/* A shared level-10 talent and three personal slots, derived from level. */
(function(global){
  'use strict';
  const M=global.MyGO=global.MyGO||{};
  const LEVEL=15;
  const data={
    xueyue:{name:'剑意',description:'装备剑时力量＋5，切换其他武器或未装备时失效。'},
    subaru:{name:'爱笑女孩',description:'使用魔法或药品时，有30%几率不消耗次数；每次出手独立判定，仍须有剩余次数。'},
    tomori:{name:'行动派',description:'速度＋4。',stat:'spd',amount:4},
    rana:{name:'幸运猫',description:'回避＋5、必杀回避＋5，对物理和魔法攻击均生效。'},
    soyo:{name:'魔力觉醒',description:'魔力＋4。',stat:'mag',amount:4},
    taki:{name:'自我防备',description:'守备、魔防＋4。',stats:{def:4,res:4}},
    anon:{name:'爆头',description:'使用弓箭攻击时，必杀＋10；主动、追击和反击均生效。'},
    nina:{name:'战斗爽',description:'每击败一个敌人回复7 HP，不超过生命上限；反击击破同样生效。'},
    nijika:{name:'妈妈守护',description:'恢复HP的治疗魔法最大射程＋2。'}
  };
  const common=Object.freeze({name:'掌握战斗',description:'命中＋5、技巧＋1。技巧计入基础属性，命中加成适用于所有攻击、反击与追击。',stats:Object.freeze({dex:1})});
  const levels=[10,15,20,25];
  const data2={
    subaru:{name:'魔力延伸',description:'伤害型魔法最大射程＋1，最小射程不变；不影响辅助魔法或魔法武器。'},
    xueyue:{name:'疾风',description:'速度＋5。',stats:{spd:5}},
    tomori:{name:'有在努力',description:'获得的经验值＋30%，向上取整。'},
    rana:{name:'哈气',description:'免疫战斗中的能力削弱，包括守备、速度、移动和魔防降低；不免疫伤害或沉默。'},
    soyo:{name:'魔力护盾',description:'魔防＋5。',stats:{res:5}},
    taki:{name:'队友守护',description:'上下左右紧邻的存活队友守备、魔防＋4；不作用于自身。'},
    anon:{name:'熟能生巧',description:'技巧＋5。',stats:{dex:5}},
    nina:{name:'威吓',description:'主动发起战斗时，受到敌人的反击伤害减少25%，向下取整；包括敌方追击。'},
    nijika:{name:'同心',description:'施放治疗魔法时，自身回复目标实际恢复的HP；群体治疗按实际回复总量计算，不超过自身生命上限。'}
  };
  const data3={
    subaru:{name:'天使',description:'击败敌人且有存活队友受伤时，自身扣除2 HP（最低保留1 HP），其他存活队友各回复5 HP，不超过上限；反击击破也生效。'},
    xueyue:{name:'冰霜剑气',description:'使用剑攻击并对敌人造成实际伤害后，交战结束时使存活目标速度−6，持续两个完整的目标方回合；反击也生效，重复施加刷新、不叠加。'},
    tomori:{name:'勇气赞歌',description:'主动发起战斗时力量＋6，持续本次交战。'},
    rana:{name:'技术高手',description:'技巧＋6。',stats:{dex:6}},
    soyo:{name:'魔力打击',description:'魔法命中后，交战结束时使存活目标魔防、守备−5，持续至下次我方阶段开始；重复命中刷新，不叠加。'},
    taki:{name:'护灯',description:'与高松灯同时存活在场时，灯守备、魔防＋4，自己力量＋4；可与队友守护叠加。'},
    anon:{name:'幸福者退让',description:'完成行动且本次未攻击时，可与上下左右相邻的一名队友交换位置，每次行动限一次；双方须能停留在交换后的地形。'},
    nina:{name:'拳拳到肉',description:'仅使用拳套或空手攻击时发动：单个回合内每出手一次，后续拳套或空手攻击伤害额外＋1，可累积；连击、追击、反击及落空均计次，加伤受暴击倍率放大，下回合开始清零。'},
    nijika:{name:'量大管饱',description:'治疗魔法回复量＋75%，向上取整，再按目标缺失HP结算。'}
  };
  const catalogues=[null,data,data2,data3];
  for(const catalogue of catalogues.slice(1)){
    for(const t of Object.values(catalogue)){if(t.stats)Object.freeze(t.stats);Object.freeze(t);}
    Object.freeze(catalogue);
  }
  function get(u,slot=1){
    const id=typeof u==='string'?u:u?.id;
    return slot===0?(M.GrowthData?.personal[id]||data[id]?common:null):catalogues[slot]?.[id]||null;
  }
  function active(u,slot=1){return !!get(u,slot)&&u.side!=='enemy'&&u.level>=levels[slot];}
  function list(u){return [0,1,2,3].filter(slot=>get(u,slot)).map(slot=>({slot,level:levels[slot],...get(u,slot),active:active(u,slot)}));}
  // Permanent stat bonuses are separate from random growth. Reconstructing a
  // save from base + gains derives the bonus once, never accumulating on reload.
  function sync(u){
    const first=get(u),before=u._talentBonuses||((u._talent1Bonus&&first?.stat)?{[first.stat]:u._talent1Bonus}:{}),next={};
    for(const t of list(u).filter(t=>t.active))for(const [k,n]of Object.entries(t.stats||(t.stat?{[t.stat]:t.amount}:{})))next[k]=(next[k]||0)+n;
    for(const k of new Set([...Object.keys(before),...Object.keys(next)]))u[k]+=(next[k]||0)-(before[k]||0);
    u._talentBonuses=next;u._talent1Bonus=active(u)&&first?.stat?first.amount:0;
    // Cleanse legacy stat penalties as soon as Haqi awakens or a save is read.
    if(immune(u)&&u.status)for(const k of ['defDown','spdDown','moveDown','talentResDown','frostSpeedDown','frostFresh','masterySealDef','masterySealRes'])delete u.status[k];
  }
  function immune(u){return active(u,2)&&u.id==='rana';}
  function penalty(u,key,amount){return immune(u)?0:(u.status?.[key]?amount:0);}
  function experience(u,amount){return active(u,2)&&u.id==='tomori'?Math.ceil(amount*13/10):amount;}
  function healingSpell(s){return !!s&&['heal','fortify'].includes(s.effect);}
  function rangeBonus(u,s){
    if(u.id==='subaru'&&active(u,2)&&s?.kind==='spell'&&!s.support)return 1;
    return u.id==='nijika'&&active(u,1)&&healingSpell(s)?2:0;
  }
  function canPreserve(u,kind){return u?.id==='subaru'&&active(u)&&['spell','consumable'].includes(kind);}
  function preserveUse(u,kind,rng){return canPreserve(u,kind)&&rng.int(1,100)<=30;}
  function healingAmount(u,s,amount){return active(u,3)&&u.id==='nijika'&&healingSpell(s)?Math.ceil(amount*7/4):amount;}
  function dexBonus(){return 0;}
  function critBonus(u){return active(u)&&u.id==='anon'&&u.weapon?.type==='bow'?10:0;}
  function critAvoidBonus(u){return active(u)&&u.id==='rana'?5:0;}
  function canStackDamage(u,weaponType=u?.weapon?.type){return u?.id==='nina'&&active(u,3)&&weaponType==='gauntlet';}
  function damageBonus(u){return canStackDamage(u)?(u.talentAttackCount||0):0;}
  function onAttack(u,target,weaponType=u?.weapon?.type){
    if(canStackDamage(u,weaponType)&&M.Grid.hostile(u,target))u.talentAttackCount=(u.talentAttackCount||0)+1;
  }
  function hitBonus(u){return active(u,0)?5:0;}
  function avoidBonus(u){return active(u)&&u.id==='rana'?5:0;}
  function guardBonus(u,map){
    if(!u||u.dead||u.hp<=0||u.escaped)return 0;
    const aura=(map?.units||[]).some(t=>t.id==='taki'&&active(t,2)&&present(t)&&
      t.id!==u.id&&!M.Grid.hostile(t,u)&&Math.abs(t.x-u.x)+Math.abs(t.y-u.y)===1)?4:0;
    return aura+(u.id==='tomori'&&bond(map,u)?4:0);
  }
  function present(u){return !!u&&!u.dead&&!u.escaped&&u.hp>0;}
  function bond(map,unit){
    const units=map?.units||[],t=units.find(u=>u.id==='taki'),lamp=units.find(u=>u.id==='tomori');
    return present(t)&&active(t,3)&&present(lamp)&&lamp.side!=='enemy'&&!M.Grid.hostile(t,lamp)&&(!unit||!M.Grid.hostile(t,unit));
  }
  function strBonus(u,map,context){return (u.id==='taki'&&bond(map,u)?4:0)+(u.id==='tomori'&&active(u,3)&&context?.initiatorId===u.id?6:0)+
    (u.id==='xueyue'&&active(u)&&u.weapon?.type==='sword'?5:0);}
  function counterFactor(attacker,defender,context){return attacker.side==='enemy'&&defender.id==='nina'&&active(defender,2)&&context?.initiatorId===defender.id?0.75:1;}
  function afterMagic(attacker,target,hit,magic){
    if(!hit||!magic||attacker.id!=='soyo'||!active(attacker,3)||!present(target)||!M.Grid.hostile(attacker,target)||immune(target))return false;
    target.status.talentResDown=2;return true;
  }
  function afterDamage(attacker,target,damage,hit,phase,weaponType=attacker.weapon?.type){
    if(weaponType!=='sword'||!hit||damage<=0||attacker.id!=='xueyue'||!active(attacker,3)||!present(target)||!M.Grid.hostile(attacker,target)||immune(target))return false;
    target.status.frostSpeedDown=2;
    // A counter applies midway through the target's phase. Count the next two
    // complete phases rather than consuming one turn immediately after combat.
    if(phase===target.side)target.status.frostFresh=1;else delete target.status.frostFresh;
    return true;
  }
  function expireFrost(u){
    if(u.status.frostFresh){delete u.status.frostFresh;return;}
    if(u.status.frostSpeedDown&&--u.status.frostSpeedDown===0)delete u.status.frostSpeedDown;
  }
  function heal(u,amount){const restored=Math.max(0,Math.min(amount,u.maxHp-u.hp));u.hp+=restored;return restored;}
  function onKill(u,target,killed){
    return killed&&active(u)&&u.id==='nina'&&!u.dead&&u.hp>0&&target.side==='enemy'?heal(u,7):0;
  }
  function onAngel(u,target,killed,map){
    if(!killed||u?.id!=='subaru'||!active(u,3)||!present(u)||target.side!=='enemy')return null;
    const teammates=(map?.units||[]).filter(t=>t.id!==u.id&&present(t)&&!M.Grid.hostile(u,t));
    if(!teammates.some(t=>t.hp<t.maxHp))return null;
    const cost=Math.min(2,u.hp-1);u.hp-=cost;
    return {cost,healing:teammates.map(t=>({id:t.id,amount:heal(t,5)})).filter(t=>t.amount>0)};
  }
  function onSupport(u,spell,changes){
    return active(u,2)&&u.id==='nijika'&&['heal','fortify'].includes(spell.effect)?
      heal(u,changes.reduce((sum,c)=>sum+Math.max(0,c.amount||0),0)):0;
  }
  M.Talents=Object.freeze({LEVEL,common,data,data2,data3,levels:Object.freeze(levels),get,active,list,sync,immune,penalty,experience,
    healingSpell,rangeBonus,canPreserve,preserveUse,healingAmount,dexBonus,critBonus,critAvoidBonus,canStackDamage,damageBonus,onAttack,hitBonus,avoidBonus,guardBonus,bond,strBonus,counterFactor,afterMagic,afterDamage,expireFrost,onKill,onAngel,onSupport});
})(window);
