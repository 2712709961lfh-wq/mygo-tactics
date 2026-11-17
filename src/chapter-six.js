/* The lamp court: a long park avenue, proximity reinforcements and an escaping boss. */
(function(global){
  'use strict';
  const C=global.MyGO.CONFIG,cols=30,rows=46;
  const palaceLamps=[];
  for(const y of [2,5,8])for(const x of [5,8,11,18,21,24])palaceLamps.push({id:'court-light-'+x+'-'+y,name:'宫廷立灯',x,y,kind:'palaceLamp'});
  const lamps=[[10,13],[19,13],[9,20],[20,20],[10,28],[19,28],[10,36],[19,36],[12,41],[17,41]].map(([x,y],i)=>({id:'avenue-light-'+i,name:'公园路灯',x,y,kind:'lamp'}));
  const chars=(()=>{
    const a=Array.from({length:rows},()=>Array(cols).fill('.'));
    const rect=(x,y,w,h,t)=>{for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)a[j][i]=t;};
    rect(0,0,cols,1,'#');rect(0,rows-1,cols,1,'#');rect(0,0,1,rows,'#');rect(cols-1,0,1,rows,'#');
    rect(4,1,22,9,'p');rect(12,9,6,34,'r');rect(9,37,12,6,'p');
    for(const y of [16,26,34])rect(6,y,18,3,'r');
    for(const y of [12,22]){rect(3,y,5,6,'w');rect(22,y,5,6,'w');}
    for(const y of [10,19,30,39]){rect(2,y,4,4,'f');rect(24,y,4,4,'f');}
    for(const y of [14,23,31]){rect(9,y,2,3,'f');rect(19,y,2,3,'f');}
    a[29][12]='H';a[19][17]='H';a[10][14]='r';
    return a.map(r=>r.join(''));
  })();
  const base=C.UNITS.find(u=>u.id==='conductor');
  const boss={...base,id:'masked_stranger',name:'神秘面具人',shortName:'面具人',className:'暗幕召唤者',art:'masked-stranger',
    side:'enemy',level:10,maxHp:52,str:3,mag:13,dex:13,spd:8,lck:5,def:6,res:8,move:0,tags:[],weapon:'miasma',spells:['miasma'],
    x:14,y:4,boss:true,hpFloor:1,key:false,dormant:false,guardGroup:'throne',guardRadius:0,facing:'down',quote:'走近一点。让我看看，你们能挣扎到哪里。'};
  const initial=[['avenue-sentry-blade','shadow_blade_1',12,33],['avenue-sentry-bow','shadow_bow',18,30]].map(([id,source,x,y])=>({
    ...C.UNITS.find(u=>u.id===source),id,x,y,name:'暗庭巡守',shortName:'巡守',level:8,boss:false,dormant:false,key:false,guardGroup:'avenue',guardRadius:5,facing:'down'}));
  const recipes=[['shadow_blade_1','court-armor-n','court-pegasus-guard-n'],
    ['shadow_bow','court-pegasus-guard-n','court-armor-n','shadow_axe'],
    ['court-armor-n','court-pegasus-guard-n','conductor','shadow_lance'],
    ['court-armor-n','court-pegasus-guard-n','court-pegasus-guard-n','shadow_blade_2','shadow_bow']];
  const waves=recipes.map((recipe,i)=>({id:'mask-wave-'+(i+1),threshold:[32,25,18,11][i],
    name:['林荫道的试探','池畔的包围','长阶前的暗潮','王座的最后帷幕'][i],
    enemies:recipe.map((source,j)=>{
      const t=(source.startsWith('court-')?C.STAGE_FIVE.enemies:C.UNITS).find(u=>u.id===source);
      return {...t,id:'mask-summon-'+(i+1)+'-'+(j+1),level:8,boss:false,key:false,drops:[],carriedItems:[],dormant:false,
        name:t.tags?.includes('armor')?'暗幕重装兵':t.tags?.includes('flying')?'暗幕天马骑士':source==='conductor'?'暗幕咒师':'暗幕幻兵',
        shortName:t.tags?.includes('armor')?'重装兵':t.tags?.includes('flying')?'天马':'幻兵',
        ...(source==='conductor'?{weapon:'miasma',spells:['miasma'],maxHp:23,mag:9}:{}),
        x:14+(j%3),y:7+i*2,guardRadius:0,guardGroup:'summoned',facing:'down',quote:'应暗幕之召，阻断前路。'};
    })}));
  // Fixed chapter-six bonuses, including every summon wave. Keep original
  // HP ceilings for old-save wounds and the boss's one-HP retreat state.
  const enemyStatBonuses={
    armor:{str:2,mag:5,dex:2,lck:1,def:1,res:1},
    flying:{str:2,mag:4,dex:2,spd:2,lck:1,res:1},
    sword:{str:2,mag:4,dex:1,spd:2,def:1,lck:1,res:1},
    axe:{str:2,mag:5,dex:2,spd:1,def:1,lck:1},
    bow:{str:2,mag:5,dex:2,spd:1,lck:1,def:1},
    lance:{str:2,mag:4,dex:1,spd:1,def:2,lck:1,res:1},
    magic:{str:4,mag:3,dex:1,spd:1,lck:1,def:1,res:1},
    boss:{mag:3,dex:2,spd:1,def:1,res:5}
  };
  C.STAGE_SIX={id:'mission-06',mapRevision:1,cols,rows,chapter:'MISSION 06',chapterJp:'第六话',chapterEn:'CHAPTER 06',enemyStatBonuses,
    title:'灯庭王座与无名面具',mapName:'飞鸟山公园·北端灯庭',
    subtitle:'公园的尽头，十八盏宫廷立灯围着一张王座。面具后的目光，正等待众人踏入她的召唤阵。',
    objective:'穿过召唤包围，逼退王座上的神秘面具人',
    gateHint:'沿中央林荫道向北推进。初始仅两名巡守；越过四个区段后，面具人会在敌方阶段于队伍附近召唤混合援军，每轮最多一波，现身当轮不行动。重装怕魔法，天马怕弓。把面具人压至1 HP即可迫使她传送离开，无需消灭全部召唤物。',
    mapChars:chars,terrain:C.buildTerrainGrid(chars),lamps:lamps.concat(palaceLamps),lampRadius:4,
    bells:[],requiredBells:0,chests:[],turnLimit:0,throne:{x:14,y:4},waves,
    enemies:initial.concat(boss),summonTemplates:waves.flatMap(w=>w.enemies),enemyCount:3+waves.reduce((n,w)=>n+w.enemies.length,0),
    decor:[...lamps,...palaceLamps,{kind:'throne',x:14,y:4},
      ...[[8,13],[21,13],[7,27],[22,27],[8,36],[21,36]].map(([x,y])=>({kind:'bench',x,y})),
      ...[[7,9],[22,9],[8,21],[21,21],[8,32],[21,32],[7,40],[22,40]].map(([x,y])=>({kind:'flowerbed',x,y})),
      {kind:'sign',x:18,y:35,label:'北端灯庭 ↑'},{kind:'sign',x:18,y:19,label:'王座长阶 ↑'}],
    spawns:{tomori:{x:14,y:38},anon:{x:13,y:39},rana:{x:15,y:38},soyo:{x:14,y:39},taki:{x:15,y:40},xueyue:{x:13,y:40},nina:{x:15,y:39}}};
  const previous=C.missionForStage;C.missionForStage=stage=>stage===6?C.STAGE_SIX:previous(stage);
})(window);
