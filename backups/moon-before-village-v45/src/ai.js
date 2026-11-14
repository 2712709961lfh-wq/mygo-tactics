/* ============================================================
 * ai.js — 基础敌方 AI
 *
 * 目标优先级（题目要求）：
 *   1. 距离最近的存活我方单位；
 *   2. 距离相同时，选择当前 HP 最低者。
 *
 * 行为：
 *   - 当前已经能攻击 → 直接攻击；
 *   - 否则在移动范围内寻找能攻击目标的位置；
 *   - 再否则朝最近目标移动，优先停在有防御加成的地形。
 * AI 只负责“计划”，移动与结算由 UI 播放。
 * ============================================================ */
(function (global) {
  'use strict';
  const MyGO = (global.MyGO = global.MyGO || {});
  const Grid = MyGO.Grid;
  const Pathfinding = MyGO.Pathfinding;

  function targetOrder(game, enemy, target) {
    return [
      Grid.manhattan(enemy, target),
      target.hp,
      target.id
    ];
  }

  function compareTuples(a, b) {
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      if (a[i] < b[i]) return -1;
      if (a[i] > b[i]) return 1;
    }
    return 0;
  }

  function sortedTargets(game, enemy) {
    return game
      .living('player')
      .slice()
      .sort((a, b) => compareTuples(targetOrder(game, enemy, a), targetOrder(game, enemy, b)));
  }

  function terrainScore(terrain) {
    // 守备优先，其次闪避；数值只用于同距离候选格的排序。
    return terrain.def * 2 + terrain.avoid * 0.05;
  }

  function pathRecordsToPath(records, rec) {
    return Pathfinding.getPath(records, Grid.key(rec.x, rec.y));
  }

  /**
   * @returns {{type:'attack'|'move'|'wait', targetId?:string, path:Array, destination?:{x,y}}}
   */
  function planAction(game, enemy) {
    if (!enemy || enemy.dead) return { type: 'wait', path: [] };
    if (!game.isUnitActive(enemy)) return { type: 'wait', path: [] };

    const targets = sortedTargets(game, enemy);
    if (!targets.length) return { type: 'wait', path: [] };

    const here = { x: enemy.x, y: enemy.y };
    const reachable = Pathfinding.getReachable(game.map, enemy, game.units);
    const records = Array.from(reachable.values()).filter((r) => r.stoppable && !r.dead);

    // 1) 原地即可攻击：不移动，选最近的（同距选残血）。
    for (const target of targets) {
      if (Pathfinding.canAttackFrom(enemy, enemy.x, enemy.y, target)) {
        return {
          type: 'attack',
          targetId: target.id,
          path: [here],
          destination: here
        };
      }
    }

    // 2) 移动后攻击。按目标优先级寻找第一个可打到的位置。
    for (const target of targets) {
      const candidates = [];
      for (const rec of records) {
        if (rec.x === enemy.x && rec.y === enemy.y) continue;
        if (!Pathfinding.canAttackFrom(enemy, rec.x, rec.y, target)) continue;
        const terrain = Grid.terrainAt(game.map, rec.x, rec.y);
        candidates.push({
          rec,
          sort: [rec.cost, -terrainScore(terrain), rec.y, rec.x]
        });
      }
      if (candidates.length) {
        candidates.sort((a, b) => compareTuples(a.sort, b.sort));
        const chosen = candidates[0];
        return {
          type: 'attack',
          targetId: target.id,
          path: pathRecordsToPath(reachable, chosen.rec),
          destination: { x: chosen.rec.x, y: chosen.rec.y }
        };
      }
    }

    // 3) 无法攻击：向最近目标靠近，尽量停在有利地形。
    const target = targets[0];
    // 用全图通路距离引导绕桥/绕墙；曼哈顿距离会让敌人卡在近岸。
    // 目标优先级保持不变，占位仍由本回合 reachable 精确处理。
    const distances = Pathfinding.getReachable(game.map, {
      id: '__route__', side: enemy.side, x: target.x, y: target.y,
      move: game.map.cols * game.map.rows * 2
    }, []);
    let best = null;
    for (const rec of records) {
      const terrain = Grid.terrainAt(game.map, rec.x, rec.y);
      const route = distances.get(Grid.key(rec.x, rec.y));
      if (!route) continue;
      // 反向搜索包含当前格的进入成本；换成正向剩余成本以正确比较森林格。
      const dist = route.cost - terrain.moveCost;
      const sort = [dist, rec.cost, -terrainScore(terrain), rec.y, rec.x];
      if (!best || compareTuples(sort, best.sort) < 0) {
        best = { rec, sort };
      }
    }

    if (!best) return { type: 'wait', path: [] };
    return {
      type: 'move',
      path: pathRecordsToPath(reachable, best.rec),
      destination: { x: best.rec.x, y: best.rec.y }
    };
  }

  MyGO.AI = { planAction };
})(window);
