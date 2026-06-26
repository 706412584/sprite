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

// ---- 世界坐标计算（被 StageRig 和编辑操作共用）----

export interface BoneWorld {
  x: number;
  y: number;
  rot: number;
}

/** 按拓扑序计算每根骨骼的世界坐标。bones[] 必须是拓扑序（父在子之前）。 */
export function computeBoneWorld(bones: BoneNode[]): Map<string, BoneWorld> {
  const worldByBone = new Map<string, BoneWorld>();
  for (const bone of bones) {
    const parent = bone.parentId ? worldByBone.get(bone.parentId) : undefined;
    const baseX = parent?.x ?? 0;
    const baseY = parent?.y ?? 0;
    const baseRot = parent?.rot ?? 0;
    const rad = (baseRot * Math.PI) / 180;
    const x = baseX + bone.x * Math.cos(rad) - bone.y * Math.sin(rad);
    const y = baseY + bone.x * Math.sin(rad) + bone.y * Math.cos(rad);
    worldByBone.set(bone.id, { x, y, rot: baseRot + bone.rotation });
  }
  return worldByBone;
}

/** 将世界坐标点转换为父骨骼局部坐标。parent 为 undefined 时视为根坐标系。 */
export function worldPointToParentLocal(
  point: { x: number; y: number },
  parent?: BoneWorld,
): { x: number; y: number } {
  const dx = point.x - (parent?.x ?? 0);
  const dy = point.y - (parent?.y ?? 0);
  const rad = -((parent?.rot ?? 0) * Math.PI) / 180;
  return {
    x: Math.round(dx * Math.cos(rad) - dy * Math.sin(rad)),
    y: Math.round(dx * Math.sin(rad) + dy * Math.cos(rad)),
  };
}

// ---- 骨骼编辑操作 ----

export interface AddBoneOptions {
  parentId: string | null;
  x?: number;
  y?: number;
  rotation?: number;
  length?: number;
  name?: string;
}

/** 在父骨骼最后一个后代之后插入新骨骼，维护拓扑序。 */
export function addBone(skel: Skeleton, opts: AddBoneOptions): Skeleton {
  if (opts.parentId !== null && !skel.bones.find((b) => b.id === opts.parentId)) {
    throw new Error(`Parent bone ${opts.parentId} not found`);
  }

  const newBone: BoneNode = {
    id: makeId("bone"),
    name: opts.name ?? `bone_${skel.bones.length}`,
    parentId: opts.parentId,
    x: opts.x ?? 0,
    y: opts.y ?? 0,
    rotation: opts.rotation ?? 0,
    scaleX: 1,
    scaleY: 1,
    length: opts.length ?? 40,
  };

  // 找到父骨骼子树的最后一个成员之后插入
  let insertIndex = skel.bones.length;
  if (opts.parentId !== null) {
    // 收集父骨骼子树中所有后代 id
    const subtreeIds = new Set<string>();
    const collectSubtree = (pid: string) => {
      skel.bones.forEach((b) => { if (b.parentId === pid && !subtreeIds.has(b.id)) { subtreeIds.add(b.id); collectSubtree(b.id); } });
    };
    subtreeIds.add(opts.parentId);
    collectSubtree(opts.parentId);
    // 从末尾找最后一个属于子树的骨骼
    for (let i = skel.bones.length - 1; i >= 0; i--) {
      if (subtreeIds.has(skel.bones[i].id)) {
        insertIndex = i + 1;
        break;
      }
    }
  }

  const bones = [...skel.bones];
  bones.splice(insertIndex, 0, newBone);
  return { ...skel, bones };
}

/** 删除骨骼及其所有后代，清理 BoneTimeline 和 slot 绑定。 */
export function removeBone(skel: Skeleton, boneId: string): Skeleton {
  const toDelete = new Set<string>();
  const collect = (id: string) => {
    toDelete.add(id);
    skel.bones.forEach((b) => { if (b.parentId === id) collect(b.id); });
  };
  collect(boneId);

  const bones = skel.bones.filter((b) => !toDelete.has(b.id));
  const animations = skel.animations.map((anim) => ({
    ...anim,
    bones: anim.bones.filter((bt) => !toDelete.has(bt.boneId)),
  }));
  const slots = skel.slots.map((s) =>
    toDelete.has(s.boneId) ? { ...s, attachmentId: null } : s,
  );

  return { ...skel, bones, animations, slots };
}

/** 改变骨骼父节点，保持世界坐标不变。检测循环引用。 */
export function reparentBone(
  skel: Skeleton,
  boneId: string,
  newParentId: string | null,
): Skeleton {
  const bone = skel.bones.find((b) => b.id === boneId);
  if (!bone) throw new Error(`Bone ${boneId} not found`);
  if (newParentId !== null && !skel.bones.find((b) => b.id === newParentId)) {
    throw new Error(`New parent ${newParentId} not found`);
  }

  // 循环检测
  if (newParentId !== null) {
    const isDescendant = (ancestorId: string, targetId: string): boolean => {
      return skel.bones.some((c) => c.parentId === ancestorId && (c.id === targetId || isDescendant(c.id, targetId)));
    };
    if (isDescendant(boneId, newParentId)) {
      throw new Error(`Cannot reparent: ${newParentId} is a descendant of ${boneId}`);
    }
  }

  const worldMap = computeBoneWorld(skel.bones);
  const oldWorld = worldMap.get(boneId)!;
  const newParentWorld = newParentId ? worldMap.get(newParentId) : undefined;

  const local = worldPointToParentLocal(oldWorld, newParentWorld);
  const newRot = oldWorld.rot - (newParentWorld?.rot ?? 0);

  const updatedBone = { ...bone, parentId: newParentId, x: local.x, y: local.y, rotation: newRot };

  // 从数组移除，找到新位置插入
  const withoutBone = skel.bones.filter((b) => b.id !== boneId);
  let insertIndex = withoutBone.length;
  if (newParentId !== null) {
    const subtreeIds = new Set<string>();
    const collectSubtree = (pid: string) => {
      withoutBone.forEach((b) => { if (b.parentId === pid && !subtreeIds.has(b.id)) { subtreeIds.add(b.id); collectSubtree(b.id); } });
    };
    subtreeIds.add(newParentId);
    collectSubtree(newParentId);
    for (let i = withoutBone.length - 1; i >= 0; i--) {
      if (subtreeIds.has(withoutBone[i].id)) {
        insertIndex = i + 1;
        break;
      }
    }
  }
  const bones = [...withoutBone];
  bones.splice(insertIndex, 0, updatedBone);

  return { ...skel, bones };
}
