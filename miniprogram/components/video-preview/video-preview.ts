import { themeBehavior } from '../../behaviors/theme';

interface VideoPreviewData {
  /** 是否正在播放 */
  isPlaying: boolean;
  /** 当前播放时间（秒） */
  currentTime: number;
  /** 总时长（秒） */
  duration: number;
  /** 进度百分比 */
  progress: number;
  /** 格式化后的时间文本 */
  currentTimeText: string;
  durationText: string;
  /** 视频上下文 */
  _videoContext: WechatMiniprogram.VideoContext | null;
}

Component({
  behaviors: [themeBehavior],

  properties: {
    /** 是否显示 */
    visible: {
      type: Boolean,
      value: false,
    },
    /** 视频地址 */
    videoUrl: {
      type: String,
      value: '',
    },
    /** 视频封面 */
    poster: {
      type: String,
      value: '',
    },
    /** 视频标题 */
    title: {
      type: String,
      value: '',
    },
  },

  data: {
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    progress: 0,
    currentTimeText: '00:00',
    durationText: '00:00',
    _videoContext: null,
  } as VideoPreviewData,

  observers: {
    visible(val: boolean) {
      if (val) {
        // 打开时重置状态
        this.setData({
          isPlaying: false,
          currentTime: 0,
          progress: 0,
          currentTimeText: '00:00',
        });
      } else {
        // 关闭时停止播放
        this.pauseVideo();
      }
    },
  },

  lifetimes: {
    detached() {
      this.pauseVideo();
    },
  },

  methods: {
    /** 获取视频上下文 */
    getVideoContext(): WechatMiniprogram.VideoContext | null {
      if (!this.data._videoContext) {
        const ctx = wx.createVideoContext('vp-video', this);
        (this as Record<string, unknown>)._ctx = ctx;
        return ctx;
      }
      return (this as Record<string, unknown>)._ctx as WechatMiniprogram.VideoContext;
    },

    /** 关闭预览 */
    onClose() {
      this.pauseVideo();
      this.triggerEvent('close');
    },

    /** 阻止冒泡 */
    onStopPropagation() {
      // 阻止点击事件冒泡
    },

    /** 播放/暂停切换 */
    onTogglePlay() {
      const ctx = this.getVideoContext();
      if (!ctx) return;
      const { isPlaying } = this.data;
      if (isPlaying) {
        ctx.pause();
        this.setData({ isPlaying: false });
      } else {
        ctx.play();
        this.setData({ isPlaying: true });
      }
    },

    /** 视频播放事件 */
    onPlay() {
      this.setData({ isPlaying: true });
    },

    /** 视频暂停事件 */
    onPause() {
      this.setData({ isPlaying: false });
    },

    /** 视频播放结束 */
    onEnded() {
      this.setData({ isPlaying: false, progress: 100, currentTime: this.data.duration });
    },

    /** 时间更新 */
    onTimeUpdate(e: WechatMiniprogram.VideoTimeUpdate) {
      const { currentTime, duration } = e.detail;
      const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
      this.setData({
        currentTime,
        duration,
        progress,
        currentTimeText: this.formatTime(currentTime),
        durationText: this.formatTime(duration),
      });
    },

    /** 进度条拖动 */
    onProgressChange(e: WechatMiniprogram.SliderChange) {
      const ctx = this.getVideoContext();
      if (!ctx) return;
      const value = e.detail.value;
      const time = (value / 100) * this.data.duration;
      ctx.seek(time);
      this.setData({
        progress: value,
        currentTime: time,
        currentTimeText: this.formatTime(time),
      });
    },

    /** 下载视频 */
    onDownload() {
      const url = this.properties.videoUrl;
      if (!url) return;

      wx.showLoading({ title: '下载中...' });
      wx.downloadFile({
        url,
        success: (res) => {
          wx.hideLoading();
          if (res.statusCode === 200) {
            wx.saveVideoToPhotosAlbum({
              filePath: res.tempFilePath,
              success: () => {
                wx.showToast({ title: '已保存到相册', icon: 'success' });
              },
              fail: () => {
                wx.showToast({ title: '保存失败', icon: 'none' });
              },
            });
          }
        },
        fail: () => {
          wx.hideLoading();
          wx.showToast({ title: '下载失败', icon: 'none' });
        },
      });
    },

    /** 分享 */
    onShare() {
      this.triggerEvent('share');
    },

    /** 暂停视频 */
    pauseVideo() {
      const ctx = (this as Record<string, unknown>)._ctx as WechatMiniprogram.VideoContext | undefined;
      if (ctx) {
        ctx.pause();
      }
      this.setData({ isPlaying: false });
    },

    /** 格式化时间 mm:ss */
    formatTime(seconds: number): string {
      const m = Math.floor(seconds / 60);
      const s = Math.floor(seconds % 60);
      return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    },
  },
});
