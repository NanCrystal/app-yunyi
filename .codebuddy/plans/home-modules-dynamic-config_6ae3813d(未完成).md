---
name: home-modules-dynamic-config
overview: 将小程序首页从写死7个查询改造为基于 AppModule/AppModuleArtist 配置的动态模块系统：只查询已启用的模块数据，支持全局模块和艺人专属模块，支持按艺人维度排序和显示/隐藏。
todos:
  - id: schema-migration
    content: 修改 schema.prisma AppModuleArtist 加 sortOrder + status，执行迁移和 generate
    status: pending
  - id: app-module-service
    content: AppModuleService 新增 updateModuleSort 方法，修复 create/update 的 createMany 传 sortOrder
    status: pending
    dependencies:
      - schema-migration
  - id: app-module-controller
    content: AppModuleController 新增 PUT /artists/:artistId/modules/sort 路由
    status: pending
    dependencies:
      - app-module-service
  - id: integration-service
    content: IntegrationService 新增 getEnabledModules 方法，改造 getHomeData 为条件查询并返回 modules
    status: pending
    dependencies:
      - schema-migration
  - id: miniprogram-ts
    content: home.ts 新增 modules 类型定义，initData 解析 modules 列表驱动渲染
    status: pending
    dependencies:
      - integration-service
  - id: miniprogram-wxml
    content: home.wxml 将 6 个内容区块改为 wx:for 动态渲染
    status: pending
    dependencies:
      - miniprogram-ts
---

## 产品概述

将小程序首页从写死的模块展示改为动态配置驱动，支持按艺人维度控制模块的显示/隐藏和排序顺序，且后端只查询已启用模块的数据，未启用的模块不查询不返回。

## 核心功能

- **AppModuleArtist 新增字段**：在多对多关联表上增加 `sortOrder`（艺人维度排序）和 `status`（艺人维度启用/禁用）
- **支持全局模块**：不绑定艺人的模块对所有艺人可见，排序使用 `AppModule.sortOrder`
- **getHomeData 动态查询**：先查模块配置，只查询已启用模块对应的数据，返回结果包含 `modules` 列表
- **批量排序接口**：后台管理可按艺人批量调整模块排序和启停状态
- **小程序动态渲染**：首页按 `modules` 列表顺序渲染，未启用的模块不显示也不请求数据

## 技术栈

- 后端：NestJS + Prisma + SQLite（复用现有）
- 小程序：微信原生小程序 WXML/WXSS/TS（复用现有）

## 实现方案

### 核心设计决策

1. **AppModuleArtist 加 `sortOrder` + `status`**：`sortOrder` 解决艺人维度排序，`status` 解决艺人维度显示/隐藏（保留配置但不启用）
2. **全局模块兼容**：查询时分两步——①查该艺人的 `AppModuleArtist(status=1)` ②查无任何 `AppModuleArtist` 记录的 `AppModule(status=1)`，合并返回
3. **条件查询而非全量过滤**：`getHomeData` 先查模块配置得到 `enabledKeys` 集合，只对 enabledKeys 中的模块发起查询，未启用的不查
4. **IntegrationService 直接用 PrismaService 查 AppModuleArtist**：不需要跨模块注入 AppModuleService，避免循环依赖
5. **小程序用 `wx:for` + `wx:if` 动态渲染**：将 6 个内容区块包裹在 `wx:for="{{moduleList}}"` 循环中，按 `key` 条件渲染对应区块，顺序由 `moduleList` 决定

### 后端改动详情

#### 1. Schema 变更 (`schema.prisma`)

- `AppModuleArtist` 增加 `sortOrder Int @default(0)` 和 `status Int @default(1)`
- 执行 `npx prisma migrate dev` 生成迁移

#### 2. IntegrationService.getHomeData 改造

流程变为：

```
1. 查 artists 建 strToNum 映射（已有）
2. 查该艺人已启用的模块列表（新逻辑）
   - 艺人专属模块：AppModuleArtist WHERE artistId=? AND status=1, include AppModule WHERE status=1
   - 全局模块：AppModule WHERE status=1 AND artists none:{}
   - 合并去重，按 sortOrder 排序
3. 构建 enabledKeys 集合
4. 根据 enabledKeys 条件性地发起并行查询
5. 返回 { modules, banners?, posts?, ... }（仅包含已启用的字段）
```

关键代码逻辑——模块 key 与查询方法的映射：

```
banners     → getBanners(queryIds)
posts        → getSocialPosts(queryIds, strToNum)
photos       → getPhotos(queryIds)
videos       → getVideos(queryIds)
audios       → getAudios(queryIds)
photoCards   → getPhotoCards(queryIds, strToNum)
itineraries  → getItineraries(queryIds)
```

#### 3. AppModuleService 补充接口

- `updateModuleSort(artistId, modules[])`：按艺人批量更新 AppModuleArtist 的 sortOrder 和 status
- 修复 `create` 和 `update` 方法中 `createMany` 时不传 `sortOrder` 的问题

#### 4. AppModuleController 新增路由

- `PUT /app-modules/artists/:artistId/modules/sort`：批量更新排序

### 小程序改动详情

#### home.ts

- `IntegrationData` 接口新增 `modules` 字段
- `HomeData` 新增 `moduleList` 数组（从后端 `modules` 字段映射）
- `initData` 中解析 `modules` 列表，设入 `moduleList`
- 加载状态/错误状态改为基于 `moduleList` 动态初始化

#### home.wxml

- Hero 轮播区保持顶部不变（banners 模块控制是否显示图片，区域始终保留用 fallback）
- 将 6 个内容区块（最新动态/近期行程/图片档案馆/视频档案馆/小卡档案馆/语音馆）从固定顺序改为 `wx:for="{{moduleList}}" wx:key="key"` 循环渲染
- 循环体内用 `wx:if="{{item.key === 'posts'}}"` 等条件渲染对应区块模板
- 角色切换区保持底部不变

## 目录结构

```
e:\Project\backend\
├── prisma/
│   └── schema.prisma                    # [MODIFY] AppModuleArtist 加 sortOrder + status 字段
├── src/
│   ├── integration/
│   │   ├── integration.service.ts       # [MODIFY] getHomeData 改为条件查询 + 新增 getEnabledModules 方法
│   │   ├── integration.controller.ts    # 无改动
│   │   └── integration.module.ts        # 无改动
│   └── app-module/
│       ├── app-module.service.ts        # [MODIFY] 新增 updateModuleSort 方法，修复 create/update 的 sortOrder
│       └── app-module.controller.ts     # [MODIFY] 新增 PUT /artists/:artistId/modules/sort 路由

e:\Project\app-yunyi\
├── miniprogram/
│   └── pages/
│       └── home/
│           ├── home.ts                   # [MODIFY] IntegrationData 加 modules，initData 动态解析
│           └── home.wxml                 # [MODIFY] 6个内容区块改为 wx:for 动态渲染
```

## 实现备注

- `getHomeData` 中 `artistIdFilter` 是 string 类型，查 `AppModuleArtist` 需要用 `strToNum` 转换为数字 ID，复用已有的 `strToNum` 映射
- 全局模块的 Prisma 查询用 `artists: { none: {} }` 过滤无关联记录的模块
- 返回结果中只包含已启用模块对应的字段（如 `banners` 未启用则返回值中没有 `banners` key），小程序需用 `data.banners || []` 兜底
- `AppModuleService.create` 和 `update` 中 `AppModuleArtist.createMany` 需同步传入 `sortOrder`，当前代码只传了 `moduleId + artistId`
- 小程序 `wx:for` 循环体内的骨架屏/错误状态逻辑保持不变，只是外层包裹循环
- 数据库迁移后需执行 `npx prisma generate` 更新客户端