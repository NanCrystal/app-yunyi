---
name: fix-page-methods-wrapper
overview: "修复5个 Page() 页面中错误使用 methods: {...} 包裹方法的问题，将所有方法提升为 Page 对象的直接属性"
todos:
  - id: fix-photos
    content: 修复 photos.ts：移除 methods 包裹，提升方法为顶层属性
    status: pending
  - id: fix-videos
    content: 修复 videos.ts：移除 methods 包裹，提升方法为顶层属性
    status: pending
  - id: fix-schedule
    content: 修复 schedule.ts：移除 methods 包裹，提升方法为顶层属性
    status: pending
  - id: verify
    content: 验证修复后代码无语法错误，真机调试正常
    status: pending
    dependencies:
      - fix-photos
      - fix-videos
      - fix-schedule
---

## 需求描述

修复微信小程序中3个页面文件错误使用 `methods: {...}` 包裹方法的问题。这3个文件使用 `Page()` 注册页面，但错误地将方法放在了 `methods` 对象中（`methods` 只适用于 `Component()`），导致真机调试报错 `SyntaxError: Unexpected token`。

## 核心功能

- 修复 `photos.ts`：移除 `methods: {` 和对应的结束 `}`，将方法提升为 Page 对象顶层属性
- 修复 `videos.ts`：移除 `methods: {` 和对应的结束 `}`，将方法提升为 Page 对象顶层属性
- 修复 `schedule.ts`：移除 `methods: {` 和对应的结束 `}`，将方法提升为 Page 对象顶层属性

## 范围说明

- 需要修复：`photos.ts`、`videos.ts`、`schedule.ts`（使用 `Page()` 但错误使用 `methods: {...}`）
- 无需修复：`index.ts`、`mine.ts`（使用 `Component()`，`methods: {...}` 是正确用法）
- 无需修复：`components/` 和 `behaviors/` 下的文件（使用 `Component()` 或 `Behavior()`，`methods: {...}` 是正确用法）

## 技术栈

- 微信小程序原生开发（TypeScript）
- 项目路径：`miniprogram/pages/`

## 实现方案

### 问题原因

微信小程序中 `Page()` 和 `Component()` 的写法不同：

- `Page()`：方法必须直接作为配置对象的顶层属性，不能用 `methods` 包裹
- `Component()`：方法必须放在 `methods: {...}` 对象中

当前3个文件错误地在 `Page()` 中使用了 `methods: {...}` 包裹方法。

### 修复策略

对于每个文件，执行以下操作：

1. 删除 `methods: {` 这一行
2. 删除 `methods` 对象的结束 `}`（保留 Page 配置对象的结束 `}` 和 `));`）
3. 确保方法提升为顶层属性后，方法之间的逗号正确

### 各文件修改详情

#### 文件1：`miniprogram/pages/photos/photos.ts`

- 当前错误结构：
- 第176行：`methods: {`
- 第177行~第1249行：`methods` 对象内的方法
- 第1250行：`},`（`methods` 对象结束）
- 第1251行：`}));`（Page 配置对象结束）
- 修复操作：
- 删除第176行 `methods: {`
- 将第1250行 `},` 改为 `}`（删除 `methods` 对象结束的 `}` 和逗号）
- 或者：删除第176行 `methods: {`，删除第1251行 `}));` 中的第一个 `}`（`methods` 对象结束）

#### 文件2：`miniprogram/pages/videos/videos.ts`

- 当前错误结构：
- 第150行：`methods: {`
- 第151行~第893行：`methods` 对象内的方法
- 第894行：`},`（`methods` 对象结束）
- 第895行：`}));`（Page 配置对象结束）
- 修复操作：同 `photos.ts`

#### 文件3：`miniprogram/pages/schedule/schedule.ts`

- 当前错误结构：
- 第72行：`methods: {`
- 第73行~第260行：`methods` 对象内的方法
- 第261行：`},`（注意：这里是 `},`，即 `methods` 对象结束 `}` 和逗号）
- 第262行：`}));`（Page 配置对象结束）
- 修复操作：同 `photos.ts`

### 验证方案

修复完成后：

1. 检查 TypeScript 编译是否有错误
2. 在微信开发者工具中进行真机调试，确认无 `SyntaxError`
3. 测试页面功能，确认方法能被正确调用