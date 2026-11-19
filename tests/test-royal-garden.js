'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const w={console,document:{readyState:'loading'},addEventListener(){},setTimeout(){},clearTimeout(){}};w.window=w;vm.createContext(w);
for(const f of ['equipment-data','magic-data','inventory','class-data','class-mastery','config','chapter-three','chapter-four','chapter-five','chapter-six','chapter-seven','chapter-eight','chapter-nine','chapter-ten','chapter-palace','chapter-royal-garden','rng','growth-data','talents','growth','grid','pathfinding','combat','game','ai','ui','entry','training','save'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',f+'.js'),'utf8'),w,{filename:f});
const M=w.MyGO,C=M.CONFIG,plain=x=>JSON.parse(JSON.stringify(x)),fresh=opts=>new M.Game({stage:12,seed:1119,...opts}),reload=g=>{const h=new M.Game();h.restore(plain(g.serialize()));return h;};
const hit=(g,id)=>g.applyCombat({attackerId:'tomori',defenderId:id,hit:true,finalDamage:999});let cases=0;
function test(name,f){f();cases++;console.log('✓ '+name);}
test('Public chapter eleven follows palace ten, with original nine-part finale untouched',()=>{
 const g=fresh();assert.equal(g.chapterNumber,11);assert.equal(g.mission.chapter,'MISSION 11');assert.equal(g.nextChapterStage,null);assert.equal(new M.Game({stage:11}).nextChapterStage,12);assert.equal(new M.Game({stage:10}).chapterNumber,9);assert.equal(g.livingCount('player'),9);assert.equal(g.getUnit('subaru').side,'player');
 assert(C.STAGE_PALACE.decor.some(o=>o.kind==='palace-rear-door'));assert(g.map.decor.some(o=>o.kind==='royal-palace-door'));
});
test('All units and both bosses are distinct, walkable and connected around walls and canals',()=>{
 const g=fresh(),ground=g.getUnit('tomori'),r=M.Pathfinding.getReachable(g.map,{...ground,move:9999},[]),used=new Set();assert.equal(g.map.cols,34);assert.equal(g.map.rows,40);
 for(const u of g.units){const k=u.x+','+u.y;assert(r.has(k),u.id+' unreachable');assert(!used.has(k),u.id+' overlap');used.add(k);}
 for(const o of g.map.decor.filter(o=>['royal-wall','royal-parterre'].includes(o.kind)))for(let y=o.y;y<o.y+o.h;y++)for(let x=o.x;x<o.x+o.w;x++)assert.equal(g.map.tiles[y][x],'wall');
});
test('Ground units use offset bridges; flyers cross water, but no unit can cross a wall',()=>{
 const g=fresh(),horse=g.getUnit('garden-cavalier-0'),fly=g.getUnit('garden-pegasus-0');
 for(const u of [horse,g.getUnit('tomori')]){assert.equal(M.Grid.movementCost(g.map,u,15,26),Infinity);assert.equal(M.Grid.movementCost(g.map,u,6,26),1);assert.equal(M.Grid.movementCost(g.map,u,11,16),1);}
 assert.equal(M.Grid.movementCost(g.map,fly,15,26),1);for(const u of [horse,fly])assert.equal(M.Grid.movementCost(g.map,u,16,30),Infinity);
 const r=M.Pathfinding.getReachable(g.map,{...horse,x:15,y:28,move:9999},[]),path=M.Pathfinding.getPath(r,'15,25');assert(path.some(p=>g.map.tiles[p.y][p.x]==='bridge'));assert(path.length>10);
});
test('Twenty-four guards emphasize ten Pegasus and eight horse units, including two bosses',()=>{
 const g=fresh(),es=g.living('enemy');assert.equal(es.length,24);assert.equal(es.filter(u=>u.tags.includes('flying')).length,10);assert.equal(es.filter(u=>u.tags.includes('cavalry')).length,8);assert.equal(es.filter(u=>u.tags.includes('armor')).length,2);assert.equal(es.filter(u=>u.boss).length,2);
 const sky=g.getUnit('garden_rift_pegasus'),horse=g.getUnit('garden_cavalier_boss');assert.equal(sky.level,18);assert.equal(horse.level,18);assert.equal(horse.classId,'cavalier');assert.equal(horse.move,7);assert.equal(sky.hpFloor,0);assert.equal(horse.hpFloor,0);assert(M.Combat.effectivenessAgainst(C.WEAPONS.iron_bow,sky)>1);assert.equal(M.Combat.effectivenessAgainst(C.WEAPONS.iron_bow,horse),1);assert(M.Combat.effectivenessAgainst(C.WEAPONS.horseslayer,horse)>1);
});
test('Either first boss may fall, but both are required; opening must finish before victory',()=>{
 for(const order of [C.STAGE_ROYAL_GARDEN.bossIds,[...C.STAGE_ROYAL_GARDEN.bossIds].reverse()]){
  const g=fresh(),gold=g.gold;g.royalGardenIntroSeen=true;hit(g,order[0]);assert.equal(g.phase,'player');assert.equal(g.gold,gold);const h=reload(g);hit(h,order[1]);assert.equal(h.phase,'victory');assert(h.livingCount('enemy')>0);assert.equal(h.gold,gold+2000);h.checkOutcome();assert.equal(h.gold,gold+2000);assert.deepEqual(plain(reload(h).rewardedChapters),[11]);
 }
 const g=fresh();for(const id of g.mission.bossIds)hit(g,id);assert.equal(g.phase,'player');g.royalGardenIntroSeen=true;g.checkOutcome();assert.equal(g.phase,'victory');
});
test('Both new chapter-eleven and older palace snapshots round-trip without misclassification',()=>{
 const g=fresh();assert.equal(g.serialize().stage,11);assert.equal(g.serialize().royalGardenChapterVersion,1);assert.equal(g.serialize().palaceChapterVersion,undefined);assert.equal(reload(g).stage,12);assert.deepEqual(plain(reload(g).serialize()),plain(g.serialize()));
 g.royalGardenIntroSeen=true;g.getUnit('garden_rift_pegasus').hp=9;g.getUnit('subaru').hp=7;g.getUnit('subaru').spellUses.fire=1;g.retreat={chapterIntroPlayed:true};const h=reload(g);assert.equal(h.getUnit('garden_rift_pegasus').hp,9);assert.equal(h.getUnit('subaru').hp,7);assert.equal(h.getUnit('subaru').spellUses.fire,1);assert(h.retreat.chapterIntroPlayed);assert.deepEqual(plain(reload(h).serialize()),plain(h.serialize()));
 const palace=new M.Game({stage:11});palace.palaceIntroSeen=true;palace.getUnit('gilded_cavalier').hp=9;assert.equal(reload(palace).chapterNumber,10);assert.equal(reload(palace).getUnit('gilded_cavalier').hp,9);
});
test('Cross-chapter import retains growth, mastery, talents, convoy, gold and ticket budget',()=>{
 const old=new M.Game({stage:11});old.palaceIntroSeen=true;old.rewardedChapters=[1,2,3,4,5,6,7,8,9];old.trainingTicketsPurchased=3;old.gold=12345;old.shopPurchases={intermediate_seal:2};const s=old.getUnit('subaru');M.Growth.award(s,250);s.exp=12;M.Mastery.award(s,5);old.convoy.push(M.Inventory.make('steel_lance'));hit(old,'gilded_cavalier');
 const g=fresh({recruited:old.recruited,loadout:old.exportLoadout()});assert.equal(g.gold,old.gold);assert.equal(g.shopChapter,11);assert.equal(Object.keys(g.shopPurchases).length,0);assert.equal(g.trainingTicketsPurchased,3);assert.deepEqual(plain(g.rewardedChapters),plain(old.rewardedChapters));assert.equal(g.getUnit('subaru').level,s.level);assert.equal(g.getUnit('subaru').exp,12);assert.deepEqual(plain(M.Mastery.pack(g.getUnit('subaru'))),plain(M.Mastery.pack(s)));assert(g.convoy.some(i=>i.id==='steel_lance'));assert.deepEqual(plain(reload(g).serialize()),plain(g.serialize()));
});
test('Missing Nina and fallen allies retain correct behavior without duplicate Subaru',()=>{
 const g=fresh({ninaLost:true});assert(!g.getUnit('nina'));g.royalGardenIntroSeen=true;hit(g,'garden_rift_pegasus');Object.assign(g.getUnit('subaru'),{hp:0,dead:true});const h=reload(g);assert(!h.getUnit('nina'));assert(h.getUnit('subaru').dead);assert.equal(h.units.filter(u=>u.id==='subaru').length,1);hit(h,'garden_cavalier_boss');assert.equal(h.phase,'victory');
 const k=fresh();k.royalGardenIntroSeen=true;for(const u of k.living('player'))Object.assign(u,{hp:0,dead:true});k.checkOutcome();assert.equal(k.phase,'defeat');assert.equal(reload(k).phase,'defeat');
});
test('Chapter-eleven save card displays both bosses and nine players, with no rehearsal labels',()=>{
 const g=fresh(),ctx={ui:{game:g,busy:false,mode:'idle',saveManager:{storageType:'memory'}},getSaveInfo:()=>({ok:true,loaded:{snapshot:plain(g.serialize()),savedAt:'2026-11-19T10:00:00.000Z'}}),dom:{saveInfo:{},saveLoad:{},saveDelete:{},saveCurrent:{},saveStatus:{}}};M.EntryScreen.prototype.refreshSavePanel.call(ctx);const html=ctx.dom.saveInfo.innerHTML;assert(html.includes('MISSION 11'));assert(html.includes('我方 9 / 敌方 24'));assert(!html.includes('前半段')&&!html.includes('后半段'));
});
test('Holy spring healing and defensive terrain work; flying ignores terrain defense',()=>{
 const g=fresh(),u=g.getUnit('tomori');Object.assign(u,{x:5,y:20,hp:5});assert.equal(M.Combat.terrainOf(u,g.map).def,2);g.beginNextPlayerPhase();assert.equal(u.hp,5+Math.ceil(u.maxHp*.2));assert.equal(M.Combat.terrainOf({...g.getUnit('garden-pegasus-0'),x:5,y:20},g.map).def,0);
});
test('Corrupt version, map, missing roster, units, one-boss victory and wall positions reject',()=>{
 for(const mutate of [s=>s.royalGardenChapterVersion=2,s=>delete s.royalGardenChapterVersion,s=>s.stage=12,s=>s.mapRevision++,s=>s.palaceChapterVersion=1,s=>s.rehearsalChapterVersion=1,s=>delete s.royalGardenIntroSeen,s=>s.gateOpen=true,s=>s.units.pop(),s=>s.recruited=s.recruited.filter(id=>id!=='subaru'),s=>s.phase='victory',s=>Object.assign(s.units[0],{x:16,y:30}),s=>s.economy.chapter=12]){const snapshot=plain(fresh().serialize());mutate(snapshot);assert.throws(()=>new M.Game().restore(snapshot));}
});
test('Enemy profiles are fixed after party growth, import, turns and loaded wounds',()=>{
 const g=fresh(),stats=g=>plain(g.units.filter(u=>u.side==='enemy').map(u=>[u.id,u.level,u.maxHp,u.str,u.mag,u.dex,u.spd,u.def,u.res,u.move])),before=stats(g);for(const u of g.living('player'))M.Growth.award(u,600);const h=fresh({recruited:g.recruited,loadout:g.exportLoadout()});assert.deepEqual(stats(h),before);h.royalGardenIntroSeen=true;h.getUnit('garden_rift_pegasus').hp=7;h.beginNextPlayerPhase();assert.deepEqual(stats(reload(h)),before);assert.equal(reload(h).getUnit('garden_rift_pegasus').hp,7);
});
console.log('Royal garden: '+cases+' scenarios passed.');
