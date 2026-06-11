/**
 * 补零到两位
 */
const formatNumber = (n: number): string => {
  const s = n.toString();
  return s.length === 1 ? '0' + s : s;
};

/**
 * 格式化日期为 YYYY/MM/DD HH:mm:ss
 */
export const formatTime = (date: Date): string => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();
  const minute = date.getMinutes();
  const second = date.getSeconds();

  return (
    [year, month, day].map(formatNumber).join('/') +
    ' ' +
    [hour, minute, second].map(formatNumber).join(':')
  );
};

/**
 * 获取当前 UTC 时间字符串 HH:MM:SS
 */
export const getUTCTimeString = (): string => {
  const now = new Date();
  const h = formatNumber(now.getUTCHours());
  const m = formatNumber(now.getUTCMinutes());
  const s = formatNumber(now.getUTCSeconds());
  return `${h}:${m}:${s}`;
};

/**
 * 秒数转 MM:SS 格式
 */
export const formatSeconds = (sec: number): string => {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${formatNumber(m)}:${formatNumber(s)}`;
};
