---
name: home-section-header-navigateTo
overview: 将 home 页面中通过 section-header 组件跳转到子页面的导航方式从 wx.reLaunch 改为 wx.navigateTo，以支持左右滑动返回上一页。涉及 4 个跳转方法和 6 个目标页面。
todos:
  - id: modify-home-navigation
    content: 将 home.ts 中 onSectionMore/onNavigate/onNavigateTo/onPlayAudio 四个方法的 wx.reLaunch 替换为 wx.navigateTo
    status: completed
  - id: fix-sync-goback
    content: 修复 sync.ts 中 onGoBack 方法，将硬编码的 reLaunch 改为 navigateBack 并保留 fail 回退逻辑
    status: completed
  - id: verify-sliding-back
    content: 验证所有 6 个目标页面的滑动返回功能是否正常工作
    status: completed
    dependencies:
      - modify-home-navigation
      - fix-sync-goback
---

## Product Overview

将 home 页面中通过 section-header 组件进入的所有目标页面（sync、schedule、photos、videos、cards、audio）的导航方式从 `wx.reLaunch` 改为 `wx.navigateTo`，使这些页面支持左右滑动返回上一页。

## Core Features

- 将 home.ts 中所有 section-header 相关跳转方法从 `wx.reLaunch` 改为 `wx.navigateTo`
- 修正 sync 页面的返回方法使其与 navigateTo 兼容
- 所有目标页面已具备自定义导航栏和返回按钮（‹），无需额外 UI 改动
- Skyline 渲染引擎原生支持右滑返回手势，无需额外配置

## 涉及页面清单

| 目标页面 | 当前跳转方式 | 返回按钮 | onGoBack 状态 | 需改动 |
| --- | --- | --- | --- | --- |
| sync (动态馆) | reLaunch | ‹ 有 | 需改为 navigateBack | home.ts + sync.ts |
| schedule (行程馆) | reLaunch | ‹ 有 | 已兼容 | 仅 home.ts |
| photos (图片馆) | reLaunch | ‹ 有 | 已兼容 | 仅 home.ts |
| videos (视频馆) | reLaunch | ‹ 有 | 已兼容 | 仅 home.ts |
| cards (小卡馆) | reLaunch | ‹ 有 | 已兼容 | 仅 home.ts |
| audio (音频馆) | reLaunch | ‹ 有 | 已兼容 | 仅 home.ts |


## Tech Stack

- 微信小程序 (Skyline 渲染引擎)
- TypeScript + Component 组件化架构

## 实现方案

### 核心策略：将 `wx.reLaunch` 替换为 `wx.navigateTo`

**原理**：

- `wx.reLaunch` 会销毁整个页面栈再打开新页，导致无历史记录可回退
- `wx.navigateTo` 将新页面压入栈顶，保留历史记录，Skyline 引擎自动支持右滑返回手势
- 项目已启用 `skylineRenderEnable: true`，无需额外配置即可使用滑动返回

### 关键发现（经代码验证）

1. **全部 6 个目标页面已有自定义导航栏 + 返回按钮（‹）**：schedule、photos、videos、sync、cards、audio 的 wxml 均包含 `<view class="custom-nav-left" bind:tap="onGoBack">` 结构
2. **5/6 个目标页面的 `onGoBack` 已经兼容 `navigateTo`**：

- schedule: `pages.length > 1 ? wx.navigateBack() : wx.reLaunch(home)` （完美兼容）
- photos: `pages.length > 1 ? wx.navigateBack() : ...` （兼容）
- videos: 同 photos （兼容）
- cards: `wx.navigateBack({ fail: () => wx.reLaunch(home) })` （兼容）
- audio: `wx.navigateBack({ fail: () => wx.reLaunch(home) })` （兼容）

3. **仅 sync 页面需要修改 `onGoBack`**：当前硬编码 `wx.reLaunch({ url: "/pages/home/home" })`

### 改动范围（极小）

#### 文件 1：`miniprogram/pages/home/home.ts`（4 处修改）

| 方法 | 行号 | 改动 |
| --- | --- | --- |
| `onSectionMore` | 723 | `wx.reLaunch` → `wx.navigateTo` |
| `onNavigate` | 713 | `wx.reLaunch` → `wx.navigateTo` |
| `onNavigateTo` | 735 | `wx.reLaunch` → `wx.navigateTo` |
| `onPlayAudio` | 754 | `wx.reLaunch` → `wx.navigateTo` |


#### 文件 2：`miniprogram/subpkg/media/pages/sync/sync.ts`（1 处修改）

| 方法 | 行号 | 改动 |
| --- | --- | --- |
| `onGoBack` | 154-156 | `wx.reLaunch({ url: "/pages/home/home" })` → `wx.navigateBack({ fail: () => wx.reLaunch({ url: '/pages/home/home' }) })` |


### 影响分析

- **正面影响**：用户可通过右滑或点击返回按钮回到首页，符合直觉
- **页面栈管理**：由于只有 home 和 mine 有 bottom-tab-bar，用户在子页面无法通过 Tab 跳转清空栈。但正常使用场景中，用户进入子页面后直接返回即可，不太可能连续跳转超过 10 次（微信上限）。若需防护可在后续迭代中加入栈深度检查
- **生命周期变化**：返回 home 时只触发 `onShow`（非重新 `onLoad`），home 已有 `restoreScrollPosition()` 逻辑可恢复滚动位置，体验更优
- **无 UI 变动**：所有目标页面导航栏无需修改