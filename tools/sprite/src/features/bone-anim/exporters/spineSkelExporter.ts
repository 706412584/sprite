// Spine 4.x .skel 二进制导出（实验性）
// 基于 spec 的最小可用版本：bones / slots / 默认 skin（区域 attachment） / 动画（仅 bone 通道）
// 不实现：IK / Transform / Path 约束，slot 颜色变化, 网格、deform、event、draw order。
// 所有约束计数都写 0 占位，loader 应能跳过；如果某个 runtime 严格校验更多字段，请用 Spine JSON 兜底。

import { Skeleton, AttachmentImage, Animation, Keyframe } from "../model/skeletonModel";
import { PackedAtlas } from "./atlasPacker";
import { SpineBinaryWriter, SharedStringTable } from "./spineBinaryWriter";

const SPINE_VERSION = "4.1.00";
const SPINE_HASH = "sprite-tool";

// 常量
const TRANSFORM_NORMAL = 0;
const BLEND_MODE_NORMAL = 0;
const ATTACHMENT_REGION = 0;

const BONE_ROTATE = 0;
const BONE_TRANSLATE = 1;
const BONE_SCALE = 2;
// const BONE_SHEAR = 3;

const CURVE_LINEAR = 0;
const CURVE_STEPPED = 1;
const CURVE_BEZIER = 2;

export interface SpineSkelExport {
  binary: Uint8Array;
  fileBaseName: string;
}

export function exportSpineSkel(skeleton: Skeleton, atlas: PackedAtlas): SpineSkelExport {
  const baseName = skeleton.name || "skeleton";

  // 第一遍：收集所有共享字符串
  const shared = new SharedStringTable();
  for (const s of skeleton.slots) {
    if (s.attachmentId) {
      const att = skeleton.attachments.find((a) => a.id === s.attachmentId);
      if (att) shared.intern(att.name);
    }
  }
  shared.intern("default"); // skin 名称用 ref string 较稳
  for (const a of skeleton.animations) shared.intern(a.name);

  const w = new SpineBinaryWriter();

  // ---- File header ----
  w.writeString(SPINE_HASH);
  w.writeString(SPINE_VERSION);
  // setup-pose AABB（v1 不算精确包围盒，给一个保守值）
  w.writeFloat(-200);
  w.writeFloat(-300);
  w.writeFloat(400);
  w.writeFloat(500);
  // nonessential
  w.writeBoolean(true);
  w.writeFloat(skeleton.fps || 30);
  w.writeString("./"); // images
  w.writeString(""); // audio

  // 共享字符串表
  const sharedList = shared.asList();
  w.writeVarintPositive(sharedList.length);
  for (const s of sharedList) w.writeString(s);

  // ---- Bones ----
  w.writeVarintPositive(skeleton.bones.length);
  const boneIndexById = new Map<string, number>();
  for (let i = 0; i < skeleton.bones.length; i += 1) boneIndexById.set(skeleton.bones[i].id, i);
  for (let i = 0; i < skeleton.bones.length; i += 1) {
    const b = skeleton.bones[i];
    w.writeString(b.name);
    if (i === 0) {
      // root 不写 parent
    } else {
      const parentIdx = b.parentId ? (boneIndexById.get(b.parentId) ?? -1) : -1;
      // spec：parent index 是 +1（即 1-based）的 varint+；root 不出现 parent 字段
      // 4.x spec 实际写法是：非 root 才写 parent 字段，且为 0-based varint+
      w.writeVarintPositive(Math.max(0, parentIdx));
    }
    w.writeFloat(b.rotation);
    w.writeFloat(b.x);
    // Spine y 向上为正，编辑态向下为正，取反
    w.writeFloat(-b.y);
    w.writeFloat(b.scaleX);
    w.writeFloat(b.scaleY);
    w.writeFloat(0); // shearX
    w.writeFloat(0); // shearY
    w.writeFloat(b.length || 0);
    w.writeByte(TRANSFORM_NORMAL); // transformMode
    w.writeBoolean(false); // skinRequired
    w.writeColor(0xffffffff | 0); // nonessential color
  }

  // ---- Slots ----
  const sortedSlots = skeleton.slots.slice().sort((a, b) => a.zOrder - b.zOrder);
  w.writeVarintPositive(sortedSlots.length);
  const slotIndexById = new Map<string, number>();
  for (let i = 0; i < sortedSlots.length; i += 1) {
    const s = sortedSlots[i];
    slotIndexById.set(s.id, i);
    w.writeString(s.name);
    w.writeVarintPositive(boneIndexById.get(s.boneId) ?? 0);
    w.writeColor(0xffffffff | 0); // light color
    w.writeColor(-1); // dark color = -1 表示无
    const att = s.attachmentId ? skeleton.attachments.find((a) => a.id === s.attachmentId) : null;
    w.writeRefString(att ? shared.intern(att.name) : 0);
    w.writeByte(BLEND_MODE_NORMAL);
  }

  // ---- IK / Transform / Path constraints ----
  w.writeVarintPositive(0); // ik
  w.writeVarintPositive(0); // transform
  w.writeVarintPositive(0); // path

  // ---- Default skin ----
  writeSkinBlock(w, skeleton, atlas, sortedSlots, slotIndexById, shared);

  // ---- 其他 skins ----
  w.writeVarintPositive(0);

  // ---- Linked meshes ----
  w.writeVarintPositive(0);

  // ---- Events ----
  w.writeVarintPositive(0);

  // ---- Animations ----
  w.writeVarintPositive(skeleton.animations.length);
  for (const anim of skeleton.animations) {
    writeAnimation(w, skeleton, anim, boneIndexById);
  }

  return { binary: w.toBuffer(), fileBaseName: baseName };
}

function writeSkinBlock(
  w: SpineBinaryWriter,
  skeleton: Skeleton,
  atlas: PackedAtlas,
  sortedSlots: ReturnType<typeof Array<unknown>> & Array<typeof skeleton.slots[number]>,
  slotIndexById: Map<string, number>,
  shared: SharedStringTable,
) {
  // 收集有 attachment 的 slot
  const slotEntries: Array<{
    slotIndex: number;
    placeholder: string;
    attachment: AttachmentImage;
  }> = [];
  for (const s of sortedSlots) {
    if (!s.attachmentId) continue;
    const att = skeleton.attachments.find((a) => a.id === s.attachmentId);
    if (!att) continue;
    slotEntries.push({
      slotIndex: slotIndexById.get(s.id) ?? 0,
      placeholder: att.name,
      attachment: att,
    });
  }

  w.writeVarintPositive(slotEntries.length);
  for (const entry of slotEntries) {
    w.writeVarintPositive(entry.slotIndex);
    w.writeVarintPositive(1); // 一个 attachment
    w.writeRefString(shared.intern(entry.placeholder));
    w.writeRefString(0); // name=null 表示沿用 placeholder
    w.writeByte(ATTACHMENT_REGION);
    // region attachment：path / rotation / x / y / scaleX / scaleY / width / height / color / sequence
    const att = entry.attachment;
    const sub = atlas.subtextures.find((t) => t.attachmentId === att.id);
    const cx = (0.5 - att.pivot.x) * att.width;
    const cy = -(0.5 - att.pivot.y) * att.height;
    w.writeRefString(0); // path = null 表示等于 placeholder
    w.writeFloat(0); // rotation
    w.writeFloat(cx); // x
    w.writeFloat(cy); // y
    w.writeFloat(1); // scaleX
    w.writeFloat(1); // scaleY
    w.writeFloat(sub ? sub.width : att.width);
    w.writeFloat(sub ? sub.height : att.height);
    w.writeColor(0xffffffff | 0);
    w.writeRefString(0); // sequence = null
  }
}

function writeAnimation(
  w: SpineBinaryWriter,
  skeleton: Skeleton,
  anim: Animation,
  boneIndexById: Map<string, number>,
) {
  w.writeString(anim.name);

  // slot timelines: 不写
  w.writeVarintPositive(0);

  // bone timelines
  // 先按骨骼分组
  const byBone = new Map<string, { rotate: Keyframe[]; translate: Keyframe[]; scale: Keyframe[] }>();
  for (const tl of anim.bones) {
    const bone = skeleton.bones.find((b) => b.id === tl.boneId);
    if (!bone) continue;
    const group = { rotate: [] as Keyframe[], translate: [] as Keyframe[], scale: [] as Keyframe[] };
    for (const k of tl.keyframes) {
      if (k.channel === "rotate") group.rotate.push(k);
      else if (k.channel === "translate") group.translate.push(k);
      else if (k.channel === "scale") group.scale.push(k);
    }
    byBone.set(tl.boneId, group);
  }
  w.writeVarintPositive(byBone.size);
  byBone.forEach((group, boneId) => {
    w.writeVarintPositive(boneIndexById.get(boneId) ?? 0);
    const tlCount =
      (group.rotate.length > 0 ? 1 : 0) +
      (group.translate.length > 0 ? 1 : 0) +
      (group.scale.length > 0 ? 1 : 0);
    w.writeVarintPositive(tlCount);

    if (group.rotate.length > 0) {
      writeBoneTimeline(w, BONE_ROTATE, group.rotate, (kf) => [kf.values[0] ?? 0]);
    }
    if (group.translate.length > 0) {
      writeBoneTimeline(w, BONE_TRANSLATE, group.translate, (kf) => [kf.values[0] ?? 0, -(kf.values[1] ?? 0)]);
    }
    if (group.scale.length > 0) {
      writeBoneTimeline(w, BONE_SCALE, group.scale, (kf) => [kf.values[0] ?? 1, kf.values[1] ?? 1]);
    }
  });

  // ik / transform / path / deform / draw order / events
  w.writeVarintPositive(0); // ik
  w.writeVarintPositive(0); // transform
  w.writeVarintPositive(0); // path
  w.writeVarintPositive(0); // skin deform
  w.writeVarintPositive(0); // draw order
  w.writeVarintPositive(0); // events
}

function writeBoneTimeline(
  w: SpineBinaryWriter,
  type: number,
  frames: Keyframe[],
  values: (kf: Keyframe) => number[],
) {
  const sorted = frames.slice().sort((a, b) => a.time - b.time);
  w.writeByte(type);
  w.writeVarintPositive(sorted.length);
  for (let i = 0; i < sorted.length; i += 1) {
    const k = sorted[i];
    const isLast = i === sorted.length - 1;
    w.writeFloat(k.time);
    const vs = values(k);
    for (const v of vs) w.writeFloat(v);
    if (!isLast) writeCurve(w, k);
  }
}

function writeCurve(w: SpineBinaryWriter, k: Keyframe) {
  switch (k.easing) {
    case "stepped":
      w.writeByte(CURVE_STEPPED);
      return;
    case "easeIn":
      w.writeByte(CURVE_BEZIER);
      w.writeFloat(0.42);
      w.writeFloat(0);
      w.writeFloat(1);
      w.writeFloat(1);
      return;
    case "easeOut":
      w.writeByte(CURVE_BEZIER);
      w.writeFloat(0);
      w.writeFloat(0);
      w.writeFloat(0.58);
      w.writeFloat(1);
      return;
    case "easeInOut":
      w.writeByte(CURVE_BEZIER);
      w.writeFloat(0.42);
      w.writeFloat(0);
      w.writeFloat(0.58);
      w.writeFloat(1);
      return;
    default:
      w.writeByte(CURVE_LINEAR);
  }
}
