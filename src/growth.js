/* FE3H experience and random growth rules. Source details: docs/GROWTH.md. */
(function(global){
  'use strict';
  const M=global.MyGO,D=M.GrowthData,keys=D.keys;
  const MAX_LEVEL=99;
  // Verified requirements through Lv.50; extrapolate the 1.05 curve thereafter.
  const requirements=[0,100,110,121,133,146,161,177,194,214,235,259,285,313,345,379,417,459,505,555,611,
    672,716,752,790,829,871,914,960,1008,1059,1111,1167,1225,1287,1351,1419,1490,1564,1642,1725,1811,1901,1996,2096,2201,2311,2427,2548,2676,2809];
  // Hard mode level-difference coefficients, enemy level minus player level.
  const hardFactors=[0,5,5,5,5,5,5,5,5,5,5,5,5,5,10,20,30,40,50,60,70,80,85,90,95,100,100,100,105,105,110,110,110,110,110,110,115,120,130,140,150];
  const supportFactors={heal:1,recover:1.5,physic:1.5,restore:1.5,ward:1.5,silence:2,rescue:2,fortify:3,warp:3};
  function required(level){return level>=MAX_LEVEL?0:requirements[level]??Math.floor(716.8*Math.pow(1.05,level-22));}
  function personalRates(u){return D.personal[u.id]?.rates||{};}
  function eligible(u){return !!D.personal[u?.id]&&u.side==='player'&&!u.dead&&u.hp>0;}
  function rates(u){const personal=personalRates(u),job=D.classes[u.classId]||{};
    return Object.fromEntries(keys.map(k=>[k,Math.max(0,(personal[k]||0)+(job[k]||0))]));}
  function seed(id,value){let n=value>>>0;for(const c of id)n=Math.imul(n^c.charCodeAt(0),16777619)>>>0;return n||1;}
  function init(u){
    u.exp=0;u.growthGains=Object.fromEntries(keys.map(k=>[k,0]));
    u.growthRngState=seed(u.id,2166136261);
    u.growthBase={level:u.level,stats:Object.fromEntries(keys.map(k=>[k,u[k]]))};
    M.Talents?.sync(u);
  }
  function pack(u){return {version:1,level:u.level,exp:u.exp,gains:{...u.growthGains},rngState:u.growthRngState};}
  function restore(u,s,fullHp=false){
    if(s===undefined)return; // Old saves start at template level, with zero EXP.
    const base=u.growthBase,levels=s?.level-base.level;
    if(!s||s.version!==1||!Number.isInteger(s.level)||s.level<base.level||s.level>MAX_LEVEL||
      !Number.isInteger(s.exp)||s.exp<0||(s.level===MAX_LEVEL?s.exp!==0:s.exp>=required(s.level))||
      !Number.isInteger(s.rngState)||s.rngState<1||s.rngState>0xffffffff||
      !s.gains||keys.some(k=>!Number.isInteger(s.gains[k])||s.gains[k]<0||s.gains[k]>levels*3))throw Error('存档成长数据无效');
    u.level=s.level;u.exp=s.exp;u.growthRngState=s.rngState;
    u.growthGains=Object.fromEntries(keys.map(k=>[k,s.gains[k]]));
    for(const k of keys)u[k]=base.stats[k]+s.gains[k];
    u._talent1Bonus=0;u._talentBonuses={};M.Talents?.sync(u);
    if(fullHp)u.hp=u.maxHp;
  }
  function rollLevel(u,rng){
    const total=rates(u),possible=keys.filter(k=>total[k]>0).length;
    let gains;
    // Companions use the student rule: reroll levels with fewer than two increases.
    do{gains=Object.fromEntries(keys.map(k=>[k,Math.floor(total[k]/100)+(rng.int(0,99)<total[k]%100?1:0)]));}
    while(Object.values(gains).filter(n=>n>0).length<Math.min(2,possible));
    return gains;
  }
  function award(u,amount,multiplier=1){
    if(!eligible(u)||u.level>=MAX_LEVEL||!Number.isInteger(amount)||amount<=0)return null;
    // One action grants at most the current level's full requirement; excess carries over.
    const baseAmount=Math.min(amount,required(u.level))*multiplier;
    const gained=M.Talents?.experience(u,baseAmount)??baseAmount,before={level:u.level,exp:u.exp,required:required(u.level)};
    u.exp+=gained;const levels=[],rng=M.RNG.restore(u.growthRngState);
    while(u.level<MAX_LEVEL&&u.exp>=required(u.level)){
      u.exp-=required(u.level);const old=Object.fromEntries(keys.map(k=>[k,u[k]])),gains=rollLevel(u,rng);
      const hadTalents=M.Talents?.list(u).filter(t=>t.active).map(t=>t.slot)||[];
      u.level++;for(const k of keys){u[k]+=gains[k];u.growthGains[k]+=gains[k];}
      M.Talents?.sync(u);
      // Preserve missing HP; growth does not fully heal an injured unit.
      u.hp+=gains.maxHp;
      const learned=M.Inventory.learn(u);M.Inventory.sync(u);
      const awakenings=M.Talents?.list(u).filter(t=>t.active&&!hadTalents.includes(t.slot))||[],awakened=awakenings[0]||null;
      levels.push({level:u.level,before:old,gains,learned,awakened,awakenings,after:Object.fromEntries(keys.map(k=>[k,u[k]]))});
    }
    u.growthRngState=rng.serialize();if(u.level===MAX_LEVEL)u.exp=0;
    return {unitId:u.id,name:u.name,gained,before,after:{level:u.level,exp:u.exp,required:required(u.level)},levels};
  }
  function hardFactor(diff){return hardFactors[Math.max(-20,Math.min(20,diff))+20]/100;}
  function killExp(u,enemy){
    // Custom foes are assigned explicit FE3H EXP bases by their authored template.
    const base=enemy.expClassBase||30,monster=enemy.tags?.includes('monster');
    return base*(enemy.level+9)/10*hardFactor(enemy.level-u.level)*(enemy.boss||monster?2:1);
  }
  function combatExp(u,enemy,damage,killed){
    if(damage<=0&&!killed)return 0;
    return Math.max(0,Math.ceil(killExp(u,enemy)*(killed?1:Math.min(damage,enemy.maxHp)/enemy.maxHp/2)-1e-9));
  }
  function turnFactor(turn){if(turn<=20)return 1;return [0.95,0.9,0.85,0.8,0.7,0.6,0.5,0.4,0.3][Math.min(8,Math.floor((turn-21)/5))];}
  function supportExp(u,id,turn){return Math.max(0,Math.ceil((u.level+9)*(supportFactors[id]||0)*turnFactor(turn)-1e-9));}
  M.Growth=Object.freeze({MAX_LEVEL,required,eligible,personalRates,rates,seed,init,pack,restore,rollLevel,award,hardFactor,killExp,combatExp,supportExp,turnFactor});
})(window);
