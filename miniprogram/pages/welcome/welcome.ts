import { fetchArtists, fetchHomeModules } from "../../services/api";
import { getImageUrl } from "../../utils/util";

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
    /** 当前倒计时秒数 */
    countdown: COUNTDOWN_SECONDS,
    /** swiper 轮播间隔(ms) */
    swiperInterval: 1000,
  },

  onLoad() {
    this.init();
    this.preloadData();
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
        fetchArtists(),
        fetchHomeModules().catch(() => ({ modules: [] })),
      ]);
      wx.setStorageSync(STORAGE_KEYS.artists, artists);
      wx.setStorageSync(STORAGE_KEYS.modules, modulesRes.modules);

      // 查找 welcome 模块，提取图片
      const welcomeModule = modulesRes.modules.find((m) => m.key === "welcome");
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
    this.setData({ loading: false });
    this.startCountdown();
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
    wx.redirectTo({ url: "/pages/index/index" });
  },
});
