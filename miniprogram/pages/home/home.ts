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
import { getUTCTimeString } from "../../utils/format";
import { themeBehavior } from "../../behaviors/theme";
import {
  getThumbUrl,
  getImageUrl,
  formatDateDot,
  formatTimeShort,
  formatDateChinese,
  formatMonthDayChinese,
  formatYearMonthChinese,
  formatMonthAbbrUpper,
  formatMonthDayEnUpper,
  formatMonthDayNum
} from "../../utils/util";
import { characters as localCharacters } from "../../utils/data";

const app = getApp<IAppOption>();

/** 艺人 accentColor 映射 */
const colorMap: Record<string, string> = {};
localCharacters.forEach((c) => {
  colorMap[c.artistId] = c.accentColor;
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
  weibo: "/pages/assets/icons/weibo.svg",
  douyin: "/pages/assets/icons/douyin.svg",
  xiaohongshu: "/pages/assets/icons/xiaohongshu.svg",
  instagram: "/pages/assets/icons/instagram.svg",
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
}

/** 分包页面路径映射（key → 完整路径） */
const SUBPKG_PAGES: Record<string, string> = {
  sync: '/subpkg/media/pages/sync/sync',
};

Component({
  behaviors: [themeBehavior],

  data: {
    statusBarHeight: 20,
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
      { key: "home", label: "首页", icon: "◼" },
      { key: "mine", label: "我的", icon: "◷" },
    ] as { key: string; label: string; icon: string }[],
    showImagePreview: false,
    previewImages: [] as string[],
    previewImageIndex: 0,
    showVideoPreview: false,
    previewVideoUrl: "",
    previewVideoPoster: "",
    previewVideoTitle: "",
  } as HomeData,

  lifetimes: {
    attached() {
      const { statusBarHeight } = (wx as any).getWindowInfo
        ? (wx as any).getWindowInfo()
        : wx.getSystemInfoSync();
      this.setData({ statusBarHeight });
      this.initData();
      // this.startClock();
    },
  },

  detached() {
    // this.stopClock();
  },

  methods: {
    // ───────────── 核心数据加载 ─────────────

    async initData() {
      const selectedCharId = (app.globalData.selectedCharId ||
        "haoyiran") as string;

      try {
        const data: IntegrationData = await get("/integration/home", {
          artistId: selectedCharId,
        });

        console.log("integration data", data);

        // Banner → heroImages
        const heroImages: string[] = (data.banners || []).flatMap((b) => {
          const img = b.data?.imageUrl;
          if (Array.isArray(img)) return img;
          if (typeof img === "string") return [img];
          return [];
        });

        // SocialPost → latestPost
        const postRaw = data.posts?.[0]?.data;
        const latestPost: PostItem | null = postRaw
          ? this.mapPost(postRaw)
          : null;

        // Itinerary → upcomingEvents（每个艺人最多 2 条，展平）
        const upcomingEvents: EventItem[] = (data.itineraries || []).flatMap(
          (item: any) => (item.data || []).map((e: any) => this.mapEvent(e))
        );

        // Photo → featuredPhotos（每个艺人最多 3 张，展平）
        const featuredPhotos: PhotoItem[] = (data.photos || []).flatMap(
          (item: any) => (item.data || []).map((p: any) => this.mapPhoto(p))
        );

        // Video → featuredVideo
        const videoRaw = data.videos?.[0]?.data;
        const featuredVideo: VideoItem | null = videoRaw
          ? this.mapVideo(videoRaw)
          : null;

        // PhotoCard → photocards（每个艺人最多 3 张，展平）
        const photocards: Photocard[] = (data.photoCards || []).flatMap(
          (item: any) => (item.data || []).map((c: any) => this.mapCard(c))
        );

        // Audio → birthdayTrack
        const audioRaw = data.audios?.[0]?.data;
        const birthdayTrack: AudioItem | null = audioRaw
          ? this.mapAudio(audioRaw)
          : null;

        // Characters（本地数据）
        const activeChar =
          localCharacters.find((c) => c.artistId === selectedCharId) ||
          localCharacters[0];

        this.setData({
          heroImages:
            heroImages.length > 0
              ? heroImages.map(getImageUrl)
              : localHeroFallback,
          characters: localCharacters.map((c) => ({
            ...c,
            avatar: getThumbUrl(c.avatar),
          })),
          selectedCharId,
          activeChar: {
            ...activeChar,
            avatar: getThumbUrl(activeChar.avatar),
          },
          latestPost,
          upcomingEvents,
          featuredPhotos: featuredPhotos.map((p) => ({
            ...p,
            url: getThumbUrl(p.url),
          })),
          featuredVideo,
          photocards: photocards.map((c) => ({
            ...c,
            imageUrl: getThumbUrl(c.imageUrl),
          })),
          birthdayTrack,
          playingTrackId: app.globalData.playingTrackId,
          isPlayingAudio: app.globalData.isPlayingAudio,
        });

        this.setData({ navTitle: activeChar.artistId.toUpperCase() });
        this.startHeroAutoPlay();
        this.restoreScrollPosition();
      } catch (err) {
        console.error("首页数据加载失败:", err);
        // 兜底：确保角色列表可用
        const fallbackChar =
          localCharacters.find((c) => c.artistId === selectedCharId) ||
          localCharacters[0];
        this.setData({
          characters: localCharacters.map((c) => ({
            ...c,
            avatar: getThumbUrl(c.avatar),
          })),
          selectedCharId,
          activeChar: fallbackChar,
          navTitle: fallbackChar.artistId.toUpperCase(),
        });
      }
    },

    // ───────────── 数据映射 ─────────────

    mapPost(post: any): PostItem {
      // 优先使用 linkedMedia（本地存储的稳定链接），兜底用 images（平台原始链接，可能过期）
      const mediaList: PostItem["mediaList"] = (
        post.linkedMedia ||
        post.mediaLinks ||
        []
      ).map((m: any) => ({
        type: m.type || m.mediaType,
        url: getImageUrl(
          m.url || m.photo?.url || m.video?.coverUrl || m.video?.playUrl || ""
        ),
      })).slice(0, 3);
 

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
        authorName: post.artist?.name || "",
        authorAvatar: getImageUrl(post.artist?.avatar || ""),
        mediaList,
      };
    },

    mapEvent(itinerary: any): EventItem {
      console.log('itinerary',itinerary);
      
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

    mapPhoto(photo: any): PhotoItem {
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

    mapVideo(video: any): VideoItem {
      return {
        id: String(video.id),
        title: video.title || video.description || "",
        duration: "",
        date: formatMonthDayEnUpper(video.shootDate),
        thumbnail: getImageUrl(video.coverUrl || ""),
        tags: [],
        description: video.description || "",
        platform: video.tagPlatform?.name || "",
        publishedTime: "",
      };
    },

    mapCard(card: any): Photocard {
      return {
        id: String(card.id),
        title: card.name || "",
        date: formatDateDot(card.createdAt),
        imageUrl: card.frontImage || "",
      };
    },

    mapAudio(audio: any): AudioItem {
      console.log('audio',audio);
      
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
      };
    },

    // ───────────── Hero 轮播 ─────────────

    startHeroAutoPlay() {
      const timer = setInterval(() => {
        const { currentSlide, heroImages } = this.data;
        if (heroImages.length === 0) return;
        const next = (currentSlide + 1) % heroImages.length;
        this.setData({ currentSlide: next });
      }, 5000);
      (this as any)._heroTimer = timer;
    },

    stopHeroTimer() {
      const timer = (this as any)._heroTimer as number | undefined;
      if (timer) clearInterval(timer);
    },

    // ───────────── 时钟 ─────────────

    // startClock() {
    //   this.setData({ currentTime: getUTCTimeString() });
    //   const timer = setInterval(() => {
    //     this.setData({ currentTime: getUTCTimeString() });
    //   }, 1000);
    //   (this as any)._clockTimer = timer;
    // },

    // stopClock() {
    //   const timer = (this as any)._clockTimer as number | undefined;
    //   if (timer) clearInterval(timer);
    // },

    // ───────────── 事件处理 ─────────────

    onSlideTap(e: WechatMiniprogram.BaseEvent) {
      const index = e.currentTarget.dataset.index as number;
      this.setData({ currentSlide: index });
    },

    onCharTap(e: WechatMiniprogram.BaseEvent) {
      const artistId = e.currentTarget.dataset.id as string;

      // 更新全局状态
      app.globalData.selectedCharId = artistId;
      app.globalData.selectedCharAccentColor =
        colorMap[artistId] || "rgb(86, 164, 173)";
      (this as any).refreshTheme();

      // 重新请求数据
      this.initData();
    },

    onGoIndex() {
      wx.reLaunch({ url: '/pages/index/index' });
    },

    /** 记录滚动位置 */
    onHomeScroll(e: WechatMiniprogram.ScrollViewScroll) {
      this.data.scrollTop = e.detail.scrollTop;
    },

    /** 保存滚动位置到全局 */
    saveScrollPosition() {
      app.globalData.homeScrollTop = this.data.scrollTop || 0;
    },

    /** 恢复滚动位置 */
    restoreScrollPosition() {
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

    onNavigate(e: WechatMiniprogram.CustomEvent) {
      const key = e.detail.key as string;
      const url = SUBPKG_PAGES[key] || `/pages/${key}/${key}`;
      wx.reLaunch({ url });
    },

    onSectionMore(e: WechatMiniprogram.CustomEvent) {
      const key = e.detail.key as string;
      // 保存滚动位置到全局，以便返回时恢复
      this.saveScrollPosition();
      const url = SUBPKG_PAGES[key] || `/pages/${key}/${key}`;
      
      // 使用 reLaunch 跳转，schedule 页面通过自定义导航栏返回首页
      wx.reLaunch({
        url,
        fail(err) {
          console.error('跳转失败:', key, err);
          wx.showToast({ title: '跳转失败', icon: 'none' });
        },
      });
    },

    onNavigateTo(e: WechatMiniprogram.BaseEvent) {
      const key = e.currentTarget.dataset.key as string;
      wx.reLaunch({ url: `/pages/${key}/${key}` });
    },

    onPlayAudio() {
      const { birthdayTrack, playingTrackId, isPlayingAudio } = this.data;
      if (!birthdayTrack) return;

      if (playingTrackId === birthdayTrack.id) {
        const newPlaying = !isPlayingAudio;
        app.globalData.isPlayingAudio = newPlaying;
        this.setData({ isPlayingAudio: newPlaying });
      } else {
        app.globalData.playingTrackId = birthdayTrack.id;
        app.globalData.isPlayingAudio = true;
        this.setData({
          playingTrackId: birthdayTrack.id,
          isPlayingAudio: true,
        });
      }

      const ctx = (this as any)._audioCtx as
        | WechatMiniprogram.InnerAudioContext
        | undefined;
      if (!ctx || ctx.paused) {
        const audioCtx = wx.createInnerAudioContext();
        (this as any)._audioCtx = audioCtx;
        audioCtx.src = "";
      }
    },

    onTabChange(_e: WechatMiniprogram.CustomEvent) {},

    onPreviewImage(e: WechatMiniprogram.BaseEvent) {
      const { index, mediaList } = e.currentTarget.dataset as {
        index: number;
        mediaList: { type: string; url: string }[];
      };
      const images = (mediaList || [])
        .filter((m) => m.type === "PHOTO")
        .map((m) => m.url);
      const currentUrl = mediaList?.[index]?.url || "";
      const currentIdx = Math.max(0, images.indexOf(currentUrl));
      this.setData({
        showImagePreview: true,
        previewImages: images,
        previewImageIndex: currentIdx,
      });
    },

    onCloseImagePreview() {
      this.setData({ showImagePreview: false });
    },

    onPreviewVideo(e: WechatMiniprogram.BaseEvent) {
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

    onCloseVideoPreview() {
      this.setData({ showVideoPreview: false });
    },

    onPreviewImageChange(e: WechatMiniprogram.CustomEvent) {
      console.log("图片切换到:", e.detail.index);
    },

    onPreviewShare() {},
  },
});

// ─── 轮播图兜底（无后端 banner 数据时使用） ───
const localHeroFallback = [
  "/pages/assets/images/1 (1).jpg",
  "/pages/assets/images/1 (2).jpg",
  "/pages/assets/images/1 (3).jpg",
  "/pages/assets/images/1 (4).jpg",
].map(getThumbUrl);
