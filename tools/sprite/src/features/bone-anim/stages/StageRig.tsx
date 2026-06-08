// 阶段 2：骨架搭建
// - 选模板生成 bones / slots
// - 在画布上预览骨骼线，槽位列表里把切片绑定到槽位
// - 部件名称 / pivot 简单微调

import { useCallback, useMemo, useState } from "react";
import { useBoneAnim } from "../BoneAnimContext";
import { applyTemplate, getTemplateById, skeletonTemplates } from "../model/skeletonTemplates";
import { AttachmentImage, BoneNode, findAttachment, findBone, findBoneByName, getDisplayName, makeId, Slot } from "../model/skeletonModel";
import { LIMB_LENGTH_PAD } from "../model/poseToParts";
import { mapPsdLayerToBone } from "../model/psdBoneMapping";
import { fitSkeletonToPsd } from "../model/fitSkeletonToPsd";

type DragMode = "joint" | "tip";

const uprightAttachmentNames = new Set(["head", "torso", "body"]);

// 计算贴图在骨骼坐标系下的显示尺寸：
// - PSD 服饰图层（带 sourceRect）：按画布 letterbox 同比缩放，避免被四肢长度压扁
// - 四肢：按 bone.length × LIMB_LENGTH_PAD ≈ 贴图轴向像素 缩放，让贴图沿骨骼自然铺满
// - 头/躯干：按 bone.length 等比缩放（pivot.y=1.0 时 length 对应贴图高度）
// - root 等无 length 骨骼：退回贴图自身尺寸的 0.5 倍兜底
function computeAttachmentDisplaySize(att: AttachmentImage, bone: BoneNode | undefined, psdScale: number): { w: number; h: number } {
  if (att.sourceRect && psdScale > 0) {
    return { w: att.width * psdScale, h: att.height * psdScale };
  }
  const isLimb = !uprightAttachmentNames.has(att.name);
  const refLen = bone?.length || 0;
  if (refLen <= 0) {
    const fallback = Math.min(att.width, 120) / Math.max(1, att.width);
    return { w: att.width * fallback, h: att.height * fallback };
  }
  const targetAxis = isLimb ? refLen * LIMB_LENGTH_PAD : refLen;
  // 四肢主轴 = 贴图宽，头/躯干主轴 = 贴图高
  const sourceAxis = isLimb ? att.width : att.height;
  const scale = targetAxis / Math.max(1, sourceAxis);
  return { w: att.width * scale, h: att.height * scale };
}

interface BoneWorld {
  x: number;
  y: number;
  rot: number;
}

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
  const [psdRigHint, setPsdRigHint] = useState<string | null>(null);

  // PSD 一键绑骨：对带 sourceRect 的图层按"服饰名→骨骼"映射建 slot 绑到目标骨。
  // 绑骨建立"图层归属哪根骨"的数据关联（供导出与后续动画使用）；预览采用「完全骨骼驱动」，
  // 即 PSD 部件位置由所绑骨骼 setup pose + pivot 决定，sourceRect 仅用于搭骨架阶段的对位参照层。
  // 一根骨可挂多个图层（头发/脸/五官都跟 head），各建独立 slot；zOrder 取 PSD 堆叠顺序。
  const autoRigPsd = useCallback(() => {
    setSkeleton((prev) => {
      const psdParts = prev.attachments.filter((a) => a.sourceRect);
      if (psdParts.length === 0) {
        setPsdRigHint("没有带绝对坐标的 PSD 部件。先在第一步「解析 PSD 分层」并导入。");
        return prev;
      }
      if (prev.bones.length === 0) {
        setPsdRigHint("还没有骨骼。请先在左侧选模板并「应用模板」（推荐人形）。");
        return prev;
      }
      // 已被任意 slot 绑定的部件 id，避免重复建 slot。
      const boundAttIds = new Set(prev.slots.map((s) => s.attachmentId).filter(Boolean) as string[]);
      const slots = [...prev.slots];
      // PSD 数组靠前 = 最底层（psd-tools 底→顶遍历）→ zOrder 取正序，首层最小、最先画。
      const total = psdParts.length; // 仅用于提示「matched/total」
      let matched = 0;
      const unmatched: string[] = [];
      const missingBones: string[] = [];

      psdParts.forEach((att, index) => {
        if (boundAttIds.has(att.id)) return; // 已绑定，跳过
        const { boneName } = mapPsdLayerToBone(att.name);
        if (!boneName) {
          unmatched.push(getDisplayName(att));
          return;
        }
        const bone = findBoneByName(prev, boneName);
        if (!bone) {
          missingBones.push(`${getDisplayName(att)}→${boneName}`);
          return;
        }
        slots.push({
          id: makeId("sl"),
          name: att.name,
          displayName: att.displayName,
          boneId: bone.id,
          attachmentId: att.id,
          zOrder: index, // PSD 底→顶：首层最小 zOrder（最先画、最底层），末层最上
        });
        matched += 1;
      });

      const tips: string[] = [];
      if (matched > 0) tips.push(`已按图层名自动绑定 ${matched}/${total} 个 PSD 部件。`);
      if (unmatched.length > 0) tips.push(`未命中映射（请手动绑定）：${unmatched.join("、")}。`);
      if (missingBones.length > 0) tips.push(`目标骨不存在（换人形模板？）：${missingBones.join("、")}。`);
      if (matched === 0 && tips.length === 0) tips.push("所有 PSD 部件都已绑定，无需重复绑骨。");

      // 在新 slots 基础上自适应骨架到 PSD 像素位置：
      // 否则骨骼仍在 humanoid 模板默认坐标（torso=0,0、head 偏右上 130、左臂在右下…），
      // 完全骨骼驱动会把 PSD 部件全拖到错位的默认骨位上。
      let nextSkel = matched > 0 ? { ...prev, slots } : prev;
      if (matched > 0) {
        const fit = fitSkeletonToPsd(nextSkel);
        nextSkel = fit.skeleton;
        tips.push(fit.report);
      }
      setPsdRigHint(tips.join(" "));
      return nextSkel;
    });
  }, [setSkeleton]);

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
          模板提供骨骼层级和槽位定义，左侧选模板后点"应用模板"。中间画布可拖动骨骼关节点和末端，右侧把已切好的部件绑到槽位。
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
              {skeleton.attachments.some((a) => a.sourceRect) && (
                <button onClick={autoRigPsd} disabled={skeleton.bones.length === 0} title="按 PSD 图层名（服饰语义）自动映射到骨骼，摆位保持一比一">
                  PSD 一键绑骨
                </button>
              )}
              {autoRigHint && <p className="muted">{autoRigHint}</p>}
              {psdRigHint && <p className="muted">{psdRigHint}</p>}
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
                    <strong>{getDisplayName(slot)}</strong>
                    <small>{att ? getDisplayName(att) : "未绑定"}</small>
                  </div>
                  <select
                    value={slot.attachmentId || ""}
                    onChange={(e) => bindAttachmentToSlot(slot.id, e.target.value || null)}
                  >
                    <option value="">— 未绑定 —</option>
                    {skeleton.attachments.map((a) => (
                      <option key={a.id} value={a.id}>
                        {getDisplayName(a)} ({a.width}×{a.height})
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>

          {selectedSlot && (
            <div className="bone-slot-detail">
              <h4>当前槽位：{getDisplayName(selectedSlot)}</h4>
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

// 简单骨架预览：以 root 为画布中心绘制骨骼线，可拖动关节点/末端微调骨骼
function BoneCanvas({
  onSelectSlot,
  selectedSlotId,
}: {
  onSelectSlot: (id: string) => void;
  selectedSlotId: string | null;
}) {
  const { skeleton, setSkeleton } = useBoneAnim();
  const [dragging, setDragging] = useState<{ boneId: string; mode: DragMode } | null>(null);

  const w = 480;
  const h = 480;
  const cx = w / 2;
  // root 在骨盆位置：上去 head+torso ≈ 290px，下去 thigh+shin ≈ 180px，
  // 把 root 略往下移让头不出 viewBox 顶部
  const cy = h / 2 + 55;

  // 计算每个 bone 的世界坐标（仅用于线段预览，不替代真实运行时）
  const worldByBone = useMemo(() => computeBoneWorld(skeleton.bones), [skeleton.bones]);
  const slotByBoneId = useMemo(() => new Map(skeleton.slots.map((slot) => [slot.boneId, slot])), [skeleton.slots]);

  // PSD 一比一还原参照层：带 sourceRect 的部件按画布绝对坐标 letterbox 映射进 viewBox，
  // 按 attachments 数组顺序绘制（PSD 存储顺序即绘制堆叠）。搭骨架时作为对位参照。
  const psdReference = useMemo(() => {
    const withRect = skeleton.attachments.filter((a) => a.sourceRect);
    if (withRect.length === 0) return null;
    const sr0 = withRect[0].sourceRect!;
    const scale = Math.min(w / sr0.canvasWidth, h / sr0.canvasHeight);
    const offX = (w - sr0.canvasWidth * scale) / 2;
    const offY = (h - sr0.canvasHeight * scale) / 2;
    const items = withRect.map((a) => ({
      id: a.id,
      href: a.pngDataUrl,
      x: offX + a.sourceRect!.x * scale,
      y: offY + a.sourceRect!.y * scale,
      w: a.width * scale,
      h: a.height * scale,
    }));
    return { items, scale };
  }, [skeleton.attachments]);

  // PSD 服饰图层在骨骼驱动绘制时也按同一 letterbox 比例缩放，避免被四肢长度压扁
  const psdScale = psdReference?.scale ?? 0;

  const selectBone = useCallback(
    (boneId: string) => {
      const slot = slotByBoneId.get(boneId);
      if (slot) onSelectSlot(slot.id);
    },
    [onSelectSlot, slotByBoneId],
  );

  const toLocalPoint = useCallback(
    (evt: React.PointerEvent<SVGSVGElement>) => {
      const svg = evt.currentTarget;
      const pt = svg.createSVGPoint();
      pt.x = evt.clientX;
      pt.y = evt.clientY;
      const transformed = pt.matrixTransform(svg.getScreenCTM()?.inverse());
      return { x: transformed.x - cx, y: transformed.y - cy };
    },
    [cx, cy],
  );

  const updateDraggedBone = useCallback(
    (evt: React.PointerEvent<SVGSVGElement>) => {
      if (!dragging) return;
      const target = toLocalPoint(evt);
      setSkeleton((prev) => ({
        ...prev,
        bones: prev.bones.map((bone) => {
          if (bone.id !== dragging.boneId) return bone;
          const parent = bone.parentId ? computeBoneWorld(prev.bones).get(bone.parentId) : undefined;
          if (dragging.mode === "joint") {
            return { ...bone, ...worldPointToParentLocal(target, parent) };
          }
          const start = computeBoneWorld(prev.bones).get(bone.id) || { x: 0, y: 0, rot: 0 };
          const worldAngle = (Math.atan2(target.y - start.y, target.x - start.x) * 180) / Math.PI;
          const parentRot = parent?.rot ?? 0;
          const length = Math.max(8, Math.hypot(target.x - start.x, target.y - start.y));
          return { ...bone, rotation: normalizeDeg(worldAngle - parentRot), length };
        }),
      }));
    },
    [dragging, setSkeleton, toLocalPoint],
  );

  return (
    <svg
      width="100%"
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="bone-canvas"
      onPointerMove={updateDraggedBone}
      onPointerUp={() => setDragging(null)}
      onPointerLeave={() => setDragging(null)}
    >
      {/* 网格 */}
      <defs>
        <pattern id="bone-grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(148,163,184,0.12)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#bone-grid)" />

      {/* PSD 一比一还原参照层：按画布绝对坐标绘制，半透明铺底供骨架对位 */}
      {psdReference && (
        <g opacity={0.55}>
          {psdReference.items.map((it) => (
            <image key={it.id} href={it.href} x={it.x} y={it.y} width={it.w} height={it.h} />
          ))}
        </g>
      )}

      {/* 部件贴图：头/躯干保持正向，四肢按骨骼方向旋转 */}
      {skeleton.slots
        .slice()
        .sort((a, b) => a.zOrder - b.zOrder)
        .map((slot) => {
          const att = skeleton.attachments.find((a) => a.id === slot.attachmentId);
          const bone = findBone(skeleton, slot.boneId);
          if (!att || !bone) return null;
          // 完全骨骼驱动：PSD 部件不再按 sourceRect 绝对坐标绘制，统一走骨骼变换，
          // 这样动画播放时能跟随骨骼移动。半透明 psdReference 参照层仍按原坐标铺底，
          // 方便对位骨骼 setup pose。
          const wpos = worldByBone.get(bone.id) || { x: 0, y: 0, rot: 0 };
          const { w: dispW, h: dispH } = computeAttachmentDisplaySize(att, bone, psdScale);
          const pivotPx = att.pivot.x * dispW;
          const pivotPy = att.pivot.y * dispH;
          const imageRot = uprightAttachmentNames.has(bone.name) ? 0 : wpos.rot;
          const offset = slot.setupOffset;
          const tx = offset
            ? cx + wpos.x + offset.x * Math.cos((wpos.rot * Math.PI) / 180) - offset.y * Math.sin((wpos.rot * Math.PI) / 180)
            : cx + wpos.x;
          const ty = offset
            ? cy + wpos.y + offset.x * Math.sin((wpos.rot * Math.PI) / 180) + offset.y * Math.cos((wpos.rot * Math.PI) / 180)
            : cy + wpos.y;
          const rot = offset ? imageRot + offset.rotation : imageRot;
          return (
            <g
              key={slot.id}
              transform={`translate(${tx} ${ty}) rotate(${rot})`}
              style={{ cursor: "pointer" }}
              onClick={() => onSelectSlot(slot.id)}
            >
              <image
                href={att.pngDataUrl}
                x={-pivotPx}
                y={-pivotPy}
                width={dispW}
                height={dispH}
                opacity={selectedSlotId === slot.id ? 1 : 0.85}
              />
            </g>
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
        const slot = slotByBoneId.get(b.id);
        const selected = Boolean(slot && slot.id === selectedSlotId);
        return (
          <g key={b.id}>
            <line
              x1={cx + start.x}
              y1={cy + start.y}
              x2={cx + ex}
              y2={cy + ey}
              stroke={selected ? "rgba(250,204,21,0.95)" : "rgba(96,165,250,0.85)"}
              strokeWidth={selected ? 5 : 3}
              strokeLinecap="round"
              style={{ cursor: "pointer" }}
              onPointerDown={(evt) => {
                evt.preventDefault();
                selectBone(b.id);
                setDragging({ boneId: b.id, mode: "tip" });
              }}
            />
            <circle
              cx={cx + start.x}
              cy={cy + start.y}
              r={selected ? 7 : 5}
              fill="#facc15"
              stroke="#0f172a"
              strokeWidth={2}
              style={{ cursor: "grab" }}
              onPointerDown={(evt) => {
                evt.preventDefault();
                selectBone(b.id);
                setDragging({ boneId: b.id, mode: "joint" });
              }}
            />
            <circle
              cx={cx + ex}
              cy={cy + ey}
              r={selected ? 6 : 4}
              fill="#60a5fa"
              stroke="#0f172a"
              strokeWidth={2}
              style={{ cursor: "crosshair" }}
              onPointerDown={(evt) => {
                evt.preventDefault();
                selectBone(b.id);
                setDragging({ boneId: b.id, mode: "tip" });
              }}
            />
            <text x={cx + start.x + 6} y={cy + start.y - 6} fill="#cbd5e1" fontSize={10}>
              {getDisplayName(b)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function computeBoneWorld(bones: BoneNode[]): Map<string, BoneWorld> {
  const worldByBone = new Map<string, BoneWorld>();
  for (const bone of bones) {
    const parent = bone.parentId ? worldByBone.get(bone.parentId) : undefined;
    const baseX = parent?.x ?? 0;
    const baseY = parent?.y ?? 0;
    const baseRot = parent?.rot ?? 0;
    const rad = (baseRot * Math.PI) / 180;
    const x = baseX + bone.x * Math.cos(rad) - bone.y * Math.sin(rad);
    const y = baseY + bone.x * Math.sin(rad) + bone.y * Math.cos(rad);
    worldByBone.set(bone.id, { x, y, rot: baseRot + bone.rotation });
  }
  return worldByBone;
}

function worldPointToParentLocal(point: { x: number; y: number }, parent?: BoneWorld): { x: number; y: number } {
  const dx = point.x - (parent?.x ?? 0);
  const dy = point.y - (parent?.y ?? 0);
  const rad = -((parent?.rot ?? 0) * Math.PI) / 180;
  return {
    x: Math.round(dx * Math.cos(rad) - dy * Math.sin(rad)),
    y: Math.round(dx * Math.sin(rad) + dy * Math.cos(rad)),
  };
}

function normalizeDeg(deg: number): number {
  let value = deg;
  while (value > 180) value -= 360;
  while (value < -180) value += 360;
  return Math.round(value);
}
