/* Three personal talent slots, derived from level rather than saved unlock flags. */
(function(global){
  'use strict';
  const M=global.MyGO=global.MyGO||{};
  const LEVEL=15;
  const data={
    xueyue:{name:'剑意',description:'装备剑时力量＋3，切换其他武器或未装备时失效。'},
    subaru:{name:'爱笑女孩',description:'使用魔法或药品时，有25%几率不消耗次数；每次出手独立判定，仍须有剩余次数。'},
    tomori:{name:'行动派',description:'速度＋2。',stat:'spd',amount:2},
    rana:{name:'幸运猫',description:'对所有攻击的闪避率提升5个百分点。'},
    soyo:{name:'魔力觉醒',description:'魔力＋2。',stat:'mag',amount:2},
    taki:{name:'队友守护',description:'上下左右紧邻的存活队友守备、魔防＋1；不作用于自身。'},
    anon:{name:'爆头',description:'使用弓箭攻击时，技巧＋3，参与命中与暴击计算。'},
    nina:{name:'战斗爽',description:'每击败一个敌人回复5 HP，不超过生命上限；反击击破同样生效。'},
    nijika:{name:'同心',description:'施放治疗魔法时，自身回复目标实际恢复的HP；群体治疗按实际回复总量计算，不超过自身生命上限。'}
  };
  const levels=[0,15,20,25];
  const data2={
    subaru:{name:'魔力延伸',description:'伤害型魔法最大射程＋1，最小射程不变；不影响辅助魔法或魔法武器。'},
    xueyue:{name:'疾风',description:'速度＋2。',stats:{spd:2}},
    tomori:{name:'有在努力',description:'获得的经验值＋20%，向上取整。'},
    rana:{name:'哈气',description:'免疫战斗中的能力削弱，包括守备、速度、移动和魔防降低；不免疫伤害或沉默。'},
    soyo:{name:'魔力护盾',description:'魔防＋2。',stats:{res:2}},
    taki:{name:'自我防备',description:'守备、魔防＋1。',stats:{def:1,res:1}},
    anon:{name:'熟能生巧',description:'技巧＋2。',stats:{dex:2}},
    nina:{name:'威吓',description:'主动发起战斗时，受到敌人的反击伤害×80%，向下取整；包括敌方追击。'},
    nijika:{name:'妈妈守护',description:'恢复HP的治疗魔法最大射程＋2。'}
  };
  const data3={
    subaru:{name:'天使',description:'击败敌人且有存活队友受伤时，自身扣除2 HP（最低保留1 HP），其他存活队友各回复5 HP，不超过上限；反击击破也生效。'},
    xueyue:{name:'冰霜剑气',description:'使用剑攻击并对敌人造成实际伤害后，交战结束时使存活目标速度−3，持续两个完整的目标方回合；反击也生效，重复施加刷新、不叠加。'},
    tomori:{name:'勇气赞歌',description:'主动发起战斗时力量＋3，持续本次交战。'},
    rana:{name:'技术高手',description:'技巧＋2。',stats:{dex:2}},
    soyo:{name:'魔力打击',description:'魔法命中后，交战结束时使存活目标魔防−2，持续至下次我方阶段开始；重复命中刷新，不叠加。'},
    taki:{name:'护灯',description:'与高松灯同时存活在场时，灯守备、魔防＋1，自己力量＋1；可与队友守护叠加。'},
    anon:{name:'幸福者退让',description:'完成行动且本次未攻击时，可与上下左右相邻的一名队友交换位置，每次行动限一次；双方须能停留在交换后的地形。'},
    nina:{name:'天赋异禀',description:'技巧＋2。',stats:{dex:2}},
    nijika:{name:'量大管饱',description:'治疗魔法回复量＋20%，向上取整，再按目标缺失HP结算。'}
  };
  const catalogues=[null,data,data2,data3];
  for(const catalogue of catalogues.slice(1)){
    for(const t of Object.values(catalogue)){if(t.stats)Object.freeze(t.stats);Object.freeze(t);}
    Object.freeze(catalogue);
  }
  function get(u,slot=1){return catalogues[slot]?.[typeof u==='string'?u:u?.id]||null;}
  function active(u,slot=1){return !!get(u,slot)&&u.side!=='enemy'&&u.level>=levels[slot];}
  function list(u){return [1,2,3].filter(slot=>get(u,slot)).map(slot=>({slot,level:levels[slot],...get(u,slot),active:active(u,slot)}));}
  // Permanent stat bonuses are separate from random growth. Reconstructing a
  // save from base + gains derives the bonus once, never accumulating on reload.
  function sync(u){
    const first=get(u),before=u._talentBonuses||((u._talent1Bonus&&first?.stat)?{[first.stat]:u._talent1Bonus}:{}),next={};
    for(const t of list(u).filter(t=>t.active))for(const [k,n]of Object.entries(t.stats||(t.stat?{[t.stat]:t.amount}:{})))next[k]=(next[k]||0)+n;
    for(const k of new Set([...Object.keys(before),...Object.keys(next)]))u[k]+=(next[k]||0)-(before[k]||0);
    u._talentBonuses=next;u._talent1Bonus=active(u)&&first?.stat?first.amount:0;
    // Cleanse legacy stat penalties as soon as Haqi awakens or a save is read.
    if(immune(u)&&u.status)for(const k of ['defDown','spdDown','moveDown','talentResDown','frostSpeedDown','frostFresh'])delete u.status[k];
  }
  function immune(u){return active(u,2)&&u.id==='rana';}
  function penalty(u,key,amount){return immune(u)?0:(u.status?.[key]?amount:0);}
  function experience(u,amount){return active(u,2)&&u.id==='tomori'?Math.ceil(amount*6/5):amount;}
  function healingSpell(s){return !!s&&['heal','fortify'].includes(s.effect);}
  function rangeBonus(u,s){
    if(!active(u,2))return 0;
    if(u.id==='subaru'&&s?.kind==='spell'&&!s.support)return 1;
    return u.id==='nijika'&&healingSpell(s)?2:0;
  }
  function canPreserve(u,kind){return u?.id==='subaru'&&active(u)&&['spell','consumable'].includes(kind);}
  function preserveUse(u,kind,rng){return canPreserve(u,kind)&&rng.int(1,100)<=25;}
  function healingAmount(u,s,amount){return active(u,3)&&u.id==='nijika'&&healingSpell(s)?Math.ceil(amount*6/5):amount;}
  function dexBonus(u){return active(u)&&u.id==='anon'&&u.weapon?.type==='bow'?3:0;}
  function avoidBonus(u){return active(u)&&u.id==='rana'?5:0;}
  function guardBonus(u,map){
    if(!u||u.dead||u.hp<=0||u.escaped)return 0;
    const aura=(map?.units||[]).some(t=>t.id==='taki'&&active(t)&&present(t)&&
      t.id!==u.id&&!M.Grid.hostile(t,u)&&Math.abs(t.x-u.x)+Math.abs(t.y-u.y)===1)?1:0;
    return aura+(u.id==='tomori'&&bond(map,u)?1:0);
  }
  function present(u){return !!u&&!u.dead&&!u.escaped&&u.hp>0;}
  function bond(map,unit){
    const units=map?.units||[],t=units.find(u=>u.id==='taki'),lamp=units.find(u=>u.id==='tomori');
    return present(t)&&active(t,3)&&present(lamp)&&lamp.side!=='enemy'&&!M.Grid.hostile(t,lamp)&&(!unit||!M.Grid.hostile(t,unit));
  }
  function strBonus(u,map,context){return (u.id==='taki'&&bond(map,u)?1:0)+(u.id==='tomori'&&active(u,3)&&context?.initiatorId===u.id?3:0)+
    (u.id==='xueyue'&&active(u)&&u.weapon?.type==='sword'?3:0);}
  function counterFactor(attacker,defender,context){return attacker.side==='enemy'&&defender.id==='nina'&&active(defender,2)&&context?.initiatorId===defender.id?0.8:1;}
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
    return killed&&active(u)&&u.id==='nina'&&!u.dead&&u.hp>0&&target.side==='enemy'?heal(u,5):0;
  }
  function onAngel(u,target,killed,map){
    if(!killed||u?.id!=='subaru'||!active(u,3)||!present(u)||target.side!=='enemy')return null;
    const teammates=(map?.units||[]).filter(t=>t.id!==u.id&&present(t)&&!M.Grid.hostile(u,t));
    if(!teammates.some(t=>t.hp<t.maxHp))return null;
    const cost=Math.min(2,u.hp-1);u.hp-=cost;
    return {cost,healing:teammates.map(t=>({id:t.id,amount:heal(t,5)})).filter(t=>t.amount>0)};
  }
  function onSupport(u,spell,changes){
    return active(u)&&u.id==='nijika'&&['heal','fortify'].includes(spell.effect)?
      heal(u,changes.reduce((sum,c)=>sum+Math.max(0,c.amount||0),0)):0;
  }
  M.Talents=Object.freeze({LEVEL,data,data2,data3,levels:Object.freeze(levels),get,active,list,sync,immune,penalty,experience,
    healingSpell,rangeBonus,canPreserve,preserveUse,healingAmount,dexBonus,avoidBonus,guardBonus,bond,strBonus,counterFactor,afterMagic,afterDamage,expireFrost,onKill,onAngel,onSupport});
})(window);
