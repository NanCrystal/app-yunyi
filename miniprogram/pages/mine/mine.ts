// pages/mine.ts
import { getCharacters } from '../../services/api';
import { parseColorToRgb } from '../../utils/theme';
import type { Character } from '../../utils/types';

const app = getApp<IAppOption>();

function getTheme() {
  const characters: Character[] = getCharacters();
  const id = app.globalData.selectedCharId || 'char1';
  const char = characters.find((c) => c.id === id) || characters[1];
  const rgb = parseColorToRgb(char.accentColor);
  return {
    themeColor: char.accentColor,
    themeR: rgb.r,
    themeG: rgb.g,
    themeB: rgb.b,
  };
}

Page({
  data: {
    tabTabs: [
      { key: 'home', label: '首页', icon: '◼' },
      { key: 'mine', label: '我的', icon: '◷' },
    ] as { key: string; label: string; icon: string }[],
    themeColor: '#aa0a27',
    themeR: 170,
    themeG: 10,
    themeB: 39,
  },

  onShow() {
    this.setData(getTheme());
  },