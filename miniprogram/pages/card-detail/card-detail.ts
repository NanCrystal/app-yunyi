// pages/detail/detail.ts

interface CardData {
  id: number;
  name: string;
  category: string;
  artist: string;
  releaseDate: string; // 格式化后展示用，如 "2026.04.30"
  orientation: "portrait" | "landscape";
  frontImageUrl: string;
  backImageUrl: string;
  coverImage: string;
  serialNo: string;
}

interface DetailPageData {
  card: CardData;
  isFlipped: boolean;
  hasBack: boolean; // 是否有背面图，单图时为 false
  touchStartX: number;
  statusBarHeight: number;
  touchStartY: number;
  navBarHeight: number;
}

interface DetailPageMethods {
  onCardTap: () => void;
  onTouchStart: (e: WechatMiniprogram.TouchEvent) => void;
  onTouchEnd: (e: WechatMiniprogram.TouchEvent) => void;
  onCoverTap: () => void;
  goBack: () => void;
  onClose: () => void;
  onNavTap: (e: WechatMiniprogram.TouchEvent) => void;
}

/** 拼接 CDN 完整地址：已是完整 URL 则原样返回，否则补前缀 */
function toCdnUrl(path: string | undefined): string {
  if (!path) return "";
  if (/^https?:\/\//.test(path)) return path;
  return `https://cdn.tauol.online/${path}`;
}

/** 将接口原始数据映射为页面所需 CardData */
function mapApiToCard(raw: Record<string, any>): CardData {
  return {
    id: raw.id,
    name: raw.name,
    category: raw.category ?? "",
    artist: raw.artist ?? "",
    releaseDate: raw._releaseDate ?? raw.releaseDate?.slice(0, 10) ?? "",
    orientation: raw.orientation === "landscape" ? "landscape" : "portrait",
    // 详情页用高清图：优先 _previewUrl（原图），其次 _frontImage（压缩图），最后拼 frontImage
    frontImageUrl:
      raw._previewUrl ?? raw._frontImage ?? toCdnUrl(raw.frontImage) ?? "",
    // backImage 是相对路径，需拼 CDN 前缀
    backImageUrl: toCdnUrl(raw.backImage),
    coverImage: toCdnUrl(raw.coverImage ?? raw.frontImage),
    serialNo: `${raw.id ?? "???"}`,
  };
}

Page<DetailPageData, DetailPageMethods>({
  data: {
    /** 状态栏高度 */
    statusBarHeight: 20,
    navBarHeight: 64,
    card: {
      id: 0,
      name: "",
      category: "",
      artist: "",
      releaseDate: "",
      orientation: "portrait",
      frontImageUrl: "",
      backImageUrl: "",
      coverImage: "",
      serialNo: "",
    },
    isFlipped: false,
    hasBack: false,
    touchStartX: 0,
    touchStartY: 0,
  },

  onLoad(options) {
    if (!options?.id) return;
    const raw = wx.getStorageSync(`card_${options.id}`);
    if (!raw) return;
    const { statusBarHeight } = (wx as any).getWindowInfo?.() ?? {
      statusBarHeight: 20,
    };
    const navBarHeight = statusBarHeight + 44;
    this.setData({ statusBarHeight, navBarHeight });
    const card = mapApiToCard(raw);
    this.setData({
      card,
      hasBack: !!card.backImageUrl,
    });
    wx.setNavigationBarTitle({ title: card.name });
  },

  /** 返回上一页 */
  goBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.switchTab({ url: "/pages/home/home" });
    }
  },
  /** 离开页面时清理本地缓存，避免存储膨胀 */
  onUnload() {
    const { id } = this.data.card;
    if (id) wx.removeStorageSync(`card_${id}`);
  },

  /** 翻转卡片（点击 or 滑动）；单图时不可翻转 */
  onCardTap() {
    if (!this.data.hasBack) return;
    this.setData({ isFlipped: !this.data.isFlipped });
  },

  onTouchStart(e: WechatMiniprogram.TouchEvent) {
    this.setData({
      touchStartX: e.touches[0].clientX,
      touchStartY: e.touches[0].clientY,
    });
  },

  /** 左右滑动超过 40px 触发翻转 */
  onTouchEnd(e: WechatMiniprogram.TouchEvent) {
    const dx = e.changedTouches[0].clientX - this.data.touchStartX;
    const dy = e.changedTouches[0].clientY - this.data.touchStartY;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      this.onCardTap();
    }
  },

  /** 点击封面缩略图，调起微信自带图片预览 */
  onCoverTap() {
    const { coverImage } = this.data.card;
    if (!coverImage) return;
    wx.previewImage({
      current: coverImage,
      urls: [coverImage],
    });
  },

  onClose() {
    wx.navigateBack();
  },

  onNavTap(e: WechatMiniprogram.TouchEvent) {
    const tab = (e.currentTarget.dataset as { tab: string }).tab;
    console.log("nav tap:", tab);
  },
});
