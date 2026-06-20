---
name: Comment-留言墙-产品方案
overview: 将 Comment 留言墙页面的交互逻辑与漂浮气泡动画整理为完整的产品方案文档，涵盖功能规格、动画体系、视觉规范、交互细节及扩展方向。
todos:
  - id: analyze-source
    content: 深度分析 Comment 页面源码（index.tsx + index.less + service + utils）提取全部交互与动画参数
    status: completed
  - id: build-prd-content
    content: 构建完整 PRD 文档内容：8大章节含功能规格、动画参数表、状态机、边界条件
    status: completed
    dependencies:
      - analyze-source
  - id: generate-docx
    content: Use [skill:docx] 生成专业排版的 Word 产品规格说明书文档并输出
    status: completed
    dependencies:
      - build-prd-content
---

## Product Overview

将 `umi-blog` 项目中的 **Comment 留言墙页面** 的交互逻辑与动画效果整理为一份详细的产品规格说明书（PRD），涵盖功能定义、视觉设计规范、动画技术规格、交互流程、状态机、边界条件及错误处理等全维度内容。该页面是一个以「漂浮气泡留言墙」为核心视觉表现形式的用户留言交互系统，采用 Bugatti 极简黑色主题设计风格，留言以彩色气泡形式在屏幕上持续上浮飘动，底部配有胶囊形输入栏供用户发布新留言。

## Core Features

- **漂浮气泡留言墙**：所有历史留言以彩色气泡形态持续向上漂浮，形成动态弹幕式视觉效果
- **气泡动画系统**：基于 CSS `@keyframes floatUp` 关键帧动画实现无限循环漂浮，每条气泡具有随机化的位置、大小、颜色、速度和延迟参数
- **底部输入栏**：固定于屏幕底部的圆角胶囊形输入区域，包含文本域 + 发送按钮
- **发送交互**：支持 Enter 快捷键发送、Shift+Enter 换行、100 字符长度限制、发送中禁用态
- **管理员删除**：仅管理员角色可见的气泡删除操作入口（× 按钮）
- **CRUD 数据接口**：对接后端 RESTful API 实现留言的增删查
- **视觉主题**：Bugatti 极简黑色主题，全局暗色系配色方案

### 交付物要求

生成一份结构完整的 **Word 产品规格说明书**（.docx 格式），需包含以下章节：

1. 产品概述与定位
2. 功能规格说明
3. 视觉设计规范（色彩/字体/布局）
4. 动画技术规格（关键帧参数表/时序图/随机参数范围）
5. 交互流程与状态机
6. 用户场景与用例
7. 边界条件与异常处理
8. 技术架构说明

## Tech Stack

- **文档格式**: Microsoft Word (.docx)
- **文档生成方式**: 使用 [skill:docx] 技能自动生成专业排版的产品规格说明书文档
- **参考源码**: 基于 `e:/Project/umi-blog/src/pages/Comment/index.tsx` 和 `index.less` 的实际代码分析

## Tech Architecture

### 文档架构

采用标准产品需求文档（PRD）分层结构，从产品概述逐层深入到技术实现细节：

```
Product Spec Document (PRD)
├── Chapter 1: 产品概述 (Overview)
│   ├── 产品定位与目标用户
│   ├── 核心价值主张
│   └── 页面信息架构图
├── Chapter 2: 功能规格 (Feature Specs)
│   ├── 功能清单 (Feature List)
│   ├── 权限模型 (RBAC - Admin/User)
│   └── 数据模型 (CommentItem / BubbleConfig)
├── Chapter 3: 视觉设计规范 (Visual Design System)
│   ├── 色彩系统 (Bugatti Dark Theme)
│   ├── 字体系统 (--font-body serif / --font-mono monospace)
│   ├── 布局规范 (Fixed Full-screen + Floating Input Bar)
│   └── 组件样式规格 (Bubble / InputBar / SendButton / DeleteButton)
├── Chapter 4: 动画技术规格 (Animation Specification)
│   ├── floatUp 关键帧定义 (4 阶段: 淡入 → 保持 → 上浮 → 淡出)
│   ├── 随机参数配置表 (7 维参数: left/startY/endY/delay/duration/fontSize/color)
│   ├── 动画时序图 (Timeline Diagram)
│   └── 性能指标 (帧率/节点数/内存考量)
├── Chapter 5: 交互流程 (Interaction Flows)
│   ├── 发送留言流程 (Submit Flow)
│   ├── 删除留言流程 (Delete Flow - Admin Only)
│   ├── 页面加载流程 (Init Flow)
│   └── 状态机图 (State Machine Diagram)
├── Chapter 6: 用户场景 (User Scenarios)
│   ├── 正常使用场景
│   ├── 管理员场景
│   └── 异常场景
├── Chapter 7: 边界条件与异常处理 (Edge Cases & Error Handling)
│   ├── 输入校验规则
│   ├── 网络异常处理
│   ├── 并发安全考虑
│   └── 浏览器兼容性
└── Chapter 8: 技术架构 (Technical Architecture)
    ├── 技术栈 (React + TypeScript + Less + Ant Design)
    ├── 接口契约 (RESTful API)
    ├── 组件结构图
    └── 文件组织
```

### Implementation Notes

- **文档语言**: 中文（简体）
- **专业术语保留英文原文**: 如 CSS @keyframes, React, TypeScript, API 等
- **表格化参数展示**: 所有数值型参数统一使用表格呈现，包含参数名、类型、默认值/范围、说明四列
- **Mermaid 图表嵌入**: 在文档中使用 Mermaid 渲染状态机和时序图（如 docx 支持则内嵌，否则用文字描述+ASCII 替代）
- **代码片段引用**: 关键 CSS 动画代码和 TypeScript 接口定义以代码块形式附录
- **Grounded 内容**: 所有规格数据均来自实际源码分析，不虚构任何参数值

本任务为**文档生成任务**，不涉及 UI 界面创建或重构，因此不适用设计模块。核心交付物是一份专业的 Word 产品规格说明书文档。

## Agent Extensions

### Skill

- **docx**
- Purpose: 将 Comment 页面交互与动画的完整产品规格生成为专业的 Word 文档（.docx 格式）
- Expected outcome: 产出一份排版精美、结构完整的产品需求规格说明书，包含产品概述、功能规格、视觉设计规范、动画技术规格（含 floatUp 关键帧详解与 7 维随机参数表）、交互流程状态机、用户场景、边界条件和技术架构共 8 大章节，支持目录导航、表格化参数呈现、代码块引用等专业化排版特性