// PSD 分层 → 骨架部件
// 把后端 psd-split 返回的图层一比一映射成 AttachmentImage[]，
// 每个部件带 sourceRect（图层在画布上的绝对坐标），用于在预览 / 导出时还原成与 PS 完全一致的相对位置。
//
// 与 poseToParts / parseToParts 的本质区别：
//   - 那两条管线靠 pivot + autoRig 猜位置，名字强行对齐 humanoid 槽位；
//   - PSD 自带绝对坐标，直接还原，名字保留原始图层名（服饰语义，多半对不上分段四肢槽位，
//     所以默认走"按坐标摆放"而非 autoRig）。

import type { PsdSplitResult } from "@/api/spriteApi";
import { AttachmentImage, makeId } from "./skeletonModel";

export interface LayersToPartsResult {
  parts: AttachmentImage[];
  warnings: string[];
}

// PSD 图层数组顺序即绘制堆叠：psd-tools 底→顶遍历，数组靠前 = 最底层（先画）。
// Slot.zOrder 约定 sort((a,b)=>a.zOrder-b.zOrder) 后画，由 StageRig.autoRigPsd 在建 slot 时
// 用 index 直接赋值（首层最小 zOrder = 最先画 = 最底层），与 PS 合成顺序一致。
export function layersToParts(result: PsdSplitResult): LayersToPartsResult {
  const parts: AttachmentImage[] = [];
  const warnings: string[] = [];
  const total = result.parts.length;

  result.parts.forEach((layer) => {
    // 跳过不可见或全透明层（width/height 已由后端保证 >= 2）。
    if (!layer.visible) {
      warnings.push(`图层「${layer.displayName}」在 PSD 中隐藏，已跳过。`);
      return;
    }
    // pivot 取贴图中心：完全骨骼驱动模式下，部件以骨骼世界点为锚旋转/平移；
    // 中心 pivot 比左上角 (0,0) 更直观，避免每个部件的左上角都堆在骨头上。
    // sourceRect 仍保留，仅用于搭骨架阶段的半透明参照层和导出溯源。
    parts.push({
      id: makeId("att"),
      name: layer.name,
      displayName: layer.displayName,
      pngDataUrl: layer.pngDataUrl,
      width: layer.width,
      height: layer.height,
      pivot: { x: 0.5, y: 0.5 },
      sourceRect: {
        x: layer.bbox.x,
        y: layer.bbox.y,
        canvasWidth: layer.canvasWidth,
        canvasHeight: layer.canvasHeight,
      },
    });
  });

  if (parts.length === 0) {
    warnings.push("PSD 没有可用的可见像素图层。");
  } else {
    warnings.push(
      `已解析 ${parts.length}/${total} 个图层。预览采用完全骨骼驱动：部件位置由所绑骨骼+pivot 决定，` +
        `不再按 PSD 原坐标 1:1 还原；搭骨架时可参考半透明的 PSD 原图铺底层做对位。`,
    );
  }

  return { parts, warnings };
}
