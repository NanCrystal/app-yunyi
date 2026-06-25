// pages/feedback/feedback.ts
import { get, post } from '../../services/request';

interface ProblemType {
  id: number;
  name: string;
  sortOrder: number;
  checked: boolean;
}

/** 后端 API 基础地址（与 services/request.ts 保持一致） */
const BASE_URL = 'https://api.tauol.online';

Page({
  data: {
    problemTypes: [] as ProblemType[],
    description: "",
    uploadedImage: "",
    contactInfo: "",
    navBarHeight: 64,
    statusBarHeight: 20, // 状态栏高度（px）
    submitting: false,
  },

  async fetchProblemTypes() {
    try {
      const res = await get<any[]>('/photo-feedback');
      const problemTypes = res.map((item) => ({
        id: item.id,
        name: item.name.trim(),
        sortOrder: item.sortOrder,
        checked: false,
      }));
      this.setData({ problemTypes });
    } catch (err) {
      console.error('获取问题类型失败:', err);
    }
  },

  toggleProblemType(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as number;
    const problemTypes = this.data.problemTypes.map((item) => ({
      ...item,
      checked: item.id === id ? !item.checked : false,
    }));
    this.setData({ problemTypes });
  },

  onDescriptionInput(e: WechatMiniprogram.Input) {
    this.setData({ description: e.detail.value });
  },

  chooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      sourceType: ["album", "camera"],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        this.setData({ uploadedImage: tempFilePath });
      },
    });
  },

  onContactInput(e: WechatMiniprogram.Input) {
    this.setData({ contactInfo: e.detail.value });
  },

  /** 上传图片到后端七牛云，返回原图 URL（image-full 接口返回 url + thumbUrl） */
  uploadImage(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const token = wx.getStorageSync('mp_auth_token') || '';
      wx.uploadFile({
        url: `${BASE_URL}/upload/image-full`,
        filePath,
        name: 'file',
        header: token ? { Authorization: `Bearer ${token}` } : {},
        success: (res) => {
          try {
            const data = JSON.parse(res.data);
            if (res.statusCode === 200 && data.url) {
              resolve(data.url);
            } else {
              reject(new Error(data.message || '图片上传失败'));
            }
          } catch {
            reject(new Error('图片上传响应解析失败'));
          }
        },
        fail: reject,
      });
    });
  },

  async submitFeedback() {
    if (this.data.submitting) return;

    const selectedTypes = this.data.problemTypes.filter((t) => t.checked);

    if (selectedTypes.length === 0) {
      wx.showToast({ title: "请选择问题类型", icon: "none" });
      return;
    }

    if (!this.data.description.trim()) {
      wx.showToast({ title: "请输入问题描述", icon: "none" });
      return;
    }

    if (!this.data.contactInfo.trim()) {
      wx.showToast({ title: "请输入联系方式", icon: "none" });
      return;
    }

    this.setData({ submitting: true });

    try {
      // 先上传图片（如有）
      let imageUrl = "";
      if (this.data.uploadedImage) {
        wx.showLoading({ title: "上传图片中..." });
        imageUrl = await this.uploadImage(this.data.uploadedImage);
        wx.hideLoading();
      }

      // 提交反馈
      wx.showLoading({ title: "提交中..." });
      await post('/feedback', {
        type: selectedTypes[0].name,
        description: this.data.description,
        image: imageUrl || undefined,
        contact: this.data.contactInfo,
      });
      wx.hideLoading();

      wx.showModal({
        title: '反馈提交成功',
        content: '感谢您的反馈，处理完成后回复将发送至预留邮箱',
        showCancel: false,
        confirmText: '我知道了',
        success: () => {
          wx.navigateBack();
        },
      });
    } catch (err) {
      wx.hideLoading();
      console.error('提交反馈失败:', err);
      wx.showToast({ title: '提交失败，请重试', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  onLoad() {
    // 获取状态栏高度，用于顶部返回按钮定位（导航栏高度 = statusBarHeight + 44）
    const { statusBarHeight } = (wx as any).getWindowInfo?.() ?? {
      statusBarHeight: 20,
    };
    const navBarHeight = statusBarHeight + 44;
    this.setData({ statusBarHeight, navBarHeight });
    this.fetchProblemTypes();
  },
  /** 返回上一页 */
  goBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.switchTab({ url: "/pages/home/home" });
    }
  },
});
