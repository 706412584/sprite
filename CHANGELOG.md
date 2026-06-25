# 更新日志

本项目的所有重要更改都会记录在此文件。格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)。

## [0.1.5] - 2026-06-25

### 新增
- **动画预设系统**：69 个动作预设（移动、战斗、情感、状态、交互、特殊）
- **8方向系统**：5方向AI生成 + 3方向镜像，节省37.5%生成成本
- **质量评分系统**：帧数匹配、方向完整性、帧间一致性、流畅度评分
- **rectpack 集成**：MaxRectsBssf 算法优化 sprite sheet 打包
- **Aseprite CLI 集成**：sprite sheet 导出、批量格式转换（可选）

## [0.1.4] - 2026-06-25

### 修复
- **批处理 60 秒停滞 bug**：`apply_matte_pipeline` 的 spriteflow/luma/birefnet 分支缺少 `on_progress` 回调，导致前端 stall 检测误判
- 进度计算从 `round(...*20)` 改为整除 `...*23//total`，保证每帧都有整数进度变化

### 新增
- **背景补全功能**：独立 tab，复用智能切片 rects，后端 LaMa/cv2.inpaint 填洞
- 背景补全支持拖拽缩放补齐框
- 背景补全结果保留原始透明通道

## [0.1.3] - 2026-06-24

### 修复
- 背景补全框选区域拖拽缩放中断问题（改用 window 级 mousemove/mouseup）
- 背景补全结果丢失 alpha 通道

## [0.1.2] - 2026-06-23

### 新增
- UI 智能切片结果可导入背景补全面板
- 背景补全 API `/api/bg-inpaint`

## 0.1.1 - 2026-05-15

### Documentation
- Add a full English usage guide alongside the Chinese guide.
- Expand both guides with user-facing BiRefNet, BiRefNet + Luma, subject-protection preset, and CorridorKey workflows.
- Add language links between the English and Chinese guides.

## 0.1.0 - 2026-05-15

### Features
- Add Luma subject-protection presets for BiRefNet + Luma workflows.
- Add preview post-processing for green residue and semi-transparent edge pixels.
- Add batch post-processing options for processed frame outputs.
- Add reverse animation preview and reverse-order export.
- Improve CorridorKey handling for large GPU post-processing workloads.

### Documentation
- Add a detailed Chinese usage guide covering setup, workflows, tuning, export, and troubleshooting.
