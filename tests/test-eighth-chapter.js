/* Chapter eight rules, rewards, continuity and snapshot regressions. */
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const w={console,document:{readyState:'loading'},addEventListener(){}};w.window=w;vm.createContext(w);
for(const f of ['equipment-data','magic-data','inventory','class-data','class-mastery','config','chapter-three','chapter-four','chapter-five','chapter-six','chapter-seven','chapter-eight','rng','growth-data','growth','grid','pathfinding','combat','game','ai','save','ui','entry'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',f+'.js'),'utf8'),w,{filename:f});
const M=w.MyGO,C=M.CONFIG,I=M.Inventory,plain=x=>JSON.parse(JSON.stringify(x)),fresh=opts=>new M.Game({stage:8,seed:8811,...opts});
const reload=g=>{const h=new M.Game();h.restore(plain(g.serialize()));return h;};
let cases=0;function test(name,f){f();cases++;console.log('✓ '+name);}
const hit=(g,id)=>g.applyCombat({attackerId:'tomori',defenderId:id,hit:true,finalDamage:999});
const qty=(g,id)=>g.living('player').flatMap(u=>u.inventory).concat(g.convoy,g.lootReserve).filter(i=>i.id===id).length;
const effective=u=>M.Combat.statTotalOf(u)-(C.WEAPONS[C.STAGE_EIGHT.enemies.find(e=>e.id===u.id)?.weapon||u.weaponId].damageType==='magic'?u.str:u.mag);
const stats=u=>[u.maxHp,u.str,u.mag,u.dex,u.spd,u.lck,u.def,u.res,u.move];
const fixed=g=>g.living('enemy').filter(u=>u.boss||u.tags.includes('armor')||u.tags.includes('flying'));
const regular=g=>g.units.filter(u=>u.side==='enemy'&&!u.boss&&!u.tags.includes('armor')&&!u.tags.includes('flying'));
const expectedEffective=u=>u.id==='dark_soyo'?113:u.id==='dark_tomori'?115:u.tags.includes('armor')?98:96;
test('30×36 expanded live house; all units, three chests and both phantoms reachable',()=>{
 const g=fresh({recruited:['xueyue','nina']}),t=g.getUnit('tomori'),r=M.Pathfinding.getReachable(g.map,{...t,move:9999},[]),used=new Set();
 assert.equal(g.map.cols,30);assert.equal(g.map.rows,36);assert.equal(g.livingCount('player'),8);assert.equal(g.livingCount('enemy'),17);
 for(const u of g.units){const k=u.x+','+u.y;assert(r.has(k),u.id);assert(!used.has(k),u.id);used.add(k);assert(Number.isFinite(M.Grid.movementCost(g.map,u,u.x,u.y)));}
 for(const c of g.mission.chests)assert(r.has(c.x+','+c.y),c.id);
 assert(g.living('player').every(u=>u.y>=18&&u.y<=20));assert(g.mission.enemies.every(u=>u.y<=17));
 assert(g.map.decor.some(o=>o.kind==='drums'&&o.y===4));assert(g.map.decor.some(o=>o.kind==='exit'&&o.y>34));
 for(let y=6;y<14;y++)assert.equal(g.map.tiles[y][15],'road');
});
test('Phantoms have real classes, weapons, normal HP; mixed soldiers retain armor/flying properties',()=>{
 const g=fresh(),s=g.getUnit('dark_soyo'),t=g.getUnit('dark_tomori');
 assert.equal(s.name,'往日之影长崎爽世');assert.equal(s.classId,'warlock');assert.equal(s.className,'术士');assert.equal(s.weapon.damageType,'magic');
 assert.equal(t.name,'往日之影高松灯');assert.equal(t.classId,'mercenary');assert.equal(t.className,'佣兵');assert.equal(t.weaponId,'steel_sword');
 assert(I.usable(s)&&I.usable(t));assert(s.boss&&t.boss&&!s.hpFloor&&!t.hpFloor);assert.equal(g.getUnit('masked_stranger'),null);
 const armor=g.living('enemy').filter(u=>u.tags.includes('armor')),peg=g.living('enemy').filter(u=>u.tags.includes('flying'));
 assert.equal(armor.length,4);assert.equal(peg.length,3);assert(armor.every(u=>u.def-u.res>=12&&u.move===4));assert(peg.every(u=>u.move===6));
 assert.equal(M.Combat.preview(g.getUnit('anon'),peg[0],g.map).effectiveness,3);
 assert(M.Combat.preview(g.getUnit('soyo'),armor[0],g.map).damage>M.Combat.preview(g.getUnit('tomori'),armor[0],g.map).damage);
 assert(!g.isUnitActive(s));
});
test('Chests and key carriers are close to the party and reachable before the boss area',()=>{
 const g=fresh();g.completeEighthIntro();const party=g.living('player');
 const expectedChests={'echo-seal':[9,20],'echo-gold':[20,19],'echo-sword':[15,13]},expectedKeys=[[10,17],[19,17],[15,14]];
 const routes=party.map(u=>M.Pathfinding.getReachable(g.map,{...u,move:999},[],(x,y)=>y>=12));
 const nearest=target=>Math.min(...routes.map(r=>r.get(target.x+','+target.y)?.cost??Infinity));
 for(const c of g.mission.chests){assert.deepEqual([c.x,c.y],expectedChests[c.id]);assert(nearest(c)<=6,c.id+' close walk');assert(g.map.decor.some(o=>o.kind==='chest'&&o.id===c.id&&o.x===c.x&&o.y===c.y));}
 expectedKeys.forEach(([x,y],i)=>{const u=g.getUnit('echo-pegasus-'+i);assert.deepEqual([u.x,u.y],[x,y]);assert(nearest(u)<=5,u.id+' close key');assert.equal(u.inventory.filter(i=>i.id==='chest_key').length,1);});
 const t=g.getUnit('tomori');for(const target of g.mission.chests.concat(expectedKeys.map(([x,y])=>({x,y})))){
  Object.assign(t,{x:target.x,y:target.y});for(const id of g.mission.phantomIds)assert(!g.isUnitActive(g.getUnit(id)),id+' stays outside loot route');
 }
});
test('Old loot layouts move untouched carriers once, retaining opened chests and keys',()=>{
 const g=fresh();g.completeEighthIntro();g.openedChests=['echo-gold'];
 for(const [id,p] of Object.entries(C.STAGE_EIGHT.legacyKeySpawns))Object.assign(g.getUnit(id),p);
 const s=plain(g.serialize());delete s.lootLayoutVersion;const h=reload({serialize:()=>s});
 for(const id of Object.keys(C.STAGE_EIGHT.legacyKeySpawns)){const u=h.getUnit(id),spawn=C.STAGE_EIGHT.enemies.find(t=>t.id===id);assert.deepEqual([u.x,u.y],[spawn.x,spawn.y]);assert.equal(u.inventory.filter(i=>i.id==='chest_key').length,1);}
 assert.deepEqual(plain(h.openedChests),['echo-gold']);assert.equal(h.serialize().lootLayoutVersion,1);assert.deepEqual(plain(reload(h).serialize()),plain(h.serialize()));
});
test('Loot migration keeps engaged/dead/moved carriers, occupied destinations and completed games',()=>{
 for(const mode of ['wounded','alerted','acted','moved','dead','occupied','victory']){
  const g=fresh();g.completeEighthIntro();for(const [id,p] of Object.entries(C.STAGE_EIGHT.legacyKeySpawns))Object.assign(g.getUnit(id),p);
  const u=g.getUnit('echo-pegasus-0');if(mode==='wounded')u.hp--;if(mode==='alerted')u.alerted=true;if(mode==='acted')u.acted=true;if(mode==='moved')u.y--;if(mode==='dead')hit(g,u.id);
  if(mode==='occupied')Object.assign(g.getUnit('tomori'),{x:10,y:17});if(mode==='victory'){hit(g,'dark_soyo');hit(g,'dark_tomori');}
  const before=[u.x,u.y,u.hp,u.dead,u.acted,u.alerted],s=plain(g.serialize());delete s.lootLayoutVersion;const h=reload({serialize:()=>s}),after=h.getUnit(u.id);
  assert.deepEqual([after.x,after.y,after.hp,after.dead,after.acted,after.alerted],before,mode);assert.equal(qty(h,'chest_key'),qty(g,'chest_key'),mode+' key quantity');
 }
 for(const value of [null,0,2,'1']){const bad=plain(fresh().serialize());bad.lootLayoutVersion=value;assert.throws(()=>fresh().restore(bad),/宝箱布局/);}
});
test('Opening skip commits atomically; pending/completed snapshots and dead Nijika round trip',()=>{
 const g=fresh();assert.equal(g.getUnit('nijika').side,'player');assert(g.recruited.includes('nijika'));assert(g.nijikaJoined);
 assert.equal(reload(g).stageEightIntroSeen,false);g._liveIntro={visible:()=>false};g.getUnit('dark_soyo')._summonAlpha=.2;
 g.completeEighthIntro();g.completeEighthIntro();assert(g.stageEightIntroSeen);assert(!g._liveIntro);assert.equal(g.getUnit('dark_soyo')._summonAlpha,undefined);
 const h=reload(g);assert(h.stageEightIntroSeen);assert(h.nijikaJoined);assert.equal(h.getUnit('nijika').level,9);
 Object.assign(g.getUnit('nijika'),{dead:true,hp:0,acted:true});assert(reload(g).getUnit('nijika').dead);
});
test('Both named phantoms required; other enemies optional, reward granted exactly once',()=>{
 for(const order of [['dark_soyo','dark_tomori'],['dark_tomori','dark_soyo']]){
  const g=fresh();g.completeEighthIntro();const gold=g.gold;hit(g,order[0]);assert.equal(g.phase,'player');assert(g.getUnit(order[0]).dead);
  hit(g,order[1]);assert.equal(g.phase,'victory');assert.equal(g.livingCount('enemy'),15);assert.equal(g.gold,gold+2000);g.checkOutcome();assert.equal(g.gold,gold+2000);
  const h=reload(g);assert.equal(h.phase,'victory');assert.equal(h.gold,g.gold);
 }
 const g=fresh();for(const id of g.mission.phantomIds)Object.assign(g.getUnit(id),{dead:true,hp:0});g.checkOutcome();assert.equal(g.phase,'player');g.completeEighthIntro();g.checkOutcome();assert.equal(g.phase,'victory');
});
test('Three actual key drops unlock exact rewards; 1500 G UI-independent, no repeated loot',()=>{
 const g=fresh();g.completeEighthIntro();const t=g.getUnit('tomori'),initial=g.gold;
 for(const e of g.living('enemy').filter(u=>u.tags.includes('flying'))){assert(e.inventory.some(i=>i.id==='chest_key'));const r=hit(g,e.id);assert.equal(r.drops[0].id,'chest_key');assert(!e.inventory.some(i=>i.id==='chest_key'));assert.throws(()=>g.applyCombat(r),/已结算/);}
 assert.equal(qty(g,'chest_key'),3);
 for(const c of g.mission.chests){Object.assign(t,{x:c.x,y:c.y,acted:false});assert(g.canOpenChest(t));const before=qty(g,c.item);const r=g.openChest(t);assert(r);assert(t.acted);assert.equal(g.openChest(t),null);if(c.item)assert.equal(qty(g,c.item),before+1);else assert.equal(r.gold,1500);}
 assert.equal(g.gold,initial+1500);assert.equal(g.openedChests.length,3);assert.equal(qty(g,'chest_key'),0);
 const h=reload(g);assert.equal(h.gold,g.gold);assert.equal(h.openedChests.length,3);assert.equal(qty(h,'intermediate_seal'),1);assert.equal(qty(h,'steel_sword'),1);
});
test('Chest requires key, range, unused action and player phase; full bags retain rewards',()=>{
 const g=fresh(),t=g.getUnit('tomori'),c=g.mission.chests[0];assert.equal(g.openChest(t),null);Object.assign(t,{x:c.x,y:c.y});assert.equal(g.openChest(t),null);
 t.inventory.push(I.make('chest_key'));t.acted=true;assert.equal(g.openChest(t),null);t.acted=false;g.phase='enemy';assert.equal(g.openChest(t),null);g.phase='player';
 while(t.inventory.length<5)t.inventory.push(I.make('vulnerary'));while(g.convoy.length<500)g.convoy.push(I.make('vulnerary'));
 // Consuming the key makes space, so the item remains safe even with a full convoy.
 assert(g.openChest(t));assert.equal(t.inventory.length,5);assert(t.inventory.some(i=>i.id==='intermediate_seal'));assert.equal(reload(g).openedChests.length,1);
});
test('Stage seven to eight preserves growth/class/equipment/gold and Nijika joins direct entry',()=>{
 const g=new M.Game({stage:7,recruited:['xueyue','nina'],seed:7});g.joinNijika();const n=g.getUnit('nijika');M.Growth.award(n,M.Growth.required(n.level));n.exp=31;
 g.gold=8731;g.convoy.push(I.make('steel_sword'));const loadout=g.exportLoadout(),h=fresh({recruited:g.recruited,loadout});
 assert.equal(h.gold,g.gold);assert.deepEqual(plain(M.Growth.pack(h.getUnit('nijika'))),plain(M.Growth.pack(n)));assert.deepEqual(plain(h.convoy),plain(g.convoy));
 assert.equal(h.getUnit('nijika').side,'player');assert.equal(h.livingCount('player'),8);assert.equal(h.getUnit('nijika').x,14);assert.equal(h.getUnit('nijika').y,18);assert(reload(h).getUnit('nijika').level===n.level);
 const s=h.getUnit('echo-armor-0'),before=stats(s);for(const u of h.living('player'))M.Growth.award(u,15000);h.beginNextPlayerPhase();assert.deepEqual(stats(s),before);assert(s.def-s.res>=12);assert.equal(reload(h).getUnit(s.id).maxHp,s.maxHp);
});
test('Title load restores the turn-six roster and keeps the current game on failed validation',()=>{
 const saved=fresh({recruited:['xueyue','nina']});saved.completeEighthIntro();saved.turn=6;
 const tomori=saved.getUnit('tomori'),soyo=saved.getUnit('soyo');
 while(tomori.level<10)M.Growth.award(tomori,M.Growth.required(tomori.level));
 M.Classes.apply(tomori,'mage');
 tomori.exp=23;tomori.inventory[0].uses=18;tomori.hp-=5;soyo.spellUses.fire=2;
 const old=plain(saved.serialize()),oldTomori=old.units.find(u=>u.id==='tomori');
 oldTomori.spellLearningVersion=2;oldTomori.equippedWeapon='fire';
 oldTomori.learnedSpells=['fire','heal','wind','thunder'];oldTomori.spellUses={fire:3,heal:5,wind:2,thunder:1};
 const saveManager=new M.SaveManager();
 assert(saveManager.save({serialize:()=>old}).ok);
 const ui=Object.create(M.UI.prototype);
 const noop=()=>{};
 Object.assign(ui,{game:new M.Game(),saveManager,renderer:{setGame(g){this.game=g;}},
  resetSelection:noop,syncMission:noop,updateAll:noop,layoutBoard:noop,revealCell:noop,renderIdleInfo:noop,showToast:noop});
 const entry=Object.create(M.EntryScreen.prototype);
 Object.assign(entry,{ui,hideToGame(){this.entered=ui.game;},refreshSaveHint:noop,setSaveStatus(message){this.status=message;}});
 const broken=plain(old);broken.units[0].growth.exp=-1;
 assert(saveManager.save({serialize:()=>broken},{automatic:true}).ok);
 const active=ui.game,state=plain(active.serialize());
 ui.renderer.setGame(active);
 const previousConsole=w.console;w.console={error:noop};
 try{entry.loadSave('automatic');}finally{w.console=previousConsole;}
 assert.match(entry.status,/读档失败.*成长数据无效/);
 assert.equal(ui.game,active);assert.equal(ui.renderer.game,active);assert.equal(entry.entered,undefined);
 assert.deepEqual(plain(ui.game.serialize()),state);
 assert.deepEqual(plain(saveManager.load('automatic').snapshot),broken);

 entry.loadSave('manual');
 assert.equal(entry.entered,ui.game);assert.equal(ui.renderer.game,ui.game);
 assert.equal(ui.game.stage,8);assert.equal(ui.game.turn,6);assert.equal(entry.players().length,8);
 for(const id of ['xueyue','nina','nijika'])assert(entry.players().some(u=>u.id===id));
 assert.deepEqual(plain(ui.game.serialize()),plain(reload(saved).serialize()));
 assert.deepEqual(plain(saveManager.load('manual').snapshot),old);
});
test('Reject corrupt flags, chest state, level, missing/duplicate units and blocked cells',()=>{
 const s=fresh().serialize();for(const mutate of [s=>s.stageEightIntroSeen='yes',s=>s.stageEightIntroSeen=undefined,s=>s.recruited=[],s=>s.openedChests=['wrong'],s=>s.openedChests=['echo-seal','echo-seal'],s=>s.enemyScaleLevel=0,s=>s.units.find(u=>u.id==='dark_soyo').classState.id='monk',s=>s.units.pop(),s=>s.units.push(s.units[0]),s=>s.mapRevision=9,s=>s.units[0].x=0]){const bad=plain(s);mutate(bad);assert.throws(()=>fresh().restore(bad));}
});

test('Panel totals are 120/102 while preserving requested stats and imperfect allocations',()=>{
 const g=fresh(),power=Math.max(100,...g.living('player').map(effective));assert.equal(g.enemyScalePower,power);assert(g.enemyScaleLevel>=10);
 const expected={dark_soyo:[38,7,20,14,10,6,7,14,4],dark_tomori:[40,16,5,15,16,6,11,6,5],armor:[30,15,4,10,6,7,22,4,4],flying:[26,11,6,13,14,6,8,12,6]};
 for(const e of g.living('enemy')){
  if(fixed(g).includes(e)){assert.deepEqual(stats(e),expected[e.id]||expected[e.tags.includes('armor')?'armor':'flying'],e.id);assert.equal(M.Combat.statTotalOf(e),e.boss?120:102,e.id+' panel total');assert.equal(effective(e),expectedEffective(e),e.id);assert(M.Combat.statTotalOf(e)>effective(e),e.id+' retains modest off-role stats');}
  else assert(M.Combat.statTotalOf(e)>=92&&M.Combat.statTotalOf(e)<=96,e.id);
  assert(e.level>=(e.boss?12:10));
 }
 const armor=g.getUnit('echo-armor-0'),peg=g.getUnit('echo-pegasus-0');assert(armor.def-armor.res>=12);assert.equal(armor.move,4);assert.equal(peg.move,6);
 assert(g.getUnit('dark_soyo').mag>g.getUnit('dark_soyo').str);assert(g.getUnit('dark_tomori').str>g.getUnit('dark_tomori').mag);
 assert(peg.spd>armor.spd);assert(peg.res>peg.def);assert(armor.spd<10&&armor.res<10);
});
test('All eight regular soldiers have 92-96 panel stats and lower useful combat stats',()=>{
 const g=fresh(),old=fresh();old.restoreLegacyEighthScale(undefined,old.units,true,false,true);
 const totals={'echo-blade':94,'echo-blade-w':93,'echo-axe':95,'echo-bow':93,'echo-bow-deep':95,'echo-lance-e':96,'echo-mage-w':92,'echo-mage-e':94};
 const previous={'echo-blade':[13,4,11,90],'echo-blade-w':[13,5,11,88],'echo-axe':[16,4,7,91],'echo-bow':[14,4,11,89],'echo-bow-deep':[14,5,11,90],'echo-lance-e':[14,5,10,91],'echo-mage-w':[7,13,7,85],'echo-mage-e':[8,13,7,86]};
 assert.equal(regular(g).length,8);
 for(const u of regular(g)){
  const before=old.getUnit(u.id),attack=u.weapon.damageType==='magic'?'mag':'str';
  assert.equal(M.Combat.statTotalOf(u),totals[u.id],u.id);assert(effective(u)<effective(before),u.id+' effective stats reduced');assert(u[attack]<before[attack],u.id+' main attack reduced');assert(u.spd<before.spd,u.id+' speed reduced');assert(u.dex<before.dex,u.id+' dexterity reduced');assert.equal(u.move,before.move);
  const [str,mag,spd,total]=previous[u.id],magic=attack==='mag';assert.equal(effective(u),total-3,u.id+' exactly 3 fewer effective points');assert.equal(u.str,str+(magic?3:-2));assert.equal(u.mag,mag+(magic?-2:3));assert.equal(u.spd,spd-1);
 }
});
test('Fixed profiles and wounded HP survive strong parties, repeated scaling and reloads',()=>{
 const g=fresh(),t=g.getUnit('tomori'),e=g.getUnit('echo-blade');e.hp=13;
 const state=plain(g.units.filter(u=>u.side==='enemy').map(u=>[u.hp,...stats(u)]));
 t.str+=50;g.beginNextPlayerPhase();for(let i=0;i<5;i++)g.applyFixedEnemyStats();
 assert.deepEqual(plain(g.units.filter(u=>u.side==='enemy').map(u=>[u.hp,...stats(u)])),state);
 const h=reload(g);assert.deepEqual(plain(h.units.filter(u=>u.side==='enemy').map(u=>[u.hp,...stats(u)])),state);
 t.str+=500;t.level=97;g.beginNextPlayerPhase();assert.deepEqual(plain(g.units.filter(u=>u.side==='enemy').map(u=>[u.hp,...stats(u)])),state);
});
test('Normal growth and next-stage imports survive repeat saves without strength drift',()=>{
 const g=fresh(),n=g.getUnit('nijika');for(let i=0;i<8;i++)M.Growth.award(n,M.Growth.required(n.level));g.beginNextPlayerPhase();const e=g.getUnit('dark_soyo');e.hp=7;
 const total=M.Combat.statTotalOf(e),level=e.level,power=g.enemyScalePower;let h=g;for(let i=0;i<4;i++)h=reload(h);
 assert.equal(M.Combat.statTotalOf(h.getUnit('dark_soyo')),total);assert.equal(h.getUnit('dark_soyo').level,level);assert.equal(h.getUnit('dark_soyo').hp,7);assert.equal(h.enemyScalePower,power);
});
test('Old eighth saves upgrade enemy wounds proportionally, keep kills, chests and positions',()=>{
 const g=fresh();g.completeEighthIntro();
 // Construct the previous version's authored average-level stats.
 g.enemyScaleLevel=0;g.restoreLegacyEnemyScale(6,g.units,true,true);g.getUnit('echo-blade').hp=5;Object.assign(g.getUnit('echo-bow'),{hp:0,dead:true,acted:true});g.openedChests=['echo-gold'];
 const oldMax=g.getUnit('echo-blade').maxHp,s=plain(g.serialize());delete s.fixedEnemyStatsVersion;delete s.enemyScaleVersion;delete s.enemyScalePower;
 const h=new M.Game();h.restore(s);assert(h.enemyScaleLevel>=10);assert(h.getUnit('echo-blade').maxHp>oldMax);assert.equal(h.getUnit('echo-blade').hp,Math.ceil(h.getUnit('echo-blade').maxHp*5/oldMax));assert(h.getUnit('echo-bow').dead);assert.equal(h.getUnit('echo-bow').hp,0);assert.deepEqual(plain(h.openedChests),['echo-gold']);assert(h.stageEightIntroSeen);
 assert.equal(h.getUnit('echo-blade').x,g.getUnit('echo-blade').x);assert.equal(reload(h).getUnit('echo-blade').hp,h.getUnit('echo-blade').hp);
 for(const patch of [{enemyScaleVersion:9},{enemyScalePower:0},{enemyScalePower:'102'},{enemyScalePower:100001}]){const bad=plain(h.serialize());Object.assign(bad,patch);assert.throws(()=>fresh().restore(bad),/强度/);}
});
test('v5.8.2 inflated saves migrate to exact budgets without healing or reviving enemies',()=>{
 const g=fresh();g.completeEighthIntro();g.enemyScaleLevel=0;g.enemyScalePower=180;g.restoreLegacyEighthScale(20,g.units,true,true);
 const s=g.getUnit('dark_soyo'),a=g.getUnit('echo-armor-0'),p=g.getUnit('echo-pegasus-0');s.hp=13;a.hp=1;Object.assign(p,{dead:true,hp:0,acted:true});s.alerted=true;g.openedChests=['echo-gold'];
 const oldMax=s.maxHp,snapshot=plain(g.serialize());delete snapshot.fixedEnemyStatsVersion;snapshot.enemyScaleVersion=1;
 const h=new M.Game();h.restore(snapshot);assert.equal(h.serialize().enemyScaleVersion,4);assert.equal(h.getUnit(s.id).hp,Math.ceil(38*13/oldMax));assert.equal(h.getUnit(a.id).hp,1);assert(h.getUnit(p.id).dead);assert.equal(h.getUnit(p.id).hp,0);assert(h.getUnit(s.id).alerted);
 assert.deepEqual(plain(h.openedChests),['echo-gold']);assert(h.stageEightIntroSeen);assert.equal(h.getUnit(s.id).x,s.x);for(const u of fixed(h))assert.equal(effective(u),expectedEffective(u));
 assert.deepEqual(plain(reload(h).serialize()),plain(h.serialize()));
});
test('v5.8.3/v5.8.4 saves retain wound ratios and progress with corrected panel totals',()=>{
 const g=fresh();g.restoreLegacyEighthScale(undefined,g.units,true,false,true);g.completeEighthIntro();g.openedChests=['echo-gold'];
 const oldMax={dark_soyo:42,dark_tomori:43,armor:32,flying:29};
 for(const u of fixed(g)){u.maxHp=oldMax[u.id]||oldMax[u.tags.includes('armor')?'armor':'flying'];u.hp=Math.floor(u.maxHp/2);u.alerted=true;}
 Object.assign(g.getUnit('echo-pegasus-1'),{dead:true,hp:0,acted:true});g.getUnit('dark_soyo').hp=40;g.getUnit('echo-armor-0').hp=1;
 const snapshot=plain(g.serialize());delete snapshot.fixedEnemyStatsVersion;snapshot.enemyScaleVersion=2;const h=reload({serialize:()=>snapshot});
 for(const u of h.units.filter(u=>u.side==='enemy'&&(u.boss||u.tags.includes('armor')||u.tags.includes('flying')))){
  const before=g.getUnit(u.id);assert.equal(M.Combat.statTotalOf(u),u.boss?120:102,u.id);assert.equal(u.hp,u.dead?0:Math.ceil(u.maxHp*before.hp/before.maxHp-1e-9),u.id+' proportional wounds');assert(u.alerted);assert.equal(u.x,before.x);assert.equal(u.y,before.y);
 }
 assert(h.getUnit('echo-pegasus-1').dead);assert.deepEqual(plain(h.openedChests),['echo-gold']);assert(h.stageEightIntroSeen);assert.equal(h.getUnit('echo-armor-0').move,4);assert.deepEqual(plain(reload(h).serialize()),plain(h.serialize()));
});
test('v5.8.5 scaled soldiers migrate wounds without clamping first or reviving dead soldiers',()=>{
 const g=fresh();g.restoreLegacyEighthScale(24,g.units,true,false,true);g.completeEighthIntro();g.openedChests=['echo-gold'];
 for(const u of regular(g)){u.hp=Math.floor(u.maxHp*.8);u.alerted=true;}
 Object.assign(g.getUnit('echo-bow'),{hp:0,dead:true,acted:true});g.getUnit('echo-blade-w').hp=1;
 const snapshot=plain(g.serialize());delete snapshot.fixedEnemyStatsVersion;snapshot.enemyScaleVersion=3;const h=reload({serialize:()=>snapshot});
 for(const u of regular(h)){const before=g.getUnit(u.id);assert.equal(u.hp,u.dead?0:Math.ceil(u.maxHp*before.hp/before.maxHp-1e-9),u.id);assert.equal(u.dead,before.dead);assert.equal(u.acted,before.acted);assert(u.alerted);assert.equal(u.x,before.x);assert.equal(u.y,before.y);assert(M.Combat.statTotalOf(u)>=92&&M.Combat.statTotalOf(u)<=96);}
 assert.deepEqual(plain(h.openedChests),['echo-gold']);assert(h.stageEightIntroSeen);assert.deepEqual(plain(reload(h).serialize()),plain(h.serialize()));
});
test('Exhausting magic does not switch a mage to physical stat scaling on reload',()=>{
 const g=fresh(),e=g.getUnit('echo-mage-w');e.spellUses.miasma=0;I.sync(e);g.getUnit('tomori').str+=50;g.beginNextPlayerPhase();const before=stats(e),h=reload(g);
 assert.deepEqual(stats(h.getUnit(e.id)),before);assert.equal(h.getUnit(e.id).spellUses.miasma,0);
});
console.log('Eighth chapter: '+cases+' cases passed.');

