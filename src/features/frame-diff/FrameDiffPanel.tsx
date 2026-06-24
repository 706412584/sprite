import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  diffImage,
  loadImageDataFromFile,
  type FrameDiffMetrics,
} from "./frameDiff";

interface Frame {
  id: string;
  name: string;
  data: ImageData;
  url: string;
}

interface DiffEntry {
  index: number;       // 第 index 帧 vs 第 index+1 帧
  metrics: FrameDiffMetrics;
}

let nextId = 1;

export function FrameDiffPanel() {
  const [frames, setFrames] = useState<Frame[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [diffs, setDiffs] = useState<DiffEntry[]>([]);
  const [running, setRunning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const heatmapCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const handleFiles = useCallback(async (files: File[]) => {
    // 按文件名排序
    files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    const loaded: Frame[] = [];
    for (const f of files) {
      try {
        const { data, name } = await loadImageDataFromFile(f);
        loaded.push({ id: `f${nextId++}`, name, data, url: URL.createObjectURL(f) });
      } catch (err) {
        console.error("加载失败", f.name, err);
      }
    }
    setFrames((prev) => [...prev, ...loaded]);
  }, []);

  function clearAll() {
    frames.forEach((f) => URL.revokeObjectURL(f.url));
    setFrames([]);
    setDiffs([]);
    setActiveIdx(0);
  }

  // 计算所有相邻帧的 diff metrics
  useEffect(() => {
    if (frames.length < 2) {
      setDiffs([]);
      return;
    }
    setRunning(true);
    const id = setTimeout(() => {
      try {
        const list: DiffEntry[] = [];
        for (let i = 0; i < frames.length - 1; i++) {
          const a = frames[i]!;
          const b = frames[i + 1]!;
          if (a.data.width !== b.data.width || a.data.height !== b.data.height) {
            list.push({ index: i, metrics: { mad: -1, changedRatio: -1 } });
            continue;
          }
          const { metrics } = diffImage(a.data, b.data);
          list.push({ index: i, metrics });
        }
        setDiffs(list);
      } finally {
        setRunning(false);
      }
    }, 50);
    return () => clearTimeout(id);
  }, [frames]);

  // 渲染当前选中帧 vs 下一帧的热力图
  useEffect(() => {
    if (frames.length < 2 || !heatmapCanvasRef.current) return;
    const a = frames[activeIdx];
    const b = frames[activeIdx + 1] || frames[activeIdx - 1];
    if (!a || !b) return;
    if (a.data.width !== b.data.width || a.data.height !== b.data.height) return;
    const { data } = diffImage(a.data, b.data);
    const c = heatmapCanvasRef.current;
    c.width = data.width;
    c.height = data.height;
    c.getContext("2d")!.putImageData(data, 0, 0);
  }, [frames, activeIdx]);

  const stats = useMemo(() => {
    if (diffs.length === 0) return null;
    const valid = diffs.filter((d) => d.metrics.mad >= 0);
    if (valid.length === 0) return null;
    const mads = valid.map((d) => d.metrics.mad);
    const mean = mads.reduce((s, v) => s + v, 0) / mads.length;
    const sd = Math.sqrt(mads.map((v) => (v - mean) ** 2).reduce((s, v) => s + v, 0) / mads.length);
    return { mean, sd, valid: valid.length, total: diffs.length };
  }, [diffs]);

  // 跳变阈值：mean + 2*sd 视为异常
  const jumpThreshold = stats ? stats.mean + 2 * stats.sd : 0;

  // 折线图：在 SVG 上画
  const chartW = 800;
  const chartH = 120;
  const maxMad = useMemo(() => {
    if (diffs.length === 0) return 1;
    return Math.max(1, ...diffs.filter((d) => d.metrics.mad >= 0).map((d) => d.metrics.mad));
  }, [diffs]);

  const polyline = diffs.map((d, i) => {
    const x = (i / Math.max(1, diffs.length - 1)) * chartW;
    const y = chartH - (d.metrics.mad / maxMad) * (chartH - 10) - 5;
    return `${x},${y}`;
  }).join(" ");

  return (
    <section className="panel frame-diff-panel">
      <div className="quantize-header">
        <div>
          <h3>帧间差异 / 质量检查</h3>
          <p>导入帧序列，相邻帧绝对差热力图 + 跳变分数曲线，定位 AI 生成的异常帧。</p>
        </div>
        <div className="export-actions">
          <button onClick={() => fileInputRef.current?.click()}>导入帧</button>
          <button onClick={clearAll} disabled={frames.length === 0}>清空</button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.png,.jpg,.jpeg,.webp"
        style={{ display: "none" }}
        onChange={(e) => { void handleFiles(Array.from(e.target.files || [])); e.currentTarget.value = ""; }}
      />

      <div className="info-box accent">
        <span>已导入：{frames.length} 帧</span>
        <span>{stats ? `平均差: ${stats.mean.toFixed(2)}, σ: ${stats.sd.toFixed(2)}` : "至少需要 2 帧"}</span>
        <span>{stats ? `跳变阈值: ${jumpThreshold.toFixed(2)}` : "-"}</span>
        <span className={running ? "tag busy" : "tag"}>{running ? "计算中…" : "就绪"}</span>
      </div>

      {diffs.length > 0 && (
        <div className="frame-diff-chart">
          <svg width="100%" height={chartH + 30} viewBox={`0 0 ${chartW} ${chartH + 30}`}>
            {/* 跳变阈值线 */}
            {stats && (
              <line
                x1="0"
                y1={chartH - (jumpThreshold / maxMad) * (chartH - 10) - 5}
                x2={chartW}
                y2={chartH - (jumpThreshold / maxMad) * (chartH - 10) - 5}
                stroke="#f87171"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
            )}
            <polyline points={polyline} fill="none" stroke="#818cf8" strokeWidth="1.5" />
            {/* 异常帧标记 */}
            {diffs.map((d, i) => {
              if (d.metrics.mad < 0 || d.metrics.mad < jumpThreshold) return null;
              const x = (i / Math.max(1, diffs.length - 1)) * chartW;
              const y = chartH - (d.metrics.mad / maxMad) * (chartH - 10) - 5;
              return (
                <circle
                  key={i}
                  cx={x}
                  cy={y}
                  r="4"
                  fill="#f87171"
                  style={{ cursor: "pointer" }}
                  onClick={() => setActiveIdx(d.index)}
                >
                  <title>帧 {d.index} -&gt; {d.index + 1}: MAD {d.metrics.mad.toFixed(2)}</title>
                </circle>
              );
            })}
            {/* X 轴说明 */}
            <text x="0" y={chartH + 18} fill="#94a3b8" fontSize="10">帧 0</text>
            <text x={chartW - 30} y={chartH + 18} fill="#94a3b8" fontSize="10">帧 {frames.length - 1}</text>
          </svg>
        </div>
      )}

      {frames.length > 0 && (
        <div className="quantize-thumbs frame-diff-thumbs">
          {frames.map((f, i) => {
            const d = diffs[i];
            const isJump = d && stats && d.metrics.mad >= jumpThreshold;
            return (
              <div
                key={f.id}
                className={`q-thumb ${activeIdx === i ? "active" : ""} ${isJump ? "jumpy" : ""}`}
                onClick={() => setActiveIdx(i)}
                title={`${f.name}${d ? ` MAD ${d.metrics.mad.toFixed(2)}` : ""}`}
              >
                <img src={f.url} alt={f.name} />
                <span className="q-thumb-name">{i}: {f.name}</span>
                {d && d.metrics.mad >= 0 && (
                  <span className="frame-diff-mad" style={{ color: isJump ? "#f87171" : "#94a3b8" }}>
                    MAD {d.metrics.mad.toFixed(1)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {frames.length >= 2 && (
        <div className="quantize-canvas-wrap">
          <span className="canvas-label">差异热力图：帧 {activeIdx} ↔ 帧 {Math.min(frames.length - 1, activeIdx + 1)}</span>
          <canvas ref={heatmapCanvasRef} className="pixelated" />
        </div>
      )}
    </section>
  );
}
