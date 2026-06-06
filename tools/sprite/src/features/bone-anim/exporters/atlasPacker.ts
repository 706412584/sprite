// 简易矩形打包：shelf + 横向贪心，输出单张 atlas PNG 与每个部件的 SubTexture 信息。
// v1 不做 trim，不做 rotate；保证小白用例足够用。

import { AttachmentImage } from "../model/skeletonModel";

export interface PackedSubTexture {
  attachmentId: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PackedAtlas {
  width: number;
  height: number;
  pngDataUrl: string;
  pngBlob: Blob;
  subtextures: PackedSubTexture[];
}

interface ShelfRow {
  y: number;
  height: number;
  cursorX: number;
}

const PADDING = 2;
const MAX_ATLAS = 4096;

function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

export async function packAtlas(attachments: AttachmentImage[]): Promise<PackedAtlas> {
  if (attachments.length === 0) {
    return makeEmptyAtlas();
  }

  // 按高度降序，更稳定的 shelf 打包
  const items = attachments
    .map((a) => ({ ...a }))
    .sort((a, b) => b.height - a.height);

  // 二分式估算宽度：从最大宽度起步
  const maxItemW = items.reduce((m, a) => Math.max(m, a.width + PADDING * 2), 0);
  let trialWidth = Math.max(256, nextPowerOfTwo(maxItemW));
  let result: { width: number; height: number; subs: PackedSubTexture[] } | null = null;

  while (trialWidth <= MAX_ATLAS) {
    const subs: PackedSubTexture[] = [];
    const shelves: ShelfRow[] = [];
    let totalH = 0;
    let ok = true;

    for (const it of items) {
      const wNeeded = it.width + PADDING * 2;
      const hNeeded = it.height + PADDING * 2;
      let placed = false;
      for (const shelf of shelves) {
        if (shelf.cursorX + wNeeded <= trialWidth && hNeeded <= shelf.height) {
          subs.push({
            attachmentId: it.id,
            name: it.name,
            x: shelf.cursorX + PADDING,
            y: shelf.y + PADDING,
            width: it.width,
            height: it.height,
          });
          shelf.cursorX += wNeeded;
          placed = true;
          break;
        }
      }
      if (!placed) {
        // 新建一行
        const newShelf: ShelfRow = { y: totalH, height: hNeeded, cursorX: 0 };
        if (newShelf.cursorX + wNeeded > trialWidth) {
          ok = false;
          break;
        }
        subs.push({
          attachmentId: it.id,
          name: it.name,
          x: newShelf.cursorX + PADDING,
          y: newShelf.y + PADDING,
          width: it.width,
          height: it.height,
        });
        newShelf.cursorX = wNeeded;
        shelves.push(newShelf);
        totalH += hNeeded;
      }
    }

    if (ok && totalH <= MAX_ATLAS) {
      result = { width: trialWidth, height: nextPowerOfTwo(totalH), subs };
      break;
    }
    trialWidth *= 2;
  }

  if (!result) {
    throw new Error("atlas 打包失败：尺寸超过 4096");
  }

  // 渲染到 canvas
  const canvas = document.createElement("canvas");
  canvas.width = result.width;
  canvas.height = result.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 不可用");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const imgs = await Promise.all(
    items.map(
      (it) =>
        new Promise<{ id: string; img: HTMLImageElement }>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve({ id: it.id, img });
          img.onerror = () => reject(new Error(`加载部件失败：${it.name}`));
          img.src = it.pngDataUrl;
        }),
    ),
  );
  const imgById = new Map(imgs.map((x) => [x.id, x.img]));

  for (const sub of result.subs) {
    const img = imgById.get(sub.attachmentId);
    if (!img) continue;
    ctx.drawImage(img, sub.x, sub.y, sub.width, sub.height);
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob 失败"))), "image/png");
  });
  const pngDataUrl = canvas.toDataURL("image/png");

  return {
    width: result.width,
    height: result.height,
    pngDataUrl,
    pngBlob: blob,
    subtextures: result.subs,
  };
}

function makeEmptyAtlas(): PackedAtlas {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 4;
  const blob = new Blob([new Uint8Array(0)], { type: "image/png" });
  return {
    width: 4,
    height: 4,
    pngDataUrl: canvas.toDataURL("image/png"),
    pngBlob: blob,
    subtextures: [],
  };
}
