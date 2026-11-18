/* Class mastery facts and executable rewards. Sources and adaptations: docs/CLASS-MASTERY.md. */
(function(global){
  'use strict';
  const M=global.MyGO;
  const abilities={},arts={},jobs={};
  function ability(id,name,description,stats){abilities[id]=Object.freeze({id,name,description,stats:stats?Object.freeze(stats):null,kind:'ability'});}
  function art(id,name,description,options){arts[id]=Object.freeze({id,name,description,kind:'art',...options});}
  ability('hp5','HP上限＋5','生命上限＋5；平民与贵族的同名奖励只计算一次。',{maxHp:5});
  for(const [id,name,key] of [['speed2','速度＋2','spd'],['defense2','防守＋2','def'],['strength2','力量＋2','str'],['magic2','魔力＋2','mag']])ability(id,name,name+'。',{[key]:2});
  ability('special_dance','特殊舞蹈','使用舞蹈后，目标技巧、速度、幸运＋4，持续至当前我方阶段结束。');
  ability('vantage','埋伏','HP低于50%，受敌攻击且能反击时，抢先反击。');
  ability('steal','偷窃','可偷取相邻、速度低于自己的敌人的非武器、非魔法物品；占用一次行动。');
  ability('armored_blow','金刚一击','主动发起交战时守备＋6。');
  ability('unarmed_combat','空手格斗','可选择不消耗耐久的空手格斗；骑乘与飞行职业不能使用。');
  ability('desperation','强攻','HP低于50%，主动交战且可以追击时，追击提前至敌人反击之前。');
  ability('death_blow','鬼神一击','主动发起交战时力量＋6。');
  ability('hit20','命中＋20','所有攻击命中＋20。');
  ability('fiendish_blow','魔神一击','主动发起交战时魔力＋6。');
  ability('poison_strike','蛇毒','主动交战命中存活敌人后，使其损失20%生命上限的HP；不会致死。');
  ability('miracle','祈祷','HP至少2时，受到致命伤害以幸运％概率保留1 HP。');
  ability('darting_blow','飞燕一击','主动发起交战时攻速＋6。');
  for(const [id,name,key,label] of [['defiant_str','力量觉醒','str','力量'],['defiant_def','防守觉醒','def','守备'],['defiant_spd','速度觉醒','spd','速度'],['defiant_mag','魔力觉醒','mag','魔力'],['defiant_res','魔防觉醒','res','魔防']])ability(id,name,'HP低于25%时'+label+'＋8。');
  ability('lethality','灭杀','命中后，以技巧×0.25％概率直接击倒普通敌人；首领、魔物与剧情保护单位免疫。');
  ability('pavise','大盾','受剑、枪、斧或格斗攻击时，以技巧％概率将本次伤害减半。');
  ability('aegis','圣盾','受弓或魔法攻击时，以技巧％概率将本次伤害减半。');
  ability('seal_defense','防守封锁','交战造成伤害后，目标守备−6，持续至目标下一次所属阶段结束。');
  ability('wrath','愤怒','HP低于50%且受敌攻击时，必杀＋50。');
  ability('tomebreaker','破魔者','使用格斗对抗魔法时，命中与回避＋20。');
  ability('bowbreaker','破弓者','使用魔法对抗弓时，命中与回避＋20。');
  ability('lifetaker','生命吸收','击破敌人后，回复本次实际伤害50%的HP。');
  ability('renewal','回复','我方阶段开始时回复20%生命上限的HP。');
  ability('defiant_avoid','回避觉醒','HP低于25%时回避＋30。');
  ability('defiant_crit','必杀觉醒','HP低于25%时必杀＋50。');
  ability('warding_blow','明镜一击','主动发起交战时魔防＋6。');
  ability('quick_riposte','回击','HP高于50%且受敌攻击时，自身必定追击，并阻止敌人的普通追击。');
  ability('seal_resistance','魔防封锁','交战造成伤害后，目标魔防−6，持续至目标下一次所属阶段结束。');
  ability('duelists_blow','清流一击','主动发起交战时回避＋20。');
  ability('brawl_avoid','格斗回避＋20','使用格斗武器或空手格斗时回避＋20。');
  ability('transmute','魔力转换','敌方阶段受到命中的魔法攻击后，力量、魔力、技巧、速度、幸运、守备、魔防＋3，持续至下一次我方阶段结束。');
  ability('uncanny_blow','慧眼一击','主动发起交战时命中＋30。');
  art('reposition','带回','将相邻同伴移到自身另一侧的相邻格。',{assist:true,range:1});
  art('shove','冲撞','将相邻同伴向远离自己的方向推1格。',{assist:true,range:1});
  art('draw_back','拉近','自己后退1格，并将相邻同伴拉到原来所在格。',{assist:true,range:1});
  art('smite','重击','将相邻同伴向远离自己的方向推2格；全程须可通行。',{assist:true,range:1});
  art('triangle_attack','三角攻阵','目标周围有包含自己在内的3名我方飞行单位时可用；威力＋8、命中＋30、必杀＋40。',{type:'lance',cost:3,might:8,hit:30,crit:40,range:[1,1]});
  art('astra','流星','剑连续攻击5次，每击伤害为通常伤害的30%；不能普通追击。',{type:'sword',cost:9,hits:5,factor:.3,exclusive:['swordmaster'],range:[1,1]});
  art('assassinate','暗杀','剑战技，命中＋15；命中后以技巧％概率击倒普通敌人，首领免疫。',{type:'sword',cost:4,hit:15,exclusive:['assassin'],range:[1,1]});
  art('hunters_volley','猎箭齐发','弓连续攻击2次；威力＋1、命中＋15、必杀＋10，射程2–3。',{type:'bow',cost:5,hits:2,might:1,hit:15,crit:10,exclusive:['sniper'],range:[2,3]});
  art('fierce_iron_fist','猛烈铁拳','格斗连续攻击3次；威力＋1、必杀＋10。',{type:'gauntlet',cost:5,hits:3,might:1,crit:10,exclusive:['grappler'],range:[1,1]});
  art('war_masters_strike','战鬼一击','斧战技，威力＋3、命中＋30，对所有敌人具有武器威力特效。',{type:'axe',cost:5,might:3,hit:30,effective:true,exclusive:['war_master'],range:[1,1]});
  art('foul_play','移形换位','与1–5格内的一名同伴交换位置，双方落点须可通行。',{assist:true,range:5,exclusive:['trickster']});
  art('pneuma_gale','猛烈气旋','格斗魔法攻击，威力＋7、命中＋10，射程1–2。',{type:'gauntlet',cost:3,might:7,hit:10,magic:true,exclusive:['war_monk','war_cleric'],range:[1,2]});
  const rows={
    commoner:['hp5'],noble:['hp5'],myrmidon:['speed2'],soldier:['defense2','reposition'],fighter:['strength2','shove'],monk:['magic2','draw_back'],
    dancer:['special_dance'],mercenary:['vantage'],thief:['steal'],armored_knight:['armored_blow','smite'],cavalier:['desperation'],brigand:['death_blow'],archer:['hit20'],brawler:['unarmed_combat'],mage:['fiendish_blow'],dark_mage:['poison_strike'],priest:['miracle'],pegasus_knight:['darting_blow','triangle_attack'],
    hero:['defiant_str'],swordmaster:['astra'],assassin:['lethality','assassinate'],fortress_knight:['pavise'],paladin:['aegis'],wyvern_rider:['seal_defense'],warrior:['wrath'],sniper:['hunters_volley'],grappler:['tomebreaker','fierce_iron_fist'],warlock:['bowbreaker'],dark_bishop:['lifetaker'],bishop:['renewal'],
    falcon_knight:['defiant_avoid'],wyvern_lord:['defiant_crit'],mortal_savant:['warding_blow'],great_knight:['defiant_def'],bow_knight:['defiant_spd'],dark_knight:['seal_resistance'],holy_knight:['defiant_res'],gremory:['defiant_mag'],war_master:['quick_riposte','war_masters_strike'],trickster:['duelists_blow','foul_play'],war_monk:['brawl_avoid','pneuma_gale'],war_cleric:['brawl_avoid','pneuma_gale'],dark_flier:['transmute'],valkyrie:['uncanny_blow']
  };
  for(const job of M.Classes.items){const required=job.id==='dancer'||job.dlc?150:({base:20,beginner:60,intermediate:100,advanced:150,master:200})[job.tier];
    jobs[job.id]=Object.freeze({id:job.id,required,rewards:Object.freeze(rows[job.id].map(id=>abilities[id]||arts[id]))});}
  Object.freeze(abilities);Object.freeze(arts);Object.freeze(jobs);
  function get(id){return jobs[id]||null;}
  function progress(u,id=u?.classId){const j=get(id);if(!j)return null;const xp=u.classXp?.[id]||0;return {...j,xp,mastered:xp>=j.required};}
  function starter(u){return u?.side!=='enemy'&&!!M.GrowthData?.personal[u?.id];}
  function learned(u){return [...new Set([...(starter(u)?['hp5']:[]),...Object.keys(u?.classXp||{}).filter(id=>get(id)&&u.classXp[id]>=get(id).required).flatMap(id=>get(id).rewards.map(r=>r.id))])];}
  function has(u,id){return u?.side!=='enemy'&&!!u?.masteryEquipped?.includes(id);}
  function sync(u){
    const before=u._masteryBonuses||{},next={};
    for(const id of u.masteryEquipped||[])for(const [k,n] of Object.entries(abilities[id]?.stats||{}))next[k]=(next[k]||0)+n;
    for(const k of new Set([...Object.keys(before),...Object.keys(next)]))u[k]+=(next[k]||0)-(before[k]||0);
    u._masteryBonuses=next;u.hp=Math.min(u.hp,u.maxHp);
  }
  function init(u){
    u.classXp={};u.masteryEquipped=starter(u)?['hp5']:[];u.combatArtId=null;u._masteryBonuses={};
    const full=u.hp===u.maxHp;sync(u);if(full)u.hp=u.maxHp;
  }
  function pack(u){return {version:1,starterVersion:1,xp:{...u.classXp},equipped:(u.masteryEquipped||[]).slice()};}
  function restore(u,s,fullHp=false){
    if(s===undefined){u.classXp={};u.masteryEquipped=starter(u)?['hp5']:[];sync(u);if(fullHp)u.hp=u.maxHp;return;}
    if(!s||s.version!==1||s.starterVersion!==undefined&&s.starterVersion!==1||!s.xp||typeof s.xp!=='object'||Array.isArray(s.xp)||!Array.isArray(s.equipped)||s.equipped.length>5||new Set(s.equipped).size!==s.equipped.length)throw Error('存档职业专精数据无效');
    for(const [id,xp] of Object.entries(s.xp))if(!get(id)||!(u.certifiedClasses||[]).includes(id)||!Number.isInteger(xp)||xp<0||xp>get(id).required||u.side==='enemy'&&xp)throw Error('存档职业经验无效');
    u.classXp={...s.xp};const known=learned(u);
    if(s.equipped.some(id=>!abilities[id]||!known.includes(id)))throw Error('存档专精技能未习得');
    u.masteryEquipped=s.equipped.slice();
    // Grant the new starting skill once; keep prior deliberate removal when the
    // old save had already mastered Commoner/Noble, and never evict another skill.
    const previouslyLearned=['commoner','noble'].some(id=>(s.xp[id]||0)>=get(id).required);
    if(s.starterVersion===undefined&&starter(u)&&!previouslyLearned&&!u.masteryEquipped.includes('hp5')&&u.masteryEquipped.length<5)u.masteryEquipped.push('hp5');
    sync(u);if(fullHp)u.hp=u.maxHp;
  }
  function equip(u,id){
    if(!abilities[id]||!learned(u).includes(id))throw Error('尚未习得该职业技能');
    if(has(u,id))u.masteryEquipped=u.masteryEquipped.filter(x=>x!==id);
    else{if(u.masteryEquipped.length>=5)throw Error('最多装备5个职业专精技能，请先卸下一个');u.masteryEquipped.push(id);}
    u.combatArtId=null;sync(u);M.Inventory.sync(u);
  }
  function award(u,amount=1){
    const p=progress(u);if(!p||p.mastered||u.side!=='player'||!Number.isInteger(amount)||amount<=0)return null;
    const known=learned(u),xp=Math.min(p.required,p.xp+amount);u.classXp[u.classId]=xp;
    const unlocked=learned(u).filter(id=>!known.includes(id));
    for(const id of unlocked)if(abilities[id]&&u.masteryEquipped.length<5)u.masteryEquipped.push(id);
    sync(u);M.Inventory.sync(u);
    return {classId:u.classId,className:u.className,before:p.xp,xp,required:p.required,gained:xp-p.xp,mastered:xp===p.required,unlocked,autoEquipped:unlocked.filter(id=>has(u,id))};
  }
  function attachReport(u,report,mastery){
    if(!mastery)return report;
    return {...(report||{unitId:u.id,name:u.name,gained:0,before:{level:u.level,exp:u.exp,required:M.Growth.required(u.level)},after:{level:u.level,exp:u.exp,required:M.Growth.required(u.level)},levels:[]}),mastery};
  }
  function bonus(u,key,context={},foe){
    const initiates=context.initiatorId===u.id;let n=0;
    if(u.hp<u.maxHp/4){if(['str','mag','spd','def','res'].includes(key)&&has(u,'defiant_'+key))n+=8;if(key==='avoid'&&has(u,'defiant_avoid'))n+=30;if(key==='crit'&&has(u,'defiant_crit'))n+=50;}
    if(initiates){if(key==='str'&&has(u,'death_blow'))n+=6;if(key==='mag'&&has(u,'fiendish_blow'))n+=6;if(key==='def'&&has(u,'armored_blow'))n+=6;if(key==='res'&&has(u,'warding_blow'))n+=6;if(key==='as'&&has(u,'darting_blow'))n+=6;if(key==='avoid'&&has(u,'duelists_blow'))n+=20;if(key==='hit'&&has(u,'uncanny_blow'))n+=30;}
    if(key==='hit'&&has(u,'hit20'))n+=20;
    if(key==='avoid'&&has(u,'brawl_avoid')&&u.weapon?.type==='gauntlet')n+=20;
    if(key==='crit'&&!initiates&&context.initiatorId&&u.hp<u.maxHp/2&&has(u,'wrath'))n+=50;
    const breaks=foe&&((has(u,'tomebreaker')&&u.weapon?.type==='gauntlet'&&M.Combat.damageTypeOf(foe.weapon)==='magic')||(has(u,'bowbreaker')&&M.Combat.damageTypeOf(u.weapon)==='magic'&&foe.weapon?.type==='bow'));
    if(breaks&&['hit','avoid'].includes(key))n+=20;
    if(u.status?.masteryDance&&['dex','spd','lck'].includes(key))n+=4;
    if(u.status?.masteryTransmute&&['str','mag','dex','spd','lck','def','res'].includes(key))n+=3;
    return n;
  }
  function canUnarmed(u){return has(u,'unarmed_combat')&&!u.tags?.some(t=>['cavalry','flying'].includes(t));}
  const unarmed=Object.freeze({id:'mastery_unarmed',name:'空手格斗',kind:'unarmed',type:'gauntlet',range:[1,1],might:0,hit:80,crit:0,weight:0,damageType:'physical',absoluteHit:true,uses:null,color:'#c8b8a4'});
  M.Inventory.weapons.mastery_unarmed=unarmed;
  function availableArts(u){return learned(u).filter(id=>arts[id]&&(!arts[id].exclusive||arts[id].exclusive.includes(u.classId))).map(id=>arts[id]);}
  function selectedArt(u){const a=arts[u?.combatArtId];return a&&!a.assist&&availableArts(u).some(r=>r.id===a.id)&&u.weapon?.type===a.type&&u.weapon?.kind!=='unarmed'?a:null;}
  function artReason(u,id){const a=arts[id];if(!a||!availableArts(u).some(r=>r.id===id))return '未习得或当前职业不能使用此战技';if(a.assist)return '';
    if(u.weapon?.type!==a.type||u.weapon.kind==='unarmed'||u.weapon.kind==='spell')return '需要装备对应类别的实体武器';
    if((u.inventory||[]).filter(i=>i.id===u.weapon.id).reduce((n,i)=>n+i.uses,0)<a.cost)return '武器耐久不足（需要'+a.cost+'）';return '';
  }
  function rangeOf(u){return selectedArt(u)?.range||u.weapon.range;}
  function targetReason(u,t,map){const a=selectedArt(u);if(!a)return '';if(artReason(u,a.id))return artReason(u,a.id);
    if(a.id==='triangle_attack'&&(map.units||[]).filter(f=>f.side===u.side&&!f.dead&&f.hp>0&&!f.escaped&&f.tags?.includes('flying')&&M.Grid.manhattan(f,t)===1).length<3)return '三角攻阵需要3名我方飞行单位相邻目标';return '';
  }
  function immuneKill(u){return u.boss||u.hpFloor>0||u.key||u.tags?.includes('monster');}
  function strikeEffects(a,b,strike,rng,art){
    strike.masteryProcs=[];
    if(!strike.hit)return;
    const dex=M.Combat.dexOf(a),luck=(b.lck||0)+bonus(b,'lck');
    let instant=false;
    if(!immuneKill(b)){
      if(has(a,'lethality')&&rng.int(1,400)<=dex){instant=true;strike.masteryProcs.push('灭杀');}
      else if(art?.id==='assassinate'&&rng.int(1,100)<=dex){instant=true;strike.masteryProcs.push('暗杀');}
      if(instant)strike.finalDamage=b.hp;
    }
    if(!instant&&(has(b,'pavise')&&['sword','lance','axe','gauntlet'].includes(strike.weaponType)&&!strike.magic||has(b,'aegis')&&(strike.weaponType==='bow'||strike.magic))&&rng.int(1,100)<=M.Combat.dexOf(b)){
      strike.finalDamage=Math.floor(strike.finalDamage/2);strike.masteryProcs.push(strike.magic||strike.weaponType==='bow'?'圣盾':'大盾');}
    if(has(b,'miracle')&&b.hp>=2&&strike.finalDamage>=b.hp&&rng.int(1,100)<=luck){strike.finalDamage=b.hp-1;strike.masteryProcs.push('祈祷');}
    strike.hpAfter=Math.max(b.hpFloor||0,b.hp-strike.finalDamage);
    strike.masteryHealing=has(a,'lifetaker')&&strike.hpAfter===0?Math.min(a.maxHp-a.hp,Math.floor(Math.min(b.hp,strike.finalDamage)/2)):0;
    a.hp+=strike.masteryHealing;
  }
  function afterBattle(units,strikes,initiatorId){
    const effects=[];
    for(const a of units){const outgoing=strikes.filter(s=>s.attackerId===a.id&&s.hit),targets=[...new Set(outgoing.map(s=>s.defenderId))];
      for(const id of targets){const b=units.find(u=>u.id===id);if(!b||b.hp<=0||b.hpFloor&&b.hp===b.hpFloor)continue;
        const status={};const damaged=outgoing.some(s=>s.defenderId===id&&s.finalDamage>0);
        if(damaged&&!M.Talents?.immune(b)){if(has(a,'seal_defense'))status.masterySealDef=1;if(has(a,'seal_resistance'))status.masterySealRes=1;}
        if(has(b,'transmute')&&units.find(u=>u.id===initiatorId)?.side==='enemy'&&outgoing.some(s=>s.defenderId===id&&s.magic))status.masteryTransmute=1;
        const damage=a.id===initiatorId&&has(a,'poison_strike')?Math.min(Math.max(0,b.hp-Math.max(1,b.hpFloor||0)),Math.floor(b.maxHp*.2)):0;
        if(damage||Object.keys(status).length){b.hp-=damage;Object.assign(b.status,status);effects.push({id:b.id,damage,status});}
      }
    }return effects;
  }
  function applyEffects(game,effects){for(const e of effects||[]){const u=game.getUnit(e.id);if(!u||u.dead)continue;u.hp=Math.max(u.hpFloor||1,u.hp-e.damage);Object.assign(u.status,e.status);}}
  function startTurn(u){let healed=0;if(has(u,'renewal')){healed=Math.min(u.maxHp-u.hp,Math.floor(u.maxHp*.2));u.hp+=healed;}u.combatArtId=null;return healed;}
  function endTurn(u){for(const k of ['masteryDance','masteryTransmute','masterySealDef','masterySealRes'])delete u.status[k];u.combatArtId=null;}
  // Assist arts validate all traversed and destination cells before any mutation.
  function assistMoves(game,u,t,id){
    const dx=t.x-u.x,dy=t.y-u.y,empty=(unit,x,y,ignore=[])=>M.Grid.inBounds(game.map,x,y)&&game.isVisible(x,y)&&Number.isFinite(M.Grid.movementCost(game.map,unit,x,y))&&(!game.unitAt(x,y)||ignore.includes(game.unitAt(x,y).id));
    if(id==='foul_play')return empty(u,t.x,t.y,[t.id])&&empty(t,u.x,u.y,[u.id])?[{id:u.id,x:t.x,y:t.y},{id:t.id,x:u.x,y:u.y}]:null;
    if(id==='draw_back')return empty(u,u.x-dx,u.y-dy)&&empty(t,u.x,u.y,[u.id])?[{id:u.id,x:u.x-dx,y:u.y-dy},{id:t.id,x:u.x,y:u.y}]:null;
    if(id==='reposition')return empty(t,u.x-dx,u.y-dy)?[{id:t.id,x:u.x-dx,y:u.y-dy}]:null;
    const length=id==='smite'?2:1;for(let n=1;n<=length;n++)if(!empty(t,t.x+dx*n,t.y+dy*n))return null;
    return [{id:t.id,x:t.x+dx*length,y:t.y+dy*length}];
  }
  function actionReady(game,u){return !!u&&u.side==='player'&&!u.dead&&u.hp>0&&!u.escaped&&!u.acted&&game.phase==='player'&&!game.isOver()&&!game.maskRetreatPending;}
  function assistTargets(game,u,id){
    if(!actionReady(game,u))return [];
    if(id==='dance'){if(u.classId!=='dancer')return [];return game.living('player').filter(t=>t.id!==u.id&&!t.escaped&&t.classId!=='dancer'&&t.acted&&M.Grid.manhattan(u,t)===1);}
    if(id==='steal'){if(!has(u,'steal')||u.inventory.length>=5)return [];return game.living('enemy').filter(t=>game.isUnitVisible(t)&&M.Grid.manhattan(u,t)===1&&M.Combat.speedOf(u)>M.Combat.speedOf(t)&&stealable(t).length);}
    const a=arts[id];if(!a?.assist||artReason(u,id))return [];
    return game.living('player').filter(t=>t.id!==u.id&&!t.escaped&&M.Grid.manhattan(u,t)>=1&&M.Grid.manhattan(u,t)<=a.range&&assistMoves(game,u,t,id));
  }
  function stealable(u){return u.inventory.filter(i=>!['weapon'].includes(M.Inventory.item(i.id)?.kind));}
  function useAssist(game,u,t,id,itemIndex){
    if(!assistTargets(game,u,id).some(x=>x.id===t?.id))throw Error('战技目标无效或无法行动');
    let moves=[];
    if(id==='dance'){t.acted=false;t.talentSwapReady=false;if(has(u,'special_dance'))t.status.masteryDance=1;}
    else if(id==='steal'){const i=t.inventory[itemIndex];if(!i||!stealable(t).includes(i))throw Error('该物品不可偷取');u.inventory.push(t.inventory.splice(itemIndex,1)[0]);if(t.drops?.includes(i.id)){t.drops=t.drops.filter(id=>id!==i.id);t.stolenDrops=[...(t.stolenDrops||[]),i.id];}M.Inventory.sync(t);}
    else {moves=assistMoves(game,u,t,id);for(const p of moves){const unit=game.getUnit(p.id);unit.x=p.x;unit.y=p.y;}game.refreshParkDiscovery();}
    game.markActed(u);u.combatArtId=null;M.Inventory.sync(u);
    const report=attachReport(u,null,award(u));return {affected:[u.id,t.id],moves,experience:report?[report]:[]};
  }
  M.Mastery=Object.freeze({abilities,arts,jobs,get,progress,learned,has,sync,init,pack,restore,equip,award,attachReport,bonus,canUnarmed,unarmed,availableArts,selectedArt,artReason,rangeOf,targetReason,strikeEffects,afterBattle,applyEffects,startTurn,endTurn,assistTargets,useAssist,stealable});
})(window);
