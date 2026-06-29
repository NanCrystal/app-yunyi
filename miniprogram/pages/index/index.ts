import { fetchArtists, fetchHomeModules } from "../../services/api";
import { getImageUrl, getVideoUrl } from "../../utils/util";

const STORAGE_KEYS = {
  artists: "cached_artists",
  modules: "cached_modules",
};

const COUNTDOWN_SECONDS = 10;
const IMAGE_DURATION_MS = 3000; /** 每张图片展示时长(>=3张图时生效) */

Page({
  data: {
    displayText: "",
    line1Chars: [] as string[],
    line2Chars: [] as string[], 
    line1len: 0, 
    loading: true,
    /** 是否有欢迎图片需要展示 */
    showWelcomeImages: false,
    /** 欢迎图片列表 */
    welcomeImages: [] as string[],
    /** 是否有欢迎视频 */
    showWelcomeVideo: false,
    /** 欢迎视频地址 */
    welcomeVideo: "",
    /** 当前倒计时秒数 */
    countdown: COUNTDOWN_SECONDS,
    /** swiper 轮播间隔(ms) */
    swiperInterval: 1000,
    /** 是否存在 welcome 模块（默认 false，等数据返回后再判断） */
    hasWelcomeModule: false,
  },

  onLoad() {
    console.log('[welcome] onLoad 开始执行');
    try {
      this.init();
    } catch (err) {
      console.error('[welcome] init 失败', err);
    }
    
    try {
      this.preloadData();
    } catch (err) {
      console.error('[welcome] preloadData 调用失败', err);
      // 确保即使预加载失败，也能正常显示页面并跳转
      this.setData({ loading: false });
      this.startCountdown();
    }
  },
  init() {
    const line1 = "有些光，不需要被定义";
    const line2 = "只是在时间里，慢慢变得清晰";
    this.setData({
      sceneIndex: 4,
      displayText: line1 + "\n" + line2,
      line1Chars: line1.split(""),
      line2Chars: line2.split(""),
      line1len: line1.length,
    });
  },

  /** 预加载艺人列表和模块配置，存入本地缓存 */
  async preloadData() {
    try {
      const [artists, modulesRes] = await Promise.all([
        fetchArtists().catch((err) => {
          console.warn('[welcome] fetchArtists 失败', err);
          return [];
        }),
        fetchHomeModules().catch((err) => {
          console.warn('[welcome] fetchHomeModules 失败', err);
          return { modules: [] };
        }),
      ]);
      
      // 安全存储，即使数据为空也不报错
      if (artists && Array.isArray(artists)) {
        wx.setStorageSync(STORAGE_KEYS.artists, artists);
      }
      if (modulesRes && modulesRes.modules) {
        wx.setStorageSync(STORAGE_KEYS.modules, modulesRes.modules);
      }

      // 查找 welcome 模块
      const welcomeModule = modulesRes?.modules?.find((m: any) => m.key === "welcome") as any;

      // 如果不存在 welcome 模块，直接跳转到首页
      if (!welcomeModule) {
        console.log('[welcome] 不存在 welcome 模块，直接跳转');
        wx.redirectTo({ url: "/pages/frontpage/frontpage" });
        return;
      }

      // 确认存在 welcome 模块，展示内容
      this.setData({ hasWelcomeModule: true });

      // 提取视频或图片
      
      // 优先处理 video
      if (welcomeModule?.video) {
        let videos: string[] = [];
        try {
          videos = typeof welcomeModule.video === "string"
            ? JSON.parse(welcomeModule.video)
            : welcomeModule.video;
          if (!Array.isArray(videos)) videos = [];
          videos = videos.filter((v: any) => typeof v === "string" && v.trim());
        } catch (e) {
          console.warn("[welcome] 解析 video 失败", e);
        }
        if (videos.length > 0) {
          const videoUrl = getVideoUrl(videos[0]);
          this.setData({
            showWelcomeVideo: true,
            welcomeVideo: videoUrl,
          });
          this.startCountdown(COUNTDOWN_SECONDS);
          return;
        }
      }

      // 处理 image
      if (welcomeModule?.image) {
        let images: string[] = [];
        try {
          images = typeof welcomeModule.image === "string"
            ? JSON.parse(welcomeModule.image)
            : welcomeModule.image;
          if (!Array.isArray(images)) images = [];
          images = images.filter((img: any) => typeof img === "string" && img.trim()).map((img) => getImageUrl(img));
        } catch (e) {
          console.warn("[welcome] 解析 image 失败", e);
        }
        if (images.length > 0) {
          // >=3 张时：每张 3s，轮播间隔 3s，倒计时 = 数量*3
          const useLongDuration = images.length >= 3;
          this.setData({
            showWelcomeImages: true,
            welcomeImages: images,
            swiperInterval: useLongDuration ? IMAGE_DURATION_MS : 1000,
          });
          this.startCountdown(useLongDuration ? images.length * (IMAGE_DURATION_MS / 1000) : COUNTDOWN_SECONDS);
          return;
        }
      }
    } catch (err) {
      console.error("[welcome] 预加载失败", err);
    }
    // 无论成功失败，都确保页面可以正常展示并跳转
    this.setData({ loading: false });
    this.startCountdown();
  },

  /** 视频播放出错时降级处理 */
  onVideoError(e: any) {
    console.error("[welcome] 视频播放失败", e.detail);
    this.setData({ showWelcomeVideo: false });
  },

  /** 启动倒计时 + 定时跳转 */
  startCountdown(totalSeconds: number = COUNTDOWN_SECONDS) {
    let remaining = totalSeconds;
    this.setData({ countdown: remaining });

    const timer = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(timer);
        this.skipToIndex();
      } else {
        this.setData({ countdown: remaining });
      }
    }, 1000);
    // 存储 timer 以便跳过时清理（页面销毁后自动失效）
    (this as any)._countdownTimer = timer;
  },

  skipToIndex() {
    clearInterval((this as any)._countdownTimer);
    wx.redirectTo({ url: "/pages/frontpage/frontpage" });
  },
});
