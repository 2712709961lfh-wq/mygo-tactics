/* Public chapter ten. Internal encounter 10 remains chapter nine's saved finale. */
(function(global){
 'use strict';const C=global.MyGO.CONFIG,base=C.STAGE_NINE,cols=30,rows=36;
 const terrain=Array.from({length:rows},(_,y)=>Array.from({length:cols},(_,x)=>x<2||x>=cols-2||y<2||y>=rows-2?'wall':'plaza'));
 const decor=[],prop=(kind,x,y,w=1,h=1)=>{decor.push({kind,x,y,w,h});for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)terrain[yy][xx]='wall';};
 for(let y=7;y<=28;y+=7)for(const x of [8,21])prop('palace-column',x,y,1,2);
 for(const y of [11,22])for(const x of [3,25])prop('palace-planter',x,y,2,1);
 // Sculptures use the existing blocked flower-platform footprints; the
 // walkable layout and old save positions remain valid.
 for(const o of decor)if(o.kind==='palace-planter'&&o.y===11)o.kind='palace-statue';
 prop('palace-throne',14,3,2,2);
 for(let y=5;y<=33;y++)for(let x=13;x<=16;x++)terrain[y][x]='road';
 for(const [x,y] of [[5,17],[24,17]]){terrain[y][x]='fort';decor.push({kind:'palace-font',x,y});}
 decor.push({kind:'palace-entrance',x:14,y:33,w:2,h:1});
 for(const y of [6,13,20,27])for(const x of [3,26])decor.push({kind:'palace-lamp',x,y});
 for(const y of [9,16,23,30])for(const x of [0,29])decor.push({kind:'palace-banner',x,y});
 const specs=[['sword-a',11,28],['axe-a',18,27],['bow-a',5,21],['lance-a',24,21],['mage-a',11,16],['sword-b',18,15],['bow-b',18,9]];
 const regular=specs.map(([source,x,y],i)=>({...base.enemies.find(u=>u.id==='rehearsal-'+source),id:'palace-soldier-'+i,x,y,level:14,
  name:'宫廷幻兵·'+['剑','斧','弓','枪','咒','剑','弓'][i],shortName:'宫廷幻兵',
  maxHp:base.enemies.find(u=>u.id==='rehearsal-'+source).maxHp+3,
  ...(source==='mage-a'?{mag:15}:{str:base.enemies.find(u=>u.id==='rehearsal-'+source).str+2}),
  guardGroup:y>=24?'palace-entry':y>=14?'palace-middle':'palace-crown',guardRadius:5,quote:'金色大厅中，盔甲与幻影一同守护着空荡的王座。'}));
 const special=(type,i,x,y)=>({...base.enemies.find(u=>u.id==='rehearsal-'+type+'-0'),id:'palace-'+type+'-'+i,x,y,level:15,
  name:type==='armor'?'宫廷重装':'宫廷天马骑士',shortName:type==='armor'?'宫廷重装':'宫廷天马',
  ...(type==='armor'?{maxHp:35,str:16,def:20,res:4}:{maxHp:31,str:14,dex:14,spd:15,def:9,res:12}),
  guardGroup:y>=14?'palace-middle':'palace-crown',guardRadius:5,quote:'它们沿着宫廷回廊列阵，等待闯入者。'});
 const cavalry=(i,x,y)=>({id:'palace-cavalier-'+i,name:'宫廷战马骑士',shortName:'战马骑士',side:'enemy',classId:'cavalier',className:'战马骑士',
  level:15,maxHp:34,str:15,mag:6,dex:14,spd:13,lck:9,def:12,res:8,hit:0,move:7,tags:['cavalry'],weapon:'steel_lance',art:'palace-cavalier',
  x,y,boss:false,key:false,dormant:false,drops:[],guardGroup:y>=24?'palace-entry':y>=14?'palace-middle':'palace-crown',guardRadius:6,facing:'down',
  quote:'沉重的马蹄踏过大理石。留意它能迅速越过的距离。'});
 const boss={...cavalry('boss',14,6),id:'gilded_cavalier',name:'精英战马骑士·金鬃卫长',shortName:'金鬃卫长',level:17,
  maxHp:46,str:18,mag:7,dex:16,spd:16,lck:10,def:14,res:12,boss:true,art:'palace-cavalier-elite',
  drops:['steel_lance'],guardGroup:'palace-crown',guardRadius:7,quote:'王座之前，禁止通行。'};
 const enemies=regular.concat([special('armor',0,12,21),special('armor',1,17,13),special('armor',2,12,9),
  special('pegasus',0,5,12),special('pegasus',1,24,12),cavalry(0,7,26),cavalry(1,22,26),cavalry(2,6,16),cavalry(3,23,16),boss]);
 C.STAGE_PALACE={id:'mission-10-palace',mapRevision:1,cols,rows,chapter:'MISSION 10',chapterJp:'第十话',chapterEn:'CHAPTER 10',
  title:'鎏金王座的铁蹄',mapName:'鎏金宫殿 · 王座大厅',subtitle:'排练室的回声散去，金色宫门在前方开启。红毯尽头，一名精英战马骑士率领宫廷守军挡住去路。',
  objective:'击败精英战马骑士',gateHint:'沿中央红毯向北端王座厅推进，也可从立柱两侧的回廊迂回。战马骑士移动7格，先查看敌军威胁范围；重装守备高而魔防低，使用魔法，天马使用弓应对。两侧圣泉提供据点防护与回合开始回复。击败金鬃卫长即可通关。',
  terrain,decor,enemies,enemyCount:enemies.length,bossId:boss.id,
  spawns:{tomori:{x:13,y:30},anon:{x:14,y:32},rana:{x:16,y:30},soyo:{x:13,y:32},taki:{x:16,y:32},xueyue:{x:12,y:31},nina:{x:14,y:29},nijika:{x:15,y:31},subaru:{x:17,y:31}}};
 const previous=C.missionForStage;C.missionForStage=stage=>stage===11?C.STAGE_PALACE:previous(stage);
})(window);
