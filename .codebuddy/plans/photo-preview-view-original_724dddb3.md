---
name: photo-preview-view-original
overview: 在 photo-preview 组件中实现：点击“查看原图”后，swiper 图片从缩略图 (url) 切换为原图 (rawUrl)，并隐藏对应图片的“查看原图”按钮。
todos:
  - id: modify-photo-preview-component
    content: 修改 photo-preview 组件的 ts 和 wxml 文件，实现图片 src 动态切换和按钮显隐控制
    status: completed
---

## 功能概述

在 photo-preview 图片预览组件中，点击"查看原图"按钮后，swiper 中的图片应直接切换显示原图（rawUrl），而非缩略图（url），并且切换后该图片保持显示原图，"查看原图"按钮应隐藏。状态按图片 id 持久保持，跨 swiper 滑动不丢失。

## 核心需求

1. 点击"查看原图"后，swiper 中该图片的 src 从 `item.url`（缩略图）切换为 `item.rawUrl`（原图）
2. 切换后该图片持续显示原图，即使 swiper 滑动再回来也不变
3. 已切换为原图的图片，"查看原图"按钮隐藏
4. 状态以图片 id 为 key 独立跟踪，不同图片互不影响

## 技术方案

### 技术栈

- 微信小程序原生开发（TypeScript）
- 基于现有 `photo-preview` 组件进行修改

### 实现思路

在 `photo-preview` 组件内部维护一个 `originalMap`（`Record<string, boolean>`），以图片 id 为 key 记录哪些图片已被切换为原图。通过数据绑定控制：

- **图片 src**：根据 `originalMap[item.id]` 条件渲染 `item.rawUrl` 或 `item.url`
- **按钮显隐**：根据 `originalMap[item.id]` 控制"查看原图"按钮的显示/隐藏

### 关键决策

- **按 id 追踪而非索引**：使用图片 id 作为 key，避免 swiper 滑动时索引变更导致状态错乱
- **内部状态自管理**：将切换逻辑完全封闭在组件内部，不依赖父页面状态；`vieworiginal` 事件仍可保留供父页面按需使用
- **零外部依赖**：直接使用组件已有的 `data` 机制，不引入额外状态管理
- **向后兼容**：不修改父页面 `photos.ts` 的 `onViewOriginal` 方法，降低爆破半径

### 性能考量

- 仅包含一个 `{}` 对象的 setData，操作极轻量
- 每次切换只更新单个 key，无遍历开销

### 修改文件清单

| 文件 | 操作 | 说明 |
| --- | --- | --- |
| `miniprogram/components/photo-preview/photo-preview.ts` | 修改 | 添加 `originalMap` 数据字段，修改 `onViewOriginal` 方法 |
| `miniprogram/components/photo-preview/photo-preview.wxml` | 修改 | 图片 src 按状态切换，按钮按状态显隐 |


### 详细修改说明

#### 1. `photo-preview.ts` 修改

**data 中添加 `originalMap`**：

```typescript
data: {
  originalMap: {} as Record<string, boolean>,
}
```

**修改 `onViewOriginal` 方法**：

```typescript
onViewOriginal() {
  const currentPhoto = this.data.photos[this.data.index] || this.data.photo;
  if (!currentPhoto) return;
  const { id } = currentPhoto;
  this.setData({
    [`originalMap.${id}`]: true,
  });
  this.triggerEvent("vieworiginal");
},
```

#### 2. `photo-preview.wxml` 修改

**图片 src 行（第 17 行）**：

```xml
src="{{originalMap[item.id] ? item.rawUrl : item.url}}"
```

**"查看原图"按钮行（第 25-28 行）**：包裹 `wx:if` 条件，当已查看原图时隐藏

```xml
<view wx:if="{{!originalMap[(photos[index] && photos[index].id) || photo.id]}}" class="preview-info-center" bind:tap="onViewOriginal">
  <text class="preview-original-text">查看原图</text>
  <text wx:if="{{(photos[index] && photos[index]._sizeText) || photo._sizeText}}" class="preview-size-text">{{(photos[index] && photos[index]._sizeText) || photo._sizeText}}</text>
</view>
```