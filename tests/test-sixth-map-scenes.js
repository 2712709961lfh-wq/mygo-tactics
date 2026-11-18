'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
let now=0,seq=0;const frames=new Map(),listeners=new Set();
const w={console,performance:{now:()=>now},document:{
 addEventListener(type,fn,capture){assert.equal(type,'keydown');assert.equal(capture,true);listeners.add(fn);},
 removeEventListener(type,fn,capture){assert.equal(type,'keydown');assert.equal(capture,true);listeners.delete(fn);}},
 requestAnimationFrame(fn){const id=++seq;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id)};
w.window=w;vm.createContext(w);
for(const name of ['equipment-data','magic-data','inventory','class-data','class-mastery','config','chapter-three','chapter-four','chapter-five','chapter-six',
 'rng','growth-data','growth','grid','pathfinding','combat','game','ui','masked-court-ui'])
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',name+'.js'),'utf8'),w,{filename:name});
const M=w.MyGO;let count=0;
function tick(ms){now+=ms;const pending=[...frames];frames.clear();for(const [,fn] of pending)fn(now);}
function key(value){let handled=0;for(const fn of [...listeners])fn({key:value,preventDefault(){handled++;},stopImmediatePropagation(){handled++;}});return handled;}
function fixture(busy=false){
 assert.equal(frames.size,0);assert.equal(listeners.size,0);now=0;
 const g=new M.Game({stage:6,seed:66}),ui=Object.create(M.UI.prototype),calls={camera:[],render:0,text:[]};
 Object.assign(ui,{game:g,busy,dom:{contextTitle:{},contextText:{},overlayRoot:{hidden:true}},
  setBusy(b){this.busy=b;},setActions(a){this.actions=a;},updateAll(){},resetSelection(){},
  revealCell(x,y){calls.camera.push({x,y});},showToast(){},
  openOverlay(){throw Error('Map scenes must not open an overlay');},closeOverlay(){throw Error('Map scenes must not close unrelated overlays');},
  renderer:{render(){calls.render++;},floatText(...a){calls.text.push(a);}}});
 return {ui,g,boss:g.getUnit('masked_stranger'),calls};
}
function summon(g){g.phase='enemy';g.getUnit('tomori').y=32;const wave=g.summonNearParty();assert(wave);return wave;}
function pending(g){g.applyCombat({attackerId:'soyo',defenderId:'masked_stranger',hit:true,finalDamage:999});assert(g.maskRetreatPending);}
function cleaned(g,boss,wave){assert(!g._courtFx);assert(!('_casting' in boss));assert(!('_teleporting' in boss));assert(!('_escapeAlpha' in boss));
 for(const u of wave?.units||[])assert(!('_summonAlpha' in u));assert.equal(frames.size,0);assert.equal(listeners.size,0);}
async function test(name,fn){await fn();count++;console.log('✓ '+name);}
(async()=>{
 await test('召唤直接使用主地图，先看Boss施法再看队伍周边法阵与援军渐显',async()=>{
  const {ui,g,boss,calls}=fixture(true),wave=summon(g),promise=ui.playCourtScene('summon',wave);
  assert(ui.busy);assert(ui.dom.overlayRoot.hidden);assert.equal(calls.camera[0].x,boss.x);assert.equal(calls.camera[0].y,boss.y);
  assert(wave.units.every(u=>u._summonAlpha===0&&u.acted));assert(boss._casting>0);assert.equal(g._courtFx.kind,'summon');
  tick(700);assert(boss._casting>.5);assert.equal(calls.camera.length,1);assert(wave.units.every(u=>u._summonAlpha===0));
  tick(400);assert.equal(calls.camera.length,2);assert(calls.camera[1].y>boss.y);assert(wave.units.some(u=>u._summonAlpha>0));
  tick(1000);assert(wave.units.every(u=>u._summonAlpha===1));assert.equal(g.phase,'enemy');
  tick(500);await promise;cleaned(g,boss,wave);assert(ui.busy);assert(calls.render>3);assert.equal(g.summonedWaves.length,1);
 });
 await test('召唤允许按Enter、Esc或战场行动按钮跳过且不会重复生成援军',async()=>{
  for(const method of ['Enter','Escape','button']){
   const {ui,g,boss}=fixture(),wave=summon(g),promise=ui.playCourtScene('summon',wave);
   const skip=ui.actions[0].onClick;assert.equal(key('g'),0);assert(ui.busy);
   if(method==='button')skip();else assert.equal(key(method),2);
   skip();await promise;cleaned(g,boss,wave);assert(!ui.busy);assert.equal(g.summonedWaves.length,1);assert(wave.units.every(u=>u.acted));
  }
 });
 await test('传送在王座原地显示台词和身体淡出，结束后空王座且奖励仅发一次',async()=>{
  const {ui,g,boss,calls}=fixture();pending(g);const gold=g.gold,promise=ui.playMaskedEscape();
  assert.equal(ui.playMaskedEscape(),promise);assert(boss._teleporting);assert(ui.busy);assert.equal(g.phase,'player');assert.equal(boss.hp,1);
  tick(1100);assert.equal(ui.dom.contextText.textContent,'“留你们一命。”');assert.equal(calls.text.length,1);
  tick(1000);assert(boss._escapeAlpha>0&&boss._escapeAlpha<1);assert(!g.isOver());assert(!boss.dead);
  tick(1300);await promise;cleaned(g,boss);assert(!ui.busy);assert(boss.escaped);assert(!boss.dead);assert.equal(g.unitAt(boss.x,boss.y),null);
  assert.equal(g.phase,'victory');assert.equal(g.gold,gold+2000);await ui.playMaskedEscape();assert.equal(g.gold,gold+2000);
 });
 await test('待传送存档恢复后可在地图继续或跳过，结局与自然播放一致',async()=>{
  const {ui,g,boss}=fixture(true);pending(g);g.restore(JSON.parse(JSON.stringify(g.serialize())));
  const b=g.getUnit('masked_stranger'),promise=ui.playMaskedEscape();tick(1000);key('Enter');await promise;
  cleaned(g,b);assert(ui.busy);assert(g.maskEscaped);assert.equal(g.phase,'victory');assert.equal(b.hp,1);assert(!b.dead);
 });
 await test('新关卡替换场景时清理旧特效与按键，不更改新关卡状态或奖励',async()=>{
  const {ui,g,boss}=fixture();pending(g);const promise=ui.playMaskedEscape(),next=new M.Game({stage:5,seed:57});
  ui.game=next;ui.busy=false;ui.actions=['new stage'];const gold=next.gold;tick(100);await promise;
  cleaned(g,boss);assert(!ui.busy);assert.equal(ui.actions[0],'new stage');assert.equal(next.gold,gold);assert.equal(next.phase,'player');assert(!g.maskEscaped);
 });
 await test('真实召唤入口等待地图演出完成，结束后仍留在敌方阶段且援军当轮待机',async()=>{
  const {ui,g}=fixture(true);g.phase='enemy';g.getUnit('tomori').y=32;
  const promise=ui.playSixthSummon();assert.equal(g.summonedWaves.length,1);tick(2600);const wave=await promise;
  assert(wave.units.every(u=>u.acted));assert.equal(g.phase,'enemy');assert(ui.busy);cleaned(g,g.getUnit('masked_stranger'),wave);
 });
 console.log('Sixth map scenes: '+count+' checks passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
