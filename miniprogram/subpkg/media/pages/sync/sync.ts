import { get } from "../../../../services/request";
import { getImageUrl } from "../../../../utils/util";
import { themeBehavior } from "../../../../behaviors/theme";

const app = getApp<IAppOption>();

/** 视频文件扩展名正则，用于判断 URL 是否为视频 */
const VIDEO_EXT = /\.(mp4|mov|avi|webm|mkv|m3u8)(\?|$)/i;

/** 安全拼接图片处理参数：视频文件直接返回原 URL，不拼接 imageView2 */
const getProcessedImageUrl = (url: string): string => {
  const fullUrl = getImageUrl(url);
  if (!fullUrl || VIDEO_EXT.test(fullUrl)) return fullUrl;
  return fullUrl + "?imageView2/2/w/750/q/85/format/webp";
};

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
  weibo: "/pages/assets/icons/weibo.svg",
  douyin: "/pages/assets/icons/douyin.svg",
  xiaohongshu: "/pages/assets/icons/xiaohongshu.svg",
  instagram: "/pages/assets/icons/instagram.svg",
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
  mediaList: { type: "PHOTO" | "VIDEO"; url: string; poster?: string; downloadUrl?: string }[];
  publishTime: string;
  publishTimeText: string;
  /** 单视频：loadedmetadata 后计算的锁定比例 class */
  videoAspectClass?: string;
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
  /** Phase 4：全局唯一活跃 video 卡片索引 */
  activeVideoIndex: number | null;
}

Component({
  behaviors: [themeBehavior],

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
    activeVideoIndex: null,
    tabTabs: [
      { key: "home", label: "首页", icon: "◼" },
      { key: "mine", label: "我的", icon: "◷" },
    ],
  } as PageData & { tabTabs: { key: string; label: string; icon: string }[] },

  lifetimes: {
    created() {
      (this as any)._observers = [];
      (this as any)._observedCount = 0;
    },

    attached() {
      // getWindowInfo 获取屏幕信息
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

      // Phase 1：fire-and-forget，不阻塞 onLoad 返回
      this._bootstrap();
    },

    /** Phase 3：页面卸载时清理所有 IntersectionObserver */
    detached() {
      (this as any)._observers.forEach((ob: WechatMiniprogram.IntersectionObserver) => ob.disconnect());
      (this as any)._observers = [];
    },
  },

  methods: {
    /** 返回上一页 */
    onGoBack() {
      wx.reLaunch({ url: "/pages/home/home" });
    },

    /** 切换 Tab */
    async onTabTap(e: WechatMiniprogram.BaseEvent) {
      const key = e.currentTarget.dataset.key as string;
      if (key === this.data.activeTab) return;

      // Phase 3：清理旧 observers
      (this as any)._observers.forEach((ob: WechatMiniprogram.IntersectionObserver) => ob.disconnect());
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

    /** 滚动到底部 */
    async onScrollToLower() {
      if (this.data.loadMoreLoading || !this.data.hasMore) return;
      this.setData({ loadMoreLoading: true });
      const nextPage = this.data.page + 1;
      this.setData({ page: nextPage });
      await this.fetchPosts(true);
      // Phase 3：仅观察新增卡片
      this._observeItems();
    },

    /** Phase 1：异步初始化，数据到达后关闭骨架屏并注册可视区观察 */
    async _bootstrap() {
      try {
        await this.fetchPosts();
      } catch (err) {
        console.error("初始化加载失败:", err);
      } finally {
        this.setData({ skeleton: false, listReady: true });
        // Phase 3：列表就绪后注册 IntersectionObserver
        this._observeItems();
      }
    },

    /** 获取帖子列表 */
    async fetchPosts(append = false) {
      if (this.data.loading) return;
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
        console.log("res", res);
        console.log("newCards", newCards);

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
    _observeItems() {
      const { cards } = this.data;
      for (let i = (this as any)._observedCount; i < cards.length; i++) {
        const item = cards[i];
        // 仅对多媒体卡片（需要 swiper）进行观察
        if (item.mediaList.length <= 1) continue;
        // 已挂载的跳过
        if (item.swiperVisible) continue;

        const ob = this.createIntersectionObserver({}).relativeToViewport({
          bottom: 200,
        });

        ob.observe(`#item-${i}`, (res) => {
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
    onTapPoster(e: WechatMiniprogram.BaseEvent) {
      const index = e.currentTarget.dataset.index as number;
      const prev = this.data.activeVideoIndex;
      const updates: Record<string, any> = {};

      if (prev !== null && prev !== index) {
        updates[`cards[${prev}].videoVisible`] = false;
      }
      updates[`cards[${index}].videoVisible`] = true;
      updates["activeVideoIndex"] = index;

      this.setData(updates);
    },

    /** 将后端帖子数据映射为卡片数据 */
    mapCard(post: any): FeedCard {
      // 媒体：优先 linkedMedia，兜底 images
      const mediaList: FeedCard["mediaList"] = [];
      if (post.linkedMedia && post.linkedMedia.length > 0) {
        for (const m of post.linkedMedia) {
          const isPhoto = m.mediaType === "PHOTO";
          const media = m.media || {};
          if (isPhoto && media.url) {
            mediaList.push({
              type: "PHOTO",
              url: getProcessedImageUrl(media.url),
            });
          } else if (!isPhoto) {
            // VIDEO: 优先 playUrl，回退 originalUrl
            const videoUrl = media.playUrl || media.originalUrl || media.url;
            const posterUrl = media.coverUrl || media.originalUrl || "";
            if (videoUrl) {
              mediaList.push({
                type: "VIDEO",
                url: getImageUrl(videoUrl),
                downloadUrl: getImageUrl(media.hdUrl),
                poster: posterUrl ? getProcessedImageUrl(posterUrl) : "",
              });
            }
          }
        }
      }
      // 当 mediaList 恰好包含一个 PHOTO 和一个 VIDEO 时，只展示 VIDEO，并用 PHOTO 作封面
      if (mediaList.length === 2) {
        const photoItem = mediaList.find((m: any) => m.type === "PHOTO");
        const videoItem = mediaList.find((m: any) => m.type === "VIDEO");
        if (photoItem && videoItem) {
          videoItem.poster = photoItem.url;
          mediaList.splice(mediaList.indexOf(photoItem), 1);
        }
      }
      // 兜底：images 字段
      if (mediaList.length === 0 && post.images && post.images.length > 0) {
        for (const img of post.images) {
          mediaList.push({
            type: "PHOTO",
            url: getProcessedImageUrl(img),
          });
        }
      }

      // 艺人信息：根据当前活跃平台切换对应昵称/头像
      const artistInfo = this.getArtistInfoByPlatform(
        post.artist,
        this.data.activeTab
      );
      const artistName = artistInfo.name;
      const artistAvatar = getImageUrl(artistInfo.avatar);

      const content = (post.content?.replace(/<[^>]*>/g, "") || post.title || "")
        .replace(/[\r\n]+/g, " ")
        .trim();
      const contentLength = [...content].length;

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
        videoAspectClass: "",
        swiperCurrent: 0,
        // Phase 3 & 4：初始不挂载 swiper 和 video
        swiperVisible: false,
        videoVisible: false,
      };
    },

    /** 单视频 loadedmetadata：根据原始宽高比锁定容器高度 */
    onVideoLoadedMeta(
      e: WechatMiniprogram.CustomEvent<{ width: number; height: number }>
    ) {
      const cardId = e.currentTarget.dataset.id as number;
      const { width, height } = e.detail;
      if (!width || !height) return;

      const ratio = width / height;
      let videoAspectClass: string;
      if (ratio > 1.2) {
        videoAspectClass = "aspect-horiz"; // 横版 → 16:9
      } else if (ratio < 0.8) {
        videoAspectClass = "aspect-vert"; // 竖版 → 4:5
      } else {
        videoAspectClass = "aspect-square"; // 方形 → 1:1
      }

      const cards = this.data.cards;
      const idx = cards.findIndex((c) => c.id === cardId);
      if (idx === -1) return;
      this.setData({ [`cards[${idx}].videoAspectClass`]: videoAspectClass });
    },

    /** 多图/多视频 swiper 滑动：控制视频播放/暂停 */
    onSwiperChange(e: WechatMiniprogram.SwiperChange) {
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
        const curCtx = wx.createVideoContext(`video-${cardId}-${current}`, this);
        curCtx.play();
      }

      this.setData({ [`cards[${idx}].swiperCurrent`]: current });
    },

    /** 根据平台 tab 获取艺人对应的昵称和头像 */
    getArtistInfoByPlatform(
      artist: any,
      platform: string
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
    onToggleExpand(e: WechatMiniprogram.BaseEvent) {
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
        "0"
      )}.${String(d.getDate()).padStart(2, "0")}`;
    },
  },
});
