'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),w={console,performance:{now:()=>0}};w.window=w;
w.MyGO={CONFIG:{TILE:32,STAGE_SIX:{summonTemplates:[]}},Assets:{},ParkMap:{},WatercourtArt:{isArmored:()=>false},WatercourtMap:{},
 Characters:{has:()=>false,hasActions:()=>false,drawMap:()=>false,drawBattlePose:()=>false,drawPortrait:()=>false}};
w.Image=class{set src(file){this.file=file;const png=fs.readFileSync(path.join(root,file));this.width=png.readUInt32BE(16);this.height=png.readUInt32BE(20);queueMicrotask(()=>this.onload());}};
vm.createContext(w);for(const n of ['masked-court-art','battle'])vm.runInContext(fs.readFileSync(path.join(root,'src',n+'.js'),'utf8'),w,{filename:n});
const M=w.MyGO,calls=[],ctx=Object.fromEntries(['save','restore','translate','scale','drawImage','beginPath','arc','fill','fillRect'].map(n=>[n,(...args)=>calls.push([n,...args])]));
ctx.globalAlpha=1;ctx.createRadialGradient=()=>({addColorStop:()=>{}});
(async()=>{
 const A=M.MaskedCourtArt;assert((await A.load()).every(Boolean));
 const meta=JSON.parse(fs.readFileSync(path.join(root,'assets/chapter-six/mask-actions.json')));
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,meta.source))).digest('hex'),meta.sourceSha256);
 assert.equal(meta.cellWidth,256);assert.equal(meta.cellHeight,160);assert.equal(meta.anchorX,64);assert.equal(meta.anchorY,143);
 let count=0;
 for(const [state,spec] of Object.entries(meta.frames)){
  assert.equal(spec.count,{idle:7,walk:7,attack:6,hurt:3,down:4}[state]);
  assert.equal(A.specs[state].join(','),[spec.row,spec.count].join(','));count+=spec.count;
  for(const direction of ['right','left'])for(let frame=0;frame<spec.count;frame++){
   calls.length=0;M.Characters.drawBattlePose(ctx,{id:'masked_stranger'},130,220,108,state,frame,direction);
   const call=calls.find(c=>c[0]==='drawImage'&&c[1]===A.images.actions);
   assert.deepEqual(call.slice(2,6),[frame*256,spec.row*160,256,160]);
   assert(call[2]+256<=call[1].width&&call[3]+160<=call[1].height);
   assert.deepEqual(call.slice(6),[-64,-143,256,160]);
   assert.equal(calls.some(c=>c[0]==='scale'&&c[1]===-1),direction==='left');
  }
  assert.equal(A.frameAt(state,-1),0);assert.equal(A.frameAt(state,1),spec.count-1);
  calls.length=0;A.action(ctx,130,220,108,state,999);
  assert.equal(calls.find(c=>c[0]==='drawImage'&&c[1]===A.images.actions)[2],(spec.count-1)*256);
 }
 assert.equal(count,27);
 for(const facing of ['down','up','left','right'])for(const moving of [false,true]){
  calls.length=0;M.Characters.drawMap(ctx,{id:'masked_stranger',facing,_walking:moving},0,0,60,250);
  assert(calls.some(c=>c[0]==='drawImage'&&c[1]===(moving?A.images.walk:A.images.idle)));
 }
 const poses=[],scene=Object.create(M.BattleScene.prototype);
 Object.assign(scene,{duration:1800,attacker:{id:'masked_stranger',weapon:{type:'tome'}},defender:{id:'tomori'},result:{hit:true,hpAfter:10},
 _shadow:()=>{},_sprite:(...args)=>poses.push(args),_drawWeaponFx:()=>{},_drawImpact:()=>{},_drawParticles:()=>{}});
 const seen=new Set();for(let i=0;i<100;i++){
  poses.length=0;scene._drawBattle(ctx,i/100,(i/100-.58)*1800);const pose=poses.at(-1);
  if(pose[8]==='attack'){assert(pose[9]<6);seen.add(pose[9]);}else assert(pose[9]<7);
 }
 assert.equal(seen.size,6);
 scene.attacker={id:'tomori',weapon:{type:'sword'}};scene.defender={id:'masked_stranger'};
 for(const [age,frame] of [[0,0],[130,1],[250,2]]){
  poses.length=0;scene._drawBattle(ctx,.9,age);assert.equal(poses[0][8],'hurt');assert.equal(poses[0][9],frame);
 }
 console.log('Mask actions: 27 source frames, both facings, anchors, crop bounds, source hash, 6 attack / 3 hurt clocks, and four map directions pass.');
})().catch(e=>{console.error(e);process.exitCode=1;});
