/**
 * 主题 Behavior — 所有页面混入后自动获得当前角色主题色。
 *
 * 使用方式：
 *   1. 在页面 ts 中 import 并加入 behaviors: [themeBehavior]
 *   2. 在 wxml 根元素上绑定 CSS 变量：
 *      style="--theme: {{themeColor}}; --theme-r: {{themeR}}; --theme-g: {{themeG}}; --theme-b: {{themeB}};"
 *   3. 在 wxss 中用 var(--theme) 引用主题色
 */

import { getCharacters } from '../services/api';
import { parseColorToRgb } from '../utils/theme';
import type { Character } from '../utils/types';

const app = getApp<IAppOption>();

/** 根据 globalData 计算主题数据 */
function computeTheme() {
  // 优先从 storage 读取缓存艺人列表（与 home 页 initData 数据源一致）
  let characters: Character[] =
    wx.getStorageSync("cached_artists") || [];
  // fallback：如果 storage 无数据，尝试 getCharacters()
  if (!characters || characters.length === 0) {
    characters = getCharacters();
  }
  const id = app.globalData.selectedCharId || 'char1';
  const char = characters.find((c) => c.artistId === id) || characters[0];
  // 防御性检查：确保 char 和 accentColor 有效
  const DEFAULT_COLOR = '#aa0a27';
  const color = char?.accentColor || DEFAULT_COLOR;
  const rgb = parseColorToRgb(color);

  return {
    themeColor: color,
    themeR: rgb.r,
    themeG: rgb.g,
    themeB: rgb.b,
  };
}

export const themeBehavior = Behavior({
  data: {
    themeColor: '#aa0a27',
    themeR: 170,
    themeG: 10,
    themeB: 39,
  },

  lifetimes: {
    attached() {
      this.setData(computeTheme());
    },
  },

  pageLifetimes: {
    show() {
      this.setData(computeTheme());
    },
  },

  methods: {
    /** 外部切换角色后主动刷新主题（用于 home 页角色切换） */
    refreshTheme() {
      this.setData(computeTheme());
    },
  },
});

/**
 * 提取 Page.Options 的 Data 泛型参数，
 * 用于在 withTheme 返回值中保留用户 data 的类型推断。
 */
type PageDataOf<T> = T extends WechatMiniprogram.Page.Options<infer D> ? D : any;

/**
 * Page 模式下的主题混入工具函数
 * 将 themeBehavior 的能力注入到 Page 配置中，解决 Page 不支持 behaviors 的问题
 *
 * 使用方式：
 *   import { withTheme } from "../../behaviors/theme";
 *   Page(withTheme({ data: {...}, onLoad() {...}, ... }));
 *
 * 实现原理：
 *   1. 保留原始 options 的所有属性和方法（通过展开）
 *   2. 注入主题数据到 data
 *   3. 包装 onLoad/onShow 以在页面加载/显示时计算主题
 *   4. 返回类型断言为 Page.Options，确保 this.setData 等方法可用
 */
export function withTheme<T extends WechatMiniprogram.Page.Options<any>>(
  options: T
): T {
  // 提取用户可能定义的生命周期
  const userOnLoad = (options as any).onLoad as
    | ((query?: Record<string, string | undefined>) => void)
    | undefined;
  const userOnShow = (options as any).onShow as
    | (() => void)
    | undefined;
  const userMethods: Record<string, (...args: any[]) => any> =
    (options as any).methods || {};

  /** 注入的 onLoad：先计算主题，再调用用户逻辑 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function wrappedOnLoad(this: any, query?: Record<string, string | undefined>) {
    this.setData(computeTheme());
    if (userOnLoad) {
      userOnLoad.call(this, query);
    }
  }

  /** 注入的 onShow：先计算主题，再调用用户逻辑 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function wrappedOnShow(this: any) {
    this.setData(computeTheme());
    if (userOnShow) {
      userOnShow.call(this);
    }
  }

  // 直接修改原对象并返回（保留原始 ThisType 约束）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (options as any).data = {
    themeColor: '#aa0a27',
    themeR: 170,
    themeG: 10,
    themeB: 39,
    ...(options.data || {}),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (options as any).onLoad = wrappedOnLoad;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (options as any).onShow = wrappedOnShow;

  // 注入 refreshTheme 方法
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (options as any).refreshTheme = function(this: any) {
    this.setData(computeTheme());
  };

  // 合并用户自定义 methods
  if (Object.keys(userMethods).length > 0) {
    Object.assign(options, userMethods);
  }

  return options;
}
