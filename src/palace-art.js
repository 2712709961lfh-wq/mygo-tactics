/* Credited LPC mounted animation and gold-and-ivory royal hall. */
(function(global){
 'use strict';const M=global.MyGO,T=M.CONFIG.TILE,P=M.MapProjection,C=M.Characters;
 const images={},files={cavalier:'cavalier-actions.png',elite:'elite-actions.png',scenery:'palace-scenery.png'};
 function load(){return Promise.all(Object.entries(files).map(([key,file])=>new Promise(resolve=>{
  const im=new Image();im.onload=()=>{images[key]=im;resolve(true);};im.onerror=()=>resolve(false);
  im.src=(global.MYGO_MAP_DATA||{})['palace'+key]||'assets/chapter-ten/'+file;
 })));}
 const scenery={stone:[0,0,32,32],carpet:[32,0,160,96],crest:[192,0,32,32],plinth:[224,0,32,96],bust:[256,0,32,32],banner:[288,0,32,96],plant:[320,0,32,64],window:[352,0,32,64],brazier:[384,0,32,32]};
 function decorSprite(c,name,x,y,w,h){if(!images.scenery)return false;const a=scenery[name];c.imageSmoothingEnabled=false;c.drawImage(images.scenery,...a,x,y,w,h);return true;}
 const rect=(c,x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
 function line(c,x,y,xx,yy,color,width=1){c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x,y);c.lineTo(xx,yy);c.stroke();}
 function poly(c,points,color){c.fillStyle=color;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();}
 function oval(c,x,y,rx,ry,color){c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();}
 function diamond(c,x,y,r,color){poly(c,[[x,y-r],[x+r,y],[x,y+r],[x-r,y]],color);}
 function marble(c,x,y,w,h){const g=c.createLinearGradient(x,y,x+w,y+h);g.addColorStop(0,'#f1e6cf');g.addColorStop(.45,'#dfd3b8');g.addColorStop(1,'#c9bc9f');c.fillStyle=g;c.fillRect(x,y,w,h);
  line(c,x+5,y+h*.66,x+w*.5,y+h*.3,'rgba(135,117,93,.12)');line(c,x+w*.5,y+h*.3,x+w-2,y+h*.36,'rgba(135,117,93,.12)');}
 function carpet(c,x,y,w,h){rect(c,x,y,w,h,'#6f1f35');rect(c,x+5,y,w-10,h,'#8d2a40');line(c,x+4,y,x+4,y+h,'#d4ad5d',2);line(c,x+w-4,y,x+w-4,y+h,'#d4ad5d',2);
  if(images.scenery&&h>=32){
   for(let yy=0;yy<h;yy+=32)for(let xx=0;xx<w;xx+=32){
    const col=xx===0?0:xx+32>=w?4:2,row=yy===0?0:yy+32>=h?2:1;
    c.drawImage(images.scenery,32+col*32,row*32,32,32,x+xx,y+yy,Math.min(32,w-xx),Math.min(32,h-yy));
   }
  }
  for(let yy=y+16;yy<y+h;yy+=32){diamond(c,x+11,yy,3,'#cb9d55');diamond(c,x+w-11,yy,3,'#cb9d55');}}
 function arch(c,x,y,w,h){c.save();c.beginPath();c.moveTo(x-w/2,y);c.lineTo(x-w/2,y-h+w/2);c.arc(x,y-h+w/2,w/2,Math.PI,0);c.lineTo(x+w/2,y);c.closePath();
  const g=c.createLinearGradient(x,y-h,x,y);g.addColorStop(0,'#223954');g.addColorStop(.65,'#57778d');g.addColorStop(1,'#c1b99a');c.fillStyle=g;c.fill();c.strokeStyle='#b69351';c.lineWidth=4;c.stroke();
  line(c,x,y-h+2,x,y,'#dec693',2);line(c,x-w/2,y-h*.42,x+w/2,y-h*.42,'#dec693',2);c.restore();}
 function drawGround(c,map){const W=map.cols*T,H=map.rows*T;c.save();rect(c,0,0,W,H,'#302a32');
  for(let y=2;y<map.rows-2;y++)for(let x=2;x<map.cols-2;x++){
   marble(c,x*T,y*T,T,T);decorSprite(c,'stone',x*T,y*T,T,T);
   if(x<8||x>21){rect(c,x*T,y*T,T,T,(x+y)%2?'rgba(39,62,73,.12)':'rgba(255,246,213,.2)');}
   c.strokeStyle='rgba(105,83,51,.22)';c.lineWidth=.6;c.strokeRect(x*T+.5,y*T+.5,T-1,T-1);
   if((x+y)%4===0&&x>=8&&x<=21)diamond(c,(x+.5)*T,(y+.5)*T,3,'#b3a17b');
  }
  // Two broad arcades and a processional carpet: every accent follows the grid.
  for(const x of [3,10,19,26]){rect(c,x*T+3,2*T,2,(map.rows-4)*T,'#b89c61');rect(c,x*T+7,2*T,1,(map.rows-4)*T,'#f5e5b7');}
  carpet(c,13*T,5*T,4*T,29*T);
  // Gallery runners frame clear flanking lanes, with mosaic roundels at each bay.
  for(const x of [5.5,24.5])for(const y of [9,20,29]){
   const cx=x*T,cy=y*T;c.strokeStyle='#9a8762';c.lineWidth=2;c.beginPath();c.arc(cx,cy,25,0,Math.PI*2);c.stroke();
   for(let i=0;i<8;i++){const a=i*Math.PI/4;diamond(c,cx+Math.cos(a)*18,cy+Math.sin(a)*18,3,i%2?'#68808b':'#ad8e55');}
   diamond(c,cx,cy,10,'#566a73');diamond(c,cx,cy,6,'#d8bf88');
  }
  for(const y of [10,21,28]){rect(c,2*T,y*T,(map.cols-4)*T,2,'#b59758');rect(c,2*T,y*T+4,(map.cols-4)*T,1,'#faf0d3');carpet(c,13*T,y*T,4*T,6);}
  // The raised throne platform remains a broad, accessible plaza, with three shallow steps.
  marble(c,10*T,2*T,10*T,5*T);c.strokeStyle='#b08c45';c.lineWidth=3;c.strokeRect(10*T+3,2*T+3,10*T-6,5*T-6);
  carpet(c,13*T,2*T+4,4*T,5*T-5);for(let i=0;i<3;i++)line(c,10*T,7*T+i*5,20*T,7*T+i*5,i===0?'#9b8259':'#eee1be',2);
  const cx=15*T,cy=25*T;c.strokeStyle='rgba(173,136,68,.55)';c.lineWidth=3;c.beginPath();c.ellipse(cx,cy,2.7*T,2.7*T,0,0,Math.PI*2);c.stroke();
  c.beginPath();c.ellipse(cx,cy,2.4*T,2.4*T,0,0,Math.PI*2);c.stroke();
  for(let i=0;i<16;i++){const a=i*Math.PI/8;diamond(c,cx+Math.cos(a)*2.55*T,cy+Math.sin(a)*2.55*T,4,'#ccb16c');}
  diamond(c,cx,cy,24,'#d4b36b');diamond(c,cx,cy,15,'#872b40');
  // Ornate outer walls, tall arched windows and burgundy hangings.
  for(const x of [0,W-2*T]){marble(c,x,0,2*T,H);rect(c,x+4,0,5,H,'#b39152');rect(c,x+2*T-9,0,5,H,'#b39152');
   for(let y=5*T;y<H-3*T;y+=7*T){arch(c,x+T,y,36,94);rect(c,x+6,y-94,7,102,'#6c2538');rect(c,x+2*T-13,y-94,7,102,'#6c2538');rect(c,x+3,y-99,2*T-6,5,'#d4af63');}}
  marble(c,0,0,W,2*T);rect(c,0,5,W,5,'#b79759');rect(c,0,2*T-7,W,5,'#a6864e');
  for(const x of [4,8,21,25]){rect(c,x*T,13,T,35,'#75283b');poly(c,[[x*T,48],[(x+.5)*T,59],[(x+1)*T,48]],'#75283b');diamond(c,(x+.5)*T,29,7,'#dbb766');}
  c.fillStyle='#75592d';c.font='bold 12px serif';c.textAlign='center';c.fillText('A U R E L I A   /   R O Y A L   H A L L',15*T,38);
  marble(c,0,H-2*T,W,2*T);rect(c,0,H-2*T,W,5,'#b09050');c.fillStyle='#765c36';c.font='bold 10px serif';c.fillText('鎏 金 宫 殿',15*T,H-18);c.restore();
  // Ground shadows are painted below pieces, making walls and columns feel solid.
  c.save();const edge=c.createLinearGradient(2*T,0,5*T,0);edge.addColorStop(0,'rgba(34,28,40,.24)');edge.addColorStop(1,'rgba(34,28,40,0)');c.fillStyle=edge;c.fillRect(2*T,2*T,3*T,H-4*T);
  const right=c.createLinearGradient(W-5*T,0,W-2*T,0);right.addColorStop(0,'rgba(34,28,40,0)');right.addColorStop(1,'rgba(34,28,40,.24)');c.fillStyle=right;c.fillRect(W-5*T,2*T,3*T,H-4*T);c.restore();
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
   for(const yy of [-30,-72]){rect(c,x-15,y+yy,30,3,'#c6a569');line(c,x-14,y+yy+3,x+14,y+yy+3,'#f4e8c9');}
  }
  if(o.kind==='palace-throne'){
   oval(c,x,y+3,40,12,'rgba(49,29,27,.24)');rect(c,x-30,y-66,60,66,'#b69149');rect(c,x-24,y-61,48,55,'#7a2437');
   poly(c,[[x-33,y-66],[x-27,y-92],[x-15,y-80],[x,y-106],[x+15,y-80],[x+27,y-92],[x+33,y-66]],'#d4af5d');diamond(c,x,y-82,8,'#e7d397');
   rect(c,x-26,y-19,52,15,'#a13748');for(const dx of [-34,26]){rect(c,x+dx,y-28,8,32,'#ca9e50');oval(c,x+dx+4,y-31,7,7,'#ebce85');}
   for(const dx of [-22,18])rect(c,x+dx,y-3,5,12,'#b88f44');
   decorSprite(c,'crest',x-13,y-67,26,26);
  }
  if(o.kind==='palace-banner'){decorSprite(c,'banner',x-14,y-85,28,84);line(c,x-18,y-87,x+18,y-87,'#d1ad67',3);}
  if(o.kind==='palace-statue'){
   oval(c,x+5,y+1,26,8,'rgba(44,38,35,.24)');marble(c,x-28,y-8,56,10);
   decorSprite(c,'plinth',x-17,y-75,34,76);decorSprite(c,'bust',x-23,y-109,46,46);
   line(c,x-19,y-22,x+19,y-22,'#cead68',3);
  }
  if(o.kind==='palace-lamp')lamp(c,x,y);
  if(o.kind==='palace-planter'){
   rect(c,x-27,y-15,54,16,'#ae9871');rect(c,x-30,y-19,60,6,'#d8c296');for(let i=0;i<7;i++){oval(c,x-23+i*8,y-25-(i%3)*4,9,11,'#46614c');oval(c,x-21+i*8,y-30-(i%3)*4,4,4,i%2?'#e5d6bf':'#b9566a');}
   decorSprite(c,'plant',x-16,y-58,32,58);
  }
  if(o.kind==='palace-font'){
   oval(c,x,y-1,24,9,'#9a8258');oval(c,x,y-6,26,9,'#e2ce9e');oval(c,x,y-8,21,6,'#497d91');oval(c,x,y-9,16,4,'#8bc2ca');
   rect(c,x-5,y-30,10,23,'#b9a577');oval(c,x,y-30,14,4,'#dfcc9b');oval(c,x,y-31,10,3,'#70aebb');diamond(c,x,y-40,6,'#f4e6ad');
   for(const dx of [-11,11]){c.strokeStyle='rgba(173,222,229,.8)';c.lineWidth=1.5;c.beginPath();c.moveTo(x,y-30);c.quadraticCurveTo(x+dx,y-28,x+dx,y-10);c.stroke();}
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
 const actions={idle:[0,2],walk:[4,6],run:[8,6],attack:[12,8],hurt:[16,3],down:[20,6],jump:[24,5]};
 function pose(id,state='idle',frame=0,facing='left'){
  const name=actions[state]?state:'idle',spec=actions[name];
  return {kind:id==='gilded_cavalier'?'elite':'cavalier',state:name,count:spec[1],
   frame:Math.max(0,Math.min(spec[1]-1,Math.floor(frame))),row:spec[0]+({up:0,left:1,down:2,right:3}[facing]??1)};
 }
 function drawMounted(c,id,x,y,h,now,state='idle',frame,facing='left'){
  const tick=frame??Math.floor(now/(state==='idle'?400:state==='walk'?115:85))%(actions[state]?.[1]||2),p=pose(id,state,tick,facing),im=images[p.kind];
  if(!im)return false;
  const scale=h/90;c.save();c.imageSmoothingEnabled=false;
  if(id==='gilded_cavalier'&&state!=='down'){
   c.strokeStyle='rgba(223,183,93,.52)';c.lineWidth=1.1;c.beginPath();c.ellipse(x,y+1,h*.34,h*.075,0,0,Math.PI*2);c.stroke();
  }
  c.drawImage(im,p.frame*192,p.row*192,192,192,x-96*scale,y-152*scale,192*scale,192*scale);
  c.restore();return true;
 }
 for(const key of ['has','hasActions']){const base=C[key];C[key]=id=>isCavalry(id)||base(id);}
 const map=C.drawMap;C.drawMap=function(c,u,x,y,h,now,opts){return isCavalry(u.id)?drawMounted(c,u.id,x,y,h*(u.boss?1.42:1.28),now,u._walking?'walk':'idle',undefined,u.facing):map(c,u,x,y,h,now,opts);};
 const battle=C.drawBattlePose;C.drawBattlePose=function(c,u,x,y,h,state,frame,facing,action){return isCavalry(u.id)?drawMounted(c,u.id,x,y,h,global.performance?.now()||0,state,frame,facing):battle(c,u,x,y,h,state,frame,facing,action);};
 const portrait=C.drawPortrait;C.drawPortrait=function(c,id,x,y,w,h,opts){if(!isCavalry(id))return portrait(c,id,x,y,w,h,opts);c.save();c.beginPath();c.rect(x,y,w,h);c.clip();const size=Math.min(w*1.15,h*.93);drawMounted(c,id,x+w/2,y+h,size,0,'idle',0,'left');c.restore();return true;};
 function obscures(o,u){return ['palace-column','palace-statue','palace-throne','palace-planter'].includes(o.kind)&&Math.abs(u.x-(o.x+(o.w||1)/2-.5))<1.6&&u.y<o.y+(o.h||1)&&o.y+(o.h||1)-u.y<3.5;}
 M.PalaceArt={load,images,actions,pose,isCavalry,drawMounted};M.PalaceMap={drawGround,makeObjects,drawObject,drawLights,drawBattleBackground,obscures};
})(window);
