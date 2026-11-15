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

  // Keep core-only consumers independent of optional chapter modules.
  function missionForStage(stage) {
    return stage===8?C.STAGE_EIGHT:stage===7?C.STAGE_SEVEN:stage===6?C.STAGE_SIX:stage===5?C.STAGE_FIVE:stage===4?C.STAGE_FOUR:stage===3?C.STAGE_THREE:stage===2?C.STAGE_TWO:C.MISSION;
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
      if(stage===8)heroes.push(C.NIJIKA);
      return heroes.map(u=>createUnit({...u,...m.spawns[u.id],side:'player',boss:false,dormant:false,
        facing:stage>=6?'up':'right',mapCols:m.cols,mapRows:m.rows})).concat(m.enemies.map(createUnit),stage===7?[createUnit({...C.NIJIKA,side:recruited.includes('nijika')?'player':'ally'})]:[]);
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
      dead: false
    };
    MyGO.Inventory.init(unit, template);
    for(const id of template.carriedItems||[])unit.inventory.push(MyGO.Inventory.make(id));
    MyGO.Growth.init(unit);
    unit.certifiedClasses=[unit.classId].filter(Boolean);
    return unit;
  }

  class Game {
    constructor(options) {
      const opts = options || {};
      this.stage = [2,3,4,5,6,7,8].includes(opts.stage) ? opts.stage : 1;
      this.recruited = Array.isArray(opts.recruited) ? ['xueyue','nina','nijika'].filter(id=>opts.recruited.includes(id)) : [];
      if(this.stage<7)this.recruited=this.recruited.filter(id=>id!=='nijika');
      if(this.stage===8&&!this.recruited.includes('nijika'))this.recruited.push('nijika');
      if (this.stage === 1) this.recruited = [];
      this.recruitmentShown = false;
      this.ninaLost = !!opts.ninaLost;
      if(this.ninaLost)this.recruited=this.recruited.filter(id=>id!=='nina');
      this.ninaRecruitmentShown = false;
      this.nijikaJoined=this.stage>=7&&this.recruited.includes('nijika');
      this.livehouseEndingShown=false;
      this.stageEightIntroSeen=false;
      this.map = this.stage >= 2 ? stageTwoMap(this.stage) : cloneMap();
      this.units = unitsForStage(this.stage, this.recruited);
      this.mission = missionForStage(this.stage);
      this.convoy = MyGO.Inventory.stock();
      this.lootReserve=[];
      this.gold=MyGO.Shop.START_GOLD;
      this.shopPurchases={};this.shopChapter=this.stage;this.rewardedChapters=[];
      this.rng = new MyGO.RNG(opts.seed);
      for(const u of this.units)u.growthRngState=MyGO.Growth.seed(u.id,this.rng.serialize());
      if (opts.loadout) this.importLoadout(opts.loadout);
      this.litLamps=[];
      this.summonedWaves=[];this.maskRetreatPending=false;this.maskEscaped=false;this.lastSummonTurn=0;
      this.openedChests=[];
      this.bossDiscovered=false;
      this.soyoBossBonus=false;
      this.enemyScaleLevel=0;this.enemyScalePower=0;
      if(this.stage>=4)this.scaleParkEnemies();
      this.turn = 1;
      this.phase = 'player'; // player | enemy | victory | defeat
      this.winner = null;
      this.gateOpen = false;
      this.resonanceOpen = false;
      this.awakenedBells = [];
      this.lastHealing = [];
      this.startedAt = Date.now();
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
      for(const saved of data.units||[]){const u=this.getUnit(saved.id);if(u&&u.side==='player'){MyGO.Growth.restore(u,saved.growth,true);MyGO.Classes.restore(u,saved.classState);MyGO.Inventory.restore(u,saved,true);}}
    }

    packEconomy(){return {version:1,gold:this.gold,chapter:this.shopChapter,purchases:{...this.shopPurchases},rewarded:this.rewardedChapters.slice()};}

    restoreEconomy(data){
      if(data===undefined){this.gold=MyGO.Shop.START_GOLD;this.shopPurchases={};this.shopChapter=this.stage;this.rewardedChapters=[];return;}
      if(!data||data.version!==1||!Number.isSafeInteger(data.gold)||data.gold<0||data.gold>99999999||
        !Number.isInteger(data.chapter)||data.chapter<1||data.chapter>this.stage||
        !data.purchases||typeof data.purchases!=='object'||Array.isArray(data.purchases)||
        !Array.isArray(data.rewarded)||new Set(data.rewarded).size!==data.rewarded.length||data.rewarded.some(c=>!Number.isInteger(c)||c<1||c>this.stage))throw Error('存档商店数据无效');
      for(const [id,n] of Object.entries(data.purchases)){const p=MyGO.Shop.get(id);
        if(!p||p.stage>data.chapter||!Number.isInteger(n)||n<0||p.limit===null||n>p.limit)throw Error('存档限购数据无效');}
      this.gold=data.gold;this.shopChapter=this.stage;
      this.shopPurchases=data.chapter===this.stage?{...data.purchases}:{};this.rewardedChapters=data.rewarded.slice();
    }

    shopReason(){return this.phase!=='player'&&this.phase!=='victory'?'请在我方阶段或战后购物':'';}

    buyItem(id,quantity=1){
      const p=MyGO.Shop.get(id),reason=this.shopReason();if(reason)throw Error(reason);
      if(!p||this.stage<p.stage)throw Error('尚未解锁该商品');
      if(!Number.isInteger(quantity)||quantity<1||quantity>99)throw Error('购买数量无效');
      if(p.limit!==null&&(this.shopPurchases[id]||0)+quantity>p.limit)throw Error('本章库存不足');
      if(this.convoy.length+quantity>500)throw Error('运输队容量不足');
      const cost=p.price*quantity;if(this.gold<cost)throw Error('资金不足');
      const entries=Array.from({length:quantity},()=>MyGO.Inventory.make(id));
      this.gold-=cost;if(p.limit!==null)this.shopPurchases[id]=(this.shopPurchases[id]||0)+quantity;
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

    reclassReason(unit,id){
      const reason=this.loadoutReason(unit),job=MyGO.Classes.get(id);if(reason)return reason;
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
      if(this.phase==='player')unit.acted=true;
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
      slot.uses--;if(slot.uses===0)unit.inventory.splice(index,1);
      unit.acted=true;MyGO.Inventory.sync(unit);return {item:e,healed};
    }

    loadoutReason(unit) {
      if(!unit||unit.side!=='player'||unit.dead)return '该角色无法整理背包';
      if(this.phase!=='player'&&this.phase!=='victory')return '请在我方阶段整理背包';
      if(unit.acted&&this.phase!=='victory')return '该角色已行动，请在下回合整理背包';
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
      if(!unit||unit.dead||!((this.phase===unit.side&&!unit.acted)||(this.phase==='victory'&&unit.side==='player')))throw Error('当前无法切换攻击手段');
      MyGO.Inventory.select(unit,id);
    }

    supportTargets(caster,spellId) {
      const s=MyGO.Magic.get(spellId);
      if(!s||!s.support||s.effect==='torch'||!caster||caster.dead||caster.acted||this.phase!==caster.side||
        !MyGO.Inventory.magicAllowed(caster)||caster.status.silence||!caster.learnedSpells.includes(spellId)||!(caster.spellUses[spellId]>0))return [];
      const r=MyGO.Magic.rangeOf(s,caster),d=u=>Grid.manhattan(caster,u);
      if(s.effect==='silence')return this.units.filter(u=>!u.dead&&Grid.hostile(u,caster)&&(caster.side!=='player'||this.isUnitVisible(u))&&u.learnedSpells.length&&d(u)>=r[0]&&d(u)<=r[1]&&!u.status.silence);
      return this.living().filter(u=>!Grid.hostile(u,caster)&&u.id!==caster.id&&d(u)>0&&d(u)<=(s.effect==='warp'?1:r[1])&&
        (['heal','fortify'].includes(s.effect)?u.hp<u.maxHp:s.effect==='restore'?['defDown','spdDown','moveDown','silence'].some(k=>u.status[k]):
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
      MyGO.Inventory.consume(caster,spellId);
      const affected=['fortify','restore'].includes(s.effect)?targets:[target];
      const changes=[];
      for(const u of affected){
        if(['heal','fortify'].includes(s.effect)){const amount=Math.min(u.maxHp-u.hp,s.might+Math.floor(caster.mag/3)+(caster.gear.heal||0));u.hp+=amount;changes.push({id:u.id,amount});}
        if(s.effect==='restore')for(const k of ['defDown','spdDown','moveDown','silence'])delete u.status[k];
        if(s.effect==='ward')u.status.ward=7;
        if(s.effect==='silence'){u.status.silence=1;this.alertGroup(u);}
        if(['warp','rescue'].includes(s.effect))this.setUnitPosition(u.id,destination.x,destination.y);
        MyGO.Inventory.sync(u);
      }
      caster.acted=true;MyGO.Inventory.sync(caster);
      const growth=MyGO.Growth.award(caster,MyGO.Growth.supportExp(caster,spellId,this.turn));
      return {spell:s,changes,affected:affected.map(u=>u.id),experience:growth?[growth]:[]};
    }

    expireStatuses(side) {
      for(const u of this.living(side)){
        for(const k of ['defDown','spdDown','moveDown','silence'])delete u.status[k];
        MyGO.Inventory.sync(u);
      }
    }

    decayWard(side) {for(const u of this.living(side))if(u.status.ward)u.status.ward--;}

    /** 切换静态关卡数据（不影响回合/单位状态，由 restore 重新填充）。 */
    _setupStage(stage) {
      this.stage = [2,3,4,5,6,7,8].includes(stage) ? stage : 1;
      this.map = this.stage >= 2 ? stageTwoMap(this.stage) : cloneMap();
      this.units = unitsForStage(this.stage, this.recruited);
      this.mission = missionForStage(this.stage);
      this.gateOpen = false;
      this.nijikaJoined=this.stage>=7&&this.recruited.includes('nijika');
      this.livehouseEndingShown=false;
      this.stageEightIntroSeen=false;
      this.resonanceOpen = false;
      this.awakenedBells = [];
      this.litLamps=[];
      this.summonedWaves=[];this.maskRetreatPending=false;this.maskEscaped=false;this.lastSummonTurn=0;
      this.openedChests=[];this.bossDiscovered=false;this.soyoBossBonus=false;this.enemyScaleLevel=0;this.enemyScalePower=0;
      if(this.stage>=4)this.scaleParkEnemies();
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
      const lamp=this.nearbyUnlitLamp(unit);this.litLamps.push(lamp.id);unit.acted=true;
      // The switch echoes along walkable ground, beyond the pool of light.
      const heard=Pathfinding.getReachable(this.map,{id:'__lamp_noise__',side:'player',...lamp,move:this.mission.lampNoiseRadius},[]);
      for(const enemy of this.living('enemy'))if(!enemy.boss&&heard.has(Grid.key(enemy.x,enemy.y)))this.alertGroup(enemy);
      this.refreshParkDiscovery();return lamp;
    }

    refreshParkDiscovery() {
      if(this.stage===4){const boss=this.getUnit('dark_soyo');if(boss&&this.isUnitVisible(boss))this.bossDiscovered=true;}
    }

    /** Scale from authored stats, never from previously scaled stats; preserve HP ratio. */
    scaleParkEnemies(level,units=this.units,force=false,legacyEighth=false) {
      if(this.stage<4)return;
      if(this.stage===8&&!legacyEighth)return this.scaleEighthEnemies(level,units,force);
      const party=units.filter(u=>u.side==='player');
      const target=level??Math.min(97,Math.ceil(party.reduce((n,u)=>n+u.level,0)/Math.max(1,party.length)));
      if(target<=this.enemyScaleLevel&&!force)return;
      for(const u of units.filter(u=>u.side==='enemy')){
        const base=missionForStage(this.stage).enemies.concat(this.stage===6?C.STAGE_SIX.summonTemplates:[]).find(t=>t.id===u.id),ratio=u.hp/u.maxHp;
        u.level=Math.min(99,target+(u.boss?2:0));const d=u.level-base.level;
        const courtArmor=this.stage>=5&&u.tags.includes('armor');
        for(const [k,rate] of Object.entries({maxHp:courtArmor?(u.boss?2:1):u.boss?3:2,str:.65,mag:.65,dex:.5,spd:.35,def:.4,res:courtArmor?.15:.45,lck:.3}))
          u[k]=Math.max(k==='maxHp'?(u.boss?(courtArmor?22:26):12):0,base[k]+Math.round(d*rate));
        u.hp=u.dead?0:Math.max(1,Math.ceil(u.maxHp*ratio));
      }
      this.enemyScaleLevel=target;
    }

    /** Fixed panel totals for phantoms/armor/pegasi; ordinary soldiers
     * follow party effective power. Legacy mode reconstructs v5.8.2 HP limits
     * before migrating wounds, and must keep the original total-stat formula. */
    scaleEighthEnemies(level,units=this.units,force=false,legacy=false) {
      const party=units.filter(u=>u.side==='player');
      const target=Math.min(97,Math.max(10,this.enemyScaleLevel||0,level||0,...party.map(u=>u.level)));
      const effectiveTotal=u=>Combat.statTotalOf(u)-(u.weapon.damageType==='magic'?(u.str||0):(u.mag||0));
      const power=Math.max(100,this.enemyScalePower||0,...party.map(legacy?Combat.statTotalOf:effectiveTotal));
      if(!force&&target===this.enemyScaleLevel&&power===this.enemyScalePower)return;
      for(const u of units.filter(u=>u.side==='enemy')){
        const base=C.STAGE_EIGHT.enemies.find(t=>t.id===u.id),ratio=u.hp/u.maxHp;
        const armor=u.tags.includes('armor'),flying=u.tags.includes('flying'),magic=C.WEAPONS[base.weapon].damageType==='magic';
        u.level=Math.min(99,target+(u.boss?2:0));const delta=u.level-base.level;
        const fixed=!legacy&&(C.STAGE_EIGHT.balanceStats[u.id]||C.STAGE_EIGHT.balanceStats[armor?'armor':flying?'flying':'']);
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
      this.scaleParkEnemies(this.enemyScaleLevel,this.units,true);
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
      return this.phase === 'player';
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
      return Pathfinding.getTargetsInRange(unit, this.units, x, y).filter(u=>unit.side!=='player'||this.isUnitVisible(u));
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

    markActed(unit) {
      if (unit) unit.acted = true;
    }

    resetActed(side) {
      for (const unit of this.living(side)) unit.acted = false;
    }

    /** 打开庭院大门，并同步地图格。返回是否是第一次打开。 */
    openGate() {
      if (this.gateOpen) return false;
      this.gateOpen = true;
      this._syncGateTiles();
      return true;
    }

    gateForKey(unit) {
      if (this.stage !== 1 || this.gateOpen || !unit) return null;
      if (!unit.inventory.some(i => i.id === 'courtyard_key' && i.uses > 0)) return null;
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        const cell = {x: unit.x + dx, y: unit.y + dy};
        if (this.getTerrain(cell.x, cell.y).id === 'gate') return cell;
      }
      return null;
    }

    canUseGateKey(unit) {
      return this.isPlayerPhase() && !!unit && unit.side === 'player' && !unit.dead && !unit.acted && !!this.gateForKey(unit);
    }

    useGateKey(unit) {
      if (!this.canUseGateKey(unit)) return false;
      const gate = this.gateForKey(unit);
      unit.inventory.splice(unit.inventory.findIndex(i => i.id === 'courtyard_key'), 1);
      this.openGate();
      unit.acted = true;
      MyGO.Inventory.sync(unit);
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
      unit.inventory.splice(index,1);this.openedChests.push(chest.id);unit.acted=true;
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
      unit.acted=true;
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
      unit.acted=true;
      for(const enemy of this.living('enemy'))if(enemy.guardGroup===bell.group)enemy.alerted=true;
      this.checkOutcome();
      return bell;
    }

    _syncResonance() {
      if(this.stage!==1 || !this.resonanceOpen) return;
      for(const p of C.FORD_CELLS) this.map.tiles[p.y][p.x]='ford';
    }

    _syncGateTiles() {
      const from = this.gateOpen ? 'gate' : 'gateOpen';
      const to = this.gateOpen ? 'gateOpen' : 'gate';
      for (let y = 0; y < this.map.rows; y++) {
        for (let x = 0; x < this.map.cols; x++) {
          if (this.map.tiles[y][x] === from) this.map.tiles[y][x] = to;
        }
      }
    }

    previewCombat(attacker, defender) {
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
        result.applied = true;
        result.hpBeforeApply = result.defenderHp;
        result.killed = result.strikes.some(s=>s.applied && s.killed && s.defenderId===result.defenderId);
        result.attackerKilled = result.strikes.some(s=>s.applied && s.killed && s.defenderId===result.attackerId);
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
      const participants=[attacker,defender].filter(Boolean).map(u=>({...u}));
      if(result.resourceId && attacker) {
        MyGO.Inventory.consume(attacker,result.resourceId);
        MyGO.Inventory.useEffects(attacker,defender,MyGO.Magic.get(result.resourceId),result.finalDamage,result.hit);
      }
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
      result.applied = true;
      result.hpBeforeApply = before;
      result.hpAfterApply = defender.hp;
      result.killed = killed;
      if (killed && this.stage === 1 && defender.key && attacker?.side === 'player' && !attacker.dead) {
        result.keyRecipientId = attacker.id;
        result.storedForKey = this._awardGateKey(attacker);
      }
      if(killed&&[5,8].includes(this.stage)&&defender.side==='enemy'&&attacker?.side==='player'&&!attacker.dead){
        result.drops=defender.drops.map(id=>this.awardLoot(attacker,id));
        for(const id of defender.drops){const at=defender.inventory.findIndex(i=>i.id===id);if(at>=0)defender.inventory.splice(at,1);}
      }
      if(attacker)MyGO.Inventory.sync(attacker);
      MyGO.Inventory.sync(defender);
      this.checkOutcome();
      if(!deferExperience)result.experience=this.awardCombatExperience([result],participants);
      return result;
    }

    awardCombatExperience(strikes,participants) {
      const reports=[];
      for(const before of participants){
        const u=this.getUnit(before.id),enemy=participants.find(p=>Grid.hostile(p,before));
        if(!MyGO.Growth.eligible(u)||!enemy)continue;
        const outgoing=strikes.filter(s=>s.applied&&s.attackerId===u.id&&s.defenderId===enemy.id);
        const damage=outgoing.reduce((n,s)=>n+Math.max(0,s.hpBeforeApply-s.hpAfterApply),0);
        const killed=outgoing.some(s=>s.killed);
        const amount=MyGO.Growth.combatExp(before,enemy,damage,killed);
        const bonus=this.stage===4&&u.id==='soyo'&&enemy.id==='dark_soyo'&&killed;
        const report=MyGO.Growth.award(u,amount,bonus?2:1);
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
      const victory=this.stage===8 ? this.stageEightIntroSeen&&this.mission.phantomIds.every(id=>this.getUnit(id)?.dead) : this.stage===7 ? this.nijikaJoined&&this.livingCount('enemy')===0 : this.stage===6 ? this.maskEscaped : this.stage===5 ? !!this.getUnit('iron_warden')?.dead : this.stage===4 ? !!this.getUnit('dark_soyo')?.dead : this.stage===2
        ? this.awakenedBells.length>=this.mission.requiredBells && !!this.getUnit('conductor')?.dead
        : this.livingCount('enemy')===0;
      if (this.livingCount('player') === 0) {
        this.phase = 'defeat';
        this.winner = 'enemy';
      } else if (victory) {
        this.phase = 'victory';
        this.winner = 'player';
        if(!this.rewardedChapters.includes(this.stage)){this.gold+=MyGO.Shop.CHAPTER_REWARD;this.rewardedChapters.push(this.stage);}
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
      if (this.phase !== 'player' || this.isOver()) return false;
      this.expireStatuses('player');
      this.decayWard('enemy');
      this.phase = 'enemy';
      this.refreshAlerts();
      this.resetActed('enemy');
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
      this.decayWard('player');
      this.turn += 1;
      if(this.stage>=4)this.scaleParkEnemies();
      if(this.stage===3 && this.turn>=4){
        for(const enemy of this.living('enemy'))if(enemy.guardGroup==='south')enemy.alerted=true;
      }
      this.phase = 'player';
      this.resetActed('player');
      this.lastHealing=[];
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
      return list.length > 0 && list.every((u) => u.acted);
    }

    /**
     * 存档快照：静态地图/角色模板不重复写入。
     * 只保存会变化的状态，读档时由模板重建单位。
     */
    serialize() {
      return {
        version: C.SAVE_VERSION,
        stage: this.stage,
        mapRevision: this.stage === 1 ? C.MAP_REVISION : this.mission.mapRevision,
        turn: this.turn,
        phase: this.phase,
        winner: this.winner,
        gateOpen: this.gateOpen,
        resonanceOpen: this.resonanceOpen,
        awakenedBells: this.awakenedBells.slice(),
        ...(this.stage===4?{litLamps:this.litLamps.slice(),bossDiscovered:this.bossDiscovered,
          soyoBossBonus:this.soyoBossBonus,enemyScaleLevel:this.enemyScaleLevel}:{}),
        ...(this.stage===8?{stageEightIntroSeen:this.stageEightIntroSeen,enemyScaleVersion:3,enemyScalePower:this.enemyScalePower,nijikaLevelVersion:1,openedChests:this.openedChests.slice(),enemyScaleLevel:this.enemyScaleLevel}:{}),
        ...(this.stage===5?{openedChests:this.openedChests.slice(),enemyScaleLevel:this.enemyScaleLevel}:{}),
        ...(this.stage===6?{summonedWaves:this.summonedWaves.slice(),lastSummonTurn:this.lastSummonTurn,maskRetreatPending:this.maskRetreatPending,maskEscaped:this.maskEscaped,enemyScaleLevel:this.enemyScaleLevel}:{}),
        ...(this.stage===7?{nijikaJoined:this.nijikaJoined,nijikaLevelVersion:1,livehouseEndingShown:this.livehouseEndingShown,enemyScaleLevel:this.enemyScaleLevel}:{}),
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
      if(snapshot.inventoryVersion!==undefined&&snapshot.inventoryVersion!==1)throw Error('背包存档版本不兼容');
      if (snapshot.stage === 2 && snapshot.mapRevision !== C.STAGE_TWO.mapRevision) {
        throw new Error('第二关地图已重新设计，请重开第二关；旧存档仍然保留。');
      }
      if (snapshot.stage === 3 && snapshot.mapRevision !== C.STAGE_THREE.mapRevision) throw new Error('第三关地图版本不兼容');
      if(snapshot.stage===8&&snapshot.mapRevision!==C.STAGE_EIGHT.mapRevision)throw Error('第八关地图版本不兼容');
      if(snapshot.stage===7&&snapshot.mapRevision!==C.STAGE_SEVEN.mapRevision)throw Error('第七关地图版本不兼容');
      if (snapshot.stage === 6 && snapshot.mapRevision !== C.STAGE_SIX.mapRevision) throw Error('第六关地图版本不兼容');
      if (snapshot.stage === 5 && snapshot.mapRevision !== C.STAGE_FIVE.mapRevision) throw new Error('第五关地图版本不兼容');
      if (snapshot.stage === 4 && snapshot.mapRevision !== C.STAGE_FOUR.mapRevision) throw new Error('第四关地图版本不兼容');
      if (![2,3,4,5,6,7,8].includes(snapshot.stage) && snapshot.mapRevision !== C.MAP_REVISION) {
        throw new Error('第一关地图已更新，请重开第一关；旧存档仍然保留。');
      }
      const bells=snapshot.stage===2 ? snapshot.awakenedBells || [] : [];
      if(!Array.isArray(bells) || new Set(bells).size!==bells.length ||
        bells.some(id=>!C.STAGE_TWO.bells.some(b=>b.id===id)))throw new Error('存档星铃数据无效');

      // 地图是可变的（大门开启后会换成 gateOpen），读档先恢复关卡与静态地图。
      this.stage = [2,3,4,5,6,7,8].includes(snapshot.stage) ? snapshot.stage : 1;
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
      this.gateOpen = !!snapshot.gateOpen;
      this._syncGateTiles();
      this.resonanceOpen = this.stage===1 && !!snapshot.resonanceOpen;
      this.awakenedBells = bells.slice();
      this._syncResonance();

      this.recruited = Array.isArray(snapshot.recruited) ? ['xueyue','nina','nijika'].filter(id=>snapshot.recruited.includes(id)) : [];
      this.ninaLost = !!snapshot.ninaLost || this.stage === 3 && snapshot.units.some(u=>u.id==='nina'&&(u.dead||u.hp<=0));
      this.ninaRecruitmentShown = !!snapshot.ninaRecruitmentShown;
      if (this.ninaLost || this.stage < 3 || this.stage===3&&snapshot.phase !== 'victory') this.recruited=this.recruited.filter(id=>id!=='nina');
      const legacyJoined = this.stage === 1 && this.recruited.includes('xueyue') && snapshot.recruitmentVersion !== 1;
      if (this.stage === 1 && snapshot.phase !== 'victory') this.recruited = [];
      this.recruitmentShown = snapshot.recruitmentVersion === 1 && !!snapshot.recruitmentShown;
      this.nijikaJoined=this.stage===8||this.stage===7&&snapshot.nijikaJoined===true;
      this.livehouseEndingShown=this.stage===7&&snapshot.livehouseEndingShown===true;
      if(this.stage===7){
        if(snapshot.livehouseEndingShown!==undefined&&typeof snapshot.livehouseEndingShown!=='boolean'||this.livehouseEndingShown&&snapshot.phase!=='victory')throw Error('Live House 战后剧情状态无效');
        if(typeof snapshot.nijikaJoined!=='boolean'||this.nijikaJoined!==this.recruited.includes('nijika'))throw Error('虹夏入队状态无效');
        if(snapshot.nijikaLevelVersion!==undefined&&snapshot.nijikaLevelVersion!==1)throw Error('虹夏等级版本无效');
        if(!Number.isInteger(snapshot.enemyScaleLevel)||snapshot.enemyScaleLevel<1||snapshot.enemyScaleLevel>97)throw Error('存档敌军等级无效');
        const expected=unitsForStage(this.stage,this.recruited);
        if(snapshot.units.length!==expected.length||snapshot.units.some(u=>!expected.some(t=>t.id===u.id)))throw Error('第七关单位数据无效');
      }else if(this.stage!==8)this.recruited=this.recruited.filter(id=>id!=='nijika');
      this.stageEightIntroSeen=this.stage===8&&snapshot.stageEightIntroSeen===true;
      this.enemyScalePower=0;
      if(this.stage===8&&snapshot.enemyScaleVersion!==undefined){
        if(![1,2,3].includes(snapshot.enemyScaleVersion)||!Number.isSafeInteger(snapshot.enemyScalePower)||snapshot.enemyScalePower<100||snapshot.enemyScalePower>100000)throw Error('第八关敌军强度数据无效');
        this.enemyScalePower=snapshot.enemyScalePower;
      }
      if(this.stage===8){
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
      if(this.stage===8&&snapshot.enemyScaleVersion===1)this.scaleEighthEnemies(snapshot.enemyScaleLevel,fresh,false,true);
      else if(this.stage>=4)this.scaleParkEnemies(snapshot.enemyScaleLevel,fresh,false,this.stage===8&&snapshot.enemyScaleVersion===undefined);
      // Both v5.8.3 and v5.8.4 used these HP limits. Restore wounds against
      // those limits before applying the corrected panel budgets below.
      if(this.stage===8&&snapshot.enemyScaleVersion===2)for(const u of fresh.filter(u=>u.side==='enemy')){
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
        if(!Number.isFinite(Grid.movementCost(this.map,unit,saved.x,saved.y)))throw Error('存档停留在阻挡地形');
        unit.hp = Math.max(0, Math.min(unit.maxHp, Number(saved.hp) || 0));
        unit.dead = !!saved.dead || unit.hp <= 0;
        unit.acted = !!saved.acted || unit.dead;
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

      // Reconstruct old limits before applying the corrected panel budgets.
      if(this.stage===8){
        if(![2,3].includes(snapshot.enemyScaleVersion)){this.enemyScaleLevel=0;this.enemyScalePower=0;}
        this.scaleParkEnemies(undefined,fresh,snapshot.enemyScaleVersion!==3);
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
      if(this.stage===7){const n=this.getUnit('nijika');n.side=this.nijikaJoined?'player':'ally';if(!this.nijikaJoined&&(n.dead||snapshot.phase!=='player'))throw Error('虹夏开场状态无效');}
      const nina=this.getUnit('nina');
      if(nina && this.ninaLost) Object.assign(nina,{dead:true,hp:0,acted:true,side:'ally'});
      if(nina && this.recruited.includes('nina') && !nina.dead && !this.ninaLost) Object.assign(nina,{side:'player',acted:this.stage===3?true:nina.acted,
        quote:'你们真的来了……我叫井芹仁菜。接下来，让我也一起走吧。'});
      this.mission = missionForStage(this.stage);
      this.refreshParkDiscovery();
      this.turn = Math.max(1, Number(snapshot.turn) || 1);
      this.phase = ['enemy','ally'].includes(snapshot.phase) ? 'player' : snapshot.phase;
      this.winner = snapshot.winner || null;
      if (this.stage === 1 && this.phase === 'victory' && this.getUnit('xueyue')?.dead) this.recruited = ['xueyue'];
      this.rng = MyGO.RNG.restore(snapshot.rngState);
      // 保留终局快照的胜负状态；非终局快照则由棋盘状态重新推导。
      this.checkOutcome();
      return true;
    }
  }

  MyGO.Game = Game;
  MyGO.createUnit = createUnit;
  MyGO.createMap = cloneMap;
})(window);
