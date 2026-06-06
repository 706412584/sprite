/**
 * Prompt engineering for SpriteFlow.
 *
 * Adapted from https://github.com/lovisdotio/falsprite (MIT) — the original
 * targets fal.ai's nano-banana-2; here we keep the high-quality grid /
 * choreography prompt and drop the fal-specific bits.
 */

import type { SpriteFlowAction, GridConfig, SpriteDirection } from "./types";
import { getDirectionPrompt } from "./types";

const NUM_WORDS: Record<number, string> = {
  1: "one",
  2: "two",
  3: "three",
  4: "four",
  5: "five",
  6: "six",
  7: "seven",
  8: "eight",
  9: "nine",
  10: "ten",
  11: "eleven",
  12: "twelve",
};

function getNumWord(n: number): string {
  return NUM_WORDS[n] || String(n);
}

function hasAction(actions: SpriteFlowAction[], id: string): boolean {
  return actions.some((action) => action.id === id);
}

function buildLocomotionContract(gridConfig: GridConfig, actions: SpriteFlowAction[]): string {
  const wantsWalk = hasAction(actions, "walk");
  const wantsRun = hasAction(actions, "run");
  if (!wantsWalk && !wantsRun) return "";
  const frameCount = gridConfig.frameCount;
  const motionName = wantsWalk && wantsRun ? "行走/奔跑" : wantsWalk ? "行走" : "奔跑";
  const threeFrameWalk = wantsWalk && frameCount === 3;

  return [
    "",
    "LOCOMOTION HARD CONSTRAINTS / 移动动作硬约束:",
    `当前动作是${motionName}，角色的腿和脚必须是动作的主要驱动力，不允许只让头发、衣服、披风或身体轻微晃动来假装在走。`,
    "每一帧都必须能清楚看到脚部位置变化、支撑脚变化、重心变化。双脚不能在连续帧里固定在同一个接地点。",
    "左右腿必须交替：一条腿向前迈出并接触地面，另一条腿在后方蹬地或离地摆动；手臂必须与腿部反向摆动。",
    "不要画成站立姿势、原地抖动、衣服飘动、头发飘动。腿部轮廓和脚底接地点必须明显不同。",
    threeFrameWalk && "三帧行走循环必须使用明确的脚步接触姿态：第1帧左脚在前接触地面、右脚在后方蹬地；第2帧为过渡姿态，身体重心移动到中线附近，双脚明显分开，手臂反向摆动；第3帧右脚在前接触地面、左脚在后方蹬地。第3帧必须能自然循环回第1帧。",
    !threeFrameWalk && `在这 ${frameCount} 帧内必须完成完整的${motionName}循环：接触、过渡、另一只脚接触、跟随恢复都要分配到画面内，最后一帧必须能自然循环回第一帧。`,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildActionFrameContracts(gridConfig: GridConfig, actions: SpriteFlowAction[]): string {
  if (actions.length === 0) return "";
  const frameCount = gridConfig.frameCount;
  const lines: string[] = [
    "",
    "ACTION-SPECIFIC FRAME CONTRACTS / 动作专属帧约束:",
    `所有选中的动作都必须在当前 ${frameCount} 帧内完成，不允许把关键动作留到画面外或只用静态姿势暗示。`,
  ];

  if (hasAction(actions, "idle")) {
    lines.push(
      "待机：每一帧都要有轻微但可见的呼吸、肩部、重心或手部变化；不要三帧完全相同。动作必须保持安静循环，最后一帧自然回到第一帧。",
    );
    if (frameCount === 3) lines.push("三帧待机：第1帧吸气准备，第2帧肩胸轻微上升或重心微移，第3帧呼气回落并能循环回第1帧。");
  }

  if (hasAction(actions, "attack")) {
    lines.push(
      "攻击：必须包含预备蓄力、主要打击瞬间、跟随收招。武器、手臂或身体攻击轨迹必须清楚变化，不允许只站着摆姿势。",
    );
    if (frameCount === 3) lines.push("三帧攻击：第1帧后撤/举起武器蓄力，第2帧挥击或命中瞬间，第3帧跟随动作并回到可循环/可衔接姿态。");
  }

  if (hasAction(actions, "cast")) {
    lines.push(
      "施法：必须包含能量聚集、释放、余波或收势。手部、法杖、身体重心和魔法效果必须逐帧变化，不能只是站立发光。",
    );
    if (frameCount === 3) lines.push("三帧施法：第1帧双手/法杖聚能，第2帧能量最亮并向外释放，第3帧余波散开、身体收势并能循环或衔接。");
  }

  if (hasAction(actions, "jump")) {
    lines.push(
      "跳跃：必须包含下蹲蓄力、离地/空中最高点、落地缓冲。脚必须离开地面或明确改变高度，不允许只是原地抖动。",
    );
    if (frameCount === 3) lines.push("三帧跳跃：第1帧下蹲压低重心，第2帧离地到最高点，双脚明显离开地面，第3帧落地屈膝缓冲并能回到第1帧。");
  }

  if (hasAction(actions, "dodge")) {
    lines.push(
      "闪避：必须包含启动、快速位移/翻滚或侧身、恢复站稳。角色位置、身体倾斜和脚步必须明显变化，不允许只是身体轻微倾斜。",
    );
    if (frameCount === 3) lines.push("三帧闪避：第1帧压低重心准备，第2帧身体快速侧移或翻滚到最大位移，第3帧落脚恢复平衡并能衔接下一轮动作。");
  }

  if (hasAction(actions, "death")) {
    lines.push(
      "倒地：必须包含受击失衡、膝盖或身体塌落、最终倒地姿态。身体高度必须逐帧下降，不能只是站立低头。",
    );
    if (frameCount === 3) lines.push("三帧倒地：第1帧受击后仰或失衡，第2帧膝盖弯曲身体下坠，第3帧倒在地面形成清楚最终姿态。");
  }

  if (frameCount !== 3) {
    lines.push(`非三帧动作：把每个动作拆成 ${frameCount} 个清楚阶段，必须包含开始、推进、高潮、跟随、恢复/循环，不要重复相邻姿势。`);
  }

  return lines.join("\n");
}

export function buildSpritePrompt(
  basePrompt: string,
  gridConfig: GridConfig,
  actions: SpriteFlowAction[],
  keyingColor?: string,
  direction?: SpriteDirection,
  outputSizeHint?: string,
  backgroundPrompt?: string,
): string {
  const isRow = gridConfig.layout === "row";
  const frameCount = gridConfig.frameCount;
  const w = getNumWord(frameCount);
  
  const layoutDesc = isRow
    ? `FORMAT: A single image containing a SINGLE HORIZONTAL ROW of ${frameCount} equally sized cells (1×${gridConfig.size} grid).`
    : `FORMAT: A single image containing a ${gridConfig.size}-by-${gridConfig.size} grid of equally sized cells.`;
  
  const readingOrder = isRow
    ? "ANIMATION FLOW: The cells read left-to-right in a SINGLE ROW."
    : "ANIMATION FLOW: The cells read left-to-right, top-to-bottom, like reading a page.";
  
  const actionsBlock =
    actions.length === 0
      ? ""
      : [
          "",
          "REQUESTED ANIMATION BEATS (in order, one row each if multiple):",
          ...actions.map((a) => `- ${a.label}: ${a.hint}`),
        ].join("\n");

  const locomotionContract = buildLocomotionContract(gridConfig, actions);
  const actionFrameContracts = buildActionFrameContracts(gridConfig, actions);

  const directionPrompt = getDirectionPrompt(direction);
  const directionBlock = directionPrompt
    ? [
        "",
        "FACING DIRECTION:",
        directionPrompt,
        "The facing direction must remain consistent across every cell. Do not mirror, rotate, or switch views between frames.",
      ].join("\n")
    : "";

  // 构建背景要求：如果指定了色键颜色，强制要求纯色背景
  const backgroundRequirement = keyingColor
    ? `CRITICAL BACKGROUND REQUIREMENT: The background MUST be a perfectly uniform solid ${keyingColor} color (RGB ${keyingColor}) with absolutely NO gradients, NO shading, NO texture, NO variation whatsoever. Every single pixel of the background must be exactly ${keyingColor}. This is essential for automatic background removal via color keying.`
    : "Strong clean silhouette against a plain solid flat-color background that is easy to key out.";

  const sizeBlock = outputSizeHint
    ? [
        "",
        "OUTPUT CANVAS SIZE:",
        outputSizeHint,
      ].join("\n")
    : "";

  const globalBackgroundBlock = backgroundPrompt
    ? [
        "",
        "GLOBAL BACKGROUND / MASK:",
        backgroundPrompt,
        "This background rule applies to the entire sprite sheet and every frame consistently.",
      ].join("\n")
    : "";

  return [
    "STRICT TECHNICAL REQUIREMENTS FOR THIS IMAGE:",
    "",
    layoutDesc,
    "Every cell must be the exact same dimensions, perfectly aligned, with no gaps or overlap.",
    isRow && "CRITICAL: This must be a SINGLE ROW ONLY. Do NOT create multiple rows. All frames must be in ONE horizontal line.",
    "",
    "FORBIDDEN: Absolutely no text, no numbers, no letters, no digits, no labels,",
    "no watermarks, no signatures, no UI elements anywhere in the image. The image must",
    "contain ONLY the character illustrations in the grid cells and nothing else.",
    "",
    "CONSISTENCY: The exact same single character must appear in every cell.",
    "Same proportions, same art style, same level of detail, same camera angle throughout.",
    "Isometric three-quarter view. Full body visible head to toe in every cell.",
    "The character must keep the same scale, foot contact height, and center-line position in every cell.",
    "Reserve the same visual padding around the character in all cells so left, right, up, and down occupancy is consistent.",
    backgroundRequirement,
    globalBackgroundBlock,
    directionBlock,
    sizeBlock,
    "",
    readingOrder,
    "This is one continuous motion sequence. Each cell shows the next moment in the movement.",
    `FRAME COUNT CONTRACT: The complete requested action must start, develop, finish, and return to the loop-ready pose within exactly ${frameCount} frames. Do not add extra implied frames outside the sheet. Do not leave the action incomplete at the last frame.`,
    actions.length > 0 && `ACTION COVERAGE: The selected action${actions.length > 1 ? "s" : ""} (${actions.map((a) => a.label).join(", ")}) must be fully readable within these ${frameCount} frames, with clear anticipation, main motion, follow-through, and recovery distributed across the available cells.`,
    isRow
      ? `The ${w} frames form a complete animation loop. The very last frame loops back seamlessly to the very first frame.`
      : "The transition between the last cell of one row and the first cell of the next row must be just as smooth as transitions within a row, no jumps, no resets.",
    !isRow && `Each row contains ${gridConfig.size} phases of the motion. The very last cell loops back seamlessly to the very first cell.`,
    "",
    "MOTION QUALITY: Show real weight and physics. Bodies shift weight between feet.",
    "Arms counterbalance legs. Torsos rotate into actions. Follow-through on every movement.",
    "No stiff poses, every cell must feel like a freeze-frame of fluid motion.",
    "For locomotion (walk/run): strictly alternate left and right legs, one leg extends forward",
    "while the other pushes behind. Each frame must show a clearly different leg position.",
    "Never repeat the same pose twice in a row.",
    locomotionContract,
    actionFrameContracts,
    "",
    "CHARACTER AND ANIMATION DIRECTION:",
    basePrompt,
    actionsBlock,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildRewriteSystemPrompt(gridConfig: GridConfig): string {
  const beatCount = gridConfig.layout === "square" ? gridConfig.size : gridConfig.frameCount;
  const w = getNumWord(beatCount);
  const layoutNote = gridConfig.layout === "row"
    ? "The animation will be displayed as a single horizontal row of frames."
    : `The animation will be displayed as a ${gridConfig.size}×${gridConfig.size} grid.`;
  
  return [
    "You are an animation director and character designer for a sprite sheet pipeline.",
    "Given a character concept, you MUST return exactly two sections, nothing else:",
    "",
    "CHARACTER: A vivid description of the character's appearance, body type, armor, weapons, colors, silhouette, art style. Be extremely specific and visual.",
    "",
    `CHOREOGRAPHY: A ${w}-beat continuous animation loop that showcases this specific character's personality and abilities. The last beat must transition seamlessly back into the first.`,
    "For each beat, describe the body position, weight distribution, limb placement, and motion arc in one sentence.",
    "The choreography must feel natural and unique to THIS character, a mage animates differently than a knight, a dancer differently than a berserker.",
    "",
    "RULES:",
    "- Never use numbers or digits anywhere.",
    "- Never mention grids, pixels, frames, cells, or image generation.",
    "- Never mention sprite sheets or technical terms.",
    "- Write as if directing a real actor through a motion capture session.",
    `- The ${w} beats must form one fluid, looping performance.`,
    gridConfig.layout === "square" && `- Square grid mode: each beat is one row. Describe ${w} row-level beats, not ${getNumWord(gridConfig.frameCount)} separate frame beats. Each row then contains smaller phases of that beat.`,
    gridConfig.layout === "row" && `- Single-row mode: each beat is one frame. Describe all ${w} frame beats clearly.`,
    "- For locomotion (walk/run): strictly alternate left and right legs in each beat.",
    "- 中文补充：如果是行走或奔跑，每个节拍都必须明确写出哪只脚在前接触地面、哪只脚在后方蹬地或摆动，不能只描述衣服、头发、披风或身体晃动。",
    beatCount === 3 && "- 中文补充：三节拍行走必须写成左脚前接触、过渡重心、右脚前接触，并让第三节拍能自然循环回第一节拍。",
    "- 中文补充：如果是攻击，必须写出蓄力、命中、收招；如果是施法，必须写出聚能、释放、余波；如果是跳跃，必须写出下蹲、离地、落地；如果是闪避，必须写出启动、位移、恢复；如果是倒地，必须写出失衡、下坠、最终倒地。",
    "- 中文补充：每个节拍都必须描述身体高度、重心、四肢位置和关键道具/特效变化，不要写成相邻节拍几乎一样的静态姿势。",
    "",
    layoutNote,
  ].join("\n");
}

export function buildRewriteUserPrompt(
  basePrompt: string,
  gridConfig: GridConfig,
  actions: SpriteFlowAction[],
): string {
  const beatCount = gridConfig.layout === "square" ? gridConfig.size : gridConfig.frameCount;
  const w = getNumWord(beatCount);
  const actionList =
    actions.length > 0
      ? ` The choreography must showcase: ${actions.map((a) => a.label).join(", ")}.`
      : "";
  const layoutHint = gridConfig.layout === "square"
    ? ` Use ${w} row-level beats for a ${gridConfig.size}x${gridConfig.size} square sprite sheet.`
    : ` Use ${w} frame-level beats for a single-row sprite strip.`;
  return `Design the character and choreograph a ${w}-beat animation loop for: ${basePrompt}.${actionList}${layoutHint}`;
}

export function makeDefaultPrompt(): string {
  const subjects = [
    "baby dragon",
    "crystal fox",
    "tiny samurai cat",
    "sparkle unicorn",
    "bamboo panda warrior",
  ];
  const styles = [
    "clean pixel art",
    "chibi kawaii",
    "pastel dreamlike",
    "cozy storybook",
    "Studio Ghibli inspired",
  ];
  const subject = subjects[Math.floor(Math.random() * subjects.length)];
  const style = styles[Math.floor(Math.random() * styles.length)];
  return `${subject}, ${style}, isometric action RPG`;
}
