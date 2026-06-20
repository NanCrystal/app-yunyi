Component({
  properties: {
    title: {
      type: String,
      value: '',
    },
    showMore: {
      type: Boolean,
      value: false,
    },
    moreText: {
      type: String,
      value: 'VIEW ALL',
    },
    moreKey: {
      type: String,
      value: '',
    },
    themeColor: {
      type: String,
      value: '#aa0a27',
    },
    disabled: {
      type: Boolean,
      value: false,
    },
  },

  methods: {
    onMoreTap() {
      if (this.properties.disabled) return;
      console.log('[section-header] tap fired');
      this.triggerEvent('more', { key: this.properties.moreKey });
    },
  },
});
