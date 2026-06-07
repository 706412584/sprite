// 像素字体生成：渲染字符到目标像素大小，阈值化后做成 sprite sheet。

export interface PixelFontOptions {
  fontSize: number;          // 渲染时的目标像素高度（同时也是 cell 高度）
  charset: string;           // 要生成的字符（如 "ABCDEF...0123"）
  threshold: number;         // 0-255，灰度阈值（透明判断）
  padding: number;           // 每格内边距
  color: string;             // 字色 hex
  bold: boolean;             // 加粗
  smoothing: boolean;        // 是否在原始大小做高质量渲染再缩放（false = 直接像素栅格化）
  bgColor: string | null;    // 背景色（null = 透明）
}

export const defaultPixelFontOptions: PixelFontOptions = {
  fontSize: 16,
  charset: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!?.,:;'\"-+()[]{}<>/@#$%^&*=_",
  threshold: 128,
  padding: 1,
  color: "#ffffff",
  bold: false,
  smoothing: false,
  bgColor: null,
};

export interface CharGlyph {
  char: string;
  x: number;
  y: number;
  w: number;
  h: number;
  advance: number;
}

export interface PixelFontResult {
  sheet: ImageData;
  glyphs: CharGlyph[];
  cellWidth: number;
  cellHeight: number;
  cols: number;
  rows: number;
}

// 估算字符宽度
function measureCharWidth(ctx: CanvasRenderingContext2D, ch: string): number {
  return Math.max(1, Math.ceil(ctx.measureText(ch).width));
}

export function renderPixelFont(
  fontFamily: string,
  options: PixelFontOptions,
): PixelFontResult {
  const { fontSize, charset, threshold, padding, color, bold, smoothing, bgColor } = options;

  // 第一步：测量每个字符在目标 fontSize 下的宽度
  const measure = document.createElement("canvas").getContext("2d")!;
  measure.font = `${bold ? "bold " : ""}${fontSize}px "${fontFamily}"`;
  const widths = Array.from(charset).map((ch) => measureCharWidth(measure, ch));
  const maxW = Math.max(...widths);

  const cellW = maxW + padding * 2;
  const cellH = fontSize + padding * 2;
  const cols = Math.ceil(Math.sqrt(charset.length * cellH / cellW));
  const rows = Math.ceil(charset.length / cols);

  const sheetW = cellW * cols;
  const sheetH = cellH * rows;

  const sheet = document.createElement("canvas");
  sheet.width = sheetW;
  sheet.height = sheetH;
  const sctx = sheet.getContext("2d")!;

  if (bgColor) {
    sctx.fillStyle = bgColor;
    sctx.fillRect(0, 0, sheetW, sheetH);
  }

  // 渲染每个字符到对应 cell
  sctx.imageSmoothingEnabled = false;
  sctx.fillStyle = color;
  sctx.textBaseline = "top";

  const glyphs: CharGlyph[] = [];
  const chars = Array.from(charset);

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]!;
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = col * cellW + padding;
    const cy = row * cellH + padding;

    if (smoothing) {
      // 直接画到 cell（浏览器抗锯齿）
      sctx.imageSmoothingEnabled = true;
      sctx.font = `${bold ? "bold " : ""}${fontSize}px "${fontFamily}"`;
      sctx.fillStyle = color;
      sctx.fillText(ch, cx, cy);
    } else {
      // 在更大尺寸渲染再缩小到 fontSize 像素并阈值化
      const big = document.createElement("canvas");
      const bigSize = fontSize * 4;
      big.width = bigSize * 2;
      big.height = bigSize * 2;
      const bctx = big.getContext("2d")!;
      bctx.imageSmoothingEnabled = true;
      bctx.font = `${bold ? "bold " : ""}${bigSize}px "${fontFamily}"`;
      bctx.fillStyle = "#ffffff";
      bctx.textBaseline = "top";
      bctx.fillText(ch, 0, 0);
      // 阈值化
      const big_w = Math.max(1, Math.ceil(bctx.measureText(ch).width));
      const big_h = bigSize;
      // 缩放到目标 cell
      const tmp = document.createElement("canvas");
      tmp.width = widths[i]!;
      tmp.height = fontSize;
      const tctx = tmp.getContext("2d")!;
      tctx.imageSmoothingEnabled = true;
      tctx.drawImage(big, 0, 0, big_w, big_h, 0, 0, tmp.width, tmp.height);
      // 阈值化输出
      const data = tctx.getImageData(0, 0, tmp.width, tmp.height);
      const targetRgba = hexToRgba(color);
      for (let p = 0; p < data.data.length; p += 4) {
        // 用 R 通道作为亮度（白底渲染）
        const lum = data.data[p]!;
        if (lum >= threshold) {
          data.data[p] = targetRgba.r;
          data.data[p + 1] = targetRgba.g;
          data.data[p + 2] = targetRgba.b;
          data.data[p + 3] = targetRgba.a;
        } else {
          data.data[p + 3] = 0;
        }
      }
      tctx.putImageData(data, 0, 0);
      sctx.drawImage(tmp, cx, cy);
    }

    glyphs.push({ char: ch, x: cx, y: cy, w: widths[i]!, h: fontSize, advance: widths[i]! });
  }

  return {
    sheet: sctx.getImageData(0, 0, sheetW, sheetH),
    glyphs,
    cellWidth: cellW,
    cellHeight: cellH,
    cols,
    rows,
  };
}

function hexToRgba(hex: string): { r: number; g: number; b: number; a: number } {
  let h = hex.startsWith("#") ? hex.slice(1) : hex;
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length === 6) h += "ff";
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
    a: parseInt(h.slice(6, 8), 16),
  };
}

// 把 ttf File 注册成 FontFace，返回字体名
export async function loadFontFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  // 用文件名作字体家族名（避免冲突）
  const family = `pf_${Date.now()}_${file.name.replace(/[^a-z0-9]/gi, "_")}`;
  const face = new FontFace(family, buf);
  await face.load();
  (document.fonts as any).add(face);
  return family;
}
