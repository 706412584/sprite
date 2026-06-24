// 角色姿态识别：从 PSD 图层名 + sourceRect + 骨架结构，推断角色面对方向。
// 输出由"动作模板"层用来：1) 自动选 front/side/back 预制；2) 决定是否对侧面模板做投影。
//
// 设计原则：
// - 信号尽量基于"原始素材"（attachment.name + sourceRect），而不是 fit 后骨骼姿态，
//   避免与 fitSkeletonToPsd / autoRigPsd 形成循环依赖。
// - 多信号投票：每条信号给出 votes（pose -> score），加权后取最高。
// - 永远返回结果，置信度 confidence 给 UI 和投影层做"够强才覆盖用户选择"。

import { AttachmentImage, Skeleton } from "./skeletonModel";

export type CharacterPose = "front" | "back" | "sideLeft" | "sideRight" | "threeQuarter";

export interface PoseDetectionSignal {
  /** 信号名（调试 / UI 展示）。 */
  name: string;
  /** 该信号本次的权重（0..1）。 */
  weight: number;
  /** 各候选 pose 的得分；最终加权累加。 */
  votes: Partial<Record<CharacterPose, number>>;
  /** 给 UI 的简短解释。 */
  detail?: string;
}

export interface PoseDetectionResult {
  pose: CharacterPose;
  /** 0..1：最高分相对总分的占比。<0.4 视为弱信号，UI 应提示"请人工确认"。 */
  confidence: number;
  signals: PoseDetectionSignal[];
  /** 各 pose 累计得分（调试用）。 */
  scores: Record<CharacterPose, number>;
}

const ALL_POSES: CharacterPose[] = ["front", "back", "sideLeft", "sideRight", "threeQuarter"];

function detectSide(lower: string): "L" | "R" | null {
  if (/(^|[-_])l($|[-_0-9])/.test(lower) || lower.includes("left")) return "L";
  if (/(^|[-_])r($|[-_0-9])/.test(lower) || lower.includes("right")) return "R";
  return null;
}

function attachmentsByPattern(skeleton: Skeleton, pattern: RegExp): AttachmentImage[] {
  return skeleton.attachments.filter((a) => pattern.test(a.name) || pattern.test(a.displayName ?? ""));
}

function centerX(att: AttachmentImage): number | null {
  if (!att.sourceRect) return null;
  return att.sourceRect.x + att.width / 2;
}

function avg(nums: number[]): number {
  return nums.reduce((s, n) => s + n, 0) / Math.max(1, nums.length);
}

// 估算画布中线 X：优先 topwear（躯干上半），回退到全部带 sourceRect 部件的中位 X。
function estimateCenterX(skeleton: Skeleton): number | null {
  const torsoLike = attachmentsByPattern(skeleton, /(topwear|chest|coat|robe|dress|body|torso)/i);
  const candidates = torsoLike.length > 0 ? torsoLike : skeleton.attachments;
  const xs = candidates
    .map(centerX)
    .filter((v): v is number => v !== null);
  if (xs.length === 0) return null;
  // 用 max+min 平均，更稳；中位也行，简单点：
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  return (minX + maxX) / 2;
}

function estimateHeadHeight(skeleton: Skeleton): number | null {
  const heads = attachmentsByPattern(skeleton, /(face|^head|forehead)/i);
  if (heads.length === 0) return null;
  return avg(heads.map((a) => a.height));
}

// 信号 1：眼睛分布 ——
//   两侧 eye 都存在且跨过画布中线、间距 ≥ headHeight*0.18 → front 强信号；
//   两 eye 但都在中线同一侧 → threeQuarter；只有一只 eye → side（按其侧）。
function eyeDistributionSignal(skeleton: Skeleton, centerXVal: number | null, headH: number | null): PoseDetectionSignal | null {
  // 扩展眼睛家族：eyewhite/eyelash/eyebrow 等也算（PSD1 命名常用这些）
  const eyes = attachmentsByPattern(skeleton, /(eye|iris|irid|pupil|eyelash|eyebrow|eyewhite)/i);
  if (eyes.length === 0) return null;
  const eyeXs = eyes
    .map((a) => ({ x: centerX(a), side: detectSide(a.name.toLowerCase()) }))
    .filter((e): e is { x: number; side: "L" | "R" | null } => e.x !== null);
  if (eyeXs.length === 0) return null;

  const votes: Partial<Record<CharacterPose, number>> = {};
  if (eyeXs.length >= 2) {
    const minX = Math.min(...eyeXs.map((e) => e.x));
    const maxX = Math.max(...eyeXs.map((e) => e.x));
    const span = maxX - minX;
    const minSpan = (headH ?? 100) * 0.18;
    if (centerXVal !== null && minX < centerXVal && maxX > centerXVal && span >= minSpan) {
      // 跨中线 + 间距足够 → front（背面通常没眼睛，置信度更高指 front）
      votes.front = 1;
      return { name: "eyes", weight: 0.9, votes, detail: `双眼跨中线 span=${span.toFixed(0)}px (≥${minSpan.toFixed(0)})` };
    }
    // 多个眼睛部件但都同侧/紧贴：可能是单层眼睛（eyewhite + eyelash + eyebrow 重叠）
    // 这种情况下不能判 threeQuarter，只能弱信号 front
    votes.front = 0.4;
    return { name: "eyes", weight: 0.3, votes, detail: `多眼睛部件但同侧 span=${span.toFixed(0)}px（疑似单层）` };
  }
  // 单只眼：根据其命名决定面朝向哪边（命名是"解剖学"侧）
  const only = eyeXs[0];
  if (only.side === "L") {
    votes.sideRight = 0.6;
    return { name: "eyes", weight: 0.4, votes, detail: "仅 eye-l：解剖左眼，角色多半朝右" };
  }
  if (only.side === "R") {
    votes.sideLeft = 0.6;
    return { name: "eyes", weight: 0.4, votes, detail: "仅 eye-r：解剖右眼，角色多半朝左" };
  }
  // 单只无侧：可能是单层 eye（无 -l/-r），算正面弱信号（背面不会画眼睛）
  votes.front = 0.5;
  return { name: "eyes", weight: 0.3, votes, detail: "仅一只无侧 eye 图层（弱投正面）" };
}

// 信号 2：头发可见性 ——
//   hairFront 存在 → front 偏向；只 hairBack → back 强信号；同时存在 → front 略偏向。
//   但若同时有"朝前的五官"（mouth/nose/iris/eyebrow），即使只有 hairBack 也判 front——
//   因为背面绝不会画这些器官，背发只是这张图没分前发图层而已。
function hairSignal(skeleton: Skeleton): PoseDetectionSignal | null {
  const hairFront = attachmentsByPattern(skeleton, /(fronthair|front[-_ ]?hair|hair[-_ ]?front|bang|bangs)/i);
  const hairBack = attachmentsByPattern(skeleton, /(backhair|back[-_ ]?hair|hair[-_ ]?back|rear[-_ ]?hair)/i);
  const generalHair = attachmentsByPattern(skeleton, /(^|[-_ ])hair($|[-_ 0-9])/i)
    .filter((a) => !hairFront.includes(a) && !hairBack.includes(a));
  if (hairFront.length === 0 && hairBack.length === 0 && generalHair.length === 0) return null;

  // 五官 = 朝前器官的存在性。任一存在 → 这张图是正面/三/四，不可能是 back。
  const facialOrgans = attachmentsByPattern(skeleton, /(mouth|lip|teeth|tongue|nose|eyebrow|eyelash|iris|irid|pupil|eyewhite)/i);
  const hasFacialOrgans = facialOrgans.length > 0;

  const votes: Partial<Record<CharacterPose, number>> = {};
  if (hairBack.length > 0 && hairFront.length === 0) {
    if (hasFacialOrgans) {
      // 有 hairBack 但同时有五官 → 仍是正面（这张图只是没专门画前发图层）
      votes.front = 0.7;
      return { name: "hair", weight: 0.4, votes, detail: "只有 hairBack 但有五官（仍判正面）" };
    }
    votes.back = 1;
    return { name: "hair", weight: 0.7, votes, detail: "只有 hairBack 且无五官" };
  }
  if (hairFront.length > 0 && hairBack.length === 0) {
    votes.front = 0.6;
    votes.threeQuarter = 0.3;
    return { name: "hair", weight: 0.4, votes, detail: "只有 hairFront/bang" };
  }
  if (hairFront.length > 0 && hairBack.length > 0) {
    votes.front = 0.7;
    return { name: "hair", weight: 0.5, votes, detail: "同时含 hairFront + hairBack（典型正面）" };
  }
  // 仅模糊 hair：没五官就 front=back 平分；有五官则偏 front
  if (hasFacialOrgans) {
    votes.front = 0.5;
    return { name: "hair", weight: 0.2, votes, detail: "模糊 hair + 有五官 → 弱投正面" };
  }
  votes.front = 0.3;
  votes.back = 0.3;
  return { name: "hair", weight: 0.2, votes, detail: "仅模糊 hair 图层" };
}

// 信号 3：手脚 X 分布 ——
//   handL、handR（或 footL、footR）的 sourceRect.x 跨中线对称 → front/back；
//   仅一侧 → side。
function limbSymmetrySignal(skeleton: Skeleton, centerXVal: number | null): PoseDetectionSignal | null {
  if (centerXVal === null) return null;
  const handLikes = attachmentsByPattern(skeleton, /(handwear|^hand|glove|wrist|forearm)/i);
  const footLikes = attachmentsByPattern(skeleton, /(shoe|boot|^foot|footwear|legwear|^leg|thigh|shin|calf)/i);
  const all = [...handLikes, ...footLikes];
  if (all.length === 0) return null;

  let leftCount = 0;
  let rightCount = 0;
  for (const att of all) {
    const cx = centerX(att);
    if (cx === null) continue;
    if (cx < centerXVal) leftCount += 1;
    else if (cx > centerXVal) rightCount += 1;
  }
  const total = leftCount + rightCount;
  if (total === 0) return null;
  const balance = Math.min(leftCount, rightCount) / Math.max(leftCount, rightCount, 1);

  const votes: Partial<Record<CharacterPose, number>> = {};
  if (balance >= 0.5) {
    // 双侧分布平衡 → 正面（背面在缺五官时由 hair 信号判定，此处只给 front）
    votes.front = 0.6;
    return { name: "limbs", weight: 0.6, votes, detail: `四肢分布对称 (L=${leftCount},R=${rightCount})` };
  }
  if (leftCount > rightCount) {
    votes.sideLeft = 0.7;
    return { name: "limbs", weight: 0.4, votes, detail: `四肢偏画布左 (L=${leftCount},R=${rightCount})` };
  }
  votes.sideRight = 0.7;
  return { name: "limbs", weight: 0.4, votes, detail: `四肢偏画布右 (L=${leftCount},R=${rightCount})` };
}

// 信号 4：图层名直接命中 ——
//   "side" / "profile" / "back" / "front" 字面词，最强权但通常只在特定项目命名里出现。
function explicitNameSignal(skeleton: Skeleton): PoseDetectionSignal | null {
  const names = skeleton.attachments.map((a) => `${a.name} ${a.displayName ?? ""}`.toLowerCase()).join(" ");
  const votes: Partial<Record<CharacterPose, number>> = {};
  let detail: string | null = null;
  if (/\b(back[-_ ]?view|backside|rearview)\b/.test(names)) {
    votes.back = 1;
    detail = "命中 back-view 命名";
  } else if (/\b(side[-_ ]?view|profile)\b/.test(names)) {
    votes.sideLeft = 0.5;
    votes.sideRight = 0.5;
    detail = "命中 side/profile 命名";
  } else if (/\b(front[-_ ]?view|frontal)\b/.test(names)) {
    votes.front = 1;
    detail = "命中 front-view 命名";
  } else if (/\b(three[-_ ]?quarter|3q|3-4view)\b/.test(names)) {
    votes.threeQuarter = 1;
    detail = "命中 three-quarter 命名";
  }
  if (!detail) return null;
  return { name: "explicit-name", weight: 1, votes, detail };
}

// 信号 5：面部器官存在性 ——
//   有 mouth/nose/eyebrow/eyewhite/eyelash/iris 任一 → 强投 front。
//   背面绝对不会画这些朝前的器官；侧面通常只有一只眼/半边嘴，但仍朝向某一侧（不归 front，靠其他信号细分）。
//   这条信号最大的作用：让"只有 hairBack 但有完整面部"的 PSD 不被误判 back。
function facialOrgansSignal(skeleton: Skeleton): PoseDetectionSignal | null {
  const organs = attachmentsByPattern(skeleton, /(mouth|lip|teeth|tongue|nose|eyebrow|eyelash|iris|irid|pupil|eyewhite)/i);
  if (organs.length === 0) return null;
  // 唯一类种类越多越像正面（多种器官同时朝前）
  const kinds = new Set(organs.map((a) => {
    const lower = a.name.toLowerCase();
    if (/mouth|lip|teeth|tongue/.test(lower)) return "mouth";
    if (/nose/.test(lower)) return "nose";
    if (/eyebrow/.test(lower)) return "brow";
    if (/eyelash/.test(lower)) return "lash";
    if (/eyewhite/.test(lower)) return "white";
    if (/iris|irid|pupil/.test(lower)) return "iris";
    return "other";
  }));
  const votes: Partial<Record<CharacterPose, number>> = {};
  // 0..1 normalized：1 种 → 0.5；3 种 → 0.85；5+ 种 → 1
  const score = Math.min(1, 0.4 + 0.15 * kinds.size);
  votes.front = score;
  return { name: "facial-organs", weight: 0.8, votes, detail: `朝前面部器官 ${kinds.size} 种：${[...kinds].join("/")}` };
}

// 信号 6：face 中心 X 偏移 ——
//   face 部件中心相对躯干中线（torsoCenterX）的偏移：
//   < 头宽 12% → 不可分（front/back，靠其他信号）；
//   ≥ 头宽 30% → 强烈侧面（按偏移方向）。
function faceCenterSignal(skeleton: Skeleton, centerXVal: number | null, headH: number | null): PoseDetectionSignal | null {
  if (centerXVal === null) return null;
  const faces = attachmentsByPattern(skeleton, /(^|[-_ ])(face|head)($|[-_ ])/i);
  if (faces.length === 0) return null;
  const faceXs = faces.map(centerX).filter((v): v is number => v !== null);
  if (faceXs.length === 0) return null;
  const faceCx = avg(faceXs);
  const headHEff = headH ?? 100;
  const offset = faceCx - centerXVal;
  const ratio = Math.abs(offset) / headHEff;
  const votes: Partial<Record<CharacterPose, number>> = {};
  if (ratio >= 0.3) {
    if (offset > 0) votes.sideRight = 0.7;
    else votes.sideLeft = 0.7;
    return { name: "face-x", weight: 0.5, votes, detail: `face 偏 ${ratio.toFixed(2)} 头宽` };
  }
  if (ratio < 0.12) {
    // face 几乎在中线 → 不可分 front/back，但能弱化"侧面"猜测
    votes.front = 0.3;
    votes.back = 0.3;
    return { name: "face-x", weight: 0.2, votes, detail: `face 几乎在中线 ratio=${ratio.toFixed(2)}` };
  }
  return null;
}

export function detectPose(skeleton: Skeleton): PoseDetectionResult {
  const centerXVal = estimateCenterX(skeleton);
  const headH = estimateHeadHeight(skeleton);

  const signals: PoseDetectionSignal[] = [];
  for (const sig of [
    explicitNameSignal(skeleton),
    facialOrgansSignal(skeleton),
    faceCenterSignal(skeleton, centerXVal, headH),
    eyeDistributionSignal(skeleton, centerXVal, headH),
    hairSignal(skeleton),
    limbSymmetrySignal(skeleton, centerXVal),
  ]) {
    if (sig) signals.push(sig);
  }

  // 没任何信号：默认 front（不致命，UI 会提示低置信度）
  if (signals.length === 0) {
    const scores = ALL_POSES.reduce(
      (acc, p) => ({ ...acc, [p]: 0 }),
      {} as Record<CharacterPose, number>,
    );
    return { pose: "front", confidence: 0, signals: [], scores };
  }

  // 加权累加
  const scores = ALL_POSES.reduce(
    (acc, p) => ({ ...acc, [p]: 0 }),
    {} as Record<CharacterPose, number>,
  );
  for (const sig of signals) {
    for (const p of ALL_POSES) {
      const v = sig.votes[p] ?? 0;
      scores[p] += v * sig.weight;
    }
  }

  let bestPose: CharacterPose = "front";
  let bestScore = -Infinity;
  for (const p of ALL_POSES) {
    if (scores[p] > bestScore) {
      bestScore = scores[p];
      bestPose = p;
    }
  }
  const total = ALL_POSES.reduce((s, p) => s + Math.max(0, scores[p]), 0);
  const confidence = total > 0 ? Math.max(0, bestScore) / total : 0;

  return { pose: bestPose, confidence, signals, scores };
}

// 把内部精细 pose 折到现有 BoneAnimContext.poseMode（front | pseudoSide | sidePending）
export function poseToContextMode(pose: CharacterPose): "front" | "pseudoSide" {
  if (pose === "sideLeft" || pose === "sideRight") return "pseudoSide";
  return "front";
}
