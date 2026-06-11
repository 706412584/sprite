import { useState } from "react";

import { ExportPanel } from "@/features/export/ExportPanel";
import { ImportPanel } from "@/features/import/ImportPanel";
import { PreviewPanel } from "@/features/preview/PreviewPanel";
import { SettingsPanel } from "@/features/settings/SettingsPanel";
import { useAppState } from "@/state/AppContext";

const steps = [
  { key: "source", label: "导入素材" },
  { key: "segment", label: "选区间" },
  { key: "matte", label: "预览去底" },
  { key: "process", label: "批量处理" },
  { key: "export", label: "导出结果" },
] as const;

type WorkflowStepKey = (typeof steps)[number]["key"];

export function WorkflowPanel() {
  const { upload, preview, job, exportResult, selectedFrameIndices, busy, message, operationLabel, operationProgress, taskLogs } = useAppState();
  const [activeStep, setActiveStep] = useState<WorkflowStepKey>("source");

  const suggestedStep: WorkflowStepKey = exportResult ? "export" : job ? "process" : preview ? "matte" : upload ? "segment" : "source";
  const processedFrameCount = job?.frames?.length || 0;
  const fallbackProgress = exportResult ? 100 : job ? 80 : preview ? 56 : upload ? 28 : 8;
  const rawProgress = Number.isFinite(operationProgress) ? operationProgress ?? fallbackProgress : fallbackProgress;
  const progressPercent = Math.max(0, Math.min(100, Math.round(rawProgress)));

  return (
    <div className="workflow-shell">
      <section className="workflow-header panel">
        <div>
          <h3>制作流水线</h3>
          <p>面向视频抽帧、角色/特效去底和透明序列帧批处理，不承担 PSD 绑骨、UI 拆分或 AI 角色生成。</p>
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

      <section className="tool-boundary panel">
        <div>
          <strong>适合</strong>
          <span>视频抽帧、角色/特效去底、批量生成透明序列帧。</span>
        </div>
        <div>
          <strong>不适合</strong>
          <span>PSD 骨骼绑定、复杂 UI 元素拆分、从文字生成角色动作 sheet。</span>
        </div>
        <div>
          <strong>去哪里</strong>
          <span>骨骼用“骨骼动画”，UI 框选用“UI 智能切片”，AI 角色动作 sheet 用“SpriteFlow 角色序列帧”。</span>
        </div>
      </section>

      <nav className="workflow-stepper" aria-label="制作步骤">
        {steps.map((step, index) => (
          <a
            key={step.key}
            className={`${step.key === activeStep ? "active" : ""} ${step.key === suggestedStep ? "suggested" : ""}`}
            href={`#${step.key}`}
            onClick={(event) => {
              event.preventDefault();
              setActiveStep(step.key);
            }}
          >
            <span>{index + 1}</span>
            {step.label}
          </a>
        ))}
      </nav>

      <div className="tool-stage-host workflow-stage-host">
        {activeStep === "source" && (
          <div className="workflow-column source-column" id="source">
            <ImportPanel />
          </div>
        )}

        {activeStep === "segment" && (
          <div className="workflow-column preview-column" id="segment">
            <PreviewPanel />
          </div>
        )}

        {activeStep === "matte" && (
          <div className="workflow-column matte-column" id="matte">
            <SettingsPanel />
          </div>
        )}

        {activeStep === "process" && (
          <section className="workflow-result-strip panel" id="process">
            <div>
              <h3>处理结果</h3>
              <p>已生成 {processedFrameCount} 帧，当前选择 {selectedFrameIndices.length} 帧。</p>
            </div>
            <div className="tool-checklist">
              <span className={`tool-check-item ${upload ? "ok" : ""}`}>素材：{upload ? "已导入" : "未导入"}</span>
              <span className={`tool-check-item ${preview ? "ok" : ""}`}>单帧预览：{preview ? "已完成" : "待生成"}</span>
              <span className={`tool-check-item ${job ? "ok" : ""}`}>批处理：{job ? "已完成" : "待处理"}</span>
              <span className={`tool-check-item ${exportResult ? "ok" : ""}`}>导出包：{exportResult ? "已生成" : "待导出"}</span>
            </div>
          </section>
        )}

        {activeStep === "export" && (
          <div id="export" className="workflow-export-dock">
            <ExportPanel />
          </div>
        )}
      </div>
    </div>
  );
}
