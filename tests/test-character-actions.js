'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
class AssetImage {
  set src(value) {
    this.file = value;
    const bytes = fs.readFileSync(path.join(root, value.split('?')[0]));
    this.width = this.naturalWidth = bytes.readUInt32BE(16);
    this.height = this.naturalHeight = bytes.readUInt32BE(20);
    queueMicrotask(() => this.onload());
  }
}
const window = { MyGO: { CONFIG: {}, Assets: {} } };
const scope = { window, Image: AssetImage, console, performance: { now: () => 0 } };
for (const file of ['characters', 'battle']) {
  vm.runInNewContext(fs.readFileSync(path.join(root, 'src', file + '.js'), 'utf8'), scope);
}
const calls = [];
const ctx = Object.fromEntries(['save', 'restore', 'translate', 'scale', 'drawImage', 'beginPath', 'ellipse', 'fill']
  .map(name => [name, (...args) => calls.push([name, ...args])]));
function draw(state, frame, facing = 'right', action, id = 'soyo') {
  calls.length = 0;
  assert(window.MyGO.Characters.drawBattlePose(ctx, { id }, 12, 90, 90, state, frame, facing, action));
  return calls.find(x => x[0] === 'drawImage');
}
(async () => {
  const chars = window.MyGO.Characters;
  assert(await chars.load(), 'All real character PNGs must exist and load');
  assert(chars.hasActions('soyo'));
  assert(chars.hasActions('tomori'));
  assert(chars.hasActions('rana'));
  assert(chars.hasActions('anon'));
  assert(chars.hasActions('taki'));
  assert(chars.hasActions('xueyue'));
  assert(chars.hasActions('subaru'));
  const subaru=JSON.parse(fs.readFileSync(path.join(root,'assets/characters/actions/subaru-actions.json')));
  assert.equal(Object.values(subaru.frames).reduce((n,x)=>n+x.count,0),49);
  for(const [state,spec] of Object.entries(subaru.frames)){
    const pose=draw(state,999,'right',undefined,'subaru');
    assert(pose[1].file.includes('subaru-actions.png'));
    assert.equal(pose[2],(spec.count-1)*subaru.cellWidth);assert.equal(pose[3],spec.row*subaru.cellHeight);
    assert.equal(pose[6],-subaru.anchorX*(90/subaru.bodyHeight));assert.equal(pose[7],-subaru.anchorY*(90/subaru.bodyHeight));
  }
  assert.equal(draw('attack',999,'left','attack2','subaru')[3],4*subaru.cellHeight);
  for(const facing of ['up','down','left','right'])for(const moving of [false,true]){
    calls.length=0;chars.drawMap(ctx,{id:'subaru',facing,_walking:moving},0,60,60,0);
    assert(calls.some(x=>x[0]==='drawImage'&&x[1].file.includes(moving?'/walk/':'/idle/')));
  }
  const snow = JSON.parse(fs.readFileSync(path.join(root, 'assets/characters/actions/xueyue-actions.json')));
  assert.equal(Object.values(snow.frames).reduce((n, x) => n + x.count, 0), 61);
  for (const [state, spec] of Object.entries(snow.frames)) {
    const frame = draw(state, 999, 'left', undefined, 'xueyue');
    assert(frame[1].file.includes('xueyue-actions.png'));
    assert.equal(frame[2], (spec.count - 1) * snow.cellWidth);
    assert.equal(frame[3], spec.row * snow.cellHeight);
    assert.equal(frame[6], -snow.anchorX * (90 / snow.bodyHeight));
    assert.equal(frame[7], -snow.anchorY * (90 / snow.bodyHeight));
    assert(calls.some(x => x[0] === 'scale' && x[1] === -1));
  }
  for (const [action, row] of [['attack', 6], ['attack2', 7], ['rush', 4]]) {
    assert.equal(draw('attack', 999, 'right', action, 'xueyue')[3], row * snow.cellHeight);
  }
  for (const [facing, row] of [['down', 0], ['up', 1], ['left', 2], ['right', 3]]) {
    calls.length = 0;
    chars.drawMap(ctx, { id: 'xueyue', facing, _walking: true }, 0, 60, 60, 0);
    const frame = calls.find(x => x[0] === 'drawImage');
    assert(frame[1].file.includes('/walk/')); assert.equal(frame[3], row * 128);
    assert(!calls.some(x => x[0] === 'scale' && x[1] === -1), 'Xueyue uses four authored directions');
  }
  const meta = JSON.parse(fs.readFileSync(path.join(root, 'assets/characters/actions/soyo-actions.json')));
  assert.equal(meta.cellWidth, 320);
  assert.equal(meta.cellHeight, 208);
  assert.equal(Object.values(meta.frames).reduce((n, x) => n + x.count, 0), 35);
  let d = draw('attack', 6);
  assert(d[1].file.endsWith('soyo-actions.png'));
  assert.equal(d[2], 6 * 320);
  assert.equal(d[3], 0);
  const anchor = [d[6], d[7]];
  d = draw('attack', 5, 'right', 'flame');
  assert.equal(d[3], 208, 'Critical attack uses the flame-jet row');
  assert.deepEqual([d[6], d[7]], anchor, 'Casting frames share one foot anchor');
  d = draw('hurt', 4, 'left');
  assert.equal(d[3], 3 * 208);
  assert(calls.some(x => x[0] === 'scale' && x[1] === -1), 'Defender faces the attacker');
  d = draw('down', 999);
  assert.equal(d[2], 5 * 320, 'Down frame clamps to the final complete body');
  assert.equal(d[3], 4 * 208);
  assert.equal(draw('jump', 7)[3], 2 * 208);
  const tomori = JSON.parse(fs.readFileSync(path.join(root, 'assets/characters/actions/tomori-actions.json')));
  assert.equal(Object.values(tomori.frames).reduce((n,x) => n+x.count,0),58);
  for (const [state,spec] of Object.entries(tomori.frames)) {
    d = draw(state,999,'right',undefined,'tomori');
    assert(d[1].file.includes('tomori-actions.png'));
    assert.equal(d[1].width,tomori.cellWidth*8);
    assert.equal(d[1].height,tomori.cellHeight*10);
    assert.equal(d[2],(spec.count-1)*tomori.cellWidth);
    assert.equal(d[3],spec.row*tomori.cellHeight);
    assert.equal(d[6],-tomori.anchorX*(90/tomori.bodyHeight));
    assert.equal(d[7],-tomori.anchorY*(90/tomori.bodyHeight));
  }
  draw('attack',2,'left',undefined,'tomori');
  assert(calls.some(x=>x[0]==='scale' && x[1]===-1),'Tomori mirrors to face the attacker');
  assert(!chars.drawProjectile(ctx,{id:'tomori'},0,0,20),'Sword sheet needs no magic projectile');
  for(const [action,row] of [['attack',6],['attack2',7],['rush',4]]) {
    assert.equal(draw('attack',999,'right',action,'tomori')[3],row*144,
      'Tomori selects all three authored sword sequences');
  }
  const rana = JSON.parse(fs.readFileSync(path.join(root,'assets/characters/actions/rana-actions.json')));
  assert.equal(Object.values(rana.frames).reduce((n,x)=>n+x.count,0),58);
  for(const [state,spec] of Object.entries(rana.frames)) {
    d=draw(state,999,'right',undefined,'rana');
    assert(d[1].file.includes('rana-actions.png'));
    assert.equal(d[1].width,rana.cellWidth*8);
    assert.equal(d[1].height,rana.cellHeight*10);
    assert.equal(d[2],(spec.count-1)*rana.cellWidth);
    assert.equal(d[3],spec.row*rana.cellHeight);
    assert.equal(d[6],-rana.anchorX*(90/rana.bodyHeight));
    assert.equal(d[7],-rana.anchorY*(90/rana.bodyHeight));
  }
  assert.equal(draw('attack',3,'left','attack2','rana')[3],7*128,'Rana critical selects the second thrust row');
  assert(calls.some(x=>x[0]==='scale'&&x[1]===-1));
  for(const moving of [false,true]) {
    calls.length=0;
    chars.drawMap(ctx,{id:'rana',facing:'up',_walking:moving},0,60,60,0);
    assert(calls.some(x=>x[0]==='drawImage'&&x[1].file.includes(moving?'/walk/':'/idle/')),
      'Rana retains true four-direction map art');
  }
  const anon=JSON.parse(fs.readFileSync(path.join(root,'assets/characters/actions/anon-actions.json')));
  assert.equal(Object.values(anon.frames).reduce((n,x)=>n+x.count,0),29);
  for(const [state,spec] of Object.entries(anon.frames)) {
    d=draw(state,999,'right',undefined,'anon');
    assert(d[1].file.includes('anon-actions.png'));
    assert.equal(d[1].width,anon.cellWidth*8);
    assert.equal(d[1].height,anon.cellHeight*5);
    assert.equal(d[2],(spec.count-1)*anon.cellWidth);
    assert.equal(d[3],spec.row*anon.cellHeight);
    assert.equal(d[6],-anon.anchorX*(90/anon.bodyHeight));
    assert.equal(d[7],-anon.anchorY*(90/anon.bodyHeight));
  }
  draw('attack',6,'left',undefined,'anon');
  assert(calls.some(x=>x[0]==='scale'&&x[1]===-1),'Anon mirrors the complete bow pose');
  calls.length=0;
  assert(chars.drawProjectile(ctx,{id:'anon'},100,50,10));
  d=calls.find(x=>x[0]==='drawImage');
  assert(d[1].file.includes('anon-arrow.png'));
  assert.equal(d[4],50,'The source arrow keeps its 65:13 aspect ratio');
  for(const moving of [false,true]) {
    calls.length=0;
    chars.drawMap(ctx,{id:'anon',facing:'up',_walking:moving},0,60,60,0);
    assert(calls.some(x=>x[0]==='drawImage'&&x[1].file.includes(moving?'/walk/':'/idle/')),
      'Anon retains four-direction map art');
  }
  for (const moving of [false,true]) {
    calls.length=0;
    chars.drawMap(ctx,{id:'tomori',facing:'up',_walking:moving},0,60,60,0);
    assert(calls.some(x=>x[0]==='drawImage' && x[1].file.includes(moving?'/walk/':'/idle/')),
      'Tomori keeps four-direction map art');
  }
  calls.length = 0;
  chars.drawMap(ctx, { id: 'soyo', facing: 'up' }, 0, 60, 60, 0);
  assert(calls.some(x => x[0] === 'drawImage' && x[1].file.includes('/idle/')), 'Map preserves true directional standing art');
  calls.length = 0;
  assert(chars.drawProjectile(ctx, { id: 'soyo' }, 100, 50, 24));
  assert(calls.some(x => x[0] === 'drawImage' && x[1].file.endsWith('soyo-fireball.png')));

  const scene = Object.create(window.MyGO.BattleScene.prototype);
  const poses = [];
  Object.assign(scene, { attacker: { id: 'soyo', weapon: { type: 'tome' } }, defender: { id: 'tomori' },
    result: { hit: true, crit: true, hpAfter: 10 },
    _shadow() {}, _sprite(...args) { poses.push(args); }, _drawWeaponFx() {}, _drawImpact() {}, _drawParticles() {} });
  scene._drawBattle(ctx, 0.30, -500);
  const early = poses[1][9];
  poses.length = 0;
  scene._drawBattle(ctx, 0.52, -100);
  assert(poses[1][9] > early, 'The battle clock advances the supplied casting frames');
  assert.equal(poses[1][10], 'flame');
  scene.attacker = { id: 'tomori', weapon: { type: 'sword' } };
  scene.defender = { id: 'soyo' };
  scene.result = { hit: false, hpAfter: 20 };
  poses.length = 0;
  scene._drawBattle(ctx, 0.70, 216);
  assert.equal(poses[0][8], 'jump', 'A missed hit plays the supplied jump sequence');
  scene.result = { hit: true, hpAfter: 0 };
  poses.length = 0;
  scene._drawBattle(ctx, 0.96, 684);
  assert.equal(poses[0][8], 'down');
  assert.equal(poses[0][9], 5);
  scene.attacker = { id:'tomori',weapon:{type:'sword'} };
  scene.defender = { id:'shadow_axe' };
  scene.result = { hit:true,hpAfter:10 };
  for (const [time,state,frame] of [[0.51,'attack',0],[0.56,'attack',1],[0.58,'attack',2],[0.66,'attack',3]]) {
    poses.length=0;
    scene._drawBattle(ctx,time,(time-.58)*1800);
    assert.equal(poses.at(-1)[8],state);
    assert.equal(poses.at(-1)[9],frame,'Sword slash must line up with the impact clock');
  }
  poses.length=0;
  scene._drawBattle(ctx,.40,-300);
  assert.equal(poses.at(-1)[8],'run','Melee approach uses the new eight-frame run');
  for(const [action,crit,frames] of [
    ['attack2',false,[[.51,0],[.57,0],[.58,1],[.63,1],[.66,2]]],
    ['rush',true,[[.28,0],[.34,1],[.42,2],[.48,3],[.56,4],[.58,5],[.64,6],[.68,7]]]
  ]) {
    scene.tomoriAction=action;
    scene.result={hit:true,crit,hpAfter:10};
    for(const [time,frame] of frames) {
      poses.length=0;
      scene._drawBattle(ctx,time,(time-.58)*2100);
      const pose=poses.at(-1);
      assert.equal(pose[8],'attack');
      assert.equal(pose[9],frame,'Overhead and rushing sword strikes synchronize with impact');
      assert.equal(pose[10],action);
      assert.equal(pose[3],242);
      assert.equal(pose[6],0);
      if(time>=.62) assert(pose[2]>340,'Tomori finishes her swing before retreating');
    }
  }
  calls.length=0;
  scene._drawSwordSlash(ctx,.58,350,242,434,242);
  assert.equal(calls.length,0,'No procedural sword hides the new authored slash');
  poses.length=0;
  scene._drawBattle(ctx,.75,300);
  assert.equal(poses.at(-1)[8],'walk','Tomori retreats with her walking row');
  scene.attacker={id:'shadow_blade_1',weapon:{type:'sword'}};
  scene.defender={id:'tomori'};
  scene.result={hit:true,hpAfter:10};
  for (const [age,state,frame] of [[0,'hurt',0],[190,'hurt',2],[520,'idle2',null]]) {
    poses.length=0;
    scene._drawBattle(ctx,.9,age);
    assert.equal(poses[0][8],state);
    if(frame!==null) assert.equal(poses[0][9],frame);
  }
  scene.result={hit:false,hpAfter:20};
  for(const [age,frame] of [[0,0],[210,3],[490,7]]) {
    poses.length=0;
    scene._drawBattle(ctx,.70,age);
    assert.equal(poses[0][8],'jump','Tomori uses her own new jump sequence');
    assert.equal(poses[0][9],frame);
    assert.equal(poses[0][3],242,'Painted jump uses a fixed ground anchor');
    assert.equal(poses[0][6],0);
  }
  scene.result={hit:true,hpAfter:0};
  for(const age of [540,684,750]) {
    poses.length=0;
    scene._drawBattle(ctx,.96,age);
    assert.equal(poses[0][8],'down');
    assert.equal(poses[0][9],3,'New four-frame death reaches and holds the final painted body');
    assert.equal(poses[0][6],0,'Collapsed body stays flat on the floor');
  }
  scene.attacker={id:'rana',weapon:{type:'lance'}};
  scene.defender={id:'shadow_axe'};
  for(const crit of [false,true]) {
    scene.result={hit:true,crit,hpAfter:10};
    const frames=crit?[[.52,0],[.55,1],[.57,2],[.60,3],[.67,4]]:[[.55,0],[.57,1],[.60,2],[.67,3]];
    for(const [time,frame] of frames) {
      poses.length=0;
      scene._drawBattle(ctx,time,(time-.58)*1800);
      assert.equal(poses.at(-1)[8],'attack');
      assert.equal(poses.at(-1)[9],frame);
      assert.equal(poses.at(-1)[10],crit?'attack2':'attack');
    }
  }
  for(const [time,state] of [[.30,'run'],[.45,'charge'],[.75,'walk']]) {
    poses.length=0;
    scene._drawBattle(ctx,time,-100);
    assert.equal(poses.at(-1)[8],state,'Rana uses the matching approach and retreat rows');
  }
  scene.attacker={id:'shadow_blade_1',weapon:{type:'sword'}};
  scene.defender={id:'rana'};
  scene.result={hit:false,hpAfter:24};
  for(const [age,frame] of [[0,0],[210,3],[490,7]]) {
    poses.length=0;
    scene._drawBattle(ctx,.8,age);
    assert.equal(poses[0][8],'jump');
    assert.equal(poses[0][9],frame);
    assert.equal(poses[0][3],242,'The painted jump arc uses a fixed ground anchor');
  }
  scene.result={hit:true,hpAfter:10};
  for(const [age,state,frame] of [[0,'hurt',0],[200,'hurt',2],[450,'idle2',null]]) {
    poses.length=0;
    scene._drawBattle(ctx,.8,age);
    assert.equal(poses[0][8],state);
    if(frame!==null) assert.equal(poses[0][9],frame);
  }
  scene.result={hit:true,hpAfter:0};
  for(const age of [140,330,540,750]) {
    poses.length=0;
    scene._drawBattle(ctx,.96,age);
    assert.equal(poses[0][8],'down');
    assert.equal(poses[0][9],Math.min(4,Math.floor((age-140)/95)));
    assert.equal(poses[0][6],0);
  }
  scene.attacker={id:'anon',weapon:{type:'bow'}};
  scene.defender={id:'shadow_axe'};
  for(const crit of [false,true]) {
    scene.result={hit:true,crit,hpAfter:10};
    for(const [time,state,frame] of [[.10,'idle',null],[.20,'attack',0],[.34,'attack',1],
      [.46,'attack',2],[.49,'attack',3],[.52,'attack',4],[.55,'attack',5],[.60,'attack',6],
      [.75,'walk',2],[.96,'idle',null]]) {
      poses.length=0;
      scene._drawBattle(ctx,time,(time-.58)*1800);
      const pose=poses.at(-1);
      assert.equal(pose[8],state);
      if(frame!==null) assert.equal(pose[9],frame,'Bow frames must follow draw/release/recovery timing');
      assert(pose[2]<150,'Ranged attacker stays at home instead of dashing to the target');
    }
  }
  scene.attacker={id:'shadow_blade_1',weapon:{type:'sword'}};
  scene.defender={id:'anon'};
  scene.result={hit:false,hpAfter:22};
  for(const [age,frame] of [[0,0],[180,3],[420,7]]) {
    poses.length=0;
    scene._drawBattle(ctx,.8,age);
    assert.equal(poses[0][8],'walk','Anon evades with the supplied stepping frames');
    assert.equal(poses[0][9],frame);
    assert.equal(poses[0][3],242);
  }
  scene.result={hit:true,hpAfter:10};
  for(const [age,state,frame] of [[0,'hurt',0],[200,'hurt',2],[450,'idle',null]]) {
    poses.length=0;
    scene._drawBattle(ctx,.8,age);
    assert.equal(poses[0][8],state);
    if(frame!==null) assert.equal(poses[0][9],frame);
  }
  scene.result={hit:true,hpAfter:0};
  for(const age of [140,330,540,750]) {
    poses.length=0;
    scene._drawBattle(ctx,.96,age);
    assert.equal(poses[0][8],'down');
    assert.equal(poses[0][9],Math.min(4,Math.floor((age-140)/95)));
    assert.equal(poses[0][3],242);
    assert.equal(poses[0][6],0);
  }
  const taki = JSON.parse(fs.readFileSync(path.join(root,'assets/characters/actions/taki-actions.json')));
  assert.equal(Object.values(taki.frames).reduce((n,x)=>n+x.count,0),66);
  for(const [state,spec] of Object.entries(taki.frames)) {
    d=draw(state,999,'right',undefined,'taki');
    assert(d[1].file.includes('taki-actions.png'));
    assert.equal(d[1].width,taki.cellWidth*8);
    assert.equal(d[1].height,taki.cellHeight*10);
    assert.equal(d[2],(spec.count-1)*taki.cellWidth);
    assert.equal(d[3],spec.row*taki.cellHeight);
    assert.equal(d[6],-taki.anchorX*(90/taki.bodyHeight));
    assert.equal(d[7],-taki.anchorY*(90/taki.bodyHeight));
  }
  for(const [action,row] of [['attack',5],['attack2',6],['special',7]]) {
    assert.equal(draw('attack',999,'left',action,'taki')[3],row*128);
    assert(calls.some(x=>x[0]==='scale'&&x[1]===-1),'Taki mirrors the axe and its trail together');
  }
  for(const moving of [false,true]) {
    calls.length=0;
    chars.drawMap(ctx,{id:'taki',facing:'up',_walking:moving},0,60,60,0);
    assert(calls.some(x=>x[0]==='drawImage'&&x[1].file.includes(moving?'/walk/':'/idle/')),
      'Taki retains four-direction map art');
  }
  scene.attacker={id:'taki',weapon:{type:'axe'}};
  scene.defender={id:'shadow_axe'};
  for(const [action,crit,frames] of [
    ['attack',false,[[.47,0],[.51,1],[.55,2],[.58,3],[.63,4],[.68,5]]],
    ['attack2',false,[[.47,0],[.50,1],[.53,2],[.56,3],[.57,4],[.58,5],[.67,6]]],
    ['special',true,[[.45,0],[.50,1],[.55,2],[.58,3],[.62,4],[.64,5],[.66,6],[.68,7]]]
  ]) {
    scene.takiAction=action;
    scene.result={hit:true,crit,hpAfter:10};
    for(const [time,frame] of frames) {
      poses.length=0;
      scene._drawBattle(ctx,time,(time-.58)*1800);
      const pose=poses.at(-1);
      assert.equal(pose[8],'attack');
      assert.equal(pose[9],frame,'All three axe sequences synchronize their painted strike with damage');
      assert.equal(pose[10],action);
      assert.equal(pose[3],242);
      assert.equal(pose[6],0,'Authored axe rotation needs no procedural body tilt');
      if(time>=.62) assert(pose[2]>340,'Taki holds her ground until the swing finishes');
    }
  }
  for(const [time,state] of [[.3,'run'],[.75,'walk']]) {
    poses.length=0;
    scene._drawBattle(ctx,time,-100);
    assert.equal(poses.at(-1)[8],state);
  }
  calls.length=0;
  scene._drawAxeChop(ctx,.58,350,242,434,242);
  assert.equal(calls.length,0,'No second procedural axe slash covers the painted trails');
  scene.attacker={id:'shadow_blade_1',weapon:{type:'sword'}};
  scene.defender={id:'taki'};
  scene.result={hit:false,hpAfter:20};
  for(const [age,frame] of [[0,0],[210,3],[490,7]]) {
    poses.length=0;
    scene._drawBattle(ctx,.8,age);
    assert.equal(poses[0][8],'jump');
    assert.equal(poses[0][9],frame);
    assert.equal(poses[0][3],242);
    assert.equal(poses[0][6],0);
  }
  scene.result={hit:true,hpAfter:10};
  for(const [age,state,frame] of [[0,'hurt',0],[285,'hurt',3],[460,'idle2',null]]) {
    poses.length=0;
    scene._drawBattle(ctx,.8,age);
    assert.equal(poses[0][8],state);
    if(frame!==null) assert.equal(poses[0][9],frame);
  }
  scene.result={hit:true,hpAfter:0};
  for(const age of [140,330,540,750]) {
    poses.length=0;
    scene._drawBattle(ctx,.96,age);
    assert.equal(poses[0][8],'down');
    assert.equal(poses[0][9],Math.min(4,Math.floor((age-140)/95)));
    assert.equal(poses[0][3],242);
    assert.equal(poses[0][6],0);
  }
  // Exercise play(), not just drawing: normal attacks alternate, while demos
  // can select the overhead chop without advancing the real visual counter.
  const player=Object.create(window.MyGO.BattleScene.prototype);
  Object.assign(player,{_cancel(){},_setupDom(){},_draw(){}});
  const attacker={id:'taki',weapon:{type:'axe'}};
  const normal={hit:true,crit:false};
  player.play(attacker,{},normal,{freezeAt:.1});
  assert.equal(player.takiAction,'attack');
  const swordUser={id:'tomori',weapon:{type:'sword'}};
  player.play(swordUser,{},normal,{freezeAt:.1});
  assert.equal(player.tomoriAction,'attack');
  player.play(swordUser,{},normal,{freezeAt:.1});
  assert.equal(player.tomoriAction,'attack2');
  player.play(swordUser,{},normal,{freezeAt:.1,action:'attack2'});
  assert.equal(player.tomoriAttackCount,2);
  player.play(swordUser,{},normal,{freezeAt:.1});
  assert.equal(player.tomoriAction,'attack');
  player.play(attacker,{},normal,{freezeAt:.1});
  assert.equal(player.takiAction,'attack2');
  player.play(attacker,{},normal,{freezeAt:.1,action:'attack2'});
  assert.equal(player.takiAttackCount,2);
  player.play(attacker,{},normal,{freezeAt:.1});
  assert.equal(player.takiAction,'attack');
  const flights = [];
  chars.drawProjectile = (...args) => flights.push(args);
  scene.attacker = { id: 'soyo' };
  for (const t of [0.40, 0.50, 0.70]) scene._drawMagicOrb(ctx, t, 142, 242, 434, 242);
  assert.equal(flights.length, 1, 'Painted projectile only exists between release and impact');
  flights.length=0;
  scene.attacker={id:'anon'};
  for(const t of [.459,.46,.50,.579,.58,.70]) scene._drawBowShot(ctx,t,142,242,434,242);
  assert.equal(flights.length,3,'One painted arrow per render, only from release until impact');
  assert.equal(flights[0][2],196,'Arrow tail starts at the painted bow');
  assert(flights[0][2]<flights[1][2]&&flights[1][2]<flights[2][2],'Arrow travels continuously toward its target');
  assert(flights[2][2]<434);
  scene.attacker = { id: 'xueyue', weapon: { type: 'sword' } };
  scene.defender = { id: 'tomori' };
  for (const [action, crit, frames] of [
    ['attack', false, [[.51, 0], [.56, 1], [.58, 2], [.66, 3]]],
    ['attack2', false, [[.51, 0], [.56, 1], [.58, 2], [.66, 3]]],
    ['rush', true, [[.28, 0], [.40, 2], [.56, 4], [.58, 5], [.66, 6]]]
  ]) {
    scene.xueyueAction = action; scene.result = { hit: true, crit, hpAfter: 10 };
    for (const [time, frame] of frames) {
      poses.length = 0; scene._drawBattle(ctx, time, (time - .58) * 1800);
      const pose = poses.at(-1);
      assert.equal(pose[8], 'attack'); assert.equal(pose[9], frame);
      assert.equal(pose[10], action); assert.equal(pose[3], 242); assert.equal(pose[6], 0);
    }
  }
  scene.attacker = { id: 'tomori', weapon: { type: 'sword' } }; scene.defender = { id: 'xueyue' };
  scene.result = { hit: true, hpAfter: 0 };
  poses.length = 0; scene._drawBattle(ctx, .96, 684);
  assert.equal(poses[0][8], 'down'); assert.equal(poses[0][9], 4);
  player.play({ id: 'xueyue', weapon: { type: 'sword' } }, {}, normal, { freezeAt: .1 });
  assert.equal(player.xueyueAction, 'attack');
  player.play({ id: 'xueyue', weapon: { type: 'sword' } }, {}, normal, { freezeAt: .1 });
  assert.equal(player.xueyueAction, 'attack2');
  console.log('Character actions: 307 real frames across six characters; atlas/anchors/facing, genuine map directions, sword/lance/bow/axe/cast clocks, alternating swings, rush critical, hurt/jump/down and projectile checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
