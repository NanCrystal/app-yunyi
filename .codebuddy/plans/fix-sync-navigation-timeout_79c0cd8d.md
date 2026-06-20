---
name: fix-sync-navigation-timeout
overview: "修复 home.ts 跳转 sync 页面时的 navigateTo timeout 错误，问题根源是 sync 页面配置了 renderer: \"webview\" 导致分包+WebView 初始化超时"
todos:
  - id: fix-sync-renderer
    content: "修改 sync.json 移除 renderer: \"webview\" 配置，消除 Skyline/webview 模式冲突导致的初始化超时"
    status: completed
  - id: enhance-navigate-fallback
    content: 增强 home.ts onSectionMore 方法，添加 timeout 自动重试与 reLaunch 降级机制
    status: completed
    dependencies:
      - fix-sync-renderer
  - id: verify-navigation
    content: 验证修复效果：确认首页跳转 sync 页面正常无超时报错
    status: completed
    dependencies:
      - enhance-navigate-fallback
---

## Product Overview

修复微信小程序中从首页 home.ts 跳转至 sync 分包页面时出现的 `navigateTo:fail timeout` 错误，确保跳转功能正常工作。

## Core Features

- **定位根因**：sync 页面的 `renderer: "webview"` 配置与项目全局 Skyline 渲染模式冲突，导致 WebView 兼容模式下页面初始化开销过大，触发 navigateTo 超时
- **修复跳转失败**：调整 sync 页面渲染器配置，消除初始化延迟瓶颈
- **增强容错能力**：在 home.ts 的导航方法中添加重试和降级机制，提升用户体验

## Tech Stack

- 微信小程序（基础库 3.10.3）
- TypeScript + glass-easel 组件框架
- Skyline 渲染模式（`skylineRenderEnable: true`）

## 根因分析

### 问题链路追踪

```
用户点击 section-header "更多" 按钮 (home.wxml:87, moreKey="sync")
  → onSectionMore 触发 (home.ts:713)
    → key = "sync", url = SUBPKG_PAGES["sync"] = "/subpkg/media/pages/sync/sync"
      → wx.navigateTo({ url: "/subpkg/media/pages/sync/sync" })
        → 页面初始化超时 → fail 回调报错 (home.ts:722)
```

### 超时的三重原因

| 层级 | 原因 | 详情 |
| --- | --- | --- |
| **根本原因** | 渲染器模式不匹配 | `project.config.json` 全局启用了 `skylineRenderEnable: true`，但 `sync.json` 显式声明 `"renderer": "webview"`。在 Skyline 全局启用下，webview 渲染器以兼容模式运行，需要额外创建 WebView 容器，初始化开销显著增大 |
| **加重因素** | 页面复杂度高 | sync.ts 含 520 行代码、视频播放器、IntersectionObserver 可视区观察、scroll-view 嵌套、骨架屏等多阶段渲染逻辑 |
| **环境因素** | 开发工具平台 | Windows 开发者工具的 WebView 初始化比 macOS/真机更慢；基础库 3.10.3 存在已知的 navigateTo timeout 问题（已在 devtools 1.06.2410222 修复） |


### 微信官方知识库佐证

- 官方确认 `navigateTo:fail timeout` 为已知问题并在后续版本修复
- Skyline 模式下推荐使用 `wx.preloadSkylineView` 预加载渲染环境
- 官方建议：Skyline 全局启用时，新页面应默认使用 Skyline 渲染器而非 webview 兼容模式

## 实现方案

### 方案一（核心修复）：移除 sync.json 中的 renderer 配置

**策略**：删除 sync.json 中 `"renderer": "webview"` 字段，让页面继承全局渲染配置。

- 当 skylineRenderEnable 全局启用时，移除页面级的 renderer 声明后，页面将使用 Skyline 原生渲染，初始化速度大幅提升
- sync 页面的 WXML 已使用 scroll-view 局部滚动（符合 Skyline 最佳实践），组件均为标准组件，无 webview 独占特性
- **风险**：需要验证 Skyline 渲染下页面显示正常（CSS 子集兼容性）

### 方案二（备选）：改为 renderer: "skyline"

如方案一测试后发现显示异常，则将 renderer 显式设为 `"skyline"`：

```
{"navigationStyle": "custom", "renderer": "skyline", "usingComponents": {}}
```

### 方案三（容错增强）：优化 home.ts 导航方法

在 `onSectionMore` 中增加重试机制和降级处理：

- 首次 navigateTo 失败后自动重试一次
- 重试仍失败时改用 `wx.reLaunch` 作为最终降级（reLaunch 不受页面栈限制且超时阈值不同）
- 对 timeout 类错误给出更友好的提示信息

## 实现细节

### 文件修改清单

```
miniprogram/
├── subpkg/media/pages/sync/
│   └── sync.json                    # [MODIFY] 移除 renderer: "webview"
├── pages/home/
│   └── home.ts                      # [MODIFY] 增强 onSectionMore 导航容错逻辑
```

### 关键改动说明

#### 1. sync.json — 移除 renderer 字段

**修改前**：

```
{"navigationStyle": "custom", "renderer": "webview", "usingComponents": {}}
```

**修改后**：

```
{"navigationStyle": "custom", "usingComponents": {}}
```

#### 2. home.ts — onSectionMore 方法增强

- 增加 1 次自动重试（间隔 300ms）
- timeout 错误降级为 reLaunch
- 区分 timeout 和其他错误类型，提供差异化提示
- 保持原有非 timeout 错误的处理逻辑不变

## 注意事项

- 修改后需在开发者工具中完整编译并真机预验，特别关注 Skyline 渲染下 sync 页面的 scroll-view、video、IntersectionObserver 是否正常
- 如发现 Skyline 下某些 CSS 特性不支持，采用方案二（显式设置 renderer: "skyline"）或针对性修复 CSS
- Windows 开发者工具建议升级到 >= 1.06.2410222 以获得 timeout 相关修复