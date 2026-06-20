---
name: comments-getUserProfile-auth
overview: 修改留言页面未登录逻辑：将原有的 showLoginPopup 弹窗替换为 wx.getUserProfile 授权流程，支持重复请求直到用户同意，并将用户信息存储到本地
todos:
  - id: auth-profile-funcs
    content: 在 auth.ts 中新增 getUserProfileInfo() 和 loginWithProfile() 封装函数
    status: completed
  - id: comments-openInputPanel
    content: 修改 comments.ts 的 openInputPanel() 方法，未登录时调用 loginWithProfile()
    status: completed
    dependencies:
      - auth-profile-funcs
  - id: comments-wxml-clean
    content: 从 comments.wxml 和 comments.json 中移除 login-popup 组件引用
    status: completed
---

## Product Overview

修改留言页面的未登录交互流程：当用户未登录时点击留言按钮，不再弹出登录弹窗（login-popup），而是直接调用 `wx.getUserProfile()` 获取用户授权。用户取消则无操作（下次点击重试），用户同意后将用户信息存入本地并完成登录流程，随后弹出输入面板。

## Core Features

1. **getUserProfile 授权流程**：未登录状态下点击留言按钮 → 调用 `wx.getUserProfile({ desc: '用于完善会员资料' })` 弹出微信授权窗口
2. **取消重试机制**：用户点击取消/拒绝后不报错、不弹窗，下次点击按钮再次触发 getUserProfile（循环直到用户同意）
3. **用户信息本地存储**：授权成功后将 nickName、avatarUrl 等信息存储到 Storage 和 globalData
4. **登录态建立**：获取用户信息后自动执行 wx.login 流程换取 token，完成完整登录
5. **输入面板弹出**：授权+登录成功后才显示输入面板（showInputPanel = true）

## 补充说明：wx.login vs wx.getUserProfile 的区别与作用

| 对比项 | `wx.login` | `wx.getUserProfile` |
| --- | --- | --- |
| **调用方式** | 静默调用，无需用户操作 | 需用户主动点击确认弹窗 |
| **返回数据** | 临时凭证 `code`（有效期5分钟） | 用户个人信息（nickName、avatarUrl、gender 等） |
| **核心作用** | 用 code 换取服务端的 `openId`、`sessionKey`、自定义 `token` | 获取用户的**展示性信息**（头像、昵称） |
| **使用场景** | 服务端身份识别、建立登录态、接口鉴权 | 前端 UI 展示用户头像昵称、提交留言时携带用户信息 |
| **关系** | 两者互补：`wx.login` 解决"你是谁"（身份认证），`wx.getUserProfile` 解决"你叫什么/长什么样"（展示信息） |
| **调用顺序** | 通常先 `wx.login` 拿 token 建立身份，再按需 `wx.getUserProfile` 拿展示信息 | 必须在 tap 点击事件中触发 |


简言之：**`wx.login` 用于后端认证身份（换 token），`wx.getUserProfile` 用于前端获取可展示的用户资料（头像昵称）。两者数据完全不重叠，需要配合使用。**

## Tech Stack

- 微信小程序原生框架 (TypeScript)
- 现有项目架构：auth.ts 工具层 + login-popup 组件 + comments 页面

## Implementation Approach

采用"替换式"方案：将 `comments.ts` 中 `openInputPanel()` 的未登录分支从"显示 login-popup 弹窗"改为"直接调用 wx.getUserProfile()"。在 `auth.ts` 中新增 `getUserProfileInfo()` 封装和 `loginWithProfile()` 组合函数，实现"先拿用户信息 → 再静默登录换 token"的串联流程。

### 关键技术决策

1. **移除 login-popup 依赖**：comments 页面不再需要 login-popup 组件，因为 getUserProfile 本身就是微信原生的授权弹窗
2. **getUserProfile 必须在 tap 事件中调用**：当前 `openInputPanel` 已通过 `bindtap="openInputPanel"` 触发，满足约束条件
3. **DEV_MODE 兼容**：开发模式下 getUserProfile 在开发者工具中可能表现异常，需做兼容处理（try-catch + fallback 到 mock 数据）
4. **存储分离**：token 存在 `mp_auth_token`，用户展示信息存在 `mp_user_info`，保持现有 key 不变
5. **去重授权提示**：微信官方建议"妥善保管用户快速填写的头像昵称，避免重复弹窗"，因此授权成功后只要本地有 user_info 就不再调用 getUserProfile

### 性能与可靠性

- 无性能瓶颈（单次 API 调用）
- 需处理基础库版本兼容（canIUse 判断或 try-catch）
- 需处理 getUserProfile 在开发者工具中的异常行为

## Implementation Details

### 修改文件清单

```
miniprogram/
├── utils/
│   └── auth.ts                    # [MODIFY] 新增 getUserProfileInfo()、loginWithProfile() 函数
├── pages/comments/
│   ├── comments.ts                # [MODIFY] 重写 openInputPanel() 未登录分支逻辑
│   ├── comments.wxml              # [MODIFY] 移除 login-popup 组件引用
│   └── comments.json              # [MODIFY] 移除 login-popup usingComponents 声明
```

### 核心流程（伪代码）

```typescript
// auth.ts 新增
export async function getUserProfileInfo(): Promise<{ nickName: string; avatarUrl: string } | null>
// 封装 wx.getUserProfile，返回 userInfo 核心字段

export async function loginWithProfile(): Promise<boolean>
// 组合流程：getUserProfileInfo() → 存储 userInfo → wx.login() → 换 token

// comments.ts 修改 openInputPanel()
async openInputPanel() {
  if (isLoggedIn()) {
    this.setData({ showInputPanel: true });
    return;
  }
  // 未登录：调用 getUserProfile 触发授权
  const { loginWithProfile } = require('../../utils/auth');
  const success = await loginWithProfile(); // 内含 getUserProfile 弹窗
  if (success) {
    this.setData({ showInputPanel: true }); // 授权成功才显示输入面板
  }
  // 取消/失败时不做任何事，下次点击会重新触发
}
```