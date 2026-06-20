---
name: comments-enhancement
overview: 为留言板新增3项功能：(1)用户自己发送的新留言闪烁放大高亮动画(2)并发场景下的性能优化策略 (3)未登录时点击按钮先弹登录弹窗，登录后才弹出输入框
design:
  architecture:
    component: tdesign
  styleKeywords:
    - Dark Space Neon
    - Spotlight Pulse
    - Glow Effect
    - Breathing Animation
    - Minimalist Black
  fontSystem:
    fontFamily: PingFang SC
    heading:
      size: 20px
      weight: 600
    subheading:
      size: 16px
      weight: 500
    body:
      size: 14px
      weight: 400
  colorSystem:
    primary:
      - "#6C63FF"
      - "#00D4FF"
      - "#FF6B9D"
    background:
      - "#000000"
      - rgba(0,0,0,0.85)
    text:
      - "#FFFFFF"
      - rgba(255,255,255,0.9)
    functional:
      - "#00FF88"
      - "#FF4444"
      - "#FFAA00"
todos:
  - id: spotlight-animation
    content: 实现新留言聚光灯闪烁放大动画（comments.ts 增加 spotlightComment 状态和清理逻辑 + comments.wxml 新增聚光灯层 + comments.wxss 新增 spotLightPulse keyframes 动画）
    status: completed
  - id: login-gate
    content: 实现登录拦截机制（comments.ts 的 openInputPanel 增加 isLoggedIn 检查 + comments.wxml 引入 login-popup 组件 + comments.json 注册组件）
    status: completed
---

## 产品概述

留言墙页面的两项增强功能：新留言发送成功后的闪烁放大高亮动画（3秒停留），以及登录拦截机制（未登录用户点击留言按钮先触发登录，登录成功后再次点击才弹出输入框）

## 核心功能

### 1. 新留言发送成功 - 聚光灯动画效果

- 用户发送留言成功后，该条留言以**独立聚光灯层**的形式居中显示在屏幕上
- 动画效果：从 scale(0) 放大到 scale(1.2) 再回弹到 scale(1)，伴随 2-3 次透明度闪烁（opacity: 1 → 0.4 → 1），同时带有外发光(glow)脉冲
- 动画持续 **3 秒**，3秒后平滑淡出移除
- 该聚光灯层与现有气泡系统**完全独立**，不影响底层气泡的轮换/刷新逻辑

### 2. 并发安全性分析

- 采用"聚光灯叠加层"方案：新增留言的高亮渲染是**单独的 DOM 节点**，不在 bubbles 数组内
- 每个客户端只维护自己的 `spotlightComment` 状态（纯客户端状态），100个用户并发发送 = 各自客户端只多渲染1个聚光灯节点
- 不修改 `refreshBubbles()` / `refreshBatch()` 的任何逻辑，气泡系统的全量刷新不会打断聚光灯动画
- 性能影响：仅增加 1 个绝对定位的 view 节点 + CSS animation，可忽略不计

### 3. 登录拦截机制

- 未登录状态下点击右下角留言按钮 → 弹出 login-popup 登录组件（复用项目已有的 login-popup）
- 登录成功后关闭弹窗，用户需**再次点击**留言按钮 → 才弹出输入框
- 已登录状态下点击按钮行为不变（直接弹出输入框）

## 技术栈

- 微信小程序原生框架（TypeScript + WXML + WXSS）
- 复用项目已有基础设施：`utils/auth.ts`（isLoggedIn/login）、`components/login-popup`、`services/request`

## 实现方案：聚光灯叠加层（Spotlight Overlay Pattern）

### 核心架构决策

**为什么不用"在气泡数组中标记特殊项"的方案？**

- 当前 `refreshBubbles()` 使用 `sampleAndBuild` 全量随机重建，会丢失特殊标记
- 当前 `refreshBatch()` 定期替换到期槽位，可能覆盖正在播动画的气泡
- 100个用户并发时，如果每个用户的新留言都混入 bubbles 数组，会导致频繁 setData 刷新整个列表

**聚光灯叠加层方案的优势：**

- 渲染管道完全隔离：聚光灯是独立的 WXML 节点和数据源（`spotlightComment`）
- 动画生命周期独立管理：通过 setTimeout 3秒后自动清理，不受气泡轮换影响
- 零侵入：不改动 BubbleConfig 接口、不改动 sampleAndBuild / refreshBubbles / refreshBatch 任何逻辑
- 并发安全：每客户端仅 1 个聚光灯节点，N 个用户并发 = N 个客户端各多 1 节点

### 数据流设计

```
用户点击发送 → submitComment()
  → POST /comments 成功
  → _allComments.unshift(newComment)
  → refreshBubbles() （原有逻辑不变）
  → 设置 spotlightComment = { content, id }  [新增]
  → 3秒后 spotlightComment = null  [新增，自动清理]
```

### 动画技术选型：纯 CSS keyframes（非 wx.createAnimation）

- 理由：微信小程序中 CSS animation 由 GPU 合成线程处理，不阻塞 JS；wx.createAnimation 每次 export 都要跨线程通信，且需要反复 setData 更新 animation data
- 动画阶段设计（总长 3s）：
- 0%: scale(0), opacity(0)
- 15%: scale(1.25), opacity(1) [弹性放大]
- 30%: scale(0.95), opacity(0.5) [第一次闪烁收缩]
- 45%: scale(1.08), opacity(1) [第二次放大]
- 60%: scale(1), opacity(0.6) [第二次闪烁]
- 75%: scale(1.02), opacity(1) [稳定]
- 85%: scale(1), opacity(1) [持续展示]
- 95%: scale(1), opacity(0.8) [开始淡出]
- 100%: scale(0.95), opacity(0) [完全消失]

### 登录拦截流程设计

```
点击留言按钮 → openInputPanel()
  → isLoggedIn() ?
      YES → showInputPanel = true （原有逻辑）
      NO  → showLoginPopup = true （新增：弹出登录框）
  
登录成功回调 onLoginSuccess()
  → showLoginPopup = false
  （用户需再次点击按钮 → 此时已登录 → 正常弹出输入框）
```

### 关键实现细节

1. **spotlightComment 数据结构**：仅需 `{ content: string, id: number }`，不需要完整 BubbleConfig（位置固定居中，不需要 left/startY/endY 等参数）
2. **清理时机**：submitComment 中设置 spotlightComment 后，用 `setTimeout(() => { this.setData({ spotlightComment: null }) }, 3000)` 清理；同时在 onHide/onUnload 中也清理，防止页面切换导致残留
3. **防重复提交**：如果 spotlightComment 已存在（上一次动画还没结束），新的提交会覆盖旧的（setData 直接覆盖即可），同时清除旧定时器
4. **login-popup 组件注册**：在 comments.json 的 usingComponents 中添加 `"login-popup": "/components/login-popup/login-popup"`
5. **Z-index 层级**：聚光灯层的 z-index 设为 50（高于 bubbles-layer 的默认层级但低于 input-panel-mask 的 100），确保不被气泡遮挡但不遮挡输入面板

## 目录结构

```
miniprogram/pages/comments/
├── comments.ts          # [MODIFY] 新增 spotlightComment 状态、聚光灯清理逻辑、登录拦截逻辑、loginSuccess 回调
├── comments.wxml        # [MODIFY] 新增聚光灯层节点、login-popup 组件节点
├── comments.wxss        # [MODIFY] 新增 .spotlight-bubble 样式和 @keyframes spotLightPulse 动画
└── comments.json        # [MODIFY] 注册 login-popup 组件
```

## 设计风格：深空霓虹聚焦（Dark Space Neon Spotlight）

整体延续当前留言墙的 Dark Space 极简黑色主题，聚光灯动画采用**霓虹聚焦**视觉风格：

### 视觉概念

当用户发送留言成功后，一条独立的留言从屏幕中央区域浮现，伴随强烈的**呼吸式发光脉冲**效果。背景保持纯黑，聚光灯文字使用动态彩虹色（与气泡色系一致但更亮），外围有多层光晕扩散。动画结束后平滑消融于黑暗中。

### 页面结构变化

在现有三个区块（气泡层、悬浮按钮、输入面板）之上，插入第四个区块：

- **区块4: 聚光灯层**（Spotlight Layer）- 仅在 spotlightComment 有值时显示，position: fixed 居中定位

### 单页区块设计

1. **漂浮气泡层**（已有）- 深空背景上的彩色上升气泡，不做修改
2. **悬浮消息按钮**（已有）- 右下角圆形半透明按钮，点击触发登录检查
3. **聚光灯层**（新增）- 居中的高亮留言展示区，带脉冲发光动画，3秒自动消失
4. **输入面板**（已有）- 右侧滑入胶囊输入框
5. **登录弹窗**（新增）- 复用 login-popup 组件，未登录时弹出

## Agent Extensions

本任务无需使用额外扩展，所有信息均通过代码探索获取。