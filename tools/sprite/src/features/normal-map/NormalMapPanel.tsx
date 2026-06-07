import { useState, useRef, useEffect, useCallback } from "react";
import {
  generateNormalMap,
  loadImageDataFromFile,
  defaultNormalMapOptions,
  type NormalMapOptions,
} from "./normalMap";

export function NormalMapPanel() {
  const [options, setOptions] = useState<NormalMapOptions>(defaultNormalMapOptions);
  const [sourceData, setSourceData] = useState<ImageData | null>(null);
  const [imageName, setImageName] = useState<string>("");
  const [running, setRunning] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const resultCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const handleFile = useCallback(async (file: File | null) => {
    if (!file) return;
    const data = await loadImageDataFromFile(file);
    setSourceData(data);
    setImageName(file.name);
  }, []);

  // 渲染源图
  useEffect(() => {
    if (!sourceData || !sourceCanvasRef.current) return;
    const c = sourceCanvasRef.current;
    c.width = sourceData.width;
    c.height = sourceData.height;
    c.getContext("2d")!.putImageData(sourceData, 0, 0);
  }, [sourceData]);

  // 计算法线
  useEffect(() => {
    if (!sourceData) return;
    setRunning(true);
    const id = setTimeout(() => {
      try {
        const out = generateNormalMap(sourceData, options);
        if (resultCanvasRef.current) {
          resultCanvasRef.current.width = out.width;
          resultCanvasRef.current.height = out.height;
          resultCanvasRef.current.getContext("2d")!.putImageData(out, 0, 0);
        }
      } catch (err) {
        console.error("法线生成失败", err);
      } finally {
        setRunning(false);
      }
    }, 80);
    return () => clearTimeout(id);
  }, [sourceData, options.intensity, options.flipY, options.blur, options.invertHeight]);

  function exportPng() {
    if (!resultCanvasRef.current) return;
    const link = document.createElement("a");
    const baseName = imageName.replace(/\.[^.]+$/, "");
    link.download = `${baseName}_normal.png`;
    link.href = resultCanvasRef.current.toDataURL("image/png");
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  return (
    <section className="panel normal-map-panel">
      <div className="quantize-header">
        <div>
          <h3>法线贴图生成</h3>
          <p>导入灰度高度图（黑色低、白色高），通过 Sobel 算子生成切线空间法线贴图。</p>
        </div>
        <div className="export-actions">
          <button onClick={() => fileInputRef.current?.click()}>选择图片</button>
          <button onClick={exportPng} disabled={!sourceData}>导出 PNG</button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.png,.jpg,.jpeg,.webp,.bmp"
        style={{ display: "none" }}
        onChange={(e) => { void handleFile(e.target.files?.[0] || null); e.currentTarget.value = ""; }}
      />

      <div className="info-box accent">
        <span>{sourceData ? `${imageName} - ${sourceData.width}x${sourceData.height}` : "未导入"}</span>
        <span className={running ? "tag busy" : "tag"}>{running ? "计算中…" : "实时预览"}</span>
      </div>

      <div className="quantize-controls">
        <label className="quantize-slider">
          <span>强度 <b>{options.intensity.toFixed(1)}</b></span>
          <input type="range" min="0.1" max="5" step="0.1" value={options.intensity}
            onChange={(e) => setOptions((o) => ({ ...o, intensity: Number(e.target.value) }))} />
        </label>
        <label className="quantize-slider">
          <span>模糊 <b>{options.blur}</b></span>
          <input type="range" min="0" max="8" step="1" value={options.blur}
            onChange={(e) => setOptions((o) => ({ ...o, blur: Number(e.target.value) }))} />
        </label>
        <label className="quantize-select">
          <span>选项</span>
          <label style={{ fontSize: "0.85rem" }}>
            <input type="checkbox" checked={options.flipY}
              onChange={(e) => setOptions((o) => ({ ...o, flipY: e.target.checked }))} />
            翻转 Y（DirectX 约定）
          </label>
          <label style={{ fontSize: "0.85rem", marginLeft: 12 }}>
            <input type="checkbox" checked={options.invertHeight}
              onChange={(e) => setOptions((o) => ({ ...o, invertHeight: e.target.checked }))} />
            反相高度图
          </label>
        </label>
      </div>

      <div className="quantize-compare side">
        <div className="quantize-canvas-wrap">
          <span className="canvas-label">源图（高度图）</span>
          <canvas ref={sourceCanvasRef} className="pixelated" />
        </div>
        <div className="quantize-canvas-wrap">
          <span className="canvas-label">法线贴图</span>
          <canvas ref={resultCanvasRef} />
        </div>
      </div>
    </section>
  );
}
