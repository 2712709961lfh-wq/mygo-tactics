'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const w={console,setTimeout,clearTimeout,document:{readyState:'loading'}};w.window=w;vm.createContext(w);
for(const n of ['equipment-data','magic-data','inventory','class-data','class-mastery','config','chapter-three','chapter-four','chapter-five','rng','growth-data','growth','grid','pathfinding','combat','game','ai','ui'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',n+'.js'),'utf8'),w,{filename:n});
const M=w.MyGO,I=M.Inventory,plain=x=>JSON.parse(JSON.stringify(x)),fresh=o=>new M.Game({stage:5,seed:57,...o});let count=0;
function test(name,fn){fn();console.log('✓ '+name);count++;}
function hit(g,a,b,n=999){return g.applyCombat({attackerId:a,defenderId:b,hit:true,finalDamage:n});}
function reload(g){const h=new M.Game();h.restore(plain(g.serialize()));return h;}
const quantity=(g,id)=>g.units.filter(u=>u.side==='player').flatMap(u=>u.inventory).concat(g.convoy,g.lootReserve||[]).filter(i=>i.id===id).length;

test('第五关全体非Boss总属性＋10、有效＋6～7，Boss有效＋5且不累加',()=>{
 const g=fresh(),C=M.CONFIG,keys=['maxHp','str','mag','dex','spd','lck','def','res','move'];
 for(const u of g.units.filter(u=>u.side==='enemy')){
  const base=C.STAGE_FIVE.enemies.find(t=>t.id===u.id),magic=u.weapon.damageType==='magic',off=magic?'str':'mag';
  const delta=keys.reduce((n,k)=>n+u[k]-(base[k]||0),0),effective=delta-(u[off]-(base[off]||0));
  assert.equal(delta,u.boss?5:10,u.id);assert(u.boss?effective===5:effective===6||effective===7,u.id);
  assert.equal(u.maxHp,base.maxHp);assert.equal(u.move,base.move);assert.equal(u.level,base.level);
  if(u.boss)assert.deepEqual([u.str,u.dex,u.spd],[17,12,6]);
 }
 const stats=()=>plain(g.units.filter(u=>u.side==='enemy').map(u=>[u.id,...keys.map(k=>u[k])]));
 const before=stats();g.applyFixedEnemyStats();g.applyFixedEnemyStats();g.beginNextPlayerPhase();assert.deepEqual(stats(),before);
 const h=reload(g);assert.deepEqual(plain(h.units.filter(u=>u.side==='enemy').map(u=>[u.id,...keys.map(k=>u[k])])),before);
});

test('第五关旧固定档采用新加点，保留伤势、阵亡、警戒、钥匙与宝箱进度',()=>{
 const g=fresh(),a=g.getUnit('court-armor-n'),p=g.getUnit('court-pegasus-n');
 Object.assign(a,{hp:11,acted:true,alerted:true});Object.assign(p,{hp:0,dead:true,acted:true});g.openedChests=['north-cache'];
 // Fixed-stat snapshots omit static attributes; old and new saves share the same HP ceilings.
 const s=plain(g.serialize()),h=fresh();h.restore(s);
 for(const u of g.units){const v=h.getUnit(u.id);assert.equal(v.hp,u.hp);assert.equal(v.dead,u.dead);assert.equal(v.acted,u.acted);assert.equal(v.alerted,u.alerted);assert.equal(v.x,u.x);assert.equal(v.y,u.y);}
 assert.equal(h.getUnit(a.id).str,13);assert.equal(h.getUnit(a.id).mag,4);
 assert.deepEqual(plain(h.openedChests),['north-cache']);assert.equal(quantity(h,'chest_key'),quantity(g,'chest_key'));
 assert.deepEqual(plain(reload(h).serialize()),plain(h.serialize()));
});
test('32×24夜间公园、7人出生、两桥贯通、14名敌人、宝箱可达',()=>{
 const g=fresh({recruited:['xueyue','nina']});assert.equal(g.map.cols,32);assert.equal(g.map.rows,24);assert.equal(g.livingCount('enemy'),14);assert.equal(g.mission.enemyCount,14);assert.equal(g.livingCount('player'),7);
 const occupied=new Set();for(const u of g.units){assert(Number.isFinite(M.Grid.movementCost(g.map,u,u.x,u.y)),u.id);const k=u.x+','+u.y;assert(!occupied.has(k));occupied.add(k);}
 const reach=M.Pathfinding.getReachable(g.map,{...g.getUnit('tomori'),move:9999},[]);assert(reach.has('28,11'));
 for(const c of g.mission.chests)assert(reach.has(c.x+','+c.y));
 for(let y=1;y<23;y++)assert.equal(g.map.tiles[y][15],[6,7,16,17].includes(y)?'bridge':'water');
 assert(g.map.decor.some(d=>d.kind==='bench'));assert(g.map.decor.some(d=>d.kind==='flowerbed'));assert(g.isVisible(28,11));
});
test('飞行越水、地面受阻、森林消耗1、墙体仍阻挡，存读档保留水面站位',()=>{
 const g=fresh(),p=g.getUnit('court-pegasus-n'),t=g.getUnit('tomori');assert.equal(g.getTerrain(p.x,p.y).id,'water');
 const r=g.getReachable(p);assert(r.has('12,3'));assert(r.has('19,3'));assert.equal(r.get('12,3').cost,3);
 assert(!g.getReachable({...t,x:12,y:3,move:6}).has('15,3'));assert.equal(M.Grid.movementCost(g.map,p,2,2),1);assert.equal(M.Grid.movementCost(g.map,p,0,3),Infinity);
 g.setUnitPosition(p.id,14,4);assert.equal(reload(g).getUnit(p.id).x,14);assert.throws(()=>g.setUnitPosition(t.id,15,4),/阻挡/);
});
test('天马AI从水面追击；攻击高亮允许瞄准水面天马',()=>{
 const g=fresh(),p=g.getUnit('court-pegasus-n');p.alerted=true;const plan=M.AI.planAction(g,p);assert.notEqual(plan.type,'wait');assert(plan.path.some(c=>g.getTerrain(c.x,c.y).id==='water'));
 const bow=g.getUnit('anon');bow.x=13;bow.y=3;assert(g.getAttackTiles(bow).some(c=>c.x===15&&c.y===3));assert(g.getAttackableEnemies(bow).includes(p));
});
test('四名天马面向西侧主角团，名称没有携钥，原来两名仍携带并掉落钥匙',()=>{
 const g=fresh(),pegasi=g.living('enemy').filter(u=>u.tags.includes('flying'));assert.equal(pegasi.length,4);
 assert.equal(pegasi.filter(p=>p.inventory.some(i=>i.id==='chest_key')).length,2);
 for(const p of pegasi){
  assert.equal(p.facing,'left');assert.equal(p.name,'天马骑士');assert(p.x>g.getUnit('soyo').x);
 }
 for(const id of ['court-pegasus-n','court-pegasus-s']){const p=g.getUnit(id);
  assert(p.inventory.some(i=>i.id==='chest_key'));assert(p.drops.includes('chest_key'));
 }
});
test('新增两名天马分守Boss两侧、属性略低、无钥匙掉落并保留受伤及阵亡存档',()=>{
 const g=fresh(),b=g.getUnit('iron_warden'),p=g.getUnit('court-pegasus-n');
 for(const id of ['court-pegasus-guard-n','court-pegasus-guard-s']){const u=g.getUnit(id);
  assert.equal(u.level,p.level);assert.equal(Math.abs(u.x-b.x)+Math.abs(u.y-b.y),3);
  for(const stat of ['maxHp','str','dex','spd','lck','def','res'])assert(u[stat]<p[stat]&&u[stat]>=p[stat]-4,stat);
  assert.equal(u.move,p.move);assert.equal(u.weapon.id,p.weapon.id);assert(!u.inventory.some(i=>i.id==='chest_key'));assert.equal(u.drops.length,0);
 }
 const n=g.getUnit('court-pegasus-guard-n');n.hp-=3;assert.equal(reload(g).getUnit(n.id).hp,n.hp);
 const r=hit(g,'tomori','court-pegasus-guard-s');assert.equal((r.drops||[]).length,0);assert.equal(quantity(g,'chest_key'),0);
 assert(reload(g).getUnit('court-pegasus-guard-s').dead);
});
test('天马护卫开场守候，接近或攻击时与Boss联动，湖上天马不提前惊动护卫',()=>{
 const g=fresh(),b=g.getUnit('iron_warden'),guards=['court-pegasus-guard-n','court-pegasus-guard-s'].map(id=>g.getUnit(id));
 for(const u of guards){assert.equal(u.guardGroup,b.guardGroup);assert(!g.isUnitActive(u));assert.equal(M.AI.planAction(g,u).type,'wait');}
 g.alertGroup(g.getUnit('court-pegasus-n'));assert(guards.every(u=>!u.alerted));
 const t=g.getUnit('tomori');t.x=24;t.y=9;g.refreshAlerts();assert(b.alerted);assert(guards.every(u=>u.alerted));
 assert(guards.some(u=>M.AI.planAction(g,u).type!=='wait'));
 const h=fresh();hit(h,'tomori','court-pegasus-guard-n',1);assert(h.getUnit('iron_warden').alerted);assert(h.getUnit('court-pegasus-guard-s').alerted);
});
test('旧档补入护卫，出生格被占时只调整新护卫，真实存档重叠仍拒绝',()=>{
 const s=plain(fresh().serialize());s.units=s.units.filter(u=>!u.id.startsWith('court-pegasus-guard-'));
 Object.assign(s.units.find(u=>u.id==='tomori'),{x:27,y:9});Object.assign(s.units.find(u=>u.id==='anon'),{x:29,y:13});
 const g=fresh();g.restore(s);assert.equal(g.livingCount('enemy'),14);
 for(const id of ['tomori','anon'])assert.deepEqual(plain({x:g.getUnit(id).x,y:g.getUnit(id).y}),{x:s.units.find(u=>u.id===id).x,y:s.units.find(u=>u.id===id).y});
 const positions=g.living().map(u=>u.x+','+u.y);assert.equal(new Set(positions).size,positions.length);
 assert.equal(reload(g).getUnit('court-pegasus-guard-n').x,g.getUnit('court-pegasus-guard-n').x);
 const bad=plain(g.serialize());Object.assign(bad.units.find(u=>u.id==='court-pegasus-guard-n'),{x:27,y:9});assert.throws(()=>fresh().restore(bad),/位置重叠/);
});
test('重装与Boss采用固定低HP模板，初始爽世火焰次数足以击破四名重装',()=>{
 const g=fresh(),s=g.getUnit('soyo'),armors=g.living('enemy').filter(u=>u.tags.includes('armor'));
 assert.equal(g.getUnit('court-armor-n').maxHp,24);assert.equal(g.getUnit('iron_warden').maxHp,36);
 const required=armors.reduce((n,e)=>n+Math.ceil(e.maxHp/M.Combat.preview(s,e,g.map).damage),0);
 assert.equal(required,9);assert(required<=s.spellUses.fire);
 g.applyFixedEnemyStats();assert.equal(g.getUnit('court-armor-n').maxHp,24);assert.equal(g.getUnit('iron_warden').maxHp,36);
 const old=plain(g.serialize());for(const e of old.units)if(e.id==='court-armor-n')e.hp=36;
 const restored=fresh();restored.restore(old);assert.equal(restored.getUnit('court-armor-n').hp,24);
});
test('重装守备远高于魔防，魔法伤害更高；弓对天马3倍武器威力，无森林地形回避',()=>{
 const g=fresh(),a=g.getUnit('court-armor-n'),p=g.getUnit('court-pegasus-n'),t=g.getUnit('tomori'),s=g.getUnit('soyo'),bow=g.getUnit('anon');
 assert(a.tags.includes('armor'));assert(a.def-a.res>=12);assert.equal(a.move,3);assert(M.Combat.preview(s,a,g.map).damage>M.Combat.preview(t,a,g.map).damage);
 assert.equal(M.Combat.preview(bow,p,g.map).effectiveness,3);p.x=2;p.y=2;assert.equal(M.Combat.terrainOf(p,g.map).avoid,0);
});
test('队伍升级不改变重装固定属性、伤势与存档数值',()=>{
 const g=fresh(),a=g.getUnit('court-armor-n'),old=a.maxHp;a.hp=Math.floor(old/2);for(const u of g.units.filter(u=>u.side==='player'))M.Growth.award(u,10000);
 g.beginNextPlayerPhase();g.applyFixedEnemyStats();assert.equal(a.maxHp,old);assert(a.def-a.res>12);assert.equal(a.hp,Math.floor(old/2));assert.equal(reload(g).getUnit(a.id).maxHp,a.maxHp);
});
test('击败天马骑士获得真实钥匙、敌人失去钥匙、同一战报不可重复领取',()=>{
 const g=fresh(),p=g.getUnit('court-pegasus-n'),t=g.getUnit('tomori');assert(p.inventory.some(i=>i.id==='chest_key'));const r=hit(g,t.id,p.id);
 assert.equal(r.drops[0].id,'chest_key');assert(t.inventory.some(i=>i.id==='chest_key'));assert(!p.inventory.some(i=>i.id==='chest_key'));assert.throws(()=>g.applyCombat(r),/已结算/);
 hit(g,t.id,p.id);assert.equal(quantity(g,'chest_key'),1);assert.equal(quantity(reload(g),'chest_key'),1);
});
test('满包拾取钥匙自动腾位，双满战利品进入暂存且存档与取回有效',()=>{
 const g=fresh(),t=g.getUnit('tomori');while(t.inventory.length<5)t.inventory.push(I.make('vulnerary'));const n=g.convoy.length;
 hit(g,t.id,'court-pegasus-n');assert.equal(t.inventory.length,5);assert(t.inventory.some(i=>i.id==='chest_key'));assert.equal(g.convoy.length,n+1);
 while(g.convoy.length<500)g.convoy.push(I.make('vulnerary'));hit(g,t.id,'iron_warden');assert.equal(g.lootReserve.length,2);assert.equal(g.convoy.length,500);
 const h=reload(g);assert.equal(h.lootReserve.length,2);h.sellItem(0);assert.equal(h.convoy.length,500);assert.equal(h.lootReserve.length,1);
});
test('开箱需要我方未行动、钥匙、距离，失败不变更状态',()=>{
 const g=fresh(),t=g.getUnit('tomori');assert.equal(g.openChest(t),null);t.x=8;t.y=3;assert.equal(g.openChest(t),null);t.inventory.push(I.make('chest_key'));
 g.phase='enemy';assert.equal(g.openChest(t),null);g.phase='player';t.acted=true;assert.equal(g.openChest(t),null);t.acted=false;t.x=7;assert.equal(g.openChest(t),null);t.x=8;
 assert(g.canOpenChest(t));const r=g.openChest(t);assert.equal(r.drop.id,'elixir');assert(t.acted);assert(!t.inventory.some(i=>i.id==='chest_key'));assert(t.inventory.some(i=>i.id==='elixir'));assert.equal(g.openChest(t),null);
});
test('500 G宝箱只奖励一次，特效药与开箱状态读档不重置',()=>{
 const g=fresh(),t=g.getUnit('tomori');hit(g,t.id,'court-pegasus-n');t.x=9;t.y=3;g.openChest(t);t.acted=false;
 hit(g,t.id,'court-pegasus-s');t.x=25;t.y=19;const gold=g.gold;const r=g.openChest(t);assert.equal(r.gold,500);assert.equal(g.gold,gold+500);
 const h=reload(g),u=h.getUnit(t.id);assert.equal(h.openedChests.length,2);assert.equal(quantity(h,'elixir'),1);u.acted=false;u.inventory.push(I.make('chest_key'));assert.equal(h.openChest(u),null);assert.equal(h.gold,g.gold);
});
test('重装Boss掉落恰好一张中级转职证与钢斧，击败即通关，通关金不重复',()=>{
 const g=fresh(),gold=g.gold;const r=hit(g,'soyo','iron_warden');assert.equal(g.phase,'victory');assert.equal(g.gold,gold+2000);assert(g.livingCount('enemy')>0);
 assert.deepEqual(plain(r.drops.map(d=>d.id)),['intermediate_seal','steel_axe']);assert.equal(quantity(g,'intermediate_seal'),1);assert.equal(quantity(g,'steel_axe'),1);
 const h=reload(g);h.checkOutcome();assert.equal(h.gold,g.gold);assert.equal(quantity(h,'intermediate_seal'),1);assert.equal(quantity(h,'steel_axe'),1);
});
test('真实战斗回合反击击败Boss仍发双掉落并聚合至战报',()=>{
 const g=fresh(),b=g.getUnit('iron_warden'),t=g.getUnit('tomori');b.hp=1;b.str=0;t.str=100;t.dex=100;t.hp=t.maxHp;t.x=27;t.y=11;
 const r=g.rollCombat(b,t);g.applyCombat(r);assert(b.dead);assert.equal(r.drops.length,2);assert(r.strikes.some(s=>s.applied&&s.attackerId===t.id&&s.killed));assert.equal(g.phase,'victory');
});
test('第四关通关后进入第五关，携带招募、等级、背包、金钱和商店重置',()=>{
 const g=new M.Game({stage:4,recruited:['xueyue','nina']});g.buyItem('intermediate_seal');hit(g,'soyo','dark_soyo');const h=fresh({recruited:g.recruited,loadout:g.exportLoadout()});
 assert.equal(h.livingCount('player'),7);assert.equal(h.getUnit('soyo').level,g.getUnit('soyo').level);assert.equal(h.gold,g.gold);assert.equal(quantity(h,'intermediate_seal'),1);assert.equal(Object.keys(h.shopPurchases).length,0);assert.equal(h.shopChapter,5);
});
test('非法宝箱ID、重复领取标记、地图版本与敌军等级被拒绝',()=>{
 for(const patch of [{openedChests:['bad']},{openedChests:['north-cache','north-cache']},{mapRevision:88},{enemyScaleLevel:0}]){const s=plain(fresh().serialize());Object.assign(s,patch);assert.throws(()=>new M.Game().restore(s));}
});
test('真实行动菜单提供开箱按钮并与缺钥匙状态同步',()=>{
 const g=fresh(),t=g.getUnit('tomori'),ui=Object.create(M.UI.prototype);let actions;Object.assign(ui,{game:g,dom:{contextTitle:{},contextText:{}},setActions:a=>actions=a,
 renderer:{floatText:()=>{}},resetSelection:()=>{},updateAll:()=>{},showToast:()=>{}});t.x=8;t.y=3;ui.renderActionSide(t);assert(actions.find(a=>a.label.includes('缺少宝箱钥匙')).disabled);
 t.inventory.push(I.make('chest_key'));ui.renderActionSide(t);actions.find(a=>a.label==='使用宝箱钥匙 · 开箱').onClick();assert(t.acted);assert.equal(g.openedChests.length,1);
});
console.log('Chapter 5: '+count+' cases passed.');
