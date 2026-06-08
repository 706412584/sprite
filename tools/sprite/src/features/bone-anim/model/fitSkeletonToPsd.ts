// 自适应骨架到 PSD：根据已建立的「图层 → 骨」绑定关系，把 humanoid 模板默认骨位
// 重写到 PSD 像素空间下的真实位置。
//
// 思路：
//   1. 每根骨先收集"绑到它的 PSD attachments 中心点"（PSD 像素坐标）。
//   2. 按解剖关系反推骨骼几何：
//      - head：head 簇所有部件中心点的平均；用于定位 head joint。
//      - torso：torso 簇部件 bbox 的"上沿中点"作为肩点（torso tip），下沿中点作为髋点。
//      - root：髋点（torso 下沿）。
//      - upperArmL/R + forearmL/R：肩点 → handwear 中心连线，按 0.55 / 0.45 切分两段。
//      - thighL/R + shinL/R：髋点 → legwear/footwear 中心，同样两段切分。
//   3. 缺乏图层信息的骨退回模板默认（仍连在合理父点）。
//   4. 把 PSD 像素坐标转成"屏幕空间相对 root"的本地坐标，写回 BoneNode。
//
// 屏幕空间约定（与 StageRig / BoneCanvasPreview 对齐）：
//   - 画布大小 W=H=480，cx=W/2, cy=H/2+55（让头不出顶部）。
//   - PSD 按 letterbox 投到画布：psdScale=min(W/cw, H/ch)，
//     offX=(W-cw*s)/2, offY=(H-ch*s)/2。PSD 像素 (px,py) → 屏幕 (offX+px*s, offY+py*s)。
//   - skeleton 渲染时坐标加 (cx,cy) → 屏幕；所以"骨骼世界坐标系原点"在屏幕 (cx,cy)。
//   - PSD 画布中心在屏幕 (W/2, H/2)，对应骨骼世界坐标 (0, -55)。
//   - 因此：把 PSD 像素 (px,py) 映射到骨骼世界坐标用：
//         worldX = (px - cw/2) * s + 0
//         worldY = (py - ch/2) * s - 55
//
// 单位：本文件内部 PSD 像素空间用变量名带 Psd 后缀，屏幕骨骼世界坐标用 World 后缀。

import { Skeleton, BoneNode } from "./skeletonModel";

const PREVIEW_SIZE = 480; // 与 StageRig / BoneCanvasPreview 保持一致
const CY_OFFSET = 55; // 与 StageRig / BoneCanvasPreview 的 cy=h/2+55 一致

interface Pt {
  x: number;
  y: number;
}

interface BoneScreen {
  /** 该骨 joint 的"屏幕骨骼世界坐标"（即 BoneCanvasPreview 里 worldByBone 那个空间）。 */
  joint: Pt;
  /** 该骨 tip（length 末端）的"屏幕骨骼世界坐标"，缺省时与 joint 相同。 */
  tip?: Pt;
}

function avg(points: Pt[]): Pt {
  const n = points.length || 1;
  let sx = 0;
  let sy = 0;
  for (const p of points) { sx += p.x; sy += p.y; }
  return { x: sx / n, y: sy / n };
}

function bbox(points: Pt[]): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (points.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

// PSD 像素坐标 → 骨骼世界坐标（屏幕空间相对 root）。
function psdToWorld(pPsd: Pt, canvasWidth: number, canvasHeight: number, psdScale: number): Pt {
  const offX = (PREVIEW_SIZE - canvasWidth * psdScale) / 2;
  const offY = (PREVIEW_SIZE - canvasHeight * psdScale) / 2;
  // 屏幕坐标 = (offX + px*s, offY + py*s)；骨骼世界 = 屏幕 - (cx, cy) = 屏幕 - (W/2, H/2+CY_OFFSET)
  const screenX = offX + pPsd.x * psdScale;
  const screenY = offY + pPsd.y * psdScale;
  return { x: screenX - PREVIEW_SIZE / 2, y: screenY - (PREVIEW_SIZE / 2 + CY_OFFSET) };
}

// 把目标 joint+tip 的世界坐标转成"父相对"的 BoneNode 字段（x,y,rotation,length）。
// parent 已经有自己的 world joint 与 world rotation，子骨 local 坐标 = inverseRotate(target - parentJoint, parentWorldRot)。
function worldToLocalBone(
  target: BoneScreen,
  parentJointWorld: Pt,
  parentWorldRotDeg: number,
): { x: number; y: number; rotation: number; length: number } {
  const dx = target.joint.x - parentJointWorld.x;
  const dy = target.joint.y - parentJointWorld.y;
  const radInv = (-parentWorldRotDeg * Math.PI) / 180;
  const localX = dx * Math.cos(radInv) - dy * Math.sin(radInv);
  const localY = dx * Math.sin(radInv) + dy * Math.cos(radInv);

  if (!target.tip) return { x: localX, y: localY, rotation: 0, length: 0 };
  const tdx = target.tip.x - target.joint.x;
  const tdy = target.tip.y - target.joint.y;
  const length = Math.hypot(tdx, tdy);
  // 子骨 world rotation = atan2(tip-joint)；local rotation = world - parentWorld。
  const worldRotDeg = (Math.atan2(tdy, tdx) * 180) / Math.PI;
  let localRot = worldRotDeg - parentWorldRotDeg;
  while (localRot > 180) localRot -= 360;
  while (localRot < -180) localRot += 360;
  return { x: localX, y: localY, rotation: localRot, length };
}

interface BoneRewrite {
  name: string;
  localX: number;
  localY: number;
  rotation: number;
  length: number;
  worldJoint: Pt;
  worldRotDeg: number; // 累计 world rotation（用于子骨折算 local）
  parentName: string | null;
}

interface PsdPartSample {
  name: string;
  boneName: string;
  center: Pt;
  rect: { minX: number; minY: number; maxX: number; maxY: number };
  pivot: Pt;
}

function unionRects(rects: Array<{ minX: number; minY: number; maxX: number; maxY: number }>) {
  if (rects.length === 0) return null;
  return rects.reduce(
    (acc, r) => ({
      minX: Math.min(acc.minX, r.minX),
      minY: Math.min(acc.minY, r.minY),
      maxX: Math.max(acc.maxX, r.maxX),
      maxY: Math.max(acc.maxY, r.maxY),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  );
}

function invRotate(p: Pt, deg: number): Pt {
  const rad = (-deg * Math.PI) / 180;
  return {
    x: p.x * Math.cos(rad) - p.y * Math.sin(rad),
    y: p.x * Math.sin(rad) + p.y * Math.cos(rad),
  };
}

function normalizeDegValue(deg: number): number {
  let value = deg;
  while (value > 180) value -= 360;
  while (value < -180) value += 360;
  return value;
}

/**
 * 根据当前 skeleton 的 PSD slot 绑定关系，把 humanoid 各骨的 setup pose 重写到 PSD 实际位置。
 *
 * 仅当 skeleton 已通过 humanoid 模板生成、且至少有几个 PSD attachment 已绑到骨上时才有效；
 * 缺失图层的骨退回模板默认值。
 *
 * 返回新的 skeleton。slots / attachments / animations 不变。
 */
export function fitSkeletonToPsd(skel: Skeleton): { skeleton: Skeleton; report: string } {
  // 收集 PSD 部件（带 sourceRect 的）按所绑骨名分组
  const attById = new Map(skel.attachments.map((a) => [a.id, a]));
  const boneById = new Map(skel.bones.map((b) => [b.id, b]));
  const psdCentersByBoneName = new Map<string, Pt[]>();
  const psdRectsByBoneName = new Map<string, Array<{ minX: number; minY: number; maxX: number; maxY: number }>>();
  const psdSamples: PsdPartSample[] = [];
  let canvasW = 0;
  let canvasH = 0;
  for (const slot of skel.slots) {
    if (!slot.attachmentId) continue;
    const att = attById.get(slot.attachmentId);
    if (!att?.sourceRect) continue;
    const bone = boneById.get(slot.boneId);
    if (!bone) continue;
    const sr = att.sourceRect;
    canvasW = sr.canvasWidth;
    canvasH = sr.canvasHeight;
    const cx = sr.x + att.width / 2;
    const cy = sr.y + att.height / 2;
    if (!psdCentersByBoneName.has(bone.name)) psdCentersByBoneName.set(bone.name, []);
    psdCentersByBoneName.get(bone.name)!.push({ x: cx, y: cy });
    if (!psdRectsByBoneName.has(bone.name)) psdRectsByBoneName.set(bone.name, []);
    const rect = {
      minX: sr.x, minY: sr.y, maxX: sr.x + att.width, maxY: sr.y + att.height,
    };
    psdRectsByBoneName.get(bone.name)!.push(rect);
    psdSamples.push({
      name: att.name,
      boneName: bone.name,
      center: { x: cx, y: cy },
      rect,
      pivot: { x: sr.x + att.pivot.x * att.width, y: sr.y + att.pivot.y * att.height },
    });
  }

  if (canvasW === 0 || canvasH === 0) {
    return { skeleton: skel, report: "没有带 PSD 坐标的部件，无法自适应。" };
  }
  const psdScale = Math.min(PREVIEW_SIZE / canvasW, PREVIEW_SIZE / canvasH);

  // —— 计算各身体部位 PSD 像素空间的关键点 ——
  const allBbox = unionRects(psdSamples.map((p) => p.rect));
  const headRects = psdRectsByBoneName.get("head") ?? [];
  const topwearRects = psdSamples.filter((p) => p.boneName === "torso" && /topwear|torso|body|chest|coat|robe|dress/i.test(p.name)).map((p) => p.rect);
  const bottomwearRects = psdSamples.filter((p) => p.boneName === "torso" && /bottomwear|skirt|belt|waist/i.test(p.name)).map((p) => p.rect);
  const torsoRects = psdRectsByBoneName.get("torso") ?? [];
  const headBbox = unionRects(headRects);
  const topwearBbox = unionRects(topwearRects);
  const bottomwearBbox = unionRects(bottomwearRects);
  const torsoBbox = topwearBbox ?? unionRects(torsoRects) ?? allBbox;

  const torsoCenterX = torsoBbox ? (torsoBbox.minX + torsoBbox.maxX) / 2 : canvasW / 2;
  const torsoWidth = torsoBbox ? torsoBbox.maxX - torsoBbox.minX : canvasW * 0.22;
  const bodyTop = topwearBbox?.minY ?? torsoBbox?.minY ?? canvasH * 0.35;
  const bodyBottom = bottomwearBbox?.minY ?? torsoBbox?.maxY ?? canvasH * 0.62;
  const shoulderY = bodyTop + Math.max(12, (torsoBbox ? torsoBbox.maxY - torsoBbox.minY : canvasH * 0.2) * 0.12);
  const hipY = Math.max(shoulderY + canvasH * 0.14, bodyBottom);
  const shoulderHalfWidth = Math.max(28, torsoWidth * 0.45);

  const hipPsd: Pt = { x: torsoCenterX, y: hipY };
  const shoulderPsd: Pt = { x: torsoCenterX, y: shoulderY };
  const headCenter = headBbox
    ? { x: (headBbox.minX + headBbox.maxX) / 2, y: (headBbox.minY + headBbox.maxY) / 2 }
    : { x: torsoCenterX, y: shoulderY - canvasH * 0.12 };
  const headHeight = headBbox ? headBbox.maxY - headBbox.minY : canvasH * 0.12;
  const headJointPsd: Pt = { x: headCenter.x, y: headCenter.y + headHeight * 0.35 };
  const headTipPsd: Pt = { x: headCenter.x, y: headCenter.y - headHeight * 0.35 };

  // 四肢端点（手/脚），缺失时回退到合理对称位置
  const handLPsd = psdCentersByBoneName.get("forearmL")?.length
    ? avg(psdCentersByBoneName.get("forearmL")!)
    : { x: torsoCenterX + shoulderHalfWidth * 1.6, y: shoulderY + (hipY - shoulderY) * 0.6 };
  const handRPsd = psdCentersByBoneName.get("forearmR")?.length
    ? avg(psdCentersByBoneName.get("forearmR")!)
    : { x: torsoCenterX - shoulderHalfWidth * 1.6, y: shoulderY + (hipY - shoulderY) * 0.6 };

  // shin/foot：legwear 之类大概率落到 shinL（默认侧），需要按 PSD 中心 X 区分左右
  const shinCenters = psdCentersByBoneName.get("shinL") ?? [];
  const shinRCenters = psdCentersByBoneName.get("shinR") ?? [];
  let footLPsd: Pt;
  let footRPsd: Pt;
  if (shinCenters.length > 0 && shinRCenters.length > 0) {
    footLPsd = avg(shinCenters);
    footRPsd = avg(shinRCenters);
  } else if (shinCenters.length > 0) {
    // 全部 shin 都被 mapPsdLayerToBone 默认到 shinL，按 X 中线再切
    const left = shinCenters.filter((p) => p.x >= torsoCenterX);
    const right = shinCenters.filter((p) => p.x < torsoCenterX);
    footLPsd = left.length > 0 ? avg(left) : avg(shinCenters);
    footRPsd = right.length > 0 ? avg(right) : { x: torsoCenterX - (footLPsd.x - torsoCenterX), y: footLPsd.y };
  } else {
    footLPsd = { x: torsoCenterX + shoulderHalfWidth * 0.6, y: hipY + (canvasH - hipY) * 0.8 };
    footRPsd = { x: torsoCenterX - shoulderHalfWidth * 0.6, y: hipY + (canvasH - hipY) * 0.8 };
  }

  // 肩 joint（左右）：肩点向两侧偏出 shoulderHalfWidth
  const shoulderLPsd: Pt = { x: torsoCenterX + shoulderHalfWidth, y: shoulderY };
  const shoulderRPsd: Pt = { x: torsoCenterX - shoulderHalfWidth, y: shoulderY };
  // 髋 joint（左右）：髋点向两侧偏出 shoulderHalfWidth*0.5
  const hipLPsd: Pt = { x: torsoCenterX + shoulderHalfWidth * 0.5, y: hipY };
  const hipRPsd: Pt = { x: torsoCenterX - shoulderHalfWidth * 0.5, y: hipY };
  // 肘/膝 joint：肩→手 / 髋→脚 的中点
  const elbowLPsd: Pt = { x: (shoulderLPsd.x + handLPsd.x) / 2, y: (shoulderLPsd.y + handLPsd.y) / 2 };
  const elbowRPsd: Pt = { x: (shoulderRPsd.x + handRPsd.x) / 2, y: (shoulderRPsd.y + handRPsd.y) / 2 };
  const kneeLPsd: Pt = { x: (hipLPsd.x + footLPsd.x) / 2, y: (hipLPsd.y + footLPsd.y) / 2 };
  const kneeRPsd: Pt = { x: (hipRPsd.x + footRPsd.x) / 2, y: (hipRPsd.y + footRPsd.y) / 2 };

  // —— 把所有关键点转成"骨骼世界坐标（屏幕空间相对 root）" ——
  const toW = (p: Pt) => psdToWorld(p, canvasW, canvasH, psdScale);
  const hipW = toW(hipPsd);
  const shoulderW = toW(shoulderPsd);
  const headJointW = toW(headJointPsd);
  const headTipW = toW(headTipPsd);
  const shoulderLW = toW(shoulderLPsd);
  const shoulderRW = toW(shoulderRPsd);
  const elbowLW = toW(elbowLPsd);
  const elbowRW = toW(elbowRPsd);
  const handLW = toW(handLPsd);
  const handRW = toW(handRPsd);
  const hipLW = toW(hipLPsd);
  const hipRW = toW(hipRPsd);
  const kneeLW = toW(kneeLPsd);
  const kneeRW = toW(kneeRPsd);
  const footLW = toW(footLPsd);
  const footRW = toW(footRPsd);

  // —— 写入 BoneNode（按父链顺序：root → torso → head/upperArmL/upperArmR；root → thighL/thighR；upperArm → forearm；thigh → shin） ——
  // root 放髋点；它没有父，rotation=0，length=0。
  const rewrites: BoneRewrite[] = [];
  rewrites.push({
    name: "root", parentName: null,
    localX: hipW.x, localY: hipW.y, rotation: 0, length: 0,
    worldJoint: hipW, worldRotDeg: 0,
  });

  // torso：joint 在髋（与 root 重合，local=0,0），tip 在肩
  const torsoLocal = worldToLocalBone({ joint: hipW, tip: shoulderW }, hipW, 0);
  const torsoWorldRot = torsoLocal.rotation; // root rot 0
  rewrites.push({
    name: "torso", parentName: "root",
    localX: 0, localY: 0,
    rotation: torsoLocal.rotation, length: torsoLocal.length,
    worldJoint: hipW, worldRotDeg: torsoWorldRot,
  });

  // head：joint 放到头部簇内部，slot 通过 setupOffset 保持各图层原始相对位置。
  const headLocal = worldToLocalBone({ joint: headJointW, tip: headTipW }, hipW, torsoWorldRot);
  rewrites.push({
    name: "head", parentName: "torso",
    localX: headLocal.x, localY: headLocal.y,
    rotation: headLocal.rotation, length: Math.max(12, headLocal.length),
    worldJoint: headJointW, worldRotDeg: torsoWorldRot + headLocal.rotation,
  });

  // upperArmL：parent torso，joint 在左肩
  const uALLocal = worldToLocalBone({ joint: shoulderLW, tip: elbowLW }, hipW, torsoWorldRot);
  rewrites.push({
    name: "upperArmL", parentName: "torso",
    localX: uALLocal.x, localY: uALLocal.y,
    rotation: uALLocal.rotation, length: uALLocal.length,
    worldJoint: shoulderLW, worldRotDeg: torsoWorldRot + uALLocal.rotation,
  });
  // forearmL：parent upperArmL，joint 在肘 elbowLW，tip 在手 handLW
  const fALLocal = worldToLocalBone({ joint: elbowLW, tip: handLW }, shoulderLW, torsoWorldRot + uALLocal.rotation);
  rewrites.push({
    name: "forearmL", parentName: "upperArmL",
    localX: fALLocal.x, localY: fALLocal.y,
    rotation: fALLocal.rotation, length: fALLocal.length,
    worldJoint: elbowLW, worldRotDeg: torsoWorldRot + uALLocal.rotation + fALLocal.rotation,
  });

  // upperArmR / forearmR
  const uARLocal = worldToLocalBone({ joint: shoulderRW, tip: elbowRW }, hipW, torsoWorldRot);
  rewrites.push({
    name: "upperArmR", parentName: "torso",
    localX: uARLocal.x, localY: uARLocal.y,
    rotation: uARLocal.rotation, length: uARLocal.length,
    worldJoint: shoulderRW, worldRotDeg: torsoWorldRot + uARLocal.rotation,
  });
  const fARLocal = worldToLocalBone({ joint: elbowRW, tip: handRW }, shoulderRW, torsoWorldRot + uARLocal.rotation);
  rewrites.push({
    name: "forearmR", parentName: "upperArmR",
    localX: fARLocal.x, localY: fARLocal.y,
    rotation: fARLocal.rotation, length: fARLocal.length,
    worldJoint: elbowRW, worldRotDeg: torsoWorldRot + uARLocal.rotation + fARLocal.rotation,
  });

  // thighL / shinL：parent 是 root（rot=0），joint 在 hipL
  const tLLocal = worldToLocalBone({ joint: hipLW, tip: kneeLW }, hipW, 0);
  rewrites.push({
    name: "thighL", parentName: "root",
    localX: tLLocal.x, localY: tLLocal.y,
    rotation: tLLocal.rotation, length: tLLocal.length,
    worldJoint: hipLW, worldRotDeg: tLLocal.rotation,
  });
  const sLLocal = worldToLocalBone({ joint: kneeLW, tip: footLW }, hipLW, tLLocal.rotation);
  rewrites.push({
    name: "shinL", parentName: "thighL",
    localX: sLLocal.x, localY: sLLocal.y,
    rotation: sLLocal.rotation, length: sLLocal.length,
    worldJoint: kneeLW, worldRotDeg: tLLocal.rotation + sLLocal.rotation,
  });

  const tRLocal = worldToLocalBone({ joint: hipRW, tip: kneeRW }, hipW, 0);
  rewrites.push({
    name: "thighR", parentName: "root",
    localX: tRLocal.x, localY: tRLocal.y,
    rotation: tRLocal.rotation, length: tRLocal.length,
    worldJoint: hipRW, worldRotDeg: tRLocal.rotation,
  });
  const sRLocal = worldToLocalBone({ joint: kneeRW, tip: footRW }, hipRW, tRLocal.rotation);
  rewrites.push({
    name: "shinR", parentName: "thighR",
    localX: sRLocal.x, localY: sRLocal.y,
    rotation: sRLocal.rotation, length: sRLocal.length,
    worldJoint: kneeRW, worldRotDeg: tRLocal.rotation + sRLocal.rotation,
  });

  // —— 把 rewrites 应用到现有 BoneNode 上（按 name 匹配，保留 id/parentId/scale 等） ——
  const rewriteByName = new Map(rewrites.map((r) => [r.name, r]));
  const newBones: BoneNode[] = skel.bones.map((b) => {
    const r = rewriteByName.get(b.name);
    if (!r) return b;
    return {
      ...b,
      x: Math.round(r.localX),
      y: Math.round(r.localY),
      rotation: Math.round(r.rotation),
      length: Math.round(r.length),
    };
  });

  const newWorldByBoneName = new Map(rewrites.map((r) => [r.name, r]));
  const newSlots = skel.slots.map((slot) => {
    if (!slot.attachmentId) return slot;
    const att = attById.get(slot.attachmentId);
    const bone = boneById.get(slot.boneId);
    if (!att?.sourceRect || !bone) return slot;
    const boneWorld = newWorldByBoneName.get(bone.name);
    if (!boneWorld) return slot;
    const sr = att.sourceRect;
    const pivotWorld = psdToWorld(
      { x: sr.x + att.pivot.x * att.width, y: sr.y + att.pivot.y * att.height },
      canvasW,
      canvasH,
      psdScale,
    );
    const local = invRotate({ x: pivotWorld.x - boneWorld.worldJoint.x, y: pivotWorld.y - boneWorld.worldJoint.y }, boneWorld.worldRotDeg);
    const baseImageRot = bone.name === "head" || bone.name === "torso" || bone.name === "body" ? 0 : boneWorld.worldRotDeg;
    return {
      ...slot,
      setupOffset: {
        x: Math.round(local.x),
        y: Math.round(local.y),
        rotation: Math.round(normalizeDegValue(-baseImageRot)),
      },
    };
  });

  const fittedCount = rewrites.length;
  const headPartsCount = (psdCentersByBoneName.get("head") ?? []).length;
  const torsoPartsCount = (psdCentersByBoneName.get("torso") ?? []).length;
  const handLCount = (psdCentersByBoneName.get("forearmL") ?? []).length;
  const handRCount = (psdCentersByBoneName.get("forearmR") ?? []).length;
  const shinCount = (psdCentersByBoneName.get("shinL") ?? []).length + (psdCentersByBoneName.get("shinR") ?? []).length;
  const report = `自适应骨架完成：重写 ${fittedCount} 根骨。参考样本：head ${headPartsCount} 件 / torso ${torsoPartsCount} 件 / forearmL ${handLCount} / forearmR ${handRCount} / shin ${shinCount}。`;

  return { skeleton: { ...skel, bones: newBones, slots: newSlots }, report };
}

// 仅用于测试：暴露内部 PSD→world 转换
export const __test__ = { psdToWorld, worldToLocalBone };

// 抑制未使用警告：上面已 export const __test__ 含两个函数引用
export type { Pt, BoneScreen };
