// 动作模板：参数化生成 Animation.bones 关键帧
// 设计原则：
// - 输入是 skeleton + params；输出是 Animation。
// - 内部以采样形式生成 keyframes，时间用秒，旋转用度，translate/scale 用相对 setup 的 delta。
// - 找不到对应骨骼时静默跳过，确保任意模板与任意骨架都能跑（缺胳膊就只动剩下的）。

import { Animation, BoneTimeline, Keyframe, Skeleton, findBoneByName, makeId } from "./skeletonModel";

export interface ActionTemplateParam {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
}

export interface ActionTemplate {
  id: string;
  label: string;
  description: string;
  defaultDuration: number;
  defaultLoop: boolean;
  params: ActionTemplateParam[];
  generate: (skeleton: Skeleton, params: Record<string, number>) => Animation;
}

// ---------- 工具函数 ----------

function emptyAnimation(name: string, durationSec: number, loop: boolean): Animation {
  return {
    id: makeId("anim"),
    name,
    durationSec,
    loop,
    bones: [],
  };
}

function ensureTimeline(anim: Animation, boneId: string): BoneTimeline {
  let t = anim.bones.find((tl) => tl.boneId === boneId);
  if (!t) {
    t = { boneId, keyframes: [] };
    anim.bones.push(t);
  }
  return t;
}

function pushKey(timeline: BoneTimeline, key: Keyframe) {
  timeline.keyframes.push(key);
}

function sampleSinKeyframes(
  count: number,
  durationSec: number,
  fn: (t: number) => number,
): Array<{ time: number; value: number }> {
  const out: Array<{ time: number; value: number }> = [];
  for (let i = 0; i <= count; i += 1) {
    const t = (i / count) * durationSec;
    out.push({ time: t, value: fn(t) });
  }
  return out;
}

// ---------- idle 呼吸 ----------

const idleTemplate: ActionTemplate = {
  id: "idle",
  label: "Idle 呼吸",
  description: "躯干上下浮动，头部跟随。",
  defaultDuration: 1.6,
  defaultLoop: true,
  params: [
    { key: "amplitudeY", label: "上下幅度", min: 0, max: 12, step: 0.5, default: 4 },
    { key: "torsoRot", label: "躯干摆动 (度)", min: 0, max: 6, step: 0.1, default: 1.5 },
    { key: "headRot", label: "头部摆动 (度)", min: 0, max: 8, step: 0.1, default: 2 },
  ],
  generate: (skeleton, params) => {
    const duration = 1.6;
    const anim = emptyAnimation("idle", duration, true);
    const sampleCount = 12;

    const torso = findBoneByName(skeleton, "torso") || findBoneByName(skeleton, "body");
    const head = findBoneByName(skeleton, "head");

    if (torso) {
      const tl = ensureTimeline(anim, torso.id);
      const trans = sampleSinKeyframes(sampleCount, duration, (t) => Math.sin((t / duration) * Math.PI * 2) * -params.amplitudeY);
      for (const s of trans) {
        pushKey(tl, { time: s.time, channel: "translate", values: [0, s.value], easing: "linear" });
      }
      const rot = sampleSinKeyframes(sampleCount, duration, (t) => Math.sin((t / duration) * Math.PI * 2) * params.torsoRot);
      for (const s of rot) {
        pushKey(tl, { time: s.time, channel: "rotate", values: [s.value], easing: "linear" });
      }
    }

    if (head) {
      const tl = ensureTimeline(anim, head.id);
      const rot = sampleSinKeyframes(sampleCount, duration, (t) => Math.sin((t / duration) * Math.PI * 2 + Math.PI / 4) * params.headRot);
      for (const s of rot) {
        pushKey(tl, { time: s.time, channel: "rotate", values: [s.value], easing: "linear" });
      }
    }

    return anim;
  },
};

// ---------- walk 走路 ----------

const walkTemplate: ActionTemplate = {
  id: "walk",
  label: "Walk 走路",
  description: "双腿反相摆动，双臂反相摆动。",
  defaultDuration: 0.9,
  defaultLoop: true,
  params: [
    { key: "legSwing", label: "摆腿幅度 (度)", min: 5, max: 60, step: 1, default: 25 },
    { key: "armSwing", label: "摆臂幅度 (度)", min: 5, max: 60, step: 1, default: 30 },
    { key: "bodyBob", label: "身体上下", min: 0, max: 10, step: 0.5, default: 3 },
  ],
  generate: (skeleton, params) => {
    const duration = 0.9;
    const anim = emptyAnimation("walk", duration, true);
    const sampleCount = 16;

    const swingPair = (boneName: string, phase: number, amp: number) => {
      const bone = findBoneByName(skeleton, boneName);
      if (!bone) return;
      const tl = ensureTimeline(anim, bone.id);
      const samples = sampleSinKeyframes(
        sampleCount,
        duration,
        (t) => Math.sin((t / duration) * Math.PI * 2 + phase) * amp,
      );
      for (const s of samples) {
        pushKey(tl, { time: s.time, channel: "rotate", values: [s.value], easing: "linear" });
      }
    };

    swingPair("thighL", 0, params.legSwing);
    swingPair("thighR", Math.PI, params.legSwing);
    swingPair("upperArmL", Math.PI, params.armSwing);
    swingPair("upperArmR", 0, params.armSwing);

    // 四足兜底
    swingPair("legFL", 0, params.legSwing);
    swingPair("legFR", Math.PI, params.legSwing);
    swingPair("legBL", Math.PI, params.legSwing);
    swingPair("legBR", 0, params.legSwing);

    const torso = findBoneByName(skeleton, "torso") || findBoneByName(skeleton, "body");
    if (torso) {
      const tl = ensureTimeline(anim, torso.id);
      const samples = sampleSinKeyframes(
        sampleCount,
        duration,
        (t) => Math.abs(Math.sin((t / duration) * Math.PI * 2)) * -params.bodyBob,
      );
      for (const s of samples) {
        pushKey(tl, { time: s.time, channel: "translate", values: [0, s.value], easing: "linear" });
      }
    }

    return anim;
  },
};

// ---------- attack 挥击 ----------

const attackTemplate: ActionTemplate = {
  id: "attack",
  label: "Attack 挥击",
  description: "前摇 / 击中 / 回弹三段式。优先用右臂。",
  defaultDuration: 0.6,
  defaultLoop: false,
  params: [
    { key: "windup", label: "前摇时间 (s)", min: 0.05, max: 0.3, step: 0.01, default: 0.15 },
    { key: "windupAngle", label: "前摇角度 (度)", min: 5, max: 90, step: 1, default: 45 },
    { key: "strikeAngle", label: "击中角度 (度)", min: -120, max: -10, step: 1, default: -60 },
    { key: "recovery", label: "回弹时间 (s)", min: 0.1, max: 0.5, step: 0.01, default: 0.3 },
  ],
  generate: (skeleton, params) => {
    const duration = params.windup + params.recovery + 0.05;
    const anim = emptyAnimation("attack", Math.max(0.4, duration), false);

    const armBone = findBoneByName(skeleton, "upperArmR") || findBoneByName(skeleton, "upperArmL");
    if (armBone) {
      const tl = ensureTimeline(anim, armBone.id);
      pushKey(tl, { time: 0, channel: "rotate", values: [0], easing: "easeOut" });
      pushKey(tl, { time: params.windup, channel: "rotate", values: [params.windupAngle], easing: "easeIn" });
      pushKey(tl, {
        time: params.windup + 0.05,
        channel: "rotate",
        values: [params.strikeAngle],
        easing: "easeOut",
      });
      pushKey(tl, { time: anim.durationSec, channel: "rotate", values: [0], easing: "linear" });
    }

    const torso = findBoneByName(skeleton, "torso") || findBoneByName(skeleton, "body");
    if (torso) {
      const tl = ensureTimeline(anim, torso.id);
      pushKey(tl, { time: 0, channel: "rotate", values: [0], easing: "linear" });
      pushKey(tl, { time: params.windup, channel: "rotate", values: [-3], easing: "linear" });
      pushKey(tl, { time: params.windup + 0.05, channel: "rotate", values: [4], easing: "linear" });
      pushKey(tl, { time: anim.durationSec, channel: "rotate", values: [0], easing: "linear" });
    }

    return anim;
  },
};

// ---------- hurt 受击 ----------

const hurtTemplate: ActionTemplate = {
  id: "hurt",
  label: "Hurt 受击",
  description: "整体短促回弹，模拟被击退。",
  defaultDuration: 0.3,
  defaultLoop: false,
  params: [
    { key: "shakeX", label: "退后幅度", min: 4, max: 30, step: 1, default: 10 },
    { key: "tiltAngle", label: "倾斜角度 (度)", min: 2, max: 25, step: 1, default: 8 },
  ],
  generate: (skeleton, params) => {
    const duration = 0.3;
    const anim = emptyAnimation("hurt", duration, false);

    const root = findBoneByName(skeleton, "root");
    if (root) {
      const tl = ensureTimeline(anim, root.id);
      pushKey(tl, { time: 0, channel: "translate", values: [0, 0], easing: "easeOut" });
      pushKey(tl, { time: 0.08, channel: "translate", values: [-params.shakeX, -2], easing: "easeOut" });
      pushKey(tl, { time: 0.18, channel: "translate", values: [params.shakeX * 0.3, 0], easing: "easeIn" });
      pushKey(tl, { time: duration, channel: "translate", values: [0, 0], easing: "linear" });
    }

    const torso = findBoneByName(skeleton, "torso") || findBoneByName(skeleton, "body");
    if (torso) {
      const tl = ensureTimeline(anim, torso.id);
      pushKey(tl, { time: 0, channel: "rotate", values: [0], easing: "easeOut" });
      pushKey(tl, { time: 0.08, channel: "rotate", values: [params.tiltAngle], easing: "easeIn" });
      pushKey(tl, { time: 0.18, channel: "rotate", values: [-params.tiltAngle * 0.4], easing: "easeOut" });
      pushKey(tl, { time: duration, channel: "rotate", values: [0], easing: "linear" });
    }

    return anim;
  },
};

export const actionTemplates: ActionTemplate[] = [idleTemplate, walkTemplate, attackTemplate, hurtTemplate];

export function getActionTemplate(id: string): ActionTemplate | undefined {
  return actionTemplates.find((t) => t.id === id);
}

export function defaultParamsFor(template: ActionTemplate): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of template.params) out[p.key] = p.default;
  return out;
}

// 把当前模板的产出 Animation 替换 / 写入 skeleton.animations
export function applyAction(skeleton: Skeleton, templateId: string, params: Record<string, number>): Skeleton {
  const tpl = getActionTemplate(templateId);
  if (!tpl) return skeleton;
  const anim = tpl.generate(skeleton, params);
  anim.sourceTemplate = { templateId, params: { ...params } };
  const existed = skeleton.animations.find((a) => a.name === anim.name);
  const filtered = existed ? skeleton.animations.filter((a) => a.id !== existed.id) : skeleton.animations;
  return { ...skeleton, animations: [...filtered, anim] };
}
