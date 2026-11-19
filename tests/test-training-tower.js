'use strict';

const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const world={console};world.window=world;vm.createContext(world);
for(const name of ['equipment-data','magic-data','inventory','class-data','class-mastery','config','chapter-three','chapter-four',
  'rng','growth-data','growth','talents','grid','pathfinding','combat','game','training','save']){
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',name+'.js'),'utf8'),world,{filename:name+'.js'});
}
const M=world.MyGO,T=M.Training,ticket=M.Shop.TICKET;
const plain=data=>JSON.parse(JSON.stringify(data));
const squad=['tomori','soyo'];

function cleared(){
  const game=new M.Game({stage:3,seed:14,recruited:['xueyue']});
  for(const unit of game.living('enemy'))Object.assign(unit,{hp:0,dead:true,acted:true});
  game.checkOutcome();
  game.retreat={chapterIntroPlayed:true};
  return game;
}

const locked=new M.Game({stage:3});
assert(M.Shop.stock(locked).find(item=>item.id===ticket).locked);
assert.throws(()=>locked.buyItem(ticket),/解锁/);
assert(!M.Shop.trainingUnlocked(new M.Game({stage:4})));
const campaign=cleared();
assert(!M.Shop.stock(campaign).find(item=>item.id===ticket).locked);
const gold=campaign.gold;
campaign.buyItem(ticket,2);
assert.equal(campaign.gold,gold-2*M.Shop.get(ticket).price);
assert.throws(()=>T.Game.start(campaign,['tomori','tomori'],1),/两位/);
assert.equal(T.ticketCount(campaign),2);

const original=campaign.getUnit('tomori');
original.hp-=3;
original.exp=14;
original.inventory[0].uses=1;
const battle=T.Game.start(campaign,squad,797);
assert.equal(T.ticketCount(campaign),1);
assert.equal(battle.livingCount('player'),2);
assert.equal(battle.livingCount('enemy'),30);
const hero=battle.getUnit('tomori'), rival=battle.getUnit('soyo');
assert.equal(hero.hp,hero.maxHp);
assert.notEqual(hero.inventory[0].uses,original.inventory[0].uses);
for(const enemy of battle.living('enemy')){
  const chosen=battle.getUnit(squad[enemy.slimeGroup]);
  const difference=M.Combat.statTotalOf(chosen)-M.Combat.statTotalOf(enemy);
  assert(difference>=30&&difference<=40);
}
assert.equal(battle.living('enemy').filter(u=>u.slimeGroup===0).length,15);
assert.notDeepEqual(plain(battle.map.tiles),plain(new T.Game(campaign,squad,133).map.tiles));

const slime=battle.living('enemy')[0];
const spawn={x:slime.x,y:slime.y};
battle.setUnitPosition(slime.id,hero.x+1,hero.y);
assert(battle.rollCombat(hero,slime).strikes.length>0);
battle.setUnitPosition(slime.id,spawn.x,spawn.y);
const xp=hero.classXp[hero.classId]||0;
const strike=battle.applyCombat({attackerId:hero.id,defenderId:slime.id,hit:true,finalDamage:999});
assert.equal(strike.experience[0].gained,0);
assert.equal(hero.classXp[hero.classId],xp+2);
assert.equal(hero.exp,14);
assert.equal(original.classXp[original.classId]||0,xp);

const save=plain(battle.serialize());
const restoredCampaign=new M.Game();
restoredCampaign.restore(save);
const resumed=T.Game.fromSnapshot(restoredCampaign,save.training);
assert.equal(resumed.seed,battle.seed);
assert.equal(resumed.livingCount('enemy'),29);
assert.equal(T.ticketCount(restoredCampaign),1);
assert.deepEqual(plain(resumed.serialize()),save);
assert.throws(()=>T.Game.fromSnapshot(restoredCampaign,{...save.training,ids:['tomori','tomori']}),/两位/);

const expected=squad.map(id=>T.sameLevelExp(campaign.getUnit(id)));
Object.assign(rival,{hp:0,dead:true});
for(const enemy of battle.living('enemy'))battle.applyCombat({attackerId:hero.id,defenderId:enemy.id,hit:true,finalDamage:999});
assert.equal(battle.phase,'victory');
const success=battle.settle();
assert.deepEqual(plain(success.party.map(row=>row.growth.gained)),expected);
assert.equal(battle.settle(),success);
assert.equal(original.exp,14+expected[0]);
assert.equal(original.hp,original.maxHp-3);
assert.equal(original.inventory[0].uses,1);
assert(!campaign.getUnit('soyo').dead);
assert.equal(campaign.gold,gold-1000);
assert.equal(battle.serialize().training,undefined);

const last=T.Game.start(campaign,squad,115);
assert.equal(T.ticketCount(campaign),0);
const trained=last.getUnit('soyo'), before=campaign.getUnit('soyo').exp;
last.applyCombat({attackerId:trained.id,defenderId:last.living('enemy')[0].id,hit:true,finalDamage:999});
for(const unit of last.living('player'))last.applyCombat({attackerId:last.living('enemy')[0].id,defenderId:unit.id,hit:true,finalDamage:999});
assert.equal(last.phase,'defeat');
const failure=last.settle();
assert(!failure.complete);
assert(failure.party.every(row=>row.growth===null));
assert(failure.party[1].mastery>=2);
assert.equal(campaign.getUnit('soyo').exp,before);
assert(!campaign.getUnit('soyo').dead);

const next=new M.Game({stage:4,recruited:campaign.recruited,loadout:campaign.exportLoadout()});
assert(M.Shop.trainingUnlocked(next));
assert.equal(next.getUnit('tomori').exp,original.exp);
assert.equal(next.getUnit('tomori').inventory[0].uses,1);
const saves=new M.SaveManager();
saves.save(locked);
saves.save(campaign,{automatic:true});
assert.equal(saves.load('manual').snapshot.phase,'player');
assert.equal(saves.load('automatic').snapshot.phase,'victory');
assert(saves.delete().ok);
assert(!saves.hasSave());

console.log('Training tower: chapter gate, tickets, dynamic stats, map regeneration, EXP, mastery, outcomes, checkpoint isolation and inheritance passed.');
