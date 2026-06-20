/// <reference path="./types/index.d.ts" />

/** 小程序用户信息（来自后端 MpUser） */
interface MpUserInfo {
  id: number;
  nickName?: string;
  avatarUrl?: string;
}

interface IAppOption {
  globalData: {
    userInfo?: WechatMiniprogram.UserInfo;

    // ─── 小程序用户认证（新增）───
    isLoggedIn: boolean;          // 是否已登录
    token: string;                // JWT token
    mpUserInfo: MpUserInfo | null; // 后端用户信息

    // ─── 原有字段（不变）────────
    playingTrackId: string | null;
    isPlayingAudio: boolean;
    selectedCharId: string;
    selectedCharAccentColor: string;
    homeScrollTop?: number;
  }
  userInfoReadyCallback?: WechatMiniprogram.GetUserInfoSuccessCallback,
}

declare namespace WechatMiniprogram {
  interface WindowInfo {
    pixelRatio: number;
    screenWidth: number;
    screenHeight: number;
    windowWidth: number;
    windowHeight: number;
    statusBarHeight: number;
    safeArea: {
      left: number;
      right: number;
      top: number;
      bottom: number;
      width: number;
      height: number;
    };
    screenTop: number;
  }

  interface Wx {
    getWindowInfo(): WindowInfo;
    getDeviceInfo(): DeviceInfo;
  }
}