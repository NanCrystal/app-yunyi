---
name: fix-caption-expand-collapse
overview: 修复 sync 页面卡片 caption 的展开/收起功能：实现真正的两行截断 + "更多"紧跟文字末尾 + "收起"跟在内容最后
todos:
  - id: fix-clamp-css
    content: 修复 sync.wxss 中 .card-caption-clamp 样式：添加 max-height:78rpx 兜底、改 word-break 为 break-word、确保 overflow:hidden 生效
    status: completed
  - id: fix-toggle-overlay
    content: "修复 .card-caption-collapsed > .card-toggle 绝对定位样式：校正渐变色为 #000 背景、优化 padding 和层级"
    status: completed
    dependencies:
      - fix-clamp-css
  - id: fix-collapsed-container
    content: 给 .card-caption-collapsed 外层添加 overflow:hidden 防止溢出
    status: completed
    dependencies:
      - fix-clamp-css
---

## Product Overview

修复微信小程序同步页（sync）中卡片 caption 文本的折叠/展开功能，实现类似微博/Instagram 的"两行截断 + ...更多"效果。

## Core Features

### 问题 1：折叠态未生效截断（核心 BUG）

- 当前 `.card-caption-clamp` 使用了 `-webkit-line-clamp: 2` 但缺少 `max-height` 硬约束，在微信小程序渲染引擎下完全失效，长文本全部展示而非截断为 2 行

### 问题 2："更多"按钮位置错误

- 由于截断失效，绝对定位的 `right:0; bottom:0` 的"更多"落在了全部文本末尾，而非第二行末尾。用户期望"更多"紧接在被截断的文字后面（第二行最右侧），带渐变遮盖效果

### 问题 3：展开态"收起"位置

- 点击"更多"展开后，"收起"应紧跟在完整内容的最后一个字符后面（同一行或自然换行后的行尾），不占独立位置、不换独行

### 两种场景统一修复

- 媒体下方 caption（`.card-caption-below`）和无媒体纯文字 caption（`.card-caption-only`）两处结构相同，需一并修复

## Tech Stack

- 微信小程序 WXML / WXSS
- 纯 CSS 方案修复，无需 JS 改动

## Implementation Approach

### 根因分析

`.card-caption-clamp` 的 `-webkit-line-clamp: 2` 在微信小程序 `<view>` 组件包裹多 `<text>` 子节点场景下不可靠——缺少 `max-height` 兜底时，引擎无法正确计算盒模型高度，导致 `overflow: hidden` 无从触发，文字全部溢出显示。

### 修复策略：max-height 强制约束 + 绝对定位渐变遮盖

**折叠态（核心修复）：**

1. 给 `.card-caption-clamp` 添加 `max-height: 78rpx`（= 26rpx font-size × 1.5 line-height × 2 行），强制限制为恰好 2 行高度
2. 将 `word-break: break-all` 改为 `word-break: break-word`，避免强制断字导致的布局异常
3. 保持 `.card-toggle` 的 `position: absolute; right:0; bottom:0;`，使其浮动在第二行右下角
4. 渐变背景色修正为 `#000`（匹配页面实际背景色）
5. 外层 `.card-caption-collapsed` 加 `overflow: hidden` 防止绝对定位元素溢出

**展开态（微调确认）：**

- `.card-caption-line` 已是正常文档流容器，内部的 artist-name / caption-text / toggle（收起）三个 `<text>` 自然 inline 排列，"收起"会紧跟在最后一个字符后，无需额外改动

## Implementation Notes

- 仅修改 `miniprogram/pages/sync/sync.wxss` 一个文件即可完成全部修复
- 两处 caption 结构共用相同样式类名，CSS 修改自动覆盖两种场景
- 字号 26rpx × 行高 1.5 × 2 行 = 78rpx，这是精确的两行高度值
- `break-word` 比 `break-all` 更优雅——仅在单词边界允许的位置断行