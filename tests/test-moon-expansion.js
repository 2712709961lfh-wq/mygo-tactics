'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const w={console};w.window=w;vm.createContext(w);
for(const f of ['equipment-data','magic-data','inventory','class-data','config','map-projection','rng','growth-data','growth','grid','pathfinding','combat','game','ai','viewport'])
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',f+'.js'),'utf8'),w);
const M=w.MyGO,C=M.CONFIG,plain=v=>JSON.parse(JSON.stringify(v));
const g=new M.Game({stage:2,recruited:['xueyue'],seed:22});
assert.equal(g.map.tiles.length,28);assert(g.map.tiles.every(r=>r.length===40));
assert.equal(g.livingCount('enemy'),24);assert.equal(g.livingCount('player'),6);
const positions=new Set();
for(const u of g.units){assert(!g.getTerrain(u.x,u.y).blocked,u.id);const k=u.x+','+u.y;assert(!positions.has(k),k);positions.add(k);}
assert.equal(new Set(g.living('enemy').map(u=>u.guardGroup)).size,6);
assert(g.living('enemy').filter(u=>g.isUnitActive(u)).length<=4,'opening contact must be a small patrol');
const west=g.getUnit('shadow_blade_1');g.alertGroup(west);
assert(g.living('enemy').filter(u=>u.guardGroup==='moon-west').every(u=>u.alerted));
assert(!g.getUnit('shadow_bow').alerted);assert(!g.isUnitActive(g.getUnit('conductor')));
for(const [x,y] of [[5,16],[18,14],[28,20]])assert.equal(g.getTerrain(x,y).id,'fort');
const tomori=g.getUnit('tomori');Object.assign(tomori,{x:5,y:16,hp:1});g.beginNextPlayerPhase();assert(tomori.hp>1);
const bell=g.mission.bells[0];
assert(!g.canAwakenBell(tomori),'must stand on an objective');
g.setUnitPosition(tomori.id,bell.x,bell.y);tomori.hp=1;
assert(g.canAwakenBell(tomori));assert.equal(g.awakenBell(tomori).id,bell.id);
assert(tomori.acted);assert.equal(tomori.hp,1+Math.ceil(tomori.maxHp*.3));
assert(!g.awakenBell(tomori),'no repeat visits in the same action');
g.beginNextPlayerPhase();assert(!g.awakenBell(tomori),'no repeat visits in later turns');
assert.equal(g.awakenedBells.length,1);
assert(g.living('enemy').filter(u=>u.guardGroup===bell.group).every(u=>u.alerted));
assert(!g.canAwakenBell(g.getUnit('shadow_bow')));
const snapshot=g.serialize();const restored=new M.Game();restored.restore(snapshot);
assert.equal(restored.map.cols,40);assert.equal(restored.getUnit('xueyue').side,'player');assert(restored.getUnit('shadow_blade_1').alerted);
assert.deepEqual(plain(restored.awakenedBells),[bell.id]);
const before=JSON.stringify(restored.serialize());
assert.throws(()=>restored.restore({...snapshot,mapRevision:2}),/第二关地图已重新设计/);
assert.equal(JSON.stringify(restored.serialize()),before,'reject incompatible old map before changing a running game');
assert.throws(()=>restored.restore({...snapshot,awakenedBells:[bell.id,bell.id]}),/星铃/);
assert.throws(()=>restored.restore({...snapshot,awakenedBells:['unknown']}),/星铃/);
const objectivesFirst=new M.Game({stage:2}),visitor=objectivesFirst.getUnit('tomori');
for(const b of objectivesFirst.mission.bells.slice(2)){
 visitor.acted=false;objectivesFirst.setUnitPosition(visitor.id,b.x,b.y);assert(objectivesFirst.awakenBell(visitor));
}
assert(!objectivesFirst.isOver(),'three objectives still require the boss');
objectivesFirst.applyCombat({defenderId:'conductor',hit:true,finalDamage:999});
assert.equal(objectivesFirst.phase,'victory');assert.equal(objectivesFirst.livingCount('enemy'),23);
const routed=new M.Game({stage:2});for(const enemy of routed.living('enemy')){enemy.dead=true;enemy.hp=0;}
routed.checkOutcome();assert(!routed.isOver(),'rout alone cannot skip the bells');
const wrongStage=new M.Game();assert(!wrongStage.canAwakenBell(wrongStage.getUnit('tomori')));

// Pick every projected cell center at different scales and after a portrait rotation.
const v=M.MapProjection.create(2,40,28),V=M.Viewport;
assert.equal(v.a,1);assert.equal(v.d,1);assert.equal(v.b,0);assert.equal(v.c,0);
const tl=M.MapProjection.project(v,0,0),tr=M.MapProjection.project(v,32,0),bl=M.MapProjection.project(v,0,32);
assert.equal(tr.y,tl.y);assert.equal(bl.x,tl.x);assert.equal(tr.x-tl.x,bl.y-tl.y,'square cells must retain equal edge lengths');
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
assert.equal(V.pointToCell(rect,1,1,40,28,false,v),null,'outside the board must not select a cell');
assert.equal(V.pointToCell(rect,v.width-2,v.height-2,40,28,false,v),null);
assert.deepEqual(plain(M.MapProjection.project(M.MapProjection.create(1,36,24),160,96)),{x:160,y:96});
console.log('Moon village: 24 enemies / six guard groups / five-bell objective / both victory orders / healing / save / square geometry / 6,720 projected picks passed.');
