/* ============================================================
 * combat.js — 伤害/命中/暴击公式与战斗预览
 *
 * 攻击类型由武器 damageType 决定：
 *   物理 -> 力量 / 目标守备；魔法 -> 魔力 / 目标魔防。
 * 武器威力 = round(武器 might × 三角修正 × 有效修正)
 * 攻击力   = 力量/魔力 + 武器威力 + 技能/骑士团等固定修正
 * 伤害     = 攻击力 - 目标守备（物理，含山地）或魔防（魔法）
 * 命中     = 图鉴命中 + 技巧（魔法取技巧幸运平均）+ 修正 - 目标回避
 * 回避     = 速度×1.5（向下取整）+ 地形闪避
 * 基础暴击 = floor((技巧 + 幸运) / 2) + 武器暴击
 * 必杀回避 = 幸运；实战暴击 = clamp(基础暴击 - 目标必杀回避, 0, 100)
 * 此处对齐《风花雪月》的幸运/暴击率部分；伤害倍率仍为原型的 ×2。
 *
 * UI 把“攻击力”和“防御”拆开展示，计算上等价于
 * 攻击 = 力量/魔力 + 威力×克制×有效 + 修正 - 防御。
 *
 * 普通交战：首击 → 射程内反击 → 攻速差至少 4 的一方追击。
 * 一方倒下立即终止；反击不消耗行动，使用同一伤害/命中/暴击公式。
 * ============================================================ */
(function (global) {
  'use strict';
  const MyGO = (global.MyGO = global.MyGO || {});
  const C = MyGO.CONFIG;
  const Grid = MyGO.Grid;

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  /**
   * 三角关系：
   *  1 = 攻击方克制目标，-1 = 被目标克制，0 = 无关系。
   */
  function triangleAgainst(attackerWeapon, defenderWeapon) {
    const a = C.TRIANGLE[attackerWeapon.type];
    if (!a) return 0;
    if (a.beats === defenderWeapon.type) return 1;
    const d = C.TRIANGLE[defenderWeapon.type];
    if (d && d.beats === attackerWeapon.type) return -1;
    return 0;
  }

  function triangleLabel(value) {
    if (value > 0) return '克制';
    if (value < 0) return '被克制';
    return '无克制';
  }

  /** 兼容旧的自定义武器数据：没有 damageType 时回退读取 magic。 */
  function damageTypeOf(weapon) {
    if (weapon.damageType === 'magic' || weapon.damageType === 'physical') {
      return weapon.damageType;
    }
    return weapon.magic ? 'magic' : 'physical';
  }

  /** 三角修正只作用于武器威力，不改变角色的力量/魔力。 */
  function triangleMultiplier(triangle) {
    if (triangle > 0) return C.TRIANGLE_BONUS.advantageMultiplier;
    if (triangle < 0) return C.TRIANGLE_BONUS.disadvantageMultiplier;
    return 1;
  }

  /**
   * 有效修正：武器 effectiveAgainst 与目标 tags 有交集时，
   * 武器威力乘 1.5（可被 weapon.effectiveMultiplier 覆盖）。
   * 当前关卡没有带 tag 的单位，但接口已为后续兵种特攻预留。
   */
  function effectivenessAgainst(weapon, defender) {
    const targets = weapon.effectiveAgainst;
    if (!Array.isArray(targets) || targets.length === 0) return 1;
    const tags = defender.tags || [];
    const hit = targets.some((tag) => tags.indexOf(tag) !== -1);
    if (!hit) return 1;
    return weapon.effectiveMultiplier || C.TRIANGLE_BONUS.effectivenessMultiplier;
  }

  function terrainOf(unit, map) {
    return unit.tags?.includes('flying')?C.TERRAIN.plain:Grid.terrainAt(map, unit.x, unit.y);
  }

  /** 展示用闪避值（地形闪避 + 速度回避）。 */
  function avoidOf(unit, map) {
    const terrain = terrainOf(unit, map);
    return Math.floor(speedOf(unit) * C.COMBAT.speedAvoidFactor) + terrain.avoid + (unit.gear?.avoid||0);
  }

  /** 风花雪月：技巧和幸运共同产生暴击，防守方幸运抵消暴击。 */
  function critRateOf(unit) {
    return Math.floor(((unit.dex || 0) + (unit.lck || 0)) / 2) + (unit.weapon.crit || 0) + (unit.gear?.crit||0);
  }

  function critAvoidOf(unit) {
    return unit.lck || 0;
  }

  /** 九项基础属性之和：HP 用上限，排除等级、派生概率及武器/地形加成。 */
  function statTotalOf(unit) {
    return ['maxHp', 'str', 'mag', 'dex', 'spd', 'lck', 'def', 'res', 'move']
      .reduce((total, key) => total + (unit[key] || 0), 0);
  }

  /** 风花雪月攻速：武器重量与辅助装备重量共同参与计算。 */
  function attackSpeedOf(unit) {
    const weight = (unit.weapon.weight || 0) + (unit.equipmentWeight || 0);
    return Math.max(0, speedOf(unit) - Math.max(0, weight - Math.floor((unit.str || 0) / 5)));
  }

  function speedOf(u){return Math.max(0,u.spd+(u.gear?.spd||0)-(u.status?.spdDown?5:0));}
  function hitOf(u){return (u.weapon.absoluteHit?(u.weapon.damageType==='magic'?Math.floor(((u.dex||0)+(u.lck||0))/2):(u.dex||0)):(u.hit||0))+(u.weapon.hit||0)+(u.gear?.hit||0);}

  function counterReason(attacker, defender) {
    if (!defender || defender.dead || defender.hp <= 0) return '单位已被击倒';
    if (!defender.weapon || !MyGO.Inventory.usable(defender)) return defender.status?.silence?'沉默中，无法施法':'未装备可用武器或魔法次数耗尽';
    if (defender.cannotCounter || attacker.preventsCounter || attacker.weapon.preventsCounter) return '反击被封锁';
    const distance = Grid.manhattan(attacker, defender);
    const range = defender.weapon.range;
    if (defender.counterAnyRange || (defender.closeCounter && defender.weapon.type === 'bow' && distance === 1)) return '';
    return distance >= range[0] && distance <= range[1] ? '' : '超出武器射程';
  }

  /** 预告只表示可执行的顺序；实际命中/暴击与死亡截断在 rollRound 决定。 */
  function forecast(attacker, defender, map) {
    const first = preview(attacker, defender, map);
    const reason = counterReason(attacker, defender);
    const counter = reason ? null : preview(defender, attacker, map);
    const attackSpeed = attackSpeedOf(attacker), defenderAttackSpeed = attackSpeedOf(defender);
    const order = [{attackerId:attacker.id, defenderId:defender.id, kind:'attack'}];
    if (attacker.weapon.brave || attacker.weapon.type === 'gauntlet') order.push({attackerId:attacker.id, defenderId:defender.id, kind:'combo'});
    if (counter) order.push({attackerId:defender.id, defenderId:attacker.id, kind:'counter'});
    if (!attacker.weapon.noFollowup && attackSpeed - defenderAttackSpeed >= 4) {
      order.push({attackerId:attacker.id, defenderId:defender.id, kind:'followup'});
      if (attacker.weapon.brave || attacker.weapon.type === 'gauntlet') order.push({attackerId:attacker.id, defenderId:defender.id, kind:'combo'});
    }
    else if (counter && !defender.weapon.noFollowup && defenderAttackSpeed - attackSpeed >= 4) order.push({attackerId:defender.id, defenderId:attacker.id, kind:'followup'});
    const remaining=u=>u.weapon.kind==='spell'?(u.spellUses?.[u.weapon.id]||0):u.inventory?u.inventory.filter(i=>i.id===u.weapon.id).reduce((n,i)=>n+i.uses,0):99;
    const counts={};
    const executable=order.filter(step=>{const u=step.attackerId===attacker.id?attacker:defender;counts[u.id]=(counts[u.id]||0)+1;return counts[u.id]<=remaining(u);});
    return {...first, counter, canCounter:!!counter, counterReason:reason, attackSpeed, defenderAttackSpeed, order:executable,
      attackCount:executable.filter(s=>s.attackerId===attacker.id).length,
      counterCount:executable.filter(s=>s.attackerId===defender.id).length};
  }

  /** 锁定整场结果，在虚拟 HP 上逐击掷骰，确认前不修改任何真实单位。 */
  function rollRound(attacker, defender, map, rng) {
    const plan = forecast(attacker, defender, map);
    const units = new Map([[attacker.id,MyGO.Inventory.copy(attacker)], [defender.id,MyGO.Inventory.copy(defender)]]);
    const strikes = [];
    for (const step of plan.order) {
      const a = units.get(step.attackerId), b = units.get(step.defenderId);
      if (a.hp <= 0 || b.hp <= 0) break;
      if(!MyGO.Inventory.usable(a))continue;
      const strike = {...roll(preview(a,b,map),rng), kind:step.kind,
        attackerHp:a.hp, attackerMaxHp:a.maxHp,resourceId:a.inventory?a.weapon.id:null,weaponSnapshot:a.weapon};
      if(a.inventory)MyGO.Inventory.consume(a,a.weapon.id);
      strike.healed=MyGO.Inventory.useEffects(a,b,MyGO.Magic.get(a.weapon.id),strike.finalDamage,strike.hit);
      strike.attackerHpAfterStrike=a.hp;
      const reverse = b.id === defender.id ? plan.counter : plan;
      strike.response = reverse;
      strike.counterReason = b.id === defender.id ? plan.counterReason : '';
      b.hp = strike.hpAfter;
      strikes.push(strike);
      if(b.hpFloor&&b.hp===b.hpFloor&&strike.finalDamage>0){strike.retreatTriggered=true;break;}
    }
    const outgoing = strikes.filter(s=>s.attackerId===attacker.id);
    return {...strikes[0], strikes, forecast:plan, applied:false,
      finalDamage:outgoing.reduce((n,s)=>n+s.finalDamage,0),
      counterDamage:strikes.filter(s=>s.attackerId===defender.id).reduce((n,s)=>n+s.finalDamage,0),
      hit:outgoing.some(s=>s.hit), crit:outgoing.some(s=>s.crit),
      attackerHp:attacker.hp, attackerMaxHp:attacker.maxHp,
      hpAfter:units.get(defender.id).hp,
      attackerHpAfter:units.get(attacker.id).hp, defenderHpAfter:units.get(defender.id).hp};
  }

  /**
   * 生成不会改变游戏状态的战斗预览。
   * 返回字段足够供 UI、AI 与结算共用。
   */
  function preview(attacker, defender, map) {
    if (!attacker || !defender) throw new Error('战斗预览缺少单位');
    if (!Grid.hostile(attacker, defender)) throw new Error('不能攻击友军');

    const aw = attacker.weapon;
    const dw = defender.weapon;
    const triangle = triangleAgainst(aw, dw);
    const terrain = terrainOf(defender, map);
    const damageType = damageTypeOf(aw);
    const magic = damageType === 'magic';

    // ① 武器威力：威力 × 三角克制 × 有效特攻，四舍五入为整数。
    const triMultiplier = triangleMultiplier(triangle);
    const effectiveness = effectivenessAgainst(aw, defender);
    const weaponPower = Math.round(aw.might * triMultiplier * effectiveness);

    // ② 攻击力：对应属性 + 武器威力 + 技能/骑士团等固定修正。
    //    当前角色 atkMod 均为 0，后续加技能时直接写入该字段即可。
    const atkStat = magic ? (attacker.mag || 0) : attacker.str;
    const attackMod = (attacker.atkMod || 0) + (aw.atkMod || 0) + (magic ? attacker.gear?.magic||0 : 0);
    const attack = atkStat + weaponPower + attackMod;

    // ③ 防守：物理吃守备和山地，魔法只吃魔防。
    const terrainDef = magic ? 0 : terrain.def;
    const defense = magic ? (aw.ignoreRes?0:defender.res+(defender.gear?.res||0)+(defender.status?.ward||0)) : Math.max(0,defender.def+(defender.gear?.def||0)-(defender.status?.defDown?5:0)) + terrainDef;
    const damage = Math.max(C.COMBAT.minDamage, attack - defense);

    const targetAvoid = avoidOf(defender,map);
    const rawHit = hitOf(attacker) + triangle * C.TRIANGLE_BONUS.hit - targetAvoid;
    const hit = clamp(rawHit, C.COMBAT.minHit, C.COMBAT.maxHit);
    const baseCrit = critRateOf(attacker);
    const targetCritAvoid = critAvoidOf(defender);
    const crit = clamp(baseCrit - targetCritAvoid, 0, 100);

    return {
      attackerId: attacker.id,
      defenderId: defender.id,
      attackerName: attacker.name,
      defenderName: defender.name,
      attackerSide: attacker.side,
      defenderSide: defender.side,
      weaponName: aw.name,
      weaponType: aw.type,
      weaponTypeName: C.TRIANGLE[aw.type] ? C.TRIANGLE[aw.type].name : (magic ? '魔' : '弓'),
      triangle,
      triangleLabel: triangleLabel(triangle),
      triangleMultiplier: triMultiplier,
      effectiveness,
      magic,
      damageType,
      damageTypeName: magic ? '魔法' : '物理',
      atkStat,
      attackMod,
      weaponPower,
      attack,
      terrainId: terrain.id,
      terrainName: terrain.name,
      terrainAvoid: terrain.avoid,
      terrainDef,
      defense,
      defenseName: magic ? '魔防' : '守备',
      targetAvoid,
      damage,
      hit,
      baseCrit,
      targetCritAvoid,
      crit,
      critDamage: damage * C.COMBAT.critMultiplier,
      hpFloor:defender.hpFloor||0,
      defenderHp: defender.hp,
      defenderMaxHp: defender.maxHp,
      hpAfterHit: Math.max(defender.hpFloor||0, defender.hp - damage),
      hpAfterCrit: Math.max(defender.hpFloor||0, defender.hp - damage * C.COMBAT.critMultiplier)
    };
  }

  /**
   * 用 RNG 掷出命中与暴击。不修改 HP，保证“点击确认后才扣血”。
   * 判定顺序：先命中，命中后才判定暴击。
   */
  function roll(previewData, rng) {
    const hitRoll = rng.int(1, 100);
    const critRoll = rng.int(1, 100);
    const hit = hitRoll <= previewData.hit;
    const crit = hit && critRoll <= previewData.crit;
    const damage = hit
      ? previewData.damage * (crit ? C.COMBAT.critMultiplier : 1)
      : 0;

    return {
      ...previewData,
      // 面板展示用概率与实战判定用布尔值分开保存：
      // hit / crit 在本函数中被覆盖为“这次是否命中/暴击”，
      // 原来的百分比保存在 hitChance / critChance 中。
      hitChance: previewData.hit,
      critChance: previewData.crit,
      hit,
      crit,
      hitRoll,
      critRoll,
      finalDamage: damage,
      hpAfter: Math.max(previewData.hpFloor||0, previewData.defenderHp - damage),
      applied: false
    };
  }

  /** 返回某单位站上当前地形后的防御值，供信息面板展示。 */
  function defenseOf(unit, map, magic) {
    const terrain = terrainOf(unit, map);
    return magic ? unit.res+(unit.gear?.res||0)+(unit.status?.ward||0) : Math.max(0,unit.def+(unit.gear?.def||0)-(unit.status?.defDown?5:0)) + terrain.def;
  }

  MyGO.Combat = {
    speedOf,
    hitOf,
    clamp,
    triangleAgainst,
    triangleLabel,
    damageTypeOf,
    triangleMultiplier,
    effectivenessAgainst,
    terrainOf,
    avoidOf,
    critRateOf,
    critAvoidOf,
    statTotalOf,
    attackSpeedOf,
    counterReason,
    forecast,
    rollRound,
    defenseOf,
    preview,
    roll
  };
})(window);
