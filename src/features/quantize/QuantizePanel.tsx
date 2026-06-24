import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import JSZip from "jszip";
import {
  quantizeImageData,
  quantizeImageDataWithPalette,
  replacePaletteColor,
  hexToRgba,
  loadImageToCanvas,
  defaultQuantizeOptions,
  type QuantizeOptions,
  type QuantizeResult,
  type DitheringMethod,
  type QuantizeMethod,
  type PaletteColor,
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

interface QuantizeItem {
  id: string;
  name: string;            // 文件名
  url: string;             // ObjectURL，给缩略图
  imageData: ImageData;    // 源图像素
  width: number;
  height: number;
  result: QuantizeResult | null;
}

let nextId = 1;

export function QuantizePanel() {
  const [options, setOptions] = useState<QuantizeOptions>(defaultQuantizeOptions);
  const [items, setItems] = useState<QuantizeItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [editingColor, setEditingColor] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  // 调色板锁定：以哪张图的调色板为准（null = 不锁定，每张独立量化）
  const [lockSourceId, setLockSourceId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const resultCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const debounceTimerRef = useRef<number | null>(null);
  const pendingRunRef = useRef(false);
  const itemsRef = useRef<QuantizeItem[]>([]);
  itemsRef.current = items;

  const activeItem = useMemo(() => items.find((it) => it.id === activeId) || null, [items, activeId]);

  // 加载文件 -> 推入列表
  const handleFiles = useCallback(async (files: File[]) => {
    const loaded: QuantizeItem[] = [];
    for (const file of files) {
      const url = URL.createObjectURL(file);
      try {
        const { canvas, imageData } = await loadImageToCanvas(url);
        loaded.push({
          id: `q${nextId++}`,
          name: file.name,
          url,
          imageData,
          width: canvas.width,
          height: canvas.height,
          result: null,
        });
      } catch (err) {
        console.error("加载失败", file.name, err);
      }
    }
    if (loaded.length === 0) return;
    setItems((prev) => {
      const next = [...prev, ...loaded];
      return next;
    });
    setActiveId((cur) => cur ?? loaded[0]!.id);
  }, []);

  function onPickFiles(input: FileList | null) {
    if (!input || input.length === 0) return;
    void handleFiles(Array.from(input));
  }

  function removeItem(id: string) {
    setItems((prev) => {
      const target = prev.find((it) => it.id === id);
      if (target) URL.revokeObjectURL(target.url);
      const next = prev.filter((it) => it.id !== id);
      return next;
    });
    setActiveId((cur) => {
      if (cur !== id) return cur;
      const remain = itemsRef.current.filter((it) => it.id !== id);
      return remain[0]?.id ?? null;
    });
  }

  function clearAll() {
    items.forEach((it) => URL.revokeObjectURL(it.url));
    setItems([]);
    setActiveId(null);
  }

  // 批量量化（每张挨个跑，让 UI 更新有机会）
  const runBatch = useCallback((opts: QuantizeOptions) => {
    const list = itemsRef.current;
    if (list.length === 0) return;
    if (processing) {
      pendingRunRef.current = true;
      return;
    }
    setProcessing(true);
    setProgress({ done: 0, total: list.length });

    // 锁定调色板：先确保 lock 源已量化，得到其 palette；其他图用该 palette 量化
    let lockedPalette: PaletteColor[] | null = null;
    let lockSrc: QuantizeItem | null = null;
    if (lockSourceId) {
      lockSrc = list.find((it) => it.id === lockSourceId) || null;
      if (lockSrc) {
        try {
          const seed = quantizeImageData(lockSrc.imageData, opts);
          lockedPalette = seed.palette;
          setItems((prev) => prev.map((it) => (it.id === lockSrc!.id ? { ...it, result: seed } : it)));
        } catch (err) {
          console.error("锁定源量化失败", err);
        }
      }
    }

    let i = 0;
    const step = () => {
      if (i >= list.length) {
        setProcessing(false);
        if (pendingRunRef.current) {
          pendingRunRef.current = false;
          runBatch(opts);
        }
        return;
      }
      const cur = list[i]!;
      // 锁定源已经在前面跑过了，跳过
      if (lockSrc && cur.id === lockSrc.id) {
        i++;
        setProgress({ done: i, total: list.length });
        requestAnimationFrame(() => setTimeout(step, 0));
        return;
      }
      try {
        const res = lockedPalette
          ? quantizeImageDataWithPalette(cur.imageData, opts, lockedPalette)
          : quantizeImageData(cur.imageData, opts);
        setItems((prev) => prev.map((it) => (it.id === cur.id ? { ...it, result: res } : it)));
      } catch (err) {
        console.error("量化失败", cur.name, err);
      }
      i++;
      setProgress({ done: i, total: list.length });
      // 让浏览器有机会绘制
      requestAnimationFrame(() => setTimeout(step, 0));
    };
    requestAnimationFrame(() => setTimeout(step, 0));
  }, [processing, lockSourceId]);

  // 参数 / 列表变化 -> debounced 批量
  useEffect(() => {
    if (items.length === 0) return;
    if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = window.setTimeout(() => {
      runBatch(options);
    }, 100);
    return () => {
      if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, options.colors, options.method, options.dithering, options.pixelSize, lockSourceId]);

  // 当前预览 canvas 渲染
  useEffect(() => {
    if (!activeItem || !sourceCanvasRef.current) return;
    sourceCanvasRef.current.width = activeItem.width;
    sourceCanvasRef.current.height = activeItem.height;
    const ctx = sourceCanvasRef.current.getContext("2d")!;
    ctx.putImageData(activeItem.imageData, 0, 0);
  }, [activeItem]);

  useEffect(() => {
    if (!activeItem?.result || !resultCanvasRef.current) return;
    resultCanvasRef.current.width = activeItem.result.imageData.width;
    resultCanvasRef.current.height = activeItem.result.imageData.height;
    const ctx = resultCanvasRef.current.getContext("2d")!;
    ctx.putImageData(activeItem.result.imageData, 0, 0);
  }, [activeItem?.result]);

  // 调色板手动改色：把当前活动图的第 idx 个调色板色全部替换为 hexNew
  function recolorActive(idx: number, hexNew: string) {
    if (!activeItem?.result) return;
    const old = activeItem.result.palette[idx];
    if (!old) return;
    const rgba = hexToRgba(hexNew.length === 7 ? hexNew + "ff" : hexNew);
    const newColor: PaletteColor = {
      r: rgba.r, g: rgba.g, b: rgba.b, a: rgba.a,
      hex: hexNew.length === 7 ? hexNew : hexNew,
    };
    const newImageData = replacePaletteColor(activeItem.result.imageData, old, newColor);
    const newPalette = [...activeItem.result.palette];
    newPalette[idx] = newColor;
    setItems((prev) => prev.map((it) => it.id === activeItem.id ? {
      ...it,
      result: { ...it.result!, imageData: newImageData, palette: newPalette },
    } : it));
  }

  // 单张导出
  function exportCurrent() {
    if (!activeItem?.result || !resultCanvasRef.current) return;
    const link = document.createElement("a");
    const baseName = activeItem.name.replace(/\.[^.]+$/, "");
    link.download = `${baseName}_${options.pixelSize}x_${options.colors}c.png`;
    link.href = resultCanvasRef.current.toDataURL("image/png");
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  // 批量打包导出 ZIP
  async function exportZip() {
    const ready = items.filter((it) => it.result);
    if (ready.length === 0) return;
    setExporting(true);
    try {
      const zip = new JSZip();
      // 离屏 canvas 用来生成每张 PNG blob
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      for (const it of ready) {
        const img = it.result!.imageData;
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.putImageData(img, 0, 0);
        const blob: Blob = await new Promise((resolve) =>
          canvas.toBlob((b) => resolve(b!), "image/png"),
        );
        const baseName = it.name.replace(/\.[^.]+$/, "");
        zip.file(`${baseName}_${options.pixelSize}x_${options.colors}c.png`, blob);
      }
      // 同时附一份调色板 JSON（取第一张的，或合并？这里按图各存一份）
      const meta = ready.map((it) => ({
        file: it.name,
        palette: it.result!.palette.map((c) => c.hex),
        pixelSize: options.pixelSize,
        colors: options.colors,
        method: options.method,
        dithering: options.dithering,
      }));
      zip.file("palette.json", JSON.stringify(meta, null, 2));

      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const link = document.createElement("a");
      link.href = url;
      link.download = `quantized_${ready.length}imgs_${options.pixelSize}x_${options.colors}c.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="panel quantize-panel">
      <div className="quantize-header">
        <div>
          <h3>像素量化编辑器</h3>
          <p>支持批量导入与统一参数批处理，一次导出 ZIP。</p>
        </div>
        <div className="export-actions">
          <button onClick={() => fileInputRef.current?.click()}>批量导入</button>
          <button onClick={exportCurrent} disabled={!activeItem?.result}>导出当前 PNG</button>
          <button onClick={exportZip} disabled={items.length === 0 || processing || exporting}>
            {exporting ? "打包中…" : `导出 ZIP（${items.filter((i) => i.result).length}/${items.length}）`}
          </button>
          <button onClick={clearAll} disabled={items.length === 0}>清空</button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.png,.jpg,.jpeg,.webp,.bmp"
        style={{ display: "none" }}
        onChange={(e) => { onPickFiles(e.target.files); e.currentTarget.value = ""; }}
      />

      <div className="info-box accent">
        <span>已导入：{items.length}</span>
        <span>当前：{activeItem ? `${activeItem.name} (${activeItem.width}x${activeItem.height})` : "-"}</span>
        <span>像素分辨率：{activeItem?.result ? `${activeItem.result.pixelatedWidth}x${activeItem.result.pixelatedHeight}` : "-"}</span>
        <span>调色板：{activeItem?.result ? `${activeItem.result.palette.length} 色` : "-"}</span>
        <span className={processing ? "tag busy" : "tag"}>
          {processing ? `量化中 ${progress.done}/${progress.total}` : "实时预览"}
        </span>
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

      {items.length > 0 && (
        <div className="quantize-thumbs">
          {items.map((it) => (
            <div
              key={it.id}
              className={`q-thumb ${activeId === it.id ? "active" : ""} ${it.result ? "ready" : "pending"} ${lockSourceId === it.id ? "locked" : ""}`}
              onClick={() => setActiveId(it.id)}
              title={it.name}
            >
              <img src={it.url} alt={it.name} />
              <span className="q-thumb-name">{it.name}</span>
              <button
                className="q-thumb-lock"
                title={lockSourceId === it.id ? "取消调色板锁定" : "以此图调色板为基准锁定全部"}
                onClick={(e) => { e.stopPropagation(); setLockSourceId(lockSourceId === it.id ? null : it.id); }}
              >{lockSourceId === it.id ? "🔒" : "🔓"}</button>
              <button
                className="q-thumb-remove"
                onClick={(e) => { e.stopPropagation(); removeItem(it.id); }}
              >×</button>
            </div>
          ))}
          {lockSourceId && (
            <div className="q-lock-note">
              已锁定调色板：以「{items.find((it) => it.id === lockSourceId)?.name || "?"}」为基准
            </div>
          )}
        </div>
      )}

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

      {activeItem?.result && (
        <div className="quantize-palette">
          <h4>调色板 ({activeItem.result.palette.length} 色) <small>{lockSourceId ? "锁定模式下不可改色" : "点击色块改色"}</small></h4>
          <div className="palette-grid">
            {activeItem.result.palette.map((color, i) => (
              <label
                key={i}
                className={`palette-swatch ${editingColor === i ? "editing" : ""}`}
                style={{ backgroundColor: color.hex }}
                title={lockSourceId ? "锁定模式下禁用改色" : `${color.hex} - 点击改色`}
                onClick={() => setEditingColor(editingColor === i ? null : i)}
              >
                {!lockSourceId && (
                  <input
                    type="color"
                    value={color.hex.length === 7 ? color.hex : color.hex.slice(0, 7)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => recolorActive(i, e.target.value)}
                  />
                )}
                {editingColor === i && <span className="swatch-hex">{color.hex}</span>}
              </label>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
