/* Fire Emblem: Three Houses playable class catalogue.
 * Certification skills reference the original; tiers and the dancer's token
 * follow this game's catalogue settings. DLC classes use master tier Lv.30.
 * Ordinary certification uses level + seal; special prerequisites remain.
 * Certified classes can be reused. See docs/CLASSES.md for reference boundaries.
 */
(function (global) {
  'use strict';
  const M = global.MyGO = global.MyGO || {};
  const tiers = Object.freeze([
    {id:'base', name:'特殊初始', level:1},
    {id:'beginner', name:'初级', level:5},
    {id:'intermediate', name:'中级', level:10},
    {id:'advanced', name:'高级', level:20},
    {id:'master', name:'最上级', level:30}
  ].map(Object.freeze));
  // id, Chinese label, English label, certification skills / unlock condition,
  // teaching specialties, base movement, magic availability, gender restriction.
  const rows = {
    base: [
      ['commoner','平民','Commoner','初始职业','无',4,true],
      ['noble','贵族','Noble','初始职业','无',4,true]
    ],
    beginner: [
      ['myrmidon','剑客','Myrmidon','剑术 D','剑',4,false],
      ['soldier','士兵','Soldier','枪术 D','枪',4,false],
      ['fighter','战士','Fighter','斧术 / 弓术 / 格斗术任一 D','斧、弓、格斗',4,false],
      ['monk','修道士','Monk','理学 / 信仰任一 D','理学、信仰',4,true]
    ],
    intermediate: [
      ['dancer','舞者','Dancer','舞者转职证','剑、指挥',6,true],
      ['mercenary','佣兵','Mercenary','剑术 C','剑、斧',5,false],
      ['thief','盗贼','Thief','剑术 C','剑、弓',5,false],
      ['armored_knight','重骑士','Armored Knight','斧术 C、重装 D','枪、斧、重装',4,false],
      ['cavalier','战马骑士','Cavalier','枪术 C、马术 D','剑、枪、马术',7,false],
      ['brigand','土匪','Brigand','斧术 C','斧、格斗',5,false],
      ['archer','弓箭手','Archer','弓术 C','剑、弓',5,false],
      ['brawler','拳斗士','Brawler','格斗术 C','斧、格斗',5,false,'男'],
      ['mage','术师','Mage','理学 C','理学、信仰',4,true],
      ['dark_mage','暗术师','Dark Mage','理学 C；消耗暗魔法准考证','理学、信仰',4,true,'男'],
      ['priest','牧师','Priest','信仰 C','理学、信仰',4,true],
      ['pegasus_knight','飞马骑士','Pegasus Knight','枪术 C、飞行 D','剑、枪、飞行',6,false,'女']
    ],
    advanced: [
      ['hero','勇者','Hero','剑术 B、斧术 C','剑、斧',5,false,'男'],
      ['swordmaster','刀剑将领','Swordmaster','剑术 A','剑',5,false],
      ['assassin','暗杀者','Assassin','剑术 B、弓术 C','剑、弓',6,false],
      ['fortress_knight','要塞','Fortress Knight','斧术 B、重装 B','枪、斧、重装',4,false],
      ['paladin','圣骑士','Paladin','枪术 B、马术 B','剑、枪、马术',8,false],
      ['wyvern_rider','飞龙骑士','Wyvern Rider','斧术 B、飞行 C','枪、斧、飞行',7,false],
      ['warrior','勇士','Warrior','斧术 A','斧',5,false],
      ['sniper','狙击手','Sniper','弓术 A','弓',5,false],
      ['grappler','综合格斗家','Grappler','格斗术 A','格斗',6,false,'男'],
      ['warlock','术士','Warlock','理学 A','理学、信仰',4,true],
      ['dark_bishop','暗主教','Dark Bishop','理学 A；已取得暗术师资格；消耗暗魔法准考证','理学、信仰',4,true,'男'],
      ['bishop','主教','Bishop','信仰 A','理学、信仰',4,true]
    ],
    master: [
      ['falcon_knight','圣飞马骑士','Falcon Knight','剑术 C、枪术 A、飞行 B+','剑、枪、飞行',8,false,'女'],
      ['wyvern_lord','飞龙将领','Wyvern Lord','枪术 C、斧术 A、飞行 A','枪、斧、飞行',8,false],
      ['mortal_savant','墓志','Mortal Savant','剑术 A、理学 B+','剑、理学',6,true],
      ['great_knight','英勇骑士','Great Knight','斧术 B+、重装 A、马术 B+','枪、斧、重装',7,false],
      ['bow_knight','弓骑士','Bow Knight','枪术 C、弓术 A、马术 A','枪、弓、马术',8,false],
      ['dark_knight','黑暗骑士','Dark Knight','枪术 C、理学 B+、马术 A','枪、理学、马术',7,true],
      ['holy_knight','神圣骑士','Holy Knight','枪术 C、信仰 B+、马术 A','枪、信仰、马术',7,true],
      ['gremory','格莫瑞','Gremory','理学 A、信仰 A','理学、信仰',5,true,'女'],
      ['war_master','战争将领','War Master','斧术 A、格斗术 A','斧、格斗',6,false,'男'],
      ['trickster','诈术师','Trickster','剑术 B、信仰 B；已取得盗贼资格','剑、信仰',5,true],
      ['war_monk','战争僧侣','War Monk','格斗术 B+、信仰 C+','斧、格斗、信仰',6,true,'男'],
      ['war_cleric','战争修女','War Cleric','格斗术 B+、信仰 C+','斧、格斗、信仰',6,true,'女'],
      ['dark_flier','暗天马骑士','Dark Flier','理学 B+、飞行 C','剑、理学、飞行',7,true,'女'],
      ['valkyrie','瓦尔基里','Valkyrie','理学 B、马术 B','理学、信仰、马术',6,true,'女']
    ]
  };
  const dlc = new Set(['trickster','war_monk','war_cleric','dark_flier','valkyrie']);
  const cavalry = new Set(['cavalier','paladin','great_knight','bow_knight','dark_knight','holy_knight','valkyrie']);
  const flying = new Set(['pegasus_knight','wyvern_rider','falcon_knight','wyvern_lord','dark_flier']);
  const armored = new Set(['armored_knight','fortress_knight','great_knight']);
  const sealFor=(id,tier)=>id==='dancer'?'dancer_seal':['dark_mage','dark_bishop'].includes(id)?'dark_seal':dlc.has(id)?'abyssian_seal':({beginner:'beginner_seal',intermediate:'intermediate_seal',advanced:'advanced_seal',master:'master_seal'}[tier]||null);
  const sealNames={beginner_seal:'初级转职证',intermediate_seal:'中级转职证',advanced_seal:'高级转职证',master_seal:'最上级转职证',dark_seal:'暗魔法转职证',abyssian_seal:'地下转职证',dancer_seal:'舞者转职证'};
  const items = Object.freeze(tiers.flatMap(tier => rows[tier.id].map(row => Object.freeze({
    id:row[0], name:row[1], en:row[2], tier:tier.id, tierName:tier.name,
    minLevel:tier.level, referenceRequirements:row[3],
    seal:sealFor(row[0],tier.id), prerequisite:row[0]==='dark_bishop'?'dark_mage':row[0]==='trickster'?'thief':null,
    requirements:row[0]==='dancer'?'舞者转职证':tier.id==='base'?'初始职业，无需转职证':'Lv.'+tier.level+' · '+sealNames[sealFor(row[0],tier.id)]+(row[0]==='dark_bishop'?' · 需暗术师资格':row[0]==='trickster'?' · 需盗贼资格':''),
    specialties:row[4], move:row[5],
    magic:row[6], gender:row[7] || null, dlc:dlc.has(row[0]),
    movement:flying.has(row[0])?'飞行':cavalry.has(row[0])?'骑乘':'步行',
    tags:Object.freeze([...(cavalry.has(row[0])?['cavalry']:[]),...(flying.has(row[0])?['flying']:[]),...(armored.has(row[0])?['armor']:[])])
  }))));
  const byId = new Map(items.map(item => [item.id, item]));
  const paths = Object.freeze({
    tomori:'剑客 → 佣兵 / 盗贼 → 刀剑将领 / 暗杀者',
    anon:'战士 → 弓箭手 → 狙击手 → 弓骑士',
    rana:'士兵 → 战马骑士 / 飞马骑士 → 圣骑士 / 飞龙骑士',
    soyo:'修道士 → 术师 / 牧师 → 术士 / 主教 → 格莫瑞',
    taki:'战士 → 土匪 → 勇士 → 飞龙将领',
    xueyue:'剑客 → 佣兵 / 盗贼 → 刀剑将领 / 暗杀者'
  });
  function apply(u,id){
    const job=byId.get(id);if(!job)throw Error('未知职业');
    u.classId=id;u.className=job.name;u.move=job.move;
    u.tags=u.tags.filter(t=>!['armor','flying','cavalry'].includes(t)).concat(job.tags);
    const names={sword:'剑',lance:'枪',axe:'斧',bow:'弓',gauntlet:'格斗'};
    u.weaponTypes=Object.keys(names).filter(k=>job.specialties.split('、').includes(names[k]));
    if(!u.weaponTypes.length)u.weaponTypes=['sword'];
    u.certifiedClasses=u.certifiedClasses||[];
    if(!u.certifiedClasses.includes(id))u.certifiedClasses.push(id);
    M.Inventory.learn(u);M.Inventory.sync(u);
  }
  function restore(u,s){
    u.certifiedClasses=[u.classId].filter(Boolean);
    if(!s)return;
    if(s.version!==1||!Array.isArray(s.certified)||new Set(s.certified).size!==s.certified.length)throw Error('存档职业资格无效');
    if(!u.classId){if(s.id!==null||s.certified.length)throw Error('存档职业无效');return;}
    for(const id of s.certified){const job=byId.get(id);
      if(!job||u.level<job.minLevel||job.gender&&job.gender!==u.gender||job.prerequisite&&!s.certified.includes(job.prerequisite))throw Error('存档职业资格无效');
    }
    if(!s.certified.includes(s.id))throw Error('存档职业资格缺失');
    u.certifiedClasses=s.certified.slice();
    // Preserve the original weapon specialism for units that have never changed class.
    if(s.id!==u.classId||s.certified.length>1)apply(u,s.id);
  }
  M.Classes = Object.freeze({tiers, items, paths,apply,restore,
    get:id => byId.get(id) || null,
    query:tier => items.filter(item => !tier || item.tier === tier)
  });
})(window);
