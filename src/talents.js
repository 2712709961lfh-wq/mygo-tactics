/* Personal talent slot 1: level 15 awakening. No random rolls or save flags. */
(function(global){
  'use strict';
  const M=global.MyGO=global.MyGO||{};
  const LEVEL=15;
  const data={
    tomori:{name:'行动者',description:'速度＋2。',stat:'spd',amount:2},
    rana:{name:'幸运猫',description:'对所有攻击的闪避率提升5个百分点。'},
    soyo:{name:'魔力觉醒',description:'魔力＋2。',stat:'mag',amount:2},
    taki:{name:'队友守护',description:'上下左右紧邻的存活队友守备、魔防＋1；不作用于自身。'},
    anon:{name:'爆头',description:'使用弓箭攻击时，技巧＋3，参与命中与暴击计算。'},
    nina:{name:'战斗爽',description:'每击败一个敌人回复5 HP，不超过生命上限；反击击破同样生效。'},
    nijika:{name:'同心',description:'施放治疗魔法时，自身回复目标实际恢复的HP；群体治疗按实际回复总量计算，不超过自身生命上限。'}
  };
  for(const t of Object.values(data))Object.freeze(t);
  Object.freeze(data);
  function get(u){return data[typeof u==='string'?u:u?.id]||null;}
  function active(u){return !!get(u)&&u.side!=='enemy'&&u.level>=LEVEL;}
  // Permanent stat bonuses are separate from random growth. Reconstructing a
  // save from base + gains derives the bonus once, never accumulating on reload.
  function sync(u){
    const t=get(u),before=u._talent1Bonus||0,next=active(u)&&t.stat?t.amount:0;
    if(t?.stat)u[t.stat]+=next-before;
    u._talent1Bonus=next;
  }
  function dexBonus(u){return active(u)&&u.id==='anon'&&u.weapon?.type==='bow'?3:0;}
  function avoidBonus(u){return active(u)&&u.id==='rana'?5:0;}
  function guardBonus(u,map){
    if(!u||u.dead||u.hp<=0||u.escaped)return 0;
    return (map?.units||[]).some(t=>t.id==='taki'&&active(t)&&!t.dead&&!t.escaped&&t.hp>0&&
      t.id!==u.id&&!M.Grid.hostile(t,u)&&Math.abs(t.x-u.x)+Math.abs(t.y-u.y)===1)?1:0;
  }
  function heal(u,amount){const restored=Math.max(0,Math.min(amount,u.maxHp-u.hp));u.hp+=restored;return restored;}
  function onKill(u,target,killed){
    return killed&&active(u)&&u.id==='nina'&&!u.dead&&u.hp>0&&target.side==='enemy'?heal(u,5):0;
  }
  function onSupport(u,spell,changes){
    return active(u)&&u.id==='nijika'&&['heal','fortify'].includes(spell.effect)?
      heal(u,changes.reduce((sum,c)=>sum+Math.max(0,c.amount||0),0)):0;
  }
  M.Talents=Object.freeze({LEVEL,data,get,active,sync,dexBonus,avoidBonus,guardBonus,onKill,onSupport});
})(window);
