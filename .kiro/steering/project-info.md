---
inclusion: fileMatch
fileMatchPattern: ['src/**/*.cs']
---

<!-- 本文件由编辑器自动生成，请勿手动编辑。保存玩家队伍配置或场景时会自动更新。 -->

# 项目配置速查

## 玩家与队伍配置

**阵营规则**: 不同队伍之间互为敌对，同队伍之间互为同盟。中立玩家 (`IsNeutral=true`) 的单位不会自动攻击任何人。

| 队伍 | 玩家 | 控制方式 | 备注 |
|------|------|---------|------|
| 队伍 0 | 玩家 0 (中立) | 电脑 | 中立，不会自动攻击 |
| 队伍 1 | 玩家 1 (玩家 1) | 用户 |  |
|  | 玩家 2 (玩家 2) | 电脑 |  |
| 队伍 2 | 玩家 3 (玩家 3) | 电脑 |  |
|  | 玩家 4 (玩家 4) | 电脑 |  |

### AI 编程提示

- 为 队伍 1 创建单位 → 分配给 玩家 1（真人控制）
- 为 队伍 1 创建 AI 单位 → 分配给 玩家 2（电脑控制）
- 为 队伍 2 创建 AI 单位 → 分配给 玩家 3、玩家 4（电脑控制）
- 创建中立单位（不主动攻击） → 分配给 玩家 0
- 敌对关系：队伍 1 vs 队伍 2（不同队伍互为敌对）

### 修改参考

- **用户操作**: 在编辑器中打开「队伍与玩家配置」窗口修改，保存后本文件自动更新
- **AI 直接修改**: 编辑 `editor/data/GameEntry/ScopeData/GameDataPlayerSettings/PlayerSettings.json` 中的 `PlayerTeamData` 数组
  - 每个数组元素是一个队伍，包含 `DisplayName` 和 `Players` 数组
  - 每个玩家有 `Id`(int)、`Controller`(`"User"`/`"Computer"`)、`IsNeutral`(bool)、`DisplayName` 等字段
  - 修改 JSON 后需在编辑器中重新生成代码才能生效（`src/DataGenerated/` 下的 C# 文件由编辑器自动生成，请勿手动编辑）

## 场景信息

| 场景名称 | HostedSceneTag | 尺寸 (宽×高) | 场景路径 |
|---------|----------------|-------------|---------|
| 默认场景 | `new_scene` | 4096×4096 | `scene/new_scene/` |

### AI 编程提示

- 使用 `ScopeData.GameDataScene.{HostedSceneTag}` 引用场景数据
- 当前项目仅有一个场景 `new_scene`（4096×4096），坐标范围约 (0,0) 到 (4096,4096)

### 修改参考

- **用户操作**: 地形场景素材只能通过编辑器的「地形编辑器」创建和编辑（放置装饰物、单位、区域等）
- **AI 使用已有场景**: 通过 `Scene.GetOrCreate(ScopeData.GameDataScene.{tag})` 获取场景实例，再调用 `scene.Load()` 加载
- **AI 构造逻辑场景**: 可复用已有地形资产创建独立的逻辑场景实例，无需新建地形文件：
  ```csharp
  // 用双参数 HostedSceneTag 复用已有地形资产，创建独立逻辑场景
  var sceneData = new GameDataScene(mySceneLink)
  {
      HostedSceneTag = new HostedSceneTag("my_logic_scene"u8, "new_scene"u8),
      Size = new Vector2(4096, 4096),
  };
  var scene = Scene.GetOrCreate(mySceneLink);
  scene.Load();
  ```
  逻辑场景的 `Scene.IsLogicScene` 为 `true`，共享地形渲染但有独立的实体空间
- **场景 JSON 数据**: 位于 `editor/data/GameEntry/ScopeData/GameDataScene/` 目录
- `src/DataGenerated/` 下的场景 C# 文件由编辑器自动生成，请勿手动编辑

