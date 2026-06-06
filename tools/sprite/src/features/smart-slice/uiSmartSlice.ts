export interface UiSliceRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface UiSliceCandidate extends UiSliceRect {
  id: string;
  name: string;
  area: number;
  confidence: number;
}

export interface UiSmartSliceOptions {
  alphaThreshold: number;
  colorThreshold: number;
  minSize: number;
  minArea: number;
  padding: number;
  mergeGap: number;
  maxAreaRatio: number;
  maxAspectRatio: number;
  includeThin: boolean;
}

export interface UiSmartSliceResult {
  width: number;
  height: number;
  candidates: UiSliceCandidate[];
  warnings: string[];
}

export const defaultUiSmartSliceOptions: UiSmartSliceOptions = {
  alphaThreshold: 16,
  colorThreshold: 36,
  minSize: 8,
  minArea: 16,
  padding: 4,
  mergeGap: 6,
  maxAreaRatio: 0.8,
  maxAspectRatio: 20,
  includeThin: false,
};

interface ComponentBox extends UiSliceRect {
  area: number;
}

export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("图片加载失败"));
    img.src = src;
  });
}

export async function analyzeUiSmartSlices(dataUrl: string, inputOptions: Partial<UiSmartSliceOptions> = {}): Promise<UiSmartSliceResult> {
  const options = { ...defaultUiSmartSliceOptions, ...inputOptions };
  const img = await loadImageElement(dataUrl);
  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 初始化失败");
  ctx.drawImage(img, 0, 0);

  const image = ctx.getImageData(0, 0, width, height);
  const mask = buildContentMask(image.data, width, height, options.alphaThreshold, options.colorThreshold);
  const components = detectComponents(mask, width, height);
  const warnings: string[] = [];
  if (components.length === 0) warnings.push("未检测到可切片区域，请先去底或降低 Alpha 阈值。");

  const imageArea = width * height;
  const minArea = Math.max(options.minArea, Math.round(imageArea * 0.00002));
  const padded = components
    .filter((box) => box.area >= minArea)
    .map((box) => padRect(box, options.padding, width, height));
  const candidates = buildCandidates(mergeRects(padded, options.mergeGap), imageArea, options);
  const finalCandidates = candidates.length > 0 ? candidates : buildCandidates(padded, imageArea, options);

  if (components.length > 0 && finalCandidates.length === 0) warnings.push("检测到了内容，但被过滤规则排除；可开启细长元素或降低最小尺寸。");

  return { width, height, candidates: finalCandidates, warnings };
}

function buildCandidates(rects: ComponentBox[], imageArea: number, options: UiSmartSliceOptions): UiSliceCandidate[] {
  return rects
    .map((rect, index) => toCandidate(rect, index, imageArea, options))
    .filter((candidate) => shouldKeepCandidate(candidate, imageArea, options))
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((candidate, index) => ({ ...candidate, name: `ui_slice_${String(index + 1).padStart(2, "0")}` }));
}

function buildContentMask(data: Uint8ClampedArray, width: number, height: number, alphaThreshold: number, colorThreshold: number): Uint8Array {
  const mask = new Uint8Array(width * height);
  const hasTransparency = detectTransparency(data, alphaThreshold);
  const bg = hasTransparency ? null : sampleBackgroundColor(data, width, height);
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    if (hasTransparency) {
      mask[p] = data[i + 3] > alphaThreshold ? 1 : 0;
      continue;
    }
    const distance = bg ? colorDistance(data[i], data[i + 1], data[i + 2], bg.r, bg.g, bg.b) : 0;
    mask[p] = distance > colorThreshold ? 1 : 0;
  }
  return mask;
}

function detectTransparency(data: Uint8ClampedArray, alphaThreshold: number): boolean {
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] <= alphaThreshold) return true;
  }
  return false;
}

function sampleBackgroundColor(data: Uint8ClampedArray, width: number, height: number) {
  const points = [0, width - 1, (height - 1) * width, height * width - 1];
  let r = 0;
  let g = 0;
  let b = 0;
  for (const point of points) {
    const i = point * 4;
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
  }
  return { r: r / points.length, g: g / points.length, b: b / points.length };
}

function colorDistance(r0: number, g0: number, b0: number, r1: number, g1: number, b1: number): number {
  const dr = r0 - r1;
  const dg = g0 - g1;
  const db = b0 - b1;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function detectComponents(mask: Uint8Array, width: number, height: number): ComponentBox[] {
  const visited = new Uint8Array(mask.length);
  const components: ComponentBox[] = [];
  const queue: number[] = [];

  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || visited[start]) continue;
    visited[start] = 1;
    queue.length = 0;
    queue.push(start);
    let head = 0;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    let area = 0;

    while (head < queue.length) {
      const index = queue[head++];
      const x = index % width;
      const y = Math.floor(index / width);
      area += 1;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;

      visitNeighbor(index - 1, x > 0);
      visitNeighbor(index + 1, x < width - 1);
      visitNeighbor(index - width, y > 0);
      visitNeighbor(index + width, y < height - 1);
    }

    components.push({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, area });
  }

  return components;

  function visitNeighbor(index: number, valid: boolean) {
    if (!valid || !mask[index] || visited[index]) return;
    visited[index] = 1;
    queue.push(index);
  }
}

function padRect(rect: ComponentBox, padding: number, width: number, height: number): ComponentBox {
  const x = Math.max(0, rect.x - padding);
  const y = Math.max(0, rect.y - padding);
  const right = Math.min(width, rect.x + rect.w + padding);
  const bottom = Math.min(height, rect.y + rect.h + padding);
  return { ...rect, x, y, w: right - x, h: bottom - y };
}

function mergeRects(rects: ComponentBox[], gap: number): ComponentBox[] {
  const result = rects.map((rect) => ({ ...rect }));
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < result.length; i += 1) {
      for (let j = i + 1; j < result.length; j += 1) {
        if (!shouldMerge(result[i], result[j], gap)) continue;
        result[i] = unionRect(result[i], result[j]);
        result.splice(j, 1);
        changed = true;
        break;
      }
      if (changed) break;
    }
  }
  return result;
}

function shouldMerge(a: UiSliceRect, b: UiSliceRect, gap: number): boolean {
  if (iou(a, b) > 0.2) return true;
  const horizontalGap = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w));
  const verticalGap = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h));
  const xOverlap = overlap(a.x, a.x + a.w, b.x, b.x + b.w) / Math.max(1, Math.min(a.w, b.w));
  const yOverlap = overlap(a.y, a.y + a.h, b.y, b.y + b.h) / Math.max(1, Math.min(a.h, b.h));
  return horizontalGap <= gap && verticalGap <= gap && (xOverlap > 0.5 || yOverlap > 0.5);
}

function unionRect(a: ComponentBox, b: ComponentBox): ComponentBox {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.w, b.x + b.w);
  const bottom = Math.max(a.y + a.h, b.y + b.h);
  return { x, y, w: right - x, h: bottom - y, area: a.area + b.area };
}

function iou(a: UiSliceRect, b: UiSliceRect): number {
  const intersection = overlap(a.x, a.x + a.w, b.x, b.x + b.w) * overlap(a.y, a.y + a.h, b.y, b.y + b.h);
  if (intersection <= 0) return 0;
  const union = a.w * a.h + b.w * b.h - intersection;
  return intersection / union;
}

function overlap(a0: number, a1: number, b0: number, b1: number): number {
  return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
}

function toCandidate(rect: ComponentBox, index: number, imageArea: number, options: UiSmartSliceOptions): UiSliceCandidate {
  const areaRatio = rect.area / Math.max(1, imageArea);
  const sizeScore = Math.min(1, Math.sqrt(areaRatio) * 12);
  const confidence = Math.max(0.05, Math.min(0.99, sizeScore));
  return {
    id: `slice_${Date.now().toString(36)}_${index}`,
    name: `ui_slice_${String(index + 1).padStart(2, "0")}`,
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    w: Math.round(rect.w),
    h: Math.round(rect.h),
    area: rect.area,
    confidence,
  };
}

function shouldKeepCandidate(candidate: UiSliceCandidate, imageArea: number, options: UiSmartSliceOptions): boolean {
  if (candidate.w < options.minSize || candidate.h < options.minSize) return false;
  if (candidate.w * candidate.h > imageArea * options.maxAreaRatio) return false;
  if (options.includeThin) return true;
  const aspect = Math.max(candidate.w / Math.max(1, candidate.h), candidate.h / Math.max(1, candidate.w));
  return aspect <= options.maxAspectRatio;
}

export async function cropUiSlice(dataUrl: string, rect: UiSliceRect): Promise<string> {
  const img = await loadImageElement(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(rect.w));
  canvas.height = Math.max(1, Math.round(rect.h));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 初始化失败");
  ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
  return canvas.toDataURL("image/png");
}

export interface RotatedCropRect {
  cx: number; // 源图中裁剪中心 x（像素）
  cy: number; // 源图中裁剪中心 y（像素）
  w: number; // 输出宽（像素）
  h: number; // 输出高（像素）
  angle: number; // 部件主轴相对水平方向的角度（弧度），输出会被旋转回水平
}

// 旋转矩形裁剪：以 (cx,cy) 为中心、按 angle 取一块旋转矩形，输出为水平摆正的 PNG（保留 alpha）。
// 用于四肢——大臂/前臂/大腿/小腿这类带方向的部件。
export async function cropRotated(dataUrl: string, rect: RotatedCropRect): Promise<string> {
  const img = await loadImageElement(dataUrl);
  const w = Math.max(1, Math.round(rect.w));
  const h = Math.max(1, Math.round(rect.h));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 初始化失败");
  // 把输出画布原点移到中心，反向旋转，再把源图按中心对齐绘制，
  // 这样源图中以 (cx,cy) 为中心、倾斜 angle 的区域就被摆正到画布。
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-rect.angle);
  ctx.drawImage(img, -rect.cx, -rect.cy);
  return canvas.toDataURL("image/png");
}

export async function exportUiSlices(dataUrl: string, candidates: UiSliceCandidate[]) {
  const slices = await Promise.all(candidates.map(async (candidate) => ({ candidate, dataUrl: await cropUiSlice(dataUrl, candidate) })));
  const metadata = {
    width: (await loadImageElement(dataUrl)).naturalWidth,
    height: (await loadImageElement(dataUrl)).naturalHeight,
    slices: candidates.map(({ id, name, x, y, w, h }) => ({ id, name, x, y, w, h, file: `${safeFileName(name)}.png` })),
  };
  return { slices, metadata };
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function downloadText(text: string, filename: string) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function safeFileName(name: string): string {
  return name.trim().replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "ui_slice";
}
