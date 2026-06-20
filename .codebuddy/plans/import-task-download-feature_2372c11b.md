---
name: import-task-download-feature
overview: 在导入任务管理页面增加 ZIP 包下载功能：前端操作列增加下载按钮（默认 CDN 直连），后端新增 GET /:id/download 代理下载接口作为备用
todos:
  - id: backend-download-service
    content: 在后端 import-task.service.ts 中新增 download(id) 方法，使用 axios stream 从七牛 CDN 获取 ZIP 文件流并返回
    status: completed
  - id: backend-download-controller
    content: 在后端 import-task.controller.ts 中新增 GET /:id/download 端点，使用 StreamableFile 流式返回文件并设置正确的 Content-Disposition header
    status: completed
    dependencies:
      - backend-download-service
  - id: frontend-download-service
    content: 在前端 services/importTask.ts 中新增 downloadImportTask 函数，支持后端代理下载的 blob 响应处理
    status: completed
  - id: frontend-download-button
    content: 在前端 ImportMgt/index.tsx 操作列中增加下载按钮，引入 DownloadOutlined 图标，CDN 直连为主路径、后端 API 为备选，调整列宽适配4个按钮
    status: completed
    dependencies:
      - frontend-download-service
---

## Product Overview

在导入数据集管理页面（ImportMgt）的操作列中增加「下载」按钮，允许用户下载已上传的 ZIP 压缩包文件。前端默认通过 CDN 直连七牛云快速下载，后端同步提供代理下载接口作为备用方案（适用于需要权限校验的场景）。

## Core Features

- **前端下载按钮**：在操作列（第412-447行）新增下载按钮，仅在任务有 fileUrl 时显示
- **CDN 直连下载（主路径）**：前端直接拼接 `https://cdn.tauol.online${fileUrl}` 触发浏览器原生下载，无需经过后端
- **后端代理下载接口（备选）**：新增 `GET /api/import-tasks/:id/download` 接口，后端从七牛 CDN 获取文件流并流式返回给客户端
- **错误处理**：CDN 下载失败自动降级到后端 API；无 fileUrl 或任务不存在时给出明确提示

## 技术确认

- ZIP 包存储位置：**七牛云 Kodo**（bucket: `wallpaper-blog`）
- 存储字段：`ImportTask.fileUrl`，值格式 `/uploads/import-tasks/{timestamp}-{random}.zip`
- CDN 完整地址：`https://cdn.tauol.online` + fileUrl

## Tech Stack

- **后端**: NestJS v10 + Prisma ORM + axios + 七牛云 SDK
- **前端**: React + TypeScript + Ant Design 5.x + umi-request

## Tech Architecture

### 系统架构

采用双通道下载策略：

```
用户点击下载
  ├─ 主路径：前端 CDN 直连 → window.open(cdnUrl) → 浏览器直接下载（零后端开销）
  └─ 备选路径：前端调用 GET /api/import-tasks/:id/download 
                → 后端 axios stream 请求七牛 CDN
                → NestJS StreamableFile 流式响应
                → 浏览器接收文件流
```

### 模块划分

- **后端 Service 层**：新增 `download()` 方法，复用已有的 CDN 域名拼接逻辑（与 `processTask` 第317行一致）
- **后端 Controller 层**：新增 `@Get(':id/download')` 端点，使用 NestJS 内置 `StreamableFile` 返回文件流
- **前端 Service 层**：新增 `downloadImportTask(id)` 函数，封装后端下载 API 调用
- **前端 Page 层**：操作列增加下载按钮，主走 CDN 直连，失败回退后端

## Implementation Details

### 核心目录结构

```
e:\Project\backend\src\import-task\
├── import-task.controller.ts    # [MODIFY] 新增 :id/download 端点
└── import-task.service.ts      # [MODIFY] 新增 download() 方法

e:\Project\umi-blog\src\
├── services\importTask.ts       # [MODIFY] 新增 downloadImportTask 函数
└── pages\ImportMgt\
    ├── index.tsx               # [MODIFY] 操作列增加下载按钮
    └── index.less              # [MODIFY] 列宽调整（可选）
```

### 关键实现要点

#### 后端 Service - download() 方法

- 复用现有的 CDN URL 拼接模式（见 service 第317行）：`const cdnDomain = process.env.QINIU_CDN_DOMAIN || process.env.QINIU_DOMAIN; const fullUrl = task.fileUrl.startsWith('http') ? task.fileUrl : \`\${cdnDomain}\${task.fileUrl}\`;`
- 使用 axios 的 `responseType: 'stream'` 从七牛获取文件流
- 返回 `{ stream: PassThrough, filename: string, contentType: string }`
- 异常处理：task 不存在抛 NotFoundException，无 fileUrl 抛 BadRequestException，CDN 请求失败包装为友好错误信息

#### 后端 Controller - download 端点

- 使用 `StreamableFile`（NestJS 10 内置，来自 `@nestjs/common`）
- 设置 Response Header：
- `Content-Type`: `application/zip`
- `Content-Disposition`: `attachment; filename="${encodeURIComponent(task.name)}.zip"`
- 放置在 `@Get(':id')` 之后、`@Put(':id')` 之前（避免路由冲突）

#### 前端 Page - 下载按钮

- 图标引入：在已有图标列表中追加 `DownloadOutlined`
- 按钮位置：操作列 `<Space>` 中，放在「重新处理」按钮之前或之后
- 显示条件：`record.fileUrl && record.fileUrl.length > 0`
- 点击逻辑：

```typescript
const handleDownload = (record: ImportTask) => {
const cdnUrl = `https://cdn.tauol.online${record.fileUrl}`;
const fileName = `${record.name}.zip`;
// 方式1：创建 <a> 标签触发 CDN 直连下载（主路径）
const link = document.createElement('a');
link.href = cdnUrl;
link.download = fileName;
link.target = '_blank';
document.body.appendChild(link);
link.click();
document.body.removeChild(link);
};
```

- 操作列宽度：从 `240` 调整至 `300` 以容纳4个按钮

#### 前端 Service - 下载函数

```typescript
/** 下载导入任务的 ZIP 文件（后端代理方式） */
export async function downloadImportTask(id: number): Promise<Blob> {
  return request(`/import-tasks/${id}/download`, {
    responseType: 'blob',
    getResponse: true,
  });
}
```

注意：umi-request 的 blob 下载需要特殊配置（`responseType: 'blob'`），实际可能改用原生 fetch 或 XMLHttpRequest 实现。