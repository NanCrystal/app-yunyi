---
name: fix-auth-request-undefined
overview: 修复 auth.ts 中登录时 "request is not defined" 错误：将动态 require 改为 ES6 静态 import
todos:
  - id: fix-auth-import
    content: 将 auth.ts 第 55 行的动态 require 改为顶部 ES6 静态 import，修复登录报错
    status: completed
---

## Product Overview

修复微信小程序登录功能报错问题：`auth.ts:84 [Auth] 登录失败: ReferenceError: request is not defined`

## Core Features

- 修复 `auth.ts` 中第 55 行动态 `require()` 导致的 `request is not defined` 错误
- 将运行时动态导入改为文件顶部 ES6 静态 `import`，确保微信小程序环境正确加载模块

## Tech Stack

- 微信小程序 (TypeScript)

## 实现方案

**根本原因分析**：`auth.ts:55` 使用了动态 `require('../services/request')` 来解构获取 `request` 函数。微信小程序对运行时动态 `require` 支持不稳定，导致模块未能正确加载，解构时抛出 `ReferenceError: request is not defined`。

**解决方案**：将第 55 行的动态 `require`：

```typescript
const { request } = require('../services/request');
```

改为文件顶部的 ES6 静态导入语句：

```typescript
import { request } from '../services/request';
```

**安全性验证**：

- ✅ 无循环依赖风险：`request.ts` 通过直接调用 `wx.getStorageSync('mp_auth_token')` 获取 token，不依赖 `auth.ts`
- ✅ 符合项目现有规范：项目中其他模块均使用 ES6 静态 `import/export`
- ✅ 这是微信小程序推荐的模块引入方式

## Implementation Notes

- 仅修改 `miniprogram/utils/auth.ts` 一个文件
- 在文件顶部（第 5 行之后、第一个函数之前）添加 `import { request } from '../services/request';`
- 删除第 55 行的 `const { request } = require('../services/request');`
- 影响范围极小，仅涉及 import 方式变更，不影响任何业务逻辑

## Architecture Design

修改前：`login()` 函数内部动态 require → 运行时解析失败 → 抛出 ReferenceError
修改后：文件顶层静态 import → 编译时确定依赖 → 正常加载模块

## Directory Structure

```
miniprogram/
├── utils/
│   └── auth.ts    # [MODIFY] 将 require 改为静态 import
```