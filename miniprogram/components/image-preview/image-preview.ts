import { themeBehavior } from '../../behaviors/theme';

interface ImagePreviewData {
  current: number;
  indicatorText: string;
  /** 是否显示原图 */
  showOriginal: boolean;
  /** 图片原始宽高 */
  imageSize: { width: number; height: number };
}

Component({
  behaviors: [themeBehavior],

  properties: {
    /** 是否显示 */
    visible: {
      type: Boolean,
      value: false,
    },
    /** 图片列表（URL 数组） */
    images: {
      type: Array,
      value: [] as string[],
    },
    /** 起始索引 */
    current: {
      type: Number,
      value: 0,
    },
  },

  data: {
    _current: 0,
    indicatorText: '1 / 1',
    showOriginal: false,
    imageSize: { width: 0, height: 0 },
  } as ImagePreviewData,

  observers: {
    'visible, images'(visible: boolean, images: string[]) {
      if (visible && images.length > 0) {
        const idx = this.properties.current;
        this.setData({
          _current: idx,
          indicatorText: `${idx + 1} / ${images.length}`,
          showOriginal: false,
        });
      }
    },
  },

  lifetimes: {
    attached() {
      // 初始化
    },
  },

  methods: {
    /** 关闭预览 */
    onClose() {
      this.triggerEvent('close');
    },

    /** 阻止冒泡 */
    onStopPropagation() {
      // 阻止点击事件冒泡到遮罩层关闭
    },

    /** 切换图片 */
    onSwiperChange(e: WechatMiniprogram.SwiperChange) {
      const idx = e.detail.current;
      const len = this.properties.images.length;
      this.setData({
        _current: idx,
        indicatorText: `${idx + 1} / ${len}`,
        showOriginal: false,
      });
      this.triggerEvent('change', { index: idx });
    },

    /** 查看原图 */
    onViewOriginal() {
      const images = this.properties.images as string[];
      const idx = this.data._current as number;
      const url = images[idx];
      if (url) {
        wx.previewImage({
          urls: images,
          current: url,
          showmenu: true,
        });
      }
    },

    /** 下载图片 */
    onDownload() {
      const images = this.properties.images as string[];
      const idx = this.data._current as number;
      const url = images[idx];
      if (!url) return;

      wx.showLoading({ title: '下载中...' });
      wx.downloadFile({
        url,
        success: (res) => {
          wx.hideLoading();
          if (res.statusCode === 200) {
            wx.saveImageToPhotosAlbum({
              filePath: res.tempFilePath,
              success: () => {
                wx.showToast({ title: '已保存到相册', icon: 'success' });
              },
              fail: (err) => {
                console.error('保存失败:', err);
                wx.showToast({ title: '保存失败', icon: 'none' });
              },
            });
          } else {
            wx.showToast({ title: '下载失败', icon: 'none' });
          }
        },
        fail: (err) => {
          wx.hideLoading();
          console.error('下载失败:', err);
          wx.showToast({ title: '下载失败', icon: 'none' });
        },
      });
    },

    /** 分享 */
    onShare() {
      this.triggerEvent('share', { index: this.data._current });
    },
  },
});
