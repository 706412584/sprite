import { useState, useCallback, useRef } from "react";
import { useAppState, useAppActions, atomicKeyingModes, updateNumber } from "@/state/AppContext";
import { ToggleField } from "@/components/ui/ToggleField";
import type { AtomicKeyingMode, ProcessSettings } from "@/types/sprite";

interface SettingsPanelProps {
  title?: string;
  showActions?: boolean;
}

export function SettingsPanel({ title = "抠图模式与参数", showActions = true }: SettingsPanelProps = {}) {
  const { settings, modelStatuses, modelCacheDir, busy } = useAppState();
  const { setSettings, runPreview, runProcess } = useAppActions();

  const pipeline = settings.matte_pipeline ?? [];
  const usesBirefNet = pipeline.includes("birefnet");
  const usesLuma = pipeline.includes("luma");
  const usesChroma = pipeline.includes("chroma") || pipeline.includes("corridorkey");
  const usesSpriteflow = pipeline.includes("spriteflow");
  const usesKeyColor = usesChroma || usesSpriteflow;
  const selectedModelStatus = modelStatuses.find((m) => m.key === settings.ai_model);

  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const dragRef = useRef<number | null>(null);

  const toggleMode = useCallback((mode: AtomicKeyingMode) => {
    setSettings((c) => {
      const cur = c.matte_pipeline ?? [];
      const next = cur.includes(mode) ? cur.filter((m) => m !== mode) : [...cur, mode];
      return { ...c, matte_pipeline: next, matte_mode: next[0] ?? "none" };
    });
  }, [setSettings]);

  const removeFromPipeline = useCallback((idx: number) => {
    setSettings((c) => {
      const next = [...(c.matte_pipeline ?? [])];
      next.splice(idx, 1);
      return { ...c, matte_pipeline: next, matte_mode: next[0] ?? "none" };
    });
  }, [setSettings]);

  const clearPipeline = useCallback(() => {
    setSettings((c) => ({ ...c, matte_pipeline: [], matte_mode: "none" }));
  }, [setSettings]);

  const onDragStart = useCallback((idx: number) => {
    dragRef.current = idx;
    setDragIdx(idx);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setOverIdx(idx);
  }, []);

  const onDrop = useCallback((idx: number) => {
    const from = dragRef.current;
    if (from === null || from === idx) { setDragIdx(null); setOverIdx(null); return; }
    setSettings((c) => {
      const arr = [...(c.matte_pipeline ?? [])];
      const [item] = arr.splice(from, 1);
      arr.splice(idx, 0, item);
      return { ...c, matte_pipeline: arr, matte_mode: arr[0] ?? "none" };
    });
    setDragIdx(null);
    setOverIdx(null);
  }, [setSettings]);

  const onDragEnd = useCallback(() => { setDragIdx(null); setOverIdx(null); }, []);

  function applyLumaPreset(preset: "soft" | "balanced" | "strong") {
    const presets = {
      soft: { luma_black: 12, luma_white: 245, luma_gamma: 1.15, luma_strength: 0.75 },
      balanced: { luma_black: 24, luma_white: 230, luma_gamma: 1, luma_strength: 1 },
      strong: { luma_black: 48, luma_white: 210, luma_gamma: 0.85, luma_strength: 1.25 },
    };
    setSettings((c) => ({ ...c, ...presets[preset] }));
  }

  return (
    <section className="panel">
      <h3>{title}</h3>

      {/* 抠图管线多选 */}
      <div className="pipeline-grid">
        {atomicKeyingModes.map((mode) => (
          <label key={mode.value} className={pipeline.includes(mode.value) ? "active" : ""} title={mode.description}>
            <input type="checkbox" checked={pipeline.includes(mode.value)} onChange={() => toggleMode(mode.value)} />
            <span>{mode.label}</span>
          </label>
        ))}
        <button type="button" className="pipeline-none-btn" onClick={clearPipeline} title="清空管线，不抠图">
          清空（不抠图）
        </button>
      </div>

      {pipeline.length > 0 && (
        <div className="pipeline-order">
          <span className="pipeline-order-label">执行顺序（拖拽排序，各模式 alpha 合并）：</span>
          {pipeline.map((mode, idx) => {
            const info = atomicKeyingModes.find((m) => m.value === mode);
            return (
              <div
                key={mode}
                className={`pipeline-item${dragIdx === idx ? " dragging" : ""}${overIdx === idx ? " drag-over" : ""}`}
                draggable
                onDragStart={() => onDragStart(idx)}
                onDragOver={(e) => onDragOver(e, idx)}
                onDrop={() => onDrop(idx)}
                onDragEnd={onDragEnd}
              >
                <span className="drag-handle">⠿</span>
                <span className="pipe-label">{idx + 1}. {info?.label ?? mode}</span>
                <button type="button" className="pipe-remove" onClick={() => removeFromPipeline(idx)}>×</button>
              </div>
            );
          })}
        </div>
      )}

      {pipeline.length === 0 && (
        <p className="pipeline-empty">未选择抠图模式，将直接使用原图（不去底）。</p>
      )}

      {/* 基础参数 */}
      <div className="settings-grid">
        <label>
          AI 模型
          <select value={settings.ai_model} disabled={!usesBirefNet}
            onChange={(e) => setSettings((c) => ({ ...c, ai_model: e.target.value }))}>
            <option value="birefnet-hr-matting">BiRefNet HR Matting</option>
            <option value="birefnet-lite-2k">BiRefNet Lite 2K</option>
            <option value="birefnet-general">BiRefNet General</option>
          </select>
        </label>
        <label>
          运行设备
          <select value={settings.ai_device} disabled={!usesBirefNet}
            onChange={(e) => setSettings((c) => ({ ...c, ai_device: e.target.value as ProcessSettings["ai_device"] }))}>
            <option value="auto">Auto</option>
            <option value="cuda">CUDA</option>
            <option value="cpu">CPU</option>
          </select>
        </label>
        <label>
          输出尺寸
          <input type="number" min="32" value={settings.target_size}
            onChange={(e) => setSettings((c) => ({ ...c, target_size: updateNumber(e.target.value, c.target_size) }))} />
        </label>
        <label>
          每 N 帧保留
          <input type="number" min="1" value={settings.keep_every}
            onChange={(e) => setSettings((c) => ({ ...c, keep_every: updateNumber(e.target.value, c.keep_every) }))} />
        </label>
      </div>

      {/* 时间与画布参数 */}
      <div className="settings-grid">
        <label>
          开始时间
          <input type="number" min="0" step="0.1" value={settings.start_time}
            onChange={(e) => setSettings((c) => ({ ...c, start_time: updateNumber(e.target.value, c.start_time) }))} />
        </label>
        <label>
          结束时间
          <input type="number" min="0" step="0.1" value={settings.end_time}
            onChange={(e) => setSettings((c) => ({ ...c, end_time: updateNumber(e.target.value, c.end_time) }))} />
        </label>
        <label>
          画布边距 (px)
          <input type="number" min="0" value={settings.reduce_px}
            onChange={(e) => setSettings((c) => ({ ...c, reduce_px: updateNumber(e.target.value, c.reduce_px) }))} />
        </label>
        <label>
          光晕像素
          <input type="number" min="0" value={settings.halo_pixels}
            onChange={(e) => setSettings((c) => ({ ...c, halo_pixels: updateNumber(e.target.value, c.halo_pixels) }))} />
        </label>
        <label>
          边缘去污
          <input type="checkbox" checked={settings.decontaminate_enabled}
            onChange={(e) => setSettings((c) => ({ ...c, decontaminate_enabled: e.target.checked }))} />
        </label>
        <label>
          去污半径
          <input type="number" min="1" max="8" value={settings.decontaminate_radius}
            onChange={(e) => setSettings((c) => ({ ...c, decontaminate_radius: updateNumber(e.target.value, c.decontaminate_radius) }))} />
        </label>
        <label>
          去污强度
          <input type="number" min="0" max="1" step="0.1" value={settings.decontaminate_strength}
            onChange={(e) => setSettings((c) => ({ ...c, decontaminate_strength: updateNumber(e.target.value, c.decontaminate_strength) }))} />
        </label>
        <label>
          特效保护
          <input type="checkbox" checked={settings.effect_protection_enabled}
            onChange={(e) => setSettings((c) => ({ ...c, effect_protection_enabled: e.target.checked }))} />
        </label>
        <label>
          亮度阈值
          <input type="number" min="0" max="255" value={settings.effect_protection_threshold}
            onChange={(e) => setSettings((c) => ({ ...c, effect_protection_threshold: updateNumber(e.target.value, c.effect_protection_threshold) }))} />
        </label>
      </div>

      {/* 高级参数 */}
      <div className="settings-grid advanced-grid">
        <label>
          画布模式
          <select value={settings.canvas_mode}
            onChange={(e) => setSettings((c) => ({ ...c, canvas_mode: e.target.value as ProcessSettings["canvas_mode"] }))}>
            <option value="auto">Auto</option>
            <option value="square_bottom">方形底部对齐</option>
            <option value="square_center">方形居中</option>
          </select>
        </label>
        <label>
          Key 模式
          <select value={settings.key_mode} disabled={!usesKeyColor}
            onChange={(e) => setSettings((c) => ({ ...c, key_mode: e.target.value as ProcessSettings["key_mode"] }))}>
            <option value="auto">自动取色</option>
            <option value="manual">手动颜色</option>
          </select>
        </label>
        <label>
          手动 Key 色
          <input type="color" value={settings.manual_key_hex} disabled={!usesKeyColor || settings.key_mode !== "manual"}
            onChange={(e) => setSettings((c) => ({ ...c, manual_key_hex: e.target.value }))} />
        </label>
        <label>
          阈值
          <input type="number" min="0" value={settings.threshold} disabled={!usesChroma}
            onChange={(e) => setSettings((c) => ({ ...c, threshold: updateNumber(e.target.value, c.threshold) }))} />
        </label>
        <label>
          柔边
          <input type="number" min="0" value={settings.softness} disabled={!usesChroma}
            onChange={(e) => setSettings((c) => ({ ...c, softness: updateNumber(e.target.value, c.softness) }))} />
        </label>
        <label>
          Despill
          <input type="number" min="0" max="2" step="0.05" value={settings.despill_strength} disabled={!usesChroma}
            onChange={(e) => setSettings((c) => ({ ...c, despill_strength: updateNumber(e.target.value, c.despill_strength) }))} />
        </label>
        <label>
          Luma 黑场
          <input type="number" min="0" max="254" value={settings.luma_black} disabled={!usesLuma}
            onChange={(e) => setSettings((c) => ({ ...c, luma_black: updateNumber(e.target.value, c.luma_black) }))} />
        </label>
        <label>
          Luma 白场
          <input type="number" min="1" max="255" value={settings.luma_white} disabled={!usesLuma}
            onChange={(e) => setSettings((c) => ({ ...c, luma_white: updateNumber(e.target.value, c.luma_white) }))} />
        </label>
        <label>
          Luma Gamma
          <input type="number" min="0.05" step="0.05" value={settings.luma_gamma} disabled={!usesLuma}
            onChange={(e) => setSettings((c) => ({ ...c, luma_gamma: updateNumber(e.target.value, c.luma_gamma) }))} />
        </label>
        <label>
          Luma 强度
          <input type="number" min="0" max="2" step="0.05" value={settings.luma_strength} disabled={!usesLuma}
            onChange={(e) => setSettings((c) => ({ ...c, luma_strength: updateNumber(e.target.value, c.luma_strength) }))} />
        </label>
        <label>
          AI 分辨率
          <input type="number" min="256" step="64" value={settings.ai_resolution} disabled={!usesBirefNet}
            onChange={(e) => setSettings((c) => ({ ...c, ai_resolution: updateNumber(e.target.value, c.ai_resolution) }))} />
        </label>
        <label>
          CorridorKey 屏幕
          <select value={settings.corridorkey_screen} disabled={!pipeline.includes("corridorkey")}
            onChange={(e) => setSettings((c) => ({ ...c, corridorkey_screen: e.target.value as ProcessSettings["corridorkey_screen"] }))}>
            <option value="auto">Auto</option>
            <option value="green">Green</option>
            <option value="blue">Blue</option>
          </select>
        </label>
      </div>

      {usesSpriteflow && (
        <div className="settings-grid advanced-grid">
          <label>
            SF 容差
            <input type="number" min="1" max="441" value={settings.sf_tolerance}
              onChange={(e) => setSettings((c) => ({ ...c, sf_tolerance: Math.max(1, Math.min(441, updateNumber(e.target.value, c.sf_tolerance))) }))} />
          </label>
          <label>
            SF 混合区比例
            <input type="number" min="0.05" max="0.95" step="0.05" value={settings.sf_blend_zone_ratio}
              onChange={(e) => setSettings((c) => ({ ...c, sf_blend_zone_ratio: Math.max(0.05, Math.min(0.95, updateNumber(e.target.value, c.sf_blend_zone_ratio))) }))} />
          </label>
          <label>
            SF Alpha 截断
            <input type="number" min="0" max="255" value={settings.sf_alpha_cutoff}
              onChange={(e) => setSettings((c) => ({ ...c, sf_alpha_cutoff: Math.max(0, Math.min(255, updateNumber(e.target.value, c.sf_alpha_cutoff))) }))} />
          </label>
          <label>
            SF 溢色强度
            <input type="number" min="0" max="1" step="0.05" value={settings.sf_spill_strength}
              onChange={(e) => setSettings((c) => ({ ...c, sf_spill_strength: Math.max(0, Math.min(1, updateNumber(e.target.value, c.sf_spill_strength))) }))} />
          </label>
          <ToggleField label="SF 边缘混合（渐变软边）" checked={settings.sf_edge_blend}
            onChange={(v) => setSettings((c) => ({ ...c, sf_edge_blend: v }))} />
          <ToggleField label="SF 去除边缘溢色" checked={settings.sf_spill_removal}
            onChange={(v) => setSettings((c) => ({ ...c, sf_spill_removal: v }))} />
        </div>
      )}

      {usesLuma && (
        <div className="log-tabs">
          <button onClick={() => applyLumaPreset("soft")}>Luma 柔和</button>
          <button onClick={() => applyLumaPreset("balanced")}>Luma 平衡</button>
          <button onClick={() => applyLumaPreset("strong")}>Luma 强力</button>
        </div>
      )}

      {/* 开关选项 */}
      <div className="toggle-grid">
        <ToggleField label="启用 Chroma Key" checked={settings.chroma_enabled}
          onChange={(v) => setSettings((c) => ({ ...c, chroma_enabled: v }))} />
        <ToggleField label="启用 CorridorKey" checked={settings.corridorkey_enabled}
          onChange={(v) => setSettings((c) => ({ ...c, corridorkey_enabled: v }))} />
        <ToggleField label="批处理绿转黑" checked={settings.batch_green_to_black}
          onChange={(v) => setSettings((c) => ({ ...c, batch_green_to_black: v }))} />
        <ToggleField label="半透明转黑" checked={settings.batch_semitransparent_to_black}
          onChange={(v) => setSettings((c) => ({ ...c, batch_semitransparent_to_black: v }))} />
        <ToggleField label="半透明转不透明" checked={settings.batch_semitransparent_to_opaque}
          onChange={(v) => setSettings((c) => ({ ...c, batch_semitransparent_to_opaque: v }))} />
      </div>

      {/* 模型状态 */}
      <div className="model-status-card">
        <strong>抠图模型状态</strong>
        <span>当前模型：{selectedModelStatus?.label || settings.ai_model}</span>
        <span>下载：{selectedModelStatus ? (selectedModelStatus.cached ? "已缓存" : "未下载，首次使用时自动下载") : "等待服务响应"}</span>
        <span>加载：{selectedModelStatus?.loaded ? "已加载" : "未加载"}</span>
        {modelCacheDir && <span>缓存目录：{modelCacheDir}</span>}
      </div>

      {/* 操作按钮 */}
      {showActions && (
        <div className="process-cta">
          <button onClick={runPreview} disabled={busy || !settings.upload_id}>预览一帧</button>
          <button onClick={runProcess} disabled={busy || !settings.upload_id}>批量处理</button>
        </div>
      )}
    </section>
  );
}
