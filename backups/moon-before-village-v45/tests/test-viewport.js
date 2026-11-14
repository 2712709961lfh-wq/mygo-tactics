'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/viewport.js'), 'utf8'), context);
const { measure, pointToCell } = context.window.MyGO.Viewport;
const plain = value => JSON.parse(JSON.stringify(value));
assert.equal(measure(1360, 768).scale, 1);
assert.equal(measure(680, 384).scale, 0.5);
assert.equal(measure(384, 680).scale, 0.5);
assert.equal(measure(384, 680).rotated, true);
// A normal map rendered at half scale retains its original 24 × 16 cells.
const normal = { left: 40, top: 20, width: 384, height: 256 };
assert.deepEqual(plain(pointToCell(normal, 112, 108, 24, 16, false)), { x: 4, y: 5 });
assert.equal(pointToCell(normal, 39, 30, 24, 16, false), null);
assert.equal(pointToCell(normal, 424, 30, 24, 16, false), null);
// A clockwise rotated map maps the same cell from its actual screen position.
const rotated = { left: 10, top: 20, width: 256, height: 384 };
assert.deepEqual(plain(pointToCell(rotated, 178, 92, 24, 16, true)), { x: 4, y: 5 });
assert.equal(pointToCell(rotated, 10, 30, 24, 16, true), null);
// Scrolling a zoomed canvas changes its rectangle, not its logical coordinates.
const zoomed = { left: -100, top: -80, width: 1536, height: 1024 };
assert.deepEqual(plain(pointToCell({left:0,top:0,width:1152,height:768},912,112,36,24,false)), {x:28,y:3});
assert.equal(pointToCell({left:0,top:0,width:1152,height:768},1152,112,36,24,false),null);
assert.deepEqual(plain(pointToCell(zoomed, 188, 272, 24, 16, false)), { x: 4, y: 5 });
assert.equal(pointToCell({ width: 0, height: 0 }, 0, 0, 24, 16, false), null);
console.log('Viewport: 13 landscape, rotation, zoom and boundary assertions passed.');
