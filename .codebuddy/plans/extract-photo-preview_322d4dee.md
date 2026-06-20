---
name: extract-photo-preview
overview: 将 photos.wxml 中的全屏预览代码提取为独立组件 components/photo-preview/，并在 photos.wxml 中引用。
todos:
  - id: create-photo-preview-component
    content: 创建 photo-preview 组件（json/ts/wxml/wxss 四个文件），含 properties（photo, index, total, statusBarHeight）和 events（close, prev, next, vieworiginal）
    status: completed
  - id: modify-photos-page
    content: 修改 photos.wxml 替换预览块为 <photo-preview> 标签，从 photos.wxss 移除预览样式段（第509-717行），在 photos.json 中注册新组件
    status: completed
    dependencies:
      - create-photo-preview-component
---

## 需求描述

将 `photos.wxml` 中第 278-310 行的全屏预览代码段（preview-mask 块）抽取为独立的组件，放到 `components/` 目录下，然后在 `photos.wxml` 中通过组件引入的方式使用。

### 核心功能

1. **创建 `photo-preview` 组件**：将内联的全屏预览模板、样式、事件处理逻辑抽取为独立、可复用的组件。
2. **组件化引入**：在 `photos.wxml` 中删除内联预览代码，替换为 `<photo-preview>` 标签。
3. **保持功能完整**：预览的关闭、上下翻页、查看原图等交互行为保持不变。

### 视觉效果

预览组件的 UI 与现有完全一致：全屏黑色遮罩、左上角圆形关闭按钮、左右圆形导航箭头、图片 widthFix 显示、底部叠加层包含"查看原图"按钮和页码计数器。

## 技术方案

### 技术栈

- 框架：微信小程序原生框架（TypeScript）

### 实现方案

**策略**：将全屏预览模板、样式和部分逻辑封装为自定义组件，父页面通过 properties 传递数据和通过 events 接收交互事件。

**组件通信设计**：

- **数据流（父 → 子）**：通过 `properties` 传递 `photo`（当前预览照片对象）、`index`（当前索引）、`total`（总数）、`statusBarHeight`（状态栏高度）
- **事件流（子 → 父）**：通过 `triggerEvent` 派发四个事件：
- `close`：用户关闭预览
- `prev`：上一张
- `next`：下一张
- `vieworiginal`：查看原图

**为什么选择 events 而非直接调用父方法**：微信小程序组件推荐通过事件进行父子通信，保持组件独立性和可复用性。父页面只需在模板中绑定对应事件处理方法即可，不需要修改任何业务逻辑。

### 执行要点

**性能**：

- 组件仅在 `photo` 属性非空时渲染（`wx:if` 控制），不消耗额外性能
- 保持原有的 `catchtouchmove="noop"` 防止触摸穿透滚动
- 样式直接从父 wxss 迁移到组件 wxss，无额外开销

**影响范围控制**：

- **不改动业务逻辑**：父页面的 `onClosePreview`、`onPrevPreview`、`onNextPreview`、`onViewOriginal` 四个方法保持不变，仅通过组件事件绑定
- **不影响其他页面**：`photo-preview` 是纯 UI 组件，不依赖全局状态或其他页面
- **不修改无关样式**：仅从 photos.wxss 中移除 preview 相关样式段（第 509-717 行），其他所有样式不变
- **保持兼容性**：photos.ts 中的 `PhotosData` 接口和所有方法均无需修改

### 架构设计

```
父页面 (photos)                           photo-preview 组件
┌──────────────────────┐                ┌──────────────────────┐
│ photos.ts            │                │ photo-preview.ts     │
│  onClosePreview() ◄──┼───close event──┤  properties:         │
│  onPrevPreview()  ◄──┼───prev event───┤    photo            │
│  onNextPreview()  ◄──┼───next event───┤    index            │
│  onViewOriginal() ◄──┼──vieworiginal──┤    total            │
│                      │                │    statusBarHeight   │
│ photos.wxml          │                │ photo-preview.wxml   │
│  <photo-preview      │                │  └ 全屏预览 UI       │
│    photo="{{...}}"   │                │                      │
│    index="{{...}}"   │                │ photo-preview.wxss   │
│    total="{{...}}"   │                │  └ 预览相关样式      │
│    statusBarH="{{}}" │                └──────────────────────┘
│    bind:close="..."  │
│    bind:prev="..."   │
│    bind:next="..."   │
│  />                  │
└──────────────────────┘
```

### 目录结构

```
miniprogram/
  components/
    photo-preview/                    # [NEW] 全屏预览组件
      photo-preview.json              # 组件配置
      photo-preview.ts                # 组件逻辑（properties + events）
      photo-preview.wxml              # 预览模板（从 photos.wxml 移植）
      photo-preview.wxss              # 预览样式（从 photos.wxss 移植）
  pages/
    photos/
      photos.wxml                     # [MODIFY] 将预览块替换为 <photo-preview>
      photos.wxss                     # [MODIFY] 移除预览相关样式（第509-717行）
      photos.json                     # [MODIFY] 注册 photo-preview 组件
```