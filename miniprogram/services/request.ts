/** 后端 API 基础地址 */
const BASE_URL = 'http://localhost:3000';

/**
 * 通用请求封装
 */
const request = <T = any>(options: {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: Record<string, any>;
}): Promise<T> => {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${BASE_URL}${options.url}`,
      method: options.method || 'GET',
      data: options.data,
      header: { 'content-type': 'application/json' },
      success: (res) => {
        if (res.statusCode === 200) {
          resolve(res.data as T);
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
