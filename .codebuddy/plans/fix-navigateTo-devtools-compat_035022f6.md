---
name: fix-navigateTo-devtools-compat
overview: 简化方案：保留现有 navigateTo→redirectTo 降级逻辑，优化子页面 onGoBack 在 reLaunch 到 home 时自动恢复滚动位置，无需复杂重试机制
todos:
  - id: add-nav-utils
    content: 在 home.ts 中新增 isTimeoutError 辅助函数和 safeNavigateTo 统一导航封装函数
    status: completed
  - id: refactor-navigate-methods
    content: 重构 onNavigate、onSectionMore、onNavigateTo 三个方法使用 safeNavigateTo，保留各自特有的 saveScrollPosition 和页面栈预检查逻辑
    status: completed
    dependencies:
      - add-nav-utils
---

## 产品概述

修复微信小程序在开发者工具中使用 glass-easel 新渲染框架时，`navigateTo` 容易触发 timeout 导致降级为 `redirectTo`，进而使子页面（如 sync）返回按钮无法正常回到上一页的问题。核心思路：**不引入重试机制（DevTools 超时可能持续存在），接受 `redirectTo` + 子页面 `reLaunch` 兜底的降级链路，确保滚动位置通过 `globalData` 正确恢复**。

## 核心功能

- **保留现有降级链路不变**：navigateTo timeout → redirectTo → navigateBack 失败 → reLaunch 到 home
- **确保 DevTools 体验平滑**：reLaunch 后 home 页面能从 `app.globalData.homeScrollTop` 恢复滚动位置（此链路已存在于代码中）
- **增加 DevTools 感知的日志提示**：让开发者明确知晓当前处于降级路径，而非静默失败
- **真机零影响**：真机不会触发超时，所有新增逻辑仅在 DevTools 的 fail 回调中生效

## 已有基础设施（无需修改，已验证完整）

| 功能 | 位置 | 状态 |
| --- | --- | --- |
| `saveScrollPosition()` 保存滚动位置到 globalData | home.ts:682-684 | ✓ |
| `restoreScrollPosition()` 从 globalData 恢复 | home.ts:687-698 | ✓ |
| `homeScrollTop` 类型声明 | typings/index.d.ts:24 | ✓ |
| onSectionMore 导航前调用 saveScrollPosition | home.ts:718 | ✓ |
| sync.onGoBack reLaunch 兜底 | sync.ts:165-173 | ✓ |
| home initData 完成后调用 restoreScrollPosition | home.ts:390 | ✓ |


## 需要改动的点

1. **home.ts 导航方法**：3 个导航方法 (`onNavigate`, `onSectionMore`, `onNavigateTo`) 的 navigateTo fail 回调中增加 DevTools 友好的日志和注释说明
2. **统一导航工具函数**：提取通用的 `safeNavigateTo` 封装，内含超时错误识别 + redirectTo 降级 + 明确的 console 提示，被三个方法复用

## Tech Stack

- 微信小程序原生框架（TypeScript）
- 目标文件：`miniprogram/pages/home/home.ts`

## 实现思路

### 核心策略：接受降级链路 + 增强可观测性

用户已确认：**不做重试机制**。DevTools 中 glass-easel 的 navigateTo 超时可能是持续性的，重试无意义。方案聚焦于：

1. **保持现有 redirectTo 降级**——当 navigateTo 失败时直接 redirectTo
2. **依赖已有的 reLaunch 兜底**——sync 等子页面的 onGoBack 已有 navigateBack → reLaunch 降级
3. **增强日志可观测性**——让开发者在控制台清晰看到降级路径的每一步，而不是困惑"为什么跳转了但回不去"

### 架构设计

```
home.ts 内部改造：

用户点击导航
    ↓
saveScrollPosition()  ← 已有，保存当前滚动位置
    ↓
wx.navigateTo(url)
    ├─ 成功 → 子页面打开，navigateBack 可正常返回 ✓（真机常态）
    └─ 失败（DevTools 超时）
         ↓
    判断错误类型（isTimeoutError）
         ↓
    wx.redirectTo(url) ← 替换当前页面（home 出栈）
         ↓
    子页面（sync）打开
    用户点击返回按钮
         ↓
    wx.navigateBack()
         ├─ 成功 ← 不可能（home 已被替换）
         └─ 失败
              ↓
         wx.reLaunch('/pages/home/home')  ← 已有兜底
              ↓
         home.onLoad → initData() → restoreScrollPosition()
              ↓
         滚动位置恢复 ✓
```

### 改动范围

| 文件 | 改动类型 | 说明 |
| --- | --- | --- |
| `miniprogram/pages/home/home.ts` | [MODIFY] | 新增 `isTimeoutError` 辅助函数；提取 `safeNavigateTo` 统一封装导航+降级逻辑；重构 `onNavigate`、`onSectionMore`、`onNavigateTo` 三个方法使用新函数 |
| `miniprogram/pages/sync/sync.ts` | 无需改动 | 已有 reLaunch 兜底逻辑完全适用 |


### 实施要点

1. **`isTimeoutError(err)` 辅助函数**：判断 errMsg 是否包含 'timeout' / '超时' 关键字，用于区分「DevTools 超时」与「真正的页面栈满等错误」

2. **`safeNavigateTo(url, options?)` 工具函数**：

- 接收目标 URL 和可选配置 `{ saveScrollBefore?: boolean }`
- 内部执行 navigateTo
- fail 时根据 isTimeoutError 分支：
    - **超时类**：console.warn `[DevTools兼容] navigateTo 超时，降级为redirectTo，子页面返回将通过 reLaunch 恢复`，然后 redirectTo
    - **其他错误**：console.error 后 redirectTo
- 不做重试（按用户要求）

3. **三个方法重构**：

- `onNavigate`：`safeNavigateTo(url)` —— 简单场景无需保存滚动位置
- `onSectionMore`：先 `saveScrollPosition()`，再 `safeNavigateTo(url, { saveScrollBefore: true })`
- `onNavigateTo`：`safeNavigateTo(url)` —— 与 onNavigate 一致

4. **页面栈预检查保留**：现有的 `pages.length >= 9` 直接 redirectTo 的逻辑不变，放在 safeNavigateTo 调用之前

5. **日志分级**：超时降级用 `console.warn`（开发信息），真正的错误用 `console.error`