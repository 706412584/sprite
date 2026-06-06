export type ApiResult<T> = { ok: true } & T;

export interface EnvPackageInfo {
  name: string;
  ok: boolean;
  version: string | null;
  install: string;
}

export interface EnvFfmpegInfo {
  name: string;
  ok: boolean;
  path: string | null;
  version: string;
}

export interface EnvToolInfo {
  name: string;
  ok: boolean;
  path: string;
  install: string;
  description?: string;
  size_hint?: string;
}

export interface EnvModelInfo {
  key: string;
  label: string;
  repo: string;
  cached: boolean;
  cache_path: string;
  hf_url: string;
  direct_url: string;
  downloadable?: boolean;
  size_hint?: string;
}

export interface EnvCheckResult {
  all_ok: boolean;
  packages: EnvPackageInfo[];
  batch_install: string;
  torch_device: string;
  ffmpeg: EnvFfmpegInfo[];
  tools: EnvToolInfo[];
  models: EnvModelInfo[];
  cache_dir: string;
}



export interface UploadInfo {
  id: string;
  name: string;
  path?: string;
  url?: string;
  media_type?: string;
  duration?: number;
  width?: number;
  height?: number;
  fps?: number;
}

export interface ModelStatusInfo {
  key: string;
  label: string;
  repo: string;
  cached: boolean;
  loaded: boolean;
  cache_path?: string;
}

export interface JobFrameInfo {
  index: number;
  name: string;
  url: string;
  thumb_url?: string;
  width?: number;
  height?: number;
  bbox?: number[] | null;
}

export interface JobInfo {
  id?: string;
  job_id?: string;
  upload_id?: string;
  frame_count?: number;
  frames?: JobFrameInfo[];
  source_media_type?: string;
  video_info?: Record<string, unknown>;
  options?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface PreviewInfo {
  id?: string;
  preview_id?: string;
  upload_id?: string;
  source_url?: string;
  processed_url?: string;
  key_color?: string;
  sample_time?: number;
  options?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ExportInfo {
  id?: string;
  output_dir?: string;
  frames_dir?: string;
  zip_url?: string;
  sheet_url?: string;
  webp_sheet_url?: string;
  video_url?: string;
  manifest_url?: string;
  frame_count?: number;
  video_duration_ms?: number;
  sheet_width?: number;
  sheet_height?: number;
  [key: string]: unknown;
}

export interface ExportCompressionSettings {
  include_sheet: boolean;
  include_zip: boolean;
  include_mov: boolean;
  include_manifest: boolean;
  sheet_format: "png" | "webp" | "both";
  png_compress_level: number;
  zip_compress_level: number;
  webp_quality: number;
  sheet_max_dimension: number;
  sheet_target_kb: number;
}

export interface SmartSelectResult {
  selected_indices: number[];
  target_count: number;
  frame_count: number;
}

export interface TaskProgressInfo<T = unknown> {
  task_id: string;
  label: string;
  status: "running" | "completed" | "failed";
  progress: number;
  message: string;
  logs?: string[];
  result: T | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export type KeyingMode =
  | "none"
  | "chroma"
  | "spriteflow"
  | "birefnet"
  | "corridorkey"
  | "luma"
  | "birefnet_corridorkey"
  | "birefnet_luma"
  | "birefnet_luma_corridorkey";

export interface ProcessSettings {
  upload_id: string;
  start_time: number;
  end_time: number;
  keep_every: number;
  target_size: number;
  reduce_px: number;
  canvas_mode: "auto" | "square_bottom" | "square_center";
  chroma_enabled: boolean;
  matte_mode: KeyingMode;
  key_mode: "auto" | "manual";
  manual_key_hex: string;
  threshold: number;
  softness: number;
  despill_strength: number;
  halo_pixels: number;
  ai_model: string;
  ai_device: "auto" | "cuda" | "cpu";
  ai_resolution: number;
  luma_black: number;
  luma_white: number;
  luma_gamma: number;
  luma_strength: number;
  corridorkey_enabled: boolean;
  corridorkey_screen: "auto" | "green" | "blue";
  batch_green_to_black: boolean;
  batch_semitransparent_to_black: boolean;
  batch_semitransparent_to_opaque: boolean;
  sf_tolerance: number;
  sf_edge_blend: boolean;
  sf_blend_zone_ratio: number;
  sf_alpha_cutoff: number;
  sf_spill_removal: boolean;
  sf_spill_strength: number;
}
