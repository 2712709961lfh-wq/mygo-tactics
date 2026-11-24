'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const w={console,document:{readyState:'loading'},addEventListener(){}};w.window=w;vm.createContext(w);
for(const name of ['equipment-data','magic-data','inventory','class-data','class-mastery','config','chapter-three','chapter-four',
  'chapter-five','chapter-six','chapter-seven','chapter-eight','chapter-nine','chapter-ten','chapter-palace','rng','growth-data','talents','growth',
  'grid','pathfinding','combat','game','ui','entry','loadout-ui','training-ui'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',name+'.js'),'utf8'),w,{filename:name});
const M=w.MyGO,S=M.Magic,I=M.Inventory,G=M.Growth,plain=x=>JSON.parse(JSON.stringify(x));let count=0;
function test(name,fn){fn();count++;console.log('✓ '+name);}
function game(){const g=new M.Game({stage:10,recruited:['nina','xueyue'],seed:4242});g.completeTenthIntro();return g;}
function level(u,n){while(u.level<n)G.award(u,G.required(u.level)-u.exp);return u;}
const expected={
  soyo:[[5,'fire'],[5,'heal'],[8,'torch'],[9,'thunder'],[12,'nosferatu'],[12,'wind'],[18,'bolganone'],[21,'excalibur'],[23,'fimbulvetr'],[26,'meteor'],[28,'ragnarok'],[32,'agneas_arrow']],
  nijika:[[5,'heal'],[5,'nosferatu'],[10,'torch'],[12,'physic'],[15,'ward'],[18,'restore'],[18,'thoron'],[22,'recover'],[22,'seraphim'],[22,'rescue'],[25,'aura'],[25,'silence'],[26,'fortify'],[26,'bolting'],[28,'warp'],[33,'abraxas']],
  subaru:[[5,'heal'],[5,'miasma'],[8,'nosferatu'],[12,'ward'],[14,'banshee'],[16,'physic'],[18,'dark_spikes'],[20,'seraphim'],[24,'death'],[25,'luna'],[27,'fimbulvetr'],[35,'hades']]
};
const names=(id,lv)=>expected[id].filter(([level])=>level<=lv).map(([,id])=>id);

test('三人学习表完整精确、按等级排序且不可改写；虹夏覆盖全部14种白魔法',()=>{
  for(const [id,rows]of Object.entries(expected)){
    assert.deepEqual(plain(S.learningFor(id)),rows.map(([level,id])=>({level,id})));assert(Object.isFrozen(S.personalLearning[id]));
    assert.equal(new Set(rows.map(r=>r[1])).size,rows.length);assert(rows.every(r=>S.get(r[1])));
  }
  assert.deepEqual(names('nijika',99).filter(id=>S.get(id).school==='faith').sort(),Array.from(S.items.filter(s=>s.school==='faith'),s=>s.id).sort());
  assert.equal(S.get('agneas_arrow').name,'阿格尼尔之箭');assert.equal(S.items.length,36);
});

test('交接表等级及文字补充逐项一致，其他六人学习表为空，魔法基础数据不因备注改变',()=>{
  const handoff=JSON.parse(fs.readFileSync(path.join(__dirname,'../docs/research/magic-handoff-2026-11-24.json'),'utf8'));
  for(const [id,rows]of Object.entries(handoff.learning))assert.deepEqual(plain(S.learningFor(id)),rows,id);
  assert.equal(S.get('fire').might,3);assert.equal(S.get('fire').uses,10);assert.equal(S.get('meteor').uses,1);assert.equal(S.get('physic').uses,5);
  assert.equal(S.learningFor('soyo').find(r=>r.id==='wind').level,12);assert.equal(S.learningFor('soyo').find(r=>r.id==='meteor').level,26);
  assert.equal(S.learningFor('subaru').find(r=>r.id==='physic').level,16);
});

test('原v1通用法术旧档对六名停学角色清除法术、次数与魔法装备，转职升级跨章不补回',()=>{
  const g=game(),disabled=['tomori','anon','rana','taki','xueyue','nina'];
  for(const id of disabled){const u=level(g.getUnit(id),35);M.Classes.apply(u,'mage');}
  const snap=plain(g.serialize());for(const id of disabled){
    const u=snap.units.find(u=>u.id===id);u.spellLearningVersion=1;u.mageTrained=true;
    u.learnedSpells=Array.from(S.learning,r=>r.id);u.spellUses=Object.fromEntries(u.learnedSpells.map(id=>[id,S.get(id).uses]));u.equippedWeapon='fire';
  }
  const h=game();h.restore(snap);for(const id of disabled){
    const u=h.getUnit(id);assert.equal(u.learnedSpells.length,0);assert.equal(Object.keys(u.spellUses).length,0);assert.notEqual(u.weapon.kind,'spell');
    assert.equal(I.learn(u).length,0);G.award(u,G.required(u.level)-u.exp);assert.equal(u.learnedSpells.length,0);
    M.Classes.apply(u,'priest');assert.equal(u.learnedSpells.length,0);assert.equal(h.supportTargets(u,'heal').length,0);
  }
  const saved=plain(h.serialize());for(let n=0;n<3;n++){const j=game();j.restore(saved);for(const id of disabled)assert.equal(j.getUnit(id).learnedSpells.length,0);}
  const next=new M.Game({stage:11,recruited:h.recruited,loadout:h.exportLoadout()});for(const id of disabled)assert.equal(next.getUnit(id).learnedSpells.length,0);
});

test('v1存档在12级补学风刃、16级补学远程圣疗、26级补学陨石且保留其他消耗',()=>{
  for(const [id,lv,spell]of [['soyo',12,'wind'],['subaru',16,'physic'],['soyo',26,'meteor']]){
    const g=game(),u=level(g.getUnit(id),lv),snap=plain(g.serialize()),saved=snap.units.find(u=>u.id===id);
    saved.spellLearningVersion=1;saved.learnedSpells=saved.learnedSpells.filter(s=>s!==spell);delete saved.spellUses[spell];saved.spellUses.heal=1;
    const h=game();h.restore(snap);assert(h.getUnit(id).learnedSpells.includes(spell));assert.equal(h.getUnit(id).spellUses[spell],S.get(spell).uses);assert.equal(h.getUnit(id).spellUses.heal,1);
    assert.deepEqual(plain(G.pack(h.getUnit(id))),plain(G.pack(u)));
  }
});

test('九名角色仅按各自配置学习，35级前学齐，未开放角色保持空表，36级不再追加',()=>{
  assert(S.learning.every(r=>r.level<36));
  const g=game();for(const id of Object.keys(M.GrowthData.personal)){
    const u=level(g.getUnit(id),35);M.Classes.apply(u,'mage');
    assert(S.learningFor(u).every(r=>r.level<36),id);
    const all=Array.from(S.learningFor(u),r=>r.id).sort();assert.deepEqual(Array.from(u.learnedSpells).sort(),all,id);
    const r=G.award(u,G.required(u.level)-u.exp);assert.equal(r.levels[0].level,36);assert.equal(r.levels[0].learned.length,0,id);
  }
});

test('原专属表的35级存档自动补学提前法术，保留既有次数和成长，新档重复读不刷新',()=>{
  const g=game(),oldLate={soyo:['agneas_arrow'],nijika:['bolting','warp','abraxas'],subaru:['luna','hades']};
  for(const id of Object.keys(expected))level(g.getUnit(id),35);
  const snap=plain(g.serialize());for(const [id,missing]of Object.entries(oldLate)){
    const u=snap.units.find(u=>u.id===id);u.learnedSpells=u.learnedSpells.filter(spell=>!missing.includes(spell));
    for(const spell of missing)delete u.spellUses[spell];u.spellUses.heal=2;
  }
  const h=game();h.restore(snap);for(const [id,missing]of Object.entries(oldLate)){
    const u=h.getUnit(id);assert.deepEqual(Array.from(u.learnedSpells),names(id,35));assert.equal(u.spellUses.heal,2);
    for(const spell of missing){assert.equal(u.spellUses[spell],S.get(spell).uses);u.spellUses[spell]=0;}
    assert.deepEqual(plain(G.pack(u)),plain(G.pack(g.getUnit(id))));
  }
  const saved=plain(h.serialize());for(let n=0;n<3;n++){const j=game();j.restore(saved);for(const [id,spells]of Object.entries(oldLate))for(const spell of spells)assert.equal(j.getUnit(id).spellUses[spell],0);}
});

test('初始、未招募友军及加入队伍后均只学当前等级法术，昴以瘴气攻击',()=>{
  const g=game();for(const id of Object.keys(expected))assert.deepEqual(Array.from(g.getUnit(id).learnedSpells),names(id,g.getUnit(id).level));
  const ally=new M.Game({stage:10,recruited:['nina','xueyue']}).getUnit('subaru');assert.equal(ally.side,'ally');
  assert.deepEqual(Array.from(ally.learnedSpells),['heal','miasma','nosferatu','ward']);assert.equal(ally.weapon.id,'miasma');assert(!ally.learnedSpells.includes('fire'));
  const n=new M.Game({stage:7}).getUnit('nijika');assert.equal(n.side,'ally');assert.deepEqual(Array.from(n.learnedSpells),['heal','nosferatu']);
});

test('每个阈值前不会提前学习、达到时只报告新增法术，初次满次数且重复学习不刷新',()=>{
  const g=game();for(const id of Object.keys(expected)){
    const u=g.getUnit(id),initial=u.level;
    for(let lv=initial+1;lv<=43;lv++){
      const previous=new Set(u.learnedSpells),r=G.award(u,G.required(u.level)-u.exp);
      assert.equal(u.level,lv);assert.deepEqual(Array.from(u.learnedSpells),names(id,lv),id+'/'+lv);
      const learned=names(id,lv).filter(s=>!previous.has(s));assert.deepEqual(Array.from(r.levels.flatMap(l=>l.learned)),learned);
      for(const spell of learned){assert.equal(u.spellUses[spell],S.get(spell).uses);u.spellUses[spell]=0;I.learn(u);assert.equal(u.spellUses[spell],0);}
    }
  }
});

test('物理职业保留专属学习但不能施法，回魔法职业只补缺少项不重置次数；其他角色转职仍不可学',()=>{
  const g=game(),u=g.getUnit('soyo');M.Classes.apply(u,'myrmidon');level(u,18);
  assert(u.learnedSpells.includes('bolganone'));assert(!I.options(u).includes('fire'));u.spellUses.fire=0;
  M.Classes.apply(u,'mage');assert(I.options(u).includes('bolganone'));assert.equal(u.spellUses.fire,0);
  const other=level(g.getUnit('tomori'),20);M.Classes.apply(other,'mage');assert.equal(other.learnedSpells.length,0);
  assert.equal(S.learningFor(other).length,0);assert(!other.learnedSpells.includes('miasma'));
});

test('旧通用法术档按新表迁移，保留仍可学法术次数，补学满次数，移除退休法术并切换攻击',()=>{
  const g=game();for(const id of Object.keys(expected))level(g.getUnit(id),30);
  const snap=plain(g.serialize());
  for(const id of Object.keys(expected)){
    const saved=snap.units.find(u=>u.id===id);delete saved.spellLearningVersion;
    saved.learnedSpells=[...new Set(S.learning.filter(r=>r.level<=30).map(r=>r.id).concat(id==='nijika'?['nosferatu']:[]))];
    saved.spellUses=Object.fromEntries(saved.learnedSpells.map(id=>[id,S.get(id).uses]));saved.spellUses.heal=0;saved.spellUses.fire=2;saved.equippedWeapon='fire';
  }
  const h=game();h.restore(snap);
  for(const id of Object.keys(expected)){
    const u=h.getUnit(id),saved=snap.units.find(u=>u.id===id);assert.deepEqual(Array.from(u.learnedSpells),names(id,30));assert.equal(u.spellUses.heal,0);
    for(const spell of names(id,30))assert.equal(u.spellUses[spell],saved.learnedSpells.includes(spell)?saved.spellUses[spell]:S.get(spell).uses);
    assert.deepEqual(plain(G.pack(u)),plain(G.pack(g.getUnit(id))));
  }
  assert.notEqual(h.getUnit('subaru').weapon.id,'fire');assert.equal(h.getUnit('subaru').spellUses.fire,undefined);
  const current=plain(h.serialize());for(let n=0;n<3;n++){const j=game();j.restore(current);assert.deepEqual(plain(j.serialize()),current);}
});

test('当前档拒绝提前或表外法术、未知法术、非法次数与版本，旧档也不能夹带未知法术',()=>{
  for(const [unit,id]of [['soyo','thoron'],['subaru','fire'],['nijika','bolting'],['soyo','hades'],['soyo','unknown']]){
    const snap=plain(game().serialize());snap.units.find(u=>u.id===unit).learnedSpells.push(id);assert.throws(()=>game().restore(snap),/魔法/);
  }
  for(const value of [null,0,3,'1']){const snap=plain(game().serialize());snap.units.find(u=>u.id==='soyo').spellLearningVersion=value;assert.throws(()=>game().restore(snap),/魔法/);}
  const snap=plain(game().serialize()),u=snap.units.find(u=>u.id==='subaru');delete u.spellLearningVersion;u.learnedSpells=['fire','thunder','heal'];u.spellUses={fire:11,thunder:8,heal:10};assert.throws(()=>game().restore(snap),/次数/);
});

test('跨章保留专属法术与等级、补满次数；敌人仍只使用关卡配置',()=>{
  const g=game();for(const id of Object.keys(expected)){const u=level(g.getUnit(id),35);for(const spell of u.learnedSpells)u.spellUses[spell]=0;}
  const next=new M.Game({stage:11,recruited:g.recruited,loadout:g.exportLoadout(),seed:5});
  for(const id of Object.keys(expected)){const u=next.getUnit(id);assert.deepEqual(Array.from(u.learnedSpells),names(id,35));for(const spell of u.learnedSpells)assert.equal(u.spellUses[spell],S.get(spell).uses);}
  const enemy={...g.getUnit('subaru'),side:'enemy',level:99};I.init(enemy,{weapon:'fire',spells:['fire']});assert.deepEqual(Array.from(enemy.learnedSpells),['fire']);assert.equal(S.learningFor(enemy).length,0);
});

test('魔法资料页按角色展示学习表，不混入其他角色的学习等级',()=>{
  const g=game();for(const id of Object.keys(expected)){
    const u=g.getUnit(id),ctx={ui:{game:g},loadoutTab:'magic',players:()=>[u],selectedUnitId:id,loadoutLock:()=>'',drawPortrait(){},renderPoseDock(){},dom:{formationDetail:{innerHTML:'',querySelector:()=>null}}};
    M.EntryScreen.prototype.renderFormationDetail.call(ctx);const html=ctx.dom.formationDetail.innerHTML;
    assert(html.includes('角色专属学习表'));for(const [lv,spell]of expected[id])assert(html.includes('Lv.'+lv+' · '+S.get(spell).name));
    assert(!html.includes(id==='soyo'?'Lv.12 · 远程圣疗':id==='nijika'?'Lv.5 · 火焰':'Lv.10 · 雷电'));
  }
});

test('停学角色资料明确提示不开放，转职不再显示自动习得的说明',()=>{
  const g=game(),u=g.getUnit('tomori'),ctx={ui:{game:g},loadoutTab:'magic',players:()=>[u],selectedUnitId:u.id,loadoutLock:()=>'',drawPortrait(){},renderPoseDock(){},dom:{formationDetail:{innerHTML:'',querySelector:()=>null}}};
  M.EntryScreen.prototype.renderFormationDetail.call(ctx);const html=ctx.dom.formationDetail.innerHTML;
  assert(html.includes('暂未开放魔法学习'));assert(html.includes('转为魔法职业也不会自动习得'));
  assert(!html.includes('Lv.5 · 火焰'));assert(!html.includes('转为可使用魔法的职业后开始学习'));
});

(async()=>{
  const g=game(),u=g.getUnit('soyo');level(u,7);const report=G.award(u,G.required(u.level)-u.exp),ui=Object.create(M.UI.prototype),html=[];
  Object.assign(ui,{game:g,renderer:{floatText(){}},updateAll(){},openOverlay(s){html.push(s);}});
  const pending=ui.showGrowthResults([report]);assert.equal(html.length,1);assert(html[0].includes('成长的足迹'));ui.confirmHandler();
  await new Promise(resolve=>setImmediate(resolve));assert.equal(html.length,2);assert(html[1].includes('长崎爽世 · 习得新魔法'));assert(html[1].includes('Lv.8 · 照明'));assert(html[1].includes('每章 10 次'));
  ui.confirmHandler();await pending;count++;console.log('✓ 升级确认后独立弹窗显示新魔法等级、名称、次数与效果，确认后继续');
  level(u,9);const noLearn=G.award(u,G.required(u.level)-u.exp);const q=ui.showGrowthResults([noLearn]);assert.equal(html.length,3);ui.confirmHandler();await q;assert.equal(html.length,3);
  const multi={...report,levels:[{...report.levels[0],level:10,learned:['thunder','nosferatu']}]};
  const p=ui.showLearnedSpells(u,multi.levels);assert(html.at(-1).includes('雷电'));assert(html.at(-1).includes('吸取'));assert(html.at(-1).includes('威力 4'));ui.confirmHandler();await p;
  count++;console.log('✓ 没有新法术不额外弹窗，一次多个法术在同一提示中完整展示');
  const trainingUI=Object.create(M.UI.prototype),button={disabled:false,focus(){}},trainingHtml=[];let returned=0;
  M.entry={openRetreat(){returned++;},retreat:{announce(){}}};
  Object.assign(trainingUI,{game:{campaign:g,mission:{enemyCount:16},settle:()=>({complete:true,defeated:16,party:[{name:u.name,mastery:1,growth:report}]})},
    saveCheckpoint:()=>({ok:true}),openOverlay(s){trainingHtml.push(s);},dom:{overlayCard:{querySelector:()=>button}},switchTrainingGame(){}});
  trainingUI.showTrainingEnd();assert(trainingHtml[0].includes('训练完成'));const leave=button.onclick();assert(button.disabled);assert.equal(returned,0);
  assert(trainingHtml[1].includes('习得新魔法'));assert(trainingHtml[1].includes('照明'));trainingUI.confirmHandler();await leave;assert.equal(returned,1);
  count++;console.log('✓ 训练结算升级习得法术也显示独立提示，确认后返回营地');console.log(count+' personal magic tests passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
