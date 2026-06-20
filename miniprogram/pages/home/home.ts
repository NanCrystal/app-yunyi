import { get } from "../../services/request";
import type {
  Character,
  PostItem,
  EventItem,
  Photocard,
  AudioItem,
  PhotoItem,
  VideoItem,
} from "../../utils/types";
import { withTheme } from "../../behaviors/theme";
import { parseColorToRgb } from "../../utils/theme";
import {
  getThumbUrl,
  getThumbFullUrl,
  getImageUrl,
  formatDateDot,
  formatTimeShort,
  formatDateChinese,
  formatMonthDayChinese,
  formatYearMonthChinese,
  formatMonthAbbrUpper,
  formatMonthDayNum,
} from "../../utils/util";
import { characters as localCharacters } from "../../utils/data";
import { colorList } from "../../services/api";
import { createNavigator, type INavigator } from "../../utils/navigator/index";

const app = getApp<IAppOption>();

/** 艺人 accentColor 映射 */
const colorMap: Record<string, string> = {};
localCharacters.forEach((c) => {
  const colorItem = colorList.find(
    (cl: { name: string; accentColor: string }) => cl.name === c.artistId
  );
  if (colorItem?.accentColor) {
    colorMap[c.artistId] = colorItem.accentColor;
  }
});

/** 平台名映射 */
const platformLabel: Record<string, string> = {
  weibo: "WEIBO",
  douyin: "DOUYIN",
  xiaohongshu: "XIAOHONGSHU",
  instagram: "INSTAGRAM",
};

/** 平台图标映射 */
const platformIconMap: Record<string, string> = {
  weibo: "/assets/icons/weibo.svg",
  douyin: "/assets/icons/douyin.svg",
  xiaohongshu: "/assets/icons/xiaohongshu.svg",
  instagram: "/assets/icons/instagram.svg",
};

/** 行程状态映射 */
const statusLabel: Record<string, string> = {
  pending: "upcoming",
  ongoing: "ongoing",
  completed: "completed",
  cancelled: "cancelled",
};

// ─── 数据类型定义 ───

/** 后端返回的聚合数据结构 */
interface IntegrationData {
  modules?: { key: string; name: string; sortOrder: number }[];
  banners: { artistId: string; data: any }[];
  posts: { artistId: string; data: any }[];
  photos: { artistId: string; data: any }[];
  videos: { artistId: string; data: any }[];
  audios: { artistId: string; data: any }[];
  photoCards: { artistId: string; data: any }[];
  itineraries: { artistId: string; data: any }[];
}

interface HomeData {
  currentTime: string;
  heroImages: string[];
  currentSlide: number;
  characters: Character[];
  selectedCharId: string;
  activeChar: Character;
  latestPost: PostItem | null;
  upcomingEvents: EventItem[];
  featuredPhotos: PhotoItem[];
  featuredVideo: VideoItem | null;
  photocards: Photocard[];
  birthdayTrack: AudioItem | null;
  playingTrackId: string | null;
  isPlayingAudio: boolean;
  tabTabs: { key: string; label: string; icon: string }[];
  showImagePreview: boolean;
  previewImages: string[];
  previewImageIndex: number;
  showVideoPreview: boolean;
  previewVideoUrl: string;
  previewVideoPoster: string;
  previewVideoTitle: string;
  // 安全区域
  safeBottom: number;
  // 滚动位置
  scrollTop: number;
  // 角色切换弹窗
  showSwitchDialog: boolean;
  switchCharAvatar: string;
  switchCharName: string;
  switchCharColor: string;
  switchProgress: number;
  switchProgressText: string;
  // 标题展开状态
  postExpanded: boolean;
  // 加载状态
  isLoading: boolean;
  loadingStates: Record<string, boolean>;
  // 错误状态
  hasError: boolean;
  errorStates: Record<string, boolean>;
  // 动态模块列表
  moduleList: { key: string; name: string; sortOrder: number }[];
  // 排序后的可渲染模块列表
  sortedModuleList: { key: string; name: string; sortOrder: number }[];
  // 是否包含 banner 模块
  hasBannerModule: boolean;
  // Navigator v3 导航状态（createNavigator 自动管理，勿手动修改）
  disableScroll: boolean;
  _navigating: boolean;
  _navLockTime: number;
  _navStateInited: boolean;
}

/** 页面实例类型，用于方法内 this 注解 */
type HomePageInstance = WechatMiniprogram.Page.Instance<
  HomeData,
  Record<string, any>
> & {
  navigator?: INavigator;
};

/** 分包页面路径映射（key → 完整路径） */
const SUBPKG_PAGES: Record<string, string> = {};

/** 模块配置缓存 key 前缀 */
const MODULES_CACHE_KEY_PREFIX = "home_modules_";

/**
 * 扩展新模块只需2步：
 *在 RENDERABLE_MODULES 添加 key
 * 在 wxml 添加 <template name="tmpl-newKey">
 *  可渲染模块白名单（key → template name 映射） */
const RENDERABLE_MODULES: Record<string, string> = {
  posts: "posts",
  itineraries: "itineraries",
  photos: "photos",
  videos: "videos",
  photoCards: "photoCards",
  audios: "audios",
};

Page(
  withTheme({
    data: {
      statusBarHeight: 20,
      safeBottom: 0,
      showSwitchDialog: false,
      switchCharAvatar: "",
      switchCharName: "",
      switchCharColor: "rgb(86, 164, 173)",
      switchProgress: 0,
      switchProgressText: "0.0%",
      navTitle: "",
      scrollTop: 0,
      currentTime: "12:00:00",
      heroImages: [] as string[],
      currentSlide: 0,
      characters: [] as Character[],
      selectedCharId: "haoyiran",
      activeChar: null as unknown as Character,
      latestPost: null as PostItem | null,
      upcomingEvents: [] as EventItem[],
      featuredPhotos: [] as PhotoItem[],
      featuredVideo: null as VideoItem | null,
      photocards: [] as Photocard[],
      birthdayTrack: null as AudioItem | null,
      playingTrackId: null as string | null,
      isPlayingAudio: false,
      tabTabs: [
        { key: "home", label: "首页", icon: "/assets/icons/home.png" },
        { key: "mine", label: "我的", icon: "/assets/icons/mine.png" },
      ] as { key: string; label: string; icon: string }[],
      showImagePreview: false,
      previewImages: [] as string[],
      previewImageIndex: 0,
      showVideoPreview: false,
      previewVideoUrl: "",
      previewVideoPoster: "",
      previewVideoTitle: "",
      // 加载状态
      isLoading: true,
      postExpanded: false,
      loadingStates: {
        hero: true,
        posts: true,
        itineraries: true,
        photos: true,
        videos: true,
        photoCards: true,
        audios: true,
      },
      // 错误状态
      hasError: false,
      errorStates: {
        posts: false,
        itineraries: false,
        photos: false,
        videos: false,
        photoCards: false,
        audios: false,
      },
      // 动态模块列表（从后端配置获取）
      moduleList: [] as { key: string; name: string; sortOrder: number }[],
      // 排序后的可渲染模块列表
      sortedModuleList: [] as {
        key: string;
        name: string;
        sortOrder: number;
      }[],
      // 是否包含 banner 模块
      hasBannerModule: false,
      // Navigator v3 导航状态
      disableScroll: false,
      _navigating: false,
      _navLockTime: 0,
      _navStateInited: false,
    } as HomeData,

    /** 页面加载：获取系统信息并初始化数据 */
    onLoad(this: HomePageInstance) {
      const info = (wx as any).getWindowInfo
        ? (wx as any).getWindowInfo()
        : wx.getSystemInfoSync();
      const { statusBarHeight } = info;
      const safeBottom = info.safeAreaInsets?.bottom || 0;
      this.setData({ statusBarHeight, safeBottom });
      // 初始化 Navigator v3 调度器
      this.navigator = createNavigator(this);
      this.initData();
      // this.startClock();
    },

    /** 页面显示时重置导航状态（从子页返回或 reLaunch 回来） */
    onShow(this: HomePageInstance) {
      this.navigator?.reset();
    },

    /** 页面卸载：清理定时器 */
    onUnload(this: HomePageInstance) {
      // this.stopClock();
    },

    // ───────────── 核心数据加载 ─────────────

    /** 根据模块配置计算排序后的可渲染列表 */
    buildSortedModuleList(
      moduleList: { key: string; name: string; sortOrder: number }[]
    ) {
      return moduleList
        .filter((m) => RENDERABLE_MODULES[m.key])
        .sort((a, b) => a.sortOrder - b.sortOrder);
    },

    async initData(this: HomePageInstance) {
      const selectedCharId = (app.globalData.selectedCharId ||
        "haoyiran") as string;

      // 1. 加载模块配置（先读缓存，没有则请求）
      let moduleList = this.loadModuleConfigFromCache(selectedCharId) || [];
      if (!moduleList || moduleList.length === 0) {
        try {
          const modRes = await get("/integration/home/modules", {
            artistId: selectedCharId,
          });
          moduleList = modRes.modules || [];
          if (moduleList?.length > 0) {
            wx.setStorageSync(
              MODULES_CACHE_KEY_PREFIX + selectedCharId,
              moduleList
            );
          }
        } catch (e) {
          console.warn("模块配置加载失败，使用空列表", e);
          moduleList = [];
        }
      }
      this.setData({
        moduleList,
        sortedModuleList: this.buildSortedModuleList(moduleList),
        hasBannerModule: moduleList.some(
          (m: { key: string }) => m.key === "banners"
        ),
      });

      // 初始化加载状态（基于 moduleList 动态生成）
      const baseLoadingStates: Record<string, boolean> = { hero: true };
      const baseErrorStates: Record<string, boolean> = {};
      for (const m of moduleList) {
        baseLoadingStates[m.key] = true;
        baseErrorStates[m.key] = false;
      }

      this.setData({
        isLoading: true,
        loadingStates: baseLoadingStates,
        hasError: false,
        errorStates: baseErrorStates,
      });

      try {
        const data: IntegrationData = await get("/integration/home/data", {
          artistId: selectedCharId,
        });

        // 2. 校验并更新模块配置缓存
        if (data.modules && data.modules.length > 0) {
          const cachedStr = wx.getStorageSync(
            MODULES_CACHE_KEY_PREFIX + selectedCharId
          );
          const serverModules = JSON.stringify(data.modules);
          if (cachedStr !== serverModules) {
            // 缓存不一致，更新
            moduleList = data.modules || [];
            wx.setStorageSync(
              MODULES_CACHE_KEY_PREFIX + selectedCharId,
              moduleList
            );
            this.setData({
              moduleList,
              sortedModuleList: this.buildSortedModuleList(moduleList),
              hasBannerModule: moduleList.some(
                (m: { key: string }) => m.key === "banners"
              ),
            });
          }
        }

        // 3. 解析各模块数据
        const setDataObj: any = {};

        // Banner → heroImages
        const heroImages: string[] = (data.banners || []).flatMap((b) => {
          const img = b.data?.imageUrl;
          if (Array.isArray(img)) return img;
          if (typeof img === "string") return [img];
          return [];
        });
        setDataObj.heroImages =
          heroImages.length > 0 ? heroImages.map(getImageUrl) : [];

        // 按模块配置解析数据字段
        for (const mod of moduleList) {
          switch (mod.key) {
            case "posts": {
              const postRaw = data.posts?.[0]?.data;
              setDataObj.latestPost = postRaw ? this.mapPost(postRaw) : null;
              break;
            }
            case "itineraries": {
              setDataObj.upcomingEvents = (data.itineraries || []).flatMap(
                (item: any) =>
                  (item.data || []).map((e: any) => this.mapEvent(e))
              );
              break;
            }
            case "photos": {
              setDataObj.featuredPhotos = (data.photos || [])
                .flatMap((item: any) =>
                  (item.data || []).map((p: any) => this.mapPhoto(p))
                )
                .map((p: any) => ({
                  ...p,
                  url: getThumbUrl(p.url),
                  reviewImageUrl: getThumbFullUrl(p.url),
                }));
              break;
            }
            case "videos": {
              const videoRaw = data.videos?.[0]?.data;
              setDataObj.featuredVideo = videoRaw
                ? this.mapVideo(videoRaw)
                : null;
              break;
            }
            case "photoCards": {
              setDataObj.photocards = (data.photoCards || [])
                .flatMap((item: any) =>
                  (item.data || []).map((c: any) => this.mapCard(c))
                )
                .map((c: any) => ({
                  ...c,
                  imageUrl: getThumbUrl(c.imageUrl),
                  reviewImageUrl: getThumbFullUrl(c.imageUrl),
                }));
              break;
            }
            case "audios": {
              const audioRaw = data.audios?.[0]?.data;
              setDataObj.birthdayTrack = audioRaw
                ? this.mapAudio(audioRaw)
                : null;
              break;
            }
          }
        }

        // Characters（本地数据）
        const activeChar =
          localCharacters.find((c) => c.artistId === selectedCharId) ||
          localCharacters[0];

        // 构建完成状态的 loadingStates
        const doneLoadingStates: Record<string, boolean> = { hero: false };
        for (const m of moduleList) {
          doneLoadingStates[m.key] = false;
        }

        this.setData({
          ...setDataObj,
          characters: localCharacters.map((c) => ({
            ...c,
            avatar: getThumbUrl(c.avatar),
          })),
          selectedCharId,
          activeChar: {
            ...activeChar,
            avatar: getThumbUrl(activeChar.avatar),
          },
          playingTrackId: app.globalData.playingTrackId,
          isPlayingAudio: app.globalData.isPlayingAudio,
          isLoading: false,
          loadingStates: doneLoadingStates,
        });

        this.setData({ navTitle: activeChar.artistId.toUpperCase() });
        this.restoreScrollPosition();
      } catch (err) {
        console.error("首页数据加载失败:", err);

        // 兜底：确保角色列表可用
        const fallbackChar =
          localCharacters.find((c) => c.artistId === selectedCharId) ||
          localCharacters[0];

        // 构建错误状态的 loading/error states
        const errLoadingStates: Record<string, boolean> = { hero: false };
        const errErrorStates: Record<string, boolean> = {};
        for (const m of moduleList) {
          errLoadingStates[m.key] = false;
          errErrorStates[m.key] = true;
        }

        this.setData({
          characters: localCharacters.map((c) => ({
            ...c,
            avatar: getThumbUrl(c.avatar),
          })),
          selectedCharId,
          activeChar: fallbackChar,
          navTitle: fallbackChar.artistId.toUpperCase(),
          hasError: true,
          isLoading: false,
          loadingStates: errLoadingStates,
          errorStates: errErrorStates,
        });
      }
    },

    /** 从本地缓存读取模块配置 */
    loadModuleConfigFromCache(
      this: HomePageInstance,
      artistId: string
    ): { key: string; name: string; sortOrder: number }[] | null {
      try {
        return wx.getStorageSync(MODULES_CACHE_KEY_PREFIX + artistId) || null;
      } catch {
        return null;
      }
    },

    // ───────────── 数据映射 ─────────────

    mapPost(this: HomePageInstance, post: any): PostItem {
      // 解析 raw JSON（包含原始平台数据，如抖音的 video_download_url、cover_url）
      const raw =
        typeof post.raw === "string" ? JSON.parse(post.raw) : post.raw || {};

      // 兜底：当后端 linkedMedia 的 url 为空时，从 raw 提取
      const fallbackVideoUrl = raw.video_download_url || "";
      const fallbackCoverUrl = raw.cover_url || "";

      // 优先使用 linkedMedia（本地存储的稳定链接），兜底用 images（平台原始链接，可能过期）
      // 兼容多种结构：
      //   1. 聚合接口: linkedMedia: [{type, url, sortOrder}] ← 后端 bug: url 可能为空
      //   2. 原始接口: linkedMedia: [{mediaType, media: {playUrl, hdUrl, coverUrl}}]
      const mediaList: PostItem["mediaList"] = (
        post.linkedMedia ||
        post.mediaLinks ||
        []
      )
        .map((m: any) => {
          const type = (m.type || m.mediaType) as "PHOTO" | "VIDEO";
          // 优先级: m.url → m.media.playUrl → raw.video_download_url
          const videoUrl =
            m.url ||
            m.media?.playUrl ||
            m.media?.originalUrl ||
            m.video?.playUrl ||
            fallbackVideoUrl;
          const photoUrl = m.url || m.media?.url || m.photo?.url || "";
          return {
            type,
            url: getImageUrl(type === "VIDEO" ? videoUrl : photoUrl),
            ...(type === "VIDEO"
              ? {
                  coverUrl: getThumbUrl(
                    m.media?.coverUrl || m.video?.coverUrl || fallbackCoverUrl
                  ),
                  hdUrl: getImageUrl(m.media?.hdUrl || videoUrl || ""),
                }
              : {}),
          };
        })
        .slice(0, 3);

      // 如果 linkedMedia 全是空 URL 且有 images，用 images 补充
      if (
        mediaList.length > 0 &&
        mediaList.every((m) => !m.url) &&
        post.images?.length > 0
      ) {
        mediaList.splice(0);
        post.images
          .slice(0, 3)
          .forEach((img: string) =>
            mediaList.push({ type: "PHOTO" as const, url: getImageUrl(img) })
          );
      }

      return {
        id: String(post.id),
        title: post.content || post.title || "",
        date: formatDateDot(post.publishTime),
        images: post.images || [],
        publishedTime: post.publishTime || "",
        platform: (platformLabel[post.platform] ||
          "WEIBO") as PostItem["platform"],
        platformIcon: platformIconMap[post.platform] || platformIconMap.weibo,
        icon: "share",
        authorName: (post.artist || post.Artist)?.name || "",
        authorAvatar: getThumbUrl((post.artist || post.Artist)?.avatar || ""),
        mediaList,
      };
    },

    mapEvent(this: HomePageInstance, itinerary: any): EventItem {
      return {
        id: String(itinerary.id),
        status: (statusLabel[itinerary.status] ||
          "ongoing") as EventItem["status"],
        title: itinerary.title || "",
        location: itinerary.location || "",
        date: formatMonthDayNum(itinerary.startTime),
        time: formatTimeShort(itinerary.startTime),
        imageUrl: getImageUrl(itinerary.poster || ""),
      };
    },

    mapPhoto(this: HomePageInstance, photo: any): PhotoItem {
      return {
        id: String(photo.id),
        url: photo.url || "",
        date: formatDateChinese(photo.shootDate),
        day: formatMonthDayChinese(photo.shootDate),
        month: formatYearMonthChinese(photo.shootDate),
        monthAbbr: formatMonthAbbrUpper(photo.shootDate),
        title: photo.title || photo.description || "",
        file_name: photo.fileName || "",
        location: "",
        tags: [],
        type: "Portrait" as const,
        region: "Shanghai" as const,
        system: "Phase One" as const,
      };
    },

    mapVideo(this: HomePageInstance, video: any): VideoItem {
      return {
        id: String(video.id),
        title: video.title || video.description || "",
        duration: "",
        date: formatDateDot(video.shootDate),
        thumbnail: getImageUrl(video.coverUrl || ""),
        reviewImageUrl: getImageUrl(video.playUrl || ""),
        tags: [],
        description: video.description || "",
        platform: video.tagPlatform?.name || "",
        publishedTime: "",
      };
    },

    mapCard(this: HomePageInstance, card: any): Photocard {
      return {
        id: String(card.id),
        title: card.name || "",
        date: formatDateDot(card.createdAt),
        imageUrl: card.frontImage || "",
      };
    },

    mapAudio(this: HomePageInstance, audio: any): AudioItem {
      return {
        id: String(audio.id),
        title: audio.title || audio.fileName || "",
        duration: "",
        durationSec: audio.duration || 0,
        thumbnail: getImageUrl(audio.coverUrl || ""),
        author: audio.artistId.toUpperCase() || "",
        date: formatDateDot(audio.shootDate),
        bitRate: "",
        coverUrl: getImageUrl(audio.coverUrl || ""),
        audioUrl: getImageUrl(audio.originalUrl || ""), // 补充音频 URL
      };
    },

    // ───────────── Hero 轮播 ─────────────

    /** swiper 切换时同步指示器状态 */
    onSwiperChange(this: HomePageInstance, e: WechatMiniprogram.SwiperChange) {
      this.setData({ currentSlide: e.detail.current });
    },

    // ───────────── 事件处理 ─────────────

    /** 重新加载数据 */
    onRetryLoad(this: HomePageInstance) {
      this.initData();
    },

    /** 切换标题展开/收起 */
    onTogglePostExpand(this: HomePageInstance) {
      this.setData({
        postExpanded: !this.data.postExpanded,
      });
    },

    onSlideTap(this: HomePageInstance, e: WechatMiniprogram.BaseEvent) {
      const index = e.currentTarget.dataset.index as number;
      this.setData({ currentSlide: index });
    },

    onCharTap(this: HomePageInstance, e: WechatMiniprogram.BaseEvent) {
      const artistId = e.currentTarget.dataset.id as string;
      if (artistId === this.data.selectedCharId) return;

      // 找到目标角色
      const targetChar = this.data.characters.find(
        (c: Character) => c.artistId === artistId
      );
      if (!targetChar) return;

      // 显示切换弹窗
      this.setData({
        showSwitchDialog: true,
        switchCharAvatar: targetChar.avatar,
        switchCharName: targetChar.name,
        switchCharColor:
          colorMap[artistId] || targetChar.accentColor || "rgb(86, 164, 173)",
        switchProgress: 0,
        switchProgressText: "0.0%",
      });

      // 3秒进度动画，每100ms递增0.0333 (30步到1.0)
      let step = 0;
      const totalSteps = 30; // 3000ms / 100ms
      const timer = setInterval(() => {
        step++;
        if (step > totalSteps) {
          clearInterval(timer);
          return;
        }
        const progress = Math.min(step / totalSteps, 1);
        this.setData({
          switchProgress: progress,
          switchProgressText: (progress * 100).toFixed(1) + "%",
        });
      }, 100);

      // 3秒后执行切换并关闭弹窗
      setTimeout(() => {
        clearInterval(timer);
        const targetColor = colorMap[artistId] || "rgb(86, 164, 173)";
        const rgb = parseColorToRgb(targetColor);

        // 更新全局状态（必须在 initData 前完成）
        app.globalData.selectedCharId = artistId;
        app.globalData.selectedCharAccentColor = targetColor;

        // 关闭弹窗、回到顶部、同时一次性写入全部 4 个主题字段
        this.setData({
          showSwitchDialog: false,
          switchProgress: 0,
          scrollTop: 0,
          themeColor: targetColor,
          themeR: rgb.r,
          themeG: rgb.g,
          themeB: rgb.b,
        });

        // 异步加载数据，完成后再次强制刷新主题
        this.initData().then(
          () => {
            (this as any).refreshTheme();
          },
          () => {
            (this as any).refreshTheme();
          }
        );
      }, 3000);
    },

    onGoIndex(this: HomePageInstance) {
      wx.reLaunch({ url: "/pages/index/index" });
    },

    /** 记录滚动位置 */
    onHomeScroll(
      this: HomePageInstance,
      e: WechatMiniprogram.ScrollViewScroll
    ) {
      this.data.scrollTop = e.detail.scrollTop;
    },

    /** 保存滚动位置到全局 */
    saveScrollPosition(this: HomePageInstance) {
      app.globalData.homeScrollTop = this.data.scrollTop || 0;
    },

    /** 恢复滚动位置
     *  ⚠️ 核心保护：导航进行中直接 return，跳过双 setData 阻塞链
     *  （restoreScrollPosition 的 setData(scrollTop+1) → nextTick → setData(saved)
     *   是 glass-easel 下 render queue 爆炸源，会导致 navigateTo 永远等不到 idle）
     */
    restoreScrollPosition(this: HomePageInstance) {
      if (this.data._navigating) return;
      const saved = app.globalData.homeScrollTop;
      if (saved && saved > 0) {
        delete app.globalData.homeScrollTop;
        // 先设一个不同值再设目标值，触发 scroll-view 滚动
        this.setData({ scrollTop: saved + 1 }, () => {
          wx.nextTick(() => {
            this.setData({ scrollTop: saved });
          });
        });
      }
    },

    /** 判断是否为 DevTools glass-easel 超时类错误 */
    isTimeoutError(err: any): boolean {
      const msg = (err?.errMsg || err?.message || "").toLowerCase();
      return msg.includes("timeout") || msg.includes("超时");
    },

    /**
     * @deprecated 已废弃，请使用 this.navigator.navigate(url)
     * Navigator v3 调度器已内置三层打断 + fallback 降级链，无需手动调用
     */
    safeNavigateTo(this: HomePageInstance, url: string): void {
      // 委托给 Navigator v3
      this.navigator?.navigate(url);
      if (!this.navigator) {
        // 兜底：未初始化时走原始逻辑
        wx.navigateTo({
          url,
          fail: (err: any) => {
            if (this.isTimeoutError(err)) {
              console.warn(
                "[DevTools兼容] navigateTo 超时，降级为 redirectTo。",
                url
              );
            } else {
              console.error("[nav] navigateTo 失败，降级 redirectTo:", err);
            }
            wx.redirectTo({ url });
          },
        });
      }
    },

    onNavigate(this: HomePageInstance, e: WechatMiniprogram.CustomEvent) {
      const key = e.detail.key as string;
      const url = SUBPKG_PAGES[key] || `/pages/${key}/${key}`;
      this.navigator?.navigate(url);
    },

    onSectionMore(this: HomePageInstance, e: WechatMiniprogram.CustomEvent) {
      const key = e.detail.key as string;
      const url = SUBPKG_PAGES[key] || `/pages/${key}/${key}`;
      // Navigator v3 内置 saveScrollPosition + 栈深预检 + 三层打断 + fallback
      this.navigator?.navigate(url);
    },

    onNavigateTo(this: HomePageInstance, e: WechatMiniprogram.BaseEvent) {
      const key = e.currentTarget.dataset.key as string;
      const url = `/pages/${key}/${key}`;
      this.navigator?.navigate(url);
    },

    onPlayAudio(this: HomePageInstance) {
      const { birthdayTrack } = this.data;
      if (!birthdayTrack) {
        console.warn("[home] birthdayTrack 为空，无法跳转");
        return;
      }

      // 设置全局播放状态
      app.globalData.playingTrackId = birthdayTrack.id;
      app.globalData.isPlayingAudio = true;
      this.setData({
        playingTrackId: birthdayTrack.id,
        isPlayingAudio: true,
      });

      // 跳转到音频页面（使用 navigate 保持页面栈，支持滑动返回）
      this.navigator?.navigate("/pages/audio/audio");
    },

    onPreviewPostMedia(this: HomePageInstance, e: WechatMiniprogram.BaseEvent) {
      const { index, mediaList } = e.currentTarget.dataset as {
        index: number;
        mediaList: PostItem["mediaList"];
      };
      if (!mediaList || mediaList.length === 0) return;
      const currentIndex = Number(index) || 0;
      const current = mediaList[currentIndex];

      // 视频类型：使用全屏 video-preview 组件播放（previewMedia 真机播放不稳定）
      if (current && current.type === "VIDEO") {
        this.setData({
          showVideoPreview: true,
          previewVideoUrl: current.hdUrl || current.url,
          previewVideoPoster: current.coverUrl || "",
          previewVideoTitle: "",
        });
        return;
      }

      // 图片类型：使用 wx.previewMedia 预览（仅过滤出图片）
      const sources = mediaList
        .filter((m) => m.type !== "VIDEO")
        .map((m) => ({
          mediaType: "image" as const,
          url: m.url,
        }));
      const imgIndex = Math.max(
        0,
        sources.findIndex((s) => s.url === current?.url)
      );

      wx.previewMedia({
        sources,
        current: imgIndex,
        showmenu: true,
      });
    },

    /** 预览日程海报图片 */
    onPreviewScheduleImage(
      this: HomePageInstance,
      e: WechatMiniprogram.BaseEvent
    ) {
      const url = e.currentTarget.dataset.url as string;
      if (!url) return;
      const fullUrl = getThumbFullUrl(url);
      wx.previewImage({
        current: fullUrl,
        urls: [fullUrl],
      });
    },

    /** 预览图片档案馆的图片 */
    onPreviewPhotoImage(
      this: HomePageInstance,
      e: WechatMiniprogram.BaseEvent
    ) {
      const { url } = e.currentTarget.dataset as {
        url: string;
      };
      if (!url) return;
      const { featuredPhotos } = this.data;
      const urls = featuredPhotos
        .map((photo) => photo.reviewImageUrl)
        .filter((url): url is string => Boolean(url));
      const currentUrl = url;
      wx.previewImage({
        current: currentUrl,
        urls: urls,
      });
    },

    /** 预览 photocard 图片 */
    onPreviewPhotocardImage(
      this: HomePageInstance,
      e: WechatMiniprogram.BaseEvent
    ) {
      const { url } = e.currentTarget.dataset as {
        url: string;
      };
      if (!url) return;

      const { photocards } = this.data;
      const urls = photocards
        .map((card) => card.reviewImageUrl)
        .filter((url): url is string => Boolean(url));
      const currentUrl = url;

      wx.previewImage({
        current: currentUrl,
        urls: urls,
      });
    },

    onCloseImagePreview(this: HomePageInstance) {
      this.setData({ showImagePreview: false });
    },

    onPreviewVideo(this: HomePageInstance, e: WechatMiniprogram.BaseEvent) {
      const { index, mediaList } = e.currentTarget.dataset as {
        index: number;
        mediaList: { type: string; url: string }[];
      };
      const videoItem = mediaList?.[index ?? 0];
      if (videoItem) {
        this.setData({
          showVideoPreview: true,
          previewVideoUrl: videoItem.url,
          previewVideoPoster: videoItem.url,
          previewVideoTitle: "",
        });
      }
    },

    onCloseVideoPreview(this: HomePageInstance) {
      this.setData({ showVideoPreview: false });
    },

    /** 预览精选视频 */
    onPreviewFeaturedVideo(this: HomePageInstance) {
      const { featuredVideo } = this.data;
      if (!featuredVideo?.reviewImageUrl) {
        wx.showToast({ title: "视频暂不可用", icon: "none" });
        return;
      }
      this.setData({
        showVideoPreview: true,
        previewVideoUrl: featuredVideo.reviewImageUrl,
        previewVideoPoster: featuredVideo.thumbnail || "",
        previewVideoTitle: featuredVideo.description || "",
      });
    },
  })
);
