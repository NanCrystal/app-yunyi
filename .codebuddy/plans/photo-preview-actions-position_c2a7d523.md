---
name: photo-preview-actions-position
overview: 将 photo-preview 组件的下载按钮从底部居中改为右下角定位（距底边和右边各 20rpx）。
todos:
  - id: adjust-preview-actions-position
    content: 修改 photo-preview.wxss：.preview-overlay 加 position:relative; .preview-actions 改为 position:absolute; bottom:20rpx; right:20rpx;
    status: completed
---

将 photo-preview 组件中的下载按钮（`.preview-actions`容器）从底部居中位置，改为固定在右下角，距离底部和右边各 20rpx。

当前布局：`.preview-overlay` 使用 flex 布局（`align-items: center; justify-content: flex-end`），`.preview-actions` 作为 flex 子项在底部居中显示。

修改后：`.preview-actions` 使用绝对定位置于右下角。

## 技术实现

### 实现策略

- 纯 CSS 调整，仅修改 `photo-preview.wxss` 文件
- 利用已有的 `position: absolute` 父子定位链，无需修改 WXML 或 TS

### 修改方案

**1. `.preview-overlay` 增加 `position: relative;`**

- 原因：建立定位参考容器，确保 `.preview-actions` 相对于 overlay 进行绝对定位，而非相对于 `.preview-swiper-item`

**2. `.preview-actions` 改为绝对定位**

- 移除原有 flex 相关样式
- 设置 `position: absolute; bottom: 20rpx; right: 20rpx;`
- 脱离 flex 流后，`.preview-info-center` 仍保持居中布局不受影响

### 涉及文件

| 文件 | 操作 | 修改内容 |
| --- | --- | --- |
| `miniprogram/components/photo-preview/photo-preview.wxss` | MODIFY | 第30行 `.preview-overlay` 增加 `position: relative`；第76行 `.preview-actions` 改为 `position: absolute; bottom: 20rpx; right: 20rpx; display: flex; flex-direction: row; align-items: center; gap: 24rpx;` |


### 最终效果

- 下载按钮容器固定在图片预览界面的右下角
- 距离底部 20rpx，距离右边 20rpx
- 不影响 "查看原图" 等其他 UI 元素