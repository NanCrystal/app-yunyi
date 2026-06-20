/** 日程事件状态 */
export type EventStatus = "ongoing" | "completed" | "cancelled" | "pending";

/** 日程事件 */
export interface EventItem {
  id: string;
  status: EventStatus;
  title: string;
  location: string;
  date: string;
  time: string;
  imageUrl?: string;
  icon?: string;
  statusLabel?: string;
}

/** 视频条目 */
export interface VideoItem {
  id: string;
  title: string;
  duration: string;
  date: string;
  thumbnail: string;
  tags: string[];
  description: string;
  publishedTime?: string;
  platform?: string;
  reviewImageUrl?: string;
  associatedPosts?: string[];
}

/** 社交平台类型 */
export type PlatformType =
  | "WEIBO"
  | "DOUYIN"
  | "XIAOHONGSHU"
  | "INSTAGRAM"
  | "ALL";

/** 社交动态媒体项 */
export interface PostMedia {
  type: "PHOTO" | "VIDEO";
  url: string;
  /** 视频封面图（仅 VIDEO 类型） */
  coverUrl?: string;
  /** 视频高清播放地址（仅 VIDEO 类型，用于 wx.previewMedia 播放） */
  hdUrl?: string;
}

/** 社交动态 */
export interface PostItem {
  id: string;
  title: string;
  date: string;
  /** @deprecated 使用 mediaList */
  images: string[];
  publishedTime: string;
  platform: "WEIBO" | "DOUYIN" | "XIAOHONGSHU" | "INSTAGRAM";
  platformIcon: string;
  icon: string;
  authorName: string;
  authorAvatar: string;
  mediaList: PostMedia[];
}

/** 照片条目 */
export interface PhotoItem {
  id: string;
  url: string;
  date: string;
  day: string;
  month: string;
  monthAbbr: string;
  title: string;
  file_name: string;
  location: string;
  reviewImageUrl?: string;
  tags: string[];
  type: "RAW" | "Video" | "Portrait";
  region: "Tokyo" | "Shanghai" | "Berlin" | "New York";
  system: "Phase One" | "Leica M" | "Hasselblad";
}

/** 小卡 */
export interface Photocard {
  id: string;
  title: string;
  date: string;
  imageUrl: string;
  reviewImageUrl?: string;
  specialEdition?: boolean;
}

/** 音频条目 */
export interface AudioItem {
  id: string;
  title: string;
  duration: string;
  durationSec: number;
  thumbnail: string;
  author: string;
  date: string;
  bitRate: string;
  coverUrl: string;
  audioUrl: string;
}
/** 音频条目 */
export interface AudioItem2 {
  id: number;
  fileName: string;
  title: string;
  artistId: string;
  qiniuKey: string;
  originalUrl: string;
  coverUrl: string;
  mimeType: any;
  size: any;
  duration: any;
  codec: any;
  bitrate: any;
  shootDate: string;
  tagTypeId: any;
  tagLocationId: any;
  tagPlatformId: any;
  tagCardTypeId: any;
  itineraryId: any;
  description: string;
  status: string;
  sortOrder: number;
  deletedAt: any;
  createdAt: string;
  updatedAt: string;
  tagType: any;
  tagLocation: any;
  tagPlatform: any;
  itinerary: any;
}

/** 角色 */
export interface Character {
  id: number;
  artistId: string;
  name: string;
  avatar: string;
  role?: string;
  accentColor?: string;
  bio?: string;
  weiboId?: string | null;
  weiboNickname?: string | null;
  weiboAvatar?: string | null;
  weiboPlatformId?: number | null;
  douyinSecUid?: string | null;
  douyinNickname?: string | null;
  douyinAvatar?: string | null;
  douyinPlatformId?: number | null;
  xhsId?: string | null;
  xhsNickname?: string | null;
  xhsAvatar?: string | null;
  xhsPlatformId?: number | null;
  igId?: string | null;
  igToken?: string | null;
  igNickname?: string | null;
  igAvatar?: string | null;
  igPlatformId?: number | null;
  syncEnabled?: boolean;
  syncWeibo?: boolean;
  syncDouyin?: boolean;
  syncXiaohongshu?: boolean;
  syncInstagram?: boolean;
  fullSynced?: boolean;
  createdAt?: string;
  updatedAt?: string;
}
/** 角色 */
export interface ArtistItem {
  name: string;
  artistId: string;
  avatar: string;
  bio?: string;
  weiboId?: string;
  weiboNickname?: string;
  weiboAvatar?: string;
  weiboPlatformId?: number;
  douyinSecUid?: string;
  douyinNickname?: string;
  douyinAvatar?: string;
  douyinPlatformId?: number;
  xhsId?: string;
  xhsNickname?: string;
  xhsAvatar?: string;
  xhsPlatformId?: number;
  igId?: string;
  igToken?: string;
  igNickname?: string;
  igAvatar?: string;
  igPlatformId?: number;
  syncEnabled?: boolean;
  syncWeibo?: boolean;
  syncDouyin?: boolean;
  syncXiaohongshu?: boolean;
  syncInstagram?: boolean;
}
export interface PlatformResType {
  id: number;
  name: string;
  uuid: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}
export interface AritistResType {
  id: number;
  name: string;
  artistId: string;
  avatar: string;
  bio: any;
  weiboId: any;
  weiboNickname: any;
  weiboAvatar: any;
  weiboPlatformId: any;
  douyinSecUid: any;
  douyinNickname: any;
  douyinAvatar: any;
  douyinPlatformId: any;
  xhsId: string;
  xhsNickname: string;
  xhsAvatar: string;
  xhsPlatformId: number;
  igId: any;
  igToken: any;
  igNickname: any;
  igAvatar: any;
  igPlatformId: any;
  syncEnabled: boolean;
  fullSynced: boolean;
  createdAt: string;
  updatedAt: string;
}
