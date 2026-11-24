/* FE3H normally learnable spells. Sources and adaptation notes: docs/INVENTORY-MAGIC.md. */
(function (global) {
  'use strict';
  const M = global.MyGO = global.MyGO || {};
  // id / 中文 / English / school / rank / uses / power / hit / crit / range / weight / element / effect
  const rows = [
    ['fire','火焰','Fire','black','E',10,3,90,0,'1-2',3,'fire'],
    ['bolganone','烈火','Bolganone','black','C',5,8,85,0,'1-2',6,'fire'],
    ['ragnarok','末世烈焰','Ragnarok','black','B',3,15,80,5,'1-2',9,'fire'],
    ['thunder','雷电','Thunder','black','E',8,4,80,5,'1-2',4,'thunder'],
    ['thoron','托隆','Thoron','black','C',4,9,75,10,'1-3',7,'thunder'],
    ['bolting','雷暴','Bolting','black','B',2,12,65,15,'3-10',18,'thunder','noFollowup'],
    ['wind','风刃','Wind','black','E',12,2,100,10,'1-2',2,'wind'],
    ['cutting_gale','烈风','Cutting Gale','black','C',6,7,95,10,'1-2',5,'wind'],
    ['excalibur','圣风','Excalibur','black','B',4,11,100,15,'1-2',8,'wind','flying'],
    ['blizzard','冰雪','Blizzard','black','E',10,3,70,15,'1-2',4,'ice'],
    ['fimbulvetr','芬布尔','Fimbulvetr','black','B',3,12,65,25,'1-2',10,'ice'],
    ['sagittae','箭雨','Sagittae','black','C',10,7,90,5,'1-2',6,'light'],
    ['meteor','陨石','Meteor','black','B',1,10,80,0,'3-10',19,'fire','noFollowup'],
    ['agneas_arrow','阿格尼尔之箭','Agnea’s Arrow','black','A',2,16,70,5,'1-2',13,'light'],
    ['miasma','瘴气 Δ','Miasma Δ','dark','E',10,5,80,0,'1-2',5,'dark'],
    ['mire','沼泽 Β','Mire Β','dark','E',8,3,70,0,'1-3',5,'dark','defDown'],
    ['swarm','虫群 Ζ','Swarm Ζ','dark','E',8,4,70,0,'1-2',4,'dark','spdDown'],
    ['banshee','魔女 Θ','Banshee Θ','dark','C',5,9,75,5,'1-2',9,'dark','moveDown'],
    ['death','死神 Γ','Death Γ','dark','C',4,6,70,20,'1-3',8,'dark'],
    ['luna','月神 Λ','Luna Λ','dark','C',2,1,65,0,'1-2',7,'dark','ignoreRes'],
    ['dark_spikes','黑暗尖刺 Τ','Dark Spikes Τ','dark','B',3,13,80,0,'1-2',11,'dark','cavalry'],
    ['hades','冥府 Ω','Hades Ω','dark','A',2,18,65,10,'1-2',16,'dark'],
    ['heal','圣疗','Heal','faith','E',10,8,100,0,'1',0,'light','heal'],
    ['recover','恢复','Recover','faith','C',5,30,100,0,'1',0,'light','heal'],
    ['physic','远程圣疗','Physic','faith','C',5,8,100,0,'mag/2',0,'light','heal'],
    ['fortify','全体圣疗','Fortify','faith','A',2,15,100,0,'mag/4',0,'light','fortify'],
    ['nosferatu','吸取','Nosferatu','faith','E',12,1,80,0,'1-2',8,'light','drain'],
    ['seraphim','天使','Seraphim','faith','C',8,8,75,5,'1-2',10,'light','monster'],
    ['aura','灵光','Aura','faith','B',3,12,70,20,'1-2',12,'light'],
    ['abraxas','阿布拉克萨斯','Abraxas','faith','A',2,14,90,5,'1-2',13,'light'],
    ['torch','照明','Torch','faith','E',10,0,100,0,'1-2',0,'light','torch'],
    ['restore','复原','Restore','faith','C',10,0,100,0,'mag/4',0,'light','restore'],
    ['ward','魔防支援','Ward','faith','C',5,0,100,0,'1',0,'light','ward'],
    ['silence','沉默','Silence','faith','B',3,0,100,0,'3-10',0,'light','silence'],
    ['rescue','救援','Rescue','faith','B',3,0,100,0,'mag/4',0,'light','rescue'],
    ['warp','传送','Warp','faith','B',1,0,100,0,'mag/4',0,'light','warp']
  ];
  const effects = {noFollowup:'不能追击。', flying:'对飞行特效（威力×3）。', cavalry:'对骑马特效（威力×3）。',monster:'对魔兽特效（威力×3）。',
    defDown:'命中后目标守备−5，持续到目标下次行动阶段结束。',spdDown:'命中后目标速度−5，持续到目标下次行动阶段结束。',moveDown:'命中后目标移动−5，持续到目标下次行动阶段结束。',
    ignoreRes:'无视魔防，不能追击。',drain:'回复实际伤害的50%（向下取整）。',heal:'治疗量＝威力＋⌊魔力/3⌋。',fortify:'治疗范围内全体友军。',
    restore:'清除范围内友军的负面状态。',ward:'友军魔防＋7，每个己方阶段开始衰减1。',silence:'使敌人无法使用魔法，持续到目标下次行动阶段结束。',
    rescue:'将范围内一名友军拉至施法者身旁的空格。',warp:'将相邻友军传送至施法者魔力/4范围内的空格。',torch:'用于战争迷雾；当前两章全图可见，无需施放。'};
  const colors = {fire:'#ed7955',thunder:'#e8c85d',wind:'#73c99d',ice:'#8cd3ed',dark:'#b399de',light:'#f4deb0'};
  const names = {fire:'火',thunder:'雷',wind:'风',ice:'冰',dark:'暗',light:'光'};
  const support = ['heal','fortify','restore','ward','silence','rescue','warp','torch'];
  const items = rows.map(([id,name,en,school,rank,uses,might,hit,crit,rangeText,weight,element,effect])=>Object.freeze({
    id,name,en,school,rank,uses,might,hit,crit,rangeText,weight,element,effect:effect||'',
    description:effects[effect]||'以魔力攻击目标魔防。',kind:'spell',type:'tome',damageType:'magic',
    elementName:names[element],color:colors[element],support:support.includes(effect),
    noFollowup:effect==='noFollowup'||effect==='ignoreRes',ignoreRes:effect==='ignoreRes',
    effectiveAgainst:['flying','cavalry','monster'].includes(effect)?[effect]:[],effectiveMultiplier:3,
    range:rangeText.includes('mag')?[1,1]:rangeText.split('-').map(Number).concat(rangeText.includes('-')?[]:[+rangeText]),
    source:school==='faith'?'https://serenesforest.net/three-houses/weapons-and-items/white-magic/':'https://serenesforest.net/three-houses/weapons-and-items/black-dark-magic/'
  }));
  // The former shared table is retained only to validate old saves.
  // Live character-level progression uses personalLearning below.
  const learning=Object.freeze([
    [5,'fire'],[5,'heal'],[8,'wind'],[10,'thunder'],[12,'physic'],[15,'bolganone'],
    [18,'restore'],[20,'thoron'],[23,'ward'],[25,'recover'],[28,'ragnarok'],
    [30,'rescue'],[32,'fortify'],[35,'warp']
  ].map(([level,id])=>Object.freeze({level,id})));
  const personalLearning=Object.freeze(Object.fromEntries(Object.entries({
    soyo:[[5,'fire'],[5,'heal'],[8,'torch'],[9,'thunder'],[12,'nosferatu'],[12,'wind'],[18,'bolganone'],[21,'excalibur'],[23,'fimbulvetr'],[26,'meteor'],[28,'ragnarok'],[32,'agneas_arrow']],
    nijika:[[5,'heal'],[5,'nosferatu'],[10,'torch'],[12,'physic'],[15,'ward'],[18,'restore'],[18,'thoron'],[22,'recover'],[22,'seraphim'],[22,'rescue'],[25,'aura'],[25,'silence'],[26,'fortify'],[26,'bolting'],[28,'warp'],[33,'abraxas']],
    subaru:[[5,'heal'],[5,'miasma'],[8,'nosferatu'],[12,'ward'],[14,'banshee'],[16,'physic'],[18,'dark_spikes'],[20,'seraphim'],[24,'death'],[25,'luna'],[27,'fimbulvetr'],[35,'hades']],
    tomori:[],
    anon:[],
    rana:[],
    taki:[],
    xueyue:[],
    nina:[]
  }).map(([id,rows])=>[id,Object.freeze(rows.map(([level,id])=>Object.freeze({level,id})))])));
  const noLearning=Object.freeze([]);
  function learningFor(u){const id=typeof u==='string'?u:u?.id;return u?.side==='enemy'?noLearning:personalLearning[id]||noLearning;}
  M.Magic = Object.freeze({items:Object.freeze(items),learning,personalLearning,learningFor,get:id=>items.find(s=>s.id===id),
    rangeOf:(s,u)=>{const r=s.rangeText.includes('mag/')?[1,Math.max(1,Math.floor(u.mag/Number(s.rangeText.split('/')[1])))]:s.range.slice();r[1]+=M.Talents?.rangeBonus(u,s)||0;return r;},
    healAmount:(s,u)=>{const amount=s.might+Math.floor(u.mag/3)+(u.gear?.heal||0);return M.Talents?.healingAmount(u,s,amount)??amount;},
    schoolName:s=>({black:'理学 · 黑魔法',dark:'理学 · 暗魔法',faith:'信仰 · 白魔法'}[s.school])});
})(window);
