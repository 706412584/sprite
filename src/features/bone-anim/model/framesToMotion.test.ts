import { describe, expect, it } from "vitest";
import { framesToMotion, FramePose } from "./framesToMotion";
import { applyTemplate, getTemplateById } from "./skeletonTemplates";
import { createEmptySkeleton, Skeleton, Animation, computeBoneWorld, findBoneByName, Keyframe } from "./skeletonModel";

function humanoid(): Skeleton {
  return applyTemplate(createEmptySkeleton("char"), getTemplateById("humanoid")!);
}

const W = 100;
const H = 200;

// 站立正面姿势的像素关节坐标（y 向下）。
function standingFrame(): FramePose {
  const px: Record<string, [number, number]> = {
    nose: [50, 30],
    left_shoulder: [60, 50],
    right_shoulder: [40, 50],
    left_elbow: [65, 80],
    right_elbow: [35, 80],
    left_wrist: [68, 110],
    right_wrist: [32, 110],
    left_hip: [58, 120],
    right_hip: [42, 120],
    left_knee: [58, 170],
    right_knee: [42, 170],
    left_ankle: [58, 195],
    right_ankle: [42, 195],
  };
  return {
    width: W,
    height: H,
    keypoints: Object.entries(px).map(([name, [x, y]]) => ({ name, x: x / W, y: y / H, score: 1 })),
  };
}

// 复刻 BoneCanvasPreview 的世界角递归：父世界角 + bone.rotation + 采样到的 rotate 增量。
function sampleRotate(kfs: Keyframe[], time: number): number {
  const f = kfs.filter((k) => k.channel === "rotate").sort((a, b) => a.time - b.time);
  if (f.length === 0) return 0;
  if (time <= f[0].time) return f[0].values[0];
  if (time >= f[f.length - 1].time) return f[f.length - 1].values[0];
  for (let i = 0; i < f.length - 1; i += 1) {
    if (time >= f[i].time && time <= f[i + 1].time) {
      const span = Math.max(1e-6, f[i + 1].time - f[i].time);
      const t = (time - f[i].time) / span;
      return f[i].values[0] + (f[i + 1].values[0] - f[i].values[0]) * t;
    }
  }
  return 0;
}

function previewWorldRot(skel: Skeleton, anim: Animation, boneName: string, time: number): number {
  const bone = findBoneByName(skel, boneName)!;
  const tl = anim.bones.find((b) => b.boneId === bone.id);
  const delta = tl ? sampleRotate(tl.keyframes, time) : 0;
  const local = bone.rotation + delta;
  if (!bone.parentId) return local;
  const parent = skel.bones.find((b) => b.id === bone.parentId)!;
  return previewWorldRot(skel, anim, parent.name, time) + local;
}

describe("framesToMotion", () => {
  it("returns empty animation for empty frames", () => {
    const res = framesToMotion(humanoid(), []);
    expect(res.animation.bones).toHaveLength(0);
    expect(res.warnings.length).toBeGreaterThan(0);
  });

  it("derives rotate timelines for the standing pose", () => {
    const skel = humanoid();
    const frames = [standingFrame(), standingFrame()];
    const res = framesToMotion(skel, frames, { fps: 24, includeRootMotion: false });
    expect(res.usedBones).toContain("torso");
    expect(res.usedBones).toContain("upperArmL");
    expect(res.usedBones).toContain("thighR");
    expect(res.animation.durationSec).toBeCloseTo(2 / 24, 5);
    // 每条用到的骨骼都应有 rotate 关键帧
    for (const tl of res.animation.bones) {
      expect(tl.keyframes.some((k) => k.channel === "rotate")).toBe(true);
    }
  });

  it("preview world angle reproduces the measured joint angles", () => {
    const skel = humanoid();
    const frames = [standingFrame(), standingFrame()];
    const res = framesToMotion(skel, frames, { fps: 24, includeRootMotion: false });
    const anim = res.animation;

    // 实测世界角（像素空间 atan2）
    const deg = (fx: number, fy: number, tx: number, ty: number) => (Math.atan2(ty - fy, tx - fx) * 180) / Math.PI;
    const expectTorso = deg(50, 120, 50, 50); // -90
    const expectUpperArmL = deg(60, 50, 65, 80);
    const expectForearmL = deg(65, 80, 68, 110);
    const expectThighR = deg(42, 120, 42, 170); // 90

    expect(previewWorldRot(skel, anim, "torso", 0)).toBeCloseTo(expectTorso, 1);
    expect(previewWorldRot(skel, anim, "upperArmL", 0)).toBeCloseTo(expectUpperArmL, 1);
    expect(previewWorldRot(skel, anim, "forearmL", 0)).toBeCloseTo(expectForearmL, 1);
    expect(previewWorldRot(skel, anim, "thighR", 0)).toBeCloseTo(expectThighR, 1);
  });

  it("skips bones whose joints are below confidence", () => {
    const skel = humanoid();
    const f = standingFrame();
    // 抹掉左臂关节可信度
    f.keypoints = f.keypoints.map((k) =>
      k.name === "left_elbow" || k.name === "left_wrist" ? { ...k, score: 0 } : k,
    );
    const res = framesToMotion(skel, [f, f], { fps: 24, includeRootMotion: false });
    expect(res.skippedBones).toContain("forearmL");
    expect(res.usedBones).toContain("upperArmR");
  });

  it("generates root translate when the hip moves", () => {
    const skel = humanoid();
    const f0 = standingFrame();
    const f1 = standingFrame();
    // 第二帧整体右移 10px
    f1.keypoints = f1.keypoints.map((k) => ({ ...k, x: k.x + 10 / W }));
    const res = framesToMotion(skel, [f0, f1], { fps: 24, includeRootMotion: true });
    const root = findBoneByName(skel, "root")!;
    const rootTl = res.animation.bones.find((b) => b.boneId === root.id);
    expect(rootTl).toBeTruthy();
    const translates = rootTl!.keyframes.filter((k) => k.channel === "translate");
    expect(translates.length).toBeGreaterThan(1);
    // 末帧位移应为正 x（向右），且非零
    const last = translates[translates.length - 1];
    expect(last.values[0]).toBeGreaterThan(0);
  });

  it("mirror swaps left/right arm derivation", () => {
    const skel = humanoid();
    const f = standingFrame();
    const normal = framesToMotion(skel, [f, f], { fps: 24, includeRootMotion: false, mirror: false });
    const mirrored = framesToMotion(skel, [f, f], { fps: 24, includeRootMotion: false, mirror: true });
    const armL = (r: typeof normal) => {
      const bone = findBoneByName(skel, "upperArmL")!;
      const tl = r.animation.bones.find((b) => b.boneId === bone.id)!;
      return tl.keyframes.find((k) => k.channel === "rotate")!.values[0];
    };
    // 站姿左右对称，镜像后左臂增量应取自右臂数据（数值通常不同）
    expect(armL(normal)).not.toBeCloseTo(armL(mirrored), 2);
  });
});
