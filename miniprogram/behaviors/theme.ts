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
  const characters: Character[] = getCharacters();
  const id = app.globalData.selectedCharId || 'char1';
  const char = characters.find((c) => c.artistId === id) || characters[0];
  const rgb = parseColorToRgb(char.accentColor);

  return {
    themeColor: char.accentColor,
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
