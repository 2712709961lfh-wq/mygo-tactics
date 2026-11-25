'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const w={console,document:{readyState:'loading'},addEventListener(){},setTimeout(){},clearTimeout(){}};w.window=w;vm.createContext(w);
for(const f of ['equipment-data','magic-data','inventory','class-data','class-mastery','config','chapter-three','chapter-four','chapter-five','chapter-six','chapter-seven','chapter-eight','chapter-nine','chapter-ten','chapter-palace','chapter-royal-garden','chapter-school','rng','growth-data','talents','growth','grid','pathfinding','combat','game','ai','ui','entry','training','save'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',f+'.js'),'utf8'),w,{filename:f});
const M=w.MyGO,C=M.CONFIG,plain=x=>JSON.parse(JSON.stringify(x)),fresh=opts=>new M.Game({stage:13,seed:1125,...opts}),reload=g=>{const h=new M.Game();h.restore(plain(g.serialize()));return h;},hit=(g,id)=>g.applyCombat({attackerId:'tomori',defenderId:id,hit:true,finalDamage:999});let count=0;
function test(name,f){f();count++;console.log('✓ '+name);}
function advance(g,n){while(g.turn<n){g.phase='enemy';g.beginNextPlayerPhase();}}
function unique(g){const seen=new Set();for(const u of g.units.filter(u=>!u.dead)){const k=u.x+','+u.y;assert(!seen.has(k),u.id+' overlap');seen.add(k);assert(Number.isFinite(M.Grid.movementCost(g.map,u,u.x,u.y)));}}
test('Chapter 12 follows garden 11 and all units connect from the school gate',()=>{
 const g=fresh(),r=M.Pathfinding.getReachable(g.map,{...g.getUnit('tomori'),move:9999},[]);assert.equal(g.chapterNumber,12);assert.equal(g.nextChapterStage,null);assert.equal(new M.Game({stage:12}).nextChapterStage,13);assert.equal(g.map.rows,38);assert.equal(g.livingCount('player'),9);unique(g);
 for(const u of g.units)assert(r.has(u.x+','+u.y),u.id+' unreachable');for(const u of g.living('player'))assert(u.y>=31&&u.y<=35);assert(g.map.decor.some(o=>o.kind==='school-gate'));
});
test('Initial roster includes 6 cavalry, 4 armor, 2 ordinary Pegasus, 5 phantoms and a rift Boss',()=>{
 const g=fresh(),es=g.living('enemy');assert.equal(es.length,18);assert.equal(es.filter(u=>u.tags.includes('cavalry')).length,6);assert.equal(es.filter(u=>u.tags.includes('armor')).length,4);assert.equal(es.filter(u=>u.tags.includes('flying')).length,3);const phantoms=es.filter(u=>u.name.startsWith('学园幻兵'));assert.equal(phantoms.length,5);assert.deepEqual([...new Set(phantoms.map(u=>u.weapon.type))].sort(),['axe','bow','lance','sword']);assert(phantoms.every(u=>u.tags.includes('monster')&&u.move===5));const b=g.getUnit(g.mission.bossId);assert.equal(b.level,20);assert.equal(b.weaponId,'steel_lance');assert.equal(b.hpFloor,0);assert(M.Combat.effectivenessAgainst(C.WEAPONS.iron_bow,b)>1);
});
test('Previous campus roster adopts phantoms while retaining positions, death, action and wound ratios',()=>{
 const g=fresh();g.schoolIntroSeen=true;advance(g,3);const snapshot=plain(g.serialize());delete snapshot.schoolRosterVersion;
 for(const [id,old]of Object.entries(C.STAGE_SCHOOL.phantomReplacements)){
  const state=snapshot.units.find(u=>u.id===id);state.classState={version:1,id:old.classId,certified:old.classId?[old.classId]:[]};state.hp=Math.floor(old.maxHp/2);state.acted=true;state.alerted=true;state.inventory=[plain(M.Inventory.make('steel_lance'))];state.equippedWeapon='steel_lance';
 }
 Object.assign(snapshot.units.find(u=>u.id==='school-armor-5'),{hp:0,dead:true});
 const before=plain(snapshot),h=reload({serialize:()=>snapshot});assert.deepEqual(snapshot,before);
 for(const id of Object.keys(C.STAGE_SCHOOL.phantomReplacements)){const u=h.getUnit(id),s=snapshot.units.find(u=>u.id===id),t=C.STAGE_SCHOOL.templateForId(id);assert(u.name.startsWith('学园幻兵'));assert.equal(u.x,s.x);assert.equal(u.y,s.y);assert(u.acted&&u.alerted);assert.equal(u.dead,s.dead);assert.equal(u.hp,s.dead?0:Math.ceil(t.maxHp*s.hp/C.STAGE_SCHOOL.phantomReplacements[id].maxHp));assert.equal(u.weaponId,t.weapon);}
 assert.equal(h.schoolWavesSpawned,1);assert.equal(h.serialize().schoolRosterVersion,1);assert.deepEqual(plain(reload(h).serialize()),plain(h.serialize()));
});
test('Waves arrive at player-phase starts 3,6,9; never duplicate or act immediately',()=>{
 const g=fresh();g.schoolIntroSeen=true;
 for(let turn=2;turn<=12;turn++){
  g.phase='enemy';assert(g.beginNextPlayerPhase());assert.equal(g.phase,'player');assert.equal(g.schoolWavesSpawned,Math.floor(turn/3));assert.equal(g.units.filter(u=>/^school-wave-/.test(u.id)).length,3*Math.floor(turn/3));unique(g);
  if(turn%3===0){const ids=g.lastSchoolReinforcement.ids,us=ids.map(id=>g.getUnit(id));assert.equal(us.filter(u=>u.tags.includes('flying')).length,2);assert.equal(us.filter(u=>u.tags.includes('cavalry')).length,1);assert(us.every(u=>u.alerted&&!u.acted&&u.y>=31&&u.y<=35));assert.equal(g.spawnSchoolReinforcements(),null);}
  else assert.equal(g.lastSchoolReinforcement,null);
 }
});
test('Opening and non-player phases cannot spawn reinforcements',()=>{
 const g=fresh();g.turn=3;assert.equal(g.spawnSchoolReinforcements(),null);g.schoolIntroSeen=true;g.phase='enemy';assert.equal(g.spawnSchoolReinforcements(),null);g.phase='player';assert(g.spawnSchoolReinforcements());
});
test('Occupied preferred spawns fall back near gate; insufficient space defers a whole wave',()=>{
 const g=fresh();g.schoolIntroSeen=true;advance(g,3);unique(g);assert.notEqual(g.getUnit('school-wave-1-0').x+','+g.getUnit('school-wave-1-0').y,'15,34');
 const h=fresh();h.schoolIntroSeen=true;h.turn=3;for(let y=31;y<=35;y++)for(let x=12;x<=21;x++)if(!h.unitAt(x,y))h.units.push({...h.getUnit('tomori'),id:'block-'+x+'-'+y,x,y});
 const n=h.units.length;assert.equal(h.spawnSchoolReinforcements(),null);assert.equal(h.units.length,n);assert.equal(h.schoolWavesSpawned,0);
 h.units=h.units.filter(u=>!u.id.startsWith('block-'));assert(h.spawnSchoolReinforcements());assert.equal(h.schoolWavesSpawned,1);unique(h);
});
test('Each wave drops medicine and a rotating steel lance, iron shield or steel bow',()=>{
 const g=fresh();g.schoolIntroSeen=true;for(let n=1;n<=3;n++){
  advance(g,n*3);for(const [suffix,item] of [[0,'concoction'],[1,['steel_lance','iron_shield','steel_bow'][n-1]]]){const u=g.getUnit('school-wave-'+n+'-'+suffix);assert(u.inventory.some(i=>i.id===item));const result=hit(g,u.id);assert.equal(result.drops[0].id,item);assert(u.dead);assert(!u.inventory.some(i=>i.id===item));}
 }assert(g.livingCount('enemy')>0);
});
test('Full backpack and convoy preserve drops in reserve, and reload never pays again',()=>{
 const g=fresh();g.schoolIntroSeen=true;advance(g,3);const u=g.getUnit('tomori');while(u.inventory.length<5)u.inventory.push(M.Inventory.make('iron_sword'));g.convoy=Array.from({length:500},()=>M.Inventory.make('iron_sword'));
 const result=hit(g,'school-wave-1-1');assert.equal(result.drops[0].id,'steel_lance');const h=reload(g);assert(h.getUnit('school-wave-1-1').dead);assert.equal(h.schoolWavesSpawned,1);assert.equal(h.spawnSchoolReinforcements(),null);assert.equal(h.lootReserve.length,g.lootReserve.length);assert.deepEqual(plain(h.serialize()),plain(g.serialize()));
});
test('Wave wounds, acted state, deaths, loot and future schedule survive exact round-trip',()=>{
 let g=fresh();assert.deepEqual(plain(reload(g).serialize()),plain(g.serialize()));g.schoolIntroSeen=true;advance(g,6);g.getUnit('school-wave-2-2').hp=7;g.getUnit('school-wave-2-2').acted=true;hit(g,'school-wave-1-0');g=reload(g);assert.equal(g.getUnit('school-wave-2-2').hp,7);assert(g.getUnit('school-wave-2-2').acted);assert.deepEqual(plain(reload(g).serialize()),plain(g.serialize()));advance(g,9);assert.equal(g.schoolWavesSpawned,3);assert.equal(g.units.filter(u=>/^school-wave-/.test(u.id)).length,9);
});
test('Killing only Boss wins once, awards steel lance, and stops all later reinforcements',()=>{
 const g=fresh();g.schoolIntroSeen=true;advance(g,3);const gold=g.gold,r=hit(g,g.mission.bossId);assert.equal(r.drops[0].id,'steel_lance');assert.equal(g.phase,'victory');assert(g.livingCount('enemy')>0);assert.equal(g.gold,gold+2000);g.checkOutcome();assert.equal(g.gold,gold+2000);assert.equal(g.beginNextPlayerPhase(),false);assert.equal(g.spawnSchoolReinforcements(),null);assert.equal(reload(g).phase,'victory');assert.deepEqual(plain(g.rewardedChapters),[12]);
});
test('Chapter 11 loadout retains growth, spells, mastery, gold, convoy and camp save',()=>{
 const old=new M.Game({stage:12});old.royalGardenIntroSeen=true;const s=old.getUnit('subaru');M.Growth.award(s,500);M.Mastery.award(s,4);s.spellUses.miasma=1;old.gold=7654;old.trainingTicketsPurchased=2;old.rewardedChapters=[3];
 const g=fresh({recruited:old.recruited,loadout:old.exportLoadout()});assert.equal(g.gold,7654);assert.equal(g.getUnit('subaru').level,s.level);assert.deepEqual(plain(M.Mastery.pack(g.getUnit('subaru'))),plain(M.Mastery.pack(s)));assert.equal(g.trainingTicketsPurchased,2);g.retreat={chapterIntroPlayed:false};assert.deepEqual(plain(reload(g).serialize()),plain(g.serialize()));assert.equal(reload(old).stage,12);
});
test('Save card counts summoned enemies and shows mission 12',()=>{
 const g=fresh();g.schoolIntroSeen=true;advance(g,3);const ctx={ui:{game:g,busy:false,mode:'idle',saveManager:{storageType:'memory'}},getSaveInfo:()=>({ok:true,loaded:{snapshot:plain(g.serialize()),savedAt:'2026-11-25T10:00:00.000Z'}}),dom:{saveInfo:{},saveLoad:{},saveDelete:{},saveCurrent:{},saveStatus:{}}};M.EntryScreen.prototype.refreshSavePanel.call(ctx);assert(ctx.dom.saveInfo.innerHTML.includes('MISSION 12'));assert(ctx.dom.saveInfo.innerHTML.includes('我方 9 / 敌方 21'));
});
test('Corrupt wave counters, missing members, mismatched chapters and fake victories reject atomically',()=>{
 for(const mutate of [s=>s.schoolWavesSpawned=-1,s=>s.schoolWavesSpawned=1,s=>s.schoolWavesSpawned=.5,s=>s.schoolChapterVersion=2,s=>s.schoolRosterVersion=2,s=>delete s.schoolChapterVersion,s=>s.stage=13,s=>s.mapRevision++,s=>s.royalGardenChapterVersion=1,s=>s.units.pop(),s=>delete s.schoolIntroSeen,s=>s.phase='victory']){const current=fresh(),before=plain(current.serialize()),snapshot=plain(before);mutate(snapshot);assert.throws(()=>current.restore(snapshot));assert.deepEqual(plain(current.serialize()),before);}
 const g=fresh();g.schoolIntroSeen=true;advance(g,6);for(const mutate of [s=>s.schoolWavesSpawned=1,s=>s.units.pop(),s=>s.units.push(s.units[s.units.length-1])]){const snapshot=plain(g.serialize());mutate(snapshot);assert.throws(()=>reload({serialize:()=>snapshot}));}
});
console.log('School: '+count+' scenarios passed.');
