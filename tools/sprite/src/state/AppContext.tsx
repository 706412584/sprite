/**
 * AppContext — Zustand 兼容包装层
 *
 * 现在所有 state/actions 都存在 store.ts（Zustand）里。
 * 这里只保留：
 *   - 类型导出（AppState / AppActions）供面板使用
 *   - useAppState / useAppActions —— 仍然可用，内部从 Zustand 读取
 *   - AppProvider —— 负责 bootstrap 初始化 + 浏览器文件选择器 ref 注册
 *   - 各种常量（atomicKeyingModes / keyingModes / updateNumber）
 *
 * 面板代码不需要改动。新代码可以直接使用 useStore 精确选取片段以减少重渲染。
 */

import { useEffect, useRef, type ReactNode } from "react";
import { getDesktopApi } from "@/api/desktopApi";
import type { AtomicKeyingMode, KeyingMode } from "@/types/sprite";
import { useStore, registerBrowserFileInputTrigger, type StoreState, type StoreActions } from "@/state/store";

// ---------------------------------------------------------------------------
// Constant exports (unchanged)
// ---------------------------------------------------------------------------
export const atomicKeyingModes: Array<{ value: AtomicKeyingMode; label: string; description: string }> = [
  { value: "chroma", label: "绿幕 / 纯色", description: "适合可控纯色背景，速度最快。" },
  { value: "spriteflow", label: "SpriteFlow 色键", description: "SpriteFlow 边缘渐变色键，含混合区与去溢色。" },
  { value: "birefnet", label: "BiRefNet", description: "AI 主体抠图，适合复杂背景。" },
  { value: "corridorkey", label: "CorridorKey", description: "重建绿/蓝幕边缘，适合走廊式背景。" },
  { value: "luma", label: "Luma", description: "按亮度保留火焰、闪电、粒子等特效。" },
];

export const keyingModes: Array<{ value: KeyingMode; label: string; description: string }> = [
  { value: "chroma", label: "绿幕 / 纯色", description: "适合可控纯色背景，速度最快。" },
  { value: "spriteflow", label: "SpriteFlow 色键", description: "SpriteFlow 边缘渐变色键，含混合区与去溢色。" },
  { value: "birefnet", label: "BiRefNet", description: "AI 主体抠图，适合复杂背景。" },
  { value: "corridorkey", label: "CorridorKey", description: "重建绿/蓝幕边缘，适合走廊式背景。" },
  { value: "luma", label: "Luma", description: "按亮度保留火焰、闪电、粒子等特效。" },
  { value: "birefnet_corridorkey", label: "BiRefNet + CorridorKey", description: "AI 主体加边缘颜色重建。" },
  { value: "birefnet_luma", label: "BiRefNet + Luma", description: "主体与亮部特效一起保留。" },
  { value: "birefnet_luma_corridorkey", label: "三管齐下", description: "主体、亮部、边缘颜色重建组合模式。" },
  { value: "none", label: "不抠图", description: "素材已有透明通道时使用。" },
];

export function updateNumber(value: string, fallback: number) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

// ---------------------------------------------------------------------------
// Type aliases (re-exported for backwards compat)
// ---------------------------------------------------------------------------
export type AppState = StoreState;
export type AppActions = StoreActions;

// ---------------------------------------------------------------------------
// Hooks — still work as before, now delegate to Zustand
// ---------------------------------------------------------------------------

/** 读取全量 state（与原来相同，但 Zustand 可以让子组件用精确 selector 避免无关重渲染）。 */
export function useAppState(): AppState {
  return useStore();
}

/** 读取全量 actions 对象（引用稳定，Zustand 保证 actions 不随 state 更新而重建）。 */
export function useAppActions(): AppActions {
  return useStore();
}

// ---------------------------------------------------------------------------
// AppProvider — bootstrap only
// ---------------------------------------------------------------------------
export function AppProvider({ children }: { children: ReactNode }) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const bootstrap = useStore((s) => s.bootstrap);
  const chooseBrowserFile = useStore((s) => s.chooseBrowserFile);

  // 注册浏览器端文件选择器 click 触发器（仅在非 Electron 环境生效）
  useEffect(() => {
    registerBrowserFileInputTrigger(() => fileInputRef.current?.click());
  }, []);

  // 初始化：拉取版本、model 状态、runtime 状态、日志列表
  useEffect(() => {
    bootstrap();
  // bootstrap 是稳定引用，只跑一次
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,image/*,.mp4,.mov,.mkv,.webm,.png,.jpg,.jpeg,.webp,.bmp"
        style={{ display: "none" }}
        onChange={(e) => chooseBrowserFile(e.target.files?.[0] || null)}
      />
      {children}
    </>
  );
}
