// 骨架模板：把人形 / 四足 / 道具 描述成一组骨骼 + 槽位定义
// 槽位带 hint 提示用户该放什么部件，pivot 用于切片绑定时给个合理默认。

import { BoneNode, Skeleton, Slot, makeId } from "./skeletonModel";

export interface BoneTemplateDef {
  name: string;
  parent: string | null;
  x: number;
  y: number;
  rotation?: number;
  length?: number;
}

export interface SlotTemplateDef {
  name: string;
  bone: string;
  zOrder: number;
  hint: string;            // 给小白看的提示，如"头部正面图"
  defaultPivot: { x: number; y: number };
}

export interface SkeletonTemplate {
  id: string;
  label: string;
  description: string;
  bones: BoneTemplateDef[];
  slots: SlotTemplateDef[];
}

// 坐标系约定：编辑态 y 向下为正，root 在画布中心 (0,0)。
// 数值是经验值，骨骼长度以 100 为单位，导出 pipeline 不依赖单位（下游可缩放）。

export const skeletonTemplates: SkeletonTemplate[] = [
  {
    id: "humanoid",
    label: "人形（默认）",
    description: "适合人物角色：头、躯干、双臂双腿。",
    bones: [
      { name: "root", parent: null, x: 0, y: 0 },
      { name: "torso", parent: "root", x: 0, y: -120, length: 120 },
      { name: "head", parent: "torso", x: 0, y: -110, length: 60 },
      { name: "upperArmL", parent: "torso", x: -45, y: -90, rotation: 110, length: 70 },
      { name: "forearmL", parent: "upperArmL", x: 0, y: 70, length: 60 },
      { name: "upperArmR", parent: "torso", x: 45, y: -90, rotation: 70, length: 70 },
      { name: "forearmR", parent: "upperArmR", x: 0, y: 70, length: 60 },
      { name: "thighL", parent: "root", x: -25, y: 0, rotation: 95, length: 90 },
      { name: "shinL", parent: "thighL", x: 0, y: 90, length: 90 },
      { name: "thighR", parent: "root", x: 25, y: 0, rotation: 85, length: 90 },
      { name: "shinR", parent: "thighR", x: 0, y: 90, length: 90 },
    ],
    slots: [
      { name: "head", bone: "head", zOrder: 90, hint: "头部正面图", defaultPivot: { x: 0.5, y: 0.85 } },
      { name: "torso", bone: "torso", zOrder: 50, hint: "躯干 / 上半身", defaultPivot: { x: 0.5, y: 0.1 } },
      { name: "upperArmL", bone: "upperArmL", zOrder: 40, hint: "左大臂", defaultPivot: { x: 0.5, y: 0.1 } },
      { name: "forearmL", bone: "forearmL", zOrder: 41, hint: "左前臂 / 左手", defaultPivot: { x: 0.5, y: 0.1 } },
      { name: "upperArmR", bone: "upperArmR", zOrder: 60, hint: "右大臂", defaultPivot: { x: 0.5, y: 0.1 } },
      { name: "forearmR", bone: "forearmR", zOrder: 61, hint: "右前臂 / 右手", defaultPivot: { x: 0.5, y: 0.1 } },
      { name: "thighL", bone: "thighL", zOrder: 30, hint: "左大腿", defaultPivot: { x: 0.5, y: 0.1 } },
      { name: "shinL", bone: "shinL", zOrder: 31, hint: "左小腿 / 左脚", defaultPivot: { x: 0.5, y: 0.1 } },
      { name: "thighR", bone: "thighR", zOrder: 32, hint: "右大腿", defaultPivot: { x: 0.5, y: 0.1 } },
      { name: "shinR", bone: "shinR", zOrder: 33, hint: "右小腿 / 右脚", defaultPivot: { x: 0.5, y: 0.1 } },
    ],
  },
  {
    id: "quadruped",
    label: "四足生物",
    description: "适合宠物 / 怪物：身体、头、四条腿、尾巴。",
    bones: [
      { name: "root", parent: null, x: 0, y: 0 },
      { name: "body", parent: "root", x: 0, y: -50, length: 120 },
      { name: "head", parent: "body", x: 60, y: -10, length: 60 },
      { name: "tail", parent: "body", x: -70, y: 0, rotation: 200, length: 60 },
      { name: "legFL", parent: "body", x: 50, y: 30, rotation: 90, length: 80 },
      { name: "legFR", parent: "body", x: 50, y: 30, rotation: 90, length: 80 },
      { name: "legBL", parent: "body", x: -50, y: 30, rotation: 90, length: 80 },
      { name: "legBR", parent: "body", x: -50, y: 30, rotation: 90, length: 80 },
    ],
    slots: [
      { name: "body", bone: "body", zOrder: 50, hint: "身体侧面图", defaultPivot: { x: 0.5, y: 0.5 } },
      { name: "head", bone: "head", zOrder: 80, hint: "头", defaultPivot: { x: 0.3, y: 0.5 } },
      { name: "tail", bone: "tail", zOrder: 30, hint: "尾巴", defaultPivot: { x: 0.5, y: 0.1 } },
      { name: "legFL", bone: "legFL", zOrder: 40, hint: "前左腿", defaultPivot: { x: 0.5, y: 0.1 } },
      { name: "legFR", bone: "legFR", zOrder: 60, hint: "前右腿", defaultPivot: { x: 0.5, y: 0.1 } },
      { name: "legBL", bone: "legBL", zOrder: 35, hint: "后左腿", defaultPivot: { x: 0.5, y: 0.1 } },
      { name: "legBR", bone: "legBR", zOrder: 65, hint: "后右腿", defaultPivot: { x: 0.5, y: 0.1 } },
    ],
  },
  {
    id: "prop",
    label: "简单道具",
    description: "单部件，仅一个 root + body slot。",
    bones: [
      { name: "root", parent: null, x: 0, y: 0 },
      { name: "body", parent: "root", x: 0, y: 0, length: 100 },
    ],
    slots: [{ name: "body", bone: "body", zOrder: 50, hint: "道具图", defaultPivot: { x: 0.5, y: 0.5 } }],
  },
];

// 套用模板，仅替换 bones / slots，保留 attachments 和 animations
export function applyTemplate(skeleton: Skeleton, tpl: SkeletonTemplate): Skeleton {
  const boneIdByName = new Map<string, string>();
  const newBones: BoneNode[] = tpl.bones.map((b) => {
    const id = makeId("bn");
    boneIdByName.set(b.name, id);
    return {
      id,
      name: b.name,
      parentId: null, // 第二轮再连
      x: b.x,
      y: b.y,
      rotation: b.rotation ?? 0,
      scaleX: 1,
      scaleY: 1,
      length: b.length ?? 0,
    };
  });
  for (let i = 0; i < tpl.bones.length; i += 1) {
    const def = tpl.bones[i];
    if (def.parent) newBones[i].parentId = boneIdByName.get(def.parent) ?? null;
  }

  const newSlots: Slot[] = tpl.slots.map((s) => ({
    id: makeId("sl"),
    name: s.name,
    boneId: boneIdByName.get(s.bone) ?? newBones[0].id,
    attachmentId: null,
    zOrder: s.zOrder,
  }));

  return {
    ...skeleton,
    name: skeleton.name || tpl.id,
    bones: newBones,
    slots: newSlots,
  };
}

export function getTemplateById(id: string): SkeletonTemplate | undefined {
  return skeletonTemplates.find((t) => t.id === id);
}

export function getSlotHint(tpl: SkeletonTemplate | undefined, slotName: string): string {
  if (!tpl) return "";
  return tpl.slots.find((s) => s.name === slotName)?.hint || "";
}

export function getSlotDefaultPivot(tpl: SkeletonTemplate | undefined, slotName: string): { x: number; y: number } {
  if (!tpl) return { x: 0.5, y: 0.5 };
  return tpl.slots.find((s) => s.name === slotName)?.defaultPivot || { x: 0.5, y: 0.5 };
}
