/* Public chapter eleven, following the door behind the palace commander. */
(function(global){
 'use strict';const C=global.MyGO.CONFIG,base=C.STAGE_PALACE,cols=34,rows=40;
 const terrain=Array.from({length:rows},(_,y)=>Array.from({length:cols},(_,x)=>x<2||x>=cols-2||y<2||y>=rows-2?'wall':'plain'));
 const decor=[],put=(kind,x,y,w=1,h=1,blocked=true)=>{decor.push({kind,x,y,w,h});if(blocked)for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)terrain[yy][xx]='wall';};
 // Processional paths cross two continuous canals at deliberately offset bridges.
 for(let y=3;y<=37;y++)for(const x of [5,6,15,16,17,18,27,28])terrain[y][x]='road';
 for(const y of [7,11,12,21,22,31,35])for(let x=2;x<32;x++)terrain[y][x]='plaza';
 for(const yy of [16,26])for(let y=yy;y<yy+2;y++)for(let x=2;x<32;x++)terrain[y][x]='water';
 for(let y=5;y<=25;y++)for(const x of [16,17])terrain[y][x]='water';
 for(const [xs,ys,w,h] of [[5,26,3,2],[25,26,3,2],[11,16,3,2],[21,16,3,2],[16,11,2,2],[16,21,2,2]]){
  for(let y=ys;y<ys+h;y++)for(let x=xs;x<xs+w;x++)terrain[y][x]='bridge';decor.push({kind:'royal-bridge',x:xs,y:ys,w,h,axis:w===2?'horizontal':'vertical'});
 }
 // Cream stone enclosures with actual blocked footprints, never painted over a path.
 for(const [x,y,w,h] of [[2,30,10,1],[15,30,4,1],[22,30,10,1],[9,32,1,4],[24,32,1,4],
  [2,22,7,1],[12,22,3,1],[19,22,3,1],[25,22,7,1],[9,19,1,4],[24,19,1,4],
  [2,12,7,1],[11,12,3,1],[20,12,3,1],[26,12,6,1],[8,7,1,6],[25,7,1,6],
  [11,4,1,5],[22,4,1,5]])put('royal-wall',x,y,w,h);
 // Fountain beds below the northern bridges move together with their blocked ground.
 for(const [x,y,w,h] of [[3,33,3,2],[28,33,3,2],[11,33,3,2],[20,33,3,2],
  [3,23,3,2],[28,23,3,2],[11,23,3,2],[20,23,3,2],
  [3,18,3,2],[28,18,3,2],[11,19,3,2],[20,19,3,2],
  [3,8,3,2],[28,8,3,2],[12,8,2,2],[20,8,2,2]])put('royal-parterre',x,y,w,h);
 for(const [x,y] of [[5,20],[28,20]]){terrain[y][x]='fort';put('palace-font',x,y,1,1,false);}
 for(const y of [9,19,29,36])for(const x of [3,30])put('palace-lamp',x,y,1,1,false);
 put('royal-palace-door',15,38,4,1,false);put('royal-pavilion',14,2,6,2);
 for(const x of [4,29])put('palace-statue',x,4,1,1);
 const group=y=>y>=28?'garden-gate':y>=18?'garden-canal':y>=10?'garden-upper':'garden-crown';
 const from=(source,id,x,y,extra={})=>({...source,id,x,y,guardGroup:group(y),guardRadius:5,facing:'down',boss:false,key:false,hpFloor:0,dormant:false,drops:[],carriedItems:[],...extra});
 const pegasusSpots=[[6,29],[27,29],[4,25],[29,25],[10,20],[23,20],[6,14],[28,14],[23,9]];
 const horses=[[12,32],[21,32],[7,24],[26,24],[12,14],[22,14],[7,8]];
 const enemies=pegasusSpots.map(([x,y],i)=>from(base.enemies.find(u=>u.id==='palace-pegasus-0'),'garden-pegasus-'+i,x,y,
  {name:'御苑天马骑士',shortName:'御苑天马',level:16,maxHp:32,str:15,spd:16,quote:'羽翼掠过水道，试图从花墙两侧包抄。'}))
  .concat(horses.map(([x,y],i)=>from(base.enemies.find(u=>u.id==='palace-cavalier-0'),'garden-cavalier-'+i,x,y,
   {name:'御苑战马骑士',shortName:'御苑骑兵',level:16,maxHp:36,str:16,def:13,guardRadius:6,quote:'骑兵沿桥头列阵，马蹄声在围墙间回响。'})));
 for(const [i,x,y] of [[0,14,28],[1,19,24],[2,10,11],[3,24,6]])enemies.push(from(base.enemies.find(u=>u.id==='palace-soldier-'+i),'garden-soldier-'+i,x,y,{name:'御苑幻兵',shortName:'御苑幻兵',level:15}));
 for(const [i,x,y] of [[0,10,15],[1,24,15]])enemies.push(from(base.enemies.find(u=>u.id==='palace-armor-0'),'garden-armor-'+i,x,y,{name:'御苑重装',shortName:'御苑重装',level:16,maxHp:36}));
 const sky=from(base.enemies.find(u=>u.id==='palace-pegasus-0'),'garden_rift_pegasus',9,5,
  {name:'裂空天马骑士·苍穹卫',shortName:'裂空天马',level:18,maxHp:44,str:17,mag:8,dex:17,spd:18,lck:9,def:11,res:17,boss:true,drops:['steel_lance'],guardGroup:'garden-sky-boss',guardRadius:6,quote:'裂空的羽翼将从水道上方封锁你们。'});
 const horse=from(base.enemies.find(u=>u.id==='gilded_cavalier'),'garden_cavalier_boss',25,5,
  {name:'战马骑士·御苑统领',shortName:'御苑统领',level:18,maxHp:48,str:19,mag:7,dex:17,spd:15,lck:10,def:16,res:11,boss:true,drops:['steel_lance'],guardGroup:'garden-horse-boss',guardRadius:7,quote:'花园的出口，由我们共同守住。'});
 enemies.push(sky,horse);
 C.STAGE_ROYAL_GARDEN={id:'mission-11-royal-garden',mapRevision:3,cols,rows,chapter:'MISSION 11',chapterJp:'第十一话',chapterEn:'CHAPTER 11',
  title:'花墙水道的双骑士',mapName:'王宫后花园 · 御苑水庭',subtitle:'众人穿过金鬃卫长身后的门，来到王宫后花园。花墙切断直路，水道间的桥头被骑兵占据，北端两名统领封锁着去路。',
  objective:'击败裂空天马骑士与战马骑士',gateHint:'中央水道与三道花墙分隔御苑。先从南侧两座桥过河，再绕到中段错位桥继续北上。围墙所有兵种均不可穿越；天马可以飞过水面，战马必须经过桥梁。弓对付天马、魔法突破重装，利用墙角和两侧圣泉稳住阵线。北端两名Boss都被击败才会通关。',
  terrain,decor,enemies,enemyCount:enemies.length,bossIds:[sky.id,horse.id],
  spawns:{tomori:{x:15,y:35},anon:{x:16,y:37},rana:{x:18,y:35},soyo:{x:15,y:37},taki:{x:18,y:37},xueyue:{x:14,y:36},nina:{x:16,y:34},nijika:{x:17,y:36},subaru:{x:19,y:36}}};
 const previous=C.missionForStage;C.missionForStage=stage=>stage===12?C.STAGE_ROYAL_GARDEN:previous(stage);
})(window);
