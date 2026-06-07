// 从灰度（高度图）通过 Sobel 算子生成法线贴图。

export interface NormalMapOptions {
  intensity: number;     // 强度（0.1 - 5.0），越大法线越陡
  flipY: boolean;        // 翻转 Y 通道（OpenGL vs DirectX 约定）
  blur: number;          // 高斯模糊半径（0=不模糊；用 box blur 近似）
  invertHeight: boolean; // 反相高度图（黑变白）
}

export const defaultNormalMapOptions: NormalMapOptions = {
  intensity: 2.0,
  flipY: false,
  blur: 0,
  invertHeight: false,
};

function getLuminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

// 简单 box blur（多次近似高斯）
function boxBlur(src: Float32Array, w: number, h: number, radius: number): Float32Array {
  if (radius <= 0) return src;
  const tmp = new Float32Array(src.length);
  const dst = new Float32Array(src.length);
  // 横向
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let count = 0;
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = x + dx;
        if (nx >= 0 && nx < w) {
          sum += src[y * w + nx]!;
          count++;
        }
      }
      tmp[y * w + x] = sum / count;
    }
  }
  // 纵向
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        const ny = y + dy;
        if (ny >= 0 && ny < h) {
          sum += tmp[ny * w + x]!;
          count++;
        }
      }
      dst[y * w + x] = sum / count;
    }
  }
  return dst;
}

export function generateNormalMap(source: ImageData, options: NormalMapOptions): ImageData {
  const w = source.width;
  const h = source.height;
  const src = source.data;

  // 1. 转灰度
  let height: Float32Array = new Float32Array(w * h);
  for (let i = 0, p = 0; i < src.length; i += 4, p++) {
    let lum = getLuminance(src[i]!, src[i + 1]!, src[i + 2]!) / 255;
    if (options.invertHeight) lum = 1 - lum;
    height[p] = lum;
  }

  // 2. 模糊
  if (options.blur > 0) {
    height = boxBlur(height, w, h, options.blur) as Float32Array;
  }

  // 3. Sobel
  const out = new ImageData(w, h);
  const intensity = Math.max(0.001, options.intensity);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // 边界 clamp 采样
      const xL = Math.max(0, x - 1);
      const xR = Math.min(w - 1, x + 1);
      const yT = Math.max(0, y - 1);
      const yB = Math.min(h - 1, y + 1);

      const tl = height[yT * w + xL]!;
      const tc = height[yT * w + x]!;
      const tr = height[yT * w + xR]!;
      const ml = height[y * w + xL]!;
      const mr = height[y * w + xR]!;
      const bl = height[yB * w + xL]!;
      const bc = height[yB * w + x]!;
      const br = height[yB * w + xR]!;

      // Sobel
      const dx = (tr + 2 * mr + br) - (tl + 2 * ml + bl);
      let dy = (bl + 2 * bc + br) - (tl + 2 * tc + tr);
      if (options.flipY) dy = -dy;

      // 法线向量 (-dx*intensity, -dy*intensity, 1)，再归一化
      const nx = -dx * intensity;
      const ny = -dy * intensity;
      const nz = 1.0;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      const r = ((nx / len) * 0.5 + 0.5) * 255;
      const g = ((ny / len) * 0.5 + 0.5) * 255;
      const b = ((nz / len) * 0.5 + 0.5) * 255;

      const idx = (y * w + x) * 4;
      out.data[idx] = r;
      out.data[idx + 1] = g;
      out.data[idx + 2] = b;
      out.data[idx + 3] = src[idx + 3]!; // alpha 保持
    }
  }
  return out;
}

export function loadImageDataFromFile(file: File): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0);
      resolve(ctx.getImageData(0, 0, c.width, c.height));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("加载失败")); };
    img.src = url;
  });
}
