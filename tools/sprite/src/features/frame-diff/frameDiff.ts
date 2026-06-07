// 计算帧间差异：MAD（Mean Absolute Difference）+ 像素级 diff 热力图。

export interface FrameDiffMetrics {
  mad: number;        // 平均绝对差（0-255）
  changedRatio: number; // 变化像素比例（>阈值的像素 / 总像素）
}

// 把两帧 ImageData 计算 diff（绝对差）作为热力图（红色越深差越大）
export function diffImage(a: ImageData, b: ImageData): { data: ImageData; metrics: FrameDiffMetrics } {
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(`帧尺寸不一致：${a.width}x${a.height} vs ${b.width}x${b.height}`);
  }
  const w = a.width;
  const h = a.height;
  const out = new ImageData(w, h);
  let sum = 0;
  let changed = 0;
  const total = w * h;
  const threshold = 8;
  for (let i = 0; i < a.data.length; i += 4) {
    const dr = Math.abs(a.data[i]! - b.data[i]!);
    const dg = Math.abs(a.data[i + 1]! - b.data[i + 1]!);
    const db = Math.abs(a.data[i + 2]! - b.data[i + 2]!);
    const max = Math.max(dr, dg, db);
    sum += (dr + dg + db) / 3;
    if (max > threshold) changed++;
    // 编码为热力图：浅蓝（小差）→ 黄 → 红（大差）
    if (max < 4) {
      out.data[i] = 30; out.data[i + 1] = 30; out.data[i + 2] = 40; out.data[i + 3] = 255;
    } else {
      const t = Math.min(1, max / 128);
      // 蓝→黄→红
      const r = Math.round(255 * t);
      const g = Math.round(255 * Math.min(1, t * 1.5) * (1 - t * 0.6));
      const bl = Math.round(255 * (1 - t));
      out.data[i] = r; out.data[i + 1] = g; out.data[i + 2] = bl; out.data[i + 3] = 255;
    }
  }
  return {
    data: out,
    metrics: {
      mad: sum / total,
      changedRatio: changed / total,
    },
  };
}

export function loadImageDataFromFile(file: File): Promise<{ data: ImageData; name: string }> {
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
      resolve({ data: ctx.getImageData(0, 0, c.width, c.height), name: file.name });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("加载失败")); };
    img.src = url;
  });
}
