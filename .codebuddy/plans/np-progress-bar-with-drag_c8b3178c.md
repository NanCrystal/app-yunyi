---
name: np-progress-bar-with-drag
overview: 在全屏播放器播放控制区域上方添加可拖拽进度条，参考迷你播放器进度条样式，支持触摸拖拽调整播放进度
design:
  styleKeywords:
    - Dark Music Player
    - Neumorphism Progress Bar
    - Theme Color Accent
    - Smooth Drag Interaction
  fontSystem:
    fontFamily: Courier New, PingFang SC
    heading:
      size: 24rpx
      weight: 400
    subheading:
      size: 22rpx
      weight: 400
    body:
      size: 24rpx
      weight: 400
  colorSystem:
    primary:
      - "#var(--theme)"
    background:
      - "#1a1a1e"
      - "#333333"
    text:
      - "#888888"
      - "#ffffff"
    functional:
      - "#ffffff"
      - rgba(255,255,255,0.3)
todos:
  - id: add-np-progress-wxml
    content: 在全屏播放器 .np-buttons 前插入进度条 WXML 结构，含轨道、填充层、thumb 和时间文本
    status: completed
  - id: add-np-progress-wxss
    content: 编写 .np-progress 系列样式，包含轨道、填充层、thumb 圆形把手及时间文本，使用主题色
    status: completed
    dependencies:
      - add-np-progress-wxml
  - id: add-drag-logic-ts
    content: 在 audio.ts 中新增 touchstart/move/end 拖拽方法及 _npDraggingProgress 临时数据字段，调用 ctx.seek() 实现跳转
    status: completed
    dependencies:
      - add-np-progress-wxml
---

## 产品概述

在全屏播放器视图的播放控制按钮上方添加一个可交互式音频进度条，复用迷你播放器的进度数据（`audioProgress`/`audioCurrentTime`/`audioDuration`），支持点击和拖拽来调整播放位置。

## 核心功能

- 在全屏播放器的 `.np-buttons` 上方插入进度条区域，显示当前播放进度百分比、已播时间/总时长
- 进度条填充颜色使用艺人主题色 `var(--theme)`
- 支持触摸点击跳转：点击进度条任意位置直接 seek 到对应时间点
- 支持触摸拖拽：touchmove 过程中实时预览进度位置，松手后执行 seek
- 复用已有的 `audioProgress`、`audioCurrentTime`、`audioDuration` 数据字段
- 调用 `InnerAudioContext.seek()` 方法实现播放位置跳转

## Tech Stack

- 微信小程序原生框架（WXML / WXSS / TS）
- InnerAudioContext 的 `seek(position)` API 实现进度跳转
- touch 事件（bindtouchstart/bindtouchmove/bindtouchend）实现拖拽交互

## Implementation Approach

### 方案策略

在 `.np-controls` 内部、`.np-buttons` 前方插入一个 `.np-progress` 区域，结构与迷你播放器类似：进度条轨道 + 可拖拽填充 + 时间文本。

### 关键决策

1. **拖拽实现方式**：使用原生 touch 事件（touchstart → touchmove → touchend），不依赖 movable-area 组件。原因：进度条是一维线性拖拽，touch 事件更轻量且控制粒度更细；同时可以避免 movable-area 的边界限制问题。
2. **Seek 调用时机**：在 touchend 时调用 `ctx.seek()`，touchmove 期间只做视觉预览（临时 setData 更新进度条宽度），不在拖拽过程中频繁 seek。
3. **数据复用**：全屏进度条与迷你播放器共用同一套 `audioProgress` / `audioCurrentTime` / `audioDuration` 字段，无需新增 data 字段。新增一个内部临时字段 `_npDraggingProgress` 仅用于拖拽预览时的视觉反馈。

### 拖拽交互流程

```
touchstart → 记录起始位置，标记拖拽状态
  touchmove → 计算 x 偏移比例 → 更新 _npDraggingProgress（视觉预览）
    touchend → 计算 target 秒数 → ctx.seek(秒数) → 清除拖拽状态
              （后续 onTimeUpdate 会自动接管 audioProgress 更新）
```

## Architecture Design

### 文件修改清单

```
miniprogram/pages/audio/
├── audio.wxml      # [MODIFY] 在 .np-buttons 前插入 .np-progress 进度条区块
├── audio.wxss      # [MODIFY] 新增 .np-progress 系列样式（进度条+时间文本）
└── audio.ts        # [MODIFY] 新增拖拽相关方法：onNpProgressTouchStart/Move/End
```

### Key Code Structures

```typescript
// audio.ts 中新增的方法签名
onNpProgressTouchStart(e: WechatMiniprogram.TouchEvent): void;
onNpProgressTouchMove(e: WechatMiniprogram.TouchEvent): void;
onNpProgressTouchEnd(e: WechatMiniprogram.TouchEvent): void;

// AudioData 接口新增字段
_npIsDragging: boolean;        // 是否正在拖拽
_npDraggingProgress: number;   // 拖拽中的临时进度值（0-100）

// AudioInstance 接口新增字段
_npDragStartTime?: number;     // 拖拽开始时的时间戳
```

## 设计风格

采用暗色系音乐播放器风格，与全屏播放器（now-playing）的整体视觉保持一致。进度条位于波形可视化和播放按钮之间，作为连接音乐可视化与控制的过渡元素。

## 页面规划

仅涉及全屏播放器页面（showNowPlaying 视图）的单个区块修改：

### 区块1：全屏播放进度条（.np-progress）— 新增

- **布局**：水平排列，左侧进度条轨道（flex:1），右侧时间文本
- **进度条轨道**：圆角细长条背景 #333333，主题色填充层，高度约 6rpx（比迷你播放器稍粗以突出重点）
- **拖拽指示器**：填充层末端增加一个圆形小把手（thumb），增强拖拽可感知性
- **时间文本**：等宽字体，显示格式 "0:00 / 3:45"，颜色使用半透明白或主题色
- **交互反馈**：拖拽时填充层和把手跟随手指移动，松手后平滑过渡到实际播放位置

### 与迷你播放器进度条的视觉差异

- 高度更粗（6rpx vs 4rpx），适合大屏操作
- 增加圆形 thumb 把手，提升拖拽暗示
- 时间文字字号更大（24rpx vs 18rpx）