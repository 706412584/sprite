// 骨骼动画局部状态：当前编辑的 Skeleton + 选中状态
// 不放进 AppContext，避免污染主 state；其他 tab 不需要这些。

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Skeleton, createEmptySkeleton } from "./model/skeletonModel";
import { CharacterPose, PoseDetectionResult } from "./model/poseDetector";

export type CharacterPoseMode = "front" | "pseudoSide" | "sidePending";
export type AssetMode = "singleImage" | "psd" | "sliced" | null;

interface BoneAnimState {
  skeleton: Skeleton;
  selectedSlotId: string | null;
  selectedBoneId: string | null;
  selectedAnimationId: string | null;
  assetMode: AssetMode;
  poseMode: CharacterPoseMode;
  /** 精细姿态：front | back | sideLeft | sideRight | threeQuarter；未识别时为 null。 */
  detectedPose: CharacterPose | null;
  /** 用户在 UI 手动覆盖的姿态；非 null 时优先使用，覆盖 detectedPose。 */
  poseOverride: CharacterPose | null;
  /** 最近一次姿态识别的完整结果，UI 用来展示信号细节。 */
  poseDetection: PoseDetectionResult | null;
}

interface BoneAnimActions {
  setSkeleton: (next: Skeleton | ((prev: Skeleton) => Skeleton)) => void;
  setSelectedSlotId: (id: string | null) => void;
  setSelectedBoneId: (id: string | null) => void;
  setSelectedAnimationId: (id: string | null) => void;
  setAssetMode: (mode: AssetMode) => void;
  setPoseMode: (mode: CharacterPoseMode) => void;
  setPoseDetection: (result: PoseDetectionResult | null) => void;
  setPoseOverride: (pose: CharacterPose | null) => void;
  /** 当前生效姿态：override 优先，其次 detection；都为空回退到 front。 */
  effectivePose: () => CharacterPose;
  resetAll: () => void;
}

type Ctx = BoneAnimState & BoneAnimActions;

declare global {
  interface Window {
    __spriteBoneAnimDebug?: {
      getSkeletonSnapshot: () => {
        poseMode: CharacterPoseMode;
        poseOverride: CharacterPose | null;
        bones: Array<Pick<Skeleton["bones"][number], "name" | "x" | "y" | "rotation" | "scaleX" | "scaleY" | "length">>;
        slots: Array<Pick<Skeleton["slots"][number], "name" | "zOrder" | "setupOffset" | "attachmentId">>;
      };
    };
  }
}

const BoneAnimContextObj = createContext<Ctx | null>(null);

export function BoneAnimProvider({ children }: { children: ReactNode }) {
  const [skeleton, setSkeletonRaw] = useState<Skeleton>(() => createEmptySkeleton("character"));
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [selectedBoneId, setSelectedBoneId] = useState<string | null>(null);
  const [selectedAnimationId, setSelectedAnimationId] = useState<string | null>(null);
  const [assetMode, setAssetMode] = useState<AssetMode>(null);
  const [poseMode, setPoseMode] = useState<CharacterPoseMode>("front");
  const [poseDetection, setPoseDetectionRaw] = useState<PoseDetectionResult | null>(null);
  const [poseOverride, setPoseOverrideRaw] = useState<CharacterPose | null>(null);

  const setSkeleton = useCallback<BoneAnimActions["setSkeleton"]>((next) => {
    setSkeletonRaw((prev) => (typeof next === "function" ? (next as (p: Skeleton) => Skeleton)(prev) : next));
  }, []);

  const setPoseDetection = useCallback((result: PoseDetectionResult | null) => {
    setPoseDetectionRaw(result);
    if (result) {
      setPoseMode(result.pose === "sideLeft" || result.pose === "sideRight" ? "sidePending" : result.pose === "threeQuarter" ? "pseudoSide" : "front");
    }
  }, []);

  const setPoseOverride = useCallback((pose: CharacterPose | null) => {
    setPoseOverrideRaw(pose);
    if (pose) {
      setPoseMode(pose === "sideLeft" || pose === "sideRight" ? "sidePending" : pose === "threeQuarter" ? "pseudoSide" : "front");
    }
  }, []);

  const effectivePoseFn = useCallback((): CharacterPose => {
    if (poseOverride) return poseOverride;
    return poseDetection?.pose ?? "front";
  }, [poseOverride, poseDetection]);

  const resetAll = useCallback(() => {
    setSkeletonRaw(createEmptySkeleton("character"));
    setSelectedSlotId(null);
    setSelectedBoneId(null);
    setSelectedAnimationId(null);
    setAssetMode(null);
    setPoseMode("front");
    setPoseDetectionRaw(null);
    setPoseOverrideRaw(null);
  }, []);

  useEffect(() => {
    if (!(import.meta as { env?: { DEV?: boolean } }).env?.DEV) return;
    const previousDebug = window.__spriteBoneAnimDebug;
    window.__spriteBoneAnimDebug = {
      getSkeletonSnapshot: () => ({
        poseMode,
        poseOverride,
        bones: skeleton.bones.map((bone) => ({
          name: bone.name,
          x: bone.x,
          y: bone.y,
          rotation: bone.rotation,
          scaleX: bone.scaleX,
          scaleY: bone.scaleY,
          length: bone.length,
        })),
        slots: skeleton.slots.map((slot) => ({
          name: slot.name,
          zOrder: slot.zOrder,
          setupOffset: slot.setupOffset ? { ...slot.setupOffset } : undefined,
          attachmentId: slot.attachmentId,
        })),
      }),
    };
    return () => {
      if (previousDebug) {
        window.__spriteBoneAnimDebug = previousDebug;
      } else {
        delete window.__spriteBoneAnimDebug;
      }
    };
  }, [skeleton, poseMode, poseOverride]);

  const value = useMemo<Ctx>(
    () => ({
      skeleton,
      selectedSlotId,
      selectedBoneId,
      selectedAnimationId,
      assetMode,
      poseMode,
      detectedPose: poseDetection?.pose ?? null,
      poseOverride,
      poseDetection,
      setSkeleton,
      setSelectedSlotId,
      setSelectedBoneId,
      setSelectedAnimationId,
      setAssetMode,
      setPoseMode,
      setPoseDetection,
      setPoseOverride,
      effectivePose: effectivePoseFn,
      resetAll,
    }),
    [skeleton, selectedSlotId, selectedBoneId, selectedAnimationId, assetMode, poseMode, poseDetection, poseOverride, setSkeleton, setPoseDetection, setPoseOverride, effectivePoseFn, resetAll],
  );

  return <BoneAnimContextObj.Provider value={value}>{children}</BoneAnimContextObj.Provider>;
}

export function useBoneAnim(): Ctx {
  const ctx = useContext(BoneAnimContextObj);
  if (!ctx) throw new Error("useBoneAnim must be used inside BoneAnimProvider");
  return ctx;
}
