/**
 * SpriteFlow client for OpenAI-compatible image APIs (New API / OneAPI style).
 *
 * Endpoints used:
 *  - POST {baseUrl}/images/generations
 *  - POST {baseUrl}/images/edits
 *  - POST {baseUrl}/chat/completions (optional rewrite step)
 */

import type {
  GridConfig,
  SpriteFlowClientConfig,
  SpriteFlowGenerateInput,
  SpriteFlowGenerateResult,
  SpriteFlowProgressEvent,
} from "./types";
import { getGridMetrics } from "./types";
import { buildRewriteSystemPrompt, buildRewriteUserPrompt, buildSpritePrompt, makeDefaultPrompt } from "./promptBuilder";
import { sliceSpriteSheet } from "./slicer";

const RELAY_PATH = "/__sf_relay__";

declare global {
  interface Window {
    layoutEditorHost?: { isDesktopApp?: boolean };
  }
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

function shouldUseRelay(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.spriteDesktop || window.layoutEditorHost;
  if (host?.isDesktopApp) return false;
  const origin = window.location?.origin || "";
  return /^https?:/.test(origin);
}

function jsonHeaders(apiKey: string): HeadersInit {
  return { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` };
}

function flattenHeaders(headers: HeadersInit | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers) return out;
  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      out[key] = value;
    });
  } else if (Array.isArray(headers)) {
    for (const [key, value] of headers) out[key] = value;
  } else {
    Object.assign(out, headers as Record<string, string>);
  }
  return out;
}

async function formDataToRelayBody(form: FormData): Promise<{ body: string; files: Array<{ name: string; filename: string; type: string; dataUrl: string }> }> {
  const body: Record<string, string> = {};
  const files: Array<{ name: string; filename: string; type: string; dataUrl: string }> = [];
  for (const [name, value] of form.entries()) {
    if (typeof value !== "string") {
      const file = value;
      const dataUrl = await blobToDataUrl(file);
      files.push({ name, filename: file.name || `${name}.png`, type: file.type || "application/octet-stream", dataUrl });
    } else {
      body[name] = String(value);
    }
  }
  return { body: JSON.stringify(body), files };
}

async function relayedFetch(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    if (!shouldUseRelay()) return await fetch(url, { ...init, signal: controller.signal });

    const payload: Record<string, unknown> = {
      url,
      method: (init.method || "GET").toUpperCase(),
      headers: flattenHeaders(init.headers),
      timeoutMs,
    };

    if (init.body instanceof FormData) {
      const multipart = await formDataToRelayBody(init.body);
      payload.body = multipart.body;
      payload.files = multipart.files;
      payload.encoding = "multipart-data-url";
    } else if (typeof init.body === "string") {
      payload.body = init.body;
    }

    return await fetch(RELAY_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timer);
  }
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  try {
    return await relayedFetch(url, init, timeoutMs);
  } catch (error) {
    const e = error as Error;
    if (e.name === "AbortError") throw new Error("请求超时。可以尝试增加超时时间，或换用更快的图像模型。");
    throw e;
  }
}

async function readJson(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function pickError(payload: any, fallback: string): string {
  if (typeof payload?.error?.message === "string") return normalizeUpstreamError(payload.error.message);
  if (typeof payload?.error === "string") return normalizeUpstreamError(payload.error);
  if (typeof payload?.message === "string") return normalizeUpstreamError(payload.message);
  if (typeof payload?.raw === "string") return normalizeUpstreamError(payload.raw.slice(0, 400));
  return fallback;
}

function normalizeUpstreamError(message: string): string {
  if (/Target host not allowed/i.test(message)) {
    return "当前 API 的域名被开发代理白名单拦截。SpriteFlow 会优先使用本地 SpriteFlow API 设置；如果这是你要用的接口，请把该域名加入 VITE_SPRITEFLOW_PROXY_HOSTS 后重启 dev server，或清空 SpriteFlow 本地 API 让它回退到全局设置。";
  }
  if (/Relay upstream error:\s*read ECONNRESET/i.test(message) || /\bECONNRESET\b/i.test(message)) {
    return "上游图像网关中途断开连接（ECONNRESET）。这通常不是本地尺寸校验错误，而是出图耗时过长、网关负载/限流、图片编辑文件过大，或模型不接受当前参数导致连接被重置。可以先重试一次；如果持续出现，建议把 size 设为 auto、关闭参考图编辑或透明背景，或增大设置里的超时时间。";
  }
  if (/Relay upstream error:\s*Upstream timeout/i.test(message) || /Upstream timeout/i.test(message)) {
    return "上游图像网关响应超时。可以在设置里增大 AI 超时时间，或换用更快的图像模型/更小的输出尺寸。";
  }
  return message;
}

function shouldRetryWithMinimalImagePayload(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || "");
  return /ECONNRESET|connection was reset|unsupported.*response_format|unsupported.*background|unknown parameter|unrecognized parameter/i.test(message);
}

function buildImageGenerationBody(config: SpriteFlowClientConfig, prompt: string, size: string, transparentBackground: boolean, minimal: boolean): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: config.imageModel,
    prompt,
    n: 1,
    size,
  };
  if (!minimal) {
    body.response_format = "b64_json";
    if (transparentBackground) body.background = "transparent";
  }
  return body;
}

function defaultSize(): string {
  return "1024x1024";
}

function gridLabel(gridConfig: GridConfig): string {
  return getGridMetrics(gridConfig).label;
}

function extractRewrittenText(payload: any): string {
  const c = payload?.choices?.[0]?.message?.content;
  if (typeof c === "string") return c.trim();
  if (Array.isArray(c)) {
    return c.map((part: any) => (typeof part === "string" ? part : part?.text || "")).filter(Boolean).join(" ").trim();
  }
  return "";
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error("读取图片失败"));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(blob);
  });
}

async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type || "image/png" });
}

async function urlToDataUrl(url: string, timeoutMs: number): Promise<string> {
  const res = await fetchWithTimeout(url, { method: "GET" }, Math.max(120000, timeoutMs));
  if (!res.ok) throw new Error(`图片下载失败（${res.status}）`);
  return await blobToDataUrl(await res.blob());
}

async function normalizeReferenceImage(referenceImage: string): Promise<File> {
  if (referenceImage.startsWith("data:")) return await dataUrlToFile(referenceImage, "reference.png");
  const dataUrl = await urlToDataUrl(referenceImage, 120000);
  return await dataUrlToFile(dataUrl, "reference.png");
}

async function rewritePrompt(
  config: SpriteFlowClientConfig,
  basePrompt: string,
  gridConfig: GridConfig,
  actions: SpriteFlowGenerateInput["actions"],
): Promise<{ ok: true; text: string } | { ok: false; warning: string }> {
  if (!config.chatModel) return { ok: false, warning: "已跳过提示词重写：未配置聊天模型" };
  const url = `${trimSlash(config.baseUrl)}/chat/completions`;
  try {
    const res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: jsonHeaders(config.apiKey),
        body: JSON.stringify({
          model: config.chatModel,
          messages: [
            { role: "system", content: buildRewriteSystemPrompt(gridConfig) },
            { role: "user", content: buildRewriteUserPrompt(basePrompt, gridConfig, actions) },
          ],
          temperature: 0.65,
          max_tokens: 600,
        }),
      },
      Math.min(180000, config.timeoutMs ?? 180000),
    );
    const data = await readJson(res);
    if (!res.ok) return { ok: false, warning: `已跳过提示词重写：${pickError(data, "重写失败")}` };
    const text = extractRewrittenText(data);
    if (!text) return { ok: false, warning: "提示词重写结果为空，已保留原始描述" };
    return { ok: true, text };
  } catch (e) {
    return { ok: false, warning: `已跳过提示词重写：${(e as Error).message}` };
  }
}

export async function rewriteSpritePromptDraft(
  config: SpriteFlowClientConfig,
  basePrompt: string,
  gridConfig: GridConfig,
  actions: SpriteFlowGenerateInput["actions"],
): Promise<string> {
  if (!config.baseUrl) throw new Error("缺少 AI Base URL");
  if (!config.apiKey) throw new Error("缺少 API Key");
  if (!config.chatModel) throw new Error("请先选择提示词重写模型");
  const original = basePrompt.trim() || makeDefaultPrompt();
  const rewrite = await rewritePrompt(config, original, gridConfig, actions);
  if (!rewrite.ok) throw new Error(rewrite.warning);
  return rewrite.text;
}

interface ImagesResponse {
  data?: Array<{ url?: string; b64_json?: string }>;
}

async function imageResponseToDataUrl(data: ImagesResponse, config: SpriteFlowClientConfig): Promise<string> {
  const first = data.data?.[0];
  if (!first) throw new Error("图像接口没有返回数据");
  if (first.b64_json) return `data:image/png;base64,${first.b64_json}`;
  if (first.url) return await urlToDataUrl(first.url, Math.max(120000, config.timeoutMs ?? 120000));
  throw new Error("图像响应缺少 b64_json 或 url");
}

async function generateImage(config: SpriteFlowClientConfig, prompt: string, size: string, transparentBackground: boolean, warnings: string[]): Promise<string> {
  const body = buildImageGenerationBody(config, prompt, size, transparentBackground, false);
  const res = await fetchWithTimeout(
    `${trimSlash(config.baseUrl)}/images/generations`,
    { method: "POST", headers: jsonHeaders(config.apiKey), body: JSON.stringify(body) },
    Math.max(600000, config.timeoutMs ?? 600000),
  );
  const data = (await readJson(res)) as ImagesResponse & Record<string, unknown>;
  if (!res.ok) throw new Error(pickError(data, `Image generation failed (${res.status})`));
  return await imageResponseToDataUrl(data, config);
}

async function generateImageWithCompatibilityFallback(config: SpriteFlowClientConfig, prompt: string, size: string, transparentBackground: boolean, warnings: string[]): Promise<string> {
  try {
    return await generateImage(config, prompt, size, transparentBackground, warnings);
  } catch (error) {
    if (!shouldRetryWithMinimalImagePayload(error)) throw error;
    warnings.push("图像生成请求被上游断开或拒绝可选参数，已自动使用兼容模式重试：仅发送 model/prompt/n/size，不再发送 response_format/background。透明或纯色背景会继续通过提示词约束。");
    const body = buildImageGenerationBody(config, prompt, size, transparentBackground, true);
    const res = await fetchWithTimeout(
      `${trimSlash(config.baseUrl)}/images/generations`,
      { method: "POST", headers: jsonHeaders(config.apiKey), body: JSON.stringify(body) },
      Math.max(600000, config.timeoutMs ?? 600000),
    );
    const data = (await readJson(res)) as ImagesResponse & Record<string, unknown>;
    if (!res.ok) throw new Error(pickError(data, `Image generation failed (${res.status})`));
    return await imageResponseToDataUrl(data, config);
  }
}

async function editImage(
  config: SpriteFlowClientConfig,
  prompt: string,
  referenceImage: string,
  size: string,
  transparentBackground: boolean,
  minimal: boolean,
): Promise<string> {
  const form = new FormData();
  form.set("model", config.imageModel);
  form.set("prompt", prompt);
  form.set("n", "1");
  form.set("size", size);
  if (!minimal) {
    form.set("response_format", "b64_json");
    if (transparentBackground) form.set("background", "transparent");
  }
  form.append("image", await normalizeReferenceImage(referenceImage));

  const res = await fetchWithTimeout(
    `${trimSlash(config.baseUrl)}/images/edits`,
    { method: "POST", headers: { Authorization: `Bearer ${config.apiKey}` }, body: form },
    Math.max(600000, config.timeoutMs ?? 600000),
  );
  const data = (await readJson(res)) as ImagesResponse & Record<string, unknown>;
  if (!res.ok) throw new Error(pickError(data, `Image edit failed (${res.status})`));
  return await imageResponseToDataUrl(data, config);
}

async function editImageWithCompatibilityFallback(config: SpriteFlowClientConfig, prompt: string, referenceImage: string, size: string, transparentBackground: boolean, warnings: string[]): Promise<string> {
  try {
    return await editImage(config, prompt, referenceImage, size, transparentBackground, false);
  } catch (error) {
    if (!shouldRetryWithMinimalImagePayload(error)) throw error;
    warnings.push("图像编辑请求被上游断开或拒绝可选参数，已自动使用兼容模式重试：仅发送 model/prompt/n/size/image，不再发送 response_format/background。");
    return await editImage(config, prompt, referenceImage, size, transparentBackground, true);
  }
}

export async function listImageModels(
  config: Pick<SpriteFlowClientConfig, "baseUrl" | "apiKey" | "timeoutMs">,
): Promise<{ ids: string[]; raw: any }> {
  if (!config.baseUrl) throw new Error("缺少 Base URL");
  if (!config.apiKey) throw new Error("缺少 API Key");
  const res = await fetchWithTimeout(
    `${trimSlash(config.baseUrl)}/models`,
    { method: "GET", headers: { Authorization: `Bearer ${config.apiKey}` } },
    Math.min(60000, config.timeoutMs ?? 60000),
  );
  const data = await readJson(res);
  if (!res.ok) throw new Error(pickError(data, `List models failed (${res.status})`));
  const ids: string[] = Array.isArray(data?.data)
    ? data.data.map((m: any) => (typeof m === "string" ? m : m?.id)).filter((x: any): x is string => typeof x === "string" && x.length > 0)
    : [];
  return { ids, raw: data };
}

export async function generateSpriteSheet(
  config: SpriteFlowClientConfig,
  input: SpriteFlowGenerateInput,
  onProgress?: (event: SpriteFlowProgressEvent) => void,
): Promise<SpriteFlowGenerateResult> {
  if (!config.baseUrl) throw new Error("缺少 AI Base URL");
  if (!config.apiKey) throw new Error("缺少 API Key");
  if (!config.imageModel) throw new Error("缺少图像模型名");

  const warnings: string[] = [];
  const original = input.prompt.trim() || makeDefaultPrompt();
  const gridConfig = input.gridConfig;
  const size = input.size?.trim() || defaultSize();
  const transparent = input.transparentBackground !== false;

  let finalPrompt = input.rewrittenPrompt?.trim() || original;
  if (!input.rewrittenPrompt?.trim() && config.chatModel) {
    onProgress?.({ stage: "rewrite", message: "正在重写提示词..." });
    const rewrite = await rewritePrompt(config, original, gridConfig, input.actions);
    if (rewrite.ok) finalPrompt = rewrite.text;
    else warnings.push(rewrite.warning);
  }

  const composedPrompt = buildSpritePrompt(finalPrompt, gridConfig, input.actions, input.keyingColor, input.direction, input.sizePromptHint, input.backgroundPrompt);
  const useEdit = Boolean(input.referenceImage);
  onProgress?.({
    stage: useEdit ? "edit" : "generate",
    message: useEdit
      ? `正在根据参考图编辑为 ${gridLabel(gridConfig)}（${config.imageModel}）...`
      : `正在生成 ${gridLabel(gridConfig)} 精灵图（${config.imageModel}）...`,
  });

  const dataUrl = useEdit
    ? await editImageWithCompatibilityFallback(config, composedPrompt, input.referenceImage as string, size, transparent, warnings)
    : await generateImageWithCompatibilityFallback(config, composedPrompt, size, transparent, warnings);

  onProgress?.({ stage: "slice", message: "正在切片并检测帧..." });
  const sliced = await sliceSpriteSheet(dataUrl, gridConfig, { rowSliceMode: gridConfig.layout === "square" ? "full-grid" : input.rowSliceMode });
  if (sliced.diagnostic.warnings.length) warnings.push(...sliced.diagnostic.warnings.map((w) => `帧检测：${w}`));

  onProgress?.({ stage: "done", message: "完成", progress: 1 });
  return {
    finalPrompt: composedPrompt,
    originalPrompt: original,
    sheetDataUrl: dataUrl,
    frames: sliced.frames,
    frameWidth: sliced.frameWidth,
    frameHeight: sliced.frameHeight,
    warnings,
    metadata: {
      grid: gridLabel(gridConfig),
      gridConfig,
      frameCount: sliced.frames.length,
      model: config.imageModel,
      size,
      direction: input.direction,
      source: useEdit ? "edit" : "generation",
    },
  };
}
