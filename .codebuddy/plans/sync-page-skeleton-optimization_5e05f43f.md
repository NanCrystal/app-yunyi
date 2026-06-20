---
name: sync-page-skeleton-optimization
overview: 优化 sync 页面加载逻辑，解决 navigateTo 超时问题，确保骨架屏在页面进入时立即展示，不等待接口返回
todos:
  - id: fix-onshow-defer
    content: 改造 sync.ts 的 onShow 方法，用 setTimeout(0) 延迟调用 _bootstrap 让骨架屏先渲染
    status: completed
  - id: fix-bootstrap-timeout
    content: 给 _bootstrap 增加 15 秒超时兜底保护，防止骨架屏永久卡住
    status: completed
    dependencies:
      - fix-onshow-defer
---

## Product Overview

修复 sync（动态馆）页面 `navigateTo:fail timeout` 导致无法正常跳转进入的问题。当前页面虽然 onLoad 和 onShow 生命周期均已触发、接口请求也已发出，但微信小程序框架因页面初始化超时而报错降级为 redirectTo。

## Core Features

- **骨架屏即时渲染**：页面跳转进入后立即展示骨架屏，不依赖接口返回
- **非阻塞数据加载**：将数据请求推迟到首帧渲染完成后异步执行，避免阻塞导航流程
- **超时兜底保护**：接口长时间无响应时自动关闭骨架屏并展示空态/错误提示，防止用户永远看到骨架屏

## Tech Stack

- 微信小程序原生框架（WXML/WXSS/TS）
- 现有项目架构：withTheme 行为 + Page 构造器

## 根因分析

### 问题链条

1. home.ts 调用 `wx.navigateTo({ url: '/pages/sync/sync' })`
2. sync 页面 `onLoad` 执行轻量初始化（获取屏幕信息 + setData 设置 skeleton=true）-- 正常
3. sync 页面 `onShow` **同步调用** `this._bootstrap()`
4. `_bootstrap()` 内部 **`await this.fetchPosts()`** -- 阻塞直到 `/sync/posts` 接口返回
5. 若接口响应超过微信 navigateTo 内置超时阈值（约 3 秒），框架判定目标页面未就绪
6. 报错 `{errMsg: "navigateTo:fail timeout"}` 并在 home.ts 中降级为 `redirectTo`

### 关键矛盾点

虽然 `skeleton: true` 已在 data 初始值和 onLoad 中设置，但 `onShow` 中同步触发的 `await` 操作会占用 JS 上下文，导致 setData 的骨架屏渲染被延迟调度。微信小程序的 navigateTo 超时判定不仅看是否调用了 setData，还关注页面是否完成了可感知的首帧渲染。

## 实现方案

### 核心策略：将数据加载从 onShow 同步路径中解耦，确保首帧纯展示骨架屏

### 改动文件

仅修改 `e:\Project\app-yunyi\miniprogram\pages\sync\sync.ts`

### 具体改动

#### 1. onShow 方法（第 146-151 行）：延迟启动 _bootstrap

```typescript
// 改造前
onShow(this: PageInstance) {
    if (!this.data.listReady && this.data.cards.length === 0) {
        this._bootstrap();
    }
},

// 改造后
onShow(this: PageInstance) {
    if (!this.data.listReady && this.data.cards.length === 0) {
        // 延迟到下一帧事件循环，确保骨架屏先完成渲染
        // 解决 navigateTo:fail timeout 问题
        setTimeout(() => { this._bootstrap(); }, 0);
    }
},
```

**原理**：`setTimeout(fn, 0)` 将 `_bootstrap` 推入下一个宏任务，让出当前 JS 主线程。微信框架得以在当前 tick 完成 skeleton=true 的 setData 渲染，navigateTo 在超时前确认目标页面已可见。

#### 2. _bootstrap 方法（第 208-219 行）：增加超时兜底

```typescript
// 改造后
async _bootstrap(this: PageInstance) {
    // 超时保护：15 秒后无论接口是否返回都关闭骨架屏
    const timer = setTimeout(() => {
        if (this.data.skeleton) {
            this.setData({ skeleton: false, listReady: true });
        }
    }, 15000);

    try {
        await this.fetchPosts();
    } catch (err) {
        console.error("初始化加载失败:", err);
    } finally {
        clearTimeout(timer);
        this.setData({ skeleton: false, listReady: true });
        this._observeItems();
    }
},
```

**原理**：即使网络极端缓慢或挂起，15 秒后也会关闭骨架屏。此时 cards 为空，wxml 中的 `wx:elif="{{!loading && cards.length === 0}}"` 分支会显示"暂无动态"空态。

## 实现注意事项

- **不改动 wxml/wxss**：骨架屏模板和样式已完整实现，无需修改
- **不改动 data 初始值**：`skeleton: true, listReady: false` 保持不变
- **setTimeout 兼容性**：微信小程序环境完全支持，无需 polyfill
- **超时时间选择**：15 秒足够覆盖绝大多数慢网络场景，同时不会让用户等待过久
- **多次 onShow 防重入**：`listReady` 条件判断已保证只执行一次，setTimeout 不会引入重复调用问题