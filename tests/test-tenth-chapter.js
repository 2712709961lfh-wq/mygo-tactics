'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const w={console};w.window=w;vm.createContext(w);
for(const f of ['equipment-data','magic-data','inventory','class-data','class-mastery','config','chapter-three','chapter-four','chapter-five','chapter-six','chapter-seven','chapter-eight','chapter-nine','chapter-ten','rng','growth-data','talents','growth','grid','pathfinding','combat','game','ai'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',f+'.js'),'utf8'),w,{filename:f});
const M=w.MyGO,C=M.CONFIG,I=M.Inventory,plain=x=>JSON.parse(JSON.stringify(x)),fresh=opts=>new M.Game({stage:10,seed:10101,...opts}),reload=g=>{const h=new M.Game();h.restore(plain(g.serialize()));return h;};
const hit=(g,id)=>g.applyCombat({attackerId:'tomori',defenderId:id,hit:true,finalDamage:999});
let cases=0;function test(name,f){f();cases++;console.log('✓ '+name);}
test('Same 28×34 rehearsal room and equipment, all units connected with no overlap',()=>{
 const g=fresh({recruited:['xueyue','nina']}),r=M.Pathfinding.getReachable(g.map,{...g.getUnit('tomori'),move:9999},[]),used=new Set();
 assert.equal(g.stage,10);assert.equal(g.map.cols,28);assert.equal(g.map.rows,34);assert.equal(g.livingCount('enemy'),15);assert.equal(g.livingCount('player'),8);
 assert.deepEqual(plain(g.map.decor),plain(C.STAGE_NINE.decor));assert.equal(g.map.tiles[2][13],'gateOpen');
 for(const u of g.units){const k=u.x+','+u.y;assert(r.has(k),u.id);assert(!used.has(k),u.id);used.add(k);}
 assert(g.getUnit('subaru').y<g.getUnit('nina').y);assert.equal(g.getUnit('dark_nina').y,14);
});
test('Subaru begins as ally, joins immediately after opening dialogue and never duplicates',()=>{
 const g=fresh(),s=g.getUnit('subaru');assert.equal(s.side,'ally');assert(!g.subaruJoined&&!g.stageTenIntroSeen);assert(!g.recruited.includes('subaru'));
 g._liveIntro={visible:()=>false};g.getUnit('loop-armor-0')._summonAlpha=.1;
 g.completeTenthIntro();assert(g.subaruJoined&&g.stageTenIntroSeen);assert.equal(s.side,'player');assert(!s.acted);assert(!g._liveIntro);assert.equal(g.getUnit('loop-armor-0')._summonAlpha,undefined);
 const n=s.inventory.length,spells=plain(s.learnedSpells);g.completeTenthIntro();assert.equal(s.inventory.length,n);assert.deepEqual(plain(s.learnedSpells),spells);assert.equal(g.recruited.filter(id=>id==='subaru').length,1);assert.equal(g.units.filter(u=>u.id==='subaru').length,1);
});
test('A real mage with usable magic, support spells, personal growth and certification',()=>{
 const g=fresh();g.completeTenthIntro();const s=g.getUnit('subaru');assert.equal(s.level,12);assert.equal(s.classId,'mage');assert(I.usable(s));assert.equal(s.weapon.damageType,'magic');
 assert(s.learnedSpells.includes('heal'));assert(M.Growth.eligible(s));const report=M.Growth.award(s,M.Growth.required(s.level));assert.equal(s.level,13);assert(report.levels.length===1);assert(Object.values(s.growthGains).some(v=>v>0));
 s.inventory.push(I.make('intermediate_seal'));assert(!g.reclassReason(s,'priest'));g.reclassUnit(s,'priest');assert.equal(s.classId,'priest');assert.equal(reload(g).getUnit('subaru').classId,'priest');
});
test('Nina phantom is enemy brawler, distinct from real Nina, with steel-gauntlet brave attacks',()=>{
 const g=fresh(),n=g.getUnit('nina'),p=g.getUnit('dark_nina');assert.equal(n.side,'player');assert.equal(p.side,'enemy');assert.equal(p.classId,'brawler');assert.equal(p.className,'拳斗士');assert.equal(p.weaponId,'steel_gauntlets');assert(p.weapon.brave&&I.usable(p));assert(p.boss&&!p.hpFloor);
 assert(!M.Growth.eligible(p));g.completeTenthIntro();Object.assign(n,{x:13,y:15});const round=M.Combat.forecast(p,n,g.map);assert(round);assert.equal(g.getUnit('nina'),n);
});
test('No victory before opening, and phantom defeat alone does not clear remaining enemies',()=>{
 const g=fresh();hit(g,'dark_nina');assert.equal(g.phase,'player');g.completeTenthIntro();g.checkOutcome();assert.equal(g.phase,'player');assert.equal(g.livingCount('enemy'),14);
 for(const e of g.living('enemy'))hit(g,e.id);assert.equal(g.phase,'victory');
 const h=fresh();for(const e of h.living('enemy')){e.hp=0;e.dead=true;}h.checkOutcome();assert.equal(h.phase,'player');h.completeTenthIntro();h.checkOutcome();assert.equal(h.phase,'victory');
});
test('Last remaining ordinary enemy is required, chapter reward is granted only once',()=>{
 const g=fresh();g.completeTenthIntro();const gold=g.gold,last='loop-soldier-8';for(const e of g.living('enemy'))if(e.id!==last)hit(g,e.id);
 assert.equal(g.phase,'player');assert.equal(g.livingCount('enemy'),1);hit(g,last);assert.equal(g.phase,'victory');assert.equal(g.gold,gold+2000);g.checkOutcome();assert.equal(g.gold,gold+2000);const h=reload(g);assert.equal(h.phase,'victory');assert.equal(h.gold,g.gold);
});
test('Pending and completed openings, grown Subaru and wounds round-trip',()=>{
 const g=fresh();assert(!reload(g).stageTenIntroSeen);assert.equal(reload(g).getUnit('subaru').side,'ally');g.completeTenthIntro();const s=g.getUnit('subaru');M.Growth.award(s,M.Growth.required(s.level));s.exp=15;s.hp-=6;
 const h=reload(g);assert(h.stageTenIntroSeen&&h.subaruJoined);assert.equal(h.getUnit('subaru').side,'player');assert.equal(h.getUnit('subaru').level,13);assert.equal(h.getUnit('subaru').exp,15);assert.equal(h.getUnit('subaru').hp,s.hp);assert.deepEqual(plain(reload(h).serialize()),plain(h.serialize()));
});
test('Subaru may fall after joining; the remaining team can still clear the chapter',()=>{
 const g=fresh();g.completeTenthIntro();g.applyCombat({attackerId:'dark_nina',defenderId:'subaru',hit:true,finalDamage:999});assert(g.getUnit('subaru').dead);assert(reload(g).getUnit('subaru').dead);
 for(const e of g.living('enemy'))hit(g,e.id);assert.equal(g.phase,'victory');assert(reload(g).getUnit('subaru').dead);
});
test('All players defeated produces defeat, not a phantom-only victory',()=>{
 const g=fresh();g.completeTenthIntro();for(const u of g.living('player')){u.dead=true;u.hp=0;}g.checkOutcome();assert.equal(g.phase,'defeat');assert.equal(reload(g).phase,'defeat');
});
test('Chapter9→10 inherits growth/talents/inventory/economy and introduces one new ally',()=>{
 const old=new M.Game({stage:9,recruited:['xueyue','nina']}),n=old.getUnit('nijika');M.Growth.award(n,M.Growth.required(n.level));n.exp=23;old.gold=7654;old.convoy.push(I.make('steel_lance'));
 const g=fresh({recruited:old.recruited,loadout:old.exportLoadout()});assert.equal(g.getUnit('nijika').level,n.level);assert.equal(g.getUnit('nijika').exp,23);assert.equal(g.gold,7654);assert(g.convoy.some(i=>i.id==='steel_lance'));assert.equal(g.getUnit('subaru').side,'ally');g.completeTenthIntro();assert.equal(g.livingCount('player'),9);
 assert.deepEqual(plain(reload(g).serialize()),plain(g.serialize()));
});
test('Nina lost in earlier chapters stays lost; the phantom remains present',()=>{
 const old=new M.Game({stage:9,ninaLost:true}),g=fresh({recruited:old.recruited,ninaLost:true,loadout:old.exportLoadout()});assert.equal(g.getUnit('nina'),null);assert(g.getUnit('dark_nina'));g.completeTenthIntro();assert.equal(reload(g).getUnit('nina'),null);
});
test('Enemy stats fixed across party growth, imports, turns and saved wounds',()=>{
 const stats=g=>plain(g.units.filter(u=>u.side==='enemy').map(u=>[u.id,...['level','maxHp','str','mag','dex','spd','lck','def','res','move'].map(k=>u[k])])),g=fresh(),before=stats(g);g.completeTenthIntro();
 for(const u of g.living('player'))M.Growth.award(u,500);assert.deepEqual(stats(fresh({loadout:g.exportLoadout()})),before);g.getUnit('dark_nina').hp=11;g.beginNextPlayerPhase();assert.deepEqual(stats(g),before);assert.deepEqual(stats(reload(g)),before);assert.equal(reload(g).getUnit('dark_nina').hp,11);
});
test('Invalid opening, roster, units, premature victory and map states are rejected',()=>{
 for(const mutate of [s=>s.mapRevision++,s=>delete s.stageTenIntroSeen,s=>s.subaruJoined=true,s=>s.recruited.push('subaru'),s=>s.units.pop(),s=>s.units[0]={...s.units[1]},s=>s.gateOpen=true,s=>s.phase='victory',s=>s.fixedEnemyStatsVersion=2,s=>{const u=s.units.find(u=>u.id==='subaru');u.dead=true;u.hp=0;}]){
  const s=plain(fresh().serialize());mutate(s);assert.throws(()=>fresh().restore(s));
 }
 const g=fresh();g.completeTenthIntro();const s=plain(g.serialize());s.phase='victory';assert.throws(()=>fresh().restore(s),/敌军尚未清除/);
});
console.log('Chapter ten: '+cases+' scenarios passed.');

