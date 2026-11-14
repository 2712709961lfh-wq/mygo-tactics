'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const world={console,setTimeout:fn=>{fn();return 0;},clearTimeout:()=>{},document:{readyState:'loading'},addEventListener:()=>{}};
world.window=world;vm.createContext(world);
for(const name of ['equipment-data','magic-data','inventory','class-data','config','chapter-three','map-projection','rng','growth-data','growth','grid','pathfinding','combat','game','ai','ui','entry','loadout-ui'])
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',name+'.js'),'utf8'),world,{filename:name+'.js'});
const M=world.MyGO;let count=0;
function test(name,fn){fn();count++;console.log('✓ '+name);}
const fresh=()=>new M.Game({stage:3,recruited:['xueyue'],seed:46});
const plain=x=>JSON.parse(JSON.stringify(x));
function clear(g){for(const e of g.living('enemy'))g.applyCombat({defenderId:e.id,hit:true,finalDamage:999});}
function execute(g,u){const plan=M.AI.planAction(g,u);if(plan.destination)g.setUnitPosition(u.id,plan.destination.x,plan.destination.y);
  if(plan.type==='attack')g.applyCombat(g.rollCombat(u,g.getUnit(plan.targetId)));u.acted=true;return plan;}

test('第三关40×30花镇、24敌人，上方中央玩家与下方中央不可控仁菜',()=>{
  const g=fresh(),n=g.getUnit('nina');assert.equal(g.stage,3);assert.equal(g.map.cols,40);assert.equal(g.map.rows,30);
  assert.equal(g.livingCount('enemy'),24);assert.equal(g.livingCount('player'),6);assert.equal(g.livingCount('ally'),1);
  assert.equal(n.level,7);assert.equal(n.className,'战士');assert.equal(n.weapon.name,'铁拳套');assert.equal(n.side,'ally');
  assert(g.living('player').every(u=>u.y<=6&&u.x>=19&&u.x<=21));assert.equal(n.x,20);assert.equal(n.y,22);
  assert.equal(new M.Game({stage:3}).livingCount('player'),5);
  const positions=new Set();for(const u of g.units){assert(!g.getTerrain(u.x,u.y).blocked,u.id);const k=M.Grid.key(u.x,u.y);assert(!positions.has(k),u.id);positions.add(k);}
  assert.throws(()=>g.transferItem(n,0,true),/无法整理/);assert.throws(()=>g.selectAttack(n,'iron_gauntlets'),/无法切换/);
});

test('全部可通行格、出生点与救援目标连通，三条路线可以通行',()=>{
  const g=fresh(),r=M.Pathfinding.getReachable(g.map,{...g.getUnit('tomori'),move:9999},[]);
  for(let y=0;y<g.map.rows;y++)for(let x=0;x<g.map.cols;x++)if(!g.getTerrain(x,y).blocked)assert(r.has(M.Grid.key(x,y)),x+','+y);
  for(const [x,y] of [[20,22],[8,20],[30,20]])assert(r.has(M.Grid.key(x,y)));
});

test('友军与玩家不能互攻，可以穿过友军但不可停留重叠，敌人同时以双方为目标',()=>{
  const g=fresh(),n=g.getUnit('nina'),t=g.getUnit('tomori');g.setUnitPosition(t.id,20,21);
  assert(!g.canAttack(t,n));assert(!g.canAttack(n,t));assert.throws(()=>M.Combat.forecast(t,n,g.map),/友军/);
  assert(!g.getAttackableEnemies(t).some(u=>u.id==='nina'));
  const r=g.getReachable(t);assert(r.has('20,22'));assert(!r.get('20,22').stoppable);assert(r.has('20,23'));
  const e=g.getUnit('siege_blade');assert(g.getAttackableEnemies(e).some(u=>u.id==='nina'));
  assert(M.AI.planAction(g,e).targetId==='nina');
});

test('玩家辅助治疗可治疗仁菜，不能治疗敌人或复活已阵亡仁菜',()=>{
  const g=fresh(),n=g.getUnit('nina'),s=g.getUnit('soyo');g.setUnitPosition(s.id,20,21);n.hp=10;
  assert(g.supportTargets(s,'heal').some(u=>u.id==='nina'));assert(!g.supportTargets(s,'heal').some(u=>u.side==='enemy'));
  const before=n.hp;g.castSupport(s,'heal',n);assert(n.hp>before);assert(s.acted);
  g.applyCombat({defenderId:'nina',finalDamage:999,hit:true});s.acted=false;
  assert(!g.supportTargets(s,'heal').some(u=>u.id==='nina'));
});

test('铁拳套主动两连击、射程1、反击一次，逐击耐久限制及击倒中断',()=>{
  const g=fresh(),n=g.getUnit('nina'),e=g.getUnit('siege_blade');e.hp=e.maxHp=100;e.spd=n.spd;
  const plan=g.previewCombat(n,e);assert.equal(plan.order.map(s=>s.kind).join(','),'attack,combo,counter');
  assert.equal(plan.attackCount,2);assert.equal(plan.counterCount,1);
  const reverse=g.previewCombat(e,n);assert.equal(reverse.counterCount,1);
  n.inventory[0].uses=1;assert.equal(g.previewCombat(n,e).attackCount,1);n.inventory[0].uses=50;
  e.hp=1;g.rng={int:()=>1};const result=g.rollCombat(n,e);assert.equal(result.strikes.length,1);
  const before=n.inventory[0].uses;g.applyCombat(result);assert.equal(n.inventory[0].uses,before-1);
});

test('仁菜友军阶段自主战斗，远离周边敌人时不追击全图',()=>{
  const g=fresh(),n=g.getUnit('nina');assert(g.beginAllyPhase());assert.equal(g.phase,'ally');
  const p=execute(g,n);assert.equal(p.type,'attack');assert(g.finishAllyPhase());assert.equal(g.phase,'enemy');
  g.beginNextPlayerPhase();assert.equal(g.turn,2);
  for(const e of g.living('enemy'))if(M.Grid.manhattan(n,e)<=4){e.dead=true;e.hp=0;}
  assert.equal(M.AI.planAction(g,n).type,'wait');
});

test('五组随机种子均留出前三轮救援窗口，第四回合南部围兵施压，放任会阵亡',()=>{
  for(const seed of [1,14,46,88,947]){
    const g=new M.Game({stage:3,recruited:['xueyue'],seed});
    for(let round=1;round<=6&&!g.getUnit('nina').dead;round++){
      if(g.beginAllyPhase()){
        for(const u of g.living('ally'))execute(g,u);
        g.finishAllyPhase();
      }else g.beginEnemyPhase();
      for(const e of g.living('enemy'))if(!g.isOver())execute(g,e);
      if(round<=3)assert(g.getUnit('nina').hp>0,'seed '+seed+' round '+round);
      g.beginNextPlayerPhase();
      if(round===3)assert(g.living('enemy').filter(e=>e.guardGroup==='south').every(e=>e.alerted));
    }
    assert(g.ninaLost,'seed '+seed+' must require rescue');
  }
});

test('四张用户素材均保留原件，仁菜动作49帧及四方向地图图集规格完整',()=>{
  const dir=path.join(__dirname,'../assets/characters');
  for(const kind of ['battle','walk','idle','portrait'])assert(fs.statSync(path.join(dir,'actions/source/nina-'+kind+'-original.jpg')).size>1000);
  const meta=JSON.parse(fs.readFileSync(path.join(dir,'actions/nina-actions.json'),'utf8'));
  assert.equal(Object.values(meta.frames).reduce((n,f)=>n+f.count,0),49);
  assert.equal(Object.keys(meta.frames).length,10);
  for(const [file,width,height] of [['actions/nina-actions.png',1280,1440],['walk/nina-walk.png',384,512],['idle/nina-idle.png',256,284]]){
    const png=fs.readFileSync(path.join(dir,file));assert.equal(png.readUInt32BE(16),width);assert.equal(png.readUInt32BE(20),height);
  }
});

test('仁菜阵亡不会失败，永久丢失招募资格，中途/终局读档不复活或补发',()=>{
  const g=fresh();g.applyCombat({attackerId:'siege_blade',defenderId:'nina',hit:true,finalDamage:999});
  assert(g.ninaLost);assert.equal(g.phase,'player');assert.equal(g.livingCount('player'),6);
  const h=fresh();h.restore(g.serialize());assert(h.ninaLost);assert(h.getUnit('nina').dead);
  clear(h);assert.equal(h.phase,'victory');assert(!h.recruited.includes('nina'));
  const z=fresh();z.restore(h.serialize());assert(z.ninaLost);assert(!z.recruited.includes('nina'));assert(z.getUnit('nina').dead);
});

test('玩家全灭但友军仁菜仍活着时任务失败',()=>{
  const g=fresh();for(const u of g.living('player')){u.dead=true;u.hp=0;}g.checkOutcome();
  assert.equal(g.phase,'defeat');assert.equal(g.getUnit('nina').hp,36);assert(!g.recruited.includes('nina'));
});

test('仁菜活着时须击败所有敌人才能招募，保留HP/耐久并出现在同行之人',()=>{
  const g=fresh(),n=g.getUnit('nina');n.hp=14;n.inventory[0].uses=31;
  const enemies=g.living('enemy');for(const e of enemies.slice(0,-1)){e.dead=true;e.hp=0;}
  g.checkOutcome();assert.equal(g.phase,'player');assert(!g.recruited.includes('nina'));assert.equal(n.side,'ally');
  g.applyCombat({defenderId:enemies.at(-1).id,finalDamage:999,hit:true});assert.equal(g.phase,'victory');
  assert(g.recruited.includes('nina'));assert.equal(n.side,'player');assert.equal(n.hp,14);assert.equal(n.inventory[0].uses,31);
  const h=fresh();h.restore(g.serialize());assert.equal(h.getUnit('nina').side,'player');assert.equal(h.getUnit('nina').hp,14);
  assert.equal(h.exportLoadout().units.filter(u=>u.id==='nina').length,1);
  assert(M.EntryScreen.prototype.players.call({ui:{game:h}}).some(u=>u.id==='nina'));
  const exp=M.Growth.award(h.getUnit('nina'),M.Growth.required(7));assert.equal(exp.after.level,8);
});

test('第三关读档还原地图、NPC敌我阵营和随机状态，不污染前两关',()=>{
  const g=fresh();execute(g,g.getUnit('nina'));const h=new M.Game();h.restore(g.serialize());
  assert.equal(h.stage,3);assert.equal(h.getUnit('nina').side,'ally');assert.equal(h.getUnit('nina').hp,g.getUnit('nina').hp);
  assert.deepEqual(plain(h.getUnit('nina').inventory),plain(g.getUnit('nina').inventory));
  assert.equal(h.rng.serialize(),g.rng.serialize());h.phase='ally';const z=fresh();z.restore(h.serialize());assert.equal(z.phase,'player');
  const first=new M.Game();h.restore(first.serialize());assert.equal(h.stage,1);assert.equal(h.getUnit('nina'),null);
  assert.throws(()=>fresh().restore({...g.serialize(),mapRevision:99}),/第三关/);
});

test('第二关通关进入第三关，背包、成长、雪月和运输队全部继承',()=>{
  const g=new M.Game({stage:2,recruited:['xueyue'],seed:88}),t=g.getUnit('tomori');
  t.inventory[0].uses=12;M.Growth.award(t,M.Growth.required(t.level));g.phase='victory';g.winner='player';
  const ui=Object.create(M.UI.prototype);Object.assign(ui,{game:g,renderer:{setGame:()=>{}},closeOverlay:()=>{},
    resetSelection:()=>{},updateAll:()=>{},renderIdleInfo:()=>{},setZoom:()=>{},syncMission:()=>{},playChapterIntro:()=>{}});
  ui.startNextStage();assert.equal(ui.game.stage,3);assert.equal(ui.game.getUnit('tomori').level,t.level);
  assert.equal(ui.game.getUnit('tomori').inventory[0].uses,12);assert.equal(ui.game.convoy.length,g.convoy.length);
  assert.equal(ui.game.getUnit('xueyue').side,'player');assert.equal(ui.game.getUnit('nina').side,'ally');
});

(async()=>{
  // Use the actual scheduler; replace only animation/painting and resolve waits immediately.
  const g=fresh(),phases=[],ui=Object.create(M.UI.prototype);
  Object.assign(ui,{game:g,mode:'idle',busy:false,setBusy:v=>{ui.busy=v;},resetSelection:()=>{},updateAll:()=>{},
    showBanner:()=>{},showToast:()=>{},renderIdleInfo:()=>{},renderEnemyPhaseInfo:()=>{},
    runEnemyAction:async u=>{phases.push([g.phase,u.side]);execute(g,u);},handleError:e=>{throw e;}});
  await ui.endTurn();assert.equal(phases[0].join(','),'ally,ally');assert(phases.some(p=>p[0]==='enemy'));
  assert.equal(g.phase,'player');assert.equal(g.turn,2);assert(!ui.busy);
  count++;console.log('✓ 真实UI回合调度依次执行友军→敌军→下一我方阶段');
  const victory=fresh();clear(victory);const end=Object.create(M.UI.prototype);let recruits=0,screens=[];
  Object.assign(end,{game:victory,endShown:false,dom:{overlayCard:{querySelector:()=>null}},
    showNinaRecruitment:async()=>{recruits++;},openOverlay:html=>screens.push(html)});
  await end.showEndScreen();assert.equal(recruits,1);assert(victory.ninaRecruitmentShown);assert(screens[0].includes('井芹仁菜已获救'));
  assert(screens[0].includes('data-end-next'));assert(screens[0].includes('进入第四章'));end.endShown=false;await end.showEndScreen();assert.equal(recruits,1);
  const lost=fresh();lost.applyCombat({defenderId:'nina',hit:true,finalDamage:999});clear(lost);end.game=lost;end.endShown=false;
  await end.showEndScreen();assert.equal(recruits,1);assert(screens.at(-1).includes('不会加入同行之人'));
  count++;console.log('✓ 通关演出只招募生还仁菜，阵亡结算明确标示永久失去招募资格');
  let release,repeated=0;
  const pending=new Promise(resolve=>{release=resolve;});
  const loaded=fresh();clear(loaded);end.game=loaded;end.endShown=false;
  end.showNinaRecruitment=()=>{repeated++;return pending;};
  const initial=end.showEndScreen();
  const entry={ui:end,dom:{root:{}},closeSavePanel:()=>{},closeFormation:()=>{}};
  end.dom.overlayRoot={hidden:false};end.layoutBoard=()=>{};world.document.body={classList:{remove:()=>{}}};
  M.EntryScreen.prototype.hideToGame.call(entry);assert.equal(repeated,1);
  release();await initial;assert(loaded.ninaRecruitmentShown);
  count++;console.log('✓ 从标题页载入待播放招募的通关档不会重复打开招募演出');
  console.log('Third chapter: '+count+' cases passed.');
})().catch(err=>{console.error(err);process.exitCode=1;});
