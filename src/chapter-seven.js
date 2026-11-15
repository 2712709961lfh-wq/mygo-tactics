/* STARRY-inspired basement live house: full-enemy-clear and opening recruitment. */
(function(global){
 'use strict';const C=global.MyGO.CONFIG,cols=30,rows=28;
 const chars=(()=>{const a=Array.from({length:rows},()=>Array(cols).fill('p'));
  const rect=(x,y,w,h,t)=>{for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)a[j][i]=t;};
  rect(0,0,cols,2,'#');rect(0,rows-1,cols,1,'#');rect(0,0,2,rows,'#');rect(cols-2,0,2,rows,'#');
  rect(7,2,16,7,'r');rect(13,3,3,2,'#');rect(7,3,2,3,'#');rect(21,3,2,3,'#');
  rect(2,12,2,8,'#');rect(24,18,3,3,'#');rect(6,12,2,2,'#');rect(22,12,2,2,'#');
  for(const [x,y] of [[10,12],[19,12],[10,19],[19,19]])a[y][x]='#';
  a[23][5]='H';a[23][24]='H';return a.map(r=>r.join(''));
 })();
 const definitions=[
  ['blade','shadow_blade_1',9,18,'floor',6],['lance','shadow_lance',20,17,'floor',6],['axe','shadow_axe',6,19,'floor',6],['bow','shadow_bow',23,16,'floor',6],
  ['blade-w','shadow_blade_2',5,14,'west',6],['bow-w','shadow_bow',8,11,'west',6],['axe-w','shadow_axe',5,8,'west',6],['mage-w','conductor',10,9,'west',6],
  ['lance-e','shadow_lance',25,14,'east',6],['blade-e','shadow_blade_1',24,10,'east',6],['bow-e','shadow_bow',25,6,'east',6],['mage-e','conductor',19,10,'east',6],
  ['blade-stage','shadow_blade_2',10,6,'stage',7],['axe-stage','shadow_axe',19,6,'stage',7],['bow-stage','shadow_bow',12,3,'stage',7],['mage-stage','conductor',17,3,'stage',7],
  ['lance-stage','shadow_lance',14,7,'stage',7],['blade-stage-e','shadow_blade_1',21,8,'stage',7]
 ];
 const enemies=definitions.map(([id,base,x,y,guardGroup,guardRadius])=>({...C.UNITS.find(u=>u.id===base),id:'live-'+id,x,y,guardGroup:'live-'+guardGroup,guardRadius,
  level:9,boss:false,key:false,hpFloor:0,dormant:false,drops:[],carriedItems:[],facing:'down',
  name:'失真回声·'+(id.includes('mage')?'咒':base.includes('bow')?'弓':base.includes('axe')?'斧':base.includes('lance')?'枪':'剑'),shortName:'失真回声',
  ...(id.includes('mage')?{weapon:'miasma',spells:['miasma'],maxHp:24,str:3,mag:10,def:4,res:7}:{}),quote:'失真的噪音，正吞没整间演出厅。'}));
 C.NIJIKA={id:'nijika',name:'伊地知虹夏',shortName:'虹夏',gender:'女',side:'ally',classId:'monk',className:'修道士',level:9,
  maxHp:30,str:7,mag:11,dex:10,spd:11,lck:13,def:7,res:9,hit:0,move:4,tags:[],weapon:'nosferatu',spells:['nosferatu','heal'],x:14,y:20,facing:'up',
  quote:'谢谢你们回应我！我叫伊地知虹夏，这次就让我和大家一起守住这里吧。',
  art:{kind:'girl',hair:'#e6c455',hairDark:'#aa792f',hairStyle:'pony',outfit:'#30334a',outfitDark:'#1c2232',accent:'#9f3743',skin:'#f8dfc5',eye:'#a95931'}};
 // Add after level scaling so every foe gains exactly 17 panel points.
 // Physical units gain 13 effective points; magic units gain 12 (excluding STR).
 const enemyStatBonuses={
  sword:{maxHp:4,str:3,mag:4,dex:2,spd:2,lck:1,def:1},
  lance:{maxHp:4,str:3,mag:4,dex:1,spd:1,lck:1,def:2,res:1},
  axe:{maxHp:5,str:3,mag:4,dex:1,spd:1,lck:1,def:2},
  bow:{maxHp:3,str:3,mag:4,dex:3,spd:2,lck:1,def:1},
  magic:{maxHp:3,str:5,mag:3,dex:2,spd:1,lck:1,def:1,res:1}
 };
 C.STAGE_SEVEN={id:'mission-07',mapRevision:1,cols,rows,chapter:'MISSION 07',chapterJp:'第七话',chapterEn:'CHAPTER 07',enemyStatBonuses,
  title:'繁星之下的求援',mapName:'STARRY · 地下 Live House',
  subtitle:'熟悉的舞台传来失真的回响。独自走入 Live House 的虹夏，被突然现身的黑影包围，直到门口响起了回应。',
  objective:'击败全部敌人，夺回 Live House 的舞台',
  gateHint:'虹夏会在开场求助得到回应后立即入队。由南侧入口向舞台推进，利用左右通道绕过音箱箱体与立柱，逐组清除失真回声。补给点可休憩回血；舞台敌人也必须全部击败。',
  terrain:C.buildTerrainGrid(chars),mapChars:chars,enemies,enemyCount:enemies.length,bells:[],requiredBells:0,lamps:[],chests:[],turnLimit:0,
  spawns:{tomori:{x:13,y:23},anon:{x:14,y:24},rana:{x:15,y:23},soyo:{x:13,y:24},taki:{x:15,y:24},xueyue:{x:12,y:25},nina:{x:16,y:25}},
  decor:[{kind:'drums',x:14,y:4},{kind:'amp',x:7.5,y:5},{kind:'amp',x:21.5,y:5},{kind:'guitar',x:10,y:3},{kind:'guitar',x:19,y:3},
   ...[11,15,18].map(x=>({kind:'mic',x,y:6.5})),...[[9,7.8],[12,7.8],[17,7.8],[20,7.8]].map(([x,y])=>({kind:'monitor',x,y})),
   {kind:'bar',x:2.6,y:19},{kind:'mixdesk',x:25,y:20},
   ...[[10,12],[19,12],[10,19],[19,19]].map(([x,y])=>({kind:'pillar',x,y})),
   {kind:'cases',x:6.5,y:13},{kind:'cases',x:22.5,y:13},{kind:'exit',x:14.5,y:26.7}]};
 C.CHARACTER_STORIES.nijika='熟悉的地下舞台忽然挤满了陌生黑影。她没有把求助藏在心里，而是向门口的少女们伸出了手。得到回应之后，她也决定成为回应别人的那个人。';
 const previous=C.missionForStage;C.missionForStage=stage=>stage===7?C.STAGE_SEVEN:previous(stage);
})(window);
