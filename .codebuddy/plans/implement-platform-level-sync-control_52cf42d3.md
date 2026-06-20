---
name: implement-platform-level-sync-control
overview: 为艺人社交账号同步功能添加按平台独立控制能力，包括数据库新增4个平台开关字段、后端同步逻辑改造、以及前端UI界面开发
design:
  styleKeywords:
    - Dark Theme
    - Minimalism
    - Card-based Layout
    - Switch Interaction
    - Theme-aware
  fontSystem:
    fontFamily: PingFang SC
    heading:
      size: 17px
      weight: 600
    subheading:
      size: 14px
      weight: 500
    body:
      size: 13px
      weight: 400
  colorSystem:
    primary:
      - "#FFFFFF"
      - "#FF6B6B"
    background:
      - "#000000"
      - "#1A1A1A"
      - "#2A2A2A"
    text:
      - "#FFFFFF"
      - "#999999"
      - "#666666"
    functional:
      - "#4CD964"
      - "#E74C3C"
      - rgba(255,255,255,0.1)
todos:
  - id: db-migrate
    content: 在 schema.prisma 的 Artist 模型新增 syncWeibo/syncDouyin/syncXiaohongshu/syncInstagram 四个 Boolean 字段并执行迁移
    status: completed
  - id: backend-sync-logic
    content: 修改 sync.service.ts 的 syncSingleArtist 方法，在各平台 ID 判断基础上追加平台开关字段的双重判断
    status: completed
    dependencies:
      - db-migrate
  - id: backend-controller-dto
    content: 修改 artist.controller.ts 的 Create/Update DTO，新增 4 个平台同步开关字段
    status: completed
    dependencies:
      - db-migrate
  - id: frontend-types-api
    content: 扩展 types.ts 接口、补齐 request.ts 的 put 导出、在 api.ts 新增 updateArtist 方法
    status: completed
  - id: settings-page
    content: 新建 artist-sync-settings 页面（json/ts/wxml/wxss），实现艺人列表展示 + 平台 switch 开关 UI 及实时保存
    status: completed
    dependencies:
      - frontend-types-api
  - id: register-route
    content: 在 app.json 中注册新页面路由
    status: completed
    dependencies:
      - settings-page
---

## 产品概述

为艺人社交平台同步功能增加**按平台独立控制开关**能力，解决当前只能全局开启/关闭同步、无法单独禁用某个平台同步的问题。

## 核心功能

- 数据库层：Artist 模型新增 4 个平台级布尔字段（syncWeibo / syncDouyin / syncXiaohongshu / syncInstagram），默认值均为 true，保持向后兼容
- 后端逻辑层：修改 `syncSingleArtist()` 方法中各平台的判断条件，在「平台 ID 已配置」基础上追加「对应平台同步开关为 true」的双重判断；同步 Controller 的 Create 和 Update DTO 接收新字段
- 前端 UI 层：新建艺人同步设置页面（artist-sync-settings），以卡片列表形式展示每位艺人，每个艺人下展示 4 个平台的 switch 开关，支持独立切换并实时保存至后端；同时在 request 服务中补充 `put` 方法导出、api 服务中补充更新艺人的接口方法

**支持的 4 个平台及配置依据**：

| 平台 | 判断字段 | 所需配置 |
| --- | --- | --- |
| 微博 | weiboId | 有值即可 |
| 抖音 | douyinSecUid | 有值即可 |
| 小红书 | xhsId | 有值即可 |
| Instagram | igId + igToken | 两个字段均需有值 |


## Tech Stack

- 后端：NestJS + Prisma ORM（SQLite/MySQL）
- 前端：微信小程序原生框架（TypeScript + WXML + WXSS）
- 数据库迁移：Prisma Migrate

## 实现方案

采用**字段扩展 + 双重判断**策略：在现有 Artist 模型上新增 4 个可选布尔字段，默认 true 保证向后兼容——已有艺人不受影响，新代码在原有 ID 非空判断上追加开关判断。前端新建独立的艺人同步设置页面，通过 `PUT /artists/:id` 接口实时保存开关状态。

## 关键技术决策

1. **字段命名**：采用 `sync{PlatformName}` 格式（如 syncWeibo），与现有 syncEnabled 全局开关风格一致，语义清晰
2. **默认值 true**：确保存量数据无缝升级，不破坏现有的全量同步行为
3. **类型安全**：后端使用 Prisma 生成的类型自动携带新字段，前端的 Character / ArtistItem 接口同步扩展
4. **请求方法复用**：request.ts 底层已支持 PUT 方法，仅需补齐 `put` 便捷函数的导出

## 架构设计

```
前端 (小程序)                    后端 (NestJS)
┌──────────────────┐         ┌─────────────────────┐
│ artist-sync-settings│ ─PUT─▶│ artist.controller.ts │
│   页面 (switch)   │ ◀─────│   DTO 含 4 个新字段    │
│        │          │        └──────────┬──────────┘
│        ▼          │                   ▼
│ api.ts            │         artist.service.ts
│ updateArtist()    │               │
│        │          │               ▼
│ request.ts        │         prisma.artist.update()
│   put()           │                   │
└──────────────────┘                   ▼
                              ┌───────────────────┐
                              │ sync.service.ts    │
                              │ syncAllArtists()   │
                              │  └─ syncSingleArtist│
                              │     if(weiboId      │
                              │       && syncWeibo) │
                              └───────────────────┘
```

## 目录结构

```
e:/Project/backend/
├── prisma/schema.prisma                          # [MODIFY] Artist 模型新增 4 个 Boolean 字段
├── src/
│   ├── artist/artist.controller.ts                # [MODIFY] Create/Update DTO 新增 4 个平台同步字段
│   └── sync/sync.service.ts                       # [MODIFY] syncSingleArtist 追加平台开关双重判断

e:/Project/app-yunyi/miniprogram/
├── utils/types.ts                                 # [MODIFY] Character/ArtistItem 接口新增 4 个可选布尔字段
├── services/request.ts                            # [MODIFY] 导出 put 便捷方法
├── services/api.ts                                # [MODIFY] 新增 updateArtist() 方法
├── pages/
│   └── artist-sync-settings/                      # [NEW] 艺人同步设置页面目录
│       ├── artist-sync-settings.json              # 页面配置
│       ├── artist-sync-settings.ts                # 页面逻辑（加载艺人列表 + switch 切换保存）
│       ├── artist-sync-settings.wxml              # 页面模板（艺人卡片 + 平台 switch 列表）
│       └── artist-sync-settings.wxss              # 页面样式
└── app.json                                       # [MODIFY] 注册新页面路由
```

## 实现注意事项

- **性能**：syncSingleArtist 中新增的布尔判断为 O(1)，不影响性能；数据库新增 4 个布尔字段对查询性能无影响
- **向后兼容**：Prisma 字段设 `@default(true)`，运行 `prisma migrate dev` 后存量记录自动获得默认值，无需数据修补脚本
- **前端开关交互**：switch 切换时立即调用 `put('/artists/:id', { syncWeibo: false })` 保存，切换过程加 loading 状态防止重复提交；失败时回滚开关状态
- **权限控制**：该设置页面应仅对完整资料用户开放（复用 isProfileComplete 判断），基础用户限查看不可编辑

## 设计概述

新建「艺人同步设置」页面，采用深色主题风格与小程序整体视觉一致。页面以艺人头像+名称作为分组头部，每个艺人下方展示 4 个平台开关行（微博/抖音/小红书/Instagram），每行包含平台图标、平台名称和 switch 组件。未配置平台 ID 的行显示置灰禁用状态并提示「未配置」。页面顶部放置全局说明文案。

## 页面规划（1个页面）

### 页面：艺人同步设置 (artist-sync-settings)

**Block 1 - 自定义导航栏**
自定义导航栏，标题为「同步设置」，左侧返回按钮，右侧留空。背景色跟随主题变量 --theme，与小程序其他页面保持一致的导航体验。

**Block 2 - 说明提示区**
页面顶部的轻量提示区域，显示说明文字：「在此管理每位艺人的各平台同步开关，关闭后定时任务将跳过该平台。」文字使用次要文本色，字号较小，不超过两行。

**Block 3 - 艺人卡片列表**
核心内容区，以 scroll-view 包裹的可滚动列表。每个艺人一张圆角卡片，包含：

- 卡片头部：左侧圆形艺人头像（appCover）+ 艺人名称，右侧显示全局同步总开关（控制该艺人所有平台）
- 卡片体部：4 行平台开关项，每行布局为 [平台图标] [平台名称] [switch]，未配置的平台行整体降低透明度且 switch 禁用（disabled）
- 卡片间适当间距，当前选中艺人卡片有微弱的边框高亮（使用主题色）

**Block 4 - 底部操作栏**
固定底部的操作栏，包含一个「保存全部」按钮（实际上每次 switch 切换已实时保存，此按钮作为心理安全感兜底 + 刷新数据用）。

## Agent Extensions

### SubAgent

- **code-explorer**
- Purpose: 在实现过程中探索相关文件的具体代码细节，确保类型定义、接口调用等与现有模式一致
- Expected outcome: 准确定位需要修改的代码位置，避免遗漏或错误引用