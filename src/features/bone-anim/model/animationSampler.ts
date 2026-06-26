// 动画采样 / 世界变换求解（与 BoneCanvasPreview 的逐帧逻辑一致，抽成可复用纯函数）。
// 用于：挂点世界坐标解算、可复用 JSON 导出，以及任何需要"某时刻骨骼世界位姿"的地方。
//
// 坐标系与编辑态一致：y 向下为正，旋转单位为度（顺时针为正）。

import {
  Animation,
  AttachmentPoint,
  BoneNode,
  Keyframe,
  KeyframeChannel,
  Skeleton,
} from "./skeletonModel";

export interface BoneWorldTransform {
  x: number;
  y: number;
  rotationDeg: number;
  scaleX: number;
  scaleY: number;
}

export interface PointWorld {
  x: number;
  y: number;
  rotationDeg: number;
}

function easingFactor(easing: Keyframe["easing"], t: number): number {
  switch (easing) {
    case "stepped":
      return 0;
    case "easeIn":
      return t * t;
    case "easeOut":
      return t * (2 - t);
    case "easeInOut":
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    default:
      return t; // linear
  }
}

/** 采样某通道在 time 时刻的插值结果（含缓动）。无关键帧返回 defaults。 */
export function sampleChannel(
  keyframes: Keyframe[],
  channel: KeyframeChannel,
  time: number,
  defaults: number[],
): number[] {
  const filtered = keyframes.filter((k) => k.channel === channel).sort((a, b) => a.time - b.time);
  if (filtered.length === 0) return defaults;
  if (time <= filtered[0].time) return [...filtered[0].values];
  if (time >= filtered[filtered.length - 1].time) return [...filtered[filtered.length - 1].values];
  for (let i = 0; i < filtered.length - 1; i += 1) {
    const a = filtered[i];
    const b = filtered[i + 1];
    if (time >= a.time && time <= b.time) {
      const span = Math.max(1e-6, b.time - a.time);
      const t = (time - a.time) / span;
      const f = easingFactor(a.easing, t);
      const out: number[] = [];
      for (let k = 0; k < a.values.length; k += 1) {
        const av = a.values[k];
        const bv = b.values[k] ?? av;
        out.push(av + (bv - av) * f);
      }
      return out;
    }
  }
  return defaults;
}

/** 把动画施加到单根骨骼，得到其本地变换（setup + 增量）。 */
function localTransform(bone: BoneNode, anim: Animation | null, time: number): BoneWorldTransform {
  const local: BoneWorldTransform = {
    x: bone.x,
    y: bone.y,
    rotationDeg: bone.rotation,
    scaleX: bone.scaleX,
    scaleY: bone.scaleY,
  };
  if (!anim) return local;
  const tl = anim.bones.find((t) => t.boneId === bone.id);
  if (!tl) return local;
  const t = sampleChannel(tl.keyframes, "translate", time, [0, 0]);
  const r = sampleChannel(tl.keyframes, "rotate", time, [0]);
  const s = sampleChannel(tl.keyframes, "scale", time, [1, 1]);
  return {
    x: local.x + (t[0] ?? 0),
    y: local.y + (t[1] ?? 0),
    rotationDeg: local.rotationDeg + (r[0] ?? 0),
    scaleX: local.scaleX * (s[0] ?? 1),
    scaleY: local.scaleY * (s[1] ?? 1),
  };
}

function compose(parent: BoneWorldTransform | null, local: BoneWorldTransform): BoneWorldTransform {
  if (!parent) return { ...local };
  const rad = (parent.rotationDeg * Math.PI) / 180;
  const wx = parent.x + (local.x * Math.cos(rad) - local.y * Math.sin(rad)) * parent.scaleX;
  const wy = parent.y + (local.x * Math.sin(rad) + local.y * Math.cos(rad)) * parent.scaleY;
  return {
    x: wx,
    y: wy,
    rotationDeg: parent.rotationDeg + local.rotationDeg,
    scaleX: parent.scaleX * local.scaleX,
    scaleY: parent.scaleY * local.scaleY,
  };
}

/** 求出某时刻全部骨骼的世界变换（按 boneId 索引）。bones 必须是拓扑序。 */
export function computeAnimatedWorld(
  skeleton: Skeleton,
  anim: Animation | null,
  time: number,
): Map<string, BoneWorldTransform> {
  const out = new Map<string, BoneWorldTransform>();
  for (const bone of skeleton.bones) {
    const parent = bone.parentId ? out.get(bone.parentId) ?? null : null;
    out.set(bone.id, compose(parent, localTransform(bone, anim, time)));
  }
  return out;
}

/** 把骨骼本地点变换到世界坐标（与 compose 的点变换一致）。 */
export function transformLocalPoint(
  world: BoneWorldTransform,
  localX: number,
  localY: number,
): { x: number; y: number } {
  const rad = (world.rotationDeg * Math.PI) / 180;
  return {
    x: world.x + (localX * Math.cos(rad) - localY * Math.sin(rad)) * world.scaleX,
    y: world.y + (localX * Math.sin(rad) + localY * Math.cos(rad)) * world.scaleY,
  };
}

/** 给定某时刻的骨骼世界变换表，解算一个挂点的世界坐标 + 朝向。 */
export function resolveAttachmentPointWorld(
  worldByBone: Map<string, BoneWorldTransform>,
  point: AttachmentPoint,
): PointWorld | null {
  const w = worldByBone.get(point.boneId);
  if (!w) return null;
  const p = transformLocalPoint(w, point.x, point.y);
  return { x: p.x, y: p.y, rotationDeg: w.rotationDeg + point.rotation };
}
