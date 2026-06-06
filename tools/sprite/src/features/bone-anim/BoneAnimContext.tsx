// 骨骼动画局部状态：当前编辑的 Skeleton + 选中状态
// 不放进 AppContext，避免污染主 state；其他 tab 不需要这些。

import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { Skeleton, createEmptySkeleton } from "./model/skeletonModel";

interface BoneAnimState {
  skeleton: Skeleton;
  selectedSlotId: string | null;
  selectedBoneId: string | null;
  selectedAnimationId: string | null;
}

interface BoneAnimActions {
  setSkeleton: (next: Skeleton | ((prev: Skeleton) => Skeleton)) => void;
  setSelectedSlotId: (id: string | null) => void;
  setSelectedBoneId: (id: string | null) => void;
  setSelectedAnimationId: (id: string | null) => void;
  resetAll: () => void;
}

type Ctx = BoneAnimState & BoneAnimActions;

const BoneAnimContextObj = createContext<Ctx | null>(null);

export function BoneAnimProvider({ children }: { children: ReactNode }) {
  const [skeleton, setSkeletonRaw] = useState<Skeleton>(() => createEmptySkeleton("character"));
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [selectedBoneId, setSelectedBoneId] = useState<string | null>(null);
  const [selectedAnimationId, setSelectedAnimationId] = useState<string | null>(null);

  const setSkeleton = useCallback<BoneAnimActions["setSkeleton"]>((next) => {
    setSkeletonRaw((prev) => (typeof next === "function" ? (next as (p: Skeleton) => Skeleton)(prev) : next));
  }, []);

  const resetAll = useCallback(() => {
    setSkeletonRaw(createEmptySkeleton("character"));
    setSelectedSlotId(null);
    setSelectedBoneId(null);
    setSelectedAnimationId(null);
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      skeleton,
      selectedSlotId,
      selectedBoneId,
      selectedAnimationId,
      setSkeleton,
      setSelectedSlotId,
      setSelectedBoneId,
      setSelectedAnimationId,
      resetAll,
    }),
    [skeleton, selectedSlotId, selectedBoneId, selectedAnimationId, setSkeleton, resetAll],
  );

  return <BoneAnimContextObj.Provider value={value}>{children}</BoneAnimContextObj.Provider>;
}

export function useBoneAnim(): Ctx {
  const ctx = useContext(BoneAnimContextObj);
  if (!ctx) throw new Error("useBoneAnim must be used inside BoneAnimProvider");
  return ctx;
}
