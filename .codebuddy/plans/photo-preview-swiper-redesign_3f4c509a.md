---
name: photo-preview-swiper-redesign
overview: 重构 photo-preview 组件，改为全屏 swiper 滑动预览、无顶部导航栏、点击图片关闭、长按不触发保存、"查看原图+size"居中定位、下方显示下载和收藏按钮。
design:
  styleKeywords:
    - 极简暗色
    - 全屏沉浸
    - 半透明悬浮层
    - 无UI干扰
  fontSystem:
    fontFamily: PingFang SC
    heading:
      size: 28rpx
      weight: 400
    subheading:
      size: 30rpx
      weight: 500
    body:
      size: 26rpx
      weight: 400
  colorSystem:
    primary:
      - "#FFFFFF"
    background:
      - "#000000"
      - rgba(0,0,0,0.4)
    text:
      - "#FFFFFF"
      - rgba(255,255,255,0.7)
      - rgba(255,255,255,0.5)
    functional:
      - rgba(255,255,255,0.15)
      - rgba(255,255,255,0.25)
todos:
  - id: add-size-field
    content: 在 EnhancedPhotoItem 中增加 size 字段，并在 API 数据映射处补充 size 取值
    status: completed
  - id: refactor-preview-component
    content: 重构 photo-preview 组件，改用 swiper 滑动、全屏展示、操作悬浮层、点击关闭
    status: completed
    dependencies:
      - add-size-field
  - id: wire-page-events
    content: 更新 photos.wxml 传递 photos 数组，在 photos.ts 中添加下载/收藏事件处理
    status: completed
    dependencies:
      - refactor-preview-component
---

## 产品概述

优化图片预览组件的交互体验，将传统的左右点击导航改为滑动式轻量预览，同时将操作按钮（查看原图、下载、收藏）以悬浮层形式叠加在图片上，极简全屏展示。

## 核心功能

- **左右滑动切换图片**：使用 swiper 组件替代左右点击按钮，手指滑动即可切换上下张
- **点击图片关闭预览**：轻点图片任意区域即关闭全屏预览
- **长按不触发系统菜单**：不显示保存图片等系统弹窗
- **全屏无缩小展示**：图片以 aspectFill 模式撑满整个屏幕，不做缩小
- **居中查看原图 + 图片大小**："查看原图" 文字居中显示在图片正上方，后面跟上通过 formatFileSize 格式化的文件大小（如 "查看原图 | 2.3 MB"）
- **操作按钮悬浮在图片上**：在"查看原图"下方垂直排列"下载"和"收藏"按钮，所有元素均定位叠放在图片之上
- **去除顶部导航栏**：移除旧的关闭按钮、计数器等顶部栏

## 技术栈

- 微信小程序原生框架（Component 构造器 + WXML + WXSS）
- 复用项目现有模式和工具函数

## 实现方案

### 核心思路

1. **组件属性扩展**：新增 `photos` 数组属性（完整照片列表供 swiper 使用），保留 `photo`/`index` 向后兼容
2. **swiper 替换点击导航**：移除 `.preview-nav--left`/`.preview-nav--right`，改用 `<swiper current="{{index}}">` 配合 `bindchange` 事件，触发 `prev`/`next` 事件保持与父组件通信一致
3. **全屏图片**：swiper-item 内 image 使用 `mode="aspectFill"` + `width: 100%; height: 100%` 撑满屏幕，不设 `show-menu-by-longpress`
4. **点击关闭**：swiper-item 最外层 view 绑定 `bind:tap="onClose"`，操作按钮层用 `catch:tap` 阻止冒泡
5. **悬浮操作层**：在图片上方用绝对定位层，居中展示"查看原图 | 文件大小"，下方垂直排列"下载"、"收藏"按钮
6. **数据层扩充**：`EnhancedPhotoItem` 增加 `size?: number` 字段，API 数据映射处补充 `size: p.size`

### 关键设计决策

- swiper 的 circular 属性不开启（与现有 prev/next 行为一致，到头不循环）
- 下载/收藏按钮使用 `catch:tap` 阻止冒泡，避免触发关闭
- "查看原图"点击仍调用现有 `onViewOriginal`（通过 `wx.previewImage` 查看原图）
- 新增 `bind:download` 和 `bind:favorite` 事件，父页面 `photos.ts` 处理具体逻辑

### 性能注意事项

- swiper 只渲染当前 + 相邻项（默认行为），大数据量无性能问题
- 图片使用 `mode="aspectFill"` + 原始 URL，不做额外缩略处理（预览场景）

### 兼容性

- 保留事件接口 `close`/`prev`/`next`/`vieworiginal` 不变，父组件无需修改事件绑定
- 新增 `download`/`favorite` 事件，父组件按需处理

## 目录结构

```
miniprogram/
├── components/
│   └── photo-preview/
│       ├── photo-preview.ts     # [MODIFY] 新增 photos 属性、swiper change 处理、下载/收藏方法
│       ├── photo-preview.wxml   # [MODIFY] 改用 swiper、移除顶部栏和左右按钮、新增操作悬浮层
│       ├── photo-preview.wxss   # [MODIFY] 新增 swiper/悬浮层样式、移除旧导航样式
│       └── photo-preview.json   # [MODIFY] (无需改动，保持 component: true)
├── pages/
│   └── photos/
│       ├── photos.ts            # [MODIFY] EnhancedPhotoItem 加 size 字段映射、新增下载/收藏方法
│       └── photos.wxml          # [MODIFY] 传 photos 数组给 photo-preview
└── utils/
    ├── util.ts                  # [REFERENCE] 已有 formatFileSize 函数
    └── types.ts                 # [MODIFY] EnhancedPhotoItem 增加 size?: number
```

## 关键代码结构

### EnhancedPhotoItem 类型扩充（types.ts）

```typescript
// EnhancedPhotoItem 新增字段
interface EnhancedPhotoItem extends PhotoItem {
  rawUrl: string;
  thumbUrl: string;
  loaded: boolean;
  size?: number; // 新增：文件大小（字节）
}
```

### photo-preview 组件新增属性（photo-preview.ts）

```typescript
properties: {
  // 保留原有属性...
  photos: {           // 新增：全部照片列表（供 swiper 使用）
    type: Array,
    value: [],
  },
}
```

## 设计风格

极简暗色全屏画廊风格，去除所有界面杂色，让图片本身成为绝对视觉主体。黑色背景全屏沉浸，操作控件以半透明低干扰的悬浮层形式呈现，点击图片即可退出，交互直觉高效。

- **布局**：全屏黑色遮盖，swiper 填满整屏。图片以 aspectFill 模式铺满，不做任何缩小留白。
- **操作层**：在图片正中央区域，使用半透明黑色圆角背景承托操作项。"查看原图 + 文件大小"居中展示，下方垂直排列"下载"和"收藏"按钮，间距舒适，使用纤细字体和低透明度边框。
- **交互**：左右滑动切换图片，点击图片空白区域关闭预览。操作按钮触发热区独立，不干扰关闭操作。
- **视觉层次**：图片背景 > 半透明遮罩层 > 操作文字/按钮，层级清晰。