'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const world={console};world.window=world;vm.createContext(world);
for(const name of ['equipment-data','magic-data','inventory','class-data','class-mastery','config','chapter-three','chapter-four','rng','growth-data','growth','grid','pathfinding','combat','game'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',name+'.js'),'utf8'),world,{filename:name+'.js'});
const M=world.MyGO,I=M.Inventory,G=M.Growth,plain=x=>JSON.parse(JSON.stringify(x));let count=0;
function test(name,fn){fn();count++;console.log('✓ '+name);}
function level(u,target){while(u.level<target)G.award(u,G.required(u.level));}
function give(g,u,id){u.inventory.push(I.make(id));return u.inventory.length-1;}
function unchanged(g,fn,pattern){const before=JSON.stringify(g.serialize());assert.throws(fn,pattern);assert.equal(JSON.stringify(g.serialize()),before);}

test('新游戏运输队仅25瓶伤药及五种铁制基础武器，无旧高级装备或重复发放',()=>{
  for(const stage of [1,2,3,4]){const g=new M.Game({stage});assert.equal(g.convoy.length,30);
    assert.equal(g.convoy.filter(i=>i.id==='vulnerary'&&i.uses===3).length,25);
    assert.equal(g.convoy.filter(i=>i.id!=='vulnerary').map(i=>i.id).sort().join(','),'iron_axe,iron_bow,iron_gauntlets,iron_lance,iron_sword');
  }
});
test('五种药品和七种转职证具有原作参考数值与独立图标',()=>{
  assert.equal(M.Equipment.query({category:'medicine'}).length,5);assert.equal(M.Equipment.query({category:'seal'}).length,7);
  for(const [id,power] of [['vulnerary',10],['concoction',20],['elixir',99]]){assert.equal(I.item(id).uses,3);assert.equal(I.item(id).power,power);}
  assert.equal(I.item('pure_water').power,7);assert.equal(new Set(M.Codex?.items?.map(i=>i.icon)||M.Equipment.items.map(i=>i.icon)).size,M.Equipment.items.length);
});
test('药品按背包格使用，消耗次数并结束行动，最后一次自动清除',()=>{
  const g=new M.Game(),u=g.getUnit('tomori'),index=give(g,u,'vulnerary');u.hp=1;
  const r=g.useMedicine(u,index);assert.equal(r.healed,10);assert.equal(u.hp,11);assert.equal(u.inventory[index].uses,2);assert(u.acted);
  unchanged(g,()=>g.useMedicine(u,index),/未行动/);u.acted=false;u.hp=1;u.inventory[index].uses=1;
  g.useMedicine(u,index);assert.equal(u.inventory.length,1);
});
test('药品不超过最大HP，满血、敌方阶段、无效物品均不消耗',()=>{
  const g=new M.Game(),u=g.getUnit('tomori'),n=give(g,u,'elixir');
  unchanged(g,()=>g.useMedicine(u,n),/生命已满/);u.hp=u.maxHp-1;assert.equal(g.useMedicine(u,n).healed,1);
  u.acted=false;g.phase='enemy';unchanged(g,()=>g.useMedicine(u,n),/未行动/);
  g.phase='player';unchanged(g,()=>g.useMedicine(u,0),/不是可用药品/);
});
test('解毒药只解除中毒，圣水增加魔防且逐回合衰减，读档保留',()=>{
  const g=new M.Game(),u=g.getUnit('soyo'),a=give(g,u,'antitoxin'),w=give(g,u,'pure_water');
  unchanged(g,()=>g.useMedicine(u,a),/没有中毒/);u.status.poison=3;u.status.silence=1;
  g.useMedicine(u,a);assert(!u.status.poison);assert(u.status.silence);u.acted=false;
  const before=M.Combat.defenseOf(u,g.map,true);g.useMedicine(u,w);assert.equal(M.Combat.defenseOf(u,g.map,true),before+7);
  const h=new M.Game();h.restore(g.serialize());assert.equal(h.getUnit('soyo').status.ward,7);g.beginNextPlayerPhase();assert.equal(u.status.ward,6);
});
test('商店前期只开放铁制，其他旧商品不可提前购买',()=>{
  for(const stage of [1,2,3,4]){
    const g=new M.Game({stage});g.gold=99999;g.buyItem('iron_sword');assert.equal(g.convoy.at(-1).id,'iron_sword');
    for(const id of ['steel_sword','silver_sword','brave_sword','training_sword','dancer_seal'])unchanged(g,()=>g.buyItem(id),/尚未解锁/);
    for(const p of M.Shop.products)assert(Number.isInteger(p.price)&&p.price>0,p.id);
  }
});

test('购买原子校验金额、数量、空间与阶段，扣款并送运输队',()=>{
  const g=new M.Game(),before=g.gold,n=g.convoy.length;g.buyItem('vulnerary',3);
  assert.equal(g.gold,before-900);assert.equal(g.convoy.length,n+3);
  for(const q of [0,-1,1.5,NaN,100])unchanged(g,()=>g.buyItem('vulnerary',q),/数量/);
  g.gold=0;unchanged(g,()=>g.buyItem('iron_sword'),/资金/);
  g.gold=3000;g.convoy=Array.from({length:500},()=>I.make('vulnerary'));unchanged(g,()=>g.buyItem('vulnerary'),/容量/);
  g.phase='enemy';unchanged(g,()=>g.buyItem('vulnerary'),/我方/);
});
test('限购库存读档不能刷新，跨章补货且不重复给初始运输队与资金',()=>{
  const g=new M.Game({stage:2});g.gold=10000;g.buyItem('intermediate_seal',3);unchanged(g,()=>g.buyItem('intermediate_seal',3),/库存/);
  const h=new M.Game();h.restore(g.serialize());assert.equal(h.gold,g.gold);unchanged(h,()=>h.buyItem('intermediate_seal'),/库存/);
  const next=new M.Game({stage:3,loadout:g.exportLoadout()});assert.equal(next.gold,g.gold);assert.equal(next.convoy.length,g.convoy.length);next.buyItem('intermediate_seal');
});
test('出售按剩余耐久折价，钥匙禁止出售，不回补限购额度',()=>{
  const g=new M.Game(),n=g.convoy.findIndex(i=>i.id==='iron_sword');g.convoy[n].uses=20;
  const before=g.gold;assert.equal(g.sellItem(n),130);assert.equal(g.gold,before+130);
  g.convoy.push(I.make('courtyard_key'));unchanged(g,()=>g.sellItem(g.convoy.length-1),/不能出售/);
  g.buyItem('beginner_seal');g.sellItem(g.convoy.length-1);assert.equal(g.shopPurchases.beginner_seal,1);
});
test('通关奖励只发一次，重复检查及恢复胜利档不重复发钱',()=>{
  const g=new M.Game(),before=g.gold;g.units.filter(u=>u.side==='enemy').forEach(u=>{u.dead=true;u.hp=0;});g.checkOutcome();
  assert.equal(g.gold,before+2000);g.checkOutcome();assert.equal(g.gold,before+2000);
  const h=new M.Game();h.restore(g.serialize());h.checkOutcome();assert.equal(h.gold,g.gold);
});
test('旧有特效武器继续支持二连、克制与逐击耐久截断',()=>{
  const g=new M.Game({stage:4}),u=g.getUnit('tomori'),v=g.units.find(a=>a.side==='enemy');g.gold=10000;
  for(const p of M.Shop.products){assert(Number.isSafeInteger(p.price)&&p.price>0,p.id);assert(I.item(p.id),p.id);}
  g.convoy.push(I.make('brave_sword'));g.transferItem(u,g.convoy.length-1,false);I.equip(u,1);
  Object.assign(u,{x:3,y:3,spd:0,str:10});Object.assign(v,{x:4,y:3,spd:0});
  assert.equal(M.Combat.forecast(u,v,g.map).attackCount,2);
  assert.equal(M.Combat.forecast(v,u,g.map).counterCount,1);
  u.inventory.find(i=>i.id==='brave_sword').uses=1;assert.equal(M.Combat.forecast(u,v,g.map).attackCount,1);
  assert.equal(M.Combat.effectivenessAgainst(I.weapons.armorslayer,{tags:['armor']}),3);
  assert.equal(M.Combat.effectivenessAgainst(I.weapons.rapier,{tags:['cavalry']}),3);
  assert.equal(M.Combat.effectivenessAgainst(I.weapons.iron_bow,{tags:['flying']}),3);
  assert.equal(M.Combat.effectivenessAgainst(I.weapons.mini_bow,{tags:['flying']}),1);
  assert.equal(M.Combat.effectivenessAgainst(I.weapons.dragon_claws,{tags:['dragon']}),3);
});
test('普通职业只要求等级与对应证，不检查技能；成功消耗证件并更改移动和成长率',()=>{
  const g=new M.Game(),u=g.getUnit('tomori');g.convoy.push(I.make('intermediate_seal'));
  unchanged(g,()=>g.reclassUnit(u,'mercenary'),/Lv.10/);level(u,10);const old=u.hp;
  const before=M.Growth.rates(u);g.reclassUnit(u,'mercenary');assert.equal(u.classId,'mercenary');assert.equal(u.move,5);assert.equal(u.hp,old);assert(u.acted);
  assert(!g.convoy.some(i=>i.id==='intermediate_seal'));assert(u.certifiedClasses.includes('mercenary'));assert.notDeepEqual(plain(M.Growth.rates(u)),plain(before));
});
test('已取得资格可免费回切，跨章和新存档保存职业移动武器资格与成长',()=>{
  const g=new M.Game(),u=g.getUnit('rana');level(u,10);g.convoy.push(I.make('intermediate_seal'));g.reclassUnit(u,'cavalier');
  assert(u.tags.includes('cavalry'));assert.equal(u.move,7);u.acted=false;g.reclassUnit(u,'soldier');u.acted=false;g.reclassUnit(u,'cavalier');
  const h=new M.Game();h.restore(g.serialize());assert.equal(h.getUnit('rana').classId,'cavalier');assert.equal(h.getUnit('rana').move,7);
  const next=new M.Game({stage:2,loadout:g.exportLoadout()});assert.equal(next.getUnit('rana').classId,'cavalier');assert.equal(next.getUnit('rana').level,10);
});
test('保留性别与专用证件、前置资格；失败不消耗任何证件',()=>{
  const g=new M.Game(),u=g.getUnit('tomori');level(u,30);g.convoy.push(...['intermediate_seal','master_seal','dark_seal','abyssian_seal'].map(I.make));
  unchanged(g,()=>g.reclassUnit(u,'grappler'),/男性/);unchanged(g,()=>g.reclassUnit(u,'dark_bishop'),/男性/);
  unchanged(g,()=>g.reclassUnit(u,'dancer'),/舞者转职证/);unchanged(g,()=>g.reclassUnit(u,'trickster'),/盗贼/);
  g.reclassUnit(u,'thief');u.acted=false;g.reclassUnit(u,'trickster');assert.equal(u.classId,'trickster');assert(!g.convoy.some(i=>i.id==='abyssian_seal'));
});
test('舞者等级加舞者证，DLC最上级需30级和地下证',()=>{
  const g=new M.Game(),u=g.getUnit('soyo');level(u,10);g.convoy.push(I.make('dancer_seal'));g.reclassUnit(u,'dancer');assert.equal(u.move,6);
  u.acted=false;g.convoy.push(I.make('abyssian_seal'));unchanged(g,()=>g.reclassUnit(u,'dark_flier'),/Lv.30/);level(u,30);g.reclassUnit(u,'dark_flier');assert(u.tags.includes('flying'));
});
test('升级按阈值逐步学习，初始只火焰圣疗，报告列出新魔法且满次数',()=>{
  const g=new M.Game(),u=g.getUnit('soyo');assert.equal(u.learnedSpells.join(','),'fire,heal');level(u,7);assert(!u.learnedSpells.includes('torch'));
  const r=G.award(u,G.required(7));assert.equal(u.level,8);assert(u.learnedSpells.includes('torch'));assert.equal(r.levels[0].learned.join(','),'torch');assert.equal(u.spellUses.torch,10);
  u.spellUses.torch=2;I.learn(u);assert.equal(u.spellUses.torch,2);level(u,12);assert(u.learnedSpells.includes('thunder'));assert(!u.learnedSpells.includes('bolganone'));
});
test('高等级读档先恢复等级再重建法术，消耗次数不刷新，跨章恢复',()=>{
  const g=new M.Game(),u=g.getUnit('soyo');level(u,20);u.spellUses.bolganone=1;u.spellUses.fire=0;
  const h=new M.Game();h.restore(g.serialize());assert.equal(h.getUnit('soyo').spellUses.bolganone,1);assert.equal(h.getUnit('soyo').spellUses.fire,0);
  const next=new M.Game({stage:2,loadout:g.exportLoadout()});assert.equal(next.getUnit('soyo').spellUses.bolganone,5);assert.equal(next.getUnit('soyo').level,20);
});
test('未开放角色转魔法职业仍不学习法术，存档与跨章保持空表',()=>{
  const g=new M.Game(),u=g.getUnit('tomori');level(u,10);g.convoy.push(I.make('intermediate_seal'));g.reclassUnit(u,'mage');
  assert.equal(u.learnedSpells.length,0);assert(!I.options(u).includes('fire'));assert.equal(g.supportTargets(u,'heal').length,0);
  const h=new M.Game();h.restore(g.serialize());assert.equal(h.getUnit(u.id).learnedSpells.length,0);
  const next=new M.Game({stage:2,loadout:g.exportLoadout()});assert.equal(next.getUnit(u.id).learnedSpells.length,0);
});

test('旧档保留既有运输队，高级物品不被初始配置覆盖；旧职业和经济字段缺省可迁移',()=>{
  const g=new M.Game(),s=g.serialize();s.convoy=[I.make('silver_sword')];delete s.economy;for(const u of s.units){delete u.classState;delete u.mageTrained;}
  const h=new M.Game();h.restore(s);assert.equal(h.convoy.length,1);assert.equal(h.convoy[0].id,'silver_sword');assert.equal(h.gold,3000);
});
test('损坏的职业资格、商店库存和药品剩余次数会被拒绝',()=>{
  for(const change of [s=>s.economy.gold=-1,s=>s.economy.purchases.unknown=1,s=>s.economy.purchases.beginner_seal=99,s=>s.units[0].classState.id='gremory',s=>s.units[0].classState.certified.push('gremory'),s=>s.convoy[0].uses=4,s=>s.convoy[0].uses=0]){
    const s=new M.Game().serialize();change(s);assert.throws(()=>new M.Game().restore(s));
  }
});
console.log('Economy, medicine, reclass and spell learning: '+count+' cases passed.');
