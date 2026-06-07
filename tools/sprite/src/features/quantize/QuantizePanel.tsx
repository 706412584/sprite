import { useState, useRef, useCallback, useEffect } from "react";
import {
  quantizeImageData,
  loadImageToCanvas,
  defaultQuantizeOptions,
  type QuantizeOptions,
  type QuantizeResult,
  type DitheringMethod,
  type QuantizeMethod,
} from "./quantizeEngine";

const ditheringOptions: Array<{ value: DitheringMethod; label: string }> = [
  { value: "nearest", label: "无抖动（像素艺术）" },
  { value: "floyd-steinberg", label: "Floyd-Steinberg" },
  { value: "stucki", label: "Stucki" },
  { value: "atkinson", label: "Atkinson" },
  { value: "jarvis", label: "Jarvis" },
  { value: "burkes", label: "Burkes" },
  { value: "sierra", label: "Sierra" },
];

const methodOptions: Array<{ value: QuantizeMethod; label: string }> = [
  { value: "wuquant", label: "WuQuant（推荐）" },
  { value: "neuquant", label: "NeuQuant" },
  { value: "rgbquant", label: "RGBQuant" },
];

export function QuantizePanel() {
  const [options, setOptions] = useState<QuantizeOptions>(defaultQuantizeOptions);
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceSize, setSourceSize] = useState({ width: 0, height: 0 });
  const [result, setResult] = useState<QuantizeResult | null>(null);
  const [processing, setProcessing] = useState(false);
  const [editingColor, setEditingColor] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const resultCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sourceImageDataRef = useRef<ImageData | null>(null);
  const debounceTimerRef = useRef<number | null>(null);
  const pendingRunRef = useRef(false);

  // 加载源图
  const loadSource = useCallback(async (url: string) => {
    const { canvas, imageData } = await loadImageToCanvas(url);
    sourceImageDataRef.current = imageData;
    setSourceUrl(url);
    setSourceSize({ width: canvas.width, height: canvas.height });

    if (sourceCanvasRef.current) {
      sourceCanvasRef.current.width = canvas.width;
      sourceCanvasRef.current.height = canvas.height;
      const ctx = sourceCanvasRef.current.getContext("2d")!;
      ctx.drawImage(canvas, 0, 0);
    }
  }, []);

  function handleFile(file: File | null) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    void loadSource(url);
  }

  // 实时量化（debounced）
  const runQuantize = useCallback((opts: QuantizeOptions) => {
    if (!sourceImageDataRef.current) return;
    if (processing) {
      pendingRunRef.current = true;     // 标记需要再跑一次
      return;
    }
    setProcessing(true);
    requestAnimationFrame(() => {
      setTimeout(() => {
        try {
          const qResult = quantizeImageData(sourceImageDataRef.current!, opts);
          setResult(qResult);
        } finally {
          setProcessing(false);
          if (pendingRunRef.current) {
            pendingRunRef.current = false;
            runQuantize(opts);
          }
        }
      }, 0);
    });
  }, [processing]);

  // 参数或图片变化触发 debounced 量化
  useEffect(() => {
    if (!sourceUrl) return;
    if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = window.setTimeout(() => {
      runQuantize(options);
    }, 80);
    return () => {
      if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
    };
  }, [sourceUrl, options.colors, options.method, options.dithering, options.pixelSize]);

  // 结果渲染到 canvas
  useEffect(() => {
    if (!result || !resultCanvasRef.current) return;
    resultCanvasRef.current.width = result.imageData.width;
    resultCanvasRef.current.height = result.imageData.height;
    const ctx = resultCanvasRef.current.getContext("2d")!;
    ctx.putImageData(result.imageData, 0, 0);
  }, [result]);

  function exportResult() {
    if (!resultCanvasRef.current) return;
    const link = document.createElement("a");
    link.download = `quantized_${options.pixelSize}x_${options.colors}c.png`;
    link.href = resultCanvasRef.current.toDataURL("image/png");
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  return (
    <section className="panel quantize-panel">
      <div className="quantize-header">
        <div>
          <h3>像素量化编辑器</h3>
          <p>拖动滑块即可实时像素化和颜色量化预览。</p>
        </div>
        <div className="export-actions">
          <button onClick={() => fileInputRef.current?.click()}>选择图片</button>
          <button onClick={exportResult} disabled={!result}>导出结果</button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.png,.jpg,.jpeg,.webp,.bmp"
        style={{ display: "none" }}
        onChange={(e) => { handleFile(e.target.files?.[0] || null); e.currentTarget.value = ""; }}
      />

      <div className="info-box accent">
        <span>源尺寸：{sourceSize.width || "-"} x {sourceSize.height || "-"}</span>
        <span>像素分辨率：{result ? `${result.pixelatedWidth} x ${result.pixelatedHeight}` : "-"}</span>
        <span>调色板：{result ? `${result.palette.length} 色` : "-"}</span>
        <span className={processing ? "tag busy" : "tag"}>{processing ? "量化中…" : "实时预览"}</span>
      </div>

      <div className="quantize-controls">
        <label className="quantize-slider">
          <span>像素块大小 <b>{options.pixelSize}px</b></span>
          <input
            type="range"
            min="1"
            max="32"
            step="1"
            value={options.pixelSize}
            onChange={(e) => setOptions((o) => ({ ...o, pixelSize: Number(e.target.value) }))}
          />
        </label>
        <label className="quantize-slider">
          <span>颜色数量 <b>{options.colors}</b></span>
          <input
            type="range"
            min="2"
            max="256"
            step="1"
            value={options.colors}
            onChange={(e) => setOptions((o) => ({ ...o, colors: Number(e.target.value) }))}
          />
        </label>
        <label className="quantize-select">
          <span>量化算法</span>
          <select
            value={options.method}
            onChange={(e) => setOptions((o) => ({ ...o, method: e.target.value as QuantizeMethod }))}
          >
            {methodOptions.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </label>
        <label className="quantize-select">
          <span>抖动算法</span>
          <select
            value={options.dithering}
            onChange={(e) => setOptions((o) => ({ ...o, dithering: e.target.value as DitheringMethod }))}
          >
            {ditheringOptions.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </label>
      </div>

      <div className="quantize-compare side">
        <div className="quantize-canvas-wrap">
          <span className="canvas-label">原图</span>
          <canvas ref={sourceCanvasRef} className="pixelated" />
        </div>
        <div className="quantize-canvas-wrap">
          <span className="canvas-label">量化结果</span>
          <canvas ref={resultCanvasRef} className="pixelated" />
        </div>
      </div>

      {result && (
        <div className="quantize-palette">
          <h4>调色板 ({result.palette.length} 色)</h4>
          <div className="palette-grid">
            {result.palette.map((color, i) => (
              <div
                key={i}
                className={`palette-swatch ${editingColor === i ? "editing" : ""}`}
                style={{ backgroundColor: color.hex }}
                title={color.hex}
                onClick={() => setEditingColor(editingColor === i ? null : i)}
              >
                {editingColor === i && <span className="swatch-hex">{color.hex}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
