import { BoneNode, Skeleton, Slot } from "./skeletonModel";

export type ThreeQuarterDirection = "right" | "left";

export interface FrontPsdToThreeQuarterOptions {
  direction?: ThreeQuarterDirection;
  intensity?: number;
}

export interface FrontPsdToThreeQuarterReport {
  direction: ThreeQuarterDirection;
  intensity: number;
  nearSide: "L" | "R";
  farSide: "L" | "R";
  changedBones: string[];
  changedSlots: string[];
  notes: string[];
}

export interface FrontPsdToThreeQuarterResult {
  skeleton: Skeleton;
  report: FrontPsdToThreeQuarterReport;
}

const FACE_SLOT_PATTERN = /face|eye|brow|lash|iris|pupil|nose|mouth|lip|teeth|tongue|cheek/i;
const LIMB_PATTERN = /arm|hand|leg|foot|sleeve|glove|boot|shoe|sock|thigh|shin|wrist|ankle|forearm|upperarm/i;
const TORSO_PATTERN = /torso|chest|waist|body/i;
const HEAD_PATTERN = /head|face/i;
const SIDE_SUFFIX_PATTERN = /(?:^|[-_ ])([lr])(?:$|[-_0-9 ])|(?:^|[-_ ])(left|right)(?:$|[-_0-9 ])/i;

function clampIntensity(value: number | undefined): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(0.5, Math.min(1.5, value ?? 1));
}

function signed(direction: ThreeQuarterDirection, amount: number): number {
  return direction === "right" ? amount : -amount;
}

function detectSide(name: string): "L" | "R" | null {
  const camelSuffix = name.match(/[a-z]([LR])(?:\b|$)/);
  if (camelSuffix) return camelSuffix[1] as "L" | "R";

  const match = name.match(SIDE_SUFFIX_PATTERN);
  if (!match) return null;
  const raw = (match[1] ?? match[2] ?? "").toLowerCase();
  if (raw === "l" || raw === "left") return "L";
  if (raw === "r" || raw === "right") return "R";
  return null;
}

function mergeOffset(slot: Slot, dx: number, dy: number, rotation: number): Slot {
  const prev = slot.setupOffset ?? { x: 0, y: 0, rotation: 0 };
  return {
    ...slot,
    setupOffset: {
      x: prev.x + dx,
      y: prev.y + dy,
      rotation: prev.rotation + rotation,
    },
  };
}

function nudgeBone(bone: BoneNode, patch: Partial<Pick<BoneNode, "x" | "y" | "rotation" | "scaleX" | "scaleY">>): BoneNode {
  return {
    ...bone,
    x: bone.x + (patch.x ?? 0),
    y: bone.y + (patch.y ?? 0),
    rotation: bone.rotation + (patch.rotation ?? 0),
    scaleX: bone.scaleX * (patch.scaleX ?? 1),
    scaleY: bone.scaleY * (patch.scaleY ?? 1),
  };
}

function groupZOrder(slot: Slot, groupBase: number): number {
  const fractionalOrder = slot.zOrder - Math.trunc(slot.zOrder);
  const stableOffset = (Math.abs(Math.trunc(slot.zOrder)) % 10) / 1000;
  return groupBase + fractionalOrder + stableOffset;
}

function sideName(side: "L" | "R"): string {
  return side === "L" ? "左" : "右";
}

export function convertFrontPsdToThreeQuarter(
  skeleton: Skeleton,
  options: FrontPsdToThreeQuarterOptions = {},
): FrontPsdToThreeQuarterResult {
  const direction = options.direction ?? "right";
  const intensity = clampIntensity(options.intensity);
  const nearSide: "L" | "R" = direction === "right" ? "L" : "R";
  const farSide: "L" | "R" = nearSide === "L" ? "R" : "L";
  const report: FrontPsdToThreeQuarterReport = {
    direction,
    intensity,
    nearSide,
    farSide,
    changedBones: [],
    changedSlots: [],
    notes: [
      `v1 为非破坏式 3Q 伪侧面：仅调整骨骼 setup 与 slot setupOffset/zOrder，不重绘 PSD 像素。`,
      `默认 ${direction} 朝向：近侧=${sideName(nearSide)}，远侧=${sideName(farSide)}。再次应用会叠加。`,
    ],
  };

  const psdAttachments = skeleton.attachments.filter((attachment) => attachment.sourceRect);
  if (psdAttachments.length === 0) {
    report.notes.push("未找到带 sourceRect 的 PSD 部件，保持 no-op。");
    return { skeleton, report };
  }

  const psdAttachmentIds = new Set(psdAttachments.map((attachment) => attachment.id));
  const hasBoundPsdSlot = skeleton.slots.some((slot) => slot.attachmentId && psdAttachmentIds.has(slot.attachmentId));
  if (!hasBoundPsdSlot) {
    report.notes.push("PSD 部件尚未绑定到 slot，保持 no-op。请先执行 PSD 一键绑骨。");
    return { skeleton, report };
  }

  const boneById = new Map(skeleton.bones.map((bone) => [bone.id, bone]));
  const hasHead = skeleton.bones.some((bone) => HEAD_PATTERN.test(bone.name));
  const hasTorso = skeleton.bones.some((bone) => TORSO_PATTERN.test(bone.name));
  const hasLimb = skeleton.bones.some((bone) => LIMB_PATTERN.test(bone.name));
  if (!hasHead) report.notes.push("未找到 head/face 骨骼，跳过头部骨骼旋转，仅尝试 slot 偏移。");
  if (!hasTorso) report.notes.push("未找到 torso/chest/waist/body 骨骼，跳过躯干压缩/旋转。");
  if (!hasLimb) report.notes.push("未找到明确四肢骨骼，跳过四肢骨骼缩放。");

  const changedBoneNames = new Set<string>();
  const changedSlotNames = new Set<string>();

  const bones = skeleton.bones.map((bone) => {
    const name = bone.name;
    const lower = name.toLowerCase();
    const side = detectSide(name);
    let next = bone;

    if (/^head$|head|face/i.test(name)) {
      next = nudgeBone(next, {
        x: signed(direction, 4 * intensity),
        y: -1 * intensity,
        rotation: signed(direction, 3 * intensity),
      });
    } else if (TORSO_PATTERN.test(name)) {
      const torsoWeight = lower.includes("torso") || lower.includes("body") ? 1 : 0.55;
      next = nudgeBone(next, {
        rotation: signed(direction, 2.5 * torsoWeight * intensity),
        scaleX: 1 - 0.04 * torsoWeight * intensity,
      });
    }

    if (side && LIMB_PATTERN.test(name)) {
      const isNear = side === nearSide;
      const amount = isNear ? 1 : -1;
      const scale = isNear ? 1 + 0.035 * intensity : 1 - 0.045 * intensity;
      next = nudgeBone(next, {
        x: signed(direction, amount * 3 * intensity),
        y: (isNear ? 3 : -3) * intensity,
        rotation: signed(direction, (isNear ? -2 : 2) * intensity),
        scaleX: Math.max(0.92, Math.min(1.06, scale)),
        scaleY: Math.max(0.92, Math.min(1.06, scale)),
      });
    }

    if (next !== bone) changedBoneNames.add(name);
    return next;
  });

  const slots = skeleton.slots.map((slot) => {
    const attachmentIsPsd = Boolean(slot.attachmentId && psdAttachmentIds.has(slot.attachmentId));
    if (!attachmentIsPsd) return { ...slot };

    const bone = boneById.get(slot.boneId);
    const semanticName = `${slot.name} ${slot.displayName ?? ""} ${bone?.name ?? ""} ${bone?.displayName ?? ""}`;
    const side = detectSide(semanticName);
    let next: Slot = { ...slot, setupOffset: slot.setupOffset ? { ...slot.setupOffset } : undefined };

    if (FACE_SLOT_PATTERN.test(semanticName)) {
      const isFarFace = side === farSide;
      const faceShift = isFarFace ? 4 : 7;
      next = mergeOffset(next, signed(direction, faceShift * intensity), isFarFace ? -1 * intensity : 0, signed(direction, (isFarFace ? -2 : 1.5) * intensity));
    }

    if (side && LIMB_PATTERN.test(semanticName)) {
      const isNear = side === nearSide;
      next = mergeOffset(
        next,
        signed(direction, (isNear ? 7 : -5) * intensity),
        (isNear ? 4 : -4) * intensity,
        signed(direction, (isNear ? -2 : 2) * intensity),
      );
      next = { ...next, zOrder: groupZOrder(next, isNear ? 60 : 30) };
    }

    if (next !== slot && (next.setupOffset !== slot.setupOffset || next.zOrder !== slot.zOrder)) {
      changedSlotNames.add(slot.name);
    }
    return next;
  });

  report.changedBones = Array.from(changedBoneNames).sort();
  report.changedSlots = Array.from(changedSlotNames).sort();
  if (report.changedBones.length === 0 && report.changedSlots.length === 0) {
    report.notes.push("未命中可调整的头/躯干/四肢/面部语义，输出与输入等价。可检查图层和骨骼命名。");
  }

  return {
    skeleton: {
      ...skeleton,
      bones,
      slots,
      attachments: skeleton.attachments.map((attachment) => ({ ...attachment, pivot: { ...attachment.pivot }, sourceRect: attachment.sourceRect ? { ...attachment.sourceRect } : undefined })),
      animations: skeleton.animations.map((animation) => ({
        ...animation,
        bones: animation.bones.map((timeline) => ({
          ...timeline,
          keyframes: timeline.keyframes.map((keyframe) => ({ ...keyframe, values: [...keyframe.values] })),
        })),
        sourceTemplate: animation.sourceTemplate
          ? { ...animation.sourceTemplate, params: { ...animation.sourceTemplate.params } }
          : undefined,
      })),
    },
    report,
  };
}
