/* A rehearsal room remembered by Nina, stretched into an impossible corridor. */
(function(global){
 'use strict';const C=global.MyGO.CONFIG,cols=28,rows=34;
 const terrain=Array.from({length:rows},(_,y)=>Array.from({length:cols},(_,x)=>x<2||x>25||y<2||y>31?'wall':'plain'));
 const decor=[];
 const prop=(kind,x,y,w=1,h=1)=>{decor.push({kind,x,y,w,h});for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)terrain[j][i]='wall';};
 // The practice equipment forms alcoves, never a second live performance stage.
 prop('drums',5,4,3,2);prop('keyboard',20,4,3,1);
 for(const [x,y] of [[3,8],[23,8],[3,17],[23,17],[8,12],[18,12]])prop('amp',x,y,2,1);
 prop('sofa',3,27,4,1);prop('table',4,25,2,1);prop('cases',23,26,2,2);
 for(const [x,y] of [[5,20],[20,20]])prop('rack',x,y,2,2);
 decor.push({kind:'mic',x:10,y:5},{kind:'mic',x:17,y:6},{kind:'guitar',x:22,y:6},
  {kind:'entrance',x:13,y:31},{kind:'strange-door',x:13,y:2});
 for(let y=3;y<=30;y++){terrain[y][13]='road';terrain[y][14]='road';}
 terrain[2][13]='gate';terrain[2][14]='wall';
 // Fixed budgets calibrated to the player's Lv.9/11/13/14 save totals.
 // Keep imperfect distributions: physical units retain some unused magic.
 const stats={
  'sword-a':{maxHp:31,str:13,mag:7,dex:14,spd:13,lck:9,def:10,res:7},
  'axe-a':{maxHp:35,str:16,mag:6,dex:12,spd:9,lck:10,def:13,res:6},
  'bow-a':{maxHp:29,str:13,mag:7,dex:16,spd:13,lck:10,def:9,res:8},
  'lance-a':{maxHp:33,str:14,mag:6,dex:13,spd:11,lck:9,def:13,res:8},
  'mage-a':{maxHp:28,str:8,mag:15,dex:14,spd:12,lck:10,def:8,res:12},
  'sword-b':{maxHp:30,str:14,mag:6,dex:14,spd:14,lck:10,def:10,res:7},
  'bow-b':{maxHp:30,str:12,mag:8,dex:15,spd:14,lck:9,def:9,res:9}
 };
 const regular=[['sword-a','shadow_blade_1',10,24],['axe-a','shadow_axe',18,24],['bow-a','shadow_bow',8,18],
  ['lance-a','shadow_lance',19,18],['mage-a','conductor',10,12],['sword-b','shadow_blade_2',17,11],['bow-b','shadow_bow',17,7]]
  .map(([id,source,x,y])=>({...C.UNITS.find(u=>u.id===source),id:'rehearsal-'+id,x,y,side:'enemy',level:12,
   name:'排练幻兵·'+(source==='conductor'?'咒':source.includes('bow')?'弓':source.includes('axe')?'斧':source.includes('lance')?'枪':'剑'),shortName:'排练幻兵',
   ...stats[id],
   ...(source==='conductor'?{weapon:'miasma',spells:['miasma']}:{}),boss:false,key:false,hpFloor:0,dormant:false,
   drops:[],carriedItems:[],guardGroup:y>=20?'rehearsal-entry':y>=14?'rehearsal-middle':'rehearsal-rear',guardRadius:5,facing:'down',quote:'熟悉的排练声，被扭曲成了不肯散去的回声。'}));
 const special=(type,i,x,y)=>({...C.STAGE_FIVE.enemies.find(u=>u.art==='park-'+type),id:'rehearsal-'+type+'-'+i,x,y,
  side:'enemy',level:13,name:type==='armor'?'隔音重装':'回声天马骑士',shortName:type==='armor'?'隔音重装':'回声天马',
  ...(type==='armor'?{maxHp:33,str:16,mag:7,dex:12,spd:8,lck:10,def:20,res:5}:{maxHp:29,str:13,mag:7,dex:14,spd:15,lck:10,def:9,res:12}),
  boss:false,key:false,hpFloor:0,dormant:false,drops:[],carriedItems:[],guardRadius:5,guardGroup:y>=14?'rehearsal-middle':'rehearsal-rear',facing:'down'});
 const boss={...special('pegasus','boss',13,5),id:'rift_pegasus',name:'裂空天马·门之守卫',shortName:'裂空天马',
  level:15,maxHp:40,str:16,mag:8,dex:14,spd:16,lck:8,def:10,res:18,move:6,weapon:'steel_lance',boss:true,key:true,
  drops:['strange_door_key','steel_lance'],carriedItems:['strange_door_key'],guardGroup:'rehearsal-door',guardRadius:6,
  quote:'苍白的羽翼拖着裂隙的光。它守护的门后，究竟通向哪里？'};
 const enemies=regular.concat([special('armor',0,12,17),special('armor',1,16,10),special('pegasus',0,6,14),special('pegasus',1,21,13),boss]);
 C.STAGE_NINE={id:'mission-09',mapRevision:1,cols,rows,chapter:'MISSION 09',chapterJp:'第九话',chapterEn:'CHAPTER 09',
  title:'门后的排练回声',mapName:'刺团的排练室 · 异常扩张空间',
  subtitle:'休息室的门后，是仁菜熟悉的排练室。镜面与吸音墙向远处延伸，一扇陌生的门浮现在尽头。',
  objective:'击败裂空天马并开门，与昴会合后击败所有敌人',
  gateHint:'沿中央地毯向北推进，绕过音箱与乐器架。重装怕魔法，天马怕弓。击败裂空天马获得门的钥匙与钢枪；队员到北端门旁开门后继续本关剧情，与昴会合并清除仁菜幻影及其余敌人，才会通关。',
  terrain,decor,enemies,enemyCount:enemies.length,bossId:boss.id,door:{x:13,y:2},
  legacyMaxHp:Object.fromEntries(enemies.filter(e=>!e.boss).map(e=>[e.id,e.id.includes('armor')?35:e.id.includes('pegasus')?30:e.id.includes('axe')?38:32])),
  spawns:{tomori:{x:12,y:28},anon:{x:14,y:29},rana:{x:15,y:28},soyo:{x:12,y:29},taki:{x:15,y:29},xueyue:{x:11,y:30},nina:{x:13,y:27},nijika:{x:14,y:28}}};
 const prev=C.missionForStage;C.missionForStage=stage=>stage===9?C.STAGE_NINE:prev(stage);
})(window);
