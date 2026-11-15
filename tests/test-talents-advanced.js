'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const w={console,document:{readyState:'loading'},addEventListener(){}};w.window=w;vm.createContext(w);
for(const name of ['equipment-data','magic-data','inventory','class-data','config','chapter-three','chapter-four',
  'chapter-five','chapter-six','chapter-seven','chapter-eight','rng','growth-data','talents','growth','grid','pathfinding',
  'combat','game','ui','entry','loadout-ui'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',name+'.js'),'utf8'),w,{filename:name});
const M=w.MyGO,T=M.Talents,C=M.Combat,G=M.Growth;let count=0;
function test(name,fn){fn();console.log('✓ '+name);count++;}
function game(){return new M.Game({stage:7,recruited:['nina','xueyue','nijika'],seed:4242});}
function level(u,n){while(u.level<n)G.award(u,G.required(u.level)-u.exp);u.hp=u.maxHp;return u;}
function fixture(){const g=game();g.map={cols:24,rows:24,tiles:Array.from({length:24},()=>Array(24).fill('plain'))};
  Object.defineProperty(g.map,'units',{configurable:true,get:()=>g.units});g.units.forEach((u,i)=>Object.assign(u,{x:i%24,y:18+Math.floor(i/24),acted:false}));return g;}
function enemy(g){return g.units.find(u=>u.side==='enemy');}
function equip(u,id){u.inventory=[M.Inventory.make(id)];u.equippedWeapon=id;M.Inventory.sync(u);}

test('八人20/25级分别觉醒一次，升级报告含正确天赋槽位',()=>{
  const g=game();for(const slot of [2,3])for(const id of Object.keys(T.data)){
    const u=level(g.getUnit(id),T.levels[slot]-1);assert(!T.active(u,slot));
    const r=G.award(u,G.required(u.level)-u.exp),a=r.levels.flatMap(l=>l.awakenings).find(t=>t.slot===slot);
    assert(a,id+'/'+slot);assert.equal(a.name,T.get(u,slot).name);assert(T.active(u,slot));
    assert(!G.award(u,1).levels.length);
  }
  assert(!T.active({id:'tomori',side:'enemy',level:99},2));assert(!T.active({id:'taki',side:'enemy',level:99},3));
});
test('固定能力奖励独立于随机成长，旧档、转职与跨章重建均不叠加',()=>{
  const g=game(),expected={xueyue:{spd:2},tomori:{spd:2},soyo:{mag:2,res:2},taki:{def:1,res:1},anon:{dex:2},rana:{dex:2},nina:{dex:2},nijika:{}};
  for(const id of Object.keys(T.data)){
    const u=level(g.getUnit(id),25);for(const k of M.GrowthData.keys)assert.equal(u[k],u.growthBase.stats[k]+u.growthGains[k]+(expected[id][k]||0),id+'/'+k);
    for(let n=0;n<3;n++)T.sync(u);
  }
  const save=JSON.parse(JSON.stringify(g.serialize())),h=game();
  const next=new M.Game({stage:8,recruited:['nina','xueyue','nijika'],loadout:g.exportLoadout(),seed:9});
  for(let i=0;i<3;i++){h.restore(save);for(const id of Object.keys(T.data))for(const k of M.GrowthData.keys){assert.equal(h.getUnit(id)[k],g.getUnit(id)[k]);assert.equal(next.getUnit(id)[k],g.getUnit(id)[k]);}}
  const u=h.getUnit('anon'),dex=u.dex;M.Classes.apply(u,'archer');assert.equal(u.dex,dex);T.sync(u);assert.equal(u.dex,dex);
});
test('有在努力按每次经验结算向上取整，包含战斗和治疗，20级当次经验不追补',()=>{
  const g=game(),u=level(g.getUnit('tomori'),19);u.exp=G.required(19)-1;
  const unlock=G.award(u,1);assert.equal(unlock.gained,1);assert.equal(u.level,20);
  for(const [base,expected]of [[1,2],[5,6],[6,8],[35,42],[101,122]])assert.equal(G.award(u,base).gained,expected);
  assert.equal(G.award(u,7,2).gained,17);
  const cap=G.required(u.level);assert.equal(G.award(u,cap+100).gained,Math.ceil(cap*6/5));
  const f=fixture(),t=level(f.getUnit('tomori'),20),a=enemy(f);Object.assign(t,{x:4,y:4});Object.assign(a,{x:5,y:4,hp:999,maxHp:999});
  equip(t,'iron_sword');const before={...t},other={...a};const r=f.rollCombat(t,a);f.applyCombat(r);
  const damage=r.strikes.filter(s=>s.attackerId===t.id&&s.applied).reduce((n,s)=>n+s.hpBeforeApply-s.hpAfterApply,0);
  assert.equal(r.experience.find(x=>x.unitId===t.id).gained,Math.ceil(G.combatExp(before,other,damage,false)*6/5));
  const h=fixture(),caster=level(h.getUnit('tomori'),20),target=h.getUnit('anon');M.Classes.apply(caster,'priest');
  Object.assign(caster,{x:4,y:4});Object.assign(target,{x:5,y:4,hp:1});const base=G.supportExp(caster,'heal',h.turn);
  assert.equal(h.castSupport(caster,'heal',target).experience[0].gained,Math.ceil(base*6/5));
});
test('哈气阻止新能力削弱并忽略旧削弱，保留伤害、沉默及正常装备负重',()=>{
  const g=fixture(),u=level(g.getUnit('rana'),20),a=enemy(g);Object.assign(u,{x:4,y:4});
  const spd=C.speedOf(u),def=C.defenseOf(u,g.map,false),res=C.defenseOf(u,g.map,true),reach=g.getReachable(u).size;
  u.status={defDown:1,spdDown:1,moveDown:1,talentResDown:2};
  assert.equal(C.speedOf(u),spd);assert.equal(C.defenseOf(u,g.map,false),def);assert.equal(C.defenseOf(u,g.map,true),res);assert.equal(g.getReachable(u).size,reach);
  T.sync(u);assert.equal(Object.keys(u.status).length,0);
  for(const id of ['mire','swarm','banshee'])M.Inventory.useEffects(a,u,M.Magic.get(id),4,true);
  assert.equal(Object.keys(u.status).length,0);M.Inventory.useEffects(a,u,M.Magic.get('silence'),0,true);assert.equal(u.status.silence,1);
  u.level=19;M.Inventory.useEffects(a,u,M.Magic.get('swarm'),0,true);assert.equal(C.speedOf(u),Math.max(0,spd-5));
  u.level=20;equip(u,'steel_lance');assert(C.attackSpeedOf(u)<=C.speedOf(u));
});
test('威吓只减轻仁菜主动交战的敌方反击及追击，暴击后取整，预告与实战相符',()=>{
  const g=fixture(),n=level(g.getUnit('nina'),20),e=enemy(g);Object.assign(n,{x:4,y:4,str:0,spd:0,def:0,hp:999,maxHp:999,lck:0});
  Object.assign(e,{x:5,y:4,str:6,spd:20,hp:999,maxHp:999,dex:200,lck:200});equip(n,'iron_sword');equip(e,'iron_sword');
  const base=C.preview(e,n,g.map),p=C.forecast(n,e,g.map);assert.equal(p.counter.damage,Math.floor(base.damage*4/5));
  assert.equal(p.counter.critDamage,Math.floor(base.critDamage*4/5));
  const r=C.rollRound(n,e,g.map,{int:()=>1}),incoming=r.strikes.filter(s=>s.attackerId===e.id);assert(incoming.length>=2);
  for(const s of incoming){assert.equal(s.damageFactor,.8);assert.equal(s.finalDamage,Math.floor(base.critDamage*4/5));}
  const hp=n.hp;g.applyCombat(r);assert.equal(n.hp,hp-incoming.reduce((sum,s)=>sum+s.finalDamage,0));
  const reverse=C.forecast(e,n,g.map);assert.equal(reverse.damage,base.damage);n.level=19;assert.equal(C.forecast(n,e,g.map).counter.damage,base.damage);
});
test('妈妈守护增加单体及群体治疗射程，其他辅助和攻击魔法保持原射程',()=>{
  const g=fixture(),n=level(g.getUnit('nijika'),20),a=g.getUnit('tomori');M.Classes.apply(n,'priest');Object.assign(n,{x:4,y:4,mag:12});Object.assign(a,{x:7,y:4,hp:1});
  assert.equal(M.Magic.rangeOf(M.Magic.get('heal'),n)[1],3);assert(g.supportTargets(n,'heal').includes(a));
  a.x=8;assert(!g.supportTargets(n,'heal').includes(a));
  for(const [id,expected]of [['physic',8],['fortify',5],['ward',1],['warp',3],['fire',2]])assert.equal(M.Magic.rangeOf(M.Magic.get(id),n)[1],expected,id);
  n.level=19;assert.equal(M.Magic.rangeOf(M.Magic.get('heal'),n)[1],1);
});
test('量大管饱在药杖等修正后向上取整，与同心、群体治疗及射程加成配合',()=>{
  for(const spell of ['heal','fortify']){
    const g=fixture(),n=level(g.getUnit('nijika'),25),a=g.getUnit('tomori'),b=g.getUnit('soyo');M.Classes.apply(n,'priest');
    n.learnedSpells.push(...['fortify'].filter(id=>!n.learnedSpells.includes(id)));n.spellUses[spell]=5;
    n.inventory.push(M.Inventory.make('healing_staff'));n.equippedAccessory='healing_staff';M.Inventory.sync(n);
    Object.assign(n,{x:4,y:4,mag:9,hp:1,maxHp:100});Object.assign(a,{x:7,y:4,hp:1,maxHp:100});Object.assign(b,{x:4,y:5,hp:98,maxHp:100});
    const expected=Math.ceil((M.Magic.get(spell).might+3+10)*6/5);assert.equal(M.Magic.healAmount(M.Magic.get(spell),n),expected);
    const r=g.castSupport(n,spell,a);assert.equal(r.changes.find(c=>c.id===a.id).amount,expected);
    assert.equal(r.talentHealing,expected+(spell==='fortify'?2:0));assert.equal(n.hp,1+r.talentHealing);
  }
});
test('勇气赞歌仅主动交战增加力量3，含追击与负重计算，不写入基础力量',()=>{
  const g=fixture(),t=level(g.getUnit('tomori'),25),e=enemy(g);Object.assign(t,{x:4,y:4,str:12,spd:30});Object.assign(e,{x:5,y:4,spd:0,hp:999,maxHp:999});equip(t,'iron_sword');equip(e,'iron_sword');
  const p=C.forecast(t,e,g.map);assert.equal(p.atkStat,15);assert.equal(C.forecast(e,t,g.map).counter.atkStat,12);
  const r=C.rollRound(t,e,g.map,{int:()=>100});for(const s of r.strikes.filter(s=>s.attackerId===t.id))assert.equal(s.atkStat,15);assert.equal(t.str,12);
  assert.equal(C.attackSpeedOf(t,g.map,{initiatorId:t.id}),Math.max(0,t.spd-Math.max(0,t.weapon.weight-3)));
});
test('魔力打击在交战结束后削弱存活目标，不影响本轮追击，次轮开始清除；读档保留且不叠加',()=>{
  const g=fixture(),s=level(g.getUnit('soyo'),25),e=enemy(g);Object.assign(s,{x:4,y:4,mag:10,dex:200,lck:0,spd:30});Object.assign(e,{x:5,y:4,res:5,hp:999,maxHp:999,spd:0,lck:200});
  s.equippedWeapon='fire';M.Inventory.sync(s);equip(e,'iron_sword');const r=C.rollRound(s,e,g.map,{int:()=>1});
  assert(!e.status.talentResDown);for(const hit of r.strikes.filter(x=>x.attackerId==='soyo'))assert.equal(hit.defense,5);
  g.applyCombat(r);assert.equal(e.status.talentResDown,2);assert.equal(C.defenseOf(e,g.map,true),3);T.afterMagic(s,e,true,true);assert.equal(e.status.talentResDown,2);
  const packed=M.Inventory.pack(e),clone=M.Inventory.copy(e);clone.status={};M.Inventory.restore(clone,packed,false);assert.equal(clone.status.talentResDown,2);
  g.beginEnemyPhase();assert.equal(e.status.talentResDown,2);g.beginNextPlayerPhase();assert(!e.status.talentResDown);
  T.afterMagic(s,e,false,true);assert(!e.status.talentResDown);T.afterMagic(s,e,true,false);assert(!e.status.talentResDown);
  e.hp=0;e.dead=true;T.afterMagic(s,e,true,true);assert(!e.status.talentResDown);
});
test('护灯无距离限制，与紧邻守护叠加，任一角色倒下或离场即时失效',()=>{
  const g=fixture(),t=level(g.getUnit('taki'),25),lamp=g.getUnit('tomori');Object.assign(t,{x:4,y:4});Object.assign(lamp,{x:10,y:10});
  assert.equal(T.guardBonus(lamp,g.map),1);assert.equal(C.strOf(t,g.map),t.str+1);
  Object.assign(lamp,{x:5,y:4});assert.equal(T.guardBonus(lamp,g.map),2);assert.equal(T.guardBonus(t,g.map),0);
  for(const id of ['taki','tomori'])for(const flag of ['dead','escaped']){const u=g.getUnit(id);u[flag]=true;assert.equal(T.guardBonus(lamp,g.map),0);assert.equal(C.strOf(t,g.map),t.str);u[flag]=false;}
  lamp.hp=0;assert.equal(C.strOf(t,g.map),t.str);lamp.hp=lamp.maxHp;t.level=24;assert.equal(T.guardBonus(lamp,g.map),1);assert.equal(C.strOf(t,g.map),t.str);
});
test('幸福者退让在非攻击行动后可选相邻队友，交换一次并保留双方行动状态',()=>{
  const g=fixture(),a=level(g.getUnit('anon'),25),t=g.getUnit('tomori'),e=enemy(g);Object.assign(a,{x:4,y:4});Object.assign(t,{x:5,y:4,acted:false});Object.assign(e,{x:4,y:5});
  assert.equal(g.talentSwapTargets(a).length,0);g.markActed(a);assert(g.talentSwapTargets(a).includes(t));assert(!g.talentSwapTargets(a).includes(e));
  const r=g.talentSwap(a,t);assert.equal(r.targetId,t.id);assert.equal(a.x,5);assert.equal(t.x,4);assert(a.acted);assert(!t.acted);assert.equal(g.talentSwapTargets(a).length,0);assert.throws(()=>g.talentSwap(a,t));
  g.markActed(a);assert.equal(g.talentSwapTargets(a).length,0);
  g.resetActed('player');g.markActed(a,true);assert.equal(g.talentSwapTargets(a).length,0);
  g.resetActed('player');a.level=24;g.markActed(a);assert.equal(g.talentSwapTargets(a).length,0);
});
test('交换支持用药等非攻击行动、存档恢复、放弃与下回合重置，阻挡地形和斜角不可交换',()=>{
  const g=fixture(),a=level(g.getUnit('anon'),25),t=g.getUnit('tomori');Object.assign(a,{x:4,y:4,hp:1});Object.assign(t,{x:5,y:4});
  a.inventory.push(M.Inventory.make('vulnerary'));g.useMedicine(a,a.inventory.length-1);assert(g.talentSwapTargets(a).includes(t));
  g.map.tiles[4][5]='wall';assert(!g.talentSwapTargets(a).includes(t));g.map.tiles[4][5]='plain';t.y=5;assert(!g.talentSwapTargets(a).includes(t));t.y=4;
  for(const u of g.living('player'))u.acted=true;assert(!g.allPlayerActed());g.skipTalentSwap(a);assert(g.allPlayerActed());
  g.resetActed('player');g.markActed(a);g.beginEnemyPhase();assert.equal(g.talentSwapTargets(a).length,0);g.beginNextPlayerPhase();assert(!a.talentSwapReady);assert(!a.talentAttacked);
  const h=game(),anon=level(h.getUnit('anon'),25);h.markActed(anon);const save=JSON.parse(JSON.stringify(h.serialize())),j=game();j.restore(save);assert(j.getUnit('anon').talentSwapReady);
  h.skipTalentSwap(anon);j.restore(JSON.parse(JSON.stringify(h.serialize())));assert(!j.getUnit('anon').talentSwapReady);
});
test('三档天赋全部显示等级与锁定状态，未指定角色和敌人无额外天赋',()=>{
  const g=game(),u=level(g.getUnit('tomori'),20),ctx={loadoutTab:'growth',players:()=>[u],selectedUnitId:u.id,dom:{formationDetail:{innerHTML:''}},renderPoseDock(){}};
  M.EntryScreen.prototype.renderFormationDetail.call(ctx);const html=ctx.dom.formationDetail.innerHTML;
  for(const s of ['个人天赋1','个人天赋2','个人天赋3','Lv.20觉醒','Lv.25觉醒','有在努力','勇气赞歌','未觉醒','已觉醒'])assert(html.includes(s),s);
  assert.equal(T.list(g.getUnit('xueyue')).length,3);
  assert(T.list({id:'xueyue',side:'enemy',level:99}).every(t=>!t.active));
});
console.log(count+' advanced talent tests passed.');
