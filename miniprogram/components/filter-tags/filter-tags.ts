interface FilterItem {
  label: string;
  value: string;
}

Component({
  properties: {
    items: {
      type: Array,
      value: [] as FilterItem[],
    },
    current: {
      type: String,
      value: '',
    },
  },

  methods: {
    onTagTap(e: WechatMiniprogram.BaseEvent) {
      const value = e.currentTarget.dataset.value as string;
      if (value !== this.properties.current) {
        this.triggerEvent('change', { value });
      }
    },
  },
});
