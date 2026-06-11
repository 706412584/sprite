// 阶段 3：动作模板
// 选 4 个内置模板之一，调滑杆，实时生成 Animation 写入 skeleton。

import { useCallback, useMemo, useState } from "react";
import { useBoneAnim } from "../BoneAnimContext";
import { actionTemplates, ActionTemplateParam, applyAction, defaultParamsFor, getActionTemplate, TEMPLATE_PRESET_POSE } from "../model/actionTemplates";
import { CharacterPose } from "../model/poseDetector";

interface Props {
  onNext: () => void;
}

const POSE_LABEL: Record<CharacterPose, string> = {
  front: "正面",
  back: "背面",
  sideLeft: "左侧",
  sideRight: "右侧",
  threeQuarter: "3/4 视角",
};

const POSE_OPTIONS: CharacterPose[] = ["front", "back", "sideLeft", "sideRight", "threeQuarter"];

function presetBadge(templateId: string): string {
  const preset = TEMPLATE_PRESET_POSE[templateId];
  if (preset === "front") return "正面";
  if (preset === "side") return "侧面";
  return "通用";
}

function isTemplateRecommended(templateId: string, pose: CharacterPose): boolean {
  const preset = TEMPLATE_PRESET_POSE[templateId];
  if (preset === "any") return false;
  if (pose === "front" || pose === "back") return preset === "front";
  if (pose === "sideLeft" || pose === "sideRight") return preset === "side";
  return false;
}

function renderParamControl(
  p: ActionTemplateParam,
  activeParams: Record<string, number>,
  updateParam: (key: string, value: number) => void,
) {
  return (
    <label key={p.key}>
      <span>
        {p.label}（{(activeParams[p.key] ?? p.default).toFixed(2)}）
      </span>
      <input
        type="range"
        min={p.min}
        max={p.max}
        step={p.step}
        value={activeParams[p.key] ?? p.default}
        onChange={(e) => updateParam(p.key, Number(e.target.value))}
      />
    </label>
  );
}

export function StageAction({ onNext }: Props) {
  const { skeleton, setSkeleton, poseDetection, poseOverride, setPoseOverride, effectivePose } = useBoneAnim();
  const pose = effectivePose();
  // 默认 active 模板：根据姿态推荐第一个匹配的；不强制用户改，但首次进入 stage 给一个合理初值。
  const initialActiveId = useMemo(() => {
    const recommended = actionTemplates.find((t) => isTemplateRecommended(t.id, pose));
    return recommended?.id ?? "idle";
    // 仅初始化时跑一次：不依赖 pose 后续变化（避免跳）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [activeId, setActiveId] = useState<string>(initialActiveId);
  const [paramsByTpl, setParamsByTpl] = useState<Record<string, Record<string, number>>>(() => {
    const init: Record<string, Record<string, number>> = {};
    for (const t of actionTemplates) init[t.id] = defaultParamsFor(t);
    return init;
  });

  const activeTpl = useMemo(() => getActionTemplate(activeId), [activeId]);
  const activeParams = paramsByTpl[activeId] || {};
  const basicParams = useMemo(() => activeTpl?.params.filter((p) => (p.group ?? "basic") === "basic") ?? [], [activeTpl]);
  const guardParams = useMemo(() => activeTpl?.params.filter((p) => p.group === "guard") ?? [], [activeTpl]);
  const advancedParams = useMemo(() => activeTpl?.params.filter((p) => p.group === "advanced") ?? [], [activeTpl]);

  const updateParam = useCallback(
    (key: string, value: number) => {
      setParamsByTpl((prev) => ({ ...prev, [activeId]: { ...prev[activeId], [key]: value } }));
    },
    [activeId],
  );

  const apply = useCallback(() => {
    if (!activeTpl) return;
    setSkeleton((prev) => applyAction(prev, activeTpl.id, paramsByTpl[activeTpl.id], pose));
  }, [activeTpl, paramsByTpl, setSkeleton, pose]);

  const applyAll = useCallback(() => {
    setSkeleton((prev) => {
      let next = prev;
      for (const t of actionTemplates) {
        next = applyAction(next, t.id, paramsByTpl[t.id], pose);
      }
      return next;
    });
  }, [paramsByTpl, setSkeleton, pose]);

  const ready = skeleton.animations.length > 0;

  return (
    <div className="bone-stage">
      <div className="info-box">
        <strong>第三步：选动作模板，调滑杆即可生成关键帧</strong>
        <p className="muted">
          模板会根据当前骨架自动找对应骨骼，找不到的就跳过。比如四足模板没有"upperArmR"就不会生成手臂动画。
          点"应用"写入当前 skeleton.animations。
        </p>
      </div>

      <div className="info-box bone-pose-box">
        <div>
          <strong>角色姿态：{POSE_LABEL[pose]}</strong>
          {poseDetection && (
            <span className="muted" style={{ marginLeft: 8 }}>
              （识别置信度 {(poseDetection.confidence * 100).toFixed(0)}% · {poseDetection.signals.length} 条信号）
            </span>
          )}
          {poseOverride && (
            <span className="muted" style={{ marginLeft: 8, color: "#a55" }}>已手动覆盖</span>
          )}
        </div>
        <div className="bone-pose-controls">
          {POSE_OPTIONS.map((p) => (
            <button
              key={p}
              type="button"
              className={`bone-pose-chip ${pose === p ? "selected" : ""}`}
              onClick={() => setPoseOverride(p)}
            >
              {POSE_LABEL[p]}
            </button>
          ))}
          {poseOverride && (
            <button type="button" onClick={() => setPoseOverride(null)} className="bone-pose-chip">
              清除手动覆盖
            </button>
          )}
        </div>
        <p className="muted">
          姿态决定模板高亮。当前姿态为正面/背面时，选侧面取向的模板（如 Walk）会自动做"姿态投影"——把绕 Z 摆腿翻译成抬腿。
          所见即所得：换姿态后请重新点"应用此动作"。
        </p>
      </div>

      <div className="bone-action-grid">
        <aside className="bone-action-list">
          <h4>动作模板</h4>
          {actionTemplates.map((t) => {
            const recommended = isTemplateRecommended(t.id, pose);
            return (
              <button
                key={t.id}
                type="button"
                className={`bone-template-item ${activeId === t.id ? "selected" : ""} ${recommended ? "recommended" : ""}`}
                onClick={() => setActiveId(t.id)}
              >
                <strong>
                  {t.label}
                  <span className="bone-template-badge">{presetBadge(t.id)}</span>
                  {recommended && <span className="bone-template-badge bone-template-badge-recommend">推荐</span>}
                </strong>
                <small>{t.description}</small>
              </button>
            );
          })}
        </aside>

        <section className="bone-action-form">
          {activeTpl ? (
            <>
              <h4>{activeTpl.label} · 参数</h4>
              <div className="bone-action-params">
                {basicParams.map((p) => renderParamControl(p, activeParams, updateParam))}
              </div>
              {guardParams.length > 0 && (
                <details className="bone-param-group">
                  <summary>防穿帮参数（肩部/前臂/手部接力）</summary>
                  <div className="bone-action-params">
                    {guardParams.map((p) => renderParamControl(p, activeParams, updateParam))}
                  </div>
                </details>
              )}
              {advancedParams.length > 0 && (
                <details className="bone-param-group">
                  <summary>高级参数</summary>
                  <div className="bone-action-params">
                    {advancedParams.map((p) => renderParamControl(p, activeParams, updateParam))}
                  </div>
                </details>
              )}
              <div className="export-actions">
                <button onClick={apply}>应用此动作</button>
                <button onClick={applyAll}>一键生成全部 4 个动作</button>
              </div>
            </>
          ) : null}

          <h4 style={{ marginTop: 12 }}>已生成的动画（{skeleton.animations.length}）</h4>
          {skeleton.animations.length === 0 ? (
            <p className="muted">还没有动画。点"应用此动作"或"一键生成全部"。</p>
          ) : (
            <ul className="bone-anim-list">
              {skeleton.animations.map((a) => (
                <li key={a.id}>
                  <strong>{a.name}</strong>
                  <small>
                    {a.durationSec.toFixed(2)}s · {a.bones.length} 条骨骼通道 · {a.loop ? "循环" : "单次"}
                  </small>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="export-actions">
        <button onClick={onNext} disabled={!ready}>
          下一步：预览导出 →
        </button>
      </div>
    </div>
  );
}
