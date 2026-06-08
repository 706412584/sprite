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
}

// 顺序敏感：靠前的规则优先命中（headwear 要在 wear 之前，避免被 topwear/legwear 抢）。
const RULES: MappingRule[] = [
  // 头部簇：头发、头饰、脸、五官、耳朵都跟 head 骨
  { keywords: ["hair", "headwear", "head", "hat", "helmet", "face", "mouth", "nose", "eye", "ear", "brow", "lash", "iris", "irid", "pupil", "horn"], bone: "head", sided: false },
  // 手部 / 前臂簇：手套、手、武器、持物跟前臂
  { keywords: ["handwear", "hand", "glove", "weapon", "wrist", "forearm"], bone: "forearm", sided: true },
  // 大臂 / 肩簇
  { keywords: ["upperarm", "shoulder", "sleeve", "arm"], bone: "upperArm", sided: true },
  // 腿 / 鞋簇：legwear、靴、脚跟小腿
  { keywords: ["legwear", "shoe", "boot", "foot", "feet", "shin", "calf"], bone: "shin", sided: true },
  // 大腿簇
  { keywords: ["thigh", "leg"], bone: "thigh", sided: true },
  // 躯干簇：上衣、下装、裙、披风、腰带、身体，外加 object/prop/item/misc 这类无明确部位语义的杂项
  // （最后兜底，避免抢走更具体的部位）。杂项默认归躯干，保证全部图层都有骨可绑，用户可手动改。
  { keywords: ["topwear", "bottomwear", "torso", "body", "chest", "coat", "cloak", "cape", "robe", "dress", "skirt", "belt", "waist", "wear", "object", "prop", "item", "accessory", "misc", "extra", "other"], bone: "torso", sided: false },
];

export interface PsdBoneMatch {
  /** 目标骨骼 name（已拼好左右，如 forearmL）；未命中为 null。 */
  boneName: string | null;
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

/**
 * 把单个 PSD 图层名映射到 humanoid 骨骼名。
 * @param layerName 原始图层名（如 "handwear-l" / "front_hair" / "topwear"）
 */
export function mapPsdLayerToBone(layerName: string): PsdBoneMatch {
  const lower = layerName.toLowerCase();
  const side = detectSide(lower);
  const tokens = tokenize(lower);
  for (const rule of RULES) {
    const hit = rule.keywords.find((k) => tokens.some((t) => tokenMatches(t, k)));
    if (!hit) continue;
    if (rule.sided) {
      // 分左右的骨：缺左右信息时默认归到左侧（保证有骨可绑，用户可手动改）。
      const suffix = side ?? "L";
      return { boneName: `${rule.bone}${suffix}`, keyword: hit };
    }
    return { boneName: rule.bone, keyword: hit };
  }
  return { boneName: null, keyword: null };
}
