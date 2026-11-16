'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const w={console};w.window=w;vm.createContext(w);
for(const f of ['equipment-data','magic-data','inventory','class-data','config','chapter-three','chapter-four','chapter-five','chapter-six','chapter-seven','chapter-eight','chapter-nine','chapter-ten','rng','growth-data','talents','growth','grid','pathfinding','combat','game'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',f+'.js'),'utf8'),w,{filename:f});
const M=w.MyGO,plain=x=>JSON.parse(JSON.stringify(x)),fresh=stage=>new M.Game({stage,recruited:['xueyue','nina'],seed:1116});
const reload=s=>{const g=fresh(1);g.restore(plain(s));return g;};
let count=0;function test(name,fn){fn();count++;console.log('✓ '+name);}
test('Both halves use original chapter-nine ordinary budgets and retain distinct effective stats',()=>{
 for(const stage of [9,10]){
  const g=fresh(stage),normals=g.units.filter(u=>u.side==='enemy'&&!u.boss);
  for(const u of normals){
   const total=M.Combat.statTotalOf(u),special=u.tags.includes('armor')||u.tags.includes('flying');
   const [low,high]=special?[114,115]:[108,111];
   assert(total>=low&&total<=high,u.id+': '+total);assert.equal(u.level,special?13:12);
   if(u.weapon.damageType==='magic'){assert(u.mag>u.str);assert(u.str>=8);}else {assert(u.str>u.mag);assert(u.mag>=6);}
   if(u.tags.includes('armor')){assert.equal(u.def,20);assert.equal(u.res,5);assert.equal(u.move,3);}
   if(u.tags.includes('flying'))assert.equal(u.move,6);
  }
  assert(new Set(normals.map(u=>M.Combat.statTotalOf(u))).size>=4);
 }
});
test('Every finale ordinary unit matches its corresponding first-half level and all nine stats',()=>{
 const first=fresh(9),last=fresh(10),keys=['level','maxHp','str','mag','dex','spd','lck','def','res','move'];
 const sources=['sword-a','axe-a','bow-a','lance-a','mage-a','sword-b','bow-b'];
 for(const u of last.units.filter(u=>u.side==='enemy'&&!u.boss)){
  const type=u.tags.includes('armor')?'armor-0':u.tags.includes('flying')?'pegasus-0':sources[Number(u.id.split('-').pop())%7];
  assert.deepEqual(keys.map(k=>u[k]),keys.map(k=>first.getUnit('rehearsal-'+type)[k]),u.id);
 }
});
test('Previous finale saves migrate wounds once while retaining enemy deaths, positions, status and progress',()=>{
 for(const legacyChapter of [false,true])for(const wound of ['full','half','one','dead']){
  const g=fresh(10);g.completeTenthIntro();const s=plain(g.serialize());delete s.rehearsalFinaleBalanceVersion;
  if(legacyChapter){s.stage=10;delete s.rehearsalChapterVersion;delete s.rehearsalPart;delete s.rehearsalFirstDefeated;}
  for(const [id,oldMax]of Object.entries(g.mission.legacyFinaleMaxHp)){
   const u=s.units.find(u=>u.id===id);u.hp=wound==='full'?oldMax:wound==='half'?Math.floor(oldMax/2):wound==='one'?1:0;
   u.dead=wound==='dead';u.acted=true;u.alerted=true;u.status={frostSpeedDown:1};
  }
  const h=reload(s);
  for(const [id,oldMax]of Object.entries(g.mission.legacyFinaleMaxHp)){
   const u=h.getUnit(id),old=s.units.find(u=>u.id===id);
   assert.equal(u.hp,Math.ceil(u.maxHp*old.hp/oldMax),id);assert.equal(u.dead,old.dead);
   assert.equal(u.x,old.x);assert.equal(u.y,old.y);assert(u.acted&&u.alerted);assert.equal(u.status.frostSpeedDown,1);
  }
  assert.equal(h.gold,g.gold);assert(h.subaruJoined);assert.equal(h.getUnit('subaru').hp,g.getUnit('subaru').hp);
  assert.equal(h.getUnit('dark_nina').hp,g.getUnit('dark_nina').hp);
  const save=plain(h.serialize());assert.equal(save.rehearsalFinaleBalanceVersion,1);
  assert.deepEqual(plain(reload(save).serialize()),save);
 }
 for(const bad of [0,2,null,'1',true]){const s=plain(fresh(10).serialize());s.rehearsalFinaleBalanceVersion=bad;assert.throws(()=>reload(s),/后半段属性版本/);}
});
test('Boss stat vectors exactly match the supplied chapter 9/10 values',()=>{
 const keys=['level','maxHp','str','mag','dex','spd','lck','def','res','move'];
 assert.deepEqual(keys.map(k=>fresh(9).getUnit('rift_pegasus')[k]),[15,40,16,8,14,16,8,10,18,6]);
 assert.deepEqual(keys.map(k=>fresh(10).getUnit('dark_nina')[k]),[16,43,15,7,15,19,8,11,9,5]);
});
test('Boss old saves preserve HP ratio, deaths and battle state, and migrate only once',()=>{
 for(const stage of [9,10])for(const hp of [46,23,1,0])for(const ordinaryLegacy of [false,true]){
  const g=fresh(stage),id=g.mission.bossId,s=plain(g.serialize());delete s.rehearsalBossBalanceVersion;
  if(ordinaryLegacy)delete s.rehearsalBalanceVersion;
  const b=s.units.find(u=>u.id===id);Object.assign(b,{hp,dead:hp===0,acted:true,alerted:true});
  const h=reload(s),u=h.getUnit(id);assert.equal(u.hp,hp===0?0:Math.ceil(u.maxHp*hp/46));
  assert.equal(u.dead,b.dead);assert.equal(u.acted,b.acted);assert.equal(u.alerted,b.alerted);assert.equal(u.x,b.x);assert.equal(u.y,b.y);
  const save=plain(h.serialize());assert.equal(save.rehearsalBossBalanceVersion,1);
  assert.deepEqual(plain(reload(save).serialize()),save);
 }
 for(const stage of [9,10])for(const value of [0,2,null,'1',true]){
  const s=plain(fresh(stage).serialize());s.rehearsalBossBalanceVersion=value;assert.throws(()=>reload(s),/Boss属性版本/);
 }
});
test('Subaru joins at Lv12/112 total; earned growth, EXP, equipment and class survive reload',()=>{
 const g=fresh(10);g.completeTenthIntro();const u=g.getUnit('subaru');assert.equal(u.level,12);assert.equal(M.Combat.statTotalOf(u),112);
 M.Growth.award(u,M.Growth.required(u.level));u.exp=13;u.hp-=5;
 const save=plain(g.serialize());let h=reload(save);
 for(let i=0;i<3;i++){assert.equal(M.Combat.statTotalOf(h.getUnit('subaru')),M.Combat.statTotalOf(u));assert.deepEqual(plain(h.serialize()),save);h=reload(h.serialize());}
 const next=fresh(10);next.completeTenthIntro();next.importLoadout(g.exportLoadout());assert.equal(next.getUnit('subaru').level,u.level);
 assert.equal(M.Combat.statTotalOf(next.getUnit('subaru')),M.Combat.statTotalOf(u));
});
test('Old saves adopt new base stats once, preserve wound ratio, deaths, growth and battle progress',()=>{
 for(const stage of [9,10]){
  const g=fresh(stage);if(stage===9)g.completeNinthIntro();else g.completeTenthIntro();
  if(stage===10){const u=g.getUnit('subaru');M.Growth.award(u,M.Growth.required(u.level));u.exp=17;}
  const save=plain(g.serialize());delete save.rehearsalBalanceVersion;
  const expected={};let i=0;
  for(const [id,oldBase]of Object.entries(g.mission.legacyMaxHp)){
   const s=save.units.find(u=>u.id===id),u=g.getUnit(id),oldMax=oldBase+(id==='subaru'?s.growth.gains.maxHp:0);
   s.hp=i===0?0:i===1?oldMax:i===2?1:Math.floor(oldMax*.6);s.dead=i===0;s.acted=true;s.alerted=true;
   expected[id]=s.dead?0:Math.max(1,Math.ceil(u.maxHp*s.hp/oldMax-1e-9));i++;
  }
  const h=reload(save);
  for(const [id,hp]of Object.entries(expected)){const u=h.getUnit(id),old=save.units.find(u=>u.id===id);assert.equal(u.hp,hp,id);assert.equal(u.dead,old.dead);assert.equal(u.acted,old.acted);assert.equal(u.alerted,old.alerted);assert.equal(u.x,old.x);assert.equal(u.y,old.y);}
  assert.equal(h.serialize().rehearsalBalanceVersion,1);assert.deepEqual(plain(reload(h.serialize()).serialize()),plain(h.serialize()));
  if(stage===10){const u=h.getUnit('subaru');assert.equal(u.level,13);assert.equal(u.exp,17);assert.deepEqual(plain(u.growthGains),save.units.find(u=>u.id==='subaru').growth.gains);}
 }
});
test('Corrupt balance markers rejected without changing the global save version',()=>{
 for(const stage of [9,10])for(const v of [0,2,null,'1',true]){const save=plain(fresh(stage).serialize());save.rehearsalBalanceVersion=v;assert.throws(()=>reload(save),/排练室属性版本/);}
});
console.log('Rehearsal balance: '+count+' cases passed.');
