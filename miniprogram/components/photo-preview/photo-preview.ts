import { formatFileSize } from "../../utils/util";
import { isLoggedIn, isProfileComplete } from "../../utils/auth";

Component({
  properties: {
    /** 当前预览的照片对象（保留兼容） */
    photo: {
      type: Object,
      value: undefined,
    },
    /** 当前预览索引 */
    index: {
      type: Number,
      value: 0,
    },
    /** 照片总数 */
    total: {
      type: Number,
      value: 0,
    },
    /** 所有照片列表（用于 swiper 滑动） */
    photos: {
      type: Array,
      value: [],
    },
  },

  data: {
    /** 记录每张照片是否已切换为原图，key 为照片 id */
    originalMap: {} as Record<string, boolean>,
    /** 是否已登录 */
    loggedIn: false,
    /** 是否已完善资料（nickName + avatarUrl） */
    profileComplete: false,
    /** 是否显示登录弹窗 */
    showLoginPopup: false,
    /** login-popup 模式：register=未登录 / complete=已登录缺资料 */
    loginMode: 'register',
  },

  observers: {
    /** 预处理 photos，为每项生成格式化后的 size 文本 */
    photos: function (photos: any[]) {
      if (!photos || photos.length === 0) return;
      // 防止 observer 循环触发
      if ((photos[0] as any)._sizeText !== undefined) return;
      // 当照片列表变化时，重置原图查看状态
      this.setData({ originalMap: {} });
      const processed = photos.map((item: any) => ({
        ...item,
        _sizeText: item.size ? formatFileSize(item.size) : "",
      }));
      this.setData({ photos: processed });
    },
  },

  lifetimes: {
    attached() {
      this._syncAuthState();
    },
  },

  pageLifetimes: {
    show() {
      // 每次显示时同步最新登录态和资料完善状态
      this._syncAuthState();
    },
  },

  methods: {
    /** 同步登录态与资料完善状态到 data */
    _syncAuthState() {
      const loggedIn = isLoggedIn();
      const profileComplete = isProfileComplete();
      this.setData({
        loggedIn,
        profileComplete,
        // 已登录但缺资料 → complete；未登录 → register
        loginMode: loggedIn && !profileComplete ? 'complete' : 'register',
      });
    },

    /** 空操作，用于 catch:tap 阻止事件冒泡 */
    noop() {},

    /** 点击图片关闭预览 */
    onClose() {
      this.triggerEvent("close");
    },

    /** swiper 滑动切换 */
    onSwiperChange(e: WechatMiniprogram.SwiperChange) {
      if (e.detail.source === "touch") {
        this.triggerEvent("swiperchange", { current: e.detail.current });
      }
    },

    /** 查看原图 — 登录 + 资料完善检测 */
    onViewOriginal() {
      if (!this.data.loggedIn || !this.data.profileComplete) {
        this.setData({ showLoginPopup: true });
        return;
      }

      const currentPhoto = this.data.photos[this.data.index] || this.data.photo;
      if (!currentPhoto) return;

      // 游客模式下 rawUrl 可能为 null
      const rawUrl = currentPhoto.rawUrl || '';
      if (!rawUrl) {
        wx.showToast({ title: '原图不可用', icon: 'none' });
        return;
      }

      const id = currentPhoto.id;
      this.setData({
        [`originalMap.${id}`]: true,
      });
      this.triggerEvent("vieworiginal");
    },

    /** 下载当前图片 — 登录 + 资料完善检测 */
    onDownload() {
      if (!this.data.loggedIn || !this.data.profileComplete) {
        this.setData({ showLoginPopup: true });
        return;
      }
      const currentPhoto = this.data.photos[this.data.index] || this.data.photo;

      // 游客模式兜底
      if (!currentPhoto.rawUrl) {
        wx.showToast({ title: '请登录后下载', icon: 'none' });
        return;
      }

      this.triggerEvent("download", { photo: currentPhoto });
    },

    /** 收藏当前图片 */
    onFavorite() {
      this.triggerEvent("favorite", { photo: this.data.photo });
    },

    /** 登录弹窗回调：登录成功 */
    onLoginSuccess() {
      this._syncAuthState();
      this.setData({ showLoginPopup: false });
    },

    /** 登录弹窗回调：取消 */
    onLoginCancel() {
      this.setData({ showLoginPopup: false });
    },
  },
});
