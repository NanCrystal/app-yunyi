---
name: implement-comments-navigation
overview: 在 mine.ts 的 onCommentsTap 方法中实现跳转到 /pages/comments/comments 页面
todos:
  - id: implement-comments-navigation
    content: 在 mine.ts 的 onCommentsTap 方法中添加 wx.navigateTo 跳转到 /pages/comments/comments
    status: completed
---

## Product Overview

在"我的"页面（mine）的 `onCommentsTap` 方法中实现页面跳转功能，点击后跳转到评论列表页 `/pages/comments/comments`。

## Core Features

- 在 mine.ts 第 91-93 行的空方法 `onCommentsTap()` 中添加跳转逻辑
- 使用小程序原生导航 API 跳转到已注册的 comments 页面

## Tech Stack

- 微信小程序原生框架（WXML + WXSS + TypeScript）
- 导航方式：`wx.navigateTo()`

## 技术分析

### 跳转方式选择

根据项目代码分析，推荐使用 **`wx.navigateTo`**：

| 方案 | 适用场景 | 本项目是否匹配 |
| --- | --- | --- |
| `wx.navigateTo` | 普通内容页跳转，保留当前页面栈，可返回 | ✅ comments 非 tabBar 页面，需要返回能力 |
| `wx.switchTab` | 跳转到 tabBar 页面 | ❌ comments 不在 tabBar 中 |
| `wx.redirectTo` | 关闭当前页面跳转（不可返回） | ❌ 用户从"我的"进入评论，应保留返回能力 |
| `wx.reLaunch` | 关闭所有页面重新打开 | ❌ 过重，仅用于特殊场景（如登录重定向） |


### 项目惯例验证

- `home.ts:740` — 内容页跳转使用 `wx.navigateTo`
- `welcome.ts:107` — 初始引导使用 `wx.redirectTo`（一次性跳转）
- `index.ts:68` / `bottom-tab-bar.ts:31` — tabBar 切换使用 `wx.reLaunch`

**结论**：`onCommentsTap` 作为普通功能入口，遵循项目惯例使用 `wx.navigateTo`。

### 实现代码

```typescript
onCommentsTap() {
  wx.navigateTo({ url: '/pages/comments/comments' });
},
```