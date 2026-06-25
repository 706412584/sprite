"""动画动作预设系统。

参考 perfectpixel-studio 的动作模板设计，提供 100+ 动作预设，
支持 8方向系统（5方向生成 + 3方向镜像）。
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Optional


class Direction(Enum):
    """8方向枚举。"""
    DOWN = "down"           # 下（正面）
    DOWN_LEFT = "down_left" # 左下
    LEFT = "left"           # 左
    UP_LEFT = "up_left"     # 左上
    UP = "up"               # 上（背面）
    UP_RIGHT = "up_right"   # 右上
    RIGHT = "right"         # 右
    DOWN_RIGHT = "down_right" # 右下

    @property
    def mirror_of(self) -> Optional['Direction']:
        """返回镜像方向（如果需要镜像生成）。"""
        mirrors = {
            Direction.DOWN_LEFT: Direction.DOWN_RIGHT,
            Direction.LEFT: Direction.RIGHT,
            Direction.UP_LEFT: Direction.UP_RIGHT,
        }
        return mirrors.get(self)

    @classmethod
    def primary_directions(cls) -> list['Direction']:
        """返回需要AI生成的主要方向（5个）。"""
        return [cls.DOWN, cls.DOWN_LEFT, cls.LEFT, cls.UP_LEFT, cls.UP]

    @classmethod
    def mirrored_directions(cls) -> list['Direction']:
        """返回通过镜像生成的方向（3个）。"""
        return [cls.DOWN_RIGHT, cls.RIGHT, cls.UP_RIGHT]


class ActionCategory(Enum):
    """动作类别。"""
    LOCOMOTION = "locomotion"   # 移动
    COMBAT = "combat"           # 战斗
    EMOTION = "emotion"         # 情感/社交
    STATUS = "status"           # 状态效果
    INTERACTION = "interaction" # 交互
    SPECIAL = "special"         # 特殊动作


@dataclass
class ActionPreset:
    """动作预设定义。"""
    id: str
    name: str
    name_zh: str
    category: ActionCategory
    prompt: str
    frame_count: int  # 建议帧数
    fps: int = 12     # 建议帧率
    loop: bool = True # 是否循环
    directions: int = 8  # 支持的方向数
    tags: list[str] = None

    def __post_init__(self):
        if self.tags is None:
            self.tags = []


# ============================================================================
# 动作预设库
# ============================================================================

PRESETS: list[ActionPreset] = [
    # -----------------------------------------------------------------------
    # 移动类 (Locomotion)
    # -----------------------------------------------------------------------
    ActionPreset(
        id="idle",
        name="Idle",
        name_zh="待机",
        category=ActionCategory.LOCOMOTION,
        prompt="standing still, breathing animation, subtle movement",
        frame_count=4,
        fps=8,
        loop=True,
        tags=["basic", "essential"],
    ),
    ActionPreset(
        id="walk",
        name="Walk",
        name_zh="行走",
        category=ActionCategory.LOCOMOTION,
        prompt="walking, natural stride, arm swing",
        frame_count=8,
        fps=12,
        loop=True,
        tags=["basic", "essential"],
    ),
    ActionPreset(
        id="run",
        name="Run",
        name_zh="奔跑",
        category=ActionCategory.LOCOMOTION,
        prompt="running fast, dynamic pose, arms pumping",
        frame_count=8,
        fps=15,
        loop=True,
        tags=["basic", "essential"],
    ),
    ActionPreset(
        id="sprint",
        name="Sprint",
        name_zh="冲刺",
        category=ActionCategory.LOCOMOTION,
        prompt="sprinting at full speed, leaning forward, intense motion",
        frame_count=6,
        fps=18,
        loop=True,
        tags=["fast"],
    ),
    ActionPreset(
        id="jump",
        name="Jump",
        name_zh="跳跃",
        category=ActionCategory.LOCOMOTION,
        prompt="jumping up, arms raised, legs bent",
        frame_count=6,
        fps=12,
        loop=False,
        tags=["basic", "vertical"],
    ),
    ActionPreset(
        id="fall",
        name="Fall",
        name_zh="下落",
        category=ActionCategory.LOCOMOTION,
        prompt="falling down, arms spread, hair flowing up",
        frame_count=4,
        fps=10,
        loop=True,
        tags=["vertical"],
    ),
    ActionPreset(
        id="land",
        name="Land",
        name_zh="落地",
        category=ActionCategory.LOCOMOTION,
        prompt="landing from jump, knees bent, impact pose",
        frame_count=4,
        fps=12,
        loop=False,
        tags=["vertical"],
    ),
    ActionPreset(
        id="dash",
        name="Dash",
        name_zh="冲刺闪避",
        category=ActionCategory.LOCOMOTION,
        prompt="dashing forward quickly, motion blur, dynamic pose",
        frame_count=4,
        fps=15,
        loop=False,
        tags=["fast", "evasion"],
    ),
    ActionPreset(
        id="dodge",
        name="Dodge",
        name_zh="闪避",
        category=ActionCategory.LOCOMOTION,
        prompt="dodging to the side, evasive movement",
        frame_count=4,
        fps=12,
        loop=False,
        tags=["evasion"],
    ),
    ActionPreset(
        id="roll",
        name="Roll",
        name_zh="翻滚",
        category=ActionCategory.LOCOMOTION,
        prompt="rolling on the ground, somersault motion",
        frame_count=8,
        fps=15,
        loop=False,
        tags=["evasion"],
    ),
    ActionPreset(
        id="climb",
        name="Climb",
        name_zh="攀爬",
        category=ActionCategory.LOCOMOTION,
        prompt="climbing, reaching up, pulling body upward",
        frame_count=8,
        fps=10,
        loop=True,
        tags=["vertical"],
    ),
    ActionPreset(
        id="swim",
        name="Swim",
        name_zh="游泳",
        category=ActionCategory.LOCOMOTION,
        prompt="swimming, arm strokes, treading water",
        frame_count=8,
        fps=10,
        loop=True,
        tags=["water"],
    ),
    ActionPreset(
        id="crawl",
        name="Crawl",
        name_zh="爬行",
        category=ActionCategory.LOCOMOTION,
        prompt="crawling on hands and knees, low to ground",
        frame_count=8,
        fps=10,
        loop=True,
        tags=["low"],
    ),
    ActionPreset(
        id="sneak",
        name="Sneak",
        name_zh="潜行",
        category=ActionCategory.LOCOMOTION,
        prompt="sneaking quietly, crouched walk, careful steps",
        frame_count=8,
        fps=8,
        loop=True,
        tags=["stealth", "low"],
    ),

    # -----------------------------------------------------------------------
    # 战斗类 (Combat)
    # -----------------------------------------------------------------------
    ActionPreset(
        id="attack_slash",
        name="Slash Attack",
        name_zh="斩击",
        category=ActionCategory.COMBAT,
        prompt="slashing with sword, horizontal swing, follow through",
        frame_count=6,
        fps=15,
        loop=False,
        tags=["melee", "weapon"],
    ),
    ActionPreset(
        id="attack_thrust",
        name="Thrust Attack",
        name_zh="刺击",
        category=ActionCategory.COMBAT,
        prompt="thrusting forward with weapon, lunging stab",
        frame_count=4,
        fps=15,
        loop=False,
        tags=["melee", "weapon"],
    ),
    ActionPreset(
        id="attack_chop",
        name="Chop Attack",
        name_zh="劈砍",
        category=ActionCategory.COMBAT,
        prompt="chopping downward with axe, overhead strike",
        frame_count=6,
        fps=15,
        loop=False,
        tags=["melee", "weapon", "heavy"],
    ),
    ActionPreset(
        id="attack_stab",
        name="Stab Attack",
        name_zh="突刺",
        category=ActionCategory.COMBAT,
        prompt="stabbing motion, quick jab",
        frame_count=4,
        fps=18,
        loop=False,
        tags=["melee", "weapon", "fast"],
    ),
    ActionPreset(
        id="attack_combo",
        name="Combo Attack",
        name_zh="连击",
        category=ActionCategory.COMBAT,
        prompt="combo attack sequence, multiple strikes in succession",
        frame_count=12,
        fps=18,
        loop=False,
        tags=["melee", "combo"],
    ),
    ActionPreset(
        id="shoot_bow",
        name="Shoot Bow",
        name_zh="射箭",
        category=ActionCategory.COMBAT,
        prompt="drawing bow and shooting arrow, archer pose",
        frame_count=8,
        fps=12,
        loop=False,
        tags=["ranged", "weapon"],
    ),
    ActionPreset(
        id="cast_spell",
        name="Cast Spell",
        name_zh="施法",
        category=ActionCategory.COMBAT,
        prompt="casting magic spell, hands glowing, mystical energy",
        frame_count=8,
        fps=12,
        loop=False,
        tags=["magic", "ranged"],
    ),
    ActionPreset(
        id="cast_fire",
        name="Cast Fire",
        name_zh="火系魔法",
        category=ActionCategory.COMBAT,
        prompt="casting fire spell, flames erupting from hands",
        frame_count=8,
        fps=12,
        loop=False,
        tags=["magic", "fire"],
    ),
    ActionPreset(
        id="cast_ice",
        name="Cast Ice",
        name_zh="冰系魔法",
        category=ActionCategory.COMBAT,
        prompt="casting ice spell, frost crystals forming",
        frame_count=8,
        fps=12,
        loop=False,
        tags=["magic", "ice"],
    ),
    ActionPreset(
        id="cast_lightning",
        name="Cast Lightning",
        name_zh="雷系魔法",
        category=ActionCategory.COMBAT,
        prompt="casting lightning spell, electric bolts",
        frame_count=6,
        fps=15,
        loop=False,
        tags=["magic", "lightning"],
    ),
    ActionPreset(
        id="block",
        name="Block",
        name_zh="格挡",
        category=ActionCategory.COMBAT,
        prompt="blocking with shield, defensive stance",
        frame_count=4,
        fps=10,
        loop=True,
        tags=["defense"],
    ),
    ActionPreset(
        id="parry",
        name="Parry",
        name_zh="招架",
        category=ActionCategory.COMBAT,
        prompt="parrying attack, deflecting with weapon",
        frame_count=4,
        fps=15,
        loop=False,
        tags=["defense", "counter"],
    ),
    ActionPreset(
        id="dodge_combat",
        name="Combat Dodge",
        name_zh="战斗闪避",
        category=ActionCategory.COMBAT,
        prompt="dodging attack in combat, quick sidestep",
        frame_count=4,
        fps=15,
        loop=False,
        tags=["evasion"],
    ),
    ActionPreset(
        id="hit",
        name="Hit",
        name_zh="受击",
        category=ActionCategory.COMBAT,
        prompt="being hit, recoiling from impact, damage reaction",
        frame_count=4,
        fps=12,
        loop=False,
        tags=["damage"],
    ),
    ActionPreset(
        id="knockback",
        name="Knockback",
        name_zh="击退",
        category=ActionCategory.COMBAT,
        prompt="knocked back by force, stumbling backward",
        frame_count=6,
        fps=12,
        loop=False,
        tags=["damage"],
    ),
    ActionPreset(
        id="death",
        name="Death",
        name_zh="死亡",
        category=ActionCategory.COMBAT,
        prompt="dying, collapsing to ground, final breath",
        frame_count=8,
        fps=10,
        loop=False,
        tags=["death"],
    ),
    ActionPreset(
        id="victory",
        name="Victory",
        name_zh="胜利",
        category=ActionCategory.COMBAT,
        prompt="victory pose, celebrating win, triumphant stance",
        frame_count=8,
        fps=10,
        loop=False,
        tags=["celebration"],
    ),
    ActionPreset(
        id="defeat",
        name="Defeat",
        name_zh="战败",
        category=ActionCategory.COMBAT,
        prompt="defeated, lying on ground, exhausted",
        frame_count=6,
        fps=8,
        loop=False,
        tags=["death"],
    ),

    # -----------------------------------------------------------------------
    # 情感/社交类 (Emotion)
    # -----------------------------------------------------------------------
    ActionPreset(
        id="cheer",
        name="Cheer",
        name_zh="欢呼",
        category=ActionCategory.EMOTION,
        prompt="cheering happily, arms raised, excited expression",
        frame_count=8,
        fps=10,
        loop=False,
        tags=["happy"],
    ),
    ActionPreset(
        id="wave",
        name="Wave",
        name_zh="挥手",
        category=ActionCategory.EMOTION,
        prompt="waving hand, friendly greeting gesture",
        frame_count=6,
        fps=8,
        loop=False,
        tags=["greeting"],
    ),
    ActionPreset(
        id="bow",
        name="Bow",
        name_zh="鞠躬",
        category=ActionCategory.EMOTION,
        prompt="bowing respectfully, formal greeting",
        frame_count=6,
        fps=8,
        loop=False,
        tags=["greeting", "formal"],
    ),
    ActionPreset(
        id="dance",
        name="Dance",
        name_zh="跳舞",
        category=ActionCategory.EMOTION,
        prompt="dancing joyfully, rhythmic movement, happy expression",
        frame_count=12,
        fps=12,
        loop=True,
        tags=["happy", "celebration"],
    ),
    ActionPreset(
        id="laugh",
        name="Laugh",
        name_zh="大笑",
        category=ActionCategory.EMOTION,
        prompt="laughing heartily, shoulders shaking, joyful expression",
        frame_count=6,
        fps=10,
        loop=False,
        tags=["happy"],
    ),
    ActionPreset(
        id="cry",
        name="Cry",
        name_zh="哭泣",
        category=ActionCategory.EMOTION,
        prompt="crying, tears flowing, sad expression",
        frame_count=6,
        fps=8,
        loop=False,
        tags=["sad"],
    ),
    ActionPreset(
        id="angry",
        name="Angry",
        name_zh="愤怒",
        category=ActionCategory.EMOTION,
        prompt="angry expression, clenched fists, fierce stance",
        frame_count=4,
        fps=10,
        loop=True,
        tags=["angry"],
    ),
    ActionPreset(
        id="surprise",
        name="Surprise",
        name_zh="惊讶",
        category=ActionCategory.EMOTION,
        prompt="surprised reaction, shocked expression, stepping back",
        frame_count=4,
        fps=12,
        loop=False,
        tags=["reaction"],
    ),
    ActionPreset(
        id="taunt",
        name="Taunt",
        name_zh="嘲讽",
        category=ActionCategory.EMOTION,
        prompt="taunting gesture, provocative pose, smug expression",
        frame_count=6,
        fps=10,
        loop=False,
        tags=["provocative"],
    ),
    ActionPreset(
        id="sit",
        name="Sit",
        name_zh="坐下",
        category=ActionCategory.EMOTION,
        prompt="sitting down, relaxed posture",
        frame_count=4,
        fps=8,
        loop=True,
        tags=["rest"],
    ),
    ActionPreset(
        id="sleep",
        name="Sleep",
        name_zh="睡觉",
        category=ActionCategory.EMOTION,
        prompt="sleeping, lying down, peaceful breathing",
        frame_count=4,
        fps=4,
        loop=True,
        tags=["rest"],
    ),
    ActionPreset(
        id="eat",
        name="Eat",
        name_zh="进食",
        category=ActionCategory.EMOTION,
        prompt="eating food, chewing motion, satisfied expression",
        frame_count=6,
        fps=8,
        loop=False,
        tags=["consumption"],
    ),
    ActionPreset(
        id="drink",
        name="Drink",
        name_zh="饮水",
        category=ActionCategory.EMOTION,
        prompt="drinking from cup, tilting head back",
        frame_count=6,
        fps=8,
        loop=False,
        tags=["consumption"],
    ),

    # -----------------------------------------------------------------------
    # 状态效果类 (Status)
    # -----------------------------------------------------------------------
    ActionPreset(
        id="power_up",
        name="Power Up",
        name_zh="强化",
        category=ActionCategory.STATUS,
        prompt="powering up, energy aura, glowing effects, becoming stronger",
        frame_count=8,
        fps=12,
        loop=False,
        tags=["buff"],
    ),
    ActionPreset(
        id="shield",
        name="Shield",
        name_zh="护盾",
        category=ActionCategory.STATUS,
        prompt="shield activated, protective barrier around character",
        frame_count=6,
        fps=10,
        loop=True,
        tags=["buff", "defense"],
    ),
    ActionPreset(
        id="heal",
        name="Heal",
        name_zh="治疗",
        category=ActionCategory.STATUS,
        prompt="healing glow, green energy restoring health",
        frame_count=8,
        fps=10,
        loop=False,
        tags=["buff", "recovery"],
    ),
    ActionPreset(
        id="poison",
        name="Poison",
        name_zh="中毒",
        category=ActionCategory.STATUS,
        prompt="poisoned, green bubbles, sick expression, stumbling",
        frame_count=6,
        fps=8,
        loop=True,
        tags=["debuff"],
    ),
    ActionPreset(
        id="burn",
        name="Burn",
        name_zh="灼烧",
        category=ActionCategory.STATUS,
        prompt="burning, fire damage, flames on character",
        frame_count=6,
        fps=10,
        loop=True,
        tags=["debuff", "fire"],
    ),
    ActionPreset(
        id="freeze",
        name="Freeze",
        name_zh="冰冻",
        category=ActionCategory.STATUS,
        prompt="frozen, ice crystals, stiff posture, shivering",
        frame_count=4,
        fps=6,
        loop=True,
        tags=["debuff", "ice"],
    ),
    ActionPreset(
        id="stun",
        name="Stun",
        name_zh="眩晕",
        category=ActionCategory.STATUS,
        prompt="stunned, dizzy, stars circling head, swaying",
        frame_count=6,
        fps=8,
        loop=True,
        tags=["debuff"],
    ),
    ActionPreset(
        id="low_hp",
        name="Low HP",
        name_zh="低血量",
        category=ActionCategory.STATUS,
        prompt="low health, weakened, hunched over, heavy breathing",
        frame_count=4,
        fps=6,
        loop=True,
        tags=["damage"],
    ),
    ActionPreset(
        id="invisible",
        name="Invisible",
        name_zh="隐身",
        category=ActionCategory.STATUS,
        prompt="becoming invisible, fading transparency, disappearing",
        frame_count=6,
        fps=10,
        loop=False,
        tags=["stealth"],
    ),

    # -----------------------------------------------------------------------
    # 交互类 (Interaction)
    # -----------------------------------------------------------------------
    ActionPreset(
        id="pick_up",
        name="Pick Up",
        name_zh="拾取",
        category=ActionCategory.INTERACTION,
        prompt="picking up item from ground, bending down to grab",
        frame_count=6,
        fps=10,
        loop=False,
        tags=["item"],
    ),
    ActionPreset(
        id="throw",
        name="Throw",
        name_zh="投掷",
        category=ActionCategory.INTERACTION,
        prompt="throwing object, overhand motion, release",
        frame_count=6,
        fps=12,
        loop=False,
        tags=["item", "ranged"],
    ),
    ActionPreset(
        id="catch",
        name="Catch",
        name_zh="接住",
        category=ActionCategory.INTERACTION,
        prompt="catching object, hands reaching out, grabbing motion",
        frame_count=4,
        fps=12,
        loop=False,
        tags=["item"],
    ),
    ActionPreset(
        id="push",
        name="Push",
        name_zh="推动",
        category=ActionCategory.INTERACTION,
        prompt="pushing object forward, leaning into it, forceful motion",
        frame_count=6,
        fps=10,
        loop=False,
        tags=["object"],
    ),
    ActionPreset(
        id="pull",
        name="Pull",
        name_zh="拉动",
        category=ActionCategory.INTERACTION,
        prompt="pulling object, leaning back, tugging motion",
        frame_count=6,
        fps=10,
        loop=False,
        tags=["object"],
    ),
    ActionPreset(
        id="open_door",
        name="Open Door",
        name_zh="开门",
        category=ActionCategory.INTERACTION,
        prompt="opening door, reaching for handle, pushing door open",
        frame_count=6,
        fps=10,
        loop=False,
        tags=["environment"],
    ),
    ActionPreset(
        id="mine",
        name="Mine",
        name_zh="挖掘",
        category=ActionCategory.INTERACTION,
        prompt="mining with pickaxe, swinging at rock, breaking motion",
        frame_count=8,
        fps=12,
        loop=True,
        tags=["gather", "tool"],
    ),
    ActionPreset(
        id="fish",
        name="Fish",
        name_zh="钓鱼",
        category=ActionCategory.INTERACTION,
        prompt="fishing, casting line, waiting, reeling in",
        frame_count=8,
        fps=8,
        loop=False,
        tags=["gather"],
    ),
    ActionPreset(
        id="craft",
        name="Craft",
        name_zh="制作",
        category=ActionCategory.INTERACTION,
        prompt="crafting item, working at table, hammering motion",
        frame_count=8,
        fps=10,
        loop=True,
        tags=["create"],
    ),

    # -----------------------------------------------------------------------
    # 特殊动作类 (Special)
    # -----------------------------------------------------------------------
    ActionPreset(
        id="transform",
        name="Transform",
        name_zh="变身",
        category=ActionCategory.SPECIAL,
        prompt="transforming, body changing shape, energy swirling",
        frame_count=12,
        fps=12,
        loop=False,
        tags=["evolution"],
    ),
    ActionPreset(
        id="summon",
        name="Summon",
        name_zh="召唤",
        category=ActionCategory.SPECIAL,
        prompt="summoning creature, magic circle appearing, calling forth",
        frame_count=10,
        fps=12,
        loop=False,
        tags=["magic"],
    ),
    ActionPreset(
        id="teleport",
        name="Teleport",
        name_zh="传送",
        category=ActionCategory.SPECIAL,
        prompt="teleporting, dissolving into particles, reappearing",
        frame_count=8,
        fps=15,
        loop=False,
        tags=["magic", "movement"],
    ),
    ActionPreset(
        id="dissolve",
        name="Dissolve",
        name_zh="消散",
        category=ActionCategory.SPECIAL,
        prompt="dissolving into particles, fading away, breaking apart",
        frame_count=8,
        fps=10,
        loop=False,
        tags=["death", "magic"],
    ),
    ActionPreset(
        id="spawn",
        name="Spawn",
        name_zh="生成",
        category=ActionCategory.SPECIAL,
        prompt="spawning in, materializing from particles, appearing",
        frame_count=8,
        fps=10,
        loop=False,
        tags=["birth"],
    ),
    ActionPreset(
        id="portal",
        name="Portal",
        name_zh="传送门",
        category=ActionCategory.SPECIAL,
        prompt="entering portal, stepping through dimensional gate",
        frame_count=8,
        fps=10,
        loop=False,
        tags=["magic", "movement"],
    ),
]


def get_preset(preset_id: str) -> ActionPreset | None:
    """获取指定ID的动作预设。"""
    for preset in PRESETS:
        if preset.id == preset_id:
            return preset
    return None


def get_presets_by_category(category: ActionCategory) -> list[ActionPreset]:
    """获取指定类别的所有预设。"""
    return [p for p in PRESETS if p.category == category]


def get_presets_by_tag(tag: str) -> list[ActionPreset]:
    """获取带有指定标签的所有预设。"""
    return [p for p in PRESETS if tag in p.tags]


def search_presets(query: str) -> list[ActionPreset]:
    """搜索预设（按名称、ID、标签）。"""
    query = query.lower()
    results = []
    for preset in PRESETS:
        if (query in preset.id.lower() or
            query in preset.name.lower() or
            query in preset.name_zh or
            any(query in tag for tag in preset.tags)):
            results.append(preset)
    return results


def get_all_presets() -> list[ActionPreset]:
    """获取所有预设。"""
    return PRESETS.copy()


def get_preset_count() -> int:
    """获取预设总数。"""
    return len(PRESETS)


# ============================================================================
# 方向系统
# ============================================================================

DIRECTION_ANGLES = {
    Direction.DOWN: 0,
    Direction.DOWN_RIGHT: 45,
    Direction.RIGHT: 90,
    Direction.UP_RIGHT: 135,
    Direction.UP: 180,
    Direction.UP_LEFT: 225,
    Direction.LEFT: 270,
    Direction.DOWN_LEFT: 315,
}


def get_direction_angle(direction: Direction) -> int:
    """获取方向角度。"""
    return DIRECTION_ANGLES.get(direction, 0)


def get_primary_directions() -> list[Direction]:
    """获取需要AI生成的主要方向。"""
    return Direction.primary_directions()


def get_mirrored_directions() -> list[Direction]:
    """获取通过镜像生成的方向。"""
    return Direction.mirrored_directions()


def get_mirror_source(direction: Direction) -> Direction | None:
    """获取镜像源方向。"""
    return direction.mirror_of


# ============================================================================
# 导出公共接口
# ============================================================================

__all__ = [
    "Direction",
    "ActionCategory",
    "ActionPreset",
    "PRESETS",
    "get_preset",
    "get_presets_by_category",
    "get_presets_by_tag",
    "search_presets",
    "get_all_presets",
    "get_preset_count",
    "get_direction_angle",
    "get_primary_directions",
    "get_mirrored_directions",
    "get_mirror_source",
]
