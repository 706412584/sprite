import { describe, expect, it } from "vitest";
import {
  Animation,
  AttachmentPoint,
  BoneNode,
  Skeleton,
} from "../model/skeletonModel";
import {
  computeAnimatedWorld,
  resolveAttachmentPointWorld,
  sampleChannel,
} from "../model/animationSampler";
import { buildSkeletonPointsJson, pointsJsonFileName } from "./pointsJsonExporter";

function bone(o: Partial<BoneNode> & { id: string; name: string }): BoneNode {
  return { parentId: null, x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, length: 40, ...o };
}

// root @ (100,100); boneA child @ local (50,0) -> world (150,100)
function rigged(points: AttachmentPoint[], animations: Animation[] = []): Skeleton {
  return {
    id: "skl",
    name: "rig",
    fps: 24,
    bones: [
      bone({ id: "root", name: "root", x: 100, y: 100, length: 0 }),
      bone({ id: "a", name: "boneA", parentId: "root", x: 50, y: 0, length: 50 }),
    ],
    slots: [],
    attachments: [],
    animations,
    points,
  };
}

const muzzle: AttachmentPoint = { id: "p1", name: "muzzle", boneId: "a", x: 10, y: 0, rotation: 0 };

function rotateAnim(): Animation {
  return {
    id: "anim1",
    name: "spin",
    durationSec: 1,
    loop: false,
    bones: [
      {
        boneId: "a",
        keyframes: [
          { time: 0, channel: "rotate", values: [0], easing: "linear" },
          { time: 1, channel: "rotate", values: [90], easing: "linear" },
        ],
      },
    ],
  };
}

describe("sampleChannel", () => {
  it("interpolates linearly between keyframes", () => {
    const kfs = [
      { time: 0, channel: "rotate" as const, values: [0], easing: "linear" as const },
      { time: 1, channel: "rotate" as const, values: [90], easing: "linear" as const },
    ];
    expect(sampleChannel(kfs, "rotate", 0.5, [0])[0]).toBeCloseTo(45, 5);
  });
  it("returns defaults when no keyframes", () => {
    expect(sampleChannel([], "translate", 0.3, [7, 8])).toEqual([7, 8]);
  });
});

describe("computeAnimatedWorld + attachment point resolve", () => {
  it("resolves point world at setup", () => {
    const skel = rigged([muzzle]);
    const world = computeAnimatedWorld(skel, null, 0);
    const a = world.get("a")!;
    expect(a.x).toBeCloseTo(150, 5);
    expect(a.y).toBeCloseTo(100, 5);
    const pw = resolveAttachmentPointWorld(world, muzzle)!;
    expect(pw.x).toBeCloseTo(160, 5);
    expect(pw.y).toBeCloseTo(100, 5);
    expect(pw.rotationDeg).toBeCloseTo(0, 5);
  });

  it("rotating the bone swings the point (y-down CW)", () => {
    const skel = rigged([muzzle], [rotateAnim()]);
    const world = computeAnimatedWorld(skel, skel.animations[0], 1);
    const pw = resolveAttachmentPointWorld(world, muzzle)!;
    // local (10,0) rotated +90deg (y down) -> (0,10) added to boneA world (150,100)
    expect(pw.x).toBeCloseTo(150, 4);
    expect(pw.y).toBeCloseTo(110, 4);
    expect(pw.rotationDeg).toBeCloseTo(90, 4);
  });
});

describe("buildSkeletonPointsJson", () => {
  it("emits bones, points and per-frame trajectory", () => {
    const skel = rigged([muzzle], [rotateAnim()]);
    const json = buildSkeletonPointsJson(skel, { fps: 4 });
    expect(json.version).toBe(1);
    expect(json.bones.map((b) => b.name)).toEqual(["root", "boneA"]);
    expect(json.bones.find((b) => b.name === "boneA")!.setupWorld.x).toBeCloseTo(150, 3);
    expect(json.points).toHaveLength(1);
    expect(json.points[0]).toMatchObject({ name: "muzzle", bone: "boneA", offset: { x: 10, y: 0 } });

    const anim = json.animations[0];
    expect(anim.name).toBe("spin");
    expect(anim.frameCount).toBe(5); // round(1*4)+1
    expect(anim.frames).toHaveLength(5);

    const f0 = anim.frames[0].points.muzzle;
    expect(f0.x).toBeCloseTo(160, 2);
    expect(f0.y).toBeCloseTo(100, 2);
    expect(f0.vx).toBe(0);

    const last = anim.frames[anim.frames.length - 1].points.muzzle;
    expect(last.x).toBeCloseTo(150, 2);
    expect(last.y).toBeCloseTo(110, 2);
    expect(last.rotation).toBeCloseTo(90, 2);
  });

  it("can filter by animation name and omit velocity", () => {
    const skel = rigged([muzzle], [rotateAnim()]);
    const json = buildSkeletonPointsJson(skel, { fps: 2, includeVelocity: false, animationNames: ["nope"] });
    expect(json.animations).toHaveLength(0);
    const json2 = buildSkeletonPointsJson(skel, { fps: 2, includeVelocity: false });
    expect(json2.animations[0].frames[1].points.muzzle.vx).toBeUndefined();
  });

  it("filename is safe", () => {
    const skel = rigged([muzzle]);
    expect(pointsJsonFileName(skel)).toBe("rig.points.json");
  });
});
