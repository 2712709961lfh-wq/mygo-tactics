"use strict";
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const window = { MyGO: { CONFIG: {} } };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/ui.js'), 'utf8'), { window });
const unit = { id: 'tomori', side: 'player', acted: false, dead: false };
function fixture(mode, moved) {
  const calls = [];
  const ui = Object.create(window.MyGO.UI.prototype);
  Object.assign(ui, { mode, moved, activeId: 'tomori', busy: false, chapterOpen: false,
    dom: { overlayRoot: { hidden: true } },
    game: { getUnit: id => ({ ...unit, id }), isPlayerPhase: () => true, isOver: () => false },
    selectUnit: u => calls.push('select:' + u.id), enterActionMode: () => calls.push('action'),
    resetSelection: () => calls.push('reset'), inspectUnit: () => calls.push('inspect'),
    showToast: () => calls.push('toast') });
  return { ui, calls };
}
let f = fixture('action', true);
f.ui.chooseParty('tomori');
assert.deepEqual(f.calls, [], 'Repeated party clicks must not grant a second movement');
f = fixture('attack', true); f.ui.chooseParty('tomori'); assert.deepEqual(f.calls, []);
f = fixture('move', false); f.ui.chooseParty('tomori'); assert.deepEqual(f.calls, ['action']);
f = fixture('move', false); f.ui.chooseParty('anon'); assert.deepEqual(f.calls, ['reset', 'select:anon']);
f = fixture('action', true); f.ui.chooseParty('anon'); assert.deepEqual(f.calls, ['toast']);
f = fixture('move', false); f.ui.busy = true; f.ui.chooseParty('anon'); assert.deepEqual(f.calls, []);
f = fixture('idle', false); f.ui.activeId = null;
f.ui.game.isPlayerPhase = () => false; f.ui.chooseParty('tomori'); assert.deepEqual(f.calls, ['inspect']);
console.log('UI flow: 7 selection, movement, phase and busy-state assertions passed.');

// Exercise the real action-menu callback against the actual chapter 2 rules.
const rules={console};rules.window=rules;vm.createContext(rules);
for(const name of ['equipment-data','magic-data','inventory','class-data','config','rng','growth-data','growth','grid','pathfinding','combat','game'])
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',name+'.js'),'utf8'),rules);
const game=new rules.MyGO.Game({stage:2}),visitor=game.getUnit('tomori');
let actions,endScreens=0,resets=0;
const actionUI=Object.create(window.MyGO.UI.prototype);
Object.assign(actionUI,{game,activeId:visitor.id,busy:false,
  dom:{contextTitle:{},contextText:{}},renderer:{floatText:()=>{}},
  setActions:list=>{actions=list;},resetSelection:()=>{resets++;},
  updateAll:()=>{},showToast:()=>{},showEndScreen:()=>{endScreens++;}});
actionUI.renderActionSide(visitor);assert(!actions.some(a=>a.label?.startsWith('唤醒星铃')));
for(const b of game.mission.bells.slice(0,2)){
 visitor.acted=false;game.setUnitPosition(visitor.id,b.x,b.y);game.awakenBell(visitor);
}
game.applyCombat({defenderId:'conductor',hit:true,finalDamage:999});
const last=game.mission.bells[2];visitor.acted=false;game.setUnitPosition(visitor.id,last.x,last.y);
actionUI.renderActionSide(visitor);
const ring=actions.find(a=>a.label?.startsWith('唤醒星铃'));
assert(ring);assert(actionUI.dom.contextText.innerHTML.includes('消耗本次行动'));
ring.onClick();assert(visitor.acted);assert.equal(game.phase,'victory');
assert.equal(endScreens,1);assert.equal(resets,1);
console.log('UI bell action: location-sensitive button, action consumption, objective progress and victory overlay passed.');
