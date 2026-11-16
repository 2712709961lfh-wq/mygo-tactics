/* The door loops back to the same rehearsal room, with a battle already underway. */
(function(global){
 'use strict';const C=global.MyGO.CONFIG,base=C.STAGE_NINE;
 C.SUBARU={id:'subaru',name:'安和昴',shortName:'昴',gender:'女',side:'ally',classId:'mage',className:'术师',level:12,
  maxHp:30,str:6,mag:15,dex:13,spd:12,lck:12,def:7,res:13,hit:0,move:4,tags:[],weapon:'fire',spells:['fire','thunder','heal'],
  x:13,y:16,facing:'up',quote:'mmk叫我抓你回去训练……不过现在，还是先把这些家伙解决掉吧！',
  art:{kind:'girl',hair:'#303037',hairDark:'#16191e',hairStyle:'long',outfit:'#283049',outfitDark:'#171e2e',accent:'#b7bdd1',skin:'#f5d6c6',eye:'#785b9c'}};
 const sources=['rehearsal-sword-a','rehearsal-axe-a','rehearsal-bow-a','rehearsal-lance-a','rehearsal-mage-a','rehearsal-sword-b','rehearsal-bow-b'];
 const spots=[[9,22],[18,22],[6,17],[21,18],[10,10],[18,11],[17,5],[7,8],[21,24]];
 // Both halves share the original chapter-nine profiles, including levels.
 const regular=spots.map(([x,y],i)=>({...base.enemies.find(e=>e.id===sources[i%sources.length]),id:'loop-soldier-'+i,x,y,
  name:'环室幻兵·'+(i%7===4?'咒':i%7===2||i%7===6?'弓':i%7===1?'斧':i%7===3?'枪':'剑'),shortName:'环室幻兵',
  guardGroup:y>=20?'loop-south':y>=13?'loop-center':'loop-north',guardRadius:6,facing:y>=17?'up':'down',quote:'休息室又回到了眼前，失真的排练声从四面八方响起。'}));
 const special=(type,i,x,y)=>({...base.enemies.find(e=>e.id==='rehearsal-'+type+'-0'),id:'loop-'+type+'-'+i,x,y,
  name:type==='armor'?'回环重装':'回环天马骑士',shortName:type==='armor'?'回环重装':'回环天马',
  guardGroup:y>=20?'loop-south':y>=13?'loop-center':'loop-north',guardRadius:6,facing:y>=17?'up':'down'});
 const phantom={...C.NINA,id:'dark_nina',name:'井芹仁菜幻影',shortName:'仁菜幻影',side:'enemy',classId:'brawler',className:'拳斗士',
  level:16,maxHp:43,str:15,mag:7,dex:15,spd:19,lck:8,def:11,res:9,move:5,weapon:'steel_gauntlets',spells:[],x:13,y:14,
  boss:true,key:false,hpFloor:0,dormant:false,tags:[],drops:[],carriedItems:[],guardGroup:'loop-phantom',guardRadius:5,facing:'down',
  quote:'它没有回答。只有模仿仁菜的拳头，一次次打向眼前的人。'};
 const enemies=regular.concat([special('armor',0,10,19),special('armor',1,18,16),special('armor',2,15,8),special('pegasus',0,6,23),special('pegasus',1,22,10),phantom]);
 const terrain=base.terrain.map(r=>r.slice());terrain[2][13]='gateOpen';
 C.STAGE_TEN={...base,id:'mission-09-finale',mapRevision:1,chapter:'MISSION 09',chapterJp:'第九话',chapterEn:'CHAPTER 09',
  title:base.title,mapName:'刺团的排练室 · 门后的回环',
  subtitle:'奇怪的门后依然是熟悉的排练室。中央，安和昴正被一个与仁菜一模一样的身影攻击。',
  objective:'击败所有敌人',gateHint:'昴会在开场对话后直接加入队伍。由南侧入口赶往中央，与她会合并清理四周敌人。仁菜幻影为拳斗士，钢拳套可连续攻击，避免让脆弱队员独自承受；魔法对付重装、弓对付天马。击败幻影后仍须清除其余敌人才会通关。',
  terrain,enemies,enemyCount:enemies.length,bossId:phantom.id,
  legacyFinaleMaxHp:Object.fromEntries(enemies.filter(e=>!e.boss).map(e=>[e.id,e.id.includes('armor')?35:e.id.includes('pegasus')?30:[32,36,31,34,30,32,30,32,36][Number(e.id.split('-').pop())]])),
  legacyMaxHp:{subaru:33,...Object.fromEntries(enemies.filter(e=>!e.boss).map(e=>[e.id,e.id.includes('armor')?38:e.id.includes('pegasus')?32:[1,8].includes(Number(e.id.split('-').pop()))?40:34]))},
  spawns:{tomori:{x:12,y:22},anon:{x:14,y:23},rana:{x:15,y:22},soyo:{x:12,y:23},taki:{x:15,y:23},xueyue:{x:11,y:24},nina:{x:13,y:21},nijika:{x:14,y:22}}};
 C.CHARACTER_STORIES.subaru='为了把仁菜抓回去训练，昴推开了休息室的门。可先迎接她的，是一双毫不犹豫挥来的拳头。直到真正的仁菜出现，她才明白自己遇见了什么。';
 const previous=C.missionForStage;C.missionForStage=stage=>stage===10?C.STAGE_TEN:previous(stage);
})(window);
