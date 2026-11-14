/* ============================================================
 * pathfinding.js — 移动范围与最短路径（Dijkstra）
 *
 * 规则：
 * - 四方向移动，进入一格支付该地形的 moveCost；
 * - 敌方单位会阻挡通行，友军可以穿过但不能停留在其格子上；
 * - 移动力耗尽或地形阻挡时不可继续前进；
 * - 山地/森林消耗 2，草地 1，残垣不可通行。
 * ============================================================ */
(function (global) {
  'use strict';
  const MyGO = (global.MyGO = global.MyGO || {});
  const Grid = MyGO.Grid;

  class MinHeap {
    constructor() {
      this.items = [];
    }
    push(node) {
      const a = this.items;
      a.push(node);
      let i = a.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (a[p].cost <= a[i].cost) break;
        [a[p], a[i]] = [a[i], a[p]];
        i = p;
      }
    }
    pop() {
      const a = this.items;
      if (!a.length) return null;
      const top = a[0];
      const last = a.pop();
      if (a.length) {
        a[0] = last;
        let i = 0;
        for (;;) {
          const l = i * 2 + 1;
          const r = l + 1;
          let small = i;
          if (l < a.length && a[l].cost < a[small].cost) small = l;
          if (r < a.length && a[r].cost < a[small].cost) small = r;
          if (small === i) break;
          [a[i], a[small]] = [a[small], a[i]];
          i = small;
        }
      }
      return top;
    }
    get size() {
      return this.items.length;
    }
  }

  const DIRS = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 }
  ];

  /**
   * 计算单位可达范围。
   * 返回 Map<"x,y", {x,y,cost,prev,stoppable}>；包含起点。
   */
  function getReachable(map, unit, units, canEnter) {
    const startKey = Grid.key(unit.x, unit.y);
    const records = new Map();
    const start = {
      x: unit.x,
      y: unit.y,
      cost: 0,
      prev: null,
      stoppable: true
    };
    records.set(startKey, start);

    const heap = new MinHeap();
    heap.push({ x: unit.x, y: unit.y, cost: 0, key: startKey });

    while (heap.size) {
      const cur = heap.pop();
      const curRec = records.get(cur.key);
      if (!curRec || cur.cost > curRec.cost) continue;

      for (const dir of DIRS) {
        const nx = cur.x + dir.x;
        const ny = cur.y + dir.y;
        if (!Grid.inBounds(map, nx, ny)) continue;
        if (canEnter && !canEnter(nx,ny)) continue;

        const terrain = Grid.terrainAt(map, nx, ny);
        if (!Number.isFinite(Grid.movementCost(map,unit,nx,ny))) continue;

        const occupant = Grid.unitAt(units, nx, ny);
        // 敌方单位阻挡通行；友军可穿过。
        if (occupant && Grid.hostile(occupant, unit)) continue;

        const nextCost = cur.cost + Grid.movementCost(map,unit,nx,ny);
        if (nextCost > Math.max(0,unit.move+(unit.gear?.move||0)-(unit.status?.moveDown?5:0))) continue;

        const nk = Grid.key(nx, ny);
        const old = records.get(nk);
        if (old && old.cost <= nextCost) continue;

        const stoppable = !occupant || occupant.id === unit.id;
        records.set(nk, {
          x: nx,
          y: ny,
          cost: nextCost,
          prev: cur.key,
          stoppable
        });
        heap.push({ x: nx, y: ny, cost: nextCost, key: nk });
      }
    }

    return records;
  }

  /** 根据 Dijkstra 记录回溯路径（含起点与终点）。 */
  function getPath(records, targetKey) {
    if (!records.has(targetKey)) return [];
    const path = [];
    let k = targetKey;
    const seen = new Set();
    while (k && records.has(k) && !seen.has(k)) {
      seen.add(k);
      const rec = records.get(k);
      path.push({ x: rec.x, y: rec.y });
      k = rec.prev;
    }
    return path.reverse();
  }

  /** 计算到指定格子的路径。 */
  function getPathTo(map, unit, units, x, y) {
    const records = getReachable(map, unit, units);
    return getPath(records, Grid.key(x, y));
  }

  /** 返回单位攻击范围覆盖的格子（不含被阻挡地形）。 */
  function getAttackTiles(map, unit, origin) {
    if(!MyGO.Inventory.usable(unit))return [];
    const ox = origin ? origin.x : unit.x;
    const oy = origin ? origin.y : unit.y;
    const [minRange, maxRange] = unit.weapon.range;
    const tiles = [];
    for (let y = 0; y < map.rows; y++) {
      for (let x = 0; x < map.cols; x++) {
        const d = Math.abs(x - ox) + Math.abs(y - oy);
        if (d < minRange || d > maxRange) continue;
        const terrain = Grid.terrainAt(map, x, y);
        if (terrain.blocked && terrain.id!=='water') continue;
        tiles.push({ x, y });
      }
    }
    return tiles;
  }

  /** 单位在指定位置能否攻击目标。 */
  function canAttackFrom(attacker, x, y, target) {
    if (!MyGO.Inventory.usable(attacker) || !target || target.dead || !Grid.hostile(target, attacker)) return false;
    const d = Math.abs(target.x - x) + Math.abs(target.y - y);
    const [minRange, maxRange] = attacker.weapon.range;
    return d >= minRange && d <= maxRange;
  }

  /** 当前位置可攻击的敌人列表。 */
  function getTargetsInRange(attacker, units, x, y) {
    const ox = x == null ? attacker.x : x;
    const oy = y == null ? attacker.y : y;
    return Grid.living(units).filter(
      (u) => Grid.hostile(u, attacker) && canAttackFrom(attacker, ox, oy, u)
    );
  }

  MyGO.Pathfinding = {
    getReachable,
    getPath,
    getPathTo,
    getAttackTiles,
    canAttackFrom,
    getTargetsInRange
  };
})(window);
