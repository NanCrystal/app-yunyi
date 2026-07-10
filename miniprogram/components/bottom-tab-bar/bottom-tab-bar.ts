import { themeBehavior } from '../../behaviors/theme';

interface TabItem {
  key: string;
  label: string;
  icon: string;
  selectedIcon?: string;
}

Component({
  behaviors: [themeBehavior],

  properties: {
    current: {
      type: String,
      value: 'home',
    },
    tabs: {
      type: Array,
      value: [] as TabItem[],
    },
  },

  methods: {
    onTabTap(e: WechatMiniprogram.BaseEvent) {
      const key = e.currentTarget.dataset.key as string;
      if (key === this.properties.current) return;

      this.triggerEvent('change', { key });

      // 使用 reLaunch 模拟 tabBar 切换
      wx.reLaunch({
        url: `/pages/${key}/${key}`,
      });
    },
  },
});

