// 像素量化引擎 — 基于 image-q 库 + 像素化下采样
import { buildPaletteSync, applyPaletteSync, utils } from "image-q";
import type { PaletteQuantization, ImageQuantization } from "image-q";

export type DitheringMethod =
  | "nearest"
  | "floyd-steinberg"
  | "stucki"
  | "atkinson"
  | "jarvis"
  | "burkes"
  | "sierra";

export type QuantizeMethod = "wuquant" | "neuquant" | "rgbquant";

export interface QuantizeOptions {
  colors: number;            // 颜色数 2-256
  method: QuantizeMethod;    // 量化算法
  dithering: DitheringMethod;// 抖动算法
  pixelSize: number;         // 像素块大小 1-32（1=不像素化，>1=马赛克块）
}

export interface QuantizeResult {
  imageData: ImageData;     // 输出与源图同尺寸（已放大回去）
  palette: Array<{ r: number; g: number; b: number; a: number; hex: string }>;
  pixelatedWidth: number;   // 实际量化分辨率
  pixelatedHeight: number;
}

export const defaultQuantizeOptions: QuantizeOptions = {
  colors: 16,
  method: "wuquant",
  dithering: "nearest",       // 像素艺术常用无抖动
  pixelSize: 1,
};

function rgbaToHex(r: number, g: number, b: number, a: number): string {
  const hex = (v: number) => v.toString(16).padStart(2, "0");
  return a === 255 ? `#${hex(r)}${hex(g)}${hex(b)}` : `#${hex(r)}${hex(g)}${hex(b)}${hex(a)}`;
}

// 把源图按 pixelSize 缩小，得到下采样画布
function downsample(source: ImageData, pixelSize: number): ImageData {
  if (pixelSize <= 1) return source;
  const w = Math.max(1, Math.floor(source.width / pixelSize));
  const h = Math.max(1, Math.floor(source.height / pixelSize));
  const srcCanvas = document.createElement("canvas");
  srcCanvas.width = source.width;
  srcCanvas.height = source.height;
  srcCanvas.getContext("2d")!.putImageData(source, 0, 0);

  const dst = document.createElement("canvas");
  dst.width = w;
  dst.height = h;
  const ctx = dst.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;     // 关插值，得到块状结果
  ctx.drawImage(srcCanvas, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

export function quantizeImageData(source: ImageData, options: QuantizeOptions): QuantizeResult {
  // 1. 像素化下采样
  const small = downsample(source, options.pixelSize);

  // 2. 颜色量化
  const pointContainer = utils.PointContainer.fromImageData(small);
  const palette = buildPaletteSync([pointContainer], {
    colorDistanceFormula: "euclidean",
    paletteQuantization: options.method as PaletteQuantization,
    colors: options.colors,
  });
  const outContainer = applyPaletteSync(pointContainer, palette, {
    colorDistanceFormula: "euclidean",
    imageQuantization: options.dithering as ImageQuantization,
  });

  const quantizedSmall = new ImageData(
    new Uint8ClampedArray(outContainer.toUint8Array()),
    small.width,
    small.height,
  );

  // 3. 放大回源尺寸（最近邻，保留方块）
  let outImageData: ImageData;
  if (options.pixelSize <= 1) {
    outImageData = quantizedSmall;
  } else {
    const tmp = document.createElement("canvas");
    tmp.width = small.width;
    tmp.height = small.height;
    tmp.getContext("2d")!.putImageData(quantizedSmall, 0, 0);

    const big = document.createElement("canvas");
    big.width = source.width;
    big.height = source.height;
    const bigCtx = big.getContext("2d")!;
    bigCtx.imageSmoothingEnabled = false;
    bigCtx.drawImage(tmp, 0, 0, source.width, source.height);
    outImageData = bigCtx.getImageData(0, 0, source.width, source.height);
  }

  const palettePoints = palette.getPointContainer().getPointArray();
  const colors = palettePoints.map((p) => ({
    r: p.r, g: p.g, b: p.b, a: p.a,
    hex: rgbaToHex(p.r, p.g, p.b, p.a),
  }));

  return {
    imageData: outImageData,
    palette: colors,
    pixelatedWidth: small.width,
    pixelatedHeight: small.height,
  };
}

export function loadImageToCanvas(src: string): Promise<{ canvas: HTMLCanvasElement; imageData: ImageData }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0);
      resolve({ canvas, imageData: ctx.getImageData(0, 0, w, h) });
    };
    img.onerror = () => reject(new Error("图片加载失败"));
    img.src = src;
  });
}
