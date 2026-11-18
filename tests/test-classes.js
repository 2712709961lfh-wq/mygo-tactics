'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.join(__dirname, '..'), world = {console,addEventListener:()=>{},document:{readyState:'loading'}};
world.window = world; vm.createContext(world);
for (const name of ['equipment-data','magic-data','inventory','class-data','class-mastery','config','rng','growth-data','growth','grid','pathfinding','combat','game','ui','entry','loadout-ui'])
  vm.runInContext(fs.readFileSync(path.join(root,'src',name+'.js'),'utf8'),world,{filename:name+'.js'});
const M = world.MyGO, D = M.Classes;
const expected = {tomori:'myrmidon',anon:'fighter',rana:'soldier',soyo:'monk',taki:'fighter',xueyue:'myrmidon'};
let count = 0;
function test(name,fn) {fn(); count++; console.log('✓ '+name);}

test('44条职业无角色专属职业，DLC并入最上级，舞者归入中级',()=>{
  assert.equal(D.items.length,44); assert.equal(new Set(D.items.map(i=>i.id)).size,44);
  for (const [tier,n] of Object.entries({base:2,beginner:4,intermediate:12,advanced:12,master:14}))
    assert.equal(D.query(tier).length,n,tier);
  assert.equal(D.query('beginner').map(i=>i.name).join(','),'剑客,士兵,战士,修道士');
  assert.equal(D.get('archer').minLevel,10); assert.equal(D.get('cavalier').minLevel,10);
  assert.equal(D.get('brawler').gender,null);
  assert.equal(D.get('war_monk').gender,'男'); assert.equal(D.get('war_cleric').gender,'女');
  for (const id of ['lord','enlightened_one','armored_lord','emperor','high_lord','great_lord','wyvern_master','barbarossa','death_knight'])
    assert.equal(D.get(id),null,id);
  assert.equal(D.query('unique').length,0);assert.equal(D.query('dlc').length,0);
  assert.equal(D.tiers.length,5);
  assert.equal(D.get('dancer').tier,'intermediate');assert.equal(D.get('dancer').minLevel,10);
  assert.equal(D.get('dancer').requirements,'舞者转职证');
  const dlc=D.items.filter(i=>i.dlc);assert.equal(dlc.length,5);
  assert(dlc.every(i=>i.tier==='master'&&i.minLevel===30));
  assert.equal(D.get('no-such-class'),null);
  assert.throws(()=>D.get('fighter').tags.push('cavalry'),{name:'TypeError'});
});

test('两章六名主角按定位使用初级职业、4移动与独立标签，武器魔法不变',()=>{
  for (const stage of [1,2]) {
    const g = new M.Game({stage,recruited:['xueyue']});
    for (const [id,classId] of Object.entries(expected)) {
      const u=g.getUnit(id),t=M.CONFIG.UNITS.find(t=>t.id===id);
      assert.equal(u.classId,classId,id); assert.equal(u.className,D.get(classId).name);
      assert.equal(D.get(u.classId).tier,'beginner'); assert.equal(u.move,4); assert.equal(t.move,4);
      assert.equal(u.tags.length,0); assert.equal(u.weaponId,t.weapon); assert.equal(u.maxHp,t.maxHp);
      assert.equal(u.level,t.level);
    }
    assert.equal(g.getUnit('soyo').learnedSpells.join(','),'fire,heal');
    assert.equal(g.getUnit('soyo').spellUses.fire,10);
    assert(g.getUnit('shadow_lance').tags.includes('monster'));
  }
});

test('士兵实际移动范围为4，装备移动加成继续生效',()=>{
  const g=new M.Game(),u=g.getUnit('rana');
  g.map={cols:12,rows:12,tiles:Array.from({length:12},()=>Array(12).fill('plain'))};
  g.units=[u];u.x=5;u.y=5;
  const tiles=M.Pathfinding.getReachable(g.map,u,g.units);
  assert(tiles.has('9,5')); assert(!tiles.has('10,5')); assert(!tiles.has('5,10'));
  u.inventory.push(M.Inventory.make('march_ring'));g.equipItem(u,1);
  assert(M.Pathfinding.getReachable(g.map,u,g.units).has('10,5'));
  assert.equal(u.move,4); assert(!u.tags.includes('cavalry'));
});

test('读入旧档以新职业重建，保持动态进度，不接受伪造职业覆盖',()=>{
  const g=new M.Game(),u=g.getUnit('rana');u.hp=9;u.acted=true;u.inventory[0].uses=12;
  const s=g.serialize(),saved=s.units.find(u=>u.id==='rana');
  Object.assign(saved,{className:'枪骑士',classId:'paladin',move:99,tags:['cavalry']});
  const h=new M.Game();h.restore(s);const r=h.getUnit('rana');
  assert.equal(r.classId,'soldier');assert.equal(r.className,'士兵');assert.equal(r.move,4);
  assert.equal(r.hp,9);assert(r.acted);assert.equal(r.inventory[0].uses,12);
  assert.equal(r.x,u.x);assert.equal(r.y,u.y);assert(!r.tags.includes('cavalry'));
});

test('雪月招募及跨章读档继续使用剑客，背包继承正常',()=>{
  const first=new M.Game();
  for (const enemy of first.living('enemy')) first.applyCombat({defenderId:enemy.id,hit:true,finalDamage:999});
  const next=new M.Game({stage:2,recruited:first.recruited,loadout:first.exportLoadout()});
  const restored=new M.Game();restored.restore(next.serialize());
  const u=restored.getUnit('xueyue');assert.equal(u.side,'player');assert.equal(u.classId,'myrmidon');
  assert.equal(u.className,'剑客');assert.equal(u.move,4);assert.equal(u.weaponId,'iron_sword');
});

test('职业目录按角色标注当前职业，阶段筛选只显示所选阶段',()=>{
  const g=new M.Game(),ui=Object.create(M.EntryScreen.prototype);
  ui.ui={game:g,mode:'idle',busy:false};ui.players=()=>g.units.filter(u=>u.side==='player');
  ui.selectedUnitId='anon';ui.loadoutTab='classes';ui.renderPoseDock=()=>{};
  ui.dom={formationDetail:{innerHTML:''}};
  ui.renderFormationDetail();let html=ui.dom.formationDetail.innerHTML;
  assert.equal((html.match(/class="class-card/g)||[]).length,44);
  for (const text of ['职业目录','战士','Fighter','当前职业','弓箭手','无需技能等级考试']) assert(html.includes(text),text);
  ui.classTier='beginner';ui.renderFormationDetail();html=ui.dom.formationDetail.innerHTML;
  assert.equal((html.match(/class="class-card/g)||[]).length,4);
  assert(!html.includes('class="class-tier"><h4>高级'));assert(html.includes('value="beginner" selected'));
  ui.classTier='master';ui.renderFormationDetail();html=ui.dom.formationDetail.innerHTML;
  assert.equal((html.match(/class="class-card/g)||[]).length,14);
  for (const name of ['诈术师','战争僧侣','战争修女','暗天马骑士','瓦尔基里']) assert(html.includes(name));
  assert(!html.includes('value="unique"'));assert(!html.includes('value="dlc"'));assert(!html.includes('死神骑士'));
  ui.classTier='intermediate';ui.renderFormationDetail();html=ui.dom.formationDetail.innerHTML;
  assert(html.includes('舞者转职证'));assert(!html.includes('白鹭杯'));
});

test('职业阶段筛选和标签切换的真实事件会重绘职业目录',()=>{
  const listeners={};
  // Exercise the extension's event wiring without constructing browser UI.
  // The base bind needs actual DOM; its extension source is evaluated against
  // a minimal EntryScreen so the installed real listener can be tested alone.
  const mock={MyGO:{...M,EntryScreen:function(){},UI:function(){}}};mock.MyGO.EntryScreen.prototype.bind=()=>{};
  mock.MyGO.EntryScreen.prototype.renderFormationDetail=()=>{};
  vm.runInNewContext(fs.readFileSync(path.join(root,'src/loadout-ui.js'),'utf8'),{window:mock});
  const screen=Object.create(mock.MyGO.EntryScreen.prototype);
  screen.dom={formationDetail:{addEventListener:(name,fn)=>{listeners[name]=fn;},scrollTop:30}};
  let renders=0;screen.renderFormationDetail=()=>{renders++;};screen.bind();
  listeners.change({target:{matches:s=>s==='[data-class-tier]',value:'master'}});
  assert.equal(screen.classTier,'master');assert.equal(renders,1);
  listeners.click({target:{closest:()=>({dataset:{loadoutTab:'classes'}})}});
  assert.equal(screen.loadoutTab,'classes');assert.equal(renders,2);assert.equal(screen.dom.formationDetail.scrollTop,0);
});

test('所有页面和单文件构建都在角色配置之前加载职业数据',()=>{
  for (const name of ['index.html','map-preview.html','moon-map-preview.html','battle-preview.html']) {
    const html=fs.readFileSync(path.join(root,name),'utf8');
    assert(html.indexOf('src/class-data.js')>=0,name);
    assert(html.indexOf('src/class-data.js')<html.indexOf('src/config.js'),name);
  }
  const build=fs.readFileSync(path.join(root,'build-standalone.js'),'utf8');
  assert(build.indexOf("'src/class-data.js'")<build.indexOf("'src/config.js'"));
});
console.log('Classes: '+count+' cases passed.');
