'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const w={console,document:{readyState:'loading'},addEventListener(){}};w.window=w;vm.createContext(w);
for(const name of ['equipment-data','magic-data','inventory','class-data','config','chapter-three','chapter-four',
  'chapter-five','chapter-six','chapter-seven','chapter-eight','rng','growth-data','talents','growth','grid','pathfinding',
  'combat','game','ui','entry','loadout-ui'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',name+'.js'),'utf8'),w,{filename:name});
const M=w.MyGO,T=M.Talents,C=M.Combat,G=M.Growth;let count=0;
function test(name,fn){fn();console.log('✓ '+name);count++;}
function game(){return new M.Game({stage:7,recruited:['nina','xueyue','nijika'],seed:4242});}
function level(u,n){while(u.level<n)G.award(u,G.required(u.level));u.hp=u.maxHp;return u;}
function fixture(){const g=game();g.map={cols:24,rows:24,tiles:Array.from({length:24},()=>Array(24).fill('plain'))};
  Object.defineProperty(g.map,'units',{configurable:true,get:()=>g.units});g.units.forEach((u,i)=>Object.assign(u,{x:i%24,y:18+Math.floor(i/24),acted:false}));return g;}
function enemy(g){return g.units.find(u=>u.side==='enemy');}
test('七个指定角色在15级觉醒，雪月和敌方幻影不获得未指定天赋',()=>{
  const g=game();assert.equal(Object.keys(T.data).length,7);
  for(const id of Object.keys(T.data)){const u=level(g.getUnit(id),14);assert(!T.active(u));
    const r=G.award(u,G.required(14));assert(T.active(u));assert.equal(r.levels[0].awakened.name,T.get(u).name);
    assert.equal(G.award(u,G.required(15)).levels[0].awakened,null);}
  assert(!T.get(g.getUnit('xueyue')));assert(!T.active({id:'tomori',side:'enemy',level:99}));
});
test('灯速度+2、爽世魔力+2，独立于随机成长且同步不叠加',()=>{
  const g=game();for(const [id,key]of [['tomori','spd'],['soyo','mag']]){
    const u=level(g.getUnit(id),14),before=u[key],r=G.award(u,G.required(14));
    assert.equal(u[key],before+r.levels[0].gains[key]+2);
    const expected=u[key];for(let i=0;i<4;i++)T.sync(u);assert.equal(u[key],expected);
    assert.equal(u[key],u.growthBase.stats[key]+u.growthGains[key]+2);
    if(id==='tomori')assert.equal(C.speedOf(u),u.spd);
    else {const b=enemy(g),p=C.preview(u,b,g.map);assert.equal(p.atkStat,u.mag);}
  }
});
test('觉醒旧档按等级重建，重复读取与跨章继承均不重复加属性',()=>{
  const g=game();for(const id of Object.keys(T.data))level(g.getUnit(id),15);
  const snapshot=JSON.parse(JSON.stringify(g.serialize())),next=new M.Game({stage:8,recruited:['nina','xueyue','nijika'],loadout:g.exportLoadout(),seed:5});
  const restored=game();for(let i=0;i<3;i++){
    restored.restore(snapshot);
    for(const id of Object.keys(T.data)){const a=g.getUnit(id),b=restored.getUnit(id),c=next.getUnit(id);
      assert(T.active(b));for(const k of M.GrowthData.keys){assert.equal(b[k],a[k],id+'/'+k);assert.equal(c[k],a[k]);}}
  }
  assert.equal(restored.map.units,restored.units);
});
test('幸运猫对物理和魔法攻击都增加5闪避百分点，未觉醒无加成',()=>{
  const g=fixture(),u=level(g.getUnit('rana'),14),a=enemy(g);
  const before=C.avoidOf(u,g.map);assert.equal(T.avoidBonus(u),0);u.level=15;
  assert.equal(C.avoidOf(u,g.map),before+5);
  for(const id of ['iron_sword','fire']){a.weapon=M.Inventory.weapons[id];a.dex=0;a.lck=0;
    const p=C.preview(a,u,g.map);u.level=14;const q=C.preview(a,u,g.map);u.level=15;
    assert.equal(p.targetAvoid,q.targetAvoid+5);assert.equal(p.hit,Math.max(M.CONFIG.COMBAT.minHit,q.hit-5));}
});
test('队友守护仅作用于紧邻队友，移动、倒下、撤离即时失效，预告与实战一致',()=>{
  const g=fixture(),t=level(g.getUnit('taki'),15),u=g.getUnit('tomori'),a=enemy(g);
  Object.assign(t,{x:5,y:5});Object.assign(u,{x:6,y:5});Object.assign(a,{x:7,y:5});
  for(const magic of [false,true]){
    a.weapon=M.Inventory.weapons[magic?'fire':'iron_sword'];
    const p=C.preview(a,u,g.map);t.x=4;const q=C.preview(a,u,g.map);t.x=5;
    assert.equal(p.defense,q.defense+1);assert.equal(C.defenseOf(u,g.map,magic),p.defense);
  }
  assert.equal(T.guardBonus(t,g.map),0);assert.equal(T.guardBonus(a,g.map),0);
  for(const delta of [[1,1],[2,0]]){Object.assign(u,{x:t.x+delta[0],y:t.y+delta[1]});assert.equal(T.guardBonus(u,g.map),0);}
  Object.assign(u,{x:6,y:5});for(const flag of ['dead','escaped']){t[flag]=true;assert.equal(T.guardBonus(u,g.map),0);t[flag]=false;}
  t.hp=0;assert.equal(T.guardBonus(u,g.map),0);t.hp=t.maxHp;t.level=14;assert.equal(T.guardBonus(u,g.map),0);t.level=15;
  a.weapon={...M.Inventory.weapons.iron_sword};a.inventory=[M.Inventory.make('iron_sword')];a.equippedWeapon='iron_sword';a.spd=0;u.spd=0;
  const r=C.rollRound(a,u,g.map,{int:()=>100});assert.equal(r.strikes[0].defense,C.preview(a,u,g.map).defense);
});
test('爆头只在弓箭出手时提供技巧+3，改变命中与暴击且不写入基础属性',()=>{
  const g=fixture(),u=level(g.getUnit('anon'),14);u.dex=10;u.lck=0;u.level=15;u.weapon=M.Inventory.weapons.iron_bow;
  assert.equal(C.dexOf(u),13);assert.equal(C.hitOf(u),u.weapon.hit+13);assert.equal(C.critRateOf(u),6+u.weapon.crit);assert.equal(u.dex,10);
  u.weapon=M.Inventory.weapons.iron_sword;assert.equal(C.dexOf(u),10);assert.equal(C.hitOf(u),u.weapon.hit+10);
  u.weapon=M.Inventory.weapons.fire;assert.equal(C.dexOf(u),10);u.level=14;u.weapon=M.Inventory.weapons.iron_bow;assert.equal(C.dexOf(u),10);
});
function killFixture(reverse=false){
  const g=fixture(),n=level(g.getUnit('nina'),15),e=enemy(g);
  Object.assign(n,{x:4,y:4,hp:n.maxHp-9,str:200,dex:200,spd:0,lck:200});
  Object.assign(e,{x:5,y:4,hp:1,maxHp:30,str:0,dex:0,spd:0,lck:200});
  for(const u of [n,e]){u.weapon={...M.Inventory.weapons.iron_sword,weight:0};u.inventory=[M.Inventory.make('iron_sword')];u.equippedWeapon='iron_sword';}
  if(reverse)g.phase='enemy';g.rng={int:()=>100,serialize:()=>4242};return {g,n,e};
}
test('战斗爽每次击破回复5HP，反击同样生效，预演不修改真实HP、确认只回复一次',()=>{
  for(const reverse of [false,true]){
    const {g,n,e}=killFixture(reverse),hp=n.hp,r=g.rollCombat(reverse?e:n,reverse?n:e);
    assert.equal(n.hp,hp);const kill=r.strikes.find(s=>s.attackerId==='nina');assert.equal(kill.talentHealed,5);
    g.applyCombat(r);assert.equal(n.hp,hp+5);assert(e.dead);assert.throws(()=>g.applyCombat(r),/已结算/);
  }
  const {g,n,e}=killFixture();n.hp=n.maxHp-2;const r=g.rollCombat(n,e);assert.equal(r.strikes[0].talentHealed,2);g.applyCombat(r);assert.equal(n.hp,n.maxHp);
  for(const hp of [1000,0]){const f=killFixture();f.e.hp=hp||1;f.e.maxHp=Math.max(hp,30);if(!hp)f.n.level=14;
    const q=f.g.rollCombat(f.n,f.e);assert.equal(q.strikes[0].talentHealed,0);}
  const f=killFixture();f.e.hpFloor=1;const q=f.g.rollCombat(f.n,f.e);assert.equal(q.strikes[0].talentHealed,0);
});
test('同心按实际治疗量回复自己，群疗合计一次、满血封顶、低于15级不触发',()=>{
  for(const spell of ['heal','fortify']){
    const g=fixture(),n=level(g.getUnit('nijika'),15),a=g.getUnit('tomori'),b=g.getUnit('soyo');
    M.Classes.apply(n,'priest');n.learnedSpells.push(spell);n.spellUses[spell]=5;
    Object.assign(n,{x:4,y:4,hp:n.maxHp-10});Object.assign(a,{x:5,y:4,hp:a.maxHp-2});Object.assign(b,{x:4,y:5,hp:b.maxHp-3});
    const before=n.hp,r=g.castSupport(n,spell,a);assert.equal(r.talentHealing,spell==='heal'?2:5);
    assert.equal(n.hp,before+r.talentHealing);assert(r.affected.includes('nijika'));assert.equal(n.spellUses[spell],4);
    assert(n.acted);assert.throws(()=>g.castSupport(n,spell,a),/目标无效/);
  }
  const g=fixture(),n=level(g.getUnit('nijika'),14),a=g.getUnit('tomori');M.Classes.apply(n,'priest');
  Object.assign(n,{x:4,y:4,hp:2});Object.assign(a,{x:5,y:4,hp:a.maxHp-2});
  const r=g.castSupport(n,'heal',a);assert.equal(r.talentHealing,0);assert.equal(n.hp,2);
  n.level=15;n.hp=n.maxHp-1;assert.equal(T.onSupport(n,M.Magic.get('heal'),[{amount:10}]),1);
  n.hp=1;assert.equal(T.onSupport(n,M.Magic.get('ward'),[{amount:10}]),0);
});
test('角色资料显示未觉醒/已觉醒与完整效果说明',()=>{
  const g=game(),u=g.getUnit('tomori');
  const ctx={loadoutTab:'growth',players:()=>[u],selectedUnitId:u.id,dom:{formationDetail:{innerHTML:''}},renderPoseDock(){}};
  M.EntryScreen.prototype.renderFormationDetail.call(ctx);assert(ctx.dom.formationDetail.innerHTML.includes('未觉醒'));assert(ctx.dom.formationDetail.innerHTML.includes('行动者'));
  level(u,15);M.EntryScreen.prototype.renderFormationDetail.call(ctx);assert(ctx.dom.formationDetail.innerHTML.includes('已觉醒'));
});
console.log(count+' talent tests passed.');
