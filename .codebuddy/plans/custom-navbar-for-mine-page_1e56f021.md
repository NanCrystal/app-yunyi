---
name: custom-navbar-for-mine-page
overview: 将 mine 页面的原生导航栏替换为自定义导航栏，以支持 font-family、letter-spacing、text-transform 等高级样式
todos:
  - id: config-custom-nav
    content: 修改 mine.json：添加 navigationStyle:custom 并移除 navigationBarTitleText
    status: completed
  - id: add-nav-logic
    content: 修改 mine.ts：添加 statusBarHeight 数据字段并在 onLoad 中获取系统状态栏高度
    status: completed
    dependencies:
      - config-custom-nav
  - id: add-nav-template
    content: 修改 mine.wxml：在页面顶部插入自定义导航栏结构（左占位 + ACCOUNT标题 + 右占位）
    status: completed
    dependencies:
      - config-custom-nav
  - id: add-nav-style
    content: 修改 mine.wxss：添加 .custom-nav 系列样式并调整 .mine-page 的 padding-top 适配导航栏
    status: completed
    dependencies:
      - add-nav-template
---

## 产品概述

将 mine（我的/ACCOUNT）页面从原生导航栏改为自定义导航栏，并对标题文字应用用户指定的自定义样式。

## 核心功能

- 将 mine 页面的导航栏从微信原生 `navigationBarTitleText` 改为项目统一的自定义导航栏组件模式
- 导航栏标题 "ACCOUNT" 应用以下样式：Courier New 字体、22rpx 字号、400 字重、24rpx 字间距、白色、居中、大写
- 保持与项目其他页面（home、schedule 等）完全一致的自定义导航栏结构和交互模式

## 涉及文件

- **mine.json**: 添加 `navigationStyle: "custom"` 隐藏原生导航栏，移除 `navigationBarTitleText`
- **mine.wxml**: 在页面顶部添加自定义导航栏结构
- **mine.wxss**: 添加自定义导航栏相关样式（`.custom-nav`、`.custom-nav-inner`、`.custom-nav-title` 等）
- **mine.ts**: 添加 `statusBarHeight` 数据字段，在 `onLoad` 中通过 `wx.getWindowInfo()` 获取状态栏高度

## 技术栈

- 微信小程序原生框架（WXML / WXSS / TS）
- 项目使用 `glass-easel` 组件框架 + `withTheme` 行为封装

## 实现方案

**策略**：复用项目中已成熟的自定义导航栏模式。home、schedule、sync、videos、cards 等页面均已采用相同模式，`.custom-nav-title` 样式与用户需求完全一致（含 Courier New / 22rpx / 24rpx letter-spacing / white / center）。

**工作原理**：

1. 在 `mine.json` 中设置 `"navigationStyle": "custom"` 隐藏原生导航栏
2. 在 `mine.wxml` 顶部插入 `<view class="custom-nav">` 结构（固定定位 + 状态栏高度 padding），内部使用 flex 布局：左侧占位区 + 居中标题 + 右侧占位区
3. 在 `mine.wxss` 中添加与 home/schedule 页面完全一致的导航栏样式
4. 在 `mine.ts` 的 data 中声明 `statusBarHeight`，onLoad 时通过 `wx.getWindowInfo()` 获取并 setData
5. 同时调整 `.mine-page` 的 padding-top，为自定义导航栏留出空间

## 关键实现细节

- **statusBarHeight 获取方式**: 与 schedule 页面一致，使用 `wx.getWindowInfo()` （较新的 API），兼容性由小程序基础库保证
- **导航栏总高度**: statusBarHeight + 44px（88rpx 的导航内容区），页面内容区需相应设置 padding-top 避免被遮挡
- **样式一致性**: 直接复用项目已有的 `.custom-nav-title` 样式规范，包含用户要求的全部属性（`text-transform: uppercase` 也已在 schedule 页面中使用）

## 架构设计

修改涉及 4 个文件，遵循项目现有的分层约定：

```
mine.json   → 页面配置（navigationStyle 切换）
mine.ts     → 数据层（statusBarHeight 状态管理）
mine.wxml   → 模板层（自定义导航栏 DOM 结构）
mine.wxss   → 样式层（导航栏 + 内容区适配样式）
```