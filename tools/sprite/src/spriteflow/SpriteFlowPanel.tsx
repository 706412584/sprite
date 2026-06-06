import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { getDesktopSettingsSnapshot } from "@/settings/runtimeSettings";
import { generateSpriteSheet, listImageModels, rewriteSpritePromptDraft } from "./spriteFlowClient";
import { composeSpriteSheet, keyOutBackground, sliceSpriteSheet, type SheetDiagnostic } from "./slicer";
import { MattingRefineModal } from "./MattingRefineModal";
import {
  DEFAULT_ACTIONS,
  GRID_CONFIGS,
  KEYING_COLORS,
  SPRITE_DIRECTIONS,
  getGridMetrics,
  parseGridConfig,
  serializeGridConfig,
  type GridConfig,
  type SpriteDirection,
  type SpriteFlowAction,
  type SpriteFlowGenerateResult,
} from "./types";

const STATE_KEY = "layout-editor-spriteflow-state-v2";
const SETTINGS_KEY = "layout-editor-spriteflow-api-settings-v1";
const DEFAULT_IMAGE_MODEL = "gemini-2.5-flash-image-preview";

const cardStyle: CSSProperties = {
  border: "1px solid #343842",
  borderRadius: 12,
  background: "linear-gradient(180deg,#202226,#191b1f)",
  padding: 12,
};

const labelStyle: CSSProperties = {
  fontSize: 12,
  color: "#aab0bc",
  marginBottom: 5,
};

const inputStyle: CSSProperties = {
  width: "100%",
  border: "1px solid #3a3f4a",
  borderRadius: 8,
  background: "#101215",
  color: "#e5e7eb",
  padding: "8px 10px",
  fontSize: 13,
  boxSizing: "border-box",
};

const textareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: 104,
  resize: "vertical",
  fontFamily: "inherit",
};

const buttonStyle: CSSProperties = {
  border: "1px solid #3a3f4a",
  borderRadius: 8,
  padding: "8px 12px",
  background: "#242830",
  color: "#e5e7eb",
  cursor: "pointer",
  fontSize: 13,
};

const primaryStyle: CSSProperties = {
  ...buttonStyle,
  border: "1px solid #2f8bd8",
  background: "linear-gradient(135deg,#1976bd,#0e639c)",
  color: "#ffffff",
};

type StepKey = "prompt" | "grid" | "model" | "keying" | "result";

const STEP_DEFS: ReadonlyArray<{ key: StepKey; label: string }> = [
  { key: "prompt", label: "角色提示词" },
  { key: "grid", label: "网格与动作" },
  { key: "model", label: "模型与尺寸" },
  { key: "keying", label: "色键去背景" },
  { key: "result", label: "结果与预览" },
];

const STEP_PROGRESS: Record<StepKey, number> = {
  prompt: 8,
  grid: 30,
  model: 55,
  keying: 80,
  result: 100,
};

function computeActiveStep(input: {
  hasResult: boolean;
  hasKeyedSheet: boolean;
  hasImageModel: boolean;
  hasActions: boolean;
}): StepKey {
  if (input.hasResult) return "result";
  if (input.hasKeyedSheet) return "keying";
  if (input.hasImageModel) return "model";
  if (input.hasActions) return "grid";
  return "prompt";
}

interface PersistedState {
  prompt: string;
  gridConfigStr: string;
  selectedActionIds: string[];
  direction: SpriteDirection;
  imageModel: string;
  chatModel: string;
  size: string;
  transparentBackground: boolean;
  previewBackground: string;
  globalBackgroundPrompt: string;
  rewrittenPrompt: string;
  rowSliceMode: "content-band" | "full-grid";
  autoKey: boolean;
  keyingColorId: string;
  keyingTolerance: number;
  keyingEdgeBlend: boolean;
  keyingBlendZoneRatio: number;
  keyingAlphaCutoff: number;
  keyingSpillRemoval: boolean;
  keyingSpillStrength: number;
  showAdvanced: boolean;
}

interface SpriteFlowApiSettings {
  provider: "openai" | "fal";
  openai: {
    baseUrl: string;
    apiKey: string;
    imageModel: string;
    chatModel: string;
    timeoutMs: number;
  };
  fal: {
    apiKey: string;
    imageEndpoint: string;
    editEndpoint: string;
    rewriteEndpoint: string;
    rewriteModel: string;
    removeBgEndpoint: string;
  };
}

const DEFAULT_STATE: PersistedState = {
  prompt: "",
  gridConfigStr: "row:8",
  selectedActionIds: ["walk"],
  direction: "right",
  imageModel: DEFAULT_IMAGE_MODEL,
  chatModel: "",
  size: "1024x1024",
  transparentBackground: true,
  previewBackground: "#0d0f12",
  globalBackgroundPrompt: "",
  rewrittenPrompt: "",
  rowSliceMode: "content-band",
  autoKey: false,
  keyingColorId: "green",
  keyingTolerance: 110,
  keyingEdgeBlend: true,
  keyingBlendZoneRatio: 0.6,
  keyingAlphaCutoff: 8,
  keyingSpillRemoval: true,
  keyingSpillStrength: 0.45,
  showAdvanced: false,
};

const DEFAULT_API_SETTINGS: SpriteFlowApiSettings = {
  provider: "openai",
  openai: {
    baseUrl: "",
    apiKey: "",
    imageModel: "",
    chatModel: "",
    timeoutMs: 600000,
  },
  fal: {
    apiKey: "",
    imageEndpoint: "fal-ai/nano-banana-2",
    editEndpoint: "fal-ai/nano-banana-pro/edit",
    rewriteEndpoint: "openrouter/router",
    rewriteModel: "openai/gpt-4o-mini",
    removeBgEndpoint: "fal-ai/bria/background/remove",
  },
};

function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      ...DEFAULT_STATE,
      ...parsed,
      gridConfigStr: typeof parsed.gridConfigStr === "string" ? parsed.gridConfigStr : DEFAULT_STATE.gridConfigStr,
      selectedActionIds: Array.isArray(parsed.selectedActionIds) ? parsed.selectedActionIds : DEFAULT_STATE.selectedActionIds,
      direction: SPRITE_DIRECTIONS.some((item) => item.id === parsed.direction) ? (parsed.direction as SpriteDirection) : DEFAULT_STATE.direction,
      keyingTolerance: typeof parsed.keyingTolerance === "number" ? parsed.keyingTolerance : DEFAULT_STATE.keyingTolerance,
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function saveState(state: PersistedState) {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

function loadSpriteFlowApiSettings(): SpriteFlowApiSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_API_SETTINGS, openai: { ...DEFAULT_API_SETTINGS.openai }, fal: { ...DEFAULT_API_SETTINGS.fal } };
    const parsed = JSON.parse(raw) as Partial<SpriteFlowApiSettings>;
    const openai = { ...DEFAULT_API_SETTINGS.openai, ...(parsed.openai || {}) };
    // Older SpriteFlow builds stored the built-in Gemini model as a local API default.
    // Treat that value as unset so fetched/selected models (for example gpt-image-2)
    // are not shadowed by a stale local default.
    if (openai.imageModel === DEFAULT_IMAGE_MODEL) openai.imageModel = "";
    return {
      provider: parsed.provider === "fal" ? "fal" : "openai",
      openai,
      fal: { ...DEFAULT_API_SETTINGS.fal, ...(parsed.fal || {}) },
    };
  } catch {
    return { ...DEFAULT_API_SETTINGS, openai: { ...DEFAULT_API_SETTINGS.openai }, fal: { ...DEFAULT_API_SETTINGS.fal } };
  }
}

function saveSpriteFlowApiSettings(settings: SpriteFlowApiSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}

function normalizeCssColor(value: string, fallback = "#0d0f12"): string {
  const trimmed = value.trim();
  return /^#[0-9a-f]{6}$/i.test(trimmed) ? trimmed : fallback;
}

function getSliceOptions(config: GridConfig, rowSliceMode: PersistedState["rowSliceMode"]) {
  return { rowSliceMode: config.layout === "square" ? "full-grid" as const : rowSliceMode };
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error("读取文件失败"));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

function makeResultWithFrames(result: SpriteFlowGenerateResult, frames: string[], sheetDataUrl: string): SpriteFlowGenerateResult {
  return {
    ...result,
    frames,
    sheetDataUrl,
    metadata: { ...result.metadata, frameCount: frames.length },
  };
}

function imageModelPriority(id: string): number {
  const normalized = id.toLowerCase();
  if (/^gpt[-_]?image[-_]?2(?:\.|$|-|_)?/.test(normalized) || /gpt.*image.*2/.test(normalized)) return 100;
  if (/^gpt[-_]?image/.test(normalized) || /gpt.*image/.test(normalized)) return 90;
  if (/dall[-_]?e|dalle/.test(normalized)) return 80;
  if (/imagen|seedream|wan|kolors|cogview/.test(normalized)) return 70;
  if (/gemini.*image|nano[-_]?banana/.test(normalized)) return 60;
  if (/flux|stable[-_]?diffusion|sd[\-_]?\d/.test(normalized)) return 50;
  if (/image|img|vision/.test(normalized)) return 40;
  return 0;
}

function sortImageModels(ids: string[]): string[] {
  return Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean))).sort((a, b) => {
    const priorityDelta = imageModelPriority(b) - imageModelPriority(a);
    return priorityDelta || a.localeCompare(b);
  });
}

function pickPreferredImageModel(ids: string[]): string | null {
  return sortImageModels(ids).find((id) => imageModelPriority(id) > 0) || ids[0] || null;
}

function isGptImage2Model(model: string): boolean {
  const normalized = model.toLowerCase();
  return /^gpt[-_]?image[-_]?2(?:\.|$|-|_)?/.test(normalized) || /gpt.*image.*2/.test(normalized);
}

function prefersAutoSize(model: string): boolean {
  const normalized = model.toLowerCase();
  return !isGptImage2Model(model) && (/^gpt[-_]?image/i.test(normalized) || /gpt.*image/i.test(normalized));
}

function parseImageSize(size: string): { width: number; height: number } | null {
  const match = /^(\d+)x(\d+)$/i.exec(size.trim());
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  return { width, height };
}

function validateGptImage2Size(size: string): string | null {
  const parsed = parseImageSize(size);
  if (!parsed) return "尺寸必须使用 宽x高 格式，例如 1024x1024。";
  const { width, height } = parsed;
  if (width % 16 !== 0 || height % 16 !== 0) return "gpt-image-2.0 要求宽高都必须是 16 的倍数。";
  if (Math.max(width, height) > 3840) return "gpt-image-2.0 要求最大边长不能超过 3840px。";
  const ratio = Math.max(width, height) / Math.max(1, Math.min(width, height));
  if (ratio > 3) return "gpt-image-2.0 要求宽高比例不能超过 3:1。";
  const pixels = width * height;
  if (pixels < 655360) return "gpt-image-2.0 要求总像素不少于 655360。";
  if (pixels > 8294400) return "gpt-image-2.0 要求总像素不超过 8294400。";
  return null;
}

function supportsExplicitSizeForModel(model: string, size: string): boolean {
  const selected = (size || "").trim();
  if (!selected || selected === "auto") return true;
  if (isGptImage2Model(model)) {
    return validateGptImage2Size(selected) === null;
  }
  if (prefersAutoSize(model)) return ["auto", "1024x1024", "1536x1024", "1024x1536"].includes(selected);
  return ["256x256", "512x512", "1024x1024", "1792x1024", "1024x1792"].includes(selected);
}

function buildSizePromptHint(model: string, requestedSize: string, apiSize: string): string | undefined {
  const selected = (requestedSize || "").trim();
  if (!selected || selected === "auto") return undefined;
  const parsed = parseImageSize(selected);
  const base = parsed
    ? `Target canvas: ${parsed.width}x${parsed.height} pixels. Keep the final image as close as possible to this exact width and height.`
    : `Target canvas size requested by the user: ${selected}.`;
  const constraints = isGptImage2Model(model)
    ? "For gpt-image-2.0 compatibility, width and height should be multiples of 16, the longest side must be at most 3840 px, aspect ratio must not exceed 3:1, and total pixels should be between 655360 and 8294400."
    : "Keep the requested canvas size and aspect ratio whenever the model allows it.";
  const fallback = apiSize === "auto" ? "The API size parameter is set to auto because the requested size may not be accepted directly; still follow the target canvas requirement in the image content." : "";
  return [base, constraints, fallback].filter(Boolean).join(" ");
}

function resolveSizeForRequest(model: string, requestedSize: string): { apiSize: string; promptHint?: string; warning?: string } {
  const selected = (requestedSize || "").trim() || "1024x1024";
  if (selected === "auto") return { apiSize: "auto" };
  if (supportsExplicitSizeForModel(model, selected)) {
    return { apiSize: selected, promptHint: buildSizePromptHint(model, selected, selected) };
  }
  const warning = isGptImage2Model(model) && validateGptImage2Size(selected)
    ? `当前尺寸 ${selected} 不满足 gpt-image-2.0 的直接 size 参数限制，已改用 API size=auto，并把目标尺寸写入提示词。`
    : `当前模型可能不支持直接传入尺寸 ${selected}，已改用 API size=auto，并把目标尺寸写入提示词。`;
  return { apiSize: "auto", promptHint: buildSizePromptHint(model, selected, "auto"), warning };
}

interface FramePreviewProps {
  frames: string[];
  frameWidth: number;
  frameHeight: number;
  previewBackground?: string;
  diagnostic?: SheetDiagnostic | null;
  onRegenerateFrame?: (index: number) => void;
  onDownloadFrame?: (index: number) => void;
  busy?: boolean;
}

function FramePreview({ frames, frameWidth, frameHeight, previewBackground, diagnostic, onRegenerateFrame, onDownloadFrame, busy }: FramePreviewProps) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [fps, setFps] = useState(8);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    setIndex(0);
  }, [frames]);

  useEffect(() => {
    if (!playing || frames.length <= 1) {
      if (timer.current !== null) window.clearInterval(timer.current);
      timer.current = null;
      return;
    }
    timer.current = window.setInterval(() => {
      setIndex((current) => (current + 1) % frames.length);
    }, Math.max(40, Math.floor(1000 / Math.max(1, fps))));
    return () => {
      if (timer.current !== null) window.clearInterval(timer.current);
      timer.current = null;
    };
  }, [playing, fps, frames.length]);

  if (frames.length === 0) return null;
  const frameInfo = diagnostic?.frames[index];
  const previewSize = 220;
  const previewPadding = 8;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }} data-testid="spriteflow-frame-preview">
      <div style={{ display: "grid", gridTemplateColumns: "minmax(180px, 240px) 1fr", gap: 12, alignItems: "start" }}>
        <div
          style={{
            width: "100%",
            maxWidth: previewSize,
            height: previewSize,
            background: previewBackground || "#0d0f12",
            border: "1px solid #343842",
            borderRadius: 10,
            backgroundImage:
              "linear-gradient(45deg,#252932 25%,transparent 25%),linear-gradient(-45deg,#252932 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#252932 75%),linear-gradient(-45deg,transparent 75%,#252932 75%)",
            backgroundSize: "12px 12px",
            backgroundPosition: "0 0,0 6px,6px -6px,-6px 0",
            display: "grid",
            placeItems: "center",
            overflow: "hidden",
          }}
        >
          <img
            src={frames[index]}
            alt={`frame-${index + 1}`}
            style={{
              width: "auto",
              height: "auto",
              maxWidth: previewSize - previewPadding * 2,
              maxHeight: previewSize - previewPadding * 2,
              imageRendering: "pixelated",
              objectFit: "contain",
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12 }}>
          <strong style={{ fontSize: 13 }}>帧 {index + 1} / {frames.length}</strong>
          <div>切片尺寸：{frameWidth} x {frameHeight}</div>
          {frameInfo ? (
            <>
              <div>同格评分：{(frameInfo.sameCellScore * 100).toFixed(0)}%</div>
              <div>中心偏移：x {frameInfo.centerOffsetX.toFixed(2)}，y {frameInfo.centerOffsetY.toFixed(2)}</div>
              <div>占位比例：{(frameInfo.occupancy * 100).toFixed(1)}%</div>
              {frameInfo.warnings.length > 0 && <div style={{ color: "#fbbf24" }}>警告：{frameInfo.warnings.join("，")}</div>}
            </>
          ) : null}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            <button style={buttonStyle} onClick={() => setPlaying((p) => !p)}>{playing ? "暂停" : "播放"}</button>
            <button style={buttonStyle} onClick={() => setIndex((i) => (i + frames.length - 1) % frames.length)}>上一帧</button>
            <button style={buttonStyle} onClick={() => setIndex((i) => (i + 1) % frames.length)}>下一帧</button>
            <button style={buttonStyle} onClick={() => onDownloadFrame?.(index)}>下载单帧</button>
            <button style={buttonStyle} disabled={busy} onClick={() => onRegenerateFrame?.(index)}>重新生成单帧</button>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            FPS
            <input
              type="number"
              value={fps}
              min={1}
              max={30}
              onChange={(e) => setFps(Math.max(1, Math.min(30, Number(e.target.value) || 8)))}
              style={{ ...inputStyle, width: 66, padding: "5px 7px" }}
            />
          </label>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(54px,1fr))", gap: 5 }}>
        {frames.map((src, i) => {
          const bad = diagnostic?.frames[i]?.warnings.length;
          return (
            <button
              key={i}
              onClick={() => {
                setPlaying(false);
                setIndex(i);
              }}
              style={{
                border: i === index ? "2px solid #2f8bd8" : bad ? "1px solid #f59e0b" : "1px solid #343842",
                borderRadius: 6,
                padding: 0,
                background: "#0d0f12",
                cursor: "pointer",
                aspectRatio: "1 / 1",
                overflow: "hidden",
                display: "grid",
                placeItems: "center",
              }}
              title={`第 ${i + 1} 帧`}
            >
              <img src={src} alt={`thumb-${i + 1}`} style={{ maxWidth: "94%", maxHeight: "94%", objectFit: "contain", imageRendering: "pixelated" }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DetectorPanel({ diagnostic }: { diagnostic: SheetDiagnostic | null }) {
  if (!diagnostic) return <div style={{ fontSize: 12, color: "#aab0bc" }}>生成或重新切片后，会在这里显示帧检测结果。</div>;
  const flagged = diagnostic.frames.filter((frame) => frame.warnings.length > 0).length;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12 }} data-testid="spriteflow-detector">
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <span>网格：{diagnostic.cols} x {diagnostic.rows}</span>
        <span>整图：{diagnostic.sheetWidth} x {diagnostic.sheetHeight}</span>
        <span>异常帧：{flagged}</span>
      </div>
      {diagnostic.contentBand ? <div>检测到内容行：y {diagnostic.contentBand.y}，高 {diagnostic.contentBand.h}</div> : <div>未检测到内容行。</div>}
      {diagnostic.warnings.length > 0 && <div style={{ color: "#fbbf24" }}>整图警告：{diagnostic.warnings.join("，")}</div>}
      <div style={{ maxHeight: 150, overflow: "auto", border: "1px solid #343842", borderRadius: 8 }}>
        {diagnostic.frames.map((frame) => (
          <div key={frame.index} style={{ display: "grid", gridTemplateColumns: "44px 74px 1fr", gap: 8, padding: "5px 8px", borderBottom: "1px solid #2b2f37" }}>
            <span>#{frame.index + 1}</span>
            <span>{(frame.sameCellScore * 100).toFixed(0)}%</span>
            <span style={{ color: frame.warnings.length ? "#fbbf24" : "#9ca3af" }}>{frame.warnings.length ? frame.warnings.join("，") : "正常"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SpriteFlowPanel() {
  const [state, setState] = useState<PersistedState>(() => loadState());
  const [busy, setBusy] = useState(false);
  const [stageMessage, setStageMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SpriteFlowGenerateResult | null>(null);
  const [keyedSheet, setKeyedSheet] = useState<string | null>(null);
  const [keyedFrames, setKeyedFrames] = useState<string[] | null>(null);
  const [diagnostic, setDiagnostic] = useState<SheetDiagnostic | null>(null);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [modelList, setModelList] = useState<string[]>([]);
  const [allModelList, setAllModelList] = useState<string[]>([]);
  const [manualImageModel, setManualImageModel] = useState(false);
  const [manualChatModel, setManualChatModel] = useState(false);
  const [modelListBusy, setModelListBusy] = useState(false);
  const [modelListMsg, setModelListMsg] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mattingOpen, setMattingOpen] = useState(false);
  const [showOriginalSheet, setShowOriginalSheet] = useState(false);
  const [apiSettings, setApiSettings] = useState<SpriteFlowApiSettings>(() => loadSpriteFlowApiSettings());
  const aiSettings = useMemo(() => getDesktopSettingsSnapshot().ai, []);
  const effectiveOpenAiConfig = useMemo(() => {
    const localBaseUrl = apiSettings.openai.baseUrl.trim();
    const localApiKey = apiSettings.openai.apiKey.trim();
    const localImageModel = apiSettings.openai.imageModel.trim();
    const localChatModel = apiSettings.openai.chatModel.trim();
    const globalBaseUrl = aiSettings.baseUrl?.trim() || "";
    const globalApiKey = aiSettings.apiKey?.trim() || "";
    const timeoutMs = apiSettings.openai.timeoutMs || aiSettings.timeoutMs;
    return {
      baseUrl: localBaseUrl || globalBaseUrl,
      apiKey: localApiKey || globalApiKey,
      imageModel: localImageModel || state.imageModel.trim(),
      chatModel: localChatModel || state.chatModel.trim(),
      timeoutMs,
      source: localBaseUrl || localApiKey || localImageModel || localChatModel ? "SpriteFlow 本地设置" : "全局 AI Provider",
    };
  }, [aiSettings.apiKey, aiSettings.baseUrl, aiSettings.timeoutMs, apiSettings.openai.apiKey, apiSettings.openai.baseUrl, apiSettings.openai.chatModel, apiSettings.openai.imageModel, apiSettings.openai.timeoutMs, state.chatModel, state.imageModel]);
  const gridConfig = parseGridConfig(state.gridConfigStr) || GRID_CONFIGS[0];
  const metrics = getGridMetrics(gridConfig);
  const showImageModelInput = modelList.length === 0 || manualImageModel || !modelList.includes(state.imageModel);
  const showChatModelInput = allModelList.length === 0 || manualChatModel || Boolean(state.chatModel && !allModelList.includes(state.chatModel));
  const previewBackground = normalizeCssColor(state.previewBackground);

  useEffect(() => saveState(state), [state]);
  useEffect(() => saveSpriteFlowApiSettings(apiSettings), [apiSettings]);

  const toggleAction = useCallback((id: string) => {
    setState((s) => {
      const has = s.selectedActionIds.includes(id);
      return { ...s, selectedActionIds: has ? s.selectedActionIds.filter((x) => x !== id) : [...s.selectedActionIds, id] };
    });
  }, []);

  const selectedActions = useMemo<SpriteFlowAction[]>(() => DEFAULT_ACTIONS.filter((a) => state.selectedActionIds.includes(a.id)), [state.selectedActionIds]);

  const runKeying = useCallback(async (sheet: string, config: GridConfig) => {
    const keyed = await keyOutBackground(sheet, {
      tolerance: state.keyingTolerance,
      edgeBlend: state.keyingEdgeBlend,
      blendZoneRatio: state.keyingBlendZoneRatio,
      alphaCutoff: state.keyingAlphaCutoff,
      spillRemoval: state.keyingSpillRemoval,
      spillStrength: state.keyingSpillStrength,
      targetColor: state.keyingColorId === "green" ? { r: 0, g: 255, b: 0 } : undefined,
    });
    const sliced = await sliceSpriteSheet(keyed, config, getSliceOptions(config, state.rowSliceMode));
    setKeyedSheet(keyed);
    setKeyedFrames(sliced.frames);
    setDiagnostic(sliced.diagnostic);
  }, [state.keyingAlphaCutoff, state.keyingBlendZoneRatio, state.keyingColorId, state.keyingEdgeBlend, state.keyingSpillRemoval, state.keyingSpillStrength, state.keyingTolerance, state.rowSliceMode]);

  const onRewritePrompt = useCallback(async () => {
    setError(null);
    setBusy(true);
    setStageMessage("正在重写提示词...");
    try {
      const { baseUrl, apiKey, chatModel, imageModel, timeoutMs } = effectiveOpenAiConfig;
      if (!baseUrl) throw new Error("请先在设置里配置 AI Base URL。");
      if (!apiKey) throw new Error("请先在设置里配置 AI API Key。");
      if (!chatModel) throw new Error("请先选择提示词重写模型。");
      const parsedGrid = parseGridConfig(state.gridConfigStr);
      if (!parsedGrid) throw new Error("无效的网格配置。");
      const rewritten = await rewriteSpritePromptDraft(
        { baseUrl, apiKey, imageModel, chatModel, timeoutMs },
        state.prompt,
        parsedGrid,
        selectedActions,
      );
      setState((s) => ({ ...s, rewrittenPrompt: rewritten }));
      setStageMessage("提示词重写完成，可继续编辑后生成。");
    } catch (e) {
      setError((e as Error).message || "提示词重写失败");
    } finally {
      setBusy(false);
      window.setTimeout(() => setStageMessage(""), 1200);
    }
  }, [effectiveOpenAiConfig, selectedActions, state.gridConfigStr, state.prompt]);

  const onGenerate = useCallback(async () => {
    setError(null);
    setResult(null);
    setKeyedSheet(null);
    setKeyedFrames(null);
    setDiagnostic(null);
    setBusy(true);
    setStageMessage("准备中...");
    try {
      const { baseUrl, apiKey, chatModel, imageModel, timeoutMs } = effectiveOpenAiConfig;
      if (!baseUrl) throw new Error("请先在设置里配置 AI Base URL。");
      if (!apiKey) throw new Error("请先在设置里配置 AI API Key。");
      if (!imageModel) throw new Error("请填写图像模型名。");
      const parsedGrid = parseGridConfig(state.gridConfigStr);
      if (!parsedGrid) throw new Error("无效的网格配置。");
      const keyingColor = KEYING_COLORS.find((c) => c.id === state.keyingColorId)?.value || "";
      const sizeRequest = resolveSizeForRequest(imageModel, state.size);
      if (sizeRequest.warning) setStageMessage(sizeRequest.warning);

      const res = await generateSpriteSheet(
        { baseUrl, apiKey, imageModel, chatModel: chatModel || undefined, timeoutMs },
        {
          prompt: state.prompt,
          rewrittenPrompt: state.rewrittenPrompt,
          gridConfig: parsedGrid,
          actions: selectedActions,
          size: sizeRequest.apiSize,
          sizePromptHint: sizeRequest.promptHint,
          backgroundPrompt: state.globalBackgroundPrompt,
          rowSliceMode: state.rowSliceMode,
          transparentBackground: state.transparentBackground,
          keyingColor,
          direction: state.direction,
          referenceImage,
        },
        (event) => setStageMessage(event.message),
      );
      setResult(res);
      const sliced = await sliceSpriteSheet(res.sheetDataUrl, res.metadata.gridConfig, getSliceOptions(res.metadata.gridConfig, state.rowSliceMode));
      setDiagnostic(sliced.diagnostic);
      if (state.autoKey) {
        setStageMessage("正在色键去背景...");
        await runKeying(res.sheetDataUrl, res.metadata.gridConfig);
      }
    } catch (e) {
      setError((e as Error).message || "生成失败");
    } finally {
      setBusy(false);
      setStageMessage("");
    }
  }, [effectiveOpenAiConfig, referenceImage, runKeying, selectedActions, state]);

  const onRegenerateFrame = useCallback(async (frameIndex: number) => {
    if (!result) return;
    setBusy(true);
    setError(null);
    setStageMessage(`正在重新生成第 ${frameIndex + 1} 帧...`);
    try {
      const { baseUrl, apiKey, imageModel, timeoutMs } = effectiveOpenAiConfig;
      if (!baseUrl || !apiKey) throw new Error("缺少 AI Base URL 或 API Key。");
      const frames = [...(keyedFrames || result.frames)];
      const framePrompt = `${state.prompt || result.originalPrompt}\nRegenerate only animation frame ${frameIndex + 1}. Keep the same character, camera, scale, padding, direction, and background as the reference frame. Return a single clean frame, not a full sheet.`;
      const singleGrid: GridConfig = { layout: "row", size: 1, frameCount: 1, label: "1x1 frame" };
      const regenerated = await generateSpriteSheet(
        { baseUrl, apiKey, imageModel, chatModel: undefined, timeoutMs },
        {
          prompt: framePrompt,
          gridConfig: singleGrid,
          actions: selectedActions,
          size: "1024x1024",
          transparentBackground: state.transparentBackground,
          keyingColor: KEYING_COLORS.find((c) => c.id === state.keyingColorId)?.value || "",
          direction: state.direction,
          referenceImage: frames[frameIndex] || referenceImage || result.sheetDataUrl,
        },
        (event) => setStageMessage(event.message),
      );
      frames[frameIndex] = regenerated.frames[0] || regenerated.sheetDataUrl;
      const sheet = await composeSpriteSheet(frames, result.metadata.gridConfig);
      const sliced = await sliceSpriteSheet(sheet, result.metadata.gridConfig, getSliceOptions(result.metadata.gridConfig, state.rowSliceMode));
      const next = makeResultWithFrames(result, sliced.frames, sheet);
      setResult(next);
      setKeyedSheet(null);
      setKeyedFrames(null);
      setDiagnostic(sliced.diagnostic);
    } catch (e) {
      setError((e as Error).message || "单帧重新生成失败");
    } finally {
      setBusy(false);
      setStageMessage("");
    }
  }, [effectiveOpenAiConfig, keyedFrames, referenceImage, result, selectedActions, state]);

  const onFetchModels = useCallback(async () => {
    setModelListBusy(true);
    setModelListMsg(null);
    try {
      const { baseUrl, apiKey, timeoutMs } = effectiveOpenAiConfig;
      if (!baseUrl) throw new Error("请先配置 AI Base URL。");
      if (!apiKey) throw new Error("请先配置 AI API Key。");
      const { ids } = await listImageModels({ baseUrl, apiKey, timeoutMs });
      const allModels = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
      const filtered = ids.filter((id) => imageModelPriority(id) > 0);
      const finalList = sortImageModels(filtered.length > 0 ? filtered : ids);
      setAllModelList(allModels);
      setModelList(finalList);
      const preferred = pickPreferredImageModel(finalList);
      let selected = "";
      setState((s) => {
        if (!preferred) return s;
        const currentExists = finalList.includes(s.imageModel.trim());
        const shouldAutoSelect = !s.imageModel.trim() || s.imageModel === DEFAULT_IMAGE_MODEL || !currentExists;
        if (!shouldAutoSelect) return s;
        selected = preferred;
        return { ...s, imageModel: preferred };
      });
      if (selected) setManualImageModel(false);
      setModelListMsg(
        finalList.length
          ? selected
            ? `已加载 ${finalList.length} 个模型，并自动选择：${selected}`
            : `已加载 ${finalList.length} 个模型。`
          : "网关没有返回模型。",
      );
    } catch (e) {
      setModelListMsg((e as Error).message);
    } finally {
      setModelListBusy(false);
    }
  }, [effectiveOpenAiConfig]);

  const activeFrames = keyedFrames || result?.frames || [];
  const activeSheet = keyedSheet || result?.sheetDataUrl || "";
  const previewSheet = showOriginalSheet && result?.sheetDataUrl ? result.sheetDataUrl : activeSheet;

  const onApplyMattingRefine = useCallback(async (nextSheet: string) => {
    if (!result) return;
    const sliced = await sliceSpriteSheet(nextSheet, result.metadata.gridConfig, getSliceOptions(result.metadata.gridConfig, state.rowSliceMode));
    setKeyedSheet(nextSheet);
    setKeyedFrames(sliced.frames);
    setDiagnostic(sliced.diagnostic);
  }, [result, state.rowSliceMode]);

  const onDownloadJson = useCallback(() => {
    if (!result) return;
    const { cols } = getGridMetrics(result.metadata.gridConfig);
    const meta = {
      version: 2,
      grid: result.metadata.grid,
      gridConfig: result.metadata.gridConfig,
      frameCount: result.metadata.frameCount,
      frameWidth: result.frameWidth,
      frameHeight: result.frameHeight,
      model: result.metadata.model,
      size: result.metadata.size,
      direction: result.metadata.direction,
      promptOriginal: result.originalPrompt,
      promptFinal: result.finalPrompt,
      diagnostic,
      frames: activeFrames.map((_, i) => ({ index: i, x: (i % cols) * result.frameWidth, y: Math.floor(i / cols) * result.frameHeight, w: result.frameWidth, h: result.frameHeight })),
    };
    const blob = new Blob([JSON.stringify(meta, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `spriteflow-${result.metadata.grid}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [activeFrames, diagnostic, result]);

  const activeStep = computeActiveStep({
    hasResult: Boolean(result),
    hasKeyedSheet: Boolean(keyedSheet),
    hasImageModel: Boolean(state.imageModel.trim()),
    hasActions: state.selectedActionIds.length > 0,
  });
  const progressPercent = STEP_PROGRESS[activeStep];

  return (
    <div className="workflow-shell" data-testid="spriteflow-panel">
      {settingsOpen ? (
        <div style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(0,0,0,0.48)", display: "grid", placeItems: "center", padding: 18 }}>
          <div style={{ ...cardStyle, width: "min(720px, 94vw)", maxHeight: "88vh", overflow: "auto", boxShadow: "0 22px 80px rgba(0,0,0,0.45)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <strong>SpriteFlow API 设置</strong>
              <span style={{ fontSize: 11, color: "#9ca3af" }}>OpenAI-compatible 当前可直接生成；falsprite/fal.ai 配置已保存，后续可接 fal 队列生成。</span>
              <button style={{ ...buttonStyle, marginLeft: "auto", padding: "5px 10px" }} onClick={() => setSettingsOpen(false)}>关闭</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <section style={cardStyle}>
                <div style={labelStyle}>当前 API（OpenAI-compatible）</div>
                <input style={inputStyle} value={apiSettings.openai.baseUrl} onChange={(e) => setApiSettings((s) => ({ ...s, openai: { ...s.openai, baseUrl: e.target.value } }))} placeholder={aiSettings.baseUrl || "https://api.openai.com/v1"} />
                <div style={{ fontSize: 10, color: "#8b93a1", marginTop: 5 }}>
                  本地 SpriteFlow API 优先；留空才使用全局 AI Provider。
                </div>
                <input style={{ ...inputStyle, marginTop: 8 }} value={apiSettings.openai.apiKey} onChange={(e) => setApiSettings((s) => ({ ...s, openai: { ...s.openai, apiKey: e.target.value } }))} placeholder="API Key（留空则使用全局设置）" type="password" />
                <input style={{ ...inputStyle, marginTop: 8 }} value={apiSettings.openai.imageModel} onChange={(e) => { const value = e.target.value; setApiSettings((s) => ({ ...s, openai: { ...s.openai, imageModel: value } })); setState((prev) => ({ ...prev, imageModel: value || prev.imageModel })); }} placeholder="图像模型" />
                <input style={{ ...inputStyle, marginTop: 8 }} value={apiSettings.openai.chatModel} onChange={(e) => { const value = e.target.value; setApiSettings((s) => ({ ...s, openai: { ...s.openai, chatModel: value } })); setState((prev) => ({ ...prev, chatModel: value })); }} placeholder="提示词重写模型（可选）" />
                <input style={{ ...inputStyle, marginTop: 8 }} value={apiSettings.openai.timeoutMs} onChange={(e) => setApiSettings((s) => ({ ...s, openai: { ...s.openai, timeoutMs: Number(e.target.value) || 600000 } }))} type="number" min={30000} step={10000} placeholder="超时 ms" />
              </section>
              <section style={cardStyle}>
                <div style={labelStyle}>falsprite / fal.ai API</div>
                <input style={inputStyle} value={apiSettings.fal.apiKey} onChange={(e) => setApiSettings((s) => ({ ...s, fal: { ...s.fal, apiKey: e.target.value } }))} placeholder="FAL API Key" type="password" />
                <input style={{ ...inputStyle, marginTop: 8 }} value={apiSettings.fal.imageEndpoint} onChange={(e) => setApiSettings((s) => ({ ...s, fal: { ...s.fal, imageEndpoint: e.target.value } }))} placeholder="fal-ai/nano-banana-2" />
                <input style={{ ...inputStyle, marginTop: 8 }} value={apiSettings.fal.editEndpoint} onChange={(e) => setApiSettings((s) => ({ ...s, fal: { ...s.fal, editEndpoint: e.target.value } }))} placeholder="fal-ai/nano-banana-pro/edit" />
                <input style={{ ...inputStyle, marginTop: 8 }} value={apiSettings.fal.rewriteEndpoint} onChange={(e) => setApiSettings((s) => ({ ...s, fal: { ...s.fal, rewriteEndpoint: e.target.value } }))} placeholder="openrouter/router" />
                <input style={{ ...inputStyle, marginTop: 8 }} value={apiSettings.fal.rewriteModel} onChange={(e) => setApiSettings((s) => ({ ...s, fal: { ...s.fal, rewriteModel: e.target.value } }))} placeholder="openai/gpt-4o-mini" />
                <input style={{ ...inputStyle, marginTop: 8 }} value={apiSettings.fal.removeBgEndpoint} onChange={(e) => setApiSettings((s) => ({ ...s, fal: { ...s.fal, removeBgEndpoint: e.target.value } }))} placeholder="fal-ai/bria/background/remove" />
              </section>
            </div>
          </div>
        </div>
      ) : null}
      {mattingOpen && activeSheet ? (
        <MattingRefineModal
          sourceDataUrl={activeSheet}
          previewBackground={previewBackground}
          onClose={() => setMattingOpen(false)}
          onApply={onApplyMattingRefine}
        />
      ) : null}
      <section className="workflow-header panel">
        <div>
          <h3>SpriteFlow 精灵生成</h3>
          <p>从提示词到精灵图的完整流水线：角色描述、网格切片、模型与色键，一页搞定。</p>
        </div>
        <div className="workflow-progress-card">
          <div className="workflow-progress-meta">
            <strong>{busy ? stageMessage || "处理中" : result ? "已生成" : "准备生成"}</strong>
            <span title={`来源：${effectiveOpenAiConfig.source}`}>
              {effectiveOpenAiConfig.imageModel || "未配置模型"} · {effectiveOpenAiConfig.source}
            </span>
          </div>
          <div className="workflow-progress-track">
            <span style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      </section>

      <nav className="workflow-stepper" aria-label="SpriteFlow 步骤">
        {STEP_DEFS.map((step, index) => (
          <a key={step.key} className={step.key === activeStep ? "active" : ""} href={`#spriteflow-step-${step.key}`}>
            <span>{index + 1}</span>
            {step.label}
          </a>
        ))}
      </nav>

      <div className="spriteflow-toolbar">
        <button style={primaryStyle} onClick={onGenerate} disabled={busy} data-testid="spriteflow-generate-button">
          {busy ? stageMessage || "处理中..." : referenceImage ? "根据参考图编辑" : "生成精灵图"}
        </button>
        <button style={buttonStyle} onClick={() => setSettingsOpen(true)} disabled={busy} title="SpriteFlow 设置">API 设置</button>
        <span className="spriteflow-toolbar-meta" title={`来源：${effectiveOpenAiConfig.source}`}>
          生效接口：{effectiveOpenAiConfig.baseUrl || "未配置"}
        </span>
      </div>

      {error ? (
        <section className="panel" style={{ background: "#4a1d1d", borderColor: "#7f3333", color: "#fde2e2", whiteSpace: "pre-wrap" }}>
          {error}
        </section>
      ) : null}

      <div className="spriteflow-grid">
          <div className="workflow-column" id="spriteflow-step-prompt">
            <section style={cardStyle}>
              <div style={labelStyle}>角色描述</div>
              <textarea
                style={textareaStyle}
                value={state.prompt}
                placeholder="例如：竹林熊猫武士，温暖像素风，动作 RPG 精灵"
                onChange={(e) => setState((s) => ({ ...s, prompt: e.target.value }))}
              />
            </section>

            <section style={cardStyle} id="spriteflow-step-grid">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <div style={labelStyle}>网格布局</div>
                  <select style={inputStyle} value={state.gridConfigStr} onChange={(e) => setState((s) => ({ ...s, gridConfigStr: e.target.value }))}>
                    <optgroup label="推荐单行布局">
                      {GRID_CONFIGS.filter((c) => c.layout === "row").map((config) => <option key={serializeGridConfig(config)} value={serializeGridConfig(config)}>{config.label}</option>)}
                    </optgroup>
                    <optgroup label="方形网格">
                      {GRID_CONFIGS.filter((c) => c.layout === "square").map((config) => <option key={serializeGridConfig(config)} value={serializeGridConfig(config)}>{config.label}</option>)}
                    </optgroup>
                  </select>
                  <div style={{ fontSize: 11, color: "#8b93a1", marginTop: 5 }}>
                    当前：{metrics.label}，{metrics.frameCount} 帧，{gridConfig.layout === "square" ? "方形网格模式（按整图等分切片）" : "单行动画条模式"}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <div style={labelStyle}>切片方式</div>
                    {gridConfig.layout === "square" ? (
                      <div style={{ fontSize: 11, color: "#8b93a1" }}>方形网格固定使用整图等分切片，避免上下内容检测导致高度漂移。</div>
                    ) : (
                      <select style={inputStyle} value={state.rowSliceMode} onChange={(e) => setState((s) => ({ ...s, rowSliceMode: e.target.value as PersistedState["rowSliceMode"] }))}>
                        <option value="content-band">智能裁内容行（去掉上下空白）</option>
                        <option value="full-grid">整图等分（高度最稳定）</option>
                      </select>
                    )}
                  </div>
                </div>
                <div>
                  <div style={labelStyle}>角色朝向</div>
                  <select style={inputStyle} value={state.direction} onChange={(e) => setState((s) => ({ ...s, direction: e.target.value as SpriteDirection }))}>
                    {SPRITE_DIRECTIONS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                  </select>
                </div>
              </div>
            </section>

            <section style={cardStyle}>
              <div style={labelStyle}>动画动作</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {DEFAULT_ACTIONS.map((action) => {
                  const active = state.selectedActionIds.includes(action.id);
                  return <button key={action.id} style={{ ...buttonStyle, padding: "5px 9px", borderColor: active ? "#2f8bd8" : "#3a3f4a", background: active ? "#0e639c" : "#242830" }} onClick={() => toggleAction(action.id)}>{action.label}</button>;
                })}
              </div>
            </section>

            <section style={cardStyle}>
              <div style={labelStyle}>参考图（用于图像编辑）</div>
              <input
                style={inputStyle}
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.currentTarget.files?.[0];
                  setReferenceImage(file ? await fileToDataUrl(file) : null);
                }}
              />
              {referenceImage ? (
                <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
                  <img src={referenceImage} alt="参考图" style={{ width: 58, height: 58, objectFit: "contain", border: "1px solid #343842", borderRadius: 8, background: "#0d0f12" }} />
                  <button style={buttonStyle} onClick={() => setReferenceImage(null)}>清除参考图</button>
                </div>
              ) : <div style={{ fontSize: 11, color: "#8b93a1", marginTop: 6 }}>上传后会使用 Images Edits multipart 接口，把这张图作为参考。</div>}
            </section>

            <section style={cardStyle} id="spriteflow-step-model">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <div style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 8 }}>
                    <span>图像模型</span>
                    <button style={{ ...buttonStyle, padding: "2px 7px", fontSize: 11 }} onClick={onFetchModels} disabled={modelListBusy}>{modelListBusy ? "拉取中" : "拉取"}</button>
                  </div>
                  {modelList.length > 0 ? (
                    <select
                      style={inputStyle}
                      value={modelList.includes(state.imageModel) ? state.imageModel : "__custom__"}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === "__custom__") {
                          setManualImageModel(true);
                          return;
                        }
                        setManualImageModel(false);
                        setState((s) => ({ ...s, imageModel: value }));
                      }}
                    >
                      {!modelList.includes(state.imageModel) && <option value="__custom__">当前自定义：{state.imageModel || "未填写"}</option>}
                      {modelList.map((id) => <option key={id} value={id}>{id}</option>)}
                      {modelList.includes(state.imageModel) ? <option value="__custom__">手动填写...</option> : null}
                    </select>
                  ) : null}
                  {showImageModelInput ? (
                    <input
                      style={{ ...inputStyle, marginTop: modelList.length > 0 ? 6 : 0 }}
                      value={state.imageModel}
                      onChange={(e) => setState((s) => ({ ...s, imageModel: e.target.value }))}
                      placeholder="可手动填写模型名"
                      list="spriteflow-image-models"
                    />
                  ) : null}
                  <datalist id="spriteflow-image-models">{modelList.map((id) => <option key={id} value={id} />)}</datalist>
                  {modelListMsg ? <div style={{ fontSize: 11, color: "#aab0bc", marginTop: 4 }}>{modelListMsg}</div> : null}
                </div>
                <div>
                  <div style={labelStyle}>提示词重写模型</div>
                  {allModelList.length > 0 ? (
                    <select
                      style={inputStyle}
                      value={!state.chatModel ? "__none__" : allModelList.includes(state.chatModel) ? state.chatModel : "__custom__"}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === "__custom__") {
                          setManualChatModel(true);
                          return;
                        }
                        setManualChatModel(false);
                        setState((s) => ({ ...s, chatModel: value === "__none__" ? "" : value }));
                      }}
                    >
                      <option value="__none__">不重写提示词</option>
                      {state.chatModel && !allModelList.includes(state.chatModel) ? <option value="__custom__">当前自定义：{state.chatModel}</option> : null}
                      {allModelList.map((id) => <option key={id} value={id}>{id}</option>)}
                      {state.chatModel && allModelList.includes(state.chatModel) ? <option value="__custom__">手动填写...</option> : null}
                    </select>
                  ) : null}
                  {showChatModelInput ? (
                    <input
                      style={{ ...inputStyle, marginTop: allModelList.length > 0 ? 6 : 0 }}
                      value={state.chatModel}
                      onChange={(e) => setState((s) => ({ ...s, chatModel: e.target.value }))}
                      placeholder="可选，可手动填写"
                      list="spriteflow-chat-models"
                    />
                  ) : null}
                  <datalist id="spriteflow-chat-models">{allModelList.map((id) => <option key={id} value={id} />)}</datalist>
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div style={{ ...labelStyle, marginBottom: 0 }}>重写提示词草稿</div>
                  <button style={{ ...buttonStyle, padding: "4px 8px", fontSize: 12 }} onClick={onRewritePrompt} disabled={busy || !state.chatModel.trim()}>重写提示词</button>
                  {state.rewrittenPrompt ? <button style={{ ...buttonStyle, padding: "4px 8px", fontSize: 12 }} onClick={() => setState((s) => ({ ...s, rewrittenPrompt: "" }))} disabled={busy}>清空草稿</button> : null}
                </div>
                <textarea
                  style={{ ...textareaStyle, minHeight: 88 }}
                  value={state.rewrittenPrompt}
                  onChange={(e) => setState((s) => ({ ...s, rewrittenPrompt: e.target.value }))}
                  placeholder="点击重写后会显示可编辑结果；不填写则生成时按原始角色描述自动重写或直接生成。"
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                <div>
                  <div style={labelStyle}>输出尺寸</div>
                  <select style={inputStyle} value={state.size} onChange={(e) => setState((s) => ({ ...s, size: e.target.value }))}>
                    <option value="1024x1024">1024x1024</option>
                    <option value="1536x1024">1536x1024</option>
                    <option value="1024x1536">1024x1536</option>
                    <option value="512x512">512x512</option>
                    <option value="auto">auto</option>
                  </select>
                </div>
                <div>
                  <div style={labelStyle}>透明背景</div>
                  <select style={inputStyle} value={state.transparentBackground ? "yes" : "no"} onChange={(e) => setState((s) => ({ ...s, transparentBackground: e.target.value === "yes" }))}>
                    <option value="yes">是</option>
                    <option value="no">否</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                <div>
                  <div style={labelStyle}>预览背景色</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="color" value={previewBackground} onChange={(e) => setState((s) => ({ ...s, previewBackground: e.target.value }))} style={{ width: 42, height: 34, border: "1px solid #3a3f4a", borderRadius: 8, background: "#101215" }} />
                    <input style={inputStyle} value={state.previewBackground} onChange={(e) => setState((s) => ({ ...s, previewBackground: e.target.value }))} placeholder="#0d0f12" />
                  </div>
                </div>
                <div>
                  <div style={labelStyle}>全局背景/遮罩提示</div>
                  <input
                    style={inputStyle}
                    value={state.globalBackgroundPrompt}
                    onChange={(e) => setState((s) => ({ ...s, globalBackgroundPrompt: e.target.value }))}
                    placeholder="例如：统一浅灰遮罩背景 / clean transparent background"
                  />
                </div>
              </div>
            </section>

            <section style={cardStyle} id="spriteflow-step-keying">
              <div style={labelStyle}>背景色键</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {KEYING_COLORS.map((kc) => {
                  const active = state.keyingColorId === kc.id;
                  return <button key={kc.id} style={{ ...buttonStyle, padding: "5px 9px", borderColor: active ? "#2f8bd8" : "#3a3f4a", background: active ? "#0e639c" : "#242830" }} onClick={() => setState((s) => ({ ...s, keyingColorId: kc.id }))}>{kc.label}</button>;
                })}
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginTop: 8 }}>
                <input type="checkbox" checked={state.autoKey} onChange={(e) => setState((s) => ({ ...s, autoKey: e.target.checked }))} />
                生成后自动色键去背景
              </label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                <button style={buttonStyle} onClick={() => result && runKeying(result.sheetDataUrl, result.metadata.gridConfig)} disabled={!result || busy}>色键去背景</button>
              </div>
              <details open={state.showAdvanced} style={{ marginTop: 8 }}>
                <summary style={{ cursor: "pointer", fontSize: 12, color: "#aab0bc" }} onClick={(e) => { e.preventDefault(); setState((s) => ({ ...s, showAdvanced: !s.showAdvanced })); }}>高级色键选项</summary>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                  <span style={{ fontSize: 11, color: "#aab0bc" }}>容差</span>
                  <input type="range" min="10" max="150" value={state.keyingTolerance} onChange={(e) => setState((s) => ({ ...s, keyingTolerance: Number(e.target.value) }))} style={{ flex: 1 }} />
                  <span style={{ fontSize: 11, color: "#60a5fa", minWidth: 30 }}>{state.keyingTolerance}</span>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginTop: 8 }}>
                  <input type="checkbox" checked={state.keyingEdgeBlend} onChange={(e) => setState((s) => ({ ...s, keyingEdgeBlend: e.target.checked }))} />
                  边缘混合（减少硬边）
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                  <span style={{ fontSize: 11, color: "#aab0bc" }}>混合区</span>
                  <input type="range" min="10" max="90" value={Math.round(state.keyingBlendZoneRatio * 100)} onChange={(e) => setState((s) => ({ ...s, keyingBlendZoneRatio: Number(e.target.value) / 100 }))} style={{ flex: 1 }} />
                  <span style={{ fontSize: 11, color: "#60a5fa", minWidth: 34 }}>{Math.round(state.keyingBlendZoneRatio * 100)}%</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                  <span style={{ fontSize: 11, color: "#aab0bc" }}>Alpha 截断</span>
                  <input type="range" min="0" max="80" value={state.keyingAlphaCutoff} onChange={(e) => setState((s) => ({ ...s, keyingAlphaCutoff: Number(e.target.value) }))} style={{ flex: 1 }} />
                  <span style={{ fontSize: 11, color: "#60a5fa", minWidth: 30 }}>{state.keyingAlphaCutoff}</span>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginTop: 8 }}>
                  <input type="checkbox" checked={state.keyingSpillRemoval} onChange={(e) => setState((s) => ({ ...s, keyingSpillRemoval: e.target.checked }))} />
                  去除边缘溢色（绿/蓝边）
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                  <span style={{ fontSize: 11, color: "#aab0bc" }}>溢色强度</span>
                  <input type="range" min="0" max="100" value={Math.round(state.keyingSpillStrength * 100)} onChange={(e) => setState((s) => ({ ...s, keyingSpillStrength: Number(e.target.value) / 100 }))} style={{ flex: 1 }} />
                  <span style={{ fontSize: 11, color: "#60a5fa", minWidth: 34 }}>{Math.round(state.keyingSpillStrength * 100)}%</span>
                </div>
              </details>
            </section>
          </div>

          <div className="workflow-column" id="spriteflow-step-result">
            <section style={cardStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                <div style={{ ...labelStyle, marginBottom: 0 }}>整图预览</div>
                {result?.sheetDataUrl && activeSheet && result.sheetDataUrl !== activeSheet ? (
                  <button style={{ ...buttonStyle, padding: "4px 8px", fontSize: 12, marginLeft: "auto" }} onClick={() => setShowOriginalSheet((v) => !v)}>{showOriginalSheet ? "查看结果" : "查看原图"}</button>
                ) : <span style={{ marginLeft: "auto" }} />}
                {activeSheet ? <button style={{ ...buttonStyle, padding: "4px 8px", fontSize: 12 }} onClick={() => setMattingOpen(true)}>抠图修正</button> : null}
              </div>
              <div style={{ minHeight: 180, border: "1px solid #343842", borderRadius: 10, background: previewBackground, display: "grid", placeItems: "center", overflow: "hidden", padding: 8 }} data-testid="spriteflow-sheet-preview">
                {previewSheet ? <img src={previewSheet} alt="精灵图" style={{ maxWidth: "100%", maxHeight: 260, objectFit: "contain", imageRendering: "pixelated" }} /> : <span style={{ fontSize: 12, color: "#7d8491" }}>还没有生成结果</span>}
              </div>
              {result?.warnings.length ? <div style={{ color: "#fbbf24", fontSize: 12, marginTop: 8 }}>{result.warnings.join(" | ")}</div> : null}
            </section>

            <section style={cardStyle}>
              <div style={labelStyle}>播放预览</div>
              <FramePreview
                frames={activeFrames}
                frameWidth={result?.frameWidth || 0}
                frameHeight={result?.frameHeight || 0}
                previewBackground={previewBackground}
                diagnostic={diagnostic}
                busy={busy}
                onRegenerateFrame={onRegenerateFrame}
                onDownloadFrame={(index) => activeFrames[index] && downloadDataUrl(activeFrames[index], `spriteflow-frame-${String(index + 1).padStart(2, "0")}.png`)}
              />
            </section>

            <section style={cardStyle}>
              <div style={labelStyle}>帧检测器</div>
              <DetectorPanel diagnostic={diagnostic} />
            </section>

            {result ? (
              <section style={cardStyle}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <button style={buttonStyle} onClick={() => downloadDataUrl(activeSheet, `spriteflow-${result.metadata.grid}.png`)}>下载整图 PNG</button>
                  <button style={buttonStyle} onClick={() => activeFrames.forEach((frame, idx) => downloadDataUrl(frame, `spriteflow-${result.metadata.grid}-frame-${String(idx + 1).padStart(2, "0")}.png`))}>下载全部帧</button>
                  <button style={buttonStyle} onClick={onDownloadJson}>下载 JSON</button>
                </div>
                <details style={{ marginTop: 10 }}>
                  <summary style={{ cursor: "pointer", fontSize: 12, color: "#aab0bc" }}>查看最终提示词</summary>
                  <pre style={{ marginTop: 8, background: "#0d0f12", border: "1px solid #343842", borderRadius: 8, padding: 10, fontSize: 11, whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 220, overflow: "auto" }}>{result.finalPrompt}</pre>
                </details>
              </section>
            ) : null}
          </div>
        </div>
    </div>
  );
}
