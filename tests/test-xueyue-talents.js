'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const w={console,document:{readyState:'loading'},addEventListener(){}};w.window=w;vm.createContext(w);
for(const name of ['equipment-data','magic-data','inventory','class-data','config','chapter-three','chapter-four',
  'chapter-five','chapter-six','chapter-seven','chapter-eight','rng','growth-data','talents','growth','grid','pathfinding',
  'combat','game','ui','entry','loadout-ui'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',name+'.js'),'utf8'),w,{filename:name});
const M=w.MyGO,T=M.Talents,C=M.Combat,G=M.Growth,I=M.Inventory;let count=0;
function test(name,fn){fn();console.log('✓ '+name);count++;}
function game(){return new M.Game({stage:7,recruited:['nina','xueyue','nijika'],seed:4242});}
function level(u,n){while(u.level<n)G.award(u,G.required(u.level)-u.exp);u.hp=u.maxHp;return u;}
function equip(u,id){u.inventory=[I.make(id)];u.equippedWeapon=id;I.sync(u);}
function fixture(){
  const g=game();g.map={cols:24,rows:24,tiles:Array.from({length:24},()=>Array(24).fill('plain'))};
  Object.defineProperty(g.map,'units',{configurable:true,get:()=>g.units});
  g.units.forEach((u,i)=>Object.assign(u,{x:i%24,y:18+Math.floor(i/24),acted:false}));
  const x=level(g.getUnit('xueyue'),25),e=g.units.find(u=>u.side==='enemy');
  Object.assign(x,{x:4,y:4,str:12,dex:200,lck:0,spd:18,hp:999,maxHp:999});
  Object.assign(e,{x:5,y:4,str:5,dex:200,lck:200,spd:18,def:5,hp:999,maxHp:999});
  equip(x,'iron_sword');equip(e,'iron_sword');g.rng={int:()=>1,serialize:()=>4242};return {g,x,e};
}

test('雪月在15/20/25级依次觉醒，剑意换装即时生效且不写入永久力量',()=>{
  const g=game(),x=g.getUnit('xueyue');
  for(const [slot,name]of [[1,'剑意'],[2,'疾风'],[3,'冰霜剑气']]){
    level(x,T.levels[slot]-1);assert(!T.active(x,slot));
    const r=G.award(x,G.required(x.level)-x.exp);assert(T.active(x,slot));
    assert.equal(r.levels[0].awakenings.find(t=>t.slot===slot).name,name);
  }
  const base=x.str;equip(x,'iron_sword');assert.equal(C.strOf(x,g.map),base+3);
  for(const weapon of [I.weapons.iron_lance,I.weapons.unarmed,I.weapons.fire]){
    x.weapon=weapon;assert.equal(C.strOf(x,g.map),base);
  }
  equip(x,'iron_sword');for(let i=0;i<3;i++)T.sync(x);assert.equal(x.str,base);
  x.side='enemy';assert.equal(C.strOf(x,g.map),base);assert(!T.active(x,3));
});

test('剑意的伤害及负重计算与预告、实战一致；疾风不因读档、转职或跨章重复增加',()=>{
  const {g,x,e}=fixture();x.str=12;
  const before=C.preview(x,e,g.map);assert.equal(before.atkStat,15);
  assert.equal(C.attackSpeedOf(x,g.map),Math.max(0,C.speedOf(x)-Math.max(0,x.weapon.weight-3)));
  x.level=14;const locked=C.preview(x,e,g.map);assert.equal(before.damage,locked.damage+3);x.level=25;
  const r=g.rollCombat(x,e);assert.equal(r.strikes[0].atkStat,15);g.applyCombat(r);
  const h=game(),u=level(h.getUnit('xueyue'),25),spd=u.spd;
  assert.equal(spd,u.growthBase.stats.spd+u.growthGains.spd+2);
  const save=JSON.parse(JSON.stringify(h.serialize())),j=game();
  for(let n=0;n<3;n++){j.restore(save);assert.equal(j.getUnit('xueyue').spd,spd);}
  M.Classes.apply(u,'myrmidon');T.sync(u);assert.equal(u.spd,spd);
  const next=new M.Game({stage:8,recruited:['nina','xueyue','nijika'],loadout:h.exportLoadout(),seed:42});
  assert.equal(next.getUnit('xueyue').spd,spd);
});

test('冰霜剑气在交战后施加，锁定预演无副作用，本轮反击和追击保持原判定',()=>{
  const {g,x,e}=fixture(),speed=C.speedOf(e),forecast=C.forecast(x,e,g.map),r=g.rollCombat(x,e);
  assert(!e.status.frostSpeedDown);assert.equal(r.strikes.length,forecast.order.length);
  for(const hit of r.strikes.filter(s=>s.attackerId===e.id))assert.equal(hit.targetAvoid,C.preview(e,x,g.map).targetAvoid);
  g.applyCombat(r);assert.equal(e.status.frostSpeedDown,2);assert(!e.status.frostFresh);
  assert.equal(C.speedOf(e),speed-3);assert(r.strikes.some(s=>s.frostApplied));
  assert.throws(()=>g.applyCombat(r),/已结算/);
});

test('仅实际伤害触发，不因落空、零伤害、锁血、击杀、友军或未觉醒触发',()=>{
  for(const mode of ['miss','zero','floor','kill','locked']){
    const {g,x,e}=fixture();if(mode==='floor'){e.hp=e.hpFloor=1;}if(mode==='locked')x.level=24;
    const damage=mode==='miss'||mode==='zero'?0:mode==='kill'?9999:1;
    const r={attackerId:x.id,defenderId:e.id,hit:mode!=='miss',finalDamage:damage};g.applyCombat(r);
    assert(!e.status.frostSpeedDown,mode);assert(!r.frostApplied,mode);
  }
  const {g,x,e}=fixture(),friend=g.getUnit('tomori');
  assert(!T.afterDamage(x,friend,3,true,'player'));x.side='enemy';assert(!T.afterDamage(x,e,3,true,'enemy'));
});

test('主动命中持续两个敌方阶段，反击命中不消耗当前半回合，重复刷新不叠加',()=>{
  for(const counter of [false,true]){
    const {g,x,e}=fixture();if(counter)g.phase='enemy';
    g.applyCombat(g.rollCombat(counter?e:x,counter?x:e));assert.equal(e.status.frostSpeedDown,2);
    if(counter){assert.equal(e.status.frostFresh,1);g.beginNextPlayerPhase();assert.equal(e.status.frostSpeedDown,2);assert(!e.status.frostFresh);}
    g.beginEnemyPhase();assert.equal(e.status.frostSpeedDown,2);g.beginNextPlayerPhase();assert.equal(e.status.frostSpeedDown,1);
    g.beginEnemyPhase();assert.equal(e.status.frostSpeedDown,1);g.beginNextPlayerPhase();assert(!e.status.frostSpeedDown);
    const speed=C.speedOf(e);T.afterDamage(x,e,1,true,'player');g.expireStatuses('enemy');assert.equal(e.status.frostSpeedDown,1);
    T.afterDamage(x,e,1,true,'player');T.afterDamage(x,e,1,true,'player');assert.equal(e.status.frostSpeedDown,2);assert.equal(C.speedOf(e),speed-3);
    e.status.spdDown=1;assert.equal(C.speedOf(e),speed-5);g.expireStatuses('enemy');assert.equal(C.speedOf(e),speed-3);
  }
});

test('存档保留减速剩余回合和反击计时，拒绝无效状态，跨章清除临时减益',()=>{
  for(const state of [{frostSpeedDown:2},{frostSpeedDown:1},{frostSpeedDown:2,frostFresh:1}]){
    const g=game(),e=g.units.find(u=>u.side==='enemy');e.status={...state};
    const save=JSON.parse(JSON.stringify(g.serialize())),h=game();
    for(let n=0;n<3;n++){h.restore(save);assert.deepEqual({...h.getUnit(e.id).status},state);}
    const packed=I.pack(e),clone=I.copy(e);I.restore(clone,packed,true);assert(!clone.status.frostSpeedDown);assert(!clone.status.frostFresh);
    for(const bad of [{frostSpeedDown:0},{frostSpeedDown:3},{frostSpeedDown:'2'},{frostFresh:1},{frostSpeedDown:2,frostFresh:2}]){
      assert.throws(()=>I.restore(I.copy(e),{...packed,status:bad},false),/冰霜剑气/);
    }
  }
});

test('哈气忽略并清理冰霜减速，复原可以解除减速及计时标记',()=>{
  const {g,x}=fixture(),r=level(g.getUnit('rana'),20);
  assert(T.immune(r));assert(!T.afterDamage(x,r,5,true,'player'));
  r.status={frostSpeedDown:2,frostFresh:1};const spd=r.spd;assert.equal(C.speedOf(r),spd);T.sync(r);assert(!r.status.frostSpeedDown);assert(!r.status.frostFresh);
  const caster=level(g.getUnit('nijika'),25),target=g.getUnit('tomori');M.Classes.apply(caster,'priest');
  if(!caster.learnedSpells.includes('restore'))caster.learnedSpells.push('restore');caster.spellUses.restore=5;
  Object.assign(caster,{x:4,y:4});Object.assign(target,{x:5,y:4});target.status={frostSpeedDown:2,frostFresh:1};
  assert(g.supportTargets(caster,'restore').includes(target));g.castSupport(caster,'restore',target);
  assert(!target.status.frostSpeedDown);assert(!target.status.frostFresh);
});

test('雪月三档资料及装备剑时的力量加成显示完整',()=>{
  const g=game(),x=level(g.getUnit('xueyue'),25);equip(x,'iron_sword');
  const ctx={ui:{game:g},loadoutTab:'growth',players:()=>[x],selectedUnitId:x.id,dom:{formationDetail:{innerHTML:'',insertAdjacentHTML(_,html){this.innerHTML=html+this.innerHTML;}}},renderPoseDock(){}};
  M.EntryScreen.prototype.renderFormationDetail.call(ctx);
  for(const text of ['剑意','疾风','冰霜剑气','Lv.15','Lv.20','Lv.25'])assert(ctx.dom.formationDetail.innerHTML.includes(text),text);
  ctx.loadoutTab='stats';ctx.dom.formationDetail.querySelector=()=>null;M.EntryScreen.prototype.renderFormationDetail.call(ctx);
  assert(ctx.dom.formationDetail.innerHTML.includes('+3 剑意'));assert(ctx.dom.formationDetail.innerHTML.includes('力量 '+(x.str+3)));
});
console.log(count+' Xueyue talent tests passed.');
