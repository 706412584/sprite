import type { ApiResult, EnvCheckResult, ExportCompressionSettings, ExportInfo, JobInfo, ModelStatusInfo, PreviewInfo, ProcessSettings, SmartSelectResult, TaskProgressInfo, UploadInfo } from "@/types/sprite";

async function resolveApiPath(path: string) {
  if (!path.startsWith("/")) {
    return path;
  }
  const desktopApi = window.spriteDesktop;
  if (!desktopApi) {
    return path;
  }
  const runtime = await desktopApi.getRuntimeStatus();
  return `${runtime.serverUrl}${path}`;
}

function normalizeUpload(upload: UploadInfo): UploadInfo {
  const raw = upload as UploadInfo & {
    upload_id?: string;
    display_name?: string;
    source_path?: string;
    media_type?: string;
    media_url?: string;
    video_url?: string;
    media_info?: { duration?: number; width?: number; height?: number; fps?: number };
    video_info?: { duration?: number; width?: number; height?: number; fps?: number };
  };
  const info = raw.media_info || raw.video_info || {};
  return {
    ...upload,
    id: raw.id || raw.upload_id || "",
    name: raw.name || raw.display_name || raw.upload_id || "素材",
    path: raw.path || raw.source_path,
    url: raw.url || raw.media_url || raw.video_url,
    media_type: raw.media_type,
    duration: raw.duration ?? info.duration,
    width: raw.width ?? info.width,
    height: raw.height ?? info.height,
    fps: raw.fps ?? info.fps,
  };
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  const response = await fetch(await resolveApiPath(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || `请求失败：${response.status}`);
  }
  return payload as ApiResult<T>;
}

async function requestUpload(path: string, form: FormData): Promise<ApiResult<{ upload: UploadInfo }>> {
  const response = await fetch(await resolveApiPath(path), {
    method: "POST",
    body: form,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || `请求失败：${response.status}`);
  }
  return { ...(payload as ApiResult<{ upload: UploadInfo }>), upload: normalizeUpload(payload.upload) };
}

export function getAppVersion() {
  return requestJson<{ version: string; poll_ms: number }>("/api/app-version");
}

export function getModelStatus() {
  return requestJson<{ models: ModelStatusInfo[]; cache_dir: string; loaded_count: number }>("/api/models/status");
}

export async function importPath(path: string) {
  const result = await requestJson<{ upload: UploadInfo }>("/api/import-path", {
    method: "POST",
    body: JSON.stringify({ path }),
  });
  return { ...result, upload: normalizeUpload(result.upload) };
}

export function uploadFile(file: File) {
  const form = new FormData();
  form.append("video", file);
  return requestUpload("/api/upload", form);
}

export async function importAnimationFrames(files: File[]) {
  const form = new FormData();
  files.forEach((file) => form.append("frames", file));
  const response = await fetch(await resolveApiPath("/api/import-animation"), {
    method: "POST",
    body: form,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || `请求失败：${response.status}`);
  }
  return payload as ApiResult<{ job: JobInfo }>;
}

export function processVideo(settings: ProcessSettings) {
  return requestJson<{ job: JobInfo }>("/api/process", {
    method: "POST",
    body: JSON.stringify(settings),
  });
}

export function startProcessVideo(settings: ProcessSettings) {
  return requestJson<{ task: TaskProgressInfo<JobInfo> }>("/api/process", {
    method: "POST",
    body: JSON.stringify({ ...settings, async: true }),
  });
}

export function getTaskProgress<T = unknown>(taskId: string) {
  return requestJson<{ task: TaskProgressInfo<T> }>(`/api/tasks/${encodeURIComponent(taskId)}`);
}

export function previewFrame(settings: ProcessSettings & { sample_time: number }) {
  return requestJson<{ preview: PreviewInfo }>("/api/preview-frame", {
    method: "POST",
    body: JSON.stringify(settings),
  });
}

export function rematteJobFrames(jobId: string, frameIndices: number[], settings: ProcessSettings) {
  return requestJson<{ job: JobInfo }>("/api/job/rematte-frames", {
    method: "POST",
    body: JSON.stringify({ ...settings, job_id: jobId, frame_indices: frameIndices }),
  });
}

export function smartSelectJobFrames(jobId: string, targetCount: number) {
  return requestJson<SmartSelectResult>("/api/job/smart-select", {
    method: "POST",
    body: JSON.stringify({ job_id: jobId, target_count: targetCount }),
  });
}

export function exportJob(jobId: string, selectedIndices: number[], sheetColumns: number, videoDurationMs: number, compression: ExportCompressionSettings) {
  return requestJson<{ export: ExportInfo }>("/api/export", {
    method: "POST",
    body: JSON.stringify({
      job_id: jobId,
      selected_indices: selectedIndices,
      sheet_columns: sheetColumns,
      video_duration_ms: videoDurationMs,
      compression,
    }),
  });
}

export function savePreview(previewId: string) {
  return requestJson<{ job: JobInfo }>("/api/save-preview", {
    method: "POST",
    body: JSON.stringify({ preview_id: previewId }),
  });
}

export function previewGreenToBlack(previewId: string, threshold = 42, dominance = 24) {
  return requestJson<{ preview: PreviewInfo }>("/api/preview-green-to-black", {
    method: "POST",
    body: JSON.stringify({ preview_id: previewId, threshold, dominance }),
  });
}

export interface PoseKeypoint {
  name: string;
  x: number; // 归一化 [0,1]
  y: number; // 归一化 [0,1]
  score: number;
}

export interface PoseDetectResult {
  keypoints: PoseKeypoint[];
  score: number;
  width: number;
  height: number;
}

// 姿态关键点检测：优先传 base64 dataUrl（骨骼切片来源可能是去底图或原图，已在前端加载）
export function poseDetect(imageDataUrl: string) {
  return requestJson<PoseDetectResult>("/api/pose-detect", {
    method: "POST",
    body: JSON.stringify({ image_data_url: imageDataUrl }),
  });
}

export function downloadPoseModel() {
  return requestJson<{ task: TaskProgressInfo<{ model_key: string; weight_path: string; after: EnvCheckResult }> }>("/api/models/download-pose", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function previewSemitransparentToBlack(previewId: string, alphaMin = 1, alphaMax = 254) {
  return requestJson<{ preview: PreviewInfo }>("/api/preview-semitransparent-to-black", {
    method: "POST",
    body: JSON.stringify({ preview_id: previewId, alpha_min: alphaMin, alpha_max: alphaMax }),
  });
}

export function previewSemitransparentToOpaque(previewId: string, alphaMin = 1, alphaMax = 254) {
  return requestJson<{ preview: PreviewInfo }>("/api/preview-semitransparent-to-opaque", {
    method: "POST",
    body: JSON.stringify({ preview_id: previewId, alpha_min: alphaMin, alpha_max: alphaMax }),
  });
}

export function openPath(path: string) {
  return requestJson<Record<string, never>>("/api/open-path", {
    method: "POST",
    body: JSON.stringify({ path }),
  });
}

export function checkEnv() {
  return requestJson<EnvCheckResult>("/api/env/check");
}

export function installMissingEnvPackages() {
  return requestJson<{ installed: string[]; stdout: string; stderr: string; after: EnvCheckResult }>("/api/env/install", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function installCorridorKey() {
  return requestJson<{ task: TaskProgressInfo<{ path: string; after: EnvCheckResult }> }>("/api/env/install-corridorkey", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function downloadModel(modelKey: string) {
  return requestJson<{ task: TaskProgressInfo<{ model_key: string; cache_path: string; after: EnvCheckResult }> }>("/api/models/download", {
    method: "POST",
    body: JSON.stringify({ model_key: modelKey }),
  });
}

export async function resolveMediaUrl(url: string) {
  return resolveApiPath(url);
}
