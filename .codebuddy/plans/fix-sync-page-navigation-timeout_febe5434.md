---
name: fix-sync-page-navigation-timeout
overview: 修复点击"最新动态"更多按钮跳转到 sync 页面时出现 navigateTo:fail timeout 错误的问题。根本原因是 sync 页面使用了 Skyline 渲染器，在首次加载时初始化耗时较长导致超时。
todos:
  - id: fix-sync-renderer
    content: "移除 sync.json 中 renderer: skyine 配置，解决 navigateTo timeout 问题"
    status: completed
---

## 产品概述

修复微信小程序中点击"最新动态"模块"更多"按钮跳转到 sync（动态馆）页面时出现的 `navigateTo:fail timeout` 错误

## 核心功能

- 修复 sync 页面的导航跳转超时问题
- 确保从首页 home 点击"更多"能正常进入动态馆列表页
- 保持页面现有功能和样式不受影响

## 技术栈

- 微信小程序原生开发 (TypeScript + WXML + WXSS + JSON)
- 渲染引擎：WebView（默认）替代 Skyline

## 根因分析

**问题链条**：`home.wxml:84` section-header 组件触发 `onSectionMore` → `home.ts:722` 解析 URL 为 `/subpkg/media/pages/sync/sync` → `wx.navigateTo()` 调用 → **sync 页面配置了 `"renderer": "skyline"`** → Skyline 首次初始化 Native 渲染管线的耗时超过了 `navigateTo` 的内部超时阈值 → 触发 fail 回调报 `timeout`

**关键证据**：

1. 全项目搜索确认：仅 `sync.json` 一处使用 `renderer: "skyline"` 配置
2. `sync.wxss` 中无 Skyline 专属 CSS 属性（无 `display-mode`/`flex-dispatch`/`worklet`）
3. `sync.wxml` 中使用的 `enhanced scroll-view`、`swiper`、`video`、`image` 组件在 WebView 下完全兼容
4. 自定义导航栏 (`navigationStyle: custom`) 与渲染器选择无关

## 实现方案

### 策略：移除 Skyline 渲染器配置

将 sync 页面从 Skyline 回退到默认 WebView 渲染，这是最小改动、最彻底的解决方案。

### 改动范围

仅需修改 **1 个文件**：`miniprogram/subpkg/media/pages/sync/sync.json`

- 移除 `"renderer": "skyline"` 字段
- 保留 `"navigationStyle": "custom"` 和 `"usingComponents": {}`

### 为什么不用其他方案

| 方案 | 缺点 |
| --- | --- |
| 保留 Skyline + 预加载 | `preloadRule` 已配置但仍超时，治标不治本 |
| 直接改 reLaunch | 破坏页面栈，用户无法返回首页 |
| 增加超时时间 | 微信 API 不支持自定义 navigateTo 超时 |


## 架构设计

修改前后架构不变，仅影响 sync 页面的渲染后端选择：

```
修改前: home → navigateTo → sync(Skyline渲染) → timeout ❌
修改后: home → navigateTo → sync(WebView渲染) → 正常跳转 ✅
```

## 目录结构

```
miniprogram/
└── subpkg/media/pages/sync/
    └── sync.json   # [MODIFY] 移除 renderer:"skyline"，解决 navigateTo 超时问题
```