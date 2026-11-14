'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const w={console,setTimeout,clearTimeout};w.window=w;vm.createContext(w);
for(const name of ['equipment-data','magic-data','inventory','class-data','config','chapter-three','chapter-four','chapter-five','chapter-six','chapter-seven',
 'rng','growth-data','growth','grid','pathfinding','combat','game','ui','renderer'])
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',name+'.js'),'utf8'),w,{filename:name});
const M=w.MyGO;let count=0;
function test(name,fn){fn();count++;console.log('✓ '+name);}
function fixture(){
 const g=new M.Game({seed:57}),e=g.getUnit('shadow_lance'),p=g.getUnit('tomori');
 g.map={cols:12,rows:12,tiles:Array.from({length:12},()=>Array(12).fill('plain')),decor:[]};
 g.units=[e,p];Object.assign(e,{x:4,y:4,move:2,dormant:false});Object.assign(p,{x:1,y:1});
 return {g,e,p};
}
function uiFixture(){
 const f=fixture(),ui=Object.create(M.UI.prototype),renderer=Object.create(M.Renderer.prototype);
 renderer.setView({});Object.assign(ui,{game:f.g,renderer,mode:'idle',busy:false,chapterOpen:false,activeId:null,
  enemyThreatId:null,enemyThreatTiles:new Set(),dom:{contextTitle:{},contextText:{},overlayRoot:{hidden:true},objectiveText:{}},
  updateBoardCursor(){},renderParty(){},renderUnitInfo(){},revealCell(){},showToast(){},
  setActions(a){this.actions=a;},eventToCell:event=>event,renderTerrainInfo(){},updateChrome(){},updateCounts(){},scheduleAutoEndTurn(){},
  moveTiles:new Set(),attackTiles:new Set(),targetIds:new Set(),previewPath:[]});
 return {...f,ui,renderer};
}
test('近战覆盖移动后的攻击格，包含射程边界但不越界，也不改写游戏状态',()=>{
 const {g,e}=fixture(),before=JSON.stringify(g.serialize()),tiles=g.getEnemyThreatTiles(e);
 assert(tiles.has('7,4'));assert(!tiles.has('8,4'));assert(!tiles.has('-1,4'));assert.equal(JSON.stringify(g.serialize()),before);
 e.move=0;const stationary=g.getEnemyThreatTiles(e);assert(stationary.has('5,4'));assert(!stationary.has('6,4'));assert(!stationary.has('4,4'));
});
test('武器最短及最长射程、无法移动的法师按实际攻击圈计算',()=>{
 const {g,e}=fixture();e.move=0;M.Inventory.init(e,{weapon:'iron_bow'});const [min,max]=e.weapon.range,tiles=g.getEnemyThreatTiles(e);
 assert(!tiles.has('5,4'));assert(tiles.has((4+min)+',4'));assert(tiles.has((4+max)+',4'));assert(!tiles.has((5+max)+',4'));
 M.Inventory.init(e,{weapon:'fire',spells:['fire']});assert(g.getEnemyThreatTiles(e).size>0);e.status.silence=1;assert.equal(g.getEnemyThreatTiles(e).size,0);
 e.status.silence=0;e.spellUses.fire=0;assert.equal(g.getEnemyThreatTiles(e).size,0);
});
test('森林消耗、墙体、水面及飞行移动影响覆盖，友方占据格不可作为攻击起点',()=>{
 const {g,e,p}=fixture();e.move=1;assert(g.getEnemyThreatTiles(e).has('6,4'));
 g.map.tiles[4][5]='forest';assert(!g.getEnemyThreatTiles(e).has('6,4'));g.map.tiles[4][5]='plain';
 const ally={...e,id:'blocker',x:5,y:4};g.units.push(ally);assert(!g.getEnemyThreatTiles(e).has('6,4'));
 e.move=2;assert(g.getEnemyThreatTiles(e).has('7,4'));ally.side='player';assert(!g.getEnemyThreatTiles(e).has('7,4'));
 g.units=[e,p];for(const row of g.map.tiles){row[5]='water';row[6]='water';}
 assert(!g.getEnemyThreatTiles(e).has('7,4'));e.tags=['flying'];assert(g.getEnemyThreatTiles(e).has('7,4'));
 g.map.tiles[4][5]='wall';assert(!g.getEnemyThreatTiles(e).has('5,4'));
});
test('无武器、阵亡、离场、友方单位和待传送Boss均不产生覆盖',()=>{
 const {g,e,p}=fixture();assert.equal(g.getEnemyThreatTiles(p).size,0);e.dead=true;assert.equal(g.getEnemyThreatTiles(e).size,0);
 e.dead=false;e.escaped=true;assert.equal(g.getEnemyThreatTiles(e).size,0);e.escaped=false;
 g.maskRetreatPending=true;assert.equal(g.getEnemyThreatTiles(e).size,0);g.maskRetreatPending=false;
 e.inventory.forEach(slot=>slot.uses=0);assert.equal(g.getEnemyThreatTiles(e).size,0);
});
test('第四关只显示可见格，隐蔽单位不会通过覆盖缺口泄漏位置',()=>{
 const {g,e,p}=fixture();g.stage=4;g.isVisible=(x,y)=>x<=6;g.isUnitVisible=M.Game.prototype.isUnitVisible.bind(g);
 const tiles=g.getEnemyThreatTiles(e);assert(tiles.size>0);assert([...tiles].every(k=>Number(k.split(',')[0])<=6));
 const hidden={...e,id:'hidden',x:7,y:4};g.units.push(hidden);
 assert.equal([...g.getEnemyThreatTiles(e)].sort().join('|'),[...tiles].sort().join('|'));
 e.x=8;assert.equal(g.getEnemyThreatTiles(e).size,0);
});
test('真实棋盘点击同一敌人开关，其他敌人切换，查看不消耗行动',()=>{
 const {g,e,p,ui,renderer}=uiFixture(),other={...e,id:'other',x:8,y:8};g.units.push(other);
 ui.onBoardClick(e);assert.equal(ui.enemyThreatId,e.id);assert(renderer.view.enemyThreatTiles.has('7,4'));
 ui.onBoardClick(e);assert.equal(ui.enemyThreatId,null);assert.equal(renderer.view.enemyThreatTiles.size,0);
 ui.onBoardClick(e);ui.onBoardClick(other);assert.equal(ui.enemyThreatId,other.id);assert(!renderer.view.enemyThreatTiles.has('4,4'));assert(!p.acted);
});
test('选择我方和移动菜单保留蓝色范围，攻击模式点击目标仍发起攻击',()=>{
 const {e,p,ui,renderer}=uiFixture();ui.mode='move';ui.activeId=p.id;ui.moveTiles=new Set(['1,1','2,1']);
 ui.onBoardClick(e);assert.equal(ui.mode,'move');assert.equal(ui.activeId,p.id);assert(renderer.view.moveTiles.has('2,1'));assert(renderer.view.enemyThreatTiles.size>0);
 ui.onBoardClick(e);assert.equal(renderer.view.enemyThreatTiles.size,0);assert(renderer.view.moveTiles.has('2,1'));
 ui.mode='action';ui.onBoardClick(e);assert.equal(ui.mode,'action');assert.equal(ui.activeId,p.id);
 ui.mode='attack';ui.targetIds=new Set([e.id]);let attacked;ui.playerAttack=t=>{attacked=t;};ui.onBoardClick(e);assert.equal(attacked,e);assert.equal(ui.mode,'attack');
});
test('敌方阶段、演出或忙碌时点击无效，回合切换／目标死亡／新对局会清除覆盖',()=>{
 for(const mode of ['enemy','busy','chapter']){
  const {g,e,ui}=uiFixture();if(mode==='enemy')g.phase='enemy';if(mode==='busy')ui.busy=true;if(mode==='chapter')ui.chapterOpen=true;
  ui.onBoardClick(e);assert.equal(ui.enemyThreatId,null);
 }
 for(const change of ['enemy','dead','escaped','hidden','newGame']){
  const {g,e,ui,renderer}=uiFixture();ui.onBoardClick(e);
  if(change==='enemy')g.phase='enemy';if(change==='dead')e.dead=true;if(change==='escaped')e.escaped=true;
  if(change==='hidden')g.isUnitVisible=()=>false;if(change==='newGame')ui.game=new M.Game();
  ui.refreshEnemyThreat();assert.equal(ui.enemyThreatId,null,change);assert.equal(renderer.view.enemyThreatTiles.size,0,change);
 }
});
test('位置和装备变化后更新范围，渲染器的默认状态和覆盖状态互相独立',()=>{
 const {e,ui,renderer}=uiFixture();ui.onBoardClick(e);assert(renderer.view.enemyThreatTiles.has('7,4'));
 e.x=7;ui.updateAll();assert(renderer.view.enemyThreatTiles.has('10,4'));e.inventory.forEach(s=>s.uses=0);ui.updateAll();assert.equal(renderer.view.enemyThreatTiles.size,0);
 renderer.setView({mode:'attack',attackTiles:new Set(['2,2'])});assert.equal(renderer.view.enemyThreatTiles.size,0);assert(renderer.view.attackTiles.has('2,2'));
});
console.log('Enemy coverage: '+count+' checks passed.');
