'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const w={console,setTimeout,clearTimeout,document:{readyState:'loading'}};w.window=w;vm.createContext(w);
for(const n of ['equipment-data','magic-data','inventory','class-data','config','chapter-three','chapter-four','chapter-five','chapter-six','rng','growth-data','growth','grid','pathfinding','combat','game','ai'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',n+'.js'),'utf8'),w,{filename:n});
const M=w.MyGO,plain=x=>JSON.parse(JSON.stringify(x)),fresh=()=>new M.Game({stage:6,recruited:['xueyue','nina'],seed:66});let count=0;
function test(name,fn){fn();console.log('✓ '+name);count++;}
function reload(g){const h=fresh();h.restore(plain(g.serialize()));return h;}
function approach(g,y){g.getUnit('tomori').y=y;g.phase='enemy';return g.summonNearParty();}
function strike(g,n=999){return g.applyCombat({attackerId:'soyo',defenderId:'masked_stranger',hit:true,finalDamage:n});}

function summonAll(g){for(const y of [32,25,18,11]){assert(approach(g,y));g.beginNextPlayerPhase();}}
const statKeys=['level','maxHp','str','mag','dex','spd','lck','def','res','move'];
const enemyStats=g=>plain(g.units.filter(u=>u.side==='enemy').map(u=>[u.id,...statKeys.map(k=>u[k])]));

test('初始巡守及四波援军各总属性＋12、有效＋7～8，面具人有效＋7',()=>{
 const g=fresh();summonAll(g);const templates=g.mission.enemies.concat(g.mission.summonTemplates);
 assert.equal(g.units.filter(u=>u.side==='enemy'&&!u.boss).length,18);
 for(const u of g.units.filter(u=>u.side==='enemy')){
  const base=templates.find(t=>t.id===u.id),off=u.weapon.damageType==='magic'?'str':'mag';
  const delta=statKeys.filter(k=>k!=='level').reduce((n,k)=>n+u[k]-(base[k]||0),0),effective=delta-(u[off]-(base[off]||0));
  const seven=u.tags.includes('armor')||['axe','bow'].includes(u.weapon.type);
  assert.equal(delta,u.boss?7:12,u.id);assert.equal(effective,u.boss?7:seven?7:8,u.id);
  for(const k of ['level','maxHp','move'])assert.equal(u[k],base[k],u.id+' '+k);
 }
 const b=g.getUnit('masked_stranger');assert.deepEqual([b.maxHp,b.str,b.mag,b.dex,b.spd,b.lck,b.def,b.res,b.move],[52,3,15,15,9,5,7,9,0]);
 const before=enemyStats(g);g.applyFixedEnemyStats();g.applyFixedEnemyStats();g.beginNextPlayerPhase();assert.deepEqual(enemyStats(g),before);assert.deepEqual(enemyStats(reload(g)),before);
});

test('旧固定档保留受伤、阵亡、行动、位置与波次，后续召唤采用新属性且不叠加',()=>{
 const mission=M.CONFIG.STAGE_SIX,bonuses=mission.enemyStatBonuses;let old;
 try{
  mission.enemyStatBonuses=Object.fromEntries(Object.keys(bonuses).map(k=>[k,{}]));
  old=fresh();assert(approach(old,32));
 }finally{mission.enemyStatBonuses=bonuses;}
 const wounded=old.getUnit('avenue-sentry-blade'),dead=old.getUnit('mask-summon-1-1');
 Object.assign(wounded,{hp:7,acted:true,alerted:true});Object.assign(dead,{hp:0,dead:true,acted:true});old.getUnit('masked_stranger').hp=27;
 const h=reload(old);
 for(const u of old.units){const v=h.getUnit(u.id);for(const k of ['hp','dead','acted','alerted','x','y'])assert.equal(v[k],u[k],u.id+' '+k);}
 assert.equal(h.getUnit(wounded.id).str,wounded.str+2);assert.equal(h.getUnit('masked_stranger').mag,15);
 assert.deepEqual(plain(h.summonedWaves),plain(old.summonedWaves));assert.equal(h.lastSummonTurn,old.lastSummonTurn);assert.equal(h.gold,old.gold);
 for(const y of [25,18,11]){h.beginNextPlayerPhase();assert(approach(h,y));}
 const expected=fresh();summonAll(expected);assert.deepEqual(enemyStats(h),enemyStats(expected));
 assert.equal(h.getUnit(wounded.id).hp,7);assert(h.getUnit(dead.id).dead);h.beginNextPlayerPhase();assert.deepEqual(plain(reload(h).serialize()),plain(h.serialize()));
});
test('30×46纵长公园、北端18盏宫廷灯与王座、下方七人、初始两巡守加Boss',()=>{
 const g=fresh();assert.equal(g.map.cols,30);assert.equal(g.map.rows,46);assert.equal(g.livingCount('enemy'),3);assert.equal(g.livingCount('player'),7);
 assert.equal(g.mission.lamps.filter(l=>l.kind==='palaceLamp').length,18);assert(g.mission.decor.some(d=>d.kind==='throne'&&d.x===14&&d.y===4));
 const positions=new Set();for(const u of g.living()){assert(Number.isFinite(M.Grid.movementCost(g.map,u,u.x,u.y)),u.id);assert(!positions.has(u.x+','+u.y));positions.add(u.x+','+u.y);if(u.side==='player')assert(u.y>=38&&u.y<=40);}
 const reach=M.Pathfinding.getReachable(g.map,{...g.getUnit('tomori'),move:9999},[]);assert(reach.has('14,4'));assert.equal(g.getUnit('masked_stranger').move,0);
});
test('四个接近区段，每回合至多一波，混合普通兵重装天马且不贴脸不重叠',()=>{
 const g=fresh();assert.equal(approach(g,33),null);g.phase='player';g.getUnit('tomori').y=32;assert.equal(g.summonNearParty(),null);
 for(const [i,y] of [32,25,18,11].entries()){
  const wave=approach(g,y);assert(wave);assert.equal(wave.units.length,[3,4,4,5][i]);assert.equal(g.summonedWaves.length,i+1);
  assert(wave.units.some(u=>u.tags.includes('armor')));assert(wave.units.some(u=>u.tags.includes('flying')));assert(wave.units.some(u=>!u.tags.includes('armor')&&!u.tags.includes('flying')));
  for(const u of wave.units){assert(u.acted&&u.alerted);assert.equal(u.drops.length,0);assert(!u.inventory.some(i=>i.id==='chest_key'));assert(Number.isFinite(M.Grid.movementCost(g.map,u,u.x,u.y)));assert(Math.min(...g.living('player').map(p=>M.Grid.manhattan(p,u)))>=3);}
  const pos=g.living().map(u=>u.x+','+u.y);assert.equal(pos.length,new Set(pos).size);assert.equal(g.summonNearParty(),null);
  const h=reload(g);assert.equal(h.units.length,g.units.length);assert.equal(h.summonedWaves.length,i+1);
  g.beginNextPlayerPhase();g.beginEnemyPhase();assert(wave.units.every(u=>!u.acted));
 }
 assert.equal(approach(g,10),null);assert.equal(g.livingCount('enemy'),19);
});
test('跳过区段也按顺序每轮召唤；击败召唤物后读档不重生',()=>{
 const g=fresh();const wave=approach(g,11);assert.equal(wave.id,'mask-wave-1');const u=wave.units[0];g.applyCombat({attackerId:'rana',defenderId:u.id,hit:true,finalDamage:999});
 const h=reload(g);assert(h.getUnit(u.id).dead);assert.equal(h.summonNearParty(),null);h.beginEnemyPhase();assert.equal(h.summonNearParty(),null);h.beginNextPlayerPhase();h.beginEnemyPhase();assert.equal(h.summonNearParty().id,'mask-wave-2');
});
test('高等级队伍遭遇的援军仍使用固定模板，保留重装弱点、飞行越水、弓特效',()=>{
 const g=fresh();for(const u of g.living('player'))u.level=99;g.beginNextPlayerPhase();const wave=approach(g,32),a=wave.units.find(u=>u.tags.includes('armor')),p=wave.units.find(u=>u.tags.includes('flying'));
 assert.equal(a.level,8);assert.equal(p.level,8);assert(a.def-a.res>=12);assert.equal(M.Grid.movementCost(g.map,p,6,14),1);assert.equal(M.Grid.movementCost(g.map,g.getUnit('tomori'),6,14),Infinity);
 assert.equal(M.Combat.preview(g.getUnit('anon'),p,g.map).effectiveness,3);assert.equal(reload(g).getUnit(a.id).maxHp,a.maxHp);
});
test('普通及暴击预演锁1 HP，连击不继续，实际结算不死亡且等待离场',()=>{
 const g=fresh(),a=g.getUnit('soyo'),b=g.getUnit('masked_stranger');a.mag=200;a.dex=200;a.lck=200;a.spd=100;a.x=14;a.y=5;
 const p=M.Combat.preview(a,b,g.map);assert.equal(p.hpAfterHit,1);assert.equal(p.hpAfterCrit,1);
 const round=M.Combat.rollRound(a,b,g.map,{int:()=>0,float:()=>0,next:()=>0});assert.equal(round.hpAfter,1);assert.equal(round.strikes.length,1);assert(round.strikes[0].retreatTriggered);
 const r=g.applyCombat(round);assert(r.retreatTriggered);assert(!r.killed);assert.equal(b.hp,1);assert(!b.dead);assert(g.maskRetreatPending);assert(!g.isOver());assert(!g.canAttack(a,b));assert(!g.isUnitActive(b));assert.equal(approach(g,11),null);
 const h=reload(g);assert(h.maskRetreatPending);assert.equal(h.getUnit(b.id).hp,1);assert.equal(h.phase,'player');
});
test('传送后移除占位并通关，Boss未死，2000G只奖励一次，终局存档稳定',()=>{
 const g=fresh(),gold=g.gold;assert(!g.finishMaskedEscape());strike(g);assert(g.finishMaskedEscape());const b=g.getUnit('masked_stranger');assert.equal(b.hp,1);assert(!b.dead&&b.escaped);assert.equal(g.unitAt(14,4),null);assert(!g.living('enemy').includes(b));assert.equal(g.phase,'victory');assert.equal(g.gold,gold+2000);assert(!g.finishMaskedEscape());g.checkOutcome();assert.equal(g.gold,gold+2000);
 const h=reload(g);assert(h.maskEscaped);assert(h.getUnit(b.id).escaped);assert.equal(h.phase,'victory');assert.equal(h.gold,g.gold);assert(!M.Pathfinding.canAttackFrom(h.getUnit('soyo'),14,6,h.getUnit(b.id)));assert(!h.getAttackableEnemies(h.getUnit('soyo'),14,6).includes(h.getUnit(b.id)));
});
test('非致命伤害继续战斗，反击与拳套连击同样锁血并终止交换',()=>{
 const g=fresh(),b=g.getUnit('masked_stranger'),hp=b.hp;strike(g,2);assert.equal(b.hp,hp-2);assert(!g.maskRetreatPending);
 const a=g.getUnit('soyo');Object.assign(a,{x:14,y:6,mag:200,dex:200,lck:200,res:200});b.hp=2;b.mag=0;b.lck=0;
 const round=M.Combat.rollRound(b,a,g.map,{int:()=>1});assert.equal(round.attackerHpAfter,1);assert(round.strikes.some(s=>s.kind==='counter'&&s.retreatTriggered));g.applyCombat(round);assert(g.maskRetreatPending&&!b.dead);
 const h=fresh(),f=h.getUnit('nina'),target=h.getUnit('masked_stranger');f.inventory=[M.Inventory.make('iron_gauntlets')];M.Inventory.equip(f,0);Object.assign(f,{x:14,y:5,str:200,dex:200,lck:200,spd:100});
 const combo=M.Combat.rollRound(f,target,h.map,{int:()=>1});assert(combo.forecast.attackCount>=2);assert.equal(combo.strikes.length,1);h.applyCombat(combo);assert.equal(target.hp,1);assert(!target.dead);assert(h.maskRetreatPending);
});
test('第五章继承等级、职业、物品、资金和已加入角色',()=>{
 const old=new M.Game({stage:5,recruited:['xueyue','nina'],seed:57});M.Growth.award(old.getUnit('soyo'),500);old.gold=4321;old.getUnit('soyo').inventory.push(M.Inventory.make('vulnerary'));
 const g=new M.Game({stage:6,recruited:old.recruited,loadout:old.exportLoadout(),seed:66});assert.equal(g.gold,4321);assert.equal(g.getUnit('soyo').level,old.getUnit('soyo').level);assert.equal(g.livingCount('player'),7);assert.deepEqual(plain(g.getUnit('soyo').inventory),plain(old.getUnit('soyo').inventory));
});
test('拒绝伪造波次、缺失召唤物、重叠和面具人死亡存档',()=>{
 const g=fresh();approach(g,32);const original=plain(g.serialize());
 for(const mutate of [s=>s.summonedWaves=['mask-wave-2'],s=>s.units.pop(),s=>s.lastSummonTurn=999,s=>s.enemyScaleLevel=0,s=>s.maskEscaped=true,s=>s.units.find(u=>u.id==='masked_stranger').hp=0,s=>Object.assign(s.units.find(u=>u.id==='mask-summon-1-1'),{x:14,y:4})]){const s=plain(original);mutate(s);assert.throws(()=>fresh().restore(s));}
});
console.log(count+' sixth-chapter checks passed.');


