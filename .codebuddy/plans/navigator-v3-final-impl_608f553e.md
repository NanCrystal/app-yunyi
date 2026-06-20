---
name: navigator-v3-final-impl
overview: 基于 Navigator v3 工业版的最终生产版本实施：创建 utils/useNavigator.ts（无 rAF、三层打断、完整 fallback 链）+ 重构 home.ts（引入 createNavigator、统一3个跳转入口、restoreScrollPosition 防重入保护） + 更新 home.wxml（scroll-view 冻结绑定）
todos:
  - id: create-navigator-util
    content: 新建 miniprogram/utils/useNavigator.ts，基于用户提供的 Navigator v3 生产版代码实现 createNavigator 工厂函数（含 navigate/back/reset/isNavigating 四个方法，三层打断调度链，navigateTo→redirectTo→reLaunch 降级链，栈深预检）
    status: completed
  - id: modify-home-data-fields
    content: 修改 home.ts 的 HomeData 接口和 data 初始化块，新增 disableScroll/_navigating/_navLockTime/_navStateInited 四个字段及默认值，并在 HomePageInstance 类型上声明 navigator 可选属性
    status: completed
  - id: init-navigator-and-lifecycle
    content: 在 home.ts 的 onLoad 中添加 createNavigator(this) 初始化，新增 onShow 生命周期调用 this.navigator?.reset() 重置状态
    status: completed
    dependencies:
      - modify-home-data-fields
  - id: protect-restore-scroll-position
    content: 修改 home.ts 的 restoreScrollPosition 方法，在首行增加 if(this.data._navigating) return; 直接 return 保护，彻底消除双 setData 阻塞源
    status: completed
    dependencies:
      - modify-home-data-fields
  - id: refactor-navigation-entry-methods
    content: 重构 home.ts 的 onSectionMore/onNavigate/onNavigateTo 三个方法：移除内联的 saveScrollPosition/栈深检查/safeNavigateTo 调用，统一改为 this.navigator.navigate(url)；将原 safeNavigateTo 标记为 @deprecated
    status: completed
    dependencies:
      - create-navigator-util
      - modify-home-data-fields
  - id: update-wxml-scroll-view
    content: 修改 home.wxml 第14行 scroll-view 元素，将 scroll-y 属性绑定为 {{!disableScroll}} 条件表达式，实现跳转前物理冻结
    status: completed
    dependencies:
      - modify-home-data-fields
---

## 产品概述

修复微信小程序首页在 DevTools glass-easel 渲染环境下，点击 "More" 等跳转按钮后 `wx.navigateTo` 被 JS 线程阻塞导致页面假死的问题。根因不是 navigateTo 本身不稳定，而是 `restoreScrollPosition` 的双 setData 阻塞链 + scroll-view 大 DOM 将 JS thread 卡死，navigateTo 永远等不到 idle。采用用户提供的 **Navigator v3 工业版** 通用导航工具方案，将"导航"从 UI 线程中剥离为独立调度层。

## 核心功能

1. **新建通用导航工具 `utils/useNavigator.ts`**：`createNavigator(pageCtx)` 工厂函数，返回 `{ navigate, back, reset }` 方法集。内部实现：防重复锁 `_navigating` → 自动调用 `saveScrollPosition()` → `disableScroll` 冻结 scroll-view → 三层打断调度链（`nextTick` 等diff → `setTimeout(16)` 跨帧打断render queue → `setTimeout(0)` 等JS idle）→ `wx.navigateTo` → fail 自动降级链（`redirectTo` → `reLaunch`）→ `complete` 恢复状态
2. **home.ts 引入 createNavigator 并重构**：HomeData 接口新增 `disableScroll / _navigating / _navLockTime / _navStateInited` 字段；`onLoad` 中初始化 `this.navigator = createNavigator(this)`；`onShow` 中调用 `this.navigator?.reset()`
3. **restoreScrollPosition 防重入保护**：首行增加 `if (this.data._navigating) return;` 直接 return，彻底消除双 setData 阻塞源
4. **统一跳转入口**：`onSectionMore / onNavigate / onNavigateTo` 三个方法全部改为 `this.navigator.navigate(url)` 调用，移除各自内联的栈深检查、saveScrollPosition、safeNavigateTo 重复逻辑
5. **WXML scroll-view 冻结**：scroll-view 的 `scroll-y` 属性绑定为 `{{!disableScroll}}` 条件表达式
6. **内置栈深预检**：navigate 方法内或外层包装检查页面栈 >=9 时直接 redirectTo

## 技术约束

- 微信小程序无全局 `requestAnimationFrame` API，必须使用 `setTimeout(fn, 16)` 模拟跨帧
- 项目 TypeScript strict 模式、ES2020 target、CommonJS module
- 日志沿用 `[nav]` 前缀风格
- home.ts 使用 `Page(withTheme({...}))` 行为注入模式
- 现有 `utils/nav.ts` 的 `safeNavigateBack` 保持不变，不在本次修改范围

## 技术栈

- 微信小程序原生框架（TypeScript + WXML + WXSS）
- glass-easel 渲染引擎（DevTools 默认渲染后端）
- withTheme 行为注入模式

## 实现方案

### 整体策略：「治本 + 调度层剥离 + 三层打断 + 统一入口」

**核心架构变化**：从"UI事件直接调 wx.navigateTo（抢线程）"升级为"UI事件 → Navigator调度层 → freeze UI → 跨帧打断render queue → 安全navigateTo → fallback链"

### 方案分层

**第一层 — 新建通用工具 utils/useNavigator.ts**

基于用户提供的最终生产版代码创建 `createNavigator` 工厂函数：

```typescript
type NavigateOptions = {
  replace?: boolean;
  force?: boolean;    // 强制跳转（忽略锁）
  delay?: number;     // 自定义延迟(ms)
};

export function createNavigator(pageCtx: WechatMiniprogram.Page.Instance<any, any>) {
  const ctx = pageCtx;

  // 初始化导航状态字段（幂等，多次调用安全）
  if (ctx.data._navStateInited !== true) {
    ctx.setData({
      disableScroll: false,
      _navigating: false,
      _navLockTime: 0,
      _navStateInited: true,
    });
  }

  function navigate(url: string, options: NavigateOptions = {}) {
    const { force = false, delay = 0 } = options;

    // 防重复：正在导航且非强制时直接返回
    if (ctx.data._navigating && !force) return;

    // 栈深预检：>=9 时直接跳过 navigateTo 用 redirectTo
    const pages = getCurrentPages();
    if (pages.length >= 9) {
      wx.redirectTo({ url });
      return;
    }

    // 自动保存滚动位置（如果页面实例有此方法）
    if (typeof ctx.saveScrollPosition === 'function') {
      ctx.saveScrollPosition();
    }

    // 冻结 scroll-view + 设置导航锁
    ctx.setData({
      disableScroll: true,
      _navigating: true,
      _navLockTime: Date.now(),
    });

    // 核心执行函数
    const run = () => {
      wx.navigateTo({
        url,
        success: () => {},   // 正常离开页面，无需恢复状态
        fail: (err) => {
          console.warn('[Navigator] navigateTo fail:', err);
          // 降级链：redirectTo → reLaunch（终极兜底）
          wx.redirectTo({
            url,
            fail: () => wx.reLaunch({ url }),
          });
          // 降级后需要恢复冻结状态（因为页面没有离开）
          ctx.setData({ disableScroll: false, _navigating: false });
        },
        // 注意：success 时不需要在 complete 里恢复，
        // 因为页面即将离开；仅 fail 时在上面已手动恢复
      });

      // 安全网：超时后强制恢复（防止 complete 不触发）
      setTimeout(() => {
        if (ctx.data._navigating) {
          ctx.setData({ disableScroll: false, _navigating: false });
        }
      }, 3000);
    };

    // 三层打断调度链（无 rAF，小程序兼容版）
    // nextTick: 等 setData diff 完成
    // setTimeout(16): 跨一帧，打断 render queue
    // setTimeout(delay/0): 等 JS queue 清空后执行
    wx.nextTick(() => {
      setTimeout(() => {
        setTimeout(run, delay);
      }, 16);
    });
  }

  /** 安全返回上一页 */
  function back(fallbackUrl: string = '/pages/index/index') {
    const pages = getCurrentPages();
    if (pages.length <= 1) {
      wx.reLaunch({ url: fallbackUrl });
      return;
    }
    wx.navigateBack();
  }

  /** 重置所有导航状态（onShow 时调用） */
  function reset() {
    ctx.setData({
      disableScroll: false,
      _navigating: false,
    });
  }

  /** 查询是否正在导航 */
  function isNavigating(): boolean {
    return !!ctx.data._navigating;
  }

  return { navigate, back, reset, isNavigating };
}
```

**第二层 — home.ts 改造**

改造点清单：

| 序号 | 改造项 | 具体内容 |
| --- | --- | --- |
| 1 | HomeData 接口新增 | `disableScroll: boolean; _navigating: boolean; _navLockTime: number; _navStateInited: boolean;` |
| 2 | data 初始化 | 四个新字段设默认值：`disableScroll: false, _navigating: false, _navLockTime: 0, _navStateInited: false` |
| 3 | 实例类型扩展 | `HomePageInstance` 类型声明新增 `navigator: ReturnType<typeof createNavigator>` 可选属性 |
| 4 | onLoad 初始化 | 在 onLoad 末尾添加 `this.navigator = createNavigator(this);` |
| 5 | 新增 onShow | `onShow() { this.navigator?.reset(); }` （注意：不做 scrollTop 的 setData） |
| 6 | restoreScrollPosition 保护 | 首行添加 `if (this.data._navigating) return;` |
| 7 | safeNavigateTo 废弃 | 保留原方法体但注释标记为 `@deprecated`，内部改为调用 `this.navigator?.navigate(url)` 或直接删除 |
| 8 | isTimeoutError 保留 | 作为独立工具函数保留（后续整合 nav.ts 时可迁移到 useNavigator） |
| 9 | onSectionMore 重构 | 移除内联的 saveScrollPosition + 栈深检查 + safeNavigateTo，改为单行 `this.navigator.navigate(url)` |
| 10 | onNavigate 重构 | 同上 |
| 11 | onNavigateTo 重构 | 同上 |
| 12 | onPlayAudio 不变 | 使用 reLaunch，不经过 navigator |


**第三层 — home.wxml 改造**

将第14行 scroll-view 的 `scroll-y` 属性从硬编码改为条件绑定：

```
<scroll-view scroll-y="{{!disableScroll}}" ... >
```

### 关键技术决策

| 决策项 | 选择 | 理由 |
| --- | --- | --- |
| 三层打断 | `nextTick → setTimeout(16) → setTimeout(0)` | 小程序无全局 rAF，16ms 约等于一帧时长，足以跨 frame 打断 render queue |
| 栈深预检位置 | 内置于 navigate 方法 | 统一逻辑避免各入口遗漏，且在 _navigating 锁之后、setData 之前，开销最低 |
| complete 回调策略 | 不用 complete 统一恢复 | success 时页面即将离开无需恢复；fail 时在 fail 回调内手动恢复；避免 complete 与 fail 双重触发导致的状态竞态 |
| restoreScrollPosition 保护 | `if (_navigating) return;` 直接 return | 彻底消除双 setData 阻塞源，不做任何 setData 操作 |
| _navStateInited 幂等初始化 | createNavigator 内部检测并初始化 | 即使被多次调用也不会覆盖已有状态；data 中默认值作为兜底 |
| safeNavigateTo 处理 | 废弃但保留方法签名 | 避免其他地方可能有外部引用；内部委托给 navigator |


### 数据流

```
点击 "More"
  → onSectionMore(e)
    → const key = e.detail.key
    → const url = SUBPKG_PAGES[key] || `/pages/${key}/${key}`
    → this.navigator.navigate(url)       // 唯一入口

navigate(url) 内部流程:
  ├── _navigating && !force → return     // 防重复
  ├── pages.length >= 9 → redirectTo     // 栈深预检
  ├── ctx.saveScrollPosition?.()         // 自动保存滚动位置
  ├── setData({disableScroll:true,       // 冻结 scroll-view
  │         _navigating:true,
  │         _navLockTime:Date.now()})
  ├── wx.nextTick()                      // [L1] 等 setData diff flush
  │   └── setTimeout(() => {             // [L2] 跨一帧 (16ms)
  │       └── setTimeout(run, delay)     // [L3] 等 JS idle
  │           └── wx.navigateTo({ url })
  │               ├── success → 页面离开 ✓
  │               └── fail → redirectTo → reLaunch
  │                   └── setData恢复冻结
  └── return                             // 异步执行，不阻塞

restoreScrollPosition() 被 initData/onShow 调用时:
  ├── if (_navigating) return;           // [核心修复] 导航中直接返回
  ├── saved = app.globalData.homeScrollTop
  └── setData({scrollTop:saved+1})       // 正常路径不变
        → nextTick → setData({saved})

页面返回首页时:
  → onShow()
    → this.navigator?.reset()
      → setData({disableScroll:false, _navigating:false})
```

## 目录结构

```
miniprogram/
├── utils/
│   ├── useNavigator.ts                  # [NEW] Navigator v3 工业版通用导航工具
│   └── nav.ts                           # [UNCHANGED] safeNavigateBack 保持不变（第二阶段再整合）
├── pages/
│   └── home/
│       ├── home.ts                      # [MODIFY] 引入 createNavigator + 重构导航方法 + restoreScrollPosition保护
│       ├── home.wxml                    # [MODIFY] scroll-view scroll-y="{{!disableScroll}}"
│       ├── home.wxss                    # [UNCHANGED]
│       └── home.json                    # [UNCHANGED]
└── ...                                  # 其余文件不受影响
```

## 实施注意事项

- **Grounding**: 完全基于现有项目结构。复用 `isTimeoutError` 判断逻辑（保留在 home.ts）、`SUBPKG_PAGES` 路径映射、`saveScrollPosition` 方法签名、`app.globalData.homeScrollTop` 全局存储机制。日志沿用 `[nav]` / `[Navigator]` / `[DevTools兼容]` 前缀风格
- **rAF 兼容性**: 已确认微信小程序环境无可全局用的 `requestAnimationFrame`（仅在 Canvas 实例方法上存在），必须用 `setTimeout(fn, 16)` 替代。这也是用户明确要求的最终版写法
- **性能影响**: `disableScroll` 仅改变一个 boolean（接近零开销）；完整三层调度链增加约 20-30ms 延迟（用户完全无感知）；真机上各层延时几乎立即执行（真机 JS 线程不会像 DevTools 这样阻塞），不影响线上体验
- **withTheme 兼容性**: `Page(withTheme({...}))` 模式中，`onLoad` / `onShow` / `setData` 等生命周期和方法均正常可用，createNavigator 通过 `pageCtx`（即 `this`）操作页面实例，与 withTheme 无冲突
- **角色切换动画**: `onCharTap` 中的 `setInterval(100ms, 30次)` setData 动画是独立流程，_navigating 标志不影响它。如果后续发现角色切换期间点击 More 也卡死，可在 navigateScheduler 中加 clearInterval 逻辑（本次不加）
- **complete 回调陷阱**: 微信小程序中 `success/fail` 和 `complete` 是互斥关系（2.1.0+ 基础库），但为保险起见不在 complete 中做状态恢复，而是在 fail 分支和超时安全网中分别处理
- **爆炸半径控制**: 本次仅新建 useNavigator.ts + 修改 home.ts/home.wxml 两个文件，不涉及组件、其他页面、现有 nav.ts
- **边界 case 处理**:
- `onPlayAudio`: 使用 `reLaunch` 到 audio 页（Skyline 渲染要求），不走 navigator，不受影响
- `onGoIndex`: 使用 `reLaunch` 到 index 页，不走 navigator，不受影响
- `previewImage` / `previewVideo`: 微信原生 API，不走 navigator，不受影响
- 连续快速点击 More: `_navigating` 锁天然防止多次导航
- 页面栈满(>=9): 内置预检自动降级为 redirectTo

## Agent Extensions

### SubAgent

- **code-explorer**
- Purpose: 对当前项目进行了全面的代码探索，包括：扫描全部10个页面目录中的导航调用现状、确认 requestAnimationFrame API 支持情况（结论：不可用）、分析 utils/ 目录工具函数风格规范、评估各页面的 scroll-view + DOM 复杂度
- Expected outcome: 产出完整的可行性评估报告，为方案提供以下关键事实依据：(1) 全局 rAF 不可用必须用 setTimeout(16)替代 (2) 8/10 页面使用 scroll-view 说明通用工具有复用价值 (3) 当前存在三种导航风格并存(safeNavigateBack/safeNavigateTo/直接wx.*)需统一 (4) photos/videos 为潜在的高危页面未来也可受益