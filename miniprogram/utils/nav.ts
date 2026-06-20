/**
 * 安全导航返回，兼容 DevTools glass-easel 下 navigateBack 静默/虚假成功的问题
 *
 * 核心策略：不信任 navigateBack 的 success 回调，用 setTimeout 验证实际跳转
 *   1. 预检栈深：pages.length <= 1 时直接 redirectTo
 *   2. 尝试 navigateBack + fail 回退
 *   3. 验证层：200ms 后检查页面栈是否真的变化了，未变化则强制 redirectTo
 */
export function safeNavigateBack(): void {
  const HOME = '/pages/home/home';
  const pages = getCurrentPages();
  const stackBefore = pages.length;
  console.log(`[safeNavigateBack] 入口, 栈深度: ${stackBefore}, 当前: ${pages[stackBefore - 1]?.route ?? '?'}`);

  // 第一层：页面栈只有自己，无法 navigateBack
  if (stackBefore <= 1) {
    console.log('[safeNavigateBack] 栈深<=1, 直接 redirectTo 首页');
    wx.redirectTo({ url: HOME });
    return;
  }

  let handled = false;

  // 第二层：尝试正常返回
  wx.navigateBack({
    success() {
      console.log('[safeNavigateBack] navigateBack success 回调触发');
      // ⚠️ 不设置 handled=true！DevTools 可能虚假成功，交给验证层判断
      // handled = true; // ← 故意注释掉，信任验证而非回调
    },
    fail() {
      console.log('[safeNavigateBack] navigateBack 失败, 立即降级');
      handled = true;
      wx.redirectTo({ url: HOME });
    },
  });

  // 第三层：验证层 — 检查页面栈是否真的发生了变化
  setTimeout(() => {
    if (handled) return;

    const currentPages = getCurrentPages();
    const currentRoute = currentPages[currentPages.length - 1]?.route ?? '?';
    console.log(
      `[safeNavigateBack] 验证: 栈深 ${stackBefore} → ${currentPages.length}, 当前页: ${currentRoute}`
    );

    if (currentPages.length >= stackBefore || currentRoute.includes('sync') ||
        currentRoute.includes('cards') || currentRoute.includes('audio') ||
        currentRoute.includes('videos') || currentRoute.includes('schedule') ||
        currentRoute.includes('photos')) {
      console.warn('[safeNavigateBack] ⚠️ 页面未真正返回, 强制 redirectTo 首页');
      wx.redirectTo({ url: HOME });
    } else {
      console.log('[safeNavigateBack] ✅ 页面已成功返回, 无需干预');
    }
  }, 250);
}
