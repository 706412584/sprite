// 帧序列 → 骨骼动画（从角色自己的帧序列反推动作）
//
// 输入：一段帧序列，每帧已经跑过 MediaPipe Pose（归一化关键点 + 该帧宽高）。
// 输出：一条 Animation（rotate 通道 + 可选 root translate），可直接写入 skeleton.animations，
//       随后无缝走现有 Spine / DragonBones 导出。
//
// 数学约定（与编辑态 / BoneCanvasPreview 完全一致）：
// - 坐标系 y 向下为正；角度 = atan2(dy, dx) 度（顺时针为正）。
// - MediaPipe 归一化坐标也是 y 向下，乘以该帧像素宽高换算成像素坐标后再取角，消除画幅比例失真。
// - rotate 关键帧存“相对 setup pose 的增量角度”，与 actionTemplates 生成的关键帧语义一致。
//
// 关键恒等式（保证预览能 1:1 复现实测关节角）：
//   bone.rotation == setupWorld[bone] - setupWorld[skeletonParent]
//   delta[bone][f] = (measuredWorld[bone][f] - measuredWorld[measureParent][f]) - bone.rotation
//   预览世界角 = 父预览世界角 + bone.rotation + delta == measuredWorld[bone][f]

import {
  Animation,
  BoneTimeline,
  Keyframe,
  Skeleton,
  computeBoneWorld,
  findBoneByName,
  makeId,
} from "./skeletonModel";

/** 单帧姿态：归一化关键点（x/y ∈ [0,1]）+ 该帧像素宽高。与 /api/pose-detect 返回结构对齐。 */
export interface FramePose {
  keypoints: Array<{ name: string; x: number; y: number; score: number }>;
  width: number;
  height: number;
}

export interface FramesToMotionOptions {
  /** 帧率；缺省取 skeleton.fps，再缺省 12。 */
  fps?: number;
  /** 是否循环；默认 true。 */
  loop?: boolean;
  /** 动画名；默认 "from_frames"。 */
  name?: string;
  /** 关键点最低可信度，低于此值视为该帧该关节缺失；默认 0.3。 */
  minScore?: number;
  /** 镜像左右关节映射（角色背向 / 自拍镜像时打开）；默认 false。 */
  mirror?: boolean;
  /** 是否生成 root 位移（跟随髋部中心移动）；默认 true。 */
  includeRootMotion?: boolean;
  /** root 位移额外缩放系数（在自动换算基础上再乘）；默认 1。 */
  rootMotionScale?: number;
  /** 角度滑动平均窗口（奇数，<=1 关闭）；默认 1（关闭）。 */
  smoothingWindow?: number;
  /** 关键帧简化容差（度）；中间帧若落在相邻帧线性插值 ±容差内则丢弃；默认 0（不简化）。 */
  simplifyToleranceDeg?: number;
}

export interface FramesToMotionResult {
  animation: Animation;
  /** 实际生成了 rotate 通道的骨骼名。 */
  usedBones: string[];
  /** 因缺乏有效关节而跳过的骨骼名。 */
  skippedBones: string[];
  /** 每帧整体可信度（参与计算关节的平均分），用于 UI 提示。 */
  frameScores: number[];
  warnings: string[];
}

/** 骨骼 → 取角关节对 + 取角父骨骼（用于换算局部增量）。父为 null 视为 root（世界角 0）。 */
interface BoneMotionMap {
  bone: string;
  from: string; // 起点关节（MediaPipe 名）
  to: string; // 终点关节
  measureParent: string | null; // 取角父骨骼名（须与骨架父子关系一致）
}

// 中心点：髋部中心 / 肩部中心（左右均值）。用伪关节名表示。
const HIP_CENTER = "__hip_center";
const SHOULDER_CENTER = "__shoulder_center";

const BONE_MOTION_MAP: BoneMotionMap[] = [
  { bone: "torso", from: HIP_CENTER, to: SHOULDER_CENTER, measureParent: null },
  { bone: "head", from: SHOULDER_CENTER, to: "nose", measureParent: "torso" },
  { bone: "upperArmL", from: "left_shoulder", to: "left_elbow", measureParent: "torso" },
  { bone: "forearmL", from: "left_elbow", to: "left_wrist", measureParent: "upperArmL" },
  { bone: "upperArmR", from: "right_shoulder", to: "right_elbow", measureParent: "torso" },
  { bone: "forearmR", from: "right_elbow", to: "right_wrist", measureParent: "upperArmR" },
  { bone: "thighL", from: "left_hip", to: "left_knee", measureParent: null },
  { bone: "shinL", from: "left_knee", to: "left_ankle", measureParent: "thighL" },
  { bone: "thighR", from: "right_hip", to: "right_knee", measureParent: null },
  { bone: "shinR", from: "right_knee", to: "right_ankle", measureParent: "thighR" },
];

// 镜像时左右关节互换（中心点不变）。
const MIRROR_JOINT: Record<string, string> = {
  left_shoulder: "right_shoulder",
  right_shoulder: "left_shoulder",
  left_elbow: "right_elbow",
  right_elbow: "left_elbow",
  left_wrist: "right_wrist",
  right_wrist: "left_wrist",
  left_hip: "right_hip",
  right_hip: "left_hip",
  left_knee: "right_knee",
  right_knee: "left_knee",
  left_ankle: "right_ankle",
  right_ankle: "left_ankle",
};

interface PixelPoint {
  x: number;
  y: number;
  score: number;
}

function buildPointResolver(frame: FramePose, minScore: number, mirror: boolean) {
  const raw = new Map<string, PixelPoint>();
  for (const kp of frame.keypoints) {
    raw.set(kp.name, { x: kp.x * frame.width, y: kp.y * frame.height, score: kp.score });
  }
  const lookup = (rawName: string): PixelPoint | null => {
    const name = mirror ? MIRROR_JOINT[rawName] ?? rawName : rawName;
    const p = raw.get(name);
    if (!p || p.score < minScore) return null;
    return p;
  };
  const resolve = (name: string): PixelPoint | null => {
    if (name === HIP_CENTER) return midpoint(lookup("left_hip"), lookup("right_hip"));
    if (name === SHOULDER_CENTER) return midpoint(lookup("left_shoulder"), lookup("right_shoulder"));
    return lookup(name);
  };
  return resolve;
}

function midpoint(a: PixelPoint | null, b: PixelPoint | null): PixelPoint | null {
  if (!a || !b) return null;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, score: Math.min(a.score, b.score) };
}

function segmentAngleDeg(from: PixelPoint, to: PixelPoint): number {
  return (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
}

/** 解卷绕：让相邻角度差落在 (-180,180]，避免 359→1 的跳变。原地修改副本并返回。 */
function unwrapDegrees(series: Array<number | null>): Array<number | null> {
  const out = [...series];
  let prev: number | null = null;
  for (let i = 0; i < out.length; i += 1) {
    const v = out[i];
    if (v === null) continue;
    if (prev === null) {
      prev = v;
      continue;
    }
    let adjusted = v;
    while (adjusted - prev > 180) adjusted -= 360;
    while (adjusted - prev < -180) adjusted += 360;
    out[i] = adjusted;
    prev = adjusted;
  }
  return out;
}

/** 把含 null 的序列在全部帧上插值/外推成连续序列；全 null 返回 null。 */
function fillSeries(series: Array<number | null>): number[] | null {
  const n = series.length;
  const known: number[] = [];
  for (let i = 0; i < n; i += 1) if (series[i] !== null) known.push(i);
  if (known.length === 0) return null;
  const out = new Array<number>(n);
  for (let i = 0; i < n; i += 1) {
    const v = series[i];
    if (v !== null) {
      out[i] = v;
      continue;
    }
    if (i < known[0]) {
      out[i] = series[known[0]] as number;
    } else if (i > known[known.length - 1]) {
      out[i] = series[known[known.length - 1]] as number;
    } else {
      let lo = known[0];
      let hi = known[known.length - 1];
      for (let k = 0; k < known.length; k += 1) {
        if (known[k] <= i) lo = known[k];
        if (known[k] >= i) {
          hi = known[k];
          break;
        }
      }
      const a = series[lo] as number;
      const b = series[hi] as number;
      const t = hi === lo ? 0 : (i - lo) / (hi - lo);
      out[i] = a + (b - a) * t;
    }
  }
  return out;
}

function smooth(series: number[], window: number): number[] {
  if (window <= 1) return series;
  const half = Math.floor(window / 2);
  return series.map((_, i) => {
    let sum = 0;
    let count = 0;
    for (let j = i - half; j <= i + half; j += 1) {
      if (j >= 0 && j < series.length) {
        sum += series[j];
        count += 1;
      }
    }
    return sum / Math.max(1, count);
  });
}

/** 简化关键帧：丢弃落在相邻保留帧线性插值 ±tol 内的中间帧（保首尾）。 */
function simplify(times: number[], values: number[], tol: number): Array<{ time: number; value: number }> {
  const pts = times.map((t, i) => ({ time: t, value: values[i] }));
  if (tol <= 0 || pts.length <= 2) return pts;
  const keep: boolean[] = pts.map(() => false);
  keep[0] = true;
  keep[pts.length - 1] = true;
  const recurse = (lo: number, hi: number) => {
    if (hi - lo < 2) return;
    let maxErr = -1;
    let maxIdx = -1;
    const a = pts[lo];
    const b = pts[hi];
    for (let i = lo + 1; i < hi; i += 1) {
      const span = b.time - a.time || 1;
      const t = (pts[i].time - a.time) / span;
      const interp = a.value + (b.value - a.value) * t;
      const err = Math.abs(pts[i].value - interp);
      if (err > maxErr) {
        maxErr = err;
        maxIdx = i;
      }
    }
    if (maxErr > tol && maxIdx > lo) {
      keep[maxIdx] = true;
      recurse(lo, maxIdx);
      recurse(maxIdx, hi);
    }
  };
  recurse(0, pts.length - 1);
  return pts.filter((_, i) => keep[i]);
}

export function framesToMotion(
  skeleton: Skeleton,
  frames: FramePose[],
  options: FramesToMotionOptions = {},
): FramesToMotionResult {
  const warnings: string[] = [];
  const fps = options.fps ?? skeleton.fps ?? 12;
  const loop = options.loop ?? true;
  const name = options.name ?? "from_frames";
  const minScore = options.minScore ?? 0.3;
  const mirror = options.mirror ?? false;
  const includeRootMotion = options.includeRootMotion ?? true;
  const rootMotionScale = options.rootMotionScale ?? 1;
  const smoothingWindow = options.smoothingWindow ?? 1;
  const simplifyTol = options.simplifyToleranceDeg ?? 0;

  const n = frames.length;
  if (n === 0) {
    warnings.push("帧序列为空，未生成动画。");
    return {
      animation: { id: makeId("anim"), name, durationSec: 0, loop, bones: [] },
      usedBones: [],
      skippedBones: [],
      frameScores: [],
      warnings,
    };
  }

  const times = frames.map((_, i) => i / Math.max(1, fps));
  const durationSec = n / Math.max(1, fps);

  const resolvers = frames.map((f) => buildPointResolver(f, minScore, mirror));
  const setupWorld = computeBoneWorld(skeleton.bones);

  // 每根可映射骨骼的逐帧世界角（含缺帧），先取值再解卷绕再插值。
  const measuredWorldByBone = new Map<string, number[] | null>();
  const frameScoreAccum = new Array<number>(n).fill(0);
  const frameScoreCount = new Array<number>(n).fill(0);

  for (const map of BONE_MOTION_MAP) {
    if (!findBoneByName(skeleton, map.bone)) continue;
    const rawSeries: Array<number | null> = frames.map((_, fi) => {
      const resolve = resolvers[fi];
      const a = resolve(map.from);
      const b = resolve(map.to);
      if (!a || !b) return null;
      frameScoreAccum[fi] += (a.score + b.score) / 2;
      frameScoreCount[fi] += 1;
      return segmentAngleDeg(a, b);
    });
    const filled = fillSeries(unwrapDegrees(rawSeries));
    measuredWorldByBone.set(map.bone, filled ? smooth(filled, smoothingWindow) : null);
  }

  const frameScores = frameScoreAccum.map((s, i) => (frameScoreCount[i] ? s / frameScoreCount[i] : 0));

  const timelines: BoneTimeline[] = [];
  const usedBones: string[] = [];
  const skippedBones: string[] = [];

  for (const map of BONE_MOTION_MAP) {
    const bone = findBoneByName(skeleton, map.bone);
    if (!bone) continue;
    const measured = measuredWorldByBone.get(map.bone) ?? null;
    if (!measured) {
      skippedBones.push(map.bone);
      continue;
    }
    // 取角父的逐帧世界角；父无映射或全缺则用其 setup 世界角（常量）。
    const parentSetupRot = map.measureParent
      ? setupWorld.get(findBoneByName(skeleton, map.measureParent)?.id ?? "")?.rot ?? 0
      : 0;
    const parentMeasured = map.measureParent ? measuredWorldByBone.get(map.measureParent) ?? null : null;

    const deltas = measured.map((wAngle, fi) => {
      const parentAngle = parentMeasured ? parentMeasured[fi] : parentSetupRot;
      const measuredLocal = wAngle - parentAngle;
      return measuredLocal - bone.rotation;
    });

    const simplified = simplify(times, deltas, simplifyTol);
    const keyframes: Keyframe[] = simplified.map((p) => ({
      time: p.time,
      channel: "rotate",
      values: [p.value],
      easing: "linear",
    }));
    timelines.push({ boneId: bone.id, keyframes });
    usedBones.push(map.bone);
  }

  // root 位移：髋部中心相对首帧的位移，按 torso 像素长度 ↔ 编辑态 torso 长度换算到编辑单位。
  if (includeRootMotion) {
    const root = findBoneByName(skeleton, "root");
    const torsoBone = findBoneByName(skeleton, "torso");
    if (root && torsoBone) {
      const hipSeriesX: Array<number | null> = [];
      const hipSeriesY: Array<number | null> = [];
      const torsoPx: number[] = [];
      for (let fi = 0; fi < n; fi += 1) {
        const resolve = resolvers[fi];
        const hip = resolve(HIP_CENTER);
        const sh = resolve(SHOULDER_CENTER);
        hipSeriesX.push(hip ? hip.x : null);
        hipSeriesY.push(hip ? hip.y : null);
        if (hip && sh) torsoPx.push(Math.hypot(sh.x - hip.x, sh.y - hip.y));
      }
      const filledX = fillSeries(hipSeriesX);
      const filledY = fillSeries(hipSeriesY);
      const medianTorsoPx = median(torsoPx);
      if (filledX && filledY && medianTorsoPx > 1) {
        const editorTorsoLen = torsoBone.length || 120;
        const scale = (editorTorsoLen / medianTorsoPx) * rootMotionScale;
        const sx = smooth(filledX, smoothingWindow);
        const sy = smooth(filledY, smoothingWindow);
        const x0 = sx[0];
        const y0 = sy[0];
        const tx = sx.map((v) => (v - x0) * scale);
        const ty = sy.map((v) => (v - y0) * scale);
        const dist = tx.map((x, i) => Math.hypot(x, ty[i]));
        const simplified = simplify(times, dist, simplifyTol > 0 ? simplifyTol : 0);
        const keepIdx = new Set(simplified.map((p) => times.indexOf(p.time)));
        const keyframes: Keyframe[] = times
          .map((t, i) => ({ t, i }))
          .filter(({ i }) => keepIdx.has(i))
          .map(({ t, i }) => ({
            time: t,
            channel: "translate" as const,
            values: [tx[i], ty[i]],
            easing: "linear" as const,
          }));
        if (keyframes.length > 1) {
          const existing = timelines.find((tl) => tl.boneId === root.id);
          if (existing) existing.keyframes.push(...keyframes);
          else timelines.push({ boneId: root.id, keyframes });
        }
      } else {
        warnings.push("髋部 / 肩部关节可信度不足，未生成 root 位移。");
      }
    }
  }

  if (usedBones.length === 0) {
    warnings.push("没有任何骨骼获得有效关节角，请检查帧是否包含清晰人物，或尝试镜像。");
  }
  if (skippedBones.length > 0) {
    warnings.push(`以下骨骼缺乏有效关节，已跳过：${skippedBones.join(", ")}。`);
  }

  const animation: Animation = {
    id: makeId("anim"),
    name,
    durationSec,
    loop,
    bones: timelines,
  };

  return { animation, usedBones, skippedBones, frameScores, warnings };
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
