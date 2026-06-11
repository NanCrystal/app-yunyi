import { getVideos } from '../../services/api';
import type { VideoItem } from '../../utils/types';
import { themeBehavior } from '../../behaviors/theme';

interface MonthGroup {
  month: string;
  items: VideoItem[];
}

interface VideosData {
  selectedVideo: VideoItem | null;
  isPlaying: boolean;
  isDescriptionExpanded: boolean;
  monthGroups: MonthGroup[];
  totalCount: number;
  tabTabs: { key: string; label: string; icon: string }[];
}

Component({
  behaviors: [themeBehavior],

  data: {
    selectedVideo: null as VideoItem | null,
    isPlaying: true,
    isDescriptionExpanded: false,
    monthGroups: [] as MonthGroup[],
    totalCount: 0,
    tabTabs: [
      { key: 'home', label: '首页', icon: '◼' },
      { key: 'mine', label: '我的', icon: '◷' },
    ],
  } as VideosData,

  lifetimes: {
    attached() {
      this.initData();
    },
  },

  methods: {
    initData() {
      const videos = getVideos();
      // 按月分组
      const monthMap: Record<string, VideoItem[]> = {};
      videos.forEach((v: VideoItem) => {
        const month = v.date.includes('MAY') ? '2026.05' : '2026.06';
        if (!monthMap[month]) monthMap[month] = [];
        monthMap[month].push(v);
      });
      const monthGroups = Object.keys(monthMap)
        .sort((a, b) => b.localeCompare(a))
        .map((month) => ({ month, items: monthMap[month] }));
      const totalCount = videos.length;
      this.setData({ monthGroups, totalCount });
    },

    onOpenVideo(e: WechatMiniprogram.BaseEvent) {
      const id = e.currentTarget.dataset.id as string;
      const videos = getVideos();
      const video = videos.find((v: VideoItem) => v.id === id) || null;
      this.setData({ selectedVideo: video, isPlaying: true, isDescriptionExpanded: false });
    },

    onCloseVideo() {
      this.setData({ selectedVideo: null });
    },

    onTogglePlay() {
      this.setData({ isPlaying: !this.data.isPlaying });
    },

    onToggleDescription() {
      this.setData({ isDescriptionExpanded: !this.data.isDescriptionExpanded });
    },
  },
});
