// 阶段 4：实时预览
// 用 BoneCanvasPreview 自渲染当前 skeleton 的指定动画。

import { useEffect, useState } from "react";
import { useBoneAnim } from "../BoneAnimContext";
import { BoneCanvasPreview } from "../preview/BoneCanvasPreview";

interface Props {
  onNext: () => void;
}

export function StagePreview({ onNext }: Props) {
  const { skeleton, selectedAnimationId, setSelectedAnimationId } = useBoneAnim();
  const [loop, setLoop] = useState(true);
  const [timeScale, setTimeScale] = useState(1);

  // 第一次进入或动画列表更新时，默认选中第一个
  useEffect(() => {
    if (!selectedAnimationId && skeleton.animations[0]) {
      setSelectedAnimationId(skeleton.animations[0].id);
    }
    if (selectedAnimationId && !skeleton.animations.find((a) => a.id === selectedAnimationId)) {
      setSelectedAnimationId(skeleton.animations[0]?.id || null);
    }
  }, [selectedAnimationId, skeleton.animations, setSelectedAnimationId]);

  return (
    <div className="bone-stage">
      <div className="info-box">
        <strong>第四步：实时预览</strong>
        <p className="muted">
          预览基于 canvas 自渲染，按当前 skeleton + 选中动画播放。如果看起来不对，可以回上一步调动作模板参数或调 pivot。
        </p>
      </div>

      <div className="bone-preview-grid">
        <div className="bone-preview-host">
          <BoneCanvasPreview
            skeleton={skeleton}
            animationId={selectedAnimationId}
            loop={loop}
            timeScale={timeScale}
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
          <label className="bone-toggle-row">
            <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />
            循环
          </label>
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
