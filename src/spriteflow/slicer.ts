/**
 * Browser-side sprite-sheet slicing and frame diagnostics.
 */

import type { GridConfig } from "./types";
import { getGridMetrics } from "./types";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FrameDiagnostic {
  index: number;
  cell: Rect;
  content: Rect | null;
  occupancy: number;
  centerOffsetX: number;
  centerOffsetY: number;
  sameCellScore: number;
  warnings: string[];
}

export interface SheetDiagnostic {
  sheetWidth: number;
  sheetHeight: number;
  rows: number;
  cols: number;
  contentBand: Rect | null;
  frames: FrameDiagnostic[];
  warnings: string[];
}

export interface SliceResult {
  frames: string[];
  frameWidth: number;
  frameHeight: number;
  frameRects: Rect[];
  diagnostic: SheetDiagnostic;
}

export interface SliceOptions {
  /** Row sheets can either crop to the detected content band or use the whole image evenly. */
  rowSliceMode?: "content-band" | "full-grid";
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to decode generated sprite sheet"));
    img.src = src;
  });
}

function createCanvas(w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(w));
  canvas.height = Math.max(1, Math.floor(h));
  return canvas;
}

function colorDistanceSq(px: Uint8ClampedArray, index: number, r: number, g: number, b: number): number {
  const dr = px[index] - r;
  const dg = px[index + 1] - g;
  const db = px[index + 2] - b;
  return dr * dr + dg * dg + db * db;
}

function sampleBackground(px: Uint8ClampedArray, w: number, h: number): { r: number; g: number; b: number } {
  const samples: Array<[number, number]> = [
    [0, 0],
    [Math.max(0, w - 1), 0],
    [0, Math.max(0, h - 1)],
    [Math.max(0, w - 1), Math.max(0, h - 1)],
    [Math.floor(w / 2), 0],
    [Math.floor(w / 2), Math.max(0, h - 1)],
  ];
  let r = 0;
  let g = 0;
  let b = 0;
  for (const [x, y] of samples) {
    const i = (y * w + x) * 4;
    r += px[i];
    g += px[i + 1];
    b += px[i + 2];
  }
  return { r: Math.round(r / samples.length), g: Math.round(g / samples.length), b: Math.round(b / samples.length) };
}

function isContentPixel(
  px: Uint8ClampedArray,
  index: number,
  bg: { r: number; g: number; b: number },
  toleranceSq = 30 * 30 * 3,
): boolean {
  const alpha = px[index + 3];
  if (alpha < 24) return false;
  if (alpha < 245) return true;
  return colorDistanceSq(px, index, bg.r, bg.g, bg.b) > toleranceSq;
}

function detectBounds(
  data: ImageData,
  rect: Rect,
  options: { minPixels?: number } = {},
): Rect | null {
  const minPixels = options.minPixels ?? 4;
  const { data: px, width: w, height: h } = data;
  const bg = sampleBackground(px, w, h);
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = -1;
  let maxY = -1;
  let count = 0;

  const x0 = Math.max(0, Math.floor(rect.x));
  const y0 = Math.max(0, Math.floor(rect.y));
  const x1 = Math.min(w, Math.ceil(rect.x + rect.w));
  const y1 = Math.min(h, Math.ceil(rect.y + rect.h));
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const i = (y * w + x) * 4;
      if (!isContentPixel(px, i, bg)) continue;
      count += 1;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (count < minPixels || maxX < minX || maxY < minY) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function inflateRect(rect: Rect, pad: number, maxW: number, maxH: number): Rect {
  const x = Math.max(0, Math.floor(rect.x - pad));
  const y = Math.max(0, Math.floor(rect.y - pad));
  const right = Math.min(maxW, Math.ceil(rect.x + rect.w + pad));
  const bottom = Math.min(maxH, Math.ceil(rect.y + rect.h + pad));
  return { x, y, w: Math.max(1, right - x), h: Math.max(1, bottom - y) };
}

function makeCellRects(sheetW: number, sheetH: number, gridConfig: GridConfig, contentBand: Rect | null): Rect[] {
  const { rows, cols } = getGridMetrics(gridConfig);
  const source = gridConfig.layout === "row" && contentBand ? contentBand : { x: 0, y: 0, w: sheetW, h: sheetH };
  const frameW = Math.floor(source.w / cols);
  const frameH = Math.floor(source.h / rows);
  const rects: Rect[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      rects.push({
        x: source.x + col * frameW,
        y: source.y + row * frameH,
        w: col === cols - 1 ? source.x + source.w - (source.x + col * frameW) : frameW,
        h: row === rows - 1 ? source.y + source.h - (source.y + row * frameH) : frameH,
      });
    }
  }
  return rects;
}

function diagnose(data: ImageData, gridConfig: GridConfig, frameRects: Rect[], contentBand: Rect | null): SheetDiagnostic {
  const { rows, cols } = getGridMetrics(gridConfig);
  const bounds = frameRects.map((rect) => detectBounds(data, rect, { minPixels: Math.max(4, Math.floor((rect.w * rect.h) / 5000)) }));
  const valid = bounds.filter((item): item is Rect => Boolean(item));
  const avgW = valid.length ? valid.reduce((sum, rect) => sum + rect.w, 0) / valid.length : 0;
  const avgH = valid.length ? valid.reduce((sum, rect) => sum + rect.h, 0) / valid.length : 0;
  const normalizedCenters = bounds
    .map((content, index) => {
      if (!content) return null;
      const cell = frameRects[index];
      return {
        x: (content.x + content.w / 2 - cell.x) / Math.max(1, cell.w),
        y: (content.y + content.h / 2 - cell.y) / Math.max(1, cell.h),
      };
    })
    .filter((item): item is { x: number; y: number } => Boolean(item));
  const avgCenterX = normalizedCenters.length ? normalizedCenters.reduce((sum, item) => sum + item.x, 0) / normalizedCenters.length : 0.5;
  const avgCenterY = normalizedCenters.length ? normalizedCenters.reduce((sum, item) => sum + item.y, 0) / normalizedCenters.length : 0.5;

  const frames = frameRects.map((cell, index) => {
    const content = bounds[index];
    const warnings: string[] = [];
    if (!content) warnings.push("empty-or-background-only");
    const occupancy = content ? (content.w * content.h) / Math.max(1, cell.w * cell.h) : 0;
    const centerX = content ? content.x + content.w / 2 : cell.x + cell.w / 2;
    const centerY = content ? content.y + content.h / 2 : cell.y + cell.h / 2;
    const centerOffsetX = content ? (centerX - (cell.x + cell.w / 2)) / Math.max(1, cell.w) : 0;
    const centerOffsetY = content ? (centerY - (cell.y + cell.h / 2)) / Math.max(1, cell.h) : 0;
    const relativeW = content && avgW ? Math.abs(content.w - avgW) / avgW : 1;
    const relativeH = content && avgH ? Math.abs(content.h - avgH) / avgH : 1;
    const normalizedCenterX = content ? (content.x + content.w / 2 - cell.x) / Math.max(1, cell.w) : 0.5;
    const normalizedCenterY = content ? (content.y + content.h / 2 - cell.y) / Math.max(1, cell.h) : 0.5;
    const globalCenterDelta = content ? Math.hypot(normalizedCenterX - avgCenterX, normalizedCenterY - avgCenterY) : 1;
    const sameCellScore = Math.max(0, 1 - (relativeW + relativeH + Math.abs(centerOffsetX) + Math.abs(centerOffsetY) + globalCenterDelta) / 2.5);
    if (content && relativeW > 0.22) warnings.push("width-drift");
    if (content && relativeH > 0.22) warnings.push("height-drift");
    if (Math.abs(centerOffsetX) > 0.14) warnings.push("horizontal-offset");
    if (Math.abs(centerOffsetY) > 0.14) warnings.push("vertical-offset");
    if (occupancy < 0.04) warnings.push("tiny-content");
    return { index, cell, content, occupancy, centerOffsetX, centerOffsetY, sameCellScore, warnings };
  });

  const warnings: string[] = [];
  if (gridConfig.layout === "row" && !contentBand) warnings.push("row-band-not-detected");
  if (frames.some((frame) => frame.warnings.length > 0)) warnings.push("frame-occupancy-varies");
  return { sheetWidth: data.width, sheetHeight: data.height, rows, cols, contentBand, frames, warnings };
}

export async function sliceSpriteSheet(sheetDataUrl: string, gridConfig: GridConfig, options: SliceOptions = {}): Promise<SliceResult> {
  const img = await loadImage(sheetDataUrl);
  const sheetW = img.naturalWidth || img.width;
  const sheetH = img.naturalHeight || img.height;
  if (!sheetW || !sheetH) throw new Error("Sprite sheet has zero size");

  const sourceCanvas = createCanvas(sheetW, sheetH);
  const sourceCtx = sourceCanvas.getContext("2d");
  if (!sourceCtx) throw new Error("Failed to acquire 2D context");
  sourceCtx.drawImage(img, 0, 0);
  const data = sourceCtx.getImageData(0, 0, sheetW, sheetH);

  const useContentBand = gridConfig.layout === "row" && options.rowSliceMode !== "full-grid";
  const wholeBounds = useContentBand ? detectBounds(data, { x: 0, y: 0, w: sheetW, h: sheetH }, { minPixels: Math.max(16, Math.floor((sheetW * sheetH) / 10000)) }) : null;
  const bandPad = useContentBand ? Math.max(6, Math.round(sheetH * 0.02)) : 0;
  const contentBand = useContentBand && wholeBounds ? inflateRect({ x: 0, y: wholeBounds.y, w: sheetW, h: wholeBounds.h }, bandPad, sheetW, sheetH) : null;
  const frameRects = makeCellRects(sheetW, sheetH, gridConfig, contentBand);
  if (frameRects.some((rect) => rect.w <= 0 || rect.h <= 0)) throw new Error("Computed frame size is zero");

  const targetW = Math.max(...frameRects.map((rect) => rect.w));
  const targetH = Math.max(...frameRects.map((rect) => rect.h));
  const canvas = createCanvas(targetW, targetH);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to acquire 2D context");

  const frames = frameRects.map((rect) => {
    canvas.width = rect.w;
    canvas.height = rect.h;
    ctx.clearRect(0, 0, rect.w, rect.h);
    ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
    return canvas.toDataURL("image/png");
  });

  return {
    frames,
    frameWidth: targetW,
    frameHeight: targetH,
    frameRects,
    diagnostic: diagnose(data, gridConfig, frameRects, contentBand),
  };
}

export async function composeSpriteSheet(frames: string[], gridConfig: GridConfig): Promise<string> {
  const images = await Promise.all(frames.map((frame) => loadImage(frame)));
  if (images.length === 0) throw new Error("No frames to compose");
  const { rows, cols, frameCount } = getGridMetrics(gridConfig);
  const used = images.slice(0, frameCount);
  const frameW = Math.max(...used.map((img) => img.naturalWidth || img.width));
  const frameH = Math.max(...used.map((img) => img.naturalHeight || img.height));
  const canvas = createCanvas(frameW * cols, frameH * rows);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to acquire 2D context");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  used.forEach((img, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    const x = col * frameW + Math.floor((frameW - w) / 2);
    const y = row * frameH + Math.floor((frameH - h) / 2);
    ctx.drawImage(img, x, y, w, h);
  });
  return canvas.toDataURL("image/png");
}

/**
 * Background-color keying: removes pixels that are very close to the dominant
 * background color of the four corner pixels.
 */
export async function keyOutBackground(
  dataUrl: string,
  options: {
    tolerance?: number;
    edgeBlend?: boolean;
    blendZoneRatio?: number;
    alphaCutoff?: number;
    spillRemoval?: boolean;
    spillStrength?: number;
    targetColor?: { r: number; g: number; b: number };
  } = {},
): Promise<string> {
  const tolerance = options.tolerance ?? 120;
  const edgeBlend = options.edgeBlend !== false;
  const blendZoneRatio = Math.max(0.05, Math.min(0.95, options.blendZoneRatio ?? 0.6));
  const alphaCutoff = Math.max(0, Math.min(255, options.alphaCutoff ?? 8));
  const spillRemoval = options.spillRemoval === true;
  const spillStrength = Math.max(0, Math.min(1, options.spillStrength ?? 0.45));
  const img = await loadImage(dataUrl);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) return dataUrl;

  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;

  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  const sampled = sampleBackground(px, w, h);
  const { r, g, b } = options.targetColor || sampled;

  if (edgeBlend) {
    const maxDist = tolerance * Math.sqrt(3);
    const blendZone = tolerance * blendZoneRatio;

    for (let i = 0; i < px.length; i += 4) {
      const dr = px[i] - r;
      const dg = px[i + 1] - g;
      const db = px[i + 2] - b;
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);
      if (dist <= blendZone) {
        px[i + 3] = 0;
      } else if (dist <= maxDist) {
        const ratio = (dist - blendZone) / Math.max(1, maxDist - blendZone);
        px[i + 3] = Math.round(px[i + 3] * ratio);
      }
      if (spillRemoval && px[i + 3] > 0 && dist <= maxDist * 1.35) {
        const closeness = Math.max(0, 1 - dist / Math.max(1, maxDist * 1.35));
        const channels = [r, g, b];
        const dominant = channels[0] >= channels[1] && channels[0] >= channels[2] ? 0 : channels[1] >= channels[2] ? 1 : 2;
        const a = dominant === 0 ? 1 : 0;
        const bIndex = dominant === 2 ? 1 : 2;
        const neutral = Math.max(px[i + a], px[i + bIndex]);
        const channel = i + dominant;
        if (px[channel] > neutral) {
          px[channel] = Math.round(px[channel] - (px[channel] - neutral) * spillStrength * closeness);
        }
      }
    }
  } else {
    const tol2 = tolerance * tolerance * 3;
    for (let i = 0; i < px.length; i += 4) {
      if (colorDistanceSq(px, i, r, g, b) <= tol2) {
        px[i + 3] = 0;
      }
    }
  }

  if (alphaCutoff > 0) {
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] <= alphaCutoff) px[i + 3] = 0;
    }
  }

  ctx.putImageData(data, 0, 0);
  return canvas.toDataURL("image/png");
}
