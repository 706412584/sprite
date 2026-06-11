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
const LIMB_DEFS: Array<{ name: string; displayName: string; from: string; to: string }> = [
  { name: "upperArmL", displayName: "upperArmL_左大臂", from: "left_shoulder", to: "left_elbow" },
  { name: "forearmL", displayName: "forearmL_左前臂", from: "left_elbow", to: "left_wrist" },
  { name: "upperArmR", displayName: "upperArmR_右大臂", from: "right_shoulder", to: "right_elbow" },
  { name: "forearmR", displayName: "forearmR_右前臂", from: "right_elbow", to: "right_wrist" },
  { name: "thighL", displayName: "thighL_左大腿", from: "left_hip", to: "left_knee" },
  { name: "shinL", displayName: "shinL_左小腿", from: "left_knee", to: "left_ankle" },
  { name: "thighR", displayName: "thighR_右大腿", from: "right_hip", to: "right_knee" },
  { name: "shinR", displayName: "shinR_右小腿", from: "right_knee", to: "right_ankle" },
];

const MIN_KP_SCORE = 0.3; // 关键点可见度阈值
// 四肢沿轴外扩系数（关节起点端 + 末端）：
// - 手臂：wrist 到手指尖约 30%，用 1.4 覆盖手掌
// - 大腿：knee 关键点在膝盖中心，各端外扩 20% 已足够
// - 小腿：ankle 在脚踝，脚掌/脚趾占小腿长 40%+，用 1.6
export const LIMB_LENGTH_PAD = 1.4; // 默认（手臂）；BoneCanvas/Preview 渲染对齐用
const LIMB_LENGTH_PAD_THIGH = 1.2; // 大腿
const LIMB_LENGTH_PAD_SHIN = 1.6;  // 小腿（覆盖脚掌）
const LIMB_WIDTH_RATIO = 0.55;
const LIMB_MIN_WIDTH = 32;

// pivot_x 按对应 pad 各自计算，关节在左端再内移 (pad-1)/(2*pad)
function limbPivotX(pad: number) { return (pad - 1) / (2 * pad); }

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

  // head：鼻/眼/耳 bbox，向上用绝对像素外扩覆盖发顶（至少 0.5 倍脸宽），向下扩到肩膀
  const headPts = pick(map, ["nose", "left_eye", "right_eye", "left_ear", "right_ear"]);
  if (headPts.length >= 2) {
    const box = bboxOf(headPts, 0.6, 0.3, W, H);
    // 向上额外补偿：发顶距眼睛约 = 脸宽 * 0.6，确保不裁头顶
    const extraTop = Math.round(box.w * 0.6);
    box.y = Math.max(0, box.y - extraTop);
    box.h = Math.min(H - box.y, box.h + extraTop);
    // 把下边界拉到肩膀（如果可见），覆盖下巴/脖
    const ls = map.get("left_shoulder");
    const rs = map.get("right_shoulder");
    const shoulderY = [ls, rs].filter((p): p is Pt => Boolean(p) && (p as Pt).score >= MIN_KP_SCORE).map((p) => p.y);
    if (shoulderY.length > 0) {
      const targetBottom = Math.round(Math.min(...shoulderY) - 4);
      if (targetBottom > box.y + box.h) box.h = targetBottom - box.y;
    }
    if (box.w >= 8 && box.h >= 8) {
      const png = await cropUiSlice(imageDataUrl, box);
      parts.push({
        id: makeId("att"),
        name: "head",
        displayName: "head_头",
        pngDataUrl: png,
        width: box.w,
        height: box.h,
        // pivot 取贴图底部中点（脖子位置），方便锚到 torso 骨骼末端
        pivot: { x: 0.5, y: 1.0 },
      });
    }
  } else {
    warnings.push("未稳定识别头部关键点（鼻/眼/耳）。");
  }

  // torso：双肩 + 双髋四点 bbox，左右各扩 35%（覆盖手臂根部贴近躯干部分）
  const torsoPts = pick(map, ["left_shoulder", "right_shoulder", "left_hip", "right_hip"]);
  if (torsoPts.length >= 3) {
    const box = bboxOf(torsoPts, 0.35, 0.05, W, H);
    if (box.w >= 8 && box.h >= 8) {
      const png = await cropUiSlice(imageDataUrl, box);
      parts.push({
        id: makeId("att"),
        name: "torso",
        displayName: "torso_躯干",
        pngDataUrl: png,
        width: box.w,
        height: box.h,
        // 模板里 torso 骨骼起点在 hip，向上指到肩 → pivot 取贴图底部中点（hip 位置）
        pivot: { x: 0.5, y: 1.0 },
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

    // 按部位选外扩系数
    const pad =
      def.name === "shinL" || def.name === "shinR" ? LIMB_LENGTH_PAD_SHIN :
      def.name === "thighL" || def.name === "thighR" ? LIMB_LENGTH_PAD_THIGH :
      LIMB_LENGTH_PAD; // 手臂默认

    const angle = Math.atan2(dy, dx);
    const outW = Math.round(segLen * pad);
    const outH = Math.round(Math.max(LIMB_MIN_WIDTH, segLen * LIMB_WIDTH_RATIO));
    // 裁剪中心取线段中点
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2;
    const png = await cropRotated(imageDataUrl, { cx, cy, w: outW, h: outH, angle });
    // cropRotated 把主轴摆正成水平，from(关节起点) 在贴图左端再向内 pivot_x 处。
    // pivot.y 取 0.5（贴图竖直中线），让贴图沿骨骼轴对称。
    parts.push({
      id: makeId("att"),
      name: def.name,
      displayName: def.displayName,
      pngDataUrl: png,
      width: outW,
      height: outH,
      pivot: { x: limbPivotX(pad), y: 0.5 },
    });
  }

  const limbCount = parts.filter((p) => p.name !== "head" && p.name !== "torso").length;
  if (limbCount < 2) {
    warnings.push("识别到的四肢部件较少，建议改用几何切片或手动补切。");
  }

  return { parts, warnings };
}
