// 姿态关键点 → 语义部件
// 输入 MediaPipe Pose 归一化关键点 + 源图，按关节自动框出 head / torso / 四肢，
// 输出 AttachmentImage[]，名称严格用 humanoid 模板的 camelCase，便于 StageRig 自动绑定。

import type { PoseKeypoint } from "@/api/spriteApi";
import { cropRotated, cropUiSlice, loadImageElement } from "@/features/smart-slice/uiSmartSlice";
import { AttachmentImage, makeId } from "./skeletonModel";

export interface PoseToPartsResult {
  parts: AttachmentImage[];
  warnings: string[];
}

interface Pt {
  x: number; // 像素
  y: number; // 像素
  score: number;
}

// MediaPipe 的 left/right 是“被摄者视角”，与 humanoid 模板的 L/R 约定一致（角色自己的左右）。
// 若发现镜像，可在调用处传 mirrorLR 翻转。
const LIMB_DEFS: Array<{ name: string; from: string; to: string }> = [
  { name: "upperArmL", from: "left_shoulder", to: "left_elbow" },
  { name: "forearmL", from: "left_elbow", to: "left_wrist" },
  { name: "upperArmR", from: "right_shoulder", to: "right_elbow" },
  { name: "forearmR", from: "right_elbow", to: "right_wrist" },
  { name: "thighL", from: "left_hip", to: "left_knee" },
  { name: "shinL", from: "left_knee", to: "left_ankle" },
  { name: "thighR", from: "right_hip", to: "right_knee" },
  { name: "shinR", from: "right_knee", to: "right_ankle" },
];

const MIN_KP_SCORE = 0.3; // 关键点可见度阈值
const LIMB_LENGTH_PAD = 1.25; // 四肢沿轴向外扩系数（覆盖手/脚）
const LIMB_WIDTH_RATIO = 0.42; // 四肢宽度 = 线段长 × 比例（无 alpha 时的退化估计）
const LIMB_MIN_WIDTH = 24; // 四肢最小宽度（像素）

function buildMap(keypoints: PoseKeypoint[], width: number, height: number, mirrorLR: boolean): Map<string, Pt> {
  const map = new Map<string, Pt>();
  for (const kp of keypoints) {
    let name = kp.name;
    if (mirrorLR) {
      if (name.startsWith("left_")) name = "right_" + name.slice(5);
      else if (name.startsWith("right_")) name = "left_" + name.slice(6);
    }
    map.set(name, { x: kp.x * width, y: kp.y * height, score: kp.score });
  }
  return map;
}

function pick(map: Map<string, Pt>, names: string[]): Pt[] {
  return names.map((n) => map.get(n)).filter((p): p is Pt => Boolean(p) && (p as Pt).score >= MIN_KP_SCORE);
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

// 根据多个点求轴对齐 bbox，按比例外扩
function bboxOf(points: Pt[], padX: number, padY: number, width: number, height: number) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  let minX = Math.min(...xs);
  let maxX = Math.max(...xs);
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);
  const w = maxX - minX;
  const h = maxY - minY;
  minX = clamp(minX - padX * Math.max(w, 1), 0, width);
  maxX = clamp(maxX + padX * Math.max(w, 1), 0, width);
  minY = clamp(minY - padY * Math.max(h, 1), 0, height);
  maxY = clamp(maxY + padY * Math.max(h, 1), 0, height);
  return { x: Math.round(minX), y: Math.round(minY), w: Math.round(maxX - minX), h: Math.round(maxY - minY) };
}

export async function poseToParts(
  imageDataUrl: string,
  keypoints: PoseKeypoint[],
  width: number,
  height: number,
  mirrorLR = false,
): Promise<PoseToPartsResult> {
  const map = buildMap(keypoints, width, height, mirrorLR);
  const parts: AttachmentImage[] = [];
  const warnings: string[] = [];

  // 预加载源图，确认尺寸（兜底用 width/height）
  const img = await loadImageElement(imageDataUrl);
  const W = img.naturalWidth || width;
  const H = img.naturalHeight || height;

  // head：鼻/眼/耳 bbox，上下大幅外扩（覆盖头发/下巴）
  const headPts = pick(map, ["nose", "left_eye", "right_eye", "left_ear", "right_ear"]);
  if (headPts.length >= 2) {
    const box = bboxOf(headPts, 0.6, 1.1, W, H);
    if (box.w >= 8 && box.h >= 8) {
      const png = await cropUiSlice(imageDataUrl, box);
      parts.push({
        id: makeId("att"),
        name: "head",
        pngDataUrl: png,
        width: box.w,
        height: box.h,
        pivot: { x: 0.5, y: 0.85 },
      });
    }
  } else {
    warnings.push("未稳定识别头部关键点（鼻/眼/耳）。");
  }

  // torso：双肩 + 双髋四点 bbox
  const torsoPts = pick(map, ["left_shoulder", "right_shoulder", "left_hip", "right_hip"]);
  if (torsoPts.length >= 3) {
    const box = bboxOf(torsoPts, 0.25, 0.12, W, H);
    if (box.w >= 8 && box.h >= 8) {
      const png = await cropUiSlice(imageDataUrl, box);
      parts.push({
        id: makeId("att"),
        name: "torso",
        pngDataUrl: png,
        width: box.w,
        height: box.h,
        pivot: { x: 0.5, y: 0.1 },
      });
    }
  } else {
    warnings.push("未稳定识别躯干关键点（双肩/双髋）。");
  }

  // 四肢：旋转矩形裁剪，pivot 取关节起点端
  for (const def of LIMB_DEFS) {
    const a = map.get(def.from);
    const b = map.get(def.to);
    if (!a || !b || a.score < MIN_KP_SCORE || b.score < MIN_KP_SCORE) continue;

    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const segLen = Math.hypot(dx, dy);
    if (segLen < 8) continue;

    const angle = Math.atan2(dy, dx);
    const outW = Math.round(segLen * LIMB_LENGTH_PAD);
    const outH = Math.round(Math.max(LIMB_MIN_WIDTH, segLen * LIMB_WIDTH_RATIO));
    // 裁剪中心取线段中点
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2;
    const png = await cropRotated(imageDataUrl, { cx, cy, w: outW, h: outH, angle });
    // cropRotated 把主轴摆正成水平，from(关节起点) 在左端中点附近
    parts.push({
      id: makeId("att"),
      name: def.name,
      pngDataUrl: png,
      width: outW,
      height: outH,
      pivot: { x: 0.5, y: 0.1 },
    });
  }

  const limbCount = parts.filter((p) => p.name !== "head" && p.name !== "torso").length;
  if (limbCount < 2) {
    warnings.push("识别到的四肢部件较少，建议改用几何切片或手动补切。");
  }

  return { parts, warnings };
}
