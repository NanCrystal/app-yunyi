---
name: optimize-sync-page-loading
overview: 综合优化 sync 页面加载性能：延迟数据加载到 onShow、优化跳转重试策略、添加 user-select 属性，彻底解决 navigateTo timeout 问题
todos:
  - id: delay-bootstrap-to-onshow
    content: 改造 sync.ts：将 _bootstrap 从 onLoad 延迟到 onShow 执行，添加 _bootstrapped 防重入标记
    status: completed
  - id: add-user-select-wxml
    content: sync.wxml 所有 card-caption-text 组件添加 user-select="{{true}}" 属性
    status: completed
  - id: optimize-retry-strategy
    content: 优化 home.ts onSectionMore：重试改为 3 次递增延迟(500/1000/1500ms)，添加 loading 提示
    status: completed
---

## 产品概述

优化 sync（动态馆）页面的加载性能，解决从首页点击"最新动态"模块的"更多"按钮跳转时出现的 `navigateTo:fail timeout` 错误。当前表现为：首次跳转报错 timeout，但几秒后页面能正常进入。

## 核心功能

- 优化 sync 页面的 onLoad 初始化时序，将网络数据请求延迟到 onShow 中执行，确保 navigateTo 在页面完成基础渲染前返回成功
- 改进 home.ts 的跳转重试策略，增加重试次数、延长间隔、避免过早降级为 reLaunch
- 为 sync.wxml 中的长文本 text 组件添加 `user-select` 属性，消除开发者工具警告

## 问题根因

**sync.ts 的加载时序问题（核心原因）**：
`withTheme.wrappedOnLoad` 调用后依次执行 `computeTheme().setData()` -> 用户 `onLoad`（getWindowInfo + setData）-> `_bootstrap()`（立即发起 fetchPosts 网络请求）。微信的 `navigateTo` 要求目标页面在一定时间内完成初始渲染并返回就绪信号，但 `_bootstrap` 在 `onLoad` 阶段同步启动了大量异步操作，导致页面初始化阶段过重，超出 navigateTo 内部超时阈值。

**home.ts 重试策略不足**：仅重试 1 次、间隔仅 300ms，第二次失败直接 reLaunch 破坏页面栈。

## 技术栈

- 微信小程序原生开发 (TypeScript + WXML + WXSS + JSON)
- 渲染引擎：WebView（已移除 Skyline）

## 实现方案

### 核心策略：延迟数据加载 + 增强重试机制

#### 1. sync.ts - 将 _bootstrap 从 onLoad 延迟到 onShow

将数据加载逻辑从 `onLoad` 移至 `onShow` 中执行。`navigateTo` 的超时判定基于页面实例化+初始渲染的完成时间。在 `onLoad` 中仅执行轻量的同步初始化（屏幕信息获取、骨架屏状态设置），不发起任何网络请求；等页面已经成功展示后再由 `onShow` 触发数据加载。这样 navigateTo 能在页面完成基础渲染（显示骨架屏）后快速返回成功。

关键改动点：

- `onLoad` 中移除 `_bootstrap()` 调用，仅保留屏幕信息和骨架屏状态初始化
- 新增 `onShow` 方法，在其中调用 `_bootstrap()`，并通过标记位防止重复触发（onShow 每次回到页面都会触发）
- `_bootstrap` 内部添加防重入保护，使用 `_bootstrapped` 标记位确保只执行一次

#### 2. home.ts - 优化跳转重试策略

改进现有的 doNavigate 重试逻辑：

- 最大重试次数从 1 次增加到 3 次
- 重试间隔从固定 300ms 改为递增策略（500ms → 1000ms → 1500ms），给页面更多初始化时间
- 仅在所有重试耗尽后才降级为 reLaunch
- 添加 wx.showLoading 提示，让用户感知到正在跳转

#### 3. sync.wxml - 添加 user-select 属性

为所有包含动态内容的 `<text class="card-caption-text">` 组件添加 `user-select="{{true}}"` 属性。

### 性能预期

修改前后对比：

| 指标 | 修改前 | 修改后 |
| --- | --- | --- |
| navigateTo 成功率 | 低（timeout） | 高（onLoad 即返回） |
| 首屏体验 | 白屏等待 | 骨架屏即时展示 |
| 数据到达时间 | ~2-5s | ~2-5s（不变，但异步） |
| 重试兜底 | 1次→reLaunch | 3次递增延迟→reLaunch |


## 架构设计

```
修改后的时序:

home.onSectionMore → wx.navigateTo(url)
    ↓
sync 页面实例化
    ↓
wrappedOnLoad → computeTheme().setData()   ← 轻量同步
    ↓
userOnLoad → getWindowInfo + setData       ← 轻量同步（无网络请求）
    ↓
【navigateTo 返回 success ✅】              ← 页面已完成基础渲染
    ↓
用户看到骨架屏界面
    ↓
onShow 触发 → _bootstrap()                 ← 异步加载数据
    ↓
fetchPosts 返回 → setData({cards})         ← 列表渲染
```

## 目录结构

```
miniprogram/
├── subpkg/media/pages/sync/
│   ├── sync.ts      # [MODIFY] _bootstrap 从 onLoad 延迟到 onShow，添加防重入保护
│   └── sync.wxml    # [MODIFY] text 组件添加 user-select="{{true}}"
└── pages/home/
    └── home.ts      # [MODIFY] 优化 onSectionMore 重试策略：3次递增延迟重试
```