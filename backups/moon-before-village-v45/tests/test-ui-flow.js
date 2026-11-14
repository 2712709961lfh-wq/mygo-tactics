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
