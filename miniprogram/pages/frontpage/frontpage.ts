import type { Character } from "../../utils/types";
import { parseColorToRgb } from "../../utils/theme";
import { getThumbFullUrl, formatDateChinese, isModuleEnabled } from "../../utils/util";
import { fetchArtists, fetchArticles } from "../../services/api";

const app = getApp<IAppOption>();

interface IndexData {
  characters: Character[];
  showHome: boolean;
  articles: any[];
}

/** 从缓存读取预加载的艺人列表 */
function getCachedArtists(): Character[] | null {
  try {
    return wx.getStorageSync("cached_artists") || null;
  } catch {
    return null;
  }
}

/** 根据角色 accentColor 生成卡片渐变色 */
function getGradient(item: Character): string {
  const color = item.accentColor || "86, 164, 173";
  const { r, g, b } = parseColorToRgb(color);
  return `linear-gradient(to top, rgba(${r}, ${g}, ${b}, 0.35) 0%, rgba(0, 0, 0, 0.6) 50%, rgba(0, 0, 0, 0.85) 100%)`;
}

Page({
  data: {
    characters: [] as Character[],
    showHome: false,
    articles: [] as any[],
  } as IndexData,

  onLoad() {
    // 判断 cached_modules 是否存在
    const cachedModules = wx.getStorageSync("cached_modules");
    const hasModuleConfig = Array.isArray(cachedModules) && cachedModules.length > 0;
    // 有配置时按 isModuleEnabled 判断，无配置时 showHome 默认为 true（隐藏 frontpage）
    const showHome = hasModuleConfig ? isModuleEnabled("home") : true;
    this.setData({ showHome });

    // 如果 showHome 为 true，获取文章列表
    if (showHome) {
      fetchArticles()
        .then((list) => {
          const items = list.map((c) => ({
            ...c,
            createdAt: formatDateChinese(c.createdAt),
            cover: getThumbFullUrl(c.cover),
          }));
          this.setData({ articles: items });
        })
        .catch(() => {
          console.error("获取文章列表失败");
        });
    }

    // 优先从缓存读取（welcome 页已预加载）
    let characters = getCachedArtists();

    if (characters && characters.length > 0) {
      const items = characters.map((c) => ({
        ...c,
        avatar: getThumbFullUrl(c.avatar),
        appCover: getThumbFullUrl(c.appCover),
        _gradient: getGradient(c),
      }));
      this.setData({ characters: items });
    } else {
      // 缓存不存在时 fallback 到接口请求
      fetchArtists().then((list) => {
        const items = list.map((c) => ({
          ...c,
          avatar: getThumbFullUrl(c.avatar),
          appCover: getThumbFullUrl(c.appCover),
          _gradient: getGradient(c),
        }));
        this.setData({ characters: items });
      });
    }
  },

  /** 选择角色，进入主页 */
  onCharSelect(e: WechatMiniprogram.BaseEvent) {
    const artistId = e.currentTarget.dataset.id as string;
    const char = this.data.characters.find(
      (c: Character) => c.artistId === artistId,
    );
    app.globalData.selectedCharId = artistId;
    if (char && char.accentColor) {
      app.globalData.selectedCharAccentColor = char.accentColor;
    }
    wx.reLaunch({ url: "/pages/home/home" });
  },

  /** 点击文章卡片，进入详情页 */
  onArticleTap(e: WechatMiniprogram.BaseEvent) {
    const id = e.currentTarget.dataset.id as number;
    wx.navigateTo({
      url: `/pages/home-detail/home-detail?id=${id}`,
    });
  },
});
