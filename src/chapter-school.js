/* Chapter twelve: Tsukinomori-inspired campus and recurring gate reinforcements. */
(function(global){
 'use strict';const C=global.MyGO.CONFIG,base=C.STAGE_ROYAL_GARDEN,cols=34,rows=38;
 const terrain=Array.from({length:rows},(_,y)=>Array.from({length:cols},(_,x)=>x<2||x>31||y<2||y>35?'wall':'plain')),decor=[];
 const prop=(kind,x,y,w=1,h=1,block=true)=>{decor.push({kind,x,y,w,h});if(block)for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)terrain[j][i]='wall';};
 for(let y=9;y<=35;y++)for(let x=14;x<=19;x++)terrain[y][x]='road';
 for(const yy of [12,22,30])for(let y=yy;y<yy+2;y++)for(let x=3;x<=30;x++)terrain[y][x]='plaza';
 prop('school-building',4,2,26,7);prop('school-wing',3,14,4,7);prop('school-wing',27,14,4,7);
 for(const [x,y,w,h] of [[9,16,3,3],[22,16,3,3],[8,25,4,2],[22,25,4,2],[4,32,3,2],[27,32,3,2]])prop('school-bed',x,y,w,h);
 for(const [x,y] of [[10,11],[23,11],[5,25],[28,25]])prop('school-tree',x,y,1,1);
 for(const [x,y] of [[9,20],[24,20]]){terrain[y][x]='fort';prop('school-bench',x,y,1,1,false);}
 for(const [x,y] of [[12,14],[21,14],[12,27],[21,27]])prop('school-lamp',x,y,1,1,false);
 prop('school-gate',14,36,6,1,false);prop('school-sign',20,35,1,1,false);
 const group=y=>y>=25?'school-gate':y>=17?'school-court':'school-hall';
 const from=(source,id,x,y,extra={})=>({...source,id,x,y,guardGroup:group(y),guardRadius:5,facing:'down',boss:false,key:false,hpFloor:0,dormant:false,drops:[],carriedItems:[],...extra});
 const horse=base.enemies.find(u=>u.id==='garden-cavalier-0'),armor=base.enemies.find(u=>u.id==='garden-armor-0'),fly=base.enemies.find(u=>u.id==='garden-pegasus-0');
 const enemies=[[11,29],[22,29],[8,22],[25,22],[13,16],[20,16],[10,10],[23,10]].map(([x,y],i)=>from(horse,'school-cavalier-'+i,x,y,{name:'月影战马骑士',shortName:'月影骑兵',level:17,maxHp:37,str:17}));
 for(const [i,x,y] of [[0,14,26],[1,19,26],[2,12,21],[3,21,21],[4,14,13],[5,19,13]])enemies.push(from(armor,'school-armor-'+i,x,y,{name:'学园重装卫兵',shortName:'学园重装',level:17,maxHp:38,str:17,def:21,res:5}));
 for(const [i,x,y] of [[0,5,29],[1,28,29],[2,8,13]])enemies.push(from(fly,'school-pegasus-'+i,x,y,{name:'月影天马骑士',shortName:'月影天马',level:17,maxHp:33,str:16}));
 // Keep encounter IDs stable so existing battle positions and defeated units migrate.
 const phantomSpecs=[['school-cavalier-1',0,'剑','steel_sword'],['school-cavalier-3',1,'斧','steel_axe'],['school-armor-2',2,'弓','steel_bow'],['school-armor-5',3,'枪','steel_lance'],['school-pegasus-1',5,'剑','steel_sword']];
 const phantomReplacements={};
 for(const [id,index,kind,weapon] of phantomSpecs){
  const at=enemies.findIndex(u=>u.id===id),old=enemies[at],source=C.STAGE_PALACE.enemies.find(u=>u.id==='palace-soldier-'+index);
  phantomReplacements[id]={maxHp:old.maxHp,classId:old.classId||null};
  enemies[at]=from(source,id,old.x,old.y,{name:'学园幻兵·'+kind,shortName:'学园幻兵',className:'幻兵·'+kind,level:17,
   maxHp:kind==='斧'?36:kind==='弓'?33:34,str:kind==='斧'?18:16,mag:6,dex:kind==='弓'?17:15,spd:kind==='斧'?11:14,def:kind==='斧'?11:10,res:8,
   move:5,tags:['monster'],weapon,quote:'熟悉的校园中，扭曲的回声凝成了幻兵。'});
 }
 const boss=from(base.enemies.find(u=>u.id==='garden_rift_pegasus'),'school_rift_pegasus',16,10,{name:'裂空天马骑士·月森守望',shortName:'裂空天马',level:20,maxHp:48,str:19,dex:18,spd:19,def:12,res:18,weapon:'steel_lance',boss:true,guardRadius:6,guardGroup:'school-boss',drops:['steel_lance'],quote:'月光之下，校门已被封锁。你们无法离开这里。'});enemies.push(boss);
 const reinforcementTemplates=wave=>{
  const rewards=['steel_lance','iron_shield','steel_bow'];
  return [from(fly,'school-wave-'+wave+'-0',15,34,{name:'追击天马·补给',shortName:'援兵天马',level:17,maxHp:33,str:16,drops:['concoction'],carriedItems:['concoction']}),
   from(fly,'school-wave-'+wave+'-1',18,34,{name:'追击天马·装备',shortName:'援兵天马',level:17,maxHp:33,str:16,drops:[rewards[(wave-1)%rewards.length]],carriedItems:[rewards[(wave-1)%rewards.length]]}),
   from(horse,'school-wave-'+wave+'-2',16,35,{name:'校门追击骑兵',shortName:'援兵骑兵',level:17,maxHp:37,str:17})].map(u=>({...u,guardGroup:'school-pursuit',guardRadius:0,facing:'up'}));
 };
 C.STAGE_SCHOOL={id:'mission-12-tsukinomori',mapRevision:1,cols,rows,chapter:'MISSION 12',chapterJp:'第十二话',chapterEn:'CHAPTER 12',title:'月之森校门的追击',mapName:'月之森女子学园 · 校门与前庭',
  subtitle:'王宫后的道路尽头，出现了爽世熟悉的校门。浅色校舍前骑兵列阵，而追兵正从身后的入口逼近。',objective:'击败裂空天马骑士',
  gateHint:'从南侧学校大门沿中央步道向北推进，利用庭园与两侧校舍分流骑兵。重装适合用魔法突破，天马怕弓。第3回合起，每3回合校门出现2名天马与1名骑兵；援兵天马携带调合药及轮换装备，击败后获得。尽快击败主楼前裂空天马即可通关，无需全歼追兵。',
  terrain,decor,enemies,enemyCount:enemies.length,bossId:boss.id,reinforcementTemplates,phantomReplacements,
  spawns:{tomori:{x:15,y:32},anon:{x:16,y:34},rana:{x:18,y:32},soyo:{x:15,y:34},taki:{x:18,y:34},xueyue:{x:14,y:33},nina:{x:16,y:31},nijika:{x:17,y:33},subaru:{x:19,y:33}}};
 C.STAGE_SCHOOL.templateForId=id=>{
  const authored=enemies.find(u=>u.id===id);if(authored)return authored;
  const m=/^school-wave-([1-9]\d*)-([012])$/.exec(id);if(!m||!Number.isSafeInteger(Number(m[1])))return null;
  return reinforcementTemplates(Number(m[1]))[Number(m[2])];
 };
 const previous=C.missionForStage;C.missionForStage=stage=>stage===13?C.STAGE_SCHOOL:previous(stage);
})(window);
