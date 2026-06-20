---
name: fix-home-navigateTo-blocking
overview: 修复微信小程序首页在 DevTools glass-easel 下 navigateTo 被 JS 线程阻塞的问题，采用强制打断渲染周期 + 冻结 scroll-view + 跳转调度器三重方案
todos:
  - id: add-data-fields
    content: 在 HomeData 接口和 data 初始化中添加 disableScroll 和 _navigating 字段
    status: pending
  - id: refactor-navigate-scheduler
    content: 重构 safeNavigateTo 为 navigateScheduler 方法：实现 disableScroll 冻结 + nextTick + setTimeout(0) + navigateTo + 降级恢复的完整调度链
    status: pending
    dependencies:
      - add-data-fields
  - id: unify-navigation-entry
    content: 将 onSectionMore / onNavigate / onNavigateTo 三个方法统一改为调用 navigateScheduler，移除各自内联的 safeNavigateTo 和栈深检查重复逻辑
    status: pending
    dependencies:
      - refactor-navigate-scheduler
  - id: protect-restore-scroll
    content: 修改 restoreScrollPosition 增加 _navigating 标志判断，导航进行中跳过双 setData 阻塞链
    status: pending
    dependencies:
      - refactor-navigate-scheduler
  - id: update-wxml-scroll-view
    content: 修改 home.wxml 的 scroll-view 元素，将 scroll-y 属性绑定为 {{!disableScroll}} 条件表达式
    status: pending
    dependencies:
      - add-data-fields
  - id: add-lifecycle-reset
    content: 在 onLoad/onShow 中添加 disableScroll 和 _navigating 的重置逻辑，确保页面显示时 scroll-view 可用
    status: pending
    dependencies:
      - refactor-navigate-scheduler
---

## 产品概述

修复微信小程序首页在 DevTools glass-easel 渲染环境下，点击 "More" 按钮后 `navigateTo` 被 JS 线程阻塞导致页面假死的问题。

## 核心功能

- **方案一（核心修复）**：重构 `safeNavigateTo` 方法，使用 `wx.nextTick + setTimeout(0)` 强制跳出当前 glass-easel 渲染周期，打断 render queue 让 JS thread 进入 idle，使 `navigateTo` 真正执行
- **方案二（防阻塞增强）**：新增 `disableScroll` 状态字段，跳转前冻结 scroll-view 防止其继续抢占渲染线程；修改 WXML 中 scroll-view 的 `scroll-y` 绑定为条件控制
- **方案三（工程级调度）**：统一所有跳转入口（onSectionMore / onNavigate / onNavigateTo），封装为带冻结+延时调度的 `navigateScheduler` 方法，替代分散的 safeNavigateTo 调用
- **附加优化**：对 `restoreScrollPosition` 的双 setData 阻塞链增加保护机制，避免在导航即将触发时执行滚动恢复

## 技术栈

- 微信小程序原生框架（TypeScript + WXML + WXSS）
- glass-easel 渲染引擎（DevTools 默认）
- withTheme 行为注入

## 实现方案

### 整体策略：三层防护 + 调度器统一

采用用户提出的三层方案组合实施，形成「强制跳出渲染周期 → 冻结 scroll-view → 统一调度」的完整防护链：

1. **渲染周期打断（最关键）**：将 `navigateTo` 包裹在 `wx.nextTick(() => setTimeout(() => {...}, 0))` 中。原理是 `setTimeout` 会将任务推入宏任务队列，确保在当前微任务队列（含 glass-easel 的同步 render 合并）清空后才执行，此时 JS 线程已 idle
2. **scroll-view 冻结（防抢线程）**：跳转前设 `disableScroll: true`，scroll-view 的 `scroll-y="{{!disableScroll}}"` 立即停止响应滚动事件和渲染更新
3. **统一调度器（工程治理）**：新建 `navigateScheduler` 方法作为唯一跳转出口，内部依次执行：冻结 scroll-view → 保存滚动位置 → nextTick → setTimeout → navigateTo → 失败降级 redirectTo → 延时恢复 scroll-view

### 关键技术决策

- **延时值选择**：setTimeout 使用 0ms（非 30ms），因为 nextTick 已经提供了一个微任务延迟，再加一个宏任务足以打破同步链；0ms 在 DevTools 下比固定值更稳定
- **fail 回调保留**：保留现有的超时检测 + redirectTo 降级逻辑，因为即使跳出渲染周期，极端情况下仍可能失败（如页面栈满）
- **scroll-view 恢复时机**：在 navigateTo success 后不恢复（页面即将离开），仅在 fail/redirectTo 后恢复；同时在 `onShow` 生命周期中统一重置 `disableScroll: false`
- **restoreScrollPosition 保护**：增加 `_navigating` 标志位，当该标志为 true 时跳过 restoreScrollPosition 中的双 setData 操作

### 数据流变更

```
点击 More → onSectionMore
  → navigateScheduler(url)          // 新统一入口
    → setData({ disableScroll:true }) // 冻结 scroll-view
    → saveScrollPosition()            // 保存位置
    → wx.nextTick()
      → setTimeout(0)
        → wx.navigateTo({ url })      // 此时 JS 已 idle
          → success: 正常离开
          → fail:   → isTimeoutError?
                      → 是: console.warn + redirectTo
                      → 否: console.error + redirectTo
                    → setData({disableScroll:false}) // 恢复
```

### 性能与可靠性

- **性能影响**：disableScroll 仅改变一个 boolean 字段，几乎零开销；nextTick + setTimeout(0) 增加约 5-10ms 延迟（用户无感知）
- **向后兼容**：真机上 setTimeout(0) 几乎无效果（真机 JS 线程不会像 DevTools 这样阻塞），不影响现有行为
- **爆炸半径控制**：仅修改 home.ts 和 home.wxml 两个文件，不涉及组件或其他页面

## 架构设计

### 修改范围（仅首页模块）

```
miniprogram/pages/home/
├── home.ts     # [MODIFY] 核心：safeNavigateTo → navigateScheduler 重构
├── home.wxml   # [MODIFY] scroll-view 增加 scroll-y 条件绑定
└── home.wxss   # 无需修改
```

### 关键数据结构变化

HomeData 接口新增字段：

```typescript
// 跳转冻结标志
disableScroll: boolean;       // 控制 scroll-view 是否可滚动
_navigating: boolean;         // 内部标志：是否正在执行导航（保护 restoreScrollPosition）
```

## 目录结构

```
miniprogram/pages/home/
├── home.ts        # [MODIFY] 新增 disableScroll/_navigating data 字段；
                  # 重构 safeNavigateTo 为 navigateScheduler（nextTick+setTimeout 双缓冲）；
                  # onSectionMore/onNavigate/onNavigateTo 统一调用 navigateScheduler；
                  # restoreScrollPosition 增加 _navigating 保护；
                  # onShow 中重置 disableScroll
├── home.wxml      # [MODIFY] scroll-view 的 scroll-y 改为 {{!disableScroll}} 条件绑定
├── home.wxss      # 无修改
└── home.json      # 无修改
```

## 实施注意事项

- **Grounding**：复用现有 `isTimeoutError` 判断逻辑和 `SUBPKG_PAGES` 路径映射，保持与 nav.ts 中 `safeNavigateBack` 相似的防御风格
- **性能热点**：角色切换动画中的 setInterval(100ms, 30次) setData 是另一个潜在阻塞源，但本次不做修改（不在导航路径上）；如果后续仍有问题可考虑在 _navigating 时暂停该定时器
- **日志规范**：沿用已有的 `[nav]` / `[Devtools兼容]` 日志前缀风格，新增 `[nav-scheduler]` 前缀标识调度器日志
- **边界处理**：连续快速点击 More 按钮时，_navigating 标志可防止重复导航；disableScroll 的 true→false 恢复使用 setTimeout(300) 确保在降级场景下有足够时间完成 redirectTo