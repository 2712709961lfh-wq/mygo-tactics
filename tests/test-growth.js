'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const world={console,document:{readyState:'loading'},addEventListener:()=>{}};world.window=world;vm.createContext(world);
for(const name of ['equipment-data','magic-data','inventory','class-data','config','chapter-three','chapter-four','chapter-five','chapter-six','chapter-seven','chapter-eight','chapter-nine','chapter-ten','rng','growth-data','growth','grid','pathfinding','combat','game','ui','entry','loadout-ui'])
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',name+'.js'),'utf8'),world,{filename:name+'.js'});
const M=world.MyGO,G=M.Growth,D=M.GrowthData;let count=0;
function test(name,fn){fn();count++;console.log('✓ '+name);}
function setup(){const g=new M.Game({seed:947}),a=g.getUnit('tomori'),b=g.getUnit('shadow_axe');
  g.map={cols:20,rows:20,tiles:Array.from({length:20},()=>Array(20).fill('plain'))};
  g.units.forEach((u,n)=>Object.assign(u,{x:n%20,y:Math.floor(n/20)+12}));Object.assign(a,{x:4,y:4});Object.assign(b,{x:5,y:4});return{g,a,b};}
function plain(v){return JSON.parse(JSON.stringify(v));}
test('原有八人成长率与新版Excel一致，昴采用新增作者配置',()=>{
  const expected={tomori:[45,35,30,50,55,45,25,30],anon:[35,35,20,55,50,35,25,35],rana:[40,35,35,40,60,45,30,35],soyo:[25,15,60,60,50,10,15,40],taki:[55,50,25,45,35,40,35,20],xueyue:[30,45,30,40,50,50,25,20],nina:[45,50,20,50,45,35,30,25],nijika:[45,30,35,35,35,50,35,40]};
  assert.equal(Object.keys(D.personal).length,9);assert.equal(D.keys.map(k=>D.personal.subaru.rates[k]).join(','),'40,20,50,45,45,40,25,40');for(const [id,values] of Object.entries(expected))assert.deepEqual(D.keys.map(k=>D.personal[id].rates[k]).join(','),values.join(','));
});
test('44个职业成长修正齐全，当前职业实际成长含负修正',()=>{
  for(const c of M.Classes.items)assert(D.classes[c.id],c.id);assert.equal(Object.keys(D.classes).length,44);
  const g=new M.Game();assert.equal(G.rates(g.getUnit('tomori')).maxHp,55);assert.equal(G.rates(g.getUnit('tomori')).spd,60);assert.equal(G.rates(g.getUnit('tomori')).res,25);
  assert.equal(G.rates(g.getUnit('soyo')).maxHp,30);assert.equal(G.rates(g.getUnit('soyo')).mag,60);assert.equal(G.rates(g.getUnit('soyo')).res,45);
});
test('升级门槛使用变动曲线，21至23级拐点和上限正确',()=>{for(const [lv,n] of [[1,100],[5,146],[10,235],[20,611],[21,672],[22,716],[23,752],[31,1111],[50,2809],[51,2950],[99,0]])assert.equal(G.required(lv),n,'Lv.'+lv);});
test('困难难度等级差表的断点与上下界正确',()=>{for(const [diff,n] of [[-30,0],[-20,0],[-19,.05],[-7,.05],[-6,.1],[-5,.2],[-1,.6],[0,.7],[1,.8],[4,.95],[5,1],[7,1],[8,1.05],[16,1.15],[20,1.5],[30,1.5]])assert.equal(G.hardFactor(diff),n,String(diff));});
test('击杀经验按兵种基数、敌等级、困难等级差与首领魔物修正计算',()=>{
  const a={level:5},e={level:5,maxHp:30,expClassBase:30,tags:[]};assert.equal(G.combatExp(a,e,30,true),30);
  assert.equal(G.combatExp(a,{...e,boss:true},30,true),59);assert.equal(G.combatExp(a,{...e,tags:['monster']},30,true),59);
  assert.equal(G.killExp(a,{...e,boss:true,tags:['monster']}),G.killExp(a,{...e,boss:true}));assert.equal(G.combatExp({level:25},e,30,true),0);
});
test('未击杀按本场实际伤害占最大HP折算，零伤害零经验',()=>{const a={level:5},e={level:5,maxHp:30,expClassBase:30,tags:[]};assert.equal(G.combatExp(a,e,15,false),8);assert.equal(G.combatExp(a,e,0,false),0);assert.equal(G.combatExp(a,{...e,maxHp:60},15,false),4);});
test('辅助经验按施法者等级和类型计算，一次范围施法只给一份',()=>{const a={level:5};for(const [id,n] of [['heal',14],['physic',21],['ward',21],['restore',21],['rescue',28],['silence',28],['fortify',42],['warp',42],['fire',0]])assert.equal(G.supportExp(a,id,1),n,id);});
test('辅助经验随21至61回合的分段衰减且向上取整',()=>{for(const [turn,n] of [[20,1],[21,.95],[25,.95],[26,.9],[35,.85],[40,.8],[45,.7],[50,.6],[55,.5],[60,.4],[61,.3],[100,.3]])assert.equal(G.turnFactor(turn),n);assert.equal(G.supportExp({level:15},'physic',21),35);});
test('升级逐项随机，100%以上保证整数部分，零成长不增加',()=>{const u={id:'soyo',classId:'monk'};const success=G.rollLevel(u,{int:()=>0}),failThenSuccess={n:0,int(){return this.n++<8?99:0;}};
  assert(D.keys.every(k=>success[k]===1));assert(D.keys.every(k=>G.rollLevel(u,failThenSuccess)[k]>=0));
  const fake={MyGO:{GrowthData:{...D,personal:{fake:{rates:{maxHp:150,str:100}}}}}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/growth.js'),'utf8'),{window:fake});
  const gains=fake.MyGO.Growth.rollLevel({id:'fake'},{int:()=>49});assert.equal(gains.maxHp,2);assert.equal(gains.str,1);assert.equal(gains.mag,0);
});
test('九名同伴每次升级至少两项，移动不随升级增长',()=>{for(const id of Object.keys(D.personal)){const g=new M.Game({stage:id==='subaru'?10:id==='nijika'?7:3,recruited:['xueyue'],seed:76}),u=g.getUnit(id);u.side='player';const move=u.move;for(let n=0;n<20;n++){const report=G.award(u,G.required(u.level));assert.equal(report.levels.length,1);assert(Object.values(report.levels[0].gains).filter(n=>n>0).length>=2);}assert.equal(u.move,move);}});
test('仁菜战士成长使用新数据，招募后升级与经验可完整读档',()=>{
  const g=new M.Game({stage:3,recruited:['xueyue'],seed:46}),n=g.getUnit('nina');
  assert.equal(D.keys.map(k=>G.rates(n)[k]).join(','),'55,55,20,50,45,35,30,20');
  assert.equal(G.award(n,100),null);
  for(const e of g.living('enemy')){e.dead=true;e.hp=0;}g.checkOutcome();
  assert.equal(n.side,'player');G.award(n,G.required(n.level));n.exp=37;
  const h=new M.Game();h.restore(g.serialize());assert.deepEqual(plain(G.pack(h.getUnit('nina'))),plain(G.pack(n)));
  assert.equal(h.getUnit('nina').level,8);
  const ui=Object.create(M.EntryScreen.prototype);Object.assign(ui,{ui:{game:h},players:()=>h.living('player'),selectedUnitId:'nina',loadoutTab:'growth',renderPoseDock:()=>{},dom:{formationDetail:{innerHTML:''}}});
  ui.renderFormationDetail();const html=ui.dom.formationDetail.innerHTML;
  assert(html.includes('井芹仁菜 · 成长率'));assert(html.includes('<td>50%</td><td>+5%</td><td><strong>55%</strong>'));assert(!html.includes('暂定'));
});
test('经验溢出保留，一次获取封顶当前一级需求，99级停止成长',()=>{const g=new M.Game({seed:24}),u=g.getUnit('tomori');u.exp=140;const r=G.award(u,9999);assert.equal(r.gained,146);assert.equal(u.level,6);assert.equal(u.exp,140);u.level=98;u.exp=G.required(98)-1;G.award(u,100);assert.equal(u.level,99);assert.equal(u.exp,0);assert.equal(G.award(u,100),null);});
test('HP成长保留缺血量，不全回复，不复活倒地角色',()=>{const g=new M.Game({seed:94}),u=g.getUnit('soyo');u.hp=3;let missing=u.maxHp-u.hp;G.award(u,G.required(u.level));assert.equal(u.maxHp-u.hp,missing);u.dead=true;u.hp=0;assert.equal(G.award(u,100),null);assert.equal(u.hp,0);});
test('战斗预览与锁定不发经验、不改变成长随机数',()=>{const {g,a,b}=setup(),before=plain(G.pack(a));g.previewCombat(a,b);g.rollCombat(a,b);assert.deepEqual(plain(G.pack(a)),before);});
test('追击整场只发一份经验，不按逐击重复发放',()=>{const {g,a,b}=setup();a.spd=30;b.hp=b.maxHp=100;g.rng={int:()=>100};const r=g.rollCombat(a,b);for(const s of r.strikes){s.hit=true;s.finalDamage=1;}g.applyCombat(r);const hits=r.strikes.filter(s=>s.attackerId===a.id).length;assert.equal(hits,2);assert.equal(r.experience.length,1);assert.equal(r.experience[0].gained,G.combatExp(a,b,hits,false));assert.throws(()=>g.applyCombat(r),/已结算/);});
test('敌方阶段反击获经验且不消耗我方行动',()=>{const {g,a,b}=setup();g.phase='enemy';b.hp=1;b.str=0;a.acted=false;g.rng={int:()=>1};const r=g.applyCombat(g.rollCombat(b,a));assert(b.dead);assert(r.experience.some(e=>e.unitId===a.id));assert(!a.acted);});
test('最后一名敌人倒下仍先结算升级，战报HP包含HP成长',()=>{
  const g=new M.Game({seed:947}),a=g.getUnit('tomori'),b=g.getUnit('shadow_axe');
  for(const u of g.units)if(u.side==='enemy'&&u!==b){u.hp=0;u.dead=true;}
  a.exp=G.required(a.level)-1;const hp=a.hp,max=a.maxHp;
  const round={attackerId:a.id,defenderId:b.id,defenderHp:b.hp,strikes:[{attackerId:a.id,defenderId:b.id,hit:true,finalDamage:999}]};
  const r=g.applyCombat(round);assert.equal(g.phase,'victory');assert.equal(r.experience.length,1);assert.equal(a.level,6);
  assert.equal(r.attackerHpAfterApply,a.hp);assert.equal(a.hp-hp,a.maxHp-max);
  const h=new M.Game();h.restore(g.serialize());assert.equal(h.getUnit(a.id).level,6);assert.equal(h.getUnit(a.id).hp,a.hp);
});
test('本场战斗死亡的角色不获得先前攻击的经验',()=>{const {g,a,b}=setup();const r={attackerId:a.id,defenderId:b.id,strikes:[{attackerId:a.id,defenderId:b.id,hit:true,finalDamage:1},{attackerId:b.id,defenderId:a.id,hit:true,finalDamage:999}]};g.applyCombat(r);assert(a.dead);assert.equal(a.exp,0);assert.equal(r.experience.length,0);});
test('击杀只算一次，倒地目标不会再次发经验',()=>{const {g,a,b}=setup(),r={attackerId:a.id,defenderId:b.id,hit:true,finalDamage:999};g.applyCombat(r);const exp=a.exp;assert.equal(r.experience.length,1);g.applyCombat({...r,applied:false});assert.equal(a.exp,exp);});
test('满血目标、取消施法、待机和机关不提供辅助经验',()=>{const {g,a}=setup(),s=g.getUnit('soyo');Object.assign(s,{x:3,y:4});const exp=s.exp;a.hp=a.maxHp;assert.throws(()=>g.castSupport(s,'heal',a));assert.equal(s.exp,exp);g.markActed(a);assert.equal(a.exp,0);});
test('真实圣疗结算增加经验，不能重复施放已行动角色',()=>{const {g,a}=setup(),s=g.getUnit('soyo');Object.assign(s,{x:3,y:4});a.hp=1;const r=g.castSupport(s,'heal',a);assert.equal(s.exp,14);assert.equal(r.experience[0].gained,14);assert.throws(()=>g.castSupport(s,'heal',a));assert.equal(s.exp,14);});
test('成长随机数独立于战斗随机数，读档后下一级成长完全一致',()=>{const g=new M.Game({seed:876}),u=g.getUnit('soyo');G.award(u,146);const saved=g.serialize(),h=new M.Game();h.restore(saved);for(let n=0;n<40;n++)g.rng.int(1,100);const r=G.award(u,G.required(u.level)),r2=G.award(h.getUnit(u.id),G.required(u.level));assert.deepEqual(plain(r.levels),plain(r2.levels));});
test('存档恢复成长属性、等级、经验和随机状态，而非任意临时属性',()=>{const g=new M.Game({seed:543}),u=g.getUnit('soyo');G.award(u,146);u.exp=53;u.hp=5;const h=new M.Game();h.restore(g.serialize());const v=h.getUnit(u.id);for(const key of [...D.keys,'level','exp','hp','growthRngState'])assert.equal(v[key],u[key],key);assert.deepEqual(plain(G.pack(v)),plain(G.pack(u)));});
test('跨章继承成长与经验，同时补满HP和魔法次数',()=>{const g=new M.Game({seed:543}),u=g.getUnit('soyo');G.award(u,146);u.hp=2;u.exp=46;u.spellUses.fire=0;const h=new M.Game({stage:2,loadout:g.exportLoadout()}),v=h.getUnit(u.id);assert.equal(v.level,u.level);assert.equal(v.exp,46);assert.equal(v.maxHp,u.maxHp);assert.equal(v.hp,v.maxHp);assert.equal(v.spellUses.fire,10);assert.deepEqual(plain(v.growthGains),plain(u.growthGains));});
test('缺少成长字段的旧存档保留进度，从模板等级零经验开始',()=>{const g=new M.Game(),saved=g.serialize();for(const u of saved.units)delete u.growth;const h=new M.Game();h.restore(saved);for(const u of h.living('player')){assert.equal(u.level,M.CONFIG.UNITS.find(t=>t.id===u.id).level);assert.equal(u.exp,0);}});
test('损坏的等级、经验、属性增量和成长随机状态会被拒绝',()=>{for(const mutate of [s=>s.level=100,s=>s.exp=-1,s=>s.exp=999,s=>s.gains.mag=-1,s=>s.gains.mag=4,s=>s.rngState=0,s=>s.version=2,s=>s.gains=null]){const saved=new M.Game().serialize();mutate(saved.units.find(u=>u.id==='soyo').growth);assert.throws(()=>new M.Game().restore(saved),/成长/);}});
test('成长率页显示个人、职业和实际概率及经验条',()=>{const g=new M.Game(),ui=Object.create(M.EntryScreen.prototype);Object.assign(ui,{ui:{game:g},players:()=>g.living('player'),selectedUnitId:'soyo',loadoutTab:'growth',renderPoseDock:()=>{},dom:{formationDetail:{innerHTML:''}}});ui.renderFormationDetail();for(const text of ['个人成长','职业修正','实际成长','困难难度','EXP 0 / 146','60%','至少提升两项'])assert(ui.dom.formationDetail.innerHTML.includes(text),text);});
test('全部独立HTML入口在引擎之前加载成长数据与规则',()=>{
  const root=path.join(__dirname,'..');for(const file of fs.readdirSync(root).filter(f=>f.endsWith('.html')&&f!=='standalone.html')){
    const html=fs.readFileSync(path.join(root,file),'utf8');if(!html.includes('src/game.js'))continue;
    const order=['src/rng.js','src/growth-data.js','src/growth.js','src/game.js'].map(s=>html.indexOf(s));
    assert(order.every(n=>n>=0),file);assert(order.every((n,i)=>!i||n>order[i-1]),file);
  }
});
(async()=>{const g=new M.Game({seed:876}),u=g.getUnit('soyo'),r=G.award(u,146),ui=Object.create(M.UI.prototype);let html='';Object.assign(ui,{game:g,renderer:{floatText:()=>{}},updateAll:()=>{},openOverlay:s=>{html=s;}});const pending=ui.showGrowthResults([r]);assert(html.includes('成长的足迹'));assert(html.includes('Lv.5 → Lv.6'));assert(html.includes('HP'));ui.confirmHandler();await pending;console.log('✓ 升级弹窗显示八项变化，确认后继续战斗流程');count++;console.log('Growth: '+count+' cases passed.');})().catch(e=>{console.error(e);process.exitCode=1;});
