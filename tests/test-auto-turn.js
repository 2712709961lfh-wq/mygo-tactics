'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
let clock=0,nextId=0,count=0;
const timers=new Map(),classes={add(){},remove(){}};
const node=()=>({hidden:true,classList:classes,querySelector(){return node();},querySelectorAll(){return [];},appendChild(){},addEventListener(){}});
const world={console,document:{readyState:'loading',body:{classList:classes},createElement:node},addEventListener(){},
 setTimeout(fn,ms=0){const id=++nextId;timers.set(id,{fn,at:clock+ms});return id;},clearTimeout:id=>timers.delete(id)};
world.window=world;vm.createContext(world);
for(const name of ['equipment-data','magic-data','inventory','class-data','class-mastery','config','chapter-three','chapter-four','chapter-five',
 'rng','growth-data','growth','grid','pathfinding','combat','game','ai','ui','entry','loadout-ui','shop-ui'])
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',name+'.js'),'utf8'),world,{filename:name});
const M=world.MyGO;
async function advance(ms){const end=clock+ms;for(let n=0;n<1000;n++){
 await new Promise(setImmediate);
 const due=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];
 if(!due){clock=end;return;}clock=due[1].at;timers.delete(due[0]);due[1].fn();
 }throw Error('timer loop');}
function fixture(stage=1){
 timers.clear();clock=0;delete M.entry;
 const g=new M.Game({stage,seed:57}),ui=Object.create(M.UI.prototype);
 Object.assign(ui,{game:g,busy:false,mode:'idle',chapterOpen:false,endShown:false,chapterPlayed:true,chapterTimers:[],
  dom:{overlayRoot:node(),overlayCard:node(),chapterIntro:node(),contextTitle:{},contextText:{},objectiveText:{},actionButtons:node()},
  updateChrome(){},updateCounts(){},resetSelection(){this.mode='idle';this.activeId=null;},renderIdleInfo(){},renderEnemyPhaseInfo(){},
  showToast(){},showBanner(){},layoutBoard(){},syncMission(){},showEndScreen(){this.endShown=true;},
  renderer:{floatText(){},snapUnit(){},shake(){},terrainLayer:null},
  setActions(actions){this.actions=actions;},showGrowthResults:async()=>{},
  endTurn(){this.ends=(this.ends||0)+1;this.game.beginEnemyPhase();}});
 for(const u of g.living('player'))u.acted=true;
 const last=g.getUnit('soyo');last.acted=false;ui.activeId=last.id;
 return {g,ui,last};
}
async function test(name,fn){await fn();count++;console.log('✓ '+name);}
function action(ui,u,label){ui.renderActionSide(u);const a=ui.actions.find(a=>(a.label||'').includes(label));assert(a,label);a.onClick();}
function terrainCell(g,id){for(let y=0;y<g.map.rows;y++)for(let x=0;x<g.map.cols;x++)if(g.getTerrain(x,y).id===id)return {x,y};throw Error(id);}
(async()=>{
 await test('全员完成才自动切换，阵亡单位不计入，重复刷新不重复切换',async()=>{
  const {g,ui,last}=fixture();ui.updateAll();await advance(500);assert(!ui.ends);
  const dead=g.getUnit('anon');dead.dead=true;dead.hp=0;dead.acted=false;
  ui.mode='action';ui.waitActiveUnit();ui.updateAll();ui.updateAll();await advance(349);assert(!ui.ends);
  await advance(1);assert.equal(ui.ends,1);assert.equal(g.phase,'enemy');ui.updateAll();await advance(1000);assert.equal(ui.ends,1);
 });
 await test('单纯移动或取消选择不结束行动，最后攻击结算后自动切换',async()=>{
  const {g,ui,last}=fixture();ui.mode='action';ui.updateAll();await advance(500);assert(!ui.ends);assert(!last.acted);
  ui.resetSelection();ui.updateAll();await advance(500);assert(!ui.ends);
  ui.activeId=last.id;ui.targetIds=new Set(['shadow_bow']);
  let resolveAttack;ui.performAttackSequence=()=>new Promise(resolve=>{resolveAttack=resolve;});
  const attacking=ui.playerAttack(g.getUnit('shadow_bow'));await advance(500);assert(!ui.ends);
  resolveAttack({strikes:[],drops:[{id:'chest_key'}]});await attacking;await advance(350);assert.equal(ui.ends,1);
 });
 await test('开箱、点灯、星铃、共鸣与钥匙开门均覆盖自动切换',async()=>{
  for(const kind of ['chest','lamp','bell','resonance','gate']){
   const {g,ui,last}=fixture({chest:5,lamp:4,bell:2,resonance:1,gate:1}[kind]);ui.mode='action';
   if(kind==='chest'){Object.assign(last,{x:8,y:3});last.inventory.push(M.Inventory.make('chest_key'));action(ui,last,'开箱');}
   if(kind==='lamp'){const l=g.mission.lamps[0];Object.assign(last,{x:l.x-1,y:l.y});action(ui,last,'点亮路灯');}
   if(kind==='bell'){Object.assign(last,g.mission.bells[0]);action(ui,last,'唤醒星铃');}
   if(kind==='resonance'){const t=g.getUnit('tomori');last.acted=true;t.acted=false;Object.assign(t,terrainCell(g,'resonance'));action(ui,t,'唤醒共鸣');}
   if(kind==='gate'){const gate=terrainCell(g,'gate');Object.assign(last,{x:gate.x-1,y:gate.y});last.inventory.push(M.Inventory.make('courtyard_key'));
    ui.showGateKeyPrompt(last);const confirm=ui.confirmHandler;ui.closeOverlay();confirm();}
   assert(g.allPlayerActed(),kind);await advance(350);assert.equal(ui.ends,1,kind);
  }
 });
 await test('药品与辅助魔法确认后切换，升级弹窗结束前保持我方阶段',async()=>{
  let f=fixture();f.last.hp--;f.last.inventory.push(M.Inventory.make('vulnerary'));
  const buttons=[{dataset:{battleMedicine:String(f.last.inventory.length-1)}}];f.ui.dom.overlayCard.querySelectorAll=()=>buttons;
  f.ui.showMedicine(f.last);buttons[0].onclick();await advance(350);assert.equal(f.ui.ends,1);
  f=fixture();const target=f.g.getUnit('tomori');target.hp--;target.x=f.last.x+1;target.y=f.last.y;
  const confirm={};f.ui.dom.overlayCard.querySelector=()=>confirm;
  let finishGrowth;f.ui.showGrowthResults=()=>new Promise(resolve=>{finishGrowth=resolve;});
  f.ui.confirmSupport(f.last,'heal',target);const casting=confirm.onclick();await advance(500);assert(!f.ui.ends);
  finishGrowth();await casting;await advance(350);assert.equal(f.ui.ends,1);
 });
 await test('战斗／升级弹窗、忙碌、章节演出与标题编队期间不切换，返回后继续',async()=>{
  for(const block of ['busy','overlay','chapter','entry']){
   const {g,ui,last}=fixture();last.acted=true;
   if(block==='busy')ui.busy=true;
   if(block==='overlay')ui.dom.overlayRoot.hidden=false;
   if(block==='chapter'){ui.chapterOpen=true;ui.dom.chapterIntro.hidden=false;}
   if(block==='entry')M.entry={ui,dom:{root:{hidden:false}}};
   ui.updateAll();await advance(500);assert(!ui.ends,block);assert.equal(g.phase,'player');
   if(block==='busy')ui.setBusy(false);
   if(block==='overlay')ui.closeOverlay();
   if(block==='chapter'){ui.finishChapterIntro();await advance(720);}
   if(block==='entry'){M.entry.dom.root.hidden=true;ui.playChapterIntro();}
   await advance(350);assert.equal(ui.ends,1,block);
  }
 });
 await test('胜负优先，重开、读档或手动结束后不会触发旧的自动切换',async()=>{
  for(const change of ['victory','defeat','game','turn','manual','restore']){
   const {g,ui,last}=fixture();last.acted=true;ui.updateAll();
   if(['victory','defeat'].includes(change))g.phase=change;
   if(change==='game')ui.game=new M.Game();
   if(change==='turn')g.turn++;
   if(change==='manual')ui.endTurn();
   if(change==='restore'){const s=g.serialize();s.units.find(u=>u.id===last.id).acted=false;g.restore(s);ui.updateAll();}
   await advance(500);assert.equal(ui.ends||0,change==='manual'?1:0,change);
  }
 });
 await test('编队中最后一人转职，保留编队阅读并在真正返回战场后自动切换',async()=>{
  const {g,ui,last}=fixture();last.certifiedClasses.push('fighter');
  const entry=Object.create(M.EntryScreen.prototype);
  Object.assign(entry,{ui,hasStarted:true,dom:{root:node()},closeSavePanel(){},closeFormation(){}});
  entry.dom.root.hidden=false;M.entry=entry;
  g.reclassUnit(last,'fighter');ui.updateAll();await advance(500);assert(!ui.ends);assert.equal(g.phase,'player');
  entry.hideToGame();await advance(350);assert.equal(ui.ends,1);assert.equal(g.phase,'enemy');
 });
 await test('全员已行动的存档返回战场后自动继续，无存活我方或仅友军不会触发',async()=>{
  let {g,ui,last}=fixture();last.acted=true;g.restore(g.serialize());ui.playChapterIntro();await advance(350);assert.equal(ui.ends,1);
  ({g,ui}=fixture(3));for(const u of g.living('player')){u.dead=true;u.hp=0;}ui.updateAll();await advance(500);assert(!ui.ends);
 });
 await test('真实回合流程只运行一次，第三关先友军后敌军并重置下一回合行动',async()=>{
  const {g,ui,last}=fixture(3),order=[];last.acted=true;
  for(const e of g.living('enemy')){e.alerted=true;e.dormant=false;}
  ui.runEnemyAction=async u=>{order.push(u.side);u.acted=true;};
  ui.endTurn=function(){this.ends=(this.ends||0)+1;return M.UI.prototype.endTurn.call(this);};
  ui.updateAll();await advance(15000);assert.equal(ui.ends,1);assert.equal(order[0],'ally');assert(order.slice(1).every(s=>s==='enemy'));assert(order.includes('enemy'));
  assert.equal(g.turn,2);assert.equal(g.phase,'player');assert(g.living('player').every(u=>!u.acted));assert(!ui.busy);
 });
 console.log('Automatic turn: '+count+' cases passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
