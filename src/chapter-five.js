/* Two bridge approaches and a rear armored commander, adapted to the night park. */
(function(global){
  'use strict';
  const C=global.MyGO.CONFIG;
  const lamps=[[5,9],[8,6],[11,16],[20,6],[21,17],[26,9],[28,16]].map(([x,y],i)=>({id:'watercourt-lamp-'+i,x,y,name:'水庭路灯'}));
  const chests=[{id:'north-cache',name:'北岸补给箱',x:9,y:3,item:'elixir'},
    {id:'south-cache',name:'南岸金库',x:25,y:20,gold:500}];
  const chars=(()=>{
    const a=Array.from({length:24},()=>Array(32).fill('.'));
    const rect=(x,y,w,h,t)=>{for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)a[j][i]=t;};
    rect(0,0,32,1,'#');rect(0,23,32,1,'#');rect(0,0,1,24,'#');rect(31,0,1,24,'#');
    rect(13,1,6,22,'w');
    rect(2,10,9,5,'p');rect(24,9,6,6,'p');
    rect(8,5,17,3,'r');rect(8,16,17,3,'r');
    rect(8,3,3,16,'r');rect(22,5,3,17,'r');rect(24,19,4,3,'p');
    rect(13,6,6,2,'b');rect(13,16,6,2,'b');
    // A continuous pond separates the approaches; the two bridges are the ground routes.
    rect(13,5,6,1,'w');rect(13,18,6,1,'w');
    for(const r of [[2,2,4,4],[2,18,4,4],[10,20,2,2],[20,2,3,2],[27,2,3,4],[28,19,2,3],[20,10,2,4]])rect(...r,'f');
    a[9][10]='H';a[14][23]='H';
    for(const c of chests)a[c.y][c.x]='p';
    return a.map(r=>r.join(''));
  })();
  const base=C.UNITS.find(u=>u.id==='shadow_lance');
  function armor(id,x,y,boss=false){return {...base,id,x,y,level:boss?10:8,name:boss?'铁幕守卫长·格雷':'水庭重装兵',
    shortName:boss?'铁幕守卫长':'重装兵',className:boss?'重装统领':'重装骑士',tags:['armor'],art:'park-armor',
    maxHp:boss?36:24,str:boss?15:11,mag:0,dex:10,spd:boss?5:4,lck:3,def:boss?21:17,res:boss?3:2,move:3,
    weapon:boss?'steel_axe':'iron_lance',boss,key:false,dormant:false,facing:'left',guardGroup:boss?'commander':'bridge',guardRadius:boss?4:6,
    drops:boss?['intermediate_seal','steel_axe']:[],quote:boss?'夜色中的铁幕，由我守到最后。':'列阵，封锁桥面。'};}
  function pegasus(id,x,y,guard=false){return {...base,id,x,y,level:8,name:'天马骑士',shortName:'天马骑士',className:'天马骑士',tags:['flying'],art:'park-pegasus',facing:'left',
    maxHp:guard?24:28,str:guard?9:10,mag:0,dex:guard?10:12,spd:guard?10:12,lck:guard?4:5,def:guard?5:6,res:guard?7:9,move:6,weapon:'iron_lance',boss:false,dormant:false,key:false,
    guardGroup:guard?'commander':'wing',guardRadius:guard?5:10,carriedItems:guard?[]:['chest_key'],drops:guard?[]:['chest_key'],
    quote:guard?'守住广场，掩护守卫长！':'越过水面，截断他们的后路。'};}
  const enemies=[armor('court-armor-n',12,6),armor('court-armor-s',19,16),armor('court-armor-east',25,12),
    pegasus('court-pegasus-n',15,3),pegasus('court-pegasus-s',18,20),
    pegasus('court-pegasus-guard-n',27,9,true),pegasus('court-pegasus-guard-s',29,13,true)];
  for(const [id,source,x,y,group] of [['court-bow-n','shadow_bow',10,5,'north'],['court-blade','shadow_blade_1',8,14,'west'],
    ['court-axe','shadow_axe',11,18,'south'],['court-mage','conductor',22,8,'east'],
    ['court-bow-east','shadow_bow',26,17,'east'],['court-lance','shadow_lance',23,19,'east']]){
    const t=C.UNITS.find(u=>u.id===source);enemies.push({...t,id,x,y,level:8,boss:false,key:false,dormant:false,
      name:source==='conductor'?'水庭影咒师':'水庭巡守·'+(source==='shadow_bow'?'弓':source==='shadow_axe'?'斧':source==='shadow_lance'?'枪':'剑'),
      shortName:'巡守',guardGroup:group,guardRadius:6,facing:'left',...(source==='conductor'?{weapon:'miasma',spells:['miasma']}:{} )});
  }
  enemies.push(armor('iron_warden',28,11,true));
  C.STAGE_FIVE={id:'mission-05',cols:32,rows:24,mapRevision:1,enemyCount:enemies.length,
    chapter:'MISSION 05',chapterJp:'第五话',chapterEn:'CHAPTER 05',title:'双桥水庭的铁幕',mapName:'飞鸟山公园·东水庭',
    subtitle:'灯光重新亮起，湖上的双桥却被铁甲封锁。天马掠过水面，银色的钥匙在夜风中作响。',
    objective:'突破双桥，击败重装统领「铁幕守卫长·格雷」',
    gateHint:'北桥与南桥均可通往东侧广场。用魔法突破高守备低魔防的重装兵，用弓克制越水袭来的天马。湖上两名天马骑士各携带一把宝箱钥匙；守卫长身旁另有两名较弱的无钥匙天马护卫。钥匙持有者站在宝箱上或相邻处开箱并结束行动。北箱：特效药；南箱：500 G。Boss 掉落中级转职证与钢斧，击败后立即通关，请先搜集宝箱。',
    terrain:C.buildTerrainGrid(chars),mapChars:chars,enemies,lamps,lampRadius:4,chests,bells:[],requiredBells:0,turnLimit:0,
    decor:[...lamps.map(l=>({...l,kind:'lamp'})),...chests.map(c=>({...c,kind:'chest'})),
      ...[[5,7],[7,18],[21,5],[26,15]].map(([x,y])=>({kind:'bench',x,y})),
      ...[[5,16],[7,3],[26,6],[28,18]].map(([x,y])=>({kind:'flowerbed',x,y})),
      {kind:'sign',x:6,y:11,label:'北桥 ↑  南桥 ↓'},{kind:'sign',x:22,y:11,label:'守卫长广场 →'}],
    spawns:{tomori:{x:3,y:10},anon:{x:2,y:11},rana:{x:3,y:12},soyo:{x:3,y:11},taki:{x:2,y:13},xueyue:{x:4,y:13},nina:{x:2,y:10}}};
  const previous=C.missionForStage;C.missionForStage=stage=>stage===5?C.STAGE_FIVE:previous(stage);
})(window);
