import { getAudioList } from '../../services/api';
import type { AudioItem } from '../../utils/types';
import { themeBehavior } from '../../behaviors/theme';

const app = getApp<IAppOption>();

interface AudioData {
  showNowPlaying: boolean;
  juneTracks: AudioItem[];
  mayTracks: AudioItem[];
  playingTrackId: string | null;
  isPlayingAudio: boolean;
  currentTrack: AudioItem | null;
  tabTabs: { key: string; label: string; icon: string }[];
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
    tabTabs: [
      { key: 'home', label: '首页', icon: '◼' },
      { key: 'mine', label: '我的', icon: '◷' },
    ],
  } as AudioData,

  lifetimes: {
    attached() {
      this.syncState();
    },
  },

  methods: {
    syncState() {
      const audioList = getAudioList();
      const juneTracks = audioList.filter((a: AudioItem) => a.date.includes('.06.'));
      const mayTracks = audioList.filter((a: AudioItem) => a.date.includes('.05.'));
      const playingTrackId = app.globalData.playingTrackId;
      const isPlayingAudio = app.globalData.isPlayingAudio;
      const currentTrack = audioList.find((a: AudioItem) => a.id === playingTrackId) || audioList[0];

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
        currentTrack: getAudioList().find((a: AudioItem) => a.id === trackId) || null,
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
      const currentIdx = audioList.findIndex((a: AudioItem) => a.id === playingTrackId);
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
      const currentIdx = audioList.findIndex((a: AudioItem) => a.id === playingTrackId);
      const prevIdx = currentIdx >= 0
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
  },
});
