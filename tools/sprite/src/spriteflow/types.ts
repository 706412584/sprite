/**
 * SpriteFlow types - local AI sprite-sheet generation pipeline.
 *
 * Backed by an OpenAI-compatible image API (for example New API / OneAPI),
 * inspired by https://github.com/lovisdotio/falsprite (MIT).
 */

export type SpriteGridSize = 2 | 3 | 4 | 5 | 6;

/** Grid layout type: square (NxN) or single-row (1xN). */
export type GridLayout = "square" | "row";

export type SpriteDirection = "right" | "left" | "up" | "down" | "front" | "back" | "isometric";

export interface GridConfig {
  layout: GridLayout;
  /** For square: N (creates NxN grid). For row: number of columns (creates 1xN grid). */
  size: number;
  /** Total frame count. */
  frameCount: number;
  /** Display label. */
  label: string;
}

export interface GridMetrics {
  rows: number;
  cols: number;
  frameCount: number;
  label: string;
}

export interface SpriteFlowAction {
  /** Stable id, e.g. "walk", "attack". */
  id: string;
  /** Human-readable label shown to the user. */
  label: string;
  /** One-sentence description appended to the prompt. */
  hint: string;
}

export interface SpriteFlowGenerateInput {
  /** Free-form character description. */
  prompt: string;
  /** Optional user-reviewed prompt draft after rewrite; used instead of running rewrite again. */
  rewrittenPrompt?: string;
  /** Grid configuration (layout type + size). */
  gridConfig: GridConfig;
  /** Selected animation actions (concatenated when building the prompt). */
  actions: SpriteFlowAction[];
  /** Optional generated-frame replacement target. */
  editFrameIndex?: number;
  /** Optional reference image (base64 data URL or http(s) URL). */
  referenceImage?: string | null;
  /** Output image size - must match what the upstream model accepts. Defaults handled by client. */
  size?: string;
  /** Optional natural-language size constraints appended to the final image prompt. */
  sizePromptHint?: string;
  /** Optional global background or mask instruction appended to the final image prompt. */
  backgroundPrompt?: string;
  /** Single-row slicing strategy. Square grids always use full-grid slicing. */
  rowSliceMode?: "content-band" | "full-grid";
  /** Whether the upstream model supports a transparent background hint. */
  transparentBackground?: boolean;
  /** Keying color for background removal (e.g. "pure green #00FF00"). */
  keyingColor?: string;
  /** Intended character facing direction. */
  direction?: SpriteDirection;
}

export interface SpriteFlowGenerateResult {
  /** Final prompt actually sent to the image model (after LLM rewrite, if any). */
  finalPrompt: string;
  /** Original prompt before rewrite. */
  originalPrompt: string;
  /** Data URL of the raw sheet (PNG). */
  sheetDataUrl: string;
  /** Sliced individual frames (PNG data URLs), in left-to-right top-to-bottom order. */
  frames: string[];
  /** Frame width / height, in pixels. */
  frameWidth: number;
  frameHeight: number;
  /** Non-fatal warnings collected during the pipeline. */
  warnings: string[];
  metadata: {
    grid: string;
    gridConfig: GridConfig;
    frameCount: number;
    model: string;
    size: string;
    direction?: SpriteDirection;
    source: "generation" | "edit";
  };
}

export interface SpriteFlowProgressEvent {
  stage: "rewrite" | "generate" | "edit" | "decode" | "slice" | "done";
  message: string;
  /** 0-1 if known. */
  progress?: number;
}

export interface SpriteFlowClientConfig {
  /** OpenAI-compatible API base, e.g. "https://api.example.com/v1". Trailing slash optional. */
  baseUrl: string;
  /** Bearer token. */
  apiKey: string;
  /** Image generation model name (e.g. "gemini-2.5-flash-image-preview"). */
  imageModel: string;
  /** Optional chat model used to rewrite the prompt before generation. */
  chatModel?: string;
  /** Request timeout in ms. */
  timeoutMs?: number;
}

export const SPRITE_DIRECTIONS: Array<{ id: SpriteDirection; label: string; prompt: string }> = [
  { id: "right", label: "向右 / 东", prompt: "The character faces to screen-right / east in every frame." },
  { id: "left", label: "向左 / 西", prompt: "The character faces to screen-left / west in every frame." },
  { id: "down", label: "向下 / 正面", prompt: "The character faces toward the viewer / south in every frame." },
  { id: "up", label: "向上 / 背面", prompt: "The character faces away from the viewer / north in every frame." },
  { id: "front", label: "正面肖像", prompt: "The character faces forward toward the camera in every frame." },
  { id: "back", label: "背面视角", prompt: "The character is seen from behind in every frame." },
  { id: "isometric", label: "等距 3/4", prompt: "The character uses a consistent isometric three-quarter game view in every frame." },
];

export const DEFAULT_ACTIONS: SpriteFlowAction[] = [
  { id: "idle", label: "待机", hint: "idle breathing loop, weight shifts gently side to side, shoulders rise and fall, arms relaxed but not identical between frames" },
  { id: "walk", label: "行走", hint: "walk cycle, left foot forward then right foot forward, arms swing opposite to legs, clear contact-pass-up-pass phases, visible foot contact changes" },
  { id: "run", label: "奔跑", hint: "run cycle, alternating left and right leg stride, one leg extends forward while the other pushes off behind, arms pump opposite to legs, torso leans forward, clear flight phase with both feet off ground" },
  { id: "attack", label: "攻击", hint: "attack combo, wind-up then slash or strike then impact then follow-through then recover to stance" },
  { id: "cast", label: "施法", hint: "spell casting, hands or staff gather energy then raise then release burst then magic afterglow cools down" },
  { id: "jump", label: "跳跃", hint: "jump, crouch then spring upward then peak in air with both feet off ground then land and absorb impact" },
  { id: "dodge", label: "闪避", hint: "dodge roll or sidestep, lean then tuck or shift into fast sideways movement then unfold then return to stance" },
  { id: "death", label: "倒地", hint: "death, hit reaction then stagger then knees buckle then collapse on ground into a final readable pose" },
];

/** Standard chroma key colors for background removal. */
export const KEYING_COLORS = [
  { id: "none", label: "不指定 / 模型自选", value: "", hex: "" },
  { id: "green", label: "绿色", value: "pure green #00FF00", hex: "#00FF00" },
  { id: "blue", label: "蓝色", value: "pure blue #0000FF", hex: "#0000FF" },
  { id: "magenta", label: "品红", value: "pure magenta #FF00FF", hex: "#FF00FF" },
  { id: "cyan", label: "青色", value: "pure cyan #00FFFF", hex: "#00FFFF" },
] as const;

/** Predefined grid configurations. */
export const GRID_CONFIGS: GridConfig[] = [
  { layout: "row", size: 3, frameCount: 3, label: "1x3 单行（3 帧）" },
  { layout: "row", size: 4, frameCount: 4, label: "1x4 单行（4 帧）" },
  { layout: "row", size: 6, frameCount: 6, label: "1x6 单行（6 帧）" },
  { layout: "row", size: 8, frameCount: 8, label: "1x8 单行（8 帧，推荐）" },
  { layout: "row", size: 9, frameCount: 9, label: "1x9 单行（9 帧）" },
  { layout: "row", size: 12, frameCount: 12, label: "1x12 单行（12 帧）" },
  { layout: "square", size: 2, frameCount: 4, label: "2x2 网格（4 帧）" },
  { layout: "square", size: 3, frameCount: 9, label: "3x3 网格（9 帧）" },
  { layout: "square", size: 4, frameCount: 16, label: "4x4 网格（16 帧）" },
  { layout: "square", size: 5, frameCount: 25, label: "5x5 网格（25 帧）" },
  { layout: "square", size: 6, frameCount: 36, label: "6x6 网格（36 帧）" },
];

export function getGridMetrics(config: GridConfig): GridMetrics {
  const rows = config.layout === "square" ? config.size : 1;
  const cols = config.size;
  const frameCount = config.layout === "square" ? config.size * config.size : config.frameCount;
  const label = config.layout === "row" ? `1x${cols}` : `${cols}x${rows}`;
  return { rows, cols, frameCount, label };
}

/** Get grid config by layout and size. */
export function getGridConfig(layout: GridLayout, size: number): GridConfig | undefined {
  return GRID_CONFIGS.find((c) => c.layout === layout && c.size === size);
}

/** Serialize grid config to string for storage. */
export function serializeGridConfig(config: GridConfig): string {
  return `${config.layout}:${config.size}`;
}

/** Parse grid config from string. */
export function parseGridConfig(str: string): GridConfig | undefined {
  const [layout, sizeStr] = str.split(":");
  const size = Number.parseInt(sizeStr, 10);
  if ((layout === "row" || layout === "square") && Number.isFinite(size)) {
    return getGridConfig(layout as GridLayout, size);
  }
  return undefined;
}

export function getDirectionPrompt(direction?: SpriteDirection): string {
  if (!direction) return "";
  return SPRITE_DIRECTIONS.find((item) => item.id === direction)?.prompt || "";
}
