'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const w={console,document:{readyState:'loading'},addEventListener(){}};w.window=w;vm.createContext(w);
for(const name of ['equipment-data','magic-data','inventory','class-data','class-mastery','config','chapter-three','chapter-four',
  'chapter-five','chapter-six','chapter-seven','chapter-eight','rng','growth-data','talents','growth','grid','pathfinding',
  'combat','game','ui','entry','loadout-ui'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',name+'.js'),'utf8'),w,{filename:name});
const M=w.MyGO,T=M.Talents,C=M.Combat,G=M.Growth,I=M.Inventory,plain=x=>JSON.parse(JSON.stringify(x));let count=0;
function test(name,fn){fn();count++;console.log('✓ '+name);}
function game(){return new M.Game({stage:7,recruited:['nina','xueyue','nijika'],seed:4242});}
function level(u,n){while(u.level<n)G.award(u,G.required(u.level)-u.exp);u.hp=u.maxHp;return u;}
function equip(u,id){u.inventory=[I.make(id)];u.equippedWeapon=id;I.sync(u);}
function fixture(n=25){
  const g=game();g.map={cols:24,rows:24,tiles:Array.from({length:24},()=>Array(24).fill('plain'))};
  Object.defineProperty(g.map,'units',{configurable:true,get:()=>g.units});
  g.units.forEach((u,i)=>Object.assign(u,{x:i%24,y:18+Math.floor(i/24),acted:false}));
  const a=level(g.getUnit('nina'),n),e=g.units.find(u=>u.side==='enemy');
  Object.assign(a,{x:4,y:4,str:20,dex:200,lck:0,spd:30,hp:999,maxHp:999});
  Object.assign(e,{x:5,y:4,str:10,dex:200,lck:200,spd:0,def:4,res:4,hp:999,maxHp:999,cannotCounter:true});
  equip(a,'iron_gauntlets');equip(e,'iron_sword');return {g,a,e};
}
function noCrit(){let n=0;return {int:()=>++n%3===0?100:1};}

test('立希与虹夏在15/20级按新顺序解锁，自己与队友奖励互不提前生效',()=>{
  const g=game(),t=level(g.getUnit('taki'),14),n=level(g.getUnit('nijika'),14),lamp=g.getUnit('tomori');
  Object.assign(t,{x:4,y:4});Object.assign(lamp,{x:5,y:4});const def=t.def,res=t.res;
  const r=G.award(t,G.required(14)-t.exp);assert.equal(r.levels[0].awakened.name,'自我防备');
  assert.equal(t.def,def+r.levels[0].gains.def+4);assert.equal(t.res,res+r.levels[0].gains.res+4);
  assert.equal(T.guardBonus(lamp,g.map),0);level(t,19);assert.equal(T.guardBonus(lamp,g.map),0);
  const r2=G.award(t,G.required(19)-t.exp);assert.equal(r2.levels[0].awakened.name,'队友守护');assert.equal(T.guardBonus(lamp,g.map),4);
  const heal=M.Magic.get('heal');assert.equal(T.rangeBonus(n,heal),0);
  const r3=G.award(n,G.required(14)-n.exp);assert.equal(r3.levels[0].awakened.name,'妈妈守护');assert.equal(T.rangeBonus(n,heal),2);
  n.hp=1;assert.equal(T.onSupport(n,heal,[{amount:2}]),0);level(n,19);n.hp=1;assert.equal(T.onSupport(n,heal,[{amount:2}]),0);
  const r4=G.award(n,G.required(19)-n.exp);assert.equal(r4.levels[0].awakened.name,'同心');n.hp=1;assert.equal(T.onSupport(n,heal,[{amount:2}]),2);
});

test('幸运猫的必杀回避对所有攻击生效，未觉醒和敌方不生效；爆头弓限定',()=>{
  const {g,e}=fixture(),r=level(g.getUnit('rana'),15),a=level(g.getUnit('anon'),15);
  r.lck=3;e.dex=40;e.lck=0;for(const weapon of ['iron_sword','fire']){
    e.weapon=I.weapons[weapon];const p=C.preview(e,r,g.map);r.level=14;const q=C.preview(e,r,g.map);r.level=15;
    assert.equal(p.targetCritAvoid,8);assert.equal(p.crit,Math.max(0,q.crit-5));
  }
  assert.equal(T.critAvoidBonus({...r,side:'enemy'}),0);
  for(const weapon of ['iron_bow','iron_sword','fire']){
    a.weapon=I.weapons[weapon];const p=C.preview(a,e,g.map),dex=a.dex;a.level=14;const q=C.preview(a,e,g.map);a.level=15;
    assert.equal(p.baseCrit-q.baseCrit,weapon==='iron_bow'?10:0);assert.equal(p.hit,q.hit);assert.equal(a.dex,dex);
  }
});

test('魔力打击同时削弱双防，取最强减益且可存读档、复原、免疫与到期',()=>{
  const {g,e}=fixture(),s=level(g.getUnit('soyo'),25);e.def=12;e.res=13;
  const def=C.defenseOf(e,g.map,false),res=C.defenseOf(e,g.map,true);
  assert(T.afterMagic(s,e,true,true));assert.equal(C.defenseOf(e,g.map,false),def-5);assert.equal(C.defenseOf(e,g.map,true),res-5);
  e.status.defDown=1;assert.equal(C.defenseOf(e,g.map,false),def-5);
  e.status.masterySealDef=1;e.status.masterySealRes=1;assert.equal(C.defenseOf(e,g.map,false),def-6);assert.equal(C.defenseOf(e,g.map,true),res-6);
  const packed=I.pack(e),copy=I.copy(e);I.restore(copy,packed,false);assert.equal(C.defenseOf(copy,g.map,false),def-6);
  const r=level(g.getUnit('rana'),20);r.status.talentResDown=2;const rd=C.defenseOf(r,g.map,false),rr=C.defenseOf(r,g.map,true);T.sync(r);
  assert(!r.status.talentResDown);assert.equal(C.defenseOf(r,g.map,false),rd);assert.equal(C.defenseOf(r,g.map,true),rr);
  const caster=level(g.getUnit('nijika'),25),target=g.getUnit('tomori');M.Classes.apply(caster,'priest');
  caster.learnedSpells.push('restore');caster.spellUses.restore=3;Object.assign(caster,{x:4,y:4});Object.assign(target,{x:5,y:4,status:{talentResDown:2}});
  assert(g.supportTargets(caster,'restore').includes(target));g.castSupport(caster,'restore',target);assert(!target.status.talentResDown);
  delete e.status.defDown;delete e.status.masterySealDef;delete e.status.masterySealRes;g.beginEnemyPhase();g.beginNextPlayerPhase();
  assert.equal(C.defenseOf(e,g.map,false),def);assert.equal(C.defenseOf(e,g.map,true),res);
});

test('拳拳到肉逐击累积，预告显示四段递增，预演不改真实状态，确认只计一次',()=>{
  const {g,a,e}=fixture(),base=C.preview(a,e,g.map).damage,p=C.forecast(a,e,g.map),before=plain(g.serialize());
  assert.deepEqual(Array.from(p.order,s=>s.damage),[base,base+1,base+2,base+3]);
  const r=C.rollRound(a,e,g.map,noCrit());assert.equal(a.talentAttackCount,0);assert.deepEqual(plain(g.serialize()),before);
  assert.deepEqual(Array.from(r.strikes,s=>s.finalDamage),[base,base+1,base+2,base+3]);
  assert.deepEqual(Array.from(r.strikes,s=>s.talentDamageBonus),[0,1,2,3]);
  const hp=e.hp;g.applyCombat(r);assert.equal(e.hp,hp-(base*4+6));assert.equal(a.talentAttackCount,4);
  assert.throws(()=>g.applyCombat(r),/已结算/);assert.equal(a.talentAttackCount,4);
  const ui=Object.create(M.UI.prototype);Object.assign(ui,{game:g,getAttackUnit:()=>a,dom:{contextTitle:{},contextText:{}}});
  ui.showHoverForecast(e);assert(ui.dom.contextText.innerHTML.includes([base+4,base+5,base+6,base+7].join(' → ')));
});

test('拳拳到肉包括落空和反击，跨敌我阶段累积，新回合清零且不由再行动清零',()=>{
  const {g,a,e}=fixture();a.spd=0;e.spd=0;a.dex=-1000;
  const miss=C.rollRound(a,e,g.map,{int:()=>100});assert(miss.strikes.every(s=>!s.hit));g.applyCombat(miss);assert.equal(a.talentAttackCount,2);
  g.resetActed('player');assert.equal(a.talentAttackCount,2);g.beginEnemyPhase();assert.equal(a.talentAttackCount,2);
  a.dex=200;e.cannotCounter=false;const r=C.rollRound(e,a,g.map,noCrit()),counter=r.strikes.find(s=>s.attackerId===a.id);
  assert.equal(counter.talentDamageBonus,2);g.applyCombat(r);assert.equal(a.talentAttackCount,3);
  g.beginNextPlayerPhase();assert.equal(a.talentAttackCount,0);assert.equal(C.preview(a,e,g.map).talentDamageBonus,0);
});

test('拳拳到肉仅拳套或空手适用，其他攻击不加伤也不计次，换回拳套保留累积',()=>{
  const {g,a,e}=fixture();a.talentAttackCount=3;
  for(const id of ['iron_sword','iron_lance','iron_axe','iron_bow','fire','unarmed','iron_gauntlets','mastery_unarmed']){
    a.weapon=I.weapons[id];const p=C.preview(a,e,g.map);a.talentAttackCount=0;const q=C.preview(a,e,g.map);a.talentAttackCount=3;
    const allowed=['iron_gauntlets','mastery_unarmed'].includes(id);
    assert.equal(p.damage,q.damage+(allowed?3:0),id);assert.equal(p.critDamage,q.critDamage+(allowed?9:0),id);
    T.onAttack(a,e);assert.equal(a.talentAttackCount,allowed?4:3,id);a.talentAttackCount=3;
  }
  a.level=24;assert.equal(T.damageBonus(a),0);T.onAttack(a,e);assert.equal(a.talentAttackCount,3);
  a.level=25;a.side='enemy';assert.equal(T.damageBonus(a),0);T.onAttack(a,{...e,side:'player'});assert.equal(a.talentAttackCount,3);
});

test('拳套逐击加伤参与暴击倍率，锁定预演、暴击预告和实际扣血一致',()=>{
  const {g,a,e}=fixture();a.lck=400;const base=C.preview(a,e,g.map).critDamage,p=C.forecast(a,e,g.map);
  assert.deepEqual(Array.from(p.order,s=>s.critDamage),[base,base+3,base+6,base+9]);
  const r=C.rollRound(a,e,g.map,{int:()=>1});assert(r.strikes.every(s=>s.crit));
  assert.deepEqual(Array.from(r.strikes,s=>s.finalDamage),[base,base+3,base+6,base+9]);
  const hp=e.hp;g.applyCombat(r);assert.equal(e.hp,hp-(base*4+18));assert.equal(a.talentAttackCount,4);
});

test('空手格斗正常累积与暴击，不消耗耐久；换用剑后不累积也不享受加伤',()=>{
  const {g,a,e}=fixture();a.certifiedClasses.push('brawler');a.classXp.brawler=M.Mastery.get('brawler').required;
  M.Mastery.equip(a,'unarmed_combat');I.select(a,'mastery_unarmed');a.talentAttackCount=2;
  const bag=JSON.stringify(a.inventory),base=C.preview(a,e,g.map).damage-2,r=C.rollRound(a,e,g.map,noCrit());
  assert.deepEqual(Array.from(r.strikes,s=>s.finalDamage),[base+2,base+3,base+4,base+5]);
  g.applyCombat(r);assert.equal(a.talentAttackCount,6);assert.equal(JSON.stringify(a.inventory),bag);
  a.weaponTypes=['gauntlet','sword'];equip(a,'iron_sword');const sword=C.rollRound(a,e,g.map,noCrit());assert(sword.strikes.every(s=>s.talentDamageBonus===0));
  g.applyCombat(sword);assert.equal(a.talentAttackCount,6);I.select(a,'mastery_unarmed');assert.equal(T.damageBonus(a),6);
});

test('按实际出手武器判定，原装备不同或拳套末次耐久自动换装仍正确计次',()=>{
  for(const selected of ['iron_gauntlets','iron_sword']){
    const {g,a,e}=fixture();a.weaponTypes=['gauntlet','sword'];a.inventory.push(I.make('iron_sword'));a.equippedWeapon=selected==='iron_gauntlets'?'iron_sword':'iron_gauntlets';I.sync(a);
    const view=I.withAttackWeapon(a,selected),r=C.rollRound(view,e,g.map,noCrit());g.applyCombat(r);
    assert.equal(a.talentAttackCount,selected==='iron_gauntlets'?r.strikes.length:0);
  }
  const {g,a,e}=fixture();a.weaponTypes=['gauntlet','sword'];a.inventory[0].uses=1;a.inventory.push(I.make('iron_sword'));
  g.applyCombat(C.rollRound(a,e,g.map,noCrit()));assert.equal(a.weapon.id,'iron_sword');assert.equal(a.talentAttackCount,1);assert.equal(T.damageBonus(a),0);
});

test('最后耐久、击杀和锁血撤离只计算真正执行的攻击，取消预演不留累积',()=>{
  for(const mode of ['last-use','kill','floor']){
    const {g,a,e}=fixture();if(mode==='last-use')a.inventory[0].uses=1;else if(mode==='kill')e.hp=1;else e.hp=e.hpFloor=1;
    const first=C.rollRound(a,e,g.map,noCrit()),again=C.rollRound(a,e,g.map,noCrit());
    assert.equal(a.talentAttackCount,0);assert.equal(first.strikes.length,1);assert.equal(again.strikes[0].talentDamageBonus,0);
    g.applyCombat(first);assert.equal(a.talentAttackCount,1);
  }
});

test('拳拳到肉保存当前回合计数，旧档默认为零，跨章清除并校验非法计数',()=>{
  const g=game(),a=level(g.getUnit('nina'),25);a.talentAttackCount=5;const save=plain(g.serialize()),h=game();
  for(let i=0;i<3;i++){h.restore(save);assert.equal(h.getUnit('nina').talentAttackCount,5);assert.equal(T.damageBonus(h.getUnit('nina')),5);}
  const next=new M.Game({stage:8,recruited:g.recruited,loadout:g.exportLoadout(),seed:5});assert.equal(next.getUnit('nina').talentAttackCount,0);
  const legacy=plain(save);for(const u of legacy.units)delete u.talentAttackCount;h.restore(legacy);assert.equal(h.getUnit('nina').talentAttackCount,0);
  for(const value of [-1,1.5,'2',null,Number.MAX_SAFE_INTEGER+1]){const bad=plain(save);bad.units.find(u=>u.id==='nina').talentAttackCount=value;assert.throws(()=>game().restore(bad),/拳拳到肉/);}
  const bad=plain(save);bad.units.find(u=>u.id==='tomori').talentAttackCount=1;assert.throws(()=>game().restore(bad),/拳拳到肉/);
});

console.log(count+' talent rebalance tests passed.');
