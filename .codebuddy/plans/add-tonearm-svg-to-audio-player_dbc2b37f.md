---
name: add-tonearm-svg-to-audio-player
overview: 在全屏播放器中添加唱针SVG图标，定位到专辑封面上方60rpx，实现未播放时逆时针旋转30度、播放时还原的交互效果
design:
  styleKeywords:
    - Neumorphism
    - Dark Theme
    - Turntable Metaphor
    - Smooth Animation
  fontSystem:
    fontFamily: PingFang SC
    heading:
      size: 32px
      weight: 600
    subheading:
      size: 18px
      weight: 500
    body:
      size: 16px
      weight: 400
  colorSystem:
    primary:
      - "#4ab8d6"
    background:
      - "#1a1a1e"
      - "#000000"
    text:
      - "#ffffff"
      - "#f5f5f5"
    functional:
      - "#f5f5f5"
todos:
  - id: add-needle-wxml
    content: 在 audio.wxml 的 np-cover-wrap 内添加唱针 image 元素并绑定 isPlayingAudio 动态类名
    status: completed
  - id: add-needle-wxss
    content: 在 audio.wxss 中添加唱针容器和图片的定位、旋转、过渡动画样式
    status: completed
    dependencies:
      - add-needle-wxml
---

## 产品概述

在全屏音频播放器（Now Playing）的专辑封面区域上方添加唱针图标（music_play.svg），实现模拟黑胶唱片唱机的视觉效果。

## 核心功能

- 将 music_play.svg 唱针图标定位到专辑封面（np-cover-wrap）往上 60rpx 的位置
- 默认状态（未播放）：唱针逆时针旋转 30 度，呈现"离盘"状态
- 点击播放后：唱针还原到原始位置（0 度），呈现"落盘"状态，带平滑过渡动画
- 唱针旋转以支点位置为旋转中心（SVG 左上角区域）

## 技术栈

- 微信小程序原生框架（WXML / WXSS / TS）
- 现有项目架构：Component 组件模式，themeBehavior 主题行为

## 实现方案

### 核心思路

在 `np-cover-wrap` 内部添加唱针图片元素，使用绝对定位将其置于封面上方 60rpx 处。通过 WXSS 的 `transform: rotate()` 配合 `transition` 实现旋转动画，利用已有的 `isPlayingAudio` 数据字段动态切换 CSS 类来控制旋转状态。

### 关键技术决策

1. **定位策略**：将唱针容器设为 `position: absolute`，通过负 `top` 值或 `transform: translateY()` 定位于封面顶部上方 60rpx。唱针支点需对齐到封面的左上边缘附近（模拟真实唱机唱臂支点在唱片左上方的布局）
2. **旋转变换中心**：使用 `transform-origin` 设置旋转中心为 SVG 支点位置（对应 SVG 中 cx="60" cy="40" 的位置，约左上角区域），确保唱针绕支点自然摆动
3. **状态驱动样式**：在 WXML 中通过 `class="{{isPlayingAudio ? 'np-needle--playing' : 'np-needle--paused'}}"` 绑定类名切换，WXSS 中分别定义两种状态的 `rotate` 值
4. **过渡动画**：使用 `transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)` 实现丝滑的唱针落下/抬起效果

### 需要修改的文件

```
miniprogram/pages/audio/
├── audio.wxml    # [MODIFY] 在 np-cover-wrap 内添加唱针 image 元素
├── audio.wxss    # [MODIFY] 添加唱针定位、旋转、过渡动画样式
```

### 实现细节

#### WXML 变更（audio.wxml 第22-35行 np-cover-wrap 内）

- 在 `np-cover-wrap` 内部最前面插入唱针 image 元素
- src 指向 `/assets/icons/music_play.svg`
- class 动态绑定 `isPlayingAudio` 状态

#### WXSS 变更（audio.wxss 封面样式区域）

新增以下样式：

- `.np-needle-wrap`：唱针容器，absolute 定位，z-index 高于封面，设置 transform-origin 为支点位置
- `.np-needle`：唱针图片尺寸（约 120rpx × 120rpx），filter 调整颜色适配深色背景
- `.np-needle--paused`：默认状态 `transform: rotate(-30deg)`
- `.np-needle--playing`：播放状态 `transform: rotate(0deg)`
- 容器加 `transition: transform 0.5s ease`

### 注意事项

- 唱针 z-index 应高于封面但低于关闭按钮（cloase-np-btn z-index 由父级决定）
- SVG 支点在 viewBox 中位于 (60, 40)，需要按比例换算 transform-origin 坐标
- 旋转方向：负值为逆时针（CCW），符合需求中"默认逆时针30度"

## 设计风格

唱针交互采用拟物化黑胶唱机设计语言，与现有全屏播放器的深色主题、圆形旋转封面风格一致。

## 页面设计变更

### 全屏播放器 - 专辑封面区域改造

原有封面区域保持不变，在封面上方新增唱针悬浮层：

**区块1：唱针层（新增）**

- 位于 np-cover-wrap 内部、专辑封面元素上方
- 唱针图片绝对定位于封面顶部向上偏移 60rpx
- 唱针支点对齐封面左上象限，唱头指向封面中心方向
- 未播放时唱针呈抬起倾斜状（逆时针30度），播放时自然落回盘面
- 过渡动画时长约 0.5s，使用 ease-out 曲线模拟物理重力效果

**区块2：专辑封面层（已有，不变）**

- 400rpx 圆形封面，带旋转动画和边框发光效果

整体视觉形成完整的"唱机+唱片"意象，增强用户沉浸感。