/* Chapter 4: a modern park, with permanent lamplight and moving party vision. */
(function(global){
  'use strict';
  const C=global.MyGO.CONFIG;
  const lamps=[
    {id:'park-entry',name:'入口步道',x:7,y:12,sound:'东北方向传来断断续续的低语，像是在恳求谁留下。'},
    {id:'park-flowers',name:'花圃转角',x:13,y:10,sound:'声音越过花丛，从偏东方传来；脚下的步道仍伸向黑暗。'},
    {id:'park-pond',name:'池塘北岸',x:19,y:8,sound:'东南方向的水面送来回声：“不要……丢下我……”'},
    {id:'park-fork',name:'林间岔路',x:24,y:12,sound:'东方的树影后又响起那个声音，比先前更清晰了。'},
    {id:'park-bench',name:'长椅广场',x:29,y:16,sound:'东北方向的池水边，熟悉的哭腔被风吹来。'},
    {id:'park-echo',name:'回声池畔',x:34,y:12,sound:'声音就在东北方向近处：“只要大家回来……”'}
  ];
  const route=[[3,13],[10,13],[10,9],[22,9],[22,15],[32,15],[32,10],[36,10]];
  const decor=[
    ...[[6,10],[10,16],[16,7],[21,11],[26,14],[30,18],[35,14]].map(([x,y])=>({kind:'bench',x,y})),
    ...[[4,7],[9,19],[15,14],[18,5],[26,6],[28,20],[35,18]].map(([x,y])=>({kind:'flowerbed',x,y})),
    ...lamps.map((l,i)=>({...l,kind:'lamp',number:i+1})),
    {kind:'sign',x:5,y:14,label:'池畔步道 →'},
    {kind:'sign',x:15,y:10,label:'北岸 ↑'},
    {kind:'sign',x:24,y:15,label:'池畔广场 →'},
    {kind:'sign',x:33,y:10,label:'池畔休憩区'}
  ];
  const chars=(()=>{
    const a=Array.from({length:26},()=>Array(40).fill('.'));
    const rect=(x,y,w,h,t)=>{for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)a[j][i]=t;};
    rect(0,0,40,1,'#');rect(0,25,40,1,'#');rect(0,0,1,26,'#');rect(39,0,1,26,'#');
    // Pond footprints leave wide, connected walks on both banks.
    for(let y=11;y<=19;y++)for(let x=13;x<=20;x++)
      if(((x-16.5)/4.6)**2+((y-15)/4.8)**2<1)a[y][x]='w';
    for(let y=4;y<=8;y++)for(let x=29;x<=35;x++)
      if(((x-32)/4)**2+((y-6)/2.8)**2<1)a[y][x]='w';
    for(const r of [[2,2,6,3],[3,20,4,3],[10,4,3,3],[9,20,5,3],[23,3,3,4],
      [23,19,3,4],[34,20,4,3],[36,3,2,4]])rect(...r,'f');
    for(let i=1;i<route.length;i++){
      const [x,y]=route[i-1],[xx,yy]=route[i];
      rect(Math.min(x,xx),Math.min(y,yy),Math.abs(xx-x)+2,Math.abs(yy-y)+2,'r');
    }
    rect(1,11,5,6,'p');rect(27,14,5,4,'p');rect(34,9,4,4,'p');
    for(const [x,y] of [[9,17],[25,9]])a[y][x]='H';
    for(const l of lamps)a[l.y][l.x]='r';
    return a.map(r=>r.join(''));
  })();
  const enemies=[
    ['park-blade-1','shadow_blade_1',10,12,'entry'],
    ['park-bow-1','shadow_bow',12,8,'entry'],
    ['park-lance-1','shadow_lance',16,9,'north'],
    ['park-mage-1','conductor',21,7,'north'],
    ['park-blade-2','shadow_blade_2',23,11,'fork'],
    ['park-axe-1','shadow_axe',25,14,'fork'],
    ['park-bow-2','shadow_bow',27,17,'square'],
    ['park-lance-2','shadow_lance',31,16,'square'],
    ['park-mage-2','conductor',33,13,'echo'],
    ['park-blade-3','shadow_blade_2',35,10,'echo'],
    ['park-axe-2','shadow_axe',36,16,'echo'],
    ['park-bow-3','shadow_bow',22,20,'south']
  ].map(([id,base,x,y,guardGroup])=>({
    ...C.UNITS.find(u=>u.id===base),id,x,y,guardGroup,guardRadius:7,level:8,
    name:base==='conductor'?'失声幻影·咒':'失声幻影·'+({shadow_bow:'弓',shadow_lance:'枪',shadow_axe:'斧'}[base]||'刃'),
    shortName:base==='conductor'?'影咒':'幻影',dormant:false,boss:false,key:false,
    ...(base==='conductor'?{maxHp:24,mag:10,weapon:'miasma',spells:['miasma'],expClassBase:30}:{}),
    facing:'left',quote:'……不要……丢下我……'
  })).map(u=>({...u,maxHp:u.maxHp+4,str:u.str+1,mag:(u.mag||0)+1,spd:u.spd+1
  }));
  enemies.push({...C.UNITS.find(u=>u.id==='conductor'),id:'dark_soyo',
    name:'往日之影长崎爽世',shortName:'往日之影',className:'执念的幻影',level:10,
    maxHp:54,str:5,mag:16,dex:13,spd:10,lck:6,def:7,res:10,move:3,
    x:36,y:10,boss:true,dormant:false,key:false,guardGroup:'phantom',guardRadius:3,
    weapon:'miasma',spells:['miasma'],facing:'left',
    quote:'欧内该，瓦达西……不要再丢下我。只要大家回来，一切都能重新开始……'});
  C.STAGE_FOUR={cols:40,rows:26,id:'mission-04',mapRevision:1,enemyCount:enemies.length,
    chapter:'MISSION 04',chapterJp:'第四话',chapterEn:'CHAPTER 04',title:'飞鸟山公园的往日之影',mapName:'飞鸟山公园',
    subtitle:'欧内该，瓦达西……灯光熄灭的瞬间，爽世又听见了那个不愿回想的自己。',
    objective:'找到发出声音的神秘幻影，并击败它',
    gateHint:'在有限视野中寻找路灯，靠近 1 格后消耗行动点亮。点灯后留意声音传来的大致方向，也要提防黑暗中被灯声惊动的巡猎者。由长崎爽世亲手击败幻影，本次击破经验翻倍。',
    huntTurns:{entry:2,south:3,north:4,fork:6,square:8,echo:10},lampNoiseRadius:10,
    lamps,route,visionRadius:3.6,lampRadius:6,turnLimit:0,bells:[],requiredBells:0,
    terrain:C.buildTerrainGrid(chars),mapChars:chars,decor,enemies,
    spawns:{tomori:{x:3,y:12},anon:{x:2,y:13},rana:{x:3,y:14},soyo:{x:3,y:13},
      taki:{x:2,y:15},xueyue:{x:4,y:15},nina:{x:2,y:12}}};
  const previous=C.missionForStage;
  C.missionForStage=stage=>stage===4?C.STAGE_FOUR:previous(stage);
})(window);
