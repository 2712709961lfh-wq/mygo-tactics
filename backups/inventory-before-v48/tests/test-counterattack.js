'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const sandbox = {console, setTimeout, clearTimeout};
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const file of ['config','rng','grid','pathfinding','combat','game','ui']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',file+'.js'),'utf8'),sandbox,{filename:file+'.js'});
}
const M = sandbox.MyGO, C = M.Combat;
let count = 0;
function test(name,fn) { fn(); count++; console.log('✓ '+name); }
function fixture() {
  const game = new M.Game({seed:123});
  const a = game.getUnit('tomori'), b = game.getUnit('shadow_axe');
  Object.assign(a,{x:7,y:13,hp:100,maxHp:100,spd:8,hit:200,lck:200});
  Object.assign(b,{x:8,y:13,hp:100,maxHp:100,spd:8,hit:200,lck:200});
  game.rng = {int:()=>100,serialize:()=>123};
  return {game,a,b};
}
const kinds = r => Array.from(r.strikes,s=>s.kind).join(',');
test('近战反击：预告无副作用、锁定时不扣双方 HP、确认一次应用整场',()=>{
  const {game,a,b}=fixture(), before=game.serialize();
  const p=game.previewCombat(a,b);
  assert(p.canCounter);assert.equal(p.counter.damage,C.preview(b,a,game.map).damage);
  assert.equal(p.attackCount,1);assert.equal(p.counterCount,1);
  assert.deepEqual(game.serialize(),before);
  const r=game.rollCombat(a,b);assert.equal(kinds(r),'attack,counter');
  assert.equal(a.hp,100);assert.equal(b.hp,100);
  game.applyCombat(r);assert.equal(a.hp,r.attackerHpAfter);assert.equal(b.hp,r.defenderHpAfter);
  assert.equal(a.hp,100-r.counterDamage);assert.equal(b.hp,100-r.finalDamage);
  assert.throws(()=>game.applyCombat(r),/已结算/);
  assert.throws(()=>game.applyCombat(r.strikes[1]),/已结算/);
});
test('反击不消耗防守方行动，未行动与已行动均可反击',()=>{
  for(const acted of [false,true]) {
    const {game,a,b}=fixture();b.acted=acted;
    const r=game.rollCombat(a,b);game.applyCombat(r);
    assert.equal(r.strikes.length,2);assert.equal(b.acted,acted);
  }
});
test('敌方阶段我方反击；已行动状态不阻止反击',()=>{
  const {game,a,b}=fixture();a.acted=true;game.beginEnemyPhase();
  const r=game.rollCombat(b,a);assert.equal(r.strikes[1].attackerId,a.id);
  game.applyCombat(r);assert(b.hp<100 && a.hp<100);assert(a.acted);
});
test('弓远射近战不会被反击；近战贴弓不会被反击',()=>{
  const {game,a,b}=fixture();a.weapon={...a.weapon,type:'bow',range:[2,3]};b.x=9;
  let r=game.rollCombat(a,b);assert.equal(r.forecast.counterReason,'超出武器射程');assert.equal(r.strikes.length,1);
  b.weapon={...b.weapon,type:'bow',range:[2,3]};a.weapon=M.CONFIG.WEAPONS.starblade;b.x=8;
  r=game.rollCombat(a,b);assert.equal(r.strikes.length,1);
});
test('魔法反击按真实射程与魔防计算，并读取主动攻击者地形',()=>{
  const {game,a,b}=fixture();a.weapon={...a.weapon,range:[2,3]};b.x=9;
  b.weapon={...M.CONFIG.WEAPONS.moonwoodStaff};b.mag=13;
  game.map.tiles[a.y][a.x]='mountain';
  const p=game.previewCombat(a,b);assert(p.canCounter);assert(p.counter.magic);
  assert.equal(p.counter.defense,a.res);assert.equal(p.counter.terrainName,game.getTerrain(a.x,a.y).name);
});
test('物理反击享受防守者脚下地形的守备与回避',()=>{
  const {game,a,b}=fixture();game.map.tiles[a.y][a.x]='mountain';
  const p=game.previewCombat(a,b);assert.equal(p.counter.defense,a.def+3);
  game.map.tiles[a.y][a.x]='forest';assert.equal(game.previewCombat(a,b).counter.terrainAvoid,20);
});
test('主动攻击落空仍会反击；反击也可独立落空',()=>{
  const {game,a,b}=fixture();a.hit=-100;
  let r=game.rollCombat(a,b);assert(!r.strikes[0].hit);assert(r.strikes[1].hit);
  a.hit=200;b.hit=-100;r=game.rollCombat(a,b);assert(r.strikes[0].hit);assert(!r.strikes[1].hit);
});
test('反击可以独立暴击',()=>{
  const {game,a,b}=fixture();b.dex=400;a.lck=0;
  const r=game.rollCombat(a,b);assert(r.strikes[1].crit);
  assert.equal(r.strikes[1].finalDamage,r.strikes[1].damage*M.CONFIG.COMBAT.critMultiplier);
});
test('首击击倒时取消反击/追击，不消耗后续随机数',()=>{
  const {game,a,b}=fixture();b.hp=1;a.spd=20;let draws=0;
  game.rng={int:()=>{draws++;return 100;}};
  const r=game.rollCombat(a,b);assert.equal(r.forecast.order.length,3);assert.equal(r.strikes.length,1);assert.equal(draws,2);
  game.applyCombat(r);assert(b.dead);assert.equal(a.hp,100);
});
test('反击击倒主动方，取消其追击且失败判定正确',()=>{
  const {game,a,b}=fixture();a.hp=1;a.spd=12;
  for(const u of game.living('player'))if(u!==a){u.hp=0;u.dead=true;}
  const r=game.rollCombat(a,b);assert.equal(kinds(r),'attack,counter');
  game.applyCombat(r);assert(a.dead);assert(r.attackerKilled);assert.equal(game.phase,'defeat');
});
test('攻速差 3 不追击，差 4 顺序为首击、反击、追击',()=>{
  const {game,a,b}=fixture();a.spd=11;assert.equal(game.previewCombat(a,b).attackCount,1);
  a.spd=12;let r=game.rollCombat(a,b);assert.equal(kinds(r),'attack,counter,followup');assert.equal(r.strikes[2].attackerId,a.id);
  a.spd=8;b.spd=12;r=game.rollCombat(a,b);assert.equal(r.forecast.counterCount,2);assert.equal(r.strikes[2].attackerId,b.id);
});
test('无法反击的高速防守者也不能追击；高速远程主动者仍可追击',()=>{
  const {game,a,b}=fixture();a.weapon={...a.weapon,range:[2,3]};b.x=9;b.spd=30;
  assert.equal(game.rollCombat(a,b).strikes.length,1);
  a.spd=40;assert.equal(kinds(game.rollCombat(a,b)),'attack,followup');
});
test('攻速使用重量、力量取整和装备重量；不能负值或超过速度',()=>{
  const {a}=fixture();a.str=9;a.spd=10;a.weapon={...a.weapon,weight:5};
  assert.equal(C.attackSpeedOf(a),6);a.str=10;assert.equal(C.attackSpeedOf(a),7);
  a.equipmentWeight=3;assert.equal(C.attackSpeedOf(a),4);
  a.str=100;assert.equal(C.attackSpeedOf(a),10);a.str=0;a.weapon.weight=30;assert.equal(C.attackSpeedOf(a),0);
});
test('封锁反击优先于全距离反击；近距离反击仅适用弓',()=>{
  const {game,a,b}=fixture();a.weapon={...a.weapon,range:[2,3]};b.x=9;b.counterAnyRange=true;
  assert(game.previewCombat(a,b).canCounter);a.preventsCounter=true;assert(!game.previewCombat(a,b).canCounter);
  a.preventsCounter=false;b.counterAnyRange=false;a.weapon=M.CONFIG.WEAPONS.starblade;b.x=8;
  b.weapon={...b.weapon,type:'bow',range:[2,3]};b.closeCounter=true;assert(game.previewCombat(a,b).canCounter);
  b.weapon={...b.weapon,type:'tome'};assert(!game.previewCombat(a,b).canCounter);
});
test('钥匙守卫被反击击倒也会开门',()=>{
  const {game,a,b}=fixture();b.key=true;b.hp=1;
  const r=game.rollCombat(b,a);game.applyCombat(r);assert(game.gateOpen);assert(r.gateOpened);
});
test('雪月主动进攻时被反击击倒，正确招募且不会继续追击新同伴',()=>{
  const {game,a}=fixture(),boss=game.getUnit('xueyue');game.openGate();
  Object.assign(boss,{x:8,y:13,hp:1,spd:30,hit:200,lck:200});
  const r=game.rollCombat(boss,a);assert.equal(r.strikes.length,2);assert.equal(boss.side,'enemy');
  game.applyCombat(r);assert.equal(r.recruitedId,'xueyue');assert.equal(boss.side,'player');
  assert.equal(boss.hp,boss.maxHp);assert(boss.acted);assert(!boss.dead);
});
test('保存恢复后双方 HP、行动状态与下一场随机结果一致',()=>{
  const {game,a,b}=fixture();game.rng=new M.RNG(235);
  for(const unit of [a,b])unit.hp=unit.maxHp=M.CONFIG.UNITS.find(u=>u.id===unit.id).maxHp;
  game.applyCombat(game.rollCombat(a,b));const copy=new M.Game();copy.restore(game.serialize());
  assert.equal(copy.getUnit(a.id).hp,a.hp);assert.equal(copy.getUnit(b.id).hp,b.hp);
  // Templates restore base stats, so compare an ordinary untouched pair's roll.
  const x=game.getUnit('rana'),y=game.getUnit('shadow_blade_1');y.x=x.x+1;y.y=x.y;
  const cx=copy.getUnit(x.id),cy=copy.getUnit(y.id);cy.x=cx.x+1;cy.y=cx.y;
  assert.equal(JSON.stringify(game.rollCombat(x,y)),JSON.stringify(copy.rollCombat(cx,cy)));
});

(async()=>{
  // Exercise the actual UI sequence with the actual engine, replacing only paint/modal I/O.
  const {game,a,b}=fixture();a.spd=12;
  const ui=Object.create(M.UI.prototype),scenes=[];
  let confirmation;
  Object.assign(ui,{game,renderer:{flash(){},floatText(){},critBurst(){},shake(){}},updateAll(){},
    showCutin:async(x,y,r)=>{
      assert.equal(a.hp,100);assert.equal(b.hp,100);
      assert.equal(x.hp,r.attackerHp);assert.equal(y.hp,r.defenderHp);
      scenes.push([x.id,y.id,r.kind]);
    },showResultModal:async r=>{
      assert.equal(a.hp,100);assert.equal(b.hp,100);confirmation=r;
    }});
  const applied=await ui.performAttackSequence(a,b,false);
  assert.equal(scenes.map(s=>s[2]).join(','),'attack,counter,followup');
  assert.equal(applied,confirmation);assert.equal(a.hp,applied.attackerHpAfter);assert.equal(b.hp,applied.defenderHpAfter);
  console.log('✓ UI 按实际顺序播放双方动画、传递虚拟 HP、只确认一次后扣血');count++;
  ui.openOverlay=(html)=>{assert(html.includes('交战结算'));assert(html.includes('反击'));assert(html.includes('追击'));
    assert(html.includes('100 → '+applied.attackerHpAfter));assert(html.includes('100 → '+applied.defenderHpAfter));
    ui.confirmHandler();};
  await ui.showRoundResultModal(applied,false);
  console.log('✓ UI 结算面板列出每一击和双方 HP');count++;
  console.log('Counterattack: '+count+' cases passed.');
})().catch(err=>{console.error(err);process.exitCode=1;});
