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
  left: number; // vw，按内容长度动态约束（短句靠边、长句居中），范围约 10~90
  startY: number; // vh (30~130)，全屏均匀分布
  endY: number; // vh (-80~-180, 负值表示上升)，完整穿过屏幕
  delay: number; // s (0~6)
  duration: number; // s (8~12)
  fontSize: number; // px (12~18)
  color: string; // hsla 字符串
}

/** 性能配置常量 */
const MAX_VISIBLE_BUBBLES = 100; // 最大渲染气泡数（密集满屏，控制 WXML 节点上限）
const ROTATE_INTERVAL_MS = 20000; // 气泡轮换间隔 20s
const BATCH_REPLACE_COUNT = 8; // 每次轮换替换的槽位数（5~8个）
const POOL_SIZE = 600; // 评论池上限，内存对象数恒 ≤ 600
const BACKGROUND_CONCURRENCY = 4; // 后台分页加载并发数

/**
 * 水平泳道：等距 12 条，中心权重高，用于横向防碰撞 + 中心密度分布。
 * 气泡按泳道分配后加 ±4vw 抖动，天然保证 ≥ 约 8vw 水平间隔，避免中间堆叠。
 */
const LANE_COUNT = 12;
const LANE_WEIGHTS = [1, 2, 3, 4, 5, 6, 6, 5, 4, 3, 2, 1];
/** 按权重展开成泳道袋并洗牌，使分配顺序不固定、且中部泳道出现概率更高 */
const LANE_BAG: number[] = (() => {
  const bag: number[] = [];
  LANE_WEIGHTS.forEach((w, lane) => {
    for (let k = 0; k < w; k++) bag.push(lane);
  });
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
})();

/** 近似正态分布：两随机数取均值，峰值在 0.5，用于长文本居中抖动 */
function randomNormal(min: number, max: number): number {
  const n = (Math.random() + Math.random()) / 2;
  return min + (max - min) * n;
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

  /** 评论池（原 _allComments，带 POOL_SIZE 上限，内存对象数恒 ≤ 600） */
  _commentPool: [] as CommentItem[],
  /** 轮换消费队列：对评论池洗牌后入队，队空时重新填充，天然不重复 */
  _queue: [] as CommentItem[],
  _totalComments: 0, // 服务端总数
  _currentPage: 0, // 已加载到第几页
  /** 页面是否已卸载：后台加载据此停止，避免卸载后继续 setData */
  _destroyed: false,

  /** 槽位生命周期：记录每个气泡槽位的创建时间戳 */
  _slotLifecycle: [] as number[],

  /** 聚光灯清理定时器 */
  _spotlightTimer: null as number | null,

  /** 泳道轮转游标：保证 buildSingleConfig 分配的水平泳道均匀且不重复跨实例 */
  _laneCursor: 0,

  /**
   * 为单条留言构建气泡动画参数。
   * 布局策略：从「均匀随机弹幕」改为「中心密度 + 泳道防碰撞」——
   * 1. 短/中文本按 LANE_BAG 泳道分配（中心权重高），天然水平防碰撞（≥约 8vw 间隔）；
   * 2. 长文本（≥15 字）锁定中部 randomNormal(35,50)，避免越过屏幕边缘；
   * 3. 文字以 left 为中心渲染（配合 wxss 的 translateX(-50%)），不再向右溢出；
   * 4. 右下角留言按钮避让：left>75 且 startY>80 时左移 15vw。
   */
  buildSingleConfig(item: CommentItem): BubbleConfig {
    const len = item.content.length;

    let left: number;
    if (len >= 15) {
      // 长文本：锁定中部，避免 nowrap 文字跨越屏幕边缘
      left = randomNormal(35, 50);
    } else {
      // 泳道分配：中心权重高，天然保证 ≥ 约 8vw 水平间隔
      const lane = LANE_BAG[this._laneCursor % LANE_BAG.length];
      this._laneCursor++;
      const laneWidth = 100 / LANE_COUNT;
      left = (lane + 0.5) * laneWidth + (Math.random() * 8 - 4); // 泳道中心 ±4vw 抖动
      left = Math.max(5, Math.min(92, left));
    }

    // 垂直起点：30~130vh，全屏均匀
    const startY = Math.random() * 100 + 30;

    // 右下角留言按钮避让：避免文字与浮动按钮重叠
    if (left > 75 && startY > 80) {
      left -= 15;
    }

    return {
      id: item.id,
      content: item.content,
      left,
      startY,
      endY: -(Math.random() * 100 + 80), // -80 ~ -180vh，完整穿过屏幕
      delay: Math.random() * 6, // 0~6s 错落延迟
      duration: Math.random() * 4 + 8, // 8~12s 单轮周期
      fontSize: Math.random() * 6 + 12, // 12~18px 文字大小
      color: `hsla(${Math.floor(Math.random() * 360)}, 80%, 72%, 0.85)`, // 虹彩色系
    };
  },

  /**
   * 从评论池中采样 maxCount 条并构建气泡配置。
   * 仅对前 maxCount 个位置做部分 Fisher-Yates 洗牌，时间复杂度 O(maxCount)，
   * 随机性与全量洗牌一致，但避免对万级列表做 O(N) 操作。
   */
  sampleAndBuild(list: CommentItem[], maxCount: number): BubbleConfig[] {
    if (list.length <= maxCount) {
      // 数据量小时全部展示
      return list.map((c) => this.buildSingleConfig(c));
    }
    // 部分洗牌：只在前 maxCount 个位置随机交换
    const idx = Array.from({ length: list.length }, (_, i) => i);
    for (let i = 0; i < maxCount; i++) {
      const j = i + Math.floor(Math.random() * (list.length - i));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    return idx.slice(0, maxCount).map((i) => this.buildSingleConfig(list[i]));
  },

  /**
   * 获取留言列表：先拉第 1 页并立即渲染气泡，再 fire-and-forget 启动后台并发加载。
   * 方法在首屏渲染后即可返回，使 onLoad 能在 await 后启动轮换定时器。
   */
  async fetchComments() {
    try {
      const res = await get<PaginatedResponse<CommentItem>>('/comments', { page: 1, pageSize: 50 });
      const list = res?.data || [];
      this._totalComments = res?.total || list.length;
      // 写入评论池并按 POOL_SIZE 截断（首屏一般不会超，但防御性处理）
      this._commentPool = list.slice(0, POOL_SIZE);

      // 首屏：先渲染气泡，再基于当前可见气泡填充轮换队列（避免队列含正在展示的内容）
      this.refreshBubbles();
      this._fillQueue();
      console.log(`[Comments] 首屏加载 ${this._commentPool.length} 条（共 ${this._totalComments} 条）`);

      // 空状态提示：如果数据库中确实没有留言数据
      if (this._totalComments === 0) {
        console.log('[Comments] 当前暂无留言，成为第一个留下足迹的人吧 ✨');
      }

      // 后台继续加载剩余页（池满即停），不阻塞首屏
      const totalPages = res?.totalPages || 1;
      if (totalPages > 1) {
        this._loadRemainingInBackground(totalPages).catch((err) =>
          console.error('[Comments] 后台加载异常', err)
        );
      }
    } catch (err) {
      console.error('[Comments] 获取留言失败', err);
      wx.showToast({ title: '加载失败，请重试', icon: 'none' });
    }
  },

  /**
   * 后台并发加载剩余页：剩余页号按 BACKGROUND_CONCURRENCY 分批，
   * 批内 Promise.all 并发、批间串行；每批结果 concat 入池并按 POOL_SIZE 截断；
   * 循环前若池已满立即 break，绝不请求剩余页。单页失败用 .catch 隔离。
   */
  async _loadRemainingInBackground(totalPages: number): Promise<void> {
    const remainingPages: number[] = [];
    for (let p = 2; p <= totalPages; p++) remainingPages.push(p);

    for (let i = 0; i < remainingPages.length; i += BACKGROUND_CONCURRENCY) {
      if (this._destroyed) return; // 页面已卸载，停止加载
      if (this._commentPool.length >= POOL_SIZE) break; // 池满即停

      const batch = remainingPages.slice(i, i + BACKGROUND_CONCURRENCY);
      const results = await Promise.all(
        batch.map((p) =>
          get<PaginatedResponse<CommentItem>>('/comments', { page: p, pageSize: 50 })
            .then((r) => (r?.data?.length ? r.data : []))
            .catch(() => [] as CommentItem[])
        )
      );

      for (const data of results) {
        if (data.length === 0) continue;
        this._commentPool = this._commentPool.concat(data);
        if (this._commentPool.length > POOL_SIZE) {
          this._commentPool.length = POOL_SIZE; // 截断，保持内存上限
        }
      }
      this._currentPage = Math.min(i + BACKGROUND_CONCURRENCY, totalPages);
    }
    console.log(`[Comments] 后台加载完成，评论池 ${this._commentPool.length} 条`);

    // 关键修复：首屏 pool=50≤60 时 startRotateTimer 会跳过，
    // 此处池已补满（95>60）且定时器仍为空，主动启动轮换，解除对 onShow 时序的依赖
    if (this._commentPool.length > MAX_VISIBLE_BUBBLES && !this.data.rotateTimer) {
      this.startRotateTimer();
    }
  },

  /** 刷新当前可见气泡（从评论池中重新采样，全量替换） */
  refreshBubbles() {
    this._laneCursor = 0; // 每轮全量重建时重置泳道游标，保证覆盖所有泳道
    const bubbles = this.sampleAndBuild(this._commentPool, MAX_VISIBLE_BUBBLES);
    // 重置所有槽位的生命周期
    this._slotLifecycle = bubbles.map(() => Date.now());
    this.setData({ bubbles });
  },

  /** 对当前评论池洗牌填充轮换队列（剔除当前正在显示的 bubble，避免同一内容同时出现在两个槽位） */
  _fillQueue() {
    const showingIds = new Set(this.data.bubbles.map((b) => b.id));
    const pool = this._commentPool.filter((c) => !showingIds.has(c.id));
    // Fisher-Yates 全量洗牌（池 ≤ 600，开销可接受）
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    this._queue = pool;
  },

  /** 增量刷新：只替换"到期"的槽位（运行时间超过 duration + delay），从队列队首取评论 */
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
        // 队列为空则重新填充（洗牌），队首取一条天然不重复
        if (this._queue.length === 0) {
          this._fillQueue();
        }
        const newComment = this._queue.shift();
        if (!newComment) break; // 池中无数据，停止本次替换
        bubbles[i] = this.buildSingleConfig(newComment);
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
    if (this._commentPool.length <= MAX_VISIBLE_BUBBLES) {
      console.log(`[Comments] 留言数 ${this._commentPool.length} ≤ ${MAX_VISIBLE_BUBBLES}，跳过轮换`);
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

      // 构建新留言对象并插入评论池头部（按 POOL_SIZE 截断，防止内存无限增长）
      const newComment: CommentItem = {
        id: Date.now(), // 临时ID，刷新后会替换为服务端真实ID
        content,
        userId: user?.id || 0,
        nickName: user?.nickName,
        avatarUrl: user?.avatarUrl,
        createdAt: new Date().toISOString(),
      };
      this._commentPool.unshift(newComment);
      if (this._commentPool.length > POOL_SIZE) {
        this._commentPool.pop();
      }
      // 新留言直接插入当前气泡画面：替换"生命周期最老"的一个槽位
      // 仅重启那一个气泡（wx:key="index" 不变，其余动画不受影响）；
      // 同步 _slotLifecycle 防止被 refreshBatch 按旧生命周期误判到期、重复替换。
      // 不进轮换队列 _queue：新评论已展示在 bubbles 中，_fillQueue 会用 showingIds
      // 剔除它，避免同一条评论在画面与轮换队列中重复出现。
      const bubbles = [...this.data.bubbles];
      if (bubbles.length > 0) {
        let oldestIdx = 0;
        let oldestTime = this._slotLifecycle[0] ?? Date.now();
        for (let i = 1; i < this._slotLifecycle.length; i++) {
          const t = this._slotLifecycle[i] ?? Date.now();
          if (t < oldestTime) {
            oldestTime = t;
            oldestIdx = i;
          }
        }
        bubbles[oldestIdx] = this.buildSingleConfig(newComment);
        this._slotLifecycle[oldestIdx] = Date.now();
        this.setData({ bubbles });
      } else {
        // 极端情况：首屏气泡尚未加载完成，直接追加，保证立即可见
        bubbles.push(this.buildSingleConfig(newComment));
        this._slotLifecycle.push(Date.now());
        this.setData({ bubbles });
      }

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
  async onLoad() {
    // 获取状态栏高度，用于顶部返回按钮定位（导航栏高度 = statusBarHeight + 44）
    const info = (wx as any).getWindowInfo ? (wx as any).getWindowInfo() : wx.getSystemInfoSync();
    this.setData({ statusBarHeight: info.statusBarHeight || 20 });

    // 检查 comments 模块是否启用（cached_modules 存在且包含 "comments"）
    if (!isModuleEnabled("comments")) {
      this.setData({ moduleEnabled: false });
      return;
    }

    this._destroyed = false;
    // 首屏拉第 1 页并渲染后，再启动轮换定时器（此时评论池已有数据）
    await this.fetchComments();
    this.startRotateTimer();
  },

  /** 生命周期 - 页面卸载时清理定时器并标记销毁（停止后台加载） */
  onUnload() {
    this._destroyed = true;
    this.stopRotateTimer();
    this.clearSpotlightTimer();
  },

  /** 生命周期 - 页面显示时恢复轮换 */
  onShow() {
    if (!this.data.rotateTimer && this._commentPool.length > 0) {
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
