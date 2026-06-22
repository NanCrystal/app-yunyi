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
} from "../utils/types";
import { get, put } from "../services/request";
import {
  initialEvents,
  initialVideos,
  initialPosts,
  initialPhotos,
  initialCards,
  initialAudio,
  heroSliderImages,
  characters,
  systemPlantforms,
  systemArtist,
} from "../utils/data";

const apiArtistList: any = [];
const apiBanners: any = [];
const recent_sync: any = [];
const recent_itinerary: any = [];
const recent_photos: any = [];
const recent_videos: any = [];
const recent_card: any = [];
const recent_voices: any = [];

export const colorList: any = [
  {
    name: "yunyi",
    accentColor: "rgb(86, 164, 173)",
  },
  {
    name: "haoyiran",
    accentColor: "#aa0a27",
  },
  {
    name: "yunqi",
    accentColor: "rgb(254, 168, 53)",
  },
];
// 艺人 accentColor 映射
const artistColorMap: Record<string, string> = {};
colorList.forEach((c: any) => {
  if (c.name && c.accentColor) {
    artistColorMap[c.name] = c.accentColor;
  }
});

const defaultAccentColor = "rgb(86, 164, 173)";

/** 获取轮播图列表 */
export const getHeroSliderImages = (): string[] => {
  return heroSliderImages;
};

/** 调用后端接口获取艺人列表，映射为 Character[] */
export const fetchArtists = async (): Promise<Character[]> => {
  const list = await get<any[]>("/artists");
  return list.map((a: any) => ({
    ...a,
    id: a.artistId,
    artistId: a.artistId,
    name: a.name,
    role: "",
    accentColor: artistColorMap[a.artistId] || defaultAccentColor,
  }));
};

/** 更新艺人配置（含平台同步开关） */
export const updateArtist = (id: number, data: Partial<Character>) => {
  return put(`/artists/${id}`, data);
};

/** 获取角色列表（本地 mock，兼容旧调用） */
export const getCharacters = (): Character[] => {
  return characters.map((c) => ({
    ...c,
    accentColor: artistColorMap[c.artistId] || defaultAccentColor,
  }));
};

/** 获取日程列表（本地 mock 数据，预留） */
export const getEvents = (): EventItem[] => {
  return initialEvents;
};

/** 获取日程列表（后端接口） */
export const getItineraries = (params: {
  artistId: string;
  period?: string;
  date?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}) => {
  const queryParams: Record<string, any> = {
    artistId: params.artistId,
    period: params.period || "year",
    date: params.date,
    page: params.page || 1,
    pageSize: params.pageSize || 20,
  };
  // status 为全部时不传
  if (params.status && params.status !== "ALL") {
    queryParams.status = params.status;
  }
  return get<{ list: any[]; total: number }>("/itineraries", queryParams);
};

/** 获取视频列表 */
export const getVideos = (): VideoItem[] => {
  return initialVideos;
};

/** 获取社交动态列表 */
export const getPosts = (): PostItem[] => {
  return initialPosts;
};

/** 获取照片列表 */
export const getPhotos = (): PhotoItem[] => {
  return initialPhotos;
};

/** 调用后端接口获取照片列表（按月分页） */
export const fetchPhotoList = (params: {
  yearMonth?: string;
  page?: number;
  pageSize?: number;
  artistIds?: string[];
  typeIds?: number[];
  locationIds?: number[];
  platformIds?: number[];
}) => {
  const queryParams: Record<string, any> = {
    page: params.page || 1,
    pageSize: params.pageSize || 50,
  };
  if (params.yearMonth) queryParams.yearMonth = params.yearMonth;
  if (params.artistIds?.length)
    queryParams.artistIds = params.artistIds.join(",");
  if (params.typeIds?.length) queryParams.typeIds = params.typeIds.join(",");
  if (params.locationIds?.length)
    queryParams.locationIds = params.locationIds.join(",");
  if (params.platformIds?.length)
    queryParams.platformIds = params.platformIds.join(",");

  return get<{ items: any[]; total: number; page: number; pageSize: number }>(
    "/photos/by-month",
    queryParams
  );
};

/** 调用后端接口获取照片时间轴（按月统计） */
export const fetchPhotoTimeline = (params: {
  artistIds?: string[];
  typeIds?: number[];
  locationIds?: number[];
  platformIds?: number[];
}) => {
  const queryParams: Record<string, any> = {};
  if (params.artistIds?.length)
    queryParams.artistIds = params.artistIds.join(",");
  if (params.typeIds?.length) queryParams.typeIds = params.typeIds.join(",");
  if (params.locationIds?.length)
    queryParams.locationIds = params.locationIds.join(",");
  if (params.platformIds?.length)
    queryParams.platformIds = params.platformIds.join(",");

  return get<{ yearMonth: string; count: number }[]>(
    "/photos/timeline",
    queryParams
  );
};

/** 调用后端接口获取视频列表（按月分页） */
export const fetchVideoList = (params: {
  yearMonth?: string;
  page?: number;
  pageSize?: number;
  artistIds?: string[];
  typeIds?: number[];
  locationIds?: number[];
  platformIds?: number[];
}) => {
  const queryParams: Record<string, any> = {
    page: params.page || 1,
    pageSize: params.pageSize || 50,
  };
  if (params.yearMonth) queryParams.yearMonth = params.yearMonth;
  if (params.artistIds?.length)
    queryParams.artistIds = params.artistIds.join(",");
  if (params.typeIds?.length) queryParams.typeIds = params.typeIds.join(",");
  if (params.locationIds?.length)
    queryParams.locationIds = params.locationIds.join(",");
  if (params.platformIds?.length)
    queryParams.platformIds = params.platformIds.join(",");

  return get<{ items: any[]; total: number; page: number; pageSize: number }>(
    "/videos/by-month",
    queryParams
  );
};

/** 调用后端接口获取视频时间轴（按月统计） */
export const fetchVideoTimeline = (params: {
  artistIds?: string[];
  typeIds?: number[];
  locationIds?: number[];
  platformIds?: number[];
}) => {
  const queryParams: Record<string, any> = {};
  if (params.artistIds?.length)
    queryParams.artistIds = params.artistIds.join(",");
  if (params.typeIds?.length) queryParams.typeIds = params.typeIds.join(",");
  if (params.locationIds?.length)
    queryParams.locationIds = params.locationIds.join(",");
  if (params.platformIds?.length)
    queryParams.platformIds = params.platformIds.join(",");

  return get<{ yearMonth: string; count: number }[]>(
    "/videos/timeline",
    queryParams
  );
};

/** 获取照片类型列表 */
export const fetchPhotoTypes = () => {
  return get<{ id: number; name: string }[]>("/photo-types");
};

/** 获取拍摄地点列表 */
export const fetchPhotoLocations = () => {
  return get<{ id: number; name: string }[]>("/photo-locations");
};

/** 获取发布平台列表 */
export const fetchPhotoPlatforms = () => {
  return get<{ id: number; name: string }[]>("/photo-platforms");
};

/** 获取小卡列表 */
export const getCards = (): Photocard[] => {
  return initialCards;
};

/** 获取小卡分类树（后端直接返回嵌套树形结构） */
export const fetchPhotoCardCategories = () => {
  return get<any[]>("/photo-card-categories");
};

/** 调用后端接口获取小卡列表（支持分页） */
export const fetchPhotoCards = (params: {
  categoryId?: number;
  artistId?: string;
  page?: number;
  pageSize?: number;
}) => {
  const queryParams: Record<string, any> = {};
  if (params.categoryId) queryParams.categoryId = params.categoryId;
  if (params.artistId) queryParams.artistId = params.artistId;
  if (params.page) queryParams.page = params.page;
  if (params.pageSize) queryParams.pageSize = params.pageSize;
  return get<any>("/photo-cards", queryParams);
};

/** 获取音频列表 */
export const getAudioList = (): AudioItem[] => {
  return initialAudio;
};

/** 调用后端接口获取音频列表（按月分页） */
export const fetchAudioList = (params: {
  yearMonth?: string;
  page?: number;
  pageSize?: number;
  artistIds?: string[];
}) => {
  const queryParams: Record<string, any> = {
    page: params.page || 1,
    pageSize: params.pageSize || 50,
  };
  if (params.yearMonth) queryParams.yearMonth = params.yearMonth;
  if (params.artistIds?.length)
    queryParams.artistIds = params.artistIds.join(",");

  return get<{ items: any[]; total: number; page: number; pageSize: number }>(
    "/audios/by-month",
    queryParams
  );
};

/** 调用后端接口获取音频时间轴（按月统计） */
export const fetchAudioTimeline = (params: {
  year?: number;
  artistIds?: string[];
}) => {
  const queryParams: Record<string, any> = {};
  if (params.year) queryParams.year = params.year;
  if (params.artistIds?.length)
    queryParams.artistIds = params.artistIds.join(",");

  return get<{ yearMonth: string; count: number }[]>(
    "/audios/timeline",
    queryParams
  );
};
/** 获取平台列表 */
export const getSystemPlantforms = (): PlatformResType[] => {
  return systemPlantforms;
};
/** 获取艺人列表 */
export const getSystemArtist = (): AritistResType[] => {
  return systemArtist;
};

/** 获取首页模块配置（轻量，适合缓存） */
export const fetchHomeModules = () => {
  return get<{
    modules: { key: string; name: string; sortOrder: number; image?: string }[];
  }>("/integration/home/modules");
};

/** 获取首页聚合数据，按 artistId 过滤 */
export const getHomeData = (artistId?: string) => {
  // 过滤辅助函数
  const filterByArtist = <T extends { artistId?: string | number }>(
    arr: T[]
  ): T[] => {
    if (!artistId) return arr;
    return arr.filter((item) => item.artistId === artistId);
  };

  // artistList → characters：始终展示全部艺人（不过滤）
  const mappedCharacters: Character[] = apiArtistList.map((a: any) => ({
    id: a.artistId,
    artistId: a.artistId,
    name: a.name,
    avatar: a.avatar,
    role: "",
    accentColor: artistColorMap[a.artistId] || defaultAccentColor,
  }));

  // banners → heroImages：按艺人过滤，提取 imageUrl 数组并扁平化
  const mappedHeroImages: string[] = filterByArtist(apiBanners).flatMap(
    (b: any) => b.imageUrl || []
  );

  // recent_sync → posts：按 artist.artistId 过滤（后端返回 Artist 首字母大写）
  const filterPostsByArtist = (arr: any[]): any[] => {
    if (!artistId) return arr;
    console.log("arr", arr);

    return arr.filter(
      (item) => (item.artist || item.Artist)?.artistId === artistId
    );
  };
  console.log("filterPostsByArtist", filterPostsByArtist);

  const platformMap: Record<string, PostItem["platform"]> = {
    douyin: "DOUYIN",
    xiaohongshu: "XIAOHONGSHU",
    weibo: "WEIBO",
    instagram: "INSTAGRAM",
  };

  const platformIconMap: Record<string, string> = {
    DOUYIN: "douyin",
    XIAOHONGSHU: "xhs",
    WEIBO: "weibo",
    INSTAGRAM: "instagram",
  };

  const mappedPosts: PostItem[] = filterPostsByArtist(recent_sync).map(
    (p: any) => ({
      id: String(p.id),
      title: p.content || p.title || "",
      date: p.publishTime
        ? new Date(p.publishTime).toISOString().split("T")[0].replace(/-/g, ".")
        : "",
      images: p.images || [],
      publishedTime: p.publishTime || "",
      platform: platformMap[p.platform] || "WEIBO",
      platformIcon:
        platformIconMap[platformMap[p.platform] || "WEIBO"] || "weibo",
      icon: "share",
      authorName: (p.artist || p.Artist)?.name || "",
      authorAvatar: (() => {
        const raw = typeof p.raw === "string" ? JSON.parse(p.raw) : p.raw;
        return (p.artist || p.Artist)?.avatar || raw?.avatar || "";
      })(),
      mediaList: (p.linkedMedia || []).map((ml: any) => {
        const media = ml.media || {};
        return {
          type: ml.mediaType as "PHOTO" | "VIDEO",
          url:
            ml.mediaType === "PHOTO"
              ? media.url || ""
              : media.playUrl || media.originalUrl || media.coverUrl || "",
        };
      }),
    })
  );

  // recent_itinerary → events
  const statusMap: Record<string, EventItem["status"]> = {
    completed: "completed",
    cancelled: "cancelled",
    pending: "ongoing",
  };
  const mappedEvents: EventItem[] = filterByArtist(recent_itinerary).map(
    (e: any) => ({
      id: String(e.id),
      status: statusMap[e.status] || "ongoing",
      title: e.title,
      location: e.location,
      date: e.startTime
        ? new Date(e.startTime).toISOString().split("T")[0].replace(/-/g, ".")
        : "",
      time: e.startTime
        ? new Date(e.startTime).toLocaleTimeString("zh-CN", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })
        : "",
    })
  );

  // recent_photos → photos
  const mappedPhotos: PhotoItem[] = filterByArtist(recent_photos).map(
    (p: any) => ({
      id: String(p.id),
      url: p.url,
      date: p.shootDate
        ? new Date(p.shootDate).toLocaleDateString("zh-CN", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : "",
      day: p.shootDate
        ? `${new Date(p.shootDate).getMonth() + 1}月${new Date(
            p.shootDate
          ).getDate()}日`
        : "",
      month: p.shootDate
        ? `${new Date(p.shootDate).getFullYear()}年${String(
            new Date(p.shootDate).getMonth() + 1
          ).padStart(2, "0")}月`
        : "",
      monthAbbr: p.shootDate
        ? new Date(p.shootDate)
            .toLocaleDateString("en-US", { month: "short" })
            .toUpperCase()
        : "",
      title: p.title || p.description || "",
      file_name: p.fileName || "",
      location: "",
      tags: [],
      type: "Portrait" as const,
      region: "Shanghai" as const,
      system: "Phase One" as const,
    })
  );

  // recent_videos → videos
  const mappedVideos: VideoItem[] = filterByArtist(recent_videos).map(
    (v: any) => ({
      id: String(v.id),
      title: v.title || v.description || "",
      duration: "",
      date: v.shootDate
        ? new Date(v.shootDate)
            .toLocaleDateString("en-US", { month: "long", day: "numeric" })
            .toUpperCase()
        : "",
      thumbnail: v.coverUrl || v.playUrl || "",
      tags: [],
      description: v.description || "",
      platform: v.tagPlatform?.name || "",
      publishedTime: "",
    })
  );

  // recent_card → cards
  const mappedCards: Photocard[] = filterByArtist(recent_card).map(
    (c: any) => ({
      id: String(c.id),
      title: c.name,
      date: c.createdAt
        ? new Date(c.createdAt).toISOString().split("T")[0].replace(/-/g, ".")
        : "",
      imageUrl: c.frontImage,
    })
  );

  // recent_voices → audioList
  const mappedAudioList: AudioItem[] = filterByArtist(recent_voices).map(
    (a: any) => ({
      id: String(a.id),
      title: a.title,
      duration: "",
      durationSec: 0,
      thumbnail: a.coverUrl || "",
      author: "",
      date: a.shootDate
        ? new Date(a.shootDate).toISOString().split("T")[0].replace(/-/g, ".")
        : "",
      bitRate: "",
      coverUrl: a.coverUrl || "",
      audioUrl: a.originalUrl || "",
    })
  );

  return {
    characters: mappedCharacters,
    heroImages: mappedHeroImages,
    posts: mappedPosts,
    events: mappedEvents,
    photos: mappedPhotos,
    videos: mappedVideos,
    cards: mappedCards,
    audioList: mappedAudioList,
  };
};
