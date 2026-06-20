/**
 * Navigator v3 Final Patch — 核心导航引擎
 *
 * 核心职责：
 * 1. 注入 pageCtx 实现 UI 能力（setData 冻结、saveScrollPosition、_navigating 锁）
 * 2. navigate: saveScrollPosition → 冻结 UI → 双层打断 → wx.navigateTo → fallback 只标记
 * 3. safeBack: 检测 fallback 栈 → reLaunch HOME / 正常 navigateBack
 *
 * 封板决策（Final Patch）：
 * - saveScrollPosition 在 navigateTo 之前调用（"离开前状态"）
 * - 打断层: nextTick + setTimeout(0) 双层（砍掉 16ms 过度工程）
 * - fallback 只标记 navStore.pushFallback(url)，不触发任何跳转
 * - fail 时 showToast 给用户最小感知
 * - safeBack 统一检测 fallbackStack → reLaunch(HOME)
 */

import { navStore } from './store';
import type { NavState, NavigateOptions, INavigator } from './types';

/** 首页路径（统一返回目标） */
const HOME = '/pages/home/home';

/** 最大页面栈深度（微信限制 10 页） */
const MAX_STACK_DEPTH = 9;

/**
 * 封装 wx.navigateTo 为 Promise
 */
function wxNavigateTo(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    wx.navigateTo({
      url,
      success: () => resolve(),
      fail: (err) => reject(err),
    });
  });
}

/**
 * Navigator 引擎（核心类）
 *
 * 持有 pageCtx 引用，提供 navigate / safeBack / reset / isNavigating 四个方法
 */
export class NavigatorEngine {
  constructor(private ctx: WechatMiniprogram.Page.Instance<any, any>) {
    // 幂等初始化页面级导航状态字段
    if (ctx.data._navStateInited !== true) {
      ctx.setData({
        disableScroll: false,
        _navigating: false,
        _navLockTime: 0,
        _navStateInited: true,
      });
    }
  }

  /**
   * 🔥 核心导航方法（Final Patch 版）
   *
   * 执行顺序（封板）：
   * 1. 防重复锁检查 (_navigating)
   * 2. 栈深预检 (>=9 → 直接 redirectTo)
   * 3. saveScrollPosition（先保存！离开前状态）
   * 4. 冻结 scroll-view (_navigating=true, disableScroll=true)
   * 5. 双层打断调度:
   *    - L1 nextTick: 等 setData diff flush
   *    - L2 setTimeout(0): 等 JS queue 清空
   * 6. 执行 wx.navigateTo
   * 7. success → 正常离开（无需恢复，新页会接管）
   * 8. fail → 只标记 fallback + showToast（不跳转！）
   */
  navigate(url: string, options: NavigateOptions = {}): void {
    const { force = false, delay = 0 } = options;

    // 1. 防重复：正在导航且非强制时忽略
    if (this.ctx.data._navigating && !force) {
      console.warn('[Navigator] 导航进行中，忽略重复跳转:', url);
      return;
    }

    // 2. 栈深预检：>=9 时直接用 redirectTo（避免超时风险）
    const pages = getCurrentPages();
    if (pages.length >= MAX_STACK_DEPTH) {
      console.warn(`[Navigator] 页面栈已满(${pages.length}>=${MAX_STACK_DEPTH})，降级 redirectTo:`, url);
      navStore.pushFallback(url);
      wx.redirectTo({ url });
      return;
    }

    // 3. 🔑 先保存滚动位置（"离开前状态"，在 navigateTo 之前！）
    if (typeof (this.ctx as any).saveScrollPosition === 'function') {
      (this.ctx as any).saveScrollPosition();
    }

    // 4. 冻结 scroll-view + 设置导航锁
    this.ctx.setData({
      disableScroll: true,
      _navigating: true,
      _navLockTime: Date.now(),
    });

    // 核心执行函数
    const doNavigate = () => {
      console.log('[Navigator] 执行 navigateTo:', url);

      wxNavigateTo(url)
        .then(() => {
          // success → 页面正常跳转离开
          // 无需恢复 disableScroll/_navigating（当前页即将卸载或进入后台）
          console.log('[Navigator] navigateTo success:', url);
        })
        .catch((err) => {
          // fail → ⚠️ 只标记 fallback，不触发任何跳转！（Final Patch 核心约束）
          const msg = (err?.errMsg || '').toLowerCase();

          console.warn(
            `[Navigator] navigateTo 失败(${msg.includes('timeout') ? '超时/被阻塞' : msg}):`,
            err,
            '→ fallback 标记模式',
          );

          // 🔥 关键：只记录状态，不执行 redirectTo/reLaunch
          navStore.pushFallback(url);

          // 恢复冻结状态（因为页面没有真正离开）
          this.ctx.setData({
            _navigating: false,
            disableScroll: false,
            _navFailed: true,
          });

          // 用户感知：轻量 toast（1.5s 自动消失）
          wx.showToast({
            title: '正在跳转...',
            icon: 'loading',
            duration: 1500,
        });

        // 安全网：3 秒后强制恢复（防止极端卡死导致状态永久锁定）
        setTimeout(() => {
          if (this.ctx.data._navigating) {
            console.warn('[Navigator] 导航超时(3s)，强制恢复状态');
            this.ctx.setData({ disableScroll: false, _navigating: false });
          }
        }, 3000);
      });
    };

    // 5. 双层打断调度链（Final Patch 封板版）
    // L1 nextTick: 等待 setData diff flush
    // L2 setTimeout(0): 跨 JS turn，让渲染线程有机会处理
    wx.nextTick(() => {
      setTimeout(() => {
        doNavigate();
      }, 0);
    });
  }

  /**
   * 🔙 安全返回上一页（Final Patch 版）
   *
   * 判断逻辑：
   * 1. fallback 栈非空 → 说明之前 navigateTo 失败过，用 reLaunch 回首页重建完整状态
   * 2. 页面栈 > 1 → 正常 navigateBack
   * 3. 页面栈 <= 1 → reLaunch 兜底到首页
   */
  safeBack(): void {
    const state = navStore.get();

    // 🔥 检测 fallback 模式：有未处理的 fallback 记录
    if (state.fallbackStack.length > 0) {
      console.log(
        '[Navigator] safeBack: 检测到 fallback 模式,',
        `剩余栈: [${state.fallbackStack.join(', ')}],`,
        '→ reLaunch 首页',
      );

      // 清理所有 fallback 状态
      navStore.reset();

      // reLaunch 重建首页（完整生命周期 onLoad→onShow，可恢复滚动位置等）
      wx.reLaunch({ url: HOME });
      return;
    }

    // 正常返回逻辑
    const pages = getCurrentPages();
    const stackDepth = pages.length;

    if (stackDepth > 1) {
      console.log('[Navigator] safeBack: navigateBack (栈深:', stackDepth, ')');
      wx.navigateBack();
    } else {
      console.log('[Navigator] safeBack: 栈深<=1, reLaunch 首页');
      wx.reLaunch({ url: HOME });
    }
  }

  /** safeBack 别名（兼容不同命名偏好） */
  back(): void {
    this.safeBack();
  }

  /**
   * 重置导航状态（onShow 时调用）
   * - 恢复 scroll-view 可滚动
   * - 清除 _navigating 锁
   * - 注意：不做 scrollTop 的 setData（避免重新触发 render chain）
   */
  reset(): void {
    if (!this.ctx.data._navigating && !this.ctx.data.disableScroll) return; // 已是正常状态则跳过

    this.ctx.setData({
      disableScroll: false,
      _navigating: false,
    });

    console.log('[Navigator] reset');
  }

  /** 查询是否正在导航中 */
  isNavigating(): boolean {
    return !!this.ctx.data._navigating;
  }
}

/** 将引擎方法映射为 INavigator 接口 */
export type INavigatorImpl = Pick<NavigatorEngine, keyof INavigator>;
