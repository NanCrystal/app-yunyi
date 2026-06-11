/// <reference path="./types/index.d.ts" />

interface IAppOption {
  globalData: {
    userInfo?: WechatMiniprogram.UserInfo;
    playingTrackId: string | null;
    isPlayingAudio: boolean;
    selectedCharId: string;
    selectedCharAccentColor: string;
    homeScrollTop?: number;
  }
  userInfoReadyCallback?: WechatMiniprogram.GetUserInfoSuccessCallback,
}