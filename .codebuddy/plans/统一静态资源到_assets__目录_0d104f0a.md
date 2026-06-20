---
name: 统一静态资源到 assets/ 目录
overview: 将 pages/assets/ 下的所有静态资源移动到根目录 assets/ 下，并更新所有文件中的引用路径。
todos:
  - id: update-references
    content: 批量更新7个代码文件中的资源引用路径，统一替换为 /assets/icons/ 和 /assets/images/ 绝对路径
    status: completed
  - id: move-assets
    content: 将 pages/assets/icons/ 和 pages/assets/images/ 下所有静态资源文件移动到 assets/ 对应目录
    status: completed
    dependencies:
      - update-references
  - id: cleanup-directory
    content: 删除 pages/assets/ 空目录结构及其子目录
    status: completed
    dependencies:
      - move-assets
---

## 产品概述

对小程序项目的静态资源进行统一管理的重构工作，将分散在 `pages/assets/icons/`、`pages/assets/images/` 的资源文件移动到根目录 `assets/icons/`、`assets/images/` 下，并更新所有代码文件中的资源引用路径。

## 核心功能

- 将 `pages/assets/icons/` 下的15个图标文件移动到 `assets/icons/`（两组目录文件无重名冲突，可直接合并）
- 将 `pages/assets/images/` 下的2张图片移动到 `assets/images/`
- 删除空的 `pages/assets/` 目录结构
- 更新所有代码文件中的资源引用路径，统一使用绝对路径 `/assets/icons/` 和 `/assets/images/`

## 技术栈

- 微信小程序静态资源管理
- 批量文件路径替换

## 实现方案

### 文件合并策略

两组 icons 目录文件无重名冲突（`home.png` 与 `home.svg` 为不同文件），可直接合并：

- `pages/assets/icons/`（15个svg）→ `assets/icons/`
- `pages/assets/images/`（2张图片）→ `assets/images/`

### 路径替换规则

统一使用绝对路径，避免相对路径因页面层级变化而失效：

- `/pages/assets/icons/` → `/assets/icons/`
- `/pages/assets/images/` → `/assets/images/`
- `../assets/icons/` → `/assets/icons/`

### 涉及修改的文件清单

| 文件 | 引用类型 | 需替换处数 |
| --- | --- | --- |
| `pages/sync/sync.ts` | 绝对路径 | 4处 |
| `pages/home/home.wxml` | 绝对路径 + 模板表达式 | 2处 |
| `pages/home/home.ts` | 绝对路径 | 5处 |
| `pages/audio/audio.wxml` | 绝对路径 + 模板表达式 | 11处 |
| `pages/videos/videos.wxml` | 相对路径 | 5处 |
| `pages/schedule/schedule.wxml` | 相对路径 | 1处 |
| `pages/photos/photos.wxml` | 相对路径 | 5处 |


## 实现注意事项

- 先更新代码中的引用路径，再移动文件，避免引用断裂
- `home.wxml` 中模板表达式内的路径需特殊处理（`{{'../assets/icons/audioplay.svg'}}` → `{{'/assets/icons/audioplay.svg'}}`）
- 移动完成后删除 `pages/assets/icons/`、`pages/assets/images/`、`pages/assets/` 三级空目录