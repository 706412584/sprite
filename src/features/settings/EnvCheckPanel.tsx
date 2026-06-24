import { useState } from "react";
import { checkEnv, downloadModel, getTaskProgress, installCorridorKey, installMissingEnvPackages } from "@/api/spriteApi";
import type { EnvCheckResult, TaskProgressInfo } from "@/types/sprite";

export function EnvCheckPanel() {
  const [result, setResult] = useState<EnvCheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState("");
  const [installLog, setInstallLog] = useState("");
  const [activeTasks, setActiveTasks] = useState<Record<string, TaskProgressInfo>>({});

  async function refreshEnv() {
    const r = await checkEnv();
    setResult(r);
    return r;
  }

  async function pollTask(taskKey: string, taskId: string) {
    let finished = false;
    try {
      while (!finished) {
        const r = await getTaskProgress(taskId);
        const task = r.task;
        setActiveTasks((current) => ({ ...current, [taskKey]: task }));
        finished = task.status !== "running";
        if (!finished) {
          await new Promise((resolve) => window.setTimeout(resolve, 800));
        }
      }
      await refreshEnv();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function renderTask(task?: TaskProgressInfo) {
    if (!task) return null;
    const recentLogs = (task.logs || []).slice(-4);
    return (
      <div className={`env-task ${task.status}`}>
        <div className="env-progress">
          <div className="env-progress-bar" style={{ width: `${Math.max(0, Math.min(100, task.progress))}%` }} />
        </div>
        <div className="env-task-message">
          {task.message} · {task.progress}%
          {task.error ? ` · ${task.error}` : ""}
        </div>
        {recentLogs.length > 0 && (
          <div className="env-task-log">
            {recentLogs.map((log, index) => (
              <div key={`${log}-${index}`}>{log}</div>
            ))}
          </div>
        )}
      </div>
    );
  }

  async function runCheck() {
    setLoading(true);
    setError("");
    try {
      await refreshEnv();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function installMissing() {
    setInstalling(true);
    setError("");
    setInstallLog("");
    try {
      const r = await installMissingEnvPackages();
      setResult(r.after);
      setInstallLog(r.installed.length > 0 ? `已安装：${r.installed.join(", ")}` : "没有需要安装的缺失包。");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setInstalling(false);
    }
  }

  async function startCorridorKeyInstall() {
    setError("");
    const taskKey = "corridorkey";
    try {
      const r = await installCorridorKey();
      setActiveTasks((current) => ({ ...current, [taskKey]: r.task }));
      await pollTask(taskKey, r.task.task_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function startModelDownload(modelKey: string) {
    setError("");
    const taskKey = `model:${modelKey}`;
    try {
      const r = await downloadModel(modelKey);
      setActiveTasks((current) => ({ ...current, [taskKey]: r.task }));
      await pollTask(taskKey, r.task.task_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const missingPackages = result?.packages.filter((p) => !p.ok) ?? [];
  const missingFfmpeg = result?.ffmpeg.filter((f) => !f.ok) ?? [];
  const missingTools = result?.tools.filter((t) => !t.ok) ?? [];
  const missingModels = result?.models.filter((m) => !m.cached) ?? [];

  return (
    <div className="env-check-panel">
      <div className="env-check-header">
        <button onClick={runCheck} disabled={loading || installing} className="env-check-btn">
          {loading ? "检测中…" : "一键检测环境"}
        </button>
        {missingPackages.length > 0 && (
          <button onClick={installMissing} disabled={loading || installing} className="env-install-btn">
            {installing ? "安装中…" : "安装缺失 Python 包"}
          </button>
        )}
        {result && (
          <span className={`env-status-badge ${result.all_ok ? "ok" : "warn"}`}>
            {result.all_ok ? "环境正常" : `${missingPackages.length + missingFfmpeg.length + missingTools.length} 项缺失`}
          </span>
        )}
      </div>

      {error && <div className="env-error">{error}</div>}
      {installLog && <div className="env-success">{installLog}</div>}

      {result && (
        <div className="env-check-body">

          {/* Python 包 */}
          <div className="env-section">
            <h4>Python 包</h4>
            <div className="env-table">
              {result.packages.map((pkg) => (
                <div key={pkg.name} className={`env-row ${pkg.ok ? "ok" : "fail"}`}>
                  <span className="env-dot">{pkg.ok ? "✓" : "✗"}</span>
                  <span className="env-name">{pkg.name}</span>
                  <span className="env-ver">{pkg.ok ? pkg.version : "未安装"}</span>
                  {!pkg.ok && <code className="env-cmd" title="点击复制" onClick={() => navigator.clipboard?.writeText(pkg.install)}>{pkg.install}</code>}
                </div>
              ))}
            </div>
            {result.batch_install && (
              <div className="env-batch-install">
                <strong>一键安装全部缺失包：</strong>
                <code
                  title="点击复制"
                  onClick={() => navigator.clipboard?.writeText(result.batch_install)}
                >{result.batch_install}</code>
              </div>
            )}
          </div>

          {/* GPU / torch 设备 */}
          <div className="env-section">
            <h4>计算设备</h4>
            <div className="env-row ok">
              <span className="env-dot">●</span>
              <span className="env-name">torch device</span>
              <span className="env-ver">{result.torch_device}</span>
            </div>
          </div>

          {/* ffmpeg */}
          <div className="env-section">
            <h4>ffmpeg</h4>
            <div className="env-table">
              {result.ffmpeg.map((f) => (
                <div key={f.name} className={`env-row ${f.ok ? "ok" : "fail"}`}>
                  <span className="env-dot">{f.ok ? "✓" : "✗"}</span>
                  <span className="env-name">{f.name}</span>
                  <span className="env-ver">{f.ok ? f.version : "未找到"}</span>
                </div>
              ))}
            </div>
            {missingFfmpeg.length > 0 && (
              <div className="env-hint">ffmpeg 未找到，请从 <a href="https://ffmpeg.org/download.html" target="_blank" rel="noreferrer">ffmpeg.org</a> 下载并加入 PATH。</div>
            )}
          </div>

          {/* 外部工具 */}
          <div className="env-section">
            <h4>外部工具</h4>
            <div className="env-table">
              {result.tools.map((tool) => {
                const task = activeTasks["corridorkey"];
                const isRunning = task?.status === "running";
                return (
                  <div key={tool.name} className={`env-resource-card ${tool.ok ? "ok" : "fail"}`}>
                    <div className="env-row-main">
                      <span className="env-dot">{tool.ok ? "✓" : "✗"}</span>
                      <span className="env-name">{tool.name}</span>
                      <span className="env-ver">{tool.ok ? tool.path : "未安装"}</span>
                      {!tool.ok && (
                        <button className="env-dl-link primary" onClick={startCorridorKeyInstall} disabled={isRunning}>
                          {isRunning ? "安装中…" : "一键安装"}
                        </button>
                      )}
                      {!tool.ok && <code className="env-cmd" title="点击复制" onClick={() => navigator.clipboard?.writeText(tool.install)}>{tool.install}</code>}
                    </div>
                    <div className="env-meta">
                      <div>{tool.description || "CorridorKey 是独立源码工具，不是 Python 包，也不是 HuggingFace 模型。"}</div>
                      {tool.size_hint && <div>预计大小：{tool.size_hint}</div>}
                    </div>
                    {renderTask(task)}
                  </div>
                );
              })}
            </div>
            {missingTools.length > 0 && (
              <div className="env-hint">
                不安装 CorridorKey 时仍可使用 chroma、birefnet、luma、birefnet_luma；使用 corridorkey 或组合模式前需要安装。
              </div>
            )}
          </div>

          {/* 模型文件 */}
          <div className="env-section">
            <h4>AI 模型缓存</h4>
            <div className="env-hint">缓存目录：{result.cache_dir}</div>
            <div className="env-table">
              {result.models.map((m) => {
                const taskKey = `model:${m.key}`;
                const task = activeTasks[taskKey];
                const isRunning = task?.status === "running";
                return (
                  <div key={m.key} className={`env-resource-card ${m.cached ? "ok" : "fail"}`}>
                    <div className="env-row-main">
                      <span className="env-dot">{m.cached ? "✓" : "✗"}</span>
                      <span className="env-name">{m.label}</span>
                      <span className="env-ver">{m.cached ? "已缓存" : "未下载"}</span>
                      {!m.cached && (
                        <div className="env-dl-group">
                          {m.downloadable !== false && (
                            <button className="env-dl-link primary" onClick={() => startModelDownload(m.key)} disabled={isRunning}>
                              {isRunning ? "下载中…" : "内置下载"}
                            </button>
                          )}
                          <a href={m.direct_url} target="_blank" rel="noreferrer" className="env-dl-link">
                            直接下载
                          </a>
                          <a href={m.hf_url} target="_blank" rel="noreferrer" className="env-dl-link">
                            HF 页面
                          </a>
                        </div>
                      )}
                    </div>
                    <div className="env-meta">
                      <div>{m.repo}</div>
                      {m.size_hint && <div>预计大小：{m.size_hint}</div>}
                      <div>安装目录：{m.cache_path}</div>
                    </div>
                    {renderTask(task)}
                  </div>
                );
              })}
            </div>
            {missingModels.length > 0 && (
              <div className="env-hint">
                内置下载会使用 HuggingFace 标准快照缓存，完成后自动刷新检测；手动下载仍需放入对应模型缓存目录。
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
