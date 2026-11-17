/* ============================================================
 * tests/test-core.js — 纯逻辑自动化测试
 *
 * 运行：node tests/test-core.js
 *
 * 不依赖浏览器或第三方框架。用 vm 提供一个最小的 window 环境，
 * 按 index.html 中的顺序加载规则相关脚本，然后直接断言结果。
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const sandbox = {
  console,
  Date,
  Math,
  JSON,
  Map,
  Set,
  Number,
  String,
  Object,
  Array,
  Error,
  Infinity,
  setTimeout,
  clearTimeout
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.localStorage = (() => {
  const data = new Map();
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    }
  };
})();

vm.createContext(sandbox);

function load(file) {
  const code = fs.readFileSync(path.join(root, file), 'utf8');
  vm.runInContext(code, sandbox, { filename: file });
}

[
  'src/equipment-data.js','src/magic-data.js','src/inventory.js','src/class-data.js','src/config.js',
  'src/rng.js','src/growth-data.js','src/growth.js',
  'src/grid.js',
  'src/pathfinding.js',
  'src/combat.js',
  'src/game.js',
  'src/ai.js',
  'src/save.js'
].forEach(load);

const MyGO = sandbox.MyGO;
const C = MyGO.CONFIG;
const Grid = MyGO.Grid;
const Path = MyGO.Pathfinding;
const Combat = MyGO.Combat;
const AI = MyGO.AI;

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log('  \x1b[32m✓\x1b[0m ' + name);
  } catch (error) {
    failed += 1;
    failures.push({ name, error });
    console.log('  \x1b[31m✗\x1b[0m ' + name);
    console.log('      ' + error.message);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || '断言失败');
}

function equal(actual, expected, message) {
  if (actual !== expected) {
    throw new Error((message || '值不相等') + `：期望 ${expected}，实际 ${actual}`);
  }
}

function close(actual, expected, message) {
  if (Math.abs(actual - expected) > 1e-9) {
    throw new Error((message || '数值不相等') + `：期望 ${expected}，实际 ${actual}`);
  }
}

function throws(fn, message) {
  let threw = false;
  try { fn(); } catch (error) { threw = true; }
  if (!threw) throw new Error(message || '预期抛出错误，但没有抛出');
}

function newGame(seed) {
  return new MyGO.Game({ seed: seed == null ? 20260411 : seed });
}

function plainMap(cols, rows) {
  return {
    cols,
    rows,
    tiles: Array.from({ length: rows }, () => Array.from({ length: cols }, () => 'plain'))
  };
}

function cloneUnit(unit, patch) {
  return Object.assign({}, unit, patch || {});
}

function byId(game, id) {
  const unit = game.getUnit(id);
  if (!unit) throw new Error('测试单位不存在: ' + id);
  return unit;
}

console.log('\nMYGO!!!!! 迷途庭院 — 核心逻辑测试\n');

/* ------------------------------------------------------------
 * 1. 基础数据与网格
 * ---------------------------------------------------------- */
test('初始对局：5 名我方、18 名敌方、玩家阶段', () => {
  const game = newGame();
  equal(game.livingCount('player'), 5);
  equal(game.livingCount('enemy'), 18);
  equal(game.phase, 'player');
  equal(game.turn, 1);
});

test('地图尺寸与地形解析正确', () => {
  const game = newGame();
  equal(game.map.cols, 36);
  equal(game.map.rows, 24);
  equal(C.MAP_CHARS.length, 24);
  C.MAP_CHARS.forEach((row, y) => equal(row.length, 36, '第 ' + y + ' 行应为 36 格'));
  equal(game.getTerrain(1, 11).id, 'plain');
  equal(game.getTerrain(3, 9).id, 'forest');
  equal(game.getTerrain(9, 3).id, 'mountain');
  equal(game.getTerrain(23, 1).id, 'wall');
  equal(game.getTerrain(28, 11).id, 'gate');
  equal(game.getTerrain(12, 9).id, 'water');
  equal(game.getTerrain(12, 6).id, 'bridge');
  equal(game.getTerrain(7, 10).id, 'road');
  equal(game.getTerrain(27, 3).id, 'plaza');
});

test('坐标键、越界与曼哈顿距离工具', () => {
  equal(Grid.key(3, 7), '3,7');
  const pos = Grid.fromKey('3,7');
  equal(pos.x, 3);
  equal(pos.y, 7);
  assert(Grid.inBounds(newGame().map, 35, 23), '右下角应在边界内');
  assert(!Grid.inBounds(newGame().map, 36, 23), 'x=36 应越界');
  assert(!Grid.inBounds(newGame().map, 35, 24), 'y=24 应越界');
  equal(Grid.manhattan({ x: 1, y: 2 }, { x: 5, y: 6 }), 8);
});

test('地形消耗：森林/山地进入需 2 点移动力', () => {
  const game = newGame();
  const tomori = byId(game, 'tomori');
  game.map = plainMap(6, 6);
  game.units = [tomori];
  tomori.x = 2; tomori.y = 3;
  game.map.tiles[4][3] = 'forest';
  const records = game.getReachable(tomori);
  const forest = records.get('3,4');
  assert(forest, '应可到达 (3,4) 森林');
  equal(forest.cost, 3, '两格草地 + 一格森林 = 1 + 2');
});

test('墙体不可进入、不可停留', () => {
  const game = newGame();
  const tomori = byId(game, 'tomori');
  const records = game.getReachable(tomori);
  assert(!records.has('23,1'), '(23,1) 是墙体，不应可达');
  throws(() => game.setUnitPosition('tomori', 23, 1), '应拒绝把单位放到墙上');
});

/* ------------------------------------------------------------
 * 2. 移动阻挡
 * ---------------------------------------------------------- */
test('敌方单位阻挡整条走廊', () => {
  const map = plainMap(6, 1);
  const base = newGame().getUnit('tomori');
  const self = cloneUnit(base, { x: 0, y: 0, move: 5 });
  const enemy = cloneUnit(newGame().getUnit('shadow_blade_1'), { x: 2, y: 0 });

  const records = Path.getReachable(map, self, [self, enemy]);
  assert(records.has('1,0'), '(1,0) 在敌人前，应可达');
  assert(!records.has('3,0'), '不能穿过敌人到 (3,0)');
  assert(!records.has('4,0'), '不能穿过敌人到 (4,0)');
});

test('友军可穿过但不能停留', () => {
  const map = plainMap(5, 1);
  const game = newGame();
  const self = cloneUnit(game.getUnit('tomori'), { x: 0, y: 0, move: 5 });
  const ally = cloneUnit(game.getUnit('anon'), { x: 1, y: 0 });

  const records = Path.getReachable(map, self, [self, ally]);
  const allyCell = records.get('1,0');
  const behind = records.get('2,0');
  assert(allyCell, '友军所在格应被记录，便于穿过');
  equal(allyCell.stoppable, false, '友军所在格不可停留');
  assert(behind, '应能穿过友军继续移动');
  equal(behind.cost, 2);
  equal(behind.stoppable, true);
});

test('移动力耗尽后不再扩展', () => {
  const map = plainMap(8, 1);
  const self = cloneUnit(newGame().getUnit('tomori'), { x: 0, y: 0, move: 3 });
  const records = Path.getReachable(map, self, [self]);
  assert(records.has('3,0'), '应到达第 3 格');
  assert(!records.has('4,0'), '4 点消耗超过移动力 3');
});

test('路径回溯包含起点和终点，顺序正确', () => {
  const map = plainMap(5, 1);
  const self = cloneUnit(newGame().getUnit('tomori'), { x: 0, y: 0, move: 5 });
  const records = Path.getReachable(map, self, [self]);
  const path = Path.getPath(records, '3,0');
  equal(path.length, 4);
  equal(path[0].x, 0);
  equal(path[3].x, 3);
});

/* ------------------------------------------------------------
 * 3. 攻击距离
 * ---------------------------------------------------------- */
test('近战武器攻击距离为 1', () => {
  const game = newGame();
  const tomori = byId(game, 'tomori');
  const axe = byId(game, 'shadow_axe');
  axe.x = 3; axe.y = 5;
  assert(Path.canAttackFrom(tomori, 2, 5, axe), '相邻 1 格应可攻击');
  axe.x = 4; axe.y = 5;
  assert(!Path.canAttackFrom(tomori, 2, 5, axe), '距离 2 不可近战');
});

test('铁弓攻击距离为2，不能贴脸或攻击3格', () => {
  const game = newGame();
  const anon = byId(game, 'anon');
  const axe = byId(game, 'shadow_axe');

  axe.x = 3; axe.y = 4;
  assert(Path.canAttackFrom(anon, 1, 4, axe), '距离 2 应可攻击');
  axe.x = 4; axe.y = 4;
  assert(!Path.canAttackFrom(anon, 1, 4, axe), '铁弓距离3不可攻击');
  axe.x = 2; axe.y = 4;
  assert(!Path.canAttackFrom(anon, 1, 4, axe), '距离 1 不应可攻击');
});

test('同阵营不能互相攻击', () => {
  const game = newGame();
  const tomori = byId(game, 'tomori');
  const anon = byId(game, 'anon');
  assert(!Path.canAttackFrom(tomori, tomori.x, tomori.y, anon), '不能攻击友军');
});

test('攻击范围高亮不含墙体', () => {
  const game = newGame();
  const anon = byId(game, 'anon');
  // 以 (6,4) 为临时站位：墙 (8,4) 距离 2、墙 (8,3) 距离 3，
  // 两者都在弓的射程内，因此能真正验证“墙被排除”而不是被射程排除。
  game.map=plainMap(12,10);game.map.tiles[4][8]='wall';game.map.tiles[3][8]='wall';
  const tiles = Path.getAttackTiles(game.map, anon, { x: 6, y: 4 });
  assert(!tiles.some((t) => t.x === 8 && t.y === 4), '距离 2 的墙体不应出现在攻击范围');
  assert(!tiles.some((t) => t.x === 8 && t.y === 3), '距离 3 的墙体不应出现在攻击范围');
  assert(tiles.every((t) => {
    const d = Math.abs(t.x - 6) + Math.abs(t.y - 4);
    return d >= 2 && d <= 3;
  }), '所有格子应满足射程 2~3');
});

/* ------------------------------------------------------------
 * 4. 战斗公式
 * ---------------------------------------------------------- */
test('三角关系：剑克斧、斧克枪、枪克剑', () => {
  equal(Combat.triangleAgainst(C.WEAPONS.iron_sword, C.WEAPONS.iron_axe), 1);
  equal(Combat.triangleAgainst(C.WEAPONS.iron_axe, C.WEAPONS.iron_lance), 1);
  equal(Combat.triangleAgainst(C.WEAPONS.iron_lance, C.WEAPONS.iron_sword), 1);
  equal(Combat.triangleAgainst(C.WEAPONS.iron_sword, C.WEAPONS.iron_lance), -1);
  equal(Combat.triangleAgainst(C.WEAPONS.iron_bow, C.WEAPONS.iron_sword), 0);
  equal(Combat.triangleLabel(1), '克制');
  equal(Combat.triangleLabel(-1), '被克制');
  equal(Combat.triangleLabel(0), '无克制');
});

test('剑克斧：武器威力 ×1.2、命中 +15', () => {
  const game = newGame();
  const tomori = byId(game, 'tomori');
  const axe = byId(game, 'shadow_axe');
  axe.x = 10; axe.y = 8;

  const preview = Combat.preview(tomori, axe, game.map);
  equal(preview.triangle, 1);
  equal(preview.triangleLabel, '克制');
  equal(preview.triangleMultiplier, 1.2);
  equal(preview.weaponPower, 6); // round(5 × 1.2)
  equal(preview.atkStat, 10);
  equal(preview.attack, 16); // 10 力量 + 6 威力
  // 16 攻击 - 6 守备 = 10
  equal(preview.damage, 10);
  // 90 角色命中 + 5 武器命中 + 15 克制 - floor(4×1.5)=6 = 104 -> 100
  equal(preview.hit, 100);
  equal(preview.baseCrit, 10);
  equal(preview.targetCritAvoid, 2);
  equal(preview.crit, 8);
  equal(preview.terrainId, 'plain');
});

test('被克制时伤害与命中下降', () => {
  const game = newGame();
  const axe = byId(game, 'shadow_axe');
  const tomori = byId(game, 'tomori');
  axe.x = 1; axe.y = 5;
  tomori.x = 2; tomori.y = 5;

  const preview = Combat.preview(axe, tomori, game.map);
  equal(preview.triangle, -1);
  equal(preview.triangleMultiplier, 0.8);
  equal(preview.weaponPower, 6); // round(铁斧8 × 0.8) = 6
  equal(preview.attack, 17); // 11 力量 + 6 威力
  // 16 攻击 - 5 守备 = 11
  equal(preview.damage, 12);
  // 72 + 0 - 15 - floor(9×1.5)=13 = 44
  equal(preview.hit, Math.max(5,Combat.hitOf(axe)-15-Combat.avoidOf(tomori,game.map)));
});

test('森林闪避 +20', () => {
  const game = newGame();
  const axe = byId(game, 'shadow_axe');
  axe.x = 3; axe.y = 9; // 森林
  equal(Combat.avoidOf(axe, game.map), Math.floor(axe.spd * 1.5) + 20);
});

test('山地守备 +3，且魔法改打魔防', () => {
  const game = newGame();
  const axe = byId(game, 'shadow_axe');
  axe.x = 9; axe.y = 3; // 山地
  equal(Combat.defenseOf(axe, game.map, false), axe.def + 3);
  equal(Combat.defenseOf(axe, game.map, true), axe.res);

  const soyo = byId(game, 'soyo');
  const preview = Combat.preview(soyo, axe, game.map);
  // 12 魔力 + 6 法书 - 1 魔防 = 17；山地守备不参与魔法减伤
  equal(preview.damageType, 'magic');
  equal(preview.atkStat, 12);
  equal(preview.attack, 15);
  equal(preview.damage, 14);
  equal(preview.magic, true);
  equal(preview.terrainDef, 0);
});

test('能力分配：物理角色力量高、法师魔力高', () => {
  const game = newGame();
  const tomori = byId(game, 'tomori');
  const anon = byId(game, 'anon');
  const rana = byId(game, 'rana');
  const taki = byId(game, 'taki');
  const soyo = byId(game, 'soyo');

  [tomori, anon, rana, taki].forEach((unit) => {
    assert(unit.str > unit.mag, unit.name + ' 是物理角色，力量应高于魔力');
  });
  assert(soyo.mag > soyo.str, '爽世是魔法角色，魔力应高于力量');
  equal(tomori.weapon.damageType, 'physical');
  equal(soyo.weapon.damageType, 'magic');
  equal(soyo.weapon.element, 'fire', '火焰魔法使用火焰演出，与作者提供的爽世施法图一致');
  equal(C.WEAPONS.bolganone.element, 'fire', '烈火魔法应带火属性，用于红色魔法球');
});

test('角色幸运与技巧替代固定暴击属性，武器暴击保留', () => {
  const game = newGame();
  game.units.forEach(unit => {
    assert(Number.isInteger(unit.dex) && unit.dex >= 0, '技巧必须是非负整数');
    assert(Number.isInteger(unit.lck) && unit.lck >= 0, '幸运必须是非负整数');
    assert(!Object.hasOwn(unit, 'crit'), '角色不再存储固定暴击属性');
    assert(Number.isInteger(unit.weapon.crit), '武器暴击仍是独立参数');
  });
});

test('风花雪月暴击率：技巧幸运取平均向下取整，再扣目标幸运', () => {
  const game = newGame();
  const a = byId(game, 'tomori');
  const b = byId(game, 'shadow_axe');
  a.dex = 11; a.lck = 8; b.lck = 4;
  equal(Combat.critRateOf(a), 9); // floor((11+8)/2)+5
  equal(Combat.critAvoidOf(b), 4);
  equal(Combat.preview(a, b, game.map).crit, 5);
  a.lck += 2;
  equal(Combat.preview(a, b, game.map).crit, 6, '攻击方幸运提升应增加暴击');
  b.lck += 3;
  equal(Combat.preview(a, b, game.map).crit, 3, '防守方幸运逐点降低来袭暴击');
});

test('暴击率边界：目标高幸运可完全防暴击，最高 100%', () => {
  const game = newGame();
  const a = byId(game, 'tomori');
  const b = byId(game, 'shadow_axe');
  b.lck = 100;
  equal(Combat.preview(a, b, game.map).crit, 0);
  a.dex = 400; a.lck = 0; b.lck = 0;
  equal(Combat.preview(a, b, game.map).crit, 100);
});

test('属性总和使用九项基础能力，受伤、等级、武器、命中修正不影响总和', () => {
  const game = newGame();
  const expected = { tomori: 83, anon: 86, rana: 81, soyo: 77, taki: 79 };
  Object.entries(expected).forEach(([id, value]) => equal(Combat.statTotalOf(byId(game, id)), value, id));
  const unit = byId(game, 'tomori');
  unit.hp = 1; unit.level = 99; unit.hit = 999;
  unit.weapon = { ...unit.weapon, might: 50, crit: 90 };
  equal(Combat.statTotalOf(unit), 83);
  unit.lck += 3;
  equal(Combat.statTotalOf(unit), 86);
});

test('既有存档重建幸运与技巧，同时保留原有进度和 HP', () => {
  const game = newGame();
  const snapshot = game.serialize();
  snapshot.units.find(u => u.id === 'soyo').hp = 7;
  const restored = newGame();
  restored.restore(snapshot);
  const soyo = byId(restored, 'soyo');
  equal(soyo.hp, 7);
  equal(soyo.dex, 10);
  equal(soyo.lck, 8);
  equal(Combat.statTotalOf(soyo), 77);
});

test('有效修正：命中目标 tag 时武器威力 ×1.5', () => {
  const effectiveWeapon = { ...C.WEAPONS.iron_sword, effectiveAgainst: ['armor'] };
  equal(Combat.effectivenessAgainst(effectiveWeapon, { tags: ['armor'] }), 1.5);
  equal(Combat.effectivenessAgainst(effectiveWeapon, { tags: ['flying'] }), 1);
  equal(Combat.effectivenessAgainst(C.WEAPONS.iron_sword, { tags: ['armor'] }), 1);
});

test('命中率被限制在 5~100', () => {
  const game = newGame();
  const tomori = byId(game, 'tomori');
  const axe = byId(game, 'shadow_axe');
  axe.x = 3; axe.y = 5;
  const preview = Combat.preview(tomori, axe, game.map);
  assert(preview.hit >= 5 && preview.hit <= 100, '命中率应在 5~100 内');
});

test('双随机数命中遵循平均值边界及真实命中概率', () => {
  for (const [chance, expected] of [[5,55],[50,5050],[70,8230],[80,9220],[90,9810],[100,10000]]) {
    let hits = 0;
    for (let first = 1; first <= 100; first++) for (let second = 1; second <= 100; second++) {
      const values = [first, second, 100];
      const result = Combat.roll({hit: chance, crit: 0, damage: 1, defenderHp: 10}, {int: () => values.shift()});
      if (result.hit) hits++;
    }
    equal(hits, expected, '显示命中 ' + chance + ' 的命中组合数');
  }
});

test('暴击伤害为 3 倍，命中后才判定暴击', () => {
  const data = { hit: 50, crit: 20, damage: 7, defenderHp: 20 };
  const miss = Combat.roll(data, { int: () => 100 });
  assert(!miss.hit, '100 应判为未命中');
  assert(!miss.crit, '未命中不应暴击');
  equal(miss.hitChance, 50, '展示用命中率应保留');
  equal(miss.critChance, 20, '展示用暴击率应保留');
  equal(miss.finalDamage, 0);

  const crit = Combat.roll(data, { int: () => 1 });
  assert(crit.hit, '1 应判为命中');
  assert(crit.crit, '1 应判为暴击');
  equal(crit.finalDamage, 21);
  equal(crit.hpAfter, 0);
});

/* ------------------------------------------------------------
 * 5. 结算时机与对局状态
 * ---------------------------------------------------------- */
test('roll 只锁定结果，不扣 HP', () => {
  const game = newGame();
  const tomori = byId(game, 'tomori');
  const axe = byId(game, 'shadow_axe');
  axe.x = 3; axe.y = 5;
  const hpBefore = axe.hp;

  const result = Combat.roll(Combat.preview(tomori, axe, game.map), { int: () => 1 });
  equal(axe.hp, hpBefore, 'roll 后血量不应变化');
  equal(result.applied, false);
  equal(result.crit, true);
  equal(result.finalDamage, 30); // 克制后基础伤害 10，暴击 ×3
});

test('applyCombat 才扣血，且只能应用一次', () => {
  const game = newGame();
  const tomori = byId(game, 'tomori');
  const axe = byId(game, 'shadow_axe');
  axe.x = tomori.x + 1; axe.y = tomori.y;

  const result = game.rollCombat(tomori, axe);
  const hpBefore = axe.hp;
  equal(axe.hp, hpBefore, '生成结果后血量不变');

  game.applyCombat(result);
  equal(axe.hp, hpBefore - result.finalDamage, '确认后扣血');
  equal(result.applied, true);
  throws(() => game.applyCombat(result), '同一结果不能重复结算');
});

test('击杀后标记死亡，全灭敌方进入胜利', () => {
  const game = newGame();
  for (const enemy of game.living('enemy')) {
    const result = {
      defenderId: enemy.id,
      finalDamage: 999,
      hit: true,
      crit: false,
      applied: false
    };
    game.applyCombat(result);
  }
  equal(game.livingCount('enemy'), 0);
  equal(game.phase, 'victory');
  equal(game.winner, 'player');
  assert(game.isOver(), '应进入结束状态');
});

test('我方全灭进入失败', () => {
  const game = newGame();
  for (const ally of game.living('player')) {
    game.applyCombat({
      defenderId: ally.id,
      finalDamage: 999,
      hit: true,
      crit: false,
      applied: false
    });
  }
  equal(game.livingCount('player'), 0);
  equal(game.phase, 'defeat');
  equal(game.winner, 'enemy');
});

test('敌方阶段重置与下一回合恢复', () => {
  const game = newGame();
  const ally = byId(game, 'tomori');
  game.markActed(ally);
  assert(game.beginEnemyPhase(), '应能进入敌方阶段');
  equal(game.phase, 'enemy');
  assert(!game.beginEnemyPhase(), '不能连续进入敌方阶段');
  assert(game.beginNextPlayerPhase(), '应能回到玩家阶段');
  equal(game.phase, 'player');
  equal(game.turn, 2);
  equal(ally.acted, false, '新回合应重置我方行动状态');
});

/* ------------------------------------------------------------
 * 6. AI
 * ---------------------------------------------------------- */
test('AI 优先攻击最近目标，即使它血量更高', () => {
  const game = newGame();
  game.map=plainMap(36,24);
  const enemy = byId(game, 'shadow_blade_1');
  const tomori = byId(game, 'tomori');
  const anon = byId(game, 'anon');

  game.setUnitPosition('shadow_blade_1', 5, 5);
  game.setUnitPosition('tomori', 5, 6);
  game.setUnitPosition('anon', 7, 5);
  tomori.hp = 20;
  anon.hp = 1;
  // 把其余我方单位移到远处，避免干扰距离排序。
  game.setUnitPosition('rana', 0, 0);
  game.setUnitPosition('soyo', 1, 0);
  game.setUnitPosition('taki', 2, 0);

  const plan = AI.planAction(game, enemy);
  equal(plan.type, 'attack');
  equal(plan.targetId, 'tomori', '距离 1 的目标优先于距离 2 的残血目标');
});

test('AI 距离相同时优先攻击血量最低者', () => {
  const game = newGame();
  game.map=plainMap(36,24);
  const enemy = byId(game, 'shadow_bow');
  const tomori = byId(game, 'tomori');
  const anon = byId(game, 'anon');

  game.setUnitPosition('shadow_bow', 5, 6);
  game.setUnitPosition('tomori', 3, 6);
  game.setUnitPosition('anon', 5, 8);
  tomori.hp = 20;
  anon.hp = 8;
  game.setUnitPosition('rana', 0, 0);
  game.setUnitPosition('soyo', 1, 0);
  game.setUnitPosition('taki', 2, 0);

  const plan = AI.planAction(game, enemy);
  equal(plan.type, 'attack');
  equal(plan.targetId, 'anon', '同为距离 2，应选择 HP 更低的爱音');
});

test('AI 无法攻击时会向最近目标移动', () => {
  const game = newGame();
  const enemy = byId(game, 'shadow_blade_1');
  enemy.alerted=true;
  game.setUnitPosition('shadow_blade_1', 17, 2);
  // 把一名我方单位放到同一侧远处，确保 AI 需要移动而不是原地等待。
  game.setUnitPosition('anon', 21, 6);

  const plan = AI.planAction(game, enemy);
  equal(plan.type, 'move');
  assert(plan.path.length > 1, '应产生移动路径');
  const last = plan.path[plan.path.length - 1];
  equal(last.x, plan.destination.x);
  equal(last.y, plan.destination.y);
});

test('AI 的移动终点不会与任何单位重叠', () => {
  const game = newGame();
  for (const enemy of game.living('enemy')) {
    const plan = AI.planAction(game, enemy);
    if (plan.destination) {
      const occupant = game.unitAt(plan.destination.x, plan.destination.y);
      assert(!occupant || occupant.id === enemy.id, 'AI 目的地不应被占用');
    }
  }
});

/* ------------------------------------------------------------
 * 7. 存档快照
 * ---------------------------------------------------------- */
test('存档快照能恢复回合、HP、位置、行动状态与 RNG', () => {
  const game = newGame(12345);
  const tomori = byId(game, 'tomori');
  tomori.hp = 9;
  tomori.acted = true;
  game.setUnitPosition('tomori', 4, 6);
  game.turn = 3;
  game.rng.int(1, 100);

  const snapshot = JSON.parse(JSON.stringify(game.serialize()));
  const restored = newGame(999);
  restored.restore(snapshot);

  const restoredTomori = byId(restored, 'tomori');
  equal(restored.turn, 3);
  equal(restoredTomori.hp, 9);
  equal(restoredTomori.x, 4);
  equal(restoredTomori.y, 6);
  equal(restoredTomori.acted, true);
  equal(restored.rng.serialize(), game.rng.serialize(), 'RNG 状态应一致');
});

test('读档时敌方阶段安全转换为玩家阶段', () => {
  const game = newGame();
  const snapshot = game.serialize();
  snapshot.phase = 'enemy';
  const next = newGame();
  next.restore(snapshot);
  equal(next.phase, 'player');
});

test('存档校验：重叠单位会被拒绝', () => {
  const game = newGame();
  const snapshot = game.serialize();
  const tomori = snapshot.units.find((u) => u.id === 'tomori');
  const anon = snapshot.units.find((u) => u.id === 'anon');
  anon.x = tomori.x;
  anon.y = tomori.y;
  throws(() => newGame().restore(snapshot), '重叠存档应被拒绝');
});

test('SaveManager 写入并读回快照', () => {
  const game = newGame(777);
  byId(game, 'tomori').hp = 12;
  const manager = new MyGO.SaveManager();
  const saveResult = manager.save(game);
  assert(saveResult.ok, '保存应成功');

  const loaded = manager.load();
  assert(loaded.ok, '读取应成功');
  equal(loaded.snapshot.units.find((u) => u.id === 'tomori').hp, 12);
  equal(loaded.snapshot.version, C.SAVE_VERSION);
});

test('恢复终局存档时保留胜利状态', () => {
  const game = newGame();
  for (const enemy of game.living('enemy')) enemy.dead = true;
  game.checkOutcome();
  equal(game.phase, 'victory');
  const snapshot = game.serialize();
  const next = newGame();
  next.restore(snapshot);
  // checkOutcome() 会根据全灭的敌人重新推导胜负，
  // 因此终局快照应保持胜利，而不是变成没有敌人的可玩状态。
  equal(next.phase, 'victory');
  equal(next.winner, 'player');
});

test('钥匙进入击败者背包，持有者在门旁使用后开启庭院并唤醒敌人', () => {
  const game = newGame();
  const boss = game.getUnit('xueyue');
  assert(boss.dormant, '首领应处于沉眠状态');
  assert(!game.isUnitActive(boss), '闭门时首领不应行动');
  equal(AI.planAction(game, boss).type, 'wait');
  equal(game.getTerrain(28, 11).id, 'gate');

  const key = game.getUnit('shadow_bow');
  assert(key.key, '影弓应携带钥匙');
  key.hp = 10;
  const result = game.applyCombat({
    attackerId: 'tomori',
    defenderId: 'shadow_bow',
    hit: true,
    finalDamage: 99
  });

  assert(!game.gateOpen, '击败守卫不能自动开门');
  equal(result.keyRecipientId, 'tomori');
  const holder = game.getUnit('tomori');
  assert(holder.inventory.some(i=>i.id==='courtyard_key'));
  assert(!game.isUnitActive(boss));
  game.setUnitPosition(holder.id, 28, 12);
  assert(game.useGateKey(holder));
  assert(holder.acted); assert(!holder.inventory.some(i=>i.id==='courtyard_key'));
  equal(game.getTerrain(28, 11).id, 'gateOpen');
  assert(game.isUnitActive(boss), '开门后首领应恢复行动');

  const snapshot = game.serialize();
  const next = newGame();
  next.restore(snapshot);
  assert(next.gateOpen, '读档应恢复大门状态');
  equal(next.getTerrain(28, 11).id, 'gateOpen');
});

test('第二关：花镇五铃择三、全图连通、无需全灭', () => {
  const game=new MyGO.Game({seed:202,stage:2});
  equal(game.mission.title,'星铃花镇');equal(game.map.cols,40);equal(game.map.rows,28);
  equal(game.livingCount('enemy'),24);
  assert(!game.units.some(u=>u.key),'第二关不再重复钥匙开门');
  assert(!game.map.tiles.flat().some(t=>['gate','bridge','ford'].includes(t)));
  const scout={...game.getUnit('tomori'),move:1000},reachable=Path.getReachable(game.map,scout,[]);
  for(const b of game.mission.bells){equal(game.getTerrain(b.x,b.y).id,'bell');assert(reachable.has(b.x+','+b.y));}
  const boss=game.getUnit('conductor');assert(reachable.has(boss.x+','+boss.y));
  for(let y=0;y<28;y++)for(let x=0;x<40;x++)if(!game.getTerrain(x,y).blocked)assert(reachable.has(x+','+y),'孤立通行格 '+x+','+y);
  game.applyCombat({defenderId:'conductor',hit:true,finalDamage:999});
  assert(!game.isOver(),'仅击败首领不能跳过访问目标');
  const unit=game.getUnit('tomori');
  for(const b of game.mission.bells.slice(0,3)){
    unit.acted=false;game.setUnitPosition(unit.id,b.x,b.y);assert(game.awakenBell(unit));
  }
  equal(game.phase,'victory');assert(game.livingCount('enemy')>0,'第二关无需全灭敌军');
  const restored=newGame();restored.restore(game.serialize());
  equal(restored.phase,'victory');equal(restored.awakenedBells.length,3);
});

test('第一关：出生格合法、钥匙可达、闭门隔离内庭、开门后全图连通', () => {
  const game = newGame();
  const occupied = new Set();
  for (const unit of game.units) {
    assert(!game.getTerrain(unit.x,unit.y).blocked, unit.id + ' 出生格必须可站立');
    const key = Grid.key(unit.x,unit.y);
    assert(!occupied.has(key), '出生格不能重叠'); occupied.add(key);
  }
  const scout = Object.assign({},game.getUnit('tomori'),{move:1000});
  const closed = Path.getReachable(game.map,scout,[]);
  const key = game.getUnit('shadow_bow'), boss = game.getUnit('xueyue');
  assert(closed.has(Grid.key(key.x,key.y)), '闭门时必须能接近钥匙守卫');
  assert(!closed.has(Grid.key(boss.x,boss.y)), '闭门时不能绕过南门进入内庭');
  for (const bridge of [[12,6],[13,7],[12,18],[13,19]]) {
    assert(closed.has(Grid.key(...bridge)), '两组桥都应通向外庭');
  }
  game.openGate();
  const opened = Path.getReachable(game.map,scout,[]);
  for (let y=0;y<game.map.rows;y++) for(let x=0;x<game.map.cols;x++) {
    if (!game.getTerrain(x,y).blocked) assert(opened.has(Grid.key(x,y)), '不可留下孤立的可通行格 '+x+','+y);
  }
});

test('AI：隔着水渠时绕桥，不能停在近岸反复待机', () => {
  const game = newGame();
  const target = game.getUnit('tomori'), enemy = game.getUnit('shadow_blade_1');
  game.units=[target,enemy];target.x=10;target.y=9;enemy.x=15;enemy.y=9;enemy.alerted=true;
  let crossed=false;
  for(let turn=0;turn<8;turn++) {
    const plan=AI.planAction(game,enemy);
    for(const p of plan.path) assert(!game.getTerrain(p.x,p.y).blocked,'AI 路径必须可通行');
    if(plan.destination){enemy.x=plan.destination.x;enemy.y=plan.destination.y;}
    if(enemy.x<12){crossed=true;break;}
  }
  assert(crossed,'AI 应主动绕行桥梁抵达西岸');
});

test('第一关：旧地图存档明确提示版本变化，新地图存档完整恢复', () => {
  const game=newGame(),snapshot=game.serialize();
  equal(snapshot.mapRevision,C.MAP_REVISION);
  const restored=newGame();restored.restore(snapshot);
  equal(restored.getUnit('tomori').x,4);
  delete snapshot.mapRevision;
  let message='';try {restored.restore(snapshot);} catch(error){message=error.message;}
  assert(message.includes('第一关地图已更新'),'旧地图存档必须明确提示，不把旧坐标载入新地图');
});

test('雪月：第一关剑客首领，未击败前不在同行之人中', () => {
  const game = newGame(), boss = game.getUnit('xueyue');
  equal(boss.name, '雪月'); equal(boss.className, '剑客');
  equal(boss.side, 'enemy'); assert(boss.boss && boss.dormant);
  equal(boss.weapon.type, 'sword'); equal(game.getUnit('conductor'), null);
  equal(game.livingCount('player'), 5); equal(game.livingCount('enemy'), 18);
  equal(boss.facing,'down');
  equal(game.recruited.length, 0);
});

function defeatXueyue(game) {
  return game.applyCombat({ defenderId: 'xueyue', hit: true, finalDamage: 999 });
}

test('雪月：未命中、非致命攻击及预演均不触发招募', () => {
  const game = newGame(), boss = game.getUnit('xueyue');
  game.openGate(); Object.assign(game.getUnit('tomori'), { x: 28, y: 4 });
  game.rollCombat(game.getUnit('tomori'), boss);
  equal(game.recruited.length, 0); equal(boss.hp, boss.maxHp);
  game.applyCombat({ defenderId: boss.id, hit: false, finalDamage: 0 });
  game.applyCombat({ defenderId: boss.id, hit: true, finalDamage: 1 });
  equal(boss.side, 'enemy'); equal(game.recruited.length, 0);
});

test('雪月：击败后保持退场，下回合也不能操作或提前招募', () => {
  const game = newGame(), result = defeatXueyue(game), boss = game.getUnit('xueyue');
  assert(!result.recruitedId); assert(result.killed);
  equal(result.hpAfterApply, 0); equal(boss.hp, 0);
  equal(boss.side, 'enemy'); assert(boss.dead && boss.acted);
  equal(game.livingCount('player'), 5); equal(game.phase, 'player');
  let rejected = false; try { game.applyCombat(result); } catch (_) { rejected = true; }
  assert(rejected, '同一战报不能重复结算'); equal(game.recruited.length, 0);
  game.beginEnemyPhase(); game.beginNextPlayerPhase(); assert(boss.dead && boss.acted);
});

test('雪月：通关后解锁招募，第一关仍为五人，通关存档可恢复', () => {
  const game = newGame();
  for (const u of game.living('enemy')) if (u.id !== 'xueyue') { u.dead = true; u.hp = 0; }
  defeatXueyue(game); equal(game.phase, 'victory'); equal(game.livingCount('player'), 5);
  equal(game.recruited[0], 'xueyue'); assert(!game.recruitmentShown);
  const restored = newGame(); restored.restore(game.serialize());
  equal(restored.phase, 'victory'); equal(restored.livingCount('player'), 5);
  equal(restored.getUnit('xueyue').side, 'enemy'); assert(restored.getUnit('xueyue').dead);
});

test('雪月：未击败与已击败的中途存档保持敌方状态，不因读档复活', () => {
  const game = newGame(), restored = newGame();
  game.getUnit('xueyue').hp = 7; restored.restore(game.serialize());
  equal(restored.getUnit('xueyue').hp, 7); equal(restored.getUnit('xueyue').side, 'enemy');
  defeatXueyue(game);
  restored.restore(game.serialize()); equal(restored.getUnit('xueyue').hp, 0);
  equal(restored.getUnit('xueyue').side, 'enemy'); assert(restored.getUnit('xueyue').dead);
  equal(restored.recruited.length, 0);
});

test('雪月：重复结算倒地目标不会提前招募或读档复活', () => {
  const game = newGame(); defeatXueyue(game);
  const result = defeatXueyue(game); assert(!result.recruitedId);
  const restored = newGame(); restored.restore(game.serialize());
  assert(restored.getUnit('xueyue').dead); equal(restored.getUnit('xueyue').hp, 0);
  equal(restored.getUnit('xueyue').side, 'enemy'); equal(restored.recruited.length, 0);
});

test('雪月：已招募随队进入第二关，直接开第二关不提前解锁', () => {
  const game = newGame(); defeatXueyue(game);
  for (const u of game.living('enemy')) { u.dead = true; u.hp = 0; }
  game.checkOutcome();
  const next = new MyGO.Game({ stage: 2, recruited: game.recruited });
  equal(next.livingCount('player'), 6); equal(next.livingCount('enemy'), 24);
  equal(next.getUnit('xueyue').side, 'player'); assert(next.getUnit('conductor').boss);
  equal(new MyGO.Game({ stage: 2 }).getUnit('xueyue'), null);
  const restored = newGame(); restored.restore(next.serialize());
  equal(restored.stage, 2); equal(restored.livingCount('player'), 6);
  equal(restored.getUnit('xueyue').x, 4); equal(restored.getUnit('xueyue').y, 17);
});

test('雪月：旧版首领存档迁移，击败后在通关时才招募', () => {
  for (const dead of [false, true]) {
    const snapshot = newGame().serialize(); delete snapshot.recruited;
    const boss = snapshot.units.find(u => u.id === 'xueyue');
    Object.assign(boss, { id: 'conductor', hp: dead ? 0 : 12, dead });
    const restored = newGame(); restored.restore(snapshot);
    const snow = restored.getUnit('xueyue');
    equal(snow.side, 'enemy'); equal(snow.hp, dead ? 0 : 12);
    equal(restored.recruited.length, 0);
    if (dead) {
      for (const u of restored.living('enemy')) { u.dead = true; u.hp = 0; }
      restored.checkOutcome(); equal(restored.recruited.length, 1);
    }
  }
});

test('共鸣：仅未行动的我方在碑上可以开启，消耗行动且只能一次',()=>{
  const g=newGame(),u=g.getUnit('tomori');
  assert(!g.activateResonance(u));g.setUnitPosition(u.id,7,13);
  u.acted=true;assert(!g.activateResonance(u));u.acted=false;
  g.phase='enemy';assert(!g.activateResonance(u));g.phase='player';
  const enemy=g.getUnit('west_bow');Object.assign(enemy,{x:7,y:13});
  assert(!g.activateResonance(enemy));Object.assign(enemy,{x:7,y:8});
  assert(g.activateResonance(u));assert(u.acted);assert(g.resonanceOpen);
  u.acted=false;assert(!g.activateResonance(u));
});
test('共鸣：只改变四格中央河面，浅滩消耗 2，闭门仍隔离首领',()=>{
  const g=newGame(),before=g.map.tiles.map(r=>r.slice()),u=g.getUnit('tomori');
  g.setUnitPosition(u.id,7,13);g.activateResonance(u);
  let changed=0;
  for(let y=0;y<24;y++)for(let x=0;x<36;x++)if(before[y][x]!==g.map.tiles[y][x]){
    changed++;equal(g.getTerrain(x,y).id,'ford');equal(g.getTerrain(x,y).moveCost,2);
  }
  equal(changed,4);
  const reach=Path.getReachable(g.map,{...u,move:1000},[]);
  assert(reach.has('13,13'));assert(!reach.has('28,3'));
});
test('共鸣：站在浅滩的存档能恢复地形、坐标与机关状态',()=>{
  const g=newGame(),u=g.getUnit('tomori');g.setUnitPosition(u.id,7,13);
  g.activateResonance(u);g.setUnitPosition(u.id,12,12);
  const next=newGame();next.restore(g.serialize());
  assert(next.resonanceOpen);equal(next.getTerrain(12,12).id,'ford');
  equal(next.getUnit(u.id).x,12);equal(next.getUnit(u.id).y,12);
});
test('警戒：开局不全军冲锋，接近一人惊动整队，撤离后仍追击',()=>{
  const g=newGame();equal(g.living('enemy').filter(u=>g.isUnitActive(u)).length,0);
  g.setUnitPosition('tomori',8,14);g.beginEnemyPhase();
  for(const u of g.living('enemy').filter(u=>u.guardGroup==='west')) assert(u.alerted);
  assert(!g.getUnit('shadow_bow').alerted);assert(!g.isUnitActive(g.getUnit('xueyue')));
  g.setUnitPosition('tomori',1,22);assert(g.isUnitActive(g.getUnit('west_bow')));
  const restored=newGame();restored.restore(g.serialize());assert(restored.getUnit('west_bow').alerted);
});
test('警戒：受击惊动全队，不惊动其他区域',()=>{
  const g=newGame();g.applyCombat({defenderId:'north_bow',hit:false,finalDamage:0});
  for(const u of g.living('enemy').filter(u=>u.guardGroup==='north'))assert(u.alerted);
  assert(!g.getUnit('shadow_axe').alerted);
});
test('警戒：按可通行地形计算，隔河的曼哈顿近邻不会凭空惊动',()=>{
  const g=newGame(),u=g.getUnit('north_lance'),p=g.getUnit('tomori');
  Object.assign(u,{x:14,y:11,guardRadius:4});Object.assign(p,{x:11,y:11});
  g.units=[u,p];assert(!g.isUnitActive(u));
  g.resonanceOpen=true;g._syncResonance();u.guardRadius=10;assert(g.isUnitActive(u));
});
test('据点：我方阶段开始回复最大 HP 的 20%，向上取整并封顶',()=>{
  const g=newGame(),u=g.getUnit('tomori');g.setUnitPosition(u.id,7,4);u.hp=10;
  g.beginEnemyPhase();equal(u.hp,10);g.beginNextPlayerPhase();equal(u.hp,16);
  u.hp=25;g.beginEnemyPhase();g.beginNextPlayerPhase();equal(u.hp,26);
  equal(g.lastHealing[0].amount,1);
});
test('据点：不治疗敌人、不复活死者，草地不回复',()=>{
  const g=newGame(),u=g.getUnit('tomori'),e=g.getUnit('west_bow');u.hp=5;
  Object.assign(e,{x:7,y:4,hp:5});g.beginNextPlayerPhase();equal(e.hp,5);equal(u.hp,5);
  Object.assign(u,{x:21,y:17,hp:0,dead:true});g.beginNextPlayerPhase();equal(u.hp,0);
});
test('第二关：从新第一关状态恢复后尺寸、单位与机关互不污染',()=>{
  const g=newGame();g.resonanceOpen=true;g._syncResonance();
  g.restore(new MyGO.Game({stage:2}).serialize());
  equal(g.map.cols,40);equal(g.map.rows,28);equal(g.livingCount('enemy'),24);
  assert(!g.resonanceOpen);assert(!g.units.some(u=>u.id==='north_bow'));
});

/* 汇总 */
console.log('\n' + '─'.repeat(46));
console.log(`通过 ${passed} 项，失败 ${failed} 项`);

if (failed) {
  console.log('\n失败详情：');
  for (const item of failures) {
    console.log(`\n[${item.name}]`);
    console.log(item.error.stack || item.error.message);
  }
  process.exitCode = 1;
} else {
  console.log('所有核心逻辑测试通过。');
}
