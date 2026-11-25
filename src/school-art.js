/* Tsukinomori-inspired brickwork and arcades; upright pieces share raised, shaded scenery. */
(function(global){
 'use strict';const M=global.MyGO,T=M.CONFIG.TILE,P=M.MapProjection,C=M.Characters,images={};
 const sprites={window:[0,0,52,68],door:[96,0,32,64],fence:[192,0,64,14],campusOak:[0,128,128,128],campusLinden:[160,128,128,128]};
 function load(){return new Promise(resolve=>{const im=new Image();im.onload=()=>{images.scenery=im;resolve(true);};im.onerror=()=>resolve(false);im.src=(global.MYGO_MAP_DATA||{}).schoolScenery||'assets/chapter-twelve/school-scenery.png';});}
 const rect=(c,x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
 function line(c,x,y,xx,yy,color,width=1){c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x,y);c.lineTo(xx,yy);c.stroke();}
 function oval(c,x,y,rx,ry,color){c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();}
 function poly(c,ps,color){c.fillStyle=color;c.beginPath();ps.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();}
 function sprite(c,name,x,y,w,h){if(!images.scenery)return;c.save();c.imageSmoothingEnabled=false;c.drawImage(images.scenery,...sprites[name],x,y,w,h);c.restore();}
 function label(c,text,x,y,size=11,color='#e6dfc7'){c.fillStyle=color;c.textAlign='center';c.font='bold '+size+'px serif';c.fillText(text,x,y);}
 function clock(c,x,y,r){oval(c,x,y,r+3,r+3,'#ad945f');oval(c,x,y,r,r,'#f0e9d6');for(let i=0;i<12;i++){const a=i*Math.PI/6;line(c,x+Math.sin(a)*r*.8,y-Math.cos(a)*r*.8,x+Math.sin(a)*r*.94,y-Math.cos(a)*r*.94,'#616f70');}line(c,x,y,x-r*.35,y-r*.3,'#485759',2);line(c,x,y,x+r*.1,y-r*.65,'#485759',2);}
 function shadow(c,points,alpha=.2,blur=5){c.save();c.shadowColor='rgba(27,47,43,.25)';c.shadowBlur=blur;c.shadowOffsetX=3;c.shadowOffsetY=3;poly(c,points,'rgba(25,47,39,'+alpha+')');c.restore();}
 function brick(c,x,y,w,h,base='#c8bd96',mortar='rgba(247,240,215,.42)'){
  rect(c,x,y,w,h,base);for(let yy=y+6,row=0;yy<y+h;yy+=7,row++){line(c,x,yy,x+w,yy,mortar,.7);for(let xx=x+(row%2?9:0);xx<x+w;xx+=18)line(c,xx,yy-6,xx,yy,mortar,.7);}
 }
 function archPath(c,x,y,w,h){const r=w/2;c.beginPath();c.moveTo(x,y+h);c.lineTo(x,y+r);c.arc(x+r,y+r,r,Math.PI,Math.PI*2);c.lineTo(x+w,y+h);c.closePath();}
 function archWindow(c,x,y,w,h){
  c.save();rect(c,x-2,y+4,w+5,h,'rgba(62,72,65,.19)');archPath(c,x-3,y-3,w+6,h+6);c.fillStyle='#f1eddb';c.fill();
  archPath(c,x,y,w,h);const glass=c.createLinearGradient(x,y,x+w,y+h);glass.addColorStop(0,'#adc9cc');glass.addColorStop(.35,'#71989e');glass.addColorStop(1,'#43696f');c.fillStyle=glass;c.fill();
  c.save();archPath(c,x+2,y+2,w-4,h-4);c.clip();poly(c,[[x+3,y+2],[x+w*.58,y+2],[x+w*.29,y+h],[x+1,y+h]],'rgba(226,243,235,.2)');
  for(let j=1;j<4;j++)line(c,x,y+w/2+j*(h-w/2)/4,x+w,y+w/2+j*(h-w/2)/4,'#cadcd4',1);
  for(const f of [1/3,2/3])line(c,x+w*f,y+2,x+w*f,y+h,'#c2d3ca',1);c.restore();
  archPath(c,x,y,w,h);c.strokeStyle='#68878a';c.lineWidth=1.4;c.stroke();line(c,x+w/2,y+1,x+w/2,y+h,'#d9e1d3',1.5);
  rect(c,x-5,y+h+1,w+10,4,'#f5eed9');rect(c,x-4,y+h+5,w+11,2,'#9f9e83');
  c.strokeStyle='#f8f3e2';c.lineWidth=1;c.beginPath();c.arc(x+w/2,y+w/2,w/2+5,Math.PI,Math.PI*2);c.stroke();c.restore();
 }
 function course(c,x,y,w){rect(c,x-3,y+3,w+9,4,'rgba(56,65,55,.2)');rect(c,x-4,y-2,w+8,5,'#eae6d1');line(c,x-4,y-3,x+w+4,y-3,'#faf5e4',1.5);line(c,x-3,y+3,x+w+5,y+3,'#a9a88a');}
 function facade(c,x,y,w,h,tower=false){
  c.save();const left=x+3,right=x+w-21,base=y+h-1,top=y+33,depth=20;
  shadow(c,[[left+6,base-2],[right+depth,base-19],[right+depth+34,base+13],[left+32,base+23]],.17,8);
  poly(c,[[right,top],[right+depth,top-19],[right+depth,base-19],[right,base]],'#9b9f88');
  for(let yy=top+8;yy<base;yy+=9)line(c,right,yy,right+depth,yy-19,'#c8c6a6',.7);
  brick(c,left,top,right-left,base-top,'#c8bd95');
  const glow=c.createLinearGradient(left,top,right,base);glow.addColorStop(0,'rgba(255,248,218,.25)');glow.addColorStop(.7,'rgba(230,223,189,0)');glow.addColorStop(1,'rgba(67,89,81,.14)');c.fillStyle=glow;c.fillRect(left,top,right-left,base-top);
  const floors=3,floorH=(base-top-17)/floors,spacing=tower?47:46,count=Math.max(2,Math.floor((right-left-20)/spacing));
  for(let row=0;row<floors;row++){
   const wy=top+12+row*floorH,wh=Math.max(23,floorH-16),ww=Math.min(25,(right-left-26)/count*.62);
   for(let i=0;i<count;i++){const wx=left+15+(i+.5)*(right-left-30)/count-ww/2;if(tower&&Math.abs(wx+ww/2-(x+w/2))<57)continue;archWindow(c,wx,wy,ww,wh);}
   if(row>0)course(c,left,top+row*floorH+2,right-left);
   const sy=top+12+row*floorH;poly(c,[[right+6,sy],[right+15,sy-8],[right+15,sy+wh-8],[right+6,sy+wh]],'#547477');line(c,right+10,sy-3,right+10,sy+wh-3,'#c7d3c4');
  }
  for(let i=0;i<=count;i+=2){const px=left+12.5+i*(right-left-30)/count;rect(c,px+5,top,3,base-top-9,'rgba(59,72,59,.17)');rect(c,px,top,5,base-top-8,'#ede6cd');}
  course(c,left,top-2,right-left);course(c,left,base-10,right-left);rect(c,left,base-5,right-left,6,'#aba98e');
  // Visible roof planes, a shaded return, standing seams and a projecting eave.
  poly(c,[[left-7,top-6],[left+21,y+2],[right-10,y+2],[right+10,top-6]],'#607a76');
  poly(c,[[right-10,y+2],[right+depth+3,y-14],[right+depth+9,top-24],[right+10,top-6]],'#3e5d5e');
  poly(c,[[left+21,y+2],[left+depth+24,y-14],[right+depth+3,y-14],[right-10,y+2]],'#7b9187');
  for(let px=left+23;px<right-10;px+=26)line(c,px,y+3,px-14,top-7,'#8a9d8d',.8);
  for(let yy=y+9;yy<top-6;yy+=8)line(c,left+17-(yy-y)*.5,yy,right-8+(yy-y)*.4,yy,'rgba(38,65,65,.35)');
  line(c,left-7,top-7,right+10,top-7,'#c7ccb6',2);rect(c,left-6,top-5,right-left+15,5,'#f0ead2');
  for(let px=left+8;px<right;px+=20){c.fillStyle='#8c9a8c';archPath(c,px,top-1,9,8);c.fill();}
  for(const px of [left+3,right-4]){line(c,px,top+6,px,base-7,'#8e9b87',2);line(c,px-1,top+6,px-1,base-7,'#d8d7ba');}
  if(tower){
   const tx=x+w/2-43,tw=86,tt=y-20;
   poly(c,[[tx+tw,tt],[tx+tw+13,tt-12],[tx+tw+13,base-12],[tx+tw,base]],'#a3a58c');
   shadow(c,[[tx+tw,tt+16],[tx+tw+15,tt+20],[tx+tw+15,base],[tx+tw,base]],.15,2);
   brick(c,tx,tt,tw,base-tt,'#d6cbab');
   for(const dx of [0,tw-8]){rect(c,tx+dx,tt,8,base-tt,'#eeead7');line(c,tx+dx+7,tt,tx+dx+7,base,'#a5ad96');}
   poly(c,[[tx-6,tt-3],[tx+12,tt-31],[tx+tw-15,tt-31],[tx+tw+7,tt-3]],'#5c7772');
   poly(c,[[tx+tw-15,tt-31],[tx+tw-4,tt-41],[tx+tw+20,tt-15],[tx+tw+7,tt-3]],'#3e605e');
   poly(c,[[tx+12,tt-31],[tx+23,tt-41],[tx+tw-4,tt-41],[tx+tw-15,tt-31]],'#8d9e8b');
   course(c,tx,tt,tw);clock(c,tx+tw/2,tt+29,19);
   rect(c,tx+13,tt+52,60,3,'#f2ecd6');archWindow(c,tx+28,tt+66,30,49);
   const ey=base-63;archPath(c,tx+17,ey-5,52,66);c.fillStyle='#eee7d1';c.fill();archPath(c,tx+22,ey,42,60);c.fillStyle='#435d5b';c.fill();
   sprite(c,'door',tx+26,base-51,34,50);
   for(let i=0;i<3;i++){rect(c,tx+10-i*3,base-1+i*3,tw-20+i*6,3,'#dcd4bc');line(c,tx+10-i*3,base-1+i*3,tx+tw-10+i*3,base-1+i*3,'#f8f0da');}
   rect(c,tx+8,ey-20,tw-16,12,'#425d59');label(c,'月ノ森女子学園',tx+tw/2,ey-11,8,'#e6e4c7');
  }
  c.restore();
 }
 function drawGround(c,map){c.save();const W=map.cols*T,H=map.rows*T;rect(c,0,0,W,H,'#364b43');
  for(let y=0;y<map.rows;y++)for(let x=0;x<map.cols;x++){const px=x*T,py=y*T,type=map.tiles[y][x];
   if(['road','plaza','fort'].includes(type)){rect(c,px,py,T,T,type==='road'?'#d3ccba':'#bec6bc');line(c,px,py,px+T,py,'#a4afa7');line(c,px,py,px,py+T,'#a4afa7');line(c,px+1,py+1,px+30,py+1,'rgba(246,243,225,.55)');
    if(type==='road'&&(x===14||x===19))rect(c,px+(x===14?2:28),py,2,T,'#9c916f');
   }else{rect(c,px,py,T,T,(x+y)%2?'#72916c':'#76956d');for(let i=0;i<7;i++)rect(c,px+(x*7+i*11)%30,py+(y*5+i*9)%30,2,1,i%2?'#88a477':'#648765');}
  }
  for(const y of [24,28]){c.strokeStyle='#99a591';c.lineWidth=1;c.strokeRect(14*T+10,y*T,6*T-20,2*T);}
  const cx=17*T,cy=23*T;c.strokeStyle='#a7ab8d';c.lineWidth=3;c.beginPath();c.ellipse(cx,cy,65,39,0,0,Math.PI*2);c.stroke();
  oval(c,cx,cy,21,14,'#afb49b');
  for(const x of [14,20]){line(c,x*T-2,9*T,x*T-2,36*T,'rgba(56,74,62,.21)',4);line(c,x*T-4,9*T,x*T-4,36*T,'#eee6cb',2);}
  for(const x of [1,32]){rect(c,x*T,2*T,T,34*T,'#b7b8a4');rect(c,x*T+3,2*T,4,34*T,'#e0dec4');rect(c,(x+1)*T-4,2*T,4,34*T,'#7c8d7c');for(let y=3;y<36;y+=2){c.save();c.translate((x+.5)*T,y*T);c.rotate(Math.PI/2);sprite(c,'fence',-32,-7,64,14);c.restore();}}
  rect(c,0,36*T,W,2*T,'#a5ada8');for(const x of [0,20*T])rect(c,x,36*T,14*T,3,'#e6e2ca');label(c,'T S U K I N O M O R I   G I R L S ’   A C A D E M Y',W/2,37*T+20,10,'#405957');c.restore();
 }
 function makeObjects(map,v){return map.decor.map(o=>({...o,p:P.project(v,(o.x+(o.w||1)/2)*T,(o.y+(o.h||1))*T-4),depth:(o.y+(o.h||1))*T+v.oy}));}
 function pillar(c,x,y){
  shadow(c,[[x-15,y],[x+18,y-9],[x+43,y+13],[x+6,y+21]],.19,4);
  poly(c,[[x+12,y-75],[x+22,y-83],[x+22,y-7],[x+12,y+1]],'#9d9f8a');brick(c,x-12,y-75,24,76,'#dfd6ba');
  for(let yy=y-65;yy<y;yy+=17){rect(c,x-13,yy,26,3,'#eee5cb');line(c,x-12,yy+3,x+12,yy+3,'#b1b29b');}
  for(const [yy,ww,hh] of [[y-78,34,7],[y-85,29,7],[y-5,33,8]]){
   rect(c,x-ww/2,yy,ww,hh,'#d8d0b4');poly(c,[[x-ww/2,yy],[x-ww/2+10,yy-8],[x+ww/2+10,yy-8],[x+ww/2,yy]],'#f0e7cb');poly(c,[[x+ww/2,yy],[x+ww/2+10,yy-8],[x+ww/2+10,yy+hh-8],[x+ww/2,yy+hh]],'#a8aa92');line(c,x-ww/2,yy,x+ww/2,yy,'#faf0d7');
  }
  oval(c,x+5,y-92,6,5,'#9ba58e');oval(c,x+3,y-94,4,4,'#e2d8b5');
  rect(c,x-6,y-60,12,20,'#698277');rect(c,x-4,y-58,8,16,'#b5c0a1');line(c,x-1,y-57,x-1,y-44,'#e1dbb8');
 }
 function gateLeaf(c,hinge,y,side){
  const dx=side*48,dy=18,edge=hinge+dx;shadow(c,[[hinge,y],[edge,y+dy],[edge+17,y+dy+9],[hinge+13,y+7]],.17,3);
  poly(c,[[hinge,y-57],[edge,y-57+dy],[edge,y+dy],[hinge,y]],'rgba(45,78,71,.08)');
  for(const t of [0,1])line(c,hinge+dx*t,y-57+dy*t,hinge+dx*t,y+dy*t,'#365952',2.5);
  for(let i=1;i<8;i++){const t=i/8,xx=hinge+dx*t;line(c,xx,y-56+dy*t,xx,y-2+dy*t,'#263f43',1.8);line(c,xx-side*.8,y-54+dy*t,xx-side*.8,y-3+dy*t,'#a1b4a0',.6);poly(c,[[xx,y-61+dy*t],[xx+2,y-56+dy*t],[xx-2,y-56+dy*t]],'#c5b681');}
  for(const yy of [-48,-18,-7])line(c,hinge, y+yy,edge,y+yy+dy,'#b7b18a',1.1);
  c.strokeStyle='#bcc0a0';c.lineWidth=1;c.beginPath();c.ellipse(hinge+dx*.5,y-30+dy*.5,5,9,-side*.45,0,Math.PI*2);c.stroke();
  for(const yy of [-45,-13])oval(c,hinge+side*2,y+yy,2,2,'#b7ad79');
 }
 function gate(c,x,y,w){c.save();const base=y-7;
  for(const side of [-1,1]){const xx=x+side*w/2;gateLeaf(c,xx-side*13,base,side);pillar(c,xx,base);}
  line(c,x-w/2+17,base+7,x+w/2-13,base+7,'#d9d8bd',2);
  for(let i=-2;i<=2;i++)line(c,x+i*25,base+3,x+i*25+5,base-2,'rgba(83,105,93,.32)');c.restore();
 }
 function tree(c,x,y,variant=0,scale=1){
  const width=(variant?107:112)*scale,height=122*scale;
  oval(c,x+15*scale,y+3*scale,38*scale,12*scale,'rgba(31,57,42,.17)');
  oval(c,x,y-1,15*scale,7*scale,'#b2b6a0');oval(c,x,y-2,11*scale,5*scale,'#6b7762');
  sprite(c,variant?'campusLinden':'campusOak',x-width/2,y-height+5,width,height);
 }
 function flowerBed(c,x,y,w,h,variant=0){
  const left=x-w/2,top=y-h+8,z=11,dx=7;
  shadow(c,[[left+4,y-2],[left+w,y-3],[left+w+15,y+9],[left+16,y+12]],.19,5);
  poly(c,[[left+w-5,top-z],[left+w+dx,top-z-5],[left+w+dx,y-5],[left+w-5,y]],'#929983');
  brick(c,left,top,w-5,h-8,'#cbc9ad','rgba(244,237,207,.42)');
  rect(c,left+5,top-z+4,w-15,h-15,'#526849');
  c.save();c.beginPath();c.rect(left+6,top-z+5,w-17,h-17);c.clip();
  const soil=c.createLinearGradient(left,top,left+w,y);soil.addColorStop(0,'#526e4a');soil.addColorStop(1,'#344d3b');c.fillStyle=soil;c.fillRect(left+6,top-z+5,w-17,h-17);
  for(let yy=top-z+9,row=0;yy<y-13;yy+=18,row++)for(let xx=left+6+(row%2)*9;xx<left+w-13;xx+=21){M.RoyalGardenArt.sprite(c,'roundBush',xx-2,yy-3,25,21);M.RoyalGardenArt.sprite(c,variant?'rosePink':'roseIvory',xx,yy-2,22,23);}
  c.restore();
  // The back cap sits behind the planting; the front face keeps its own masonry thickness.
  rect(c,left-1,top-z,w-3,5,'#eee5c9');rect(c,left-1,top-z+5,5,h-8,'#e1d9bd');rect(c,left+w-9,top-z+3,6,h-7,'#a7b195');
  rect(c,left-1,y-z,w-3,z,'#c4c1a2');line(c,left,y-z,left+w-4,y-z,'#f7efd4',3);line(c,left,y,left+w-4,y,'#87987b');
  for(let xx=left+16;xx<left+w-5;xx+=21)line(c,xx,y-z+2,xx,y-1,'#a4ac8d');
  poly(c,[[left+w-4,y-z],[left+w+dx,y-z-5],[left+w+dx,y-5],[left+w-4,y]],'#8f9d82');
  for(const xx of [left+2,left+w-7]){rect(c,xx-2,y-z-1,7,z+2,'#dfd7b7');rect(c,xx-3,y-z-3,9,3,'#f3e9ca');}
 }
 function drawObject(c,v,o){const {x,y}=o.p,w=(o.w||1)*T,h=(o.h||1)*T;c.save();
  if(o.kind==='school-building')facade(c,x-w/2,y-h-5,w,h,true);
  if(o.kind==='school-wing')facade(c,x-w/2,y-h-5,w,h,false);
  if(o.kind==='school-gate')gate(c,x,y,w);
  if(o.kind==='school-sign'){c.translate(30,0);shadow(c,[[x-19,y],[x+20,y],[x+31,y+9],[x-9,y+9]],.18,4);poly(c,[[x+19,y-46],[x+26,y-51],[x+26,y-4],[x+19,y+1]],'#8e9f8b');brick(c,x-19,y-46,38,47,'#d6ceb0');rect(c,x-16,y-42,32,35,'#355750');c.strokeStyle='#c6b984';c.lineWidth=1;c.strokeRect(x-14,y-40,28,31);label(c,'月ノ森',x,y-28,8);label(c,'女子学園',x,y-15,7);rect(c,x-22,y-49,45,5,'#eee3c5');}
  if(o.kind==='school-tree')tree(c,x,y,o.x<17?0:1);
  if(o.kind==='school-bed')flowerBed(c,x,y,w,h,o.x<17?0:1);
  if(o.kind==='school-bench'){rect(c,x-19,y-15,38,12,'#997957');for(const dx of [-14,13])rect(c,x+dx,y-4,3,7,'#425853');line(c,x-18,y-10,x+18,y-10,'#c5af7f');label(c,'休憩',x,y+12,8,'#dce4c9');}
  if(o.kind==='school-lamp'){rect(c,x-2,y-49,4,50,'#3d5555');rect(c,x-8,y-58,16,12,'#526866');rect(c,x-5,y-55,10,8,'#dfd6aa');}
  c.restore();
 }
 function drawLights(c,v,g){c.save();P.apply(c,v);for(const o of g.map.decor.filter(o=>o.kind==='school-lamp')){const x=(o.x+.5)*T,y=o.y*T-18;const grad=c.createRadialGradient(x,y,0,x,y,47);grad.addColorStop(0,'rgba(243,230,171,.13)');grad.addColorStop(1,'rgba(243,230,171,0)');c.fillStyle=grad;c.fillRect(x-47,y-47,94,94);}c.restore();}
 function drawEffects(c,v,g,now){const fx=g._schoolReinforcement;if(!fx)return;const t=Math.max(0,(now-fx.at)/1700);if(t>=1)return;c.save();
  for(const id of fx.ids){const u=g.getUnit(id);if(!u||u.dead)continue;const p=P.project(v,(u.x+.5)*T,(u.y+.9)*T);M.MaskedCourtArt.circle(c,p.x,p.y,68,23,Math.min(.99,t),1-t*.5);c.globalAlpha=1-t;c.strokeStyle='#d2e9ed';c.beginPath();c.ellipse(p.x,p.y,8+t*30,3+t*9,0,0,Math.PI*2);c.stroke();}c.restore();}
 function drawBattleBackground(c,w,h){c.save();const sky=c.createLinearGradient(0,0,0,h*.6);sky.addColorStop(0,'#b9d9dc');sky.addColorStop(1,'#e2e7ce');c.fillStyle=sky;c.fillRect(0,0,w,h);facade(c,w*.14,h*.13,w*.72,h*.45,true);rect(c,0,h*.59,w,h*.41,'#d7d2b9');for(let y=h*.6;y<h;y+=28)line(c,0,y,w,y,'#b3b7a2');for(let i=-4;i<12;i++)line(c,w*.5,h*.59,w*i*.14,h,'#b3b7a2');
  for(const [i,x] of [w*.035,w*.965].entries())tree(c,x,h*.63,i,h/255);c.restore();}
 function obscures(o,u){if(['school-building','school-wing'].includes(o.kind))return u.x>=o.x-1&&u.x<o.x+o.w+1&&u.y<o.y+o.h&&o.y+o.h-u.y<6;
  if(o.kind==='school-tree')return Math.abs(u.x-o.x)<1.8&&u.y<=o.y&&o.y-u.y<3.7;
  if(o.kind==='school-gate')return Math.abs(Math.abs(u.x-(o.x+o.w/2-.5))-o.w/2)<.9&&u.y<=o.y&&o.y-u.y<2.8;
  return false;}
 const rift=id=>id==='school_rift_pegasus';
 const map=C.drawMap;C.drawMap=(c,u,x,y,h,now,opts)=>map(c,rift(u.id)?{...u,id:'rift_pegasus'}:u,x,y,h,now,opts);
 const battle=C.drawBattlePose;C.drawBattlePose=(c,u,x,y,h,state,frame,facing,action)=>battle(c,rift(u.id)?{...u,id:'rift_pegasus'}:u,x,y,h,state,frame,facing,action);
 const portrait=C.drawPortrait;C.drawPortrait=(c,id,x,y,w,h,opts)=>portrait(c,rift(id)?'rift_pegasus':id,x,y,w,h,opts);
 M.SchoolArt={load,images,sprites,gate};M.SchoolMap={drawGround,makeObjects,drawObject,drawLights,drawEffects,drawBattleBackground,obscures};
})(window);
