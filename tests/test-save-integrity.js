'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const storage=new Map(),writes=[];
let blockedKey=null;
const w={console,document:{readyState:'loading'},addEventListener(){},setTimeout(){},clearTimeout(){},
  localStorage:{
    getItem:key=>storage.get(key)||null,
    setItem(key,value){
      if(key===blockedKey)throw Error('quota');
      writes.push(key);storage.set(key,String(value));
    },
    removeItem:key=>storage.delete(key)
  }};
w.window=w;vm.createContext(w);
for(const name of ['equipment-data','magic-data','inventory','class-data','class-mastery','config','chapter-three',
  'chapter-four','chapter-five','chapter-six','chapter-seven','chapter-eight','chapter-nine','chapter-ten',
  'chapter-palace','chapter-royal-garden','chapter-school','rng','growth-data','talents','growth','grid',
  'pathfinding','combat','game','training','save','ui','entry']){
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',name+'.js'),'utf8'),w,{filename:name});
}
const M=w.MyGO,key=M.CONFIG.SAVE_KEY,plain=value=>JSON.parse(JSON.stringify(value));
let count=0;
function test(name,run){storage.clear();writes.length=0;blockedKey=null;run();count++;console.log('✓ '+name);}
function party(stage=8){
  const game=new M.Game({stage,recruited:['xueyue','nina'],seed:8811});
  if(stage===7)game.joinNijika();
  if(stage===8)game.completeEighthIntro();
  for(const unit of game.living('player')){
    while(unit.level<16)M.Growth.award(unit,M.Growth.required(unit.level)-unit.exp);
    unit.exp=23;
  }
  return game;
}
function put(slot,snapshot,at){
  storage.set(key+slot,JSON.stringify({version:M.CONFIG.SAVE_VERSION,savedAt:at,snapshot:plain(snapshot)}));
}
function uiFor(game){
  const noop=()=>{},ui=Object.create(M.UI.prototype);
  Object.assign(ui,{game,renderer:{setGame(game){this.game=game;}},dom:{},closeOverlay:noop,resetSelection:noop,
    syncMission:noop,updateAll:noop,renderIdleInfo:noop,layoutBoard:noop,revealCell:noop,setZoom:noop,
    showBanner:noop,showToast:noop});
  return ui;
}
test('现代存档缺少任意或全部成长数据都会失败，旧版现代档也不会静默重置',()=>{
  const game=party();
  for(const legacy of [false,true])for(const all of [false,true]){
    const snapshot=plain(game.serialize());
    if(legacy)delete snapshot.growthVersion;
    for(const unit of snapshot.units)if(all||unit.id==='tomori')delete unit.growth;
    assert.throws(()=>new M.Game().restore(snapshot),/缺少.*成长数据/);
  }
  const snapshot=plain(game.serialize());snapshot.units=snapshot.units.filter(u=>u.id!=='tomori');
  assert.throws(()=>new M.Game().restore(snapshot),/单位数据|同伴数据/);
});
test('保存前校验失败时，原槽位与备份都保持完整',()=>{
  const manager=new M.SaveManager(),game=party();
  assert(manager.save(game).ok);game.turn=2;assert(manager.save(game).ok);
  const before=[storage.get(key),storage.get(key+':backup')],broken=plain(game.serialize());
  delete broken.units.find(u=>u.id==='soyo').growth;
  assert(!manager.save({serialize:()=>broken}).ok);
  assert.deepEqual([storage.get(key),storage.get(key+':backup')],before);
  const loaded=new M.Game();loaded.restore(manager.load().snapshot);
  for(const unit of game.living('player'))assert.deepEqual(plain(M.Growth.pack(loaded.getUnit(unit.id))),plain(M.Growth.pack(unit)));
});
test('损坏的最新自动档会回退完整手动档，两个主槽损坏时读取各自的上次备份',()=>{
  const manager=new M.SaveManager(),game=party();
  assert(manager.save(game).ok);game.turn=2;assert(manager.save(game).ok);
  assert(manager.save(game,{automatic:true}).ok);game.turn=3;assert(manager.save(game,{automatic:true}).ok);
  for(const [slot,at] of [[':backup','2026-11-25T00:00:00.000Z'],[':checkpoint:backup','2026-11-26T00:00:00.000Z']]){
    const payload=JSON.parse(storage.get(key+slot));payload.savedAt=at;storage.set(key+slot,JSON.stringify(payload));
  }
  const broken=plain(game.serialize());delete broken.units[0].growth;
  put(':checkpoint',broken,'2099-01-01T00:00:00.000Z');
  assert.equal(manager.load().slot,'manual');assert(manager.load().recoveryMessage);
  put('',broken,'2099-01-02T00:00:00.000Z');
  const recovered=manager.load();
  assert(recovered.ok);assert.equal(recovered.slot,'backup');assert(recovered.recoveryMessage);
  assert.equal(recovered.snapshot.turn,2);assert.equal(recovered.snapshot.units[0].growth.level,16);
  assert.equal(manager.load('backup').snapshot.units[0].growth.exp,23);
  assert(!manager.load('manual').ok);assert(!manager.load('automatic').ok);
  assert(manager.delete().ok);assert(!manager.hasSave());assert.equal(storage.size,0);
});
test('写入新档失败时保留原档和可读备份；写入备份失败时拒绝覆盖原档',()=>{
  const manager=new M.SaveManager(),game=party();assert(manager.save(game).ok);
  const original=storage.get(key);game.turn=2;blockedKey=key;
  assert(!manager.save(game).ok);assert.equal(storage.get(key),original);
  assert.equal(storage.get(key+':backup'),original);
  blockedKey=key+':backup';assert(!manager.save(game).ok);assert.equal(storage.get(key),original);
});
test('真实读档入口在独立页面状态恢复八人成长，重复保存读取不降级',()=>{
  const manager=new M.SaveManager(),game=party();game.turn=6;
  const expected=plain(game.living('player').map(u=>({id:u.id,growth:M.Growth.pack(u)})));
  assert(manager.save(game).ok);
  const ui=uiFor(new M.Game()),entry=Object.create(M.EntryScreen.prototype);
  Object.assign(entry,{ui,hideToGame(){},refreshSaveHint(){},setSaveStatus(message){throw Error(message);}});
  ui.saveManager=manager;
  for(let i=0;i<3;i++){
    entry.loadSave();
    assert.equal(ui.game.stage,8);assert.equal(ui.game.turn,6);assert.equal(entry.players().length,8);
    assert.deepEqual(plain(entry.players().map(u=>({id:u.id,growth:M.Growth.pack(u)}))),expected);
    assert(manager.save(ui.game).ok);
  }
});
test('重开第一、七、八关保留成长、职业、物品和资金，重新入队的虹夏也保留等级',()=>{
  for(const stage of [1,7,8]){
    const game=party(stage),unit=game.getUnit('tomori');
    M.Classes.apply(unit,'mercenary');unit.inventory[0].uses=17;game.gold=8765;
    const growth=plain(game.living('player').map(u=>[u.id,M.Growth.pack(u)])),ui=uiFor(game);
    ui.newGame(123);
    if(stage===7)ui.game.joinNijika();
    assert.equal(ui.game.turn,1);assert.equal(ui.game.stage,stage);assert.equal(ui.game.gold,8765);
    assert.equal(ui.game.getUnit('tomori').classId,'mercenary');
    assert.equal(ui.game.getUnit('tomori').inventory[0].uses,17);
    for(const [id,expected] of growth)assert.deepEqual(plain(M.Growth.pack(ui.game.getUnit(id))),expected);
    const restored=new M.Game();restored.restore(ui.game.serialize());
    assert.equal(restored.getUnit('tomori').level,16);
  }
});
console.log('Save integrity: '+count+' cases passed.');
