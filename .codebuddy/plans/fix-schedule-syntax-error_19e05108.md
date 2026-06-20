---
name: fix-schedule-syntax-error
overview: 修复 miniprogram/pages/schedule/schedule.ts 第261行的语法编译错误，确保与其他页面（cards/photos/videos）的 withTheme+methods 模式一致
todos:
  - id: fix-syntax-error
    content: 修复 schedule.ts 第261行语法错误：清理隐藏字符并规范 methods 闭合结构，确保与 cards.ts 一致的干净格式
    status: completed
  - id: verify-fix
    content: 验证修复结果：确认 lint 错误清除、微信开发者工具编译通过、home 到 schedule 跳转正常
    status: completed
    dependencies:
      - fix-syntax-error
---

## 产品概述

排查并修复 `schedule.ts` 页面的编译语法错误，同时确认 `audio`、`cards`、`photos`、`videos` 四个页面是否存在相同的语法问题。

## 核心功能需求

- **根因定位**：`schedule.ts` 第261行报 `SyntaxError: Unexpected token, expected ","`，导致从 home 跳转至 schedule 页面时白屏报错 `module 'pages/schedule/schedule.js' is not defined`
- **范围排查**：检查 audio/cards/photos/videos 共4个页面的 `.ts` 文件是否存在相同模式的问题
- **修复目标**：消除 schedule.ts 的编译错误，使页面能正常跳转和加载

## 技术栈

- **平台**：微信小程序 (TypeScript)
- **构建工具**：微信开发者工具内置编译器 (lib: 3.10.3, mp: 2.01.2510290)
- **关键模块**：`withTheme()` 行为混入函数 (`miniprogram/behaviors/theme.ts`)

## 技术架构

### withTheme 工作原理

```
Page(options) 
  → withTheme(options) 提取 options.methods
  → Object.assign(options, userMethods) 将 methods 内方法合并到选项对象
  → 注入 themeColor/data、包装 onLoad/onShow
  → 返回增强后的 options
```

### 各页面结构对比

| 页面 | 结构模式 | 状态 |
| --- | --- | --- |
| **schedule.ts** | `withTheme({ data, onLoad, methods: {...} })` | **有错误 L261** |
| audio.ts | `withTheme({ data, onLoad, onUnload, 方法扁平散列 })` | 正常（无methods包装） |
| cards.ts | `withTheme({ data, onLoad, methods: {...} })` | 正常 |
| photos.ts | `withTheme({ data, onLoad, onUnload, methods: {...} })` | 正常 |
| videos.ts | `withTheme({ data, onLoad, onUnload, methods: {...} })` | 正常 |


### 根因分析结论

1. **schedule.ts 是唯一有错误的页面**，audio/cards/photos/videos 均无此问题
2. schedule.ts 源码结构与正常的 cards/photos/videos **完全一致**
3. 从源码肉眼检查：括号匹配正确、`methods:` 对象正常闭合、末尾 `}))` 格式正确
4. **最可能原因**：文件中存在隐藏字符（零宽字符 ZWJ/ZWNJ、非断空格 NBSP、BOM 等）或编码不一致，导致编译器解析到第261行时解析状态异常，误报 "expected ','"
5. 此类问题通常由跨编辑器复制粘贴或编码转换引入

### 排查数据支撑

- TypeScript Lint 诊断明确报错：`[ERROR] Line 261: 应为","。 (Source: ts, Code: 1005)`
- 微信开发者工具编译输出：`SyntaxError: unknown: Unexpected token, expected "," (261:1)` 指向 `}))` 处
- 运行时报错链：编译失败 → `schedule.js` 未生成 → `module not defined` → 白屏 + wx://not-found

## 实现方案

采用**安全重写修复**策略：

1. **备份后重写** `schedule.ts` 的闭合区域（第250-262行），确保无隐藏字符
2. 若重写末尾无效，则对 `methods` 块整体进行规范化重写（参照 cards.ts 的标准格式）
3. 验证修复后编译通过且页面跳转正常

## 关键注意事项

- 仅修改 `schedule.ts` 一个文件，不触碰其他4个已确认正常的页面
- 保持 `withTheme` + `methods:` 包装结构不变（与项目约定一致）
- 不改变任何业务逻辑，仅修复语法/字符层面问题