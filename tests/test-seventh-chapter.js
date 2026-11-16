'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const w={console};w.window=w;vm.createContext(w);
for(const f of ['equipment-data','magic-data','inventory','class-data','config','chapter-three','chapter-four','chapter-five','chapter-six','chapter-seven','rng','growth-data','growth','grid','pathfinding','combat','game','ai'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',f+'.js'),'utf8'),w,{filename:f});
const M=w.MyGO,C=M.CONFIG;let cases=0;function test(name,f){f();cases++;console.log('✓ '+name);}const plain=x=>JSON.parse(JSON.stringify(x));
function game(recruited=[]){return new M.Game({stage:7,recruited,seed:7711});}
const statKeys=['maxHp','str','mag','dex','spd','lck','def','res','move'];
const effective=u=>M.Combat.statTotalOf(u)-(C.WEAPONS[C.STAGE_SEVEN.enemies.find(e=>e.id===u.id).weapon].damageType==='magic'?u.str:u.mag);
const enemyState=g=>plain(g.units.filter(u=>u.side==='enemy').map(u=>[u.id,u.level,u.hp,u.dead,u.acted,u.alerted,...statKeys.map(k=>u[k])]));
test('30×28 live house; stage, props and all units reachable without overlap',()=>{
 const g=game(['xueyue','nina']),start=g.getUnit('tomori'),seen=new Set(),q=[[start.x,start.y]];
 while(q.length){const [x,y]=q.shift(),key=x+','+y;if(seen.has(key)||!M.Grid.inBounds(g.map,x,y)||!Number.isFinite(M.Grid.movementCost(g.map,start,x,y)))continue;seen.add(key);q.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);}
 assert.equal(g.map.cols,30);assert.equal(g.map.rows,28);const occupied=new Set();for(const u of g.units){const k=u.x+','+u.y;assert(seen.has(k),u.id);assert(!occupied.has(k),u.id);occupied.add(k);}
 assert.equal(g.livingCount('enemy'),18);assert(g.living('enemy').every(u=>!u.boss&&!u.hpFloor));assert(C.STAGE_SEVEN.decor.some(o=>o.kind==='drums'&&o.y<8));
});
test('Opening joins Nijika once, immediately actionable with magic and healing',()=>{
 const g=game(),n=g.getUnit('nijika');assert.equal(n.side,'ally');assert(!M.Growth.eligible(n));assert.equal(g.livingCount('player'),5);
 assert.equal(n.level,9);assert.equal(['maxHp','str','mag','dex','spd','lck','def','res','move'].map(k=>n[k]).join(','),'30,7,11,10,11,13,7,9,4');
 assert.equal(g.joinNijika(),n);assert.equal(n.side,'player');assert(!n.acted);assert(M.Growth.eligible(n));assert(n.learnedSpells.includes('heal'));assert(n.learnedSpells.includes('nosferatu'));assert(M.Inventory.usable(n));
 n.acted=true;g.joinNijika();assert(n.acted);assert.equal(g.recruited.filter(id=>id==='nijika').length,1);assert.equal(g.livingCount('player'),6);
 const h=game(['xueyue','nina']);h.joinNijika();assert.equal(h.livingCount('player'),8);
});
test('Updated workbook Nijika values are exact and upgrade persists',()=>{
 const g=game();g.joinNijika();const n=g.getUnit('nijika');assert.equal(M.GrowthData.keys.map(k=>M.Growth.personalRates(n)[k]).join(','),'45,30,35,35,35,50,35,45');
 const r=M.Growth.award(n,M.Growth.required(n.level));assert.equal(n.level,10);assert(Object.values(r.levels[0].gains).filter(v=>v>0).length>=2);n.exp=36;n.hp=7;
 const h=game();h.restore(g.serialize());assert.deepEqual(plain(M.Growth.pack(h.getUnit('nijika'))),plain(M.Growth.pack(n)));assert.equal(h.getUnit('nijika').hp,7);assert(h.nijikaJoined);assert.equal(h.getUnit('nijika').side,'player');
});

test('Old Nijika saves gain exactly one level without changing stats, HP, EXP or growth RNG',()=>{
 for(const joined of [false,true])for(const level of [8,10,98,99]){
  const g=game();if(joined)g.joinNijika();const saved=plain(g.serialize());delete saved.nijikaLevelVersion;
  const n=saved.units.find(u=>u.id==='nijika');n.growth.level=level;n.growth.exp=level===99?0:17;n.hp=7;
  n.growth.gains.maxHp=(level-8)*3;n.growth.gains.mag=level-8;
  const rng=n.growth.rngState,h=game();h.restore(saved);const u=h.getUnit('nijika');
  assert.equal(u.level,Math.min(99,level+1));assert.equal(u.hp,7);assert.equal(u.maxHp,30+(level-8)*3);assert.equal(u.mag,11+level-8);
  assert.equal(u.exp,level>=98?0:17);assert.equal(u.growthRngState,rng);assert.equal(h.nijikaJoined,joined);
  const again=game();again.restore(h.serialize());assert.deepEqual(plain(M.Growth.pack(again.getUnit('nijika'))),plain(M.Growth.pack(u)));
 }
});
test('Pending opening restores as ally; corrupt recruitment and missing units rejected',()=>{
 const g=game(),s=g.serialize(),h=game();h.restore(s);assert(!h.nijikaJoined);assert.equal(h.getUnit('nijika').side,'ally');
 for(const mutate of [s=>s.nijikaJoined=true,s=>s.enemyScaleLevel=0,s=>s.units.pop(),s=>s.units.push(s.units[0]),s=>s.mapRevision=99]){const broken=plain(s);mutate(broken);assert.throws(()=>game().restore(broken));}
});
test('Only the last enemy completes victory, chapter reward awarded once',()=>{
 const g=game();g.joinNijika();const enemies=g.living('enemy'),last=enemies.pop(),gold=g.gold;for(const e of enemies){e.hp=0;e.dead=true;}
 g.checkOutcome();assert.equal(g.phase,'player');last.dead=true;last.hp=0;g.checkOutcome();assert.equal(g.phase,'victory');assert.equal(g.gold,gold+2000);g.checkOutcome();assert.equal(g.gold,gold+2000);
 const h=game();h.restore(g.serialize());assert.equal(h.phase,'victory');assert.equal(h.gold,g.gold);
});
test('No early victory before recruitment and fallen Nijika is not revived on restore',()=>{
 const g=game();for(const e of g.living('enemy')){e.hp=0;e.dead=true;}g.checkOutcome();assert.equal(g.phase,'player');g.joinNijika();g.checkOutcome();assert.equal(g.phase,'victory');
 const h=game();h.joinNijika();Object.assign(h.getUnit('nijika'),{dead:true,hp:0,acted:true});const j=game();j.restore(h.serialize());assert(j.getUnit('nijika').dead);assert.equal(j.getUnit('nijika').hp,0);assert.equal(j.joinNijika(),null);
});
test('Six to seven preserves growth, economy and recruited companions',()=>{
 const g=new M.Game({stage:6,recruited:['xueyue','nina'],seed:6});const t=g.getUnit('tomori');M.Growth.award(t,M.Growth.required(t.level));t.exp=29;g.gold=4733;
 const h=new M.Game({stage:7,recruited:g.recruited,loadout:g.exportLoadout()});assert.equal(h.gold,4733);assert.equal(h.getUnit('tomori').level,t.level);assert.equal(h.getUnit('tomori').exp,29);assert.equal(h.livingCount('player'),7);h.joinNijika();assert.equal(h.livingCount('player'),8);
 const before=h.getUnit('live-blade').maxHp;for(const u of h.living('player'))u.level+=10;h.beginNextPlayerPhase();assert.equal(h.getUnit('live-blade').maxHp,before);
});
test('All 18 fixed enemies gain exactly 17 panel points and at least 9 useful points over authored templates',()=>{
 {
  const g=game(),old=game();old.restoreLegacyEnemyScale(9,old.units,true,false,true);
  for(const u of g.living('enemy')){
   const before=old.getUnit(u.id),magic=C.WEAPONS[C.STAGE_SEVEN.enemies.find(e=>e.id===u.id).weapon].damageType==='magic';
   assert.equal(M.Combat.statTotalOf(u)-M.Combat.statTotalOf(before),17,u.id+' total');
   assert.equal(effective(u)-effective(before),magic?12:13,u.id+' useful points');
   assert.equal(u[magic?'mag':'str']-before[magic?'mag':'str'],3);assert.equal(u.move,before.move);assert.equal(u.level,before.level);
  }
 }
});
test('Chapter seven bonuses do not accumulate, heal wounds or depend on remaining spells',()=>{
 let g=game();g.joinNijika();
 g.getUnit('live-blade').hp=7;g.getUnit('live-mage-w').hp=13;g.getUnit('live-mage-w').spellUses.miasma=0;M.Inventory.sync(g.getUnit('live-mage-w'));
 Object.assign(g.getUnit('live-bow'),{hp:0,dead:true,acted:true,alerted:true});const before=enemyState(g);
 for(let i=0;i<5;i++)g.applyFixedEnemyStats();assert.deepEqual(enemyState(g),before);
 for(let i=0;i<5;i++){const h=game();h.restore(plain(g.serialize()));g=h;}assert.deepEqual(enemyState(g),before);assert.equal(g.getUnit('live-mage-w').spellUses.miasma,0);
});
test('Old seventh saves migrate wounded/dead enemies once while keeping positions and recruitment',()=>{
 for(const joined of [false,true])for(const level of [1,24]){
  const old=game();if(joined)old.joinNijika();old.restoreLegacyEnemyScale(level,old.units,true,false,true);
  for(const u of old.living('enemy')){u.hp=Math.floor(u.maxHp*.8);u.alerted=true;}
  old.getUnit('live-blade-w').hp=1;Object.assign(old.getUnit('live-bow'),{hp:0,dead:true,acted:true});
  const saved=plain(old.serialize());delete saved.enemyBalanceVersion;delete saved.fixedEnemyStatsVersion;const h=game();h.restore(saved);
  assert.equal(h.serialize().enemyBalanceVersion,1);assert.equal(h.nijikaJoined,joined);assert.equal(h.enemyScaleLevel,9);assert.equal(h.gold,old.gold);
  for(const u of h.units.filter(u=>u.side==='enemy')){
   const before=old.getUnit(u.id);assert.equal(u.level,9);
   assert.equal(u.hp,u.dead?0:Math.ceil(u.maxHp*before.hp/before.maxHp-1e-9),u.id+' wounds');assert.equal(u.dead,before.dead);assert.equal(u.acted,before.acted);assert.equal(u.alerted,before.alerted);assert.equal(u.x,before.x);assert.equal(u.y,before.y);
  }
  const again=game();again.restore(plain(h.serialize()));assert.deepEqual(enemyState(again),enemyState(h));
 }
 for(const value of [0,2,null,'1',true]){const s=plain(game().serialize());s.enemyBalanceVersion=value;assert.throws(()=>game().restore(s),/平衡版本/);}
});
test('Epilogue completion persists, old saves remain compatible, invalid flags rejected',()=>{
 const g=game();g.joinNijika();assert.equal(g.livehouseEndingShown,false);
 for(const e of g.living('enemy')){e.dead=true;e.hp=0;}g.checkOutcome();g.livehouseEndingShown=true;
 const s=g.serialize(),h=game();h.restore(s);assert.equal(h.livehouseEndingShown,true);
 const old=plain(s);delete old.livehouseEndingShown;h.restore(old);assert.equal(h.livehouseEndingShown,false);
 const wrong=plain(s);wrong.livehouseEndingShown='true';assert.throws(()=>game().restore(wrong),/剧情/);
 const premature=game().serialize();premature.livehouseEndingShown=true;assert.throws(()=>game().restore(premature),/剧情/);
});
console.log('Seventh chapter: '+cases+' cases passed.');
