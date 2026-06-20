/**
 * Navigator v3 Final Patch — 状态机（唯一真相源）
 *
 * 职责：
 * - 记录导航模式（normal / fallback）
 * - 维护 fallback 栈（数组结构，防止单点覆盖）
 * - 提供 pushFallback / popFallback / reset 操作
 *
 * 设计约束：
 * - 纯状态管理，不触发任何 UI 操作
 * - 单例模式，全局共享
 */

import type { NavState } from './types';

class NavStore {
  private state: NavState = {
    mode: 'normal',
    fallbackStack: [],
  };

  /** 获取当前状态的快照 */
  get(): Readonly<NavState> {
    return this.state;
  }

  /**
   * 推入 fallback 记录
   * - 设置 mode 为 fallback
   * - 将 url 追加到 fallbackStack
   */
  pushFallback(url: string): void {
    this.state.mode = 'fallback';
    this.state.fallbackTarget = url;
    this.state.fallbackStack.push(url);
    console.log('[NavStore] pushFallback:', url, 'stack:', [...this.state.fallbackStack]);
  }

  /**
   * 弹出 fallback 记录
   * - 从栈顶移除一个 url
   * - 如果栈空则重置为 normal 模式
   *
   * @returns 弹出的 url，栈空时返回 undefined
   */
  popFallback(): string | undefined {
    const popped = this.state.fallbackStack.pop();

    if (this.state.fallbackStack.length === 0) {
      this.state.mode = 'normal';
      this.state.fallbackTarget = undefined;
    }

    console.log(
      '[NavStore] popFallback:',
      popped ?? '(empty)',
      'remaining:',
      this.state.fallbackStack.length,
    );

    return popped;
  }

  /** 重置所有状态（reLaunch 后调用） */
  reset(): void {
    this.state = {
      mode: 'normal',
      fallbackStack: [],
    };
    console.log('[NavStore] reset');
  }
}

/** 全局单例 */
export const navStore = new NavStore();
