'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..'),crypto=require('crypto');
class LocalImage{
 set src(file){this.file=file;const png=fs.readFileSync(path.join(root,file));
  this.width=png.readUInt32BE(16);this.height=png.readUInt32BE(20);queueMicrotask(()=>this.onload());}
}
const w={MyGO:{CONFIG:{TILE:32},Assets:{},ParkMap:{},Characters:{has:()=>false,hasActions:()=>false,
 drawMap:()=>false,drawBattlePose:()=>false,drawPortrait:()=>false}}};
const scope={window:w,Image:LocalImage,console,performance:{now:()=>0}};
for(const file of ['watercourt-art','battle'])vm.runInNewContext(fs.readFileSync(path.join(root,'src',file+'.js'),'utf8'),scope);
const M=w.MyGO,calls=[],ctx=Object.fromEntries(['save','restore','translate','scale','drawImage','beginPath','ellipse','fill']
 .map(name=>[name,(...args)=>calls.push([name,...args])]));
(async()=>{
 assert((await M.WatercourtArt.load()).every(Boolean));assert.equal(Object.keys(M.WatercourtArt.images).length,4);
 const meta=JSON.parse(fs.readFileSync(path.join(root,'assets/chapter-five/knight-actions.json')));
 let count=0;
 for(const [id,kind] of [['court-armor-n','armor'],['iron_warden','warden']]){
  assert(M.Characters.hasActions(id));
  for(const [state,spec] of Object.entries(meta.units[kind].actions))for(const [direction,facing] of meta.directions.entries()){
   for(let i=0;i<spec.count;i++){
    calls.length=0;M.Characters.drawBattlePose(ctx,{id},0,0,96,state,i,facing);
    const call=calls.find(c=>c[0]==='drawImage');assert(call[1].file.endsWith(kind+'-actions.png'));
    assert.deepEqual(call.slice(2,6),[i*192,(spec.row+direction)*192,192,192]);count++;
   }
   calls.length=0;M.Characters.drawBattlePose(ctx,{id},0,0,96,state,999,facing);
   assert.equal(calls.find(c=>c[0]==='drawImage')[2],(spec.count-1)*192);
  }
 }
 assert.equal(count,248);
 // The source horse faces right; map and battle must apply the same convention.
 for(const id of ['court-pegasus-n','court-pegasus-s','court-pegasus-guard-n','court-pegasus-guard-s'])for(const facing of ['left','right']){
  assert(M.Characters.has(id));
  calls.length=0;assert(M.Characters.drawMap(ctx,{id,facing},0,0,60,0));
  assert(calls.find(c=>c[0]==='drawImage')[1].file.endsWith('pegasus-rider.png'));
  assert.equal(calls.some(c=>c[0]==='scale'&&c[1]===-1),facing==='left');
  calls.length=0;assert(M.Characters.drawBattlePose(ctx,{id},0,0,60,'attack',3,facing));
  assert.equal(calls.some(c=>c[0]==='scale'&&c[1]===-1),facing==='left');
 }
 // Idle and moving map units use genuine different rows, in all four directions.
 for(const [direction,facing] of meta.directions.entries())for(const moving of [false,true]){
  calls.length=0;M.Characters.drawMap(ctx,{id:'court-armor-n',facing,_walking:moving},0,0,60,250);
  const call=calls.find(c=>c[0]==='drawImage');assert.equal(call[3],((moving?4:0)+direction)*192);
 }
 // The original layers and credits must remain reproducible.
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/chapter-five/knight-source-manifest.json')));
 assert(manifest.credits.length>0);assert.equal(manifest.selectedLicense,'CC-BY-SA-3.0');
 for(const source of manifest.files){const data=fs.readFileSync(path.join(root,'assets/chapter-five/lpc-source',source.path.replaceAll('/','__')));
  assert.equal(crypto.createHash('sha256').update(data).digest('hex'),source.sha256);}
 const scene=Object.create(M.BattleScene.prototype),poses=[];
 Object.assign(scene,{duration:1800,result:{hit:true,hpAfter:10},defender:{id:'tomori'},
 _shadow:()=>{},_sprite:(...args)=>poses.push(args),_drawWeaponFx:()=>{},_drawImpact:()=>{},_drawParticles:()=>{}});
 for(const [id,weapon,frames] of [['court-armor-n','lance',[[.50,1],[.53,2],[.57,4],[.58,5],[.68,7]]],
  ['iron_warden','axe',[[.50,0],[.54,1],[.57,2],[.58,3],[.64,4],[.68,5]]]]){
  scene.attacker={id,weapon:{type:weapon}};
  for(const [time,frame] of frames){poses.length=0;scene._drawBattle(ctx,time,(time-.58)*1800);
   assert.equal(poses.at(-1)[8],'attack');assert.equal(poses.at(-1)[9],frame);assert.equal(poses.at(-1)[6],0);}
  for(const time of [.4,.76]){poses.length=0;scene._drawBattle(ctx,time,-100);assert.equal(poses.at(-1)[8],'walk');}
  // Passing an empty drawing context proves no extra procedural weapon is painted.
  scene._drawAxeChop({},.58,0,0,0,0);scene._drawLanceThrust({},.58,0,0,0,0);
 }
 scene.attacker={id:'tomori',weapon:{type:'sword'}};scene.defender={id:'iron_warden'};
 for(const [hit,hp,age,state,frame] of [[true,10,0,'hurt',0],[true,10,250,'hurt',2],[true,0,570,'down',5],[false,10,300,'jump',3]]){
  scene.result={hit,hpAfter:hp};poses.length=0;scene._drawBattle(ctx,.9,age);
  assert.equal(poses[0][8],state);assert.equal(poses[0][9],frame);
 }
 console.log('Watercourt actions: 248 real directional poses, clipping, facing, movement, attack/impact clocks, hurt/down/dodge, source hashes and no procedural axe/lance verified.');
})().catch(e=>{console.error(e);process.exitCode=1;});
