'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
class LocalImage{set src(file){this.file=file;const b=fs.readFileSync(path.join(root,file));this.width=b.readUInt32BE(16);this.height=b.readUInt32BE(20);queueMicrotask(()=>this.onload());}}
const w={console,performance:{now:()=>1600},MyGO:{CONFIG:{TILE:32,STAGE_PALACE:{enemies:[{id:'palace-cavalier-0',art:'palace-cavalier'},{id:'gilded_cavalier',art:'palace-cavalier-elite'}]}},MapProjection:{},Characters:{has:()=>false,hasActions:()=>false,drawMap:()=>false,drawBattlePose:()=>false,drawPortrait:()=>false}}};w.window=w;
w.MyGO.Assets={};
const scope={window:w,Image:LocalImage,console,performance:w.performance};
for(const file of ['palace-art','battle'])vm.runInNewContext(fs.readFileSync(path.join(root,'src',file+'.js'),'utf8'),scope,{filename:file});
const M=w.MyGO,calls=[],ctx=Object.fromEntries(['save','restore','translate','scale','drawImage','beginPath','ellipse','fill','stroke','rect','clip'].map(name=>[name,(...args)=>calls.push([name,...args])]));
(async()=>{
 assert((await M.PalaceArt.load()).every(Boolean));const meta=JSON.parse(fs.readFileSync(path.join(root,'assets/chapter-ten/mounted-actions.json')));let count=0;
 for(const [id,kind]of [['palace-cavalier-0','cavalier'],['gilded_cavalier','elite']]){
  assert(M.Characters.hasActions(id));
  for(const [state,spec]of Object.entries(meta.units[kind].actions))for(const [direction,facing]of meta.directions.entries()){
   for(let i=0;i<spec.count;i++){
    calls.length=0;assert(M.Characters.drawBattlePose(ctx,{id},0,0,90,state,i,facing));const call=calls.find(c=>c[0]==='drawImage');
    assert(call[1].file.endsWith(kind+'-actions.png'));assert.deepEqual(call.slice(2,6),[i*192,(spec.row+direction)*192,192,192]);assert.deepEqual(call.slice(6),[-96,-152,192,192]);count++;
   }
   calls.length=0;M.PalaceArt.drawMounted(ctx,id,0,0,90,0,state,999,facing);assert.equal(calls.find(c=>c[0]==='drawImage')[2],(spec.count-1)*192);
  }
  // Map pose and portrait use the same atlas and direction as the battle pose.
  for(const [direction,facing]of meta.directions.entries())for(const moving of [false,true]){
   calls.length=0;M.Characters.drawMap(ctx,{id,facing,_walking:moving},0,0,60,460);
   const call=calls.find(c=>c[0]==='drawImage');assert.equal(call[3],((moving?4:0)+direction)*192);assert.equal(call[2],(moving?4:1)*192);
  }
  calls.length=0;M.Characters.drawPortrait(ctx,id,0,0,80,80);assert(calls.find(c=>c[0]==='drawImage')[1].file.endsWith(kind+'-actions.png'));
 }
 assert.equal(count,288);assert(!M.PalaceArt.isCavalry('palace-armor-0'));assert(!M.Characters.drawMap(ctx,{id:'tomori'},0,0,60,0));
 const scene=Object.create(M.BattleScene.prototype),poses=[];Object.assign(scene,{attacker:{id:'gilded_cavalier',weapon:{type:'lance'}},defender:{id:'tomori'},duration:1800,result:{hit:true,hpAfter:10},_shadow:()=>{},_sprite:(...args)=>poses.push(args),_drawWeaponFx:()=>{},_drawImpact:()=>{},_drawParticles:()=>{}});
 for(const [t,state,frame]of [[.4,'run'],[.50,'attack',1],[.57,'attack',4],[.58,'attack',5],[.67,'attack',7],[.76,'walk']]){
  poses.length=0;scene._drawBattle(ctx,t,(t-.58)*1800);const p=poses.at(-1);assert.equal(p[8],state);assert.equal(p[6],0);if(frame!==undefined)assert.equal(p[9],frame);
 }
 scene._drawLanceThrust({},.58,0,0,0,0); // No duplicate geometric spear is drawn.
 scene.attacker={id:'tomori',weapon:{type:'sword'}};scene.defender={id:'gilded_cavalier'};
 for(const [hit,hp,age,state,frame]of [[true,10,0,'hurt',0],[true,10,250,'hurt',2],[true,0,570,'down',5],[false,10,300,'jump',3]]){
  scene.result={hit,hpAfter:hp};poses.length=0;scene._drawBattle(ctx,.9,age);assert.equal(poses[0][8],state);assert.equal(poses[0][9],frame);
 }
 assert(M.PalaceMap.obscures({kind:'palace-column',x:8,y:7,h:2},{x:8,y:6}));assert(!M.PalaceMap.obscures({kind:'palace-column',x:8,y:7,h:2},{x:13,y:6}));
 const scenery=JSON.parse(fs.readFileSync(path.join(root,'assets/chapter-ten/scenery.json'))),img=M.PalaceArt.images.scenery;
 for(const a of Object.values(scenery)){assert(a.x>=0&&a.y>=0&&a.x+a.w<=img.width&&a.y+a.h<=img.height);}
 assert(fs.readFileSync(path.join(root,'build-standalone.js'),'utf8').includes("palaceelite: 'assets/chapter-ten/elite-actions.png'"));
 console.log('Palace art: 288 frame rectangles, four directions, shared map/battle/portrait atlases, attack clock, defender poses and scenery bounds passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
