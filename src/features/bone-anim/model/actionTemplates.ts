// 动作模板：参数化生成 Animation.bones 关键帧
// 设计原则：
// - 输入是 skeleton + params；输出是 Animation。
// - 内部以采样形式生成 keyframes，时间用秒，旋转用度，translate/scale 用相对 setup 的 delta。
// - 找不到对应骨骼时静默跳过，确保任意模板与任意骨架都能跑（缺胳膊就只动剩下的）。

import { Animation, BoneTimeline, Keyframe, Skeleton, findBoneByName, makeId } from "./skeletonModel";
import { TEMPLATE_PRESET_POSE } from "./templatePoseMap";
import { CharacterPose } from "./poseDetector";
import { projectAnimationToPose } from "./poseProjection";

export interface ActionTemplateParam {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
  group?: "basic" | "guard" | "advanced";
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

function pushRotateSamples(
  anim: Animation,
  skeleton: Skeleton,
  boneName: string,
  count: number,
  durationSec: number,
  amp: number,
  phase = 0,
) {
  const bone = findBoneByName(skeleton, boneName);
  if (!bone) return;
  const tl = ensureTimeline(anim, bone.id);
  const samples = sampleSinKeyframes(count, durationSec, (t) => Math.sin((t / durationSec) * Math.PI * 2 + phase) * amp);
  for (const s of samples) {
    pushKey(tl, { time: s.time, channel: "rotate", values: [s.value], easing: "linear" });
  }
}

function pushTranslateSamples(
  anim: Animation,
  skeleton: Skeleton,
  boneName: string,
  count: number,
  durationSec: number,
  xAmp: number,
  yAmp: number,
  phase = 0,
) {
  const bone = findBoneByName(skeleton, boneName);
  if (!bone) return;
  const tl = ensureTimeline(anim, bone.id);
  const samples = sampleSinKeyframes(count, durationSec, (t) => Math.sin((t / durationSec) * Math.PI * 2 + phase));
  for (const s of samples) {
    pushKey(tl, { time: s.time, channel: "translate", values: [s.value * xAmp, s.value * yAmp], easing: "linear" });
  }
}

function pushRotateKeys(anim: Animation, skeleton: Skeleton, boneName: string, keys: Array<[number, number, Keyframe["easing"]]>) {
  const bone = findBoneByName(skeleton, boneName);
  if (!bone) return;
  const tl = ensureTimeline(anim, bone.id);
  for (const [time, value, easing] of keys) {
    pushKey(tl, { time, channel: "rotate", values: [value], easing });
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function estimateShoulderGuard(skeleton: Skeleton): number {
  const scores = ["upperArmL", "upperArmR"].map((name) => {
    const bone = findBoneByName(skeleton, name);
    if (!bone) return 0;
    const slot = skeleton.slots.find((s) => s.boneId === bone.id && s.attachmentId);
    const attachment = slot?.attachmentId ? skeleton.attachments.find((a) => a.id === slot.attachmentId) : undefined;
    if (!slot || !attachment || !bone.length) return 0;

    const shoulderOffset = slot.setupOffset ? Math.hypot(slot.setupOffset.x, slot.setupOffset.y) : attachment.height * attachment.pivot.y;
    const widthRatio = attachment.width / Math.max(1, bone.length);
    const pivotRisk = attachment.pivot.y < 0.18 ? 0.35 : attachment.pivot.y < 0.28 ? 0.18 : 0;
    const offsetRisk = shoulderOffset < bone.length * 0.3 ? 0.3 : shoulderOffset < bone.length * 0.45 ? 0.15 : 0;
    const slimRisk = widthRatio < 0.75 ? 0.2 : widthRatio < 1 ? 0.1 : 0;

    return Math.min(0.65, pivotRisk + offsetRisk + slimRisk);
  });

  return Math.max(...scores, 0);
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

    pushRotateSamples(anim, skeleton, "hairFront", sampleCount, duration, params.headRot * 1.4, Math.PI * 0.7);
    pushRotateSamples(anim, skeleton, "hairBack", sampleCount, duration, params.headRot * 1.1, Math.PI * 0.95);
    pushRotateSamples(anim, skeleton, "cape", sampleCount, duration, params.torsoRot * 2.2, Math.PI * 1.1);
    pushRotateSamples(anim, skeleton, "skirt", sampleCount, duration, params.torsoRot * 1.8, Math.PI * 0.9);
    pushTranslateSamples(anim, skeleton, "eyeL", sampleCount, duration, 0.7, 0, Math.PI / 3);
    pushTranslateSamples(anim, skeleton, "eyeR", sampleCount, duration, 0.7, 0, Math.PI / 3);
    pushTranslateSamples(anim, skeleton, "mouth", sampleCount, duration, 0, 0.8, Math.PI);

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
    // 默认值整体下调约 40%：legSwing 25→14、armSwing 18→10、bodyBob 3→1.5
    // 原因：旧默认值在 480 画布上看起来摆动过夸张，且子骨接力比例差异（shin 0.45/foot 0.22）
    // 让肢体看起来"上下骨没接住" → 关节处贴图分离。这里同时收紧默认幅度 + 提高子骨接力比例。
    { key: "legSwing", label: "摆腿幅度 (度)", min: 0, max: 60, step: 1, default: 14 },
    { key: "armSwing", label: "摆臂幅度 (度)", min: 0, max: 60, step: 1, default: 10 },
    { key: "shinFollow", label: "小腿接力比例", min: 0.4, max: 1.2, step: 0.01, default: 0.9, group: "guard" },
    { key: "footFollow", label: "脚部接力比例", min: 0.4, max: 1.2, step: 0.01, default: 0.8, group: "guard" },
    { key: "shoulderSwingRatio", label: "肩部摆臂比例", min: 0, max: 1.2, step: 0.01, default: 0.55, group: "guard" },
    { key: "forearmSwingRatio", label: "前臂接力比例", min: 0.4, max: 1.2, step: 0.01, default: 0.95, group: "guard" },
    { key: "handSwingRatio", label: "手部接力比例", min: 0.4, max: 1.2, step: 0.01, default: 0.9, group: "guard" },
    { key: "armCrossGuard", label: "交叉保护", min: 0, max: 1, step: 0.01, default: 0.3, group: "guard" },
    { key: "bodyBob", label: "身体上下", min: 0, max: 10, step: 0.5, default: 1.5 },
  ],
  generate: (skeleton, params) => {
    const duration = 0.9;
    const anim = emptyAnimation("walk", duration, true);
    const sampleCount = 16;

    const swingPair = (boneName: string, phase: number, amp: number) => {
      pushRotateSamples(anim, skeleton, boneName, sampleCount, duration, amp, phase);
    };

    // 关节同步：原 phase 偏移（thigh→shin 0.35π→shin、foot→0.55π）会让父子骨摆动到各自极值的时机错开,
    // 在 480 画布上看起来"贴图在关节处分裂"。这里把子骨 phase 与父骨完全对齐（同相），
    // 接力比例提到 0.8~0.9（而不是 0.45/0.22），子骨整体看起来就像被父骨"带"着摆,
    // 关节处没有"父骨已到 +25° 而子骨还在 0°"的撕裂感。
    swingPair("thighL", 0, params.legSwing);
    swingPair("thighR", Math.PI, params.legSwing);
    swingPair("shinL", 0, params.legSwing * params.shinFollow);
    swingPair("shinR", Math.PI, params.legSwing * params.shinFollow);
    swingPair("footL", 0, params.legSwing * params.footFollow);
    swingPair("footR", Math.PI, params.legSwing * params.footFollow);
    const intelligentGuard = Math.max(clamp01(params.armCrossGuard), estimateShoulderGuard(skeleton));
    const shoulderRatio = Math.max(0, params.shoulderSwingRatio * (1 - intelligentGuard * 0.5));
    const forearmRatio = params.forearmSwingRatio;
    const handRatio = params.handSwingRatio;

    // 手臂同样关节对齐：肩/前臂/手共用 0/π phase；接力比例保持 0.55/0.95/0.9 让肩部小幅、
    // 前臂和手大幅同步——避免肩部 pivot 缝隙暴露 + 肘/腕处贴图分离。
    swingPair("upperArmL", Math.PI, params.armSwing * shoulderRatio);
    swingPair("upperArmR", 0, params.armSwing * shoulderRatio);
    swingPair("forearmL", Math.PI, params.armSwing * forearmRatio);
    swingPair("forearmR", 0, params.armSwing * forearmRatio);
    swingPair("handL", Math.PI, params.armSwing * handRatio);
    swingPair("handR", 0, params.armSwing * handRatio);
    swingPair("hairFront", Math.PI * 0.25, params.bodyBob * 1.1);
    swingPair("hairBack", Math.PI * 0.45, params.bodyBob * 1.4);
    swingPair("cape", Math.PI * 0.75, params.bodyBob * 2.2);
    swingPair("skirt", Math.PI * 0.55, params.bodyBob * 1.8);

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

    // 中线兜底：当 PSD 把 limb 服饰降级到 waist/chest（如 unsidedBoneNames），
    // 普通 walk 的 thigh/forearm 关键帧失效。这里给 waist/root 加几条小幅时间轴：
    // - waist 旋转 ±2°：模拟"重心左右切换"，让绑在 waist 上的整张裤子有微摆。
    // - root translate X ±1.2px：极小幅左右晃。两者对正常素材几乎不可见，对全无侧服饰素材"撑住"动感。
    pushMidlineFallbackWalk(anim, skeleton, sampleCount, duration);

    return anim;
  },
};

/**
 * walk 中线兜底：让 PSD1 这类"无肢体绑定"素材至少有重心切换 + 整体微晃。
 * 对正常素材也加但幅度极小，几乎不可见；对无侧素材投影器会另外加 waist Y 抬腿，
 * 这里不重复处理 Y 维度，专注 X 重心切换 + waist/chest 旋转。
 */
function pushMidlineFallbackWalk(anim: Animation, skeleton: Skeleton, sampleCount: number, duration: number) {
  // 兜底幅度回调：原 ±4°/±2.5°/±5px 与正常 thigh/forearm 摆动叠加后视觉偏夸张。
  // 现在收敛到 ±1.5°/±1°/±2px：对全无侧服饰素材仍有"重心切换"线索，
  // 对正常素材几乎不可察觉，避免 waist 上挂的整张下半身被额外晃动一次。
  pushRotateSamples(anim, skeleton, "waist", sampleCount, duration, 1.5, Math.PI / 2);
  pushRotateSamples(anim, skeleton, "chest", sampleCount, duration, 1.0, Math.PI / 2);
  const root = findBoneByName(skeleton, "root");
  if (root) {
    const tlRoot = ensureTimeline(anim, root.id);
    const xSamples = sampleSinKeyframes(sampleCount, duration, (t) => Math.sin((t / duration) * Math.PI * 2) * 2);
    for (const s of xSamples) pushKey(tlRoot, { time: s.time, channel: "translate", values: [s.value, 0], easing: "linear" });
  }
}

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
    // 肩部承担小幅，避免袖子绕轴翻转露出贴图缝；前臂/手承担主要挥击幅度。
    const shoulderRatio = 0.4;
    if (armBone) {
      const tl = ensureTimeline(anim, armBone.id);
      pushKey(tl, { time: 0, channel: "rotate", values: [0], easing: "easeOut" });
      pushKey(tl, { time: params.windup, channel: "rotate", values: [params.windupAngle * shoulderRatio], easing: "easeIn" });
      pushKey(tl, {
        time: params.windup + 0.05,
        channel: "rotate",
        values: [params.strikeAngle * shoulderRatio],
        easing: "easeOut",
      });
      pushKey(tl, { time: anim.durationSec, channel: "rotate", values: [0], easing: "linear" });
    }
    const side = armBone?.name.endsWith("L") ? "L" : "R";
    pushRotateKeys(anim, skeleton, `forearm${side}`, [
      [0, 0, "easeOut"],
      [params.windup, params.windupAngle * 0.7, "easeIn"],
      [params.windup + 0.05, params.strikeAngle * 0.85, "easeOut"],
      [anim.durationSec, 0, "linear"],
    ]);
    pushRotateKeys(anim, skeleton, `hand${side}`, [
      [0, 0, "easeOut"],
      [params.windup, params.windupAngle * 0.55, "easeIn"],
      [params.windup + 0.05, params.strikeAngle * 0.65, "easeOut"],
      [anim.durationSec, 0, "linear"],
    ]);

    const torso = findBoneByName(skeleton, "torso") || findBoneByName(skeleton, "body");
    if (torso) {
      const tl = ensureTimeline(anim, torso.id);
      pushKey(tl, { time: 0, channel: "rotate", values: [0], easing: "linear" });
      pushKey(tl, { time: params.windup, channel: "rotate", values: [-3], easing: "linear" });
      pushKey(tl, { time: params.windup + 0.05, channel: "rotate", values: [4], easing: "linear" });
      pushKey(tl, { time: anim.durationSec, channel: "rotate", values: [0], easing: "linear" });
    }
    for (const name of ["head", "hairFront", "hairBack", "cape", "skirt"]) {
      const amp = name === "head" ? 3 : name.startsWith("hair") ? 8 : 10;
      pushRotateKeys(anim, skeleton, name, [
        [0, 0, "linear"],
        [params.windup, -amp * 0.45, "easeIn"],
        [params.windup + 0.05, amp, "easeOut"],
        [anim.durationSec, 0, "linear"],
      ]);
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
    for (const [name, amp] of [
      ["head", params.tiltAngle * 0.7],
      ["hairFront", -params.tiltAngle * 1.4],
      ["hairBack", -params.tiltAngle * 1.8],
      ["cape", -params.tiltAngle * 1.6],
      ["skirt", -params.tiltAngle * 1.2],
    ] as Array<[string, number]>) {
      pushRotateKeys(anim, skeleton, name, [
        [0, 0, "easeOut"],
        [0.08, amp, "easeIn"],
        [0.18, -amp * 0.45, "easeOut"],
        [duration, 0, "linear"],
      ]);
    }
    pushTranslateSamples(anim, skeleton, "eyeL", 3, duration, -1.2, 0, 0);
    pushTranslateSamples(anim, skeleton, "eyeR", 3, duration, -1.2, 0, 0);
    pushTranslateSamples(anim, skeleton, "mouth", 3, duration, -0.8, 0.6, Math.PI / 2);

    return anim;
  },
};

// ---------- walkFront 正面行走 ----------
//
// 设计要点（与侧面 walkTemplate 区别）：
// - 髋（root/torso）做 sin*2 频率的"上下 bob"：每跨一步上下一次。
// - 腿不绕 Z 旋转（绕 Z 在正面观下变左右八字开合，看着像踢腿）；
//   改用 thigh.translate +y 抬腿（小腿 Y 缩短模拟膝弯），左右反相。
// - 同时给左右脚一个极小的 X 平移（< 4px）让"前后步"在正面视角下有微观左右切换感。
// - 手臂保留极小的躯干 sway，避免双手交叉穿身体。
const walkFrontTemplate: ActionTemplate = {
  id: "walkFront",
  label: "Walk 正面行走",
  description: "正面观行走：抬腿+轻微躯干 bob，不做绕 Z 八字开合。",
  defaultDuration: 0.9,
  defaultLoop: true,
  params: [
    { key: "legLift", label: "抬腿幅度 (px)", min: 0, max: 30, step: 0.5, default: 8 },
    { key: "legPivotSwing", label: "腿轻摆 (度)", min: 0, max: 12, step: 0.5, default: 3, group: "advanced" },
    { key: "shinFold", label: "小腿弯曲比", min: 0, max: 0.4, step: 0.01, default: 0.12, group: "advanced" },
    { key: "torsoBob", label: "躯干上下 (px)", min: 0, max: 12, step: 0.5, default: 3 },
    { key: "armSway", label: "手臂随动 (度)", min: 0, max: 18, step: 0.5, default: 5 },
    { key: "footStepX", label: "脚前后步 (px)", min: 0, max: 8, step: 0.2, default: 2, group: "advanced" },
  ],
  generate: (skeleton, params) => {
    const duration = 0.9;
    const anim = emptyAnimation("walk", duration, true);
    const sampleCount = 16;

    // 双步频率：bob/抬腿用 2 倍频率（左右各一步=完整周期）
    const stepFreq = (t: number) => Math.sin((t / duration) * Math.PI * 2);
    const bobFreq = (t: number) => -Math.abs(Math.sin((t / duration) * Math.PI * 2)) * params.torsoBob;

    // 躯干 bob
    const torso = findBoneByName(skeleton, "torso") || findBoneByName(skeleton, "body");
    if (torso) {
      const tl = ensureTimeline(anim, torso.id);
      const samples = sampleSinKeyframes(sampleCount, duration, bobFreq);
      for (const s of samples) pushKey(tl, { time: s.time, channel: "translate", values: [0, s.value], easing: "linear" });
    }

    // 抬腿：thighL/thighR translate Y 反相
    const liftLeg = (boneName: string, phase: number) => {
      const bone = findBoneByName(skeleton, boneName);
      if (!bone) return;
      const tl = ensureTimeline(anim, bone.id);
      const samples = sampleSinKeyframes(sampleCount, duration, (t) => Math.max(0, Math.sin((t / duration) * Math.PI * 2 + phase)) * -params.legLift);
      for (const s of samples) pushKey(tl, { time: s.time, channel: "translate", values: [0, s.value], easing: "linear" });
    };
    liftLeg("thighL", 0);
    liftLeg("thighR", Math.PI);

    // 小腿弯曲：scale Y 缩，让贴图模拟"屈膝"
    const foldShin = (boneName: string, phase: number) => {
      const bone = findBoneByName(skeleton, boneName);
      if (!bone) return;
      const tl = ensureTimeline(anim, bone.id);
      const samples = sampleSinKeyframes(sampleCount, duration, (t) => 1 - Math.max(0, Math.sin((t / duration) * Math.PI * 2 + phase)) * params.shinFold);
      for (const s of samples) pushKey(tl, { time: s.time, channel: "scale", values: [1, s.value], easing: "linear" });
    };
    foldShin("shinL", 0);
    foldShin("shinR", Math.PI);

    // 腿微摆（极小幅，给一点正面行走"重心切换"感）
    pushRotateSamples(anim, skeleton, "thighL", sampleCount, duration, params.legPivotSwing, 0);
    pushRotateSamples(anim, skeleton, "thighR", sampleCount, duration, -params.legPivotSwing, 0);

    // 脚前后步：translate X 反相（极小幅）
    const stepFoot = (boneName: string, phase: number) => {
      const bone = findBoneByName(skeleton, boneName);
      if (!bone) return;
      const tl = ensureTimeline(anim, bone.id);
      const samples = sampleSinKeyframes(sampleCount, duration, (t) => Math.sin((t / duration) * Math.PI * 2 + phase) * params.footStepX);
      for (const s of samples) pushKey(tl, { time: s.time, channel: "translate", values: [s.value, 0], easing: "linear" });
    };
    stepFoot("footL", 0);
    stepFoot("footR", Math.PI);

    // 手臂：极小躯干随动，反相，避免穿身
    pushRotateSamples(anim, skeleton, "upperArmL", sampleCount, duration, params.armSway, Math.PI);
    pushRotateSamples(anim, skeleton, "upperArmR", sampleCount, duration, params.armSway, 0);
    pushRotateSamples(anim, skeleton, "forearmL", sampleCount, duration, params.armSway * 0.6, Math.PI * 1.05);
    pushRotateSamples(anim, skeleton, "forearmR", sampleCount, duration, params.armSway * 0.6, 0.05);

    // 头发/披风轻轻随 bob
    pushRotateSamples(anim, skeleton, "hairFront", sampleCount, duration, params.torsoBob * 0.6, Math.PI * 0.3);
    pushRotateSamples(anim, skeleton, "hairBack", sampleCount, duration, params.torsoBob * 0.8, Math.PI * 0.5);
    pushRotateSamples(anim, skeleton, "cape", sampleCount, duration, params.torsoBob * 1.4, Math.PI * 0.8);
    pushRotateSamples(anim, skeleton, "skirt", sampleCount, duration, params.torsoBob * 1.2, Math.PI * 0.6);

    // 中线兜底（同 walkTemplate）：让全无侧服饰素材也有重心切换。
    pushMidlineFallbackWalk(anim, skeleton, sampleCount, duration);

    return anim;
  },
};

// ---------- idleFront 正面待机 ----------
const idleFrontTemplate: ActionTemplate = {
  id: "idleFront",
  label: "Idle 正面呼吸",
  description: "正面观待机：上下浮动 + 左右极轻重心切换。",
  defaultDuration: 1.6,
  defaultLoop: true,
  params: [
    { key: "amplitudeY", label: "上下幅度", min: 0, max: 12, step: 0.5, default: 3 },
    { key: "swayX", label: "重心切换 (px)", min: 0, max: 4, step: 0.1, default: 1 },
    { key: "headRot", label: "头部摆动 (度)", min: 0, max: 6, step: 0.1, default: 1.2 },
  ],
  generate: (skeleton, params) => {
    const duration = 1.6;
    const anim = emptyAnimation("idle", duration, true);
    const sampleCount = 12;

    const torso = findBoneByName(skeleton, "torso") || findBoneByName(skeleton, "body");
    if (torso) {
      const tl = ensureTimeline(anim, torso.id);
      const trans = sampleSinKeyframes(sampleCount, duration, (t) => Math.sin((t / duration) * Math.PI * 2) * -params.amplitudeY);
      const transX = sampleSinKeyframes(sampleCount, duration, (t) => Math.sin((t / duration) * Math.PI * 2 + Math.PI / 2) * params.swayX);
      for (let i = 0; i < trans.length; i += 1) {
        pushKey(tl, { time: trans[i].time, channel: "translate", values: [transX[i].value, trans[i].value], easing: "linear" });
      }
    }
    pushRotateSamples(anim, skeleton, "head", sampleCount, duration, params.headRot, Math.PI / 4);
    pushRotateSamples(anim, skeleton, "hairFront", sampleCount, duration, params.headRot * 1.4, Math.PI * 0.7);
    pushRotateSamples(anim, skeleton, "hairBack", sampleCount, duration, params.headRot * 1.1, Math.PI * 0.95);
    pushRotateSamples(anim, skeleton, "cape", sampleCount, duration, params.amplitudeY * 0.5, Math.PI * 1.1);
    pushRotateSamples(anim, skeleton, "skirt", sampleCount, duration, params.amplitudeY * 0.4, Math.PI * 0.9);
    return anim;
  },
};

// ---------- runFront 正面奔跑 ----------
// 与 walkFront 同结构，加大幅 + 提高频率（步幅快），保留躯干轻微前倾。
const runFrontTemplate: ActionTemplate = {
  id: "runFront",
  label: "Run 正面奔跑",
  description: "正面观奔跑：抬腿幅度更大、躯干轻微前倾。",
  defaultDuration: 0.6,
  defaultLoop: true,
  params: [
    { key: "legLift", label: "抬腿幅度 (px)", min: 4, max: 40, step: 0.5, default: 14 },
    { key: "torsoBob", label: "躯干上下 (px)", min: 1, max: 14, step: 0.5, default: 5 },
    { key: "torsoLean", label: "躯干前倾 (度)", min: 0, max: 12, step: 0.5, default: 4 },
    { key: "armSway", label: "手臂摆动 (度)", min: 4, max: 30, step: 0.5, default: 10 },
  ],
  generate: (skeleton, params) => {
    const duration = 0.6;
    const anim = emptyAnimation("run", duration, true);
    const sampleCount = 14;

    const torso = findBoneByName(skeleton, "torso") || findBoneByName(skeleton, "body");
    if (torso) {
      const tl = ensureTimeline(anim, torso.id);
      const samples = sampleSinKeyframes(sampleCount, duration, (t) => -Math.abs(Math.sin((t / duration) * Math.PI * 2)) * params.torsoBob);
      for (const s of samples) pushKey(tl, { time: s.time, channel: "translate", values: [0, s.value], easing: "linear" });
      // 持续前倾（不振荡），写两个端点即可：
      pushKey(tl, { time: 0, channel: "rotate", values: [params.torsoLean], easing: "linear" });
      pushKey(tl, { time: duration, channel: "rotate", values: [params.torsoLean], easing: "linear" });
    }

    const liftLeg = (boneName: string, phase: number) => {
      const bone = findBoneByName(skeleton, boneName);
      if (!bone) return;
      const tl = ensureTimeline(anim, bone.id);
      const samples = sampleSinKeyframes(sampleCount, duration, (t) => Math.max(0, Math.sin((t / duration) * Math.PI * 2 + phase)) * -params.legLift);
      for (const s of samples) pushKey(tl, { time: s.time, channel: "translate", values: [0, s.value], easing: "linear" });
    };
    liftLeg("thighL", 0);
    liftLeg("thighR", Math.PI);

    pushRotateSamples(anim, skeleton, "upperArmL", sampleCount, duration, params.armSway, Math.PI);
    pushRotateSamples(anim, skeleton, "upperArmR", sampleCount, duration, params.armSway, 0);
    pushRotateSamples(anim, skeleton, "forearmL", sampleCount, duration, params.armSway * 0.7, Math.PI * 1.05);
    pushRotateSamples(anim, skeleton, "forearmR", sampleCount, duration, params.armSway * 0.7, 0.05);

    pushRotateSamples(anim, skeleton, "hairFront", sampleCount, duration, params.torsoBob * 0.8, Math.PI * 0.3);
    pushRotateSamples(anim, skeleton, "hairBack", sampleCount, duration, params.torsoBob * 1.0, Math.PI * 0.5);
    pushRotateSamples(anim, skeleton, "cape", sampleCount, duration, params.torsoBob * 2.0, Math.PI * 0.8);
    pushRotateSamples(anim, skeleton, "skirt", sampleCount, duration, params.torsoBob * 1.6, Math.PI * 0.6);

    return anim;
  },
};

// ---------- back 背面动作 ----------
const idleBackTemplate: ActionTemplate = {
  id: "idleBack",
  label: "Idle 背面呼吸",
  description: "背面观待机：上下浮动 + 头发摆动。",
  defaultDuration: 1.6,
  defaultLoop: true,
  params: [
    { key: "amplitudeY", label: "上下幅度", min: 0, max: 12, step: 0.5, default: 3 },
    { key: "headRot", label: "头部摆动 (度)", min: 0, max: 6, step: 0.1, default: 1.2 },
  ],
  generate: (skeleton, params) => {
    const duration = 1.6;
    const anim = emptyAnimation("idleBack", duration, true);
    const sampleCount = 12;

    const torso = findBoneByName(skeleton, "torso") || findBoneByName(skeleton, "body");
    if (torso) {
      const tl = ensureTimeline(anim, torso.id);
      const trans = sampleSinKeyframes(sampleCount, duration, (t) => Math.sin((t / duration) * Math.PI * 2) * -params.amplitudeY);
      for (let i = 0; i < trans.length; i += 1) {
        pushKey(tl, { time: trans[i].time, channel: "translate", values: [0, trans[i].value], easing: "linear" });
      }
    }
    pushRotateSamples(anim, skeleton, "head", sampleCount, duration, params.headRot, Math.PI / 4);
    pushRotateSamples(anim, skeleton, "hairBack", sampleCount, duration, params.headRot * 1.4, Math.PI * 0.7);
    pushRotateSamples(anim, skeleton, "cape", sampleCount, duration, params.amplitudeY * 0.5, Math.PI * 1.1);
    return anim;
  },
};

const walkBackTemplate: ActionTemplate = {
  id: "walkBack",
  label: "Walk 背面行走",
  description: "背面观行走：抬腿 + 躯干上下 + 手臂摆动。",
  defaultDuration: 0.8,
  defaultLoop: true,
  params: [
    { key: "legLift", label: "抬腿幅度 (px)", min: 4, max: 30, step: 0.5, default: 10 },
    { key: "torsoBob", label: "躯干上下 (px)", min: 1, max: 10, step: 0.5, default: 3 },
    { key: "armSway", label: "手臂摆动 (度)", min: 4, max: 30, step: 0.5, default: 12 },
  ],
  generate: (skeleton, params) => {
    const duration = 0.8;
    const anim = emptyAnimation("walkBack", duration, true);
    const sampleCount = 14;

    const torso = findBoneByName(skeleton, "torso") || findBoneByName(skeleton, "body");
    if (torso) {
      const tl = ensureTimeline(anim, torso.id);
      const samples = sampleSinKeyframes(sampleCount, duration, (t) => -Math.abs(Math.sin((t / duration) * Math.PI * 2)) * params.torsoBob);
      for (const s of samples) pushKey(tl, { time: s.time, channel: "translate", values: [0, s.value], easing: "linear" });
    }

    const liftLeg = (boneName: string, phase: number) => {
      const bone = findBoneByName(skeleton, boneName);
      if (!bone) return;
      const tl = ensureTimeline(anim, bone.id);
      const samples = sampleSinKeyframes(sampleCount, duration, (t) => Math.max(0, Math.sin((t / duration) * Math.PI * 2 + phase)) * -params.legLift);
      for (const s of samples) pushKey(tl, { time: s.time, channel: "translate", values: [0, s.value], easing: "linear" });
    };
    liftLeg("thighL", 0);
    liftLeg("thighR", Math.PI);

    pushRotateSamples(anim, skeleton, "upperArmL", sampleCount, duration, params.armSway, Math.PI);
    pushRotateSamples(anim, skeleton, "upperArmR", sampleCount, duration, params.armSway, 0);
    pushRotateSamples(anim, skeleton, "forearmL", sampleCount, duration, params.armSway * 0.7, Math.PI * 1.05);
    pushRotateSamples(anim, skeleton, "forearmR", sampleCount, duration, params.armSway * 0.7, 0.05);

    pushRotateSamples(anim, skeleton, "hairBack", sampleCount, duration, params.torsoBob * 1.2, Math.PI * 0.45);
    pushRotateSamples(anim, skeleton, "cape", sampleCount, duration, params.torsoBob * 1.5, Math.PI * 0.6);

    return anim;
  },
};

const runBackTemplate: ActionTemplate = {
  id: "runBack",
  label: "Run 背面奔跑",
  description: "背面观奔跑：抬腿幅度更大、躯干轻微前倾。",
  defaultDuration: 0.6,
  defaultLoop: true,
  params: [
    { key: "legLift", label: "抬腿幅度 (px)", min: 4, max: 40, step: 0.5, default: 14 },
    { key: "torsoBob", label: "躯干上下 (px)", min: 1, max: 14, step: 0.5, default: 5 },
    { key: "torsoLean", label: "躯干前倾 (度)", min: 0, max: 12, step: 0.5, default: 4 },
    { key: "armSway", label: "手臂摆动 (度)", min: 4, max: 30, step: 0.5, default: 10 },
  ],
  generate: (skeleton, params) => {
    const duration = 0.6;
    const anim = emptyAnimation("runBack", duration, true);
    const sampleCount = 14;

    const torso = findBoneByName(skeleton, "torso") || findBoneByName(skeleton, "body");
    if (torso) {
      const tl = ensureTimeline(anim, torso.id);
      const samples = sampleSinKeyframes(sampleCount, duration, (t) => -Math.abs(Math.sin((t / duration) * Math.PI * 2)) * params.torsoBob);
      for (const s of samples) pushKey(tl, { time: s.time, channel: "translate", values: [0, s.value], easing: "linear" });
      pushKey(tl, { time: 0, channel: "rotate", values: [params.torsoLean], easing: "linear" });
      pushKey(tl, { time: duration, channel: "rotate", values: [params.torsoLean], easing: "linear" });
    }

    const liftLeg = (boneName: string, phase: number) => {
      const bone = findBoneByName(skeleton, boneName);
      if (!bone) return;
      const tl = ensureTimeline(anim, bone.id);
      const samples = sampleSinKeyframes(sampleCount, duration, (t) => Math.max(0, Math.sin((t / duration) * Math.PI * 2 + phase)) * -params.legLift);
      for (const s of samples) pushKey(tl, { time: s.time, channel: "translate", values: [0, s.value], easing: "linear" });
    };
    liftLeg("thighL", 0);
    liftLeg("thighR", Math.PI);

    pushRotateSamples(anim, skeleton, "upperArmL", sampleCount, duration, params.armSway, Math.PI);
    pushRotateSamples(anim, skeleton, "upperArmR", sampleCount, duration, params.armSway, 0);
    pushRotateSamples(anim, skeleton, "forearmL", sampleCount, duration, params.armSway * 0.7, Math.PI * 1.05);
    pushRotateSamples(anim, skeleton, "forearmR", sampleCount, duration, params.armSway * 0.7, 0.05);

    pushRotateSamples(anim, skeleton, "hairBack", sampleCount, duration, params.torsoBob * 1.5, Math.PI * 0.45);
    pushRotateSamples(anim, skeleton, "cape", sampleCount, duration, params.torsoBob * 2.0, Math.PI * 0.8);

    return anim;
  },
};

// ---------- side 侧面动作 ----------
const idleSideTemplate: ActionTemplate = {
  ...idleTemplate,
  id: "idleSide",
  label: "Idle 侧面呼吸",
  description: "侧面/3Q 待机：轻微前后重心与头发摆动。",
  generate: (skeleton, params) => {
    const anim = idleTemplate.generate(skeleton, params);
    anim.name = "idleSide";
    pushTranslateSamples(anim, skeleton, "root", 12, anim.durationSec, 1.5, 0, Math.PI / 2);
    return anim;
  },
};

const walkSideTemplate: ActionTemplate = {
  ...walkTemplate,
  id: "walkSide",
  label: "Walk 侧面行走",
  description: "真侧面/3Q 行走：沿侧面模板摆腿摆臂。",
  generate: (skeleton, params) => {
    const anim = walkTemplate.generate(skeleton, params);
    anim.name = "walkSide";
    return anim;
  },
};

const runSideTemplate: ActionTemplate = {
  id: "runSide",
  label: "Run 侧面奔跑",
  description: "侧面奔跑：更快步频、更大摆腿与身体起伏。",
  defaultDuration: 0.55,
  defaultLoop: true,
  params: [
    { key: "legSwing", label: "摆腿幅度 (度)", min: 0, max: 70, step: 1, default: 24 },
    { key: "armSwing", label: "摆臂幅度 (度)", min: 0, max: 70, step: 1, default: 18 },
    { key: "bodyBob", label: "身体上下", min: 0, max: 14, step: 0.5, default: 4 },
    { key: "lean", label: "前倾 (度)", min: 0, max: 14, step: 0.5, default: 5, group: "advanced" },
  ],
  generate: (skeleton, params) => {
    const duration = 0.55;
    const anim = emptyAnimation("runSide", duration, true);
    const sampleCount = 14;
    pushRotateSamples(anim, skeleton, "thighL", sampleCount, duration, params.legSwing, 0);
    pushRotateSamples(anim, skeleton, "thighR", sampleCount, duration, params.legSwing, Math.PI);
    pushRotateSamples(anim, skeleton, "shinL", sampleCount, duration, params.legSwing * 0.9, 0);
    pushRotateSamples(anim, skeleton, "shinR", sampleCount, duration, params.legSwing * 0.9, Math.PI);
    pushRotateSamples(anim, skeleton, "footL", sampleCount, duration, params.legSwing * 0.75, 0);
    pushRotateSamples(anim, skeleton, "footR", sampleCount, duration, params.legSwing * 0.75, Math.PI);
    pushRotateSamples(anim, skeleton, "upperArmL", sampleCount, duration, params.armSwing * 0.55, Math.PI);
    pushRotateSamples(anim, skeleton, "upperArmR", sampleCount, duration, params.armSwing * 0.55, 0);
    pushRotateSamples(anim, skeleton, "forearmL", sampleCount, duration, params.armSwing, Math.PI);
    pushRotateSamples(anim, skeleton, "forearmR", sampleCount, duration, params.armSwing, 0);
    pushRotateSamples(anim, skeleton, "handL", sampleCount, duration, params.armSwing * 0.8, Math.PI);
    pushRotateSamples(anim, skeleton, "handR", sampleCount, duration, params.armSwing * 0.8, 0);
    const torso = findBoneByName(skeleton, "torso") || findBoneByName(skeleton, "body");
    if (torso) {
      const tl = ensureTimeline(anim, torso.id);
      const samples = sampleSinKeyframes(sampleCount, duration, (t) => -Math.abs(Math.sin((t / duration) * Math.PI * 2)) * params.bodyBob);
      for (const sample of samples) pushKey(tl, { time: sample.time, channel: "translate", values: [0, sample.value], easing: "linear" });
      pushKey(tl, { time: 0, channel: "rotate", values: [params.lean], easing: "linear" });
      pushKey(tl, { time: duration, channel: "rotate", values: [params.lean], easing: "linear" });
    }
    pushRotateSamples(anim, skeleton, "hairFront", sampleCount, duration, params.bodyBob * 1.2, Math.PI * 0.25);
    pushRotateSamples(anim, skeleton, "hairBack", sampleCount, duration, params.bodyBob * 1.5, Math.PI * 0.45);
    pushRotateSamples(anim, skeleton, "cape", sampleCount, duration, params.bodyBob * 2.4, Math.PI * 0.75);
    pushRotateSamples(anim, skeleton, "skirt", sampleCount, duration, params.bodyBob * 1.8, Math.PI * 0.55);
    return anim;
  },
};

const castSideTemplate: ActionTemplate = {
  id: "castSide",
  label: "Cast 侧面施法",
  description: "侧面施法：近侧手臂前伸，头发和披风跟随。",
  defaultDuration: 0.8,
  defaultLoop: false,
  params: [
    { key: "raiseAngle", label: "抬手角度 (度)", min: 5, max: 80, step: 1, default: 35 },
    { key: "pushAngle", label: "推出角度 (度)", min: -80, max: 40, step: 1, default: -30 },
    { key: "torsoLean", label: "躯干前倾 (度)", min: 0, max: 16, step: 0.5, default: 5 },
  ],
  generate: (skeleton, params) => {
    const anim = emptyAnimation("castSide", 0.8, false);
    pushRotateKeys(anim, skeleton, "upperArmL", [[0, 0, "easeOut"], [0.25, params.raiseAngle * 0.45, "easeIn"], [0.5, params.pushAngle * 0.45, "easeOut"], [0.8, 0, "linear"]]);
    pushRotateKeys(anim, skeleton, "forearmL", [[0, 0, "easeOut"], [0.25, params.raiseAngle, "easeIn"], [0.5, params.pushAngle, "easeOut"], [0.8, 0, "linear"]]);
    pushRotateKeys(anim, skeleton, "handL", [[0, 0, "easeOut"], [0.25, params.raiseAngle * 0.7, "easeIn"], [0.5, params.pushAngle * 0.8, "easeOut"], [0.8, 0, "linear"]]);
    pushRotateKeys(anim, skeleton, "torso", [[0, 0, "linear"], [0.5, params.torsoLean, "easeOut"], [0.8, 0, "linear"]]);
    pushRotateKeys(anim, skeleton, "head", [[0, 0, "linear"], [0.5, -params.torsoLean * 0.5, "easeOut"], [0.8, 0, "linear"]]);
    pushRotateSamples(anim, skeleton, "hairFront", 6, 0.8, params.torsoLean * 1.2, Math.PI * 0.7);
    pushRotateSamples(anim, skeleton, "hairBack", 6, 0.8, params.torsoLean * 1.6, Math.PI * 0.9);
    pushRotateSamples(anim, skeleton, "cape", 6, 0.8, params.torsoLean * 2, Math.PI);
    return anim;
  },
};

export const actionTemplates: ActionTemplate[] = [
  idleTemplate,
  walkTemplate,
  attackTemplate,
  hurtTemplate,
  walkFrontTemplate,
  idleFrontTemplate,
  runFrontTemplate,
  idleBackTemplate,
  walkBackTemplate,
  runBackTemplate,
  idleSideTemplate,
  walkSideTemplate,
  runSideTemplate,
  castSideTemplate,
];

/** 各预制对哪种姿态最适合：UI 高亮 + 投影决策都用它。Re-export 自 templatePoseMap 以兼容外部引用。 */
export { TEMPLATE_PRESET_POSE };

export function getActionTemplate(id: string): ActionTemplate | undefined {
  return actionTemplates.find((t) => t.id === id);
}

export function defaultParamsFor(template: ActionTemplate): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of template.params) out[p.key] = p.default;
  return out;
}

// 把当前模板的产出 Animation 替换 / 写入 skeleton.animations
// pose（可选）：当前角色面对方向；若为 front/back 且模板是 side 取向，会调用 poseProjection 把动画"翻译"过来。
export function applyAction(skeleton: Skeleton, templateId: string, params: Record<string, number>, pose?: CharacterPose): Skeleton {
  const tpl = getActionTemplate(templateId);
  if (!tpl) return skeleton;
  let anim = tpl.generate(skeleton, params);
  anim.sourceTemplate = { templateId, params: { ...params } };
  if (pose) {
    anim = projectAnimationToPose(anim, skeleton, pose);
  }
  const existed = skeleton.animations.find((a) => a.sourceTemplate?.templateId === templateId) ?? skeleton.animations.find((a) => a.name === anim.name);
  const filtered = existed ? skeleton.animations.filter((a) => a.id !== existed.id) : skeleton.animations;
  return { ...skeleton, animations: [...filtered, anim] };
}
