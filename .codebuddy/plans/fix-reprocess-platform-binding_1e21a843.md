---
name: fix-reprocess-platform-binding
overview: 修复重新处理导入任务时照片无法绑定平台的问题。根因：当用户手动绑定艺人后，后端跳过了自动匹配逻辑导致 platformId 为 null。
todos:
  - id: fix-platform-id-reprocess
    content: 修复 import-task.service.ts 中 reprocess 时 useManualArtist 导致 platformId 为 null 的 Bug
    status: completed
---

## Product Overview

修复"重新处理"功能中，用户通过编辑弹窗选择了艺人后，重新处理时照片/视频无法绑定平台（platformId）的 Bug。

## Core Features

- **Bug 根因**: 后端 `import-task.service.ts` 第 486-519 行，当用户手动绑定了艺人（`useManualArtist=true`）时，代码跳过了 `matchArtist()` 分支，导致 `platformId` 始终为 null。最终第 552 行将 null 写入数据库的 `photoPlatformId` 字段。
- **预期行为**: 重新处理时，若任务已手动绑定艺人，应根据艺人记录中的平台 ID 映射（如 douyinPlatformId、xhsPlatformId 等）正确解析并写入平台绑定。

## Tech Stack

- **后端**: NestJS + Prisma + TypeScript
- **修改文件**: 仅需修改后端 `import-task.service.ts` 一处

## Implementation Approach

在 `processTask` 方法中，当 `useManualArtist = true` 时补充 platformId 解析逻辑：

1. 在现有 `if (note && !useManualArtist)` 分支之后（第 519 行），新增一个分支处理手动绑定艺人的场景
2. 通过 `task.artistId` 查询艺人记录
3. 使用已有的 `detectPlatform(note)` 方法检测平台类型
4. 调用已有的 `getArtistPlatformId(artist, platform)` 方法获取 platformId
5. 对 Instagram 格式的数据也做同样的兼容处理

## Implementation Details

### 修改文件

```
backend/src/import-task/import-task.service.ts   # [MODIFY] 修复 reprocess 时 platformId 为 null 的 Bug
```

### 关键修改点（第 486-519 行区域）

在第 519 行（`}` 关闭 if 块）之后，添加如下逻辑：

```typescript
// 手动绑定艺人时：根据艺人记录和当前平台类型解析 platformId
if (useManualArtist && !platformId) {
  const artist = await this.prisma.artist.findFirst({
    where: { artistId: task.artistId },
  });
  if (artist) {
    const platform = note ? this.detectPlatform(note) : null;
    if (platform) {
      platformId = this.getArtistPlatformId(artist, platform);
    }
    // Instagram 格式：使用已解析的全局 instagramPlatformId
    if (isInstagramFormat) {
      platformId = platformId || instagramPlatformId;
    }
  }
}
```

### 注意事项

- 复用已有的 `detectPlatform()` 和 `getArtistPlatformId()` 方法，保持代码一致性
- Instagram 格式已有全局 `instagramPlatformId` 变量，需要兼容使用
- 不影响非 reprocess 场景（首次导入）的现有逻辑
- 不修改前端代码或 API 接口签名