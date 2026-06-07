import { useState, useRef, useEffect, useCallback } from "react";
import {
  loadFontFile,
  renderPixelFont,
  defaultPixelFontOptions,
  type PixelFontOptions,
  type PixelFontResult,
} from "./pixelFont";

const SYSTEM_FONTS = ["sans-serif", "serif", "monospace", "Arial", "Verdana", "Courier New"];

export function PixelFontPanel() {
  const [options, setOptions] = useState<PixelFontOptions>(defaultPixelFontOptions);
  const [fontFamily, setFontFamily] = useState<string>("monospace");
  const [fontDisplayName, setFontDisplayName] = useState<string>("monospace");
  const [result, setResult] = useState<PixelFontResult | null>(null);
  const [running, setRunning] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const generate = useCallback(() => {
    if (running) return;
    setRunning(true);
    requestAnimationFrame(() => {
      setTimeout(() => {
        try {
          const r = renderPixelFont(fontFamily, options);
          setResult(r);
        } catch (err) {
          console.error("生成失败", err);
        } finally {
          setRunning(false);
        }
      }, 0);
    });
  }, [fontFamily, options, running]);

  useEffect(() => {
    if (!result || !canvasRef.current) return;
    const c = canvasRef.current;
    c.width = result.sheet.width;
    c.height = result.sheet.height;
    c.getContext("2d")!.putImageData(result.sheet, 0, 0);
  }, [result]);

  // 自动生成（参数变化时）
  useEffect(() => {
    const t = setTimeout(generate, 80);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontFamily, options.fontSize, options.charset, options.threshold, options.padding, options.color, options.bold, options.smoothing, options.bgColor]);

  async function handleFontFile(file: File | null) {
    if (!file) return;
    try {
      const family = await loadFontFile(file);
      setFontFamily(family);
      setFontDisplayName(file.name);
    } catch (err) {
      console.error(err);
      alert("字体加载失败");
    }
  }

  function exportSheet() {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = `pixelfont_${options.fontSize}px.png`;
    link.href = canvasRef.current.toDataURL("image/png");
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function exportJson() {
    if (!result) return;
    const json = {
      fontSize: options.fontSize,
      cellWidth: result.cellWidth,
      cellHeight: result.cellHeight,
      cols: result.cols,
      rows: result.rows,
      glyphs: result.glyphs,
    };
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pixelfont_${options.fontSize}px.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="panel pixel-font-panel">
      <div className="quantize-header">
        <div>
          <h3>像素字体生成</h3>
          <p>导入 ttf/woff 或选择系统字体，按目标像素栅格化生成 sprite sheet 与位图字体 JSON。</p>
        </div>
        <div className="export-actions">
          <button onClick={() => fileInputRef.current?.click()}>导入字体</button>
          <button onClick={exportSheet} disabled={!result}>导出 PNG</button>
          <button onClick={exportJson} disabled={!result}>导出 JSON</button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".ttf,.otf,.woff,.woff2"
        style={{ display: "none" }}
        onChange={(e) => { void handleFontFile(e.target.files?.[0] || null); e.currentTarget.value = ""; }}
      />

      <div className="info-box accent">
        <span>当前字体：{fontDisplayName}</span>
        <span>字符数：{Array.from(options.charset).length}</span>
        <span>{result ? `Sheet: ${result.sheet.width}x${result.sheet.height} (${result.cols}x${result.rows})` : "-"}</span>
        <span className={running ? "tag busy" : "tag"}>{running ? "渲染中…" : "实时预览"}</span>
      </div>

      <div className="quantize-controls">
        <label className="quantize-select">
          <span>系统字体</span>
          <select
            value={SYSTEM_FONTS.includes(fontFamily) ? fontFamily : ""}
            onChange={(e) => { setFontFamily(e.target.value); setFontDisplayName(e.target.value); }}
          >
            <option value="">（已加载自定义字体）</option>
            {SYSTEM_FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </label>
        <label className="quantize-slider">
          <span>字体大小 <b>{options.fontSize}px</b></span>
          <input type="range" min="6" max="64" value={options.fontSize}
            onChange={(e) => setOptions((o) => ({ ...o, fontSize: Number(e.target.value) }))} />
        </label>
        <label className="quantize-slider">
          <span>阈值 <b>{options.threshold}</b></span>
          <input type="range" min="0" max="255" value={options.threshold}
            onChange={(e) => setOptions((o) => ({ ...o, threshold: Number(e.target.value) }))} />
        </label>
        <label className="quantize-slider">
          <span>边距 <b>{options.padding}</b></span>
          <input type="range" min="0" max="8" value={options.padding}
            onChange={(e) => setOptions((o) => ({ ...o, padding: Number(e.target.value) }))} />
        </label>
        <label className="quantize-select">
          <span>字色</span>
          <input type="color" value={options.color}
            onChange={(e) => setOptions((o) => ({ ...o, color: e.target.value }))} />
        </label>
        <label className="quantize-select">
          <span>背景</span>
          <input type="color" value={options.bgColor || "#000000"}
            disabled={!options.bgColor}
            onChange={(e) => setOptions((o) => ({ ...o, bgColor: e.target.value }))} />
          <label style={{ marginLeft: 8, fontSize: "0.78rem" }}>
            <input type="checkbox" checked={!!options.bgColor}
              onChange={(e) => setOptions((o) => ({ ...o, bgColor: e.target.checked ? "#000000" : null }))} />
            启用背景
          </label>
        </label>
        <label className="quantize-select">
          <span>选项</span>
          <label style={{ fontSize: "0.85rem" }}>
            <input type="checkbox" checked={options.bold}
              onChange={(e) => setOptions((o) => ({ ...o, bold: e.target.checked }))} />
            加粗
          </label>
          <label style={{ fontSize: "0.85rem", marginLeft: 12 }}>
            <input type="checkbox" checked={options.smoothing}
              onChange={(e) => setOptions((o) => ({ ...o, smoothing: e.target.checked }))} />
            抗锯齿（关闭=纯像素阈值化）
          </label>
        </label>
      </div>

      <div className="quantize-controls" style={{ gridTemplateColumns: "1fr" }}>
        <label className="quantize-select" style={{ width: "100%" }}>
          <span>字符表</span>
          <textarea
            rows={3}
            value={options.charset}
            onChange={(e) => setOptions((o) => ({ ...o, charset: e.target.value }))}
            style={{ fontFamily: "monospace", padding: 6, background: "#0f172a", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 6 }}
          />
        </label>
      </div>

      <div className="quantize-canvas-wrap">
        <span className="canvas-label">预览（点击放大）</span>
        <canvas ref={canvasRef} className="pixelated" />
      </div>
    </section>
  );
}
