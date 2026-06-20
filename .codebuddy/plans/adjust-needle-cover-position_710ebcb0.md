---
name: adjust-needle-cover-position
overview: 调整全屏播放器中唱针和专辑封面的位置：使唱针距顶部为0，整体上移，同时保持唱针与封面的相对间距不变
todos:
  - id: adjust-needle-cover-position
    content: 修改 .np-body 样式实现唱针贴顶且保持与封面间距不变
    status: completed
---

## 产品概述

调整音频全屏播放器（Now Playing 视图）中唱针与专辑封面的布局位置。

## 核心功能需求

- 将唱针（第22-27行）和专辑封面（第29-42行）**整体上移**
- 唱针部分距离容器**顶部为 0**（贴顶）
- 唱针与专辑封面之间的**相对距离保持不变**（维持当前 -60rpx 的负边距重叠效果）

## 技术栈

- 微信小程序 WXML / WXSS

## 实现方案

修改 `audio.wxss` 中 `.np-body` 的样式，将内容对齐方式从居中改为顶部对齐，具体改动：

1. **`.np-body`** (`audio.wxss:268-276`)

- `justify-content: center` → `justify-content: flex-start`：内容改为顶部对齐，实现整体上移
- `padding: 60rpx 48rpx` → `padding: 0 48rpx 60rpx`：移除顶部内边距，使唱针贴顶；保留底部和水平方向内边距不变
- 其他属性（flex、align-items、overflow 等）保持不变

2. **不修改的样式**：

- `.np-needle-wrap` 的 `margin-bottom: -60rpx` 保持不变 → 唱针与封面相对位置不变
- 所有其他组件样式不受影响

## 架构设计

这是一个纯 CSS 样式微调，仅涉及一个文件的一处样式修改，不影响组件结构或数据流。

## 目录结构

```
miniprogram/pages/audio/
├── audio.wxml    # [无需修改] 模板结构不变
└── audio.wxss    # [MODIFY] 仅修改 .np-body 样式
```