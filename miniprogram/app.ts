// app.ts

/**
 * 检查小程序线上版本更新
 */
function checkForUpdates() {
  if (wx.canIUse('getUpdateManager')) {
    const updateManager = wx.getUpdateManager();

    updateManager.onCheckForUpdate((res) => {
      if (res.hasUpdate) {
        console.log('检测到新版本，正在后台下载...');
      }
    });

    updateManager.onUpdateReady(() => {
      wx.showModal({
        title: '更新提示',
        content: '新版本已经准备好，是否重启小程序以应用更新？',
        showCancel: false,
        confirmText: '重启更新',
        success: (res) => {
          if (res.confirm) {
            updateManager.applyUpdate();
          }
        }
      });
    });

    updateManager.onUpdateFailed(() => {
      wx.showModal({
        title: '更新失败',
        content: '检测到新版本，但下载失败了，请稍后尝试删除小程序重新搜索打开。',
        showCancel: true
      });
    });
  }
}

// 静态导入（替代动态 import，解决真机 "No module loader provided" 错误）
import { silentLogin } from './utils/auth';

App<IAppOption>({
  globalData: {
    // 音频播放状态 - 跨页面共享
    playingTrackId: null as string | null,
    isPlayingAudio: false,
    // 当前选中的角色 ID
    selectedCharId: 'yunyi',
    // 当前主题色（角色 accentColor，方便跨页面快速获取）
    selectedCharAccentColor: 'rgb(86, 164, 173)',

    // ─── 小程序用户认证 ──
    isLoggedIn: false,
    token: '',
    mpUserInfo: null as MpUserInfo | null,
  },

  onLaunch() {
    console.log('StarView Archive launched');
    checkForUpdates();
    this.restoreAuthState();

    // 静默登录：自动识别用户身份（无需弹窗）
    // - 有本地 token → 恢复登录态（已在 restoreAuthState 中完成）
    // - 无 token → 自动执行 wx.login 获取 openid 并创建基础用户
    silentLogin().then(ok => {
      if (ok) {
        const app = getApp<IAppOption>();
        console.log('[App] 静默登录成功, isProfileComplete=', app.globalData.mpUserInfo?.isProfileComplete);
      } else {
        console.log('[App] 静默登录未成功，以游客模式运行');
      }
    });
  },

  /** 从本地存储恢复登录态 */
  restoreAuthState() {
    try {
      const token = wx.getStorageSync('mp_auth_token') || '';
      // 微信 getStorageSync 会自动反序列化，直接返回对象/字符串
      const userInfo = wx.getStorageSync('mp_user_info') || null;

      this.globalData.isLoggedIn = !!token;
      this.globalData.token = token;
      this.globalData.mpUserInfo = userInfo;

      if (token) {
        console.log('[App] 登录态已恢复, userId=', userInfo?.id, ', isProfileComplete=', userInfo?.isProfileComplete);
      }
    } catch (e) {
      console.warn('[App] 恢复登录态失败:', e);
    }
  },
});
