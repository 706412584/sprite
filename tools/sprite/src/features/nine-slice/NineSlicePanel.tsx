import { useState, useRef, useEffect, useCallback } from "react";
import {
  loadImageBitmap,
  renderNineSlice,
  type NineSliceBorders,
} from "./nineSlice";

export function NineSlicePanel() {
  const [imageUrl, setImageUrl] = useState<string>("");
  const [imageName, setImageName] = useState<string>("");
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [borders, setBorders] = useState<NineSliceBorders>({ top: 0, right: 0, bottom: 0, left: 0 });
  const [previewW, setPreviewW] = useState(400);
  const [previewH, setPreviewH] = useState(200);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const handleFile = useCallback(async (file: File | null) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const { bitmap: bm, width, height } = await loadImageBitmap(url);
    setBitmap(bm);
    setSize({ w: width, h: height });
    setImageUrl(url);
    setImageName(file.name);
    // 默认 1/4 处切线
    setBorders({
      top: Math.max(1, Math.floor(height / 4)),
      bottom: Math.max(1, Math.floor(height / 4)),
      left: Math.max(1, Math.floor(width / 4)),
      right: Math.max(1, Math.floor(width / 4)),
    });
    setPreviewW(Math.min(800, width * 2));
    setPreviewH(Math.min(800, height * 2));
  }, []);

  // 渲染源图 + 红色辅助线
  useEffect(() => {
    if (!bitmap || !sourceCanvasRef.current) return;
    const c = sourceCanvasRef.current;
    c.width = size.w;
    c.height = size.h;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(bitmap, 0, 0);
    // 切线
    ctx.save();
    ctx.strokeStyle = "rgba(255, 90, 90, 0.95)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    // 横线 top
    ctx.moveTo(0, borders.top); ctx.lineTo(size.w, borders.top);
    // 横线 bottom
    ctx.moveTo(0, size.h - borders.bottom); ctx.lineTo(size.w, size.h - borders.bottom);
    // 竖线 left
    ctx.moveTo(borders.left, 0); ctx.lineTo(borders.left, size.h);
    // 竖线 right
    ctx.moveTo(size.w - borders.right, 0); ctx.lineTo(size.w - borders.right, size.h);
    ctx.stroke();
    ctx.restore();
  }, [bitmap, size, borders]);

  // 渲染预览
  useEffect(() => {
    if (!bitmap || !previewCanvasRef.current) return;
    const c = previewCanvasRef.current;
    c.width = previewW;
    c.height = previewH;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    renderNineSlice(ctx, {
      source: bitmap,
      sourceWidth: size.w,
      sourceHeight: size.h,
      borders,
    }, previewW, previewH);
  }, [bitmap, size, borders, previewW, previewH]);

  function exportConfig() {
    const json = {
      image: imageName,
      width: size.w,
      height: size.h,
      // SCE / Unity-friendly: top/right/bottom/left 像素
      borders,
      // 同时导出 css border-image-slice 的写法
      cssBorderImageSlice: `${borders.top} ${borders.right} ${borders.bottom} ${borders.left} fill`,
    };
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const baseName = imageName.replace(/\.[^.]+$/, "");
    link.href = url;
    link.download = `${baseName}.9slice.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function exportPreviewPng() {
    if (!previewCanvasRef.current) return;
    const link = document.createElement("a");
    const baseName = imageName.replace(/\.[^.]+$/, "");
    link.download = `${baseName}_${previewW}x${previewH}.png`;
    link.href = previewCanvasRef.current.toDataURL("image/png");
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  return (
    <section className="panel nine-slice-panel">
      <div className="quantize-header">
        <div>
          <h3>9-slice 编辑器</h3>
          <p>设置 4 条切割线，预览不同尺寸下的拉伸效果，导出 9-slice JSON。</p>
        </div>
        <div className="export-actions">
          <button onClick={() => fileInputRef.current?.click()}>选择图片</button>
          <button onClick={exportConfig} disabled={!bitmap}>导出 JSON</button>
          <button onClick={exportPreviewPng} disabled={!bitmap}>导出预览 PNG</button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.png,.jpg,.jpeg,.webp,.bmp"
        style={{ display: "none" }}
        onChange={(e) => { handleFile(e.target.files?.[0] || null); e.currentTarget.value = ""; }}
      />

      {!bitmap && (
        <div className="info-box">
          <span>未选择图片。导入一张 UI 图（如按钮、面板、对话框背景）开始编辑。</span>
        </div>
      )}

      {bitmap && (
        <>
          <div className="info-box accent">
            <span>{imageName} - 源尺寸 {size.w}x{size.h}</span>
            <span>预览尺寸 {previewW}x{previewH}</span>
          </div>

          <div className="quantize-controls">
            <label className="quantize-slider">
              <span>顶部 <b>{borders.top}px</b></span>
              <input type="range" min="0" max={Math.floor(size.h / 2) - 1} value={borders.top}
                onChange={(e) => setBorders((b) => ({ ...b, top: Number(e.target.value) }))} />
            </label>
            <label className="quantize-slider">
              <span>底部 <b>{borders.bottom}px</b></span>
              <input type="range" min="0" max={Math.floor(size.h / 2) - 1} value={borders.bottom}
                onChange={(e) => setBorders((b) => ({ ...b, bottom: Number(e.target.value) }))} />
            </label>
            <label className="quantize-slider">
              <span>左侧 <b>{borders.left}px</b></span>
              <input type="range" min="0" max={Math.floor(size.w / 2) - 1} value={borders.left}
                onChange={(e) => setBorders((b) => ({ ...b, left: Number(e.target.value) }))} />
            </label>
            <label className="quantize-slider">
              <span>右侧 <b>{borders.right}px</b></span>
              <input type="range" min="0" max={Math.floor(size.w / 2) - 1} value={borders.right}
                onChange={(e) => setBorders((b) => ({ ...b, right: Number(e.target.value) }))} />
            </label>
            <label className="quantize-slider">
              <span>预览宽度 <b>{previewW}px</b></span>
              <input type="range" min="50" max="1200" step="10" value={previewW}
                onChange={(e) => setPreviewW(Number(e.target.value))} />
            </label>
            <label className="quantize-slider">
              <span>预览高度 <b>{previewH}px</b></span>
              <input type="range" min="50" max="1200" step="10" value={previewH}
                onChange={(e) => setPreviewH(Number(e.target.value))} />
            </label>
          </div>

          <div className="quantize-compare side">
            <div className="quantize-canvas-wrap">
              <span className="canvas-label">源图（红线为切割边界）</span>
              <canvas ref={sourceCanvasRef} className="pixelated" />
            </div>
            <div className="quantize-canvas-wrap">
              <span className="canvas-label">预览（按设置尺寸拉伸）</span>
              <canvas ref={previewCanvasRef} />
            </div>
          </div>
        </>
      )}
    </section>
  );
}
