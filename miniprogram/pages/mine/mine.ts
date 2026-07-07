// pages/mine.ts

import { withTheme } from "../../behaviors/theme";
import {
  isLoggedIn,
  isProfileComplete,
  getUserInfo,
  logout,
} from "../../utils/auth";

interface MineData {
  /** 系统状态栏高度 */
  statusBarHeight: number;
  tabTabs: { key: string; label: string; icon: string }[];
  /** 是否已登录 */
  loggedIn: boolean;
  /** 资料是否完整（nickName + avatarUrl 均非空） */
  isProfileComplete: boolean;
  /** 用户昵称 */
  nickName: string;
  /** 用户头像 URL */
  avatarUrl: string;
  /** 是否显示登录弹窗 */
  showLoginPopup: boolean;
  /** 弹窗模式：register 或 complete */
  loginMode: string;
  /** 是否显示帮助弹窗 */
  showHelpPopup: boolean;
  /** 是否显示联系客服弹窗（二维码） */
  showContactPopup: boolean;
  /** 是否显示评论菜单项（取决于 cached_modules 中是否有 comments 模块） */
  showCommentsMenu: boolean;
  /** 是否显示帮助菜单项（取决于 cached_modules 中是否有 feedback 模块） */
  showHelpMenu: boolean;
}

Page(
  withTheme({
    data: {
      tabTabs: [
        { key: "home", label: "首页", icon: "/assets/icons/home.png" },
        { key: "mine", label: "我的", icon: "/assets/icons/mine.png" },
      ],
      statusBarHeight: 20,
      loggedIn: false,
      isProfileComplete: false,
      nickName: "GUEST",
      avatarUrl: "/assets/icons/user-default.svg",
      showLoginPopup: false,
      loginMode: "register",
      showHelpPopup: false,
      showContactPopup: false,
      showCommentsMenu: false,
      showHelpMenu: false,
      title: "SUPPORT & FEEDBACK",
      menuObj: {
        comments: {
          title: "COMMENTS",
          icon: "/assets/icons/arrow_right.svg",
        },
        help: {
          title: "SUPPORT & FEEDBACK",
          icon: "/assets/icons/arrow_right.svg",
        },
      },
    } as MineData,

    /** 页面加载：获取系统状态栏高度 */
    onLoad() {
      const { statusBarHeight } = (wx as any).getWindowInfo
        ? (wx as any).getWindowInfo()
        : wx.getSystemInfoSync();
      this.setData({ statusBarHeight });
      this._syncLoginState();
      this._checkCommentsModule();
    },

    onShow() {
      // 每次显示页面时同步最新登录态
      this._syncLoginState();
      this._checkCommentsModule();
    },

    /** 从 auth 工具函数同步登录状态到 data */
    _syncLoginState() {
      const logIn = isLoggedIn();
      const info = getUserInfo();

      this.setData({
        loggedIn: logIn,
        isProfileComplete: logIn ? isProfileComplete() : false,
        nickName: logIn && info?.nickName ? info.nickName : "GUEST",
        avatarUrl:
          logIn && info?.avatarUrl
            ? info.avatarUrl
            : "/assets/icons/user-default.svg",
      });
    },

    /** 检查 cached_modules 中是否有 comments 和 feedback 模块 */
    _checkCommentsModule() {
      try {
        const modules = wx.getStorageSync("cached_modules");
        const showComments = Array.isArray(modules) &&
          modules.some((m: any) => m?.key === "comments");
        const showHelp = Array.isArray(modules) &&
          modules.some((m: any) => m?.key === "feedback");
        this.setData({ showCommentsMenu: showComments, showHelpMenu: showHelp });
      } catch (err) {
        console.warn("[mine] 读取 cached_modules 失败", err);
        this.setData({ showCommentsMenu: false, showHelpMenu: false });
      }
    },

    /** 显示登录/完善资料弹窗 */
    onShowPopup() {
      const mode = this.data.loggedIn ? "complete" : "register";
      this.setData({
        showLoginPopup: true,
        loginMode: mode,
      });
    },

    /** 登录弹窗成功回调 */
    onLoginSuccess() {
      this.setData({ showLoginPopup: false });
      this._syncLoginState();
    },

    /** 登录弹窗取消回调 */
    onLoginCancel() {
      this.setData({ showLoginPopup: false });
    },

    onLogoutTap() {
      wx.showModal({
        title: "退出登录",
        content: "确定要退出当前账号吗？",
        confirmText: "退出",
        confirmColor: "#E74C3C",
        success: (res) => {
          if (res.confirm) {
            logout();
            this._syncLoginState();
            wx.showToast({ title: "已退出", icon: "none" });
          }
        },
      });
    },

    onCommentsTap() {
      wx.navigateTo({ url: "/pages/comments/comments" });
    },
    onHelpTap() {
      this.setData({ showHelpPopup: true });
    },

    /** 关闭帮助弹窗 */
    onCloseHelpPopup() {
      this.setData({ showHelpPopup: false });
    },

    /** 点击联系客服 - 显示二维码弹窗 */
    onContactServiceTap() {
      this.setData({ showContactPopup: true, showHelpPopup: false });
    },

    /** 关闭联系客服弹窗，返回帮助弹窗 */
    onCloseContactPopup() {
      this.setData({ showContactPopup: false, showHelpPopup: true });
    },

    /** 点击直接反馈 - 跳转反馈页面 */
    onFeedbackTap() {
      this.setData({ showHelpPopup: false });
      wx.navigateTo({ url: "/pages/feedback/feedback" });
    },

    /** 长按二维码 - 弹出操作菜单 */
    onQrcodeLongPress() {
      wx.showActionSheet({
        itemList: ['保存图片到相册'],
        success: (res) => {
          if (res.tapIndex === 0) {
            this.handleSaveQrcode();
          }
        }
      });
    },

    /** 保存二维码到相册 */
    handleSaveQrcode() {
      const imageUrl = '/assets/images/help.png';

      // 获取图片信息并保存到相册
      wx.saveImageToPhotosAlbum({
        filePath: imageUrl,
        success: () => {
          this.showSaveSuccessGuide();
        },
        fail: (err) => {
          // 处理权限拒绝的情况
          if (err.errMsg.includes('auth deny') || err.errMsg.includes('authorize')) {
            wx.showModal({
              title: '需要相册权限',
              content: '请允许访问您的相册以保存图片',
              confirmText: '去设置',
              success: (res) => {
                if (res.confirm) {
                  wx.openSetting();
                }
              }
            });
          } else {
            wx.showToast({
              title: '保存失败，请重试',
              icon: 'none'
            });
          }
        }
      });
    },

    /** 保存成功后的引导弹窗 */
    showSaveSuccessGuide() {
      wx.showModal({
        title: '✓ 图片已保存',
        content: '接下来请：\n1. 打开微信「扫一扫」\n2. 点击右上角「从相册选取」\n3. 选择刚保存的图片\n4. 即可自动识别并添加好友',
        showCancel: false,
        confirmText: '我知道了'
      });
    },
  })
);
