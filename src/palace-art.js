/* Original gold-and-ivory palace and grounded, wingless mounted knights. */
(function(global){
 'use strict';const M=global.MyGO,T=M.CONFIG.TILE,P=M.MapProjection,C=M.Characters;
 const rect=(c,x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
 function line(c,x,y,xx,yy,color,width=1){c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x,y);c.lineTo(xx,yy);c.stroke();}
 function poly(c,points,color){c.fillStyle=color;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();}
 function oval(c,x,y,rx,ry,color){c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();}
 function diamond(c,x,y,r,color){poly(c,[[x,y-r],[x+r,y],[x,y+r],[x-r,y]],color);}
 function marble(c,x,y,w,h){const g=c.createLinearGradient(x,y,x+w,y+h);g.addColorStop(0,'#f1e6cf');g.addColorStop(.45,'#dfd3b8');g.addColorStop(1,'#c9bc9f');c.fillStyle=g;c.fillRect(x,y,w,h);
  line(c,x+5,y+h*.66,x+w*.5,y+h*.3,'rgba(135,117,93,.12)');line(c,x+w*.5,y+h*.3,x+w-2,y+h*.36,'rgba(135,117,93,.12)');}
 function carpet(c,x,y,w,h){rect(c,x,y,w,h,'#6f1f35');rect(c,x+5,y,w-10,h,'#8d2a40');line(c,x+4,y,x+4,y+h,'#d4ad5d',2);line(c,x+w-4,y,x+w-4,y+h,'#d4ad5d',2);
  for(let yy=y+16;yy<y+h;yy+=32){diamond(c,x+11,yy,3,'#cb9d55');diamond(c,x+w-11,yy,3,'#cb9d55');}}
 function arch(c,x,y,w,h){c.save();c.beginPath();c.moveTo(x-w/2,y);c.lineTo(x-w/2,y-h+w/2);c.arc(x,y-h+w/2,w/2,Math.PI,0);c.lineTo(x+w/2,y);c.closePath();
  const g=c.createLinearGradient(x,y-h,x,y);g.addColorStop(0,'#223954');g.addColorStop(.65,'#57778d');g.addColorStop(1,'#c1b99a');c.fillStyle=g;c.fill();c.strokeStyle='#b69351';c.lineWidth=4;c.stroke();
  line(c,x,y-h+2,x,y,'#dec693',2);line(c,x-w/2,y-h*.42,x+w/2,y-h*.42,'#dec693',2);c.restore();}
 function drawGround(c,map){const W=map.cols*T,H=map.rows*T;c.save();rect(c,0,0,W,H,'#302a32');
  for(let y=2;y<map.rows-2;y++)for(let x=2;x<map.cols-2;x++){
   marble(c,x*T,y*T,T,T);c.strokeStyle='rgba(105,83,51,.22)';c.lineWidth=.6;c.strokeRect(x*T+.5,y*T+.5,T-1,T-1);
   if((x+y)%4===0)diamond(c,(x+.5)*T,(y+.5)*T,3,'#b3a17b');
  }
  // Two broad arcades and a processional carpet: every accent follows the grid.
  for(const x of [3,10,19,26]){rect(c,x*T+3,2*T,2,(map.rows-4)*T,'#b89c61');rect(c,x*T+7,2*T,1,(map.rows-4)*T,'#f5e5b7');}
  carpet(c,13*T,5*T,4*T,29*T);
  for(const y of [10,21,28]){rect(c,2*T,y*T,(map.cols-4)*T,2,'#b59758');rect(c,2*T,y*T+4,(map.cols-4)*T,1,'#faf0d3');carpet(c,13*T,y*T,4*T,6);}
  // The raised throne platform remains a broad, accessible plaza, with three shallow steps.
  marble(c,10*T,2*T,10*T,5*T);c.strokeStyle='#b08c45';c.lineWidth=3;c.strokeRect(10*T+3,2*T+3,10*T-6,5*T-6);
  carpet(c,13*T,2*T+4,4*T,5*T-5);for(let i=0;i<3;i++)line(c,10*T,7*T+i*5,20*T,7*T+i*5,i===0?'#9b8259':'#eee1be',2);
  const cx=15*T,cy=25*T;c.strokeStyle='rgba(173,136,68,.55)';c.lineWidth=3;c.beginPath();c.ellipse(cx,cy,2.7*T,2.7*T,0,0,Math.PI*2);c.stroke();
  c.beginPath();c.ellipse(cx,cy,2.4*T,2.4*T,0,0,Math.PI*2);c.stroke();diamond(c,cx,cy,24,'#d4b36b');diamond(c,cx,cy,15,'#872b40');
  // Ornate outer walls, tall arched windows and burgundy hangings.
  for(const x of [0,W-2*T]){marble(c,x,0,2*T,H);rect(c,x+4,0,5,H,'#b39152');rect(c,x+2*T-9,0,5,H,'#b39152');
   for(let y=5*T;y<H-3*T;y+=7*T){arch(c,x+T,y,36,94);rect(c,x+6,y-94,7,102,'#6c2538');rect(c,x+2*T-13,y-94,7,102,'#6c2538');rect(c,x+3,y-99,2*T-6,5,'#d4af63');}}
  marble(c,0,0,W,2*T);rect(c,0,5,W,5,'#b79759');rect(c,0,2*T-7,W,5,'#a6864e');
  for(const x of [4,8,21,25]){rect(c,x*T,13,T,35,'#75283b');poly(c,[[x*T,48],[(x+.5)*T,59],[(x+1)*T,48]],'#75283b');diamond(c,(x+.5)*T,29,7,'#dbb766');}
  c.fillStyle='#75592d';c.font='bold 12px serif';c.textAlign='center';c.fillText('A U R E L I A   /   R O Y A L   H A L L',15*T,38);
  marble(c,0,H-2*T,W,2*T);rect(c,0,H-2*T,W,5,'#b09050');c.fillStyle='#765c36';c.font='bold 10px serif';c.fillText('鎏 金 宫 殿',15*T,H-18);c.restore();
 }
 function makeObjects(map,v){return map.decor.map(o=>({...o,p:P.project(v,(o.x+(o.w||1)/2)*T,(o.y+(o.h||1))*T-4),depth:(o.y+(o.h||1))*T+v.oy}));}
 function lamp(c,x,y){rect(c,x-3,y-37,6,36,'#a98542');rect(c,x-11,y-4,22,5,'#b39351');line(c,x-15,y-46,x+15,y-46,'#e3bc6a',3);
  for(const dx of [-14,0,14]){line(c,x+dx,y-46,x+dx,y-55,'#c49b4d',3);oval(c,x+dx,y-59,3,6,'#ffe8a3');}diamond(c,x,y-39,5,'#d7b467');}
 function drawObject(c,v,o){const {x,y}=o.p;c.save();
  if(o.kind==='palace-column'){
   oval(c,x+9,y+2,28,9,'rgba(37,27,25,.2)');marble(c,x-22,y-12,44,12);rect(c,x-24,y-13,48,4,'#b39351');
   const g=c.createLinearGradient(x-13,y,x+13,y);g.addColorStop(0,'#b6a383');g.addColorStop(.35,'#f9efd6');g.addColorStop(1,'#b29c78');c.fillStyle=g;c.fillRect(x-14,y-94,28,81);
   for(const dx of [-8,0,8])line(c,x+dx,y-89,x+dx,y-17,'rgba(150,126,83,.45)');marble(c,x-21,y-106,42,12);rect(c,x-23,y-108,46,4,'#d5b05f');
   for(const dx of [-18,18]){c.strokeStyle='#b39351';c.lineWidth=3;c.beginPath();c.arc(x+dx,y-98,6,0,Math.PI*1.7);c.stroke();}
  }
  if(o.kind==='palace-throne'){
   oval(c,x,y+3,40,12,'rgba(49,29,27,.24)');rect(c,x-30,y-66,60,66,'#b69149');rect(c,x-24,y-61,48,55,'#7a2437');
   poly(c,[[x-33,y-66],[x-27,y-92],[x-15,y-80],[x,y-106],[x+15,y-80],[x+27,y-92],[x+33,y-66]],'#d4af5d');diamond(c,x,y-82,8,'#e7d397');
   rect(c,x-26,y-19,52,15,'#a13748');for(const dx of [-34,26]){rect(c,x+dx,y-28,8,32,'#ca9e50');oval(c,x+dx+4,y-31,7,7,'#ebce85');}
   for(const dx of [-22,18])rect(c,x+dx,y-3,5,12,'#b88f44');
  }
  if(o.kind==='palace-lamp')lamp(c,x,y);
  if(o.kind==='palace-planter'){
   rect(c,x-27,y-15,54,16,'#ae9871');rect(c,x-30,y-19,60,6,'#d8c296');for(let i=0;i<7;i++){oval(c,x-23+i*8,y-25-(i%3)*4,9,11,'#46614c');oval(c,x-21+i*8,y-30-(i%3)*4,4,4,i%2?'#e5d6bf':'#b9566a');}
  }
  if(o.kind==='palace-font'){
   oval(c,x,y-1,15,6,'#9a8258');oval(c,x,y-5,17,6,'#e2ce9e');oval(c,x,y-6,12,4,'#78a8b3');diamond(c,x,y-14,5,'#f4e6ad');
  }
  if(o.kind==='palace-entrance'){
   rect(c,x-34,y-32,68,32,'#9d7e46');rect(c,x-28,y-29,56,29,'#3c3240');line(c,x-28,y-29,x-48,y-4,'#d5b16a',4);line(c,x+28,y-29,x+48,y-4,'#d5b16a',4);
  }c.restore();
 }
 function drawLights(c,v,game){c.save();P.apply(c,v);for(const o of game.map.decor.filter(o=>o.kind==='palace-lamp')){
  const x=(o.x+.5)*T,y=(o.y+1)*T-55,g=c.createRadialGradient(x,y,2,x,y,100);g.addColorStop(0,'rgba(255,225,151,.18)');g.addColorStop(1,'rgba(255,225,151,0)');c.fillStyle=g;c.fillRect(x-100,y-100,200,200);
 }c.restore();}
 function drawBattleBackground(c,w,h){c.save();rect(c,0,0,w,h,'#e0cfad');
  for(let i=0;i<5;i++){const x=w*(.1+i*.2);arch(c,x,h*.53,w*.11,h*.43);rect(c,x-w*.07,h*.12,12,h*.43,'#7b283c');rect(c,x+w*.07-12,h*.12,12,h*.43,'#7b283c');}
  rect(c,0,h*.56,w,h*.44,'#d8c7a5');
  for(let y=h*.56;y<h;y+=h*.08)line(c,0,y,w,y,'#bba57e');for(let i=-4;i<13;i++)line(c,w*.5,h*.56,w*i*.13,h,'#bba57e');
  poly(c,[[w*.42,h*.56],[w*.58,h*.56],[w*.75,h],[w*.25,h]],'#7e293d');
  line(c,w*.42,h*.56,w*.25,h,'#d4ae61',3);line(c,w*.58,h*.56,w*.75,h,'#d4ae61',3);
  for(const x of [w*.025,w*.21,w*.77,w*.955]){marble(c,x-12,h*.08,24,h*.49);rect(c,x-22,h*.06,44,14,'#bc9b57');rect(c,x-21,h*.55,42,12,'#c3a263');}
  rect(c,0,h*.025,w,8,'#bc9953');rect(c,0,h*.09,w,4,'#b08b4b');lamp(c,w*.5,h*.22);c.restore();}
 const isCavalry=id=>M.CONFIG.STAGE_PALACE?.enemies.some(u=>u.id===id&&String(u.art).startsWith('palace-cavalier'))||false;
 function drawMounted(c,id,x,y,h,now,state='idle',frame=0,facing='left'){
  const elite=id==='gilded_cavalier',moving=['walk','run','attack'].includes(state),tick=moving?now/95+frame:0,down=state==='down';
  c.save();c.translate(x,y);c.scale(h/70,h/70);if(facing==='left')c.scale(-1,1);
  if(state==='hurt')c.filter='brightness(1.65)';if(down){c.translate(0,-8);c.rotate(facing==='left'?-.9:.9);c.globalAlpha=.65;}
  const metal=elite?'#dbb967':'#aab6c2',shade=elite?'#96723a':'#596a80',cloth=elite?'#8e293e':'#343c68',horse=elite?'#d7ccb2':'#755e54',dark=elite?'#9f8d76':'#443a3c';
  oval(c,0,1,25,5,'rgba(30,24,32,.25)');const front=['up','down'].includes(facing);const bob=moving?Math.sin(tick)*1.5:Math.sin(now/550)*.4;c.translate(0,bob);
  if(elite&&!down){c.strokeStyle='rgba(225,183,87,.55)';c.lineWidth=1.3;c.beginPath();c.ellipse(0,1,29,7,0,0,Math.PI*2);c.stroke();}
  if(front){
   for(const dx of [-9,7]){const step=moving?Math.sin(tick+(dx<0?0:Math.PI))*3:0;rect(c,dx,-18,4,17+step,dark);rect(c,dx-1,-3+step,6,4,'#33333a');}
   oval(c,0,-26,14,20,horse);poly(c,[[-13,-38],[13,-38],[16,-14],[4,-10],[-14,-17]],cloth);line(c,-13,-16,14,-12,metal,2);
   if(facing==='up'){poly(c,[[-10,-47],[11,-47],[14,-23],[-13,-23]],cloth);}
   else{oval(c,0,-25,8,12,horse);rect(c,-5,-34,10,3,dark);rect(c,-6,-19,12,3,shade);rect(c,-4,-29,2,3,'#302e35');rect(c,3,-29,2,3,'#302e35');}
   poly(c,[[-5,-52],[-3,-64],[3,-65],[8,-54]],elite?'#b44250':'#596391');
   line(c,19,-7,19+(state==='attack'?5:0),-63,shade,3);poly(c,[[16,-64],[19,-73],[22,-64]],metal);
   oval(c,-14,-36,8,10,shade);diamond(c,-14,-36,5,metal);
  }else{
   for(let i=0;i<4;i++){const step=moving?Math.sin(tick+(i%2)*Math.PI)*4:0,xx=[-18,-10,10,17][i];poly(c,[[xx,-23],[xx+4,-22],[xx+3+step,-5],[xx+5+step,-2],[xx-1+step,-2],[xx-2,-10]],i%2?dark:horse);rect(c,xx-1+step,-4,7,4,'#30313a');}
   poly(c,[[-26,-36],[-35,-29],[-31,-18],[-27,-24],[-24,-27]],dark);oval(c,-1,-29,25,13,horse);poly(c,[[-23,-28],[-15,-20],[7,-19],[22,-28],[17,-17],[-13,-15]],dark);line(c,-17,-36,7,-39,elite?'#f0e4ca':'#a48a76',2);
   poly(c,[[-20,-38],[10,-40],[16,-18],[-7,-15],[-22,-23]],cloth);line(c,-19,-24,14,-18,metal,2);diamond(c,-5,-26,5,metal);
   poly(c,[[11,-35],[16,-48],[23,-53],[32,-46],[35,-39],[27,-37],[22,-39],[19,-23]],horse);poly(c,[[15,-44],[17,-54],[23,-50],[25,-57],[27,-49]],dark);
   rect(c,29,-46,3,2,'#292c32');rect(c,32,-41,2,2,dark);line(c,18,-49,30,-38,shade,2);line(c,31,-39,4,-32,'#bda473',1.2);line(c,22,-47,29,-44,elite?'#f0e4ca':'#a48a76',2);
   poly(c,[[-13,-52],[1,-51],[4,-33],[-19,-31]],cloth);
   poly(c,[[-6,-55],[-4,-65],[3,-66],[8,-55]],elite?'#bd4551':'#666fa0');line(c,1,-33,-3,-19,shade,5);rect(c,-6,-20,9,4,'#343842');
   const thrust=state==='attack'?Math.min(1,frame/4)*14:0;line(c,-1,-40,38+thrust,-48+thrust*.25,shade,3);poly(c,[[37+thrust,-51+thrust*.25],[46+thrust,-49+thrust*.25],[37+thrust,-45+thrust*.25]],metal);
   oval(c,-6,-39,8,10,shade);diamond(c,-6,-39,5,metal);
  }
  // Reuse the same detailed LPC helmet/plate layers as the palace's armored guards.
  const rider=M.WatercourtArt?.images[elite?'warden':'armor'];
  if(rider){const row=facing==='up'?0:facing==='down'?2:3;c.imageSmoothingEnabled=false;c.drawImage(rider,76,row*192+76,44,35,-18,-63,35,28);}
  c.restore();return true;
 }
 for(const key of ['has','hasActions']){const base=C[key];C[key]=id=>isCavalry(id)||base(id);}
 const map=C.drawMap;C.drawMap=function(c,u,x,y,h,now,opts){return isCavalry(u.id)?drawMounted(c,u.id,x,y,h*(u.boss?1.13:1.04),now,u._walking?'walk':'idle',0,u.facing):map(c,u,x,y,h,now,opts);};
 const battle=C.drawBattlePose;C.drawBattlePose=function(c,u,x,y,h,state,frame,facing,action){return isCavalry(u.id)?drawMounted(c,u.id,x,y,h,global.performance?.now()||0,state,frame,facing):battle(c,u,x,y,h,state,frame,facing,action);};
 const portrait=C.drawPortrait;C.drawPortrait=function(c,id,x,y,w,h,opts){if(!isCavalry(id))return portrait(c,id,x,y,w,h,opts);c.save();c.beginPath();c.rect(x,y,w,h);c.clip();const size=Math.min(w*1.15,h*.93);drawMounted(c,id,x+w/2,y+h,size,0,'idle',0,'left');c.restore();return true;};
 M.PalaceArt={isCavalry,drawMounted};M.PalaceMap={drawGround,makeObjects,drawObject,drawLights,drawBattleBackground};
})(window);
