/* FE3H reference catalogue, verified 2026-11-10 against Triangle Attack.
 * CONFIG.WEAPONS uses inventory.js adapters of the playable base entries.
 * Row stats: rank / uses / might / hit / crit / range / weight.
 * Icons: CC0 Free Game Assets; original art, not Nintendo assets.
 */
(function (global) {
  'use strict';
  const MyGO = global.MyGO = global.MyGO || {};
  const categories = [
    ['all','全部藏品','ALL'], ['sword','剑','SWORDS'], ['lance','枪','LANCES'],
    ['axe','斧','AXES'], ['bow','弓','BOWS'], ['gauntlet','拳套','GAUNTLETS'],
    ['shield','盾牌','SHIELDS'], ['ring','饰品','ACCESSORIES'], ['staff','法杖','STAVES'],
    ['medicine','药品','MEDICINES'], ['seal','转职证','SEALS']
  ].map(([id,name,en])=>Object.freeze({id,name,en}));
  // The second stat string is the forged + version, not a modifier to add.
  const weaponRows = [
    ['sword','Training Sword','训练用剑','E/50/3/100/0/1/4','E/65/3/100/0/1/2'],
    ['sword','Iron Sword','铁剑','E/40/5/90/0/1/5','E/45/6/100/0/1/5'],
    ['sword','Steel Sword','钢剑','D/50/8/85/0/1/10','D/55/10/85/0/1/10'],
    ['sword','Silver Sword','银剑','B/30/12/90/0/1/8','B/40/13/90/0/1/8'],
    ['sword','Killing Edge','必杀剑','C/20/8/85/25/1/10','C/25/9/85/35/1/10'],
    ['sword','Brave Sword','勇者之剑','B/30/9/75/0/1/12','B/40/10/85/0/1/12','brave'],
    ['sword','Armorslayer','破甲剑','D/20/8/80/0/1/11','D/25/8/100/5/1/11','armor'],
    ['sword','Rapier','刺剑','E/40/7/95/10/1/5','E/45/9/95/20/1/5','rapier'],
    ['sword','Levin Sword','雷剑','C/25/9/70/0/1-2/9','C/30/9/70/0/1-3/9','magic'],
    ['lance','Training Lance','训练用枪','E/50/4/90/0/1/5','E/65/4/90/0/1/3'],
    ['lance','Iron Lance','铁枪','E/30/6/80/0/1/6','E/35/7/90/0/1/6'],
    ['lance','Steel Lance','钢枪','D/40/9/75/0/1/11','D/45/11/75/0/1/11'],
    ['lance','Silver Lance','银枪','B/25/13/80/0/1/9','B/35/14/80/0/1/9'],
    ['lance','Killer Lance','必杀枪','C/20/9/80/25/1/11','C/25/10/80/35/1/11'],
    ['lance','Brave Lance','勇者之枪','B/25/10/70/0/1/13','B/35/11/80/0/1/13','brave'],
    ['lance','Javelin','投枪','D/30/2/80/0/1-2/8','D/40/3/80/0/1-2/8','ranged'],
    ['lance','Horseslayer','骑士杀手','D/20/8/70/0/1/13','D/25/8/90/5/1/13','cavalry'],
    ['lance','Arrow of Indra','因陀罗之箭','C/30/12/75/0/1-2/14','C/35/12/75/0/1-3/14','magic'],
    ['axe','Training Axe','训练用斧','E/50/6/80/0/1/6','E/65/6/80/0/1/4'],
    ['axe','Iron Axe','铁斧','E/45/8/70/0/1/7','E/45/9/75/0/1/7'],
    ['axe','Steel Axe','钢斧','D/55/11/65/0/1/12','D/60/13/65/0/1/12'],
    ['axe','Silver Axe','银斧','B/30/16/70/0/1/10','B/40/17/70/0/1/10'],
    ['axe','Killer Axe','必杀斧','C/20/11/70/25/1/12','C/25/12/70/35/1/12'],
    ['axe','Brave Axe','勇者之斧','B/30/12/60/0/1/14','B/40/13/70/0/1/14','brave'],
    ['axe','Hand Axe','手斧','D/30/4/70/0/1-2/10','D/40/5/70/0/1-2/10','ranged'],
    ['axe','Hammer','战锤','D/20/10/60/0/1/15','D/20/10/80/5/1/15','armor'],
    ['axe','Bolt Axe','雷斧','B/25/14/60/0/1-2/15','B/25/14/60/0/1-3/15','magic'],
    ['bow','Training Bow','训练用弓','E/50/3/90/0/2/5','E/65/3/90/0/2/3'],
    ['bow','Iron Bow','铁弓','E/40/6/85/0/2/6','E/40/7/95/0/2/5'],
    ['bow','Steel Bow','钢弓','D/50/9/80/0/2/11','D/50/11/80/0/2/10'],
    ['bow','Silver Bow','银弓','B/30/12/75/0/2/9','B/30/13/75/0/2/8'],
    ['bow','Killer Bow','必杀弓','C/20/9/80/25/2/11','C/25/11/80/35/2/11'],
    ['bow','Brave Bow','勇者之弓','B/30/10/70/0/2/13','B/40/11/80/0/2/12','brave'],
    ['bow','Mini Bow','短弓','D/50/4/90/0/1-2/3','D/55/6/90/10/1-2/3','mini'],
    ['bow','Longbow','长弓','C/20/9/70/0/2-3/13','C/25/11/70/0/2-3/13','ranged'],
    ['bow','Magic Bow','魔法弓','B/25/8/75/0/2/9','B/30/8/75/0/2-3/9','magic'],
    ['gauntlet','Training Gauntlets','训练用拳套','E/70/0/90/5/1/1','E/90/0/100/5/1/1'],
    ['gauntlet','Iron Gauntlets','铁拳套','E/50/1/85/5/1/3','E/60/1/95/5/1/3'],
    ['gauntlet','Steel Gauntlets','钢拳套','D/60/3/80/5/1/5','D/70/3/85/5/1/5'],
    ['gauntlet','Silver Gauntlets','银拳套','B/40/4/85/5/1/7','B/55/4/90/5/1/7'],
    ['gauntlet','Killer Gauntlets','必杀拳套','B/30/3/80/20/1/5','B/40/3/80/30/1/5'],
    ['gauntlet','Aura Knuckles','光辉拳套','A/30/2/70/0/1/4','A/40/2/80/5/1/4','magic'],
    ['gauntlet','Dragon Claws','龙爪','A/30/4/75/5/1/7','A/40/4/85/5/1/7','dragon']
  ];
  const specials = {
    brave: ['连续攻击','主动发起攻击时连续攻击两次。'],
    armor: ['重装特效','对重装单位有效；原作特效通常将武器威力乘 3。'],
    cavalry: ['骑马特效','对骑马单位有效；原作特效通常将武器威力乘 3。'],
    rapier: ['双重特效','对重装与骑马单位有效。'],
    magic: ['魔法武器','以魔力计算攻击，针对目标魔防。'],
    ranged: ['远程武器','可攻击的距离以射程栏为准。'],
    mini: ['近身射击','可在 1–2 格攻击；短弓没有飞行特效。'],
    dragon: ['龙特效','对龙类单位有效；主动发起攻击时连续攻击两次。']
  };
  const items = [];
  function slug(s) { return s.toLowerCase().replace(/ /g,'_'); }
  weaponRows.forEach(([category,en,name,base,forged,special])=>{
    const familyId=slug(en);
    const effect=specials[special] || (category==='gauntlet' ? ['连续攻击','主动发起攻击时连续攻击两次。骑乘状态不能使用拳套。'] : ['标准武器','无额外特殊效果。']);
    const tags=[effect[0]];
    let text=effect[1];
    if(category==='bow'&&special!=='mini'){tags.push('飞行特效');text+=' 对飞行单位有效。';}
    if(category==='gauntlet'&&special==='magic') text+=' 主动发起攻击时连续攻击两次，骑乘状态不能使用拳套。';
    [base,forged].forEach((stats,index)=>{
      if(!stats)return;
      const [rank,uses,might,hit,crit,range,weight]=stats.split('/');
      items.push({id:familyId+(index?'_plus':''),familyId,name:name+(index?'＋':''),en:en+(index?'+':''),category,kind:'weapon',rank,uses:+uses,might:+might,hit:+hit,crit:+crit,range,weight:+weight,protection:0,resilience:0,damageType:special==='magic'?'magic':'physical',icon:familyId+(index?'_plus':''),edition:index?'forged':'base',rarity:index?'forged':'regular',tags:[...tags,...(index?['强化版']:[])],effect:text,source:'https://www.fe3h.com/weapons/'+category+'/'+familyId});
    });
  });
  // Secondary equipment: English / Chinese / category / Prt / Rsl / Wt / effect / rarity.
  const accessoryRows = [
    ['Accuracy Ring','命中戒指','ring',0,0,0,'命中＋10。'],
    ['Aurora Shield','极光之盾','shield',3,0,0,'使针对飞行单位的特效无效。'],
    ['Black Eagles Pendant','黑鹫吊坠','ring',0,0,0,'魅力＋2。'],
    ['Blue Lion Brooch','青狮胸针','ring',0,0,0,'魅力＋2。'],
    ['Chalice of Beginnings','起源宝杯','ring',0,0,0,'使针对移动类型的特效无效；可对任意距离的攻击进行反击。DLC 装备。'],
    ['Critical Ring','必杀戒指','ring',0,0,0,'必杀＋5。'],
    ['Evasion Ring','回避戒指','ring',0,0,0,'回避＋10。'],
    ['Experience Gem','经验宝珠','ring',0,0,0,'获得的经验值加倍。'],
    ['Goddess Ring','女神戒指','ring',0,0,0,'幸运＋4；每回合恢复 HP。回复量的精确取整与条件请查阅原作来源。'],
    ['Golden Deer Bracelet','金鹿手环','ring',0,0,0,'魅力＋2。'],
    ['Healing Staff','治愈之杖','staff',0,0,1,'白魔法的治疗量＋10。'],
    ['Hexlock Shield','魔封之盾','shield',2,4,5,'物防＋2、魔防＋4。'],
    ['Iron Shield','铁盾','shield',2,0,2,'物防＋2。'],
    ['Kadmos Shield','卡多摩斯之盾','shield',3,0,0,'使针对重装单位的特效无效。'],
    ['Knowledge Gem','知识宝珠','ring',0,0,0,'技能经验与兵种精通经验加倍。'],
    ['Lampos Shield','兰波斯之盾','shield',3,0,0,'使针对骑马单位的特效无效。'],
    ['Leather Shield','皮盾','shield',1,0,1,'物防＋1。'],
    ['Magic Staff','魔导之杖','staff',0,0,1,'魔法攻击＋3。'],
    ['March Ring','行军戒指','ring',0,0,0,'移动＋1。'],
    ['Prayer Ring','祈祷戒指','ring',0,0,0,'赋予祈祷技能；每回合恢复 5 HP。'],
    ['Silver Shield','银盾','shield',4,0,4,'物防＋4。'],
    ['Speed Ring','速度戒指','ring',0,0,0,'速度＋2。'],
    ['Steel Shield','钢盾','shield',3,0,3,'物防＋3。'],
    ['Talisman Shield','护符之盾','shield',1,3,4,'物防＋1、魔防＋3。'],
    ['White Dragon Scarf','白龙围巾','ring',0,0,0,'魅力＋2。'],
    ['Caduceus Staff','卡度凯乌斯之杖','staff',0,0,1,'魔法攻击射程＋1。每回合恢复 HP，希思琳纹章持有者效果增强。','sacred'],
    ['Ochain Shield','奥汉之盾','shield',6,0,4,'使敌人的必杀无效。每回合恢复 HP，奇霍尔纹章持有者效果增强。','sacred'],
    ['Seiros Shield','赛罗司之盾','shield',5,0,3,'受到的魔兽伤害减半。每回合恢复 HP，赛罗司纹章持有者效果增强。','sacred'],
    ['Aegis Shield','埃癸斯之盾','shield',6,3,6,'伏拉鲁达力乌斯纹章持有者有概率使受到的伤害减半。','relic'],
    ['Fetters of Dromi','多罗米的锁环','ring',0,0,0,'移动＋1，赋予再移动。奥班纹章持有者有概率使受到的伤害减半。DLC 装备。','relic'],
    ['Rafail Gem','拉法叶宝珠','ring',0,0,0,'使针对移动类型的特效及敌人的必杀无效。拉米努纹章持有者有概率使受到的伤害减半。','relic'],
    ['Thyrsus','提尔狩斯之杖','staff',0,0,1,'魔法攻击射程＋2。古罗斯塔尔纹章持有者有概率使受到的伤害减半。','relic']
  ];
  accessoryRows.forEach(([en,name,category,protection,resilience,weight,effect,rarity])=>{
    const id=slug(en);
    items.push({id,familyId:id,name,en,category,kind:'equipment',rank:null,uses:null,might:null,hit:null,crit:null,range:null,weight,protection,resilience,damageType:null,icon:id,edition:'base',rarity:rarity||'regular',tags:[rarity==='relic'?'英雄遗产':rarity==='sacred'?'神圣装备':'辅助装备'],effect:effect+(rarity==='relic'?' 无纹章者装备英雄遗产通常会在战斗后受到 10 点伤害。':''),source:'https://www.fe3h.com/equipment/'+id});
  });
  const supplies = [
    ['vulnerary','伤药','Vulnerary','medicine',3,300,'heal',10,'回复自身 10 HP。每瓶可使用 3 次。'],
    ['concoction','调合药','Concoction','medicine',3,600,'heal',20,'回复自身 20 HP。每瓶可使用 3 次。'],
    ['elixir','特效药','Elixir','medicine',3,1000,'heal',99,'回复自身 99 HP。每瓶可使用 3 次。'],
    ['antitoxin','解毒药','Antitoxin','medicine',3,300,'antitoxin',0,'解除自身中毒状态。每瓶可使用 3 次。'],
    ['pure_water','圣水','Pure Water','medicine',3,300,'ward',7,'自身魔防暂时＋7，每个己方阶段开始衰减 1。每瓶可使用 3 次。'],
    ['beginner_seal','初级转职证','Beginner Seal','seal',1,500,'seal',0,'Lv.5 起取得初级职业资格，首次转职消耗 1 张。'],
    ['intermediate_seal','中级转职证','Intermediate Seal','seal',1,1000,'seal',0,'Lv.10 起取得中级职业资格，首次转职消耗 1 张。'],
    ['advanced_seal','高级转职证','Advanced Seal','seal',1,2000,'seal',0,'Lv.20 起取得高级职业资格，首次转职消耗 1 张。'],
    ['master_seal','最上级转职证','Master Seal','seal',1,3000,'seal',0,'Lv.30 起取得最上级职业资格，首次转职消耗 1 张。'],
    ['dark_seal','暗魔法转职证','Dark Seal','seal',1,2000,'seal',0,'用于暗术师与暗主教，保留性别及前置职业限制。'],
    ['abyssian_seal','地下转职证','Abyssian Exam Pass','seal',1,2000,'seal',0,'用于最上级 DLC 职业，Lv.30 起使用。'],
    ['dancer_seal','舞者转职证','Dancer Seal','seal',1,2000,'seal',0,'Lv.10 起取得舞者资格。本作设定。']
  ];
  supplies.forEach(([id,name,en,category,uses,price,action,power,effect])=>items.push({
    id,familyId:id,name,en,category,kind:category==='medicine'?'consumable':'seal',rank:null,
    uses,price,action,power,might:null,hit:null,crit:null,range:null,weight:0,protection:0,resilience:0,
    damageType:null,icon:id,edition:'base',rarity:'regular',tags:[category==='medicine'?'药品':'转职道具'],
    effect,source:'https://serenesforest.net/three-houses/weapons-and-items/consumables/',verifiedAt:'2026-11-13'
  }));
  function query(options) {
    const o=options||{}, q=(o.search||'').trim().toLowerCase();
    const result=items.filter(item=>(!o.category||o.category==='all'||item.category===o.category)&&(!o.edition||o.edition==='all'||item.edition===o.edition)&&(!o.rank||o.rank==='all'||item.rank===o.rank)&&(o.special!=='relic'||item.rarity==='relic')&&(o.special!=='magic'||item.damageType==='magic')&&(o.special!=='effective'||item.tags.some(t=>t.includes('特效')))&&(!q||[item.name,item.en,item.effect,...item.tags].join(' ').toLowerCase().includes(q.replace(/\+/g,'＋'))||item.en.toLowerCase().includes(q)));
    const rankOrder={E:0,D:1,C:2,B:3,A:4,S:5};
    return result.slice().sort((a,b)=>o.sort==='might'?(b.might??-1)-(a.might??-1):o.sort==='weight'?a.weight-b.weight:o.sort==='rank'?(rankOrder[a.rank]??6)-(rankOrder[b.rank]??6):0);
  }
  items.forEach(item=>{Object.freeze(item.tags);Object.freeze(item);});
  MyGO.Equipment=Object.freeze({categories:Object.freeze(categories),items:Object.freeze(items),query,get:id=>items.find(item=>item.id===id),family:id=>items.filter(item=>item.familyId===id),verifiedAt:'2026-11-10'});
})(window);
