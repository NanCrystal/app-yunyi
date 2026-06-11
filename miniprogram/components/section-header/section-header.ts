import { themeBehavior } from '../../behaviors/theme';

Component({
  behaviors: [themeBehavior],

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
  },

  methods: {
    onMoreTap() {
      this.triggerEvent('more', { key: this.properties.moreKey });
    },
  },
});
