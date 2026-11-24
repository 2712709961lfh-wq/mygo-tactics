/* ============================================================
 * game.js — 游戏状态机与规则入口
 *
 * 只负责“数据”：单位位置、HP、回合、阶段、随机数、存档快照。
 * 动画、弹窗、AI 调度由 ui.js 负责，便于进行无浏览器测试。
 * ============================================================ */
(function (global) {
  'use strict';
  const MyGO = (global.MyGO = global.MyGO || {});
  const C = MyGO.CONFIG;
  const Grid = MyGO.Grid;
  const Pathfinding = MyGO.Pathfinding;
  const Combat = MyGO.Combat;

  // Non-serialized live context lets combat/UI/AI inspect adjacent protectors,
  // including after movement, recruitment, deaths and chapter restoration.
  function bindCombatMap(game){Object.defineProperty(game.map,'units',{configurable:true,get:()=>game.units});}

  // Keep core-only consumers independent of optional chapter modules.
  function missionForStage(stage) {
    return stage===12?C.STAGE_ROYAL_GARDEN:stage===11?C.STAGE_PALACE:stage===10?C.STAGE_TEN:stage===9?C.STAGE_NINE:stage===8?C.STAGE_EIGHT:stage===7?C.STAGE_SEVEN:stage===6?C.STAGE_SIX:stage===5?C.STAGE_FIVE:stage===4?C.STAGE_FOUR:stage===3?C.STAGE_THREE:stage===2?C.STAGE_TWO:C.MISSION;
  }

  function cloneMap() {
    return {
      cols: C.COLS,
      rows: C.ROWS,
      tiles: C.MAP_TERRAIN.map((row) => row.slice()),
      decor: (C.MAP_DECOR || []).slice()
    };
  }

  function stageTwoMap(stage = 2) {
    const mission = missionForStage(stage);
    return {
      cols: mission.cols,
      rows: mission.rows,
      tiles: mission.terrain.map((row) => row.slice()),
      decor: (mission.decor || []).slice()
    };
  }

  function unitsForStage(stage, recruited) {
    if (stage >= 4) {
      const m=missionForStage(stage);
      const heroes=C.UNITS.filter(u=>u.side==='player'||u.id==='xueyue'&&recruited.includes('xueyue'));
      if(recruited.includes('nina'))heroes.push(C.NINA);
      if(stage>=8)heroes.push(C.NIJIKA);
      if(stage>=11)heroes.push(C.SUBARU);
      return heroes.map(u=>createUnit({...u,...m.spawns[u.id],side:'player',boss:false,dormant:false,
        facing:stage>=6?'up':'right',mapCols:m.cols,mapRows:m.rows})).concat(m.enemies.map(createUnit),stage===10?[createUnit({...C.SUBARU,side:recruited.includes('subaru')?'player':'ally'})]:stage===7?[createUnit({...C.NIJIKA,side:recruited.includes('nijika')?'player':'ally'})]:[]);
    }
    if (stage === 3) {
      const heroes=C.UNITS.filter(u=>u.side==='player'||u.id==='xueyue'&&recruited.includes('xueyue'));
      return heroes.map(u=>createUnit({...u,...C.STAGE_THREE.spawns[u.id],side:'player',boss:false,dormant:false,mapCols:40,mapRows:30}))
        .concat(C.STAGE_THREE.enemies.map(u=>createUnit({...u,mapCols:40,mapRows:30})),[createUnit(C.NINA)]);
    }
    const spawns = stage === 2 ? C.STAGE_TWO.spawns : C.STAGE_ONE_SPAWNS;
    const joined = (recruited || []).includes('xueyue');
    const extraUnits = stage === 1 ? C.STAGE_ONE_EXTRA_UNITS : C.STAGE_TWO_EXTRA_UNITS;
    const templates = C.UNITS.concat(extraUnits.map(extra =>
      Object.assign({}, C.UNITS.find(u=>u.id===extra.base), extra)));
    return templates.filter(template => stage === 1 ? template.id !== 'conductor'
      : template.id !== 'xueyue' || joined).map(function (template) {
      const override = spawns[template.id];
      const ally = stage === 2 && template.id === 'xueyue' && joined ? { side: 'player', boss: false, dormant: false,
        quote: '心声已经传达到了。今后，请让我与你同行。' } : {};
      return createUnit(Object.assign({ mapCols:stage===2?C.STAGE_TWO.cols:C.COLS,
        mapRows:stage===2?C.STAGE_TWO.rows:C.ROWS }, template, override || {}, ally));
    });
  }

  function createUnit(template) {
    const job = template.classId ? MyGO.Classes.get(template.classId) : null;
    if (template.classId && !job) throw new Error('未知职业：' + template.classId);
    const unit = {
      id: template.id,
      name: template.name,
      shortName: template.shortName,
      side: template.side,
      classId: job ? job.id : null,
      className: job ? job.name : template.className,
      gender: template.gender || '不明',
      level: template.level,
      expClassBase: template.expClassBase || 30,
      maxHp: template.maxHp,
      hp: template.maxHp,
      // 物理武器读取 str，魔法武器读取 mag；两者都参与面板展示。
      str: template.str,
      mag: template.mag || 0,
      spd: template.spd,
      def: template.def,
      res: template.res,
      hit: template.hit,
      dex: template.dex || 0,
      lck: template.lck || 0,
      move: job ? job.move : template.move,
      // 预留技能 / 骑士团 / 装备被动的固定攻击修正。
      atkMod: template.atkMod || 0,
      // 供“有效修正”判定使用，例如 ['armor']、['flying']。
      tags: template.tags ? template.tags.slice() : (job ? job.tags.slice() : template.className.includes('骑士') ? ['cavalry'] : template.side==='enemy'&&template.id!=='xueyue'?['monster']:[]),
      weaponId: template.weapon,
      weapon: C.WEAPONS[template.weapon],
      x: template.x,
      y: template.y,
      boss: !!template.boss,
      hpFloor:template.hpFloor||0,
      escaped:false,
      dormant: !!template.dormant,
      key: !!template.key,
      drops: (template.drops||[]).slice(),
      guardGroup: template.guardGroup || null,
      guardRadius: template.guardRadius || 0,
      alerted: false,
      quote: template.quote,
      art: template.art,
      // 仅影响渲染：默认朝向与行走动画状态。
      // 优先使用关卡指定朝向，否则按站位面向场内。
      facing: template.facing || (() => {
        const centerX = ((template.mapCols || C.COLS) - 1) / 2;
        if (template.x < centerX - 1) return 'right';
        if (template.x > centerX + 1) return 'left';
        return template.y < (template.mapRows || C.ROWS) / 2 ? 'down' : 'up';
      })(),
      _walking: false,
      _spritePhase: (template.x * 7 + template.y * 13) % 8,
      acted: false,
      talentAttackCount:0,
      dead: false
    };
    MyGO.Inventory.init(unit, template);
    for(const id of template.carriedItems||[])unit.inventory.push(MyGO.Inventory.make(id));
    MyGO.Growth.init(unit);
    unit.certifiedClasses=[unit.classId].filter(Boolean);
    MyGO.Mastery?.init(unit);
    return unit;
  }

  class Game {
    // 10 remains an internal encounter key for old saves; both encounters are chapter 9.
    get chapterNumber(){return this.stage>=10?this.stage-1:this.stage;}
    get nextChapterStage(){return this.stage===9||this.stage>=12?null:this.stage+1;}
    get rehearsalTransitionPending(){return this.stage===9&&this.gateOpen&&this.stageNineIntroSeen&&!!this.getUnit('rift_pegasus')?.dead&&!this.isOver();}
    constructor(options) {
      const opts = options || {};
      this.stage = [2,3,4,5,6,7,8,9,10,11,12].includes(opts.stage) ? opts.stage : 1;
      this.retreat = null;
      this.recruited = Array.isArray(opts.recruited) ? ['xueyue','nina','nijika','subaru'].filter(id=>opts.recruited.includes(id)) : [];
      this.recruited=this.recruited.filter(id=>this.stage>=11||id!=='subaru');
      if(this.stage>=11&&!this.recruited.includes('subaru'))this.recruited.push('subaru');
      if(this.stage>=11&&!opts.loadout&&!this.recruited.includes('xueyue'))this.recruited.push('xueyue');
      if(this.stage<7)this.recruited=this.recruited.filter(id=>id!=='nijika');
      if(this.stage>=8&&!this.recruited.includes('nijika'))this.recruited.push('nijika');
      if (this.stage === 1) this.recruited = [];
      this.recruitmentShown = false;
      this.ninaLost = !!opts.ninaLost;
      if(this.stage>=9&&!opts.loadout&&!this.ninaLost&&!this.recruited.includes('nina'))this.recruited.push('nina');
      if(this.ninaLost)this.recruited=this.recruited.filter(id=>id!=='nina');
      this.recruited=['xueyue','nina','nijika','subaru'].filter(id=>this.recruited.includes(id));
      this.ninaRecruitmentShown = false;
      this.nijikaJoined=this.stage>=7&&this.recruited.includes('nijika');
      this.livehouseEndingShown=false;
      this.stageEightIntroSeen=false;
      this.stageNineIntroSeen=false;
      this.stageTenIntroSeen=false;this.subaruJoined=false;
      this.palaceIntroSeen=false;this.royalGardenIntroSeen=false;
      if(this.stage>=11)this.subaruJoined=true;
      this.map = this.stage >= 2 ? stageTwoMap(this.stage) : cloneMap();
      bindCombatMap(this);
      this.units = unitsForStage(this.stage, this.recruited);
      this.mission = missionForStage(this.stage);
      this.convoy = MyGO.Inventory.stock();
      this.lootReserve=[];
      this.gold=MyGO.Shop.START_GOLD;
      this.shopPurchases={};this.shopChapter=this.chapterNumber;this.rewardedChapters=[];
      this.trainingTicketsPurchased=0;
      this.rng = new MyGO.RNG(opts.seed);
      for(const u of this.units)u.growthRngState=MyGO.Growth.seed(u.id,this.rng.serialize());
      if (opts.loadout) this.importLoadout(opts.loadout);
      this.litLamps=[];
      this.summonedWaves=[];this.maskRetreatPending=false;this.maskEscaped=false;this.lastSummonTurn=0;
      this.openedChests=[];
      this.bossDiscovered=false;
      this.soyoBossBonus=false;
      this.enemyScaleLevel=0;this.enemyScalePower=0;
      if(this.stage>=4)this.applyFixedEnemyStats();
      this.turn = 1;
      this.phase = 'player'; // player | enemy | victory | defeat
      this.winner = null;
      this.gateOpen = false;
      this.resonanceOpen = false;
      this.awakenedBells = [];
      this.lastHealing = [];
      this.startedAt = Date.now();
    }

    completeTenthIntro() {
      if(this.stage!==10||this.stageTenIntroSeen&&this.subaruJoined)return;
      const u=this.getUnit('subaru');
      if(!u||u.dead)throw Error('昴的开场状态无效');
      this.stageTenIntroSeen=true;
      if(!this.subaruJoined){
        this.subaruJoined=true;u.side='player';u.acted=false;
        if(!this.recruited.includes('subaru'))this.recruited.push('subaru');
        MyGO.Inventory.learn(u);MyGO.Inventory.sync(u);
      }
      delete this._liveIntro;for(const unit of this.units)delete unit._summonAlpha;
    }

    beginRehearsalFinale() {
      if(!this.rehearsalTransitionPending||!C.STAGE_TEN||!this.livingCount('player'))return false;
      const party=this.units.filter(u=>u.side==='player');
      this.rehearsalFirstDefeated=this.units.filter(u=>u.side==='enemy'&&u.dead).length;
      for(const u of party){
        Object.assign(u,C.STAGE_TEN.spawns[u.id],{acted:!!u.dead,talentSwapReady:false,talentAttacked:false,facing:'up'});
        delete u._walking;delete u._summonAlpha;
      }
      this.stage=10;this.mission=C.STAGE_TEN;
      this.units=party.concat(C.STAGE_TEN.enemies.map(createUnit),[createUnit(C.SUBARU)]);
      const subaru=this.getUnit('subaru');subaru.growthRngState=MyGO.Growth.seed(subaru.id,this.rng.serialize());
      this.gateOpen=false;this.stageTenIntroSeen=false;this.subaruJoined=false;
      this.phase='player';this.winner=null;this.lastHealing=[];
      delete this._liveIntro;delete this._doorOpenedAt;
      bindCombatMap(this);this.applyFixedEnemyStats();
      return true;
    }

    completeNinthIntro() {
      if(this.stage!==9)return;
      this.stageNineIntroSeen=true;delete this._liveIntro;
      for(const u of this.units)delete u._summonAlpha;
    }

    completeEighthIntro() {
      if(this.stage!==8)return;
      this.stageEightIntroSeen=true;
      delete this._liveIntro;
      for(const u of this.units)delete u._summonAlpha;
    }

    joinNijika() {
      if(this.stage!==7)return null;
      const u=this.getUnit('nijika');if(!u||u.dead)return null;
      if(!this.nijikaJoined){
        this.nijikaJoined=true;u.side='player';u.acted=false;
        if(!this.recruited.includes('nijika'))this.recruited.push('nijika');
        MyGO.Inventory.learn(u);MyGO.Inventory.sync(u);
      }
      return u;
    }

    exportLoadout() {
      return {lootReserve:(this.lootReserve||[]).map(i=>({...i})),economy:this.packEconomy(),convoy:this.convoy.map(i=>({...i})),units:this.units.filter(u=>u.side==='player').map(u=>({id:u.id,...MyGO.Inventory.pack(u),growth:MyGO.Growth.pack(u)}))};
    }

    importLoadout(data) {
      this.lootReserve=MyGO.Inventory.validateBag(data.lootReserve||[],50);
      if(data.convoy)this.convoy=MyGO.Inventory.validateBag(data.convoy,500);
      this.collectReservedLoot();
      this.restoreEconomy(data.economy);
      for(const saved of data.units||[]){const u=this.getUnit(saved.id);if(u&&u.side==='player'){MyGO.Growth.restore(u,saved.growth,true);MyGO.Classes.restore(u,saved.classState);MyGO.Mastery?.restore(u,saved.classMastery,true);MyGO.Inventory.restore(u,saved,true);}}
    }

    packEconomy(){return {version:1,gold:this.gold,chapter:this.shopChapter,purchases:{...this.shopPurchases},rewarded:this.rewardedChapters.slice(),
      trainingTicketsPurchased:this.trainingTicketsPurchased};}

    restoreEconomy(data){
      if(data===undefined){this.gold=MyGO.Shop.START_GOLD;this.shopPurchases={};this.shopChapter=this.chapterNumber;this.rewardedChapters=[];this.trainingTicketsPurchased=0;return;}
      if(!data||data.version!==1||!Number.isSafeInteger(data.gold)||data.gold<0||data.gold>99999999||
        !Number.isInteger(data.chapter)||data.chapter<1||data.chapter>(this.stage>=11?this.chapterNumber:this.stage)||
        !data.purchases||typeof data.purchases!=='object'||Array.isArray(data.purchases)||
        !Array.isArray(data.rewarded)||new Set(data.rewarded).size!==data.rewarded.length||data.rewarded.some(c=>!Number.isInteger(c)||c<1||c>(this.stage>=11?this.chapterNumber:this.stage)))throw Error('存档商店数据无效');
      for(const [id,n] of Object.entries(data.purchases)){const p=MyGO.Shop.get(id);
        if(!p||p.stage>data.chapter||!Number.isInteger(n)||n<0||p.limit===null||n>p.limit)throw Error('存档限购数据无效');}
      const rewarded=[...new Set(data.rewarded.map(n=>this.stage<11&&n===10?9:n))];
      const ticketsPurchased=data.trainingTicketsPurchased===undefined?0:data.trainingTicketsPurchased;
      if(!Number.isInteger(ticketsPurchased)||ticketsPurchased<0||ticketsPurchased>MyGO.Shop.ticketAllowance(rewarded)||
        (ticketsPurchased>0&&!rewarded.includes(3)))throw Error('存档训练门票限购数据无效');
      this.gold=data.gold;this.shopChapter=this.chapterNumber;
      this.shopPurchases=[this.stage,this.chapterNumber].includes(data.chapter)?{...data.purchases}:{};
      this.rewardedChapters=rewarded;
      this.trainingTicketsPurchased=ticketsPurchased;
    }

    shopReason(){return this.phase!=='player'&&this.phase!=='victory'?'请在我方阶段或战后购物':'';}

    buyItem(id,quantity=1){
      const p=MyGO.Shop.get(id),reason=this.shopReason();if(reason)throw Error(reason);
      if(!p||!MyGO.Shop.unlocked(this,p))throw Error('尚未解锁该商品');
      if(!Number.isInteger(quantity)||quantity<1||quantity>99)throw Error('购买数量无效');
      const remaining=MyGO.Shop.remaining(this,p);
      if(remaining!==null&&quantity>remaining)throw Error(id===MyGO.Shop.TICKET?'训练门票购买额度不足':'本章库存不足');
      if(this.convoy.length+quantity>500)throw Error('运输队容量不足');
      const cost=p.price*quantity;if(this.gold<cost)throw Error('资金不足');
      const entries=Array.from({length:quantity},()=>MyGO.Inventory.make(id));
      this.gold-=cost;
      if(id===MyGO.Shop.TICKET)this.trainingTicketsPurchased+=quantity;
      else if(p.limit!==null)this.shopPurchases[id]=(this.shopPurchases[id]||0)+quantity;
      this.convoy.push(...entries);return {id,quantity,cost};
    }

    sellItem(index){
      const reason=this.shopReason();if(reason)throw Error(reason);
      const slot=Number.isInteger(index)&&this.convoy[index],p=slot&&MyGO.Shop.get(slot.id);
      if(!p)throw Error('该物品不能出售');
      const e=MyGO.Inventory.item(slot.id),price=Math.floor(p.price/2*(e.uses===null?1:slot.uses/e.uses));
      if(price<1)throw Error('该物品没有出售价值');
      this.convoy.splice(index,1);this.gold+=price;this.collectReservedLoot();return price;
    }

    reclassLockReason(unit){
      if(!unit||unit.side!=='player')return '只有已入队的同伴可以转职';
      if(this.phase!=='player'&&this.phase!=='victory')return '请在我方阶段或战后转职';
      // Class management also applies to withdrawn companions. It never heals
      // or revives them; their acted flag cannot lock out roster management.
      if(!unit.dead&&unit.acted&&this.phase!=='victory'&&!this.retreat)return '该角色已行动，请在下回合转职';
      return '';
    }

    equipMasterySkill(unit,id){
      const reason=this.reclassLockReason(unit);if(reason)throw Error(reason);
      MyGO.Mastery.equip(unit,id);
    }

    selectCombatArt(unit,id){
      if(this.phase!=='player'||!unit||unit.side!=='player'||unit.dead||unit.acted||unit.escaped||this.isOver())throw Error('该角色现在无法选择战技');
      const reason=MyGO.Mastery.artReason(unit,id);if(reason)throw Error(reason);
      if(MyGO.Mastery.arts[id].assist)throw Error('辅助战技需选择同伴目标');
      unit.combatArtId=id;
    }

    useMasteryAssist(unit,target,id,index){return MyGO.Mastery.useAssist(this,unit,target,id,index);}

    reclassReason(unit,id){
      const reason=this.reclassLockReason(unit),job=MyGO.Classes.get(id);if(reason)return reason;
      if(!unit.classId||!job)return '该角色不能转为此职业';
      if(job.id===unit.classId)return '当前已是该职业';
      if(unit.level<job.minLevel)return '需要达到 Lv.'+job.minLevel;
      if(job.gender&&job.gender!==unit.gender)return job.gender+'性限定职业';
      if(job.prerequisite&&!unit.certifiedClasses.includes(job.prerequisite))return '需先取得'+MyGO.Classes.get(job.prerequisite).name+'资格';
      if(!unit.certifiedClasses.includes(id)&&job.seal&&!unit.inventory.concat(this.convoy).some(i=>i.id===job.seal))return '缺少'+MyGO.Inventory.item(job.seal).name;
      return '';
    }

    reclassUnit(unit,id){
      const reason=this.reclassReason(unit,id);if(reason)throw Error(reason);
      const job=MyGO.Classes.get(id);
      if(!unit.certifiedClasses.includes(id)&&job.seal){const bag=unit.inventory.some(i=>i.id===job.seal)?unit.inventory:this.convoy;bag.splice(bag.findIndex(i=>i.id===job.seal),1);}
      MyGO.Classes.apply(unit,id);
      if(this.phase==='player'&&!this.retreat)this.markActed(unit);
      return job;
    }

    medicineReason(unit,index){
      if(!unit||unit.dead||unit.side!=='player'||unit.hp<=0)return '该角色无法使用药品';
      if(this.phase!=='player'||unit.acted)return '请在我方未行动时使用药品';
      const slot=unit.inventory[index],e=slot&&MyGO.Inventory.item(slot.id);
      if(!e||e.kind!=='consumable'||slot.uses<1)return '该格不是可用药品';
      if(e.action==='heal'&&unit.hp>=unit.maxHp)return '生命已满';
      if(e.action==='antitoxin'&&!unit.status.poison)return '当前没有中毒';
      if(e.action==='ward'&&unit.status.ward>=7)return '魔防增益已达上限';
      return '';
    }

    useMedicine(unit,index){
      const reason=this.medicineReason(unit,index);if(reason)throw Error(reason);
      const slot=unit.inventory[index],e=MyGO.Inventory.item(slot.id);let healed=0;
      if(e.action==='heal'){healed=Math.min(e.power,unit.maxHp-unit.hp);unit.hp+=healed;}
      if(e.action==='antitoxin')delete unit.status.poison;
      if(e.action==='ward')unit.status.ward=7;
      const resourcePreserved=!!MyGO.Talents?.preserveUse(unit,e.kind,this.rng);
      if(!resourcePreserved){slot.uses--;if(slot.uses===0)unit.inventory.splice(index,1);}
      this.markActed(unit);MyGO.Inventory.sync(unit);return {item:e,healed,resourcePreserved};
    }

    loadoutReason(unit) {
      if(!unit||unit.side!=='player'||unit.dead)return '该角色无法整理背包';
      if(this.phase!=='player'&&this.phase!=='victory')return '请在我方阶段整理背包';
      if(unit.acted&&this.phase!=='victory'&&!this.retreat)return '该角色已行动，请在下回合整理背包';
      return '';
    }

    transferItem(unit,index,toConvoy) {
      const reason=this.loadoutReason(unit);if(reason)throw Error(reason);
      const from=toConvoy?unit.inventory:this.convoy,to=toConvoy?this.convoy:unit.inventory;
      if(!Number.isInteger(index)||!from[index])throw Error('物品不存在');
      if(toConvoy&&to.length>=500)throw Error('运输队容量不足');
      if(!toConvoy&&to.length>=5)throw Error('背包已满（5/5）');
      const [entry]=from.splice(index,1);to.push(entry);this.collectReservedLoot();MyGO.Inventory.sync(unit);
    }

    equipItem(unit,index) {
      const reason=this.loadoutReason(unit);if(reason)throw Error(reason);
      MyGO.Inventory.equip(unit,index);
    }

    selectAttack(unit,id) {
      if(!unit||unit.dead||!((this.phase===unit.side&&!unit.acted)||(unit.side==='player'&&!this.loadoutReason(unit))))throw Error('当前无法切换攻击手段');
      MyGO.Inventory.select(unit,id);
    }

    supportTargets(caster,spellId) {
      const s=MyGO.Magic.get(spellId);
      if(!s||!s.support||s.effect==='torch'||!caster||caster.dead||caster.acted||this.phase!==caster.side||
        !MyGO.Inventory.magicAllowed(caster)||caster.status.silence||!caster.learnedSpells.includes(spellId)||!(caster.spellUses[spellId]>0))return [];
      const r=MyGO.Magic.rangeOf(s,caster),d=u=>Grid.manhattan(caster,u);
      if(s.effect==='silence')return this.units.filter(u=>!u.dead&&Grid.hostile(u,caster)&&(caster.side!=='player'||this.isUnitVisible(u))&&u.learnedSpells.length&&d(u)>=r[0]&&d(u)<=r[1]&&!u.status.silence);
      return this.living().filter(u=>!Grid.hostile(u,caster)&&u.id!==caster.id&&d(u)>0&&d(u)<=(s.effect==='warp'?1:r[1])&&
        (['heal','fortify'].includes(s.effect)?u.hp<u.maxHp:s.effect==='restore'?['defDown','spdDown','moveDown','silence','talentResDown','frostSpeedDown','masterySealDef','masterySealRes'].some(k=>u.status[k]):
        s.effect==='rescue'?this.supportDestinations(caster,spellId,u).length>0:s.effect==='ward'?!(u.status.ward>=7):true));
    }

    supportDestinations(caster,spellId,target) {
      const s=MyGO.Magic.get(spellId);if(!s||!['warp','rescue'].includes(s.effect))return [];
      const range=s.effect==='rescue'?1:MyGO.Magic.rangeOf(s,caster)[1],out=[];
      for(let y=0;y<this.map.rows;y++)for(let x=0;x<this.map.cols;x++){
        const d=Grid.manhattan(caster,{x,y});
        if(d>=1&&d<=range&&Number.isFinite(Grid.movementCost(this.map,target,x,y))&&!this.unitAt(x,y)&&this.isVisible(x,y))out.push({x,y});
      }
      return out;
    }

    castSupport(caster,spellId,target,destination) {
      const s=MyGO.Magic.get(spellId),targets=this.supportTargets(caster,spellId);
      if(!s||!targets.some(u=>u.id===target?.id))throw Error('魔法目标无效、超出射程或次数不足');
      if(['warp','rescue'].includes(s.effect)){
        const cells=this.supportDestinations(caster,spellId,target);
        destination=destination||cells[0];
        if(!destination||!cells.some(c=>c.x===destination.x&&c.y===destination.y))throw Error('传送落点无效');
      }
      const resourcePreserved=!!MyGO.Talents?.preserveUse(caster,s.kind,this.rng);
      MyGO.Inventory.consume(caster,spellId,resourcePreserved);
      const affected=['fortify','restore'].includes(s.effect)?targets:[target];
      const changes=[];
      for(const u of affected){
        if(['heal','fortify'].includes(s.effect)){const amount=Math.min(u.maxHp-u.hp,MyGO.Magic.healAmount(s,caster));u.hp+=amount;changes.push({id:u.id,amount});}
        if(s.effect==='restore')for(const k of ['defDown','spdDown','moveDown','silence','talentResDown','frostSpeedDown','frostFresh','masterySealDef','masterySealRes'])delete u.status[k];
        if(s.effect==='ward')u.status.ward=7;
        if(s.effect==='silence'){u.status.silence=1;this.alertGroup(u);}
        if(['warp','rescue'].includes(s.effect))this.setUnitPosition(u.id,destination.x,destination.y);
        MyGO.Inventory.sync(u);
      }
      const talentHealing=MyGO.Talents?.onSupport(caster,s,changes)||0;
      if(talentHealing)changes.push({id:caster.id,amount:talentHealing,talent:'同心'});
      this.markActed(caster);MyGO.Inventory.sync(caster);
      let growth=this.isTraining?null:MyGO.Growth.award(caster,MyGO.Growth.supportExp(caster,spellId,this.turn));
      if(MyGO.Mastery)growth=MyGO.Mastery.attachReport(caster,growth,MyGO.Mastery.award(caster,this.masteryMultiplier??1));
      return {spell:s,changes,talentHealing,resourcePreserved,affected:affected.map(u=>u.id).concat(talentHealing?[caster.id]:[]),experience:growth?[growth]:[]};
    }

    expireStatuses(side) {
      for(const u of this.living(side)){
        for(const k of ['defDown','spdDown','moveDown','silence'])delete u.status[k];
        MyGO.Mastery?.endTurn(u);
        MyGO.Talents?.expireFrost(u);
        MyGO.Inventory.sync(u);
      }
    }

    decayWard(side) {for(const u of this.living(side))if(u.status.ward)u.status.ward--;}

    /** 切换静态关卡数据（不影响回合/单位状态，由 restore 重新填充）。 */
    _setupStage(stage) {
      this.stage = [2,3,4,5,6,7,8,9,10,11,12].includes(stage) ? stage : 1;
      this.map = this.stage >= 2 ? stageTwoMap(this.stage) : cloneMap();
      bindCombatMap(this);
      this.units = unitsForStage(this.stage, this.recruited);
      this.mission = missionForStage(this.stage);
      this.gateOpen = false;
      this.nijikaJoined=this.stage>=7&&this.recruited.includes('nijika');
      this.livehouseEndingShown=false;
      this.stageEightIntroSeen=false;
      this.stageNineIntroSeen=false;
      this.stageTenIntroSeen=false;this.subaruJoined=false;
      this.resonanceOpen = false;
      this.awakenedBells = [];
      this.litLamps=[];
      this.summonedWaves=[];this.maskRetreatPending=false;this.maskEscaped=false;this.lastSummonTurn=0;
      this.openedChests=[];this.bossDiscovered=false;this.soyoBossBonus=false;this.enemyScaleLevel=0;this.enemyScalePower=0;
      if(this.stage>=4)this.applyFixedEnemyStats();
    }

    /** Party vision moves with units; lamplight remains until the end of the map. */
    isVisible(x,y) {
      if(this.stage!==4)return true;
      const within=(p,r)=>(p.x-x)**2+(p.y-y)**2<=r*r;
      return this.living('player').some(p=>within(p,this.mission.visionRadius)) ||
        this.mission.lamps.some(l=>(this.litLamps||[]).includes(l.id)&&within(l,this.mission.lampRadius));
    }

    isUnitVisible(unit) {return !!unit&&(unit.side!=='enemy'||this.isVisible(unit.x,unit.y));}

    parkSoundHint() {
      if(this.stage!==4)return '';
      const lamp=this.mission.lamps.find(l=>l.id===this.litLamps[this.litLamps.length-1]);
      return lamp?.sound || '风声掩住了低语。先在附近探索，点亮找到的路灯。';
    }

    nearbyUnlitLamp(unit) {
      return this.stage===4&&unit ? this.mission.lamps.find(l=>!this.litLamps.includes(l.id)&&Grid.manhattan(l,unit)<=1)||null : null;
    }

    canLightLamp(unit) {
      return this.isPlayerPhase()&&!!unit&&unit.side==='player'&&!unit.dead&&!unit.acted&&!!this.nearbyUnlitLamp(unit);
    }

    lightLamp(unit) {
      if(!this.canLightLamp(unit))return null;
      const lamp=this.nearbyUnlitLamp(unit);this.litLamps.push(lamp.id);this.markActed(unit);
      // The switch echoes along walkable ground, beyond the pool of light.
      const heard=Pathfinding.getReachable(this.map,{id:'__lamp_noise__',side:'player',...lamp,move:this.mission.lampNoiseRadius},[]);
      for(const enemy of this.living('enemy'))if(!enemy.boss&&heard.has(Grid.key(enemy.x,enemy.y)))this.alertGroup(enemy);
      this.refreshParkDiscovery();return lamp;
    }

    refreshParkDiscovery() {
      if(this.stage===4){const boss=this.getUnit('dark_soyo');if(boss&&this.isUnitVisible(boss))this.bossDiscovered=true;}
    }

    /** Campaign enemies use authored chapter values, independent of the party.
     * Keep wounds and battle state when migrating an older scaled save. */
    applyFixedEnemyStats(units=this.units) {
      if(this.stage<4)return;
      const mission=missionForStage(this.stage),templates=mission.enemies.concat(this.stage===6?mission.summonTemplates:[]);
      for(const u of units.filter(u=>u.side==='enemy')){
        const base=templates.find(t=>t.id===u.id),ratio=u.hp/u.maxHp;
        const job=base.classId?MyGO.Classes.get(base.classId):null;
        u.level=base.level;
        for(const key of ['maxHp','str','mag','dex','spd','lck','def','res'])u[key]=base[key]||0;
        u.move=job?job.move:base.move;
        if([5,6].includes(this.stage)){
          const weapon=C.WEAPONS[base.weapon];
          const role=u.boss?'boss':u.tags.includes('armor')?'armor':u.tags.includes('flying')?'flying':weapon.damageType==='magic'?'magic':weapon.type;
          for(const [key,value] of Object.entries(mission.enemyStatBonuses[role]))u[key]+=value;
        }
        if(this.stage===7){
          const weapon=C.WEAPONS[base.weapon],bonus=mission.enemyStatBonuses[weapon.damageType==='magic'?'magic':weapon.type];
          for(const [key,value] of Object.entries(bonus))u[key]+=value;
        }
        if(this.stage===8){
          const profile=mission.balanceStats[u.id]||mission.balanceStats[u.tags.includes('armor')?'armor':u.tags.includes('flying')?'flying':''];
          if(profile)Object.assign(u,profile);
        }
        u.hp=u.dead?0:Math.max(1,Math.min(u.maxHp,Math.ceil(u.maxHp*ratio-1e-9)));
      }
      // Kept in snapshots solely for compatibility with pre-fixed-stat saves.
      this.enemyScaleLevel=Math.min(...mission.enemies.map(u=>u.level));this.enemyScalePower=this.stage===8?100:0;
    }

    /** Legacy save reconstruction only. Never called by current gameplay. */
    restoreLegacyEnemyScale(level,units=this.units,force=false,legacyEighth=false,legacySeventh=false) {
      if(this.stage<4)return;
      if(this.stage===8&&!legacyEighth)return this.restoreLegacyEighthScale(level,units,force);
      const party=units.filter(u=>u.side==='player');
      const target=level??Math.min(97,Math.ceil(party.reduce((n,u)=>n+u.level,0)/Math.max(1,party.length)));
      if(target<=this.enemyScaleLevel&&!force)return;
      for(const u of units.filter(u=>u.side==='enemy')){
        const base=missionForStage(this.stage).enemies.concat(this.stage===6?C.STAGE_SIX.summonTemplates:[]).find(t=>t.id===u.id),ratio=u.hp/u.maxHp;
        u.level=Math.min(99,target+(u.boss?2:0));const d=u.level-base.level;
        const courtArmor=this.stage>=5&&u.tags.includes('armor');
        for(const [k,rate] of Object.entries({maxHp:courtArmor?(u.boss?2:1):u.boss?3:2,str:.65,mag:.65,dex:.5,spd:.35,def:.4,res:courtArmor?.15:.45,lck:.3}))
          u[k]=Math.max(k==='maxHp'?(u.boss?(courtArmor?22:26):12):0,base[k]+Math.round(d*rate));
        if(this.stage===7&&!legacySeventh){
          const weapon=C.WEAPONS[base.weapon],bonus=C.STAGE_SEVEN.enemyStatBonuses[weapon.damageType==='magic'?'magic':weapon.type];
          for(const [key,value] of Object.entries(bonus))u[key]+=value;
        }
        u.hp=u.dead?0:Math.max(1,Math.ceil(u.maxHp*ratio-(this.stage===7?1e-9:0)));
      }
      this.enemyScaleLevel=target;
    }

    /** Fixed panel profiles for every chapter-eight enemy. Legacy modes rebuild
     * previous scaling limits before migrating wounds: v1 uses total power,
     * v2/v3 scaled ordinary soldiers from effective power. */
    restoreLegacyEighthScale(level,units=this.units,force=false,legacy=false,legacyRegular=false) {
      const party=units.filter(u=>u.side==='player');
      const target=Math.min(97,Math.max(10,this.enemyScaleLevel||0,level||0,...party.map(u=>u.level)));
      const effectiveTotal=u=>Combat.statTotalOf(u)-(u.weapon.damageType==='magic'?(u.str||0):(u.mag||0));
      const power=Math.max(100,this.enemyScalePower||0,...party.map(legacy?Combat.statTotalOf:effectiveTotal));
      if(!force&&target===this.enemyScaleLevel&&power===this.enemyScalePower)return;
      for(const u of units.filter(u=>u.side==='enemy')){
        const base=C.STAGE_EIGHT.enemies.find(t=>t.id===u.id),ratio=u.hp/u.maxHp;
        const armor=u.tags.includes('armor'),flying=u.tags.includes('flying'),magic=C.WEAPONS[base.weapon].damageType==='magic';
        u.level=Math.min(99,target+(u.boss?2:0));const delta=u.level-base.level;
        const fixed=!legacy&&(!legacyRegular||u.boss||armor||flying)&&(C.STAGE_EIGHT.balanceStats[u.id]||C.STAGE_EIGHT.balanceStats[armor?'armor':flying?'flying':'']);
        if(fixed){
          Object.assign(u,fixed);
          u.hp=u.dead?0:Math.max(1,Math.ceil(u.maxHp*ratio-1e-9));
          continue;
        }
        for(const [key,rate] of Object.entries({maxHp:armor?1:u.boss?3:2,str:.65,mag:.65,dex:.5,spd:.35,def:.4,res:armor?.15:.45,lck:.3}))
          u[key]=Math.max(key==='maxHp'?12:0,base[key]+Math.round(Math.max(0,delta)*(legacy||key!==(magic?'str':'mag')?rate:0)));
        const budget=Math.ceil(power*(u.boss?1.30:armor?1.05:flying?1:.95));
        const total=legacy?Combat.statTotalOf(u):Combat.statTotalOf(u)-(magic?u.str:u.mag);
        const extra=Math.max(0,budget-total);
        // No movement inflation; distribute power into each class's useful stats.
        const weights=armor?{maxHp:34,str:21,dex:13,spd:4,lck:4,def:21,res:3}
          :magic?{maxHp:30,mag:23,dex:12,spd:10,lck:6,def:6,res:13}
          :flying?{maxHp:30,str:20,dex:14,spd:17,lck:5,def:5,res:9}
          :{maxHp:34,str:19,dex:13,spd:12,lck:6,def:10,res:6};
        const parts=Object.entries(weights).map(([key,weight])=>({key,n:Math.floor(extra*weight/100),fraction:extra*weight%100}));
        parts.sort((a,b)=>b.fraction-a.fraction);
        const remainder=extra-parts.reduce((n,p)=>n+p.n,0);
        for(let i=0;i<remainder;i++)parts[i].n++;
        for(const p of parts)u[p.key]+=p.n;
        u.hp=u.dead?0:Math.max(1,Math.ceil(u.maxHp*ratio-1e-9));
      }
      this.enemyScaleLevel=target;this.enemyScalePower=power;
    }

    /** At most one mixed wave each enemy phase; appearing units wait a full round. */
    summonNearParty() {
      if(this.stage!==6||this.phase!=='enemy'||this.maskRetreatPending||this.maskEscaped||this.lastSummonTurn===this.turn)return null;
      const party=this.living('player').slice().sort((a,b)=>a.y-b.y||a.x-b.x),wave=this.mission.waves[this.summonedWaves.length];
      if(!wave||!party.some(u=>u.y<=wave.threshold))return null;
      const reserved=new Set(this.living().map(u=>Grid.key(u.x,u.y))),placements=[];
      for(const [i,t] of wave.enemies.entries()){
        const anchor=party[i%party.length],cells=[];
        for(let y=Math.max(10,anchor.y-8);y<=Math.min(this.map.rows-3,anchor.y+8);y++)for(let x=2;x<this.map.cols-2;x++){
          const d=Grid.manhattan(anchor,{x,y}),nearest=Math.min(...party.map(u=>Grid.manhattan(u,{x,y})));
          if(d<3||d>8||nearest<3||reserved.has(Grid.key(x,y))||!Number.isFinite(Grid.movementCost(this.map,t,x,y)))continue;
          cells.push({x,y,score:Math.abs(d-4)*10+((i%2===0?x<anchor.x:x>anchor.x)?0:2)+(this.map.tiles[y][x]==='water'?1:0)});
        }
        cells.sort((a,b)=>a.score-b.score||a.y-b.y||a.x-b.x);
        if(!cells.length)return null;
        const cell=cells[0];reserved.add(Grid.key(cell.x,cell.y));placements.push({...t,x:cell.x,y:cell.y});
      }
      const summoned=placements.map(t=>createUnit({...t,mapCols:this.map.cols,mapRows:this.map.rows}));
      for(const u of summoned){u.acted=true;u.alerted=true;u.growthRngState=MyGO.Growth.seed(u.id,this.rng.serialize());}
      this.units.push(...summoned);this.summonedWaves.push(wave.id);this.lastSummonTurn=this.turn;
      this.applyFixedEnemyStats(summoned);
      this.getUnit('masked_stranger').acted=true;
      return {id:wave.id,name:wave.name,units:summoned};
    }

    finishMaskedEscape() {
      if(this.stage!==6||!this.maskRetreatPending||this.maskEscaped)return false;
      const boss=this.getUnit('masked_stranger');boss.hp=1;boss.dead=false;boss.escaped=true;boss.acted=true;
      this.maskRetreatPending=false;this.maskEscaped=true;this.checkOutcome();return true;
    }

    getUnit(id) {
      return this.units.find((u) => u.id === id) || null;
    }

    unitAt(x, y) {
      return Grid.unitAt(this.units, x, y);
    }

    living(side) {
      return Grid.living(this.units, side);
    }

    livingCount(side) {
      return this.living(side).length;
    }

    getTerrain(x, y) {
      const t=Grid.terrainAt(this.map, x, y);
      if(this.stage>=7){
        const labels={plaza:['演出厅地板','宽敞的观众站席，可沿两侧绕过设备箱和立柱。'],road:['舞台地板','Live House 的演出舞台。仍有敌人占据这里。'],wall:['隔墙与设备','不可穿越的隔墙、音箱、鼓组或固定设备。'],fort:['急救补给点','场馆的急救补给位置，回合开始时回复生命。']};
        const label=labels[t.id];if(label)return {...t,name:label[0],desc:label[1]};
      }
      return t;
    }

    /** 当前阶段是否接受玩家操作。 */
    isPlayerPhase() {
      return this.phase === 'player'&&!this.rehearsalTransitionPending;
    }

    isOver() {
      return this.phase === 'victory' || this.phase === 'defeat';
    }

    /** 选中单位可移动范围。 */
    getReachable(unit) {
      return Pathfinding.getReachable(this.map, unit, this.units,
        this.stage===4&&unit.side==='player'?(x,y)=>this.isVisible(x,y):null);
    }

    /** 返回指定攻击位置可攻击的敌人。 */
    getAttackableEnemies(unit, fromX, fromY) {
      if(this.maskRetreatPending||unit.escaped)return [];
      const x = fromX == null ? unit.x : fromX;
      const y = fromY == null ? unit.y : fromY;
      return Pathfinding.getTargetsInRange(unit, this.units, x, y).filter(u=>(unit.side!=='player'||this.isUnitVisible(u))&&!MyGO.Mastery?.targetReason(unit,u,this.map));
    }

    getAttackOptions(unit) {
      return MyGO.Inventory.options(unit).map(id => ({
        id, targets: this.getAttackableEnemies(MyGO.Inventory.withAttackWeapon(unit, id))
      })).filter(option => option.targets.length);
    }

    /** 攻击范围格子（用于高亮）。 */
    getAttackTiles(unit, fromX, fromY) {
      return Pathfinding.getAttackTiles(
        this.map,
        unit,
        fromX == null ? null : { x: fromX, y: fromY }
      );
    }

    /** Visible enemy's potential coverage after moving, using the current weapon. */
    getEnemyThreatTiles(unit) {
      const tiles=new Set();
      if(!unit||unit.side!=='enemy'||unit.dead||unit.escaped||this.maskRetreatPending||
        !this.isUnitVisible(unit)||!MyGO.Inventory.usable(unit))return tiles;
      // Hidden units must not reveal themselves through gaps in the overlay.
      const knownUnits=this.stage===4?this.units.filter(u=>this.isUnitVisible(u)):this.units;
      const reachable=Pathfinding.getReachable(this.map,unit,knownUnits);
      for(const origin of reachable.values()){
        if(!origin.stoppable)continue;
        for(const cell of Pathfinding.getAttackTiles(this.map,unit,origin)){
          if(this.isVisible(cell.x,cell.y))tiles.add(Grid.key(cell.x,cell.y));
        }
      }
      return tiles;
    }

    canAttack(attacker, target) {
      return (
        !!attacker &&
        !!target &&
        !attacker.dead &&
        !target.dead && !target.escaped && !attacker.escaped && !this.maskRetreatPending &&
        (attacker.side!=='player'||this.isUnitVisible(target)) &&
        Grid.hostile(attacker, target) &&
        !(MyGO.Mastery?.targetReason(attacker,target,this.map)) &&
        Pathfinding.canAttackFrom(attacker, attacker.x, attacker.y, target)
      );
    }

    /** 记录移动结果；只修改坐标，不做动画。 */
    setUnitPosition(unitId, x, y) {
      const unit = this.getUnit(unitId);
      if (!unit) throw new Error('单位不存在');
      if (!Grid.inBounds(this.map, x, y)) throw new Error('坐标越界');
      if (!Number.isFinite(Grid.movementCost(this.map,unit,x,y))) throw new Error('不能停留在阻挡地形');
      const occupant = this.unitAt(x, y);
      if (occupant && occupant.id !== unit.id) throw new Error('目标格已被占用');
      unit.x = x;
      unit.y = y;
      this.refreshParkDiscovery();
      return unit;
    }

    markActed(unit,attacked=false) {
      if(!unit)return;
      unit.combatArtId=null;unit.talentAttacked=!!unit.talentAttacked||attacked;
      unit.talentSwapReady=false;
      unit.acted=true;
    }

    resetActed(side) {
      for (const unit of this.living(side)){unit.acted=false;unit.talentAttacked=false;unit.talentSwapReady=false;}
    }

    // Compatibility entry points for older saves and consumers. The swap talent was replaced.
    talentSwapTargets(){return [];}

    talentSwap(){throw Error('幸福者退让已替换为自信者光芒，无法交换位置');}

    skipTalentSwap(unit){
      if(unit?.id==='anon')unit.talentSwapReady=false;
    }

    /** 打开庭院大门，并同步地图格。返回是否是第一次打开。 */
    openGate() {
      if (this.gateOpen) return false;
      this.gateOpen = true;
      this._syncGateTiles();
      return true;
    }

    gateForKey(unit) {
      if(this.stage===9){
        if(this.gateOpen||!this.stageNineIntroSeen||!this.getUnit(this.mission.bossId)?.dead||!unit||!this.ninthKeyBag(unit))return null;
        return Grid.manhattan(unit,this.mission.door)===1?{...this.mission.door}:null;
      }
      if (this.stage !== 1 || this.gateOpen || !unit) return null;
      if (!unit.inventory.some(i => i.id === 'courtyard_key' && i.uses > 0)) return null;
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        const cell = {x: unit.x + dx, y: unit.y + dy};
        if (this.getTerrain(cell.x, cell.y).id === 'gate') return cell;
      }
      return null;
    }

    ninthKeyBag(unit) {
      // The convoy is accessible to all companions; reserved quest loot cannot lock the exit.
      return [unit?.inventory||[],this.convoy,this.lootReserve||[]].find(b=>b.some(i=>i.id==='strange_door_key'&&i.uses>0));
    }

    canUseGateKey(unit) {
      return this.isPlayerPhase() && !!unit && unit.side === 'player' && !unit.dead && !unit.acted && !!this.gateForKey(unit);
    }

    useGateKey(unit) {
      if (!this.canUseGateKey(unit)) return false;
      const gate = this.gateForKey(unit);
      const bag=this.stage===9?this.ninthKeyBag(unit):unit.inventory,key=this.stage===9?'strange_door_key':'courtyard_key';
      bag.splice(bag.findIndex(i=>i.id===key),1);
      this.openGate();
      this.markActed(unit);
      MyGO.Inventory.sync(unit);
      if(this.stage===9)this.checkOutcome();
      return gate;
    }

    /** Mission loot has a reserve if both bags and convoy are full; never discard it. */
    awardLoot(unit,id) {
      const entry=MyGO.Inventory.make(id),isKey=MyGO.Inventory.item(id).kind==='key';
      if(isKey&&unit.inventory.length>=5&&this.convoy.length<500){
        const index=unit.inventory.findIndex(i=>MyGO.Inventory.item(i.id).kind!=='key'&&i.id!==unit.equippedWeapon);
        if(index>=0)this.convoy.push(unit.inventory.splice(index,1)[0]);
      }
      let location;
      if(unit.inventory.length<5){unit.inventory.push(entry);location=unit.name+'的背包';}
      else if(this.convoy.length<500){this.convoy.push(entry);location='运输队';}
      else{(this.lootReserve||(this.lootReserve=[])).push(entry);location='战利品暂存（运输队腾出空间后自动领取）';}
      MyGO.Inventory.sync(unit);
      return {id,recipientId:unit.id,location};
    }

    collectReservedLoot(){
      while(this.lootReserve?.length&&this.convoy.length<500)this.convoy.push(this.lootReserve.shift());
    }

    nearbyChest(unit){
      return [5,8].includes(this.stage)&&unit?(this.mission.chests.find(c=>!this.openedChests.includes(c.id)&&Grid.manhattan(unit,c)<=1)||null):null;
    }

    canOpenChest(unit){
      return this.phase==='player'&&!!unit&&unit.side==='player'&&!unit.dead&&!unit.acted&&!!this.nearbyChest(unit)&&
        unit.inventory.some(i=>i.id==='chest_key'&&i.uses>0);
    }

    openChest(unit){
      if(!this.canOpenChest(unit))return null;
      const chest=this.nearbyChest(unit),index=unit.inventory.findIndex(i=>i.id==='chest_key'&&i.uses>0);
      unit.inventory.splice(index,1);this.openedChests.push(chest.id);this.markActed(unit);
      const drop=chest.item?this.awardLoot(unit,chest.item):null;
      if(chest.gold)this.gold+=chest.gold;
      MyGO.Inventory.sync(unit);return {chest,drop,gold:chest.gold||0};
    }

    _awardGateKey(unit) {
      // Keep the killing unit's five-slot bag valid without losing the drop.
      let stored = null;
      if (unit.inventory.length >= MyGO.Inventory.MAX_SLOTS) {
        let index = unit.inventory.findIndex(i => i.id !== unit.equippedWeapon && i.id !== unit.equippedAccessory && MyGO.Inventory.item(i.id).kind !== 'key');
        if (index < 0) index = unit.inventory.findIndex(i => MyGO.Inventory.item(i.id).kind !== 'key');
        [stored] = unit.inventory.splice(index, 1);
        this.convoy.push(stored);
      }
      unit.inventory.push(MyGO.Inventory.make('courtyard_key'));
      return stored;
    }

    /** 闭门时庭院内的休眠敌人不会行动。 */
    isUnitActive(unit) {
      if (!unit || unit.escaped || this.maskRetreatPending || (unit.dormant && !this.gateOpen)) return false;
      return !unit.guardRadius || unit.alerted || this.parkHuntActive(unit) || this._seesPlayer(unit);
    }

    parkHuntActive(unit) {
      return this.stage===4 && unit.side==='enemy' && !unit.boss &&
        this.turn >= (this.mission.huntTurns[unit.guardGroup] || Infinity);
    }

    _seesPlayer(unit) {
      const reach = Pathfinding.getReachable(this.map, {...unit, move:unit.guardRadius}, []);
      return this.living().some(p => Grid.hostile(unit,p) &&
        // The distant village watches the arriving party; only the siege starts on Nina.
        (this.stage !== 3 || unit.side !== 'enemy' || unit.guardGroup === 'siege' || p.side === 'player') &&
        reach.has(Grid.key(p.x,p.y)));
    }

    alertGroup(unit) {
      if (!unit || unit.side !== 'enemy') return;
      for (const other of this.living('enemy')) {
        if (other.id===unit.id || (unit.guardGroup && other.guardGroup===unit.guardGroup)) other.alerted=true;
      }
    }

    refreshAlerts() {
      for(const unit of this.living('enemy')) {
        if (!(unit.dormant && !this.gateOpen) && unit.guardRadius &&
          (this.parkHuntActive(unit)||this._seesPlayer(unit))) this.alertGroup(unit);
      }
    }

    canActivateResonance(unit) {
      return this.stage===1 && this.isPlayerPhase() && !this.resonanceOpen && !!unit &&
        unit.side==='player' && !unit.dead && !unit.acted && this.getTerrain(unit.x,unit.y).id==='resonance';
    }

    activateResonance(unit) {
      if(!this.canActivateResonance(unit)) return false;
      this.resonanceOpen=true;
      this._syncResonance();
      this.markActed(unit);
      return true;
    }

    bellAt(x,y) {
      return this.stage===2 ? this.mission.bells.find(b=>b.x===x&&b.y===y) || null : null;
    }

    canAwakenBell(unit) {
      const bell=unit && this.bellAt(unit.x,unit.y);
      return !!bell && this.isPlayerPhase() && unit.side==='player' && !unit.dead && !unit.acted &&
        !this.awakenedBells.includes(bell.id);
    }

    awakenBell(unit) {
      if(!this.canAwakenBell(unit))return false;
      const bell=this.bellAt(unit.x,unit.y);
      this.awakenedBells.push(bell.id);
      unit.hp=Math.min(unit.maxHp,unit.hp+Math.ceil(unit.maxHp*.3));
      this.markActed(unit);
      for(const enemy of this.living('enemy'))if(enemy.guardGroup===bell.group)enemy.alerted=true;
      this.checkOutcome();
      return bell;
    }

    _syncResonance() {
      if(this.stage!==1 || !this.resonanceOpen) return;
      for(const p of C.FORD_CELLS) this.map.tiles[p.y][p.x]='ford';
    }

    _syncGateTiles() {
      if(this.stage===10)return; // The shared room's door stays open in part two.
      const from = this.gateOpen ? 'gate' : 'gateOpen';
      const to = this.gateOpen ? 'gateOpen' : 'gate';
      for (let y = 0; y < this.map.rows; y++) {
        for (let x = 0; x < this.map.cols; x++) {
          if (this.map.tiles[y][x] === from) this.map.tiles[y][x] = to;
        }
      }
    }

    previewCombat(attacker, defender) {
      bindCombatMap(this);
      if (!this.canAttack(attacker, defender)) {
        throw new Error('目标不在攻击范围内');
      }
      return Combat.forecast(attacker, defender, this.map);
    }

    /** 消耗随机数生成结果；此时 HP 尚未变化。 */
    rollCombat(attacker, defender) {
      this.previewCombat(attacker, defender);
      return Combat.rollRound(attacker, defender, this.map, this.rng);
    }

    /**
     * 真正扣血。返回战报对象，供 UI 播放伤害数字。
     * 战斗结果只能应用一次。
     */
    applyCombat(result, deferExperience=false) {
      if (!result) throw new Error('缺少战斗结果');
      if (result.applied) throw new Error('该战斗结果已结算');
      if (result.strikes) {
        const initiator=this.getUnit(result.attackerId);
        if(initiator?.side==='player'&&this.phase==='player'){initiator.talentAttacked=true;initiator.talentSwapReady=false;}
        const participants=[result.attackerId,result.defenderId].map(id=>this.getUnit(id)).filter(Boolean).map(u=>({...u}));
        for (const strike of result.strikes) {
          const a = this.getUnit(strike.attackerId), b = this.getUnit(strike.defenderId);
          if (!a || !b || a.dead || b.dead || !Grid.hostile(a,b) || this.isOver()) break;
          this.applyCombat(strike,true);
          if(strike.drops)result.drops=(result.drops||[]).concat(strike.drops);
          if (strike.keyRecipientId) {
            result.keyRecipientId = strike.keyRecipientId;
            result.storedForKey = strike.storedForKey;
          }
          if(strike.retreatTriggered)result.retreatTriggered=true;
          if (strike.killed||strike.retreatTriggered) break;
        }
        for(const strike of result.strikes.filter(s=>s.applied)){
          const a=this.getUnit(strike.attackerId),b=this.getUnit(strike.defenderId);
          strike.talentResDown=!!(a&&b&&MyGO.Talents?.afterMagic(a,b,strike.hit,strike.magic));
          strike.frostApplied=!!(a&&b&&MyGO.Talents?.afterDamage(a,b,Math.max(0,strike.hpBeforeApply-strike.hpAfterApply),strike.hit,this.phase,strike.weaponType||strike.weaponSnapshot?.type||a.weapon?.type));
        }
        result.applied = true;
        result.hpBeforeApply = result.defenderHp;
        result.killed = result.strikes.some(s=>s.applied && s.killed && s.defenderId===result.defenderId);
        result.attackerKilled = result.strikes.some(s=>s.applied && s.killed && s.defenderId===result.attackerId);
        MyGO.Mastery?.applyEffects(this,result.masteryEffects);
        if(initiator)initiator.combatArtId=null;
        result.experience=this.awardCombatExperience(result.strikes,participants);
        result.hpAfterApply = this.getUnit(result.defenderId)?.hp;
        result.attackerHpAfterApply = this.getUnit(result.attackerId)?.hp;
        return result;
      }
      const defender = this.getUnit(result.defenderId);
      if (!defender || defender.dead || defender.escaped || this.maskRetreatPending) {
        result.applied = true;
        return { ...result, killed: false, skipped: true };
      }
      const attacker = this.getUnit(result.attackerId);
      if(!deferExperience&&attacker?.side==='player'&&this.phase==='player'&&!['counter','followup'].includes(result.kind)){
        attacker.talentAttacked=true;attacker.talentSwapReady=false;
      }
      const participants=[attacker,defender].filter(Boolean).map(u=>({...u}));
      if(result.resourceId && attacker) {
        MyGO.Inventory.consume(attacker,result.resourceId,result.resourcePreserved,result.resourceCost||1);
        if (result.kind === 'attack' && attacker.side === 'player' && this.phase === 'player') {
          attacker.equippedWeapon = result.resourceId;
        }
        MyGO.Inventory.useEffects(attacker,defender,MyGO.Magic.get(result.resourceId),result.finalDamage,result.hit);
      }
      if(attacker&&result.masteryHealing)attacker.hp=Math.min(attacker.maxHp,attacker.hp+result.masteryHealing);
      const before = defender.hp;
      this.alertGroup(defender);
      defender.hp = Math.max(defender.hpFloor||0, before - result.finalDamage);
      const retreat=this.stage===6&&defender.id==='masked_stranger'&&defender.hp===1&&result.finalDamage>0;
      if(retreat){this.maskRetreatPending=true;result.retreatTriggered=true;}
      const killed = defender.hp <= 0;
      if (killed) {
        defender.dead = true;
        defender.acted = true;
        if (this.stage === 3 && defender.id === 'nina') this.ninaLost = true;
      }
      result.talentHealed=attacker?(MyGO.Talents?.onKill(attacker,defender,killed)||0):0;
      result.angel=attacker?(MyGO.Talents?.onAngel(attacker,defender,result,this.map)||null):null;
      if(attacker)MyGO.Talents?.onAttack(attacker,defender,result.weaponType||result.weaponSnapshot?.type||attacker.weapon?.type);
      result.applied = true;
      result.hpBeforeApply = before;
      result.hpAfterApply = defender.hp;
      result.killed = killed;
      if (killed && this.stage === 1 && defender.key && attacker?.side === 'player' && !attacker.dead) {
        result.keyRecipientId = attacker.id;
        result.storedForKey = this._awardGateKey(attacker);
      }
      if(killed&&[5,8,9].includes(this.stage)&&defender.side==='enemy'&&attacker?.side==='player'&&!attacker.dead){
        result.drops=defender.drops.map(id=>this.awardLoot(attacker,id));
        for(const id of defender.drops){const at=defender.inventory.findIndex(i=>i.id===id);if(at>=0)defender.inventory.splice(at,1);}
      }
      if(killed&&this.stage===9&&defender.side==='player'){
        // Losing the carrier must not strand the remaining party at a locked exit.
        const at=defender.inventory.findIndex(i=>i.id==='strange_door_key');
        if(at>=0){
          const key=defender.inventory.splice(at,1)[0],reserved=this.convoy.length>=500;
          (reserved?this.lootReserve:this.convoy).push(key);
          result.drops=[{id:key.id,recipientId:defender.id,location:reserved?'战利品暂存（回收门钥匙）':'运输队（回收门钥匙）'}];
        }
      }
      if(attacker)MyGO.Inventory.sync(attacker);
      if(!deferExperience&&attacker)result.talentResDown=!!MyGO.Talents?.afterMagic(attacker,defender,result.hit,result.magic);
      if(!deferExperience&&attacker)result.frostApplied=!!MyGO.Talents?.afterDamage(attacker,defender,Math.max(0,before-defender.hp),result.hit,this.phase,result.weaponType||result.weaponSnapshot?.type||attacker.weapon?.type);
      MyGO.Inventory.sync(defender);
      this.checkOutcome();
      if(!deferExperience)result.experience=this.awardCombatExperience([result],participants);
      return result;
    }

    awardCombatExperience(strikes,participants) {
      const reports=[];
      for(const before of participants){
        const u=this.getUnit(before.id),enemy=participants.find(p=>Grid.hostile(p,before));
        if(!u||!enemy||u.side!=='player'||before.dead||!strikes.some(s=>s.applied))continue;
        const outgoing=strikes.filter(s=>s.applied&&s.attackerId===u.id&&s.defenderId===enemy.id);
        const damage=outgoing.reduce((n,s)=>n+Math.max(0,s.hpBeforeApply-s.hpAfterApply),0);
        const killed=outgoing.some(s=>s.killed);
        const amount=MyGO.Growth.combatExp(before,enemy,damage,killed);
        const bonus=this.stage===4&&u.id==='soyo'&&enemy.id==='dark_soyo'&&killed;
        let report=this.isTraining?null:MyGO.Growth.award(u,amount,bonus?2:1);
        if(MyGO.Mastery)report=MyGO.Mastery.attachReport(u,report,MyGO.Mastery.award(u,this.masteryMultiplier??1));
        if(bonus)this.soyoBossBonus=true;
        if(report){if(bonus)report.bonus='直面过去 · 击破经验 ×2';reports.push(report);}
      }
      return reports;
    }

    /**
     * 第一关歼灭；第二关需要三个不同星铃与首领击破，可以留下普通敌军。
     * 不自动修改 turn，便于 UI 播放结算动画。
     */
    checkOutcome() {
      if (this.isOver()) return this.winner;
      const victory=this.stage===12 ? this.royalGardenIntroSeen&&this.mission.bossIds.every(id=>this.getUnit(id)?.dead) : this.stage===11 ? this.palaceIntroSeen&&!!this.getUnit('gilded_cavalier')?.dead : this.stage===10 ? this.stageTenIntroSeen&&this.subaruJoined&&this.livingCount('enemy')===0 : this.stage===9 ? false : this.stage===8 ? this.stageEightIntroSeen&&this.mission.phantomIds.every(id=>this.getUnit(id)?.dead) : this.stage===7 ? this.nijikaJoined&&this.livingCount('enemy')===0 : this.stage===6 ? this.maskEscaped : this.stage===5 ? !!this.getUnit('iron_warden')?.dead : this.stage===4 ? !!this.getUnit('dark_soyo')?.dead : this.stage===2
        ? this.awakenedBells.length>=this.mission.requiredBells && !!this.getUnit('conductor')?.dead
        : this.livingCount('enemy')===0;
      if (this.livingCount('player') === 0) {
        this.phase = 'defeat';
        this.winner = 'enemy';
      } else if (victory) {
        this.phase = 'victory';
        this.winner = 'player';
        if(!this.rewardedChapters.includes(this.chapterNumber)){this.gold+=MyGO.Shop.CHAPTER_REWARD;this.rewardedChapters.push(this.chapterNumber);}
        if (this.stage === 1 && this.getUnit('xueyue')?.dead) this.recruited = ['xueyue'];
        if (this.stage === 3) {
          const nina=this.getUnit('nina');
          if (nina && !nina.dead && !this.ninaLost) {
            if (!this.recruited.includes('nina')) this.recruited.push('nina');
            Object.assign(nina,{side:'player',acted:true,quote:'你们真的来了……我叫井芹仁菜。接下来，让我也一起走吧。'});
          }
        }
      }
      return this.winner;
    }

    /** 玩家结束回合，进入敌方阶段。 */
    beginEnemyPhase() {
      if (!this.isPlayerPhase() || this.isOver()) return false;
      this.expireStatuses('player');
      this.decayWard('enemy');
      this.phase = 'enemy';
      this.refreshAlerts();
      this.resetActed('enemy');
      for(const u of this.living('enemy'))MyGO.Mastery?.startTurn(u);
      return true;
    }

    beginAllyPhase() {
      if (this.phase !== 'player' || !this.living('ally').length) return false;
      this.phase = 'ally';
      this.resetActed('ally');
      return true;
    }

    finishAllyPhase() {
      if (this.phase !== 'ally' || this.isOver()) return false;
      this.expireStatuses('ally');
      this.decayWard('ally');
      this.phase = 'player';
      return this.beginEnemyPhase();
    }

    /** 敌方阶段结束，回合数 +1，回到玩家阶段。 */
    beginNextPlayerPhase() {
      if (this.isOver()) return false;
      this.expireStatuses('enemy');
      for(const u of this.units)delete u.status.talentResDown;
      for(const u of this.units)u.talentAttackCount=0;
      this.decayWard('player');
      this.turn += 1;
      if(this.stage===3 && this.turn>=4){
        for(const enemy of this.living('enemy'))if(enemy.guardGroup==='south')enemy.alerted=true;
      }
      this.phase = 'player';
      this.resetActed('player');
      this.lastHealing=[];
      for(const u of this.living('player')){const amount=MyGO.Mastery?.startTurn(u)||0;if(amount)this.lastHealing.push({id:u.id,amount});}
      for(const unit of this.living('player')) {
        if(this.getTerrain(unit.x,unit.y).id!=='fort') continue;
        const amount=Math.min(unit.maxHp-unit.hp, Math.ceil(unit.maxHp*.2));
        if(amount>0) { unit.hp+=amount; this.lastHealing.push({id:unit.id,amount}); }
      }
      return true;
    }

    /** 玩家全体存活单位是否都已行动。 */
    allPlayerActed() {
      const list = this.living('player');
      return list.length > 0 && list.every((u) => u.acted&&!this.talentSwapTargets(u).length);
    }

    /**
     * 存档快照：静态地图/角色模板不重复写入。
     * 只保存会变化的状态，读档时由模板重建单位。
     */
    serialize() {
      return {
        version: C.SAVE_VERSION,
        ...(this.stage>=4?{fixedEnemyStatsVersion:1}:{}),
        ...([9,10].includes(this.stage)?{rehearsalBalanceVersion:1,rehearsalBossBalanceVersion:1,rehearsalHpVersion:1}:{}),
        stage: this.chapterNumber,
        ...(this.stage===12?{royalGardenChapterVersion:1,royalGardenIntroSeen:this.royalGardenIntroSeen,nijikaLevelVersion:1}:{}),
        ...(this.stage===11?{palaceChapterVersion:1,palaceIntroSeen:this.palaceIntroSeen,nijikaLevelVersion:1}:{}),
        ...([9,10].includes(this.stage)?{rehearsalChapterVersion:1,rehearsalPart:this.stage===10?2:1,
          rehearsalFirstDefeated:this.stage===10?(this.rehearsalFirstDefeated||0):0}:{}),
        mapRevision: this.stage === 1 ? C.MAP_REVISION : this.mission.mapRevision,
        turn: this.turn,
        phase: this.phase,
        ...(this.retreat ? { retreat: { ...this.retreat } } : {}),
        winner: this.winner,
        gateOpen: this.gateOpen,
        resonanceOpen: this.resonanceOpen,
        awakenedBells: this.awakenedBells.slice(),
        ...(this.stage===4?{litLamps:this.litLamps.slice(),bossDiscovered:this.bossDiscovered,
          soyoBossBonus:this.soyoBossBonus,enemyScaleLevel:this.enemyScaleLevel}:{}),
        ...(this.stage===10?{stageTenIntroSeen:this.stageTenIntroSeen,subaruJoined:this.subaruJoined,nijikaLevelVersion:1,rehearsalFinaleBalanceVersion:1}:{}),
        ...(this.stage===9?{stageNineIntroSeen:this.stageNineIntroSeen,nijikaLevelVersion:1}:{}),
        ...(this.stage===8?{stageEightIntroSeen:this.stageEightIntroSeen,enemyScaleVersion:4,enemyScalePower:this.enemyScalePower,nijikaLevelVersion:1,lootLayoutVersion:1,openedChests:this.openedChests.slice(),enemyScaleLevel:this.enemyScaleLevel}:{}),
        ...(this.stage===5?{openedChests:this.openedChests.slice(),enemyScaleLevel:this.enemyScaleLevel}:{}),
        ...(this.stage===6?{summonedWaves:this.summonedWaves.slice(),lastSummonTurn:this.lastSummonTurn,maskRetreatPending:this.maskRetreatPending,maskEscaped:this.maskEscaped,enemyScaleLevel:this.enemyScaleLevel}:{}),
        ...(this.stage===7?{nijikaJoined:this.nijikaJoined,nijikaLevelVersion:1,livehouseEndingShown:this.livehouseEndingShown,enemyScaleLevel:this.enemyScaleLevel,enemyBalanceVersion:1}:{}),
        recruited: this.recruited.slice(),
        recruitmentVersion: 1,
        recruitmentShown: this.recruitmentShown,
        ninaLost: this.ninaLost,
        ninaRecruitmentShown: this.ninaRecruitmentShown,
        rngState: this.rng.serialize(),
        inventoryVersion: 1,
        economy:this.packEconomy(),
        lootReserve:(this.lootReserve||[]).map(i=>({...i})),
        convoy: this.convoy.map(i=>({...i})),
        units: this.units.map((u) => ({
          id: u.id,
          x: u.x,
          y: u.y,
          hp: u.hp,
          acted: u.acted,
          talentSwapReady:!!u.talentSwapReady,
          talentAttacked:!!u.talentAttacked,
          talentAttackCount:u.talentAttackCount||0,
          dead: u.dead,
          alerted: u.alerted,
          growth: MyGO.GrowthData.personal[u.id] ? MyGO.Growth.pack(u) : undefined,
          ...MyGO.Inventory.pack(u)
        }))
      };
    }

    /** 校验并恢复存档。返回 true 表示成功。 */
    restore(snapshot) {
      if (!snapshot || snapshot.version !== C.SAVE_VERSION) {
        throw new Error('存档版本不兼容');
      }
      if (!Array.isArray(snapshot.units)) throw new Error('存档单位数据缺失');
      if (snapshot.retreat !== undefined && (!snapshot.retreat ||
          typeof snapshot.retreat.chapterIntroPlayed !== 'boolean' ||
          !['player', 'victory'].includes(snapshot.phase))) throw new Error('休憩之地存档状态无效');
      if(snapshot.royalGardenChapterVersion!==undefined){
        if(snapshot.royalGardenChapterVersion!==1||snapshot.stage!==11||snapshot.palaceChapterVersion!==undefined||snapshot.rehearsalChapterVersion!==undefined||snapshot.rehearsalPart!==undefined)throw Error('第十一关御苑进度无效');
        snapshot={...snapshot,stage:12};
      }else if(snapshot.stage===12)throw Error('第十一关御苑进度缺失');
      if(snapshot.stage===12&&[1,2].includes(snapshot.mapRevision)){
        // The bridge-side beds move south; the entrance beds return to their original place.
        // Move affected saved units to the freed tile in the same column, preserving the battle.
        const columns=[11,12,13,20,21,22];
        const previousRevision=snapshot.mapRevision;
        if(snapshot.units.some(u=>columns.includes(u.x)&&(u.y===18||previousRevision===2&&u.y===35)))throw Error('存档停留在旧版喷泉阻挡地形');
        snapshot={...snapshot,mapRevision:3,units:snapshot.units.map(u=>{
          if(!columns.includes(u.x))return u;
          if(u.y===20)return {...u,y:18};
          if(previousRevision===2&&u.y===33)return {...u,y:35};
          return u;
        })};
      }
      if(snapshot.palaceChapterVersion!==undefined){
        if(snapshot.palaceChapterVersion!==1||snapshot.stage!==10||snapshot.rehearsalChapterVersion!==undefined||snapshot.rehearsalPart!==undefined)throw Error('第十关宫殿进度无效');
        snapshot={...snapshot,stage:11};
      }else if(snapshot.stage===11)throw Error('第十关宫殿进度缺失');
      if(snapshot.rehearsalChapterVersion!==undefined){
        if(snapshot.rehearsalChapterVersion!==1||snapshot.stage!==9||![1,2].includes(snapshot.rehearsalPart)||
          !Number.isInteger(snapshot.rehearsalFirstDefeated)||snapshot.rehearsalFirstDefeated<0||snapshot.rehearsalFirstDefeated>C.STAGE_NINE.enemies.length||
          snapshot.rehearsalPart===1&&snapshot.rehearsalFirstDefeated!==0)throw Error('存档第九关合并进度无效');
        if(snapshot.rehearsalPart===2)snapshot={...snapshot,stage:10};
      }else if(snapshot.rehearsalPart!==undefined)throw Error('存档第九关合并进度无效');
      if(snapshot.fixedEnemyStatsVersion!==undefined&&snapshot.fixedEnemyStatsVersion!==1)throw Error('存档固定敌军属性版本无效');
      if(snapshot.rehearsalBalanceVersion!==undefined&&snapshot.rehearsalBalanceVersion!==1)throw Error('存档排练室属性版本无效');
      if(snapshot.rehearsalBossBalanceVersion!==undefined&&snapshot.rehearsalBossBalanceVersion!==1)throw Error('存档排练室Boss属性版本无效');
      if(snapshot.rehearsalHpVersion!==undefined&&snapshot.rehearsalHpVersion!==1)throw Error('存档排练室生命版本无效');
      if(snapshot.rehearsalFinaleBalanceVersion!==undefined&&snapshot.rehearsalFinaleBalanceVersion!==1)throw Error('存档排练室后半段属性版本无效');
      if(snapshot.inventoryVersion!==undefined&&snapshot.inventoryVersion!==1)throw Error('背包存档版本不兼容');
      if (snapshot.stage === 2 && snapshot.mapRevision !== C.STAGE_TWO.mapRevision) {
        throw new Error('第二关地图已重新设计，请重开第二关；旧存档仍然保留。');
      }
      if (snapshot.stage === 3 && snapshot.mapRevision !== C.STAGE_THREE.mapRevision) throw new Error('第三关地图版本不兼容');
      if(snapshot.stage===10&&snapshot.mapRevision!==C.STAGE_TEN.mapRevision)throw Error('第九关后半段地图版本不兼容');
      if(snapshot.stage===12&&snapshot.mapRevision!==C.STAGE_ROYAL_GARDEN.mapRevision)throw Error('第十一关御苑地图版本不兼容');
      if(snapshot.stage===11&&snapshot.mapRevision!==C.STAGE_PALACE.mapRevision)throw Error('第十关宫殿地图版本不兼容');
      if(snapshot.stage===9&&snapshot.mapRevision!==C.STAGE_NINE.mapRevision)throw Error('第九关地图版本不兼容');
      if(snapshot.stage===8&&snapshot.mapRevision!==C.STAGE_EIGHT.mapRevision)throw Error('第八关地图版本不兼容');
      if(snapshot.stage===7&&snapshot.mapRevision!==C.STAGE_SEVEN.mapRevision)throw Error('第七关地图版本不兼容');
      if (snapshot.stage === 6 && snapshot.mapRevision !== C.STAGE_SIX.mapRevision) throw Error('第六关地图版本不兼容');
      if (snapshot.stage === 5 && snapshot.mapRevision !== C.STAGE_FIVE.mapRevision) throw new Error('第五关地图版本不兼容');
      if (snapshot.stage === 4 && snapshot.mapRevision !== C.STAGE_FOUR.mapRevision) throw new Error('第四关地图版本不兼容');
      if (![2,3,4,5,6,7,8,9,10,11,12].includes(snapshot.stage) && snapshot.mapRevision !== C.MAP_REVISION) {
        throw new Error('第一关地图已更新，请重开第一关；旧存档仍然保留。');
      }
      const bells=snapshot.stage===2 ? snapshot.awakenedBells || [] : [];
      if(!Array.isArray(bells) || new Set(bells).size!==bells.length ||
        bells.some(id=>!C.STAGE_TWO.bells.some(b=>b.id===id)))throw new Error('存档星铃数据无效');

      // 地图是可变的（大门开启后会换成 gateOpen），读档先恢复关卡与静态地图。
      this.stage = [2,3,4,5,6,7,8,9,10,11,12].includes(snapshot.stage) ? snapshot.stage : 1;
      if(this.stage===4){
        const lamps=snapshot.litLamps;
        if(!Array.isArray(lamps)||new Set(lamps).size!==lamps.length||lamps.some(id=>!C.STAGE_FOUR.lamps.some(l=>l.id===id)))throw Error('存档路灯数据无效');
        if(!Number.isInteger(snapshot.enemyScaleLevel)||snapshot.enemyScaleLevel<1||snapshot.enemyScaleLevel>97)throw Error('存档敌军等级无效');
      }
      this.summonedWaves=[];this.maskRetreatPending=false;this.maskEscaped=false;this.lastSummonTurn=0;
      this.openedChests=[];
      if(this.stage===5){
        const opened=snapshot.openedChests;
        if(!Array.isArray(opened)||new Set(opened).size!==opened.length||opened.some(id=>!C.STAGE_FIVE.chests.some(c=>c.id===id)))throw Error('存档宝箱数据无效');
        if(!Number.isInteger(snapshot.enemyScaleLevel)||snapshot.enemyScaleLevel<1||snapshot.enemyScaleLevel>97)throw Error('存档敌军等级无效');
        this.openedChests=opened.slice();
      }
      this.litLamps=this.stage===4?snapshot.litLamps.slice():[];
      this.bossDiscovered=this.stage===4&&!!snapshot.bossDiscovered;
      this.soyoBossBonus=this.stage===4&&!!snapshot.soyoBossBonus;
      this.map = this.stage >= 2 ? stageTwoMap(this.stage) : cloneMap();
      bindCombatMap(this);
      this.gateOpen = !!snapshot.gateOpen;
      this._syncGateTiles();
      this.resonanceOpen = this.stage===1 && !!snapshot.resonanceOpen;
      this.awakenedBells = bells.slice();
      this._syncResonance();

      this.recruited = Array.isArray(snapshot.recruited) ? ['xueyue','nina','nijika','subaru'].filter(id=>snapshot.recruited.includes(id)) : [];
      this.ninaLost = !!snapshot.ninaLost || this.stage === 3 && snapshot.units.some(u=>u.id==='nina'&&(u.dead||u.hp<=0));
      this.ninaRecruitmentShown = !!snapshot.ninaRecruitmentShown;
      if (this.ninaLost || this.stage < 3 || this.stage===3&&snapshot.phase !== 'victory') this.recruited=this.recruited.filter(id=>id!=='nina');
      const legacyJoined = this.stage === 1 && this.recruited.includes('xueyue') && snapshot.recruitmentVersion !== 1;
      if (this.stage === 1 && snapshot.phase !== 'victory') this.recruited = [];
      this.recruitmentShown = snapshot.recruitmentVersion === 1 && !!snapshot.recruitmentShown;
      if(this.stage<10)this.recruited=this.recruited.filter(id=>id!=='subaru');
      this.nijikaJoined=this.stage>=8||this.stage===7&&snapshot.nijikaJoined===true;
      this.livehouseEndingShown=this.stage===7&&snapshot.livehouseEndingShown===true;
      if(this.stage===7){
        if(snapshot.enemyBalanceVersion!==undefined&&snapshot.enemyBalanceVersion!==1)throw Error('第七关敌军平衡版本无效');
        if(snapshot.livehouseEndingShown!==undefined&&typeof snapshot.livehouseEndingShown!=='boolean'||this.livehouseEndingShown&&snapshot.phase!=='victory')throw Error('Live House 战后剧情状态无效');
        if(typeof snapshot.nijikaJoined!=='boolean'||this.nijikaJoined!==this.recruited.includes('nijika'))throw Error('虹夏入队状态无效');
        if(snapshot.nijikaLevelVersion!==undefined&&snapshot.nijikaLevelVersion!==1)throw Error('虹夏等级版本无效');
        if(!Number.isInteger(snapshot.enemyScaleLevel)||snapshot.enemyScaleLevel<1||snapshot.enemyScaleLevel>97)throw Error('存档敌军等级无效');
        const expected=unitsForStage(this.stage,this.recruited);
        if(snapshot.units.length!==expected.length||snapshot.units.some(u=>!expected.some(t=>t.id===u.id)))throw Error('第七关单位数据无效');
      }else if(this.stage<8)this.recruited=this.recruited.filter(id=>id!=='nijika');
      this.stageTenIntroSeen=this.stage===10&&snapshot.stageTenIntroSeen===true;
      this.subaruJoined=this.stage===10&&snapshot.subaruJoined===true;
      this.palaceIntroSeen=this.stage===11&&snapshot.palaceIntroSeen===true;
      this.royalGardenIntroSeen=this.stage===12&&snapshot.royalGardenIntroSeen===true;
      if(this.stage===12){
        if(typeof snapshot.royalGardenIntroSeen!=='boolean'||!this.recruited.includes('subaru')||!this.recruited.includes('nijika')||snapshot.nijikaLevelVersion!==1||snapshot.fixedEnemyStatsVersion!==1||snapshot.gateOpen!==false)throw Error('第十一关御苑状态无效');
        if(!this.royalGardenIntroSeen&&snapshot.phase!=='player')throw Error('第十一关开场尚未完成');
        const expected=unitsForStage(12,this.recruited);
        if(snapshot.units.length!==expected.length||snapshot.units.some(u=>!expected.some(t=>t.id===u.id)))throw Error('第十一关御苑单位数据无效');
        if(snapshot.phase==='victory'&&!C.STAGE_ROYAL_GARDEN.bossIds.every(id=>snapshot.units.find(u=>u.id===id)?.dead))throw Error('第十一关双骑士尚未击败');
        this.subaruJoined=true;
      }
      if(this.stage===11){
        if(typeof snapshot.palaceIntroSeen!=='boolean'||!this.recruited.includes('subaru')||!this.recruited.includes('nijika')||snapshot.nijikaLevelVersion!==1||snapshot.fixedEnemyStatsVersion!==1||snapshot.gateOpen!==false)throw Error('第十关宫殿状态无效');
        if(!this.palaceIntroSeen&&snapshot.phase!=='player')throw Error('第十关宫殿开场尚未完成');
        const expected=unitsForStage(11,this.recruited);
        if(snapshot.units.length!==expected.length||snapshot.units.some(u=>!expected.some(t=>t.id===u.id)))throw Error('第十关宫殿单位数据无效');
        if(snapshot.phase==='victory'&&!snapshot.units.find(u=>u.id==='gilded_cavalier')?.dead)throw Error('第十关精英骑士尚未击败');
        this.subaruJoined=true;
      }
      if(this.stage===10){
        if(typeof snapshot.stageTenIntroSeen!=='boolean'||typeof snapshot.subaruJoined!=='boolean'||this.subaruJoined!==this.stageTenIntroSeen||this.subaruJoined!==this.recruited.includes('subaru')||!this.recruited.includes('nijika')||snapshot.nijikaLevelVersion!==1||snapshot.fixedEnemyStatsVersion!==1)throw Error('第九关后半段开场或昴入队状态无效');
        if(!this.stageTenIntroSeen&&snapshot.phase!=='player')throw Error('第九关后半段开场尚未完成');
        const expected=unitsForStage(10,this.recruited);
        if(snapshot.units.length!==expected.length||snapshot.units.some(u=>!expected.some(t=>t.id===u.id)))throw Error('第九关后半段单位数据无效');
        if(snapshot.gateOpen!==false)throw Error('第九关后半段门状态无效');
        if(snapshot.phase==='victory'&&snapshot.units.some(u=>expected.some(t=>t.id===u.id&&t.side==='enemy')&&!u.dead&&u.hp>0))throw Error('第九关后半段敌军尚未清除');
      }
      this.stageNineIntroSeen=this.stage===9&&snapshot.stageNineIntroSeen===true;
      if(this.stage===9){
        if(typeof snapshot.stageNineIntroSeen!=='boolean'||typeof snapshot.gateOpen!=='boolean'||!this.recruited.includes('nijika')||snapshot.nijikaLevelVersion!==1||snapshot.fixedEnemyStatsVersion!==1)throw Error('第九关开场状态无效');
        if(!this.stageNineIntroSeen&&(snapshot.phase!=='player'||snapshot.gateOpen))throw Error('第九关开场尚未完成');
        const expected=unitsForStage(9,this.recruited);
        if(snapshot.units.length!==expected.length||snapshot.units.some(u=>!expected.some(t=>t.id===u.id)))throw Error('第九关单位数据无效');
        const boss=snapshot.units.find(u=>u.id==='rift_pegasus');
        if(snapshot.gateOpen&&!(boss.dead||boss.hp<=0)||snapshot.phase==='victory'&&(!snapshot.gateOpen||!this.stageNineIntroSeen))throw Error('第九关门状态无效');
      }
      this.stageEightIntroSeen=this.stage===8&&snapshot.stageEightIntroSeen===true;
      this.enemyScalePower=0;
      if(this.stage===8&&snapshot.enemyScaleVersion!==undefined){
        if(![1,2,3,4].includes(snapshot.enemyScaleVersion)||!Number.isSafeInteger(snapshot.enemyScalePower)||snapshot.enemyScalePower<100||snapshot.enemyScalePower>100000)throw Error('第八关敌军强度数据无效');
        this.enemyScalePower=snapshot.enemyScalePower;
      }
      if(this.stage===8){
        if(snapshot.lootLayoutVersion!==undefined&&snapshot.lootLayoutVersion!==1)throw Error('第八关宝箱布局版本无效');
        if(typeof snapshot.stageEightIntroSeen!=='boolean'||!this.recruited.includes('nijika')||snapshot.nijikaLevelVersion!==1)throw Error('第八关开场状态无效');
        if(!this.stageEightIntroSeen&&snapshot.phase!=='player')throw Error('第八关开场尚未完成');
        const opened=snapshot.openedChests,expected=unitsForStage(8,this.recruited);
        if(!Array.isArray(opened)||new Set(opened).size!==opened.length||opened.some(id=>!C.STAGE_EIGHT.chests.some(c=>c.id===id)))throw Error('存档宝箱数据无效');
        if(!Number.isInteger(snapshot.enemyScaleLevel)||snapshot.enemyScaleLevel<1||snapshot.enemyScaleLevel>97)throw Error('存档敌军等级无效');
        if(snapshot.units.length!==expected.length||snapshot.units.some(u=>!expected.some(t=>t.id===u.id)))throw Error('第八关单位数据无效');
        this.openedChests=opened.slice();
      }
      const fresh = unitsForStage(this.stage, this.recruited);
      if(this.stage===6){
        const ids=snapshot.summonedWaves;
        if(!Array.isArray(ids)||ids.length>4||ids.some((id,i)=>id!==C.STAGE_SIX.waves[i].id))throw Error('存档召唤波次无效');
        if(!Number.isInteger(snapshot.enemyScaleLevel)||snapshot.enemyScaleLevel<1||snapshot.enemyScaleLevel>97)throw Error('存档敌军等级无效');
        if(!Number.isInteger(snapshot.lastSummonTurn)||snapshot.lastSummonTurn<0||snapshot.lastSummonTurn>snapshot.turn||ids.length>0&&snapshot.lastSummonTurn<1)throw Error('存档召唤回合无效');
        if(typeof snapshot.maskRetreatPending!=='boolean'||typeof snapshot.maskEscaped!=='boolean'||snapshot.maskRetreatPending&&snapshot.maskEscaped)throw Error('存档面具人状态无效');
        this.summonedWaves=ids.slice();this.lastSummonTurn=snapshot.lastSummonTurn;
        this.maskRetreatPending=snapshot.maskRetreatPending;this.maskEscaped=snapshot.maskEscaped;
        for(const wave of C.STAGE_SIX.waves.filter(w=>ids.includes(w.id)))fresh.push(...wave.enemies.map(createUnit));
        const expected=new Set(fresh.map(u=>u.id));
        if(snapshot.units.length!==fresh.length||snapshot.units.some(u=>!expected.has(u.id)))throw Error('存档召唤单位无效');
      }
      this.enemyScaleLevel=0;
      if(this.stage>=4&&snapshot.fixedEnemyStatsVersion===1)this.applyFixedEnemyStats(fresh);
      else if(this.stage===8&&snapshot.enemyScaleVersion===1)this.restoreLegacyEighthScale(snapshot.enemyScaleLevel,fresh,false,true);
      else if(this.stage===8&&[2,3].includes(snapshot.enemyScaleVersion))this.restoreLegacyEighthScale(snapshot.enemyScaleLevel,fresh,false,false,true);
      else if(this.stage>=4)this.restoreLegacyEnemyScale(snapshot.enemyScaleLevel,fresh,false,this.stage===8&&snapshot.enemyScaleVersion===undefined,this.stage===7&&snapshot.enemyBalanceVersion===undefined);
      // Both v5.8.3 and v5.8.4 used these HP limits. Restore wounds against
      // those limits before applying the corrected panel budgets below.
      if(this.stage===8&&snapshot.fixedEnemyStatsVersion===undefined&&snapshot.enemyScaleVersion===2)for(const u of fresh.filter(u=>u.side==='enemy')){
        const oldMaxHp=u.id==='dark_soyo'?42:u.id==='dark_tomori'?43:u.tags.includes('armor')?32:u.tags.includes('flying')?29:0;
        if(oldMaxHp){u.maxHp=oldMaxHp;u.hp=oldMaxHp;}
      }
      const byId = new Map(fresh.map((u) => [u.id, u]));
      const seen = new Set();

      const legacyBoss = this.stage === 1 && !snapshot.units.some(u => u.id === 'xueyue');
      for (const entry of snapshot.units) {
        // v3.9 and earlier used conductor as the first boss. Preserve its
        // position/HP; recruitment is now unlocked only after chapter victory.
        const saved = legacyBoss && entry.id === 'conductor' ? Object.assign({}, entry, { id: 'xueyue' }) : entry;
        const unit = byId.get(saved.id);
        if (!unit) continue;
        if (seen.has(saved.id)) throw new Error('存档单位重复');
        seen.add(saved.id);
        if (!Number.isInteger(saved.x) || !Number.isInteger(saved.y)) {
          throw new Error('存档坐标无效');
        }
        if (!Grid.inBounds(this.map, saved.x, saved.y)) throw new Error('存档坐标越界');
        unit.x = saved.x;
        unit.y = saved.y;
        unit.growthRngState=MyGO.Growth.seed(unit.id,snapshot.rngState);
        if(this.stage>=7&&unit.id==='nijika'&&saved.growth){
          // The free level has no growth. Keep the old validation allowance so
          // a migrated Lv.99 save can retain every previously earned stat.
          unit.growthBase.level=8;
          MyGO.Growth.restore(unit,saved.growth);
          unit.growthBase.level=C.NIJIKA.level;
          if(snapshot.nijikaLevelVersion===undefined){
            unit.level=Math.min(MyGO.Growth.MAX_LEVEL,unit.level+1);
            if(unit.level===MyGO.Growth.MAX_LEVEL)unit.exp=0;
          }else if(unit.level<C.NIJIKA.level)throw Error('虹夏存档等级无效');
        }else MyGO.Growth.restore(unit,saved.growth);
        MyGO.Classes.restore(unit,saved.classState);
        MyGO.Mastery?.restore(unit,saved.classMastery);
        if(!Number.isFinite(Grid.movementCost(this.map,unit,saved.x,saved.y)))throw Error('存档停留在阻挡地形');
        unit.hp = Math.max(0, Math.min(unit.maxHp, Number(saved.hp) || 0));
        if([9,10].includes(this.stage)){
          const mission=missionForStage(this.stage),legacyMax=mission.legacyMaxHp[saved.id];
          const legacyFinaleMax=this.stage===10?mission.legacyFinaleMaxHp[saved.id]:undefined;
          let oldMax;
          // Select the save's original HP ceiling, then convert exactly once.
          if(unit.boss&&snapshot.rehearsalBossBalanceVersion===undefined)oldMax=46;
          else if(snapshot.rehearsalBalanceVersion===undefined&&legacyMax)oldMax=legacyMax+(saved.id==='subaru'?(saved.growth?.gains?.maxHp||0):0);
          else if(snapshot.rehearsalFinaleBalanceVersion===undefined&&legacyFinaleMax)oldMax=legacyFinaleMax;
          else if(snapshot.rehearsalHpVersion===undefined)oldMax=mission.legacyRecentMaxHp[saved.id];
          if(oldMax)unit.hp=Math.max(0,Math.min(unit.maxHp,Math.ceil(unit.maxHp*(Number(saved.hp)||0)/oldMax-1e-9)));
        }
        unit.dead = !!saved.dead || unit.hp <= 0;
        unit.acted = !!saved.acted || unit.dead;
        if(saved.talentSwapReady!==undefined&&typeof saved.talentSwapReady!=='boolean'||saved.talentAttacked!==undefined&&typeof saved.talentAttacked!=='boolean')throw Error('存档天赋行动状态无效');
        unit.talentAttacked=!!saved.talentAttacked;
        if(saved.talentAttackCount!==undefined&&(!Number.isSafeInteger(saved.talentAttackCount)||saved.talentAttackCount<0||unit.id!=='nina'&&saved.talentAttackCount!==0))throw Error('存档拳拳到肉计数无效');
        unit.talentAttackCount=saved.talentAttackCount||0;
        unit.talentSwapReady=false;
        unit.alerted = !!saved.alerted;
        MyGO.Inventory.restore(unit,saved,false);
        if (this.stage === 1 && unit.id === 'xueyue' && legacyJoined) {
          Object.assign(unit, { hp: 0, dead: true, acted: true });
        }
      }

      if(this.stage===6){
        const boss=fresh.find(u=>u.id==='masked_stranger');
        if(boss.dead||boss.hp<1||(this.maskEscaped||this.maskRetreatPending)&&boss.hp!==1)throw Error('存档面具人生命无效');
        boss.escaped=this.maskEscaped;
      }
      // Older chapter-five saves have no escort entries. Keep saved positions and
      // move only newly introduced escorts if their authored spawn is occupied.
      if (this.stage === 5) for (const id of ['court-pegasus-guard-n','court-pegasus-guard-s']) {
        const guard = byId.get(id);
        if (seen.has(id) || !fresh.some(u=>u!==guard&&!u.dead&&u.x===guard.x&&u.y===guard.y)) continue;
        const blocked = new Set(fresh.filter(u=>u!==guard&&!u.dead).map(u=>Grid.key(u.x,u.y)));
        const cells = [];
        for(let y=0;y<this.map.rows;y++)for(let x=0;x<this.map.cols;x++) {
          if(!blocked.has(Grid.key(x,y))&&Number.isFinite(Grid.movementCost(this.map,guard,x,y)))
            cells.push({x,y,d:Math.abs(x-guard.x)+Math.abs(y-guard.y)});
        }
        cells.sort((a,b)=>a.d-b.d);
        if(!cells.length)throw new Error('天马护卫没有可用站位');
        Object.assign(guard,{x:cells[0].x,y:cells[0].y});
      }

      // Old saves were restored against their original limits above. Migrate
      // directly to fixed chapter stats, preserving the exact wound ratio.
      if(this.stage>=4)this.applyFixedEnemyStats(fresh);

      // Only untouched key carriers still at their old spawn adopt the closer
      // layout. Keep battle progress and never displace another living unit.
      if(this.stage===8&&snapshot.lootLayoutVersion===undefined&&!['victory','defeat'].includes(snapshot.phase)){
        for(const [id,old] of Object.entries(C.STAGE_EIGHT.legacyKeySpawns)){
          const u=byId.get(id),spawn=C.STAGE_EIGHT.enemies.find(t=>t.id===id);
          if(u.dead||u.acted||u.alerted||u.hp!==u.maxHp||u.x!==old.x||u.y!==old.y)continue;
          if(fresh.some(other=>other!==u&&!other.dead&&!other.escaped&&other.x===spawn.x&&other.y===spawn.y))continue;
          u.x=spawn.x;u.y=spawn.y;
        }
      }

      // 防御性检查：存活单位不能重叠。
      const occupied = new Set();
      for (const u of fresh) {
        if (u.dead || u.escaped) continue;
        const k = Grid.key(u.x, u.y);
        if (occupied.has(k)) throw new Error('存档单位位置重叠');
        occupied.add(k);
      }

      this.convoy = snapshot.inventoryVersion===1 ? MyGO.Inventory.validateBag(snapshot.convoy,500) : MyGO.Inventory.stock();
      this.lootReserve=MyGO.Inventory.validateBag(snapshot.lootReserve||[],50);
      this.collectReservedLoot();
      this.restoreEconomy(snapshot.economy);
      this.units = fresh;
      if(this.stage===10){const subaru=this.getUnit('subaru');subaru.side=this.subaruJoined?'player':'ally';if(!this.subaruJoined&&subaru.dead)throw Error('昴的开场状态无效');}
      if(this.stage===7){const n=this.getUnit('nijika');n.side=this.nijikaJoined?'player':'ally';if(!this.nijikaJoined&&(n.dead||snapshot.phase!=='player'))throw Error('虹夏开场状态无效');}
      const nina=this.getUnit('nina');
      if(nina && this.ninaLost) Object.assign(nina,{dead:true,hp:0,acted:true,side:'ally'});
      if(nina && this.recruited.includes('nina') && !nina.dead && !this.ninaLost) Object.assign(nina,{side:'player',acted:this.stage===3?true:nina.acted,
        quote:'你们真的来了……我叫井芹仁菜。接下来，让我也一起走吧。'});
      this.mission = missionForStage(this.stage);
      this.refreshParkDiscovery();
      this.turn = Math.max(1, Number(snapshot.turn) || 1);
      this.phase = ['enemy','ally'].includes(snapshot.phase) ? 'player' : snapshot.phase;
      if(this.stage===3&&this.phase==='victory'&&!this.rewardedChapters.includes(3))this.rewardedChapters.push(3);
      this.retreat = snapshot.retreat ? { chapterIntroPlayed: snapshot.retreat.chapterIntroPlayed } : null;
      this.winner = snapshot.winner || null;
      if (this.stage === 1 && this.phase === 'victory' && this.getUnit('xueyue')?.dead) this.recruited = ['xueyue'];
      this.rng = MyGO.RNG.restore(snapshot.rngState);
      this.rehearsalFirstDefeated=this.stage===10?(snapshot.rehearsalFirstDefeated??0):0;
      if(this.stage===9&&this.gateOpen&&this.getUnit('rift_pegasus')?.dead&&this.livingCount('player')>0){
        // Old chapter-nine clear saves resume at the second encounter. Any
        // previously paid reward remains paid and will not be granted again.
        this.phase='player';this.winner=null;this.beginRehearsalFinale();
      }
      // 保留终局快照的胜负状态；非终局快照则由棋盘状态重新推导。
      this.checkOutcome();
      return true;
    }
  }

  MyGO.Game = Game;
  MyGO.createUnit = createUnit;
  MyGO.createMap = cloneMap;
})(window);
