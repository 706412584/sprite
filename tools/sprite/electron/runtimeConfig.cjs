const { app } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const appDisplayName = "精灵动画工坊";
const defaultServerPort = 8894;

function getProjectRoot() {
  return path.resolve(__dirname, "..");
}

function getUnpackedRoot() {
  if (!app.isPackaged) {
    return getProjectRoot();
  }
  return path.join(process.resourcesPath, "app.asar.unpacked");
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getUserDataDir() {
  return ensureDir(app.getPath("userData"));
}

function getRuntimeDir() {
  const dir = app.isPackaged ? path.join(getUserDataDir(), "runtime") : path.join(getProjectRoot(), "work", "desktop-runtime");
  return ensureDir(dir);
}

function getLogDir() {
  return ensureDir(path.join(getRuntimeDir(), "logs"));
}

function resolveLogPath(fileName) {
  return path.join(getLogDir(), fileName);
}

function getModelCacheDir() {
  return ensureDir(path.join(getUserDataDir(), "models"));
}

function getDistDir() {
  return path.join(getProjectRoot(), "dist");
}

function getServerScriptPath() {
  const unpackedServer = path.join(getUnpackedRoot(), "server.py");
  if (fs.existsSync(unpackedServer)) {
    return unpackedServer;
  }
  return path.join(getProjectRoot(), "server.py");
}

function getPythonCommand() {
  return process.env.SPRITE_VIDEO_LAB_PYTHON || process.env.PYTHON || "python";
}

function getFfmpegDir() {
  const configured = process.env.SPRITE_VIDEO_LAB_FFMPEG_DIR;
  if (configured) {
    return configured;
  }
  const bundled = path.join(getUnpackedRoot(), "runtime", "ffmpeg", "win-x64");
  return fs.existsSync(bundled) ? bundled : "";
}

module.exports = {
  appDisplayName,
  defaultServerPort,
  getProjectRoot,
  getUnpackedRoot,
  getDistDir,
  getServerScriptPath,
  getPythonCommand,
  getFfmpegDir,
  getRuntimeDir,
  getLogDir,
  resolveLogPath,
  getModelCacheDir,
};
