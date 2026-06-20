---
name: section-header-theme-color-optimization
overview: 将 section-header 组件从使用 themeBehavior 自行计算主题色改为通过 property 从父组件接收主题色，消除重复的 computeTheme() 调用
todos:
  - id: refactor-section-header-ts
    content: 移除 themeBehavior 并新增 themeColor property
    status: completed
  - id: update-section-header-wxml
    content: 为 .section-more 和 .more-arrow 添加 themeColor 内联 style
    status: completed
    dependencies:
      - refactor-section-header-ts
  - id: update-home-wxml-calls
    content: 在 home.wxml 全部 5 处 section-header 调用中添加 themeColor 属性
    status: completed
    dependencies:
      - refactor-section-header-ts
---

## 产品概述

对 `section-header` 组件进行性能优化，将其从"自行计算主题色"改为"由父组件通过 property 传入主题色"，消除冗余的 `computeTheme()` 重复调用。

## 核心功能

- 移除 `section-header` 组件的 `themeBehavior` 依赖，改为接收 `themeColor` 属性
- 在组件 wxml 中使用内联 style 应用传入的主题色
- 在 home 页面的所有 5 处 `<section-header>` 调用处传入 `themeColor="{{themeColor}}"`
- 性能收益：消除每个组件实例 attached + show 各一次 computeTheme() 调用（5个实例 x 2次 = 最多10次重复计算 → 减少至仅 home 页面自身1次计算）

## 技术栈

- 微信小程序原生框架（Component / WXML / WXSS）
- TypeScript

## 实现方案

**策略**：将主题色从 behavior 内部计算下沉为 property 外部注入，遵循"单一职责原则"——组件只负责展示，不负责数据计算。

**关键决策**：

1. **移除 themeBehavior**：删除 `behaviors: [themeBehavior]` 及对应 import
2. **新增 property**：添加 `themeColor: { type: String, value: '#aa0a27' }`，默认值与原 themeBehavior 一致
3. **内联 style 覆盖**：在 `.section-more` 元素上通过 `style="color: {{themeColor}}; border-color: {{themeColor}}"` 直接应用颜色，优先级高于 wxss 中的 `var(--theme)`
4. **保留 CSS 变量降级**：wxss 中已有的 `var(--theme)` 不做改动，作为未传 themeColor 时的兜底样式

## 架构设计

```
home 页 (computeTheme 只调用 1 次)
  ├── setData({ themeColor, themeR, themeG, themeB })
  ├── scroll-view (CSS 变量供子元素继承)
  └── section-header x5 (各接收 themeColor property)
        ├── .more-text (内联 color)
        └── .more-arrow (需额外处理 background-color)
```

注意：`.more-arrow` 使用的是 `background-color: var(--theme)` 设置箭头颜色，wxml 内联 style 需要同时覆盖该元素的 background-color，或者改用 class + CSS 变量方式统一处理。

## 目录结构

```
miniprogram/
├── components/section-header/
│   ├── section-header.ts    # [MODIFY] 移除 themeBehavior，新增 themeColor property
│   ├── section-header.wxml  # [MODIFY] .section-more 添加内联 style
│   ├── section-header.wxss  # [MODIFY] 可选清理 var(--theme) 依赖
│   └── section-header.json  # 无变更
└── pages/home/
    └── home.wxml            # [MODIFY] 5 处 <section-header> 均添加 themeColor="{{themeColor}}"
```