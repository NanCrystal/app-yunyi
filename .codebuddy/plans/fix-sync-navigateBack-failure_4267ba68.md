---
name: fix-sync-navigateBack-failure
overview: 修复 sync 子页面返回失败的问题：将 safeNavigateBack 升级为与 Navigator v3 兼容的安全返回机制，并可选地为 sync 页面引入 createNavigator 实现统一导航调度
todos:
  - id: add-typing-nav-redirected
    content: "在 typings/index.d.ts 的 IAppOption.globalData 中新增 _navRedirectedFrom?: string 字段声明"
    status: completed
  - id: enhance-navigator-fail-marking
    content: 修改 useNavigator.ts 的 navigate() 方法 fail 回调：在执行 redirectTo 前记录 app.globalData._navRedirectedFrom 为当前页面路由；同时在栈深预检（>=9 直接 redirectTo）处也加相同标记
    status: completed
  - id: enhance-safenavigateback-re-launch
    content: "修改 nav.ts 的 safeNavigateBack()：入口处优先检测 _navRedirectedFrom 标记，若存在则 delete 标志后使用 wx.reLaunch({url: HOME}) 返回首页；同时修改栈深"
    status: completed
    dependencies:
      - add-typing-nav-redirected
---

## 产品概述

修复 sync 子页面（及所有通过 Navigator v3 跳转的子页面）在 DevTools glass-easel 下因 `navigateTo` 被阻塞降级为 `redirectTo` 后，点击返回按钮无法回到首页的问题。

## 核心功能

**故障链（已确认）**：

```
home.navigator.navigate('/pages/sync/sync')
  → DevTools glass-easel 阻塞 navigateTo
  → useNavigator.ts fail 回调触发
  → 降级为 redirectTo('/pages/sync/sync')   ← 关键：redirectTo 替换了 home！
  → 页面栈: [sync]（home 被销毁）
  → 用户点返回 → safeNavigateBack()
  → navigateBack 失败（栈中无 home）
  → 兜底 redirectTo('/pages/home/home')
  → home 全新加载，滚动位置和状态全部丢失 ❌
```

**修复方案（3 个文件）**：

1. **useNavigator.ts fail 增强标记**：降级为 `redirectTo` 前，在 `app.globalData` 记录来源页面路由（`_navRedirectedFrom`），让目标页知道自己"替换了父页面"
2. **nav.ts safeNavigateBack 感知标记**：检测到 `_navRedirectedFrom` 时，使用 `reLaunch(HOME)` 替代 `navigateBack/redirectTo`。`reLaunch` 销毁所有页面后重建首页，全局状态（`homeScrollTop`、`selectedCharId` 等）保留不变，首页 `onLoad→onShow` 完整生命周期可恢复滚动位置和导航状态
3. **typings 类型声明**：在 `IAppOption.globalData` 中添加 `_navRedirectedFrom` 字段类型定义

## 技术栈

- 微信小程序原生框架（TypeScript + WXML + WXSS）
- glass-easel 渲染引擎（DevTools 默认）
- Navigator v3 工业版（已部署的 useNavigator.ts）
- safeNavigateBack 导航返回工具（nav.ts）

## 实现方案

### 核心策略：「标记-感知-重启动」三步修复

**问题本质**：`redirectTo` 破坏了页面栈结构（父页面被替换而非保留），导致子页面无法通过 `navigateBack` 返回。

**解决思路**：不改变 redirectTo 的降级策略（它在 DevTools 下是最可靠的跳转方式），而是让"返回路径"感知到这种异常进入方式，自动切换到 `reLaunch` 返回。

**为什么用 reLaunch 而非 redirectTo 返回首页**：

| 对比项 | redirectTo(HOME) | reLaunch(HOME) |
| --- | --- | --- |
| 页面栈效果 | 替换当前页(sync→home) | 销毁全部，只留 home |
| home 触发 | onShow（可能不走 onLoad） | **onLoad + onShow（完整生命周期）** |
| 滚动位置 | restoreScrollPosition 可能不被调用（无 onLoad） | **onLoad→initData→restoreScrollPosition 正常执行** |
| 全局状态 | 保留 | **保留（微信官方文档确认）** |
| 导航器状态 | navigator 可能未初始化 | **onLoad 重新 createNavigator + onShow reset()** |


### 数据流（修复后）

```
正常路径（navigateTo 成功）：
home → navigateTo → sync     [栈: home, sync]
sync → safeNavigateBack → navigateBack → 回到 home  ✓

异常路径（navigateTo 阻塞，修复后）：
home → navigator.navigate('/pages/sync/sync') → navigateTo 被阻塞
  → fail 回调: app.globalData._navRedirectedFrom = 'pages/home/home'
  → redirectTo('/pages/sync/sync')    [栈: sync, home 已被替换]
  → 用户点返回: safeNavigateBack()
  → 检测到 _navRedirectedFrom 存在!
  → delete _navRedirectedFrom（清理）
  → reLaunch('/pages/home/home')        [销毁 sync，重建 home]
  → home.onLoad → createNavigator + initData + restoreScrollPosition(读 homeScrollTop)
  → home.onShow → navigator.reset()
  → 滚动位置恢复 ✓ 状态保留 ✓
```

### 关键技术决策

| 决策项 | 选择 | 理由 |
| --- | --- | --- |
| 标记存储 | `app.globalData._navRedirectedFrom` | 全局共享、reLaunch 不清零、无需额外存储 |
| 返回方式 | `reLaunch` 而非 `redirectTo` | 确保 home 完整生命周期（onLoad+onShow）以恢复所有状态 |
| 标记清理 | 消费时立即 `delete` | 防止后续正常跳转误判 |
| 修改范围 | 仅 3 个文件（useNavigator + nav + typings） | 最小爆炸半径 |


## 目录结构

```
miniprogram/
├── utils/
│   ├── useNavigator.ts              # [MODIFY] fail 回调增加 _navRedirectedFrom 标记
│   └── nav.ts                       # [MODIFY] safeNavigateBack 增加 redirectTo 检测 + reLaunch 兜底
├── typings/
│   └── index.d.ts                   # [MODIFY] IAppOption.globalData 增加 _navRedirectedFrom
├── pages/
│   ├── home/home.ts                 # [NO CHANGE] 已有 restoreScrollPosition / onShow reset 可正确处理 reLaunch
│   └── sync/sync.ts                # [NO CHANGE] safeNavigateBack 无需改动（逻辑在 nav.ts 内）
```