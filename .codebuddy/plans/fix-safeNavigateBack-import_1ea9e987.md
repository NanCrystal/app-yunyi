---
name: fix-safeNavigateBack-import
overview: 在 photos.ts 中添加 safeNavigateBack 函数的导入，解决运行时 ReferenceError
todos:
  - id: fix-import
    content: 在 photos.ts 中补充 safeNavigateBack 的 import 语句以修复 ReferenceError
    status: completed
---

## 产品概述

修复 `photos.ts:178` 的运行时错误：`ReferenceError: safeNavigateBack is not defined`

## 核心功能

- `onGoBack()` 方法（第 177-179 行）调用了 `safeNavigateBack()` 函数，但该函数未在 `photos.ts` 中导入
- `safeNavigateBack` 函数已存在于 `miniprogram/utils/nav.ts` 中并以 `export` 导出
- 修复方式：在 `photos.ts` 顶部导入区域添加 `import { safeNavigateBack } from "../../utils/nav"`

## 技术栈

- 微信小程序（TypeScript）

## 实现方案

**修复策略**: 在 `photos.ts` 第 12 行（`import { isLoggedIn } from "../../utils/auth"` 之后）添加缺失的 import 语句

**关键决策**:

- `nav.ts` 已导出 `safeNavigateBack`，无需修改源文件
- 仅需在 `photos.ts` 补充一行导入即可解决
- 路径 `../../utils/nav` 与同文件中其他 utils 导入路径一致

## 实现注意事项

- **影响范围**: 仅修改 `photos.ts` 一个文件，仅添加一行 import，无副作用
- **向后兼容**: 不影响任何现有功能