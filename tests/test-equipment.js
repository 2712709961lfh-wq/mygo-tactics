'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const window={};
for(const name of ['equipment-data','magic-data','inventory','class-data','class-mastery','config'])vm.runInNewContext(fs.readFileSync(path.join(root,'src',name+'.js'),'utf8'),{window});
const E=window.MyGO.Equipment;
let passed=0;
function test(name,fn){fn();passed++;console.log('  ✓ '+name);}
test('Playable basic weapons copy catalogue stats without mutating reference data',()=>{const w=window.MyGO.CONFIG.WEAPONS.iron_sword;assert.equal(w.hit,E.get(w.id).hit);assert.equal(w.weight,E.get(w.id).weight);assert.equal(w.might,E.get(w.id).might);});
test('130 unique entries: 43 families, 43 upgrades, 32 accessories and 12 supplies',()=>{
  assert.equal(E.items.length,130);assert.equal(new Set(E.items.map(i=>i.id)).size,130);
  assert.equal(E.items.filter(i=>i.kind==='weapon'&&i.edition==='base').length,43);
  assert.equal(E.items.filter(i=>i.edition==='forged').length,43);
  assert.equal(E.items.filter(i=>i.kind==='equipment').length,32);
  for(const id of ['sword_of_the_creator','thunderbrand','lance_of_ruin','freikugel','failnaught']){
    assert.equal(E.get(id),undefined);assert.equal(E.family(id).length,0);
  }
  assert(E.items.filter(i=>i.kind==='weapon').every(i=>i.rarity!=='relic'));
});
test('Iron Sword retains FE3H weapon Hit 90 rather than prototype additive Hit',()=>{
  const i=E.get('iron_sword');assert.equal(i.might,5);assert.equal(i.hit,90);assert.equal(i.uses,40);assert.equal(i.weight,5);
  const p=E.get('iron_sword_plus');assert.equal(p.hit,100);assert.equal(p.might,6);assert.equal(p.uses,45);
});
test('Forging changes range for Levin Sword and weight for Training Sword',()=>{
  assert.equal(E.get('levin_sword').range,'1-2');assert.equal(E.get('levin_sword_plus').range,'1-3');
  assert.equal(E.get('training_sword').weight,4);assert.equal(E.get('training_sword_plus').weight,2);
});
test('Zero Might gauntlets are preserved and equipment has no fabricated durability',()=>{
  assert.equal(E.get('training_gauntlets').might,0);assert.equal(E.get('training_gauntlets_plus').uses,90);
  for(const item of E.items.filter(i=>i.kind==='equipment')){assert.equal(item.uses,null);assert.equal(item.rank,null);}
});
test('Shields and magic staves retain different secondary equipment bonuses',()=>{
  const i=E.get('aegis_shield');assert.equal(i.protection,6);assert.equal(i.resilience,3);assert.equal(i.weight,6);
  assert.equal(E.get('hexlock_shield').resilience,4);assert.equal(E.get('magic_staff').category,'staff');assert.match(E.get('magic_staff').effect,/＋3/);
});
test('Every item has a local icon, safe source URL and valid stat schema',()=>{
  for(const item of E.items){
    assert.ok(fs.existsSync(path.join(root,'assets/equipment/icons',item.icon+'.png')),item.id);
    if(['weapon','equipment'].includes(item.kind))assert.match(item.source,/^https:\/\/www\.fe3h\.com\/(weapons|equipment)\/[a-z_\/]+$/);
    for(const key of item.kind==='weapon'?['might','hit','crit','weight','uses']:['weight','protection','resilience'])assert.ok(Number.isInteger(item[key])&&item[key]>=0,`${item.id}.${key}`);
    if(item.kind==='weapon')assert.match(item.range,/^[1-3](-[1-3])?$/);
  }
});
test('Search supports Chinese, English, plus signs and empty results',()=>{
  assert.equal(E.query({search:'铁剑+'})[0].id,'iron_sword_plus');assert.equal(E.query({search:'IRON SWORD+'})[0].id,'iron_sword_plus');
  assert.equal(E.query({search:'不存在的藏品'}).length,0);
});
test('Combined filters find A-rank magical gauntlets and exclude ordinary bows',()=>{
  const result=E.query({category:'gauntlet',rank:'A',special:'magic',edition:'base'});assert.equal(result.length,1);assert.equal(result[0].id,'aura_knuckles');
  assert.ok(E.query({category:'bow',special:'effective'}).every(i=>i.id!=='mini_bow'&&i.id!=='mini_bow_plus'));
});
test('Sorting uses numeric weight and might, and never changes source order',()=>{
  const ids=E.items.map(i=>i.id).join(',');
  const result=E.query({sort:'might',edition:'base'});assert.equal(result[0].id,'silver_axe');
  const light=E.query({sort:'weight'});assert.equal(light[0].weight,0);assert.equal(E.items.map(i=>i.id).join(','),ids);
});
test('Reference records and tags cannot be mutated through get/query',()=>{
  assert.throws(()=>{E.get('iron_sword').hit=5;},{name:'TypeError'});assert.throws(()=>{E.query({search:'Iron Sword'})[0].tags.push('changed');},{name:'TypeError'});
});
test('Every original icon has a CC0 provenance entry and SHA-256 hash',()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/equipment/manifest.json'),'utf8'));assert(manifest.length>=154);
  for(const source of manifest){assert.equal(source.license,'CC0-1.0');assert.match(source.sha256,/^[a-f0-9]{64}$/);assert.ok(fs.existsSync(path.join(root,'assets/equipment/originals',source.id+'.png')));}
});
console.log(`Equipment: ${passed} catalogue, source, filter, upgrade and isolation checks passed.`);
