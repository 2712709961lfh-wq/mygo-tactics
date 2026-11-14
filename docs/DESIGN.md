# 设计文档

第一关重制新增 `src/garden-map.js`，渲染器仅在第一关调用专用地图画笔；两章规则继续共用 `Game`、寻路和战斗模块。地图布局、素材来源、AI 绕桥和存档地图版本说明见 [MAP-REMAKE.md](MAP-REMAKE.md)。

本文记录 `MYGO!!!!! 迷途庭院` 的结构、回合状态机、核心算法与后续扩展方式。

---

## 1. 总体设计

### 1.1 技术选型

| 选择 | 原因 |
| --- | --- |
| 原生 HTML / CSS / JavaScript | 零依赖、零构建，双击即可运行 |
| Canvas 2D | 像素图、网格高亮、动画和粒子都在一个绘制循环内完成 |
| 经典 `<script>` + `window.MyGO` | 避开 `file://` 下 ES Module 的 CORS 限制 |
| 数据与逻辑分离 | `config.js` 只放数值，逻辑模块不写死角色 |
| DOM 负责 UI / Canvas 负责战场 | 弹窗、按钮、信息面板用 HTML 更容易做响应式和可访问性 |

世界逻辑分辨率现在是 `24 × 32 = 768` × `16 × 32 = 512` 像素；渲染时使用 `RENDER_SCALE = 2` 的 1536 × 1024 背板。视口通过 CSS 缩放到 1×–2.2×，因此地图可以比屏幕大，同时保留像素边缘。

### 1.2 模块边界

```text
config.js       纯数据（地图、单位、武器、文案、常量）
rng.js          可复现随机数
grid.js         坐标、地形、占位查询
pathfinding.js  移动范围 / 路径 / 攻击范围
combat.js       纯函数战斗公式
game.js         对局事实（谁在哪里、多少 HP、轮到谁）
ai.js           读取 game，输出行动计划，不直接改状态
save.js         序列化快照到存储
assets.js       地形 / 敌方影子 / 程序化兜底绘制 + 素材覆盖接口
characters.js   五名角色图集加载、方向行走、头像、战斗姿态
renderer.js     2× 背板、地形缓存、氛围层；只读 game + view，负责画
battle.js       侧视战斗演出；只读单位外观 + 已锁定的结算结果
ui.js           输入、状态机、演出调度、DOM；唯一修改 game 的调度者
entry.js        标题页、存档抽屉、编队界面；读取 game/存档，不直接改战斗规则
main.js         启动
```

关键原则：

- `combat.js` 不修改任何单位，只返回预览和结算结果。
- `ai.js` 只做计划，由 `ui.js` 执行移动和攻击。
- `game.applyCombat()` 是唯一扣血入口。
- `renderer.js` 不参与规则判定。

### 1.3 标题页与编队

启动顺序：

```text
main.js
  → new MyGO.UI()
  → new MyGO.EntryScreen(ui)
  → entry.open({ force: true })
  → 玩家选择「开始游戏」/「存档」/「编队」
```

- 标题页覆盖在游戏之上，不销毁战场；返回标题后再次「开始游戏」会继续当前对局。
- 存档抽屉通过 `SaveManager` 读取快照，只用于展示与调用 `UI.loadSnapshot()`；实际读档仍走 `game.restore()` 的完整校验。
- 编队直接读取 `game.units` 中的当前单位（含 HP、存活状态、性别、职业、武器），因此战斗减员会显示为「撤退」。
- 头像用 `<canvas>` 调 `Characters.drawPortrait()` 绘制；战斗与地图共用同一套 80×96 图集，缺失时回退到 `Assets.drawUnit()`。
- 小屏幕下编队名册改为横向滚动卡片，详情面板独立滚动。

---

## 2. 回合状态机

### 2.1 对局阶段

`game.phase`：

```text
player → enemy → player → ...
   ↓        ↓
victory   defeat
```

- `beginEnemyPhase()`：阶段切到 `enemy`，不自动重置敌方 `acted`（每个敌人行动后单独标记）。
- `beginNextPlayerPhase()`：回合数 +1，阶段切回 `player`，重置全部我方 `acted`。
- `checkOutcome()`：任一方存活数为 0 时写入 `victory` / `defeat`。

### 2.2 UI 模式

`ui.mode`：

| 模式 | 含义 | 点击棋盘的行为 |
| --- | --- | --- |
| `idle` | 未选中单位 | 选中我方单位 / 查看敌人 / 查看地形 |
| `move` | 已选中单位，显示移动范围 | 移动到可停留格，或点原点原地行动 |
| `action` | 已移动，显示行动菜单 | 等待按钮操作 |
| `attack` | 选择攻击目标 | 点击攻击范围内的敌人 |
| `moving` | 移动动画中 | 锁定输入 |

`busy` 是比 `mode` 更粗的全局锁：特写、结算弹窗、敌方回合、存档确认期间都为 `true`。

### 2.3 玩家一次行动的完整链路

```text
点击我方单位
  → mode = move
  → getReachable() 得到可达格
  → 点击落点
  → mode = moving
  → renderer.animateMove()
  → game.setUnitPosition()
  → mode = action
  → 选择「攻击」
      → mode = attack
      → 显示攻击范围与目标
      → 点击目标
      → combat.preview()       （锁定数值）
      → combat.roll()          （锁定命中/暴击结果，并保留 hitChance/critChance）
      → battle.js 侧视演出
      → 结算弹窗
      → 玩家点击「确认结算」
      → game.applyCombat()
      → 扣血 / 死亡 / 胜负判定
      → unit.acted = true
      → mode = idle
  → 或选择「待机」：unit.acted = true
  → 或选择「撤回移动」：回到 origin，mode = move
```

> 注意：`roll()` 发生在侧视演出之前，所以打开面板后数值不会再变化；`hitChance` / `critChance` 保留百分比供面板显示，`hit` / `crit` 则是本次掷骰的布尔结果。`applyCombat()` 必须等玩家确认，保证“结算面板显示的 HP”和实际扣血时机一致。

#### 2.3.1 武器专属战斗动作

`battle.js` 的 `_drawWeaponFx()` 根据 `attacker.weapon.type` 分派动作，不再是所有武器共用一条大弧线：

| 武器 | 位移 | 攻击表现 |
| --- | --- | --- |
| `sword` | 冲到 `defX - 54` | 短直线剑光挥砍，带剑尖星芒 |
| `axe` | 冲到 `defX - 58` | 自上而下重劈，落点碎石 |
| `lance` | 冲到 `defX - 78` | 直线枪尖突刺与速度线 |
| `bow` | 原地 | 拉弓、箭矢飞行、命中星芒 |
| `tome` | 原地 | 蓄力魔法球 + 属性色飞行 + 属性色爆裂 |

魔法色由武器的 `element` 决定：`fire` 火红、`ice` 冰蓝、`wind` 翠绿、`thunder` 雷金、`dark` 暗紫、`light` 白金，缺省为 `arcane` 紫罗兰。演出时间轴以 `IMPACT_T = 0.58` 为命中点；近战在 `0.26 → 0.50` 完成冲刺，远程在 `0.46 → 0.58` 让箭矢/魔法球抵达目标。伤害数字、HP 预演和暴击特效仍只属于演出，真正扣血继续由结算弹窗确认。

### 2.4 敌方回合链路

```text
endTurn()
  → game.beginEnemyPhase()
  → 回合横幅
  → 遍历仍存活的敌人
      → AI.planAction()
      → 若需要移动：路径动画 + setUnitPosition
      → 若能攻击：performAttackSequence()
          → 特写
          → 结算弹窗（同样要求点击确认）
          → applyCombat()
      → enemy.acted = true
  → game.beginNextPlayerPhase()
  → mode = idle, busy = false
  → 回合横幅
```

任意时刻 `game.phase` 变为 `victory` / `defeat`，循环立即停止并显示结算界面。

### 2.5 庭院钥匙与大门的联动

- 地图南墙有两格 `gate`（字符 `G`），`TERRAIN.gate.blocked = true`，因此闭门时寻路会自动绕开。
- 外围的 `shadow_bow` 带有 `key: true`；庭院内的 `conductor` 与 `shadow_lance` 带有 `dormant: true`。
- 玩家击杀钥匙守卫后，`Game.applyCombat()` 检测 `defender.key`，调用 `openGate()`：
  - `gateOpen = true`；
  - 地图上的 `gate` 替换为 `gateOpen`；
  - 返回结果带 `gateOpened = true`，UI 播放提示与“门开了”浮字。
- 敌方阶段遍历单位时，`isUnitActive(enemy)` 为 false 的沉眠敌人会被跳过；`AI.planAction()` 也做同样防护。
- 大门状态写入存档快照；读档时先重建静态地图，再按 `gateOpen` 同步门格。
- 胜利条件仍是全部敌人被击破，因此开门后必须进入庭院击败首领。

---

## 3. 移动与寻路

### 3.1 坐标

- 左上角为 `(0, 0)`，`x` 向右，`y` 向下。
- 四方向邻接（上/下/左/右），不实现斜向移动。
- 距离使用曼哈顿距离：`|x1-x2| + |y1-y2|`。

### 3.2 Dijkstra

`pathfinding.js` 使用最小堆实现 Dijkstra，而不是简单 BFS，因为地形移动消耗不同：

```text
草地 1
森林 2
山地 2
墙   ∞
```

每个可达格记录：

```js
{ x, y, cost, prev, stoppable }
```

- `prev` 用于回溯路径。
- `cost > unit.move` 的格子不会被加入结果。
- 路径可以穿过友军，但 `stoppable=false`。
- 路径不能穿过敌军。
- 终点不能是任何存活单位所在格。

### 3.3 攻击范围

攻击范围不是在移动范围上直接叠加，而是：

```text
先从当前格（或候选落点）计算武器射程内、与角色曼哈顿距离符合 [rangeMin, rangeMax] 的格子
```

近战 `[1,1]`，远程 `[2,3]`。因此远程单位不能攻击贴脸 1 格的敌人，这属于刻意设计，方便玩家理解射程。

`getAttackTiles(map, unit, origin)` 用于绘制红色攻击范围；`getTargetsInRange` / `getAttackableEnemies` 用于筛选实际目标。

---

## 4. 战斗公式

实现位于 `src/combat.js`。

### 4.1 三角关系

```text
剑 → 斧 → 枪 → 剑
```

`triangleAgainst(attackerType, defenderType)` 返回 `1`（克制）、`-1`（被克制）、`0`（中立）。

- 克制：武器威力 ×1.2，命中 +15。
- 被克制：武器威力 ×0.8，命中 −15。
- 弓、法书：不参与三角，始终中立。
- 有效修正：武器 `effectiveAgainst` 与目标 `tags` 相交时，武器威力 ×1.5。

### 4.2 命中

```text
rawHit = attacker.hit + weapon.hit + triangleHit
avoid  = floor(defender.spd * 1.5) + terrain.avoid
hit    = clamp(rawHit - avoid, 5, 100)
```

### 4.3 攻击与伤害

伤害类型由**武器**的 `damageType` 决定，而非角色职业。物理与魔法共用同一套公式：

```text
triangleMultiplier = 1.2（克制）/ 0.8（被克制）/ 1.0（中立）
effectiveness      = 1.5（命中有效 tags）/ 1.0（否则）

weaponPower = round(weapon.might * triangleMultiplier * effectiveness)

if damageType === 'magic':
  atkStat  = attacker.mag
  defense  = defender.res
else:
  atkStat  = attacker.str
  defense  = defender.def + terrain.def

attack = atkStat + weaponPower
       + (attacker.atkMod || 0)
       + (weapon.atkMod || 0)

damage = max(1, attack - defense)
```

- `weapon.magic` 仅作为旧存档/自定义数据的兼容回退，不再写入当前武器表。
- 山地 +3 守备只对物理伤害生效；魔法改为结算魔防，因此山地不能提供魔防。
- 技能、骑士团等后续修正可累加到 `atkMod`；有效修正可由 `effectiveAgainst` / `tags` 自动匹配。
- 预览层会把 `attack`、`atkStat`、`weaponPower`、`triangleMultiplier`、`effectiveness`、`defense` 一起返回，UI 可完整展示计算链。

### 4.4 暴击

```text
crit = attacker.crit + weapon.crit
finalDamage = crit ? damage * 2 : damage
```

命中判定成功后才会判定暴击。

### 4.5 随机数

使用 `xorshift32`，状态可序列化：

```js
const rng = new MyGO.RNG(seed);
rng.int(1, 100);       // 1..100 闭区间
rng.serialize();       // 保存到存档
```

存档恢复时一并恢复 RNG 状态，因此读档后的随机序列与存档时一致。

---

## 5. AI

入口：`MyGO.AI.planAction(game, enemy)`。

### 5.1 目标排序

```js
targets.sort((a, b) =>
  manhattan(enemy, a) - manhattan(enemy, b) ||
  a.hp - b.hp ||
  a.id.localeCompare(b.id)
);
```

即：**最近优先，距离相同则血量最低优先**。需求中的“优先攻击最近、血量最低”通过这个双关键字排序同时满足。

### 5.2 决策顺序

1. 当前位置能攻击目标 → 直接攻击。
2. 遍历可达停留格，寻找能攻击任意目标的格子：
   - 优先能攻击排序更靠前的目标；
   - 同目标优先消耗移动力更少；
   - 再优先地形守备/闪避更高。
3. 无法攻击 → 朝最近目标移动：
   - 在可达格中选曼哈顿距离目标最近的；
   - 同距离优先地形防守更好；
   - 再优先消耗移动力更少。
4. 无合适落点 → 原地待机。

### 5.3 边界

- AI 不会穿过敌方（对我方而言的玩家单位）占据的格子，和玩家规则一致。
- 敌人之间可以互相穿过，但不能重叠停留。
- 若所有可达格都被占据，返回 `wait`。
- 当前版本不会使用道具、技能或撤退。

---

## 6. 渲染层

`renderer.js` 维护一个 `requestAnimationFrame` 循环，每帧重绘：

1. 地形 Tilemap（预渲染缓存，24 × 16 世界坐标）。
2. 移动范围 / 攻击范围高亮。
3. 路径预览。
4. 60px 火纹 if 风角色与头顶血条（`characters.js` 按方向/状态从图集裁剪，缓存绘制）。
5. 选中/目标标记。
6. 伤害飘字、暴击火花、闪白、震屏。
7. 轻量尘埃与暗角。

### 6.1 大地图视口与缩放

- 世界尺寸为 `COLS × ROWS = 24 × 16`，每格逻辑 32px，画布背板再乘 `RENDER_SCALE=2`。
- `#board-viewport` 固定为 3:2 视口；1× 时画布恰好适合视口，不产生滚动条。
- `UI.setZoom(z)` 只改变画布的 CSS 像素尺寸（1.0–2.2），逻辑坐标、点击换算、游戏规则完全不变。
- 放大后视口 `overflow:auto`，可用滚轮/滚动条平移；`UI.revealCell(x,y)` 会把选中/查看的格子滚进视野。
- `layoutBoard()` 以 `getBoundingClientRect()` 的稳定尺寸为基准，并在 1× 时锁死 overflow，避免“滚动条出现 → 尺寸变化 → 再次布局”的回环。
- 整屏云影/阳光已烘焙进地形层；每帧只绘制少量尘埃，避免大地图上的全屏渐变拖慢渲染循环。

`setView()` 接收一个纯数据视图对象：

```js
renderer.setView({
  mode: 'attack',
  selectedId: 'tomori',
  hoverKey: '11,2',
  moveTiles: new Set(['2,5', '3,5']),
  attackTiles: new Set(['10,2']),
  targetIds: new Set(['shadow_blade_1']),
  path: [{x:2,y:5}, {x:3,y:5}],
  actionableIds: new Set(['tomori'])
});
```

渲染器不读取 UI 内部状态，便于单独替换表现层。

### 动画

- `animateMove(unitId, path, msPerTile)`：沿路径逐格插值，返回 Promise。
- `flash(unitId, color, ms)`：受击闪白。
- `shake(ms, power)`：震屏。
- `floatText(text, gx, gy, color, size)`：飘字。
- `critBurst(gx, gy)`：暴击火花。

所有动画均使用时间戳，不依赖固定帧率。

---

## 7. 存档

实现：`src/save.js`。

### 7.1 存储键与版本

```text
key:     mygo_tactics_save_v1
version: 1
```

### 7.2 快照内容

```js
{
  version: 1,
  savedAt: '2026-...',
  turn: 3,
  phase: 'player',
  units: [{ id, x, y, hp, acted, dead }],
  rng: 123456789
}
```

不保存 DOM、动画、UI 模式或渲染状态。读档后统一回到可操作的我方阶段。

### 7.3 校验

`game.restore()` 会检查：

- 版本号。
- 单位 id 是否存在。
- 坐标是否越界。
- 存活单位是否重叠。
- 快照是否缺少必要字段。

校验失败时抛出错误，由 UI 显示 Toast，不会破坏当前对局。

### 7.4 存储降级

- 优先 `localStorage`。
- 浏览器禁用或配额不足时，使用内存中的 `Map` 作为后备；此时刷新页面存档会丢失。

---

## 8. 素材接口

`src/assets.js` 默认绘制程序化 32×32 像素图。所有绘制都通过以下两个函数分发：

```js
MyGO.Assets.drawTerrain(ctx, terrainId, x, y, size, info)
MyGO.Assets.drawUnit(ctx, unit, x, y, size, opts)
```

注册覆盖：

```js
MyGO.Assets.registerPack({
  terrain: {
    forest(ctx, x, y, size, info) { /* ... */ }
  },
  units: {
    tomori(ctx, x, y, size, unit, opts) { /* ... */ }
  }
});
```

`opts` 可能包含：

| 字段 | 含义 |
| --- | --- |
| `portrait` | 是否为 UI 头像/特写，通常去掉影子、缩小构图 |
| `noFlip` | 禁止根据阵营自动镜像 |
| `static` | 不播放待机浮动 |
| `bob` | 待机浮动相位 |

`fromImage(image, crop)` 是一个便捷工厂，返回可注册的绘制函数。图片必须由调用方加载，本项目不写死任何外部路径。

完整示例见 [`ASSETS.md`](ASSETS.md)。

---

## 9. 扩展方向

### 9.1 新增角色 / 敌人

在 `config.js` 的 `CONFIG.UNITS` 中追加一条：

```js
{
  id: 'new_unit',
  name: '新角色',
  shortName: '新',
  side: 'player',
  className: '剑士',
  level: 1,
  x: 3, y: 5,
  hp: 24,
  str: 9, spd: 8, def: 4, res: 3,
  hit: 85, crit: 8, move: 5,
  weapon: 'starblade',
  artKey: 'new_unit',
  art: { /* 供 assets.js 使用的颜色、发型等 */ }
}
```

`artKey` 不存在时程序化绘制会回退到通用造型。替换素材时，用同一个 `id` / `artKey` 注册即可。

### 9.2 新增地形

1. 在 `TERRAIN` 中追加定义。
2. 在 `MAP_CHARS` 字符映射和 `CHAR_TO_TERRAIN` 中登记。
3. 在 `assets.js` 中登记默认画笔（或 afterward 用 `registerPack` 覆盖）。
4. 在 `styles.css` 的图例中追加颜色点。

### 9.3 新增武器

在 `WEAPONS` 中追加数据；`range` 为 `[min, max]`，`magic` 决定结算物防还是魔防，`type` 决定三角关系。

### 9.4 商店框架

当前版本的商店是刻意留空的。推荐扩展方式：

1. 在 `index.html` 增加一个「商店」按钮，打开空弹窗骨架。
2. 新增 `src/shop.js`，维护金币和库存。
3. 商店只修改 `game` 外的持久化数据，不改动战斗状态机。
4. 战斗准备界面读取库存，给单位换武器。

由于用户要求优先保证战斗走通，本版本未加入商店逻辑。

### 9.5 多关卡

当前 `MyGO.Game` 直接读取 `CONFIG.MAP_CHARS` 和 `CONFIG.UNITS`。扩展方式：

- 把地图与单位模板提取为 `CONFIG.STAGES` 数组。
- `Game` 接收 `stageId`，按关卡构建地图和单位。
- 胜利后由 UI 切换到下一关，并保留队伍状态。

---

## 10. 测试策略

`tests/test-core.js` 使用 Node 直接加载逻辑脚本（通过 `vm` 提供最小 `window`），不依赖浏览器。

测试重点不是像素输出，而是：

- 地形消耗与阻挡。
- 寻路是否绕过敌人。
- 攻击距离边界。
- 三角、地形、暴击公式。
- 结算前不扣血。
- AI 目标排序。
- 存档快照恢复。

浏览器端的人眼检查重点：

- 移动/攻击高亮是否与规则一致。
- 特写、结算弹窗、确认后扣血的顺序。
- 敌方回合是否逐单位行动。
- 底部面板在常见分辨率下是否可读。

运行：

```bash
node tests/test-core.js
```

---

## 11. 已知取舍

- **反击与追击（v4.7）**：首击后，存活且射程覆盖攻击者的防守方自动反击，攻速差至少 4 时较快方在反击后追击；任一方倒下立即停止。预告、逐击动画与双方 HP 统一确认共用一份交战结果。详见 `docs/COUNTERATTACK.md`。
- **物魔分家**：v1.1 起力量与魔力是独立属性；物理武器读力量/守备，魔法武器读魔力/魔防，避免“攻击”与“力量”概念重叠。
- **威力倍率而非固定加减**：三角克制改为武器威力 ×1.2 / ×0.8，低威力武器不会获得与高威力武器相同的克制收益；命中仍用 ±15。
- **2× 背板**：逻辑格仍是 32px；角色地图高度 60px、侧视战斗高度约 90–105px，均从 80×96 的图集单元按比例缩放；`RENDER_SCALE=2` 只提高背板清晰度，不改变规则或坐标。
- **60px 战棋小人**：高于一格，会向上溢出约一格；渲染器按行排序，血条固定在头顶并夹在画布内。角色图集含四方向行走、攻击、受伤、倒地。
- **缩放上限 2.2×**：足够看清 60px 小人，又不会让 24×16 地图的滚动距离失控；1× 是“适合视口”而不是像素 1:1。
- **远程不能攻击贴脸**：保持射程概念的清晰性，也避免弓手被近战贴身后仍能还手。
- **无武器耐久**：让测试与平衡更直接。
- **无动画跳过设置**：特写支持点击 / Esc 跳过单次；全局跳过可在 UI 增加设置项。
- **单关**：胜利/失败后只提供重开；多关卡扩展见 9.5。
