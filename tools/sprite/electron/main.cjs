const { app, BrowserWindow, dialog, ipcMain, protocol, shell } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const {
  appDisplayName,
  defaultServerPort,
  getDistDir,
  getFfmpegDir,
  getLogDir,
  getModelCacheDir,
  getPythonCommand,
  getRuntimeDir,
  getServerScriptPath,
  resolveLogPath,
} = require("./runtimeConfig.cjs");

const APP_PROTOCOL = "sprite-lab";

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_PROTOCOL,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
]);

let mainWindow = null;
let serverProcess = null;
let lastServerError = null;

function timestampPrefix() {
  return `[${new Date().toISOString()}]`;
}

function createLogStream(fileName) {
  return fs.createWriteStream(resolveLogPath(fileName), { flags: "a" });
}

function logLine(fileName, line) {
  try {
    fs.appendFileSync(resolveLogPath(fileName), `${timestampPrefix()} ${line}\n`, "utf8");
  } catch {}
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".js") return "text/javascript; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".ico") return "image/x-icon";
  return "application/octet-stream";
}

function registerAppProtocol() {
  protocol.handle(APP_PROTOCOL, async (request) => {
    const requestUrl = new URL(request.url);
    const relativePath = decodeURIComponent(requestUrl.pathname.replace(/^\/+/, "")) || "index.html";
    const distDir = getDistDir();
    const targetPath = path.resolve(distDir, relativePath);
    if (!targetPath.startsWith(path.resolve(distDir))) {
      return new Response("Forbidden", { status: 403 });
    }
    const filePath = fs.existsSync(targetPath) && fs.statSync(targetPath).isFile() ? targetPath : path.join(distDir, "index.html");
    if (!fs.existsSync(filePath)) {
      return new Response("dist not found. Run npm run build first.", { status: 404 });
    }
    return new Response(fs.readFileSync(filePath), {
      headers: { "Content-Type": contentTypeFor(filePath) },
    });
  });
}

function getServerUrl() {
  return `http://127.0.0.1:${defaultServerPort}`;
}

function waitForServer(timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  const serverUrl = getServerUrl();
  return new Promise((resolve) => {
    const attempt = () => {
      const request = http.get(`${serverUrl}/api/app-version`, (response) => {
        response.resume();
        resolve(true);
      });
      request.on("error", () => {
        if (Date.now() >= deadline) {
          resolve(false);
        } else {
          setTimeout(attempt, 350);
        }
      });
      request.setTimeout(1200, () => {
        request.destroy();
      });
    };
    attempt();
  });
}

function startPythonServer() {
  if (serverProcess && !serverProcess.killed) {
    return serverProcess;
  }

  const pythonCommand = getPythonCommand();
  const serverScriptPath = getServerScriptPath();
  const stdout = createLogStream("python-server.log");
  const stderr = createLogStream("python-server.log");
  const ffmpegDir = getFfmpegDir();
  const modelCacheDir = getModelCacheDir();
  const runtimeDir = getRuntimeDir();

  const env = {
    ...process.env,
    SPRITE_VIDEO_LAB_HOST: "127.0.0.1",
    SPRITE_VIDEO_LAB_PORT: String(defaultServerPort),
    SPRITE_VIDEO_LAB_AI_MODEL_CACHE: modelCacheDir,
    HF_HOME: modelCacheDir,
    TORCH_HOME: path.join(modelCacheDir, "torch"),
    SPRITE_VIDEO_LAB_DESKTOP_RUNTIME_DIR: runtimeDir,
  };
  if (ffmpegDir) {
    env.SPRITE_VIDEO_LAB_FFMPEG_DIR = ffmpegDir;
  }

  logLine("main.log", `starting python server: ${pythonCommand} ${serverScriptPath}`);
  serverProcess = spawn(pythonCommand, [serverScriptPath, "--host", "127.0.0.1", "--port", String(defaultServerPort)], {
    cwd: path.dirname(serverScriptPath),
    env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  serverProcess.stdout.on("data", (chunk) => stdout.write(`${timestampPrefix()} [stdout] ${chunk.toString("utf8")}`));
  serverProcess.stderr.on("data", (chunk) => stderr.write(`${timestampPrefix()} [stderr] ${chunk.toString("utf8")}`));
  serverProcess.on("error", (error) => {
    lastServerError = error.message;
    logLine("main.log", `python server error: ${error.stack || error.message}`);
  });
  serverProcess.on("exit", (code, signal) => {
    logLine("main.log", `python server exited code=${code ?? "null"} signal=${signal ?? "null"}`);
    stdout.end();
    stderr.end();
    serverProcess = null;
  });

  return serverProcess;
}

function stopPythonServer() {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
  }
  serverProcess = null;
}

function getRuntimeStatus() {
  return {
    isDesktop: true,
    serverRunning: Boolean(serverProcess && !serverProcess.killed),
    serverUrl: getServerUrl(),
    pythonCommand: getPythonCommand(),
    userDataDir: app.getPath("userData"),
    modelCacheDir: getModelCacheDir(),
    lastError: lastServerError,
  };
}

async function createWindow() {
  startPythonServer();
  await waitForServer();

  mainWindow = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1180,
    minHeight: 720,
    title: appDisplayName,
    icon: path.join(__dirname, "..", "build", "icon.png"),
    backgroundColor: "#08111f",
    autoHideMenuBar: true,
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#08111f",
      symbolColor: "#cccccc",
      height: 40,
    },
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  await mainWindow.loadURL(`${APP_PROTOCOL}://app/index.html`);
  mainWindow.maximize();
}

function readLogTail(filePath, lines = 200) {
  if (!fs.existsSync(filePath)) return "";
  const content = fs.readFileSync(filePath, "utf8");
  return content.split(/\r?\n/).slice(-Math.max(1, lines)).join("\n");
}

function wireIpc() {
  ipcMain.on("sprite:renderer-log", (_event, payload) => {
    logLine("renderer.log", JSON.stringify(payload));
  });

  ipcMain.handle("sprite:runtime:get-status", () => getRuntimeStatus());

  ipcMain.handle("sprite:runtime:restart-server", async () => {
    stopPythonServer();
    startPythonServer();
    await waitForServer();
    return getRuntimeStatus();
  });

  ipcMain.handle("sprite:dialog:choose-video", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "选择视频、图片或序列帧",
      properties: ["openFile"],
      filters: [
        { name: "素材文件", extensions: ["mp4", "mov", "mkv", "webm", "png", "jpg", "jpeg", "webp", "bmp"] },
        { name: "所有文件", extensions: ["*"] },
      ],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle("sprite:dialog:choose-directory", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "选择目录",
      properties: ["openDirectory"],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle("sprite:open-path", async (_event, targetPath) => {
    if (typeof targetPath !== "string" || !targetPath.trim()) return;
    await shell.openPath(targetPath);
  });

  ipcMain.handle("sprite:logs:list", () => {
    const logDir = getLogDir();
    if (!fs.existsSync(logDir)) return [];
    return fs.readdirSync(logDir).filter((name) => name.endsWith(".log"));
  });

  ipcMain.handle("sprite:logs:read", (_event, fileName, lines) => {
    const safeName = path.basename(String(fileName || ""));
    return readLogTail(path.join(getLogDir(), safeName), Number(lines) || 200);
  });
}

app.whenReady().then(() => {
  registerAppProtocol();
  wireIpc();
  createWindow().catch((error) => {
    lastServerError = error.message;
    logLine("main.log", error.stack || error.message);
  });
});

app.on("window-all-closed", () => {
  stopPythonServer();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  stopPythonServer();
});
