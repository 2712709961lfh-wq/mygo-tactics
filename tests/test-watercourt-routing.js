'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),w={console};w.window=w;vm.createContext(w);
for(const name of ['equipment-data','magic-data','inventory','class-data','class-mastery','config','chapter-three','chapter-four','chapter-five','chapter-six',
 'rng','growth-data','growth','grid','pathfinding','combat','game'])
 vm.runInContext(fs.readFileSync(path.join(root,'src',name+'.js'),'utf8'),w,{filename:name});
const M=w.MyGO;
M.ParkMap={};M.Characters={has:()=>false,hasActions:()=>false,drawMap:()=>false,drawBattlePose:()=>false,drawPortrait:()=>false};
w.Image=class{set src(file){this.file=file;fs.accessSync(path.join(root,file));queueMicrotask(()=>this.onload());}};
for(const name of ['watercourt-art','masked-court-art'])vm.runInContext(fs.readFileSync(path.join(root,'src',name+'.js'),'utf8'),w,{filename:name});
const calls=[],ctx=Object.fromEntries(['save','restore','translate','scale','drawImage'].map(name=>[name,(...args)=>calls.push([name,...args])]));
function drawn(fn){calls.length=0;assert(fn());const call=calls.find(c=>c[0]==='drawImage');assert(call);return call;}
function sheet(call){return path.basename(call[1].file);}
(async()=>{
 await M.WatercourtArt.load();const g=new M.Game({stage:5,seed:57}),boss=g.getUnit('iron_warden');
 for(const u of g.living('enemy').filter(u=>['park-armor','park-pegasus'].includes(u.art))){
  const expected=u.boss?'warden-actions.png':u.art==='park-armor'?'armor-actions.png':'pegasus-rider.png';
  assert.equal(sheet(drawn(()=>M.Characters.drawPortrait(ctx,u.id,0,0,100,100))),expected,u.id+' portrait');
  for(const facing of ['up','left','down','right']){
   u.facing=facing;
   for(const moving of [false,true]){u._walking=moving;
    assert.equal(sheet(drawn(()=>M.Characters.drawMap(ctx,u,0,0,60,250))),expected,u.id+' map');}
   for(const state of ['idle','walk','attack','hurt','down','jump'])
    assert.equal(sheet(drawn(()=>M.Characters.drawBattlePose(ctx,u,0,0,60,state,2,facing))),expected,u.id+' '+state);
  }
 }
 boss._walking=false;boss.facing='left';
 const map=drawn(()=>M.Characters.drawMap(ctx,boss,0,0,60,0));
 const battle=drawn(()=>M.Characters.drawBattlePose(ctx,boss,0,0,60,'idle',0,'left'));
 const portrait=drawn(()=>M.Characters.drawPortrait(ctx,boss.id,0,0,100,100));
 assert.deepEqual(map.slice(1,6),battle.slice(1,6));assert.deepEqual(map.slice(1,6),portrait.slice(1,6));
 assert(Math.abs(map[7]-(-124*60*1.16/48))<1e-9,'Boss keeps its enlarged map silhouette');
 let summons=0;
 for(const u of M.CONFIG.STAGE_SIX.summonTemplates.filter(u=>['park-armor','park-pegasus'].includes(u.art))){
  const expected=u.art==='park-armor'?'armor-actions.png':'pegasus-rider.png';
  assert(M.Characters.has(u.id));assert(M.Characters.hasActions(u.id));
  assert.equal(sheet(drawn(()=>M.Characters.drawMap(ctx,u,0,0,60,0))),expected);
  assert.equal(sheet(drawn(()=>M.Characters.drawBattlePose(ctx,u,0,0,60,'attack',0,'left'))),expected);
  assert.equal(sheet(drawn(()=>M.Characters.drawPortrait(ctx,u.id,0,0,100,100))),expected);summons++;
 }
 assert(summons>0);
 console.log('Watercourt routing: complete chapter-six wrapper chain preserves chapter-five boss gold axe atlas in map/battle/portrait, all directions and states; '+summons+' summon aliases verified.');
})().catch(e=>{console.error(e);process.exitCode=1;});
