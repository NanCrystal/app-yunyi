---
name: fix-audio-navigate-to
overview: 将 home.ts 中 onPlayAudio 方法的 wx.reLaunch 改为 this.navigator?.navigate，与 onSectionMore 保持一致，使 audio 页面能正常滑动返回 home
todos:
  - id: fix-audio-nav
    content: 修改 home.ts 的 onPlayAudio 方法，将 wx.reLaunch 替换为 this.navigator?.navigate
    status: completed
---

## 产品概述

修复 audio 页面左右滑动直接退出小程序的问题。

## 核心功能

- **问题**：从 home 页面点击播放音频跳转到 audio 页面时，使用了 `wx.reLaunch`，导致页面栈被清空，audio 成为唯一页面，左右滑动返回手势直接退出小程序。
- **修复**：将 `home.ts` 中 `onPlayAudio` 方法的 `wx.reLaunch` 替换为与 photos/videos/cards 等其他子页面一致的 `this.navigator?.navigate()` 导航方式，使 audio 正常入栈，支持滑动返回 home。

## 技术栈

- 微信小程序原生开发（TypeScript）
- 自定义 Navigator v3 调度器（`utils/navigator/index.ts`）

## 实现方案

### 修改策略

将 `miniprogram/pages/home/home.ts` 第 791-792 行的导航调用从 `wx.reLaunch` 改为 `this.navigator?.navigate()`，与同文件第 763-769 行 `onSectionMore` 方法保持一致：

```typescript
// 修改前：
wx.reLaunch({ url: "/pages/audio/audio" });

// 修改后：
this.navigator?.navigate("/pages/audio/audio");
```

### 技术依据

| API | 页面栈行为 | 返回能力 |
| --- | --- | --- |
| `wx.reLaunch` | 关闭所有页面，只保留目标页 | 无上一页，滑动返回=退出小程序 |
| `this.navigator?.navigate()` | 保留当前页，目标页压入栈顶 | 有上一页，可正常滑回 |


### 影响范围

仅修改 `home.ts` 一个文件的 `onPlayAudio` 方法，无其他依赖影响。Navigator v3 已内置 saveScrollPosition + 栈深预检 + 三层打断 + fallback 降级链，无需额外处理。

### 注意事项

原注释写的是 "audio 是 component 页，Skyline 下需用 reLaunch"，这个前提已不成立（其他子页同样使用 navigate 均正常工作），需同步更新注释。