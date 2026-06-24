const BASE_URL_KEY = "layout-editor-spriteflow-openai-base-url";
const API_KEY_KEY = "layout-editor-spriteflow-openai-api-key";
const TIMEOUT_KEY = "layout-editor-spriteflow-openai-timeout-ms";

export interface DesktopAiSettingsSnapshot {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
}

export interface DesktopSettingsSnapshot {
  ai: DesktopAiSettingsSnapshot;
}

export function getDesktopSettingsSnapshot(): DesktopSettingsSnapshot {
  const timeoutMs = Number(localStorage.getItem(TIMEOUT_KEY));
  return {
    ai: {
      baseUrl: localStorage.getItem(BASE_URL_KEY) || localStorage.getItem("spriteflow-openai-base-url") || "",
      apiKey: localStorage.getItem(API_KEY_KEY) || localStorage.getItem("spriteflow-openai-api-key") || "",
      timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 600000,
    },
  };
}

export function saveDesktopAiSettings(settings: Partial<DesktopAiSettingsSnapshot>) {
  if (typeof settings.baseUrl === "string") {
    localStorage.setItem(BASE_URL_KEY, settings.baseUrl);
  }
  if (typeof settings.apiKey === "string") {
    localStorage.setItem(API_KEY_KEY, settings.apiKey);
  }
  if (typeof settings.timeoutMs === "number" && Number.isFinite(settings.timeoutMs)) {
    localStorage.setItem(TIMEOUT_KEY, String(settings.timeoutMs));
  }
}
