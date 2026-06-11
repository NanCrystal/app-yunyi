import { getPhotos } from '../../services/api';
import type { PhotoItem } from '../../utils/types';
import { themeBehavior } from '../../behaviors/theme';

interface FilterItem {
  label: string;
  value: string;
}

interface GroupedPhotos {
  month: string;
  days: { day: string; items: PhotoItem[] }[];
  count: number;
}

interface PhotosData {
  selectedType: string;
  selectedRegion: string;
  selectedSystem: string;
  typeItems: FilterItem[];
  regionItems: FilterItem[];
  systemItems: FilterItem[];
  filteredPhotos: PhotoItem[];
  groupedPhotos: GroupedPhotos[];
  checkedPhotoIds: string[];
  previewPhoto: PhotoItem | null;
  previewIndex: number;
  tabTabs: { key: string; label: string; icon: string }[];
}

Component({
  behaviors: [themeBehavior],

  data: {
    selectedType: 'All',
    selectedRegion: 'All',
    selectedSystem: 'All',
    typeItems: [
      { label: 'All', value: 'All' },
      { label: 'RAW', value: 'RAW' },
      { label: 'Video', value: 'Video' },
      { label: 'Portrait', value: 'Portrait' },
    ] as FilterItem[],
    regionItems: [
      { label: 'All', value: 'All' },
      { label: 'Tokyo', value: 'Tokyo' },
      { label: 'Shanghai', value: 'Shanghai' },
      { label: 'Berlin', value: 'Berlin' },
      { label: 'New York', value: 'New York' },
    ] as FilterItem[],
    systemItems: [
      { label: 'All', value: 'All' },
      { label: 'Phase One', value: 'Phase One' },
      { label: 'Leica M', value: 'Leica M' },
      { label: 'Hasselblad', value: 'Hasselblad' },
    ] as FilterItem[],
    filteredPhotos: [] as PhotoItem[],
    groupedPhotos: [] as GroupedPhotos[],
    checkedPhotoIds: ['ph1', 'ph3'] as string[],
    previewPhoto: null as PhotoItem | null,
    previewIndex: 0,
    tabTabs: [
      { key: 'home', label: '首页', icon: '◼' },
      { key: 'mine', label: '我的', icon: '◷' },
    ],
  } as PhotosData,

  lifetimes: {
    attached() {
      this.applyFilters();
    },
  },

  methods: {
    onTypeChange(e: WechatMiniprogram.CustomEvent) {
      this.setData({ selectedType: e.detail.value as string });
      this.applyFilters();
    },

    onRegionChange(e: WechatMiniprogram.CustomEvent) {
      this.setData({ selectedRegion: e.detail.value as string });
      this.applyFilters();
    },

    onSystemChange(e: WechatMiniprogram.CustomEvent) {
      this.setData({ selectedSystem: e.detail.value as string });
      this.applyFilters();
    },

    applyFilters() {
      const { selectedType, selectedRegion, selectedSystem } = this.data;
      const allPhotos = getPhotos();

      const filtered = allPhotos.filter((p: PhotoItem) => {
        if (selectedType !== 'All' && p.type !== selectedType) return false;
        if (selectedRegion !== 'All' && p.region !== selectedRegion) return false;
        if (selectedSystem !== 'All' && p.system !== selectedSystem) return false;
        return true;
      });

      // 按月分组，再按日分组
      const monthMap: Record<string, Record<string, PhotoItem[]>> = {};
      filtered.forEach((p: PhotoItem) => {
        if (!monthMap[p.month]) monthMap[p.month] = {};
        if (!monthMap[p.month][p.day]) monthMap[p.month][p.day] = [];
        monthMap[p.month][p.day].push(p);
      });

      const groupedPhotos: GroupedPhotos[] = Object.keys(monthMap)
        .sort((a, b) => b.localeCompare(a))
        .map((month) => {
          const days = Object.keys(monthMap[month])
            .sort((a, b) => b.localeCompare(a))
            .map((day) => ({ day, items: monthMap[month][day] }));
          const count = days.reduce((acc, d) => acc + d.items.length, 0);
          return { month, days, count };
        });

      this.setData({ filteredPhotos: filtered, groupedPhotos });
    },

    onPhotoTap(e: WechatMiniprogram.BaseEvent) {
      const photoId = e.currentTarget.dataset.id as string;
      const filtered = this.data.filteredPhotos;
      const index = filtered.findIndex((p: PhotoItem) => p.id === photoId);
      if (index >= 0) {
        this.setData({ previewPhoto: filtered[index], previewIndex: index });
      }
    },

    onCheckTap(e: WechatMiniprogram.BaseEvent) {
      e.stopPropagation();
      const photoId = e.currentTarget.dataset.id as string;
      const checked = this.data.checkedPhotoIds;
      const newChecked = checked.includes(photoId)
        ? checked.filter((id: string) => id !== photoId)
        : [...checked, photoId];
      this.setData({ checkedPhotoIds: newChecked });
    },

    onClosePreview() {
      this.setData({ previewPhoto: null });
    },

    onPrevPreview() {
      const { previewIndex, filteredPhotos } = this.data;
      const newIndex = previewIndex > 0 ? previewIndex - 1 : filteredPhotos.length - 1;
      this.setData({ previewPhoto: filteredPhotos[newIndex], previewIndex: newIndex });
    },

    onNextPreview() {
      const { previewIndex, filteredPhotos } = this.data;
      const newIndex = previewIndex < filteredPhotos.length - 1 ? previewIndex + 1 : 0;
      this.setData({ previewPhoto: filteredPhotos[newIndex], previewIndex: newIndex });
    },
  },
});
