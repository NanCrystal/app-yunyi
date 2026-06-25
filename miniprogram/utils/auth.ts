/**
 * 小程序用户认证工具函数
 * 管理 token 存储、登录状态检测、微信登录流程等
 */
import { BASE_URL } from "../services/request";

const TOKEN_KEY = "mp_auth_token";
const USER_INFO_KEY = "mp_user_info";

// ============================================
// 登录锁：防止并发登录导致 code 冲突 (errcode: 40029)
// ============================================
let _loginPromise: Promise<boolean> | null = null;
// 独立的带资料登录锁（不与静默登录共享）
let _profilePromise: Promise<boolean> | null = null;

// ============================================
// 开发模式开关（生产环境请设为 false）
// 开启后跳过微信登录和后端接口，使用 mock token
// ============================================
const DEV_MODE = false;

import { request } from "../services/request";

/** 后端 API 基础地址（与 request.ts 保持一致） */ 

/** 七牛云 CDN 域名 */
const QINIU_CDN = "https://cdn.tauol.online";

export interface MpUserInfo {
  id: number;
  nickName?: string;
  avatarUrl?: string;
  /** 是否已完善资料（nickName && avatarUrl 均不为空） */
  isProfileComplete?: boolean;
}

/**
 * 检查是否已登录（本地有 token）
 */
export function isLoggedIn(): boolean {
  return !!wx.getStorageSync(TOKEN_KEY);
}

/**
 * 检查当前用户是否为正式用户（已完善资料）
 * 需要先确保已调用过 silentLogin 或 login
 */
export function isProfileComplete(): boolean {
  const userInfo = getUserInfo();
  return !!(userInfo?.nickName && userInfo?.avatarUrl);
}

/**
 * 获取存储的 token */
export function getToken(): string {
  return wx.getStorageSync(TOKEN_KEY) || "";
}

/**
 * 获取存储的用户信息
 */
export function getUserInfo(): MpUserInfo | null {
  return wx.getStorageSync(USER_INFO_KEY) || null;
}

/**
 * 上传临时头像到七牛云，获取永久 URL
 * @param tempPath wxfile:// 临时路径
 * @returns 永久 URL，上传失败返回空字符串
 */
function uploadAvatarToQiniu(tempPath: string): Promise<string> {
  return new Promise((resolve) => {
    // 非 wxfile:// 路径（已经是网络 URL）直接返回
    if (
      !tempPath.startsWith("wxfile://") &&
      !tempPath.startsWith("http://tmp/")
    ) {
      resolve(tempPath);
      return;
    }

    wx.uploadFile({
      url: `${BASE_URL}/upload/image-full`,
      filePath: tempPath,
      name: "file",
      success: (res) => {
        if (res.statusCode === 200 && res.data) {
          try {
            const data = JSON.parse(res.data);
            if (data.url) {
              const fullUrl = `${QINIU_CDN}${data.url}`;
              console.log("[Auth] 头像上传成功:", fullUrl);
              resolve(fullUrl);
              return;
            }
          } catch {
            /* 解析失败走 fallback */
          }
        }
        console.warn("[Auth] 头像上传失败，使用空 avatarUrl");
        resolve("");
      },
      fail: (err) => {
        console.warn("[Auth] 头像上传异常:", err);
        resolve("");
      },
    });
  });
}

/** * 微信小程序登录完整流程：
 * 1. wx.login() 获取 code
 * 2. POST /mp-auth/login 换取 token
 * 3. 存储到本地
 *
 * @returns 登录是否成功
 */
export async function login(): Promise<boolean> {
  // ── 登录锁：防止并发调用导致 code 冲突 (errcode: 40029) ──
  if (_loginPromise) {
    console.log("[Auth] 登录进行中，复用现有 Promise");
    return _loginPromise;
  }

  _loginPromise = (async () => {
    try {
      // ============================================
      // 开发模式：跳过微信登录，使用 mock token
      // ============================================
      if (DEV_MODE) {
        console.warn("[Auth] ⚠️ DEV_MODE 已开启，使用 mock 登录");

        const mockToken = "dev_mock_token_" + Date.now();
        const mockUserInfo: MpUserInfo = {
          id: 1,
          nickName: "开发者",
          avatarUrl: "",
          isProfileComplete: false,
        };

        wx.setStorageSync(TOKEN_KEY, mockToken);
        wx.setStorageSync(USER_INFO_KEY, mockUserInfo);

        const app = getApp<IAppOption>();
        if (app.globalData) {
          app.globalData.isLoggedIn = true;
          app.globalData.token = mockToken;
          app.globalData.mpUserInfo = mockUserInfo;
        }

        console.log("[Auth] Mock 登录成功");
        return true;
      }

      // 1. 获取微信 login code
      const loginRes =
        await new Promise<WechatMiniprogram.LoginSuccessCallbackResult>(
          (resolve, reject) => {
            wx.login({
              success: resolve,
              fail: reject,
            });
          }
        );

      const code = loginRes.code;
      if (!code) {
        console.error("[Auth] wx.login 未返回 code");
        return false;
      }

      // 2. 调用后端登录接口换取 token（不携带旧 token）
      const res = await request<any>({
        url: "/mp-auth/login",
        method: "POST",
        data: { code },
        skipAuth: true,
      });

      if (!res || !res.token) {
        console.error("[Auth] 登录接口未返回 token", res);
        return false;
      }

      // 3. 构建完整的 userInfo（含服务端返回的 isProfileComplete 标识）
      const userInfo: MpUserInfo = {
        ...(res.userInfo || {}),
        isProfileComplete: res.isProfileComplete || false,
      };

      // 4. 存储到本地
      wx.setStorageSync(TOKEN_KEY, res.token);
      wx.setStorageSync(USER_INFO_KEY, userInfo);

      // 5. 同步更新 app.globalData
      const app = getApp<IAppOption>();
      if (app.globalData) {
        app.globalData.isLoggedIn = true;
        app.globalData.token = res.token;
        app.globalData.mpUserInfo = userInfo;
      }

      console.log(
        "[Auth] 登录成功, userId=",
        userInfo.id,
        ", isProfileComplete=",
        userInfo.isProfileComplete
      );
      return true;
    } catch (err) {
      console.error("[Auth] 登录失败:", err);
      return false;
    } finally {
      _loginPromise = null; // 清除锁，允许下次登录
    }
  })(); // 立即执行 async IIFE

  return _loginPromise;
}

/**
 * 静默登录（onLaunch 时自动调用）：
 * - 如果本地已有有效 token → 直接恢复登录态，不做任何事
 * - 如果没有 token → 自动执行 wx.login() 换取 token（无需用户操作）
 * - 不弹窗、不打扰用户，静默完成身份识别
 *
 * @returns 是否有有效的登录态（无论新旧）
 */
export async function silentLogin(): Promise<boolean> {
  try {
    // 本地已有 token → 已登录（可能是之前登录过的）
    if (isLoggedIn()) {
      console.log("[Auth] 静默登录：已有 token，跳过");
      return true;
    }

    // 无 token → 执行静默登录（调用现有的 login 方法）
    console.log("[Auth] 静默登录：无 token，执行 wx.login...");
    return await login();
  } catch (err) {
    console.warn("[Auth] 静默登录失败（非致命）:", err);
    // 静默登录失败不应阻塞小程序正常使用（游客模式仍可浏览部分内容）
    return false;
  }
}

/**
 * 调用 wx.getUserProfile 获取用户展示信息（头像、昵称等）
 * 必须在 tap 事件中调用
 *
 * @returns 用户信息对象，用户取消时返回 null
 */
export async function getUserProfileInfo(): Promise<{
  nickName: string;
  avatarUrl: string;
} | null> {
  try {
    console.log("[Auth] 正在调用 wx.getUserProfile...");
    const res =
      await new Promise<WechatMiniprogram.GetUserProfileSuccessCallbackResult>(
        (resolve, reject) => {
          wx.getUserProfile({
            desc: "用于完善会员资料",
            success: resolve,
            fail: reject,
          });
        }
      );
    const { nickName, avatarUrl } = res.userInfo;
    console.log("[Auth] getUserProfile 成功, nickName=", nickName);
    return { nickName, avatarUrl };
  } catch (err) {
    // 用户取消授权或调用失败
    console.log("[Auth] getUserProfile 取消或失败:", err);
    return null;
  }
}

/**
 * 完整登录流程：getUserProfile → 存储 userInfo → wx.login 换 token
 * 组合了"获取展示信息"和"建立登录态"两个步骤
 *
 * @returns 登录是否成功
 */
export async function loginWithProfile(): Promise<boolean> {
  // ── 独立登录锁：不与静默 login() 共享（避免被静默登录拦截导致不弹窗）──
  if (_profilePromise) {
    console.log("[Auth] loginWithProfile: 登录进行中，复用现有 Promise");
    return _profilePromise;
  }

  console.log("[Auth] loginWithProfile 开始执行...");
  _profilePromise = (async () => {
    const app = getApp<IAppOption>();
    try {
      // 0. 先清除旧的登录态（避免脏数据干扰）
      wx.removeStorageSync(TOKEN_KEY);
      wx.removeStorageSync(USER_INFO_KEY);

      if (app.globalData) {
        app.globalData.isLoggedIn = false;
        app.globalData.token = "";
        app.globalData.mpUserInfo = null;
      }

      // 1. 先获取用户展示信息（会弹窗要求用户确认）
      const profile = await getUserProfileInfo();
      if (!profile) {
        // 用户取消了授权，不继续登录流程
        return false;
      }

      // DEV_MODE 下使用 mock token
      if (DEV_MODE) {
        console.warn(
          "[Auth] ⚠️ DEV_MODE 已开启，loginWithProfile 使用 mock 登录"
        );

        const mockToken = "dev_mock_token_" + Date.now();
        const mockUserInfo: MpUserInfo = { id: 1, ...profile };

        wx.setStorageSync(TOKEN_KEY, mockToken);
        wx.setStorageSync(USER_INFO_KEY, mockUserInfo);

        if (app.globalData) {
          app.globalData.isLoggedIn = true;
          app.globalData.token = mockToken;
          app.globalData.mpUserInfo = mockUserInfo;
        }

        console.log("[Auth] loginWithProfile Mock 登录成功");
        return true;
      }

      // 2. 正式环境：wx.login 换取 code
      const loginRes =
        await new Promise<WechatMiniprogram.LoginSuccessCallbackResult>(
          (resolve, reject) => {
            wx.login({
              success: resolve,
              fail: reject,
            });
          }
        );

      const code = loginRes.code;
      if (!code) {
        console.error("[Auth] wx.login 未返回 code");
        return false;
      }

      // 4. 后端接口换取 token，同时携带用户资料
      const res = await request<any>({
        url: "/mp-auth/login",
        method: "POST",
        data: { code, profile },
        skipAuth: true,
      });

      if (!res || !res.token) {
        console.error("[Auth] 登录接口未返回 token", res);
        return false;
      }

      // 3. 存储登录成功的完整用户信息（profile 优先，避免被后端 null 覆盖）
      wx.setStorageSync(TOKEN_KEY, res.token);
      const baseInfo: MpUserInfo = { id: 0, ...profile };
      const serverInfo = res.userInfo || {};
      // 合并策略：服务端 userId 优先 + profile 昵称/头像优先（防止 null 覆盖）
      const fullUserInfo: MpUserInfo = {
        id: serverInfo.id || baseInfo.id,
        nickName: serverInfo.nickName || baseInfo.nickName,
        avatarUrl: serverInfo.avatarUrl || baseInfo.avatarUrl,
        isProfileComplete:
          res.isProfileComplete ||
          !!(serverInfo.nickName && serverInfo.avatarUrl),
      };
      wx.setStorageSync(USER_INFO_KEY, fullUserInfo);

      // 同步 globalData
      if (app.globalData) {
        app.globalData.isLoggedIn = true;
        app.globalData.token = res.token;
        app.globalData.mpUserInfo = fullUserInfo;
      }

      console.log(
        "[Auth] loginWithProfile 登录成功, userId=",
        res.userInfo?.id
      );
      return true;
    } catch (err) {
      console.error("[Auth] loginWithProfile 失败:", err);
      return false;
    } finally {
      _profilePromise = null; // 清除锁，允许下次登录
    }
  })(); // 立即执行 async IIFE

  return _profilePromise;
}

/**
 * 新版登录流程（微信推荐方式）：
 * 接收用户通过 button open-type="chooseAvatar" 和 input type="nickname" 获取的头像/昵称
 * → wx.login 获取 code → 后端换取 token → 存储 userInfo
 *
 * @param avatarUrl 用户选择的头像 URL（临时路径或网络地址）
 * @param nickName 用户输入的昵称
 * @returns 登录是否成功
 */
export async function loginWithNewProfile(
  avatarUrl: string,
  nickName: string
): Promise<boolean> {
  if (_profilePromise) {
    console.log("[Auth] loginWithNewProfile: 登录进行中，复用现有 Promise");
    return _profilePromise;
  }

  if (!nickName || !avatarUrl) {
    console.warn("[Auth] loginWithNewProfile: 缺少头像或昵称");
    return false;
  }

  console.log("[Auth] loginWithNewProfile 开始执行, nickName=", nickName);
  _profilePromise = (async () => {
    const app = getApp<IAppOption>();
    try {
      // 0. 清除旧数据
      wx.removeStorageSync(TOKEN_KEY);
      wx.removeStorageSync(USER_INFO_KEY);
      if (app.globalData) {
        app.globalData.isLoggedIn = false;
        app.globalData.token = "";
        app.globalData.mpUserInfo = null;
      }

      // DEV_MODE
      if (DEV_MODE) {
        const mockToken = "dev_mock_token_" + Date.now();
        const mockUserInfo: MpUserInfo = {
          id: 1,
          nickName,
          avatarUrl,
          isProfileComplete: true,
        };
        wx.setStorageSync(TOKEN_KEY, mockToken);
        wx.setStorageSync(USER_INFO_KEY, mockUserInfo);
        if (app.globalData) {
          app.globalData.isLoggedIn = true;
          app.globalData.token = mockToken;
          app.globalData.mpUserInfo = mockUserInfo;
        }
        console.log("[Auth] loginWithNewProfile Mock 成功");
        return true;
      }

      // 1. wx.login 获取 code
      const loginRes =
        await new Promise<WechatMiniprogram.LoginSuccessCallbackResult>(
          (resolve, reject) => {
            wx.login({ success: resolve, fail: reject });
          }
        );
      const code = loginRes.code;
      if (!code) {
        console.error("[Auth] wx.login 未返回 code");
        return false;
      }

      // 1.5 上传头像到七牛云获取永久 URL（wxfile:// 临时路径无法存入数据库）
      const permanentAvatarUrl = await uploadAvatarToQiniu(avatarUrl);

      // 2. 后端接口，携带用户资料
      const res = await request<any>({
        url: "/mp-auth/login",
        method: "POST",
        data: { code, profile: { nickName, avatarUrl: permanentAvatarUrl } },
        skipAuth: true,
      });

      if (!res || !res.token) {
        console.error("[Auth] 登录接口未返回 token", res);
        return false;
      }

      // 3. 存储完整用户信息
      wx.setStorageSync(TOKEN_KEY, res.token);
      const fullUserInfo: MpUserInfo = {
        id: res.userInfo?.id || 0,
        nickName,
        avatarUrl: permanentAvatarUrl,
        isProfileComplete: res.isProfileComplete || !!permanentAvatarUrl,
      };
      wx.setStorageSync(USER_INFO_KEY, fullUserInfo);

      if (app.globalData) {
        app.globalData.isLoggedIn = true;
        app.globalData.token = res.token;
        app.globalData.mpUserInfo = fullUserInfo;
      }

      console.log("[Auth] loginWithNewProfile 成功, userId=", res.userInfo?.id);
      return true;
    } catch (err) {
      console.error("[Auth] loginWithNewProfile 失败:", err);
      return false;
    } finally {
      _profilePromise = null;
    }
  })();

  return _profilePromise;
}

/**
 * 新版完善资料流程：
 * 使用用户选择的新头像/昵称更新到后端
 *
 * @param avatarUrl 用户选择的头像 URL
 * @param nickName 用户输入的昵称
 */
export async function updateProfile(
  avatarUrl: string,
  nickName: string
): Promise<boolean> {
  try {
    if (!isLoggedIn()) {
      console.error("[Auth] 未登录，无法完善资料");
      return false;
    }

    if (DEV_MODE) {
      const updatedInfo: MpUserInfo = {
        ...(getUserInfo() || { id: 1 }),
        nickName,
        avatarUrl,
        isProfileComplete: true,
      };
      wx.setStorageSync(USER_INFO_KEY, updatedInfo);
      const app = getApp<IAppOption>();
      if (app.globalData) app.globalData.mpUserInfo = updatedInfo;
      return true;
    }

    // 上传头像到七牛云获取永久 URL
    const permanentAvatarUrl = await uploadAvatarToQiniu(avatarUrl);

    await request<any>({
      url: "/mp-auth/profile",
      method: "PUT",
      data: { nickName, avatarUrl: permanentAvatarUrl },
    });

    const currentInfo = getUserInfo() || { id: 0 };
    const updatedInfo: MpUserInfo = {
      ...currentInfo,
      nickName,
      avatarUrl: permanentAvatarUrl,
      isProfileComplete: !!permanentAvatarUrl,
    };
    wx.setStorageSync(USER_INFO_KEY, updatedInfo);
    const app = getApp<IAppOption>();
    if (app.globalData) app.globalData.mpUserInfo = updatedInfo;

    console.log("[Auth] updateProfile 成功");
    return true;
  } catch (err) {
    console.error("[Auth] updateProfile 失败:", err);
    return false;
  }
}

/**
 * 退出登录：清除本地存储和 globalData
 */
export function logout(): void {
  wx.removeStorageSync(TOKEN_KEY);
  wx.removeStorageSync(USER_INFO_KEY);

  const app = getApp<IAppOption>();
  if (app.globalData) {
    app.globalData.isLoggedIn = false;
    app.globalData.token = "";
    app.globalData.mpUserInfo = null;
  }

  console.log("[Auth] 已退出登录");
}

/**
 * 完善用户资料（基础用户升级为正式用户）：
 * 1. 调用 wx.getUserProfile() 获取头像昵称
 * 2. PUT /mp-auth/profile 更新到后端
 * 3. 更新本地 userInfo 和 globalData
 *
 * @returns 升级是否成功
 */
export async function completeProfile(): Promise<boolean> {
  try {
    // 检查是否已登录（必须有 token 才能调用此接口）
    if (!isLoggedIn()) {
      console.error("[Auth] 未登录，无法完善资料");
      // 先执行静默登录获取 token
      const loginOk = await login();
      if (!loginOk) return false;
    }

    // DEV_MODE 下模拟完善资料
    if (DEV_MODE) {
      console.warn("[Auth] ⚠️ DEV_MODE 已开启，completeProfile 使用 mock");

      const mockUpdatedInfo: MpUserInfo = {
        id: 1,
        nickName: "开发者",
        avatarUrl: "https://mock-avatar-url",
        isProfileComplete: true,
      };

      wx.setStorageSync(USER_INFO_KEY, mockUpdatedInfo);

      const app = getApp<IAppOption>();
      if (app.globalData) {
        app.globalData.mpUserInfo = mockUpdatedInfo;
      }

      console.log("[Auth] Mock 资料完善成功");
      return true;
    }

    // 1. 调用 getUserProfile 获取头像昵称（会弹窗）
    const profile = await getUserProfileInfo();
    if (!profile) {
      console.log("[Auth] 用户取消授权");
      return false;
    }

    // 2. 调用后端接口更新资料
    const res = await request<any>({
      url: "/mp-auth/profile",
      method: "PUT",
      data: profile, // { nickName, avatarUrl }
    });

    if (!res || !res.success) {
      console.error("[Auth] 完善资料接口失败", res);
      return false;
    }

    // 3. 更新本地 userInfo
    const currentInfo = getUserInfo() || { id: 0 };
    const updatedInfo: MpUserInfo = {
      id: currentInfo.id,
      nickName: res.userInfo?.nickName || profile.nickName,
      avatarUrl: res.userInfo?.avatarUrl || profile.avatarUrl,
      isProfileComplete: true,
    };

    wx.setStorageSync(USER_INFO_KEY, updatedInfo);

    // 4. 同步 globalData
    const app = getApp<IAppOption>();
    if (app.globalData) {
      app.globalData.mpUserInfo = updatedInfo;
    }

    console.log("[Auth] 资料完善成功，已升级为正式用户");
    return true;
  } catch (err) {
    console.error("[Auth] 完善资料失败:", err);
    return false;
  }
}
