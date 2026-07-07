import { get } from "../../services/request";
import { getImageUrl } from "../../utils/util";
import { isModuleEnabled } from "../../utils/util";
import { withTheme } from "../../behaviors/theme";
import { createNavigator, type INavigator } from "../../utils/navigator/index";

const app = getApp<IAppOption>();

/** 平台 tab 定义 */
const PLATFORM_TABS = [
  { key: "", label: "全部" },
  { key: "weibo", label: "微博" },
  { key: "douyin", label: "抖音" },
  { key: "xiaohongshu", label: "小红书" },
  { key: "instagram", label: "Instagram" },
];

/** 平台名中文映射 */
const PLATFORM_LABELS: Record<string, string> = {
  weibo: "微博",
  douyin: "抖音",
  xiaohongshu: "小红书",
  instagram: "Instagram",
};

/** 平台图标映射 */
const PLATFORM_ICONS: Record<string, string> = {
  weibo: "/assets/icons/weibo.svg",
  douyin: "/assets/icons/douyin.svg",
  xiaohongshu: "/assets/icons/xiaohongshu.svg",
  instagram: "/assets/icons/instagram.svg",
};

/** 卡片数据 */
interface FeedCard {
  id: number;
  platform: string;
  platformLabel: string;
  platformIcon: string;
  artistName: string;
  artistAvatar: string;
  content: string;
  /** 内容字符数（含空格、换行、emoji） */
  contentLength: number;
  /** 是否已展开 */
  expanded: boolean;
  /** 媒体列表（统一 PHOTO / VIDEO） */
  mediaList: {
    type: "PHOTO" | "VIDEO";
    url: string;
    poster?: string;
    downloadUrl?: string;
    width?: number;
    height?: number;
  }[];
  publishTime: string;
  publishTimeText: string;
  /** 单视频：loadedmetadata 后计算的精确高度(px) */
  videoHeight?: number;
  /** 单视频：根据后端宽高比计算的容器高度(rpx) */
  videoContainerHeight?: string;
  /** 多视频 Carousel：当前滑动帧索引 */
  swiperCurrent?: number;
  downloadUrl?: string;
  /** Phase 3：swiper 是否已进入可视区 */
  swiperVisible?: boolean;
  /** Phase 4：video 是否已被用户点击激活 */
  videoVisible?: boolean;
}

interface PageData {
  statusBarHeight: number;
  navHeight: number;
  tabBarHeight: number;
  scrollTop: number;
  tabs: typeof PLATFORM_TABS;
  activeTab: string;
  cards: FeedCard[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  loading: boolean;
  loadMoreLoading: boolean;
  /** Phase 1：首屏骨架屏 */
  skeleton: boolean;
  /** Phase 2：列表数据已就绪 */
  listReady: boolean;
  /** Phase 5：模块是否启用（控制整个页面是否展示） */
  moduleEnabled: boolean;
  /** Phase 4：全局唯一活跃 video 卡片索引 */
  activeVideoIndex: number | null;
  // Navigator v3 导航状态（createNavigator 自动管理，勿手动修改）
  disableScroll: boolean;
  _navigating: boolean;
  _navLockTime: number;
  _navStateInited: boolean;
}

/**
 * 页面实例类型
 * 用于方法内 this 注解，解决 withTheme 返回值 ThisType 丢失问题
 * WechatMiniprogram.Page.Instance 需要 DataOption 和 CustomOption 两个泛型参数
 */
type PageInstance = WechatMiniprogram.Page.Instance<
  PageData & { tabTabs: { key: string; label: string; icon: string }[] },
  Record<string, any>
> & {
  navigator?: INavigator;
};

Page(
  withTheme({
    data: {
      statusBarHeight: 40,
      navHeight: 128,
      tabBarHeight: 88,
      scrollTop: 0,
      tabs: PLATFORM_TABS,
      activeTab: "",
      cards: [] as FeedCard[],
      page: 1,
      pageSize: 20,
      total: 0,
      hasMore: true,
      loading: false,
      loadMoreLoading: false,
      skeleton: true,
      listReady: false,
      moduleEnabled: true,
      activeVideoIndex: null,
      tabTabs: [
        { key: "home", label: "首页", icon: "/assets/icons/home.png" },
        { key: "mine", label: "我的", icon: "/assets/icons/mine.png" },
      ],
      // Navigator v3 导航状态
      disableScroll: false,
      _navigating: false,
      _navLockTime: 0,
      _navStateInited: false,
    } as PageData & { tabTabs: { key: string; label: string; icon: string }[] },

    /** 页面加载：仅做轻量初始化，不阻塞渲染 */
    onLoad(this: PageInstance) {
      // 初始化 observer 数组（原 created 逻辑）
      (this as any)._observers = [];
      (this as any)._observedCount = 0;

      // 初始化 Navigator v3 调度器
      this.navigator = createNavigator(this);

      // getWindowInfo 获取屏幕信息（原 attached 逻辑）
      const windowInfo = (wx as any).getWindowInfo
        ? (wx as any).getWindowInfo()
        : wx.getSystemInfoSync();
      const screenWidth = windowInfo.screenWidth;
      const statusBarHeight = windowInfo.statusBarHeight;

      this.setData({
        statusBarHeight,
        tabBarHeight: Math.round((88 * screenWidth) / 750),
        skeleton: true,
        listReady: false,
      });
    },

    /** 页面显示时不再触发数据加载（避免阻塞 navigateTo） */
    onShow(this: PageInstance) {
      // 数据加载已迁移到 onReady（首帧渲染完成后才触发）
      // 此处保留空实现用于生命周期完整性
    },

    /** 首帧渲染完成后才开始异步加载数据 */
    onReady(this: PageInstance) {
      if (this.data.cards.length === 0) {
        this._bootstrap();
      }
    },

    /** 页面卸载时清理所有 IntersectionObserver */
    onUnload(this: PageInstance) {
      (this as any)._observers.forEach(
        (ob: WechatMiniprogram.IntersectionObserver) => ob.disconnect(),
      );
      (this as any)._observers = [];
    },

    /** 返回上一页（Navigator v3 Final Patch：检测 fallback 栈自动 reLaunch） */
    onGoBack(this: PageInstance) {
      this.navigator?.safeBack();
    },

    /** 切换 Tab */
    async onTabTap(this: PageInstance, e: WechatMiniprogram.BaseEvent) {
      const key = e.currentTarget.dataset.key as string;
      if (key === this.data.activeTab) return;

      // ✅ 模块未启用时禁止切换 tab 加载数据
      if (!isModuleEnabled("posts")) {
        console.warn("[sync] posts 模块未启用，禁止切换");
        return;
      }

      // Phase 3：清理旧 observers
      (this as any)._observers.forEach(
        (ob: WechatMiniprogram.IntersectionObserver) => ob.disconnect(),
      );
      (this as any)._observers = [];
      (this as any)._observedCount = 0;

      this.setData({
        activeTab: key,
        page: 1,
        cards: [],
        total: 0,
        hasMore: true,
        scrollTop: 0,
        activeVideoIndex: null, // Phase 4
      });
      await this.fetchPosts();
      // Phase 3：注册新卡片可视区观察
      this._observeItems();
    },

    /** 滚动时检测视频可视状态，仅当卡片完全离开视口时才暂停 */
    onScroll(this: PageInstance, e: WechatMiniprogram.ScrollViewScrollEvent) {
      const activeIdx = this.data.activeVideoIndex;
      if (activeIdx === null) return;
      // 防抖：避免滚动过程中频繁触发
      if ((this as any)._scrollTimer) clearTimeout((this as any)._scrollTimer);
      (this as any)._scrollTimer = setTimeout(() => {
        const sysInfo = (wx as any).getWindowInfo?.() || wx.getSystemInfoSync();
        const screenHeight = sysInfo.windowHeight;
        const query = this.createSelectorQuery();
        query
          .select(`#item-${activeIdx}`)
          .boundingClientRect((rect) => {
            // 仅当卡片完全离开屏幕（底部在屏幕上方 或 顶部在屏幕下方）才暂停
            if (!rect || rect.bottom < -50 || rect.top > screenHeight + 50) {
              this._pauseActiveVideo(activeIdx);
            }
          })
          .exec();
      }, 150);
    },

    /** 暂停当前活跃的视频并重置状态 */
    _pauseActiveVideo(this: PageInstance, index: number) {
      const card = this.data.cards[index];
      if (!card) return;

      // 暂停单视频
      if (card.videoVisible && card.mediaList[0]?.type === "VIDEO") {
        const ctx = wx.createVideoContext(String(card.id), this);
        ctx.pause();
      }

      // 暂停 swiper 中当前帧视频
      const swiperCur = card.swiperCurrent ?? 0;
      if (card.mediaList[swiperCur]?.type === "VIDEO") {
        const ctx = wx.createVideoContext(
          `video-${card.id}-${swiperCur}`,
          this,
        );
        ctx.pause();
      }

      // 隐藏 video 组件（回到封面态）
      this.setData({
        [`cards[${index}].videoVisible`]: false,
        activeVideoIndex: null,
      });
    },

    /** 滚动到底部 */
    async onScrollToLower(this: PageInstance) {
      if (this.data.loadMoreLoading || !this.data.hasMore) return;
      // ✅ 模块未启用时不加载更多
      if (!isModuleEnabled("posts")) return;
      this.setData({ loadMoreLoading: true });
      const nextPage = this.data.page + 1;
      this.setData({ page: nextPage });
      await this.fetchPosts(true);
      // Phase 3：仅观察新增卡片
      this._observeItems();
    },

    /** Phase 1：异步初始化，数据到达后关闭骨架屏并注册可视区观察 */
    async _bootstrap(this: PageInstance) {
      // 检查 posts 模块是否启用（cached_modules 存在且包含 "posts"）
      if (!isModuleEnabled("posts")) {
        this.setData({ moduleEnabled: false, skeleton: false, listReady: true });
        return;
      }

      // 超时保护：15 秒后无论接口是否返回都关闭骨架屏
      const timer = setTimeout(() => {
        if (this.data.skeleton) {
          this.setData({ skeleton: false, listReady: true });
        }
      }, 15000);

      try {
        await this.fetchPosts();
      } catch (err) {
        console.error("初始化加载失败:", err);
      } finally {
        clearTimeout(timer);
        this.setData({ skeleton: false, listReady: true });
        // Phase 3：列表就绪后注册 IntersectionObserver
        this._observeItems();
      }
    },

    /** 获取帖子列表 */
    async fetchPosts(this: PageInstance, append = false) {
      if (this.data.loading) return;

      // ✅ 核心守卫：模块未启用时直接返回，不发起请求
      if (!isModuleEnabled("posts")) {
        console.warn("[sync] posts 模块未启用，跳过数据请求");
        return;
      }

      this.setData({ loading: true });

      try {
        const { activeTab, page, pageSize } = this.data;
        const artistId = app.globalData.selectedCharId;
        const params: Record<string, any> = { page, pageSize, artistId };
        if (activeTab) params.platform = activeTab;

        const res = await get<{
          list: any[];
          total: number;
        }>("/sync/posts", params);

        const newCards = (res.list || []).map((p: any) => this.mapCard(p));

        if (append) {
          this.setData({
            cards: [...this.data.cards, ...newCards],
            total: res.total,
            hasMore: this.data.cards.length + newCards.length < res.total,
          });
        } else {
          this.setData({
            cards: newCards,
            total: res.total,
            hasMore: newCards.length < res.total,
          });
        }
      } catch (err) {
        console.error("获取动态失败:", err);
        wx.showToast({ title: "加载失败", icon: "none" });
      } finally {
        this.setData({ loading: false, loadMoreLoading: false });
      }
    },

    /**
     * Phase 3：为多图/多视频卡片注册 IntersectionObserver
     * 仅当卡片进入可视区（提前 200px）时才挂载 swiper 组件
     * 通过 _observedCount 实现增量注册，避免重复
     */
    _observeItems(this: PageInstance) {
      const { cards } = this.data;
      for (let i = (this as any)._observedCount; i < cards.length; i++) {
        const item = cards[i];
        // 仅对多媒体卡片（需要 swiper）进行观察
        if (item.mediaList.length <= 1) continue;
        // 已挂载的跳过
        if (item.swiperVisible) continue;

        const ob = this.createIntersectionObserver({
          nativeMode: true,
        } as WechatMiniprogram.CreateIntersectionObserverOption).relativeToViewport(
          {
            bottom: 200,
          },
        );

        ob.observe(`#item-${i}`, (res: { intersectionRatio: number }) => {
          if (!res.intersectionRatio) return;
          this.setData({ [`cards[${i}].swiperVisible`]: true });
          ob.disconnect();
        });

        (this as any)._observers.push(ob);
      }
      (this as any)._observedCount = cards.length;
    },

    /**
     * Phase 4：点击单视频封面 → 销毁上一个 video 实例 → 挂载新的
     * 全局最多同时存在 1 个 video 实例
     */
    onTapPoster(this: PageInstance, e: WechatMiniprogram.BaseEvent) {
      const index = e.currentTarget.dataset.index as number;
      const prev = this.data.activeVideoIndex;
      const updates: Record<string, any> = {};

      if (prev !== null && prev !== index) {
        updates[`cards[${prev}].videoVisible`] = false;
      }
      updates[`cards[${index}].videoVisible`] = true;
      updates["activeVideoIndex"] = index;

      // autoplay="{{item.videoVisible}}" 会让 video 挂载后自动播放
      this.setData(updates);
    },

    /** 将后端帖子数据映射为卡片数据 */
    mapCard(this: PageInstance, post: any): FeedCard {
      // 媒体：优先 linkedMedia，兜底 images
      const mediaList: FeedCard["mediaList"] = [];
      if (post.linkedMedia && post.linkedMedia.length > 0) {
        // console.log("[mapCard] linkedMedia length:", post.linkedMedia.length, "postId:", post.id);
        for (const m of post.linkedMedia) {
          const isPhoto = m.mediaType === "PHOTO";
          const media = m.media || {};
          if (isPhoto && media.url) {
            mediaList.push({
              type: "PHOTO",
              url: getImageUrl(media.url),
            });
          } else if (!isPhoto) {
            // VIDEO: 优先 playUrl，回退 originalUrl
            const videoUrl =
              media.hdUrl || media.playUrl || media.originalUrl || media.url;
            const posterUrl = media.coverUrl || media.originalUrl || "";
            if (videoUrl) {
              mediaList.push({
                type: "VIDEO",
                url: getImageUrl(videoUrl),
                downloadUrl: getImageUrl(media.hdUrl),
                poster: posterUrl ? getImageUrl(posterUrl) : "",
                width: media.width,
                height: media.height,
              });
            }
          }
        }
      }
      // 当 mediaList 恰好包含一个 PHOTO 和一个 VIDEO 时，只展示 VIDEO，并用 PHOTO 作封面
      if (mediaList.length === 2) {
        const photoItem = mediaList.find((m: any) => m.type === "PHOTO");
        const videoItem = mediaList.find((m: any) => m.type === "VIDEO");
        // console.log("[merge] mediaList:", JSON.stringify(mediaList.map(m => m.type)), "photoItem:", !!photoItem, "videoItem:", !!videoItem);
        if (photoItem && videoItem) {
          videoItem.poster = photoItem.url;
          mediaList.splice(mediaList.indexOf(photoItem), 1);
          // console.log("[merge] after splice, length:", mediaList.length);
        }
      }
      // 兜底：images 字段
      if (mediaList.length === 0 && post.images && post.images.length > 0) {
        // 抖音/微博等视频动态：raw 里携带 videoUrl 时，识别为 VIDEO 媒体
        let raw: any = post.raw;
        if (typeof raw === "string") {
          try {
            raw = JSON.parse(raw);
          } catch {
            raw = null;
          }
        }
        const videoUrl = raw?.videoUrl;
        if (videoUrl) {
          mediaList.push({
            type: "VIDEO",
            url: getImageUrl(videoUrl),
            poster: getImageUrl(raw.coverUrl || post.images[0] || ""),
            width: raw.width,
            height: raw.height,
          });
        } else {
          for (const img of post.images) {
            mediaList.push({
              type: "PHOTO",
              url: getImageUrl(img),
            });
          }
        }
      }

      // 艺人信息：根据当前活跃平台切换对应昵称/头像（兼容 Artist 大写）
      const artistInfo = this.getArtistInfoByPlatform(
        post.artist || post.Artist,
        this.data.activeTab,
      );
      const artistName = artistInfo.name;
      const artistAvatar = getImageUrl(artistInfo.avatar);

      const content = (
        post.content?.replace(/<[^>]*>/g, "") ||
        post.title ||
        ""
      )
        .replace(/[\r\n]+/g, " ")
        .trim();
      const contentLength = [...content].length;

      // 根据视频宽高比计算容器高度（rpx）
      let videoContainerHeight: string | undefined;
      const videoMedia = mediaList.find((m) => m.type === "VIDEO");
      if (videoMedia?.width && videoMedia?.height) {
        // 基础宽度 750rpx，根据宽高比计算高度
        const containerHeight = Math.round(
          750 * (videoMedia.height / videoMedia.width),
        );
        // 限制范围：最小 400rpx，最大 1200rpx
        videoContainerHeight = `${Math.max(
          400,
          Math.min(1200, containerHeight),
        )}rpx`;
      }

      return {
        id: post.id,
        platform: post.platform,
        platformLabel: PLATFORM_LABELS[post.platform] || post.platform,
        platformIcon: PLATFORM_ICONS[post.platform] || "",
        artistName,
        artistAvatar,
        content,
        contentLength,
        expanded: false,
        mediaList: mediaList.slice(0, 20),
        publishTime: post.publishTime,
        publishTimeText: this.formatTime(post.publishTime),
        swiperCurrent: 0,
        // Phase 3 & 4：初始不挂载 swiper 和 video
        swiperVisible: false,
        videoVisible: false,
        videoContainerHeight,
      };
    },

    /** 单视频 loadedmetadata：根据原始宽高比计算精确容器高度(px) */
    onVideoLoadedMeta(
      this: PageInstance,
      e: WechatMiniprogram.CustomEvent<{ width: number; height: number }>,
    ) {
      const cardId = e.currentTarget.dataset.id as number;
      const { width, height } = e.detail;
      if (!width || !height) return;

      // 根据屏幕宽度计算实际显示高度
      const windowInfo = (wx as any).getWindowInfo
        ? (wx as any).getWindowInfo()
        : wx.getSystemInfoSync();
      const screenWidth = windowInfo.screenWidth;
      // 卡片左右 padding 各 32rpx → 实际内容宽度
      const contentWidth = screenWidth - (64 * screenWidth) / 750;
      const videoHeight = Math.round(contentWidth * (height / width));

      const cards = this.data.cards;
      const idx = cards.findIndex((c) => c.id === cardId);
      if (idx === -1) return;
      this.setData({ [`cards[${idx}].videoHeight`]: videoHeight });
    },

    /** 多图/多视频 swiper 滑动：控制视频播放/暂停 */
    onSwiperChange(this: PageInstance, e: WechatMiniprogram.SwiperChange) {
      // console.log("1111111111111111111111111111111111111");

      const cardId = e.currentTarget.dataset.id as number;
      const current = e.detail.current;
      const cards = this.data.cards;
      const idx = cards.findIndex((c) => c.id === cardId);
      if (idx === -1) return;

      const card = cards[idx];
      const prev = card.swiperCurrent ?? 0;

      // 暂停上一帧视频
      if (prev !== current && card.mediaList[prev]?.type === "VIDEO") {
        const prevCtx = wx.createVideoContext(`video-${cardId}-${prev}`, this);
        prevCtx.pause();
      }

      // 播放当前帧视频
      if (card.mediaList[current]?.type === "VIDEO") {
        const curCtx = wx.createVideoContext(
          `video-${cardId}-${current}`,
          this,
        );
        curCtx.play();
      }

      this.setData({ [`cards[${idx}].swiperCurrent`]: current });
    },

    /** 根据平台 tab 获取艺人对应的昵称和头像 */
    getArtistInfoByPlatform(
      artist: any,
      platform: string,
    ): { name: string; avatar: string } {
      if (!artist) return { name: "", avatar: "" };
      const platformMap: Record<string, { nick: string; avatar: string }> = {
        weibo: { nick: "weiboNickname", avatar: "weiboAvatar" },
        douyin: { nick: "douyinNickname", avatar: "douyinAvatar" },
        xiaohongshu: { nick: "xhsNickname", avatar: "xhsAvatar" },
        instagram: { nick: "igNickname", avatar: "igAvatar" },
      };
      const mapping = platformMap[platform];
      if (mapping) {
        return {
          name: artist[mapping.nick] || artist.name || "",
          avatar: artist[mapping.avatar] || artist.avatar || "",
        };
      }
      // 全部 tab 或无匹配平台，兜底默认 name/avatar
      return { name: artist.name || "", avatar: artist.avatar || "" };
    },

    /** 切换 caption 展开/折叠 */
    onToggleExpand(this: PageInstance, e: WechatMiniprogram.BaseEvent) {
      const cardId = e.currentTarget.dataset.id as number;
      const cards = this.data.cards;
      const idx = cards.findIndex((c) => c.id === cardId);
      if (idx === -1) return;
      this.setData({ [`cards[${idx}].expanded`]: !cards[idx].expanded });
    },

    /** 格式化发布时间 */
    formatTime(dateStr: string): string {
      if (!dateStr) return "";
      const d = new Date(dateStr);
      const now = new Date();
      const diff = now.getTime() - d.getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return "刚刚";
      if (mins < 60) return `${mins}分钟前`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}小时前`;
      const days = Math.floor(hours / 24);
      if (days < 7) return `${days}天前`;
      return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(
        2,
        "0",
      )}.${String(d.getDate()).padStart(2, "0")}`;
    },
  }),
);
