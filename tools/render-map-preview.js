/* Optional offline preview export using @napi-rs/canvas from the workspace runtime.
 * It runs the actual game renderer, without a browser, network or saved-game data.
 * NODE_PATH=<runtime node_modules> node tools/render-map-preview.js */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('node:assert/strict');
const {createCanvas, Image} = require('@napi-rs/canvas');
const root = path.resolve(__dirname,'..');
class LocalImage extends Image {
  set src(value) { super.src = value.startsWith('data:') ? value : fs.readFileSync(path.join(root,value.split('?')[0])); }
}
const sandbox = {
  console, Date, Math, Map, Set, Image: LocalImage, performance:{now:()=>0},
  requestAnimationFrame:()=>0, cancelAnimationFrame:()=>{},
  document:{createElement:tag=>{
    if(tag!=='canvas') throw new Error('Unsupported element '+tag);
    return createCanvas(1,1);
  }}
};
sandbox.window=sandbox;
vm.createContext(sandbox);
for(const name of ['equipment-data','magic-data','inventory','config','map-projection','rng','grid','pathfinding','combat','game','assets','garden-map','moon-map','characters','renderer']) {
  vm.runInContext(fs.readFileSync(path.join(root,'src',name+'.js'),'utf8'),sandbox,{filename:name+'.js'});
}
(async()=>{
  const M=sandbox.MyGO;
  await Promise.all([M.GardenMap.load(),M.MoonMap.load(),M.Characters.load()]);
  const game=new M.Game({seed:101});
  const canvas=createCanvas(1,1), renderer=new M.Renderer(canvas,game);
  const out=path.join(root,'docs','previews');fs.mkdirSync(out,{recursive:true});
  renderer.render(0);fs.writeFileSync(path.join(out,'chapter-01-deployment.png'),canvas.toBuffer('image/png'));
  // A raised sprite's head must select its own cell, not the cell behind it.
  const tomori=game.getUnit('tomori'),T=M.CONFIG.TILE;
  const head=renderer.pickProjectedUnit((tomori.x+.5)*T,(tomori.y+1)*T-48);
  assert.equal(head.x,tomori.x);assert.equal(head.y,tomori.y);
  const scene=M.GardenMap.makeObjects(game.map,renderer.projection);
  assert.ok(scene.some(o=>o.kind==='tower')&&scene.some(o=>o.kind==='rail'));
  for(const o of scene){
    assert.ok(Number.isFinite(o.depth)&&Number.isFinite(o.p.x));
    if(o.kind==='wall')assert.equal(game.map.tiles[o.y][o.x],'wall');
    if(o.kind==='tree')assert.equal(game.map.tiles[o.y][o.x],'forest');
    if(o.kind==='rail')assert.equal(game.map.tiles[o.y][o.x],'bridge');
  }
  const tree=scene.find(o=>o.kind==='tree');
  assert.ok(M.GardenMap.obscures(tree,{x:tree.x,y:tree.y-1}));
  assert.ok(!M.GardenMap.obscures(tree,{x:tree.x,y:tree.y+1}));
  assert.ok(!M.GardenMap.obscures(tree,{x:tree.x+2,y:tree.y-1}));
  game.units=[];renderer.render(0);fs.writeFileSync(path.join(out,'chapter-01-terrain.png'),canvas.toBuffer('image/png'));
  const closed=canvas.toBuffer('image/png');
  game.openGate();renderer.render(0);fs.writeFileSync(path.join(out,'chapter-01-gate-open.png'),canvas.toBuffer('image/png'));
  const open=canvas.toBuffer('image/png');assert.ok(!closed.equals(open),'opening the gate must update the cached scene');
  assert.ok(M.GardenMap.makeObjects(game.map,renderer.projection).filter(o=>o.kind==='gate').every(o=>o.open));
  game.resonanceOpen=true;game._syncResonance();renderer.terrainLayer=null;
  renderer.render(0);fs.writeFileSync(path.join(out,'chapter-01-ford-open.png'),canvas.toBuffer('image/png'));
  assert.ok(!open.equals(canvas.toBuffer('image/png')),'opening the ford must update terrain and banks');
  console.log('First chapter 2.5D: sprite-head selection, scenery footprints, occlusion, gate and ford redraw passed.');
  console.log('Exported deployment, terrain, open-gate and ford previews to docs/previews/');
  renderer.setGame(new M.Game({stage:2,recruited:['xueyue']}));renderer.render(0);
  fs.writeFileSync(path.join(out,'chapter-02-deployment.png'),canvas.toBuffer('image/png'));
  renderer.game.units=[];renderer.render(0);
  fs.writeFileSync(path.join(out,'chapter-02-terrain.png'),canvas.toBuffer('image/png'));
  renderer.game.awakenedBells=renderer.game.mission.bells.map(b=>b.id);renderer.render(0);
  fs.writeFileSync(path.join(out,'chapter-02-bells-awake.png'),canvas.toBuffer('image/png'));
  assert.equal(canvas.width,Math.ceil(M.MapProjection.create(2,40,28).width)*2);
  assert.equal(canvas.height,Math.ceil(M.MapProjection.create(2,40,28).height)*2);
  renderer.setGame(new M.Game({stage:1}));renderer.render(0);
  assert.equal(canvas.width,2304);assert.equal(canvas.height,1536);
  console.log('Renderer chapter transitions: 36×24 → 40×28 square village → 36×24 passed.');
  const tilted=M.MapProjection.createInclinedPreview(36,24);
  assert.ok(Math.abs(Math.hypot(tilted.a,tilted.b)-Math.hypot(tilted.c,tilted.d))<1e-12,
    'equal world axes must have equal projected lengths');
  assert.equal(tilted.a,-tilted.c);assert.equal(tilted.b,tilted.d);
  assert.ok(Math.abs(tilted.a**2+tilted.c**2-1)<1e-12,'camera must not stretch the horizontal axis');
  for(const rail of M.GardenMap.makeObjects(renderer.game.map,tilted).filter(o=>o.kind==='rail')){
    const depth=M.MapProjection.project(tilted,(rail.x+.5)*T,(rail.y+(rail.dy<0?.05:.98))*T).y;
    assert.ok(Math.abs(rail.depth-depth)<1e-10,'bridge rail depth must include both ground axes');
  }
  const probe=createCanvas(128,128);
  M.GardenMap.drawObject(probe.getContext('2d'),tilted,{kind:'tree',id:16,p:{x:64.31,y:100.21},x:0,y:0});
  const transparentEdge=probe.getContext('2d').getImageData(36,29,56,4).data;
  for(let i=3;i<transparentEdge.length;i+=4)assert.equal(transparentEdge[i],0,'tree margin must not sample adjacent atlas tiles');
  renderer.setMapProjection(tilted);renderer.showGrid=false;renderer.render(0);
  fs.writeFileSync(path.join(out,'chapter-01-inclined.png'),canvas.toBuffer('image/png'));
  fs.writeFileSync(path.join(out,'chapter-01-inclined-fixed.png'),canvas.toBuffer('image/png'));
  const rotated=M.MapProjection.createInclinedPreview(36,24,-20);
  const epsilon=1e-10;
  assert.ok(Math.abs(Math.atan2(rotated.b,rotated.a)-Math.atan2(tilted.b,tilted.a)+Math.PI/9)<epsilon);
  assert.ok(Math.abs(Math.hypot(rotated.a,rotated.b)-Math.hypot(tilted.a,tilted.b))<epsilon);
  assert.ok(Math.abs(Math.hypot(rotated.c,rotated.d)-Math.hypot(tilted.c,tilted.d))<epsilon);
  assert.ok(Math.abs(rotated.a*rotated.c+rotated.b*rotated.d-(tilted.a*tilted.c+tilted.b*tilted.d))<epsilon);
  for(const [x,y] of [[0,0],[36*T,0],[0,24*T],[36*T,24*T]]){
    const p=M.MapProjection.project(rotated,x,y);
    assert.ok(p.x>=39&&p.y>=87&&p.x<=rotated.width-39&&p.y<=rotated.height-39);
    const q=M.MapProjection.unproject(rotated,p.x,p.y);
    assert.ok(Math.abs(q.x-x)<epsilon&&Math.abs(q.y-y)<epsilon);
  }
  renderer.setMapProjection(rotated);renderer.render(0);
  fs.writeFileSync(path.join(out,'chapter-01-inclined-ccw20.png'),canvas.toBuffer('image/png'));
  renderer.setMapProjection(tilted);
  console.log('Counterclockwise 20°: exact rotation, unchanged scale / ground angles, full board bounds and inverse coordinates passed.');
  // The optional camera must keep every ground coordinate invertible.
  for(let y=0;y<24;y++)for(let x=0;x<36;x++){
    const p=M.MapProjection.project(tilted,(x+.5)*T,(y+.5)*T);
    const q=M.MapProjection.unproject(tilted,p.x,p.y);
    assert.ok(Math.abs(q.x-(x+.5)*T)<1e-8&&Math.abs(q.y-(y+.5)*T)<1e-8);
  }
  renderer.game.units=[];renderer.render(0);
  fs.writeFileSync(path.join(out,'chapter-01-inclined-terrain.png'),canvas.toBuffer('image/png'));
  renderer.setMapProjection(M.MapProjection.create(1,36,24));renderer.render(0);
  assert.equal(canvas.width,2304);assert.equal(canvas.height,1536);
  console.log('Inclined comparison: balanced camera axes, bridge depth, transparent sprite edges, 864 coordinate round trips and return to square view passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
