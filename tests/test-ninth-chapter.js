'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const w={console};w.window=w;vm.createContext(w);
for(const f of ['equipment-data','magic-data','inventory','class-data','config','chapter-three','chapter-four','chapter-five','chapter-six','chapter-seven','chapter-eight','chapter-nine','chapter-ten','rng','growth-data','talents','growth','grid','pathfinding','combat','game','ai'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',f+'.js'),'utf8'),w,{filename:f});
const M=w.MyGO,I=M.Inventory,plain=x=>JSON.parse(JSON.stringify(x)),fresh=opts=>new M.Game({stage:9,seed:9911,...opts}),reload=g=>{const h=new M.Game();h.restore(plain(g.serialize()));return h;};
const hit=g=>g.applyCombat({attackerId:'tomori',defenderId:'rift_pegasus',hit:true,finalDamage:999});
const qty=(g,id)=>g.living('player').flatMap(u=>u.inventory).concat(g.convoy,g.lootReserve).filter(i=>i.id===id).length;
const approach=g=>{const u=g.getUnit('tomori');Object.assign(u,{x:13,y:3,acted:false});return u;};
let cases=0;function test(name,f){f();cases++;console.log('✓ '+name);}
test('28×34 room has connected party, equipment lanes, enemies and locked exit',()=>{
 const g=fresh({recruited:['xueyue','nina']}),t=g.getUnit('tomori'),r=M.Pathfinding.getReachable(g.map,{...t,move:9999},[]),used=new Set();
 assert.equal(g.map.cols,28);assert.equal(g.map.rows,34);assert.equal(g.livingCount('player'),8);assert.equal(g.livingCount('enemy'),12);
 for(const u of g.units){const k=u.x+','+u.y;assert(r.has(k),u.id);assert(!used.has(k),u.id);used.add(k);assert(Number.isFinite(M.Grid.movementCost(g.map,u,u.x,u.y)));}
 assert(r.has('13,3'));assert(!r.has('13,2'));assert(!Number.isFinite(M.Grid.movementCost(g.map,g.getUnit('rift_pegasus'),13,2)));
 assert(g.mission.decor.some(o=>o.kind==='drums'));assert(g.mission.decor.some(o=>o.kind==='keyboard'));assert(g.living('player').every(u=>u.y>=27));
});
test('Boss has enhanced pegasus stats, a usable steel lance, key and exact drops',()=>{
 const g=fresh(),b=g.getUnit('rift_pegasus'),p=g.getUnit('rehearsal-pegasus-0');
 assert(b.boss&&b.tags.includes('flying'));assert.equal(b.weaponId,'steel_lance');assert(I.usable(b));
 assert.equal(M.Combat.statTotalOf(b),135);assert(M.Combat.statTotalOf(b)>M.Combat.statTotalOf(p));assert.equal(M.Combat.preview(g.getUnit('anon'),b,g.map).effectiveness,3);
 assert.deepEqual(plain(b.drops),['strange_door_key','steel_lance']);assert(b.inventory.some(i=>i.id==='strange_door_key'));
 assert(g.living('enemy').filter(u=>u.tags.includes('armor')).every(u=>u.def-u.res>=15));
});
test('Direct entry includes Nina and Nijika; campaign loss and roster persist',()=>{
 assert(fresh().getUnit('nina'));assert.equal(fresh().getUnit('nijika').side,'player');
 const old=new M.Game({stage:8,ninaLost:true}),g=fresh({loadout:old.exportLoadout(),ninaLost:true,recruited:old.recruited});
 assert.equal(g.getUnit('nina'),null);assert.equal(reload(g).getUnit('nina'),null);
});
test('Pending/completed opening round-trips, cleanup is atomic and repeat-safe',()=>{
 const g=fresh();assert(!reload(g).stageNineIntroSeen);g._liveIntro={visible:()=>false};g.getUnit('rift_pegasus')._summonAlpha=.2;
 g.completeNinthIntro();g.completeNinthIntro();assert(g.stageNineIntroSeen&&!g._liveIntro);assert.equal(g.getUnit('rift_pegasus')._summonAlpha,undefined);
 assert(reload(g).stageNineIntroSeen);assert.deepEqual(plain(reload(g).serialize()),plain(g.serialize()));
});
test('Boss defeat grants both items exactly once, without ending the chapter',()=>{
 const g=fresh();g.completeNinthIntro();const before=qty(g,'steel_lance'),result=hit(g);
 assert.equal(result.drops.length,2);assert.equal(qty(g,'strange_door_key'),1);assert.equal(qty(g,'steel_lance'),before+1);
 assert(g.getUnit('rift_pegasus').dead);assert.equal(g.phase,'player');assert(!g.gateOpen);hit(g);assert.equal(qty(g,'strange_door_key'),1);
 assert(reload(g).getUnit('rift_pegasus').dead);assert.equal(reload(g).phase,'player');
});
test('Key must be present, Boss defeated, intro complete, unit adjacent, alive and unacted',()=>{
 const g=fresh(),u=approach(g);u.inventory.push(I.make('strange_door_key'));
 assert(!g.canUseGateKey(u));g.completeNinthIntro();assert(!g.canUseGateKey(u));hit(g);
 assert(g.canUseGateKey(u));for(const [k,v] of [['acted',true],['dead',true],['side','enemy'],['x',11]]){const old=u[k];u[k]=v;assert(!g.canUseGateKey(u),k);u[k]=old;}
 for(const phase of ['enemy','victory','defeat']){g.phase=phase;assert(!g.canUseGateKey(u));}g.phase='player';
 for(const bag of [u.inventory,g.convoy,g.lootReserve])for(let i=bag.length-1;i>=0;i--)if(bag[i].id==='strange_door_key')bag.splice(i,1);
 assert(!g.canUseGateKey(u));assert.equal(g.useGateKey(u),false);
});
test('Opening consumes the key and continues the same chapter without victory or reward',()=>{
 const g=fresh();g.completeNinthIntro();hit(g);const u=approach(g),gold=g.gold;
 assert.deepEqual(plain(g.useGateKey(u)),{x:13,y:2});assert(u.acted);assert.equal(qty(g,'strange_door_key'),0);
 assert(g.gateOpen);assert.equal(g.map.tiles[2][13],'gateOpen');assert.equal(g.phase,'player');assert(g.rehearsalTransitionPending);assert.equal(g.gold,gold);
 assert.equal(g.useGateKey(u),false);g.checkOutcome();assert.equal(g.gold,gold);
 const h=reload(g);assert.equal(h.serialize().rehearsalPart,2);assert.equal(h.phase,'player');assert.equal(h.gold,g.gold);assert.equal(h.map.tiles[2][13],'gateOpen');
});
test('All enemies dead still requires opening the door; unopened intro cannot grant victory',()=>{
 const g=fresh();for(const e of g.living('enemy')){e.hp=0;e.dead=true;}g.checkOutcome();assert.equal(g.phase,'player');
 g.completeNinthIntro();g.checkOutcome();assert.equal(g.phase,'player');
});
test('Full bags and full convoy retain both rewards and allow reserved key to open door',()=>{
 for(const fullConvoy of [false,true]){
  const g=fresh();g.completeNinthIntro();const u=g.getUnit('tomori');u.inventory=Array.from({length:5},()=>I.make('strange_door_key'));for(const i of u.inventory)i.id='courtyard_key';
  if(fullConvoy)g.convoy=Array.from({length:500},()=>I.make('iron_sword'));
  const before=qty(g,'steel_lance');hit(g);assert.equal(qty(g,'strange_door_key'),1);assert.equal(qty(g,'steel_lance'),before+1);
  if(fullConvoy)assert.equal(g.lootReserve.length,2);else assert(g.convoy.some(i=>i.id==='strange_door_key'));
  const h=reload(g),actor=approach(h);assert(h.canUseGateKey(actor));h.useGateKey(actor);assert(h.rehearsalTransitionPending);assert.equal(qty(h,'strange_door_key'),0);
 }
});
test('Chapter8→9 carries growth, talents, weapons, money, reserve and recruited roster',()=>{
 const old=new M.Game({stage:8,recruited:['nina','xueyue']}),n=old.getUnit('nijika');
 M.Growth.award(n,M.Growth.required(n.level));n.exp=17;old.gold=8888;old.convoy.push(I.make('steel_lance'));old.lootReserve.push(I.make('steel_sword'));
 const g=fresh({recruited:old.recruited,loadout:old.exportLoadout()});
 assert.equal(g.getUnit('nijika').level,n.level);assert.equal(g.getUnit('nijika').exp,17);assert.equal(g.gold,8888);assert.equal(g.livingCount('player'),8);
 assert.equal(qty(g,'steel_lance'),qty(old,'steel_lance'));assert.equal(qty(g,'steel_sword'),qty(old,'steel_sword'));
 assert.deepEqual(plain(reload(g).serialize()),plain(g.serialize()));
});
test('A fallen key carrier returns the unique door key to convoy/reserve for survivors',()=>{
 for(const full of [false,true]){
  const g=fresh();g.completeNinthIntro();hit(g);
  if(full)g.convoy=Array.from({length:500},()=>I.make('iron_sword'));
  const result=g.applyCombat({attackerId:'rehearsal-bow-b',defenderId:'tomori',hit:true,finalDamage:999});
  assert(g.getUnit('tomori').dead);assert.equal(result.drops[0].id,'strange_door_key');assert.equal(qty(g,'strange_door_key'),1);
  assert(!(g.getUnit('tomori').inventory.some(i=>i.id==='strange_door_key')));
  const h=reload(g),u=h.getUnit('anon');Object.assign(u,{x:13,y:3,acted:false});assert(h.canUseGateKey(u));h.useGateKey(u);assert(h.rehearsalTransitionPending);
 }
});
test('Fixed enemy values survive party growth, imported loads, turns and restoration',()=>{
 const g=fresh(),stats=g=>plain(g.units.filter(u=>u.side==='enemy').map(u=>[u.id,...['level','maxHp','str','mag','dex','spd','lck','def','res','move'].map(k=>u[k])])),before=stats(g);
 for(const u of g.living('player'))M.Growth.award(u,400);assert.deepEqual(stats(fresh({loadout:g.exportLoadout()})),before);
 g.completeNinthIntro();g.getUnit('rift_pegasus').hp=12;g.beginNextPlayerPhase();assert.deepEqual(stats(g),before);assert.deepEqual(stats(reload(g)),before);assert.equal(reload(g).getUnit('rift_pegasus').hp,12);
});
test('Malformed chapter, roster, opening, door and duplicate unit snapshots are rejected',()=>{
 for(const mutate of [s=>s.mapRevision++,s=>delete s.stageNineIntroSeen,s=>s.stageNineIntroSeen='yes',s=>s.recruited=[],s=>s.units.pop(),s=>s.units[0]={...s.units[1]},s=>s.gateOpen=true,s=>s.phase='victory',s=>s.fixedEnemyStatsVersion=2]){
  const s=plain(fresh().serialize());mutate(s);assert.throws(()=>fresh().restore(s));
 }
});
console.log('Chapter nine: '+cases+' scenarios passed.');
