---
name: fix-video-page-initial-lazy-load
overview: 修复视频页面初始加载时未自动预加载可见月份的问题：在 loadVideosFromServer 完成后主动调用一次 _lazyLoadVisibleMonths(0)
todos:
  - id: fix-initial-lazy-load
    content: 在 videos.ts 的 onLoad 方法中，loadVideosFromServer 之后添加 _lazyLoadVisibleMonths(0) 调用
    status: completed
---

## 产品概述

修复视频馆页面初始加载时，首屏可见的月份分组（红色框区域，如2025年12月）无法自动加载的问题。当前行为是页面进入后只有第一个月份（2026年02月）加载完成，其余月份必须用户手动滑动页面才会触发懒加载。

## 核心功能

- 页面初始化完成后，自动预加载所有在首屏可见区域内的月份视频数据
- 无需用户滑动即可看到已加载的视频内容（封面图、标题等）

## 技术栈

- 微信小程序原生框架 (TypeScript + WXML + WXSS)

## 实现方案

### 问题根因分析

通过代码排查确认了三个关联问题：

1. **`loadVideosFromServer`（第226-228行）**：初始化时仅加载 timeline 中第1个月份 `timelineItems[0]`（2026年02月），不会加载后续月份
2. **`onScroll`（第633-652行）**：`_lazyLoadVisibleMonths` 方法仅在滚动事件中被调用（带150ms节流）
3. **`onLoad`（第113-145行）**：数据加载完成后未主动触发一次可见性检测来预加载首屏月份

### 修复策略

在 `onLoad` 方法中，`loadVideosFromServer` 完成后、`isLoading` 设为 false 前，添加一行调用 `_lazyLoadVisibleMonths(0)`。该方法会以 scrollTop=0 计算当前视口范围内所有可见的月份分组，并对其中未加载且未在 loading 状态的月份发起 `loadMonth` 请求。

### 关键修改点

**文件**: `e:/Project/app-yunyi/miniprogram/pages/videos/videos.ts`

**位置**: `onLoad` 方法内，第142行 `await this.loadVideosFromServer(artistId);` 之后

**修改内容**: 添加 `this._lazyLoadVisibleMonths(0);` 调用

### 实现注意事项

- `_lazyLoadVisibleMonths(0)` 内部已有完整的可见性计算逻辑：遍历 groupedVideos 累加高度、判断与视口交集、逐个触发 loadMonth（同一时刻只触发1个避免并发）
- 该方法内部使用 `groupedVideos` 和 `gridCellSize` 数据，此时均已由前面的 `loadVideosFromServer` 和 `_calcGridCellSize()` 初始化完毕
- 不需要额外的 setTimeout 延迟，因为 setData 是同步调用的，数据已在 this.data 中就绪

## 架构设计

无需架构变更，仅补充缺失的初始预加载触发点。

## 目录结构

```
miniprogram/pages/videos/
├── videos.ts   # [MODIFY] 在 onLoad 方法中添加 _lazyLoadVisibleMonths(0) 初始调用
```