/* ============================================================
 * game.js — 游戏状态机与规则入口
 *
 * 只负责“数据”：单位位置、HP、回合、阶段、随机数、存档快照。
 * 动画、弹窗、AI 调度由 ui.js 负责，便于进行无浏览器测试。
 * ============================================================ */
(function (global) {
  'use strict';
  const MyGO = (global.MyGO = global.MyGO || {});
  const C = MyGO.CONFIG;
  const Grid = MyGO.Grid;
  const Pathfinding = MyGO.Pathfinding;
  const Combat = MyGO.Combat;

  function cloneMap() {
    return {
      cols: C.COLS,
      rows: C.ROWS,
      tiles: C.MAP_TERRAIN.map((row) => row.slice()),
      decor: (C.MAP_DECOR || []).slice()
    };
  }

  function stageTwoMap() {
    return {
      cols: C.STAGE_TWO.cols,
      rows: C.STAGE_TWO.rows,
      tiles: C.STAGE_TWO.terrain.map((row) => row.slice()),
      decor: (C.STAGE_TWO.decor || []).slice()
    };
  }

  function unitsForStage(stage, recruited) {
    const spawns = stage === 2 ? C.STAGE_TWO.spawns : C.STAGE_ONE_SPAWNS;
    const joined = (recruited || []).includes('xueyue');
    const templates = C.UNITS.concat(stage === 1 ? C.STAGE_ONE_EXTRA_UNITS.map(extra =>
      Object.assign({}, C.UNITS.find(u=>u.id===extra.base), extra)) : []);
    return templates.filter(template => stage === 1 ? template.id !== 'conductor'
      : template.id !== 'xueyue' || joined).map(function (template) {
      const override = spawns[template.id];
      const ally = template.id === 'xueyue' && joined ? { side: 'player', boss: false, dormant: false,
        quote: '心声已经传达到了。今后，请让我与你同行。' } : {};
      return createUnit(Object.assign({ mapCols:stage===2?C.STAGE_TWO.cols:C.COLS,
        mapRows:stage===2?C.STAGE_TWO.rows:C.ROWS }, template, override || {}, ally));
    });
  }

  function createUnit(template) {
    const unit = {
      id: template.id,
      name: template.name,
      shortName: template.shortName,
      side: template.side,
      className: template.className,
      gender: template.gender || '不明',
      level: template.level,
      maxHp: template.maxHp,
      hp: template.maxHp,
      // 物理武器读取 str，魔法武器读取 mag；两者都参与面板展示。
      str: template.str,
      mag: template.mag || 0,
      spd: template.spd,
      def: template.def,
      res: template.res,
      hit: template.hit,
      dex: template.dex || 0,
      lck: template.lck || 0,
      move: template.move,
      // 预留技能 / 骑士团 / 装备被动的固定攻击修正。
      atkMod: template.atkMod || 0,
      // 供“有效修正”判定使用，例如 ['armor']、['flying']。
      tags: template.tags ? template.tags.slice() : [],
      weaponId: template.weapon,
      weapon: C.WEAPONS[template.weapon],
      x: template.x,
      y: template.y,
      boss: !!template.boss,
      dormant: !!template.dormant,
      key: !!template.key,
      guardGroup: template.guardGroup || null,
      guardRadius: template.guardRadius || 0,
      alerted: false,
      quote: template.quote,
      art: template.art,
      // 仅影响渲染：默认朝向与行走动画状态。
      // 优先使用关卡指定朝向，否则按站位面向场内。
      facing: template.facing || (() => {
        const centerX = ((template.mapCols || C.COLS) - 1) / 2;
        if (template.x < centerX - 1) return 'right';
        if (template.x > centerX + 1) return 'left';
        return template.y < (template.mapRows || C.ROWS) / 2 ? 'down' : 'up';
      })(),
      _walking: false,
      _spritePhase: (template.x * 7 + template.y * 13) % 8,
      acted: false,
      dead: false
    };
    if (!unit.weapon) throw new Error('未知武器: ' + template.weapon);
    return unit;
  }

  class Game {
    constructor(options) {
      const opts = options || {};
      this.stage = opts.stage === 2 ? 2 : 1;
      this.recruited = Array.isArray(opts.recruited) && opts.recruited.includes('xueyue') ? ['xueyue'] : [];
      this.map = this.stage === 2 ? stageTwoMap() : cloneMap();
      this.units = unitsForStage(this.stage, this.recruited);
      this.mission = this.stage === 2 ? C.STAGE_TWO : C.MISSION;
      this.turn = 1;
      this.phase = 'player'; // player | enemy | victory | defeat
      this.winner = null;
      this.gateOpen = false;
      this.resonanceOpen = false;
      this.lastHealing = [];
      this.rng = new MyGO.RNG(opts.seed);
      this.startedAt = Date.now();
    }

    /** 切换静态关卡数据（不影响回合/单位状态，由 restore 重新填充）。 */
    _setupStage(stage) {
      this.stage = stage === 2 ? 2 : 1;
      this.map = this.stage === 2 ? stageTwoMap() : cloneMap();
      this.units = unitsForStage(this.stage, this.recruited);
      this.mission = this.stage === 2 ? C.STAGE_TWO : C.MISSION;
      this.gateOpen = false;
      this.resonanceOpen = false;
    }

    getUnit(id) {
      return this.units.find((u) => u.id === id) || null;
    }

    unitAt(x, y) {
      return Grid.unitAt(this.units, x, y);
    }

    living(side) {
      return Grid.living(this.units, side);
    }

    livingCount(side) {
      return this.living(side).length;
    }

    getTerrain(x, y) {
      return Grid.terrainAt(this.map, x, y);
    }

    /** 当前阶段是否接受玩家操作。 */
    isPlayerPhase() {
      return this.phase === 'player';
    }

    isOver() {
      return this.phase === 'victory' || this.phase === 'defeat';
    }

    /** 选中单位可移动范围。 */
    getReachable(unit) {
      return Pathfinding.getReachable(this.map, unit, this.units);
    }

    /** 返回指定攻击位置可攻击的敌人。 */
    getAttackableEnemies(unit, fromX, fromY) {
      const x = fromX == null ? unit.x : fromX;
      const y = fromY == null ? unit.y : fromY;
      return Pathfinding.getTargetsInRange(unit, this.units, x, y);
    }

    /** 攻击范围格子（用于高亮）。 */
    getAttackTiles(unit, fromX, fromY) {
      return Pathfinding.getAttackTiles(
        this.map,
        unit,
        fromX == null ? null : { x: fromX, y: fromY }
      );
    }

    canAttack(attacker, target) {
      return (
        !!attacker &&
        !!target &&
        !attacker.dead &&
        !target.dead &&
        attacker.side !== target.side &&
        Pathfinding.canAttackFrom(attacker, attacker.x, attacker.y, target)
      );
    }

    /** 记录移动结果；只修改坐标，不做动画。 */
    setUnitPosition(unitId, x, y) {
      const unit = this.getUnit(unitId);
      if (!unit) throw new Error('单位不存在');
      if (!Grid.inBounds(this.map, x, y)) throw new Error('坐标越界');
      if (this.getTerrain(x, y).blocked) throw new Error('不能停留在阻挡地形');
      const occupant = this.unitAt(x, y);
      if (occupant && occupant.id !== unit.id) throw new Error('目标格已被占用');
      unit.x = x;
      unit.y = y;
      return unit;
    }

    markActed(unit) {
      if (unit) unit.acted = true;
    }

    resetActed(side) {
      for (const unit of this.living(side)) unit.acted = false;
    }

    /** 打开庭院大门，并同步地图格。返回是否是第一次打开。 */
    openGate() {
      if (this.gateOpen) return false;
      this.gateOpen = true;
      this._syncGateTiles();
      return true;
    }

    /** 闭门时庭院内的休眠敌人不会行动。 */
    isUnitActive(unit) {
      if (!unit || (unit.dormant && !this.gateOpen)) return false;
      return !unit.guardRadius || unit.alerted || this._seesPlayer(unit);
    }

    _seesPlayer(unit) {
      const reach = Pathfinding.getReachable(this.map, {...unit, move:unit.guardRadius}, []);
      return this.living('player').some(p => reach.has(Grid.key(p.x,p.y)));
    }

    alertGroup(unit) {
      if (!unit || unit.side !== 'enemy') return;
      for (const other of this.living('enemy')) {
        if (other.id===unit.id || (unit.guardGroup && other.guardGroup===unit.guardGroup)) other.alerted=true;
      }
    }

    refreshAlerts() {
      for(const unit of this.living('enemy')) {
        if (!(unit.dormant && !this.gateOpen) && unit.guardRadius && this._seesPlayer(unit)) this.alertGroup(unit);
      }
    }

    canActivateResonance(unit) {
      return this.stage===1 && this.isPlayerPhase() && !this.resonanceOpen && !!unit &&
        unit.side==='player' && !unit.dead && !unit.acted && this.getTerrain(unit.x,unit.y).id==='resonance';
    }

    activateResonance(unit) {
      if(!this.canActivateResonance(unit)) return false;
      this.resonanceOpen=true;
      this._syncResonance();
      unit.acted=true;
      return true;
    }

    _syncResonance() {
      if(this.stage!==1 || !this.resonanceOpen) return;
      for(const p of C.FORD_CELLS) this.map.tiles[p.y][p.x]='ford';
    }

    _syncGateTiles() {
      const from = this.gateOpen ? 'gate' : 'gateOpen';
      const to = this.gateOpen ? 'gateOpen' : 'gate';
      for (let y = 0; y < this.map.rows; y++) {
        for (let x = 0; x < this.map.cols; x++) {
          if (this.map.tiles[y][x] === from) this.map.tiles[y][x] = to;
        }
      }
    }

    previewCombat(attacker, defender) {
      if (!this.canAttack(attacker, defender)) {
        throw new Error('目标不在攻击范围内');
      }
      return Combat.preview(attacker, defender, this.map);
    }

    /** 消耗随机数生成结果；此时 HP 尚未变化。 */
    rollCombat(attacker, defender) {
      const previewData = this.previewCombat(attacker, defender);
      return Combat.roll(previewData, this.rng);
    }

    /**
     * 真正扣血。返回战报对象，供 UI 播放伤害数字。
     * 战斗结果只能应用一次。
     */
    applyCombat(result) {
      if (!result) throw new Error('缺少战斗结果');
      if (result.applied) throw new Error('该战斗结果已结算');
      const defender = this.getUnit(result.defenderId);
      if (!defender || defender.dead) {
        result.applied = true;
        return { ...result, killed: false, skipped: true };
      }
      const before = defender.hp;
      this.alertGroup(defender);
      defender.hp = Math.max(0, before - result.finalDamage);
      const killed = defender.hp <= 0;
      if (killed) {
        defender.dead = true;
        defender.acted = true;
      }
      result.applied = true;
      result.hpBeforeApply = before;
      result.hpAfterApply = defender.hp;
      result.killed = killed;
      if (killed && defender.key) {
        result.keyCarrier = defender.id;
        result.gateOpened = this.openGate();
      }
      if (killed && this.stage === 1 && defender.id === 'xueyue' && defender.side === 'enemy') {
        this.recruited = ['xueyue'];
        defender.side = 'player';
        defender.boss = false;
        defender.dormant = false;
        defender.dead = false;
        defender.hp = defender.maxHp;
        defender.acted = true;
        defender.quote = '心声已经传达到了。今后，请让我与你同行。';
        result.recruitedId = defender.id;
      }
      this.checkOutcome();
      return result;
    }

    /**
     * 判断胜负。任一方全灭即结束。
     * 不自动修改 turn，便于 UI 播放结算动画。
     */
    checkOutcome() {
      if (this.isOver()) return this.winner;
      if (this.livingCount('enemy') === 0) {
        this.phase = 'victory';
        this.winner = 'player';
      } else if (this.livingCount('player') === 0) {
        this.phase = 'defeat';
        this.winner = 'enemy';
      }
      return this.winner;
    }

    /** 玩家结束回合，进入敌方阶段。 */
    beginEnemyPhase() {
      if (this.phase !== 'player' || this.isOver()) return false;
      this.phase = 'enemy';
      this.refreshAlerts();
      this.resetActed('enemy');
      return true;
    }

    /** 敌方阶段结束，回合数 +1，回到玩家阶段。 */
    beginNextPlayerPhase() {
      if (this.isOver()) return false;
      this.turn += 1;
      this.phase = 'player';
      this.resetActed('player');
      this.lastHealing=[];
      for(const unit of this.living('player')) {
        if(this.getTerrain(unit.x,unit.y).id!=='fort') continue;
        const amount=Math.min(unit.maxHp-unit.hp, Math.ceil(unit.maxHp*.2));
        if(amount>0) { unit.hp+=amount; this.lastHealing.push({id:unit.id,amount}); }
      }
      return true;
    }

    /** 玩家全体存活单位是否都已行动。 */
    allPlayerActed() {
      const list = this.living('player');
      return list.length > 0 && list.every((u) => u.acted);
    }

    /**
     * 存档快照：静态地图/角色模板不重复写入。
     * 只保存会变化的状态，读档时由模板重建单位。
     */
    serialize() {
      return {
        version: C.SAVE_VERSION,
        stage: this.stage,
        mapRevision: this.stage === 1 ? C.MAP_REVISION : 1,
        turn: this.turn,
        phase: this.phase,
        winner: this.winner,
        gateOpen: this.gateOpen,
        resonanceOpen: this.resonanceOpen,
        recruited: this.recruited.slice(),
        rngState: this.rng.serialize(),
        units: this.units.map((u) => ({
          id: u.id,
          x: u.x,
          y: u.y,
          hp: u.hp,
          acted: u.acted,
          dead: u.dead,
          alerted: u.alerted
        }))
      };
    }

    /** 校验并恢复存档。返回 true 表示成功。 */
    restore(snapshot) {
      if (!snapshot || snapshot.version !== C.SAVE_VERSION) {
        throw new Error('存档版本不兼容');
      }
      if (!Array.isArray(snapshot.units)) throw new Error('存档单位数据缺失');
      if (snapshot.stage !== 2 && snapshot.mapRevision !== C.MAP_REVISION) {
        throw new Error('第一关地图已更新，请重开第一关；旧存档仍然保留。');
      }

      // 地图是可变的（大门开启后会换成 gateOpen），读档先恢复关卡与静态地图。
      this.stage = snapshot.stage === 2 ? 2 : 1;
      this.map = this.stage === 2 ? stageTwoMap() : cloneMap();
      this.gateOpen = !!snapshot.gateOpen;
      this._syncGateTiles();
      this.resonanceOpen = this.stage===1 && !!snapshot.resonanceOpen;
      this._syncResonance();

      this.recruited = Array.isArray(snapshot.recruited) && snapshot.recruited.includes('xueyue') ? ['xueyue'] : [];
      const fresh = unitsForStage(this.stage, this.recruited);
      const byId = new Map(fresh.map((u) => [u.id, u]));
      const seen = new Set();

      const legacyBoss = this.stage === 1 && !snapshot.units.some(u => u.id === 'xueyue');
      for (const entry of snapshot.units) {
        // v3.9 and earlier used conductor as the first boss. Keep its battle
        // position/HP, and grant the recruit for an already cleared old boss.
        const saved = legacyBoss && entry.id === 'conductor' ? Object.assign({}, entry, { id: 'xueyue' }) : entry;
        const unit = byId.get(saved.id);
        if (!unit) continue;
        if (seen.has(saved.id)) throw new Error('存档单位重复');
        seen.add(saved.id);
        if (!Number.isInteger(saved.x) || !Number.isInteger(saved.y)) {
          throw new Error('存档坐标无效');
        }
        if (!Grid.inBounds(this.map, saved.x, saved.y)) throw new Error('存档坐标越界');
        if (this.getTerrain(saved.x, saved.y).blocked) throw new Error('存档停留在阻挡地形');
        unit.x = saved.x;
        unit.y = saved.y;
        unit.hp = Math.max(0, Math.min(unit.maxHp, Number(saved.hp) || 0));
        unit.dead = !!saved.dead || unit.hp <= 0;
        unit.acted = !!saved.acted || unit.dead;
        unit.alerted = !!saved.alerted;
        if (this.stage === 1 && unit.id === 'xueyue' && unit.dead && !this.recruited.includes('xueyue')) {
          this.recruited = ['xueyue'];
          Object.assign(unit, { side: 'player', boss: false, dormant: false, hp: unit.maxHp, dead: false, acted: true,
            quote: '心声已经传达到了。今后，请让我与你同行。' });
        }
      }

      // 防御性检查：存活单位不能重叠。
      const occupied = new Set();
      for (const u of fresh) {
        if (u.dead) continue;
        const k = Grid.key(u.x, u.y);
        if (occupied.has(k)) throw new Error('存档单位位置重叠');
        occupied.add(k);
      }

      this.units = fresh;
      this.mission = this.stage === 2 ? C.STAGE_TWO : C.MISSION;
      this.turn = Math.max(1, Number(snapshot.turn) || 1);
      this.phase = snapshot.phase === 'enemy' ? 'player' : snapshot.phase;
      this.winner = snapshot.winner || null;
      this.rng = MyGO.RNG.restore(snapshot.rngState);
      // 保留终局快照的胜负状态；非终局快照则由棋盘状态重新推导。
      this.checkOutcome();
      return true;
    }
  }

  MyGO.Game = Game;
  MyGO.createUnit = createUnit;
  MyGO.createMap = cloneMap;
})(window);
