/**
 * 主题工具 — 将角色 accentColor 解析为 RGB 分量，供 CSS 自定义属性使用。
 */

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

/** 解析任意格式的颜色字符串（hex / rgb）为 RGB 分量 */
export function parseColorToRgb(color: string): RgbColor {
  // rgb(r, g, b)
  const rgbMatch = color.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1], 10),
      g: parseInt(rgbMatch[2], 10),
      b: parseInt(rgbMatch[3], 10),
    };
  }

  // #rrggbb or #rgb
  let hex = color.replace('#', '');
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  return {
    r: parseInt(hex.substring(0, 2), 16),
    g: parseInt(hex.substring(2, 4), 16),
    b: parseInt(hex.substring(4, 6), 16),
  };
}
