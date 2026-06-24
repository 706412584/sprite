// 阶段 4：实时预览
// 用 BoneCanvasPreview 自渲染当前 skeleton 的指定动画。
// 支持暂停 + 拖拉进度条 scrub,以及实时调动作模板可变参数（拖滑块即时重写动画）。

import { useEffect, useMemo, useState } from "react";
import { useBoneAnim } from "../BoneAnimContext";
import { BoneCanvasPreview } from "../preview/BoneCanvasPreview";
import { applyAction, getActionTemplate } from "../model/actionTemplates";

interface Props {
  onNext: () => void;
}

export function StagePreview({ onNext }: Props) {
  const { skeleton, setSkeleton, selectedAnimationId, setSelectedAnimationId, effectivePose } = useBoneAnim();
  const [loop, setLoop] = useState(true);
  const [timeScale, setTimeScale] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const [scrubTime, setScrubTime] = useState(0);

  // 第一次进入或动画列表更新时，默认选中第一个
  useEffect(() => {
    if (!selectedAnimationId && skeleton.animations[0]) {
      setSelectedAnimationId(skeleton.animations[0].id);
    }
    if (selectedAnimationId && !skeleton.animations.find((a) => a.id === selectedAnimationId)) {
      setSelectedAnimationId(skeleton.animations[0]?.id || null);
    }
  }, [selectedAnimationId, skeleton.animations, setSelectedAnimationId]);

  const selectedAnim = useMemo(
    () => skeleton.animations.find((a) => a.id === selectedAnimationId) || null,
    [skeleton.animations, selectedAnimationId],
  );

  // 当前动画来自哪个模板（含可变参数）；非模板生成的动画就没有滑块可调
  const sourceTpl = useMemo(() => {
    const tplId = selectedAnim?.sourceTemplate?.templateId;
    return tplId ? getActionTemplate(tplId) ?? null : null;
  }, [selectedAnim]);

  // 切换动画时把进度回到 0,避免滑块还停在上一个动画的尾部
  useEffect(() => {
    setScrubTime(0);
  }, [selectedAnimationId]);

  // 滑块改参数：用 applyAction 重写同名动画。
  // applyAction 内部会按 anim.name 删旧加新（id 会变）,所以需要把新生成的动画 id 选回去。
  const updateParam = (key: string, value: number) => {
    if (!selectedAnim || !sourceTpl) return;
    const oldName = selectedAnim.name;
    const oldParams = selectedAnim.sourceTemplate?.params ?? {};
    const nextParams: Record<string, number> = { ...oldParams, [key]: value };
    const pose = effectivePose();
    setSkeleton((prev) => {
      const next = applyAction(prev, sourceTpl.id, nextParams, pose);
      // 拿新动画的 id（applyAction 会用同 name 替换,所以按 name 找最后一个）
      const newAnim = [...next.animations].reverse().find((a) => a.name === oldName);
      if (newAnim) {
        // 异步刷新选中（在下一 tick,避免在 setSkeleton 内部嵌套 setState）
        Promise.resolve().then(() => setSelectedAnimationId(newAnim.id));
      }
      return next;
    });
  };

  return (
    <div className="bone-stage">
      <div className="info-box">
        <strong>第四步：实时预览</strong>
        <p className="muted">
          预览基于 canvas 自渲染。可暂停后拖动"进度"滑块查看任意时刻；右侧参数滑块直接重写动画,实时生效。
        </p>
      </div>

      <div className="bone-preview-grid">
        <div className="bone-preview-host">
          <BoneCanvasPreview
            skeleton={skeleton}
            animationId={selectedAnimationId}
            loop={loop}
            timeScale={timeScale}
            controlledTime={scrubTime}
            isPaused={isPaused}
          />
        </div>

        <aside className="bone-preview-controls">
          <h4>动画</h4>
          {skeleton.animations.length === 0 ? (
            <p className="muted">还没有动画，回上一步生成。</p>
          ) : (
            <div className="bone-anim-pick">
              {skeleton.animations.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={`bone-template-item ${selectedAnimationId === a.id ? "selected" : ""}`}
                  onClick={() => setSelectedAnimationId(a.id)}
                >
                  <strong>{a.name}</strong>
                  <small>
                    {a.durationSec.toFixed(2)}s · {a.bones.length} 通道
                  </small>
                </button>
              ))}
            </div>
          )}

          <h4>播放</h4>
          <div className="bone-toggle-row" style={{ gap: 8 }}>
            <button type="button" onClick={() => setIsPaused((p) => !p)}>
              {isPaused ? "▶ 播放" : "⏸ 暂停"}
            </button>
            <label className="bone-toggle-row" style={{ marginLeft: "auto" }}>
              <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />
              循环
            </label>
          </div>
          <label>
            <span>速度（{timeScale.toFixed(2)}×）</span>
            <input
              type="range"
              min={0.1}
              max={3}
              step={0.05}
              value={timeScale}
              onChange={(e) => setTimeScale(Number(e.target.value))}
            />
          </label>
          {selectedAnim && (
            <label>
              <span>
                进度（{scrubTime.toFixed(2)}s / {selectedAnim.durationSec.toFixed(2)}s）
                {!isPaused && <em className="muted" style={{ marginLeft: 6 }}>暂停后拖动</em>}
              </span>
              <input
                type="range"
                min={0}
                max={selectedAnim.durationSec}
                step={0.01}
                value={scrubTime}
                disabled={!isPaused}
                onChange={(e) => setScrubTime(Number(e.target.value))}
              />
            </label>
          )}

          {sourceTpl && selectedAnim?.sourceTemplate && (
            <>
              <h4>动作参数</h4>
              <p className="muted" style={{ marginTop: -4, marginBottom: 8 }}>
                拖动滑块即时重写当前动画。
              </p>
              {sourceTpl.params.map((p) => {
                const cur = selectedAnim.sourceTemplate?.params?.[p.key] ?? p.default;
                return (
                  <label key={p.key}>
                    <span>
                      {p.label}（{cur.toFixed(p.step < 1 ? 2 : 0)}）
                      {p.group === "guard" && <em className="muted" style={{ marginLeft: 6 }}>guard</em>}
                      {p.group === "advanced" && <em className="muted" style={{ marginLeft: 6 }}>adv</em>}
                    </span>
                    <input
                      type="range"
                      min={p.min}
                      max={p.max}
                      step={p.step}
                      value={cur}
                      onChange={(e) => updateParam(p.key, Number(e.target.value))}
                    />
                  </label>
                );
              })}
            </>
          )}
        </aside>
      </div>

      <div className="export-actions">
        <button onClick={onNext} disabled={skeleton.animations.length === 0}>
          下一步：导出 →
        </button>
      </div>
    </div>
  );
}
