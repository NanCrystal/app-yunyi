---
name: fix-navigateTo-timeout-compatibility
overview: 针对微信小程序开发者工具中 navigateTo 容易触发 timeout 的问题，通过增加重试机制和优化页面栈管理来提升开发体验
todos:
  - id: add-nav-utils
    content: 在 home.ts 中新增 isTimeoutError 和 safeNavigateTo 工具函数
    status: pending
  - id: refactor-navigate-methods
    content: 重构 onNavigate、onSectionMore、onNavigateTo 三个方法使用 safeNavigateTo
    status: pending
    dependencies:
      - add-nav-utils
---

## 产品概述

修复微信小程序在开发者工具中使用 glass-easel 新渲染框架时，`navigateTo` 容易触发 timeout 导致降级为 `redirectTo`，进而使子页面返回按钮无法正常回到上一页的问题。

## 核心功能

- **智能导航降级策略**：在 `home.ts` 的导航方法（`onNavigate`、`onSectionMore`、`onNavigateTo`）中，区分「DevTools 超时误报」与「真正的页面栈满」两种失败场景：
- 超时类错误：延迟重试 `navigateTo`，而非直接降级到 `redirectTo`
- 真正的页面栈溢出：保持现有 `redirectTo` 降级逻辑
- **兼容真机行为**：真机上不触发超时，行为完全不变；仅在开发者工具中改善体验
- **最小改动原则**：只修改导航逻辑的 fail 回调，不影响正常流程和 UI

## 技术栈

- 微信小程序原生框架（TypeScript）
- 目标文件：`miniprogram/pages/home/home.ts`

## 实现思路

### 核心策略：按错误类型差异化处理

当前代码的问题在于 **所有 navigateTo 失败统一降级为 redirectTo**，但 DevTools 中 glass-easel 触发的 timeout 并非真正需要 redirectTo 的场景。

**方案：提取通用导航工具函数 + 按错误码分支处理**

```typescript
// 关键判断逻辑
function isTimeoutError(err: any): boolean {
  // DevTools glass-easel 常见超时特征
  const msg = (err?.errMsg || err?.message || '').toLowerCase();
  return msg.includes('timeout') || msg.includes('超时');
}

// 导航方法改造后伪代码
wx.navigateTo({
  url,
  fail(err) {
    if (isTimeoutError(err)) {
      // DevTools 超时：延迟重试一次，避免误降级
      setTimeout(() => wx.navigateTo({ url }), 300);
    } else {
      // 真正的错误（页面栈满等）：保持原有 redirectTo 降级
      wx.redirectTo({ url });
    }
  },
});
```

### 架构设计

```
home.ts 内部改造：
┌─────────────────────────────────────┐
│  新增 safeNavigateTo() 工具函数       │
│  - 统一封装 navigateTo + 错误分类     │
│  - 超时自动重试                       │
│  - 非超时降级 redirectTo              │
└──────────┬──────────────────────────┘
           │ 被以下三个方法调用
   ┌───────┼───────────┐
   ▼       ▼           ▼
onNavigate onSectionMore onNavigateTo
```

### 改动范围

| 文件 | 改动类型 | 说明 |
| --- | --- | --- |
| `miniprogram/pages/home/home.ts` | [MODIFY] | 新增 `safeNavigateTo` 工具函数和 `isTimeoutError` 辅助函数；重构 `onNavigate`、`onSectionMore`、`onNavigateTo` 三个方法使用新工具函数 |


不需要改动子页面的 `onGoBack` —— 因为只要不再误触发 `redirectTo`，现有的 `navigateBack` + fail 回退 `reLaunch` 兜底逻辑就能正常工作。

### 实施要点

1. **`safeNavigateTo(url)` 函数**：接收目标 URL，内部先尝试 `navigateTo`，fail 时判断错误类型
2. **超时重试机制**：仅重试 1 次，延迟 300ms，避免无限循环
3. **页面栈预检查保留**：现有的 `pages.length >= 9` 检查逻辑不变，这是真正的页面栈保护
4. **日志区分**：超时重试时用 `console.warn` 级别（开发期信息），真正的失败用 `console.error`