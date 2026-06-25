// 模板姿态分类：被 actionTemplates、poseProjection、StageAction 共同使用。
// 单独成文件，避免 actionTemplates ↔ poseProjection 循环依赖。
//
// "side"：模板按侧面观写（thigh/forearm 绕 Z 反相摆动）。在 front/back 姿态下应做投影。
// "front"：模板按正面观写（抬腿/上下 bob，无侧向摆动）。
// "any"：与姿态无关（idle/hurt/attack 这种位移夸张但不依赖朝向）。
export type TemplatePosePreset = "side" | "front" | "any";

export const TEMPLATE_PRESET_POSE: Record<string, TemplatePosePreset> = {
  walk: "side",
  attack: "side",
  hurt: "any",
  idle: "any",
  walkFront: "front",
  idleFront: "front",
  runFront: "front",
  idleBack: "back",
  walkBack: "back",
  runBack: "back",
  idleSide: "side",
  walkSide: "side",
  runSide: "side",
  castSide: "side",
};
