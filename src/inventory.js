/* Five physical slots; learned spells and their per-map charges live separately. */
(function(global){
  'use strict';
  const M=global.MyGO=global.MyGO||{}, E=M.Equipment, Magic=M.Magic;
  const weaponIds=['training_sword','iron_sword','steel_sword','silver_sword','training_lance','iron_lance','steel_lance','silver_lance','javelin',
    'training_axe','iron_axe','steel_axe','silver_axe','hand_axe','training_bow','iron_bow','steel_bow','silver_bow','mini_bow','longbow',
    'training_gauntlets','iron_gauntlets','steel_gauntlets','silver_gauntlets'];
  const accessoryIds=['leather_shield','iron_shield','steel_shield','silver_shield','talisman_shield','hexlock_shield','accuracy_ring','critical_ring','evasion_ring','speed_ring','march_ring','magic_staff','healing_staff'];
  const courtyardKey=Object.freeze({id:'courtyard_key',name:'内庭钥匙',kind:'key',category:'key',uses:1,icon:'accuracy-ring',
    effect:'开启第一关内庭大门。持有者须站在门旁使用，使用后消耗钥匙并结束行动。'});
  const chestKey=Object.freeze({id:'chest_key',name:'宝箱钥匙',kind:'key',category:'key',uses:1,icon:'accuracy-ring',
    effect:'持有者站在宝箱上或相邻1格，消耗钥匙开箱并结束行动。'});
  const supplyIds=E.items.filter(e=>['consumable','seal'].includes(e.kind)).map(e=>e.id);
  const allowed=new Set([...E.items.map(e=>e.id),courtyardKey.id,chestKey.id]);
  // Soyo's original v4.8 spell list is accepted only for save migration.
  const retiredSoyoSpells=new Set(['wind','thunder','thoron','nosferatu','physic','restore','ward','rescue','warp','silence','fortify']);
  const weapons=Object.fromEntries(E.items.filter(e=>e.kind==='weapon').map(e=>{
    const r=e.range.split('-').map(Number),targets={'飞行特效':['flying'],'重装特效':['armor'],'骑马特效':['cavalry'],'双重特效':['armor','cavalry'],'龙特效':['dragon']};
    const effectiveAgainst=[...new Set(e.tags.flatMap(t=>targets[t]||[]))];
    return[e.id,Object.freeze({...e,type:e.category,range:[r[0],r[1]||r[0]],color:'#b4cadc',absoluteHit:true,
      brave:e.category==='gauntlet'||e.tags.includes('连续攻击'),effectiveAgainst,effectiveMultiplier:effectiveAgainst.length?3:undefined})];
  }));
  for(const s of Magic.items)if(!s.support)weapons[s.id]=Object.freeze({...s,absoluteHit:true});
  const unarmed=Object.freeze({id:'unarmed',name:'未装备攻击手段',type:'none',range:[0,0],might:0,hit:0,crit:0,weight:0,damageType:'physical',cannotAttack:true,color:'#aaa'});
  weapons.unarmed=unarmed;
  function item(id){return id===courtyardKey.id?courtyardKey:id===chestKey.id?chestKey:E.get(id);}
  function make(id){if(!allowed.has(id))throw Error('该物品尚未开放配置');const e=item(id);return{id,uses:e.uses};}
  function magicAllowed(u){return !u.classId||!!M.Classes?.get(u.classId)?.magic;}
  function canEquip(u,e){
    if(e?.kind!=='weapon')return e?.kind==='equipment';
    if(e.category==='gauntlet'&&(u.tags.includes('cavalry')||u.tags.includes('flying')))return false;
    return (u.weaponTypes||[u.weaponType]).includes(e.category);
  }
  function learn(u){
    if(u.side!=='player'||(!u.mageTrained&&u.id!=='soyo'&&!M.Classes?.get(u.classId)?.magic))return [];
    u.mageTrained=true;
    const added=[];
    for(const row of Magic.learning)if(u.level>=row.level&&!u.learnedSpells.includes(row.id)){
      u.learnedSpells.push(row.id);u.spellUses[row.id]=Magic.get(row.id).uses;added.push(row.id);
    }
    return added;
  }
  function usable(u,w=u.weapon){
    if(!w||w.cannotAttack||w.support)return false;
    if(w.kind==='spell')return magicAllowed(u)&&!(u.status?.silence)&&u.learnedSpells.includes(w.id)&&(u.spellUses[w.id]||0)>0;
    if(!u.inventory)return true; // Pure combat fixtures may supply standalone weapons.
    return u.inventory.some(i=>i.id===w.id&&i.uses>0);
  }
  function options(u){return [...new Set([...u.inventory.filter(i=>i.uses>0&&canEquip(u,weapons[i.id])).map(i=>i.id),
    ...u.learnedSpells.filter(id=>magicAllowed(u)&&!Magic.get(id).support&&u.spellUses[id]>0&&!u.status?.silence)])];}
  function sync(u){
    let id=u.equippedWeapon;
    if(!options(u).includes(id))id=options(u)[0]||'unarmed';
    u.equippedWeapon=id;u.weaponId=id;u.weapon=weapons[id]||unarmed;
    const candidate=u.inventory.find(i=>i.id===u.equippedAccessory)&&item(u.equippedAccessory);
    const e=candidate?.kind==='equipment'?candidate:null;
    u.equippedAccessory=e?e.id:null;u.equipmentWeight=e?e.weight:0;
    u.gear={def:e?.protection||0,res:e?.resilience||0,hit:e?.id==='accuracy_ring'?10:0,crit:e?.id==='critical_ring'?5:0,
      avoid:e?.id==='evasion_ring'?10:0,spd:e?.id==='speed_ring'?2:0,move:e?.id==='march_ring'?1:0,
      magic:e?.id==='magic_staff'?3:0,heal:e?.id==='healing_staff'?10:0};
  }
  function init(u,t){
    const w=weapons[t.weapon];if(!w)throw Error('未知攻击手段：'+t.weapon);
    u.weaponType=w.type;u.inventory=w.kind==='spell'?[]:[make(w.id)];
    u.learnedSpells=(t.spells|| (w.kind==='spell'?[w.id]:[])).slice();
    u.spellUses=Object.fromEntries(u.learnedSpells.map(id=>[id,Magic.get(id).uses]));
    u.status={};u.equippedWeapon=w.id;u.equippedAccessory=null;learn(u);sync(u);
  }
  function consume(u,id){
    if(Magic.get(id)){if(!(u.spellUses[id]>0))throw Error('魔法次数不足');u.spellUses[id]--;}
    else {const i=u.inventory.find(i=>i.id===id&&i.uses>0);if(!i)throw Error('武器耐久不足');i.uses--;}
  }
  function copy(u){return {...u,inventory:u.inventory?.map(i=>({...i})),learnedSpells:u.learnedSpells?.slice(),spellUses:{...u.spellUses},status:{...u.status},gear:{...u.gear}};}
  function pack(u){return{inventory:u.inventory.map(i=>({...i})),equippedWeapon:u.equippedWeapon,equippedAccessory:u.equippedAccessory,
    classState:{version:1,id:u.classId,certified:(u.certifiedClasses||[u.classId]).filter(Boolean)},mageTrained:!!u.mageTrained,
    learnedSpells:u.learnedSpells.slice(),spellUses:{...u.spellUses},status:{...u.status}};}
  function validateBag(bag,max=5){
    if(!Array.isArray(bag)||bag.length>max)throw Error('背包格数无效');
    return bag.map(i=>{const e=i&&item(i.id);if(!e||!allowed.has(i.id))throw Error('存档包含未知物品');
      if(e.uses!==null&&(!Number.isInteger(i.uses)||i.uses<(['key','seal','consumable'].includes(e.kind)?1:0)||i.uses>e.uses))throw Error('存档耐久无效');return{id:i.id,uses:e.uses===null?null:i.uses};});
  }
  function restore(u,s,refresh){
    if(!s||!Array.isArray(s.inventory))return;
    u.inventory=validateBag(s.inventory);
    if(s.mageTrained!==undefined&&typeof s.mageTrained!=='boolean')throw Error('存档魔法训练无效');
    u.mageTrained=!!s.mageTrained||u.id==='soyo'||!!M.Classes?.get(u.classId)?.magic;
    learn(u);
    if(!Array.isArray(s.learnedSpells)||new Set(s.learnedSpells).size!==s.learnedSpells.length||s.learnedSpells.some(id=>!Magic.get(id)))throw Error('存档魔法无效');
    // Templates remain authoritative: discard Soyo's retired spells from old saves.
    if(s.learnedSpells.some(id=>!u.learnedSpells.includes(id)&&!(u.id==='soyo'&&retiredSoyoSpells.has(id))))throw Error('角色尚未学会该魔法');
    for(const id of u.learnedSpells){const n=s.spellUses?.[id];if(n!==undefined&&(!Number.isInteger(n)||n<0||n>Magic.get(id).uses))throw Error('存档魔法次数无效');u.spellUses[id]=refresh?Magic.get(id).uses:(n??Magic.get(id).uses);}
    u.equippedWeapon=s.equippedWeapon;u.equippedAccessory=s.equippedAccessory;
    u.status={};if(!refresh)for(const k of ['defDown','spdDown','moveDown','silence','ward','poison','talentResDown']){const n=s.status?.[k];if(Number.isInteger(n)&&n>0&&n<=7)u.status[k]=n;}
    if(!refresh){
      const turns=s.status?.frostSpeedDown,fresh=s.status?.frostFresh;
      if((turns!==undefined&&![1,2].includes(turns))||(fresh!==undefined&&(fresh!==1||turns===undefined)))throw Error('存档冰霜剑气状态无效');
      if(turns!==undefined)u.status.frostSpeedDown=turns;
      if(fresh===1)u.status.frostFresh=1;
    }
    M.Talents?.sync(u);
    sync(u);
  }
  function stock(){return [...Array.from({length:25},()=>make('vulnerary')),...['iron_sword','iron_lance','iron_axe','iron_bow','iron_gauntlets'].map(make)];}
  function equip(u,index){const i=u.inventory[index],e=i&&item(i.id);if(!e)throw Error('背包物品不存在');
    if(e.kind==='key')throw Error('钥匙需在对应门旁使用');
    if(e.kind==='consumable'||e.kind==='seal')throw Error('该物品需要使用，不能装备');
    if(e.kind==='weapon'){if(!canEquip(u,e))throw Error('当前职业不能装备此类武器');if(i.uses<=0)throw Error('该武器已损坏');u.equippedWeapon=i.id;
      // Duplicate items are selected by slot: put the selected instance first among its family.
      const first=u.inventory.findIndex(a=>a.id===i.id);[u.inventory[first],u.inventory[index]]=[u.inventory[index],u.inventory[first]];
    }else u.equippedAccessory=u.equippedAccessory===i.id?null:i.id;sync(u);
  }
  function select(u,id){if(!options(u).includes(id))throw Error('攻击手段不可用');u.equippedWeapon=id;sync(u);}
  function useEffects(a,b,s,damage,hit){
    if(!hit||!s)return 0;
    if(['defDown','spdDown','moveDown','silence'].includes(s.effect)&&!(s.effect!=='silence'&&M.Talents?.immune(b)))b.status[s.effect]=1;
    const heal=s.effect==='drain'?Math.min(a.maxHp-a.hp,Math.floor(Math.min(b.hp,damage)/2)):0;
    a.hp+=heal;return heal;
  }
  M.Inventory={MAX_SLOTS:5,weaponIds,accessoryIds,supplyIds,weapons,item,make,usable,options,sync,init,consume,copy,pack,restore,validateBag,stock,equip,select,useEffects,learn,magicAllowed,canEquip};

  // Four authored chapters compress the original campaign's staged shop upgrades.
  const products=[];
  function offer(id,price,stage,limit=null){products.push(Object.freeze({id,price,stage,limit}));}
  const prices={training_sword:260,iron_sword:520,steel_sword:910,silver_sword:1560,killing_edge:1800,brave_sword:4000,armorslayer:2500,rapier:2000,levin_sword:1500,
    training_lance:280,iron_lance:560,steel_lance:910,silver_lance:1800,killer_lance:1800,brave_lance:4000,javelin:600,horseslayer:2500,arrow_of_indra:2000,
    training_axe:300,iron_axe:600,steel_axe:1100,silver_axe:2000,killer_axe:1800,brave_axe:4000,hand_axe:700,hammer:2500,bolt_axe:1500,
    training_bow:350,iron_bow:600,steel_bow:1000,silver_bow:2000,killer_bow:1800,brave_bow:4000,mini_bow:700,longbow:2000,magic_bow:1500,
    training_gauntlets:240,iron_gauntlets:480,steel_gauntlets:600,silver_gauntlets:1000,killer_gauntlets:1800,aura_knuckles:2000,dragon_claws:3000};
  for(const e of E.items.filter(e=>e.kind==='weapon'&&e.edition==='base')){
    const stage=/^(training|iron)_/.test(e.id)?1:/^(steel)_/.test(e.id)||['javelin','hand_axe','mini_bow'].includes(e.id)?2:/^(silver|killer)_/.test(e.id)||e.id==='killing_edge'?3:4;
    offer(e.id,prices[e.id],stage,stage===4?2:null);
  }
  [['leather_shield',500,1],['iron_shield',1000,2],['steel_shield',1500,3],['silver_shield',2000,4],['magic_staff',1500,3],['healing_staff',1500,3]].forEach(r=>offer(...r));
  for(const e of E.items.filter(e=>['consumable','seal'].includes(e.kind))){
    const stage=({vulnerary:1,concoction:2,elixir:4,antitoxin:1,pure_water:2,beginner_seal:1,intermediate_seal:2,advanced_seal:3,master_seal:4,dark_seal:3,abyssian_seal:4,dancer_seal:2})[e.id];
    offer(e.id,e.price,stage,e.kind==='seal'?e.id==='dancer_seal'?1:3:null);
  }
  M.Shop=Object.freeze({products:Object.freeze(products),START_GOLD:3000,CHAPTER_REWARD:2000,
    get:id=>products.find(p=>p.id===id)||null,
    stock:game=>products.map(p=>({...p,item:item(p.id),locked:game.stage<p.stage,
      remaining:p.limit===null?null:Math.max(0,p.limit-(game.shopPurchases[p.id]||0))}))});
})(window);
