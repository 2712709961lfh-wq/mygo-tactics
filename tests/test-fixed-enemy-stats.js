/* Campaign enemy stats must depend only on chapter configuration. */
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const w={console};w.window=w;vm.createContext(w);
for(const f of ['equipment-data','magic-data','inventory','class-data','config','chapter-three','chapter-four','chapter-five','chapter-six','chapter-seven','chapter-eight','rng','growth-data','growth','grid','pathfinding','combat','game','ai'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',f+'.js'),'utf8'),w,{filename:f});
const M=w.MyGO,plain=x=>JSON.parse(JSON.stringify(x)),keys=['level','maxHp','str','mag','dex','spd','lck','def','res','move'];
const fresh=(stage,opts={})=>new M.Game({stage,recruited:['xueyue','nina'],seed:1115,...opts});
const enemies=g=>g.units.filter(u=>u.side==='enemy');
const stats=g=>plain(enemies(g).map(u=>[u.id,...keys.map(k=>u[k])]));
const reload=g=>{const h=fresh(1);h.restore(plain(g.serialize()));return h;};
function growParty(g){for(const u of g.living('player')){
 u.level=40;u.exp=0;for(const k of M.GrowthData.keys){u.growthGains[k]=20;u[k]=u.growthBase.stats[k]+20;}u.hp=u.maxHp;M.Inventory.learn(u);M.Inventory.sync(u);
}}
function summonAll(g){for(let i=0;i<4;i++){
 g.getUnit('tomori').y=11;g.phase='enemy';const wave=g.summonNearParty();assert(wave);g.beginNextPlayerPhase();
}g.phase='player';}
let count=0;function test(name,f){f();count++;console.log('✓ '+name);}
test('Chapters 1-8 ignore imported party power, level, roster and later growth; no live scaling calls',()=>{
 const oldPark=M.Game.prototype.restoreLegacyEnemyScale,oldEighth=M.Game.prototype.restoreLegacyEighthScale;
 M.Game.prototype.restoreLegacyEnemyScale=M.Game.prototype.restoreLegacyEighthScale=()=>{throw Error('Live scaling must never run');};
 try{for(let stage=1;stage<=8;stage++){
  const base=fresh(stage),before=stats(base),grown=fresh(stage);growParty(grown);
  assert.deepEqual(stats(fresh(stage,{loadout:grown.exportLoadout()})),before,'import chapter '+stage);
  assert.deepEqual(stats(fresh(stage,{recruited:[]})),before,'roster chapter '+stage);
  growParty(base);if(stage===7)base.joinNijika();
  const e=enemies(base)[0];e.hp=3;for(let i=0;i<3;i++)base.beginNextPlayerPhase();
  assert.deepEqual(stats(base),before,'turns chapter '+stage);assert.equal(e.hp,3);
  const h=reload(base);assert.deepEqual(stats(h),before,'reload chapter '+stage);assert.equal(h.getUnit(e.id).hp,3);
 }}finally{M.Game.prototype.restoreLegacyEnemyScale=oldPark;M.Game.prototype.restoreLegacyEighthScale=oldEighth;}
});
test('All four sixth-chapter waves use identical fixed stats for low/high parties and later turns',()=>{
 const low=fresh(6),high=fresh(6);growParty(high);for(let i=0;i<5;i++)high.beginNextPlayerPhase();
 const e=enemies(high)[0];e.hp=3;const max=e.maxHp;
 summonAll(low);summonAll(high);assert.equal(enemies(low).length,19);assert.deepEqual(stats(high),stats(low));assert.equal(e.hp,3);assert.equal(e.maxHp,max);
 for(const u of enemies(high)){const template=high.mission.enemies.concat(high.mission.summonTemplates).find(t=>t.id===u.id);assert.equal(u.level,template.level);}
 assert.deepEqual(stats(reload(high)),stats(low));
});
test('Scaled chapter 4-8 saves migrate once to fixed stats, preserving wounds, deaths and progress',()=>{
 for(const stage of [4,5,6,7,8])for(const level of [3,30]){
  const old=fresh(stage);if(stage===6)summonAll(old);if(stage===7)old.joinNijika();if(stage===8)old.completeEighthIntro();
  old.enemyScaleLevel=0;old.restoreLegacyEnemyScale(level,old.units,true);
  const list=enemies(old);for(const u of list){u.hp=Math.floor(u.maxHp*.8);u.alerted=true;}
  list[0].hp=1;Object.assign(list[1],{hp:0,dead:true,acted:true});
  if(stage===4)old.litLamps=['park-entry'];if([5,8].includes(stage))old.openedChests=[old.mission.chests[0].id];
  const snapshot=plain(old.serialize());delete snapshot.fixedEnemyStatsVersion;const h=fresh(stage);h.restore(snapshot);
  const expected=fresh(stage);if(stage===6)summonAll(expected);assert.deepEqual(stats(h),stats(expected),'fixed chapter '+stage+' from level '+level);
  for(const u of enemies(h)){const before=old.getUnit(u.id);assert.equal(u.hp,u.dead?0:Math.ceil(u.maxHp*before.hp/before.maxHp-1e-9),u.id);assert.equal(u.dead,before.dead);assert.equal(u.acted,before.acted);assert.equal(u.alerted,before.alerted);assert.equal(u.x,before.x);assert.equal(u.y,before.y);}
  assert.deepEqual(plain(h.litLamps),plain(old.litLamps));assert.deepEqual(plain(h.openedChests),plain(old.openedChests));assert.equal(h.nijikaJoined,old.nijikaJoined);assert.equal(h.stageEightIntroSeen,old.stageEightIntroSeen);
  assert.deepEqual(plain(reload(h).serialize()),plain(h.serialize()),'no drift chapter '+stage);
 }
});
test('Fixed-stat save marker rejects corrupt values',()=>{
 for(const value of [0,2,null,'1',true]){const s=plain(fresh(7).serialize());s.fixedEnemyStatsVersion=value;assert.throws(()=>fresh(7).restore(s),/固定敌军属性版本/);}
});
console.log('Fixed enemy stats: '+count+' cases passed.');
