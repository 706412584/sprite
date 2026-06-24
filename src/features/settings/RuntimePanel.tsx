import { useCallback, useEffect, useState } from "react";

import { useAppState, useAppActions } from "@/state/AppContext";
import { ToolPageShell } from "@/components/ui/ToolPageShell";
import { getMcpStatus, type McpStatusInfo } from "@/api/spriteApi";
import { EnvCheckPanel } from "./EnvCheckPanel";

const MCP_LABELS: Record<McpStatusInfo["state"], { text: string; cls: string }> = {
  running: { text: "MCP 运行中", cls: "ok" },
  ready: { text: "MCP 就绪（未连接）", cls: "idle" },
  unavailable: { text: "MCP 不可用", cls: "off" },
};

function McpStatusBadge({ status }: { status: McpStatusInfo | null }) {
  if (!status) return <span className="status-badge idle">MCP 状态查询中…</span>;
  const label = MCP_LABELS[status.state] ?? MCP_LABELS.unavailable;
  const since = status.seconds_since_heartbeat;
  const title = status.running && since != null ? `${since}s 前心跳` : status.script_path;
  return <span className={`status-badge ${label.cls}`} title={title}>{label.text}</span>;
}

export function RuntimePanel() {
  const { desktopApi, runtime, version, logFiles, selectedLog, logText, busy } = useAppState();
  const { refreshRuntime, readSelectedLog, restartServer } = useAppActions();
  const [mcp, setMcp] = useState<McpStatusInfo | null>(null);

  const pythonConnected = desktopApi ? Boolean(runtime?.serverRunning) : version !== "Python 服务未连接";
  const apiAddress = runtime?.serverUrl || (pythonConnected ? "Vite proxy → http://127.0.0.1:8894" : "-");

  const refreshMcp = useCallback(async () => {
    try {
      setMcp(await getMcpStatus());
    } catch {
      setMcp({
        state: "unavailable",
        running: false,
        sdk_installed: false,
        script_exists: false,
        script_path: "-",
        api_base: null,
        backend_api_base: null,
        seconds_since_heartbeat: null,
        last_heartbeat: null,
      });
    }
  }, []);

  // 轮询 MCP 状态：心跳每 10s 一次，这里 8s 刷新一次即可及时反映启动/掉线。
  useEffect(() => {
    refreshMcp();
    const timer = window.setInterval(refreshMcp, 8000);
    return () => window.clearInterval(timer);
  }, [refreshMcp]);

  return (
    <ToolPageShell
      title="运行时诊断"
      subtitle="Python 服务、模型缓存与 MCP 服务状态"
      status={<McpStatusBadge status={mcp} />}
      actions={
        <>
          <button onClick={() => { refreshRuntime(); refreshMcp(); }}>刷新诊断</button>
          <button onClick={restartServer} disabled={!desktopApi || busy}>重启 Python</button>
          <button onClick={() => readSelectedLog()} disabled={!desktopApi || !selectedLog}>读取日志</button>
        </>
      }
    >
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

      <div className="runtime-grid">
        <span>MCP：{mcp ? MCP_LABELS[mcp.state]?.text ?? "未知" : "查询中…"}</span>
        <span>MCP 地址：{mcp?.api_base || mcp?.backend_api_base || "-"}</span>
        <span>MCP SDK：{mcp?.sdk_installed ? "已安装" : "未安装"}</span>
        <span>工具数：{mcp?.last_heartbeat?.tool_count ?? "-"}</span>
        <span>最近心跳：{mcp?.seconds_since_heartbeat != null ? `${mcp.seconds_since_heartbeat}s 前` : "无"}</span>
        <span>MCP 脚本：{mcp?.script_path || "-"}</span>
        {mcp?.last_heartbeat?.pid != null && <span>进程 PID：{mcp.last_heartbeat.pid}</span>}
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
    </ToolPageShell>
  );
}
