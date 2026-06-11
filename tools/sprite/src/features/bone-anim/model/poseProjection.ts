// 动画姿态投影：把"侧面观"模板生成的 Animation 改写成"正面/背面观"等价表现。
//
// 起因：side-view 预制（如 walkTemplate）让 thighL/R 反相绕 Z 旋转，
//   在侧面观下是"前后迈步"，但在正面观下变成"左右八字开合"。
//
// 投影规则（front/back）：
// - 大腿/小腿的 rotate 时间轴：清空 → 改成 thigh.translate +Y（抬腿）+ shin.scale Y 缩短（屈膝）；
//   左右仍保持反相，但走"上下"而非"绕 Z"。
// - 大臂/前臂/手 的 rotate 幅度：×0.35（保留一点随动，避免穿身）。
// - torso 的 translate（bob）/ rotate（轻微）保留。
// - cape/skirt/hair 保留。
// - 其他骨骼通道保留。
//
// 这样无需重写模板：用户在正面观下选"Walk 走路"也能看到合理表现；
// 想要更精细的视觉，再切换"Walk 正面行走"。

import { Animation, BoneTimeline, Keyframe, Skeleton, findBone, findBoneByName } from "./skeletonModel";
import { CharacterPose } from "./poseDetector";
import { TEMPLATE_PRESET_POSE } from "./templatePoseMap";

/** 投影后写入新的 BoneTimeline 列表；不修改原 anim。 */
export function projectAnimationToPose(anim: Animation, skeleton: Skeleton, pose: CharacterPose): Animation {
  const templateId = anim.sourceTemplate?.templateId;
  const preset = templateId ? TEMPLATE_PRESET_POSE[templateId] : undefined;
  // 仅当：模板是 side 取向 + 当前姿态是 front/back 时，才投影。
  const needProject = preset === "side" && (pose === "front" || pose === "back");
  if (!needProject) return anim;

  // 借鉴模板里默认抬腿/屈膝幅度（无法精确反推时给保守默认值）。
  const params = anim.sourceTemplate?.params ?? {};
  const legSwingDeg = Number(params.legSwing ?? 25); // 越大投影出来抬腿幅度越大
  const liftPx = Math.max(4, legSwingDeg * 0.4); // 经验比例：1° ≈ 0.4px 抬腿
  const shinFold = Math.min(0.3, legSwingDeg / 200); // 1° ≈ 0.005 缩短比例
  const armDamp = 0.35;
  const duration = anim.durationSec;
  const sampleCount = 16;

  const newBones: BoneTimeline[] = [];

  // 先把"非腿手"的时间轴原样搬过去（含 torso bob、披风/裙摆/头发）
  for (const tl of anim.bones) {
    const bone = findBone(skeleton, tl.boneId);
    if (!bone) {
      newBones.push(tl);
      continue;
    }
    const isLegRot = /^(thigh|shin|foot)(L|R)$/.test(bone.name) && tl.keyframes.some((k) => k.channel === "rotate");
    const isArmRot = /^(upperArm|forearm|hand)(L|R)$/.test(bone.name) && tl.keyframes.some((k) => k.channel === "rotate");

    if (isLegRot) {
      // 丢掉 rotate 帧，translate/scale 保留
      const filtered: Keyframe[] = tl.keyframes.filter((k) => k.channel !== "rotate");
      if (filtered.length > 0) newBones.push({ boneId: tl.boneId, keyframes: filtered });
      continue;
    }
    if (isArmRot) {
      // rotate 幅度衰减
      const damped: Keyframe[] = tl.keyframes.map((k) =>
        k.channel === "rotate"
          ? { ...k, values: k.values.map((v) => v * armDamp) }
          : k,
      );
      newBones.push({ boneId: tl.boneId, keyframes: damped });
      continue;
    }
    newBones.push(tl);
  }

  // 加入抬腿/屈膝时间轴（左右反相）
  function ensure(boneName: string): BoneTimeline | null {
    const bone = findBoneByName(skeleton, boneName);
    if (!bone) return null;
    let tl = newBones.find((b) => b.boneId === bone.id);
    if (!tl) {
      tl = { boneId: bone.id, keyframes: [] };
      newBones.push(tl);
    }
    return tl;
  }

  function pushSampledY(boneName: string, phase: number, signedAmp: number) {
    const tl = ensure(boneName);
    if (!tl) return;
    for (let i = 0; i <= sampleCount; i += 1) {
      const t = (i / sampleCount) * duration;
      const value = Math.max(0, Math.sin((t / duration) * Math.PI * 2 + phase)) * signedAmp;
      tl.keyframes.push({ time: t, channel: "translate", values: [0, value], easing: "linear" });
    }
  }
  function pushSampledScaleY(boneName: string, phase: number, foldRatio: number) {
    const tl = ensure(boneName);
    if (!tl) return;
    for (let i = 0; i <= sampleCount; i += 1) {
      const t = (i / sampleCount) * duration;
      const value = 1 - Math.max(0, Math.sin((t / duration) * Math.PI * 2 + phase)) * foldRatio;
      tl.keyframes.push({ time: t, channel: "scale", values: [1, value], easing: "linear" });
    }
  }

  pushSampledY("thighL", 0, -liftPx);
  pushSampledY("thighR", Math.PI, -liftPx);
  pushSampledScaleY("shinL", 0, shinFold);
  pushSampledScaleY("shinR", Math.PI, shinFold);

  return {
    ...anim,
    bones: newBones,
    sourceTemplate: anim.sourceTemplate
      ? { ...anim.sourceTemplate, params: { ...anim.sourceTemplate.params, _projectedPose: pose === "front" ? 0 : 1 } }
      : anim.sourceTemplate,
  };
}
