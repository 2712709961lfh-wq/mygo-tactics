'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const world={console};world.window=world;vm.createContext(world);
for(const file of ['equipment-data','magic-data','inventory','class-data','class-mastery','config','chapter-three','chapter-four',
  'chapter-five','chapter-six','chapter-seven','chapter-eight','chapter-nine','chapter-ten','chapter-palace',
  'rng','growth-data','talents','growth','grid','pathfinding','combat','game']){
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',file+'.js'),'utf8'),world,{filename:file});
}
const M=world.MyGO,I=M.Inventory,plain=x=>JSON.parse(JSON.stringify(x));let count=0;
const early=['iron_sword','iron_lance','iron_axe','iron_bow','iron_gauntlets','vulnerary','beginner_seal','intermediate_seal','leather_shield'].sort();
const extra=['steel_sword','steel_lance','steel_axe','steel_bow','steel_gauntlets','iron_shield','concoction','antitoxin'].sort();
const available=g=>plain(M.Shop.stock(g).filter(p=>!p.locked&&p.id!==M.Shop.TICKET).map(p=>p.id).sort());
const fresh=stage=>new M.Game({stage,seed:1319,recruited:['xueyue','nina']});
const reload=g=>{const h=fresh(g.stage);h.restore(plain(g.serialize()));return h;};
function test(name,fn){fn();count++;console.log('✓ '+name);}
function completeSixth(g){g.applyCombat({attackerId:'soyo',defenderId:'masked_stranger',hit:true,finalDamage:999});assert(g.finishMaskedEscape());assert.equal(g.phase,'victory');}

test('第一至第五关及第六关战中只有九种初始商品，包含中级证，解毒药未提前开放',()=>{
  for(const stage of [1,2,3,4,5,6]){
    const g=fresh(stage);g.gold=999999;assert.deepEqual(available(g),early);
    for(const id of early){g.buyItem(id);assert.equal(g.convoy.at(-1).id,id);}
    const before=JSON.stringify(g.serialize());
    for(const id of extra)assert.throws(()=>g.buyItem(id),/尚未解锁/);
    assert.equal(JSON.stringify(g.serialize()),before);
    const h=reload(g);assert.equal(h.shopPurchases.intermediate_seal,1);assert.deepEqual(available(h),early);
  }
});
test('第六关真实离场通关后立即追加八种商品，保留当关已购额度，胜利读档保持解锁',()=>{
  const g=fresh(6);g.gold=999999;g.buyItem('intermediate_seal',2);g.buyItem('beginner_seal');
  assert(!M.Shop.steelUnlocked(g));completeSixth(g);assert(g.rewardedChapters.includes(6));
  assert.deepEqual(available(g),early.concat(extra).sort());
  assert.equal(M.Shop.remaining(g,M.Shop.get('intermediate_seal')),1);
  for(const id of extra){g.buyItem(id);assert.equal(g.convoy.at(-1).id,id);}
  const h=reload(g);assert.deepEqual(available(h),available(g));assert.equal(h.gold,g.gold);
  assert.equal(h.shopPurchases.intermediate_seal,2);assert.equal(h.convoy.length,g.convoy.length);
});
test('第七至第十关按真实章节号保持第二档，缺少通关记录的旧进度也能开放',()=>{
  for(const stage of [7,8,9,10,11]){
    const g=fresh(stage);assert.deepEqual(available(g),early.concat(extra).sort());
    const h=reload(g);assert.deepEqual(available(h),available(g));
    assert.equal(h.chapterNumber,stage===11?10:stage===10?9:stage);
  }
});
test('两种转职证各限购三张，读档和出售不补货，跨关补货且九关前后段不刷新',()=>{
  const g=fresh(6);g.gold=999999;
  for(const id of ['beginner_seal','intermediate_seal']){g.buyItem(id,3);assert.throws(()=>g.buyItem(id),/库存不足/);}
  g.sellItem(g.convoy.findIndex(i=>i.id==='intermediate_seal'));
  const h=reload(g);assert.equal(M.Shop.remaining(h,M.Shop.get('intermediate_seal')),0);
  completeSixth(h);assert.equal(M.Shop.remaining(h,M.Shop.get('intermediate_seal')),0);
  const next=new M.Game({stage:7,recruited:h.recruited,loadout:h.exportLoadout()});
  assert.equal(next.gold,h.gold);assert.equal(next.convoy.length,h.convoy.length);
  for(const id of ['beginner_seal','intermediate_seal']){assert.equal(M.Shop.remaining(next,M.Shop.get(id)),3);next.buyItem(id,3);}
  const nine=fresh(9);nine.gold=999999;nine.buyItem('intermediate_seal',2);
  nine.completeNinthIntro();nine.applyCombat({attackerId:'tomori',defenderId:'rift_pegasus',hit:true,finalDamage:999});
  const holder=nine.getUnit('tomori');Object.assign(holder,{x:13,y:3,acted:false});nine.useGateKey(holder);
  assert(nine.beginRehearsalFinale());assert.equal(nine.stage,10);assert.equal(nine.chapterNumber,9);
  assert.equal(M.Shop.remaining(nine,M.Shop.get('intermediate_seal')),1);
  const ten=new M.Game({stage:11,recruited:nine.recruited,loadout:nine.exportLoadout()});
  assert.equal(ten.chapterNumber,10);assert.equal(M.Shop.remaining(ten,M.Shop.get('intermediate_seal')),3);
});
test('非指定商品从购买货架移除且不可绕过购买，旧存档物品及限购仍能读取出售',()=>{
  const g=fresh(11);g.gold=999999;
  const hidden=M.Shop.products.filter(p=>!early.includes(p.id)&&!extra.includes(p.id)&&p.id!==M.Shop.TICKET);
  for(const p of hidden){assert(!M.Shop.stock(g).some(row=>row.id===p.id));assert.throws(()=>g.buyItem(p.id),/尚未解锁/);}
  g.convoy.push(I.make('silver_sword'),I.make('dancer_seal'));g.shopPurchases={dancer_seal:1,brave_sword:2};
  const h=reload(g);assert.equal(h.shopPurchases.dancer_seal,1);assert.equal(h.shopPurchases.brave_sword,2);
  const gold=h.gold;assert.equal(h.sellItem(h.convoy.findIndex(i=>i.id==='silver_sword')),780);assert.equal(h.gold,gold+780);
});
test('训练门票仍按第三关通关及累计额度运作，钢系解锁和每关补货不重置其额度',()=>{
  const g=fresh(6);g.gold=999999;g.rewardedChapters=[1,2,3,4,5];g.buyItem(M.Shop.TICKET,4);
  assert.equal(M.Shop.remaining(g,M.Shop.get(M.Shop.TICKET)),6);completeSixth(g);
  assert.equal(M.Shop.remaining(g,M.Shop.get(M.Shop.TICKET)),8);
  const next=new M.Game({stage:7,recruited:g.recruited,loadout:g.exportLoadout()});
  assert.equal(next.trainingTicketsPurchased,4);assert.equal(M.Shop.remaining(next,M.Shop.get(M.Shop.TICKET)),8);
});
console.log('Shop progression: '+count+' cases passed.');
