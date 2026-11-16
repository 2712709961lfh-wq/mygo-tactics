/* Original rehearsal-room scenery. Music icons reuse the existing CC0 library. */
(function(global){
 'use strict';const M=global.MyGO,T=M.CONFIG.TILE,P=M.MapProjection;
 function rect(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(x,y,w,h);}
 function line(c,x,y,xx,yy,color,w=1){c.strokeStyle=color;c.lineWidth=w;c.beginPath();c.moveTo(x,y);c.lineTo(xx,yy);c.stroke();}
 function label(c,text,x,y,color='#e5d6bc',size=9){c.fillStyle=color;c.font='bold '+size+'px sans-serif';c.textAlign='center';c.fillText(text,x,y);}
 function speaker(c,x,y,w,h){rect(c,x,y,w,h,'#14181c');rect(c,x+3,y+3,w-6,h-6,'#292c2e');
  for(const yy of [.32,.73]){c.fillStyle='#101418';c.beginPath();c.arc(x+w/2,y+h*yy,w*.26,0,Math.PI*2);c.fill();c.strokeStyle='#4e5253';c.stroke();}
  rect(c,x+4,y+h-6,w-8,2,'#a6a59a');}
 function drum(c,x,y,s){
  const im=M.LivehouseArt?.images.drums;if(im)c.drawImage(im,x-s*.5,y-s*.83,s,s);
  else {c.fillStyle='#a63135';c.beginPath();c.arc(x,y-s*.24,s*.3,0,Math.PI*2);c.fill();}
  for(const dx of [-.43,.4]){line(c,x+dx*s,y-s*.6,x+dx*s,y,'#aab2b5',2);c.fillStyle='#d4bd7c';c.beginPath();c.ellipse(x+dx*s,y-s*.64,s*.22,s*.045,-.1,0,Math.PI*2);c.fill();}
 }
 function drawGround(c,map){
  const W=map.cols*T,H=map.rows*T;c.save();rect(c,0,0,W,H,'#15181c');
  // Warm acoustic panels, reddish practice carpet and a long mirrored wall.
  for(let y=2;y<map.rows-2;y++)for(let x=2;x<map.cols-2;x++){
   rect(c,x*T,y*T,T,T,(x+y)%2?'#67434a':'#624048');
   rect(c,x*T+3,y*T+6,2,1,'#765159');rect(c,x*T+18,y*T+21,1,2,'#53363e');
   line(c,x*T,y*T,(x+1)*T,y*T,'rgba(35,20,26,.16)');
  }
  for(let x=2;x<map.cols-2;x++){
   rect(c,x*T,0,T,2*T,'#c2b394');rect(c,x*T+2,4,T-4,39,(x%3)?'#b8aa8e':'#aa9a80');
   for(let i=5;i<29;i+=5)for(let j=9;j<36;j+=5)rect(c,x*T+i,j,1,1,'#857862');
   rect(c,x*T,45,T,18,'#46494a');line(c,x*T,62,(x+1)*T,62,'#c5b59a',2);
  }
  for(let y=2;y<map.rows-2;y++){
   rect(c,0,y*T,2*T,T,'#8f8576');rect(c,7,y*T+1,49,T-2,'#313c43');
   line(c,13,y*T+26,52,y*T+4,'#64777b');line(c,28,y*T+31,54,y*T+8,'#46565d',2);
   rect(c,W-2*T,y*T,2*T,T,'#b9ac94');
   for(let j=4;j<30;j+=6)line(c,W-57,y*T+j,W-7,y*T+j,'#a2957f');
   if(y%5===3){rect(c,W-53,y*T+3,43,22,'#363a3b');label(c,'STUDIO',W-32,y*T+17,'#c8bda5',6);}
  }
  rect(c,0,H-2*T,W,2*T,'#68635c');
  for(let i=0;i<8;i++){const x=(19+i%4)*T,y=9+Math.floor(i/4)*19;rect(c,x+3,y,23,17,['#dfd3ad','#b58173','#aeb7a7','#d2bd8c'][i%4]);rect(c,x+6,y+3,17,3,'#655e58');line(c,x+6,y+10,x+19,y+10,'#9c8f7d');}
  for(let y=7;y<31;y++){
   rect(c,12*T,y*T,4*T,T,'#463d43');line(c,12*T+3,y*T,12*T+3,(y+1)*T,'#aaa089');line(c,16*T-3,y*T,16*T-3,(y+1)*T,'#aaa089');
   if(y%5===0){c.save();c.globalAlpha=.5;c.fillStyle='#d4c39d';c.beginPath();c.moveTo(14*T,y*T+8);c.lineTo(14*T-7,y*T+16);c.lineTo(14*T+7,y*T+16);c.fill();c.restore();}
  }
  // Drum and keyboard rugs, rehearsal tape marks and untidy instrument cables.
  for(const [x,y,w,h] of [[4,3,5,4],[19,3,5,3]]){rect(c,x*T,y*T,w*T,h*T,'#40343b');c.strokeStyle='#8e7969';c.strokeRect(x*T+3,y*T+3,w*T-6,h*T-6);}
  for(const [x,y] of [[10,5],[17,6],[21,8],[7,7]]){line(c,x*T-5,y*T,x*T+5,y*T,'#c3baa3',2);line(c,x*T,y*T-5,x*T,y*T+5,'#c3baa3',2);}
  c.strokeStyle='#202129';c.lineWidth=2;c.beginPath();c.moveTo(7*T,5*T);c.bezierCurveTo(10*T,8*T,5*T,10*T,11*T,10*T);c.stroke();
  c.beginPath();c.moveTo(22*T,5*T);c.bezierCurveTo(16*T,7*T,23*T,11*T,18*T,9*T);c.stroke();
  label(c,'REHEARSAL  /  09',7*T,59,'#e2d7b9',10);label(c,'REHEARSAL ROOM',20*T,59,'#e2d7b9',9);
  label(c,'休息室入口',14*T,H-24,'#e4d9bc',10);
  c.restore();
 }
 function makeObjects(map,v){return map.decor.map(o=>({...o,p:P.project(v,(o.x+(o.w||1)/2)*T,(o.y+(o.h||1)) *T-4),depth:(o.y+(o.h||1))*T+v.oy}));}
 function drawObject(c,v,o){
  const {x,y}=o.p,w=(o.w||1)*T;c.save();
  if(o.kind==='amp'){speaker(c,x-w/2,y-42,w,42);label(c,'REHEARSAL',x,y-4,'#ccc0a6',6);}
  if(o.kind==='drums')drum(c,x,y,90);
  if(o.kind==='keyboard'){
   line(c,x-w*.35,y-28,x+w*.3,y,'#a4aba9',3);line(c,x+w*.35,y-28,x-w*.3,y,'#a4aba9',3);
   rect(c,x-w/2,y-39,w,17,'#20262c');rect(c,x-w/2+4,y-32,w-8,9,'#e1e0d2');
   for(let i=0;i<18;i++)rect(c,x-w/2+5+i*5,y-32,2,5,i%7===2||i%7===6?'#e1e0d2':'#1e252a');
  }
  if(o.kind==='mic'){line(c,x,y-41,x,y,'#a4aaa8',2);line(c,x,y-41,x+14,y-46,'#adb6b3',2);rect(c,x+10,y-49,12,5,'#22282d');for(const dx of [-10,10])line(c,x,y-5,x+dx,y,'#939997',2);}
  if(o.kind==='guitar'){
   const im=M.LivehouseArt?.images.guitar;if(im)c.drawImage(im,x-17,y-56,34,56);
   line(c,x,y-10,x-12,y,'#878d89',2);line(c,x,y-10,x+12,y,'#878d89',2);
  }
  if(o.kind==='sofa'){rect(c,x-w/2,y-34,w,32,'#333d3d');rect(c,x-w/2+5,y-28,w-10,13,'#65716b');rect(c,x-w/2+7,y-13,w-14,10,'#58655f');line(c,x,y-14,x,y-2,'#303c37',2);}
  if(o.kind==='table'){rect(c,x-w/2,y-18,w,14,'#967858');line(c,x-w/2+5,y-4,x-w/2+5,y,'#403f3a',3);rect(c,x-8,y-24,8,7,'#ddd6bd');rect(c,x+6,y-22,14,3,'#b6bdb7');}
  if(o.kind==='rack'){rect(c,x-w/2,y-45,w,45,'#21262b');for(let i=0;i<3;i++){line(c,x-22+i*20,y-4,x-20+i*20,y-45,'#bf8565',4);c.fillStyle=['#ae5446','#b7a885','#637c8a'][i];c.beginPath();c.ellipse(x-22+i*20,y-13,8,13,.15,0,Math.PI*2);c.fill();}}
  if(o.kind==='cases'){for(let i=0;i<3;i++){rect(c,x-w/2+i*6,y-25-i*10,w-12,24,'#30343c');c.strokeStyle='#92928a';c.strokeRect(x-w/2+i*6,y-25-i*10,w-12,24);rect(c,x-6,y-17-i*10,12,3,'#989b95');}}
  if(o.kind==='entrance'){rect(c,x-28,y-14,56,14,'#252e32');label(c,'LOUNGE',x,y-3,'#c7bc9c',8);}
  // Door is dynamic and rendered separately, including during the opening movie.
  c.restore();
 }
 function drawLights(c,v,game){c.save();P.apply(c,v);
  for(let y=4;y<31;y+=7)for(const x of [4,23]){const px=x*T,py=y*T,g=c.createRadialGradient(px,py,4,px,py,95);g.addColorStop(0,'rgba(255,228,178,.11)');g.addColorStop(1,'rgba(255,228,178,0)');c.fillStyle=g;c.fillRect(px-95,py-95,190,190);rect(c,px-20,py-3,40,4,'#ddd9bd');}
  c.restore();
 }
 function door(c,x,y,opened,alpha,now){
  c.save();c.globalAlpha=alpha;const pulse=.7+.3*Math.sin(now/500);
  c.shadowColor='#86d9ef';c.shadowBlur=12;rect(c,x-28,y-77,56,80,'#7a8594');rect(c,x-24,y-73,48,76,'#252737');
  if(opened){const g=c.createLinearGradient(x-21,y-70,x+21,y);g.addColorStop(0,'#f5f2d4');g.addColorStop(.45,'#a5e7f0');g.addColorStop(1,'#5b71ad');c.fillStyle=g;c.fillRect(x-21,y-70,42,70);}
  else {rect(c,x-20,y-69,40,69,'#3b344d');c.strokeStyle='#9cc7dd';c.lineWidth=1.5;c.strokeRect(x-15,y-63,30,54);label(c,'◇',x,y-31,'#c9edf3',24);rect(c,x+11,y-20,3,6,'#ecd59b');}
  c.shadowBlur=0;c.strokeStyle='rgba(171,219,246,'+pulse+')';c.lineWidth=2;c.beginPath();c.ellipse(x,y+3,43,10,0,0,Math.PI*2);c.stroke();
  for(let i=0;i<8;i++){const t=now/1400+i*.79;c.fillStyle='#c4edff';c.fillRect(x+Math.cos(t)*35,y-30+Math.sin(t*1.2)*39,2,4);}
  c.restore();
 }
 function aura(c,x,y,h,now){c.save();c.globalCompositeOperation='screen';
  const g=c.createRadialGradient(x,y-h*.4,0,x,y-h*.4,h*.8);g.addColorStop(0,'rgba(105,202,255,.22)');g.addColorStop(1,'rgba(80,130,230,0)');c.fillStyle=g;c.fillRect(x-h,y-h*1.3,h*2,h*1.7);
  c.strokeStyle='#b7e5ff';c.lineWidth=Math.max(1,h*.022);c.shadowColor='#78bfff';c.shadowBlur=8;
  for(const r of [.44,.59]){c.beginPath();c.ellipse(x,y-h*.26,h*r,h*r*.28,Math.sin(now/1300)*.12,0,Math.PI*2);c.stroke();}
  for(let i=0;i<7;i++){const t=now/1000+i*.9,px=x+Math.cos(t)*h*.58,py=y-h*.43+Math.sin(t*.7)*h*.56;c.save();c.translate(px,py);c.rotate(t);rect(c,-1,-5,2,10,'#d9f6ff');c.restore();}
  c.restore();
 }
 function drawEffects(c,v,game,now){
  const p=P.project(v,(game.mission.door.x+.5)*T,(game.mission.door.y+1)*T-2),alpha=game._liveIntro?.doorAlpha??1;
  door(c,p.x,p.y,game.stage===10||game.gateOpen,alpha,now);
  if(alpha>.5){c.save();c.globalAlpha=alpha;label(c,game.stage===10?'回环之门':game.gateOpen?'出口已开启':'奇怪的门 · 钥匙开启',p.x,p.y+23,'#c5ecf4',10);c.restore();}
  if(game.gateOpen&&game._doorOpenedAt){const t=Math.max(0,Math.min(1,(now-game._doorOpenedAt)/1400));if(t<1){c.save();c.globalAlpha=(1-t)*.55;c.strokeStyle='#d2f4ff';c.lineWidth=5*(1-t);c.beginPath();c.ellipse(p.x,p.y,t*190,t*70,0,0,Math.PI*2);c.stroke();c.restore();}}
 }
 function drawBattleBackground(c,w,h){
  c.save();rect(c,0,0,w,h,'#373c3e');
  for(let x=0;x<w;x+=65){rect(c,x+2,8,61,h*.57,'#b6a58a');for(let j=18;j<h*.55;j+=8)line(c,x+7,j,x+57,j,'#a49680');}
  rect(c,w*.22,h*.16,w*.56,h*.36,'#46555c');c.strokeStyle='#b9b9a4';c.lineWidth=6;c.strokeRect(w*.22,h*.16,w*.56,h*.36);
  for(let i=0;i<3;i++)line(c,w*(.25+i*.18),h*.48,w*(.39+i*.18),h*.2,'#62757b',2);
  rect(c,0,h*.6,w,h*.4,'#654149');rect(c,0,h*.6,w,5,'#b4a38b');
  speaker(c,w*.04,h*.35,w*.1,h*.34);speaker(c,w*.86,h*.35,w*.1,h*.34);drum(c,w*.67,h*.66,h*.2);
  rect(c,w*.36,h*.01,w*.28,7,'#ede7cb');c.restore();
 }
 // The same aura follows the actual unit in map movement and battle poses.
 const C=M.Characters,map=C.drawMap,battle=C.drawBattlePose,portrait=C.drawPortrait;
 C.drawMap=function(c,u,x,y,h,now,opts){if(u.id==='rift_pegasus')aura(c,x,y,h,now);return map(c,u,x,y,u.id==='rift_pegasus'?h*1.1:h,now,opts);};
 C.drawBattlePose=function(c,u,x,y,h,state,frame,facing,action){const now=global.performance?.now()||0;if(u.id==='rift_pegasus')aura(c,x,y,h,now);const result=battle(c,u,x,y,h,state,frame,facing,action);
  if(u.id==='rift_pegasus'&&state==='attack'){c.save();c.strokeStyle='#e5f7ff';c.shadowColor='#80c9ff';c.shadowBlur=12;const d=facing==='left'?-1:1;line(c,x+d*h*.1,y-h*.4,x+d*h*.74,y-h*.6,'#d1ebff',3);c.restore();}return result;};
 C.drawPortrait=function(c,id,x,y,w,h,opts){if(id==='rift_pegasus')return M.WatercourtArt.draw(c,'court-pegasus-guard-n',x+w/2,y+h,h*.9,0,'idle','left');return portrait(c,id,x,y,w,h,opts);};
 M.RehearsalMap={drawGround,makeObjects,drawObject,drawLights,drawEffects,drawBattleBackground,drawDoor:door};
})(window);
