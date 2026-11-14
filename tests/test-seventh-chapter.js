'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const w={console};w.window=w;vm.createContext(w);
for(const f of ['equipment-data','magic-data','inventory','class-data','config','chapter-three','chapter-four','chapter-five','chapter-six','chapter-seven','rng','growth-data','growth','grid','pathfinding','combat','game','ai'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',f+'.js'),'utf8'),w,{filename:f});
const M=w.MyGO,C=M.CONFIG;let cases=0;function test(name,f){f();cases++;console.log('✓ '+name);}const plain=x=>JSON.parse(JSON.stringify(x));
function game(recruited=[]){return new M.Game({stage:7,recruited,seed:7711});}
test('30×28 live house; stage, props and all units reachable without overlap',()=>{
 const g=game(['xueyue','nina']),start=g.getUnit('tomori'),seen=new Set(),q=[[start.x,start.y]];
 while(q.length){const [x,y]=q.shift(),key=x+','+y;if(seen.has(key)||!M.Grid.inBounds(g.map,x,y)||!Number.isFinite(M.Grid.movementCost(g.map,start,x,y)))continue;seen.add(key);q.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);}
 assert.equal(g.map.cols,30);assert.equal(g.map.rows,28);const occupied=new Set();for(const u of g.units){const k=u.x+','+u.y;assert(seen.has(k),u.id);assert(!occupied.has(k),u.id);occupied.add(k);}
 assert.equal(g.livingCount('enemy'),18);assert(g.living('enemy').every(u=>!u.boss&&!u.hpFloor));assert(C.STAGE_SEVEN.decor.some(o=>o.kind==='drums'&&o.y<8));
});
test('Opening joins Nijika once, immediately actionable with magic and healing',()=>{
 const g=game(),n=g.getUnit('nijika');assert.equal(n.side,'ally');assert(!M.Growth.eligible(n));assert.equal(g.livingCount('player'),5);
 assert.equal(g.joinNijika(),n);assert.equal(n.side,'player');assert(!n.acted);assert(M.Growth.eligible(n));assert(n.learnedSpells.includes('heal'));assert(n.learnedSpells.includes('nosferatu'));assert(M.Inventory.usable(n));
 n.acted=true;g.joinNijika();assert(n.acted);assert.equal(g.recruited.filter(id=>id==='nijika').length,1);assert.equal(g.livingCount('player'),6);
 const h=game(['xueyue','nina']);h.joinNijika();assert.equal(h.livingCount('player'),8);
});
test('Updated workbook Nijika values are exact and upgrade persists',()=>{
 const g=game();g.joinNijika();const n=g.getUnit('nijika');assert.equal(M.GrowthData.keys.map(k=>M.Growth.personalRates(n)[k]).join(','),'45,30,35,35,35,50,35,40');
 const r=M.Growth.award(n,M.Growth.required(n.level));assert.equal(n.level,9);assert(Object.values(r.levels[0].gains).filter(v=>v>0).length>=2);n.exp=36;n.hp=7;
 const h=game();h.restore(g.serialize());assert.deepEqual(plain(M.Growth.pack(h.getUnit('nijika'))),plain(M.Growth.pack(n)));assert.equal(h.getUnit('nijika').hp,7);assert(h.nijikaJoined);assert.equal(h.getUnit('nijika').side,'player');
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
 const before=h.getUnit('live-blade').maxHp;for(const u of h.living('player'))u.level+=10;h.scaleParkEnemies();assert(h.getUnit('live-blade').maxHp>before);
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
