import { ExportPanel } from "@/features/export/ExportPanel";
import { ImportPanel } from "@/features/import/ImportPanel";
import { PreviewPanel } from "@/features/preview/PreviewPanel";
import { SettingsPanel } from "@/features/settings/SettingsPanel";
import { useAppState } from "@/state/AppContext";

const steps = [
  { key: "source", label: "导入素材" },
  { key: "segment", label: "选区间" },
  { key: "matte", label: "调参预览" },
  { key: "process", label: "批量生成" },
  { key: "export", label: "导出压缩" },
];

export function WorkflowPanel() {
  const { upload, preview, job, exportResult, selectedFrameIndices, busy, message, operationLabel, operationProgress, taskLogs } = useAppState();

  const activeStep = exportResult ? "export" : job ? "process" : preview ? "matte" : upload ? "segment" : "source";
  const processedFrameCount = job?.frames?.length || 0;
  const fallbackProgress = exportResult ? 100 : job ? 80 : preview ? 56 : upload ? 28 : 8;
  const rawProgress = Number.isFinite(operationProgress) ? operationProgress ?? fallbackProgress : fallbackProgress;
  const progressPercent = Math.max(0, Math.min(100, Math.round(rawProgress)));

  return (
    <div className="workflow-shell">
      <section className="workflow-header panel">
        <div>
          <h3>制作流水线</h3>
          <p>按素材、区间、调参、批处理、导出的顺序完成动画特效处理。</p>
        </div>
        <div className="workflow-progress-card">
          <div className="workflow-progress-meta">
            <strong>{busy ? operationLabel : "当前状态"}</strong>
            <span>{message}</span>
            <b>{progressPercent}%</b>
          </div>
          <div className="workflow-progress-track">
            <span style={{ width: `${progressPercent}%` }} />
          </div>
          {(busy || taskLogs.length > 0) && (
            <div className="task-log-panel">
              <div className="task-log-title">任务日志</div>
              <div className="task-log-lines">
                {taskLogs.length > 0 ? taskLogs.map((line, index) => <span key={`${index}-${line}`}>{line}</span>) : <span>等待任务日志...</span>}
              </div>
            </div>
          )}
        </div>
      </section>

      <nav className="workflow-stepper" aria-label="制作步骤">
        {steps.map((step, index) => (
          <a key={step.key} className={step.key === activeStep ? "active" : ""} href={`#${step.key}`}>
            <span>{index + 1}</span>
            {step.label}
          </a>
        ))}
      </nav>

      <div className="workflow-grid">
        <div className="workflow-column source-column" id="source">
          <ImportPanel />
        </div>

        <div className="workflow-column matte-column" id="matte">
          <SettingsPanel />
        </div>

        <div className="workflow-column preview-column" id="segment">
          <PreviewPanel />
        </div>
      </div>

      <section className="workflow-result-strip panel" id="process">
        <div>
          <h3>处理结果</h3>
          <p>已生成 {processedFrameCount} 帧，当前选择 {selectedFrameIndices.length} 帧。</p>
        </div>
        <div className="result-metrics">
          <span>素材：{upload ? "已导入" : "未导入"}</span>
          <span>单帧预览：{preview ? "已生成" : "未生成"}</span>
          <span>批处理：{job ? "已完成" : "未处理"}</span>
          <span>导出：{exportResult ? "已生成" : "未导出"}</span>
        </div>
      </section>

      <div id="export" className="workflow-export-dock">
        <ExportPanel />
      </div>
    </div>
  );
}
