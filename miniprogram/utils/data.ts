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
export const initialAudio: AudioItem[] = [
  {
    id: "a1",
    title: "Atmospheric_Resonance_Site_04.wav",
    duration: "04:22",
    durationSec: 262,
    thumbnail: "/pages/assets/images/1.jpg",
    coverUrl: "/pages/assets/images/1.jpg",
    author: "Hao Yiran",
    date: "2026.06.12",
    bitRate: "320kbps",
  },
  {
    id: "a2",
    title: "Deep_Field_Recording_Nocturnal.flac",
    duration: "12:45",
    durationSec: 765,
    thumbnail: "/pages/assets/images/1.jpg",
    coverUrl: "/pages/assets/images/1.jpg",
    author: "Yunyi Space",
    date: "2026.06.12",
    bitRate: "LOSSLESS",
  },
  {
    id: "a3",
    title: "Urban_Static_Analysis_Log_002.mp3",
    duration: "01:15",
    durationSec: 75,
    thumbnail: "/pages/assets/images/1.jpg",
    coverUrl: "/pages/assets/images/1.jpg",
    author: "Yunqi Curation",
    date: "2026.06.12",
    bitRate: "320kbps",
  },
  {
    id: "a4",
    title: "Modular_Synthesis_Drift_A.wav",
    duration: "08:30",
    durationSec: 510,
    thumbnail: "/pages/assets/images/1.jpg",
    coverUrl: "/pages/assets/images/1.jpg",
    author: "StarView Lab",
    date: "2026.05.24",
    bitRate: "320kbps",
  },
];

// ==================== 轮播图 ====================
export const heroSliderImages: string[] = [
  "/pages/assets/images/1.jpg",
  "/pages/assets/images/1.jpg",
  "/pages/assets/images/1.jpg",
  "/pages/assets/images/1.jpg",
];

// ==================== 角色 ====================
export const characters: Character[] = [
  {
    id: "char1",
    artistId: "yunyi",
    name: "云熠",
    avatar: "/pages/assets/images/1 (3).jpg",
    role: "DUO HARMONY",
    accentColor: "rgb(86, 164, 173)",
  },
  {
    id: "char2",
    artistId: "haoyiran",
    name: "郝熠然",
    avatar: "/pages/assets/images/1 (46).jpg",
    role: "VOCALIST / ART DIRECTORY",
    accentColor: "#aa0a27",
  },
  {
    id: "char3",
    artistId: "yunqi",
    name: "云旗",
    avatar: "/pages/assets/images/1 (40).jpg",
    role: "PERFORMER / COMPOSER",
    accentColor: "rgb(254, 168, 53)",
  },
];
// ==================== 平台 ====================
export const systemPlantforms: PlatformResType[] = [
  {
    id: 1,
    name: "微博",
    uuid: "weibo",
    sortOrder: 1,
    createdAt: "2026-06-03T21:20:41.632Z",
    updatedAt: "2026-06-04T17:16:50.578Z",
  },
  {
    id: 2,
    name: "小红书",
    uuid: "xiaohongshu",
    sortOrder: 2,
    createdAt: "2026-06-03T21:20:48.623Z",
    updatedAt: "2026-06-04T17:16:59.947Z",
  },
  {
    id: 3,
    name: "Instagram",
    uuid: "instagram",
    sortOrder: 3,
    createdAt: "2026-06-03T21:21:06.377Z",
    updatedAt: "2026-06-04T17:17:41.891Z",
  },
  {
    id: 4,
    name: "抖音",
    uuid: "douyin",
    sortOrder: 4,
    createdAt: "2026-06-03T21:21:15.372Z",
    updatedAt: "2026-06-04T17:17:49.309Z",
  },
];
// ==================== 平台角色 ====================
export const systemArtist: AritistResType[] = [
  {
    id: 4,
    name: "云熠",
    artistId: "yunyi",
    avatar: "/uploads/1780595655393-763524.webp",
    bio: null,
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
    bio: null,
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
    bio: null,
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
