Component({
  properties: {
    /** 是否展示（由父组件根据 _guestLimit 控制） */
    show: {
      type: Boolean,
      value: false,
    },
  },

  methods: {
    onTap() {
      this.triggerEvent('login');
    },
  },
});
