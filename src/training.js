/* The tower runs a separate battle. Only earned experience returns to the campaign. */
(function (global) {
  'use strict';
  const M=global.MyGO;
  const ENEMY_COUNT=20;
  const MASTERY_MULTIPLIER=4;
  const SNAPSHOT_VERSION=2;
  const enemyCountByVersion=new Map([[1,30],[SNAPSHOT_VERSION,ENEMY_COUNT]]);
  const statKeys=['maxHp','str','mag','dex','spd','lck','def','res','move'];

  function trainees(campaign){
    return campaign.living('player');
  }

  const ticketBags=campaign=>[campaign.convoy,...campaign.units.filter(u=>u.side==='player').map(u=>u.inventory)];
  const ticketCount=campaign=>ticketBags(campaign).flat().filter(item=>item.id===M.Shop.TICKET).length;

  function entryReason(campaign){
    if(!M.Shop.trainingUnlocked(campaign))return '第 3 章通关后解锁训练之塔。';
    if(!campaign.retreat || campaign.phase==='defeat')return '请从休憩之地进入训练之塔。';
    if(trainees(campaign).length<2)return '需要两位可出战的同伴。';
    if(!ticketCount(campaign))return '需要一张训练之塔门票，可在行旅商店购买。';
    return '';
  }

  function sameLevelExp(unit){
    return Math.ceil(M.Growth.killExp(unit,{level:unit.level,expClassBase:30})-1e-9);
  }

  function arena(rng,enemyCount){
    const cols=rng.int(18,20), rows=rng.int(14,16);
    const pillarColumn=rng.int(1,3), pillarRow=rng.int(1,3);
    const tiles=Array.from({length:rows},(_,y)=>Array.from({length:cols},(_,x)=>{
      if(x===0||x===cols-1||y===0||y===rows-1)return 'wall';
      if(y>=rows-3)return y===rows-2&&[cols-4,3].includes(x)?'fort':'plain';
      if(x%3===pillarColumn%3&&y%3===pillarRow%3&&rng.int(0,99)<72)return 'wall';
      return rng.int(0,99)<19?'forest':'plain';
    }));
    const spawns=[-1,1].map(offset=>({x:Math.floor(cols/2)+offset,y:rows-2}));
    const points=[];
    for(let y=1;y<rows-4;y++)for(let x=1;x<cols-1;x++)if(tiles[y][x]!=='wall')points.push({x,y});
    for(let i=points.length-1;i>0;i--){
      const at=rng.int(0,i);
      [points[i],points[at]]=[points[at],points[i]];
    }
    return {map:{cols,rows,tiles,decor:[]},spawns,enemies:points.slice(0,enemyCount)};
  }

  function slimeStats(hero,rng){
    const total=M.Combat.statTotalOf(hero);
    const budget=total-rng.int(30,40);
    const values={maxHp:1,str:0,mag:0,dex:0,spd:0,lck:0,def:0,res:0,move:Math.min(3,Math.max(1,hero.move-2))};
    let remaining=budget-values.maxHp-values.move;
    const weights=statKeys.slice(0,-1).map(key=>({key,weight:Math.max(1,hero[key]+rng.int(-2,2))}));
    const weightSum=weights.reduce((sum,entry)=>sum+entry.weight,0);
    const quota=weights.map(({key,weight})=>{
      const share=remaining*weight/weightSum;
      return {key,whole:Math.floor(share),fraction:share%1};
    });
    for(const {key,whole} of quota){ values[key]+=whole; remaining-=whole; }
    quota.sort((a,b)=>b.fraction-a.fraction);
    for(let i=0;i<remaining;i++)values[quota[i].key]++;
    return values;
  }

  function copyTrainee(unit,cell){
    // All unit data is plain state. Give the exercise its own inventory, HP and skills.
    const copy=JSON.parse(JSON.stringify(unit));
    Object.assign(copy,cell,{hp:copy.maxHp,acted:false,dead:false,escaped:false,_walking:false,
      facing:'up',status:{},combatArtId:null,talentSwapReady:false,talentAttacked:false,talentAttackCount:0,trainingPractice:true});
    copy.inventory=copy.inventory.filter(item=>item.id!==M.Shop.TICKET);
    for(const slot of copy.inventory){
      const item=M.Inventory.item(slot.id);
      if(item.kind==='weapon')slot.uses=item.uses;
    }
    for(const id of copy.learnedSpells)copy.spellUses[id]=M.Magic.get(id).uses;
    M.Inventory.sync(copy);
    return copy;
  }

  class TrainingGame extends M.Game {
    get masteryMultiplier(){return MASTERY_MULTIPLIER;}

    constructor(campaign,ids,seed,snapshotVersion=SNAPSHOT_VERSION){
      if(!M.Shop.trainingUnlocked(campaign)||!campaign.retreat||campaign.phase==='defeat'||
        !Array.isArray(ids)||ids.length!==2||new Set(ids).size!==2||!ids.every(id=>trainees(campaign).some(u=>u.id===id))) {
        throw Error('请选择两位可出战的同伴。');
      }
      if(!Number.isInteger(seed)||seed<1||seed>0xffffffff)throw Error('训练地图种子无效。');
      const enemyCount=enemyCountByVersion.get(snapshotVersion);
      if(!enemyCount)throw Error('训练存档版本无效。');
      super({seed});
      this.stage=0;
      this.isTraining=true;
      this.campaign=campaign;
      this.seed=seed;
      this.traineeIds=ids.slice();
      this.snapshotVersion=snapshotVersion;
      const setup=arena(this.rng,enemyCount);
      this.map=setup.map;
      Object.defineProperty(this.map,'units',{configurable:true,get:()=>this.units});
      const participants=ids.map(id=>campaign.getUnit(id));
      const slimes=setup.enemies.map((cell,index)=>{
        const group=index%2, hero=participants[group];
        const stats=slimeStats(hero,this.rng);
        const slime=M.createUnit({...stats,...cell,id:'training_slime_'+index,side:'enemy',
          name:'史莱姆 '+(index+1),shortName:'黏',className:'史莱姆',level:hero.level,hit:75,
          weapon:'training_sword',guardRadius:4,tags:['monster'],expClassBase:30});
        Object.assign(slime,{trainingSlime:true,trainingPractice:true,artKey:'training_slime',slimeGroup:group});
        M.Inventory.sync(slime);
        return slime;
      });
      this.units=participants.map((unit,index)=>copyTrainee(unit,setup.spawns[index])).concat(slimes);
      this.convoy=[];
      this.gold=0;
      this.mission={chapter:'TRAINING',chapterJp:'演练',chapterEn:'TRAINING TOWER',title:'训练之塔',subtitle:'双人演练 · 随机战场',
        mapName:'塔内试炼场',objective:'击败全部 '+enemyCount+' 个史莱姆',gateHint:'两位同伴都倒下时，本次训练结束。',enemyCount};
    }

    static start(campaign,ids,seed){
      const reason=entryReason(campaign);
      if(reason)throw Error(reason);
      const battle=new TrainingGame(campaign,ids,seed);
      const bag=ticketBags(campaign).find(items=>items.some(item=>item.id===M.Shop.TICKET));
      bag.splice(bag.findIndex(item=>item.id===M.Shop.TICKET),1);
      if(bag===campaign.convoy)campaign.collectReservedLoot();
      return battle;
    }

    shopReason(){return '训练中请使用出发时携带的装备。';}

    checkOutcome(){
      if(this.isOver())return this.winner;
      if(!this.livingCount('player')){
        this.phase='defeat';
        this.winner='enemy';
      }else if(!this.livingCount('enemy')){
        this.phase='victory';
        this.winner='player';
      }
      return this.winner;
    }

    settle(){
      if(!this.isOver())throw Error('训练尚未结束。');
      if(this.settlement)return this.settlement;
      const complete=this.phase==='victory';
      const party=this.traineeIds.map(id=>{
        const unit=this.campaign.getUnit(id), trainee=this.getUnit(id);
        const mastery=(trainee.classXp[unit.classId]||0)-(unit.classXp[unit.classId]||0);
        M.Mastery.restore(unit,M.Mastery.pack(trainee));
        const growth=complete?M.Growth.award(unit,sameLevelExp(unit)):null;
        return {name:unit.name,mastery,growth};
      });
      this.settlement={complete,defeated:this.mission.enemyCount-this.livingCount('enemy'),party};
      return this.settlement;
    }

    serialize(){
      const snapshot=this.campaign.serialize();
      if(this.settlement)return snapshot;
      return {...snapshot,training:{version:this.snapshotVersion,seed:this.seed,ids:this.traineeIds.slice(),turn:this.turn,
        rngState:this.rng.serialize(),units:this.units.map(unit=>({id:unit.id,x:unit.x,y:unit.y,hp:unit.hp,
          dead:unit.dead,acted:unit.acted,alerted:unit.alerted,talentSwapReady:!!unit.talentSwapReady,
          talentAttacked:!!unit.talentAttacked,talentAttackCount:unit.talentAttackCount||0,...M.Inventory.pack(unit)}))}};
    }

    static fromSnapshot(campaign,snapshot){
      const enemyCount=enemyCountByVersion.get(snapshot?.version);
      if(!enemyCount||!Number.isInteger(snapshot.turn)||snapshot.turn<1||
        !Number.isInteger(snapshot.rngState)||snapshot.rngState<1||snapshot.rngState>0xffffffff||
        !Array.isArray(snapshot.units)||snapshot.units.length!==enemyCount+2)throw Error('训练存档数据无效。');
      const battle=new TrainingGame(campaign,snapshot.ids,snapshot.seed,snapshot.version);
      const ids=new Set(), occupied=new Set();
      for(const state of snapshot.units){
        const unit=battle.getUnit(state?.id);
        if(!unit||ids.has(unit.id)||!Number.isInteger(state.x)||!Number.isInteger(state.y)||
          !M.Grid.inBounds(battle.map,state.x,state.y)||!Number.isFinite(M.Grid.movementCost(battle.map,unit,state.x,state.y))||
          !Number.isInteger(state.hp)||state.hp<0||typeof state.dead!=='boolean'||state.dead!==(state.hp===0)||
          typeof state.acted!=='boolean'||typeof state.alerted!=='boolean'||!Number.isSafeInteger(state.talentAttackCount)||state.talentAttackCount<0||
          !Array.isArray(state.inventory)||state.classState?.id!==unit.classId)throw Error('训练单位存档无效。');
        ids.add(unit.id);
        const cell=M.Grid.key(state.x,state.y);
        if(!state.dead&&occupied.has(cell))throw Error('训练存档位置重叠。');
        if(!state.dead)occupied.add(cell);
        M.Mastery.restore(unit,state.classMastery);
        M.Inventory.restore(unit,state,false);
        if(state.hp>unit.maxHp)throw Error('训练生命值无效。');
        Object.assign(unit,{x:state.x,y:state.y,hp:state.hp,dead:state.dead,acted:state.acted,alerted:state.alerted,
          talentSwapReady:false,talentAttacked:!!state.talentAttacked,talentAttackCount:state.talentAttackCount});
      }
      battle.turn=snapshot.turn;
      battle.rng=M.RNG.restore(snapshot.rngState);
      if(battle.checkOutcome())throw Error('训练存档已结算。');
      return battle;
    }
  }

  M.Training=Object.freeze({Game:TrainingGame,trainees,ticketCount,entryReason,sameLevelExp,ENEMY_COUNT,MASTERY_MULTIPLIER});
})(window);
