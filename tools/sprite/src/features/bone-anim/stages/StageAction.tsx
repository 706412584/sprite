// 阶段 3：动作模板
// 选 4 个内置模板之一，调滑杆，实时生成 Animation 写入 skeleton。

import { useCallback, useMemo, useState } from "react";
import { useBoneAnim } from "../BoneAnimContext";
import { actionTemplates, applyAction, defaultParamsFor, getActionTemplate } from "../model/actionTemplates";

interface Props {
  onNext: () => void;
}

export function StageAction({ onNext }: Props) {
  const { skeleton, setSkeleton } = useBoneAnim();
  const [activeId, setActiveId] = useState<string>("idle");
  const [paramsByTpl, setParamsByTpl] = useState<Record<string, Record<string, number>>>(() => {
    const init: Record<string, Record<string, number>> = {};
    for (const t of actionTemplates) init[t.id] = defaultParamsFor(t);
    return init;
  });

  const activeTpl = useMemo(() => getActionTemplate(activeId), [activeId]);
  const activeParams = paramsByTpl[activeId] || {};

  const updateParam = useCallback(
    (key: string, value: number) => {
      setParamsByTpl((prev) => ({ ...prev, [activeId]: { ...prev[activeId], [key]: value } }));
    },
    [activeId],
  );

  const apply = useCallback(() => {
    if (!activeTpl) return;
    setSkeleton((prev) => applyAction(prev, activeTpl.id, paramsByTpl[activeTpl.id]));
  }, [activeTpl, paramsByTpl, setSkeleton]);

  const applyAll = useCallback(() => {
    setSkeleton((prev) => {
      let next = prev;
      for (const t of actionTemplates) {
        next = applyAction(next, t.id, paramsByTpl[t.id]);
      }
      return next;
    });
  }, [paramsByTpl, setSkeleton]);

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

      <div className="bone-action-grid">
        <aside className="bone-action-list">
          <h4>动作模板</h4>
          {actionTemplates.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`bone-template-item ${activeId === t.id ? "selected" : ""}`}
              onClick={() => setActiveId(t.id)}
            >
              <strong>{t.label}</strong>
              <small>{t.description}</small>
            </button>
          ))}
        </aside>

        <section className="bone-action-form">
          {activeTpl ? (
            <>
              <h4>{activeTpl.label} · 参数</h4>
              <div className="bone-action-params">
                {activeTpl.params.map((p) => (
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
                ))}
              </div>
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
          下一步：实时预览 →
        </button>
      </div>
    </div>
  );
}
