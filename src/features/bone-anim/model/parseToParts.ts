// 人体语义解析结果 → 骨架部件
// 输入后端 SegFormer（ATR 18 类）的 HumanParseResult，输出 AttachmentImage[]。
// 后端已合成 head / torso 复合件对齐 humanoid 槽位（autoRig 按名命中），
// 其余细粒度 ATR 件（pants/skirt/shoeL/armL/legL...）名字对不上 humanoid 分段四肢槽位
// （upperArmL/forearmL/thighL/shinL...），autoRig 严格按名匹配会全部落空、还会变成
// 画布上未绑骨骼的漂浮碎片。所以这里只输出能命中 humanoid 槽位的 head / torso，
// 四肢交给 MediaPipe poseToParts（其产出名天然就是分段槽位名）。两者互补。

import type { HumanParseResult } from "@/api/spriteApi";
import { AttachmentImage, makeId } from "./skeletonModel";

// 与 poseToParts 对齐：head/torso 是立绘件，pivot 取贴图底部中点（脖子 / 髋位置），
// 方便锚到骨骼末端。BoneCanvasPreview 的 UPRIGHT_ATTACHMENT_NAMES 也认这两个名字。
const COMPOSITE_PIVOTS: Record<string, { x: number; y: number }> = {
  head: { x: 0.5, y: 1.0 },
  torso: { x: 0.5, y: 1.0 },
};

// 只导入能被 autoRig（槽位名 === 部件名）命中的件。head/torso 是后端合成的复合件，
// 名字与 humanoid 模板槽位一致；其余 ATR 细件（含整条 armL/legL）一律不导入，
// 避免对不上槽位却堆在画布上变成漂浮碎片。
const PARSE_IMPORT_NAMES = new Set(Object.keys(COMPOSITE_PIVOTS));

export interface ParseToPartsResult {
  parts: AttachmentImage[];
  warnings: string[];
}

export function parseToParts(result: HumanParseResult): ParseToPartsResult {
  const parts: AttachmentImage[] = [];
  const warnings: string[] = [];

  for (const p of result.parts) {
    // 跳过对不上 humanoid 槽位的细件（armL/legL/skirt/pants/shoe... ），它们无法被 autoRig 命中。
    if (!PARSE_IMPORT_NAMES.has(p.name)) continue;
    parts.push({
      id: makeId("att"),
      name: p.name,
      displayName: p.displayName,
      pngDataUrl: p.pngDataUrl,
      width: p.width,
      height: p.height,
      pivot: COMPOSITE_PIVOTS[p.name],
    });
  }

  const hasHead = parts.some((p) => p.name === "head");
  const hasTorso = parts.some((p) => p.name === "torso");
  if (!hasHead) warnings.push("未解析出头部（hair/face），可改用姿态识别补头。");
  if (!hasTorso) warnings.push("未解析出躯干（上衣/连衣裙），可改用姿态识别补躯干。");
  if (parts.length === 0) {
    warnings.push("人体语义解析未命中可用的头/躯干部件，请确认图中有清晰人物。");
  } else {
    // 语义解析只负责头/躯干；四肢必须用「按姿态识别部位」生成分段件才能命中 humanoid 槽位。
    warnings.push("语义解析只导入头/躯干；四肢请用「按姿态识别部位」生成 upperArm/forearm/thigh/shin 分段件，否则四肢无法自动绑定。");
  }

  return { parts, warnings };
}
