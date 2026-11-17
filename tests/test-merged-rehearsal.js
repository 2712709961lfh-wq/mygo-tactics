'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const timers=[],w={console,document:{readyState:'loading'},performance:{now:()=>100},addEventListener(){},setTimeout(fn){timers.push(fn);return timers.length;},clearTimeout(){}};
w.window=w;vm.createContext(w);
for(const f of ['equipment-data','magic-data','inventory','class-data','config','chapter-three','chapter-four','chapter-five','chapter-six','chapter-seven','chapter-eight','chapter-nine','chapter-ten','chapter-palace','rng','growth-data','talents','growth','grid','pathfinding','combat','game','ui','entry','ninth-intro'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',f+'.js'),'utf8'),w,{filename:f});
const M=w.MyGO,plain=x=>JSON.parse(JSON.stringify(x)),fresh=()=>new M.Game({stage:9,recruited:['xueyue','nina'],seed:1116});
const reload=s=>{const h=new M.Game();h.restore(plain(s));return h;};
const hit=(g,id)=>g.applyCombat({attackerId:'tomori',defenderId:id,hit:true,finalDamage:999});
function ready(g){g.completeNinthIntro();hit(g,'rift_pegasus');const u=g.getUnit('tomori');Object.assign(u,{x:13,y:3,acted:false});return u;}
function finale(g){const u=ready(g);g.useGateKey(u);assert(g.beginRehearsalFinale());return g;}
function clear(g){g.completeTenthIntro();for(const u of g.living('enemy'))hit(g,u.id);}
function uiFixture(g){
 const ui=Object.create(M.UI.prototype);Object.assign(ui,{game:g,busy:false,mode:'idle',chapterPlayed:true,endShown:false,
  renderer:{setGame(){},floatText(){},shake(){}},dom:{contextTitle:{},contextText:{},objectiveText:{},overlayCard:{querySelector(){return null;}}},
  resetSelection(){},syncMission(){},updateAll(){},renderIdleInfo(){},setZoom(){},revealCell(){},renderTerrainInfo(){},
  setActions(){},showToast(){},showBanner(){},closeOverlay(){},openOverlay(html){this.html=html;},
  playChapterIntro(){this.intros=(this.intros||0)+1;},showEndScreen(){this.ends=(this.ends||0)+1;}});return ui;
}
let cases=0;function test(name,f){f();cases++;console.log('✓ '+name);}
test('Door triggers automatic in-chapter continuation, no clear screen, reward or extra chapter entry',()=>{
 const g=fresh(),u=ready(g),ui=uiFixture(g),gold=g.gold;timers.length=0;
 ui.openNinthDoor(u);assert(ui.busy);assert(g.rehearsalTransitionPending);assert(!g.isPlayerPhase());assert(!g.beginEnemyPhase());
 assert.equal(g.phase,'player');assert.equal(g.gold,gold);assert(!ui.ends);assert.equal(timers.length,1);
 timers.shift()();assert.equal(g.chapterNumber,9);assert.equal(g.serialize().rehearsalPart,2);assert.equal(ui.intros,1);assert(!ui.ends);assert(!ui.busy);
 assert.equal(g.gold,gold);assert(!g.beginRehearsalFinale());assert.equal(g.mission.chapter,'MISSION 09');
 const index=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 assert.equal((index.match(/data-entry-action="chapter9"/g)||[]).length,1);assert(!index.includes('第十重 · 回环休息室'));assert.equal((index.match(/data-entry-action="chapter10"/g)||[]).length,1);
});
test('Same game and map retain wounds, deaths, status, charges, durability, growth, turns and shop stock',()=>{
 const g=fresh(),actor=ready(g),map=g.map,n=g.getUnit('nina'),s=g.getUnit('soyo'),dead=g.getUnit('anon');
 g.turn=7;g.gold=12345;g.shopPurchases={intermediate_seal:1};
 M.Growth.award(n,M.Growth.required(n.level));n.hp-=7;n.exp=11;n.status={frostSpeedDown:1};
 n.inventory[0].uses-=2;s.spellUses.fire=1;Object.assign(dead,{dead:true,hp:0,acted:true});
 const records=Object.fromEntries(g.units.filter(u=>u.side==='player').map(u=>[u.id,plain({growth:M.Growth.pack(u),inventory:M.Inventory.pack(u),hp:u.hp,dead:u.dead})]));
 g.useGateKey(actor);const afterKey=M.Inventory.pack(actor);records[actor.id].inventory=plain(afterKey);
 assert(g.beginRehearsalFinale());assert.equal(g.map,map);assert.equal(g.turn,7);assert.equal(g.gold,12345);assert.equal(g.shopChapter,9);
 assert.equal(g.shopPurchases.intermediate_seal,1);assert.equal(g.getUnit('nina'),n);assert.equal(g.getUnit('soyo'),s);
 for(const [id,record]of Object.entries(records)){
  const u=g.getUnit(id);assert.deepEqual(plain({growth:M.Growth.pack(u),inventory:M.Inventory.pack(u),hp:u.hp,dead:u.dead}),record,id);
 }
 assert.equal(g.map.tiles[2][13],'gateOpen');assert.equal(g.livingCount('enemy'),15);assert.equal(g.getUnit('subaru').side,'ally');
 assert(!g.getUnit('rift_pegasus'));assert(g.getUnit('dark_nina'));assert.equal(g.rehearsalFirstDefeated,1);
 g.completeTenthIntro();assert.equal(g.getUnit('subaru').side,'player');assert(g.getUnit('anon').dead);assert.equal(g.units.filter(u=>u.id==='subaru').length,1);
 const h=reload(g.serialize());assert(h.getUnit('anon').dead);assert.equal(h.getUnit('soyo').spellUses.fire,1);assert.equal(h.shopPurchases.intermediate_seal,1);
});
test('Only final full clear pays one chapter-nine reward, then offers the new palace chapter',()=>{
 const g=finale(fresh()),gold=g.gold;g.completeTenthIntro();hit(g,'dark_nina');assert.equal(g.phase,'player');assert.equal(g.gold,gold);
 for(const e of g.living('enemy'))hit(g,e.id);assert.equal(g.phase,'victory');assert.equal(g.gold,gold+2000);
 assert.deepEqual(plain(g.rewardedChapters),[9]);g.checkOutcome();assert.equal(g.gold,gold+2000);
 const h=reload(g.serialize());assert.equal(h.gold,g.gold);assert.equal(h.chapterNumber,9);
 const ui=uiFixture(h);M.UI.prototype.showEndScreen.call(ui);assert(ui.html.includes('data-end-next'));assert(ui.html.includes('MISSION 09'));assert(ui.html.includes('第九关完成'));
 ui.startNextStage();assert.equal(ui.game.stage,11);assert.equal(ui.game.chapterNumber,10);assert.equal(ui.game.gold,h.gold);assert.equal(ui.game.getUnit('subaru').side,'player');
});
test('Both parts serialize as chapter nine; pending door saves resume final intro and stable round trips',()=>{
 const g=fresh();assert.equal(g.serialize().stage,9);assert.equal(g.serialize().rehearsalPart,1);
 assert.deepEqual(plain(reload(g.serialize()).serialize()),plain(g.serialize()));
 g.useGateKey(ready(g));const input=plain(g.serialize()),h=reload(input);assert.deepEqual(plain(g.serialize()),input);
 assert.equal(h.serialize().stage,9);assert.equal(h.serialize().rehearsalPart,2);assert(!h.stageTenIntroSeen);
 assert.equal(h.map.tiles[2][13],'gateOpen');assert(h.getUnit('subaru'));assert(!h.subaruJoined);
 h.completeTenthIntro();const s=h.getUnit('subaru');M.Growth.award(s,M.Growth.required(s.level));s.hp-=3;s.exp=15;
 const save=plain(h.serialize());for(let n=0;n<3;n++)assert.deepEqual(plain(reload(save).serialize()),save);
});
test('Save panel displays the correct merged part and counts Subaru in the party',()=>{
 for(const part of [1,2]){
  const g=part===1?fresh():finale(fresh());if(part===2)g.completeTenthIntro();
  const ctx={ui:{game:g,busy:false,mode:'idle',saveManager:{storageType:'memory'}},
   getSaveInfo:()=>({ok:true,loaded:{snapshot:plain(g.serialize()),savedAt:'2026-11-16T04:00:00.000Z'}}),
   dom:{saveInfo:{},saveLoad:{},saveDelete:{},saveCurrent:{},saveStatus:{}}};
  M.EntryScreen.prototype.refreshSavePanel.call(ctx);const html=ctx.dom.saveInfo.innerHTML;
  assert(html.includes('MISSION 09'));assert(html.includes(part===1?'前半段':'后半段'));
  assert(html.includes('我方 '+(part===1?8:9)+' / 敌方 '+(part===1?12:15)),html);assert(!html.includes('MISSION 10'));
 }
});
test('Old chapter-nine clear saves resume finale without duplicate gold; old chapter-ten saves retain progress',()=>{
 const g=fresh();g.useGateKey(ready(g));const old=plain(g.serialize());
 delete old.rehearsalChapterVersion;delete old.rehearsalPart;delete old.rehearsalFirstDefeated;
 old.phase='victory';old.winner='player';old.economy.gold+=2000;old.economy.rewarded=[9];
 const h=reload(old),gold=h.gold;assert.equal(h.serialize().rehearsalPart,2);assert.equal(h.phase,'player');clear(h);assert.equal(h.gold,gold);
 for(const complete of [false,true]){
  const g=finale(fresh());g.completeTenthIntro();g.getUnit('subaru').hp-=4;g.getUnit('loop-armor-0').hp=8;
  if(complete)clear(g);
  const old=plain(g.serialize());old.stage=10;delete old.rehearsalChapterVersion;delete old.rehearsalPart;delete old.rehearsalFirstDefeated;
  old.economy.chapter=10;old.economy.purchases={intermediate_seal:1};old.economy.rewarded=complete?[9,10]:[9];old.economy.gold=7654;
  const h=reload(old);assert.equal(h.gold,7654);assert.equal(h.serialize().stage,9);assert.equal(h.serialize().rehearsalPart,2);
  assert.equal(h.getUnit('subaru').hp,g.getUnit('subaru').hp);assert.equal(h.getUnit('loop-armor-0').hp,g.getUnit('loop-armor-0').hp);
  assert.equal(h.shopChapter,9);assert.equal(h.shopPurchases.intermediate_seal,1);assert.deepEqual(plain(h.rewardedChapters),[9]);
  if(!complete)clear(h);assert.equal(h.gold,7654);assert.equal(h.phase,'victory');
 }
});
test('Restarting either merged part begins chapter nine; explicit chapter ten now opens the palace',()=>{
 const g=finale(fresh()),ui=uiFixture(g);timers.length=0;ui.newGame(777);assert.equal(ui.game.stage,9);assert.equal(ui.game.serialize().rehearsalPart,1);
 assert(!ui.game.getUnit('subaru'));ui.newGame(778,10);assert.equal(ui.game.stage,11);assert.equal(ui.game.chapterNumber,10);
 const main=fs.readFileSync(path.join(__dirname,'../src/main.js'),'utf8');assert(main.includes('[10,11].includes(stageParam)?11:'));
});
test('Nina lost stays lost, withdrawn allies remain withdrawn, and premature finale cannot start',()=>{
 const g=new M.Game({stage:9,recruited:['xueyue'],ninaLost:true});assert(!g.beginRehearsalFinale());finale(g);
 assert(!g.getUnit('nina'));assert(g.getUnit('dark_nina'));g.completeTenthIntro();assert(!reload(g.serialize()).getUnit('nina'));
 const h=fresh();ready(h);h.openGate();for(const u of h.living('player')){u.hp=0;u.dead=true;}
 assert(!h.beginRehearsalFinale());h.checkOutcome();assert.equal(h.phase,'defeat');
});
test('Merged metadata rejects corrupt parts, versions and kill histories',()=>{
 for(const mutate of [s=>s.rehearsalPart=0,s=>s.rehearsalPart=3,s=>s.rehearsalPart='2',s=>s.rehearsalChapterVersion=2,s=>s.rehearsalFirstDefeated=-1,s=>s.rehearsalFirstDefeated=13,s=>s.rehearsalFirstDefeated=1,s=>delete s.rehearsalChapterVersion]){
  const s=plain(fresh().serialize());mutate(s);assert.throws(()=>reload(s),/合并进度/);
 }
});
console.log('Merged rehearsal: '+cases+' scenarios passed.');
