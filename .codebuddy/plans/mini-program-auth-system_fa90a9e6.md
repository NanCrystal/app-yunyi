---
name: mini-program-auth-system
overview: 为微信小程序新增完整的用户认证体系：后端新增 MiniUser 模型 + 微信 code2session 登录 + JWT 鉴权；小程序端实现登录态管理 + photo-preview 组件登录拦截；照片接口根据登录态差异化返回数据（未登录限50张、无原图/下载权限），并为后期留言/评论等用户功能预留扩展点，不影响现有后台管理系统。
design:
  styleKeywords:
    - Dark Mode
    - Minimalism
    - Premium Archive Aesthetic
    - High Contrast Monochrome
    - Micro-interaction Animation
    - Glassmorphism Overlay
  fontSystem:
    fontFamily: PingFang SC
    heading:
      size: 44rpx
      weight: 600
    subheading:
      size: 30rpx
      weight: 500
    body:
      size: 28rpx
      weight: 400
  colorSystem:
    primary:
      - "#FFFFFF"
      - "#56A4AD"
    background:
      - "#000000"
      - "#1A1A1A"
      - rgba(0, 0, 0, 0.75)
    text:
      - "#FFFFFF"
      - "#666666"
      - "#999999"
    functional:
      - "#07C160"
      - "#E74C3C"
      - rgba(255, 255, 255, 0.15)
todos:
  - id: backend-auth-module
    content: 搭建后端小程序认证基础架构：Prisma新增MpUser模型+安装JWT依赖+创建MpAuthModule完整模块（controller/service/guard/decorator）
    status: completed
  - id: backend-photo-api
    content: 改造后端Photo API：添加可选认证装饰器，根据登录态差异化返回数据（游客限50条+无rawUrl，登录用户完整数据）
    status: completed
    dependencies:
      - backend-auth-module
  - id: frontend-auth-util
    content: 构建小程序端登录基础设施：新建auth.ts工具函数+扩展IAppOption类型+改造request.ts自动携带Bearer Token+更新app.ts globalData
    status: completed
  - id: frontend-login-ui
    content: 创建登录弹窗组件login-popup+升级mine页面实现完整登录/登出流程及动态用户信息展示
    status: completed
    dependencies:
      - frontend-auth-util
  - id: frontend-photo-check
    content: 改造photo-preview组件：onViewOriginal/onDownload加入登录检测+未登录时触发弹窗+按钮UI状态变化
    status: completed
    dependencies:
      - frontend-auth-util
      - frontend-login-ui
  - id: integration-test
    content: 端到联调验证：确认登录全流程通畅、游客限制生效、管理员登录不受影响
    status: completed
    dependencies:
      - backend-auth-module
      - backend-photo-api
      - frontend-auth-util
      - frontend-login-ui
      - frontend-photo-check
---

## 产品概述

为微信小程序（StarView Archive）添加用户认证体系，实现"游客模式受限 + 登录后完整体验"的差异化访问策略。核心需求：点击查看原图/下载时检测登录状态，未登录则触发微信授权；**所有数据模块**（photo/voice/audio/photo-card/sync/posts）未登录用户列表限制 50 条且不可下载原图；滚动到底部显示"登录查看更多"引导；后端记录小程序用户身份，为后续留言/评论功能预留用户绑定能力。

## 核心功能

- **微信小程序登录流程**：wx.login 获取 code -> 后端 code2session 换取 openid -> 创建/查找用户 -> 签发 JWT token
- **登录状态检测**：photo-preview 组件的"查看原图"和"下载"按钮点击时，检查是否已登录，未登录则弹出授权引导
- **全模块差异化数据访问**（不仅限于 photo）：
- 未登录（游客）：**每个数据模块**每页最多 50 条记录，无法查看原图 URL，无法下载
- 已登录：无数量限制，可查看原图，可下载
- **列表底部引导 UI**：游客模式下各数据列表滚动到 50 条上限时，底部显示「登录查看更多」区域，点击触发登录弹窗
- **双轨认证体系**：新增小程序用户认证模块，完全独立于现有后台管理员的硬编码 `/auth/login`，不影响原有后台管理功能
- **我的页面升级**：从硬编码 GUEST 升级为显示真实用户信息（头像/昵称），支持登录/退出切换
- **Token 持久化与自动续期**：前端 Storage 存储 token，请求自动携带 Authorization header，token 过期时静默刷新

## 技术栈选型

| 层 | 技术 | 说明 |
| --- | --- | --- |
| 后端框架 | NestJS (已有) | 保持一致 |
| ORM / 数据库 | Prisma + SQLite (已有) | 新增 MpUser 模型 |
| 认证方案 | JWT (@nestjs/jwt + @nestjs/passport + passport-jwt) | 无状态、轻量、NestJS 原生支持 |
| 小程序端 | 微信原生小程序 (TypeScript) | 保持一致 |


## 实现策略

### 整体架构：双轨认证 + 全模块后端校验

采用**后端强制校验 + 前端辅助控制**的双重保障：

- **后端为主**：**所有数据 API**（photo / voice / audio / photo-card / sync/posts）根据 Authorization header 判断是否合法用户，决定返回数据的完整程度（数量上限、是否包含 rawUrl）
- **前端为辅**：UI 层隐藏/禁用操作按钮、列表底部显示登录引导，减少无效请求，提升用户体验

### 认证流程设计

```
小程序用户                    后端服务                    微信服务器
   │                           │                           │
   │── wx.login() ──────────>│                           │
   │   (获取 code)             │                           │
   │                           │                           │
   │── POST /mp-auth/login ──>│                           │
   │   { code }                │                           │
   │                           │── GET /sns/jscode2session ──>│
   │                           │  (appid+secret+code)      │
   │                           │<── openid+unionid ────────│
   │                           │                           │
   │                           │── findOrCreate MpUser ─────│
   │                           │── sign JWT(token) ─────────│
   │                           │                           │
   │<── { token, userInfo } ──│                           │
   │                           │                           │
   │── 存储 token 到 Storage  │                           │
   │── 后续请求携带 Bearer token                            │
```

### 关键技术决策

1. **JWT 而非 session token**：当前管理后台用内存 Map 存 token 无法扩展到多实例。JWT 无状态、自包含，适合小程序场景。小程序用户和管理员使用完全独立的 token 系统。

2. **新增 `MpUser` 数据模型**（非复用任何现有模型）：

- 字段：id, openId(唯一), unionId, nickName, avatarUrl, lastLoginAt, createdAt
- 通过 openId 唯一标识微信用户，支持同一微信用户多次登录自动关联

3. **全模块 API 改造方式**（核心修正 — 不仅限 photo）：

- 不使用全局 Guard（避免影响所有公开接口），而是通过自定义装饰器 `@OptionalAuth()` 提取可选的 user 信息
- **以下所有模块的查询方法统一改造**：
    - `PhotoService` — findByMonth / findAll 等
    - `VoiceService` — 列表查询方法
    - `AudioService` — 列表查询方法
    - `PhotoCardService` — 列表查询方法
    - `Sync/PostsService` — 列表查询方法
- 有有效 token → 正常返回完整数据；无 token 或 token 无效 → take 上限 **50 条**，返回数据中不含 rawUrl/downloadUrl，额外附加 `_guestLimit: true` 标记
- 所有公开接口仍然无需登录即可访问，只是数据量受限

4. **微信 AppID/Secret 复用**：`.env` 中已有 `WECHAT_MP_APP_ID` 和 `WECHAT_MP_APP_SECRET`（目前仅用于公众号发文），小程序登录也使用相同的 appid/secret（同一个小程序）

5. **前端登录态管理**：

- `utils/auth.ts` 封装统一的登录状态管理
- `app.ts` globalData 新增 `isLoggedIn`、`token`、`userInfo` 字段
- `request.ts` 的 header 自动注入 `Authorization: Bearer <token>`
- 登录弹窗组件化，可在 photo-preview、各列表页和 mine 页面复用

6. **列表底部「登录查看更多」组件**：

- 新建 `guest-limit-footer` 可复用组件
- 各数据列表页在 `_guestLimit: true` 且已加载完 50 条时展示该组件
- 点击触发 login-popup 弹窗

## 目录结构

```
e:/Project/backend/
├── prisma/schema.prisma                          # [MODIFY] 新增 MpUser 模型
├── src/
│   ├── mp-auth/                                   # [NEW] 小程序用户认证模块
│   │   ├── mp-auth.module.ts                      #       Module 注册
│   │   ├── mp-auth.controller.ts                  #       登录接口 POST /mp-auth/login
│   │   ├── mp-auth.service.ts                     #       code2session + 用户CRUD + JWT签发
│   │   ├── mp-auth.guard.ts                       #       JWT 认证守卫
│   │   ├── optional-auth.decorator.ts             #       可选认证装饰器（不强制）
│   │   └── dto/
│   │       └── login.dto.ts                       #       登录请求DTO
│   ├── common/
│   │   └── decorators/
│   │       └── current-user.decorator.ts          # [NEW] 注入当前用户信息
│   ├── photo/
│   │   ├── photo.controller.ts                    # [MODIFY] 接收可选 auth 参数
│   │   └── photo.service.ts                       # [MODIFY] 根据登录态控制返回数据范围
│   ├── voice/
│   │   ├── voice.controller.ts                    # [MODIFY] 接收可选 auth 参数
│   │   └── voice.service.ts                       # [MODIFY] 游客限50条
│   ├── audio/
│   │   ├── audio.controller.ts                    # [MODIFY] 接收可选 auth 参数
│   │   └── audio.service.ts                       # [MODIFY] 游客限50条
│   ├── photo-card/ (或对应目录)
│   │   ├── *.controller.ts                        # [MODIFY] 接收可选 auth 参数
│   │   └── *.service.ts                           # [MODIFY] 游客限50条
│   ├── sync/ (或 posts 相关)
│   │   ├── *.controller.ts                        # [MODIFY] 接收可选 auth 参数
│   │   └── *.service.ts                           # [MODIFY] 游客限50条
│   └── app.module.ts                              # [MODIFY] 注册 MpAuthModule
├── .env                                           # [MODIFY] 新增 JWT_SECRET 环境变量

e:/Project/app-yunyi/miniprogram/
├── typings/index.d.ts                             # [MODIFY] IAppOption 扩展登录态字段
├── app.ts                                         # [MODIFY] globalData 新增登录态，onLaunch 恢复登录态
├── utils/
│   └── auth.ts                                    # [NEW] 登录工具函数（login/check/getToken/logout）
├── services/
│   └── request.ts                                 # [MODIFY] 自动携带 Authorization header
├── components/
│   ├── photo-preview/
│   │   ├── photo-preview.ts                       # [MODIFY] onViewOriginal/onDownload 加登录检查
│   │   └── photo-preview.wxml                     # [MODIFY] 未登录时按钮样式变化提示
│   ├── login-popup/                               # [NEW] 登录授权弹窗组件（全局复用）
│   └── guest-limit-footer/                        # [NEW] "登录查看更多"底部引导组件（列表页复用）
├── pages/
│   ├── mine/
│   │   ├── mine.ts                                # [MODIFY] 实现完整登录/登出流程
│   │   ├── mine.wxml                              # [MODIFY] 动态展示用户信息或 GUEST
│   │   └── mine.wxss                              # [MODIFY] 登录后的头像/昵称样式
│   ├── photos/
│   │   ├── photos.ts                              # [MODIFY] _guestLimit 处理 + 底部引导
│   │   └── photos.wxml                            # [MODIFY] 引入 guest-limit-footer
│   ├── audio/
│   │   ├── audio.ts                               # [MODIFY] 同上
│   │   └── audio.wxml                             # [MODIFY] 同上
│   └── ... (voice/photo-card/sync等页面同样处理)
```

## 关键实现细节

### 1. 后端 MpUser 模型（Prisma Schema）

```
model MpUser {
  id          Int      @id @default(autoincrement())
  openId      String   @unique          // 微信 openid
  unionId     String?                   // 微信 unionid（需绑定开放平台）
  nickName    String?                   // 用户昵称
  avatarUrl   String?                   // 用户头像
  lastLoginAt DateTime @default(now())  // 最后登录时间
  createdAt   DateTime @default(now())

  @@index([openId])
}
```

### 2. 认证接口设计

| 方法 | 路径 | 说明 | 认证要求 |
| --- | --- | --- | --- |
| POST | `/mp-auth/login` | 小程序登录（code换token） | 无 |
| GET | `/mp-auth/profile` | 获取当前用户信息 | Bearer Token |


### 3. 全模块 API 差异化响应（统一规范）

**已登录用户请求** (`Authorization: Bearer <valid_token>`):

```
{
  "items": [{ "id": 1, "url": "/xxx.jpg", "rawUrl": "https://cdn.../xxx.jpg", ... }],
  "total": 200,
  "page": 1,
  "pageSize": 50
}
```

**未登录/游客请求** (无header或token无效):

```
{
  "items": [{ "id": 1, "url": "/xxx.jpg", "rawUrl": null, ... }],
  "total": 200,
  "page": 1,
  "pageSize": 50,
  "_guestLimit": true
}
```

- 服务端对**所有数据模块**的游客请求统一限制：单次最多返回 50 条（无论前端传多大 pageSize）
- `rawUrl` / 下载相关字段设为 null
- `_guestLimit: true` 前端据此判断是否显示底部"登录查看更多"

### 4. 性能与可靠性考虑

- **JWT 过期时间**：7 天，小程序端在 token 快过期时（提前1天）用 wx.login 静默刷新
- **code2session 结果缓存**：openid 不会变，但微信建议每次都用最新 code，不做长期缓存 session_key
- **数据库查询优化**：MpUser 按 openId 查询，已有唯一索引，O(1)
- **向后兼容**：所有 API 变更为可选认证，不传 token 行为与改造前完全一致（只是多了数量限制），确保不影响现有功能

### 5. 影响范围控制（铁律）

- **不修改** `/auth/login` 管理员登录接口
- **不修改** umi-blog 后台管理系统
- **不改** 其他无关业务模块的核心逻辑
- 仅修改**所有数据返回模块**（photo/voice/audio/photo-card/sync/posts）的查询方法增加可选认证 + `request.ts` 的请求头

## 设计风格定位

延续 StarView Archive 当前已有的**暗色系高端档案感**设计语言——纯黑背景 (#000000)、白色文字、极简线条边框、大间距留白。整体视觉保持冷峻、克制、专业的调性。登录相关的新增 UI 元素（弹窗、按钮、底部引导）必须融入现有的暗色美学体系，不破坏沉浸式浏览体验。

## 页面/组件规划

### Page 1: 我的页面 (mine) — 升级版

用户个人中心，从静态 GUEST 骨架升级为动态登录态感知页面。

**Block 1 - 用户信息区**
顶部居中展示用户头像（圆形）、昵称、欢迎语。已登录时显示微信头像和昵称；未登录时保持默认占位图标 + "GUEST" 文字。下方是登录/退出按钮——未登录显示 "LOGIN / REGISTER" 描边圆角按钮；已登录显示 "SIGN OUT" 文字按钮。

**Block 2 - 功能菜单列表**
四个菜单项保持不变，后续可基于登录态控制某些菜单显隐。

**Block 3 - 底部导航栏**
复用 bottom-tab-bar 组件不变。

### Component 1: 登录授权弹窗 (login-popup) — 全局复用

半透明黑色遮罩层上的居中卡片弹窗，用于在用户点击需登录的功能时唤起。

- 遮罩层：全屏 rgba(0,0,0,0.75)
- 内容卡片：深灰近黑圆角卡片，包含标题"需要登录"、说明文字、微信一键登录按钮、"暂不登录"取消链接
- scale + fade-in 动画入场

### Component 2: "登录查看更多"底部引导 (guest-limit-footer) — 列表页复用

嵌入在各数据列表底部的提示条，当游客模式加载满 50 条时显示。

- 暗色半透明背景条，左侧 🔒 图标 + "登录后查看更多内容"文字，右侧箭头
- 点击触发 login-popup 弹窗
- 在 photos / audio / voice / photo-card / sync 等所有列表页复用

### Component 3: photo-preview 操作层 — 升级版

预览图层的底部操作区，增加登录状态感知。

- **查看原图按钮**：已登录正常显示+点击切原图；未登录加锁图标🔒，点击触发生 login-popup
- **下载按钮**：已登录正常；未登录透明度 0.5，点击触发 login-popup