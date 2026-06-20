---
name: fix-home-navigateTo-blocking-v2
overview: 工业级修复：以 restoreScrollPosition 双 setData 阻塞源治理为核心，配合三层打断(nextTick→rAF→setTimeout)的 navigateScheduler + scroll-view 物理冻结 + 强制 flush 机制，彻底解决 DevTools glass-easel 下 JS 线程卡死导致 navigateTo 无法执行的问题
todos:
  - id: add-data-fields
    content: 在 HomeData 接口添加 disableScroll/_navigating 字段并在 data 初始化中设默认值 false
    status: pending
  - id: refactor-navigate-scheduler
    content: 将 safeNavigateTo 重构为 navigateScheduler：实现强制 flush(flushNextTick) + disableScroll 冻结 + saveScrollPosition + 三层打断(nextTick→setTimeout(16)→setTimeout(0)) + navigateTo + fail 降级 redirectTo + 恢复 disableScroll 的完整调度链
    status: pending
    dependencies:
      - add-data-fields
  - id: unify-navigation-entry
    content: 将 onSectionMore/onNavigate/onNavigateTo 三个方法统一改为调用 navigateScheduler，移除各自内联的 safeNavigateTo 调用和栈深检查重复逻辑（栈深预检内置于 scheduler）
    status: pending
    dependencies:
      - refactor-navigate-scheduler
  - id: protect-restore-scroll
    content: 修改 restoreScrollPosition 方法首行增加 if(this.data._navigating) return; 直接 return 跳过双 setData 阻塞链
    status: pending
    dependencies:
      - add-data-fields
  - id: update-wxml-scroll-view
    content: 修改 home.wxml 第14行 scroll-view 的 scroll-y 属性绑定为 {{!disableScroll}} 条件表达式
    status: pending
    dependencies:
      - add-data-fields
  - id: add-lifecycle-reset
    content: 新增 onShow 生命周期方法，内部重置 disableScroll:false 和 _navigating:false（注意不做 setData scrollTop 避免重新触发 render chain）
    status: pending
    dependencies:
      - refactor-navigate-scheduler
---

## Product Overview

修复微信小程序首页在 DevTools glass-easel 渲染环境下，点击 "More" 等跳转按钮后 `navigateTo` 被 JS 线程阻塞导致页面假死的问题。根因不是 navigateTo 本身不稳定，而是 `restoreScrollPosition` 的双 setData 阻塞链 + scroll-view 大 DOM 把 JS thread 卡死，navigateTo 永远等不到 idle。

## Core Features

**根因排序（按影响程度）**：

1. **核心阻塞源（必须修）**：`restoreScrollPosition()` 中 `setData(scrollTop+1) → nextTick → setData(saved)` 双 setData 触发 layout 重算 2 次 + scroll-view 强制 reflow + render queue 延迟释放，这是最高概率"锁死 JS idle"的原因
2. **次要阻塞源**：scroll-view + swiper + 多 template + video 组件导致渲染线程长期 busy
3. **被阻塞者**：navigateTo 本身没有问题，只是永远等不到 idle

**方案内容（工业级跳转调度器 v2）**：

- **三层打断机制**（增强版 navigateScheduler）：`nextTick(等 setData flush) → requestAnimationFrame(等 render flush) → setTimeout(0, 等 JS queue 清空)` 三层缓冲确保 JS thread 真正 idle 后才执行 navigateTo
- **强制 flush 前置**：调度器入口处先执行 `wx.nextTick(resolve)` Promise 化等待，强制刷出当前 setData 队列
- **scroll-view 物理冻结**：新增 `disableScroll` 字段，WXML 中 `scroll-y="{{!disableScroll}}"`，跳转前冻结防止继续触发 layout 和 gesture pipeline
- **restoreScrollPosition 直接 return 保护**：新增 `_navigating` 标志位，导航进行中直接 return 跳过双 setData 阻塞链（这是最关键的修复点）
- **统一跳转入口**：`onSectionMore / onNavigate / onNavigateTo` 三个方法全部改为调用 `navigateScheduler`，消除各自内联的栈深检查和 safeNavigateTo 重复逻辑，避免不同入口行为不一致
- **生命周期重置**：`onShow` 中重置 `disableScroll: false` 和 `_navigating: false`，且不在 onShow 中 setData scrollTop（避免重新触发 render chain）
- **降级恢复**：fail 回调中 redirectTo 降级后延时恢复 disableScroll，超时类错误保留特殊日志

## Tech Stack

- 微信小程序原生框架（TypeScript + WXML + WXSS）
- glass-easel 渲染引擎（DevTools 默认）
- withTheme 行为注入

## Implementation Approach

### 整体策略：「先治本、再打断、最后兜底」三阶防护

**第一阶 -- 治本（消除阻塞源）**：对 `restoreScrollPosition` 加 `_navigating` 标志直接 return 保护，彻底阻止导航期间的双 setData 阻塞链执行。这是用户确认的最高优先级修复点。

**第二阶 -- 打断（强制空闲）**：重构 `safeNavigateTo` 为 `navigateScheduler`，采用「强制 flush → 冻结 scroll-view → 三层延时 → navigateTo」的完整调度链：

1. 入口先 `new Promise(r => wx.nextTick(r))` 强制等当前 setData flush
2. `setData({ disableScroll: true, _navigating: true })` 物理冻结 scroll-view
3. `wx.nextTick` 等待冻结生效（微任务层）
4. `requestAnimationFrame` 等待渲染帧完成（渲染层）
5. `setTimeout(0)` 等待 JS 空闲（宏任务层）
6. 执行 `wx.navigateTo`
7. fail 时 `redirectTo` 降级 + 恢复 disableScroll

**第三阶 -- 兜底（工程治理）**：统一三个跳转方法为单入口调用 navigateScheduler，内置页面栈深度预检（>=9 时直接 redirectTo），消除分散逻辑带来的不一致风险。

### 关键技术决策

| 决策项 | 选择 | 理由 |
| --- | --- | --- |
| 三层打断 | nextTick → rAF → setTimeout(0) | 用户明确要求；rAF 在小程序中通过 `setTimeout(() => {...}, 16)` 模拟（小程序无原生 rAF API） |
| 强制 flush | await new Promise(r => wx.nextTick(r)) | 确保 navigateScheduler 调用前的 setData 已 flush，避免 setData 与 navigateTo 竞争 |
| restoreScrollPosition 保护 | if (_navigating) return; | 直接 return 而非条件跳过，彻底消除阻塞源 |
| rAF 替代方案 | setTimeout(fn, 16) | 微信小程序环境无原生 requestAnimationFrame，16ms 约等于一帧时长 |
| disableScroll 恢复时机 | fail 回调内 + onShow 生命周期 | success 时页面即将离开无需恢复；fail/redirectTo 降级时需恢复；onShow 作为安全网 |


### 数据流

```
点击 More → onSectionMore(key)
  → navigateScheduler(url)              // 统一入口
    ├── 页面栈 >= 9 ? redirectTo(url)   // 栈深预检，直接返回
    ├── saveScrollPosition()            // 保存位置到全局
    ├── setData({disableScroll:true, _navigating:true})  // 冻结 scroll-view
    ├── await new Promise(r => wx.nextTick(r))           // [新增] 强制 flush
    ├── wx.nextTick(() =>
    │     setTimeout(() => {           // [增强] 模拟 rAF (16ms)
    │       setTimeout(() => {         // 宏任务，等 JS idle
    │         wx.navigateTo({ url,
    │           success: () => {},     // 页面离开，不恢复
    │           fail: (err) => {
    │             isTimeoutError(err) ?
    │               console.warn(...) : console.error(...)
    │             wx.redirectTo({ url })
    │             setTimeout(() => this.setData({disableScroll:false}), 300)  // 降级后恢复
    │           }
    │         })
    │       }, 0)
    │     }, 16))
    └── return                          // 异步执行
```

```
restoreScrollPosition()                  // 被 initData/onShow 调用时
  ├── if (_navigating) return;          // [核心] 导航中直接跳过双setData
  ├── saved = app.globalData.homeScrollTop
  └── setData({scrollTop:saved+1})      // 正常路径不变
        → nextTick → setData({saved})
```

## Architecture Design

### 修改范围（仅首页模块 2 个文件）

```
miniprogram/pages/home/
├── home.ts     # [MODIFY] 核心：数据字段 + navigateScheduler + restoreScrollPosition保护 + 统一入口 + 生命周期重置
├── home.wxml   # [MODIFY] scroll-view scroll-y 条件绑定
├── home.wxss   # 无修改
└── home.json   # 无修改
```

### 关键数据结构变化

HomeData 接口新增 2 个字段：

```typescript
interface HomeData {
  // ...现有字段...
  disableScroll: boolean;   // 控制 scroll-view 是否可滚动（跳转前冻结）
  _navigating: boolean;     // 内部标志：是否正在执行导航（保护 restoreScrollPosition）
}
```

## Implementation Notes

- **Grounding**：完全基于现有代码结构，复用 `isTimeoutError`、`SUBPKG_PAGES`、`saveScrollPosition` 等已有逻辑；日志沿用 `[nav]` / `[nav-scheduler]` / `[DevTools兼容]` 前缀风格
- **rAF 兼容性**：微信小程序无原生 `requestAnimationFrame`，使用 `setTimeout(fn, 16)` 模拟，16ms 约 60fps 单帧时长，在小程序环境下等效
- **连续点击防御**：`_navigating` 标志位天然防止快速重复点击导致的多次导航；如需更严格可外加时间戳 debounce（本次不加，保持简洁）
- **性能影响**：disableScroll 仅改变一个 boolean（零开销）；完整调度链增加约 20-30ms 延迟（用户无感知）；真机上各层延时几乎立即执行（不会像 DevTools 这样阻塞），不影响体验
- **角色切换动画兼容**：`onCharTap` 中的 setInterval(100ms, 30次) setData 不在本次修改范围；但 _navigating 标志不影响该动画（它是独立流程）。如果后续发现角色切换期间点击 More 也卡死，可在 navigateScheduler 中加 `clearInterval` 逻辑
- **爆炸半径控制**：仅改 home.ts 和 home.wxml，不影响其他页面、组件、工具函数
- **边界 case**：`onPlayAudio` 使用 `reLaunch` 不走 navigateScheduler（reLaunch 不受此问题影响）；`previewImage` 是微信原生 API 也不受影响