---
name: add-audio-zip-import-support
overview: 在 import-task 模块中新增对 mp3 zip 包的支持：识别 audios/ 目录下的音频文件，解析后存入 voice 表（audio 列表），支持可选绑定艺人和平台，使用上传时间作为 shootDate
todos:
  - id: update-import-module
    content: 修改 import-task.module.ts 导入 AudioModule，使 ImportTaskService 可注入 AudioService
    status: completed
  - id: inject-audio-service
    content: 在 ImportTaskService 构造函数注入 AudioService，新增 resolveAudioPlatformId 辅助方法和音频 MIME 映射
    status: completed
    dependencies:
      - update-import-module
  - id: add-audio-path-matching
    content: 在 processTask 方法中增加 audios/ 路径匹配逻辑和 mediaType==='audios' 处理分支，含七牛上传+voice入库+艺人平台绑定
    status: completed
    dependencies:
      - inject-audio-service
  - id: verify-audio-flow
    content: 验证完整链路：无JSON的mp3 ZIP能正确解析到voice表，艺人/平台可选绑定，shootDate为上传时间，不触发SocialPost同步
    status: completed
    dependencies:
      - add-audio-path-matching
---

## 产品概述

在现有的 import-task 数据集导入模块中，增加对纯 mp3 音频 ZIP 包（无 JSON 元数据文件）的解析支持。当用户上传包含 mp3 文件的 zip 包且包内没有 jsonl/json 元数据时，系统应将音频文件解析并导入到 audio 列表（voice 表）中。

## 核心功能

- **音频 ZIP 包检测与解析**：在 processTask 流程中识别 zip 内的 `audios/` 目录结构下的音频文件（mp3/m4a/wav/aac 等）
- **纯音频导入模式**：当 zip 中无 JSONL/JSON 元数据文件但存在音频文件时，走独立的音频入库流程
- **艺人绑定**：如果任务配置了 artistId，则绑定到 voice 记录；未配置则留空
- **平台绑定**：如果任务配置了 type 字段（平台类型），则映射为 tagPlatformId 绑定到 voice 记录；未配置则留空
- **时间字段**：shootDate 使用当前上传时间（new Date()），而非从元数据提取
- **跳过同步**：音频记录不同步到 SocialPost/SocialPostMedia 表
- **七牛上传复用**：使用已有的 uploadBufferToQiniu 方法上传音频到七牛云存储
- **元数据自动补充**：入库后自动触发 AudioService 的 enrichAudioMetadata 获取时长/编码/比特率

## 边界条件

- 音频文件最小体积校验（< 1KB 视为无效文件）
- 支持的音频格式：mp3、m4a、wav、aac、ogg、flac
- ZIP 内路径格式预期：`audios/<任意目录层级>/filename.mp3` 或直接在根目录的音频文件
- 如果 zip 同时包含 images/videos 和 audios，各自按原有流程独立处理

## 技术栈

- **后端框架**：NestJS + TypeScript
- **数据库 ORM**：Prisma（voice 表 / PhotoPlatform 表）
- **文件存储**：七牛云（分片上传）
- **解压库**：AdmZip
- **目标模块**：import-task 模块扩展 + 复用 audio 模块的 AudioService

## 实现方案

### 总体策略

在 `ImportTaskService.processTask()` 方法的主循环中，增加第三种媒体类型 `audios` 的处理分支。当文件路径匹配 `audios/` 前缀时，走纯音频导入流程——上传七牛、创建 voice 记录、绑定艺人和平台信息。此分支完全独立于现有的 images/videos 逻辑和 SocialPost 同步逻辑。

### 关键技术决策

1. **模块依赖注入**：ImportTaskModule 需要引入 AudioModule，使 ImportTaskService 可以注入 AudioService 并调用其 create() 方法完成入库。AudioService.create() 已封装完整的 voice 记录创建逻辑（含异步音频元数据补充）。

2. **路径匹配策略**：新增正则 `/^audios\/(.+)$/` 匹配音频文件路径，兼容 `audios/by-month/202401/song.mp3` 等多级目录嵌套。同时保留对根目录散落音频文件的兜底匹配（文件扩展名为音频格式但不在 images/videos/audios 目录下）。

3. **平台 ID 映射**：task.type 到 tagPlatformId 的映射通过查询 photoPlatform 表实现，与现有 Instagram 格式的 platformId 解析方式一致。

4. **无 JSON 时的行为差异**：

- note 为 null/undefined → 不进入 SocialPost 同步块（第727行条件不满足）
- shootDate 使用 new Date() 而非 extractShootDate()
- title/description 使用文件名而非元数据

### 数据流

```
ZIP 上传 → 解压 → 检测文件类型
├── images/videos + 有JSON → 现有流程（不变）
├── audios/ + 无JSON → 新增：音频入库流程
│   ├── uploadBufferToQiniu() → 七牛URL
│   ├── AudioService.create() → voice记录
│   │   ├── artistId: task.artistId（可选）
│   │   ├── tagPlatformId: 从task.type映射（可选）
│   │   └── shootDate: new Date()
│   └── 跳过SocialPost同步
└── 其他格式 → fail计数
```

## 实现细节要点

### 目录结构变更

```
e:/Project/backend/src/
├── import-task/
│   ├── import-task.module.ts      # [MODIFY] 新增 AudioModule 导入
│   └── import-task.service.ts     # [MODIFY] 增加音频处理分支
```

### import-task.service.ts 核心修改点

1. **构造函数注入 AudioService**（约第17-20行）
2. **processTask 方法内**：

- 文件过滤阶段（~第433-441行）：确保音频扩展名文件不被排除
- 路径匹配阶段（~第459-471行）：增加 `audios/` 路径匹配分支
- 主循环内部（~第536行之后）：增加 `mediaType === 'audios'` 的处理块
- 在音频处理块中：调 AudioService.create() 入库，统计 createdCount

3. **新增辅助方法** `resolveAudioPlatformId(type: string)` ：根据 task.type 查询 photoPlatform 表获取平台ID
4. **mimeMap 扩展**：补充音频格式的 MIME 映射（audio/mpeg, audio/mp4, audio/wav 等）

### import-task.module.ts 修改

- imports 数组中追加 AudioModule

### 性能与可靠性考量

- 音频上传使用已有分片上传方法，大文件无忧
- AudioService.create() 内部已异步执行 enrichAudioMetadata，不阻塞主流程
- 错误处理：单条音频失败不影响其他文件处理，计入 failCount