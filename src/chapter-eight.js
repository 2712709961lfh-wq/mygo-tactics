/* A distorted continuation of STARRY: eight rows unfold inside the existing stage. */
(function(global){
 'use strict';const C=global.MyGO.CONFIG,base=C.STAGE_SEVEN;
 const chars=base.mapChars.slice(0,6).concat(Array(8).fill(base.mapChars[6]),base.mapChars.slice(6));
 const chests=[{id:'echo-seal',name:'西侧转职宝箱',x:4,y:23,item:'intermediate_seal'},
  {id:'echo-gold',name:'东侧金币宝箱',x:25,y:17,gold:1500},
  {id:'echo-sword',name:'后台武器宝箱',x:24,y:4,item:'steel_sword'}];
 const defs=[['blade','shadow_blade_1',10,15],['axe','shadow_axe',19,15],['bow','shadow_bow',12,11],
  ['blade-w','shadow_blade_2',8,10],['lance-e','shadow_lance',21,12],['bow-deep','shadow_bow',20,5],
  ['mage-w','conductor',10,7],['mage-e','conductor',18,8]];
 const regular=defs.map(([id,source,x,y])=>({...C.UNITS.find(u=>u.id===source),id:'echo-'+id,x,y,side:'enemy',level:10,
  boss:false,key:false,hpFloor:0,dormant:false,drops:[],carriedItems:[],guardGroup:'echo-'+(y>10?'front':'rear'),guardRadius:6,facing:'down',
  name:'舞台幻兵·'+(source==='conductor'?'咒':source.includes('bow')?'弓':source.includes('axe')?'斧':source.includes('lance')?'枪':'剑'),shortName:'舞台幻兵',
  ...(source==='conductor'?{weapon:'miasma',spells:['miasma'],mag:11,maxHp:25,def:4,res:8}:{}),quote:'面具人留下的回声，凝成了舞台上的幻兵。'}));
 const special=(type,i,x,y)=>({...C.STAGE_FIVE.enemies.find(u=>u.art==='park-'+type),id:'echo-'+type+'-'+i,x,y,side:'enemy',level:10,
  name:type==='armor'?'暗幕重装':'携钥天马骑士',shortName:type==='armor'?'暗幕重装':'携钥天马',boss:false,key:false,hpFloor:0,dormant:false,
  drops:type==='pegasus'?['chest_key']:[],carriedItems:type==='pegasus'?['chest_key']:[],guardGroup:'echo-'+(y>10?'front':'rear'),guardRadius:6,facing:'down'});
 const enemies=regular.concat([[9,12],[20,13],[9,5],[20,8]].map(([x,y],i)=>special('armor',i,x,y)),
  [[8,15],[21,10],[22,6]].map(([x,y],i)=>special('pegasus',i,x,y)),[
  {...C.UNITS.find(u=>u.id==='soyo'),id:'dark_soyo',name:'往日之影长崎爽世',shortName:'爽世之影',side:'enemy',classId:'warlock',className:'术士',
   level:12,maxHp:40,str:5,mag:15,dex:13,spd:9,lck:5,def:6,res:12,weapon:'miasma',spells:['miasma'],x:11,y:4,
   boss:true,hpFloor:0,tags:[],drops:[],carriedItems:[],dormant:false,guardRadius:5,guardGroup:'echo-phantoms',facing:'down',quote:'那些没有说出口的话……你还记得吗？'},
  {...C.UNITS.find(u=>u.id==='tomori'),id:'dark_tomori',name:'往日之影高松灯',shortName:'灯之影',side:'enemy',classId:'mercenary',className:'佣兵',
   level:12,maxHp:43,str:14,mag:2,dex:14,spd:13,lck:5,def:10,res:5,weapon:'steel_sword',spells:[],x:18,y:4,
   boss:true,hpFloor:0,tags:[],drops:[],carriedItems:[],dormant:false,guardRadius:5,guardGroup:'echo-phantoms',facing:'down',quote:'如果那首歌……再也传达不到呢？'}]);
 // Panel budgets count all nine stats, including HP and movement.
 // Preserve the requested attack/mobility trades without optimizing away off-role stats.
 const balanceStats={
  // v5.8.7: main attack -2, speed -1, off-role attack +3; panel totals stay fixed.
  'echo-blade':{maxHp:32,str:11,mag:7,dex:12,spd:10,lck:7,def:7,res:4}, // 94, move 4
  'echo-blade-w':{maxHp:31,str:11,mag:8,dex:12,spd:10,lck:6,def:7,res:4}, // 93, move 4
  'echo-axe':{maxHp:37,str:14,mag:7,dex:9,spd:6,lck:5,def:10,res:4}, // 95, move 3
  'echo-bow':{maxHp:30,str:12,mag:7,dex:13,spd:10,lck:7,def:6,res:4}, // 93, move 4
  'echo-bow-deep':{maxHp:31,str:12,mag:8,dex:13,spd:10,lck:7,def:6,res:4}, // 95, move 4
  'echo-lance-e':{maxHp:33,str:12,mag:8,dex:11,spd:9,lck:6,def:9,res:4}, // 96, move 4
  'echo-mage-w':{maxHp:28,str:10,mag:11,dex:13,spd:6,lck:8,def:4,res:8}, // 92, move 4
  'echo-mage-e':{maxHp:29,str:11,mag:11,dex:13,spd:6,lck:8,def:4,res:8}, // 94, move 4
  dark_soyo:{maxHp:38,str:7,mag:20,dex:14,spd:10,lck:6,def:7,res:14}, // panel total 120, move 4
  dark_tomori:{maxHp:40,str:16,mag:5,dex:15,spd:16,lck:6,def:11,res:6}, // panel total 120, move 5
  armor:{maxHp:30,str:15,mag:4,dex:10,spd:6,lck:7,def:22,res:4,move:4}, // panel total 102
  flying:{maxHp:26,str:11,mag:6,dex:13,spd:14,lck:6,def:8,res:12} // panel total 102, move 6
 };
 C.STAGE_EIGHT={...base,id:'mission-08',mapRevision:1,rows:36,chapter:'MISSION 08',chapterJp:'第八话',chapterEn:'CHAPTER 08',balanceStats,
  title:'无尽舞台的往日之影',mapName:'STARRY · 被暗幕扩张的舞台',
  subtitle:'神秘面具人再现，熟悉的舞台向黑暗深处延伸。幕布下，两个本不该站在对面的身影睁开了眼。',
  objective:'击败幻影：往日之影长崎爽世与往日之影高松灯',
  gateHint:'众人留在舞台前沿。向北击败术士爽世之影与佣兵灯之影即可获胜。重装高守备低魔防；弓克制天马。三名携钥天马各掉一把钥匙，三个宝箱分别藏有中级转职证、1500 G、钢剑。先搜宝，再击败最后一名幻影。',
  terrain:C.buildTerrainGrid(chars),mapChars:chars,enemies,enemyCount:enemies.length,chests,phantomIds:['dark_soyo','dark_tomori'],
  spawns:{tomori:{x:13,y:18},anon:{x:14,y:19},rana:{x:15,y:18},soyo:{x:13,y:19},taki:{x:15,y:19},xueyue:{x:12,y:20},nina:{x:16,y:20},nijika:{x:14,y:18}},
  decor:base.decor.map(o=>({...o,y:o.y>=6?o.y+8:o.y})).concat(chests.map(c=>({...c,kind:'chest'})))};
 const prev=C.missionForStage;C.missionForStage=stage=>stage===8?C.STAGE_EIGHT:prev(stage);
})(window);
