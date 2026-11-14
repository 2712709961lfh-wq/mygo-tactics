/* A second moonlit village, laid out as a southbound rescue rather than bell visits. */
(function(global){
  'use strict';
  const C=global.MyGO.CONFIG;
  const decor=[
    {kind:'house',x:8,y:5,w:4,h:3,roof:'lavender'},
    {kind:'house',x:28,y:4,w:4,h:3,roof:'blue'},
    {kind:'house',x:4,y:14,w:4,h:3,roof:'rose'},
    {kind:'house',x:29,y:14,w:4,h:3,roof:'lavender'},
    {kind:'house',x:9,y:24,w:4,h:3,roof:'blue'},
    {kind:'house',x:29,y:25,w:4,h:3,roof:'rose'}
  ];
  const chars=(()=>{
    const a=Array.from({length:30},()=>Array(40).fill('.'));
    const rect=(x,y,w,h,t)=>{for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)a[j][i]=t;};
    rect(0,0,40,1,'f');rect(0,29,40,1,'f');rect(0,0,1,30,'f');rect(39,0,1,30,'f');
    for(const r of [[2,2,4,5],[14,3,2,4],[34,2,4,7],[3,21,3,6],[34,20,4,7],
      [11,10,3,5],[25,9,3,4],[9,19,4,3],[27,20,2,4],[15,26,3,3],[23,27,4,2]])rect(...r,'f');
    // The two ponds split the descent into a fast exposed avenue and covered side routes.
    rect(5,9,4,3,'w');rect(30,9,4,3,'w');rect(14,17,3,3,'w');rect(24,16,3,3,'w');
    rect(18,2,4,23,'r');rect(9,9,22,2,'r');rect(8,10,2,14,'r');rect(29,10,2,15,'r');
    rect(8,22,23,2,'r');rect(17,3,6,4,'p');rect(17,19,7,6,'p');
    rect(15,12,2,2,'#');rect(23,12,2,2,'#');rect(17,26,1,2,'#');rect(23,26,1,2,'#');
    for(const d of decor)rect(d.x,d.y,d.w,d.h,'#');
    for(const [x,y] of [[13,9],[27,13],[18,17]])a[y][x]='H';
    return a.map(r=>r.join(''));
  })();
  const enemies=[
    ['dream_sentry_w','shadow_blade_1',16,8,'avenue',5],
    ['dream_sentry_e','shadow_lance',24,8,'avenue',5],
    ['dream_bow_n','shadow_bow',20,10,'avenue',5],
    ['dream_axe_w','shadow_axe',9,12,'west',4],
    ['dream_blade_w','shadow_blade_1',10,18,'west',4],
    ['dream_bow_w','shadow_bow',5,19,'west',4],
    ['dream_mage_w','shadow_blade_1',13,16,'west',4],
    ['dream_lance_e','shadow_lance',30,12,'east',4],
    ['dream_blade_e','shadow_blade_2',28,18,'east',4],
    ['dream_bow_e','shadow_bow',34,18,'east',4],
    ['dream_mage_e','shadow_blade_1',27,14,'east',4],
    ['dream_axe_mid','shadow_axe',18,15,'avenue',5],
    ['dream_lance_mid','shadow_lance',22,15,'avenue',5],
    ['siege_blade','shadow_blade_1',19,22,'siege',0],
    ['siege_lance','shadow_lance',22,22,'siege',0],
    ['siege_bow','shadow_bow',20,25,'siege',0],
    ['siege_axe','shadow_axe',16,24,'south',4],
    ['siege_blade_s','shadow_blade_2',25,24,'south',4],
    ['siege_bow_s','shadow_bow',26,27,'south',4],
    ['siege_mage_s','shadow_blade_1',15,27,'south',4],
    ['dream_lance_sw','shadow_lance',7,27,'west',4],
    ['dream_axe_se','shadow_axe',34,26,'east',4],
    ['dream_guard_s','shadow_blade_2',21,27,'south',4],
    ['dream_warden','conductor',20,28,'south',5]
  ].map(([id,base,x,y,guardGroup,guardRadius])=>({
    ...C.UNITS.find(u=>u.id===base),id,x,y,guardGroup,guardRadius,level:7,
    dormant:false,key:false,boss:id==='dream_warden',facing:'up',
    ...(id.includes('mage')?{name:'迷梦回声·咒',shortName:'梦咒',className:'迷梦术士',
      weapon:'miasma',spells:['miasma'],maxHp:22,str:3,mag:8,res:6}:{}),
    ...(id==='dream_warden'?{name:'迷梦的看守',shortName:'看守',maxHp:30,mag:10,weapon:'fire',spells:['fire'],
      quote:'醒来的人，也必须留在梦里。'}:{}),
    ...(guardGroup==='siege'?{str:7,maxHp:18,dex:8,lck:0}:{}),
  }));
  C.NINA={id:'nina',name:'井芹仁菜',shortName:'仁菜',side:'ally',classId:'fighter',className:'战士',
    gender:'女',level:7,maxHp:36,str:12,mag:2,dex:10,spd:10,lck:7,def:8,res:3,hit:0,move:4,
    weapon:'iron_gauntlets',x:20,y:22,facing:'left',guardRadius:0,
    quote:'明明只是睡了一觉……这里到底是哪？你们也是被带到这里的吗？',
    art:{kind:'girl',hair:'#523749',hairDark:'#302332',hairStyle:'short',outfit:'#263446',
      outfitDark:'#14202d',accent:'#b2748b',skin:'#f3cdb1',eye:'#507d9c'}};
  C.STAGE_THREE={cols:40,rows:30,enemyCount:enemies.length,mapRevision:1,id:'mission-03',
    chapter:'MISSION 03',chapterJp:'第三话',chapterEn:'CHAPTER 03',title:'梦醒的呼救',mapName:'月下蔷薇街',
    subtitle:'从睡梦中睁眼的少女，被陌生的怪物围在花镇南端。她挥起双拳时，看见了赶来的 MyGO。',
    objective:'击败全部敌人；救下井芹仁菜可招募她（仁菜阵亡仍可通关，但永久失去招募机会）',
    gateHint:'我方从北部中央出发，仁菜在南部中央独自迎敌。第四回合南部围兵全面逼近；中央大道最快，左右花巷可绕侧翼，辅助治疗可以支援友军。',
    turnLimit:0,bells:[],requiredBells:0,terrain:C.buildTerrainGrid(chars),mapChars:chars,decor,
    spawns:{tomori:{x:19,y:4,facing:'down'},anon:{x:20,y:3,facing:'down'},
      rana:{x:21,y:4,facing:'down'},soyo:{x:19,y:5,facing:'down'},
      taki:{x:21,y:5,facing:'down'},xueyue:{x:20,y:6,facing:'down'}},enemies};
  C.CHARACTER_STORIES.nina='现实里的最后记忆，只是一次普通的入睡。再睁眼时，陌生的花镇和怪物将她团团围住。她一边挥拳抵抗，一边发现了正在赶来的 MyGO。她还不知道回去的路，但至少不必再独自面对这一切。';
  C.missionForStage=stage=>stage===3?C.STAGE_THREE:stage===2?C.STAGE_TWO:C.MISSION;
})(window);
