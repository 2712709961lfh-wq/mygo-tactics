'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const world = {console,setTimeout,clearTimeout}; world.window = world; vm.createContext(world);
for (const name of ['equipment-data','magic-data','inventory','class-data','config','rng','growth-data','growth','grid','pathfinding','combat','game','ui'])
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src', name + '.js'), 'utf8'), world);
const M = world.MyGO;
let count = 0;
function test(name, fn) { fn(); count++; console.log('✓ ' + name); }
function drop(g, id='tomori') {
  return g.applyCombat({attackerId:id, defenderId:'shadow_bow', hit:true, finalDamage:999});
}
function clear(g) {
  for (const enemy of g.living('enemy')) g.applyCombat({defenderId:enemy.id, hit:true, finalDamage:999});
}

test('非致命与重复结算不发钥匙，只有实际击败者获得', () => {
  const g = new M.Game(), guard = g.getUnit('shadow_bow');
  g.applyCombat({attackerId:'anon', defenderId:guard.id, hit:true, finalDamage:1});
  assert(!g.getUnit('anon').inventory.some(i=>i.id==='courtyard_key'));
  const report = drop(g, 'soyo');
  assert.equal(report.keyRecipientId, 'soyo');
  assert.equal(g.getUnit('soyo').inventory.filter(i=>i.id==='courtyard_key').length, 1);
  assert.throws(()=>g.applyCombat(report), /已结算/);
  drop(g, 'anon');
  assert(!g.getUnit('anon').inventory.some(i=>i.id==='courtyard_key'));
  assert(!g.gateOpen);
});

test('满背包自动存回未装备物品，钥匙留在击败者背包且装备不变', () => {
  const g = new M.Game(), u = g.getUnit('tomori');
  u.inventory.push(...['iron_shield','steel_sword','iron_bow','speed_ring'].map(M.Inventory.make));
  g.equipItem(u, 1);
  const original = u.equippedWeapon, total = g.convoy.length + u.inventory.length;
  const report = drop(g);
  assert.equal(report.storedForKey.id, 'steel_sword');
  assert.equal(u.inventory.length, 5);
  assert.equal(g.convoy.at(-1).id, 'steel_sword');
  assert.equal(g.convoy.length + u.inventory.length, total + 1);
  assert.equal(u.equippedWeapon, original); assert.equal(u.equippedAccessory, 'iron_shield');
  const restored = new M.Game(); restored.restore(g.serialize());
  assert.equal(restored.getUnit(u.id).inventory.length, 5);
  assert(restored.getUnit(u.id).inventory.some(i=>i.id==='courtyard_key'));
});

test('钥匙只可在对应门正交相邻格由未行动持有者使用，成功后只消耗一次', () => {
  const g = new M.Game(), u = g.getUnit('tomori'), other = g.getUnit('anon'); drop(g);
  assert(!g.useGateKey(u));
  g.setUnitPosition(other.id, 28, 12); assert(!g.useGateKey(other));
  g.setUnitPosition(other.id, 26, 12); g.setUnitPosition(u.id, 28, 12);
  u.acted = true; assert(!g.useGateKey(u)); u.acted = false;
  g.phase = 'enemy'; assert(!g.useGateKey(u)); g.phase = 'player';
  assert(g.useGateKey(u)); assert(g.gateOpen); assert(u.acted);
  assert(!u.inventory.some(i=>i.id==='courtyard_key')); assert(!g.useGateKey(u));
  assert(g.isUnitActive(g.getUnit('xueyue')));
  const restored = new M.Game(); restored.restore(g.serialize());
  assert(restored.gateOpen); assert(!restored.getUnit(u.id).inventory.some(i=>i.id==='courtyard_key'));
});

test('钥匙可经运输队转交，不能装备且存档拒绝失效钥匙', () => {
  const g = new M.Game(), u = g.getUnit('tomori'), v = g.getUnit('anon'); drop(g);
  assert.throws(()=>g.equipItem(u, u.inventory.length - 1), /门旁/);
  g.transferItem(u, u.inventory.length - 1, true);
  const saved = g.serialize(), h = new M.Game(); h.restore(saved);
  h.transferItem(h.getUnit(v.id), h.convoy.findIndex(i=>i.id==='courtyard_key'), false);
  h.setUnitPosition(v.id, 28, 12); assert(h.useGateKey(h.getUnit(v.id)));
  saved.convoy.find(i=>i.id==='courtyard_key').uses = 0;
  assert.throws(()=>new M.Game().restore(saved), /耐久/);
});

test('先击败雪月再击败其他敌人，直到全关通关才解锁招募', () => {
  const g = new M.Game();
  g.applyCombat({defenderId:'xueyue', hit:true, finalDamage:999});
  assert.equal(g.recruited.length, 0); assert.equal(g.livingCount('player'), 5);
  const restored = new M.Game(); restored.restore(g.serialize());
  assert(restored.getUnit('xueyue').dead); assert.equal(restored.recruited.length, 0);
  clear(restored); assert.equal(restored.phase, 'victory'); assert.equal(restored.recruited[0], 'xueyue');
  assert.equal(restored.livingCount('player'), 5);
  const second = new M.Game({stage:2, recruited:restored.recruited, loadout:restored.exportLoadout()});
  const snow = second.getUnit('xueyue');
  assert.equal(snow.side, 'player'); assert.equal(snow.hp, snow.maxHp); assert(!snow.dead && !snow.acted);
});

test('旧版已招募中途存档改为已击败退场，通关旧档仍解锁第二关', () => {
  const g = new M.Game(), saved = g.serialize();
  delete saved.recruitmentVersion; delete saved.recruitmentShown;
  saved.recruited = ['xueyue'];
  const old = saved.units.find(u=>u.id==='xueyue'); old.hp = 19; old.dead = false;
  const restored = new M.Game(); restored.restore(saved);
  assert(restored.getUnit('xueyue').dead); assert.equal(restored.recruited.length, 0);
  saved.phase = 'victory'; saved.winner = 'player';
  for (const entry of saved.units) if (g.getUnit(entry.id).side === 'enemy') {entry.hp = 0; entry.dead = true;}
  restored.restore(saved); assert.equal(restored.recruited[0], 'xueyue'); assert(!restored.recruitmentShown);
});

(async () => {
  const g = new M.Game(), u = g.getUnit('tomori'); drop(g);
  const calls = [], ui = Object.create(M.UI.prototype);
  Object.assign(ui, {game:g, busy:false, activeId:u.id, mode:'move',
    dom:{overlayCard:{querySelector:()=>null}},
    renderer:{visuals:new Map(), animateMove:async()=>{}, snapUnit:()=>{}, floatText:()=>{}, shake:()=>{}},
    setView:()=>{}, setBusy:value=>{ui.busy=value;}, enterActionMode:()=>{ui.mode='action';},
    resetSelection:()=>calls.push('reset'), updateAll:()=>{}, showToast:()=>{},
    openOverlay:html=>{ui.overlayHTML=html;},
    reachable:new Map([['28,13',{x:28,y:13,cost:0,prev:null,stoppable:true}],['28,12',{x:28,y:12,cost:1,prev:'28,13',stoppable:true}]])});
  await ui.moveActiveTo(28, 12);
  assert(ui.overlayHTML.includes('使用内庭钥匙开门')); assert(!g.gateOpen);
  // Cancelling the real modal clears the handler without changing the game.
  ui.dom.overlayRoot = {}; ui.dom.overlayCard = {};
  world.document = {body:{classList:{remove:()=>{}}}};
  ui.closeOverlay(); assert.equal(ui.confirmHandler, null); assert(!g.gateOpen); assert(!u.acted);
  ui.showGateKeyPrompt(u); ui.confirmHandler(); assert(g.gateOpen && u.acted); assert.equal(calls.length, 1);
  count++; console.log('✓ 移动到门旁自动弹窗，取消不消耗钥匙，重开确认后开门并结束行动');

  const pickup = Object.create(M.UI.prototype), notices = [];
  Object.assign(pickup, {game:g, activeId:u.id, busy:false, targetIds:new Set(['shadow_bow']),
    setBusy:value=>{pickup.busy=value;}, resetSelection:()=>{}, updateAll:()=>{},
    showToast:message=>notices.push(message),
    performAttackSequence:async()=>{
      pickup.showToast('内庭钥匙已放入背包，未装备物品已送回运输队。');
      return {keyRecipientId:u.id, strikes:[], finalDamage:99, counterDamage:0};
    }});
  for (const ally of g.living('player')) ally.acted=true;
  await pickup.playerAttack(g.getUnit('shadow_bow'));
  assert.equal(notices.length, 1); assert(notices[0].includes('运输队'));
  count++; console.log('✓ 钥匙掉落与满背包提示不会被普通战报或全员行动提示立即覆盖');

  const cleared = new M.Game(); clear(cleared);
  const end = Object.create(M.UI.prototype); let resolveRecruit, recruitCalls = 0, endCalls = 0;
  Object.assign(end, {game:cleared, endShown:false, dom:{overlayCard:{querySelector:()=>null}},
    showRecruitment:()=>{recruitCalls++; return new Promise(resolve=>{resolveRecruit=resolve;});},
    openOverlay:()=>{endCalls++;}});
  const showing = end.showEndScreen(); assert.equal(recruitCalls, 1); assert.equal(endCalls, 0);
  await end.showEndScreen(); assert.equal(recruitCalls, 1);
  resolveRecruit(); await showing; assert.equal(endCalls, 1); assert(cleared.recruitmentShown);
  const restored = new M.Game(); restored.restore(cleared.serialize());
  assert(restored.recruitmentShown); end.game = restored; end.endShown = false;
  await end.showEndScreen(); assert.equal(recruitCalls, 1); assert.equal(endCalls, 2);
  count++; console.log('✓ 第一关通关先播放招募再显示结算，避免重复播放，已观看状态随存档恢复');
  console.log('Chapter progression: ' + count + ' cases passed.');
})().catch(error=>{console.error(error); process.exitCode=1;});
