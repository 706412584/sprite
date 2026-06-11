// PSD 图层名 → humanoid 骨骼名 的自动映射
// PSD 图层名是服饰/部位语义（front_hair / topwear / handwear-l / legwear ...），
// humanoid 模板骨骼是分段四肢（head / torso / upperArmL / forearmL / thighL / shinL ...）。
// 这里用"关键词 + 左右后缀"把每个图层归到一根驱动骨：摆位仍靠 sourceRect 一比一还原，
// 绑骨只决定该图层跟随哪根骨的动画运动（如挥手时 handwear 跟前臂、跑步时 legwear 跟大腿）。

// 单条映射规则：keyword 命中图层名（小写、去左右后缀后）即归到 bone。
interface MappingRule {
  keywords: string[];
  // 不带左右的目标骨（命中后按 side 拼接 L/R）；side 为 null 表示中线骨不分左右。
  bone: string;
  // 该规则是否区分左右：true 时按图层 -l/-r 后缀拼成 boneL/boneR。
  sided: boolean;
  // 细分模板优先骨，基础模板不存在时由 StageRig 回退到 bone。
  detailedBone?: string;
  // 区分左右的规则是否把基础回退骨也拼 L/R；五官回退到 head 这类中线骨时设为 false。
  fallbackSided?: boolean;
  // 区分左右的整层服饰未带 -l/-r 时，降级到中线骨，避免整张图被单侧行走骨拖裂。
  unsidedBoneNames?: string[];
}

// 顺序敏感：越具体的规则越靠前，避免 hair 被 head 抢、skirt 被 wear 抢。
const RULES: MappingRule[] = [
  { keywords: ["mouth", "lip", "teeth", "tongue"], bone: "head", sided: false, detailedBone: "mouth" },
  { keywords: ["eye", "brow", "lash", "iris", "irid", "pupil"], bone: "head", sided: true, detailedBone: "eye", fallbackSided: false, unsidedBoneNames: ["head"] },
  { keywords: ["backhair", "hairback", "rearhair"], bone: "head", sided: false, detailedBone: "hairBack" },
  { keywords: ["fronthair", "hairfront", "bang", "bangs", "hair", "headwear", "hat", "helmet", "horn"], bone: "head", sided: false, detailedBone: "hairFront" },
  { keywords: ["face", "head", "nose", "ear"], bone: "head", sided: false },
  { keywords: ["handwear", "hand", "glove", "weapon", "wrist"], bone: "forearm", sided: true, detailedBone: "hand", unsidedBoneNames: ["chest", "torso"] },
  { keywords: ["forearm"], bone: "forearm", sided: true, unsidedBoneNames: ["chest", "torso"] },
  { keywords: ["upperarm", "shoulder", "sleeve", "arm"], bone: "upperArm", sided: true, unsidedBoneNames: ["chest", "torso"] },
  { keywords: ["shoe", "boot", "foot", "feet"], bone: "shin", sided: true, detailedBone: "foot", unsidedBoneNames: ["waist", "torso"] },
  { keywords: ["legwear", "shin", "calf"], bone: "shin", sided: true, unsidedBoneNames: ["waist", "torso"] },
  { keywords: ["thigh", "leg"], bone: "thigh", sided: true, unsidedBoneNames: ["waist", "torso"] },
  { keywords: ["cape", "cloak"], bone: "torso", sided: false, detailedBone: "cape" },
  { keywords: ["skirt"], bone: "torso", sided: false, detailedBone: "skirt" },
  { keywords: ["belt", "waist", "bottomwear"], bone: "torso", sided: false, detailedBone: "waist" },
  { keywords: ["topwear", "chest", "coat", "robe", "dress"], bone: "torso", sided: false, detailedBone: "chest" },
  // 杂项默认归躯干，保证全部图层都有骨可绑，用户可手动改。
  { keywords: ["torso", "body", "wear", "object", "prop", "item", "accessory", "misc", "extra", "other"], bone: "torso", sided: false },
];

export interface PsdBoneMatch {
  /** 首选目标骨骼 name（已拼好左右，如 forearmL）；未命中为 null。 */
  boneName: string | null;
  /** 从细分到基础的候选骨骼名，StageRig 会选择当前模板中存在的第一个。 */
  boneNames: string[];
  /** 命中的关键词（调试 / 提示用）。 */
  keyword: string | null;
}

// 从图层名里识别左右：优先 -l / -r / _l / _r 后缀，其次 left/right 子串。返回 "L" | "R" | null。
function detectSide(lower: string): "L" | "R" | null {
  if (/(^|[-_])l($|[-_0-9])/.test(lower) || lower.includes("left")) return "L";
  if (/(^|[-_])r($|[-_0-9])/.test(lower) || lower.includes("right")) return "R";
  return null;
}

// 按非字母数字字符把图层名切成 token 数组。
// 这样 "handwear-l" → ["handwear", "l"]，"front_hair" → ["front", "hair"]，
// 后续 keyword 匹配以 token 为单位，避免 "ear" 用 includes 子串误中 "handwear" 的尾巴。
function tokenize(lower: string): string[] {
  return lower.split(/[^a-z0-9]+/).filter(Boolean);
}

// 单个 token 是否命中 keyword：
//   1) 完全相等（最精确）；
//   2) token 以 keyword 开头（如 "objects" 命中 "object"、"earring" 命中 "ear"）。
// 不允许 keyword 出现在 token 中间或末尾，杜绝 "handwear" 命中 "ear"、"legwear" 命中 "leg" 之外的误匹配。
function tokenMatches(token: string, keyword: string): boolean {
  return token === keyword || token.startsWith(keyword);
}

function hasTokenPair(tokens: string[], first: string, second: string): boolean {
  return tokens.some((token, index) => tokenMatches(token, first) && Boolean(tokens[index + 1]) && tokenMatches(tokens[index + 1], second));
}

function keywordMatches(tokens: string[], keyword: string): boolean {
  const tokenHit = tokens.some((t) => tokenMatches(t, keyword));
  if (keyword === "backhair") return tokenHit || hasTokenPair(tokens, "back", "hair");
  if (keyword === "hairback") return tokenHit || hasTokenPair(tokens, "hair", "back");
  if (keyword === "fronthair") return tokenHit || hasTokenPair(tokens, "front", "hair");
  if (keyword === "hairfront") return tokenHit || hasTokenPair(tokens, "hair", "front");
  return tokenHit;
}

function withSide(base: string, side: "L" | "R" | null): string {
  return `${base}${side ?? "L"}`;
}

function unique(names: string[]): string[] {
  return Array.from(new Set(names));
}

/**
 * 把单个 PSD 图层名映射到 humanoid 骨骼名。
 * @param layerName 原始图层名（如 "handwear-l" / "front_hair" / "topwear"）
 */
export function mapPsdLayerToBone(layerName: string): PsdBoneMatch {
  const lower = layerName.toLowerCase();
  const side = detectSide(lower);
  const tokens = tokenize(lower);
  for (const rule of RULES) {
    const hit = rule.keywords.find((k) => keywordMatches(tokens, k));
    if (!hit) continue;
    if (rule.sided && !side && rule.unsidedBoneNames?.length) {
      return { boneName: rule.unsidedBoneNames[0], boneNames: rule.unsidedBoneNames, keyword: hit };
    }
    const fallback = rule.sided && rule.fallbackSided !== false ? withSide(rule.bone, side) : rule.bone;
    const preferred = rule.detailedBone
      ? rule.sided
        ? withSide(rule.detailedBone, side)
        : rule.detailedBone
      : fallback;
    const boneNames = unique([preferred, fallback]);
    return { boneName: boneNames[0], boneNames, keyword: hit };
  }
  return { boneName: null, boneNames: [], keyword: null };
}
