import { getPosts } from '../../services/api';
import type { PostItem, PlatformType } from '../../utils/types';
import { themeBehavior } from '../../behaviors/theme';

interface SocialData {
  selectedPlatform: PlatformType;
  filteredPosts: PostItem[];
  tabTabs: { key: string; label: string; icon: string }[];
}

Component({
  behaviors: [themeBehavior],

  data: {
    selectedPlatform: 'ALL' as PlatformType,
    filteredPosts: [] as PostItem[],
    tabTabs: [
      { key: 'home', label: '首页', icon: '◼' },
      { key: 'mine', label: '我的', icon: '◷' },
    ],
  } as SocialData,

  lifetimes: {
    attached() {
      this.applyFilter('ALL');
    },
  },

  methods: {
    onPlatformChange(e: WechatMiniprogram.BaseEvent) {
      const platform = e.currentTarget.dataset.platform as PlatformType;
      this.applyFilter(platform);
    },

    applyFilter(platform: PlatformType) {
      const allPosts = getPosts();
      const filtered = platform === 'ALL'
        ? allPosts
        : allPosts.filter((p: PostItem) => p.platform === platform);
      this.setData({ selectedPlatform: platform, filteredPosts: filtered });
    },
  },
});
