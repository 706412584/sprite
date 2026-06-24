// Spine 4.x JSON 导出
// 与 DragonBones 概念相通但字段不同：
// - skeleton 顶层带版本字段
// - bones 是数组，每个有 name/parent/x/y/rotation/scaleX/scaleY/length
// - slots 是数组，每个 name/bone/attachment
// - skins 是带 name + attachments 字典的数组（4.x 形态）
// - animations 是 { [name]: { bones: { [boneName]: { translate/rotate/scale: [{time, x, y, ...}] } } } }
// - 时间用秒（与 DragonBones 不同）
// - 旋转用度（与 DragonBones rotateFrame 不同）

import { Skeleton, Animation, BoneNode, Slot, AttachmentImage, Keyframe, safeName } from "../model/skeletonModel";
import { PackedAtlas } from "./atlasPacker";

const SPINE_VERSION = "4.1.00";
const SPINE_HASH = "sprite-tool";

interface SpineSkeletonHead {
  hash: string;
  spine: string;
  width: number;
  height: number;
  images: string;
  audio?: string;
}

interface SpineBone {
  name: string;
  parent?: string;
  x?: number;
  y?: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  length?: number;
}

interface SpineSlot {
  name: string;
  bone: string;
  attachment?: string;
}

interface SpineAttachment {
  type?: "region";
  x?: number;
  y?: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  width: number;
  height: number;
}

interface SpineSkin {
  name: string;
  attachments: Record<string, Record<string, SpineAttachment>>;
}

interface SpineFrame {
  time: number;
  curve?: "stepped" | number[];
}
interface SpineTranslateFrame extends SpineFrame {
  x?: number;
  y?: number;
}
interface SpineRotateFrame extends SpineFrame {
  value?: number;
}
interface SpineScaleFrame extends SpineFrame {
  x?: number;
  y?: number;
}

interface SpineBoneTimeline {
  translate?: SpineTranslateFrame[];
  rotate?: SpineRotateFrame[];
  scale?: SpineScaleFrame[];
}

interface SpineAnimation {
  bones?: Record<string, SpineBoneTimeline>;
}

export interface SpineSkeletonJson {
  skeleton: SpineSkeletonHead;
  bones: SpineBone[];
  slots: SpineSlot[];
  skins: SpineSkin[];
  animations: Record<string, SpineAnimation>;
}

export interface SpineExport {
  skeleton: SpineSkeletonJson;
  atlasText: string;
  pngBlob: Blob;
  pngDataUrl: string;
  fileBaseName: string;
}

export interface SpineExportOptions {
  fileBaseName?: string;
}

function easingToCurve(easing: Keyframe["easing"]): SpineFrame["curve"] | undefined {
  switch (easing) {
    case "stepped":
      return "stepped";
    case "easeIn":
      return [0.42, 0, 1, 1];
    case "easeOut":
      return [0, 0, 0.58, 1];
    case "easeInOut":
      return [0.42, 0, 0.58, 1];
    default:
      return undefined; // linear
  }
}

function buildBones(skeleton: Skeleton): SpineBone[] {
  const byId = new Map(skeleton.bones.map((b) => [b.id, b]));
  return skeleton.bones.map((b) => {
    const out: SpineBone = { name: b.name };
    if (b.parentId) out.parent = byId.get(b.parentId)?.name;
    if (b.x !== 0) out.x = b.x;
    // Spine 默认 y 向上为正；编辑态 y 向下为正，导出取反
    if (b.y !== 0) out.y = -b.y;
    if (b.rotation !== 0) out.rotation = b.rotation;
    if (b.scaleX !== 1) out.scaleX = b.scaleX;
    if (b.scaleY !== 1) out.scaleY = b.scaleY;
    if (b.length) out.length = b.length;
    return out;
  });
}

function buildSlots(skeleton: Skeleton): SpineSlot[] {
  const boneById = new Map(skeleton.bones.map((b) => [b.id, b]));
  const attById = new Map(skeleton.attachments.map((a) => [a.id, a]));
  const sorted = skeleton.slots.slice().sort((a, b) => a.zOrder - b.zOrder);
  return sorted.map((s) => {
    const bone = boneById.get(s.boneId);
    const att = s.attachmentId ? attById.get(s.attachmentId) : null;
    const out: SpineSlot = { name: s.name, bone: bone?.name || "root" };
    if (att) out.attachment = att.name;
    return out;
  });
}

function buildSkin(skeleton: Skeleton): SpineSkin {
  const skinAttachments: Record<string, Record<string, SpineAttachment>> = {};
  const attById = new Map(skeleton.attachments.map((a) => [a.id, a]));
  for (const s of skeleton.slots) {
    if (!s.attachmentId) continue;
    const att: AttachmentImage | undefined = attById.get(s.attachmentId);
    if (!att) continue;
    // pivot 是图像中心相对左上角的 0-1 比例。Spine 的 attachment x/y 是 attachment 中心相对 slot 原点的偏移，
    // 用 pivot 0.5 时为 0；偏离中心则给负 / 正偏移。取 (0.5 - pivot) * size。
    // setupOffset 来自编辑态（y 向下为正），Spine y 向上为正，因此叠加时需要取反。
    const setupOffset = s.setupOffset;
    const cx = (0.5 - att.pivot.x) * att.width + (setupOffset?.x ?? 0);
    const cy = -(0.5 - att.pivot.y) * att.height - (setupOffset?.y ?? 0);
    const rotation = setupOffset?.rotation ?? 0;
    const region: SpineAttachment = {
      width: att.width,
      height: att.height,
    };
    if (cx !== 0) region.x = cx;
    if (cy !== 0) region.y = cy;
    if (rotation !== 0) region.rotation = rotation;
    skinAttachments[s.name] = { [att.name]: region };
  }
  return { name: "default", attachments: skinAttachments };
}

function buildBoneTimelines(skeleton: Skeleton, anim: Animation): Record<string, SpineBoneTimeline> {
  const boneById = new Map(skeleton.bones.map((b) => [b.id, b]));
  const out: Record<string, SpineBoneTimeline> = {};
  for (const tl of anim.bones) {
    const bone: BoneNode | undefined = boneById.get(tl.boneId);
    if (!bone) continue;
    const translate = tl.keyframes
      .filter((k) => k.channel === "translate")
      .sort((a, b) => a.time - b.time)
      .map<SpineTranslateFrame>((k) => {
        const f: SpineTranslateFrame = { time: k.time };
        if ((k.values[0] ?? 0) !== 0) f.x = k.values[0];
        // Spine y 向上为正
        if ((k.values[1] ?? 0) !== 0) f.y = -k.values[1];
        const c = easingToCurve(k.easing);
        if (c !== undefined) f.curve = c;
        return f;
      });
    const rotate = tl.keyframes
      .filter((k) => k.channel === "rotate")
      .sort((a, b) => a.time - b.time)
      .map<SpineRotateFrame>((k) => {
        const f: SpineRotateFrame = { time: k.time };
        if ((k.values[0] ?? 0) !== 0) f.value = k.values[0];
        const c = easingToCurve(k.easing);
        if (c !== undefined) f.curve = c;
        return f;
      });
    const scale = tl.keyframes
      .filter((k) => k.channel === "scale")
      .sort((a, b) => a.time - b.time)
      .map<SpineScaleFrame>((k) => {
        const f: SpineScaleFrame = { time: k.time };
        if ((k.values[0] ?? 1) !== 1) f.x = k.values[0];
        if ((k.values[1] ?? 1) !== 1) f.y = k.values[1];
        const c = easingToCurve(k.easing);
        if (c !== undefined) f.curve = c;
        return f;
      });
    const tlOut: SpineBoneTimeline = {};
    if (translate.length) tlOut.translate = translate;
    if (rotate.length) tlOut.rotate = rotate;
    if (scale.length) tlOut.scale = scale;
    if (Object.keys(tlOut).length) out[bone.name] = tlOut;
  }
  return out;
}

function buildAtlasText(baseName: string, atlas: PackedAtlas): string {
  // Spine .atlas 文本格式（4.x）：
  // 第一行空行，之后是 png 文件名 + 元信息，再每个 region 名 + 字段
  const lines: string[] = [];
  lines.push("");
  lines.push(`${baseName}.png`);
  lines.push(`size: ${atlas.width},${atlas.height}`);
  lines.push("filter: Linear,Linear");
  lines.push("");
  for (const sub of atlas.subtextures) {
    lines.push(sub.name);
    lines.push("  rotate: false");
    lines.push(`  xy: ${sub.x}, ${sub.y}`);
    lines.push(`  size: ${sub.width}, ${sub.height}`);
    lines.push(`  orig: ${sub.width}, ${sub.height}`);
    lines.push("  offset: 0, 0");
    lines.push("  index: -1");
  }
  return lines.join("\n");
}

export function exportSpineJson(skeleton: Skeleton, atlas: PackedAtlas, options?: SpineExportOptions): SpineExport {
  const baseName = safeName(options?.fileBaseName || skeleton.name, "skeleton");
  const bones = buildBones(skeleton);
  const slots = buildSlots(skeleton);
  const skin = buildSkin(skeleton);
  const animations: Record<string, SpineAnimation> = {};
  for (const a of skeleton.animations) {
    const boneTimelines = buildBoneTimelines(skeleton, a);
    if (Object.keys(boneTimelines).length === 0) continue;
    animations[a.name] = { bones: boneTimelines };
  }

  const skel: SpineSkeletonJson = {
    skeleton: {
      hash: SPINE_HASH,
      spine: SPINE_VERSION,
      width: 0,
      height: 0,
      images: "./",
    },
    bones,
    slots,
    skins: [skin],
    animations,
  };

  return {
    skeleton: skel,
    atlasText: buildAtlasText(baseName, atlas),
    pngBlob: atlas.pngBlob,
    pngDataUrl: atlas.pngDataUrl,
    fileBaseName: baseName,
  };
}
