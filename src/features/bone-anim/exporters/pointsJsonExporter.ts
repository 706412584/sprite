// 可复用「骨骼 + 挂点」JSON 导出（给游戏引擎运行时用）。
//
// 与 Spine/DragonBones 导出互补：此 JSON 不依赖任何引擎运行时，结构直白，
// 重点是逐帧的挂点（发射点）世界坐标轨迹 + 速度，便于做枪口火光 / 弹道 / 粒子发射。
//
// 坐标系：与编辑态 / 源帧 / MediaPipe 一致 —— 原点左上、y 向下为正、角度为度（顺时针为正）。
// 引擎若用 y 向上，自行翻转 y 并取反角度即可（JSON 的 meta.coordinateSpace 标注了约定）。

import { Animation, Skeleton, computeBoneWorld, safeName } from "../model/skeletonModel";
import { computeAnimatedWorld, resolveAttachmentPointWorld } from "../model/animationSampler";

export interface PointsJsonOptions {
  /** 采样帧率；缺省取 skeleton.fps。 */
  fps?: number;
  /** 是否输出挂点逐帧速度（vx,vy = 与上一帧位移 × fps）；默认 true。 */
  includeVelocity?: boolean;
  /** 仅导出这些动画名；缺省导出全部。 */
  animationNames?: string[];
  /** 文件基名；缺省用 skeleton.name。 */
  fileBaseName?: string;
}

export interface PointsJsonBone {
  name: string;
  parent: string | null;
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  length: number;
  /** setup pose 下的世界位姿（便于引擎初始化）。 */
  setupWorld: { x: number; y: number; rotation: number };
}

export interface PointsJsonPoint {
  name: string;
  bone: string;
  offset: { x: number; y: number };
  rotation: number;
}

export interface PointsJsonFrame {
  index: number;
  time: number;
  /** 各骨骼该帧世界位姿。 */
  bones: Record<string, { x: number; y: number; rotation: number; scaleX: number; scaleY: number }>;
  /** 各挂点该帧世界坐标（+ 可选速度）。 */
  points: Record<string, { x: number; y: number; rotation: number; vx?: number; vy?: number }>;
}

export interface PointsJsonAnimation {
  name: string;
  durationSec: number;
  loop: boolean;
  fps: number;
  frameCount: number;
  frames: PointsJsonFrame[];
}

export interface SkeletonPointsJson {
  version: 1;
  meta: {
    skeleton: string;
    generator: string;
    coordinateSpace: "originTopLeft-yDown-degCW";
  };
  fps: number;
  bones: PointsJsonBone[];
  points: PointsJsonPoint[];
  animations: PointsJsonAnimation[];
}

function round(v: number, dp = 3): number {
  const f = 10 ** dp;
  return Math.round(v * f) / f;
}

export function buildSkeletonPointsJson(skeleton: Skeleton, options: PointsJsonOptions = {}): SkeletonPointsJson {
  const fps = options.fps ?? skeleton.fps ?? 12;
  const includeVelocity = options.includeVelocity ?? true;
  const points = skeleton.points ?? [];
  const boneById = new Map(skeleton.bones.map((b) => [b.id, b]));
  const setupWorld = computeBoneWorld(skeleton.bones);

  const bonesOut: PointsJsonBone[] = skeleton.bones.map((b) => {
    const w = setupWorld.get(b.id);
    return {
      name: b.name,
      parent: b.parentId ? boneById.get(b.parentId)?.name ?? null : null,
      x: round(b.x),
      y: round(b.y),
      rotation: round(b.rotation),
      scaleX: round(b.scaleX),
      scaleY: round(b.scaleY),
      length: round(b.length),
      setupWorld: { x: round(w?.x ?? 0), y: round(w?.y ?? 0), rotation: round(w?.rot ?? 0) },
    };
  });

  const pointsOut: PointsJsonPoint[] = points.map((p) => ({
    name: p.name,
    bone: boneById.get(p.boneId)?.name ?? "root",
    offset: { x: round(p.x), y: round(p.y) },
    rotation: round(p.rotation),
  }));

  const wanted = options.animationNames ? new Set(options.animationNames) : null;
  const animsToExport = skeleton.animations.filter((a) => !wanted || wanted.has(a.name));

  const animations: PointsJsonAnimation[] = animsToExport.map((anim) =>
    buildAnimation(skeleton, anim, fps, includeVelocity),
  );

  return {
    version: 1,
    meta: {
      skeleton: skeleton.name,
      generator: "sprite-tool/bone-anim",
      coordinateSpace: "originTopLeft-yDown-degCW",
    },
    fps,
    bones: bonesOut,
    points: pointsOut,
    animations,
  };
}

function buildAnimation(
  skeleton: Skeleton,
  anim: Animation,
  fps: number,
  includeVelocity: boolean,
): PointsJsonAnimation {
  const duration = anim.durationSec;
  const frameCount = Math.max(1, Math.round(duration * fps) + (duration > 0 ? 1 : 0));
  const points = skeleton.points ?? [];
  const frames: PointsJsonFrame[] = [];
  let prevPointPos: Record<string, { x: number; y: number }> = {};

  for (let i = 0; i < frameCount; i += 1) {
    const time = frameCount <= 1 ? 0 : Math.min(duration, i / fps);
    const worldByBone = computeAnimatedWorld(skeleton, anim, time);

    const bonesFrame: PointsJsonFrame["bones"] = {};
    for (const b of skeleton.bones) {
      const w = worldByBone.get(b.id);
      if (!w) continue;
      bonesFrame[b.name] = {
        x: round(w.x),
        y: round(w.y),
        rotation: round(w.rotationDeg),
        scaleX: round(w.scaleX),
        scaleY: round(w.scaleY),
      };
    }

    const pointsFrame: PointsJsonFrame["points"] = {};
    const curPointPos: Record<string, { x: number; y: number }> = {};
    for (const p of points) {
      const resolved = resolveAttachmentPointWorld(worldByBone, p);
      if (!resolved) continue;
      const entry: PointsJsonFrame["points"][string] = {
        x: round(resolved.x),
        y: round(resolved.y),
        rotation: round(resolved.rotationDeg),
      };
      if (includeVelocity) {
        const prev = prevPointPos[p.name];
        if (prev) {
          entry.vx = round((resolved.x - prev.x) * fps);
          entry.vy = round((resolved.y - prev.y) * fps);
        } else {
          entry.vx = 0;
          entry.vy = 0;
        }
      }
      curPointPos[p.name] = { x: resolved.x, y: resolved.y };
      pointsFrame[p.name] = entry;
    }
    prevPointPos = curPointPos;

    frames.push({ index: i, time: round(time, 4), bones: bonesFrame, points: pointsFrame });
  }

  return {
    name: anim.name,
    durationSec: round(duration, 4),
    loop: anim.loop,
    fps,
    frameCount,
    frames,
  };
}

export function skeletonPointsJsonString(skeleton: Skeleton, options: PointsJsonOptions = {}): string {
  return JSON.stringify(buildSkeletonPointsJson(skeleton, options), null, 2);
}

export function pointsJsonFileName(skeleton: Skeleton, options: PointsJsonOptions = {}): string {
  return `${safeName(options.fileBaseName || skeleton.name, "skeleton")}.points.json`;
}
