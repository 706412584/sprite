export interface SpriteDesktopApi {
  platform: string;
  isDesktopApp: boolean;
  getRuntimeStatus: () => Promise<RuntimeStatus>;
  restartServer: () => Promise<RuntimeStatus>;
  chooseVideo: () => Promise<string | null>;
  chooseDirectory: () => Promise<string | null>;
  openPath: (path: string) => Promise<void>;
  listLogs: () => Promise<string[]>;
  readLog: (fileName: string, lines?: number) => Promise<string>;
}

export interface RuntimeStatus {
  isDesktop: boolean;
  serverRunning: boolean;
  serverUrl: string;
  pythonCommand: string | null;
  userDataDir: string | null;
  modelCacheDir: string | null;
  lastError?: string | null;
}

declare global {
  interface Window {
    spriteDesktop?: SpriteDesktopApi;
  }
}

export function getDesktopApi() {
  return window.spriteDesktop ?? null;
}
