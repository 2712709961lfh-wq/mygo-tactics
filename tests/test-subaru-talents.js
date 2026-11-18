'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const w={console,document:{readyState:'loading'},addEventListener(){}};w.window=w;vm.createContext(w);
for(const name of ['equipment-data','magic-data','inventory','class-data','class-mastery','config','chapter-three','chapter-four',
  'chapter-five','chapter-six','chapter-seven','chapter-eight','chapter-nine','chapter-ten','rng','growth-data','talents',
  'growth','grid','pathfinding','combat','game','ui','entry','loadout-ui'])
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',name+'.js'),'utf8'),w,{filename:name});
const M=w.MyGO,T=M.Talents,I=M.Inventory,C=M.Combat,G=M.Growth,plain=x=>JSON.parse(JSON.stringify(x));let count=0;
function test(name,fn){fn();console.log('✓ '+name);count++;}
function level(u,n){while(u.level<n)G.award(u,G.required(u.level)-u.exp);u.hp=u.maxHp;return u;}
function game(){const g=new M.Game({stage:10,recruited:['nina','xueyue'],seed:1212});g.completeTenthIntro();return g;}
function fixture(n=25){
  const g=game();g.map={cols:24,rows:24,tiles:Array.from({length:24},()=>Array(24).fill('plain'))};
  Object.defineProperty(g.map,'units',{configurable:true,get:()=>g.units});
  g.units.forEach((u,i)=>Object.assign(u,{x:i%24,y:18+Math.floor(i/24),acted:false}));
  const s=level(g.getUnit('subaru'),n),e=g.units.find(u=>u.side==='enemy'),t=g.getUnit('tomori');
  Object.assign(s,{x:4,y:4,mag:12,spd:10,dex:200,lck:0,hp:50,maxHp:50});
  Object.assign(e,{x:5,y:4,str:1,res:0,spd:10,dex:200,lck:200,hp:999,maxHp:999});
  e.inventory=[I.make('iron_sword')];e.equippedWeapon='iron_sword';I.sync(e);
  s.equippedWeapon='fire';I.sync(s);return {g,s,e,t};
}
function rolls(g,values){let i=0;g.rng={int(){assert(i<values.length,'unexpected RNG draw');return values[i++];},serialize:()=>1212};return ()=>i;}

test('昴15/20/25级依次觉醒，报告、资料、旧档重建和转职保留三档天赋',()=>{
  const g=game(),s=g.getUnit('subaru');
  for(const [slot,name]of [[1,'爱笑女孩'],[2,'魔力延伸'],[3,'天使']]){
    level(s,T.levels[slot]-1);assert(!T.active(s,slot));
    const r=G.award(s,G.required(s.level)-s.exp);assert(T.active(s,slot));
    assert.equal(r.levels[0].awakenings.find(t=>t.slot===slot).name,name);
  }
  const save=plain(g.serialize()),h=game();
  for(let n=0;n<3;n++){h.restore(save);assert(T.list(h.getUnit('subaru')).every(t=>t.active));assert.equal(h.getUnit('subaru').mag,s.mag);}
  M.Classes.apply(s,'priest');assert(T.list(s).every(t=>t.active));
  const ctx={ui:{game:g},loadoutTab:'growth',players:()=>[s],selectedUnitId:s.id,dom:{formationDetail:{innerHTML:'',insertAdjacentHTML(_,html){this.innerHTML=html+this.innerHTML;}}},renderPoseDock(){}};
  M.EntryScreen.prototype.renderFormationDetail.call(ctx);
  for(const text of ['爱笑女孩','魔力延伸','天使','Lv.15','Lv.20','Lv.25'])assert(ctx.dom.formationDetail.innerHTML.includes(text),text);
  assert.equal(T.get('tomori').name,'行动派');assert(!T.active({...s,side:'enemy'},3));
});
test('爱笑女孩25成功26失败，未觉醒/其他角色/实体物品不抽签，零次数仍不可施法',()=>{
  const {s,t}=fixture(15);let draws=0;const rng={int:()=>{draws++;return 25;}};
  assert(T.preserveUse(s,'spell',rng));assert(T.preserveUse(s,'consumable',rng));assert.equal(draws,2);
  assert(!T.preserveUse(s,'spell',{int:()=>26}));
  for(const [u,kind]of [[{...s,level:14},'spell'],[t,'spell'],[s,'weapon'],[s,'seal'],[s,'key']])assert(!T.preserveUse(u,kind,{int(){throw Error('should not roll');}}));
  s.spellUses.fire=0;assert(!I.usable(s));assert.throws(()=>I.consume(s,'fire',true),/次数不足/);
});
test('攻击每次独立抽签，锁定不改真实次数，确认不重抽也不重复消耗',()=>{
  const {g,s,e}=fixture(15);s.spd=40;e.spd=0;e.cannotCounter=true;s.spellUses.fire=2;
  const draws=rolls(g,[1,1,100,25,1,1,100,26]),r=g.rollCombat(s,e);
  assert.equal(r.strikes.length,2);assert(r.strikes[0].resourcePreserved);assert(!r.strikes[1].resourcePreserved);
  assert.equal(s.spellUses.fire,2);assert.equal(draws(),8);g.applyCombat(r);
  assert.equal(s.spellUses.fire,1);assert.equal(draws(),8);assert.throws(()=>g.applyCombat(r),/已结算/);
});
test('一发剩余可在触发后追击，未触发则中断，预告无随机副作用且提示条件',()=>{
  for(const proc of [25,26]){
    const {g,s,e}=fixture(15);s.spd=40;e.spd=0;e.cannotCounter=true;s.spellUses.fire=1;
    const draws=rolls(g,proc===25?[1,1,100,25,1,1,100,26]:[1,1,100,26]);
    const p=C.forecast(s,e,g.map);assert.equal(draws(),0);assert(p.order[1].resourceConditional);
    const r=g.rollCombat(s,e);assert.equal(r.strikes.length,proc===25?2:1);g.applyCombat(r);assert.equal(s.spellUses.fire,0);
  }
});
test('落空和反击施法也判定保留，实体武器不判定',()=>{
  const {g,s,e}=fixture(15);s.spd=e.spd=10;s.dex=-1000;s.spellUses.fire=1;
  const r=C.rollRound(e,s,g.map,{int:()=>25});const counter=r.strikes.find(x=>x.attackerId===s.id);
  assert(counter);assert(!counter.hit);assert(counter.resourcePreserved);g.applyCombat(r);assert.equal(s.spellUses.fire,1);
  const f=fixture(15);f.s.weaponTypes=['sword'];f.s.inventory=[I.make('iron_sword')];f.s.equippedWeapon='iron_sword';I.sync(f.s);
  const p=C.rollRound(f.s,f.e,f.g.map,{int:()=>1});assert(!p.strikes.find(x=>x.attackerId===f.s.id).resourcePreserved);
});
test('辅助魔法和各类药品正确保留最后一次，非法目标/满血用药不抽签',()=>{
  for(const id of ['heal','ward','restore','rescue'])for(const proc of [25,26]){
    const {g,s,t}=fixture(25);Object.assign(t,{x:5,y:5,hp:1,status:{poison:1,spdDown:1}});
    if(!s.learnedSpells.includes(id))s.learnedSpells.push(id);s.spellUses[id]=1;
    if(id!=='rescue')t.y=4;
    const draws=rolls(g,[proc]),r=g.castSupport(s,id,t);assert.equal(r.resourcePreserved,proc===25);
    assert.equal(s.spellUses[id],proc===25?1:0);assert.equal(draws(),1);assert(s.acted);
  }
  for(const id of ['vulnerary','antitoxin','pure_water'])for(const proc of [25,26]){
    const {g,s}=fixture(15);s.inventory=[I.make(id)];s.inventory[0].uses=1;s.hp=1;s.status.poison=1;
    const draws=rolls(g,[proc]),r=g.useMedicine(s,0);assert.equal(r.resourcePreserved,proc===25);
    assert.equal(s.inventory.length,proc===25?1:0);if(proc===25)assert.equal(s.inventory[0].uses,1);assert.equal(draws(),1);
  }
  const {g,s,t}=fixture(15);const draws=rolls(g,[]);s.inventory=[I.make('vulnerary')];
  assert.throws(()=>g.useMedicine(s,0),/生命已满/);t.x=22;t.hp=1;assert.throws(()=>g.castSupport(s,'heal',t),/目标无效/);assert.equal(draws(),0);
});
test('魔力延伸影响攻击范围、反击、预告和实战，辅助/魔法武器/全局图鉴保持原范围',()=>{
  const {g,s,e}=fixture(19);Object.assign(e,{x:7,y:4});assert(!g.canAttack(s,e));
  level(s,20);I.sync(s);assert.equal(s.weapon.range.join(','),'1,3');assert.equal(I.weapons.fire.range.join(','),'1,2');
  assert(g.canAttack(s,e));assert(g.getAttackTiles(s).some(t=>t.x===7&&t.y===4));assert.equal(C.counterReason(e,s),'');
  assert.equal(g.previewCombat(s,e).weaponType,'tome');assert(g.rollCombat(s,e).strikes.length);
  for(const spell of M.Magic.items){const r=M.Magic.rangeOf(spell,s);assert.equal(r[0],spell.range[0]);if(!spell.rangeText.includes('mag/'))assert.equal(r[1],spell.range[1]+(spell.support?0:1));}
  s.weaponTypes=['sword'];s.inventory=[I.make('levin_sword')];s.equippedWeapon='levin_sword';I.sync(s);assert.equal(s.weapon.range.join(','),'1,2');
  M.Classes.apply(s,'mage');s.equippedWeapon='fire';I.sync(s);assert.equal(s.weapon.range[1],3);
});
test('天使锁定预演只改副本，击破治疗所有存活队友且封顶，确认只结算一次',()=>{
  const {g,s,e,t}=fixture();const a=g.getUnit('anon'),dead=g.getUnit('soyo'),escaped=g.getUnit('rana');
  t.hp=t.maxHp-8;a.hp=a.maxHp-2;dead.hp=0;dead.dead=true;escaped.hp=1;escaped.escaped=true;
  e.hp=1;e.cannotCounter=true;s.hp=10;const before=g.units.map(u=>[u.id,u.hp]);
  const r=C.rollRound(s,e,g.map,{int:()=>1});assert.equal(JSON.stringify(g.units.map(u=>[u.id,u.hp])),JSON.stringify(before));
  const angel=r.strikes[0].angel;assert.equal(angel.cost,2);assert.equal(angel.healing.find(c=>c.id===t.id).amount,5);assert.equal(angel.healing.find(c=>c.id===a.id).amount,2);
  assert.equal(r.attackerHpAfter,8);g.applyCombat(r);assert.equal(s.hp,8);assert.equal(t.hp,t.maxHp-3);assert.equal(a.hp,a.maxHp);assert.equal(dead.hp,0);assert.equal(escaped.hp,1);
  assert.equal(e.hp,0);assert.throws(()=>g.applyCombat(r),/已结算/);
});
test('天使支持反击击破，扣血最低保留1HP，队友全满/无队友/未觉醒/锁血/未击破不发动',()=>{
  const {g,s,e,t}=fixture();s.hp=1;t.hp=1;e.hp=1;e.str=0;e.dex=-1000;s.def=999;
  const r=C.rollRound(e,s,g.map,{int:()=>25});assert(r.strikes.some(x=>x.kind==='counter'&&x.angel));g.applyCombat(r);assert.equal(s.hp,1);assert.equal(t.hp,6);
  for(const mode of ['full','alone','locked','floor','nonkill','miss']){
    const f=fixture(mode==='locked'?24:25);if(mode!=='full')f.t.hp=1;if(mode==='alone')for(const u of f.g.units)if(u.id!==f.s.id&&u.side!=='enemy')u.escaped=true;
    if(mode==='floor')f.e.hpFloor=1;f.e.hp=mode==='nonkill'?999:1;const hp=f.s.hp;
    const hit=mode!=='miss',x={attackerId:f.s.id,defenderId:f.e.id,hit,finalDamage:hit?30:0};f.g.applyCombat(x);assert(!x.angel,mode);assert.equal(f.s.hp,hp,mode);
  }
});
test('当前击破升25级从下一次击破起发动，存档随机状态恢复后保留次数结果一致',()=>{
  const {g,s,e,t}=fixture(24);s.exp=G.required(24)-1;t.hp=1;e.hp=1;
  const r=g.rollCombat(s,e);g.applyCombat(r);assert.equal(s.level,25);assert(!r.strikes.some(x=>x.angel));assert.equal(t.hp,1);
  const h=game(),a=level(h.getUnit('subaru'),20),b=h.units.find(u=>u.side==='enemy');
  Object.assign(a,{x:13,y:16});Object.assign(b,{x:13,y:15});a.equippedWeapon='fire';I.sync(a);
  const save=plain(h.serialize()),j=game();j.restore(save);
  const one=C.rollRound(a,b,h.map,h.rng),two=C.rollRound(j.getUnit(a.id),j.getUnit(b.id),j.map,j.rng);
  assert.deepEqual(plain(one.strikes.map(x=>[x.hitRoll,x.hitRoll2,x.critRoll,x.resourcePreserved])),plain(two.strikes.map(x=>[x.hitRoll,x.hitRoll2,x.critRoll,x.resourcePreserved])));
  assert.equal(j.getUnit(a.id).weapon.range[1],3);
});
console.log(count+' Subaru talent tests passed.');
