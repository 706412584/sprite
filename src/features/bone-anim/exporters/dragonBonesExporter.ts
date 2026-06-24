// DragonBones JSON 5.5 导出
// 内部模型 → ske.json + tex.json + tex.png
//
// 关键转换：
// - 时间秒 → 整数 ticks（按 fps，向上取整避免末帧丢失）
// - 旋转 度 → 弧度 [-π, π]，跨界用 clockwise 表达多圈
// - bone setup transform 直接用度（DragonBones JSON 中 bone.transform.skX/skY 是度）
// - 动画通道值是相对 setup 的 delta（编辑态本来就这么存的，直接搬）

import { Skeleton, Animation, BoneNode, Slot, AttachmentImage, Keyframe } from "../model/skeletonModel";
import { PackedAtlas } from "./atlasPacker";

const VERSION = "5.5";

interface DBTransform {
  x?: number;
  y?: number;
  skX?: number;
  skY?: number;
  scX?: number;
  scY?: number;
}

interface DBBone {
  name: string;
  parent?: string;
  transform?: DBTransform;
}

interface DBSlot {
  name: string;
  parent: string;
  displayIndex?: number;
}

interface DBSkin {
  name?: string;
  slot: Array<{ name: string; display: Array<DBDisplay> }>;
}

interface DBDisplay {
  name: string;
  type?: "image";
  transform?: DBTransform;
  pivot?: { x: number; y: number };
}

interface DBFrame {
  duration?: number;
  tweenEasing?: number | null;
}

interface DBTranslateFrame extends DBFrame {
  x?: number;
  y?: number;
}

interface DBRotateFrame extends DBFrame {
  rotate?: number;
  clockwise?: number;
}

interface DBScaleFrame extends DBFrame {
  x?: number;
  y?: number;
}

interface DBBoneTimeline {
  name: string;
  translateFrame?: DBTranslateFrame[];
  rotateFrame?: DBRotateFrame[];
  scaleFrame?: DBScaleFrame[];
}

interface DBAnimation {
  name: string;
  duration: number;
  playTimes: number;
  bone?: DBBoneTimeline[];
}

export interface DragonBonesArmature {
  type: "Armature";
  frameRate: number;
  name: string;
  bone: DBBone[];
  slot: DBSlot[];
  skin: DBSkin[];
  animation: DBAnimation[];
}

export interface DragonBonesSkeletonJson {
  isGlobal: 0;
  version: string;
  compatibleVersion: string;
  frameRate: number;
  name: string;
  armature: DragonBonesArmature[];
}

export interface DragonBonesAtlasJson {
  name: string;
  imagePath: string;
  width: number;
  height: number;
  SubTexture: Array<{ name: string; x: number; y: number; width: number; height: number }>;
}

export interface DragonBonesExport {
  ske: DragonBonesSkeletonJson;
  tex: DragonBonesAtlasJson;
  pngBlob: Blob;
  pngDataUrl: string;
  fileBaseName: string;
}

function toRadiansClamped(deg: number): { rotate: number; clockwise: number } {
  // 把度规整到 [-π, π]，多余的圈用 clockwise 表达
  let rad = (deg * Math.PI) / 180;
  let clockwise = 0;
  while (rad > Math.PI) {
    rad -= Math.PI * 2;
    clockwise += 1;
  }
  while (rad < -Math.PI) {
    rad += Math.PI * 2;
    clockwise -= 1;
  }
  return { rotate: rad, clockwise };
}

function easingToTween(easing: Keyframe["easing"]): number | null {
  // DragonBones tweenEasing：null=stepped, 0=linear, 其它表强度
  switch (easing) {
    case "stepped":
      return null;
    case "easeIn":
      return -1; // 缓入
    case "easeOut":
      return 1; // 缓出
    case "easeInOut":
      return 2; // 缓入缓出（quadratic）
    default:
      return 0; // linear
  }
}

function secondsToTicks(seconds: number, fps: number): number {
  return Math.max(1, Math.round(seconds * fps));
}

function buildBones(skeleton: Skeleton): DBBone[] {
  const byId = new Map(skeleton.bones.map((b) => [b.id, b]));
  return skeleton.bones.map((b) => {
    const parent = b.parentId ? byId.get(b.parentId)?.name : undefined;
    const transform: DBTransform = {};
    if (b.x !== 0) transform.x = b.x;
    if (b.y !== 0) transform.y = b.y;
    if (b.rotation !== 0) {
      transform.skX = b.rotation;
      transform.skY = b.rotation;
    }
    if (b.scaleX !== 1) transform.scX = b.scaleX;
    if (b.scaleY !== 1) transform.scY = b.scaleY;
    const out: DBBone = { name: b.name };
    if (parent) out.parent = parent;
    if (Object.keys(transform).length > 0) out.transform = transform;
    return out;
  });
}

function buildSlots(skeleton: Skeleton): DBSlot[] {
  const boneById = new Map(skeleton.bones.map((b) => [b.id, b]));
  const slotsSorted = skeleton.slots.slice().sort((a, b) => a.zOrder - b.zOrder);
  return slotsSorted.map((s) => {
    const bone = boneById.get(s.boneId);
    return { name: s.name, parent: bone?.name || "root" };
  });
}

function buildSkin(skeleton: Skeleton, atlas: PackedAtlas): DBSkin {
  const attachmentByName = new Map(skeleton.attachments.map((a) => [a.id, a]));
  const subByAtt = new Map(atlas.subtextures.map((s) => [s.attachmentId, s]));
  const slot: DBSkin["slot"] = [];
  for (const s of skeleton.slots) {
    if (!s.attachmentId) continue;
    const att: AttachmentImage | undefined = attachmentByName.get(s.attachmentId);
    if (!att) continue;
    const sub = subByAtt.get(att.id);
    if (!sub) continue;
    const display: DBDisplay = {
      name: att.name,
      type: "image",
      pivot: { x: att.pivot.x, y: att.pivot.y },
    };
    const setupOffset = s.setupOffset;
    if (setupOffset) {
      const transform: DBTransform = {};
      if (setupOffset.x !== 0) transform.x = setupOffset.x;
      if (setupOffset.y !== 0) transform.y = setupOffset.y;
      if (setupOffset.rotation !== 0) {
        transform.skX = setupOffset.rotation;
        transform.skY = setupOffset.rotation;
      }
      if (Object.keys(transform).length > 0) display.transform = transform;
    }
    slot.push({ name: s.name, display: [display] });
  }
  return { name: "default", slot };
}

function buildAnimation(skeleton: Skeleton, anim: Animation, fps: number): DBAnimation {
  const boneById = new Map(skeleton.bones.map((b) => [b.id, b]));
  const totalTicks = secondsToTicks(anim.durationSec, fps);

  function compileChannel<T extends DBFrame>(
    channel: Keyframe["channel"],
    keyframes: Keyframe[],
    convert: (k: Keyframe) => T,
  ): T[] | undefined {
    const filtered = keyframes
      .filter((k) => k.channel === channel)
      .sort((a, b) => a.time - b.time);
    if (filtered.length === 0) return undefined;

    // 保证以 time=0 起步：若没有则补一帧默认值
    const ensureStart: Keyframe[] = [];
    if (filtered[0].time > 0) {
      ensureStart.push({
        time: 0,
        channel,
        values: defaultValuesFor(channel),
        easing: filtered[0].easing,
      });
    }
    const all = [...ensureStart, ...filtered];

    const out: T[] = [];
    for (let i = 0; i < all.length; i += 1) {
      const k = all[i];
      const next = all[i + 1];
      const startTick = secondsToTicks(k.time, fps);
      const endTick = next ? secondsToTicks(next.time, fps) : totalTicks;
      const duration = Math.max(0, endTick - startTick);
      const frame = convert(k);
      // 最后一帧 duration 写 0 让它"填满"，非最后一帧写实际间隔
      frame.duration = next ? duration : 0;
      frame.tweenEasing = easingToTween(k.easing);
      out.push(frame);
    }
    return out;
  }

  function defaultValuesFor(channel: Keyframe["channel"]): number[] {
    if (channel === "scale") return [1, 1];
    if (channel === "translate") return [0, 0];
    return [0];
  }

  const result: DBBoneTimeline[] = [];
  for (const tl of anim.bones) {
    const bone: BoneNode | undefined = boneById.get(tl.boneId);
    if (!bone) continue;
    const translateFrame = compileChannel<DBTranslateFrame>("translate", tl.keyframes, (k) => ({
      x: k.values[0] ?? 0,
      y: k.values[1] ?? 0,
    }));
    const rotateFrame = compileChannel<DBRotateFrame>("rotate", tl.keyframes, (k) => {
      const { rotate, clockwise } = toRadiansClamped(k.values[0] ?? 0);
      const out: DBRotateFrame = { rotate };
      if (clockwise !== 0) out.clockwise = clockwise;
      return out;
    });
    const scaleFrame = compileChannel<DBScaleFrame>("scale", tl.keyframes, (k) => ({
      x: k.values[0] ?? 1,
      y: k.values[1] ?? 1,
    }));
    if (translateFrame || rotateFrame || scaleFrame) {
      const out: DBBoneTimeline = { name: bone.name };
      if (translateFrame) out.translateFrame = translateFrame;
      if (rotateFrame) out.rotateFrame = rotateFrame;
      if (scaleFrame) out.scaleFrame = scaleFrame;
      result.push(out);
    }
  }

  return {
    name: anim.name,
    duration: totalTicks,
    playTimes: anim.loop ? 0 : 1,
    bone: result.length > 0 ? result : undefined,
  };
}

export function exportDragonBones(skeleton: Skeleton, atlas: PackedAtlas): DragonBonesExport {
  const fps = skeleton.fps || 24;
  const baseName = skeleton.name || "skeleton";

  const armature: DragonBonesArmature = {
    type: "Armature",
    frameRate: fps,
    name: baseName,
    bone: buildBones(skeleton),
    slot: buildSlots(skeleton),
    skin: [buildSkin(skeleton, atlas)],
    animation: skeleton.animations.map((a) => buildAnimation(skeleton, a, fps)),
  };

  const ske: DragonBonesSkeletonJson = {
    isGlobal: 0,
    version: VERSION,
    compatibleVersion: VERSION,
    frameRate: fps,
    name: baseName,
    armature: [armature],
  };

  const tex: DragonBonesAtlasJson = {
    name: baseName,
    imagePath: `${baseName}_tex.png`,
    width: atlas.width,
    height: atlas.height,
    SubTexture: atlas.subtextures.map((s) => ({
      name: s.name,
      x: s.x,
      y: s.y,
      width: s.width,
      height: s.height,
    })),
  };

  return {
    ske,
    tex,
    pngBlob: atlas.pngBlob,
    pngDataUrl: atlas.pngDataUrl,
    fileBaseName: baseName,
  };
}
