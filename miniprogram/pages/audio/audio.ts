import { getAudioList } from "../../services/api";
import type { AudioItem } from "../../utils/types";
import { themeBehavior } from "../../behaviors/theme";

const app = getApp<IAppOption>();

interface AudioData {
  showNowPlaying: boolean;
  juneTracks: AudioItem[];
  mayTracks: AudioItem[];
  playingTrackId: string | null;
  isPlayingAudio: boolean;
  currentTrack: AudioItem | null;
  months: { label: string; value: string }[];
  currentMonth: string;
  currentYear: number;
  showYearPicker: boolean;
  yearRange: number[];
  yearIndex: number;
  tempYear: number;
}

Component({
  behaviors: [themeBehavior],

  data: {
    showNowPlaying: false,
    juneTracks: [] as AudioItem[],
    mayTracks: [] as AudioItem[],
    playingTrackId: null as string | null,
    isPlayingAudio: false,
    currentTrack: null as AudioItem | null,
    currentMonth: '06',
    currentYear: new Date().getFullYear(),
    showYearPicker: false,
    yearRange: [] as number[],
    yearIndex: 0,
    tempYear: new Date().getFullYear(),
    months: [
      { label: 'JUN', value: '06' },
      { label: 'MAY', value: '05' },
      { label: 'APR', value: '04' },
      { label: 'MAR', value: '03' },
      { label: 'FEB', value: '02' },
      { label: 'JAN', value: '01' },
      { label: 'DEC', value: '12' },
      { label: 'NOV', value: '11' },
      { label: 'OCT', value: '10' },
      { label: 'SEP', value: '09' },
      { label: 'AUG', value: '08' },
      { label: 'JUL', value: '07' },
    ],

    /** 状态栏高度 */
    statusBarHeight: 20,
  } as AudioData,

  lifetimes: {
    attached() {
      const artistId = (app.globalData.selectedCharId || "haoyiran") as string;
      const { statusBarHeight } = (wx as any).getWindowInfo?.() ?? {
        statusBarHeight: 20,
      };
      const navBarHeight = statusBarHeight + 44;
      this.setData({ artistId, statusBarHeight, navBarHeight });
      this.initYearRange();
      this.syncState();
    },
  },

  methods: {
    syncState() {
      const audioList = getAudioList();
      const juneTracks = audioList.filter((a: AudioItem) =>
        a.date.includes(".06.")
      );
      const mayTracks = audioList.filter((a: AudioItem) =>
        a.date.includes(".05.")
      );
      const playingTrackId = app.globalData.playingTrackId;
      const isPlayingAudio = app.globalData.isPlayingAudio;
      const currentTrack =
        audioList.find((a: AudioItem) => a.id === playingTrackId) ||
        audioList[0];

      this.setData({
        juneTracks,
        mayTracks,
        playingTrackId,
        isPlayingAudio,
        currentTrack,
      });
    },

    onTrackRowTap(e: WechatMiniprogram.BaseEvent) {
      const trackId = e.currentTarget.dataset.id as string;
      app.globalData.playingTrackId = trackId;
      app.globalData.isPlayingAudio = true;
      this.setData({
        playingTrackId: trackId,
        isPlayingAudio: true,
        showNowPlaying: true,
        currentTrack:
          getAudioList().find((a: AudioItem) => a.id === trackId) || null,
      });
    },

    onTogglePlay() {
      const newPlaying = !this.data.isPlayingAudio;
      app.globalData.isPlayingAudio = newPlaying;
      this.setData({ isPlayingAudio: newPlaying });
    },

    onNextTrack() {
      const audioList = getAudioList();
      const { playingTrackId } = this.data;
      const currentIdx = audioList.findIndex(
        (a: AudioItem) => a.id === playingTrackId
      );
      const nextIdx = currentIdx >= 0 ? (currentIdx + 1) % audioList.length : 0;
      app.globalData.playingTrackId = audioList[nextIdx].id;
      app.globalData.isPlayingAudio = true;
      this.setData({
        playingTrackId: audioList[nextIdx].id,
        isPlayingAudio: true,
        currentTrack: audioList[nextIdx],
      });
    },

    onPrevTrack() {
      const audioList = getAudioList();
      const { playingTrackId } = this.data;
      const currentIdx = audioList.findIndex(
        (a: AudioItem) => a.id === playingTrackId
      );
      const prevIdx =
        currentIdx >= 0
          ? (currentIdx - 1 + audioList.length) % audioList.length
          : 0;
      app.globalData.playingTrackId = audioList[prevIdx].id;
      app.globalData.isPlayingAudio = true;
      this.setData({
        playingTrackId: audioList[prevIdx].id,
        isPlayingAudio: true,
        currentTrack: audioList[prevIdx],
      });
    },

    onMiniPlayerTap() {
      this.setData({ showNowPlaying: true });
    },

    onCloseNowPlaying() {
      this.setData({ showNowPlaying: false });
    },

    onShowNowPlaying(e: WechatMiniprogram.BaseEvent) {
      const trackId = e.currentTarget.dataset.id as string;
      this.onTrackRowTap({
        currentTarget: { dataset: { id: trackId } },
      } as WechatMiniprogram.BaseEvent);
    },

    onMonthTap(e: WechatMiniprogram.BaseEvent) {
      const month = e.currentTarget.dataset.month as string;
      this.setData({ currentMonth: month });
    },

    /** 初始化年份范围（当前年份前后5年） */
    initYearRange() {
      const currentYear = new Date().getFullYear();
      const yearRange: number[] = [];
      for (let y = currentYear - 5; y <= currentYear + 5; y++) {
        yearRange.push(y);
      }
      const yearIndex = yearRange.indexOf(currentYear);
      this.setData({ yearRange, yearIndex: yearIndex >= 0 ? yearIndex : 5 });
    },

    /** 打开/关闭年份弹窗 */
    onToggleYearPicker() {
      const { showYearPicker, currentYear, yearRange } = this.data;
      if (!showYearPicker) {
        const idx = yearRange.indexOf(currentYear);
        this.setData({
          showYearPicker: true,
          tempYear: currentYear,
          yearIndex: idx >= 0 ? idx : 0,
        });
      } else {
        this.setData({ showYearPicker: false });
      }
    },

    onCloseYearPicker() {
      this.setData({ showYearPicker: false });
    },

    /** 滚动年份 */
    onYearScroll(e: WechatMiniprogram.CustomEvent) {
      const val = e.detail.value as number[];
      const { yearRange } = this.data;
      this.setData({ yearIndex: val[0], tempYear: yearRange[val[0]] });
    },

    /** 确认年份 */
    onConfirmYear() {
      const { tempYear } = this.data;
      this.setData({ currentYear: tempYear, showYearPicker: false });
      // 可在此处根据年份筛选音频
    },
  },
});
