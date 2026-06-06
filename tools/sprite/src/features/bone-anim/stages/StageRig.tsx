// 阶段 2：骨架搭建
// - 选模板生成 bones / slots
// - 在画布上预览骨骼线，槽位列表里把切片绑定到槽位
// - 部件名称 / pivot 简单微调

import { useCallback, useMemo, useState } from "react";
import { useBoneAnim } from "../BoneAnimContext";
import { applyTemplate, getTemplateById, skeletonTemplates } from "../model/skeletonTemplates";
import { findAttachment, findBone, Slot } from "../model/skeletonModel";

interface Props {
  onNext: () => void;
}

export function StageRig({ onNext }: Props) {
  const { skeleton, setSkeleton, selectedSlotId, setSelectedSlotId } = useBoneAnim();
  const [templateId, setTemplateId] = useState<string>("humanoid");

  const currentTemplate = useMemo(() => getTemplateById(templateId), [templateId]);

  const applyChosenTemplate = useCallback(() => {
    const tpl = getTemplateById(templateId);
    if (!tpl) return;
    setSkeleton((prev) => applyTemplate(prev, tpl));
    setSelectedSlotId(null);
  }, [templateId, setSkeleton, setSelectedSlotId]);

  const bindAttachmentToSlot = useCallback(
    (slotId: string, attachmentId: string | null) => {
      setSkeleton((prev) => ({
        ...prev,
        slots: prev.slots.map((s) => (s.id === slotId ? { ...s, attachmentId } : s)),
      }));
    },
    [setSkeleton],
  );

  const [autoRigHint, setAutoRigHint] = useState<string | null>(null);

  // 按名称自动绑定：槽位名 === 部件名（姿态语义部件直接命中），只填未绑定的槽位。
  const autoRig = useCallback(() => {
    setSkeleton((prev) => {
      let matched = 0;
      const slots = prev.slots.map((s) => {
        if (s.attachmentId) return s;
        const att = prev.attachments.find((a) => a.name === s.name);
        if (!att) return s;
        matched += 1;
        return { ...s, attachmentId: att.id };
      });
      setAutoRigHint(matched > 0 ? `按名称自动绑定了 ${matched} 个槽位。` : "没有名称完全匹配的部件，请手动绑定或先用姿态识别生成语义部件。");
      return { ...prev, slots };
    });
  }, [setSkeleton]);

  const updateAttachmentPivot = useCallback(
    (attId: string, axis: "x" | "y", value: number) => {
      const v = Math.max(0, Math.min(1, value));
      setSkeleton((prev) => ({
        ...prev,
        attachments: prev.attachments.map((a) =>
          a.id === attId ? { ...a, pivot: { ...a.pivot, [axis]: v } } : a,
        ),
      }));
    },
    [setSkeleton],
  );

  const renameAttachment = useCallback(
    (attId: string, name: string) => {
      const cleaned = name.replace(/[^a-zA-Z0-9_-]/g, "_") || "part";
      setSkeleton((prev) => ({
        ...prev,
        attachments: prev.attachments.map((a) => (a.id === attId ? { ...a, name: cleaned } : a)),
      }));
    },
    [setSkeleton],
  );

  const selectedSlot: Slot | undefined = skeleton.slots.find((s) => s.id === selectedSlotId);
  const selectedAttachment = selectedSlot ? findAttachment(skeleton, selectedSlot.attachmentId || "") : undefined;

  const slotHint = useMemo(() => {
    if (!currentTemplate || !selectedSlot) return "";
    return currentTemplate.slots.find((s) => s.name === selectedSlot.name)?.hint ?? "";
  }, [currentTemplate, selectedSlot]);

  const ready = skeleton.bones.length > 0 && skeleton.slots.some((s) => s.attachmentId);

  return (
    <div className="bone-stage">
      <div className="info-box">
        <strong>第二步：选模板，把切片绑到对应槽位</strong>
        <p className="muted">
          模板提供骨骼层级和槽位定义，左侧选模板后点"应用模板"。中间画布预览骨骼线，右侧把已切好的部件绑到槽位。
        </p>
      </div>

      <div className="bone-rig-grid">
        <aside className="bone-rig-templates">
          <h4>骨架模板</h4>
          <div className="bone-template-list">
            {skeletonTemplates.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`bone-template-item ${templateId === t.id ? "selected" : ""}`}
                onClick={() => setTemplateId(t.id)}
              >
                <strong>{t.label}</strong>
                <small>{t.description}</small>
              </button>
            ))}
          </div>
          <button onClick={applyChosenTemplate}>应用模板</button>
          <p className="muted">应用后旧的骨骼 / 槽位会被替换，部件库保留。</p>
        </aside>

        <section className="bone-rig-canvas">
          <BoneCanvas onSelectSlot={setSelectedSlotId} selectedSlotId={selectedSlotId} />
        </section>

        <aside className="bone-rig-inspector">
          <h4>槽位绑定</h4>
          {skeleton.slots.length === 0 && <p className="muted">先应用模板生成槽位。</p>}
          {skeleton.slots.length > 0 && (
            <div className="bone-autorig">
              <button onClick={autoRig} disabled={skeleton.attachments.length === 0}>
                按名称自动绑定
              </button>
              {autoRigHint && <p className="muted">{autoRigHint}</p>}
            </div>
          )}
          <div className="bone-slot-list">
            {skeleton.slots.map((slot) => {
              const att = findAttachment(skeleton, slot.attachmentId || "");
              return (
                <div
                  key={slot.id}
                  className={`bone-slot-row ${selectedSlotId === slot.id ? "selected" : ""}`}
                  onClick={() => setSelectedSlotId(slot.id)}
                >
                  <div className="bone-slot-row-head">
                    <strong>{slot.name}</strong>
                    <small>{att ? att.name : "未绑定"}</small>
                  </div>
                  <select
                    value={slot.attachmentId || ""}
                    onChange={(e) => bindAttachmentToSlot(slot.id, e.target.value || null)}
                  >
                    <option value="">— 未绑定 —</option>
                    {skeleton.attachments.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.width}×{a.height})
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>

          {selectedSlot && (
            <div className="bone-slot-detail">
              <h4>当前槽位：{selectedSlot.name}</h4>
              {slotHint && <p className="muted">建议：{slotHint}</p>}
              {selectedAttachment ? (
                <div className="bone-attachment-form">
                  <label>
                    <span>部件名</span>
                    <input
                      value={selectedAttachment.name}
                      onChange={(e) => renameAttachment(selectedAttachment.id, e.target.value)}
                    />
                  </label>
                  <div className="bone-pivot-grid">
                    <label>
                      <span>pivot X ({selectedAttachment.pivot.x.toFixed(2)})</span>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={selectedAttachment.pivot.x}
                        onChange={(e) =>
                          updateAttachmentPivot(selectedAttachment.id, "x", Number(e.target.value))
                        }
                      />
                    </label>
                    <label>
                      <span>pivot Y ({selectedAttachment.pivot.y.toFixed(2)})</span>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={selectedAttachment.pivot.y}
                        onChange={(e) =>
                          updateAttachmentPivot(selectedAttachment.id, "y", Number(e.target.value))
                        }
                      />
                    </label>
                  </div>
                  <div className="bone-attachment-preview">
                    <img src={selectedAttachment.pngDataUrl} alt={selectedAttachment.name} />
                    <span
                      className="bone-pivot-marker"
                      style={{
                        left: `${selectedAttachment.pivot.x * 100}%`,
                        top: `${selectedAttachment.pivot.y * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ) : (
                <p className="muted">先选一个部件绑定到该槽位。</p>
              )}
            </div>
          )}
        </aside>
      </div>

      <div className="export-actions">
        <button onClick={onNext} disabled={!ready}>
          下一步：动作模板 →
        </button>
      </div>
    </div>
  );
}

// 简单骨架预览：以 root 为画布中心绘制骨骼线
function BoneCanvas({
  onSelectSlot,
  selectedSlotId,
}: {
  onSelectSlot: (id: string) => void;
  selectedSlotId: string | null;
}) {
  const { skeleton } = useBoneAnim();

  const w = 480;
  const h = 480;
  const cx = w / 2;
  const cy = h / 2 + 80;

  // 计算每个 bone 的世界坐标（仅用于线段预览，不替代真实运行时）
  const worldByBone = new Map<string, { x: number; y: number; rot: number }>();
  for (const b of skeleton.bones) {
    let parent = worldByBone.get(b.parentId || "");
    if (!parent && b.parentId) {
      // 父级还没算完时，先放占位（拓扑序在模板里大致正确）
      parent = { x: 0, y: 0, rot: 0 };
    }
    const baseX = parent ? parent.x : 0;
    const baseY = parent ? parent.y : 0;
    const baseRot = parent ? parent.rot : 0;
    const rad = (baseRot * Math.PI) / 180;
    const wx = baseX + b.x * Math.cos(rad) - b.y * Math.sin(rad);
    const wy = baseY + b.x * Math.sin(rad) + b.y * Math.cos(rad);
    worldByBone.set(b.id, { x: wx, y: wy, rot: baseRot + b.rotation });
  }

  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} className="bone-canvas">
      {/* 网格 */}
      <defs>
        <pattern id="bone-grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(148,163,184,0.12)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#bone-grid)" />

      {/* 部件贴图（简易展示，不带 pivot/旋转，仅给小白一个直观参考） */}
      {skeleton.slots
        .slice()
        .sort((a, b) => a.zOrder - b.zOrder)
        .map((slot) => {
          const att = skeleton.attachments.find((a) => a.id === slot.attachmentId);
          const bone = findBone(skeleton, slot.boneId);
          if (!att || !bone) return null;
          const wpos = worldByBone.get(bone.id) || { x: 0, y: 0, rot: 0 };
          const dispW = Math.min(att.width, 80);
          const scale = dispW / att.width;
          const dispH = att.height * scale;
          const px = cx + wpos.x - att.pivot.x * dispW;
          const py = cy + wpos.y - att.pivot.y * dispH;
          return (
            <image
              key={slot.id}
              href={att.pngDataUrl}
              x={px}
              y={py}
              width={dispW}
              height={dispH}
              opacity={selectedSlotId === slot.id ? 1 : 0.85}
              style={{ cursor: "pointer" }}
              onClick={() => onSelectSlot(slot.id)}
            />
          );
        })}

      {/* 骨骼线段 */}
      {skeleton.bones.map((b) => {
        const start = worldByBone.get(b.id);
        if (!start) return null;
        const rad = (start.rot * Math.PI) / 180;
        const len = b.length || 30;
        const ex = start.x + len * Math.cos(rad);
        const ey = start.y + len * Math.sin(rad);
        return (
          <g key={b.id}>
            <line
              x1={cx + start.x}
              y1={cy + start.y}
              x2={cx + ex}
              y2={cy + ey}
              stroke="rgba(96,165,250,0.85)"
              strokeWidth={3}
              strokeLinecap="round"
            />
            <circle cx={cx + start.x} cy={cy + start.y} r={4} fill="#facc15" />
            <text x={cx + start.x + 6} y={cy + start.y - 6} fill="#cbd5e1" fontSize={10}>
              {b.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
