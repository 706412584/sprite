// 骨骼动画编辑器内部数据模型
// 编辑态使用绝对值 + 直观单位（度、秒），导出时再换算为各格式所需形态。

export interface BoneNode {
  id: string;
  name: string;
  /** 显示名（"英文_中文"，仅 UI 可读，导出仍用 name） */
  displayName?: string;
  parentId: string | null;
  // 父相对 transform（编辑态绝对值）
  x: number;
  y: number;
  rotation: number; // 度
  scaleX: number;
  scaleY: number;
  length: number; // 仅用于可视化骨骼线段
}

/**
 * 部件在源画布上的绝对位置矩形（左上角原点）。
 * 仅 PSD 等"带原始坐标"的来源会填这个字段，用于一比一还原（与 PS 里完全一致的相对位置）。
 * 姿态/几何切片不填，按骨骼 + pivot 摆放。
 */
export interface SourceRect {
  x: number; // 部件左上角在源画布的像素 X
  y: number; // 部件左上角在源画布的像素 Y
  canvasWidth: number; // 源画布总宽（用于居中/缩放还原）
  canvasHeight: number; // 源画布总高
}

export interface AttachmentImage {
  id: string;
  name: string; // 同 atlas SubTexture name，需 safe filename
  /** 显示名（"英文_中文"，仅 UI 可读，导出/绑定仍用 name） */
  displayName?: string;
  pngDataUrl: string; // 切片后的 PNG（v1 内存承载）
  width: number;
  height: number;
  pivot: { x: number; y: number }; // 0-1 归一化
  /** 源画布绝对坐标（PSD 一比一还原用）；无则按骨骼 + pivot 摆放 */
  sourceRect?: SourceRect;
}

export interface Slot {
  id: string;
  name: string;
  /** 显示名（"英文_中文"，仅 UI 可读，导出仍用 name） */
  displayName?: string;
  boneId: string;
  attachmentId: string | null;
  zOrder: number;
  /** PSD 绑定姿态下，贴图 pivot 相对骨骼 joint 的本地偏移与反向旋转。 */
  setupOffset?: { x: number; y: number; rotation: number };
}

export type KeyframeChannel = "translate" | "rotate" | "scale";
export type KeyframeEasing = "linear" | "stepped" | "easeIn" | "easeOut" | "easeInOut";

export interface Keyframe {
  time: number; // 秒
  channel: KeyframeChannel;
  // translate: [dx, dy] 相对 setup pose
  // rotate:    [degrees] 相对 setup pose（导出转弧度并解卷绕）
  // scale:     [sx, sy] 绝对倍数（相对 setup 取比值）
  values: number[];
  easing: KeyframeEasing;
}

export interface BoneTimeline {
  boneId: string;
  keyframes: Keyframe[];
}

export interface ActionTemplateSnapshot {
  templateId: string;
  params: Record<string, number>;
}

export interface Animation {
  id: string;
  name: string;
  durationSec: number;
  loop: boolean;
  bones: BoneTimeline[];
  sourceTemplate?: ActionTemplateSnapshot;
}

export interface Skeleton {
  id: string;
  name: string;
  fps: number;
  bones: BoneNode[];
  slots: Slot[];
  attachments: AttachmentImage[];
  animations: Animation[];
}

// 工厂函数 / 工具方法

export function createEmptySkeleton(name = "skeleton"): Skeleton {
  return {
    id: makeId("skl"),
    name,
    fps: 24,
    bones: [],
    slots: [],
    attachments: [],
    animations: [],
  };
}

export function makeId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`;
}

export function findBone(skel: Skeleton, boneId: string): BoneNode | undefined {
  return skel.bones.find((b) => b.id === boneId);
}

export function findBoneByName(skel: Skeleton, name: string): BoneNode | undefined {
  return skel.bones.find((b) => b.name === name);
}

export function findSlot(skel: Skeleton, slotId: string): Slot | undefined {
  return skel.slots.find((s) => s.id === slotId);
}

export function findAttachment(skel: Skeleton, attId: string): AttachmentImage | undefined {
  return skel.attachments.find((a) => a.id === attId);
}

// 把名称规范化成 atlas / 文件系统安全的 ASCII 名
export function safeName(input: string, fallback = "item"): string {
  const cleaned = input.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/^_+|_+$/g, "");
  return cleaned || fallback;
}

/** 给 UI 用的显示名：优先 displayName，回退 name。仅展示用，不要写回 name。 */
export function getDisplayName(item: { name: string; displayName?: string }): string {
  return item.displayName && item.displayName.trim() ? item.displayName : item.name;
}
