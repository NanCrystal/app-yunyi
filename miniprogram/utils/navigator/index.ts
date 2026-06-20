/**
 * Navigator v3 Final Patch — 对外 API
 *
 * 使用方式：
 * ```ts
 * import { createNavigator, type INavigator } from '../../utils/navigator';
 *
 * Page({
 *   onLoad() {
 *     this.navigator = createNavigator(this);
 *   },
 *   onShow() {
 *     this.navigator?.reset();
 *   },
 *   onGoDetail() {
 *     this.navigator?.navigate('/pages/detail/detail');
 *   },
 *   onGoBack() {
 *     this.navigator?.safeBack(); // 或 .back()
 *   },
 * });
 * ```
 *
 * WXML 配合（重要！）：
 * <scroll-view scroll-y="{{!disableScroll}}" scroll-top="{{scrollTop}}">
 */

import { NavigatorEngine } from './engine';
import { navStore } from './store';
import type { INavigator, NavigateOptions, NavState } from './types';

/**
 * 创建 Navigator 实例并绑定到页面上下文
 *
 * @param pageCtx 页面实例（通常传 this）
 * @returns INavigator 导航方法集 { navigate, safeBack/back, reset, isNavigating }
 */
export function createNavigator(
  pageCtx: WechatMiniprogram.Page.Instance<any, any>,
): INavigator {
  const engine = new NavigatorEngine(pageCtx);

  return {
    navigate: (url: string, options?: NavigateOptions) => engine.navigate(url, options),
    safeBack: () => engine.safeBack(),
    back: () => engine.back(),
    reset: () => engine.reset(),
    isNavigating: () => engine.isNavigating(),
  };
}

// 导出类型和 store（供外部高级用法使用）
export type { INavigator, NavigateOptions, NavState };
export { navStore };
