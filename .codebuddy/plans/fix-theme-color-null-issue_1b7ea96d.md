---
name: fix-theme-color-null-issue
overview: 修复 home 页面 section-header 组件 themeColor 属性接收到 null 值的问题，需要在 behaviors/theme.ts 中添加防御性处理
todos:
  - id: fix-theme-null
    content: 修复 behaviors/theme.ts 中 computeTheme() 的空值防护逻辑，确保 themeColor 始终为有效字符串
    status: completed
---

## 产品概述

修复微信小程序 home 页面控制台警告：`section-header` 组件的 `themeColor` 属性收到 null 值（期望 String 类型）。

## 核心问题

`behaviors/theme.ts` 中 `computeTheme()` 函数存在防御性缺失：

- 第 21 行：当 `characters` 数组为空或找不到匹配角色时，`char` 可能为 `undefined`
- 第 22 行：直接访问 `char.accentColor` 可能导致运行时错误或返回 null/undefined
- 第 25 行：将可能为 null 的 `accentColor` 作为 `themeColor` 返回，传递给 `section-header` 组件时触发类型不兼容警告

## 核心功能

- 在 `computeTheme()` 函数中增加防御性空值检查，确保 `themeColor` 始终返回有效字符串
- 当角色数据异常时，回退到安全的默认主题色 `#aa0a27`

## 技术栈

- 微信小程序 (TypeScript)
- 无需引入新依赖

## 实现方案

**策略**：在 `computeTheme()` 函数中添加多层防御性校验

**关键决策**：

1. 在访问 `char.accentColor` 前，先确保 `char` 对象存在（处理空数组场景）
2. 在使用 `accentColor` 前进行 falsy 检查，null/undefined/空字符串均回退到默认色
3. 默认值与现有 `withTheme` 注入的默认值保持一致：`#aa0a27`

## 实现细节

修改文件 `miniprogram/behaviors/theme.ts` 的 `computeTheme()` 函数：

```typescript
function computeTheme() {
  const characters: Character[] = getCharacters();
  const id = app.globalData.selectedCharId || 'char1';
  const char = characters.find((c) => c.artistId === id) || characters[0];
  // 防御性检查：确保 char 和 accentColor 有效
  const DEFAULT_COLOR = '#aa0a27';
  const color = char?.accentColor || DEFAULT_COLOR;
  const rgb = parseColorToRgb(color);

  return {
    themeColor: color,
    themeR: rgb.r,
    themeG: rgb.g,
    themeB: rgb.b,
  };
}
```

## 架构设计

无需架构变更，属于纯防御性代码修复。影响范围仅限于 `behaviors/theme.ts` 中的单个函数，所有通过 `withTheme()` 或 `themeBehavior` 使用主题能力的页面均自动受益。

## 目录结构

```
miniprogram/
└── behaviors/
    └── theme.ts   # [MODIFY] 修复 computeTheme() 函数中的空值防护
```