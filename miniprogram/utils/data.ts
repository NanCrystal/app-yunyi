import type {
  EventItem,
  VideoItem,
  PostItem,
  PhotoItem,
  Photocard,
  AudioItem,
  Character,
  PlatformResType,
  AritistResType,
} from "./types";
// ==================== 日程事件 ====================
export const initialEvents: EventItem[] = [];

// ==================== 视频档案 ====================
export const initialVideos: VideoItem[] = [];

// ==================== 社交动态 ====================
export const initialPosts: PostItem[] = [];

// ==================== 照片档案 ====================
export const initialPhotos: PhotoItem[] = [];

// ==================== 小卡 ====================
export const initialCards: Photocard[] = [];

// ==================== 音频 ====================
export const initialAudio: AudioItem[] = [];

// ==================== 轮播图 ====================
export const heroSliderImages: string[] = [];

// ==================== 角色 ====================
export const characters: Character[] = [
  {
    id: 4,
    name: "云熠",
    artistId: "yunyi",
    avatar: "/uploads/1780595655393-763524.webp",
    bio: undefined,
    weiboId: null,
    weiboNickname: null,
    weiboAvatar: null,
    weiboPlatformId: null,
    douyinSecUid: null,
    douyinNickname: null,
    douyinAvatar: null,
    douyinPlatformId: null,
    xhsId: "692c6aac000000000300db53",
    xhsNickname: "云熠小世界",
    xhsAvatar: "/uploads/1780595619236-330245.webp",
    xhsPlatformId: 2,
    igId: null,
    igToken: null,
    igNickname: null,
    igAvatar: null,
    igPlatformId: null,
    syncEnabled: false,
    fullSynced: false,
    createdAt: "2026-06-04T17:54:32.051Z",
    updatedAt: "2026-06-04T17:54:32.051Z",
  },
  {
    id: 2,
    name: "云旗",
    artistId: "yunqi",
    avatar: "/uploads/1780521591404-109038.jpg",
    bio: undefined,
    weiboId: "7997469042",
    weiboNickname: "云旗Yunqi",
    weiboAvatar: "/uploads/1780569703782-748349.jpg",
    weiboPlatformId: 1,
    douyinSecUid:
      "MS4wLjABAAAA3EZIhf-3zjhy2NwCGYNt2e4gdUl1DXcgRbVRovLUmEeQ1PiFOylXfdPYi1-5T_fz",
    douyinNickname: "云旗Yunqi",
    douyinAvatar: "/uploads/1780569695245-370006.jpg",
    douyinPlatformId: 4,
    xhsId: "63f1f40a000000001001d4a8",
    xhsNickname: "云旗Yunqi",
    xhsAvatar: "/uploads/1780569652610-379374.jpg",
    xhsPlatformId: 2,
    igId: "yunqii_0811",
    igToken: null,
    igNickname: "yunqii_0811",
    igAvatar: "/uploads/1780569672225-582497.jpg",
    igPlatformId: 3,
    syncEnabled: false,
    fullSynced: true,
    createdAt: "2026-06-03T21:19:56.655Z",
    updatedAt: "2026-06-04T17:37:34.253Z",
  },
  {
    id: 1,
    name: "郝熠然",
    artistId: "haoyiran",
    avatar: "/uploads/1780521491823-715722.jpg",
    bio: undefined,
    weiboId: "6372221076",
    weiboNickname: "郝熠然",
    weiboAvatar: "/uploads/1780570240319-53145.jpg",
    weiboPlatformId: 1,
    douyinSecUid: "MS4wLjABAAAA9hJgduKImx3ZesbSpS3Q3htdTNO5XZXSpiZxIvRXros",
    douyinNickname: "郝熠然",
    douyinAvatar: "/uploads/1780570243862-921643.jpg",
    douyinPlatformId: 4,
    xhsId: "5f6723160000000001006495",
    xhsNickname: "郝熠然",
    xhsAvatar: "/uploads/1780570284938-694924.jpg",
    xhsPlatformId: 2,
    igId: "haoyiran_0912",
    igToken: null,
    igNickname: "haoyiran_0912",
    igAvatar: "/uploads/1780570260413-553192.jpg",
    igPlatformId: 3,
    syncEnabled: false,
    fullSynced: true,
    createdAt: "2026-06-03T21:18:26.931Z",
    updatedAt: "2026-06-04T16:37:51.237Z",
  },
];
// ==================== 平台 ====================
export const systemPlantforms: PlatformResType[] = [];
// ==================== 平台角色 ====================
export const systemArtist: AritistResType[] = [];
