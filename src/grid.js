/* ============================================================
 * grid.js — 网格坐标与查询工具
 * ============================================================ */
(function (global) {
  'use strict';
  const MyGO = (global.MyGO = global.MyGO || {});

  function key(x, y) {
    return x + ',' + y;
  }

  function fromKey(k) {
    const [x, y] = k.split(',').map(Number);
    return { x, y };
  }

  function inBounds(map, x, y) {
    return x >= 0 && y >= 0 && x < map.cols && y < map.rows;
  }

  function manhattan(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  function terrainAt(map, x, y) {
    if (!inBounds(map, x, y)) return MyGO.CONFIG.TERRAIN.wall;
    return MyGO.CONFIG.TERRAIN[map.tiles[y][x]];
  }

  function unitAt(units, x, y, includeDead) {
    for (const unit of units) {
      if (!includeDead && (unit.dead||unit.escaped)) continue;
      if (unit.x === x && unit.y === y) return unit;
    }
    return null;
  }

  function living(units, side) {
    return units.filter((u) => !u.dead && !u.escaped && (!side || u.side === side));
  }

  function hostile(a, b) {
    return !!a && !!b && (a.side === 'enemy') !== (b.side === 'enemy');
  }

  /** 判断一个格子能否作为某单位的落脚点（存活单位均不可重叠）。 */
  function canStopAt(units, self, x, y) {
    const occupant = unitAt(units, x, y);
    return !occupant || occupant.id === self.id;
  }

  function movementCost(map,unit,x,y){
    if(!inBounds(map,x,y))return Infinity;
    const t=terrainAt(map,x,y),flying=unit?.tags?.includes('flying');
    if(flying&&['water','forest','mountain','ford'].includes(t.id))return 1;
    return t.blocked?Infinity:t.moveCost;
  }

  MyGO.Grid = {
    movementCost,
    key,
    fromKey,
    inBounds,
    manhattan,
    terrainAt,
    unitAt,
    living,
    hostile,
    canStopAt
  };
})(window);
