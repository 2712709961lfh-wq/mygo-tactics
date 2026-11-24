'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const w={console,document:{readyState:'loading'},addEventListener(){},setTimeout(){},clearTimeout(){}};w.window=w;vm.createContext(w);
for(const f of ['equipment-data','magic-data','inventory','class-data','class-mastery','config','chapter-three','chapter-four','chapter-five','chapter-six','chapter-seven','chapter-eight','chapter-nine','chapter-ten','chapter-palace','rng','growth-data','talents','growth','grid','pathfinding','combat','game','ai','ui','entry'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',f+'.js'),'utf8'),w,{filename:f});
const M=w.MyGO,C=M.CONFIG,I=M.Inventory,plain=x=>JSON.parse(JSON.stringify(x)),fresh=opts=>new M.Game({stage:11,seed:1117,...opts}),reload=g=>{const h=new M.Game();h.restore(plain(g.serialize()));return h;};
const hit=(g,id)=>g.applyCombat({attackerId:'tomori',defenderId:id,hit:true,finalDamage:999});
let cases=0;function test(name,f){f();cases++;console.log('✓ '+name);}
test('New palace is chapter ten; merged rehearsal remains chapter nine',()=>{
 const g=fresh();assert.equal(g.chapterNumber,10);assert.equal(g.mission.chapter,'MISSION 10');assert.equal(g.map.cols,30);assert.equal(g.map.rows,36);assert.equal(g.livingCount('player'),9);assert.equal(g.getUnit('subaru').side,'player');
 const old=new M.Game({stage:10});assert.equal(old.chapterNumber,9);assert.equal(old.mission.chapter,'MISSION 09');assert(old.getUnit('dark_nina'));assert(!g.getUnit('dark_nina'));
});
test('All spawns are distinct and accessible by three connected corridors; obstacles block flyers too',()=>{
 const g=fresh(),lead=g.getUnit('tomori'),r=M.Pathfinding.getReachable(g.map,{...lead,move:9999},[]),used=new Set();
 for(const u of g.units){const key=u.x+','+u.y;assert(r.has(key),u.id);assert(!used.has(key),u.id);used.add(key);}
 for(const x of [5,14,24])assert(r.has(x+',10'));assert(!r.has('8,7'));assert(!Number.isFinite(M.Grid.movementCost(g.map,g.getUnit('palace-pegasus-0'),8,7)));
 assert(g.map.decor.some(o=>o.kind==='palace-throne'));assert(g.map.decor.every(o=>!['amp','drums','keyboard','rack'].includes(o.kind)));
});
test('Seventeen enemies include infantry, high-defense armor, flyers and true ground cavalry',()=>{
 const g=fresh(),foes=g.living('enemy');assert.equal(foes.length,17);assert.equal(foes.filter(u=>u.tags.includes('cavalry')).length,5);assert.equal(foes.filter(u=>u.tags.includes('flying')).length,2);assert.equal(foes.filter(u=>u.tags.includes('armor')).length,3);
 const boss=g.getUnit('gilded_cavalier');assert(boss.boss);assert.equal(boss.classId,'cavalier');assert.equal(boss.move,7);assert.equal(boss.hp,46);assert.equal(boss.weaponId,'steel_lance');assert(!boss.hpFloor);assert(!boss.tags.includes('flying'));
 assert(g.getUnit('palace-armor-0').def>g.getUnit('palace-armor-0').res+10);
 const spear=C.WEAPONS.horseslayer,bow=C.WEAPONS.iron_bow;assert(M.Combat.effectivenessAgainst(spear,boss)>1);assert.equal(M.Combat.effectivenessAgainst(bow,boss),1);assert(M.Combat.effectivenessAgainst(bow,g.getUnit('palace-pegasus-0'))>1);
});
test('Boss kill clears palace, ordinary soldier does not; opening gates victory and reward pays once',()=>{
 const g=fresh(),gold=g.gold;hit(g,'palace-soldier-0');assert.equal(g.phase,'player');hit(g,'gilded_cavalier');assert.equal(g.phase,'player');g.palaceIntroSeen=true;g.checkOutcome();assert.equal(g.phase,'victory');assert.equal(g.gold,gold+2000);assert(g.livingCount('enemy')>0);g.checkOutcome();assert.equal(g.gold,gold+2000);
 assert(g.units.some(u=>u.inventory.some(i=>i.id==='steel_lance'))||g.convoy.some(i=>i.id==='steel_lance'));const h=reload(g);assert.equal(h.gold,g.gold);assert.deepEqual(plain(h.rewardedChapters),[10]);assert.deepEqual(plain(reload(h).serialize()),plain(h.serialize()));
});
test('Palace marker distinguishes new chapter-ten saves from old chapter-ten rehearsal saves',()=>{
 const g=fresh();assert.equal(g.serialize().stage,10);assert.equal(g.serialize().palaceChapterVersion,1);assert.equal(g.serialize().rehearsalPart,undefined);assert.equal(reload(g).stage,11);assert(!reload(g).palaceIntroSeen);
 g.palaceIntroSeen=true;g.getUnit('gilded_cavalier').hp=11;g.getUnit('subaru').hp=8;g.getUnit('subaru').spellUses.miasma=1;const h=reload(g);assert(h.palaceIntroSeen);assert.equal(h.getUnit('gilded_cavalier').hp,11);assert.equal(h.getUnit('subaru').hp,8);assert.equal(h.getUnit('subaru').spellUses.miasma,1);assert.deepEqual(plain(reload(h).serialize()),plain(h.serialize()));
 const old=new M.Game({stage:10});old.completeTenthIntro();const legacy=plain(old.serialize());legacy.stage=10;delete legacy.rehearsalChapterVersion;delete legacy.rehearsalPart;delete legacy.rehearsalFirstDefeated;const k=new M.Game();k.restore(legacy);assert.equal(k.chapterNumber,9);assert(k.getUnit('dark_nina'));assert(!k.getUnit('gilded_cavalier'));
});
test('Chapter nine clear imports Subaru growth, latest talents, money and equipment exactly once',()=>{
 const old=new M.Game({stage:10,recruited:['xueyue','nina']});old.completeTenthIntro();const s=old.getUnit('subaru');while(s.level<20)M.Growth.award(s,M.Growth.required(s.level));s.exp=17;old.gold=7777;old.rewardedChapters=[9];old.shopPurchases={intermediate_seal:1};
 const g=fresh({recruited:old.recruited,loadout:old.exportLoadout()});assert.equal(g.livingCount('player'),9);assert.equal(g.getUnit('subaru').level,20);assert.equal(g.getUnit('subaru').exp,17);assert.equal(M.Magic.rangeOf(M.Magic.get('fire'),g.getUnit('subaru'))[1],3);assert.equal(g.gold,7777);assert.equal(g.shopChapter,10);assert.equal(Object.keys(g.shopPurchases).length,0);assert.deepEqual(plain(g.rewardedChapters),[9]);
 g.palaceIntroSeen=true;hit(g,'gilded_cavalier');assert.equal(g.gold,9777);assert.deepEqual(plain(reload(g).rewardedChapters),[9,10]);
});
test('Palace survives wounded, grown, withdrawn and absent companions in saved progress',()=>{
 const g=fresh({ninaLost:true});assert(!g.getUnit('nina'));g.palaceIntroSeen=true;g.getUnit('subaru').dead=true;g.getUnit('subaru').hp=0;g.getUnit('anon').hp-=4;M.Growth.award(g.getUnit('tomori'),200);const h=reload(g);assert(!h.getUnit('nina'));assert(h.getUnit('subaru').dead);assert.equal(h.getUnit('anon').hp,g.getUnit('anon').hp);assert.equal(h.getUnit('tomori').level,g.getUnit('tomori').level);hit(h,'gilded_cavalier');assert.equal(h.phase,'victory');
});
test('Save card names the palace chapter and counts Subaru without rehearsal-part labels',()=>{
 const g=fresh(),ctx={ui:{game:g,busy:false,mode:'idle',saveManager:{storageType:'memory'}},getSaveInfo:()=>({ok:true,loaded:{snapshot:plain(g.serialize()),savedAt:'2026-11-17T10:00:00.000Z'}}),dom:{saveInfo:{},saveLoad:{},saveDelete:{},saveCurrent:{},saveStatus:{}}};
 M.EntryScreen.prototype.refreshSavePanel.call(ctx);const html=ctx.dom.saveInfo.innerHTML;assert(html.includes('MISSION 10'));assert(html.includes('鎏金王座的铁蹄'));assert(html.includes('我方 9 / 敌方 17'));assert(!html.includes('前半段')&&!html.includes('后半段'));
});
test('Cavalry patrol moves through open lanes, alerts as a group and reaches nearby targets',()=>{
 const g=fresh(),e=g.getUnit('palace-cavalier-0'),r=M.Pathfinding.getReachable(g.map,e,g.units);assert(r.has('7,19'));g.alertGroup(e);assert(g.getUnit('palace-cavalier-1').alerted);assert(!g.getUnit('palace-cavalier-2').alerted);
});
test('Holy fonts apply actual terrain defense and player-turn healing',()=>{
 const g=fresh(),u=g.getUnit('tomori');Object.assign(u,{x:5,y:17,hp:10});assert.equal(g.getTerrain(5,17).id,'fort');assert.equal(M.Combat.terrainOf(u,g.map).def,2);g.beginNextPlayerPhase();assert.equal(u.hp,10+Math.ceil(u.maxHp*.2));
});
test('Corrupt palace markers, incomplete rosters and premature victory cannot load',()=>{
 for(const mutate of [s=>s.palaceChapterVersion=2,s=>s.stage=11,s=>s.mapRevision++,s=>delete s.palaceIntroSeen,s=>delete s.palaceChapterVersion,s=>s.rehearsalPart=2,s=>s.units.pop(),s=>s.recruited=s.recruited.filter(id=>id!=='subaru'),s=>s.gateOpen=true,s=>s.phase='victory',s=>s.economy.chapter=11]){
  const snapshot=plain(fresh().serialize());mutate(snapshot);assert.throws(()=>new M.Game().restore(snapshot));
 }
});
test('Palace enemies remain fixed after high-level party imports and turn progression',()=>{
 const g=fresh(),stats=g=>plain(g.living('enemy').map(u=>[u.id,u.level,u.maxHp,u.str,u.mag,u.dex,u.spd,u.def,u.res])),before=stats(g);for(const u of g.living('player'))M.Growth.award(u,800);const h=fresh({recruited:g.recruited,loadout:g.exportLoadout()});assert.deepEqual(stats(h),before);h.palaceIntroSeen=true;h.beginNextPlayerPhase();assert.deepEqual(stats(reload(h)),before);
});
console.log('Palace chapter: '+cases+' scenarios passed.');
