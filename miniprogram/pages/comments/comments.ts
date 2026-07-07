// pages/comments/comments.ts
import { get, post } from '../../services/request';
import { isLoggedIn, getUserInfo, isProfileComplete } from '../../utils/auth';
import { isModuleEnabled } from "../../utils/util";

/** 留言数据结构 */
interface CommentItem {
  id: number;
  content: string;
  userId: number;
  nickName?: string;
  avatarUrl?: string;
  createdAt: string;
}

/** 聚光灯动画数据（仅保留必要字段，位置固定居中） */
interface SpotlightData {
  content: string;
  id: number;
}

/** 气泡动画配置（7维随机参数） */
interface BubbleConfig {
  id: number;
  content: string;
  left: number; // vw (5~95)
  startY: number; // vh (50~130)
  endY: number; // vh (-30~-180, 负值表示上升)
  delay: number; // s (0~6)
  duration: number; // s (8~12)
  fontSize: number; // px (12~18)
  color: string; // hsla 字符串
}

/** 性能配置常量 */
const MAX_VISIBLE_BUBBLES = 60; // 最大渲染气泡数（控制 WXML 节点数）
const ROTATE_INTERVAL_MS = 20000; // 气泡轮换间隔 20s
const BATCH_REPLACE_COUNT = 8; // 每次轮换替换的槽位数（5~8个）

/** 为单条留言构建气泡动画参数 */
function buildSingleConfig(item: CommentItem): BubbleConfig {
  return {
    id: item.id,
    content: item.content,
    left: Math.random() * 90 + 5, // 5~95vw，水平分布避免贴边
    startY: Math.random() * 80 + 50, // 50~130vh，部分在屏幕外底部
    endY: -(Math.random() * 150 + 30), // -30 ~ -180vh，上升距离
    delay: Math.random() * 6, // 0~6s 错落延迟
    duration: Math.random() * 4 + 8, // 8~12s 单轮周期
    fontSize: Math.random() * 6 + 12, // 12~18px 文字大小
    color: `hsla(${Math.floor(Math.random() * 360)}, 80%, 72%, 0.85)`, // 虹彩色系
  };
}

/** 从全量列表中随机采样 N 条并构建气泡配置 */
function sampleAndBuild(list: CommentItem[], maxCount: number): BubbleConfig[] {
  if (list.length <= maxCount) {
    // 数据量小时全部展示
    return list.map(buildSingleConfig);
  }
  // Fisher-Yates 洗牌算法保证随机性
  const shuffled = [...list];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, maxCount).map(buildSingleConfig);
}

/** 分页响应结构 */
interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

Page({
  /** 页面数据 */
  data: {
    bubbles: [] as BubbleConfig[], // 当前渲染的气泡数组
    inputValue: '', // 输入框内容
    showInputPanel: false, // 输入面板是否显示
    submitting: false, // 是否正在提交
    rotateTimer: null as number | null, // 轮换定时器 ID
    spotlightComment: null as SpotlightData | null, // 聚光灯高亮留言（用户自己发送的）
    showLoginPopup: false, // 登录弹窗是否显示
    statusBarHeight: 20, // 状态栏高度（px）
    /** 模块是否启用（控制整个页面是否展示） */
    moduleEnabled: true,
  },

  /** 全量留言数据（内存缓存） */
  _allComments: [] as CommentItem[],
  _totalComments: 0, // 服务端总数
  _currentPage: 0, // 已加载到第几页

  /** 槽位生命周期：记录每个气泡槽位的创建时间戳 */
  _slotLifecycle: [] as number[],

  /** 聚光灯清理定时器 */
  _spotlightTimer: null as number | null,

  /** 获取留言列表（分页加载，自动合并全量数据） */
  async fetchComments() {
    try {
      const res = await get<PaginatedResponse<CommentItem>>('/comments', { page: 1, pageSize: 50 });
      const list = res?.data || [];
      this._totalComments = res?.total || list.length;
      this._allComments = list;

      // 如果还有更多页，继续加载剩余数据
      const totalPages = res?.totalPages || 1;
      if (totalPages > 1) {
        for (let p = 2; p <= totalPages; p++) {
          const nextRes = await get<PaginatedResponse<CommentItem>>('/comments', { page: p, pageSize: 50 });
          if (nextRes?.data?.length) {
            this._allComments = this._allComments.concat(nextRes.data);
          }
        }
      }

      this._currentPage = totalPages;
      this.refreshBubbles();
      console.log(`[Comments] 加载 ${this._allComments.length} 条留言（共 ${this._totalComments} 条）`);

      // 空状态提示：如果数据库中确实没有留言数据
      if (this._totalComments === 0) {
        console.log('[Comments] 当前暂无留言，成为第一个留下足迹的人吧 ✨');
      }
    } catch (err) {
      console.error('[Comments] 获取留言失败', err);
      wx.showToast({ title: '加载失败，请重试', icon: 'none' });
    }
  },

  /** 刷新当前可见气泡（从全量数据中重新采样，全量替换） */
  refreshBubbles() {
    const bubbles = sampleAndBuild(this._allComments, MAX_VISIBLE_BUBBLES);
    // 重置所有槽位的生命周期
    this._slotLifecycle = bubbles.map(() => Date.now());
    this.setData({ bubbles });
  },

  /** 增量刷新：只替换"到期"的槽位（运行时间超过 duration + delay） */
  refreshBatch() {
    const bubbles = [...this.data.bubbles];
    if (bubbles.length === 0) return;

    const now = Date.now();
    let replacedCount = 0;

    for (let i = 0; i < bubbles.length && replacedCount < BATCH_REPLACE_COUNT; i++) {
      const slotCreatedAt = this._slotLifecycle[i];
      if (!slotCreatedAt) continue;

      const bubble = bubbles[i];
      // 计算该气泡完成一轮动画所需的时间
      const expiryMs = (bubble.duration + bubble.delay) * 1000;
      const elapsed = now - slotCreatedAt;

      if (elapsed >= expiryMs) {
        // 该槽位已到期，从全量数据中随机选一条新留言替换
        const randomIdx = Math.floor(Math.random() * this._allComments.length);
        const newComment = this._allComments[randomIdx];
        bubbles[i] = buildSingleConfig(newComment);
        this._slotLifecycle[i] = now; // 更新该槽位的创建时间
        replacedCount++;
      }
    }

    if (replacedCount > 0) {
      this.setData({ bubbles });
    }
  },

  /** 启动轮换调度器（仅数据量超过最大可见数时才有意义） */
  startRotateTimer() {
    this.stopRotateTimer(); // 先清除旧的定时器
    // 数据量不足以填满槽位时，无需轮换（没有新内容可展示）
    if (this._allComments.length <= MAX_VISIBLE_BUBBLES) {
      console.log(`[Comments] 留言数 ${this._allComments.length} ≤ ${MAX_VISIBLE_BUBBLES}，跳过轮换`);
      return;
    }
    const timer = setInterval(() => {
      this.refreshBatch();
    }, ROTATE_INTERVAL_MS) as unknown as number;
    this.setData({ rotateTimer: timer });
  },

  /** 停止轮换调度器 */
  stopRotateTimer() {
    const timer = this.data.rotateTimer;
    if (timer !== null) {
      clearInterval(timer);
      this.setData({ rotateTimer: null });
    }
  },

  /** 打开输入面板（需登录且已完善个人资料） */
  openInputPanel() {
    if (isLoggedIn() && isProfileComplete()) {
      this.setData({ showInputPanel: true });
      return;
    }
    // 未登录或资料未完善：显示统一登录弹窗（自动处理选头像+填昵称）
    this.setData({ showLoginPopup: true });
  },

  /** 登录弹窗取消回调 */
  onLoginCancel() {
    this.setData({ showLoginPopup: false });
  },

  /** 登录成功回调：关闭弹窗并打开输入面板 */
  onLoginSuccess() {
    this.setData({
      showLoginPopup: false,
      showInputPanel: true,
    });
  },

  /** 关闭输入面板 */
  closeInputPanel() {
    this.setData({ showInputPanel: false, inputValue: '' });
  },

  /** 阻止输入面板内部点击冒泡到遮罩层 */
  preventClose() {
    // 空方法，仅用于 catchtap 阻止事件冒泡
  },

  /** 监听输入框变化 */
  onInputChange(e: WechatMiniprogram.Input) {
    this.setData({ inputValue: e.detail.value });
  },

  /** 提交新留言（带防抖 + 聚光灯动画） */
  async submitComment() {
    const content = this.data.inputValue.trim();
    if (!content) return;
    if (this.data.submitting) return;

    this.setData({ submitting: true });

    try {
      // 获取当前登录用户信息
      const user = getUserInfo();

      // 调用后端接口创建留言（userId 必填）
      await post('/comments', {
        content,
        userId: user?.id || 0,
        ...(user?.nickName && { nickName: user.nickName }),
        ...(user?.avatarUrl && { avatarUrl: user.avatarUrl }),
      });

      // 构建新留言对象并插入全量列表头部
      const newComment: CommentItem = {
        id: Date.now(), // 临时ID，刷新后会替换为服务端真实ID
        content,
        userId: user?.id || 0,
        nickName: user?.nickName,
        avatarUrl: user?.avatarUrl,
        createdAt: new Date().toISOString(),
      };
      this._allComments.unshift(newComment);

      // 立即刷新气泡（新留言有更高概率出现在当前视图中）
      this.refreshBubbles();

      // ── 触发聚光灯高亮动画（仅对当前用户自己发的留言）──
      this.clearSpotlightTimer();
      this.setData({
        spotlightComment: { content, id: newComment.id },
      });
      // 3秒后自动清理聚光灯节点
      this._spotlightTimer = setTimeout(() => {
        this.setData({ spotlightComment: null });
        this._spotlightTimer = null;
      }, 3000) as unknown as number;

      // 清空输入框并关闭面板
      this.setData({ inputValue: '', showInputPanel: false });

      // wx.showToast({ title: '留下了一句话 ✨', icon: 'none' });
      // console.log('[Comments] 留言成功:', content);
    } catch (err) {
      console.error('[Comments] 提交失败', err);
      wx.showToast({ title: '发送失败，请重试', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  /** 清理聚光灯定时器 */
  clearSpotlightTimer() {
    if (this._spotlightTimer !== null) {
      clearTimeout(this._spotlightTimer);
      this._spotlightTimer = null;
    }
  },

  /** 返回上一页 */
  goBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.switchTab({ url: '/pages/home/home' });
    }
  },

  /** 生命周期 - 页面加载 */
  onLoad() {
    // 获取状态栏高度，用于顶部返回按钮定位（导航栏高度 = statusBarHeight + 44）
    const info = (wx as any).getWindowInfo ? (wx as any).getWindowInfo() : wx.getSystemInfoSync();
    this.setData({ statusBarHeight: info.statusBarHeight || 20 });

    // 检查 comments 模块是否启用（cached_modules 存在且包含 "comments"）
    if (!isModuleEnabled("comments")) {
      this.setData({ moduleEnabled: false });
      return;
    }

    // 初始化数据
    this.fetchComments();
    this.startRotateTimer();
  },

  /** 生命周期 - 页面卸载时清理定时器 */
  onUnload() {
    this.stopRotateTimer();
    this.clearSpotlightTimer();
  },

  /** 生命周期 - 页面显示时恢复轮换 */
  onShow() {
    if (!this.data.rotateTimer && this._allComments.length > 0) {
      this.startRotateTimer();
    }
  },

  /** 生命周期 - 页面隐藏时暂停轮换 + 清理聚光灯（节省性能） */
  onHide() {
    this.stopRotateTimer();
    this.clearSpotlightTimer();
    this.setData({ spotlightComment: null });
  },
});
