'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'), source=fs.readFileSync(path.join(root,'src/combat-vfx.js'),'utf8');
function setup(fail=false,embedded=false) {
  let loads=0;
  class Image {set src(v){loads++;this.file=v;queueMicrotask(()=>fail?this.onerror():this.onload());}}
  const w={MyGO:{CONFIG:{},Assets:{},Characters:{hasActions:()=>true},WatercourtArt:{isArmored:()=>true}},
    MYGO_MAP_DATA:embedded?{combatVfx:'data:image/png;base64,AA=='}:{}};
  const safeMath=Object.create(Math);safeMath.random=()=>{throw Error('Effects must not consume random numbers');};
  const scope={window:w,Image,Math:safeMath,console};vm.createContext(scope);vm.runInContext(source,scope);
  vm.runInContext(fs.readFileSync(path.join(root,'src/battle.js'),'utf8'),scope);
  const calls=[],ctx={globalAlpha:1};
  for(const name of ['save','restore','translate','rotate','strokeText','fillText','beginPath','arc','fill','fillRect'])ctx[name]=(...args)=>calls.push([name,...args]);
  for(const name of ['createRadialGradient','createLinearGradient'])ctx[name]=(...args)=>{
    for(const value of args)assert(Number.isFinite(value));
    return {addColorStop(){}};
  };
  ctx.drawImage=(...args)=>{for(const v of args.slice(1))assert(Number.isFinite(v));calls.push(['drawImage',...args]);};
  return {fx:w.MyGO.CombatVfx,M:w.MyGO,ctx,calls,get loads(){return loads;}};
}
(async()=>{
  const a=setup();assert.equal(a.fx.magic(a.ctx,{},.5,0,0,100,100),false,'fallback until loaded');
  assert.strictEqual(a.fx.load(),a.fx.load(),'one shared preload');await a.fx.load();assert.equal(a.loads,1);
  const meta=JSON.parse(fs.readFileSync(path.join(root,'assets/effects/combat/combat-atlas.json')));
  assert.deepEqual(JSON.parse(JSON.stringify(a.fx.tracks)),meta.tracks);
  const png=fs.readFileSync(path.join(root,'assets/effects/combat/combat-atlas.png'));
  assert.equal(png.readUInt32BE(16),1024);assert.equal(png.readUInt32BE(20),4352);
  for(const [file,sha]of Object.entries(meta.inputs))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'assets/effects/combat/source',file))).digest('hex'),sha);
  for(const [name,spec]of Object.entries(meta.tracks)) {
    assert.equal(a.fx.frameAt(name,0),0);assert.equal(a.fx.frameAt(name,.999999),spec.count-1);
    for(const p of [-1,1,Infinity,NaN])assert.equal(a.fx.frameAt(name,p),-1);
  }
  const proto=a.M.BattleScene.prototype;
  for(const [id,kind,method]of [['tomori','sword','_drawSwordSlash'],['xueyue','sword','_drawSwordSlash'],
    ['taki','axe','_drawAxeChop'],['iron_warden','axe','_drawAxeChop'],['rana','lance','_drawLanceThrust'],['court-armor-n','lance','_drawLanceThrust']]) {
    a.calls.length=0;proto[method].call({attacker:{id}},a.ctx,.56,350,242,434,242);
    assert(a.calls.some(c=>c[0]==='drawImage'),id+' must receive new textures despite custom actor artwork');
  }
  const elementRows=new Set();
  a.calls.length=0;a.fx.weapon(a.ctx,'lance',.56,350,242,434,242);
  assert(a.calls.some(c=>c[0]==='fillRect'&&c[3]>=240),'lance must have a visibly extended speed trail');
  for(const element of ['fire','ice','wind','thunder','dark','light','arcane']) {
    const unit={id:'soyo',weapon:{type:'tome',element}};
    a.calls.length=0;proto._drawMagicOrb.call({attacker:unit},a.ctx,.52,142,242,434,242);
    assert(a.calls.some(c=>c[0]==='drawImage'));elementRows.add(a.calls.find(c=>c[0]==='drawImage')[3]);
    for(const t of [.461,.52,.579]) {
      a.calls.length=0;a.fx.magic(a.ctx,unit,t,142,242,434,242);
      const core=a.calls.filter(c=>c[0]==='arc'&&c[3]>=16&&c[3]<=18);
      assert.equal(core.length,1,'a large spherical core must remain visible throughout the whole flight');
      assert(core[0][1]>=176&&core[0][1]<=434,'ball must move from caster hand to target');
    }
    for(const t of [.1,.4599,.58,.9]) {
      a.calls.length=0;a.fx.magic(a.ctx,unit,t,142,242,434,242);
      if(t===.1||t>=.58)assert(!a.calls.some(c=>c[0]==='drawImage'),'no projectile outside release/impact window');
    }
    for(const hit of [false,true]) {
      a.calls.length=0;proto._drawImpact.call({attacker:unit,result:{hit,crit:false,finalDamage:8}},a.ctx,434,178,180,'tome');
      assert.equal(a.calls.some(c=>c[0]==='drawImage'),hit,'a miss never explodes');
      assert(a.calls.some(c=>c[0]==='fillText'&&c[1]===(hit?'-8':'MISS')),'damage/miss text preserved');
    }
    a.calls.length=0;a.fx.impact(a.ctx,unit,{hit:true},'tome',434,178,800);assert(!a.calls.some(c=>c[0]==='drawImage'),'animation must finish');
  }
  assert.equal(elementRows.size,7,'seven separately coloured projectile tracks');
  assert.equal(a.fx.elementOf({weapon:{element:'unknown'}}),'arcane');
  assert.equal(a.fx.weapon(a.ctx,'bow',.55,0,0,0,0),false,'bow retains authored arrow');
  const b=setup(true);assert.equal(await b.fx.load(),false);assert.equal(b.fx.weapon(b.ctx,'sword',.55,0,0,0,0),false,'asset failure retains procedural fallback');
  const e=setup(false,true);assert(await e.fx.load());e.fx.weapon(e.ctx,'sword',.55,350,242,434,242);
  assert(e.calls.find(c=>c[0]==='drawImage')[1].file.startsWith('data:'),'standalone uses embedded image');
  console.log('Combat VFX: 250 frame metadata, original hashes, custom actors, elements, hit/miss timing, fallback and embedded loading passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
