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

/** 根据路径获取完整图片 URL（自动拼接 CDN 前缀） */
export const getImageUrl = (path?: string): string => {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  // 小程序本地资源，不加 CDN 前缀
  if (path.startsWith("/pages/")) return path;
  // 上传到七牛的远程资源，拼 CDN 域名
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
 */
export const getThumbFullUrl = (url: string): string => {
  // 本地资源不做缩略处理
  if (url.startsWith("/pages/")) return url;
  return `${getImageUrl(url)}?imageView2/2`;
};
/** 获取缩略图
 * imageView2/2  展示完整图片，不裁切
 * imageView2/1 — 所有图片统一切成方形网格，布局整齐
 * imageView2/1/w/200/h/200/q/75 缩放至覆盖 200×200 的最小尺寸，再居中裁剪，不变形
 * imageView2/2/w/400/q/80 按比例缩放到宽度 ≤ 400px，高度自适应 度 400px，高度按原比例，可能不到 400px
 *
 */
export const getThumbUrl = (url: string): string => {
  // 本地资源不做缩略处理
  if (url.startsWith("/pages/")) return url;
  return `${getImageUrl(url)}?imageView2/1/w/200/h/200/q/75`;
};
/** 获取缩略图
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
 */
export const buildThumbUrl = (rawUrl: string, size: number) => {
  if (!rawUrl) return "";
  // 避免对已带参数的 URL 重复拼接
  const base = rawUrl.split("?")[0];
  return `${base}?imageView2/1/w/${size}/h/${size}/format/webp/q/75/interlace/1/ignore-error/1`;
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
