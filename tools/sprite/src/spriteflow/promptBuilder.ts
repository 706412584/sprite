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

function hasAnyAction(actions: SpriteFlowAction[], ids: string[]): boolean {
  return actions.some((action) => ids.includes(action.id));
}

/**
 * 全局身份锁：跨帧必须保持的属性清单。
 * 灵感来自 hatch-pet 的 row-generation identity lock —— 用逐字列举的属性清单
 * 替代模糊的"same character"，显著降低帧间漂移。
 */
function buildIdentityLock(): string {
  return [
    "",
    "IDENTITY LOCK / 跨帧身份锁:",
    "Every cell must show the exact same single character. Lock the following properties across every frame:",
    "- silhouette and body proportions (head-to-body ratio, limb length, build)",
    "- face shape, facial features, expression baseline, skin/fur/scale color and markings",
    "- hair / fur / scale style and color",
    "- outfit, armor, accessories, and any held props (weapons, staves, instruments)",
    "- color palette, materials, level of rendering detail",
    "- camera angle and viewing distance",
    "Pose, limb positions, weight, and motion change between frames. Identity does NOT change.",
    "Poses are GENERATED animation variants, not repeated copies of the same source image with tiny edits.",
    "Treat any frame that drifts in style, palette, proportions, materials, or props as a hard failure of this contract.",
  ].join("\n");
}

/**
 * 全局效果策略：什么效果允许、什么禁止。
 * 灵感来自 hatch-pet 的 "Transparency And Effects" 章节 —— 用 attached vs detached
 * 的二分法约束模型，避免它用速度线/灰尘/星星等装饰特效掩盖姿态本身的不变化。
 */
function buildEffectsPolicy(keyingColor?: string): string {
  const chromaNote = keyingColor
    ? `Effects must NOT use colors close to the chroma key (${keyingColor}); they must remain easy to distinguish from the background during keying.`
    : "Effects must NOT use colors close to the chroma background; they must remain distinguishable for downstream keying.";
  return [
    "",
    "EFFECTS POLICY / 特效策略（关键，违反即失败）:",
    "Prefer pose, expression, and silhouette change to convey motion. Do NOT use decorative effects to fake animation.",
    "ATTACHED vs DETACHED rule:",
    "- ATTACHED effects (allowed if state-relevant): touch, overlap, or directly emerge from the character body / weapon / prop. Examples: tears running down the face, attached small breath puff at the mouth, attached impact spark on a weapon at moment of strike, attached magic glow on hands or staff.",
    "- DETACHED effects (forbidden by default): floating around the character with no physical contact. Examples: stars / sparkles / asterisks / icons / punctuation marks / smoke puffs / dust clouds / tear droplets flying away / speed arcs / motion lines / trail streaks / afterimages / motion blur / cast or contact or drop shadows / aura halos / soft glow patches.",
    "Allowed effects must satisfy ALL of:",
    "(a) state-relevant (matches the action being shown),",
    "(b) attached / touching / overlapping the silhouette,",
    "(c) opaque and hard-edged, not soft or transparent,",
    `(d) ${chromaNote}`,
    "(e) small enough not to dominate the frame.",
    "GLOBALLY FORBIDDEN regardless of action:",
    "- speed lines, motion arcs, smear frames, afterimages, motion blur",
    "- stars, sparkles, exclamation marks, question marks, hearts, asterisks, comic-book emoji, or any floating symbols",
    "- cast shadows, contact shadows, drop shadows, oval ground shadows, floor patches, landing rings, impact bursts",
    "- soft glow halos, aura clouds, transparent rim light",
    "- dust puffs, smoke trails, debris particles unless the action explicitly creates them as attached effects",
    "- text, numbers, letters, frame labels, UI bubbles, speech balloons, grids, guide marks, watermarks, signatures",
    "- white / black / checkerboard / scenery backgrounds",
  ].join("\n");
}

function buildLocomotionContract(gridConfig: GridConfig, actions: SpriteFlowAction[]): string {
  const wantsWalk = hasAction(actions, "walk");
  const wantsRun = hasAction(actions, "run");
  const wantsRunRight = hasAction(actions, "running-right");
  const wantsRunLeft = hasAction(actions, "running-left");
  const wantsDirectionalRun = wantsRunRight || wantsRunLeft;
  if (!wantsWalk && !wantsRun && !wantsDirectionalRun) return "";
  const frameCount = gridConfig.frameCount;
  const motionName = wantsWalk && (wantsRun || wantsDirectionalRun)
    ? "行走/奔跑"
    : wantsWalk
      ? "行走"
      : "奔跑";
  const threeFrameWalk = wantsWalk && frameCount === 3;

  const lines: string[] = [
    "",
    "LOCOMOTION HARD CONSTRAINTS / 移动动作硬约束:",
    `当前动作是${motionName}，角色的腿和脚必须是动作的主要驱动力，不允许只让头发、衣服、披风或身体轻微晃动来假装在走。`,
    "每一帧都必须能清楚看到脚部位置变化、支撑脚变化、重心变化。双脚不能在连续帧里固定在同一个接地点。",
    "左右腿必须交替：一条腿向前迈出并接触地面，另一条腿在后方蹬地或离地摆动；手臂必须与腿部反向摆动。",
    "Cadence must visibly alternate across the loop: do NOT use the same supporting foot in consecutive frames.",
    "不要画成站立姿势、原地抖动、衣服飘动、头发飘动。腿部轮廓和脚底接地点必须明显不同。",
    threeFrameWalk
      ? "三帧行走循环必须使用明确的脚步接触姿态：第1帧左脚在前接触地面、右脚在后方蹬地；第2帧为过渡姿态，身体重心移动到中线附近，双脚明显分开，手臂反向摆动；第3帧右脚在前接触地面、左脚在后方蹬地。第3帧必须能自然循环回第1帧。"
      : `在这 ${frameCount} 帧内必须完成完整的${motionName}循环：接触、过渡、另一只脚接触、跟随恢复都要分配到画面内，最后一帧必须能自然循环回第一帧。`,
    // Locomotion 专属禁止清单（hatch-pet 风格）
    "FORBIDDEN for locomotion: speed lines, motion arcs, dust clouds, dust puffs, ground impact rings, afterimage trails, motion blur, smear frames, floor shadows, contact shadows, foot scuff marks. Convey speed by leg position, body lean, and arm swing only.",
  ];

  if (wantsDirectionalRun) {
    lines.push("DIRECTIONAL LOCOMOTION LOCK:");
    if (wantsRunRight) {
      lines.push("- 向右移动：facing direction = travel direction = screen-right. The character must face right AND the entire silhouette must physically translate from left edge of cell toward right edge of cell across the loop. Do NOT flip facing across frames.");
    }
    if (wantsRunLeft) {
      lines.push("- 向左移动：facing direction = travel direction = screen-left. The character must face left AND the entire silhouette must physically translate from right edge of cell toward left edge of cell across the loop. Do NOT flip facing across frames.");
    }
  }

  return lines.join("\n");
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
      "Idle FORBIDDEN: do NOT accept several effectively identical copies of the same pose. Every frame must show micro-variation in breath, shoulders, weight, eyes, or hand position. NO waving, NO walking, NO working actions, NO new props introduced mid-loop, NO floating effects.",
    );
    if (frameCount === 3) lines.push("三帧待机：第1帧吸气准备，第2帧肩胸轻微上升或重心微移，第3帧呼气回落并能循环回第1帧。");
  }

  if (hasAction(actions, "walk")) {
    lines.push(
      "行走：通过腿脚清晰交替、支撑脚每帧切换、手臂与腿反向摆动来传达。整个循环可平滑回到第一帧。",
      "Walk FORBIDDEN: NO speed lines, NO dust clouds at the feet, NO ground shadow patches, NO motion blur, NO afterimages, NO foot scuff marks. The supporting foot must change between every consecutive frame; the same supporting foot in adjacent frames is a hard failure.",
    );
  }

  if (hasAction(actions, "run")) {
    lines.push(
      "奔跑：通过更大的腿部步幅、躯干前倾、手臂前后摆动、双脚同时离地的飞行帧来传达；不要画成站立姿势加风线。",
      "Run FORBIDDEN: NO speed lines, NO motion blur, NO afterimage trails, NO ground dust clouds, NO heat distortion, NO floor shadows, NO foot scuff marks. Speed is conveyed only by stride length, body lean, and the flight-phase silhouette where both feet are off the ground.",
    );
  }

  if (hasAction(actions, "attack")) {
    lines.push(
      "攻击：必须包含预备蓄力、主要打击瞬间、跟随收招。武器、手臂或身体攻击轨迹必须清楚变化，不允许只站着摆姿势。",
      "Attack FORBIDDEN: NO detached impact stars, NO floating slash arcs separated from the weapon, NO speed lines, NO motion blur, NO afterimages. Impact effects, if any, must be ATTACHED to the weapon edge or to the contact point at the exact strike frame, opaque and hard-edged.",
    );
    if (frameCount === 3) lines.push("三帧攻击：第1帧后撤/举起武器蓄力，第2帧挥击或命中瞬间，第3帧跟随动作并回到可循环/可衔接姿态。");
  }

  if (hasAction(actions, "cast")) {
    lines.push(
      "施法：必须包含能量聚集、释放、余波或收势。手部、法杖、身体重心和魔法效果必须逐帧变化，不能只是站立发光。",
      "Cast FORBIDDEN: NO detached sparkles or stars floating around hands, NO symbol icons, NO soft glow halos. Magic effects must be ATTACHED to the hands, staff, or focus prop, opaque and hard-edged.",
    );
    if (frameCount === 3) lines.push("三帧施法：第1帧双手/法杖聚能，第2帧能量最亮并向外释放，第3帧余波散开、身体收势并能循环或衔接。");
  }

  if (hasAction(actions, "jump") || hasAction(actions, "jumping")) {
    lines.push(
      "跳跃：必须包含下蹲蓄力、离地/空中最高点、落地缓冲。脚必须离开地面或明确改变高度，不允许只是原地抖动。",
      "Jump FORBIDDEN: NO floor shadow, NO ground dust cloud, NO landing impact ring, NO speed lines on the way up or down. Convey vertical motion ONLY by changing the body's vertical position within the cell.",
    );
    if (frameCount === 3) lines.push("三帧跳跃：第1帧下蹲压低重心，第2帧离地到最高点，双脚明显离开地面，第3帧落地屈膝缓冲并能回到第1帧。");
  }

  if (hasAction(actions, "dodge")) {
    lines.push(
      "闪避：必须包含启动、快速位移/翻滚或侧身、恢复站稳。角色位置、身体倾斜和脚步必须明显变化，不允许只是身体轻微倾斜。",
      "Dodge FORBIDDEN: NO speed lines, NO afterimage trails, NO motion blur smears. Convey speed by sharp body lean, foot position, and silhouette displacement only.",
    );
    if (frameCount === 3) lines.push("三帧闪避：第1帧压低重心准备，第2帧身体快速侧移或翻滚到最大位移，第3帧落脚恢复平衡并能衔接下一轮动作。");
  }

  if (hasAction(actions, "death")) {
    lines.push(
      "倒地：必须包含受击失衡、膝盖或身体塌落、最终倒地姿态。身体高度必须逐帧下降，不能只是站立低头。",
      "Death FORBIDDEN: NO floating cartoon X marks, NO orbiting stars or birds around the head, NO floating ghost or soul wisp unless explicitly part of the character concept. Use body collapse and posture only.",
    );
    if (frameCount === 3) lines.push("三帧倒地：第1帧受击后仰或失衡，第2帧膝盖弯曲身体下坠，第3帧倒在地面形成清楚最终姿态。");
  }

  // hatch-pet 风格新动作

  if (hasAction(actions, "waving")) {
    lines.push(
      "挥手问候：通过手 / 爪 / 翅膀 / 肢体的清晰弧线传达问候，从低位起手，过渡到峰值挥动并保持，再回落。整个动作完全通过该肢体本身完成。",
      "Waving FORBIDDEN: NO wave marks, NO arc lines, NO sparkles, NO speech bubbles, NO greeting symbols anywhere around the gesturing limb. The wave is conveyed by the limb's position alone.",
    );
  }

  if (hasAction(actions, "waiting")) {
    lines.push(
      "期待询问：明显的期待询问姿态用于等待批准 / 帮助 / 用户输入：头部倾斜、身体前倾、抬起的爪 / 手、专注的目光。必须与普通待机和审视思考有清晰区别。",
      "Waiting FORBIDDEN: NO question mark icons floating overhead, NO speech bubbles, NO thought clouds. Convey expectation through pose, gaze, and tilt only.",
    );
  }

  if (hasAction(actions, "working")) {
    lines.push(
      "专注工作：完全通过上半身和头部传达活跃的专注任务工作 —— 思考、扫视、类似打字的手指动作、或专注用力。这不是物理意义的奔跑，脚步保持原地，身体不发生位移。",
      "Working FORBIDDEN: NO literal jogging or sprinting, NO raised knees, NO arm pumps in a running cadence, NO directional travel across the cell, NO speed lines, NO dust, NO trails. The character stays planted while only upper body conveys activity.",
    );
  }

  if (hasAction(actions, "review")) {
    lines.push(
      "审视思考：聚焦的检查 / 思考循环：身体微倾、眨眼、眼神扫视、头部倾斜、爪 / 手靠近下巴或脸部。",
      "Review FORBIDDEN: NO magnifying glass props, NO papers, NO code or UI elements, NO new accessories that did not exist in earlier frames. Use existing props and pose only.",
    );
  }

  if (hasAction(actions, "failed")) {
    lines.push(
      "失败沮丧：耷拉的肩膀、低垂的头、可附着的眼泪或附着的小型呼气云。可读但不嘈杂。",
      "Failed FORBIDDEN: NO floating red X icons, NO crash symbols, NO detached tears flying off the face, NO detached puff clouds. Tears must run down the face; any breath puff must emerge from the mouth and stay attached.",
    );
  }

  if (hasAction(actions, "running-right") || hasAction(actions, "running-left")) {
    lines.push(
      "向左 / 向右移动：方向性位移循环。身体面朝该方向 AND 整个轮廓在循环中实际跨越画面在该方向上发生位移。左右脚步态必须清晰交替。",
      "Directional running FORBIDDEN: NO speed lines, NO dust clouds, NO foot scuff marks, NO motion blur, NO trails, NO ground shadow, NO afterimages. Speed is conveyed by leg stride, body lean, and silhouette translation only.",
    );
  }

  if (frameCount !== 3) {
    lines.push(`非三帧动作：把每个动作拆成 ${frameCount} 个清楚阶段，必须包含开始、推进、高潮、跟随、恢复/循环，不要重复相邻姿势。`);
  }

  // 全动作通用：拒绝复制粘贴
  if (hasAnyAction(actions, ["idle", "walk", "run", "running-right", "running-left", "waving", "waiting", "working", "review", "failed", "attack", "cast", "jump", "jumping", "dodge", "death"])) {
    lines.push(
      "ANTI-COPY RULE: Poses across frames are GENERATED animation variants. Do NOT produce two adjacent frames that are visually identical or near-identical (same limb positions, same eye direction, same prop angle).",
    );
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
  const identityLock = buildIdentityLock();
  const effectsPolicy = buildEffectsPolicy(keyingColor);

  const directionPrompt = getDirectionPrompt(direction);
  const isLocomotion = hasAnyAction(actions, ["walk", "run", "running-right", "running-left"]);
  const directionBlock = directionPrompt
    ? [
        "",
        "FACING DIRECTION:",
        directionPrompt,
        "The facing direction must remain consistent across every cell. Do not mirror, rotate, or switch views between frames.",
        isLocomotion && (direction === "left" || direction === "right")
          ? `LOCOMOTION DIRECTION LOCK: travel direction equals facing direction (${direction === "right" ? "screen-right" : "screen-left"}). The character's silhouette must physically translate in the same direction it is facing across the frames; do NOT show running-in-place, and do NOT flip facing mid-loop.`
          : "",
      ]
        .filter(Boolean)
        .join("\n")
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
    identityLock,
    effectsPolicy,
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
