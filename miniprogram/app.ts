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

App<IAppOption>({
  globalData: {
    // 音频播放状态 - 跨页面共享
    playingTrackId: null as string | null,
    isPlayingAudio: false,
    // 当前选中的角色 ID
    selectedCharId: 'yunyi',
    // 当前主题色（角色 accentColor，方便跨页面快速获取）
    selectedCharAccentColor: 'rgb(86, 164, 173)',
  },

  onLaunch() {
    console.log('StarView Archive launched');
    checkForUpdates();
  },
});