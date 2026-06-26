const { app, BrowserWindow, dialog, ipcMain, protocol, shell } = require("electron");
const { spawn, execFileSync, execSync } = require("node:child_process");
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
  getMcpScriptPath,
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
let mcpProcess = null;
let lastServerError = null;

function installGlobalErrorHandlers() {
  process.on("uncaughtException", (error) => {
    lastServerError = error?.message || String(error);
    logLine("main.log", `uncaughtException: ${error?.stack || error}`);
  });

  process.on("unhandledRejection", (reason) => {
    const message = reason instanceof Error ? reason.stack || reason.message : String(reason);
    lastServerError = message;
    logLine("main.log", `unhandledRejection: ${message}`);
  });
}

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

// 强制结束指定进程及其整棵子进程树。打包环境里 Python 可能再 fork 子进程，
// 只 kill 顶层进程会留下孤儿进程继续占用端口、提供旧代码。
function killProcessTree(pid) {
  if (!pid) return;
  try {
    if (process.platform === "win32") {
      execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      process.kill(pid, "SIGKILL");
    }
  } catch {}
}

function waitForProcessExit(proc, timeoutMs = 5000) {
  if (!proc || proc.exitCode !== null || proc.signalCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    proc.once("exit", finish);
    setTimeout(finish, timeoutMs);
  });
}

// 清理任何仍在监听后端端口的残留进程（上次未正常退出的孤儿）。
function freeServerPort(port) {
  if (process.platform !== "win32") return;
  try {
    const out = execSync("netstat -ano -p tcp", { encoding: "utf8", windowsHide: true });
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      const match = line.match(/^\s*TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)/i);
      if (match && Number(match[1]) === Number(port)) {
        const pid = match[2];
        if (pid && pid !== String(process.pid)) pids.add(pid);
      }
    }
    for (const pid of pids) {
      logLine("main.log", `reaping stale process on port ${port}: pid=${pid}`);
      killProcessTree(pid);
    }
  } catch (error) {
    logLine("main.log", `freeServerPort error: ${error?.message || error}`);
  }
}

function startPythonServer() {
  if (serverProcess && !serverProcess.killed) {
    return serverProcess;
  }
  freeServerPort(defaultServerPort);

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
  logLine("main.log", `python server env: ffmpegDir=${ffmpegDir || "(empty)"} modelCacheDir=${modelCacheDir} runtimeDir=${runtimeDir}`);
  serverProcess = spawn(pythonCommand, [serverScriptPath, "--serve", "--host", "127.0.0.1", "--port", String(defaultServerPort)], {
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

async function stopPythonServer() {
  const proc = serverProcess;
  serverProcess = null;
  if (proc && !proc.killed) {
    killProcessTree(proc.pid);
    await waitForProcessExit(proc);
  }
  freeServerPort(defaultServerPort);
}

// 退出场景下的同步收尾：来不及 await，直接对整棵树发 taskkill。
function stopPythonServerSync() {
  const proc = serverProcess;
  serverProcess = null;
  if (proc && !proc.killed) {
    killProcessTree(proc.pid);
  }
  freeServerPort(defaultServerPort);
}

// 顺带启动 MCP 服务（stdio）。装机版里没有外部 MCP 客户端来拉起它，
// 所以由主进程启动一份，让它向后端发心跳，运行时面板即可显示"MCP 运行中"。
// 关键：stdin 必须保持 pipe 打开，否则 stdio 服务读到 EOF 会立刻退出。
function startMcpServer() {
  if (mcpProcess && !mcpProcess.killed) {
    return mcpProcess;
  }

  const pythonCommand = getPythonCommand();
  const mcpScriptPath = getMcpScriptPath();
  if (!fs.existsSync(mcpScriptPath)) {
    logLine("main.log", `mcp script not found: ${mcpScriptPath}`);
    return null;
  }

  const log = createLogStream("mcp-server.log");
  const env = {
    ...process.env,
    SPRITE_VIDEO_LAB_API_BASE: getServerUrl(),
    SPRITE_VIDEO_LAB_PORT: String(defaultServerPort),
  };

  logLine("main.log", `starting mcp server: ${pythonCommand} ${mcpScriptPath}`);
  logLine("main.log", `mcp env: apiBase=${getServerUrl()} port=${defaultServerPort}`);
  mcpProcess = spawn(pythonCommand, [mcpScriptPath], {
    cwd: path.dirname(mcpScriptPath),
    env,
    // stdin 保持 pipe 并一直不关闭，让 stdio MCP 服务常驻、持续心跳。
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });

  mcpProcess.stdout.on("data", (chunk) => log.write(`${timestampPrefix()} [stdout] ${chunk.toString("utf8")}`));
  mcpProcess.stderr.on("data", (chunk) => log.write(`${timestampPrefix()} [stderr] ${chunk.toString("utf8")}`));
  mcpProcess.on("error", (error) => {
    logLine("main.log", `mcp server error: ${error.stack || error.message}`);
  });
  mcpProcess.on("exit", (code, signal) => {
    logLine("main.log", `mcp server exited code=${code ?? "null"} signal=${signal ?? "null"}`);
    log.end();
    mcpProcess = null;
  });

  return mcpProcess;
}

function stopMcpServer() {
  if (mcpProcess && !mcpProcess.killed) {
    mcpProcess.kill();
  }
  mcpProcess = null;
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
  startMcpServer();

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
    stopMcpServer();
    await stopPythonServer();
    startPythonServer();
    await waitForServer();
    startMcpServer();
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

installGlobalErrorHandlers();

app.whenReady().then(() => {
  registerAppProtocol();
  wireIpc();
  createWindow().catch((error) => {
    lastServerError = error.message;
    logLine("main.log", error.stack || error.message);
  });
});

app.on("window-all-closed", () => {
  stopMcpServer();
  stopPythonServerSync();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  stopMcpServer();
  stopPythonServerSync();
});
