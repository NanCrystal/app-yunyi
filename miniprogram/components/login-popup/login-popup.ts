import { isLoggedIn, isProfileComplete, loginWithNewProfile, updateProfile, login, completeProfile } from "../../utils/auth";

Component({
  properties: {
    /** 控制弹窗显隐 */
    show: {
      type: Boolean,
      value: false,
    },
    /** 弹窗模式：'register'=未登录需要注册(选头像+昵称) | 'complete'=已登录需完善资料 | 'login'=纯静默登录(兼容) */
    mode: {
      type: String,
      value: '',  // 空字符串 = 自动推断
    },
    /** 自定义标题（默认根据 mode 自动设置） */
    title: {
      type: String,
      value: '',
    },
    /** 自定义说明文字（默认根据 mode 自动设置） */
    description: {
      type: String,
      value: '',
    },
  },

  data: {
    loading: false,
    // 表单状态（register/complete 模式用）
    tempAvatarUrl: '',
    tempNickName: '',
    // 计算属性
    _computedTitle: '',
    _computedDesc: '',
    _btnText: '',
    // 当前有效模式（自动推断后）
    _effectiveMode: '' as string,
    // 头像选择锁（防止 chooseAvatar 并发冲突）
    _avatarChoosing: false,
  },

  observers: {
    show(val: boolean) {
      if (val) {
        this.setData({ loading: false });
        this._updateComputedTexts();
        this._inferMode();
      }
    },
    mode() {
      this._updateComputedTexts();
      this._inferMode();
    },
  },

  lifetimes: {
    attached() {
      this._updateComputedTexts();
      this._inferMode();
    },
  },

  methods: {
    /** 更新计算属性（标题/描述/按钮文案） */
    _updateComputedTexts() {
      const effectiveMode = this.data._effectiveMode || this.data.mode;
      
      let title = this.data.title || '';
      let desc = this.data.description || '';
      let btnText = '微信一键登录';

      switch (effectiveMode) {
        case 'register':
          if (!title) title = '欢迎来到';
          if (!desc) desc = '完善信息以解锁全部功能';
          break;
        case 'complete':
          if (!title) title = '解锁全部功能';
          if (!desc) desc = '完善头像和昵称后即可下载原图、高清视频并参与讨论';
          btnText = '立即完善资料';
          break;
        case 'login':
        default:
          if (!title) title = '需要登录';
          if (!desc) desc = '登录后即可解锁完整功能，查看高清原图并下载收藏';
          break;
      }

      this.setData({
        _computedTitle: title,
        _computedDesc: desc,
        _btnText: btnText,
      });
    },

    /** 自动推断模式：未传或空字符串时根据登录态决定 */
    _inferMode() {
      if (this.data.mode && this.data.mode !== '') {
        this.setData({ _effectiveMode: this.data.mode });
        return;
      }

      // 自动推断
      if (!isLoggedIn()) {
        this.setData({ _effectiveMode: 'register' });
      } else if (!isProfileComplete()) {
        this.setData({ _effectiveMode: 'complete' });
      } else {
        this.setData({ _effectiveMode: 'login' });
      }
      this._updateComputedTexts();
    },

    /** 空操作，用于 catch:tap 阻止事件冒泡 */
    noop() {},

    /**
     * 安全获取头像 URL（处理 HTTP 协议兼容问题）
     * 微信开发者工具 Windows 环境下临时文件路径为 http://tmp/xxx
     * 真机上使用 wxfile:// 或 https:// 协议，不会有此问题
     */
    getSafeAvatarUrl(url: string): string {
      if (!url) return '';
      // 临时文件路径在开发者工具中可能以 http://tmp/ 开头
      // 这种情况下直接返回（开发者工具特有问题，真机正常）
      // 如果是其他非 HTTPS 的远程地址则返回空字符串避免警告
      if (url.startsWith('http://') && !url.startsWith('http://tmp/')) {
        console.warn('[LoginPopup] 检测到非 HTTPS 远程图片链接:', url);
        return '';
      }
      return url;
    },

    /** 遮罩点击 - 不关闭（强制操作） */
    onMaskTap() {
      // 故意不关闭，引导用户必须做选择
    },

    /* ========== 表单模式方法 (register/complete) ========== */

    /** 选择头像回调 */
    onChooseAvatar(e: WechatMiniprogram.TouchEvent) {
      // 防抖锁：如果正在选择中，忽略本次点击（避免 chooseAvatar 并发冲突）
      if (this.data._avatarChoosing) return;
      this.setData({ _avatarChoosing: true });

      const avatarUrl = e.detail.avatarUrl || '';
      console.log('[LoginPopup] 用户选择头像:', avatarUrl);
      
      // 处理临时文件路径的 HTTP 协议兼容问题
      // 微信开发者工具 Windows 环境下临时路径为 http://tmp/xxx
      // 这种路径在真机上不会出现（使用 wxfile:// 协议）
      let safeUrl = avatarUrl;
      if (avatarUrl.startsWith('http://') && !avatarUrl.startsWith('http://tmp/')) {
        console.warn('[LoginPopup] 检测到非 HTTPS 远程图片链接:', avatarUrl);
        safeUrl = '';
      }
      this.setData({ tempAvatarUrl: safeUrl });

      // 延迟释放锁（500ms 防止快速重复点击）
      setTimeout(() => {
        this.setData({ _avatarChoosing: false });
      }, 500);
    },

    /** 输入昵称回调 */
    onNicknameInput(e: WechatMiniprogram.Input) {
      this.setData({ tempNickName: e.detail.value });
    },

    /** 取消表单编辑 */
    onCancelTap() {
      this.triggerEvent('cancel');
      this._close();
    },

    /** 确认表单提交（注册/完善资料） */
    async onConfirmForm() {
      const { tempAvatarUrl, tempNickName, loading, _effectiveMode } = this.data;

      if (loading) return;

      if (!tempNickName) {
        wx.showToast({ title: '请输入昵称', icon: 'none' });
        return;
      }
      if (!tempAvatarUrl) {
        wx.showToast({ title: '请选择头像', icon: 'none' });
        return;
      }

      this.setData({ loading: true });

      try {
        let success = false;

        if (_effectiveMode === 'complete') {
          // 已登录 → 更新资料
          success = await updateProfile(tempAvatarUrl, tempNickName);
          if (success) wx.showToast({ title: '资料更新成功', icon: 'success' });
        } else {
          // 未登录 → 新注册
          success = await loginWithNewProfile(tempAvatarUrl, tempNickName);
          if (success) wx.showToast({ title: '欢迎', icon: 'success' });
        }

        if (success) {
          setTimeout(() => {
            this.triggerEvent('loginSuccess');
            this._close();
          }, 800);
        } else {
          wx.showToast({ title: '操作失败，请重试', icon: 'none' });
          this.setData({ loading: false });
        }
      } catch (err) {
        console.error('[LoginPopup] 操作异常:', err);
        wx.showToast({ title: '操作异常', icon: 'none' });
        this.setData({ loading: false });
      }
    },

    /* ========== 纯登录模式方法 (login - 向后兼容) ========== */

    /** 登录或完善资料（纯 login 模式） */
    async onLoginTap() {
      if (this.data.loading) return;
      this.setData({ loading: true });

      try {
        let success = false;
        const effectiveMode = this.data._effectiveMode;

        if (effectiveMode === 'complete') {
          success = await completeProfile();
          if (success) wx.showToast({ title: '资料完善成功', icon: 'success' });
        } else {
          success = await login();
          if (success) wx.showToast({ title: '登录成功', icon: 'success' });
        }

        if (success) {
          setTimeout(() => {
            this.triggerEvent('loginSuccess');
            this._close();
          }, 800);
        } else {
          const errMsg = effectiveMode === 'complete' ? '完善失败，请重试' : '登录失败，请重试';
          wx.showToast({ title: errMsg, icon: 'none' });
          this.setData({ loading: false });
        }
      } catch (err) {
        console.error('[LoginPopup] 操作异常:', err);
        wx.showToast({ title: '操作异常', icon: 'none' });
        this.setData({ loading: false });
      }
    },

    /** 关闭弹窗 */
    _close() {
      this.setData({
        show: false,
        loading: false,
        tempAvatarUrl: '',
        tempNickName: '',
      });
    },
  },
});
