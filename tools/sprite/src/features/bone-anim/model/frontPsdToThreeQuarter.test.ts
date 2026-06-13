import { describe, expect, it } from "vitest";
import { convertFrontPsdToThreeQuarter } from "./frontPsdToThreeQuarter";
import { Skeleton } from "./skeletonModel";

function makeSkeleton(): Skeleton {
  return {
    id: "skl",
    name: "test",
    fps: 24,
    bones: [
      { id: "root", name: "root", parentId: null, x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, length: 0 },
      { id: "torso", name: "torso", parentId: "root", x: 0, y: 0, rotation: -90, scaleX: 1, scaleY: 1, length: 120 },
      { id: "head", name: "head", parentId: "torso", x: 100, y: 0, rotation: 0, scaleX: 1, scaleY: 1, length: 60 },
      { id: "upperArmL", name: "upperArmL", parentId: "torso", x: 80, y: 30, rotation: 100, scaleX: 1, scaleY: 1, length: 70 },
      { id: "upperArmR", name: "upperArmR", parentId: "torso", x: 80, y: -30, rotation: -100, scaleX: 1, scaleY: 1, length: 70 },
      { id: "thighL", name: "thighL", parentId: "root", x: 0, y: -20, rotation: 95, scaleX: 1, scaleY: 1, length: 90 },
      { id: "thighR", name: "thighR", parentId: "root", x: 0, y: 20, rotation: 85, scaleX: 1, scaleY: 1, length: 90 },
    ],
    slots: [
      { id: "sHead", name: "head", boneId: "head", attachmentId: "aHead", zOrder: 80 },
      { id: "sEyeL", name: "eyeL", boneId: "head", attachmentId: "aEyeL", zOrder: 84 },
      { id: "sMouth", name: "mouth", boneId: "head", attachmentId: "aMouth", zOrder: 86 },
      { id: "sArmL", name: "upperArmL", boneId: "upperArmL", attachmentId: "aArmL", zOrder: 40.125 },
      { id: "sArmR", name: "upperArmR", boneId: "upperArmR", attachmentId: "aArmR", zOrder: 60.25 },
    ],
    attachments: [
      { id: "aHead", name: "head", pngDataUrl: "data:image/png;base64,HEAD", width: 64, height: 64, pivot: { x: 0.5, y: 0.8 }, sourceRect: { x: 10, y: 10, canvasWidth: 256, canvasHeight: 256 } },
      { id: "aEyeL", name: "eyeL", pngDataUrl: "data:image/png;base64,EYEL", width: 8, height: 4, pivot: { x: 0.5, y: 0.5 }, sourceRect: { x: 20, y: 20, canvasWidth: 256, canvasHeight: 256 } },
      { id: "aMouth", name: "mouth", pngDataUrl: "data:image/png;base64,MOUTH", width: 16, height: 8, pivot: { x: 0.5, y: 0.5 }, sourceRect: { x: 18, y: 30, canvasWidth: 256, canvasHeight: 256 } },
      { id: "aArmL", name: "upperArmL", pngDataUrl: "data:image/png;base64,ARML", width: 20, height: 70, pivot: { x: 0.5, y: 0.1 }, sourceRect: { x: 5, y: 80, canvasWidth: 256, canvasHeight: 256 } },
      { id: "aArmR", name: "upperArmR", pngDataUrl: "data:image/png;base64,ARMR", width: 20, height: 70, pivot: { x: 0.5, y: 0.1 }, sourceRect: { x: 80, y: 80, canvasWidth: 256, canvasHeight: 256 } },
    ],
    animations: [],
  };
}

describe("convertFrontPsdToThreeQuarter", () => {
  it("uses L as near side by default and mirrors to R for left direction", () => {
    const right = convertFrontPsdToThreeQuarter(makeSkeleton());
    const left = convertFrontPsdToThreeQuarter(makeSkeleton(), { direction: "left" });

    expect(right.report.nearSide).toBe("L");
    expect(right.report.farSide).toBe("R");
    expect(left.report.nearSide).toBe("R");
    expect(left.report.farSide).toBe("L");

    const rightArmL = right.skeleton.bones.find((bone) => bone.name === "upperArmL")!;
    const rightArmR = right.skeleton.bones.find((bone) => bone.name === "upperArmR")!;
    const leftArmL = left.skeleton.bones.find((bone) => bone.name === "upperArmL")!;
    const leftArmR = left.skeleton.bones.find((bone) => bone.name === "upperArmR")!;
    expect(rightArmL.scaleX).toBeGreaterThan(rightArmR.scaleX);
    expect(leftArmR.scaleX).toBeGreaterThan(leftArmL.scaleX);
  });

  it("does not mutate input or image payloads", () => {
    const input = makeSkeleton();
    const before = JSON.stringify(input);
    const result = convertFrontPsdToThreeQuarter(input);

    expect(JSON.stringify(input)).toBe(before);
    expect(result.skeleton).not.toBe(input);
    expect(result.skeleton.attachments.map((attachment) => attachment.pngDataUrl)).toEqual(input.attachments.map((attachment) => attachment.pngDataUrl));
  });

  it("changes face, mouth and limb slot setup offsets", () => {
    const result = convertFrontPsdToThreeQuarter(makeSkeleton());
    const eye = result.skeleton.slots.find((slot) => slot.name === "eyeL")!;
    const mouth = result.skeleton.slots.find((slot) => slot.name === "mouth")!;
    const arm = result.skeleton.slots.find((slot) => slot.name === "upperArmL")!;

    expect(eye.setupOffset?.x).not.toBe(0);
    expect(mouth.setupOffset?.x).not.toBe(0);
    expect(arm.setupOffset?.x).not.toBe(0);
    expect(result.report.changedSlots).toEqual(expect.arrayContaining(["eyeL", "mouth", "upperArmL"]));
  });

  it("puts far limb slots behind near limb slots", () => {
    const result = convertFrontPsdToThreeQuarter(makeSkeleton());
    const near = result.skeleton.slots.find((slot) => slot.name === "upperArmL")!;
    const far = result.skeleton.slots.find((slot) => slot.name === "upperArmR")!;

    expect(near.zOrder).toBeGreaterThan(far.zOrder);
  });

  it("no-ops with report notes when PSD source or bound slots are missing", () => {
    const noPsd = makeSkeleton();
    noPsd.attachments = noPsd.attachments.map((attachment) => ({ ...attachment, sourceRect: undefined }));
    const noPsdResult = convertFrontPsdToThreeQuarter(noPsd);
    expect(noPsdResult.skeleton).toBe(noPsd);
    expect(noPsdResult.report.notes.join(" ")).toContain("sourceRect");

    const unbound = makeSkeleton();
    unbound.slots = unbound.slots.map((slot) => ({ ...slot, attachmentId: null }));
    const unboundResult = convertFrontPsdToThreeQuarter(unbound);
    expect(unboundResult.skeleton).toBe(unbound);
    expect(unboundResult.report.notes.join(" ")).toContain("尚未绑定");
  });
});
