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
 * 暴击伤害倍率为 ×3。
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
  function avoidOf(unit, map,context={},foe) {
    const terrain = terrainOf(unit, map);
    return Math.floor(speedOf(unit,context) * C.COMBAT.speedAvoidFactor) + terrain.avoid + (unit.gear?.avoid||0) + (MyGO.Talents?.avoidBonus(unit,foe)||0)+(MyGO.Mastery?.bonus(unit,'avoid',context,foe)||0);
  }

  /** 风花雪月：技巧和幸运共同产生暴击，防守方幸运抵消暴击。 */
  function critRateOf(unit,context={},foe) {
    return Math.floor((dexOf(unit) + ((unit.lck || 0)+(MyGO.Mastery?.bonus(unit,'lck',context)||0))) / 2) + (unit.weapon.crit || 0) + (unit.gear?.crit||0)+(MyGO.Talents?.critBonus(unit,context,foe)||0)+(MyGO.Mastery?.bonus(unit,'crit',context)||0);
  }

  function critAvoidOf(unit) {
    return (unit.lck || 0)+(MyGO.Talents?.critAvoidBonus(unit)||0)+(MyGO.Mastery?.bonus(unit,'lck')||0);
  }

  /** 九项基础属性之和：HP 用上限，排除等级、派生概率及武器/地形加成。 */
  function statTotalOf(unit) {
    return ['maxHp', 'str', 'mag', 'dex', 'spd', 'lck', 'def', 'res', 'move']
      .reduce((total, key) => total + (unit[key] || 0), 0);
  }

  /** 风花雪月攻速：武器重量与辅助装备重量共同参与计算。 */
  function attackSpeedOf(unit,map,context) {
    const weight = (unit.weapon.weight || 0) + (unit.equipmentWeight || 0);
    return Math.max(0, speedOf(unit,context)+(MyGO.Mastery?.bonus(unit,'as',context)||0) - Math.max(0, weight - Math.floor(strOf(unit,map,context) / 5)));
  }

  function penalty(u,key,amount){return MyGO.Talents?.penalty(u,key,amount)??(u.status?.[key]?amount:0);}
  function speedOf(u,context={}){return Math.max(0,u.spd+(u.gear?.spd||0)+(MyGO.Mastery?.bonus(u,'spd',context)||0)-Math.max(penalty(u,'spdDown',5),penalty(u,'frostSpeedDown',6)));}
  function strOf(u,map,context){return (u.str||0)+(MyGO.Talents?.strBonus(u,map,context)||0)+(MyGO.Mastery?.bonus(u,'str',context)||0);}
  function dexOf(u){return (u.dex||0)+(MyGO.Talents?.dexBonus(u)||0)+(MyGO.Mastery?.bonus(u,'dex')||0);}
  function hitOf(u,context={},foe){return (u.weapon.absoluteHit?(u.weapon.damageType==='magic'?Math.floor((dexOf(u)+(u.lck||0)+(MyGO.Mastery?.bonus(u,'lck')||0))/2):dexOf(u)):(u.hit||0)+(MyGO.Talents?.dexBonus(u)||0))+(u.weapon.hit||0)+(u.gear?.hit||0)+(MyGO.Talents?.hitBonus(u,context,foe)||0)+(MyGO.Mastery?.bonus(u,'hit',context,foe)||0);}

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
    const context={initiatorId:attacker.id};
    const first = preview(attacker, defender, map,context);
    const reason = counterReason(attacker, defender);
    const counter = reason ? null : preview(defender, attacker, map,context);
    const attackSpeed = attackSpeedOf(attacker,map,context), defenderAttackSpeed = attackSpeedOf(defender,map,context);
    const art=MyGO.Mastery?.selectedArt(attacker);
    const order = [{attackerId:attacker.id, defenderId:defender.id, kind:'attack'}];
    const quick=MyGO.Mastery?.has(defender,'quick_riposte')&&defender.hp>defender.maxHp/2;
    const vantage=counter&&MyGO.Mastery?.has(defender,'vantage')&&defender.hp<defender.maxHp/2;
    const attackerFollow=!art&&!quick&&!attacker.weapon.noFollowup&&attackSpeed-defenderAttackSpeed>=4;
    const defenderFollow=counter&&!defender.weapon.noFollowup&&(quick||defenderAttackSpeed-attackSpeed>=4);
    if(art){for(let n=1;n<(art.hits||1);n++)order.push({attackerId:attacker.id,defenderId:defender.id,kind:'combat-art'});}
    else if(attacker.weapon.brave||attacker.weapon.type==='gauntlet')order.push({attackerId:attacker.id,defenderId:defender.id,kind:'combo'});
    const follow=[];
    if(attackerFollow){follow.push({attackerId:attacker.id,defenderId:defender.id,kind:'followup'});if(attacker.weapon.brave||attacker.weapon.type==='gauntlet')follow.push({attackerId:attacker.id,defenderId:defender.id,kind:'combo'});}
    if(counter){const response={attackerId:defender.id,defenderId:attacker.id,kind:'counter'};if(vantage)order.unshift(response);else if(MyGO.Mastery?.has(attacker,'desperation')&&attacker.hp<attacker.maxHp/2&&attackerFollow){order.push(...follow);follow.length=0;order.push(response);}else order.push(response);}
    order.push(...follow);
    if(defenderFollow)order.push({attackerId:defender.id,defenderId:attacker.id,kind:'followup'});
    const remaining=u=>u.weapon.kind==='unarmed'?99:u.weapon.kind==='spell'?(u.spellUses?.[u.weapon.id]||0):u.inventory?u.inventory.filter(i=>i.id===u.weapon.id).reduce((n,i)=>n+i.uses,0):99;
    const counts={};
    const executable=order.filter(step=>{
      const u=step.attackerId===attacker.id?attacker:defender;counts[u.id]=(counts[u.id]||0)+1;
      if(art&&u.id===attacker.id)return !MyGO.Mastery.artReason(u,art.id);
      if(counts[u.id]<=remaining(u))return true;
      if(remaining(u)>0&&MyGO.Talents?.canPreserve(u,u.weapon.kind)){step.resourceConditional=true;return true;}
      return false;
    });
    if(counter&&defender.id==='rana'&&MyGO.Talents?.active(defender,2)&&attacker.side==='enemy'){counter.critAfterDodge=clamp(counter.crit+15,0,100);}
    const attacks={};
    for(const step of executable){
      const u=step.attackerId===attacker.id?attacker:defender,p=step.attackerId===attacker.id?first:counter;
      const extra=MyGO.Talents?.canStackDamage(u)?(attacks[u.id]||0):0;
      step.damage=p.damage+extra;step.critDamage=p.critDamage+extra*C.COMBAT.critMultiplier;
      attacks[u.id]=(attacks[u.id]||0)+1;
    }
    return {...first, counter, canCounter:!!counter, counterReason:reason, attackSpeed, defenderAttackSpeed, order:executable,
      attackCount:executable.filter(s=>s.attackerId===attacker.id).length,
      counterCount:executable.filter(s=>s.attackerId===defender.id).length};
  }

  /** 锁定整场结果，在虚拟 HP 上逐击掷骰，确认前不修改任何真实单位。 */
  function rollRound(attacker, defender, map, rng) {
    const plan = forecast(attacker, defender, map),art=MyGO.Mastery?.selectedArt(attacker);
    if(MyGO.Mastery?.targetReason(attacker,defender,map))throw Error(MyGO.Mastery.targetReason(attacker,defender,map));
    const units = new Map([...(map.units||[]),attacker,defender].map(u=>[u.id,MyGO.Inventory.copy(u)]));
    const battleMap={...map,units:[...units.values()]};
    const strikes = [];let artPaid=false;
    const context={initiatorId:attacker.id,dodgedIds:new Set()};
    if(units.get(defender.id))units.get(defender.id).combatArtId=null;
    for (const step of plan.order) {
      const a = units.get(step.attackerId), b = units.get(step.defenderId);
      if (a.hp <= 0 || b.hp <= 0) break;
      if(!(art&&a.id===attacker.id&&artPaid)&&!MyGO.Inventory.usable(a))continue;
      const strike = {...roll(preview(a,b,battleMap,context),rng), kind:step.kind,
        attackerHp:a.hp, attackerMaxHp:a.maxHp,resourceId:a.inventory?a.weapon.id:null,weaponSnapshot:a.weapon};
      const usingArt=art&&a.id===attacker.id;
      if(usingArt){strike.combatArtId=art.id;strike.resourceCost=artPaid?0:art.cost;if(artPaid)strike.resourceId=null;}
      MyGO.Mastery?.strikeEffects(a,b,strike,rng,usingArt?art:null);
      strike.resourcePreserved=!!(a.inventory&&MyGO.Talents?.preserveUse(a,a.weapon.kind,rng));
      if(a.inventory&&strike.resourceId)MyGO.Inventory.consume(a,a.weapon.id,strike.resourcePreserved,strike.resourceCost||1);
      if(usingArt)artPaid=true;
      strike.healed=MyGO.Inventory.useEffects(a,b,MyGO.Magic.get(a.weapon.id),strike.finalDamage,strike.hit);
      strike.talentHealed=MyGO.Talents?.onKill(a,b,strike.hit&&strike.hpAfter<=0)||0;
      b.hp = strike.hpAfter;
      strike.angel=MyGO.Talents?.onAngel(a,b,strike,battleMap)||null;
      if(!strike.hit&&a.side==='enemy')context.dodgedIds.add(b.id);
      MyGO.Talents?.onAttack(a,b,strike.weaponType);
      strike.attackerHpAfterStrike=a.hp;
      const reverse = b.id === defender.id ? plan.counter : plan;
      strike.response = reverse;
      strike.counterReason = b.id === defender.id ? plan.counterReason : '';
      strikes.push(strike);
      if(b.hpFloor&&b.hp===b.hpFloor&&strike.finalDamage>0){strike.retreatTriggered=true;break;}
    }
    const masteryEffects=MyGO.Mastery?.afterBattle([units.get(attacker.id),units.get(defender.id)],strikes,attacker.id)||[];
    const outgoing = strikes.filter(s=>s.attackerId===attacker.id);
    return {...strikes[0], attackerId:attacker.id,defenderId:defender.id,attackerName:attacker.name,defenderName:defender.name,attackerSide:attacker.side,defenderSide:defender.side,defenderHp:defender.hp,defenderMaxHp:defender.maxHp,strikes,masteryEffects,forecast:plan, applied:false,
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
  function preview(attacker, defender, map,context={initiatorId:attacker.id}) {
    if (!attacker || !defender) throw new Error('战斗预览缺少单位');
    if (!Grid.hostile(attacker, defender)) throw new Error('不能攻击友军');

    const aw = attacker.weapon;
    const dw = defender.weapon;
    const triangle = triangleAgainst(aw, dw);
    const terrain = terrainOf(defender, map);
    const art=context.initiatorId===attacker.id?MyGO.Mastery?.selectedArt(attacker):null;
    const damageType = art?.magic?'magic':damageTypeOf(aw);
    const magic = damageType === 'magic';

    // ① 武器威力：威力 × 三角克制 × 有效特攻，四舍五入为整数。
    const triMultiplier = triangleMultiplier(triangle);
    const effectiveness = art?.effective?3:effectivenessAgainst(aw, defender);
    const weaponPower = Math.round((aw.might*(MyGO.Talents?.weaponFactor(attacker,defender)||1)+(art?.might||0)) * triMultiplier * effectiveness);

    // ② 攻击力：对应属性 + 武器威力 + 技能/骑士团等固定修正。
    //    当前角色 atkMod 均为 0，后续加技能时直接写入该字段即可。
    const atkStat = magic ? (attacker.mag || 0)+(MyGO.Mastery?.bonus(attacker,'mag',context)||0) : strOf(attacker,map,context);
    const attackMod = (attacker.atkMod || 0) + (aw.atkMod || 0) + (magic ? attacker.gear?.magic||0 : 0);
    const attack = atkStat + weaponPower + attackMod;

    // ③ 防守：物理吃守备和山地，魔法只吃魔防。
    const terrainDef = magic ? 0 : terrain.def;
    const defense = magic&&aw.ignoreRes?0:defenseOf(defender,map,magic,context);
    const damageFactor=MyGO.Talents?.counterFactor(attacker,defender,context)||1;
    const baseDamage = Math.max(C.COMBAT.minDamage, attack - defense);
    const talentDamageBonus=MyGO.Talents?.damageBonus(attacker)||0;
    const damage = Math.floor(baseDamage*(damageFactor===0.67?67:100)/100*(art?.factor||1))+talentDamageBonus;
    const critDamage = Math.floor(baseDamage*C.COMBAT.critMultiplier*(damageFactor===0.67?67:100)/100*(art?.factor||1))+talentDamageBonus*C.COMBAT.critMultiplier;

    const targetAvoid = avoidOf(defender,map,context,attacker);
    const rawHit = hitOf(attacker,context,defender)+(art?.hit||0) + triangle * C.TRIANGLE_BONUS.hit - targetAvoid;
    const hit = clamp(rawHit, C.COMBAT.minHit, C.COMBAT.maxHit);
    const baseCrit = critRateOf(attacker,context,defender)+(art?.crit||0);
    const targetCritAvoid = critAvoidOf(defender);
    const crit = clamp(baseCrit - targetCritAvoid, 0, 100);

    return {
      attackerId: attacker.id,
      defenderId: defender.id,
      attackerName: attacker.name,
      defenderName: defender.name,
      attackerSide: attacker.side,
      defenderSide: defender.side,
      weaponName: aw.name+(art?' · '+art.name:''),
      combatArtId:art?.id||null,
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
      damageFactor,
      talentDamageBonus,
      haqiBonus:MyGO.Talents?.haqiBonus(attacker,context,defender)||0,
      confident:!!MyGO.Talents?.confident(attacker,defender),
      hit,
      baseCrit,
      targetCritAvoid,
      crit,
      critDamage,
      hpFloor:defender.hpFloor||0,
      defenderHp: defender.hp,
      defenderMaxHp: defender.maxHp,
      hpAfterHit: Math.max(defender.hpFloor||0, defender.hp - damage),
      hpAfterCrit: Math.max(defender.hpFloor||0, defender.hp - critDamage)
    };
  }

  /**
   * 用 RNG 掷出命中与暴击。不修改 HP，保证“点击确认后才扣血”。
   * 判定顺序：先命中，命中后才判定暴击。
   */
  function roll(previewData, rng) {
    // Two independent 0–99 rolls; their average must be below displayed Hit.
    const hitRoll = rng.int(1, 100) - 1;
    const hitRoll2 = rng.int(1, 100) - 1;
    const critRoll = rng.int(1, 100);
    const hit = hitRoll + hitRoll2 < 2 * previewData.hit;
    const crit = hit && critRoll <= previewData.crit;
    const damage = hit
      ? (crit ? previewData.critDamage??previewData.damage*C.COMBAT.critMultiplier : previewData.damage)
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
      hitRoll2,
      critRoll,
      finalDamage: damage,
      hpAfter: Math.max(previewData.hpFloor||0, previewData.defenderHp - damage),
      applied: false
    };
  }

  /** 返回某单位站上当前地形后的防御值，供信息面板展示。 */
  function defenseOf(unit, map, magic,context={}) {
    const terrain = terrainOf(unit, map);
    const guard=MyGO.Talents?.guardBonus(unit,map)||0;
    return magic ? Math.max(0,unit.res+(unit.gear?.res||0)+(unit.status?.ward||0)+guard+(MyGO.Mastery?.bonus(unit,'res',context)||0)-Math.max(penalty(unit,'talentResDown',5),penalty(unit,'masterySealRes',6))) : Math.max(0,unit.def+(unit.gear?.def||0)+guard+(MyGO.Talents?.defBonus(unit)||0)+(MyGO.Mastery?.bonus(unit,'def',context)||0)-Math.max(penalty(unit,'defDown',5),penalty(unit,'talentResDown',5),penalty(unit,'masterySealDef',6))) + terrain.def;
  }

  MyGO.Combat = {
    dexOf,
    strOf,
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
