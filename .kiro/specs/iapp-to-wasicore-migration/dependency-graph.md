# 依赖关系图（Manager 层）

## 统计
- 管理器数量: 20
- 依赖边数量: 7
- 循环依赖组数量: 0

## Mermaid
```mermaid
graph TD
  AlchemyManager --> BagManager
  AlchemyManager --> RoleDataManager
  BattleManager --> BattleReportManager
  BattleManager --> RoleDataManager
  FormationManager --> BagManager
  FormationManager --> RoleDataManager
  TribulationManager --> RoleDataManager
```

## 循环依赖检测
- 未检测到循环依赖。

