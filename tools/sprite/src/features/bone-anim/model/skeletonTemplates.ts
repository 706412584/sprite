// 骨架模板：把人形 / 四足 / 道具 描述成一组骨骼 + 槽位定义
// 槽位带 hint 提示用户该放什么部件，pivot 用于切片绑定时给个合理默认。

import { BoneNode, Skeleton, Slot, makeId } from "./skeletonModel";

export interface BoneTemplateDef {
  name: string;
  /** UI 显示名（"英文_中文"），不参与导出 */
  displayName?: string;
  parent: string | null;
  x: number;
  y: number;
  rotation?: number;
  length?: number;
}

export interface SlotTemplateDef {
  name: string;
  /** UI 显示名（"英文_中文"），不参与导出 */
  displayName?: string;
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
      // 坐标系：y 向下为正，root 在腰部（髋关节中心）。
      // torso 旋转 -90° → 骨骼沿世界 -y（朝上）延伸 120px 到肩部。
      // 腿从 root 直接向下（rotation≈90°），和躯干共享 root 不留空隙。
      { name: "root", displayName: "root_根", parent: null, x: 0, y: 0 },
      { name: "torso", displayName: "torso_躯干", parent: "root", x: 0, y: 0, rotation: -90, length: 120 },
      { name: "head", displayName: "head_头", parent: "torso", x: 130, y: 0, length: 60 },
      // 大臂从肩部（torso 末端附近）向外伸：局部 y±45 偏向肩点，rotation ±100° 让世界角水平朝外。
      { name: "upperArmL", displayName: "upperArmL_左大臂", parent: "torso", x: 90, y: 45, rotation: 100, length: 70 },
      { name: "forearmL", displayName: "forearmL_左前臂", parent: "upperArmL", x: 70, y: 0, length: 60 },
      { name: "upperArmR", displayName: "upperArmR_右大臂", parent: "torso", x: 90, y: -45, rotation: -100, length: 70 },
      { name: "forearmR", displayName: "forearmR_右前臂", parent: "upperArmR", x: 70, y: 0, length: 60 },
      // 腿从 root 向下：x 偏移分开左右腿，rotation≈90° 朝下。
      { name: "thighL", displayName: "thighL_左大腿", parent: "root", x: 0, y: -25, rotation: 95, length: 90 },
      { name: "shinL", displayName: "shinL_左小腿", parent: "thighL", x: 90, y: 0, length: 90 },
      { name: "thighR", displayName: "thighR_右大腿", parent: "root", x: 0, y: 25, rotation: 85, length: 90 },
      { name: "shinR", displayName: "shinR_右小腿", parent: "thighR", x: 90, y: 0, length: 90 },
    ],
    slots: [
      { name: "head", displayName: "head_头", bone: "head", zOrder: 90, hint: "头部正面图", defaultPivot: { x: 0.5, y: 0.85 } },
      { name: "torso", displayName: "torso_躯干", bone: "torso", zOrder: 50, hint: "躯干 / 上半身", defaultPivot: { x: 0.5, y: 0.1 } },
      { name: "upperArmL", displayName: "upperArmL_左大臂", bone: "upperArmL", zOrder: 40, hint: "左大臂", defaultPivot: { x: 0.5, y: 0.1 } },
      { name: "forearmL", displayName: "forearmL_左前臂", bone: "forearmL", zOrder: 41, hint: "左前臂 / 左手", defaultPivot: { x: 0.5, y: 0.1 } },
      { name: "upperArmR", displayName: "upperArmR_右大臂", bone: "upperArmR", zOrder: 60, hint: "右大臂", defaultPivot: { x: 0.5, y: 0.1 } },
      { name: "forearmR", displayName: "forearmR_右前臂", bone: "forearmR", zOrder: 61, hint: "右前臂 / 右手", defaultPivot: { x: 0.5, y: 0.1 } },
      { name: "thighL", displayName: "thighL_左大腿", bone: "thighL", zOrder: 30, hint: "左大腿", defaultPivot: { x: 0.5, y: 0.1 } },
      { name: "shinL", displayName: "shinL_左小腿", bone: "shinL", zOrder: 31, hint: "左小腿 / 左脚", defaultPivot: { x: 0.5, y: 0.1 } },
      { name: "thighR", displayName: "thighR_右大腿", bone: "thighR", zOrder: 32, hint: "右大腿", defaultPivot: { x: 0.5, y: 0.1 } },
      { name: "shinR", displayName: "shinR_右小腿", bone: "shinR", zOrder: 33, hint: "右小腿 / 右脚", defaultPivot: { x: 0.5, y: 0.1 } },
    ],
  },
  {
    id: "humanoid_detailed",
    label: "人形细分（头发/五官/衣摆）",
    description: "适合 PSD 分层角色：在基础人形上增加头发、五官、手脚和衣摆骨骼。",
    bones: [
      { name: "root", displayName: "root_根", parent: null, x: 0, y: 0 },
      { name: "torso", displayName: "torso_躯干", parent: "root", x: 0, y: 0, rotation: -90, length: 120 },
      { name: "chest", displayName: "chest_胸腔", parent: "torso", x: 80, y: 0, length: 36 },
      { name: "waist", displayName: "waist_腰部", parent: "torso", x: 16, y: 0, length: 28 },
      { name: "cape", displayName: "cape_披风", parent: "chest", x: 10, y: 0, rotation: 90, length: 70 },
      { name: "skirt", displayName: "skirt_裙摆", parent: "waist", x: 0, y: 0, rotation: 90, length: 55 },
      { name: "head", displayName: "head_头", parent: "torso", x: 130, y: 0, length: 60 },
      { name: "hairBack", displayName: "hairBack_后发", parent: "head", x: 6, y: 0, rotation: 90, length: 45 },
      { name: "hairFront", displayName: "hairFront_前发", parent: "head", x: -4, y: 0, rotation: 90, length: 38 },
      { name: "eyeL", displayName: "eyeL_左眼", parent: "head", x: 0, y: 14, length: 12 },
      { name: "eyeR", displayName: "eyeR_右眼", parent: "head", x: 0, y: -14, length: 12 },
      { name: "mouth", displayName: "mouth_嘴巴", parent: "head", x: 16, y: 0, length: 12 },
      { name: "upperArmL", displayName: "upperArmL_左大臂", parent: "torso", x: 90, y: 45, rotation: 100, length: 70 },
      { name: "forearmL", displayName: "forearmL_左前臂", parent: "upperArmL", x: 70, y: 0, length: 60 },
      { name: "handL", displayName: "handL_左手", parent: "forearmL", x: 60, y: 0, length: 22 },
      { name: "upperArmR", displayName: "upperArmR_右大臂", parent: "torso", x: 90, y: -45, rotation: -100, length: 70 },
      { name: "forearmR", displayName: "forearmR_右前臂", parent: "upperArmR", x: 70, y: 0, length: 60 },
      { name: "handR", displayName: "handR_右手", parent: "forearmR", x: 60, y: 0, length: 22 },
      { name: "thighL", displayName: "thighL_左大腿", parent: "root", x: 0, y: -25, rotation: 95, length: 90 },
      { name: "shinL", displayName: "shinL_左小腿", parent: "thighL", x: 90, y: 0, length: 90 },
      { name: "footL", displayName: "footL_左脚", parent: "shinL", x: 90, y: 0, length: 28 },
      { name: "thighR", displayName: "thighR_右大腿", parent: "root", x: 0, y: 25, rotation: 85, length: 90 },
      { name: "shinR", displayName: "shinR_右小腿", parent: "thighR", x: 90, y: 0, length: 90 },
      { name: "footR", displayName: "footR_右脚", parent: "shinR", x: 90, y: 0, length: 28 },
    ],
    slots: [
      { name: "hairBack", displayName: "hairBack_后发", bone: "hairBack", zOrder: 20, hint: "后发 / 后方头饰", defaultPivot: { x: 0.5, y: 0.2 } },
      { name: "cape", displayName: "cape_披风", bone: "cape", zOrder: 24, hint: "披风 / 背饰", defaultPivot: { x: 0.5, y: 0.1 } },
      { name: "thighL", displayName: "thighL_左大腿", bone: "thighL", zOrder: 30, hint: "左大腿", defaultPivot: { x: 0.5, y: 0.1 } },
      { name: "shinL", displayName: "shinL_左小腿", bone: "shinL", zOrder: 31, hint: "左小腿", defaultPivot: { x: 0.5, y: 0.1 } },
      { name: "footL", displayName: "footL_左脚", bone: "footL", zOrder: 32, hint: "左脚 / 鞋", defaultPivot: { x: 0.3, y: 0.5 } },
      { name: "thighR", displayName: "thighR_右大腿", bone: "thighR", zOrder: 33, hint: "右大腿", defaultPivot: { x: 0.5, y: 0.1 } },
      { name: "shinR", displayName: "shinR_右小腿", bone: "shinR", zOrder: 34, hint: "右小腿", defaultPivot: { x: 0.5, y: 0.1 } },
      { name: "footR", displayName: "footR_右脚", bone: "footR", zOrder: 35, hint: "右脚 / 鞋", defaultPivot: { x: 0.3, y: 0.5 } },
      { name: "upperArmL", displayName: "upperArmL_左大臂", bone: "upperArmL", zOrder: 40, hint: "左大臂 / 袖子", defaultPivot: { x: 0.5, y: 0.1 } },
      { name: "forearmL", displayName: "forearmL_左前臂", bone: "forearmL", zOrder: 41, hint: "左前臂", defaultPivot: { x: 0.5, y: 0.1 } },
      { name: "handL", displayName: "handL_左手", bone: "handL", zOrder: 42, hint: "左手 / 左手套 / 持物", defaultPivot: { x: 0.3, y: 0.5 } },
      { name: "torso", displayName: "torso_躯干", bone: "torso", zOrder: 50, hint: "躯干 / 整体上半身", defaultPivot: { x: 0.5, y: 0.1 } },
      { name: "waist", displayName: "waist_腰部", bone: "waist", zOrder: 52, hint: "腰带 / 下装", defaultPivot: { x: 0.5, y: 0.2 } },
      { name: "chest", displayName: "chest_胸腔", bone: "chest", zOrder: 54, hint: "上衣 / 胸甲", defaultPivot: { x: 0.5, y: 0.2 } },
      { name: "skirt", displayName: "skirt_裙摆", bone: "skirt", zOrder: 56, hint: "裙摆 / 衣摆", defaultPivot: { x: 0.5, y: 0.1 } },
      { name: "upperArmR", displayName: "upperArmR_右大臂", bone: "upperArmR", zOrder: 60, hint: "右大臂 / 袖子", defaultPivot: { x: 0.5, y: 0.1 } },
      { name: "forearmR", displayName: "forearmR_右前臂", bone: "forearmR", zOrder: 61, hint: "右前臂", defaultPivot: { x: 0.5, y: 0.1 } },
      { name: "handR", displayName: "handR_右手", bone: "handR", zOrder: 62, hint: "右手 / 右手套 / 武器", defaultPivot: { x: 0.3, y: 0.5 } },
      { name: "head", displayName: "head_头", bone: "head", zOrder: 80, hint: "头部 / 脸", defaultPivot: { x: 0.5, y: 0.85 } },
      { name: "eyeL", displayName: "eyeL_左眼", bone: "eyeL", zOrder: 84, hint: "左眼 / 左眉", defaultPivot: { x: 0.5, y: 0.5 } },
      { name: "eyeR", displayName: "eyeR_右眼", bone: "eyeR", zOrder: 85, hint: "右眼 / 右眉", defaultPivot: { x: 0.5, y: 0.5 } },
      { name: "mouth", displayName: "mouth_嘴巴", bone: "mouth", zOrder: 86, hint: "嘴巴 / 表情", defaultPivot: { x: 0.5, y: 0.5 } },
      { name: "hairFront", displayName: "hairFront_前发", bone: "hairFront", zOrder: 90, hint: "前发 / 刘海 / 前方头饰", defaultPivot: { x: 0.5, y: 0.2 } },
    ],
  },
  {
    id: "quadruped",
    label: "四足生物",
    description: "适合宠物 / 怪物：身体、头、四条腿、尾巴。",
    bones: [
      { name: "root", displayName: "root_根", parent: null, x: 0, y: 0 },
      { name: "body", displayName: "body_身体", parent: "root", x: 0, y: -50, length: 120 },
      { name: "head", displayName: "head_头", parent: "body", x: 60, y: -10, length: 60 },
      { name: "tail", displayName: "tail_尾巴", parent: "body", x: -70, y: 0, rotation: 200, length: 60 },
      { name: "legFL", displayName: "legFL_前左腿", parent: "body", x: 50, y: 30, rotation: 90, length: 80 },
      { name: "legFR", displayName: "legFR_前右腿", parent: "body", x: 50, y: 30, rotation: 90, length: 80 },
      { name: "legBL", displayName: "legBL_后左腿", parent: "body", x: -50, y: 30, rotation: 90, length: 80 },
      { name: "legBR", displayName: "legBR_后右腿", parent: "body", x: -50, y: 30, rotation: 90, length: 80 },
    ],
    slots: [
      { name: "body", displayName: "body_身体", bone: "body", zOrder: 50, hint: "身体侧面图", defaultPivot: { x: 0.5, y: 0.5 } },
      { name: "head", displayName: "head_头", bone: "head", zOrder: 80, hint: "头", defaultPivot: { x: 0.3, y: 0.5 } },
      { name: "tail", displayName: "tail_尾巴", bone: "tail", zOrder: 30, hint: "尾巴", defaultPivot: { x: 0.5, y: 0.1 } },
      { name: "legFL", displayName: "legFL_前左腿", bone: "legFL", zOrder: 40, hint: "前左腿", defaultPivot: { x: 0.5, y: 0.1 } },
      { name: "legFR", displayName: "legFR_前右腿", bone: "legFR", zOrder: 60, hint: "前右腿", defaultPivot: { x: 0.5, y: 0.1 } },
      { name: "legBL", displayName: "legBL_后左腿", bone: "legBL", zOrder: 35, hint: "后左腿", defaultPivot: { x: 0.5, y: 0.1 } },
      { name: "legBR", displayName: "legBR_后右腿", bone: "legBR", zOrder: 65, hint: "后右腿", defaultPivot: { x: 0.5, y: 0.1 } },
    ],
  },
  {
    id: "prop",
    label: "简单道具",
    description: "单部件，仅一个 root + body slot。",
    bones: [
      { name: "root", displayName: "root_根", parent: null, x: 0, y: 0 },
      { name: "body", displayName: "body_主体", parent: "root", x: 0, y: 0, length: 100 },
    ],
    slots: [{ name: "body", displayName: "body_主体", bone: "body", zOrder: 50, hint: "道具图", defaultPivot: { x: 0.5, y: 0.5 } }],
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
      displayName: b.displayName,
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
    displayName: s.displayName,
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
