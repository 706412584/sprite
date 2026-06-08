// Canvas 自渲染骨骼动画预览
// 把当前 skeleton + 选中 animation 在每帧采样，按父子层级合成 transform，
// 用 canvas2d 绘制贴图。先满足 v1 验证：translate / rotate / scale 通道，linear / stepped 缓动。

import { useEffect, useMemo, useRef, useState } from "react";
import { Animation, AttachmentImage, BoneNode, Keyframe, KeyframeChannel, Skeleton, Slot } from "../model/skeletonModel";
import { LIMB_LENGTH_PAD } from "../model/poseToParts";

const UPRIGHT_ATTACHMENT_NAMES = new Set(["head", "torso", "body"]);

// 与 StageRig 对齐的"按骨骼长度缩放贴图"逻辑，避免预览里贴图按原始像素绘制把人画成一坨。
// 注意：带 sourceRect 的 PSD 服饰图层不能按四肢长度压缩，需要按画布 letterbox 同比缩放（外部传入 psdScale）。
function computeAttachmentDisplaySize(att: AttachmentImage, bone: BoneNode | undefined, psdScale: number): { w: number; h: number } {
  if (att.sourceRect && psdScale > 0) {
    return { w: att.width * psdScale, h: att.height * psdScale };
  }
  const isLimb = !UPRIGHT_ATTACHMENT_NAMES.has(bone?.name ?? att.name);
  const refLen = bone?.length || 0;
  if (refLen <= 0) {
    const fallback = Math.min(att.width, 120) / Math.max(1, att.width);
    return { w: att.width * fallback, h: att.height * fallback };
  }
  const targetAxis = isLimb ? refLen * LIMB_LENGTH_PAD : refLen;
  const sourceAxis = isLimb ? att.width : att.height;
  const scale = targetAxis / Math.max(1, sourceAxis);
  return { w: att.width * scale, h: att.height * scale };
}

interface Props {
  skeleton: Skeleton;
  animationId: string | null;
  loop: boolean;
  timeScale: number;
  width?: number;
  height?: number;
}

interface BoneWorldTransform {
  x: number;
  y: number;
  rotationDeg: number;
  scaleX: number;
  scaleY: number;
}

interface LoadedImage {
  id: string;
  img: HTMLImageElement;
}

function easingFactor(easing: Keyframe["easing"], t: number): number {
  switch (easing) {
    case "stepped":
      return 0;
    case "easeIn":
      return t * t;
    case "easeOut":
      return 1 - (1 - t) * (1 - t);
    case "easeInOut":
      return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    default:
      return t;
  }
}

// 取通道在指定时间的采样值
function sampleChannel(keyframes: Keyframe[], channel: KeyframeChannel, time: number, defaults: number[]): number[] {
  const filtered = keyframes.filter((k) => k.channel === channel).sort((a, b) => a.time - b.time);
  if (filtered.length === 0) return defaults;
  if (time <= filtered[0].time) return [...filtered[0].values];
  if (time >= filtered[filtered.length - 1].time) return [...filtered[filtered.length - 1].values];
  for (let i = 0; i < filtered.length - 1; i += 1) {
    const a = filtered[i];
    const b = filtered[i + 1];
    if (time >= a.time && time <= b.time) {
      const span = Math.max(1e-6, b.time - a.time);
      const t = (time - a.time) / span;
      const f = easingFactor(a.easing, t);
      const out: number[] = [];
      for (let k = 0; k < a.values.length; k += 1) {
        const av = a.values[k];
        const bv = b.values[k] ?? av;
        out.push(av + (bv - av) * f);
      }
      return out;
    }
  }
  return defaults;
}

function applyAnimationToBone(
  bone: BoneNode,
  anim: Animation | null,
  time: number,
): BoneWorldTransform {
  // 起点是 setup pose
  const local: BoneWorldTransform = {
    x: bone.x,
    y: bone.y,
    rotationDeg: bone.rotation,
    scaleX: bone.scaleX,
    scaleY: bone.scaleY,
  };
  if (!anim) return local;
  const tl = anim.bones.find((t) => t.boneId === bone.id);
  if (!tl) return local;

  const t = sampleChannel(tl.keyframes, "translate", time, [0, 0]);
  const r = sampleChannel(tl.keyframes, "rotate", time, [0]);
  const s = sampleChannel(tl.keyframes, "scale", time, [1, 1]);

  return {
    x: local.x + (t[0] ?? 0),
    y: local.y + (t[1] ?? 0),
    rotationDeg: local.rotationDeg + (r[0] ?? 0),
    scaleX: local.scaleX * (s[0] ?? 1),
    scaleY: local.scaleY * (s[1] ?? 1),
  };
}

function composeWorld(parent: BoneWorldTransform | null, local: BoneWorldTransform): BoneWorldTransform {
  if (!parent) return { ...local };
  const rad = (parent.rotationDeg * Math.PI) / 180;
  const sx = parent.scaleX;
  const sy = parent.scaleY;
  const wx = parent.x + (local.x * Math.cos(rad) - local.y * Math.sin(rad)) * sx;
  const wy = parent.y + (local.x * Math.sin(rad) + local.y * Math.cos(rad)) * sy;
  return {
    x: wx,
    y: wy,
    rotationDeg: parent.rotationDeg + local.rotationDeg,
    scaleX: parent.scaleX * local.scaleX,
    scaleY: parent.scaleY * local.scaleY,
  };
}

export function BoneCanvasPreview({ skeleton, animationId, loop, timeScale, width = 480, height = 480 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const startRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const [, setTick] = useState(0); // 仅触发重渲染（实际绘制在 rAF 里直接画）

  const animation = useMemo(
    () => skeleton.animations.find((a) => a.id === animationId) || null,
    [skeleton, animationId],
  );

  // 预加载所有部件图
  const [images, setImages] = useState<LoadedImage[]>([]);
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      skeleton.attachments.map(
        (a) =>
          new Promise<LoadedImage>((resolve) => {
            const img = new Image();
            img.onload = () => resolve({ id: a.id, img });
            img.onerror = () => resolve({ id: a.id, img });
            img.src = a.pngDataUrl;
          }),
      ),
    ).then((list) => {
      if (!cancelled) setImages(list);
    });
    return () => {
      cancelled = true;
    };
  }, [skeleton.attachments]);

  // 渲染循环
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    startRef.current = performance.now();
    const cx = width / 2;
    // 同 StageRig：root 下移 55px 让头不出 viewBox 顶部
    const cy = height / 2 + 55;

    const loopTick = (now: number) => {
      const elapsed = ((now - startRef.current) / 1000) * Math.max(0.05, timeScale);
      let time = elapsed;
      if (animation) {
        if (loop && animation.loop) {
          time = elapsed % Math.max(0.001, animation.durationSec);
        } else {
          time = Math.min(elapsed, animation.durationSec);
        }
      }

      // 计算各 bone 的世界 transform
      const worldByBone = new Map<string, BoneWorldTransform>();
      // 拓扑序：按 parent 出现优先；模板生成时基本是顺序的，此处一遍重试两次足够
      for (let pass = 0; pass < 2; pass += 1) {
        for (const b of skeleton.bones) {
          if (worldByBone.has(b.id)) continue;
          const parentWorld = b.parentId ? worldByBone.get(b.parentId) : null;
          if (b.parentId && !parentWorld) continue;
          const local = applyAnimationToBone(b, animation, time);
          worldByBone.set(b.id, composeWorld(parentWorld || null, local));
        }
      }

      // 清屏 + 网格
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "rgba(2,6,23,0.6)";
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = "rgba(148,163,184,0.10)";
      ctx.lineWidth = 1;
      for (let x = 0; x <= width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y <= height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // 绘制 slots，按 zOrder
      // 完全骨骼驱动：所有 slot（含 PSD 带 sourceRect 的部件）一律按所绑骨骼的世界 transform 定位，
      // 不再特殊处理 sourceRect 绝对坐标——这样部件能跟随骨骼动画移动/旋转，代价是静止摆位
      // 由骨骼 setup pose + pivot 决定，会与 PS 原图相对位置有偏差（用户已确认接受 tradeoff）。
      const sortedSlots: Slot[] = skeleton.slots.slice().sort((a, b) => a.zOrder - b.zOrder);
      const imgById = new Map(images.map((i) => [i.id, i.img]));

      // PSD 服饰图层按画布 letterbox 同比缩放，避免被 computeAttachmentDisplaySize 按四肢长度压扁。
      const firstPsd = skeleton.attachments.find((a) => a.sourceRect);
      const psdScale = firstPsd?.sourceRect
        ? Math.min(width / firstPsd.sourceRect.canvasWidth, height / firstPsd.sourceRect.canvasHeight)
        : 0;

      for (const slot of sortedSlots) {
        const att = skeleton.attachments.find((a) => a.id === slot.attachmentId);
        const bone = skeleton.bones.find((b) => b.id === slot.boneId);
        if (!att || !bone) continue;
        const w = worldByBone.get(bone.id);
        if (!w) continue;
        const img = imgById.get(att.id);
        if (!img || !img.complete) continue;

        ctx.save();
        ctx.translate(cx + w.x, cy + w.y);
        const { w: dispW, h: dispH } = computeAttachmentDisplaySize(att, bone, psdScale);
        const px = att.pivot.x * dispW;
        const py = att.pivot.y * dispH;
        const offset = slot.setupOffset;
        if (offset) {
          const rad = (w.rotationDeg * Math.PI) / 180;
          ctx.translate(offset.x * Math.cos(rad) - offset.y * Math.sin(rad), offset.x * Math.sin(rad) + offset.y * Math.cos(rad));
        }
        const upright = UPRIGHT_ATTACHMENT_NAMES.has(bone.name);
        if (offset) {
          ctx.rotate(((upright ? 0 : w.rotationDeg) + offset.rotation) * Math.PI / 180);
        } else if (!upright) {
          ctx.rotate((w.rotationDeg * Math.PI) / 180);
        }
        ctx.scale(w.scaleX, w.scaleY);
        ctx.drawImage(img, -px, -py, dispW, dispH);
        ctx.restore();
      }

      // 骨骼线段（半透明覆盖）
      ctx.strokeStyle = "rgba(96,165,250,0.6)";
      ctx.lineWidth = 2;
      for (const b of skeleton.bones) {
        const w = worldByBone.get(b.id);
        if (!w) continue;
        const len = b.length || 0;
        if (!len) continue;
        const rad = (w.rotationDeg * Math.PI) / 180;
        const ex = w.x + len * Math.cos(rad) * w.scaleX;
        const ey = w.y + len * Math.sin(rad) * w.scaleY;
        ctx.beginPath();
        ctx.moveTo(cx + w.x, cy + w.y);
        ctx.lineTo(cx + ex, cy + ey);
        ctx.stroke();
        ctx.fillStyle = "#facc15";
        ctx.beginPath();
        ctx.arc(cx + w.x, cy + w.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(loopTick);
    };

    rafRef.current = requestAnimationFrame(loopTick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [skeleton, animation, images, loop, timeScale, width, height]);

  // 强制 React 在 animation 变化时重新挂载 effect
  useEffect(() => {
    setTick((t) => t + 1);
  }, [animationId]);

  return <canvas ref={canvasRef} className="bone-preview-canvas" />;
}
