---
name: fix-modulelist-null-check
overview: 修复 home.ts 第 234 行的 TypeScript 空值检查错误
todos:
  - id: fix-null-check
    content: 修复 home.ts 第 234 行 moduleList 空值检查，将 moduleList.length 改为 moduleList?.length
    status: completed
---

## 产品概述

修复 `home.ts` 第 234 行的 TypeScript 类型错误：`moduleList` 可能为 `null`

## 核心功能

- 消除 TS 编译器对 `moduleList.length` 的空值报警
- 保持原有业务逻辑不变（仅在 moduleList 有数据时写入缓存）

## 技术栈

- 语言：TypeScript（微信小程序环境）
- 目标文件：`miniprogram/pages/home/home.ts`

## 问题分析

### 根因定位（严重度: 🟡 minor）

**文件**: `miniprogram/pages/home/home.ts`，**行号**: 229-234

```typescript
let moduleList = this.loadModuleConfigFromCache(selectedCharId);  // 返回类型可能含 null
if (!moduleList || moduleList.length === 0) {
  try {
    const modRes = await get("/integration/home/modules", { artistId: selectedCharId });
    moduleList = modRes.modules || [];   // ← 重新赋值，TS 无法做控制流类型收窄
    if (moduleList.length > 0) {          // ← 第234行报错：moduleList 可能为 null
```

**原因链**:

1. `loadModuleConfigFromCache()` 返回类型可能包含 `null | undefined`
2. 变量在 if 块内部被**重新赋值**（第 233 行），TypeScript 对重新赋值的变量不会继承外层条件判断的类型收窄结果
3. 虽然 `modRes.modules || []` 在逻辑上保证非空，但 TS 类型推断无法跨赋值边界传播这一保证

### 修复方案

采用**可选链操作符 (`?.`)** 进行防御性空值检查：

```typescript
// 修改前 (第 234 行)
if (moduleList.length > 0) {

// 修改后
if (moduleList?.length > 0) {
```

**方案选择理由**:

- **可选链 `?.`**: 最轻量、最符合防御性编程惯用法的修复方式，语义清晰——"如果 moduleList 存在且有内容则缓存"，零运行时开销
- 备选方案对比：
- 非空断言 `!`（`moduleList!.length`）: 不安全，掩盖潜在 null 风险
- 显式类型标注: 过度工程化，改动范围大
- 提前 return/continue: 改变控制流结构，不必要

### 影响范围

- 仅修改第 234 行一行代码
- 不影响任何下游逻辑（第 242 行 setData、第 247 行 for...of 循环均有隐式或显式的空值保护）