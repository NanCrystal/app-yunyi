export const formatTime = (date: Date) => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();
  const minute = date.getMinutes();
  const second = date.getSeconds();

  return (
    [year, month, day].map(formatNumber).join("/") +
    " " +
    [hour, minute, second].map(formatNumber).join(":")
  );
};

const formatNumber = (n: number) => {
  const s = n.toString();
  return s[1] ? s : "0" + s;
};

/**
 * 检查 cached_modules 是否存在且包含指定模块 key
 * @param moduleKey 要检查的模块 key（如 "home", "videos", "photos" 等）
 * @returns true 表示模块存在且应该加载数据，false 表示模块不存在应跳过加载
 */
export const isModuleEnabled = (moduleKey: string): boolean => {
  try {
    const modules: { key: string }[] = wx.getStorageSync("cached_modules") || [];
    // cached_modules 必须存在且包含指定的 moduleKey
    return Array.isArray(modules) && modules.length > 0 && modules.some((m) => m.key === moduleKey);
  } catch {
    return false;
  }
};

/** 本地资源路径前缀白名单（小程序项目内静态资源） */
const LOCAL_PREFIXES = ["/assets/", "/pages/", "/components/", "/behaviors/", "/utils/"];

/** 判断是否为小程序本地资源路径 */
const isLocalPath = (path?: string | null): boolean => {
  if (!path) return false;
  return LOCAL_PREFIXES.some((prefix) => path.startsWith(prefix));
};

/** 根据路径获取完整图片 URL（自动拼接 CDN 前缀） */
export const getImageUrl = (path?: string): string => {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  // 小程序本地资源，不加 CDN 前缀
  if (isLocalPath(path)) return path;
  // 上传到七牛的远程资源，拼 CDN 域名
  return `https://cdn.tauol.online${path}`;
};

/** 根据路径获取完整视频 URL（自动拼接 CDN 前缀） */
export const getVideoUrl = (path?: string): string => {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  // 小程序本地资源，不加 CDN 前缀
  if (isLocalPath(path)) return path;
  // 上传到服务器的远程资源，拼 CDN 域名
  return `https://cdn.tauol.online${path}`;
};

/** 格式化文件大小为可读字符串（B/KB/MB/GB） */
export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

/** 获取缩略图
 * imageView2/2  展示完整图片，不裁切
 * imageView2/1 — 所有图片统一切成方形网格，布局整齐
 * imageView2/1/w/200/h/200/q/75 缩放至覆盖 200×200 的最小尺寸，再居中裁剪，不变形
 * imageView2/2/w/400/q/80 按比例缩放到宽度 ≤ 400px，高度自适应 度 400px，高度按原比例，可能不到 400px
 *
 * 注意：仅对自有 CDN 域名的图片附加处理参数，外部第三方 URL 直接原样返回
 */
export const getThumbFullUrl = (url?: string | null): string => {
  if (!url) return "";
  // 本地资源不做缩略处理
  if (isLocalPath(url)) return url;
  // 外部第三方 URL（http:// 或 https:// 开头）不做缩略处理，避免 403/超时
  if (!url.startsWith("/") && !url.startsWith("https://cdn.tauol.online")) return url;
  return `${getImageUrl(url)}?imageView2/2`;
};
/** 获取缩略图
 * imageView2/2  展示完整图片，不裁切
 * imageView2/1 — 所有图片统一切成方形网格，布局整齐
 * imageView2/1/w/200/h/200/q/75 缩放至覆盖 200×200 的最小尺寸，再居中裁剪，不变形
 * imageView2/2/w/400/q/80 按比例缩放到宽度 ≤ 400px，高度自适应 度 400px，高度按原比例，可能不到 400px
 *
 * 注意：仅对自有 CDN 域名的图片附加处理参数，外部第三方 URL 直接原样返回
 */
export const getThumbUrl = (url?: string | null): string => {
  if (!url) return "";
  // 本地资源不做缩略处理
  if (isLocalPath(url)) return url;
  // 外部第三方 URL（http:// 或 https:// 开头）不做缩略处理，避免 403/超时
  if (!url.startsWith("/") && !url.startsWith("https://cdn.tauol.online")) return url;
  return `${getImageUrl(url)}?imageView2/1/w/200/h/200/q/75`;
};
/**
 * 获取缩略图
 * 七牛云缩略图 URL 工具
 *
 * @param {string} rawUrl  原始图片 URL（不含处理参数）
 * @param {number} size    目标边长（px，物理像素）
 * @returns {string}       带七牛参数的缩略图 URL
 *
 * 参数说明：
 *   imageView2/1  — 模式1：等比缩放后居中裁剪，保证正方形填满
 *   w/{size}      — 目标宽度（物理像素）
 *   h/{size}      — 目标高度
 *   format/webp   — 转 WebP，同质量体积小 ~30%
 *   q/75          — 质量 75，缩略图场景肉眼无损
 *   interlace/1   — 渐进加载，弱网下从模糊到清晰显示
 *   ignore-error/1— 原图处理失败时返回原图，防止整批挂掉
 *
 * 注意：仅对自有 CDN 域名的图片附加处理参数，外部第三方 URL 直接原样返回
 */
export const buildThumbUrl = (rawUrl: string, size: number) => {
  if (!rawUrl) return "";
  // 防止 NaN / 0 / 负数等非法尺寸
  if (!size || size <= 0 || isNaN(size)) return rawUrl;
  // 外部第三方 URL（http:// 或 https:// 开头）不做缩略处理，避免 403/超时
  if ((rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) && 
      !rawUrl.startsWith("https://cdn.tauol.online")) {
    return rawUrl;
  }
  // 避免对已带参数的 URL 重复拼接
  const base = rawUrl.split("?")[0];
  return `${base}?imageView2/1/w/${size}/h/${size}/format/webp/q/75/interlace/1/ignore-error/1`;
};

// ════════════════════════════════════════
// 🖼️ CDN 图片尺寸常量化（提升缓存命中率）
// ════════════════════════════════════════

/** 统一缩略图尺寸常量（仅限3档），避免参数碎片化导致CDN缓存不命中 */
export const THUMB_SIZE = {
  /** 小图：头像/图标/列表缩略（200px） */
  SMALL: 200,
  /** 中图：卡片封面/照片墙网格（400px） */
  MEDIUM: 400,
  /** 大图：详情页/预览大图（600px） */
  LARGE: 600,
} as const;

/**
 * 标准化图片尺寸到最近档位
 * 输入任意size → 输出200/400/600之一，提升CDN缓存命中率
 * @param size 原始请求尺寸
 * @returns 标准化后的档位值
 */
export const normalizeThumbSize = (size: number): number => {
  if (!size || size <= 0 || isNaN(size)) return THUMB_SIZE.SMALL;
  if (size <= 300) return THUMB_SIZE.SMALL;   // ≤300 → 200
  if (size <= 500) return THUMB_SIZE.MEDIUM;  // 300~500 → 400
  return THUMB_SIZE.LARGE;                     // >500 → 600
};

/**
 * 获取最佳视频播放URL（统一m3u8优先策略）
 * 降级链: hlsUrl(m3u8) → hdUrl(720p mp4) → playUrl(360p mp4) → originalUrl(原始)
 * @param video 视频对象 { hlsUrl?, hdUrl?, playUrl?, originalUrl? }
 */
export const getBestVideoUrl = (video?: {
  hlsUrl?: string;
  hdUrl?: string;
  playUrl?: string;
  originalUrl?: string;
}): string => {
  if (!video) return "";
  if (video.hlsUrl) return getImageUrl(video.hlsUrl);
  if (video.hdUrl) return getImageUrl(video.hdUrl);
  if (video.playUrl) return getImageUrl(video.playUrl);
  if (video.originalUrl) return getImageUrl(video.originalUrl);
  return "";
};

// ───────────── 日期/时间格式化工具 ─────────────

/** YYYY.MM.DD 格式（如 2024.03.15） */
export const formatDateDot = (dateStr: string): string => {
  if (!dateStr) return "";
  return new Date(dateStr).toISOString().split("T")[0].replace(/-/g, ".");
};

/** HH:mm 格式（如 14:30） */
export const formatTimeShort = (dateStr: string): string => {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

/** YYYY年M月D日 格式（如 2024年3月15日） */
export const formatDateChinese = (dateStr: string): string => {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

/** M月D日 格式（如 3月15日） */
export const formatMonthDayChinese = (dateStr: string): string => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
};
/** MM.DD 格式（如 03.15） */
export const formatMonthDayNum = (dateStr: string): string => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${m}.${day}`;
};

/** YYYY年MM月 格式（如 2024年03月） */
export const formatYearMonthChinese = (dateStr: string): string => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return `${d.getFullYear()}年${String(d.getMonth() + 1).padStart(2, "0")}月`;
};

/** 月份缩写大写 格式（如 MAR） */
export const formatMonthAbbrUpper = (dateStr: string): string => {
  if (!dateStr) return "";
  return new Date(dateStr)
    .toLocaleDateString("en-US", { month: "short" })
    .toUpperCase();
};

/** MONTH DAY 大写 格式（如 MARCH 15） */
export const formatMonthDayEnUpper = (dateStr: string): string => {
  if (!dateStr) return "";
  return new Date(dateStr)
    .toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
    })
    .toUpperCase();
};
//  duration 秒数的格式化字符串
export const fmtDuration = (duration: number) => {
  if (duration == null || duration <= 0) return "";
  const m = Math.floor(duration / 60);
  const s = Math.floor(duration % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
  // 全量带小时 00.00.00
  // const h = Math.floor(duration / 3600);
  // const m = Math.floor((duration % 3600) / 60);
  // const s = Math.floor(duration % 60);
  // return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s
  //   .toString()
  //   .padStart(2, "0")}`;
};
