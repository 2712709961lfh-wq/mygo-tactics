'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const w={console};w.window=w;vm.createContext(w);
for(const f of ['config','map-projection','rng','grid','pathfinding','combat','game','ai','viewport'])
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',f+'.js'),'utf8'),w);
const M=w.MyGO,C=M.CONFIG,plain=v=>JSON.parse(JSON.stringify(v));
const g=new M.Game({stage:2,recruited:['xueyue'],seed:22});
assert.equal(g.map.tiles.length,28);assert(g.map.tiles.every(r=>r.length===40));
assert.equal(g.livingCount('enemy'),24);assert.equal(g.livingCount('player'),6);
const positions=new Set();
for(const u of g.units){assert(!g.getTerrain(u.x,u.y).blocked,u.id);const k=u.x+','+u.y;assert(!positions.has(k),k);positions.add(k);}
assert.equal(new Set(g.living('enemy').map(u=>u.guardGroup)).size,6);
assert(g.living('enemy').filter(u=>g.isUnitActive(u)).length<=3,'opening contact must be a small patrol');
const west=g.getUnit('shadow_lance');g.alertGroup(west);
assert(g.living('enemy').filter(u=>u.guardGroup==='moon-west').every(u=>u.alerted));
assert(!g.getUnit('shadow_bow').alerted);assert(!g.isUnitActive(g.getUnit('conductor')));
for(const [x,y] of [[5,17],[34,11],[12,24],[11,7]])assert.equal(g.getTerrain(x,y).id,'fort');
const tomori=g.getUnit('tomori');Object.assign(tomori,{x:12,y:24,hp:1});g.beginNextPlayerPhase();assert(tomori.hp>1);
const snapshot=g.serialize();const restored=new M.Game();restored.restore(snapshot);
assert.equal(restored.map.cols,40);assert.equal(restored.getUnit('xueyue').side,'player');assert(restored.getUnit('shadow_lance').alerted);
const before=JSON.stringify(restored.serialize());
assert.throws(()=>restored.restore({...snapshot,mapRevision:1}),/第二关地图已扩建/);
assert.equal(JSON.stringify(restored.serialize()),before,'reject incompatible old map before changing a running game');

// Pick every projected cell center at different scales and after a portrait rotation.
const v=M.MapProjection.create(2,40,28),V=M.Viewport;
for(const zoom of [.45,1,2.25]){
 const rect={left:-70,top:30,width:v.width*zoom,height:v.height*zoom};
 for(let y=0;y<28;y++)for(let x=0;x<40;x++){
  const p=M.MapProjection.project(v,(x+.5)*32,(y+.5)*32);
  assert.deepEqual(plain(V.pointToCell(rect,rect.left+p.x*zoom,rect.top+p.y*zoom,40,28,false,v)),{x,y});
  const rotated={left:13,top:-60,width:v.height*zoom,height:v.width*zoom};
  assert.deepEqual(plain(V.pointToCell(rotated,rotated.left+rotated.width-p.y*zoom,rotated.top+p.x*zoom,40,28,true,v)),{x,y});
 }
}
const rect={left:0,top:0,width:v.width,height:v.height};
assert.equal(V.pointToCell(rect,1,1,40,28,false,v),null,'outside the tilted board must not select a cell');
assert.equal(V.pointToCell(rect,v.width-2,v.height-2,40,28,false,v),null);
assert.deepEqual(plain(M.MapProjection.project(M.MapProjection.create(1,36,24),160,96)),{x:160,y:96});
console.log('Moon expansion: 24 enemies / six guard groups / legal spawns / forts / save revision / 6,720 projected picks passed.');
