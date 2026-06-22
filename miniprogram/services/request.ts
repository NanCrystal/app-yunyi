/** 后端 API 基础地址 */
// const BASE_URL = 'http://192.168.10.37:3000'; // 本地环境
const BASE_URL = 'https://api.tauol.online'; // 线上环境

/** 从 auth 工具获取 token（循环引用安全方式） */
function getAuthToken(): string {
  try {
    return wx.getStorageSync('mp_auth_token') || '';
  } catch {
    return '';
  }
}

/**
 * 通用请求封装
 * 自动携带 Authorization: Bearer <token>（如果已登录）
 */
const request = <T = any>(options: {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: Record<string, any>;
  skipAuth?: boolean; // 跳过自动携带 token（用于登录等公开接口）
}): Promise<T> => {
  const token = options.skipAuth ? '' : getAuthToken();

  const header: Record<string, string> = { 'content-type': 'application/json' };
  if (token) {
    header['Authorization'] = `Bearer ${token}`;
  }

  return new Promise((resolve, reject) => {
    wx.request({
      url: `${BASE_URL}${options.url}`,
      method: options.method || 'GET',
      data: options.data,
      header,
      success: (res) => {
        // 200 OK / 201 Created 均视为成功（POST 创建资源通常返回 201）
        if (res.statusCode === 200 || res.statusCode === 201) {
          resolve(res.data as T);
        } else if (res.statusCode === 401) {
          // token 过期或无效 → 清除本地登录态
          console.warn('[Request] 401 未授权，清除 token');
          try { wx.removeStorageSync('mp_auth_token'); } catch { /* ignore */ }
          reject(new Error('登录已过期，请重新登录'));
        } else {
          reject(new Error(`请求失败: ${res.statusCode}`));
        }
      },
      fail: reject,
    });
  });
};

/** GET 请求 */
export const get = <T = any>(url: string, params?: Record<string, any>): Promise<T> => {
  const query = params
    ? '?' +
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
        .join('&')
    : '';
  return request<T>({ url: url + query });
};

/** POST 请求 */
export const post = <T = any>(url: string, data?: Record<string, any>): Promise<T> => {
  return request<T>({ url, method: 'POST', data });
};

/** PUT 请求 */
export const put = <T = any>(url: string, data?: Record<string, any>): Promise<T> => {
  return request<T>({ url, method: 'PUT', data });
};

/** 导出原始 request 供 auth.ts 使用（避免循环依赖） */
export { request };
