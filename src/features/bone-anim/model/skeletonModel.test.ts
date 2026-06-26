import { describe, expect, it } from "vitest";
import {
  computeBoneWorld,
  worldPointToParentLocal,
  addBone,
  removeBone,
  reparentBone,
  BoneNode,
  Skeleton,
} from "./skeletonModel";

function makeBone(overrides: Partial<BoneNode> & { id: string; name: string }): BoneNode {
  return { parentId: null, x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, length: 40, ...overrides };
}

function makeSkeleton(bones: BoneNode[]): Skeleton {
  return {
    id: "skl",
    name: "test",
    fps: 24,
    bones,
    slots: [],
    attachments: [],
    animations: [],
  };
}

// ---- computeBoneWorld ----

describe("computeBoneWorld", () => {
  it("single bone at origin", () => {
    const bones = [makeBone({ id: "root", name: "root" })];
    const world = computeBoneWorld(bones);
    const r = world.get("root")!;
    expect(r.x).toBe(0);
    expect(r.y).toBe(0);
    expect(r.rot).toBe(0);
  });

  it("parent-child chain without rotation", () => {
    const bones = [
      makeBone({ id: "root", name: "root" }),
      makeBone({ id: "child", name: "child", parentId: "root", x: 10, y: 0 }),
    ];
    const world = computeBoneWorld(bones);
    expect(world.get("child")!.x).toBe(10);
    expect(world.get("child")!.y).toBe(0);
  });

  it("rotation propagation", () => {
    const bones = [
      makeBone({ id: "root", name: "root", rotation: 90 }),
      makeBone({ id: "child", name: "child", parentId: "root", x: 10, y: 0 }),
    ];
    const world = computeBoneWorld(bones);
    // root rotated 90° → child local (10,0) → world (0,10)
    expect(world.get("child")!.x).toBeCloseTo(0);
    expect(world.get("child")!.y).toBe(10);
    expect(world.get("child")!.rot).toBe(90);
  });

  it("three-level chain", () => {
    const bones = [
      makeBone({ id: "root", name: "root" }),
      makeBone({ id: "mid", name: "mid", parentId: "root", x: 20, y: 0, rotation: 90 }),
      makeBone({ id: "tip", name: "tip", parentId: "mid", x: 10, y: 0 }),
    ];
    const world = computeBoneWorld(bones);
    // mid: world (20, 0), rot 90
    // tip: local (10,0) rotated by mid's 90° → world (20+0, 0+10) = (20, 10)
    expect(world.get("mid")!.x).toBe(20);
    expect(world.get("mid")!.y).toBe(0);
    expect(world.get("tip")!.x).toBe(20);
    expect(world.get("tip")!.y).toBe(10);
  });
});

// ---- worldPointToParentLocal ----

describe("worldPointToParentLocal", () => {
  it("identity transform", () => {
    const local = worldPointToParentLocal({ x: 10, y: 5 });
    expect(local.x).toBe(10);
    expect(local.y).toBe(5);
  });

  it("with parent at origin no rotation", () => {
    const local = worldPointToParentLocal({ x: 10, y: 5 }, { x: 0, y: 0, rot: 0 });
    expect(local.x).toBe(10);
    expect(local.y).toBe(5);
  });

  it("with parent offset", () => {
    const local = worldPointToParentLocal({ x: 20, y: 5 }, { x: 10, y: 0, rot: 0 });
    expect(local.x).toBe(10);
    expect(local.y).toBe(5);
  });

  it("with parent rotation 90", () => {
    // parent at (0,0) rot=90, world point (10,0)
    // local = inverse旋转: rotate -90 → (0,10)
    const local = worldPointToParentLocal({ x: 10, y: 0 }, { x: 0, y: 0, rot: 90 });
    expect(local.x).toBe(0);
    expect(local.y).toBe(-10);
  });
});

// ---- addBone ----

describe("addBone", () => {
  it("adds root bone to empty skeleton", () => {
    const skel = makeSkeleton([]);
    const next = addBone(skel, { parentId: null, name: "root" });
    expect(next.bones).toHaveLength(1);
    expect(next.bones[0].name).toBe("root");
    expect(next.bones[0].parentId).toBeNull();
  });

  it("appends child to root", () => {
    const skel = makeSkeleton([makeBone({ id: "root", name: "root" })]);
    const next = addBone(skel, { parentId: "root", name: "child" });
    expect(next.bones).toHaveLength(2);
    expect(next.bones[1].parentId).toBe("root");
  });

  it("inserts after parent's last descendant (topological order)", () => {
    const bones = [
      makeBone({ id: "root", name: "root" }),
      makeBone({ id: "child1", name: "child1", parentId: "root" }),
      makeBone({ id: "grandchild", name: "grandchild", parentId: "child1" }),
    ];
    const skel = makeSkeleton(bones);
    // Adding another child of root should go after grandchild
    const next = addBone(skel, { parentId: "root", name: "child2" });
    const rootIdx = next.bones.findIndex((b) => b.id === "root");
    const child2Idx = next.bones.findIndex((b) => b.name === "child2");
    const grandchildIdx = next.bones.findIndex((b) => b.id === "grandchild");
    expect(child2Idx).toBeGreaterThan(grandchildIdx);
    expect(child2Idx).toBeGreaterThan(rootIdx);
  });

  it("throws on invalid parentId", () => {
    const skel = makeSkeleton([makeBone({ id: "root", name: "root" })]);
    expect(() => addBone(skel, { parentId: "nonexistent", name: "x" })).toThrow();
  });
});

// ---- removeBone ----

describe("removeBone", () => {
  it("removes bone and descendants", () => {
    const bones = [
      makeBone({ id: "root", name: "root" }),
      makeBone({ id: "child", name: "child", parentId: "root" }),
      makeBone({ id: "grand", name: "grand", parentId: "child" }),
      makeBone({ id: "other", name: "other", parentId: "root" }),
    ];
    const skel = makeSkeleton(bones);
    const next = removeBone(skel, "child");
    expect(next.bones.map((b) => b.id)).toEqual(["root", "other"]);
  });

  it("cleans up BoneTimeline in animations", () => {
    const bones = [
      makeBone({ id: "root", name: "root" }),
      makeBone({ id: "child", name: "child", parentId: "root" }),
    ];
    const skel = makeSkeleton(bones);
    skel.animations = [
      {
        id: "a1",
        name: "walk",
        durationSec: 1,
        loop: true,
        bones: [
          { boneId: "child", keyframes: [] },
          { boneId: "root", keyframes: [] },
        ],
      },
    ];
    const next = removeBone(skel, "child");
    expect(next.animations[0].bones).toHaveLength(1);
    expect(next.animations[0].bones[0].boneId).toBe("root");
  });

  it("unbinds slots from deleted bones", () => {
    const bones = [
      makeBone({ id: "root", name: "root" }),
      makeBone({ id: "child", name: "child", parentId: "root" }),
    ];
    const skel = makeSkeleton(bones);
    skel.slots = [{ id: "s1", name: "slot1", boneId: "child", attachmentId: "a1", zOrder: 0 }];
    const next = removeBone(skel, "child");
    expect(next.slots[0].attachmentId).toBeNull();
  });
});

// ---- reparentBone ----

describe("reparentBone", () => {
  it("reparents and preserves world coordinates", () => {
    const bones = [
      makeBone({ id: "root", name: "root" }),
      makeBone({ id: "a", name: "a", parentId: "root", x: 10, y: 0 }),
      makeBone({ id: "b", name: "b", parentId: "root", x: 0, y: 20 }),
    ];
    const skel = makeSkeleton(bones);
    const worldBefore = computeBoneWorld(skel.bones);
    const bWorldBefore = worldBefore.get("b")!;

    const next = reparentBone(skel, "b", "a");
    const worldAfter = computeBoneWorld(next.bones);
    const bWorldAfter = worldAfter.get("b")!;

    // World position should be approximately preserved
    expect(Math.abs(bWorldAfter.x - bWorldBefore.x)).toBeLessThan(2);
    expect(Math.abs(bWorldAfter.y - bWorldBefore.y)).toBeLessThan(2);
  });

  it("throws on circular reparent", () => {
    const bones = [
      makeBone({ id: "root", name: "root" }),
      makeBone({ id: "a", name: "a", parentId: "root" }),
      makeBone({ id: "b", name: "b", parentId: "a" }),
    ];
    const skel = makeSkeleton(bones);
    expect(() => reparentBone(skel, "a", "b")).toThrow();
  });

  it("maintains topological order", () => {
    const bones = [
      makeBone({ id: "root", name: "root" }),
      makeBone({ id: "a", name: "a", parentId: "root" }),
      makeBone({ id: "b", name: "b", parentId: "root" }),
    ];
    const skel = makeSkeleton(bones);
    const next = reparentBone(skel, "b", "a");
    // b should come after a in the array
    const aIdx = next.bones.findIndex((b) => b.id === "a");
    const bIdx = next.bones.findIndex((b) => b.id === "b");
    expect(bIdx).toBeGreaterThan(aIdx);
  });
});
