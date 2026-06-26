// 绑骨发射点（挂点）编辑器
//
// 在某根骨骼上放命名挂点（枪口 / 粒子发射点等），只存「骨骼 + 局部偏移/角度」，不挂贴图。
// 导出时由骨骼世界变换逐帧解算出世界坐标（见 pointsJsonExporter），供引擎做发射点。

import { useCallback, useState } from "react";
import { useBoneAnim } from "../BoneAnimContext";
import { AttachmentPoint, makeId } from "../model/skeletonModel";

const PRESET_COLORS = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#a855f7"];

export function AttachmentPointEditor() {
  const { skeleton, setSkeleton, selectedBoneId } = useBoneAnim();
  const points = skeleton.points ?? [];
  const bones = skeleton.bones;
  const [newName, setNewName] = useState("muzzle");

  const updatePoint = useCallback(
    (id: string, patch: Partial<AttachmentPoint>) => {
      setSkeleton((prev) => ({
        ...prev,
        points: (prev.points ?? []).map((p) => (p.id === id ? { ...p, ...patch } : p)),
      }));
    },
    [setSkeleton],
  );

  const removePoint = useCallback(
    (id: string) => {
      setSkeleton((prev) => ({ ...prev, points: (prev.points ?? []).filter((p) => p.id !== id) }));
    },
    [setSkeleton],
  );

  const addPoint = useCallback(() => {
    const boneId = selectedBoneId && bones.some((b) => b.id === selectedBoneId) ? selectedBoneId : bones[0]?.id;
    if (!boneId) return;
    const idx = (skeleton.points ?? []).length;
    const point: AttachmentPoint = {
      id: makeId("pt"),
      name: newName.trim() || `point_${idx + 1}`,
      boneId,
      x: 0,
      y: 0,
      rotation: 0,
      color: PRESET_COLORS[idx % PRESET_COLORS.length],
    };
    setSkeleton((prev) => ({ ...prev, points: [...(prev.points ?? []), point] }));
  }, [bones, selectedBoneId, newName, skeleton.points, setSkeleton]);

  return (
    <section className="bone-action-form" style={{ marginTop: 16 }}>
      <h4>发射点 / 挂点（{points.length}）</h4>
      <p className="muted">
        在骨骼上放命名点（枪口、粒子源等），存「骨骼 + 局部偏移 x/y + 角度」。导出时逐帧解算世界坐标，
        随「可复用骨骼+挂点 JSON」一起输出，供引擎做发射点。
      </p>

      {bones.length === 0 ? (
        <div className="info-box" style={{ borderColor: "rgba(248,113,113,0.5)" }}>
          <strong>请先生成骨架</strong>
          <small>挂点必须依附在某根骨骼上。</small>
        </div>
      ) : (
        <div className="export-actions" style={{ flexWrap: "wrap", gap: 8 }}>
          <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="挂点名（如 muzzle）" />
          <button type="button" onClick={addPoint}>
            添加挂点{selectedBoneId ? "（到选中骨骼）" : "（到第一根骨骼）"}
          </button>
        </div>
      )}

      {points.length > 0 && (
        <ul className="bone-anim-list" style={{ marginTop: 8 }}>
          {points.map((p) => (
            <li key={p.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ width: 12, height: 12, borderRadius: 6, background: p.color || "#888", display: "inline-block" }} />
                <input
                  type="text"
                  value={p.name}
                  onChange={(e) => updatePoint(p.id, { name: e.target.value })}
                  style={{ width: 120 }}
                />
                <select value={p.boneId} onChange={(e) => updatePoint(p.id, { boneId: e.target.value })}>
                  {bones.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={() => removePoint(p.id)} title="删除">
                  ✕
                </button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  x
                  <input
                    type="number"
                    value={p.x}
                    step={1}
                    onChange={(e) => updatePoint(p.id, { x: Number(e.target.value) })}
                    style={{ width: 70 }}
                  />
                </label>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  y
                  <input
                    type="number"
                    value={p.y}
                    step={1}
                    onChange={(e) => updatePoint(p.id, { y: Number(e.target.value) })}
                    style={{ width: 70 }}
                  />
                </label>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  角度
                  <input
                    type="number"
                    value={p.rotation}
                    step={1}
                    onChange={(e) => updatePoint(p.id, { rotation: Number(e.target.value) })}
                    style={{ width: 70 }}
                  />
                </label>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
