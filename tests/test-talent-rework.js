'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const w={console,document:{readyState:'loading'},addEventListener(){}};w.window=w;vm.createContext(w);
for(const name of ['equipment-data','magic-data','inventory','class-data','class-mastery','config','chapter-three','chapter-four',
  'chapter-five','chapter-six','chapter-seven','chapter-eight','chapter-nine','chapter-ten','rng','growth-data','talents','growth',
  'grid','pathfinding','combat','game','ui','entry','loadout-ui'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',name+'.js'),'utf8'),w,{filename:name});
const M=w.MyGO,T=M.Talents,C=M.Combat,G=M.Growth,I=M.Inventory,plain=x=>JSON.parse(JSON.stringify(x));let count=0;
function test(name,fn){fn();count++;console.log('✓ '+name);}
function game(){const g=new M.Game({stage:10,recruited:['nina','xueyue'],seed:4242});g.completeTenthIntro();return g;}
function level(u,n){while(u.level<n)G.award(u,G.required(u.level)-u.exp);u.hp=u.maxHp;return u;}
function equip(u,id){u.weaponTypes=['sword','lance','axe','bow','gauntlet'];u.inventory=[I.make(id)];u.equippedWeapon=id;I.sync(u);}
function fixture(id,lv=25){const g=game();g.map={cols:24,rows:24,tiles:Array.from({length:24},()=>Array(24).fill('plain'))};
  Object.defineProperty(g.map,'units',{configurable:true,get:()=>g.units});
  g.units.forEach((u,i)=>Object.assign(u,{x:i%24,y:18+Math.floor(i/24),acted:false}));
  const a=level(g.getUnit(id),lv),e=g.units.find(u=>u.side==='enemy');
  Object.assign(a,{x:4,y:4,str:10,mag:10,dex:10,lck:0,spd:10,hp:999,maxHp:999});
  Object.assign(e,{x:5,y:4,str:10,dex:10,lck:0,spd:10,def:4,res:4,hp:999,maxHp:999});
  equip(a,'iron_sword');equip(e,'iron_sword');return {g,a,e};}
function rolls(values){let n=0;return {int(){assert(n<values.length,'unexpected roll '+n);return values[n++];}};}

test('哈气仅闪避后的本次交战反击加15必杀，命中与零伤害不算闪避，预告不提前触发',()=>{
  for(const dodge of [true,false]){
    const {g,a,e}=fixture('rana',20),base=C.preview(a,e,g.map).crit;
    const before=plain(g.serialize()),p=C.forecast(e,a,g.map);assert.equal(p.counter.crit,base);assert.equal(p.counter.critAfterDodge,Math.min(100,base+15));
    const r=C.rollRound(e,a,g.map,rolls([dodge?100:1,dodge?100:1,100,1,1,10]));
    const c=r.strikes.find(s=>s.attackerId===a.id);assert.equal(c.critChance,base+(dodge?15:0));assert.equal(c.haqiBonus,dodge?15:0);
    assert.equal(c.crit,dodge);assert.deepEqual(plain(g.serialize()),before);g.applyCombat(r);
    assert.equal(C.preview(a,e,g.map).crit,base);assert.equal(C.forecast(a,e,g.map).haqiBonus,0);
  }
  const {g,a,e}=fixture('rana',19);const r=C.rollRound(e,a,g.map,rolls([100,100,100,1,1,10]));assert.equal(r.strikes[1].haqiBonus,0);
});

test('哈气支持防守追击但不叠加，埋伏在闪避前出手不得加成',()=>{
  const {g,a,e}=fixture('rana',20);a.spd=30;
  const r=C.rollRound(e,a,g.map,rolls([100,100,100,1,1,100,1,1,100]));
  assert.deepEqual(Array.from(r.strikes.filter(s=>s.attackerId===a.id),s=>s.haqiBonus),[15,15]);
  a.masteryEquipped.push('vantage');a.hp=100;
  const v=C.rollRound(e,a,g.map,rolls([1,1,100,100,100,100,1,1,100]));
  assert.equal(v.strikes[0].attackerId,a.id);assert.equal(v.strikes[0].haqiBonus,0);assert.equal(v.strikes[2].haqiBonus,15);
});

test('勇气赞歌主动交战力量6命中50覆盖追击，反击与平时面板不加成',()=>{
  const {g,a,e}=fixture('tomori');a.spd=30;a.dex=-30;e.lck=200;
  const base=C.preview(a,e,g.map,{initiatorId:e.id}),p=C.forecast(a,e,g.map);
  assert.equal(p.atkStat,base.atkStat+6);assert.equal(C.hitOf(a,{initiatorId:a.id},e),C.hitOf(a,{},e)+50);
  const reverse=C.forecast(e,a,g.map);assert.equal(reverse.counter.atkStat,a.str);assert.equal(reverse.counter.hit,base.hit);
  const r=C.rollRound(a,e,g.map,{int:()=>100});for(const s of r.strikes.filter(s=>s.attackerId===a.id)){assert.equal(s.hitChance,p.hit);assert.equal(s.atkStat,p.atkStat);}
});

test('拿好武器按实际所用斧子提供命中10守备3，自我防备与护灯各5',()=>{
  const {g,a,e}=fixture('taki',20),lamp=g.getUnit('tomori');Object.assign(lamp,{x:5,y:5});
  assert.equal(a._talentBonuses.def,5);assert.equal(a._talentBonuses.res,5);assert.equal(T.guardBonus(lamp,g.map),0);
  equip(a,'iron_axe');const def=C.defenseOf(a,g.map,false),res=C.defenseOf(a,g.map,true),h=C.hitOf(a);
  a.level=19;assert.equal(C.defenseOf(a,g.map,false),def-3);assert.equal(C.defenseOf(a,g.map,true),res);assert.equal(C.hitOf(a),h-10);
  a.level=25;assert.equal(T.guardBonus(lamp,g.map),5);assert.equal(C.strOf(a,g.map),a.str+5);
  equip(a,'iron_sword');assert.equal(T.defBonus(a),0);assert.equal(T.hitBonus(a),5);
  const view=I.withAttackWeapon(a,'iron_axe');assert.equal(T.defBonus(view),3);assert.equal(T.hitBonus(view),15);
  lamp.escaped=true;assert.equal(C.strOf(a,g.map),a.str);assert.equal(T.guardBonus(lamp,g.map),0);
});

test('自信者光芒严格比较速度加技巧：低于才生效，相等、高于、未觉醒及友方无效',()=>{
  const {g,a,e}=fixture('anon');a.spd=20;a.dex=20;e.spd=20;e.dex=19;
  const p=C.preview(a,e,g.map),back=C.preview(e,a,g.map);assert(p.confident);
  assert.equal(p.weaponPower,Math.round(a.weapon.might*2*p.triangleMultiplier*p.effectiveness));
  const ownHit=C.hitOf(a,{},e),ownCrit=C.critRateOf(a,{},e),avoid=C.avoidOf(a,g.map,{},e);
  a.level=24;const q=C.preview(a,e,g.map);assert(!q.confident);assert.equal(ownHit,C.hitOf(a,{},e)+5);
  assert.equal(ownCrit,C.critRateOf(a,{},e)+5);assert.equal(avoid,C.avoidOf(a,g.map,{},e)+5);
  assert.equal(back.targetAvoid,C.preview(e,a,g.map).targetAvoid+5);
  a.level=25;for(const dex of [20,21]){e.dex=dex;assert(!T.confident(a,e));assert.equal(C.preview(a,e,g.map).weaponPower,q.weaponPower);}
  e.dex=19;assert(T.confident(a,e));e.side='player';assert(!T.confident(a,e));e.side='enemy';a.side='enemy';assert(!T.confident(a,{...e,side:'player'}));
});

test('自信者光芒主动和反击均生效，武器原始威力不变，魔法与特效同用一套计算',()=>{
  const {g,a,e}=fixture('anon');a.dex=40;a.spd=30;e.dex=0;e.spd=0;e.lck=200;
  for(const id of ['iron_bow','iron_sword','fire']){
    a.weapon=I.weapons[id];const original=a.weapon.might;
    const p=C.preview(a,e,g.map),q=C.forecast(e,a,g.map).counter;assert(p.confident);if(q)assert.equal(q.weaponPower,p.weaponPower);
    assert.equal(a.weapon.might,original);assert.equal(p.weaponPower,Math.round(original*2*p.triangleMultiplier*p.effectiveness));
  }
  equip(a,'iron_sword');const p=C.forecast(a,e,g.map),r=C.rollRound(a,e,g.map,{int:()=>100});
  for(const s of r.strikes.filter(s=>s.attackerId===a.id)){assert(s.confident);assert.equal(s.weaponPower,p.weaponPower);assert.equal(s.hitChance,p.hit);}
  a.status.spdDown=1;a.dex=0;e.spd=26;assert(!T.confident(a,e));
});

test('天使每次魔法必杀各治疗15，包括自己和友军，连续必杀可改变本次交战后续存活',()=>{
  const {g,a,e}=fixture('subaru');M.Classes.apply(a,'mage');a.equippedWeapon='fire';I.sync(a);
  Object.assign(a,{hp:1,maxHp:100,lck:400,dex:200,spd:30});Object.assign(e,{hp:999,maxHp:999,cannotCounter:true});
  const ally=g.getUnit('tomori'),other=g.getUnit('nijika');ally.hp=1;ally.maxHp=100;other.side='ally';other.hp=1;other.maxHp=100;
  const r=C.rollRound(a,e,g.map,{int:()=>1});assert.equal(r.strikes.length,2);assert(r.strikes.every(s=>s.angel));assert.equal(r.attackerHpAfter,31);assert.equal(ally.hp,1);
  g.applyCombat(r);assert.equal(a.hp,31);assert.equal(ally.hp,31);assert.equal(other.hp,31);assert.throws(()=>g.applyCombat(r));
  const f=fixture('subaru');M.Classes.apply(f.a,'mage');f.a.equippedWeapon='fire';I.sync(f.a);
  Object.assign(f.a,{hp:1,maxHp:100,lck:400,dex:200,spd:10,def:0});Object.assign(f.e,{spd:10,str:0});
  const x=C.rollRound(f.a,f.e,f.g.map,{int:()=>1});assert(x.strikes[0].angel);assert(x.strikes.some(s=>s.attackerId===f.e.id));assert(x.attackerHpAfter>0);
});

test('新版天使对物理必杀、落空和辅助法术不发动，满血无溢出，不复活离场角色',()=>{
  const {g,a,e}=fixture('subaru'),dead=g.getUnit('rana'),escaped=g.getUnit('tomori');
  dead.hp=0;dead.dead=true;escaped.hp=1;escaped.escaped=true;
  const hit={hit:true,crit:true,magic:true};assert.equal(T.onAngel(a,e,{...hit,magic:false},g.map),null);assert.equal(T.onAngel(a,e,{...hit,hit:false},g.map),null);
  assert.equal(T.onAngel(a,e,{...hit,crit:false},g.map),null);assert.equal(T.onAngel(a,e,hit,g.map),null);
  assert.equal(dead.hp,0);assert.equal(escaped.hp,1);
  a.hp=1;const heal=T.onAngel(a,e,hit,g.map);assert.equal(heal.healing.find(c=>c.id===a.id).amount,15);assert.equal(a.hp,16);
});

test('威吓精确按67%伤害向下取整，覆盖主动交战敌人反击、追击与暴击',()=>{
  const {g,a,e}=fixture('nina',20);a.spd=0;a.def=0;a.lck=0;e.spd=30;e.dex=400;e.str=20;
  const base=C.preview(e,a,g.map),p=C.forecast(a,e,g.map);assert.equal(p.counter.damage,Math.floor(base.damage*67/100));
  assert.equal(p.counter.critDamage,Math.floor(base.critDamage*67/100));
  const r=C.rollRound(a,e,g.map,{int:()=>1});const hits=r.strikes.filter(s=>s.attackerId===e.id);assert.equal(hits.length,2);
  for(const s of hits){assert.equal(s.damageFactor,.67);assert.equal(s.finalDamage,Math.floor(base.critDamage*67/100));}
  assert.equal(C.forecast(e,a,g.map).damage,base.damage);
});

test('天赋说明和角色资料显示新名称与新条件，旧换位入口关闭，存档不累加永久奖励',()=>{
  const g=game();for(const u of g.living('player'))level(u,25);
  assert.equal(T.get('taki',2).name,'拿好武器');assert.equal(T.get('anon',3).name,'自信者光芒');
  assert(T.get('subaru',3).description.includes('15 HP'));assert(T.get('tomori',3).description.includes('命中＋50'));
  const snap=plain(g.serialize());snap.units.find(u=>u.id==='anon').talentSwapReady=true;const h=game();
  for(let n=0;n<3;n++){h.restore(snap);assert(!h.getUnit('anon').talentSwapReady);assert.equal(h.getUnit('taki').def,g.getUnit('taki').def);assert.equal(h.getUnit('taki').res,g.getUnit('taki').res);}
});
console.log(count+' talent rework tests passed.');
