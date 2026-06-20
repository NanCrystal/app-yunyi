---
name: fix-navigateTo-timeout
overview: 修复 home.ts 中 navigateTo 超时失败的问题，通过预先检查页面栈深度并优化降级策略来解决导航失败
todos:
  - id: fix-navigate-stack
    content: 修复 home.ts 中 onSectionMore/onNavigate/onNavigateTo 三个方法的页面栈溢出问题，增加 getCurrentPages() 预检查和降级逻辑
    status: completed
---

## Product Overview

修复微信小程序首页 `home.ts` 中 `navigateTo` 调用因页面栈超限（10层上限）导致的 `timeout` 错误。

## Core Features

- 在 `home.ts` 的三个导航方法（`onNavigate`、`onSectionMore`、`onNavigateTo`）中，增加页面栈深度预检查，避免在栈满时调用 `navigateTo` 导致超时失败
- 栈满时采用合理的降级策略：优先使用 `redirectTo` 替代，保留 fail 兜底回调确保跳转最终成功
- 复用项目中已有的 `getCurrentPages()` 模式（参考 `videos.ts`、`schedule.ts` 的实现）

## Tech Stack

- 微信小程序原生开发（TypeScript）
- 微信小程序路由 API（`wx.navigateTo`、`wx.redirectTo`、`wx.reLaunch`、`getCurrentPages`）

## 实现方案

### 根因分析

微信小程序 `navigateTo` 页面栈上限为 **10 层**。当页面栈已达到或接近 10 层时继续调用 `navigateTo`，框架内部会等待超时后返回 `{errMsg: "navigateTo:fail timeout"}` 错误。当前代码存在以下缺陷：

1. **无前置检查**：所有 `navigateTo` 调用前未检查 `getCurrentPages().length`
2. **降级策略不当**：`onSectionMore` 中降级使用 `redirectTo` 会关闭当前 home 页面，导致用户返回时丢失首页上下文
3. **遗漏处理**：`onNavigate` 和 `onNavigateTo` 方法完全无错误处理

### 修复策略

遵循项目已有模式（`videos.ts:152-158`, `schedule.ts:61-84`），统一为以下逻辑：

```
调用 navigateTo 前 → getCurrentPages() 检查页面栈
  ├── length < 9  → 正常 navigateTo（保留 fail 回调兜底）
  └── length >= 9 → 直接 redirectTo（避免超时，保留当前页面的上一页）
```

**关键决策**：

- 阈值选择 **9 而非 10**：留 1 层余量，因为用户可能在目标页内再次导航；同时避免临界条件下的竞态问题
- 降级使用 **redirectTo 而非 reLaunch**：`redirectTo` 仅关闭当前页，保留页面栈中其他页面（如 index），用户体验优于清空全栈的 `reLaunch`
- **不抽取公共工具函数**：项目内 `videos.ts`/`schedule.ts` 均为内联实现，保持一致性

### 影响范围

仅修改一个文件：`miniprogram/pages/home/home.ts`，涉及 3 个方法：

| 方法 | 行号 | 问题 | 修改内容 |
| --- | --- | --- | --- |
| `onSectionMore` | 716-736 | 有 fail 回调但无预检查 | 增加 `getCurrentPages()` 判断 |
| `onNavigate` | 708-714 | 无任何保护 | 增加页面栈检查 + fail 回调 |
| `onNavigateTo` | 738-742 | 无任何保护 | 增加页面栈检查 + fail 回调 |


## 实现细节

### 修改文件

```
miniprogram/pages/home/home.ts  [MODIFY]
```

### 核心代码变更

对 `onSectionMore` 方法（主要报错位置）的改造：

```typescript
onSectionMore(this: HomePageInstance, e: WechatMiniprogram.CustomEvent) {
  const key = e.detail.key as string;
  this.saveScrollPosition();
  const url = SUBPKG_PAGES[key] || `/pages/${key}/${key}`;

  const pages = getCurrentPages();
  if (pages.length >= 9) {
    // 页面栈接近上限，使用 redirectTo 避免超时
    wx.redirectTo({
      url,
      fail(err: any) {
        console.error('redirectTo 也失败:', key, err);
      },
    });
    return;
  }

  wx.navigateTo({
    url,
    fail(err: any) {
      console.error(`navigateTo 失败，降级为 redirectTo:`, key, err);
      wx.redirectTo({ url });
    },
  });
}
```

`onNavigate` 和 `onNavigateTo` 采用相同模式添加保护。

### 注意事项

- `saveScrollPosition()` 在 `redirectTo` 场景下仍应执行（虽然 home 页会被销毁，但不会有副作用）
- 保持现有日志格式不变，方便错误追踪
- 不改动 `SUBPKG_PAGES` 映射逻辑和 URL 构建逻辑