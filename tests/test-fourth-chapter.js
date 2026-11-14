'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const w={console,setTimeout,clearTimeout,document:{readyState:'loading'},addEventListener:()=>{}};w.window=w;vm.createContext(w);
for(const name of ['equipment-data','magic-data','inventory','class-data','config','chapter-three','chapter-four',
  'map-projection','rng','growth-data','growth','grid','pathfinding','combat','game','ai','park-map','ui','entry'])
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',name+'.js'),'utf8'),w,{filename:name+'.js'});
const M=w.MyGO,plain=o=>JSON.parse(JSON.stringify(o)),fresh=opts=>new M.Game({stage:4,seed:46,...opts});let count=0;
function test(name,fn){fn();count++;console.log('✓ '+name);}
const hit=(g,a,b,damage=999)=>g.applyCombat({attackerId:a,defenderId:b,finalDamage:damage,hit:true});
test('40×26现代公园、左侧出生、13敌人、合法站位和连通路线',()=>{
  const g=fresh({recruited:['xueyue','nina']});assert.equal(g.stage,4);assert.equal(g.map.cols,40);assert.equal(g.map.rows,26);
  assert.equal(g.livingCount('player'),7);assert.equal(g.livingCount('enemy'),13);
  assert(g.living('player').every(u=>u.x<=4&&u.facing==='right'));
  const occupied=new Set();for(const u of g.units){assert(!g.getTerrain(u.x,u.y).blocked,u.id);const k=M.Grid.key(u.x,u.y);assert(!occupied.has(k),u.id);occupied.add(k);}
  const reach=M.Pathfinding.getReachable(g.map,{...g.getUnit('tomori'),move:9999},[]);
  for(let y=0;y<g.map.rows;y++)for(let x=0;x<g.map.cols;x++)if(!g.getTerrain(x,y).blocked)assert(reach.has(M.Grid.key(x,y)),x+','+y);
  for(const l of g.mission.lamps)assert(reach.has(M.Grid.key(l.x,l.y)));
  assert(g.map.decor.some(d=>d.kind==='bench'));assert(g.map.decor.some(d=>d.kind==='flowerbed'));
});
test('初始有限视野、隐藏敌军、隐藏选取与不可直接跨入黑暗的移动范围',()=>{
  const g=fresh(),s=g.getUnit('soyo'),boss=g.getUnit('dark_soyo');
  assert(g.isVisible(s.x,s.y));assert(!g.isVisible(36,10));assert(!g.isUnitVisible(boss));assert(!g.bossDiscovered);
  s.weapon={...s.weapon,range:[1,99]};assert(!g.canAttack(s,boss));assert(!g.getAttackableEnemies(s).includes(boss));
  for(const r of g.getReachable(s).values())assert(g.isVisible(r.x,r.y));
  assert(g.parkSoundHint().includes('先在附近探索'));assert(!g.parkSoundHint().includes('入口步道'));
});
test('路灯只能在1格内、我方阶段未行动时点亮，消耗行动且永久提供视野',()=>{
  const g=fresh(),t=g.getUnit('tomori'),l=g.mission.lamps[0];assert(!g.canLightLamp(t));
  g.setUnitPosition(t.id,l.x-1,l.y);assert(g.canLightLamp(t));assert.equal(g.lightLamp(t).id,l.id);assert(t.acted);
  assert(!g.lightLamp(t));assert.equal(g.litLamps.length,1);assert(g.isVisible(l.x+5,l.y));assert(!g.isVisible(l.x+7,l.y));
  g.setUnitPosition(t.id,3,12);assert(g.isVisible(l.x+5,l.y));
  assert(g.parkSoundHint().includes('东北方向'));
  const l2=g.mission.lamps[1];g.setUnitPosition(t.id,l2.x,l2.y);t.acted=false;g.phase='enemy';assert(!g.lightLamp(t));
  g.phase='player';t.dead=true;assert(!g.lightLamp(t));
});
test('逐盏点灯存在可行前进路线，最后路灯揭示Boss',()=>{
  const g=fresh(),t=g.getUnit('tomori');
  // Clear foes only to isolate navigation; fog and terrain use production rules.
  for(const e of g.living('enemy'))if(!e.boss){e.dead=true;e.hp=0;}
  for(const l of g.mission.lamps){
    let moves=0;
    while(M.Grid.manhattan(t,l)>1){
      const available=[...g.getReachable(t).values()].filter(r=>r.stoppable);
      const best=available.sort((a,b)=>M.Grid.manhattan(a,l)-M.Grid.manhattan(b,l))[0];
      assert(M.Grid.manhattan(best,l)<M.Grid.manhattan(t,l),'路线应向下一灯推进');
      g.setUnitPosition(t.id,best.x,best.y);assert(++moves<20);
    }
    t.acted=false;assert(g.lightLamp(t));
  }
  assert(g.bossDiscovered);assert(g.isUnitVisible(g.getUnit('dark_soyo')));
  assert.equal(g.getUnit('dark_soyo').name,'往日之影长崎爽世');
});

test('每盏灯提供独立声音方向，按实际点亮顺序回忆，存读档不泄漏下一盏位置',()=>{
  const g=fresh(),t=g.getUnit('tomori'),hints=new Set();
  for(const index of [3,0,5,1,4,2]){
    const lamp=g.mission.lamps[index];g.setUnitPosition(t.id,lamp.x,lamp.y);t.acted=false;
    assert(g.lightLamp(t));const hint=g.parkSoundHint();assert(/东[南北]?方/.test(hint));assert(!/号路灯|下一站|\d+,\d+/.test(hint));
    hints.add(hint);const restored=fresh();restored.restore(plain(g.serialize()));assert.equal(restored.parkSoundHint(),hint);
  }
  assert.equal(hints.size,6);
});

test('地图不再绘制路灯指引和Boss脚下名称，角色资料保留首领名字',()=>{
  assert.equal(M.ParkMap.drawGuides,undefined);
  assert.equal(fresh().getUnit('dark_soyo').name,'往日之影长崎爽世');
});

test('敌军从视野之外警戒、移动到可见范围并在同回合攻击，不等玩家先发现',()=>{
  const g=fresh(),e=g.getUnit('park-blade-1'),t=g.getUnit('tomori');
  g.setUnitPosition(t.id,6,12);assert(!g.isUnitVisible(e));assert(g.isUnitActive(e));
  g.beginEnemyPhase();const plan=M.AI.planAction(g,e);assert.equal(plan.type,'attack');
  assert(plan.path.some(p=>!g.isVisible(p.x,p.y)));assert(plan.path.some(p=>g.isVisible(p.x,p.y)));
  g.setUnitPosition(e.id,plan.destination.x,plan.destination.y);assert(g.isUnitVisible(e));
  const target=g.getUnit(plan.targetId);assert(g.canAttack(e,target));
  const result=g.rollCombat(e,target);g.applyCombat(result);assert(target.hp<target.maxHp||!result.strikes.some(s=>s.hit));
});

test('点灯声惊动光圈外的敌军，远方首领不会被直接激活',()=>{
  const g=fresh(),t=g.getUnit('tomori'),e=g.getUnit('park-bow-1');g.setUnitPosition(t.id,6,12);
  assert(!e.alerted);g.lightLamp(t);assert(!g.isUnitVisible(e));assert(e.alerted);assert(!g.getUnit('dark_soyo').alerted);
  t.x=3;t.y=12;assert(g.isUnitActive(e));
});

test('巡猎分批启动，未到回合的远方敌军等待，读档保留追击警戒',()=>{
  const g=fresh(),south=g.getUnit('park-bow-3'),fork=g.getUnit('park-axe-1');
  assert(!g.isUnitActive(south));assert(!g.isUnitActive(fork));
  g.turn=3;g.beginEnemyPhase();assert(south.alerted);assert(!fork.alerted);
  assert.notEqual(M.AI.planAction(g,south).type,'wait');assert(!g.isUnitVisible(south));
  const restored=fresh();restored.restore(plain(g.serialize()));assert(restored.getUnit(south.id).alerted);
  g.turn=6;g.refreshAlerts();assert(fork.alerted);assert(!g.getUnit('dark_soyo').alerted);
});
test('敌人随队伍平均等级变强，回合刷新不叠加成长，并保留HP比例',()=>{
  const g=fresh(),e=g.getUnit('park-blade-1'),boss=g.getUnit('dark_soyo');
  assert.equal(e.level,5);assert.equal(boss.level,7);const low={hp:e.maxHp,str:e.str,mag:boss.mag};
  e.hp=Math.floor(e.maxHp/2);const ratio=e.hp/e.maxHp;
  for(const p of g.living('player'))M.Growth.award(p,M.Growth.required(p.level));
  g.beginNextPlayerPhase();assert.equal(e.level,6);assert(e.maxHp>low.hp);assert(e.str>low.str);assert(boss.mag>=low.mag);
  assert(Math.abs(e.hp/e.maxHp-ratio)<1/e.maxHp+.001);
  const unchanged=plain([e.level,e.maxHp,e.str,e.hp]);g.scaleParkEnemies();assert.deepEqual(plain([e.level,e.maxHp,e.str,e.hp]),unchanged);
  g.scaleParkEnemies(30);assert.equal(e.level,30);assert.equal(boss.level,32);assert(e.maxHp>low.hp+30);assert(boss.mag>low.mag);
});
test('爽世击杀与反击击杀Boss均双倍经验，普通队友和非致命伤不触发',()=>{
  for(const id of ['soyo','tomori']){
    const g=fresh(),u=g.getUnit(id),b=g.getUnit('dark_soyo'),base=Math.min(M.Growth.combatExp(u,b,b.hp,true),M.Growth.required(u.level));
    const r=hit(g,id,b.id);assert.equal(r.experience[0].gained,base*(id==='soyo'?2:1));assert.equal(g.soyoBossBonus,id==='soyo');
    assert.equal(g.phase,'victory');assert(g.livingCount('enemy')>0);
  }
  const g=fresh(),u=g.getUnit('soyo'),b=g.getUnit('dark_soyo');
  const amount=M.Growth.combatExp(u,b,1,false),r=hit(g,u.id,b.id,1);assert.equal(r.experience[0].gained,amount);assert(!g.soyoBossBonus);
  const counter=fresh(),s=counter.getUnit('soyo'),enemy=counter.getUnit('dark_soyo');
  const base=Math.min(M.Growth.combatExp(s,enemy,enemy.hp,true),M.Growth.required(s.level));
  const result={attackerId:enemy.id,defenderId:s.id,strikes:[{attackerId:enemy.id,defenderId:s.id,finalDamage:1,hit:true,kind:'attack'},
    {attackerId:s.id,defenderId:enemy.id,finalDamage:999,hit:true,kind:'counter'}]};
  counter.applyCombat(result);assert.equal(result.experience[0].gained,base*2);assert(counter.soyoBossBonus);
});
test('保存/恢复路灯、等级、HP、Boss发现、成长与已招募仁菜，不回滚缩放',()=>{
  const g=fresh({recruited:['xueyue','nina']}),t=g.getUnit('tomori');g.setUnitPosition(t.id,7,12);g.lightLamp(t);
  g.scaleParkEnemies(12);g.getUnit('park-blade-1').hp=9;const snapshot=plain(g.serialize()),restored=new M.Game({stage:1});
  restored.restore(snapshot);assert.deepEqual(plain(restored.serialize()),snapshot);assert.equal(restored.getUnit('nina').side,'player');
  assert.equal(restored.getUnit('park-blade-1').level,12);assert.equal(restored.getUnit('park-blade-1').hp,9);
  for(const bad of [{...snapshot,litLamps:['wrong']},{...snapshot,litLamps:['park-entry','park-entry']},{...snapshot,enemyScaleLevel:0},
    {...snapshot,mapRevision:0}])assert.throws(()=>fresh().restore(bad));
  hit(g,'soyo','dark_soyo');const win=fresh();win.restore(plain(g.serialize()));assert(win.soyoBossBonus);assert.equal(win.phase,'victory');
});
test('第三关进入第四关继承雪月、仁菜、成长、背包和永久失去招募状态',()=>{
  const previous=new M.Game({stage:3,recruited:['xueyue'],seed:44});
  for(const e of previous.living('enemy'))hit(previous,null,e.id);
  const u=previous.getUnit('soyo');M.Growth.award(u,M.Growth.required(u.level));
  const next=fresh({recruited:previous.recruited,loadout:previous.exportLoadout(),ninaLost:previous.ninaLost});
  assert.equal(next.getUnit('nina').side,'player');assert.equal(next.getUnit('soyo').level,u.level);assert.equal(next.getUnit('xueyue').side,'player');
  assert.deepEqual(plain(next.getUnit('soyo').inventory),plain(u.inventory));
  assert(!fresh({recruited:['nina'],ninaLost:true}).getUnit('nina'));
});
test('真实行动菜单点灯弹出声音方向、重复点击不额外点灯',()=>{
  const g=fresh(),t=g.getUnit('tomori');g.setUnitPosition(t.id,6,12);let actions;const toasts=[];
  const ui=Object.create(M.UI.prototype);Object.assign(ui,{game:g,dom:{contextTitle:{},contextText:{}},
    renderer:{floatText:()=>{}},setActions:a=>actions=a,resetSelection:()=>{},updateAll:()=>{},showToast:s=>toasts.push(s)});
  ui.renderActionSide(t);const action=actions.find(a=>a.label?.startsWith('点亮路灯'));assert(action);action.onClick();action.onClick();
  assert.equal(g.litLamps.length,1);assert(t.acted);assert.equal(toasts.length,1);assert(toasts[0].includes('东北方向'));
});

test('任务面板只回忆声音，没有下一路灯名称、坐标和自动定位按钮',()=>{
  const g=fresh(),ui=Object.create(M.UI.prototype);let actions;
  Object.assign(ui,{game:g,dom:{portraitBlock:{dataset:{}},portraitBadge:{},portraitLevel:{},infoPortrait:{},
    infoName:{},infoTags:{},infoBody:{},contextTitle:{},contextText:{}},drawTerrainPortrait:()=>{},setActions:a=>actions=a});
  ui.renderIdleInfo();assert(!actions.some(a=>a.label.includes('追踪声音')));
  assert(!/下一站|入口步道|花圃转角|号路灯|定位/.test(ui.dom.infoBody.innerHTML));
  const t=g.getUnit('tomori');g.setUnitPosition(t.id,6,12);g.lightLamp(t);ui.renderIdleInfo();
  assert(ui.dom.infoBody.innerHTML.includes(g.parkSoundHint()));
});

(async()=>{
  w.setTimeout=fn=>{fn();return 0;};
  for(const hiddenOnly of [false,true]){
    const g=fresh(),ui=Object.create(M.UI.prototype),seen=[],moves=[],attacks=[],toasts=[];
    const e=g.getUnit(hiddenOnly?'park-bow-3':'park-blade-1');
    if(hiddenOnly)g.turn=3;else g.setUnitPosition('tomori',6,12);
    g.beginEnemyPhase();assert(!g.isUnitVisible(e));
    const plan=M.AI.planAction(g,e);
    Object.assign(ui,{game:g,dom:{contextTitle:{},contextText:{}},renderer:{snapUnit:()=>{},setView:()=>{},
      animateMove:async(id,path)=>moves.push(plain(path))},setView:()=>{},setActions:()=>{},updateAll:()=>{},
      revealCell:()=>{},showToast:s=>toasts.push(s),renderUnitInfo:u=>{assert(g.isUnitVisible(u));seen.push(u.id);},
      performAttackSequence:async(a,b)=>{attacks.push([a.id,b.id]);g.applyCombat(g.rollCombat(a,b));}});
    await ui.runEnemyAction(e);assert(e.acted);
    assert.deepEqual({x:e.x,y:e.y},plain(plan.destination));
    if(hiddenOnly){assert.equal(seen.length,0);assert.equal(moves.length,0);assert.equal(attacks.length,0);assert.equal(toasts.length,0);}
    else{assert.equal(attacks.length,1);assert(toasts[0].includes('脚步声'));assert.equal(moves.length,1);
      assert(moves[0].every(p=>g.isVisible(p.x,p.y)));assert(g.isUnitVisible(e));}
  }
  count++;console.log('✓ 真实UI隐藏敌军接近后播放可见路径与攻击，纯暗处移动不泄漏情报');
  console.log('Fourth chapter: '+count+' cases passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
