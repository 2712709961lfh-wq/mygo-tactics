'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),w={console,addEventListener(){},document:{readyState:'loading'}};
w.window=w;vm.createContext(w);
for(const name of ['equipment-data','magic-data','inventory','class-data','config','chapter-three','chapter-four','chapter-five','chapter-six','chapter-seven','chapter-eight','rng','growth-data','growth','grid','pathfinding','combat','game','ui','entry','loadout-ui'])
 vm.runInContext(fs.readFileSync(path.join(root,'src',name+'.js'),'utf8'),w,{filename:name});
const M=w.MyGO,I=M.Inventory,plain=v=>JSON.parse(JSON.stringify(v));let count=0;
function test(name,fn){fn();count++;console.log('✓ '+name);}
function fixture(stage=8,id='nijika',level=10){
 const g=new M.Game({stage,recruited:['xueyue','nina'],seed:818});
 if(stage===7)g.joinNijika();else g.completeEighthIntro();
 const u=g.getUnit(id);while(u.level<level)M.Growth.award(u,M.Growth.required(u.level));
 g.convoy.push(I.make('intermediate_seal'));return {g,u};
}
function withdraw(u){u.hp=0;u.dead=true;u.acted=true;}
function unchanged(g,fn,pattern){const before=JSON.stringify(g.serialize());assert.throws(fn,pattern);assert.equal(JSON.stringify(g.serialize()),before);}

test('拳斗士男女均可转职，消耗中级证并保存格斗武器资格',()=>{
 for(const gender of ['女','男']){
  const {g,u}=fixture();u.gender=gender;
  assert.equal(M.Classes.get('brawler').gender,null);assert.equal(g.reclassReason(u,'brawler'),'');
  g.reclassUnit(u,'brawler');assert.equal(u.classId,'brawler');assert(u.weaponTypes.includes('gauntlet'));
  assert(!g.convoy.some(i=>i.id==='intermediate_seal'));
  const h=new M.Game();h.restore(g.serialize());assert.equal(h.getUnit('nijika').classId,'brawler');
 }
});

test('虹夏在第七／八关10级及以上撤退后均可转中级，HP与撤退不变',()=>{
 for(const stage of [7,8])for(const level of [10,11,20])for(const id of ['nijika','soyo','tomori']){
  const {g,u}=fixture(stage,id,level);withdraw(u);
  const growth=plain(M.Growth.pack(u)),position=[u.x,u.y];
  assert(g.loadoutReason(u));assert.equal(g.reclassReason(u,'priest'),'');
  g.reclassUnit(u,'priest');assert.equal(u.classId,'priest');
  assert.equal(u.hp,0);assert(u.dead&&u.acted);assert.deepEqual([u.x,u.y],position);
  assert.deepEqual(plain(M.Growth.pack(u)),growth);assert(!M.Growth.eligible(u));
  assert(!g.convoy.some(i=>i.id==='intermediate_seal'));
  const h=new M.Game();h.restore(g.serialize());const saved=h.getUnit(id);
  assert.equal(saved.classId,'priest');assert.equal(saved.level,level);assert.equal(saved.hp,0);assert(saved.dead&&saved.acted);
  assert.deepEqual(plain(M.Growth.pack(saved)),growth);
 }
});

test('撤退转拳斗士后跨章保存职业，转职当下不回到存活名单',()=>{
 const {g,u}=fixture(7);withdraw(u);g.reclassUnit(u,'brawler');
 const h=new M.Game({stage:8,recruited:g.recruited,loadout:g.exportLoadout()}),n=h.getUnit('nijika');
 assert.equal(n.classId,'brawler');
 // Cross-chapter HP follows the game's existing chapter reset policy. The
 // reclass action itself must preserve withdrawal, verified above and on save.
 assert.equal(u.hp,0);assert(u.dead);assert(!g.living('player').includes(u));
 assert.equal(n.level,u.level);assert(n.certifiedClasses.includes('brawler'));
});

test('撤退同伴仍需10级及对应证，拒绝敌方与尚未入队角色',()=>{
 let {g,u}=fixture(7,'nijika',9);withdraw(u);unchanged(g,()=>g.reclassUnit(u,'priest'),/Lv.10/);
 ({g,u}=fixture());withdraw(u);g.convoy=g.convoy.filter(i=>i.id!=='intermediate_seal');
 unchanged(g,()=>g.reclassUnit(u,'priest'),/缺少中级转职证/);
 g.convoy.push(I.make('intermediate_seal'));g.phase='enemy';unchanged(g,()=>g.reclassUnit(u,'priest'),/我方阶段/);
 g.phase='player';unchanged(g,()=>g.reclassUnit(g.getUnit('dark_soyo'),'priest'),/已入队/);
 const beforeJoin=new M.Game({stage:7});assert.match(beforeJoin.reclassReason(beforeJoin.getUnit('nijika'),'priest'),/已入队/);
 assert.match(g.reclassReason(null,'priest'),/已入队/);
});

test('撤退者可免费切回已认证职业，存活已行动同伴仍不能转职或整理背包',()=>{
 const {g,u}=fixture();g.reclassUnit(u,'priest');
 unchanged(g,()=>g.reclassUnit(u,'monk'),/已行动/);assert(g.loadoutReason(u));
 withdraw(u);assert.equal(g.reclassReason(u,'monk'),'');g.reclassUnit(u,'monk');
 assert.equal(u.hp,0);assert(u.dead);assert(g.loadoutReason(u));
 unchanged(g,()=>g.transferItem(u,0,false),/无法整理背包/);
});

function screen(g,u){
 const s=Object.create(M.EntryScreen.prototype);
 Object.assign(s,{ui:{game:g,mode:'idle',busy:false},selectedUnitId:u.id,loadoutTab:'classes',classTier:'intermediate',
  dom:{formationDetail:{innerHTML:''}},renderPoseDock(){}});return s;
}
test('职业按钮对撤退虹夏启用，忙碌与行动菜单时显示同一拦截原因',()=>{
 const {g,u}=fixture();withdraw(u);const s=screen(g,u);
 s.renderFormationDetail();let html=s.dom.formationDetail.innerHTML;
 assert(html.includes('data-reclass="brawler" title='));assert(html.includes('data-reclass="priest" title='));
 const card=html.match(/<article class="class-card[^]*?data-reclass="brawler"[^]*?<\/article>/)[0];
 assert(!card.includes('男性限定'));assert(html.includes('仍保持撤退与原有 HP'));
 for(const mode of ['move','action','attack']){
  s.ui.mode=mode;s.renderFormationDetail();html=s.dom.formationDetail.innerHTML;
  assert(html.includes('data-reclass="priest" disabled'));assert(html.includes(s.reclassLock(u)));
 }
 s.ui.mode='idle';s.ui.busy=true;s.renderFormationDetail();
 assert(s.dom.formationDetail.innerHTML.includes('data-reclass="priest" disabled title="正在结算战斗"'));
});

test('真实编队点击转职分支不再调用撤退者的背包限制',()=>{
 const {g,u}=fixture();withdraw(u);
 // Bind the production extension to a minimal host, retaining the real game.
 const mock={MyGO:{...M,EntryScreen:function(){},UI:function(){}}},listeners={},toasts=[];
 mock.MyGO.EntryScreen.prototype.bind=()=>{};mock.MyGO.EntryScreen.prototype.renderFormationDetail=()=>{};
 vm.runInNewContext(fs.readFileSync(path.join(root,'src/loadout-ui.js'),'utf8'),{window:mock});
 const s=Object.create(mock.MyGO.EntryScreen.prototype);
 Object.assign(s,{ui:{game:g,mode:'idle',busy:false,updateAll(){},showToast:m=>toasts.push(m)},
  selectedUnitId:u.id,players:()=>g.units.filter(u=>u.side==='player'),
  dom:{formationDetail:{addEventListener:(name,fn)=>listeners[name]=fn}},renderFormationList(){},renderFormationDetail(){}});
 s.bind();
 const button={dataset:{reclass:'brawler'},hasAttribute:name=>name==='data-reclass'};
 listeners.click({target:{closest:()=>button}});
 assert.equal(u.classId,'brawler');assert.equal(u.hp,0);assert(u.dead);
 assert.equal(toasts.length,1);assert(toasts[0].includes('转职为拳斗士'));
});
console.log('Withdrawn reclass: '+count+' cases passed.');
