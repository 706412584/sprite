const { contextBridge, ipcRenderer } = require("electron");

function sendRendererLog(level, payload) {
  try {
    ipcRenderer.send("sprite:renderer-log", {
      level,
      payload,
      sentAt: new Date().toISOString(),
    });
  } catch {}
}

window.addEventListener("error", (event) => {
  sendRendererLog("error", {
    source: "window-error",
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    stack: event.error?.stack || null,
  });
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  sendRendererLog("error", {
    source: "window-unhandledrejection",
    message: reason?.message || String(reason),
    stack: reason?.stack || null,
  });
});

try {
  contextBridge.exposeInMainWorld("spriteDesktop", {
    platform: process.platform,
    isDesktopApp: true,
    getRuntimeStatus: () => ipcRenderer.invoke("sprite:runtime:get-status"),
    restartServer: () => ipcRenderer.invoke("sprite:runtime:restart-server"),
    chooseVideo: () => ipcRenderer.invoke("sprite:dialog:choose-video"),
    chooseDirectory: () => ipcRenderer.invoke("sprite:dialog:choose-directory"),
    openPath: (targetPath) => ipcRenderer.invoke("sprite:open-path", targetPath),
    listLogs: () => ipcRenderer.invoke("sprite:logs:list"),
    readLog: (fileName, lines) => ipcRenderer.invoke("sprite:logs:read", fileName, lines),
  });
} catch (error) {
  sendRendererLog("error", {
    source: "preload-expose-failed",
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : null,
  });
  contextBridge.exposeInMainWorld("spriteDesktop", {
    platform: process.platform,
    isDesktopApp: true,
    preloadError: error instanceof Error ? error.message : String(error),
  });
}
