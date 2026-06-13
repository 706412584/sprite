import { describe, expect, it } from "vitest";
import { exportDragonBones } from "./dragonBonesExporter";
import { exportSpineJson } from "./spineJsonExporter";
import { PackedAtlas } from "./atlasPacker";
import { Skeleton } from "../model/skeletonModel";

function makeAtlas(): PackedAtlas {
  return {
    width: 64,
    height: 64,
    pngDataUrl: "data:image/png;base64,TEST",
    pngBlob: new Blob(),
    subtextures: [{ attachmentId: "att", name: "head", x: 0, y: 0, width: 20, height: 10 }],
  };
}

function makeSkeleton(): Skeleton {
  return {
    id: "skl",
    name: "test",
    fps: 24,
    bones: [{ id: "root", name: "root", parentId: null, x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, length: 0 }],
    slots: [{ id: "slot", name: "headSlot", boneId: "root", attachmentId: "att", zOrder: 0, setupOffset: { x: 12, y: -5, rotation: 18 } }],
    attachments: [{ id: "att", name: "head", pngDataUrl: "data:image/png;base64,TEST", width: 20, height: 10, pivot: { x: 0.25, y: 0.75 } }],
    animations: [],
  };
}

describe("bone animation exporters", () => {
  it("folds slot setupOffset into Spine region attachments", () => {
    const result = exportSpineJson(makeSkeleton(), makeAtlas());
    const region = result.skeleton.skins[0].attachments.headSlot.head;

    expect(region.x).toBe(17);
    expect(region.y).toBe(7.5);
    expect(region.rotation).toBe(18);
  });

  it("uses the standard Spine JSON suite png name in atlas text", () => {
    const result = exportSpineJson(makeSkeleton(), makeAtlas());

    expect(result.fileBaseName).toBe("test");
    expect(result.atlasText).toContain("\ntest.png\n");
    expect(result.atlasText).not.toContain("test_tex.png");
  });

  it("uses a sanitized supplied Spine fileBaseName consistently", () => {
    const skeleton = { ...makeSkeleton(), name: "角色/unsafe name" };
    const result = exportSpineJson(skeleton, makeAtlas(), { fileBaseName: "hero_walk" });

    expect(result.fileBaseName).toBe("hero_walk");
    expect(result.atlasText).toContain("\nhero_walk.png\n");
    expect(result.atlasText).not.toContain("unsafe");
  });

  it("sanitizes the skeleton name for Spine atlas page fallback", () => {
    const skeleton = { ...makeSkeleton(), name: "角色/unsafe name" };
    const result = exportSpineJson(skeleton, makeAtlas());

    expect(result.fileBaseName).toBe("unsafe_name");
    expect(result.atlasText).toContain("\nunsafe_name.png\n");
  });

  it("emits slot setupOffset as DragonBones display transforms", () => {
    const result = exportDragonBones(makeSkeleton(), makeAtlas());
    const display = result.ske.armature[0].skin[0].slot[0].display[0];

    expect(display.transform).toEqual({ x: 12, y: -5, skX: 18, skY: 18 });
  });
});
