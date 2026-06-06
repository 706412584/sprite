import { useAppState, useAppActions } from "@/state/AppContext";
import { EnvCheckPanel } from "./EnvCheckPanel";

export function RuntimePanel() {
  const { desktopApi, runtime, version, logFiles, selectedLog, logText, busy } = useAppState();
  const { refreshRuntime, readSelectedLog, restartServer } = useAppActions();

  const pythonConnected = desktopApi ? Boolean(runtime?.serverRunning) : version !== "Python 服务未连接";
  const apiAddress = runtime?.serverUrl || (pythonConnected ? "Vite proxy → http://127.0.0.1:8894" : "-");

  return (
    <section className="panel">
      <h3>运行时诊断</h3>
      <div className="runtime-grid">
        <span>模式：{desktopApi ? "Electron 桌面" : "浏览器 / Vite"}</span>
        <span>Python：{pythonConnected ? "已连接" : "未连接"}</span>
        <span>地址：{apiAddress}</span>
        <span>版本：{version}</span>
        <span>Python 命令：{runtime?.pythonCommand || (desktopApi ? "-" : "仅桌面模式")}</span>
        <span>用户数据：{runtime?.userDataDir || (desktopApi ? "-" : "仅桌面模式")}</span>
        <span>模型缓存：{runtime?.modelCacheDir || (desktopApi ? "-" : "仅桌面模式")}</span>
        {runtime?.lastError && <span>最近错误：{runtime.lastError}</span>}
      </div>
      <div className="export-actions">
        <button onClick={refreshRuntime}>刷新诊断</button>
        <button onClick={restartServer} disabled={!desktopApi || busy}>重启 Python</button>
        <button onClick={() => readSelectedLog()} disabled={!desktopApi || !selectedLog}>读取日志</button>
      </div>
      {logFiles.length > 0 && (
        <div className="log-tabs">
          {logFiles.map((fileName) => (
            <button
              key={fileName}
              className={fileName === selectedLog ? "selected" : ""}
              onClick={() => readSelectedLog(fileName)}
            >
              {fileName}
            </button>
          ))}
        </div>
      )}
      {logText && <pre className="log-view">{logText}</pre>}

      {/* 环境检测 */}
      <EnvCheckPanel />
    </section>
  );
}
