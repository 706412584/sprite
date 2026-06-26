// 阶段 2：骨架搭建
// - 选模板生成 bones / slots
// - 在画布上预览骨骼线，槽位列表里把切片绑定到槽位
// - 部件名称 / pivot 简单微调

import { useCallback, useEffect, useMemo, useState } from "react";
import { useBoneAnim, CharacterPoseMode } from "../BoneAnimContext";
import { applyTemplate, getTemplateById, skeletonTemplates } from "../model/skeletonTemplates";
import { addBone, removeBone, AttachmentImage, BoneNode, BoneWorld, computeBoneWorld, worldPointToParentLocal, findBone, findBoneByName, getDisplayName, makeId, Skeleton, Slot } from "../model/skeletonModel";
import { LIMB_LENGTH_PAD } from "../model/poseToParts";
import { mapPsdLayerToBone } from "../model/psdBoneMapping";
import { fitSkeletonToPsd } from "../model/fitSkeletonToPsd";
import { detectPose } from "../model/poseDetector";
import { convertFrontPsdToThreeQuarter, FrontPsdToThreeQuarterReport } from "../model/frontPsdToThreeQuarter";

interface PsdRigCheck {
  total: number;
  matched: number;
  alreadyBound: number;
  unmatched: string[];
  missingBones: string[];
  defaultSideWarnings: string[];
  keyParts: Array<{ label: string; ok: boolean }>;
}

const sidedLayerPattern = /(^|[-_])(l|r)($|[-_0-9])|left|right/i;
const HEAD_LAYER_Z: Array<{ pattern: RegExp; z: number }> = [
  { pattern: /back[-_ ]?hair|hair[-_ ]?back|rear[-_ ]?hair/i, z: -40 },
  { pattern: /front[-_ ]?hair|hair[-_ ]?front|bang|hair|headwear|hat|helmet|horn/i, z: 40 },
  { pattern: /eye|brow|lash|iris|irid|pupil|mouth|lip|teeth|tongue/i, z: -10 },
  { pattern: /(^|[-_ ])(head|face|ear|nose)($|[-_ ])/i, z: -20 },
];

function getPsdSlotZOrder(att: AttachmentImage, index: number): number {
  const headLayer = HEAD_LAYER_Z.find((layer) => layer.pattern.test(att.name) || layer.pattern.test(att.displayName ?? ""));
  return headLayer ? headLayer.z + index / 1000 : index;
}

function hasSidedIntent(name: string): boolean {
  return /(arm|hand|leg|foot|sleeve|glove|boot|shoe|sock|thigh|shin|wrist|ankle)/i.test(name);
}

function buildKeyPartChecks(skeleton: Skeleton): Array<{ label: string; ok: boolean }> {
  return [
    { label: "head 头部", ok: Boolean(findBoneByName(skeleton, "head")) },
    { label: "torso/chest 躯干", ok: Boolean(findBoneByName(skeleton, "torso") || findBoneByName(skeleton, "chest") || findBoneByName(skeleton, "body")) },
    { label: "arm 手臂", ok: Boolean(findBoneByName(skeleton, "upperArmL") || findBoneByName(skeleton, "forearmL") || findBoneByName(skeleton, "upperArmR") || findBoneByName(skeleton, "forearmR")) },
    { label: "leg 腿部", ok: Boolean(findBoneByName(skeleton, "thighL") || findBoneByName(skeleton, "shinL") || findBoneByName(skeleton, "thighR") || findBoneByName(skeleton, "shinR")) },
  ];
}

type DragMode = "joint" | "tip";

const uprightAttachmentNames = new Set(["head", "torso", "body", "chest", "waist", "eyeL", "eyeR", "mouth"]);

// 计算贴图在骨骼坐标系下的显示尺寸：
// - PSD 服饰图层（带 sourceRect）：按画布 letterbox 同比缩放，避免被四肢长度压扁
// - 四肢：按 bone.length × LIMB_LENGTH_PAD ≈ 贴图轴向像素 缩放，让贴图沿骨骼自然铺满
// - 头/躯干：按 bone.length 等比缩放（pivot.y=1.0 时 length 对应贴图高度）
// - root 等无 length 骨骼：退回贴图自身尺寸的 0.5 倍兜底
function computeAttachmentDisplaySize(att: AttachmentImage, bone: BoneNode | undefined, psdScale: number): { w: number; h: number } {
  if (att.sourceRect && psdScale > 0) {
    return { w: att.width * psdScale, h: att.height * psdScale };
  }
  const isLimb = !uprightAttachmentNames.has(bone?.name ?? att.name);
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

interface Props {
  onNext: () => void;
}

/** 递归渲染骨骼树行 */
function renderBoneTree(
  bones: BoneNode[],
  parentId: string | null,
  depth: number,
  selectedBoneId: string | null,
  onSelectBone: (id: string | null) => void,
  onDeleteBone: (id: string) => void,
): React.ReactNode[] {
  const children = bones.filter((b) => b.parentId === parentId);
  if (children.length === 0) return [];
  return children.flatMap((bone) => {
    const row = (
      <div
        key={bone.id}
        className={`bone-tree-row ${selectedBoneId === bone.id ? "selected" : ""}`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={(e) => {
          e.stopPropagation();
          onSelectBone(bone.id);
        }}
      >
        <span className="bone-tree-row-name">{getDisplayName(bone)}</span>
        <button
          type="button"
          className="bone-delete-btn"
          title="删除骨骼"
          onClick={(e) => {
            e.stopPropagation();
            onDeleteBone(bone.id);
          }}
        >
          ×
        </button>
      </div>
    );
    return [row, ...renderBoneTree(bones, bone.id, depth + 1, selectedBoneId, onSelectBone, onDeleteBone)];
  });
}

export function StageRig({ onNext }: Props) {
  const { skeleton, setSkeleton, selectedSlotId, setSelectedSlotId, selectedBoneId, setSelectedBoneId, poseMode, setPoseMode, setPoseDetection, setPoseOverride } = useBoneAnim();
  const [templateId, setTemplateId] = useState<string>("humanoid");
  const [addBoneMode, setAddBoneMode] = useState<boolean>(false);

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
  const [psdRigCheck, setPsdRigCheck] = useState<PsdRigCheck | null>(null);
  const [threeQuarterReport, setThreeQuarterReport] = useState<FrontPsdToThreeQuarterReport | null>(null);

  const attachmentById = useMemo(() => new Map(skeleton.attachments.map((attachment) => [attachment.id, attachment])), [skeleton.attachments]);
  const selectedSlot: Slot | undefined = useMemo(
    () => skeleton.slots.find((slot) => slot.id === selectedSlotId),
    [skeleton.slots, selectedSlotId],
  );
  const selectedAttachment = useMemo(
    () => (selectedSlot?.attachmentId ? attachmentById.get(selectedSlot.attachmentId) : undefined),
    [attachmentById, selectedSlot],
  );
  const hasPsdSourceParts = useMemo(() => skeleton.attachments.some((attachment) => attachment.sourceRect), [skeleton.attachments]);
  const hasBoundPsdParts = useMemo(
    () => skeleton.slots.some((slot) => Boolean(slot.attachmentId && attachmentById.get(slot.attachmentId)?.sourceRect)),
    [attachmentById, skeleton.slots],
  );
  const threeQuarterDisabledReason = !hasPsdSourceParts
    ? "没有带 sourceRect 的 PSD 部件。先解析 PSD 分层并导入。"
    : !hasBoundPsdParts
      ? "PSD 部件还没有绑定到 slot。请先执行 PSD 一键绑骨。"
      : null;

  // PSD 一键绑骨：对带 sourceRect 的图层按"服饰名→骨骼"映射建 slot 绑到目标骨。
  // 绑骨建立"图层归属哪根骨"的数据关联（供导出与后续动画使用）；预览采用「完全骨骼驱动」，
  // 即 PSD 部件位置由所绑骨骼 setup pose + pivot 决定，sourceRect 仅用于搭骨架阶段的对位参照层。
  // 一根骨可挂多个图层（头发/脸/五官都跟 head），各建独立 slot；zOrder 取 PSD 堆叠顺序。
  const autoRigPsd = useCallback(() => {
    setSkeleton((prev) => {
      const psdParts = prev.attachments.filter((a) => a.sourceRect);
      if (psdParts.length === 0) {
        setPsdRigHint("没有带绝对坐标的 PSD 部件。先在第一步「解析 PSD 分层」并导入。");
        setPsdRigCheck(null);
        return prev;
      }
      if (prev.bones.length === 0) {
        setPsdRigHint("还没有骨骼。请先在左侧选模板并「应用模板」（推荐人形）。");
        setPsdRigCheck(null);
        return prev;
      }
      // 已被任意 slot 绑定的部件 id，避免重复建 slot。
      const boundAttIds = new Set(prev.slots.map((s) => s.attachmentId).filter(Boolean) as string[]);
      const slots = [...prev.slots];
      // PSD 数组靠前 = 最底层（psd-tools 底→顶遍历）→ zOrder 取正序，首层最小、最先画。
      const total = psdParts.length; // 仅用于提示「matched/total」
      let matched = 0;
      let alreadyBound = 0;
      const unmatched: string[] = [];
      const missingBones: string[] = [];
      const defaultSideWarnings: string[] = [];

      psdParts.forEach((att, index) => {
        if (boundAttIds.has(att.id)) {
          alreadyBound += 1;
          return;
        }
        const { boneNames } = mapPsdLayerToBone(att.name);
        if (boneNames.length === 0) {
          unmatched.push(getDisplayName(att));
          return;
        }
        if (boneNames.some((name) => name.endsWith("L")) && !sidedLayerPattern.test(att.name) && hasSidedIntent(att.name)) {
          defaultSideWarnings.push(getDisplayName(att));
        }
        const boneName = boneNames.find((name) => findBoneByName(prev, name));
        const bone = boneName ? findBoneByName(prev, boneName) : undefined;
        if (!bone) {
          missingBones.push(`${getDisplayName(att)}→${boneNames.join("/")}`);
          return;
        }
        slots.push({
          id: makeId("sl"),
          name: att.name,
          displayName: att.displayName,
          boneId: bone.id,
          attachmentId: att.id,
          zOrder: getPsdSlotZOrder(att, index), // 头部簇按语义稳定层级；其余沿用 PSD 底→顶顺序
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
      // 自动姿态识别：根据图层名 + sourceRect 推断 front/back/sideLeft/sideRight；
      // 写进 context 供"生成动作"阶段决定模板高亮 + 投影。
      const detection = detectPose(nextSkel);
      setPoseDetection(detection);
      tips.push(`姿态识别：${detection.pose}（置信度 ${(detection.confidence * 100).toFixed(0)}%）`);
      setPsdRigHint(tips.join(" "));
      setPsdRigCheck({
        total,
        matched,
        alreadyBound,
        unmatched,
        missingBones,
        defaultSideWarnings,
        keyParts: buildKeyPartChecks(prev),
      });
      return nextSkel;
    });
  }, [setSkeleton, setPoseDetection]);

  const convertPsdToThreeQuarter = useCallback(() => {
    setSkeleton((prev) => {
      const result = convertFrontPsdToThreeQuarter(prev, { direction: "right" });
      setThreeQuarterReport(result.report);
      if (result.skeleton === prev) return prev;
      return result.skeleton;
    });
    setPoseMode("pseudoSide");
    setPoseOverride("threeQuarter");
  }, [setSkeleton, setPoseMode, setPoseOverride]);

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

  const slotHint = useMemo(() => {
    if (!currentTemplate || !selectedSlot) return "";
    return currentTemplate.slots.find((s) => s.name === selectedSlot.name)?.hint ?? "";
  }, [currentTemplate, selectedSlot]);

  // ---- 骨骼树操作 ----
  const deleteBone = useCallback(
    (boneId: string) => {
      setSkeleton((prev) => removeBone(prev, boneId));
      if (selectedBoneId === boneId) setSelectedBoneId(null);
    },
    [setSkeleton, selectedBoneId, setSelectedBoneId],
  );

  // 选中的骨骼对象
  const selectedBone = useMemo(
    () => (selectedBoneId ? skeleton.bones.find((b) => b.id === selectedBoneId) : undefined),
    [skeleton.bones, selectedBoneId],
  );

  const updateBoneField = useCallback(
    (boneId: string, field: keyof BoneNode, value: number | string) => {
      setSkeleton((prev) => ({
        ...prev,
        bones: prev.bones.map((b) => (b.id === boneId ? { ...b, [field]: value } : b)),
      }));
    },
    [setSkeleton],
  );

  const deleteSelectedBone = useCallback(() => {
    if (!selectedBoneId) return;
    setSkeleton((prev) => removeBone(prev, selectedBoneId));
    setSelectedBoneId(null);
  }, [setSkeleton, selectedBoneId, setSelectedBoneId]);

  const ready = skeleton.bones.length > 0 && skeleton.slots.some((s) => s.attachmentId);
  const poseNotes: Record<CharacterPoseMode, string> = {
    front: "正面 PSD 可使用人形/细分人形模板，当前 PSD 拟合按左右对称处理。",
    pseudoSide: "伪侧面复用 threeQuarter 姿态，可使用正面细分模板或侧面细分模板模拟 3Q 效果。",
    sidePending: "真侧面会映射到 sideLeft/sideRight 流程；推荐使用「人形侧面细分」模板和 near/far 或 left/right 图层名。",
  };

  return (
    <div className="bone-stage">
      <div className="info-box">
        <strong>第二步：选择角色结构与朝向，再绑定 PSD 部件</strong>
        <p className="muted">
          模板提供骨骼层级和槽位定义。正面、伪侧面（threeQuarter）和真侧面（sideLeft/sideRight）都可沿 PSD 一键绑骨流程导入；真侧面建议选择侧面细分模板。
        </p>
      </div>

      <div className="bone-mode-card">
        <div>
          <strong>角色结构</strong>
          <p className="muted">人形 / 四足 / 道具会映射到左侧现有骨架模板。</p>
        </div>
        <div className="bone-pose-mode-row">
          {([
            ["front", "正面"],
            ["pseudoSide", "伪侧面"],
            ["sidePending", "真侧面"],
          ] as Array<[CharacterPoseMode, string]>).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              className={`bone-pose-mode ${poseMode === mode ? "selected" : ""}`}
              onClick={() => setPoseMode(mode)}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="muted">{poseNotes[poseMode]}</p>
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
          <BoneCanvas
            onSelectSlot={setSelectedSlotId}
            selectedSlotId={selectedSlotId}
            addBoneMode={addBoneMode}
            onAddBoneModeChange={setAddBoneMode}
            selectedBoneId={selectedBoneId}
            onSelectBone={setSelectedBoneId}
          />
        </section>

        <aside className="bone-rig-inspector">
          {/* ---- 骨骼树 ---- */}
          <div className="bone-tree">
            <div className="bone-tree-header">
              <h4>骨骼树</h4>
              <button type="button" onClick={() => setAddBoneMode(true)} disabled={addBoneMode}>
                + 添加
              </button>
            </div>
            {skeleton.bones.length === 0 && <p className="muted">先应用模板或在画布中添加骨骼。</p>}
            <div className="bone-tree-list">
              {renderBoneTree(skeleton.bones, null, 0, selectedBoneId, setSelectedBoneId, deleteBone)}
            </div>
          </div>

          {/* ---- 选中骨骼属性编辑 ---- */}
          {selectedBone && (
            <div className="bone-detail-editor">
              <h4>骨骼属性</h4>
              <div className="bone-detail-row">
                <label>名称</label>
                <input
                  value={selectedBone.name}
                  onChange={(e) => updateBoneField(selectedBone.id, "name", e.target.value)}
                />
              </div>
              <div className="bone-detail-row">
                <label>X</label>
                <input
                  type="number"
                  value={selectedBone.x}
                  onChange={(e) => updateBoneField(selectedBone.id, "x", Number(e.target.value))}
                />
              </div>
              <div className="bone-detail-row">
                <label>Y</label>
                <input
                  type="number"
                  value={selectedBone.y}
                  onChange={(e) => updateBoneField(selectedBone.id, "y", Number(e.target.value))}
                />
              </div>
              <div className="bone-detail-row">
                <label>旋转</label>
                <input
                  type="number"
                  value={selectedBone.rotation}
                  onChange={(e) => updateBoneField(selectedBone.id, "rotation", Number(e.target.value))}
                />
              </div>
              <div className="bone-detail-row">
                <label>长度</label>
                <input
                  type="number"
                  value={selectedBone.length}
                  onChange={(e) => updateBoneField(selectedBone.id, "length", Number(e.target.value))}
                />
              </div>
              <button type="button" className="bone-delete-btn" onClick={deleteSelectedBone}>
                删除骨骼
              </button>
            </div>
          )}

          <h4>槽位绑定</h4>
          {skeleton.slots.length === 0 && <p className="muted">先应用模板生成槽位。</p>}
          {skeleton.slots.length > 0 && (
            <div className="bone-autorig">
              <button onClick={autoRig} disabled={skeleton.attachments.length === 0}>
                按名称自动绑定
              </button>
              {hasPsdSourceParts && (
                <button onClick={autoRigPsd} disabled={skeleton.bones.length === 0} title="按 PSD 图层名（服饰语义）自动映射到骨骼，摆位保持一比一">
                  PSD 一键绑骨
                </button>
              )}
              <button onClick={convertPsdToThreeQuarter} disabled={Boolean(threeQuarterDisabledReason)} title={threeQuarterDisabledReason ?? "非破坏式调整骨骼与 slot setup，生成 threeQuarter 伪侧面"}>
                正面 PSD 转 3Q 伪侧面
              </button>
              {threeQuarterDisabledReason && <p className="muted">{threeQuarterDisabledReason}</p>}
              {autoRigHint && <p className="muted">{autoRigHint}</p>}
              {psdRigHint && <p className="muted">{psdRigHint}</p>}
              {threeQuarterReport && (
                <div className="bone-rig-checklist">
                  <strong>3Q 伪侧面转换报告</strong>
                  <p className="muted">非破坏式 3Q 伪侧面：不会重绘 PSD 像素，可再次应用但会叠加。</p>
                  <div className="bone-stat-row">
                    <span>方向：{threeQuarterReport.direction}</span>
                    <span>强度：{threeQuarterReport.intensity.toFixed(2)}</span>
                  </div>
                  <div className="bone-stat-row">
                    <span>骨骼：{threeQuarterReport.changedBones.length}</span>
                    <span>槽位：{threeQuarterReport.changedSlots.length}</span>
                  </div>
                  <ul>
                    {threeQuarterReport.changedBones.length > 0 && (
                      <li className="ok">changedBones：{threeQuarterReport.changedBones.join("、")}</li>
                    )}
                    {threeQuarterReport.changedSlots.length > 0 && (
                      <li className="ok">changedSlots：{threeQuarterReport.changedSlots.join("、")}</li>
                    )}
                    {threeQuarterReport.notes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                </div>
              )}
              {psdRigCheck && (
                <div className="bone-rig-checklist">
                  <strong>PSD 绑定检查</strong>
                  <div className="bone-stat-row">
                    <span>新增绑定：{psdRigCheck.matched}/{psdRigCheck.total}</span>
                    <span>已存在：{psdRigCheck.alreadyBound}</span>
                  </div>
                  <ul>
                    {psdRigCheck.keyParts.map((part) => (
                      <li key={part.label} className={part.ok ? "ok" : "warning"}>
                        {part.ok ? "通过" : "缺少"}：{part.label}
                      </li>
                    ))}
                    {psdRigCheck.unmatched.map((name) => (
                      <li key={`unmatched-${name}`} className="warning">未命中图层：{name}</li>
                    ))}
                    {psdRigCheck.missingBones.map((name) => (
                      <li key={`missing-${name}`} className="warning">目标骨骼缺失：{name}</li>
                    ))}
                    {psdRigCheck.defaultSideWarnings.map((name) => (
                      <li key={`side-${name}`} className="warning">缺少左右标记，已按默认侧匹配：{name}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          <div className="bone-slot-list">
            {skeleton.slots.map((slot) => {
              const att = slot.attachmentId ? attachmentById.get(slot.attachmentId) : undefined;
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
          下一步：生成动作 →
        </button>
      </div>
    </div>
  );
}

// 简单骨架预览：以 root 为画布中心绘制骨骼线，可拖动关节点/末端微调骨骼
function BoneCanvas({
  onSelectSlot,
  selectedSlotId,
  addBoneMode,
  onAddBoneModeChange,
  selectedBoneId,
  onSelectBone,
}: {
  onSelectSlot: (id: string) => void;
  selectedSlotId: string | null;
  addBoneMode: boolean;
  onAddBoneModeChange: (mode: boolean) => void;
  selectedBoneId: string | null;
  onSelectBone: (id: string | null) => void;
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

  // Escape 键退出添加骨骼模式
  useEffect(() => {
    if (!addBoneMode) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onAddBoneModeChange(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [addBoneMode, onAddBoneModeChange]);

  // 在画布中点击添加骨骼
  const handleCanvasClickAddBone = useCallback(
    (evt: React.PointerEvent<SVGSVGElement>) => {
      if (!addBoneMode) return;
      const local = toLocalPoint(evt);
      // 找最近的已有骨骼作为父骨骼；如果没有骨骼则挂到根
      let parentId: string | null = null;
      let minDist = Infinity;
      for (const [id, w] of worldByBone.entries()) {
        const d = Math.hypot(local.x - w.x, local.y - w.y);
        if (d < minDist) {
          minDist = d;
          parentId = id;
        }
      }
      // 如果最近骨骼太远（>200px），直接挂到根
      if (minDist > 200) parentId = null;
      setSkeleton((prev) => addBone(prev, { parentId, x: local.x, y: local.y }));
      onAddBoneModeChange(false);
    },
    [addBoneMode, toLocalPoint, worldByBone, setSkeleton, onAddBoneModeChange],
  );

  return (
    <svg
      width="100%"
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="bone-canvas"
      style={addBoneMode ? { cursor: "crosshair" } : undefined}
      onPointerMove={updateDraggedBone}
      onPointerUp={() => setDragging(null)}
      onPointerLeave={() => setDragging(null)}
      onClick={addBoneMode ? handleCanvasClickAddBone : undefined}
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

function normalizeDeg(deg: number): number {
  let value = deg;
  while (value > 180) value -= 360;
  while (value < -180) value += 360;
  return Math.round(value);
}
