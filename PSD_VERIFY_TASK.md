# PSD 骨骼绑定与行走动画验证 — 任务进度

> 用于跨会话接续。下次开新会话直接读本文件即可恢复上下文。

## 用户原始诉求

> 重新导入 psd 工作台状态没有被重置；重新验证 `D:\download\seethrough_output (2).psd`、`D:\download\seethrough_output (1).psd` 的骨骼绑定和动画。
> 刚刚试了：**PSD1 的腿部动画和手动画有问题（行走）**；**PSD2 的脸"背过去了"的感觉**。

拆成四件事：
- (a) 重新导入 PSD 工作台状态未重置 → **已修复**（见下）
- (b) 用两个 PSD 重新验证绑骨与动画
- (c) PSD1：行走时腿部、手部动画异常
- (d) PSD2：脸有"背过去/朝向反了"的感觉

## 任务状态

- Task #37 [completed] 重新导入 PSD 时重置工作台状态
  - 修复点：`src/features/bone-anim/stages/StageSlice.tsx` 的 `handlePsdFile` 开头新增并调用 `resetWorkbench`（清空旧骨架/部件/动画/绑定）。上一会话已验证生效（界面显示"已清空旧工作台"）。
- Task #36 [in_progress] 验证两个 PSD 骨骼绑定与行走动画
  - PSD1 腿/手行走异常：**代码级根因已确认**，可视化回放未最终确认。
  - PSD2 脸朝向异常：**仅拿到图层数据，根因未确认**，需在预览里实际渲染确认。

## 已确认的根因

### PSD1（seethrough_output (1).psd）腿/手行走异常 — 根因已定位

PSD1 的服饰图层是**单层、无左右后缀**：`handwear` / `footwear` / `legwear` / `topwear`（已用 psd_tools 确认）。

链路：`mapPsdLayerToBone(att.name)` → 命中 sided 规则 → `withSide(base, side)`，而 `detectSide` 返回 null（无 -l/-r/left/right），`withSide` **默认拼 "L"**（`psdBoneMapping.ts:70-72`）。

结果：
- `legwear` → `shinL`
- `handwear` → `forearmL` / `handL`
- `footwear` → `footL`（shin）

`StageRig.autoRigPsd`（`StageRig.tsx:107`）对每个 PSD 附件只建**一个 slot**，把整张图绑到**唯一一根（左侧）骨**。

行走模板（`actionTemplates.ts:192` walkTemplate）让 `thighL/thighR`、`shinL/shinR` **反相**摆动，但整张裤子/手套图只跟随左骨 → 只有一侧摆动却拖着整张图，产生"腿/手行走破碎"的观感。

> `fitSkeletonToPsd.ts:289-294` 的 X 中线切分（`torsoCenterX`）**只修正静态 fit 位置，不改 slot 绑骨**，所以救不了动画。

这是**平面纸娃娃单层服饰**与**左右交替行走周期**的根本性不匹配。

### PSD2（seethrough_output (2).psd）脸"背过去" — 图层数据已拿到，根因未确认

图层数据（psd_tools）：
- 手部正确分左右：`handwear-l` / `handwear-r`
- `legwear` 仍是单层（同 PSD1 问题）
- 眼/眉是**解剖学命名**的 `-r` / `-l`：`-r` 在画布**左侧** x≈458-489，`-l` 在画布**右侧** x≈498-529

可疑点：`fitSkeletonToPsd.ts:336-337`
```
eyeLW = headCenter.x + headHeight*0.16   // 默认放右侧
eyeRW = headCenter.x - headHeight*0.16   // 默认放左侧
```
有真实 PSD eyeL/eyeR rect 时会覆盖默认值。但 PSD2 的眼睛是解剖学命名（`-r` 在画布左、`-l` 在画布右），`detectSide` 会把 `eye-r` 判成 "R"、`eye-l` 判成 "L"，于是 `eyeR`(解剖右=画布左) 被 fit 放到画布左、`eyeL`(解剖左=画布右) 放到画布右——**这与画布实际位置恰好一致**，初看不矛盾。需在预览实际渲染才能判断"脸背过去"到底是眼睛左右调换、还是 head/hairFront/hairBack 前后层级（zOrder）或朝向问题。

**结论：PSD2 必须在预览里实际渲染确认，不能纯靠代码推断。**

## 已实施修复（待最终预览确认）

### PSD1 单层服饰绑左骨问题
`src/features/bone-anim/model/psdBoneMapping.ts`:
- `MappingRule` 新增字段 `unsidedBoneNames` / `fallbackSided`。
- 无 `-l/-r` 后缀的整层手/臂/腿/脚/服饰规则降级到中线骨：`hand/forearm/upperArm` → `chest/torso`；`shoe/legwear/thigh/leg` → `waist/torso`。
- 新增 `hasTokenPair` / `keywordMatches` 支持 `back hair` / `hair back` / `front hair` / `hair front` 等带空格/分隔符的命名。
- 五官规则加 `fallbackSided: false` + `unsidedBoneNames: ["head"]`，避免 `eye/brow` 无侧时被默认拼成 `eyeL/headL` 后无骨可回退。

### PSD2 后发盖脸问题
`src/features/bone-anim/stages/StageRig.tsx`:
- 新增 `HEAD_LAYER_Z` + `getPsdSlotZOrder(att, index)`，按语义稳定 head 簇绘制层级：
  - hairBack/rearhair → -40（最底）
  - head/face/ear/nose → -20
  - eye/brow/lash/iris/pupil/mouth/lip/teeth/tongue → -10
  - hairFront/bang/headwear/hat/helmet/horn → +40（最顶）
- 其余非 head 簇 slot 仍沿用 PSD 原 index（底→顶）。

代码审查：code-reviewer 已 APPROVE（第二轮）。`npm run build` 已通过。

## 浏览器复验进度（被中断）

最后一次成功状态（PSD2 单步流程已走到预览阶段）：
- 启动：`npm run dev -- --host 127.0.0.1 --port 39200` + `npm run dev:api`
- 上传 `work/_psd_test/psd2.psd` → 解析 22 图层（提示「已清空旧工作台」）
- 导入 22 个部件 → 应用「人形细分」(24 骨/23 槽) → PSD 一键绑骨（22/22 通过 head/torso/arm/leg）
- 进入「生成动作」→ 选 Walk → 应用动作 → `已生成的动画（1）walk 0.90s · 17 通道 · 循环`
- 进入「预览导出」→ 截图保存到 `work/_psd_test/psd2_preview_after_fix.png`（已生成但未由人/AI最终肉眼判读）

随后浏览器页面意外回到 `about:blank`，session 上下文中断。**所以 PSD2 修复后的视觉效果尚未最终判读**。

## 下次会话的下一步（按顺序）

1. 重新启动（如未起）：在 `tools/sprite` 下并行 `npm run dev -- --host 127.0.0.1 --port 39200` 和 `npm run dev:api`。
2. 直接打开 `work/_psd_test/psd2_preview_after_fix.png` 肉眼判读：
   - 后发是否在脸/五官**之后**？
   - 前发/headwear 是否在脸/五官**之前**？
   - 若仍"背过去"，再考虑是否是 eyeL/eyeR 命名映射镜像（解剖学 -r 在画布左，-l 在画布右）。
3. 若 PSD2 OK，转 Task #2：浏览器复现 PSD1 行走（同流程，上传 `work/_psd_test/psd1.psd`），重点看 `legwear/handwear` 单层是否仍被左骨拖裂。预期已修复（绑到 waist/chest/torso）。
4. 全部确认通过后，Task #1 清理 `work/_psd_test/psd1.psd`、`psd2.psd`、`psd2_preview_after_fix.png`。
5. 可选：补回归测试覆盖 `mapPsdLayerToBone` 命名（项目当前无 test script，需另起 vitest）。

## MCP / 浏览器约束备忘

- `upload_file` 仅接受 workspace 根内路径 → PSD 已复制到 `work/_psd_test/`（`psd1.psd` 5615026 bytes、`psd2.psd` 5744754 bytes）。
- chrome-devtools `take_snapshot` 可能超 token 上限 → 用 `evaluate_script` 取 `innerText`。
- `wait_for` 需要 text **数组**，不是字符串。
- 页面可能被刷新重置回「制作流水线」tab，导致 bone-anim 状态丢失，需重新驱动导入。

## 关键文件索引

- `src/features/bone-anim/model/psdBoneMapping.ts` — RULES 映射 + `detectSide`/`withSide`（默认 L）+ `unsidedBoneNames` 中线降级。
- `src/features/bone-anim/model/fitSkeletonToPsd.ts` — fit；shin X 中线切分(289-294)；眼睛默认位(336-337)。
- `src/features/bone-anim/stages/StageRig.tsx` — `autoRigPsd`(107)：一图一 slot 一骨；HEAD_LAYER_Z 簇 zOrder。
- `src/features/bone-anim/preview/BoneCanvasPreview.tsx` — 完全骨骼驱动渲染，无显式水平翻转。
- `src/features/bone-anim/model/actionTemplates.ts` — `walkTemplate`(192)：thighL/R、shinL/R 反相；新增 walkFront/idleFront/runFront；`applyAction(skeleton, id, params, pose)` 自动投影。
- `src/features/bone-anim/model/poseDetector.ts` — 多信号投票：facial-organs / face-x / eyes / hair / limbs / explicit-name。
- `src/features/bone-anim/model/poseProjection.ts` — side→front 投影：剔 thigh/shin rotate，加 thigh translate-Y 抬腿 + shin scale-Y 屈膝；arm rotate ×0.35 衰减。
- `src/features/bone-anim/model/templatePoseMap.ts` — TEMPLATE_PRESET_POSE 解循环依赖。
- `src/features/bone-anim/stages/StageSlice.tsx` — `handlePsdFile` + `resetWorkbench`（已修复重置 bug）。
- `src/features/bone-anim/BoneAnimPanel.tsx` — dev URL 钩子（`?dev=psd&file=...&pose=...&action=...&snap=...&frames=N&intervalMs=M`）。
- `server.py` do_POST — `/api/dev-canvas?path=work/_psd_test/*.png` 落盘截图（dev-only 白名单）。

## 2026-06-11 验证基线（dev URL 自动驱动 + canvas.toBlob 截图）

启动方式（在 `tools/sprite` 下）：
```
npm run dev -- --host 127.0.0.1 --port 39200 &
npm run dev:api &
```
跑两 PSD：
```
http://127.0.0.1:39200/?dev=psd&file=_psd_test/pA.psd&action=walk#bone-anim
http://127.0.0.1:39200/?dev=psd&file=_psd_test/psd2.psd&action=walk#bone-anim
```
PSD 来源：`D:/download/seethrough_output*.psd` 与 `seethrough_output (1).psd` md5 一致（5615026B），都是 PSD1；当前 `pA.psd`/`psd1.psd` 均为这张。`psd2.psd` 是另一张 5744754B。

**PoseDetector v2 置信度基线**（提升后）：

| PSD | v1 (back/55-57%) | v2 | 信号 |
|---|---|---|---|
| pA.psd（PSD1, 15 部件） | back@57% ❌ | **front@96%** ✓ | facialOrgansSignal 6 种 + hairSignal 看到 hairBack+五官改投 front |
| psd2.psd（PSD2, 22 部件） | front@55% ✓ | **front@100%** ✓ | facialOrgansSignal + 双侧 eyebrow-l/-r 跨中线 + hairFront+hairBack |

**A+B walk 投影像素分析**（720×720 canvas，4 帧 @ 220ms）：

| 指标 | PSD1 (front 投影) | PSD1 (sideLeft) | PSD2 (front 投影) | PSD2 (sideLeft) |
|---|---|---|---|---|
| 角色 X 跨度变化 | 2 px | 1 px | 13 px | 29 px |
| 内部 t1↔t3 总像素差 | ~25K | ~25K | ~18K | ~37K |
| front vs side 同帧差 | 47K | — | 25K~57K | — |

**结论**：
1. ✅ A+B 投影路线对 PSD2（部分分侧）有效：X 八字 29 px → 抬腿 13 px。
2. ✅ PSD1 中线兜底（`pushMidlineFallbackWalk`）让全无侧服饰素材的 walk 动起来：cx 范围从 0 → 2.6 px；t0↔t2 帧像素差从仅头发级别提升到 110 万级别，且分布从"全靠头发"变为"上中下均匀（38/31/32%）"。Task #40 已完成。
3. ✅ PoseDetector v2 在两张 PSD 上都达到 ≥96% 置信度，方向正确。

## walk 中线兜底设计

`actionTemplates.ts/pushMidlineFallbackWalk(anim, skeleton, sampleCount, duration)`：

- waist rotate ±2.2°（phase=π/2，与 torso bob 错开）
- chest rotate ±1.4°
- root translate X ±1.2 px

无论素材是否有腿绑定都加；幅度极小，对正常素材几乎不可见，对 PSD1 这类全无侧服饰素材"撑住"重心切换感。walkFront（正面预制）也调用同一函数。


