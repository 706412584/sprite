// 阶段 5：导出
// 选择需要的格式 + 一键打包成 zip 下载。

import { useCallback, useMemo, useState } from "react";
import { useBoneAnim } from "../BoneAnimContext";
import { packAtlas } from "../exporters/atlasPacker";
import { exportDragonBones } from "../exporters/dragonBonesExporter";
import { exportSpineJson } from "../exporters/spineJsonExporter";
import { exportSpineSkel } from "../exporters/spineSkelExporter";
import { blobToUint8, buildZip, downloadBytes } from "../exporters/zipBuilder";
import { safeName } from "../model/skeletonModel";

interface ExportFlags {
  dragonBones: boolean;
  spineJson: boolean;
  spineSkel: boolean;
}

export function StageExport() {
  const { skeleton } = useBoneAnim();
  const [flags, setFlags] = useState<ExportFlags>({ dragonBones: false, spineJson: true, spineSkel: false });
  const [acceptSpineLicense, setAcceptSpineLicense] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const issues = useMemo(() => {
    const out: string[] = [];
    if (skeleton.bones.length === 0) out.push("尚未生成骨骼。请回到第二步选骨架模板。");
    if (skeleton.slots.every((s) => !s.attachmentId)) out.push("没有任何槽位绑定部件。");
    if (skeleton.animations.length === 0) out.push("尚未生成动画。请回到第三步生成动作。");
    return out;
  }, [skeleton]);

  const canExport = issues.length === 0 && (flags.dragonBones || flags.spineJson || flags.spineSkel);

  const doExport = useCallback(async () => {
    if (!canExport) return;
    setBusy(true);
    setMessage("打包 atlas…");
    try {
      const atlas = await packAtlas(skeleton.attachments);
      const baseName = safeName(skeleton.name, "skeleton");
      const files: Array<{ name: string; data: Uint8Array | string }> = [];

      if (flags.dragonBones) {
        setMessage("生成 DragonBones JSON…");
        const db = exportDragonBones(skeleton, atlas);
        files.push({ name: `${baseName}_ske.json`, data: JSON.stringify(db.ske, null, 2) });
        files.push({ name: `${baseName}_tex.json`, data: JSON.stringify(db.tex, null, 2) });
        files.push({ name: `${baseName}_tex.png`, data: await blobToUint8(atlas.pngBlob) });
      }
      if (flags.spineJson) {
        setMessage("生成 Spine JSON…");
        const spine = exportSpineJson(skeleton, atlas, { fileBaseName: baseName });
        files.push({ name: `${baseName}.json`, data: JSON.stringify(spine.skeleton, null, 2) });
        files.push({ name: `${baseName}.atlas`, data: spine.atlasText });
        files.push({ name: `${baseName}.png`, data: await blobToUint8(atlas.pngBlob) });
      }
      if (flags.spineSkel) {
        if (!acceptSpineLicense) {
          setMessage("请先勾选 Spine 授权确认。");
          setBusy(false);
          return;
        }
        setMessage("生成 .skel（实验性）…");
        const skel = exportSpineSkel(skeleton, atlas);
        files.push({ name: `${baseName}.skel`, data: skel.binary });
        if (!flags.spineJson && !flags.dragonBones) {
          files.push({ name: `${baseName}_tex.png`, data: await blobToUint8(atlas.pngBlob) });
        }
      }

      // 附带一份说明
      files.push({
        name: "README.txt",
        data: buildReadme(skeleton, flags),
      });

      const zip = buildZip(files);
      downloadBytes(`${baseName}_bone_anim.zip`, zip, "application/zip");
      setMessage("导出完成，已开始下载；Spine JSON 套件为 xxx.json + xxx.atlas + xxx.png。");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [canExport, flags, skeleton, acceptSpineLicense]);

  return (
    <div className="bone-stage">
      <div className="info-box">
        <strong>第五步：导出</strong>
        <p className="muted">
          默认导出布局工具兼容的 Spine JSON 套件：xxx.json + xxx.atlas + xxx.png。DragonBones 可按需勾选；Spine .skel 二进制为实验功能，需勾选授权确认后才能启用。
        </p>
      </div>

      {issues.length > 0 && (
        <div className="info-box" style={{ borderColor: "rgba(248,113,113,0.5)" }}>
          <strong>导出前的问题</strong>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {issues.map((it, i) => (
              <li key={i}>{it}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="bone-export-grid">
        <label className="bone-export-row">
          <input
            type="checkbox"
            checked={flags.dragonBones}
            onChange={(e) => setFlags((f) => ({ ...f, dragonBones: e.target.checked }))}
          />
          <div>
            <strong>DragonBones JSON</strong>
            <small>可选兼容格式。输出 xxx_ske.json + xxx_tex.json + xxx_tex.png。</small>
          </div>
        </label>

        <label className="bone-export-row">
          <input
            type="checkbox"
            checked={flags.spineJson}
            onChange={(e) => setFlags((f) => ({ ...f, spineJson: e.target.checked }))}
          />
          <div>
            <strong>Spine JSON（4.x，布局工具默认）</strong>
            <small>输出标准套件 xxx.json + xxx.atlas + xxx.png，用于可视化游戏布局工具导入。需要项目侧持有 Spine 编辑器/Runtimes 授权。</small>
          </div>
        </label>

        <label className="bone-export-row">
          <input
            type="checkbox"
            checked={flags.spineSkel}
            onChange={(e) => setFlags((f) => ({ ...f, spineSkel: e.target.checked }))}
          />
          <div>
            <strong>Spine .skel 二进制（实验性）</strong>
            <small>
              基于公开二进制格式说明的 best-effort 实现，部分高级特性未支持。如不能正确加载，请回退到 Spine JSON。
            </small>
          </div>
        </label>

        {flags.spineSkel && (
          <label className="bone-export-row" style={{ borderColor: "#facc15" }}>
            <input
              type="checkbox"
              checked={acceptSpineLicense}
              onChange={(e) => setAcceptSpineLicense(e.target.checked)}
            />
            <div>
              <strong>我已持有 Spine 编辑器/Runtimes 授权</strong>
              <small>使用 .skel 输出意味着下游项目须自行符合 Esoteric Software Spine 授权要求。</small>
            </div>
          </label>
        )}
      </div>

      <div className="export-actions">
        <button onClick={doExport} disabled={!canExport || busy}>
          {busy ? "导出中…" : "导出 zip"}
        </button>
        <span className="muted">{message}</span>
      </div>
    </div>
  );
}

function buildReadme(skeleton: { name: string; bones: unknown[]; slots: unknown[]; animations: unknown[] }, flags: ExportFlags): string {
  const baseName = safeName(skeleton.name, "skeleton");
  const files: string[] = [];
  if (flags.spineJson) {
    files.push(`${baseName}.json`, `${baseName}.atlas`, `${baseName}.png`);
  }
  if (flags.dragonBones) {
    files.push(`${baseName}_ske.json`, `${baseName}_tex.json`, `${baseName}_tex.png`);
  }
  if (flags.spineSkel) {
    files.push(`${baseName}.skel`);
    if (!flags.spineJson && !flags.dragonBones) files.push(`${baseName}_tex.png`);
  }

  return [
    `Bone Animation Export`,
    ``,
    `name: ${skeleton.name}`,
    `bones: ${skeleton.bones.length}`,
    `slots: ${skeleton.slots.length}`,
    `animations: ${skeleton.animations.length}`,
    ``,
    `formats:`,
    `  - Spine JSON:       ${flags.spineJson ? "yes (layout-tool suite: xxx.json + xxx.atlas + xxx.png)" : "no"}`,
    `  - DragonBones JSON: ${flags.dragonBones ? "yes (xxx_ske.json + xxx_tex.json + xxx_tex.png)" : "no"}`,
    `  - Spine .skel:      ${flags.spineSkel ? "yes (experimental)" : "no"}`,
    ``,
    `expected files:`,
    ...files.map((file) => `  - ${file}`),
    ``,
    `Generated by Sprite Video Lab — Bone Animation tab.`,
  ].join("\n");
}
