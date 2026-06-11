import { getCharacters } from '../../services/api';
import type { Character } from '../../utils/types';
import { parseColorToRgb } from '../../utils/theme';

const app = getApp<IAppOption>();

interface IndexData {
  characters: Character[];
}

/** 根据角色 accentColor 生成卡片渐变色 */
function getGradient(item: Character): string {
  const { r, g, b } = parseColorToRgb(item.accentColor);
  return `linear-gradient(to top, rgba(${r}, ${g}, ${b}, 0.35) 0%, rgba(0, 0, 0, 0.6) 50%, rgba(0, 0, 0, 0.85) 100%)`;
}

Component({
  data: {
    characters: [] as Character[],
  } as IndexData,

  lifetimes: {
    attached() {
      const characters = getCharacters();
      const items = characters.map((c) => ({ ...c, _gradient: getGradient(c) }));
      this.setData({ characters: items });
    },
  },

  methods: {
    /** 选择角色，进入主页 */
    onCharSelect(e: WechatMiniprogram.BaseEvent) {
      const artistId = e.currentTarget.dataset.id as string;
      const char = this.data.characters.find((c: Character) => c.artistId === artistId);
      app.globalData.selectedCharId = artistId;
      if (char) {
        app.globalData.selectedCharAccentColor = char.accentColor;
      }
      wx.reLaunch({ url: '/pages/home/home' });
    },
  },
});
