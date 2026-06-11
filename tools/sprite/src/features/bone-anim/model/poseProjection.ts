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
// 兜底（PSD 服饰图层无 -l/-r 后缀场景）：
//   mapPsdLayerToBone 会把 legwear/footwear 等无侧图层降级到 waist/torso，
//   分肢骨 thighL/R 与 shinL/R 上没有 attachment。这种情况下原投影写到分肢骨的
//   抬腿/屈膝帧会完全打到空骨上，肉眼看不到任何腿动。
//   解决：投影时先看分肢骨是否真挂图，全空挂时把抬腿改写到 waist/root（整体踏步），
//   并加大 pushMidlineFallbackWalk 的 root.X / waist 旋转幅度。
//
// 这样无需重写模板：用户在正面观下选"Walk 走路"也能看到合理表现；
// 想要更精细的视觉，再切换"Walk 正面行走"。

import { Animation, BoneTimeline, Keyframe, Skeleton, findBone, findBoneByName } from "./skeletonModel";
import { CharacterPose } from "./poseDetector";
import { TEMPLATE_PRESET_POSE } from "./templatePoseMap";

/** 给定骨名集合，是否至少有一根骨同时挂了 attachment。判断分肢骨是否被 PSD 真正使用。 */
function anyBoneHasAttachment(skeleton: Skeleton, boneNames: string[]): boolean {
  for (const name of boneNames) {
    const bone = findBoneByName(skeleton, name);
    if (!bone) continue;
    const hit = skeleton.slots.some((s) => s.boneId === bone.id && s.attachmentId);
    if (hit) return true;
  }
  return false;
}

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

  // 分肢骨是否真有 PSD attachment：服饰图层无 -l/-r 后缀时，
  // legwear/footwear 会被 mapPsdLayerToBone 降级到 waist/torso，分肢骨形同虚设。
  // 此时把抬腿改写到 waist/root（整体踏步），保证肉眼能看到腿部位移。
  const legBonesActive = anyBoneHasAttachment(skeleton, ["thighL", "thighR", "shinL", "shinR", "footL", "footR"]);
  const armBonesActive = anyBoneHasAttachment(skeleton, ["upperArmL", "upperArmR", "forearmL", "forearmR", "handL", "handR"]);

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

  // 分肢骨全空挂兜底：把"抬腿"改写到 waist 的 Y 上下踏步（频率 2x：每跨一步上下一次），
  // 让 PSD 服饰风格素材（如 PSD1/PSD2 的 legwear→waist 降级）也能看到可见的腿部位移。
  // 注意：waist 已挂 legwear/bottomwear/skirt 等服饰图层，translate Y 会带动整张下半身。
  if (!legBonesActive) {
    const waistTl = ensure("waist");
    if (waistTl) {
      // 兜底幅度同步回调：原 max(6, liftPx*1.2) 在 legSwing=14 默认下产生 ~6.7px 全身抬腿,
      // 与新降幅后的 thigh 摆动量同量级。这里压到 max(2, liftPx*0.5),既保留"无侧素材"
      // 的可视踏步,又不会让正常 PSD 的下半身被额外大幅抬起。
      const stepLift = Math.max(2, liftPx * 0.5);
      for (let i = 0; i <= sampleCount; i += 1) {
        const t = (i / sampleCount) * duration;
        const value = -Math.abs(Math.sin((t / duration) * Math.PI * 2)) * stepLift;
        waistTl.keyframes.push({ time: t, channel: "translate", values: [0, value], easing: "linear" });
      }
    }
  }

  // 同理：分肢手骨全空挂时，原 armDamp 已让原有 rotate 衰减为 0.35×，再加上骨上无图，等于无效。
  // 这里不强行把摆臂搬走（无侧服饰多半就不该有手部位移），但保留 hook 以便将来扩展。
  void armBonesActive;

  return {
    ...anim,
    bones: newBones,
    sourceTemplate: anim.sourceTemplate
      ? { ...anim.sourceTemplate, params: { ...anim.sourceTemplate.params, _projectedPose: pose === "front" ? 0 : 1 } }
      : anim.sourceTemplate,
  };
}
