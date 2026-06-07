// 9-slice 渲染：把源图按 top/right/bottom/left 4 条线切成 9 块，
// 4 角不缩放，4 边沿对应方向拉伸，中心区域两方向都拉伸。

export interface NineSliceBorders {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface NineSliceConfig {
  // 源图
  source: ImageBitmap | HTMLCanvasElement | HTMLImageElement;
  sourceWidth: number;
  sourceHeight: number;
  borders: NineSliceBorders;
}

// 把配置渲染到目标尺寸 canvas
export function renderNineSlice(
  ctx: CanvasRenderingContext2D,
  config: NineSliceConfig,
  targetWidth: number,
  targetHeight: number,
) {
  const { source, sourceWidth: sw, sourceHeight: sh, borders } = config;
  const { top, right, bottom, left } = borders;

  // 防止边界总和超出
  const t = Math.min(top, sh - 1);
  const b = Math.min(bottom, sh - t - 1);
  const l = Math.min(left, sw - 1);
  const r = Math.min(right, sw - l - 1);

  // 源图各列宽度
  const srcCols = [l, sw - l - r, r];
  const srcRows = [t, sh - t - b, b];

  // 目标列宽：角不缩放，中间块吃掉剩余空间
  const tCols = [l, Math.max(0, targetWidth - l - r), r];
  const tRows = [t, Math.max(0, targetHeight - t - b), b];

  let sy = 0;
  let dy = 0;
  for (let row = 0; row < 3; row++) {
    let sx = 0;
    let dx = 0;
    for (let col = 0; col < 3; col++) {
      if (srcCols[col]! > 0 && srcRows[row]! > 0 && tCols[col]! > 0 && tRows[row]! > 0) {
        ctx.drawImage(
          source as CanvasImageSource,
          sx, sy, srcCols[col]!, srcRows[row]!,
          dx, dy, tCols[col]!, tRows[row]!,
        );
      }
      sx += srcCols[col]!;
      dx += tCols[col]!;
    }
    sy += srcRows[row]!;
    dy += tRows[row]!;
  }
}

export function loadImageBitmap(src: string): Promise<{ bitmap: ImageBitmap; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = async () => {
      const bitmap = await createImageBitmap(img);
      resolve({ bitmap, width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
    };
    img.onerror = () => reject(new Error("图片加载失败"));
    img.src = src;
  });
}
