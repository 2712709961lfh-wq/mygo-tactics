'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const w={console,document:{readyState:'loading'},addEventListener(){}};w.window=w;vm.createContext(w);
for(const name of ['equipment-data','magic-data','inventory','class-data','class-mastery','config','chapter-three','chapter-four','chapter-five','chapter-six','chapter-seven','chapter-eight','chapter-nine','chapter-ten','chapter-palace','rng','growth-data','talents','growth','grid','pathfinding','combat','game','ui','entry','loadout-ui','mastery-ui'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',name+'.js'),'utf8'),w,{filename:name});
const M=w.MyGO,A=M.Mastery,C=M.Combat,I=M.Inventory,G=M.Growth,plain=x=>JSON.parse(JSON.stringify(x));let count=0;
function test(name,fn){fn();count++;console.log('✓ '+name);}
function setup(){const g=new M.Game({seed:1818}),u=g.getUnit('tomori'),e=g.getUnit('shadow_axe');
  g.map={cols:20,rows:20,tiles:Array.from({length:20},()=>Array(20).fill('plain'))};
  Object.defineProperty(g.map,'units',{configurable:true,get:()=>g.units});
  g.units.forEach((u,n)=>Object.assign(u,{x:n%20,y:12+Math.floor(n/20)}));
  Object.assign(u,{x:5,y:5,str:10,spd:12,dex:10,lck:0,def:10,res:10,hp:60,maxHp:60});Object.assign(e,{x:6,y:5,str:10,spd:10,dex:10,lck:0,def:10,res:10,hp:100,maxHp:100,tags:[]});
  return {g,u,e};
}
function master(u,id){u.level=Math.max(u.level,30);M.Talents.sync(u);if(!u.certifiedClasses.includes(id))u.certifiedClasses.push(id);const old=u.classId;u.classId=id;A.award(u,A.get(id).required);u.classId=old;}
function skills(u,classes,ids){for(const id of classes)master(u,id);u.masteryEquipped=ids;A.sync(u);I.sync(u);}
function weapon(u,id){u.inventory=[I.make(id)];u.equippedWeapon=id;u.weaponTypes=[I.weapons[id].type];I.sync(u);}
const low={int(a){return a;}};
const noCrit={int(a,b){return a===1&&b===100?50:a;}};

test('44种职业均有专精奖励、阶段门槛和可执行技能／战技',()=>{
  assert.equal(Object.keys(A.jobs).length,44);for(const j of M.Classes.items){assert(A.get(j.id).rewards.length);for(const r of A.get(j.id).rewards)assert(r.description&&r.kind);}
  assert.equal(A.get('commoner').required,20);assert.equal(A.get('fighter').required,60);assert.equal(A.get('priest').required,100);assert.equal(A.get('swordmaster').required,150);assert.equal(A.get('gremory').required,200);assert.equal(A.get('dancer').required,150);assert.equal(A.get('trickster').required,150);
  assert.equal(A.get('brawler').rewards[0].id,'unarmed_combat');assert.equal(A.get('priest').rewards[0].id,'miracle');assert.equal(A.get('sniper').rewards[0].id,'hunters_volley');
});
test('满条只解锁一次，自动装备，跨职业保留不同进度',()=>{
  const {u}=setup(),spd=u.spd;assert.equal(A.progress(u).xp,0);assert.equal(A.award(u,59).unlocked.length,0);const r=A.award(u);assert.equal(r.unlocked.join(','),'speed2');assert(A.has(u,'speed2'));assert.equal(u.spd,spd+2);assert.equal(A.award(u),null);
  M.Classes.apply(u,'fighter');A.award(u,3);assert.equal(A.progress(u).xp,3);assert.equal(A.progress(u,'myrmidon').xp,60);M.Classes.apply(u,'myrmidon');assert.equal(u.spd,spd+2);assert(A.progress(u).mastered);
});
test('五栏限制、同名奖励去重、卸下重新装备不叠加或治疗',()=>{
  const {u}=setup(),max=u.maxHp;master(u,'commoner');master(u,'noble');assert.equal(A.learned(u).filter(x=>x==='hp5').length,1);assert.equal(u.maxHp,max+5);assert.equal(u.hp,max);
  A.equip(u,'hp5');assert.equal(u.maxHp,max);A.equip(u,'hp5');assert.equal(u.maxHp,max+5);assert.equal(u.hp,max);
  for(const id of ['myrmidon','soldier','fighter','monk','archer'])master(u,id);assert.equal(u.masteryEquipped.length,5);assert(!A.has(u,'hit20'));assert.throws(()=>A.equip(u,'hit20'),/最多装备5/);A.equip(u,'hp5');A.equip(u,'hit20');assert(A.has(u,'hit20'));
});
test('未命中和零伤害仍各给交战双方一次职业经验，不能重复结算',()=>{
  const {g,u,e}=setup();e.side='player';e.classId='fighter';e.className='战士';e.certifiedClasses=['fighter'];u.side='enemy';
  const r=g.rollCombat(u,e);for(const s of r.strikes){s.hit=false;s.finalDamage=0;}g.applyCombat(r);assert.equal(e.classXp.fighter,1);assert.equal(A.progress(u).xp,0);assert.throws(()=>g.applyCombat(r),/已结算/);
  const z=setup();z.e.def=999;z.e.res=999;const zero=z.g.rollCombat(z.u,z.e);z.g.applyCombat(zero);assert.equal(A.progress(z.u).xp,1);
});
test('追击和格斗多段攻击只获得一次职业经验，99级独立练职业',()=>{
  const {g,u,e}=setup();u.level=99;weapon(u,'iron_gauntlets');u.spd=40;e.str=0;const r=g.rollCombat(u,e);assert(r.strikes.filter(s=>s.attackerId===u.id).length>=2);g.applyCombat(r);assert.equal(A.progress(u).xp,1);assert.equal(r.experience[0].gained,0);assert.equal(r.experience[0].mastery.gained,1);
});
test('成功辅助魔法只加一次，失败／满血目标不增加',()=>{
  const {g}=setup(),u=g.getUnit('soyo'),t=g.getUnit('anon');Object.assign(u,{x:2,y:2});Object.assign(t,{x:3,y:2,hp:1});const r=g.castSupport(u,'heal',t);assert.equal(A.progress(u).xp,1);assert.equal(r.experience[0].mastery.gained,1);assert.throws(()=>g.castSupport(u,'heal',t));assert.equal(A.progress(u).xp,1);
});
test('预览与整场锁定不增加职业经验或改变真实技能／HP',()=>{
  const {g,u,e}=setup();const before=JSON.stringify(I.pack(u)),hp=u.hp,ehp=e.hp;g.previewCombat(u,e);g.rollCombat(u,e);assert.equal(JSON.stringify(I.pack(u)),before);assert.equal(u.hp,hp);assert.equal(e.hp,ehp);
});
test('鬼神／魔神／飞燕／金刚／明镜按发起方生效，命中常驻',()=>{
  const {g,u,e}=setup();skills(u,['brigand','mage','pegasus_knight','armored_knight','mortal_savant'],['death_blow','fiendish_blow','darting_blow','armored_blow','warding_blow']);
  u.level=9;weapon(u,'training_sword');u.weapon={...u.weapon,weight:0};const context={initiatorId:u.id};assert.equal(C.strOf(u,g.map,context)-C.strOf(u,g.map,{initiatorId:e.id}),6);assert.equal(C.attackSpeedOf(u,g.map,context)-C.attackSpeedOf(u,g.map,{initiatorId:e.id}),6);assert.equal(C.defenseOf(u,g.map,false,context)-C.defenseOf(u,g.map,false,{initiatorId:e.id}),6);assert.equal(C.defenseOf(u,g.map,true,context)-C.defenseOf(u,g.map,true,{initiatorId:e.id}),6);assert.equal(A.bonus(u,'mag',context),6);
  skills(u,['archer'],['hit20']);const h=C.hitOf(u);u.masteryEquipped=[];assert.equal(h-C.hitOf(u),20);
});
test('觉醒、愤怒、破魔破弓和DLC命中回避的条件实际进入公式',()=>{
  const {g,u,e}=setup();skills(u,['hero','falcon_knight','wyvern_lord','bow_knight','warrior'],['defiant_str','defiant_avoid','defiant_crit','defiant_spd','wrath']);u.hp=1;const ctx={initiatorId:e.id};assert.equal(A.bonus(u,'str',ctx),8);assert.equal(A.bonus(u,'spd',ctx),8);assert.equal(A.bonus(u,'crit',ctx),100);assert.equal(A.bonus(u,'avoid',ctx),30);u.hp=u.maxHp;assert.equal(A.bonus(u,'str',ctx),0);
  skills(u,['trickster','valkyrie','war_monk','grappler','warlock'],['duelists_blow','uncanny_blow','brawl_avoid','tomebreaker','bowbreaker']);weapon(u,'iron_gauntlets');weapon(e,'levin_sword');assert.equal(A.bonus(u,'avoid',{initiatorId:u.id},e),60);assert.equal(A.bonus(u,'hit',{initiatorId:u.id},e),50);
});
test('埋伏、强攻与回击改变真实出手顺序，职业战技不再普通追击',()=>{
  const {g,u,e}=setup();e.side='player';u.side='enemy';skills(e,['mercenary'],['vantage']);e.hp=20;let f=C.forecast(u,e,g.map);assert.equal(f.order[0].attackerId,e.id);
  e.side='enemy';u.side='player';skills(u,['cavalier'],['desperation']);u.hp=10;u.spd=40;e.hp=100;f=C.forecast(u,e,g.map);const ids=f.order.map(s=>s.attackerId);assert(ids.indexOf(e.id)>ids.lastIndexOf(u.id));
  e.side='player';u.side='enemy';skills(e,['war_master'],['quick_riposte']);f=C.forecast(u,e,g.map);assert.equal(f.attackCount,1);assert.equal(f.counterCount,2);
});
test('祈祷／大盾／圣盾／灭杀的随机结果锁定，首领保留保护',()=>{
  const {g,u,e}=setup();skills(u,['priest'],['miracle']);u.lck=100;u.hp=20;e.str=200;weapon(e,'iron_sword');let r=C.rollRound(e,u,g.map,low);assert.equal(r.strikes[0].hpAfter,1);assert(r.strikes[0].masteryProcs.includes('祈祷'));assert.equal(u.hp,20);
  u.hp=60;skills(u,['fortress_knight'],['pavise']);u.dex=100;e.str=20;r=C.rollRound(e,u,g.map,low);assert(r.strikes[0].masteryProcs.includes('大盾'));assert.equal(r.strikes[0].finalDamage,Math.floor((r.strikes[0].crit?r.strikes[0].critDamage:r.strikes[0].damage)/2));
  skills(u,['paladin'],['aegis']);weapon(e,'levin_sword');r=C.rollRound(e,u,g.map,low);assert(r.strikes[0].masteryProcs.includes('圣盾'));
  skills(u,['assassin'],['lethality']);u.dex=400;weapon(u,'iron_sword');e.hp=100;e.def=999;e.boss=false;e.tags=[];r=C.rollRound(u,e,g.map,low);assert.equal(r.strikes[0].hpAfter,0);e.boss=true;r=C.rollRound(u,e,g.map,low);assert(r.strikes[0].hpAfter>0);
});
test('蛇毒／双封锁／魔力转换在整场后结算，锁定与真实HP一致',()=>{
  const {g,u,e}=setup();skills(u,['dark_mage','wyvern_rider','dark_knight'],['poison_strike','seal_defense','seal_resistance']);u.dex=100;u.str=15;e.def=0;e.maxHp=300;e.hp=300;const r=C.rollRound(u,e,g.map,low);assert(r.masteryEffects.some(x=>x.damage===60));assert.equal(e.hp,300);g.applyCombat(r);assert.equal(e.hp,r.defenderHpAfter);assert.equal(e.status.masterySealDef,1);assert.equal(e.status.masterySealRes,1);g.expireStatuses('enemy');assert.equal(e.status.masterySealDef,undefined);
  const z=setup();skills(z.u,['dark_flier'],['transmute']);weapon(z.e,'levin_sword');z.u.hp=z.u.maxHp=200;z.g.phase='enemy';const magic=C.rollRound(z.e,z.u,z.g.map,low);z.g.applyCombat(magic);assert.equal(z.u.status.masteryTransmute,1);assert.equal(A.bonus(z.u,'lck'),3);z.g.beginNextPlayerPhase();assert.equal(z.u.status.masteryTransmute,1);z.g.beginEnemyPhase();assert.equal(z.u.status.masteryTransmute,undefined);
});
test('生命吸收按实际击破伤害回复；回复每我方阶段一次',()=>{
  const {g,u,e}=setup();skills(u,['dark_bishop','bishop'],['lifetaker','renewal']);u.hp=10;u.str=30;e.hp=10;e.boss=false;const r=C.rollRound(u,e,g.map,low);assert.equal(r.strikes[0].masteryHealing,5);g.applyCombat(r);assert.equal(u.hp,r.attackerHpAfter);const before=u.hp;g.phase='enemy';g.beginNextPlayerPhase();assert.equal(u.hp,Math.min(u.maxHp,before+Math.floor(u.maxHp*.2)));
});
test('空手格斗可装备、可连击、不消耗耐久，骑乘和飞行不能使用',()=>{
  const {g,u,e}=setup();skills(u,['brawler'],['unarmed_combat']);I.select(u,'mastery_unarmed');assert.equal(u.weapon.id,'mastery_unarmed');assert(I.usable(u));assert(C.forecast(u,e,g.map).attackCount>=2);const bag=JSON.stringify(u.inventory);g.applyCombat(g.rollCombat(u,e));assert.equal(JSON.stringify(u.inventory),bag);u.tags=['flying'];I.sync(u);assert(!I.options(u).includes('mastery_unarmed'));assert.notEqual(u.weapon.id,'mastery_unarmed');
});
test('实体攻击战技：流星／猎箭／铁拳锁定多段、射程、一次总耐久',()=>{
  for(const [job,art,id,hits,cost,distance] of [['swordmaster','astra','iron_sword',5,9,1],['sniper','hunters_volley','iron_bow',2,5,3],['grappler','fierce_iron_fist','iron_gauntlets',3,5,1]]){
    const {g,u,e}=setup();master(u,job);M.Classes.apply(u,job);weapon(u,id);u.str=1;e.def=999;e.str=0;e.x=u.x+distance;g.selectCombatArt(u,art);assert(g.canAttack(u,e));assert.equal(A.rangeOf(u).join(','),distance===3?'2,3':'1,1');const before=u.inventory[0].uses,r=g.rollCombat(u,e);assert.equal(r.strikes.filter(s=>s.attackerId===u.id).length,hits);g.applyCombat(r);assert.equal(u.inventory[0].uses,before-cost);assert.equal(A.progress(u).xp,A.get(job).required);assert.equal(u.combatArtId,null);
  }
});
test('战技提前击破仍扣总耐久，恰好足够耐久可打完，不能在错误职业使用',()=>{
  const {g,u,e}=setup();master(u,'swordmaster');M.Classes.apply(u,'swordmaster');weapon(u,'iron_sword');u.inventory[0].uses=9;u.str=1;e.def=999;g.selectCombatArt(u,'astra');const r=g.rollCombat(u,e);assert.equal(r.strikes.filter(s=>s.attackerId===u.id).length,5);g.applyCombat(r);assert.equal(u.inventory[0].uses,0);
  u.acted=false;M.Classes.apply(u,'myrmidon');assert(A.artReason(u,'astra'));assert.throws(()=>g.selectCombatArt(u,'astra'));
  M.Classes.apply(u,'swordmaster');weapon(u,'iron_sword');u.str=999;e.hp=1;e.dead=false;e.def=0;g.selectCombatArt(u,'astra');const before=u.inventory[0].uses;const kill=g.rollCombat(u,e);g.applyCombat(kill);assert.equal(u.inventory[0].uses,before-9);assert.equal(kill.strikes.length,1);
});
test('三角攻阵验证三名飞行单位，魔法格斗与全特效接入伤害预告',()=>{
  const {g,u,e}=setup();master(u,'pegasus_knight');M.Classes.apply(u,'pegasus_knight');weapon(u,'iron_lance');g.selectCombatArt(u,'triangle_attack');assert(!g.canAttack(u,e));for(const [id,x,y] of [['anon',6,4],['rana',6,6]])Object.assign(g.getUnit(id),{x,y,tags:['flying']});assert(g.canAttack(u,e));
  master(u,'war_monk');M.Classes.apply(u,'war_monk');weapon(u,'iron_gauntlets');u.combatArtId='pneuma_gale';assert(C.preview(u,e,g.map).magic);assert.equal(A.rangeOf(u).join(','),'1,2');
  master(u,'war_master');M.Classes.apply(u,'war_master');weapon(u,'iron_axe');u.combatArtId='war_masters_strike';assert.equal(C.preview(u,e,g.map).effectiveness,3);
});
test('辅助战技先验证全路径与占用；带回、冲撞、重击、拉近、换位实际移动',()=>{
  for(const [job,id,expected] of [['soldier','reposition',[4,5]],['fighter','shove',[7,5]],['armored_knight','smite',[8,5]],['monk','draw_back',[5,5]],['trickster','foul_play',[5,5]]]){
    const {g,u,e}=setup(),t=g.getUnit('anon');e.x=15;Object.assign(t,{x:6,y:5});master(u,job);M.Classes.apply(u,job);u.acted=false;assert(A.assistTargets(g,u,id).some(x=>x.id===t.id));g.useMasteryAssist(u,t,id);assert.equal(t.x,expected[0]);assert.equal(t.y,expected[1]);assert(u.acted);
  }
  const {g,u,e}=setup(),t=g.getUnit('anon');e.x=15;Object.assign(t,{x:6,y:5});master(u,'armored_knight');g.map.tiles[5][7]='wall';assert(!A.assistTargets(g,u,'smite').some(x=>x.id===t.id));assert.throws(()=>g.useMasteryAssist(u,t,'smite'));assert.equal(t.x,6);assert(!u.acted);
});
test('舞蹈使同伴再次行动，特殊舞蹈实际加属性，不可对舞者循环',()=>{
  const {g,u,e}=setup(),t=g.getUnit('anon');e.x=15;Object.assign(t,{x:6,y:5,acted:true});M.Classes.apply(u,'dancer');const dex=C.dexOf(t);g.useMasteryAssist(u,t,'dance');assert(!t.acted);assert.equal(C.dexOf(t),dex);assert.equal(A.progress(u).xp,1);
  u.acted=false;t.acted=true;master(u,'dancer');const r=g.useMasteryAssist(u,t,'dance');assert.equal(C.dexOf(t),dex+4);assert(r);g.expireStatuses('player');assert.equal(C.dexOf(t),dex);u.acted=false;t.acted=true;t.classId='dancer';assert(!A.assistTargets(g,u,'dance').length);
});
test('偷窃检查速度、背包、物品类型，并移除敌方对应掉落',()=>{
  const {g,u,e}=setup();skills(u,['thief'],['steal']);u.spd=20;e.spd=1;e.inventory.push(I.make('chest_key'));e.drops=['chest_key'];const n=e.inventory.length-1;g.useMasteryAssist(u,e,'steal',n);assert(u.inventory.some(i=>i.id==='chest_key'));assert(!e.inventory.some(i=>i.id==='chest_key'));assert(!e.drops.includes('chest_key'));assert.equal(e.stolenDrops[0],'chest_key');assert(u.acted);
});
test('存档／跨章保留每职业进度与装备，属性不叠加，旧档从0开始',()=>{
  const g=new M.Game(),u=g.getUnit('tomori');master(u,'myrmidon');M.Classes.apply(u,'fighter');A.award(u,9);u.hp=8;
  const s=g.serialize();let h=new M.Game();h.restore(s);let v=h.getUnit(u.id);assert.equal(v.hp,8);assert.equal(v.spd,u.spd);assert.equal(v.classXp.fighter,9);assert.equal(v.classXp.myrmidon,60);assert.equal(v.masteryEquipped.join(','),u.masteryEquipped.join(','));h.restore(h.serialize());assert.equal(h.getUnit(u.id).spd,u.spd);
  h=new M.Game({stage:2,recruited:['xueyue'],loadout:g.exportLoadout()});v=h.getUnit(u.id);assert.equal(v.classXp.fighter,9);assert.equal(v.spd,u.spd);assert.equal(v.hp,v.maxHp);
  const old=plain(s);for(const x of old.units)delete x.classMastery;h=new M.Game();h.restore(old);assert.equal(A.progress(h.getUnit(u.id)).xp,0);assert.equal(h.getUnit(u.id).masteryEquipped.length,0);
});
test('HP专精保存上限后再恢复伤血／撤退，重复加载不叠加；撤退可管理技能',()=>{
  const g=new M.Game(),u=g.getUnit('tomori');master(u,'commoner');u.hp=u.maxHp-1;let h=new M.Game();h.restore(g.serialize());assert.equal(h.getUnit(u.id).maxHp,u.maxHp);assert.equal(h.getUnit(u.id).hp,u.hp);h.restore(h.serialize());assert.equal(h.getUnit(u.id).maxHp,u.maxHp);
  u.hp=0;u.dead=true;u.acted=true;g.equipMasterySkill(u,'hp5');assert.equal(u.hp,0);assert(u.dead);g.equipMasterySkill(u,'hp5');assert.equal(u.hp,0);assert(u.dead);
});
test('拒绝伪造专精经验、未知职业、未取得资格及未学技能',()=>{
  const g=new M.Game(),u=g.getUnit('tomori');const s=g.serialize();for(const bad of [{version:1,xp:{myrmidon:61},equipped:[]},{version:1,xp:{myrmidon:-1},equipped:[]},{version:1,xp:{myrmidon:1.5},equipped:[]},{version:1,xp:{fake:1},equipped:[]},{version:1,xp:{sniper:150},equipped:[]},{version:1,xp:{myrmidon:0},equipped:['speed2']},{version:1,xp:{myrmidon:60},equipped:['speed2','speed2']}]){const x=plain(s);x.units.find(t=>t.id===u.id).classMastery=bad;assert.throws(()=>new M.Game().restore(x),/存档/);}
});
test('角色资料／职业目录／专精页显示真实经验、奖励和五栏；通知支持仅专精',()=>{
  const {g,u}=setup();A.award(u,5);assert(M.MasteryUI.bar(u).includes('5 / 60 CEXP'));assert(M.MasteryUI.bar(u).includes('role="progressbar"'));assert(M.MasteryUI.rewards(u,'myrmidon').includes('速度＋2'));assert(M.MasteryUI.skills(u,'').includes('已装备 0 / 5'));
  const entry=Object.create(M.EntryScreen.prototype);entry.ui={game:g,busy:false,mode:'idle'};entry.players=()=>g.units.filter(u=>u.side==='player');entry.selectedUnitId=u.id;entry.dom={formationDetail:{innerHTML:''}};entry.renderPoseDock=()=>{};entry.loadoutTab='classes';entry.renderFormationDetail();assert(entry.dom.formationDetail.innerHTML.includes('专精奖励'));entry.loadoutTab='mastery';entry.renderFormationDetail();assert(entry.dom.formationDetail.innerHTML.includes('职业经验＋1'));
  const source=fs.readFileSync(path.join(__dirname,'../src/ui.js'),'utf8');assert(source.includes('r.levels.length||r.mastery?.unlocked?.length'));assert(source.includes('职业专精达成'));
});
test('埋伏先击破发起者时，整场双方身份、HP上限和真实结算仍正确',()=>{
  const {g,u,e}=setup();skills(u,['mercenary'],['vantage']);u.hp=20;u.str=100;e.hp=1;e.str=0;
  const r=C.rollRound(e,u,g.map,low);assert.equal(r.strikes.length,1);assert.equal(r.attackerId,e.id);assert.equal(r.defenderId,u.id);assert.equal(r.defenderMaxHp,u.maxHp);assert.equal(r.finalDamage,0);assert(r.counterDamage>0);g.applyCombat(r);assert(e.dead);assert.equal(u.hp,r.defenderHpAfter);assert.equal(A.progress(u).xp,1); // Defensive participation trains the current class once.
});
test('专精在交战结束后才解锁，不回头改变已锁定的本次交战',()=>{
  const {g,u,e}=setup();u.level=30;M.Classes.apply(u,'dark_mage');u.classXp.dark_mage=99;u.dex=100;u.mag=1;e.res=999;e.str=0;e.maxHp=e.hp=300;
  const r=C.rollRound(u,e,g.map,low);assert.equal(r.masteryEffects.length,0);g.applyCombat(r);assert(A.has(u,'poison_strike'));assert.equal(e.hp,r.defenderHpAfter);assert(r.experience[0].mastery.unlocked.includes('poison_strike'));
});
test('战后封锁尊重哈气免疫，与其他减益取最大且可被复原清除',()=>{
  const {g,u}=setup(),t=g.getUnit('rana');t.level=20;M.Talents.sync(t);t.status.masterySealDef=1;assert.equal(M.Talents.penalty(t,'masterySealDef',6),0);M.Talents.sync(t);assert.equal(t.status.masterySealDef,undefined);
  u.status={defDown:1,masterySealDef:1,masterySealRes:1,talentResDown:1};const physical=C.defenseOf(u,g.map,false),magic=C.defenseOf(u,g.map,true);u.status={};assert.equal(C.defenseOf(u,g.map,false)-physical,6);assert.equal(C.defenseOf(u,g.map,true)-magic,6);
  const s=g.getUnit('soyo');Object.assign(s,{level:30,x:4,y:5});I.learn(s);u.status.masterySealDef=1;const r=g.castSupport(s,'restore',u);assert(r);assert.equal(u.status.masterySealDef,undefined);
});
test('DLC魔力转换不在主动进攻时触发；舞蹈幸运也参与魔法命中',()=>{
  const {g,u,e}=setup();skills(u,['dark_flier'],['transmute']);weapon(e,'levin_sword');u.hp=u.maxHp=300;
  const r=C.rollRound(u,e,g.map,low);g.applyCombat(r);assert.equal(u.status.masteryTransmute,undefined);
  weapon(u,'levin_sword');const hit=C.hitOf(u);u.status.masteryDance=1;assert.equal(C.hitOf(u)-hit,4); // +4 dex and +4 luck, averaged.
});
test('偷取关卡真实钥匙后，读档和后续击破都不会复制钥匙掉落',()=>{
  const g=new M.Game({stage:5}),u=g.getUnit('tomori'),e=g.living('enemy').find(t=>t.inventory.some(i=>i.id==='chest_key'));
  skills(u,['thief'],['steal']);M.Classes.apply(u,'pegasus_knight');u.spd=100;e.spd=1;u.inventory=[];const cell=[[e.x-1,e.y],[e.x+1,e.y],[e.x,e.y-1],[e.x,e.y+1]].find(([x,y])=>M.Grid.inBounds(g.map,x,y)&&Number.isFinite(M.Grid.movementCost(g.map,u,x,y))&&!g.unitAt(x,y));assert(cell);[u.x,u.y]=cell;const index=e.inventory.findIndex(i=>i.id==='chest_key');g.useMasteryAssist(u,e,'steal',index);
  const h=new M.Game();h.restore(g.serialize());const enemy=h.getUnit(e.id),player=h.getUnit(u.id);assert(!enemy.drops.includes('chest_key'));assert.equal(player.inventory.filter(i=>i.id==='chest_key').length,1);
  const kill=h.applyCombat({attackerId:player.id,defenderId:enemy.id,hit:true,finalDamage:999});assert(!kill.drops?.some(d=>d.id==='chest_key'));
});
test('九名角色均初始化独立职业经验，未入队角色可在入队后正常练职业',()=>{
  const g=new M.Game({stage:10,recruited:['xueyue','nina']});g.completeTenthIntro();const units=Object.keys(M.GrowthData.personal).map(id=>g.getUnit(id));assert(units.every(Boolean));
  for(const u of units){assert.equal(A.progress(u).xp,0);assert.equal(u.masteryEquipped.length,0);const report=A.award(u);assert.equal(report.gained,1);assert.equal(A.progress(u).xp,1);}
  assert.notEqual(units[0].classXp,units[1].classXp);
});
console.log('Class mastery: '+count+' cases passed.');
