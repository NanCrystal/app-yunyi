/**
 * Navigator v3 Final Patch — 类型定义
 *
 * 核心设计原则：
 * - fallback 只标记不跳转（状态与行为分离）
 * - fallbackStack 用数组栈防止单点覆盖
 */

/** 导航模式 */
export type NavMode = 'normal' | 'fallback';

/** 导航状态（NavStore 唯一真相源） */
export interface NavState {
  /** 当前导航模式 */
  mode: NavMode;
  /** fallback 目标 URL（兼容旧字段） */
  fallbackTarget?: string;
  /**
   * 🔥 Fallback 栈（数组，防止多级跳转覆盖）
   * push on navigate fail
   * pop on safeBack
   */
  fallbackStack: string[];
}

/** 导航选项 */
export interface NavigateOptions {
  /** 强制导航（忽略 _navigating 锁） */
  force?: boolean;
  /** 自定义延迟（毫秒） */
  delay?: number;
}

/** Navigator 实例方法集（对外 API） */
export interface INavigator {
  /** 核心导航方法（含双层打断 + fallback 标记 + 栈深预检） */
  navigate(url: string, options?: NavigateOptions): void;

  /** 安全返回上一页（检测 fallback 模式时 reLaunch HOME） */
  safeBack(): void;

  /** 安全返回上一页（别名，与 safeBack 行为一致） */
  back(): void;

  /** 重置导航状态（onShow 时调用） */
  reset(): void;

  /** 查询是否正在导航中 */
  isNavigating(): boolean;
}
