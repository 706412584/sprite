# Sprite Video Lab 重构计划

## 背景

代码评估结论：整体质量中等偏上，核心算法和 TS 类型建模不错，但两个"神文件"（`server.py` 3705 行 / `AppContext.tsx` 500+ 行）的维护成本在快速上升。本计划按优先级排列可执行的优化步骤。

## 总体策略

- 不做大爆炸式重构，每步保持可运行可回滚。
- 每个 P0 阶段结束都跑一次完整流程回归（导入 → 抠图 → 导出）。
- 先动最痛的两个文件，其它问题渐进改进。

---

## P0 — 高优先级

### P0-1：拆分 server.py（3705 行 → 多模块）

**进度：核心隔离层 + 16 个路由 已完成 ✅** （server.py 2993 行，sprite_lab/ 1415 行）

**已迁移**

- `sprite_lab/config.py` / `paths.py` — 全部常量与运行时目录
- `sprite_lab/utils/` — fs、json_io、multipart
- `sprite_lab/validation/` — types、normalizers
- `sprite_lab/imaging/` — color、chroma、luma、canvas
- `sprite_lab/ffmpeg/` — binaries、accel、extract
- `sprite_lab/storage/` — media、uploads、jobs、previews
- `sprite_lab/tasks/runner.py` — TASKS 注册表 + 进度跟踪
- `sprite_lab/routes/` — 路由注册表 + 16 个简单路由（registry / misc / tasks_route / preview_alpha / env_models / imports / jobs_route / pose）

**剩余 3 个重路由**（参数巨多，先抽 normalizer）

- `/api/process` （30+ 字段）
- `/api/job/rematte-frames` （30+ 字段）
- `/api/preview-frame` （30+ 字段）

策略：把这三个共享的 `payload -> kwargs` 转换抽成 `sprite_lab/routes/_process_kwargs.py`，再分别迁移。

**验证**：16 项端到端 HTTP 测试全过（迁移路由 + 错误状态码 + 未知路由 404 + legacy fallthrough）。

**未迁移函数**（仍在 server.py，等 P0-1 末尾再处理）

- `watch_targets` / `current_app_version` / `watch_snapshot` / `open_path_in_file_browser` （server lifecycle）
- `serve_dist_file` / `serve_work_file` / `serve_media_file` / `serve_file` （静态文件，AppHandler 方法）
- 业务核心：process_video_to_job / preview_frame / save_preview_as_job / export_job / suggest_job_frames 等

**操作步骤** ✅ 1-7 已完成；剩下重路由 normalizer + handler 拆分需要新一轮工作

1. ✅ 创建 `sprite_lab/` 包，先迁移纯函数
2. ✅ 迁移 imaging/
3. ✅ 迁移 ffmpeg/
4. ✅ 迁移 storage/
5. ✅ 迁移 tasks/runner.py
6. ✅ 创建路由注册表 + 混合分发
7. ✅ 迁移 16 个简单路由

### P0-2：拆分 AppContext.tsx → Zustand store ✅ 已完成

**实现**：
- 新建 `src/state/store.ts`（单一 Zustand store，含全部 state + actions）
- `AppContext.tsx` 改为兼容包装层：`useAppState`/`useAppActions`/`AppProvider`/常量全部保留，内部委托给 Zustand，**所有 11 个面板零改动**
- `AppProvider` 瘦身为只做 bootstrap 初始化 + 浏览器文件选择器注册
- 取消控制器 `AbortController` 移到 module-level（非序列化对象不进 store state，store 只存 `canCancelTask` 布尔）
- 消除了原 `useMemo + eslint-disable` 的 stale closure 风险：action 全部用 `get()` 读最新 state

**验证**：
- `tsc -b --force` 全量类型检查通过
- `vite build` 产物成功（仅遗留 jszip chunk 警告，与本次无关）

**已知后续优化**（非阻塞）：当前 `useAppState()` 返回全量 state，仍会整组件重渲染。后续可让热点面板改用精确 selector `useStore((s) => s.busy)` 以发挥 Zustand 优势。安装依赖：`zustand@^5.0.14`

### P0-3：修复 waitForTaskResult 无超时 ✅ 已完成

**实现位置**：`src/state/actions/waitForTask.ts`

**关键改动**：
- 抽出独立工具 `waitForTaskResult<T>(taskId, opts)`，原 AppContext 内死循环 `for(;;)` 删除
- 三种语义化错误类：`TaskTimeoutError` / `TaskStallError` / `TaskCancelledError`
- 默认上限：超时 10 分钟、停滞检测 60 秒（进度无变化）、轮询 800ms
- 支持外部 `AbortSignal`，包括轮询间隙期间也响应取消
- AppContext 暴露 `canCancelTask` / `cancelCurrentTask`，App.tsx 顶栏增加"取消任务"按钮（仅在长任务运行时显示）
- runProcess 区分错误类型，给出更精准的提示文案

---

## P1 — 中优先级

### P1-1：Python 图像处理 NumPy 化

enforce_hard_alpha、auto_key_color、chroma_key_frame 改用 NumPy 向量化。
前提：先建立 golden image 测试（P1-2）。

### P1-2：图像处理算法测试覆盖

```
tests/
  fixtures/                 固定输入用例
  test_chroma.py
  test_luma.py
  test_spriteflow_key.py
  test_canvas_modes.py
  test_normalizers.py       别名表驱动测试
```

pytest + SSIM 对比，requirements-dev.txt 加 pytest/scikit-image。

### P1-3：收紧弱类型边界

- 用 zod 替代 `[key: string]: unknown` 索引签名
- 合并重复的 keyingModes 定义为单一来源

### P1-4：SpriteFlowPanel.tsx 样式提取

内联样式 → CSS Modules，FramePreview/DetectorPanel 拆成独立文件。

---

## P2 — 低优先级

### P2-1：日志统一

server.py 的 print → logging 模块，带文件输出和级别。

### P2-2：Skeleton 类型可选字段统一

提取 Named base interface。

### P2-3：异步任务支持取消

后端 TASKS 加 cancelled 字段 + /api/tasks/{id}/cancel。

### P2-4：删除死代码和测试遗留物

_test_*.png、work/bone-verify-*、注释掉的旧实现。

---

## 实施顺序

| 周次 | 任务 | 完成判定 |
|------|------|----------|
| 第 1 周 | P0-1 前半（imaging + utils + storage） | 三模块迁移完，原 routes 仍可用 |
| 第 2 周 | P0-1 后半（routes + handler）+ P0-3 | 完整端到端通过 |
| 第 3 周 | P0-2 + P1-4 | 所有面板改造完，AppContext 删除 |
| 第 4 周 | P1-1 + P1-2 | pytest 全绿 |
| 后续 | P1-3 + P2 系列 | 渐进 |

## 风险控制

1. 每次只动一个领域
2. 每个 PR 跑完整流程回归
3. 保留 git tag 方便回滚
4. golden image 测试先于算法迁移
