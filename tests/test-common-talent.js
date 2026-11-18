'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
function world(legacy=false){
  const w={console,document:{readyState:'loading'},addEventListener(){}};w.window=w;vm.createContext(w);
  for(const name of ['equipment-data','magic-data','inventory','class-data','class-mastery','config','chapter-three','chapter-four',
    'chapter-five','chapter-six','chapter-seven','chapter-eight','chapter-nine','chapter-ten','rng','growth-data','talents',
    'growth','grid','pathfinding','combat','game','ui','entry','loadout-ui']){
    let source=fs.readFileSync(path.join(__dirname,'../src',name+'.js'),'utf8');
    if(legacy&&name==='talents')source=source.replace('return [0,1,2,3].filter','return [1,2,3].filter')
      .replace('function hitBonus(u){return active(u,0)?5:0;}','function hitBonus(){return 0;}');
    vm.runInContext(source,w,{filename:name});
  }
  return w.MyGO;
}
const M=world(),T=M.Talents,G=M.Growth,C=M.Combat,I=M.Inventory,plain=x=>JSON.parse(JSON.stringify(x));let count=0;
function test(name,fn){fn();count++;console.log('✓ '+name);}
function game(api=M){const g=new api.Game({stage:10,recruited:['xueyue','nina'],seed:1818});g.completeTenthIntro();return g;}
function level(u,n,api=M){while(u.level<n)api.Growth.award(u,api.Growth.required(u.level)-u.exp);return u;}

test('九名角色均在9→10级习得掌握战斗一次，技巧奖励独立于随机成长',()=>{
  const g=game();
  for(const id of Object.keys(M.GrowthData.personal)){
    const u=g.getUnit(id);u.level=9;T.sync(u);const dex=u.dex;
    assert(!T.active(u,0));assert.equal(T.hitBonus(u),0);
    const r=G.award(u,G.required(9)-u.exp),l=r.levels[0];
    assert.equal(u.level,10);assert.equal(l.awakened.slot,0);assert.equal(l.awakened.name,'掌握战斗');
    assert.equal(l.awakenings.length,1);assert.equal(u.dex,dex+l.gains.dex+1);
    assert.equal(T.hitBonus(u),5);assert.equal(u._talentBonuses.dex,1);
    for(let n=0;n<3;n++)T.sync(u);assert.equal(u.dex,dex+l.gains.dex+1);
    assert(!G.award(u,G.required(10)-u.exp).levels[0].awakenings.some(t=>t.slot===0));
  }
});
test('起始已达10级立即生效，敌方/同名幻影不获得天赋',()=>{
  const g=game(),s=g.getUnit('subaru');assert.equal(s.level,12);assert(T.active(s,0));
  assert.equal(s.dex,s.growthBase.stats.dex+1);assert.equal(G.pack(s).gains.dex,0);
  for(const u of g.units.filter(u=>u.side==='enemy'))assert.equal(T.hitBonus(u),0);
  const fake={...s,side:'enemy'};T.sync(fake);assert(!T.active(fake,0));assert.equal(fake.dex,s.dex-1);
  assert.equal(T.list({id:'dark_tomori',side:'enemy',level:99}).length,0);
});
test('所有实体武器和攻击魔法额外命中5，技巧另按原有公式参与命中与暴击',()=>{
  const u=level(game().getUnit('anon'),15);u.dex=11;u.lck=4;
  for(const weapon of Object.values(I.weapons).filter(w=>!w.cannotAttack)){
    u.weapon=weapon;const skill=11;
    const expected=weapon.damageType==='magic'?Math.floor((skill+4)/2):skill;
    assert.equal(C.hitOf(u),(weapon.hit||0)+expected+5,weapon.id);
    assert.equal(C.critRateOf(u),Math.floor((skill+4)/2)+(weapon.crit||0)+(weapon.type==='bow'?10:0),weapon.id);
  }
  u.weapon={type:'sword',hit:60};u.hit=20;assert.equal(C.hitOf(u),85);
});
test('首击反击追击的预告与锁定使用同一命中加成，预演不改技巧',()=>{
  const g=game(),u=level(g.getUnit('tomori'),10),e=g.units.find(u=>u.side==='enemy');
  g.map={cols:24,rows:24,tiles:Array.from({length:24},()=>Array(24).fill('plain'))};
  Object.defineProperty(g.map,'units',{get:()=>g.units});
  Object.assign(u,{x:4,y:4,dex:10,lck:0,spd:30,hp:999,maxHp:999});
  Object.assign(e,{x:5,y:4,dex:10,lck:0,spd:0,hp:999,maxHp:999});
  for(const a of [u,e]){a.inventory=[I.make('iron_sword')];a.equippedWeapon='iron_sword';I.sync(a);}
  for(const reverse of [false,true]){
    const a=reverse?e:u,b=reverse?u:e,p=C.forecast(a,b,g.map),r=C.rollRound(a,b,g.map,{int:()=>100});
    const expected=reverse?p.counter.hit:p.hit;
    for(const s of r.strikes.filter(s=>s.attackerId===u.id))assert.equal(s.hitChance,expected);
    assert(r.strikes.some(s=>s.attackerId===u.id&&s.kind==='followup'));
  }
  assert.equal(u.dex,10);
});
test('旧档所有已达等级角色补发技巧一次，原等级经验成长和随机状态不变，重复读档不叠加',()=>{
  const old=world(true),g=game(old);
  for(const u of g.living('player')){level(u,25,old);u.exp=17;u.hp-=2;}
  const save=plain(g.serialize()),h=game();
  for(let n=0;n<3;n++){
    h.restore(save);
    for(const u of g.living('player')){
      const v=h.getUnit(u.id);assert.equal(v.dex,u.dex+1);assert.equal(v.hp,u.hp);
      assert.equal(C.hitOf(v)-old.Combat.hitOf(u),5+(u.weapon.damageType==='magic'?Math.floor((u.dex+1+u.lck)/2)-Math.floor((u.dex+u.lck)/2):1));
      assert.deepEqual(plain(G.pack(v)),plain(old.Growth.pack(u)));
    }
  }
  const current=plain(h.serialize()),j=game();j.restore(current);assert.deepEqual(plain(j.serialize()),current);
});
test('低等级旧档仍未习得；转职和跨章保留一次奖励并与个人天赋技巧叠加',()=>{
  const g=game(),a=level(g.getUnit('anon'),25);assert.equal(a._talentBonuses.dex,6);
  const dex=a.dex;M.Classes.apply(a,'archer');T.sync(a);assert.equal(a.dex,dex);
  const next=new M.Game({stage:10,recruited:g.recruited,loadout:g.exportLoadout(),seed:2});next.completeTenthIntro();assert.equal(next.getUnit(a.id).dex,dex);
  const old=world(true),low=new old.Game({seed:12}),u=low.getUnit('tomori');level(u,9,old);
  const h=new M.Game();h.restore(plain(low.serialize()));assert.equal(h.getUnit(u.id).dex,u.dex);assert(!T.active(h.getUnit(u.id),0));
});
test('角色资料展示10级通用天赋及状态，原个人天赋编号不变',()=>{
  const g=game(),u=g.getUnit('tomori'),ctx={loadoutTab:'growth',players:()=>[u],selectedUnitId:u.id,dom:{formationDetail:{innerHTML:''}},renderPoseDock(){}};
  M.EntryScreen.prototype.renderFormationDetail.call(ctx);let html=ctx.dom.formationDetail.innerHTML;
  for(const text of ['通用天赋','Lv.10觉醒','掌握战斗','命中＋5、技巧＋1','未觉醒','个人天赋1','个人天赋2','个人天赋3'])assert(html.includes(text),text);
  level(u,10);M.EntryScreen.prototype.renderFormationDetail.call(ctx);html=ctx.dom.formationDetail.innerHTML;assert(html.includes('已觉醒'));
  assert.equal(T.list(u).map(t=>t.slot).join(','),'0,1,2,3');
});
(async()=>{
  const g=game(),u=g.getUnit('tomori');level(u,9);const r=G.award(u,G.required(9)-u.exp),ui=Object.create(M.UI.prototype);let html='';
  Object.assign(ui,{game:g,renderer:{floatText(){}},updateAll(){},openOverlay(s){html=s;}});
  const pending=ui.showGrowthResults([r]);assert(html.includes('通用天赋觉醒：掌握战斗'));assert(!html.includes('个人天赋1觉醒：掌握战斗'));
  ui.confirmHandler();await pending;count++;console.log('✓ 10级升级弹窗显示通用天赋名称与效果');console.log(count+' shared talent tests passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
