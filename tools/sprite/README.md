# Sprite Video Lab

Sprite Video Lab 是一个本地网页工具，用来把视频片段、单张图片或已有序列帧整理成干净的 2D Sprite 资源。

它适合这些工作流：

- 导入本地视频、图片或动画序列帧。
- 截取有用的帧范围。
- 按固定间隔抽帧。
- 去除纯色背景、绿幕/蓝幕背景或 AI 生成背景。
- 用 Luma 保留发光、火焰、闪电、粒子等亮部特效。
- 统一帧尺寸，支持自动宽度画布或方形落地/居中画布。
- 导出透明 PNG 帧、Sprite Sheet、JSON manifest 和 zip 包。

项目优先服务 Windows 本地工作流。前端是 React + TypeScript + Vite，后端是本地 Python HTTP 服务，运行时依赖 Pillow、ffmpeg 和可选 AI 模型。

## 功能

### 最近更新 (v0.1.4)
- 背景补全功能：复用智能切片结果，LaMa AI 填充被抠掉的背景
- 修复批处理 60 秒停滞问题

### 核心功能
- 本地路径导入和拖拽上传。
- 视频区间预览，支持按帧设置起止位置。
- 批处理前先单帧预览参数效果。
- 自动宽度居中画布，适合横向连招、特效条、多姿态行。
- 纯色/绿幕抠图，支持阈值、软边、去色溢出和 Halo 收缩。
- BiRefNet AI 主体抠图。
- Luma 亮度抠图，用来保留发光、火焰、闪电、粒子和亮部 VFX。
- CorridorKey 绿幕/蓝幕边缘精修和前景颜色重建。
- `BiRefNet + Luma + CorridorKey` 三管齐下模式。
- 主体保护预设，减少 BiRefNet/Luma 把主体内部抠成半透明的问题。
- 单帧预览支持原始抽帧全分辨率查看，处理后预览可切换棋盘格或指定纯色背景。
- 预览和批处理后处理：残绿涂黑、半透明像素涂黑。
- 可直接导入已有动画序列帧，按文件名顺序预览和导出。
- 反向动画预览和反向导出。
- 帧选择、动画预览、Sprite Sheet 导出、zip 导出和 JSON manifest 导出。

## 抠图模式

Sprite Video Lab 目前提供这些背景处理模式：

- `我的绿幕抠图算法`：快速处理受控纯色背景，适合绿幕、蓝幕、白底、灰底等素材。
- `只用 BiRefNet`：AI 主体抠图，适合非纯色背景或生成图背景。
- `只用 CorridorKey`：先用绿幕算法生成粗 alpha，再用 CorridorKey 重建边缘和前景颜色。
- `只用 Luma`：基于亮度生成 alpha，适合亮部特效、火焰、闪电、粒子等素材。
- `BiRefNet + CorridorKey`：BiRefNet 先给主体 alpha，再用 CorridorKey 做绿幕/蓝幕边缘重建。
- `BiRefNet + Luma`：主体 alpha 加亮度 alpha，适合 VFX 比较重的 Sprite。
- `BiRefNet + Luma + CorridorKey`：先合成主体 alpha 和亮度 alpha，再用 CorridorKey 做边缘/颜色重建。
- `不抠图`：素材已经带透明通道时，只做缩放、对齐和导出。

灰底、白底、黑底素材通常不需要去色溢出；绿幕/蓝幕素材再开启 despill 和 CorridorKey 会更稳。

## 环境要求

- Python 3.10+
- Pillow
- ffmpeg / ffprobe
- 可选 AI 环境：
  - PyTorch
  - torchvision
  - transformers
  - huggingface-hub
  - timm 和相关图片依赖
  - CorridorKey 依赖，例如 `safetensors`、OpenCV、NumPy

基础功能只需要 `requirements.txt`。BiRefNet、Luma 组合和 CorridorKey 相关能力需要 `requirements-ai.txt` 里的可选依赖。

## 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/sparklecatta-lang/sprite-video-lab.git
cd sprite-video-lab
```

### 2. 安装基础依赖

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

### 3. 安装 ffmpeg

把 `ffmpeg` 和 `ffprobe` 放到 `PATH`。

如果你使用独立 ffmpeg 目录，可以这样指定：

```powershell
$env:SPRITE_VIDEO_LAB_FFMPEG_DIR="D:\ffmpeg\bin"
```

### 4. 可选：安装 AI 抠图环境

Windows 下运行：

```bat
setup_ai_runtime.bat
```

脚本会创建单独的 AI Python 环境，并安装 BiRefNet 和 CorridorKey 所需依赖。模型缓存目录可以这样覆盖：

```bat
set SPRITE_VIDEO_LAB_AI_MODEL_CACHE=<model-cache-dir>
```

CorridorKey 源码和 checkpoint 目录可以这样覆盖：

```bat
set SPRITE_VIDEO_LAB_CORRIDORKEY_ROOT=<corridorkey-dir>
```

也可以指定服务启动时使用的 Python：

```bat
set SPRITE_VIDEO_LAB_PYTHON=<python-runtime>
```

更多说明见 [AI_MATTING.md](./AI_MATTING.md)。

### 5. 启动

#### 本地开发 / 测试

源码开发时前后端端口和 Windows 打包版分开：

```bash
npm run dev:api   # Python API: http://127.0.0.1:8895
npm run dev       # React/Vite 前端: http://127.0.0.1:39200
```

Vite 会把 `/api`、`/work`、`/media` 代理到 `8895`。如需临时覆盖后端地址，可设置 `SPRITE_VIDEO_LAB_API_BASE`。

#### Windows 桌面版 / 打包版

Windows 下直接运行：

```bat
start_sprite_video_lab.bat
```

或在终端运行：

```bash
python server.py
```

默认地址：

```text
http://127.0.0.1:8894
```

Electron 桌面版和 Windows 打包版固定使用 `8894`，避免和本地测试端口 `8895` 混用。

## 使用说明

完整的导入、截取、抠图模式、Luma 主体保护、CorridorKey 精修、后处理、动画预览、反向导出和排错说明见：

- [中文使用说明](./USAGE.zh-CN.md)
- [English usage guide](./USAGE.md)

## 环境变量

- `SPRITE_VIDEO_LAB_HOST`
  - 默认：`127.0.0.1`
- `SPRITE_VIDEO_LAB_PORT`
  - 默认：`8894`
- `SPRITE_VIDEO_LAB_FFMPEG_DIR`
  - 可选，包含 `ffmpeg(.exe)` 和 `ffprobe(.exe)` 的目录
- `SPRITE_VIDEO_LAB_FFMPEG_ACCEL`
  - 可选，支持 `auto`、`cpu`、`cuda`、`qsv`、`d3d11va`、`dxva2`
- `SPRITE_VIDEO_LAB_AI_MODEL_CACHE`
  - 可选，Hugging Face / AI 模型缓存目录
- `SPRITE_VIDEO_LAB_CORRIDORKEY_ROOT`
  - 可选，CorridorKey checkout 和 checkpoint 目录
- `SPRITE_VIDEO_LAB_PYTHON`
  - 可选，启动器使用的 Python 可执行文件

也可以从命令行覆盖 host 和 port：

```bash
python server.py --host 127.0.0.1 --port 8894
```

## 项目结构

```text
src/                              React/TypeScript 新前端源码
index.html                        Vite 入口页面
dist/                             React 构建输出，供 Python/Electron 运行时加载
server.py                         本地 HTTP 服务和处理流水线
requirements.txt                  基础运行依赖
requirements-ai.txt               可选 AI 抠图依赖
setup_ai_runtime.bat              Windows AI 环境安装脚本
start_sprite_video_lab.bat        Windows 启动器
start_sprite_video_lab_portable.bat 便携版启动器
build_portable_bundle.ps1         便携版打包脚本
work/                             运行时输出目录，已被 git 忽略
```

## MCP 服务

Sprite Video Lab 提供一个 MCP（Model Context Protocol）服务 `sprite_mcp_server.py`，把主要功能开放给 MCP 客户端（如 Claude、Kiro 等）。它是本地 HTTP 后端的薄包装：所有图像处理仍在 `server.py` 内运行，MCP 只通过 `127.0.0.1` 转发请求，不重复实现任何算法。

### 开放的工具

- `health_check`：后端在线状态 + 版本 + 环境概况
- `list_models`：AI 抠图模型缓存/加载状态
- `import_media`：从本地路径导入视频/图片
- `split_psd`：PSD 分层拆部件
- `preview_frame`：单帧去底调参
- `process_video`：批量抽帧去底（可阻塞等待完成）
- `get_task`：异步任务进度轮询
- `smart_select_frames`：差异度智能选帧
- `export_job`：导出 PNG 序列帧 / Sprite Sheet / zip / JSON manifest
- `open_in_file_browser`：在文件管理器打开输出目录

### 安装

MCP 依赖独立于基础依赖，单独安装：

```bash
pip install -r requirements-mcp.txt
```

### 启动顺序

MCP 服务依赖本地 HTTP 后端提供算力，必须**先启动后端**：

```bash
python server.py                 # 1) 后端，默认 http://127.0.0.1:8894
python sprite_mcp_server.py      # 2) MCP（通常由 MCP 客户端按下方配置自动拉起）
```

MCP 服务启动后会向后端发送心跳，可在应用「运行时」面板看到 MCP 状态（运行中 / 就绪 / 不可用、工具数、最近心跳）。

### 客户端配置

在 MCP 客户端的 `mcp.json` 中登记（按需替换为你的实际绝对路径）：

```json
{
  "mcpServers": {
    "sprite-video-lab": {
      "command": "python",
      "args": ["<项目根>/sprite_mcp_server.py"],
      "env": {
        "SPRITE_VIDEO_LAB_API_BASE": "http://127.0.0.1:8894"
      },
      "disabled": false,
      "autoApprove": ["health_check", "list_models", "get_task"]
    }
  }
}
```

`SPRITE_VIDEO_LAB_API_BASE` 可省略，默认按 `SPRITE_VIDEO_LAB_PORT`（默认 `8894`）拼成 `http://127.0.0.1:8894`。

### 安全提示

后端目前监听 `127.0.0.1` 且无鉴权（CORS `*`）。MCP 经它可以读写 `work/` 下文件、并通过 `open_in_file_browser` 在本机打开路径。请仅在本地可信环境使用；若日后需要远程暴露，必须先在 `server.py` 增加访问控制。

## 注意事项

- 不要把 `work/`、生成帧、测试视频、模型缓存和虚拟环境提交到 git。
- AI 模型会在第一次选择相关模式时由本地运行时下载。
- BiRefNet 通过 Hugging Face 的 `trust_remote_code=True` 加载远程模型代码；如果需要更严格的供应链控制，请审查并固定模型 revision。
- CorridorKey 是独立项目，重新分发或用于商业推理服务前请确认它的许可证。

## English

This README is Chinese-first. For English instructions, see [USAGE.md](./USAGE.md).

## License

[MIT](./LICENSE)
