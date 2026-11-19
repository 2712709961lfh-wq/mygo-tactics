/* Formal palace garden: ivory retaining walls, rose parterres and turquoise canals. */
(function(global){
 'use strict';const M=global.MyGO,T=M.CONFIG.TILE,P=M.MapProjection,C=M.Characters,TAU=Math.PI*2;
 const images={};
 const sprites={fountain0:[0,0,64,96],fountain1:[96,0,64,96],angel:[192,0,32,64],knight:[288,0,64,96],lion:[384,0,64,96],column:[480,0,64,108],pedestal:[576,0,32,64],rosePink:[672,0,32,32],roseIvory:[0,128,32,32],roseRed:[96,128,32,32],roseBlue:[192,128,32,32],flowerBush:[288,128,32,32],hedge:[384,128,64,32],roundBush:[480,128,32,32],cypress:[576,128,32,64],topiary:[672,128,40,64],lily:[0,256,32,32]};
 function load(){return new Promise(resolve=>{const im=new Image();im.onload=()=>{images.details=im;resolve(true);};im.onerror=()=>resolve(false);im.src=(global.MYGO_MAP_DATA||{}).royalGardenDetails||'assets/chapter-eleven/royal-details.png';});}
 function sprite(c,name,x,y,w,h){const im=images.details,source=sprites[name];if(!im||!source)return false;c.save();c.imageSmoothingEnabled=false;c.drawImage(im,...source,x,y,w,h);c.restore();return true;}
 const rect=(c,x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
 function line(c,x,y,xx,yy,color,width=1){c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x,y);c.lineTo(xx,yy);c.stroke();}
 function oval(c,x,y,rx,ry,color){c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fill();}
 function poly(c,points,color){c.fillStyle=color;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();}
 function stone(c,x,y,w,h){rect(c,x,y,w,h,'#d8ceb1');rect(c,x+1,y+1,w-2,2,'#f6e9c7');line(c,x,y+h-1,x+w,y+h-1,'#9b987a');
  c.strokeStyle='rgba(117,107,78,.2)';for(let yy=y+12;yy<y+h;yy+=12){line(c,x,yy,x+w,yy,'rgba(117,107,78,.24)');for(let xx=x+(Math.floor(yy/12)%2?12:24);xx<x+w;xx+=24)line(c,xx,yy-11,xx,yy,'rgba(117,107,78,.22)');}}
 function scroll(c,x,y,size=12){c.save();c.strokeStyle='#b59a59';c.lineWidth=1.3;c.beginPath();for(let i=0;i<28;i++){const t=i/27*Math.PI*3,r=size*(1-i/32);const xx=x+Math.cos(t)*r,yy=y+Math.sin(t)*r*.48;if(i)c.lineTo(xx,yy);else c.moveTo(xx,yy);}c.stroke();c.restore();}
 function medallion(c,x,y,r){c.save();c.fillStyle='#ddd2ae';c.beginPath();c.ellipse(x,y,r,r*.62,0,0,TAU);c.fill();
  for(const d of [1,.87,.7]){c.strokeStyle=d===.87?'#897e5c':'#b59a59';c.lineWidth=d===.87?1:2;c.beginPath();c.ellipse(x,y,r*d,r*.62*d,0,0,TAU);c.stroke();}
  for(let i=0;i<12;i++){const a=i*TAU/12,xx=x+Math.cos(a)*r*.8,yy=y+Math.sin(a)*r*.5;poly(c,[[xx,yy-3],[xx+3,yy],[xx,yy+3],[xx-3,yy]],i%2?'#b59a59':'#65847a');}
  poly(c,[[x,y-r*.4],[x+r*.36,y],[x,y+r*.4],[x-r*.36,y]],'#517568');poly(c,[[x,y-r*.25],[x+r*.22,y],[x,y+r*.25],[x-r*.22,y]],'#d3bb77');c.restore();}
 function urn(c,x,y,foliage=true){oval(c,x+4,y+1,15,5,'rgba(28,44,34,.26)');stone(c,x-9,y-3,18,6);rect(c,x-3,y-12,6,10,'#c8b684');
  poly(c,[[x-13,y-30],[x+13,y-30],[x+10,y-17],[x+4,y-12],[x-4,y-12],[x-10,y-17]],'#d9c99c');line(c,x-14,y-31,x+14,y-31,'#f1dfac',3);
  for(const dx of [-13,13]){c.strokeStyle='#ae8c49';c.lineWidth=2;c.beginPath();c.ellipse(x+dx,y-24,5,6,0,0,TAU);c.stroke();}line(c,x-8,y-20,x+8,y-20,'#b89b59');
  if(foliage){const slender=Math.floor(x/T)%2;sprite(c,slender?'cypress':'topiary',x-(slender?12:15),y-78,slender?24:30,48);}else sprite(c,'flowerBush',x-20,y-54,40,27);
 }
 function door(c,x,y,open=false){c.save();stone(c,x-42,y-83,84,87);rect(c,x-35,y-77,70,77,'#977643');
  const g=c.createLinearGradient(x,y-70,x,y);g.addColorStop(0,open?'#9dc4b3':'#455456');g.addColorStop(1,open?'#d7e5c2':'#283d3e');c.fillStyle=g;c.fillRect(x-30,y-72,60,72);
  if(!open){for(const dx of [-27,3]){rect(c,x+dx,y-68,24,61,'#465752');c.strokeStyle='#c9ab64';c.lineWidth=1.5;c.strokeRect(x+dx,y-68,24,61);}rect(c,x-5,y-30,10,3,'#e7ce87');}
  else{poly(c,[[x-31,y-73],[x-48,y-60],[x-48,y+3],[x-31,y]],'#805c36');poly(c,[[x+31,y-73],[x+48,y-60],[x+48,y+3],[x+31,y]],'#805c36');}
  rect(c,x-47,y-86,94,6,'#b89b58');poly(c,[[x-28,y-86],[x,y-102],[x+28,y-86]],'#d8c89b');oval(c,x,y-90,5,5,'#b9974e');c.restore();}
 function drawGround(c,map){const W=map.cols*T,H=map.rows*T,im=M.PalaceArt.images.scenery;c.save();rect(c,0,0,W,H,'#283d34');
  for(let y=0;y<map.rows;y++)for(let x=0;x<map.cols;x++){
   const type=map.tiles[y][x],px=x*T,py=y*T,n=(x*71+y*139)%17;
   if(type==='plain'){
    rect(c,px,py,T,T,(x+y)%2?'#50705a':'#55775d');for(let i=0;i<6;i++){const dx=(n+i*11)%30,dy=(n*3+i*7)%30;line(c,px+dx,py+dy+3,px+dx+2,py+dy,'rgba(163,184,122,.23)');}
   }else if(['road','plaza','fort','bridge'].includes(type)){
    stone(c,px,py,T,T);if(im&&type!=='bridge'){c.globalAlpha=.35;c.drawImage(im,0,0,32,32,px,py,T,T);c.globalAlpha=1;}
    if(type==='bridge'){rect(c,px+1,py+1,T-2,T-2,'#dfd1a8');line(c,px+2,py+10,px+30,py+10,'#b6a57c');line(c,px+2,py+22,px+30,py+22,'#b6a57c');
     poly(c,[[px+16,py+10],[px+22,py+16],[px+16,py+22],[px+10,py+16]],'#b79d62');oval(c,px+16,py+16,2,2,'#e9dcb0');}
    if(type==='road'){rect(c,px+3,py+3,2,2,'#b69d59');rect(c,px+27,py+27,2,2,'#b69d59');
     if(map.tiles[y]?.[x-1]!=='road'){line(c,px+2,py,px+2,py+32,'#ae9559');line(c,px+5,py,px+5,py+32,'#f3e3b9');}
     if(map.tiles[y]?.[x+1]!=='road'){line(c,px+30,py,px+30,py+32,'#ae9559');line(c,px+27,py,px+27,py+32,'#f3e3b9');}}
   }else if(type==='water'){
    rect(c,px,py,T,T,(x+y)%2?'#346c78':'#397380');line(c,px+3,py+9,px+16,py+9,'#79a8a8');line(c,px+16,py+24,px+29,py+24,'#5e969c');
    line(c,px+1,py+31,px+31,py+31,'rgba(17,61,71,.16)');line(c,px+31,py+1,px+31,py+31,'rgba(17,61,71,.16)');
    for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]])if(!['water','bridge'].includes(map.tiles[y+dy]?.[x+dx])){
     rect(c,px+(dx===1?28:0),py+(dy===1?28:0),dx?4:32,dy?4:32,'#d3c6a1');
     rect(c,px+(dx===1?27:4),py+(dy===1?27:4),dx?1:24,dy?1:24,'#a78e55');
    }
    if((x*3+y)%13===0&&x!==16&&x!==17){c.save();c.globalAlpha=.65;sprite(c,'lily',px+10,py+9,20,20);c.restore();}
   }else{stone(c,px,py,T,T);rect(c,px+1,py+1,T-2,T-2,'#bfb99b');}
  }
  // Formal lawn embroidery and marble borders emphasize the shared palace palette.
  for(const [cx,cy,r] of [[17,32,46],[6,31.5,29],[28,31.5,29],[6,11.5,26],[28,11.5,26],[12.5,7.5,24],[21.5,7.5,24]])medallion(c,cx*T,cy*T,r);
  // Narrow geometric parterre borders carry a repeating royal diamond, never a fake obstacle.
  for(const o of map.decor.filter(o=>o.kind==='royal-parterre')){
   const x=o.x*T,y=o.y*T,w=o.w*T,h=o.h*T;c.strokeStyle='#a59460';c.lineWidth=1;c.strokeRect(x-3,y-3,w+6,h+6);
   for(let xx=x+6;xx<x+w;xx+=16){poly(c,[[xx,y-3],[xx+2,y-5],[xx+4,y-3],[xx+2,y-1]],'#d6bf80');}
  }
  // Southern elevation is the rear facade of chapter ten's palace.
  stone(c,0,H-2*T,W,2*T);rect(c,0,H-2*T,W,6,'#b79d61');for(let x=3;x<map.cols-2;x+=4){rect(c,x*T,H-2*T+9,2*T,34,'#777b70');rect(c,x*T+3,H-2*T+12,2*T-6,28,'#a9bbad');line(c,(x+1)*T,H-2*T+12,(x+1)*T,H-2*T+40,'#d5cba8',2);scroll(c,(x+1)*T,H-2*T+50,12);}
  for(let y=4;y<map.rows-3;y+=2)for(const x of [1,32]){stone(c,x*T+5,y*T+2,22,25);line(c,x*T+7,y*T+6,x*T+25,y*T+6,'#c3a568',2);scroll(c,(x+.5)*T,(y+.5)*T+5,7);}
  c.fillStyle='#e4ddc3';c.textAlign='center';c.font='bold 12px serif';c.fillText('R O Y A L   G A R D E N',W/2,39);
  c.restore();
 }
 function makeObjects(map,v){const details=[];
  // Taller adornments stand only on pre-existing blocked walls or the outer perimeter.
  for(const y of [12,22,30])for(const x of [2,31])details.push({kind:'royal-angel',x,y,w:1,h:1});
  for(const y of [8,18,28,36])for(const x of [.5,32.5])details.push({kind:'royal-urn',x,y,w:1,h:1});
  for(const x of [11,22])details.push({kind:'royal-knight',x,y:4,w:1,h:1});
  const objects=map.decor.concat(details).map(o=>({...o,p:P.project(v,(o.x+(o.w||1)/2)*T,(o.y+(o.h||1))*T-4),depth:(o.y+(o.h||1))*T+v.oy}));
  // Each column of a long wall sorts independently, so a rider never disappears behind its remote end.
  return objects.flatMap(o=>o.kind==='royal-wall'&&o.w>1?Array.from({length:o.w},(_,i)=>({...o,x:o.x+i,w:1,p:P.project(v,(o.x+i+.5)*T,(o.y+1)*T-4)})):o);
 }
 function drawObject(c,v,o){const {x,y}=o.p,w=(o.w||1)*T,h=(o.h||1)*T;c.save();
  if(o.kind==='royal-wall'){
   const top=y-25;oval(c,x+6,y+3,w*.58,7,'rgba(20,40,32,.28)');stone(c,x-w/2,top,w,27);rect(c,x-w/2-1,top-4,w+2,6,'#eee0b9');rect(c,x-w/2,top+3,w,2,'#b99c62');
   for(let xx=x-w/2+6;xx<x+w/2;xx+=16){rect(c,xx,y-18,5,14,'#8d9d88');rect(c,xx+1,y-17,3,12,'#c3c6a5');}
   scroll(c,x,y-15,6);line(c,x-12,top-1,x+12,top-1,'#c5a25f');
   if(o.h>1){stone(c,x-13,y-h-16,26,h);rect(c,x-15,y-h-20,30,6,'#eee0b9');for(let yy=y-h;yy<y-12;yy+=28){scroll(c,x,yy,8);line(c,x-11,yy+13,x+11,yy+13,'#b3a06b');}}
  }else if(o.kind==='royal-parterre'){
   const top=y-h+5;rect(c,x-w/2-2,top-2,w+4,h, '#b5aa83');rect(c,x-w/2,top,w,h-4,'#294c39');rect(c,x-w/2+5,top+5,w-10,h-14,'#506d43');
   c.strokeStyle='#9dac73';c.lineWidth=2;c.strokeRect(x-w/2+8,top+8,w-16,h-20);line(c,x-w/2+1,top-1,x+w/2-1,top-1,'#e2d3a1');
   if([11,20].includes(o.x)&&[19,33].includes(o.y)){
    stone(c,x-27,y-8,54,10);sprite(c,'fountain'+(Math.floor((global.performance?.now()||0)/280)%2),x-22,y-64,44,66);
    for(const dx of [-w*.39,w*.39])sprite(c,'rosePink',x+dx-10,y-27,20,20);
   }else{
    const color=o.x<16?(o.y%2?'rosePink':'roseRed'):(o.y%2?'roseIvory':'roseBlue');
    for(let row=0;row<2;row++)for(let col=0;col<3;col++){const xx=x-w/2+4+col*(w-12)/3,yy=top+row*20-3;sprite(c,color,xx,yy,29,29);}
    sprite(c,'hedge',x-w/2+3,y-17,w-6,19);for(const dx of [-w/2+7,w/2-11]){sprite(c,'roundBush',x+dx-7,top-9,21,21);}
   }
  }else if(o.kind==='royal-bridge'){
   if(o.axis==='vertical'){for(const dx of [-w/2+2,w/2-2]){line(c,x+dx,y-h-6,x+dx,y-4,'#e4d6b0',5);line(c,x+dx,y-h-3,x+dx,y-1,'#b09256',1);for(let yy=y-h;yy<=y;yy+=16){rect(c,x+dx-3,yy-12,6,18,'#e2d7b1');rect(c,x+dx-4,yy-14,8,3,'#b79b5b');oval(c,x+dx,yy-16,3,3,'#d5bd7a');}}}
   else{for(const yy of [y-h+3,y+2]){line(c,x-w/2,yy-9,x+w/2,yy-9,'#d3c69b',3);for(let xx=x-w/2+3;xx<x+w/2;xx+=22)rect(c,xx,yy-15,5,16,'#e0d3aa');}}
  }else if(o.kind==='royal-angel'){
   oval(c,x+3,y+1,15,6,'rgba(18,40,28,.28)');sprite(c,'pedestal',x-12,y-34,24,40);sprite(c,'angel',x-20,y-104,40,80);scroll(c,x,y-13,7);
  }else if(o.kind==='royal-knight'){
   oval(c,x+5,y+1,24,8,'rgba(18,40,28,.28)');sprite(c,'knight',x-31,y-92,62,93);line(c,x-19,y-7,x+19,y-7,'#b99a57',2);
  }else if(o.kind==='royal-urn'){urn(c,x,y,true);}
  else if(o.kind==='palace-statue'){
   stone(c,x-23,y-4,46,10);sprite(c,'lion',x-27,y-80,54,81);line(c,x-20,y-6,x+20,y-6,'#b59b60',2);
  }else if(o.kind==='palace-font'){
   medallion(c,x,y-2,29);sprite(c,'fountain'+(Math.floor((global.performance?.now()||0)/280)%2),x-32,y-90,64,96);
  }else if(o.kind==='royal-palace-door'){c.translate(x,y+28);c.scale(.72,.72);door(c,0,0,true);}
  else if(o.kind==='royal-pavilion'){
   stone(c,x-w/2,y-14,w,18);for(const dx of [-w*.4,-w*.18,w*.18,w*.4])sprite(c,'column',x+dx-18,y-85,36,77);
   poly(c,[[x-w*.55,y-79],[x,y-125],[x+w*.55,y-79]],'#4d786c');
   for(let j=1;j<=4;j++){const yy=y-79-j*9,half=w*.55*(1-j/5.2);line(c,x-half,yy,x+half,yy,'#8ca28a',1);}
   line(c,x-w*.55,y-79,x,y-125,'#d1b776',3);line(c,x,y-125,x+w*.55,y-79,'#d1b776',3);line(c,x-w*.55,y-79,x+w*.55,y-79,'#d1b776',5);oval(c,x,y-124,5,7,'#d9be75');
   scroll(c,x,y-71,17);for(const dx of [-w*.39,w*.39])urn(c,x+dx,y-7,false);
  }else M.PalaceMap.drawObject(c,v,o);
  c.restore();
 }
 function drawLights(c,v,g){M.PalaceMap.drawLights(c,v,g);}
 function drawEffects(c,v,g,now){c.save();P.apply(c,v);c.strokeStyle='rgba(183,220,212,.32)';c.lineWidth=1;const t=now/1000;
  for(let y=3;y<g.map.rows-2;y++)for(let x=2;x<g.map.cols-2;x++)if(g.map.tiles[y][x]==='water'&&(x+y)%3===0){const xx=(x+.5)*T+Math.sin(t+x)*3,yy=(y+.5)*T+Math.sin(t*.8+y)*3;line(c,xx-7,yy,xx+7,yy,'rgba(182,221,213,.28)');}
  // Soft highlights drift with the current rather than covering passable bridge tiles.
  for(const y of [16.6,26.6])for(let i=0;i<10;i++){const xx=(3+i*2.8+Math.sin(t*.4+i)*.4)*T,yy=y*T;const tile=g.map.tiles[Math.floor(y)]?.[Math.floor(xx/T)];if(tile!=='water')continue;
   c.globalAlpha=.1+.12*(Math.sin(t+i)+1);oval(c,xx,yy,9,1,'#e9e1b4');}c.restore();}
 function drawBattleBackground(c,w,h){c.save();const sky=c.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#8aaea7');sky.addColorStop(.52,'#d2d3ae');sky.addColorStop(1,'#53715a');c.fillStyle=sky;c.fillRect(0,0,w,h);
  stone(c,w*.24,h*.12,w*.52,h*.34);for(let i=0;i<7;i++){const xx=w*(.28+i*.073);rect(c,xx,h*.2,w*.035,h*.2,'#6d8b89');rect(c,xx+2,h*.2+2,w*.035-4,h*.2-4,'#aac3b6');}rect(c,w*.22,h*.1,w*.56,8,'#af965f');
  rect(c,0,h*.42,w,h*.16,'#3a6750');for(let i=0;i<35;i++){oval(c,i*w/34,h*.44,18,16,i%2?'#4e7752':'#456b47');if(i%3===0)sprite(c,i%2?'rosePink':'roseIvory',i*w/34-12,h*.42-6,24,25);}
  rect(c,0,h*.54,w,h*.1,'#487e86');for(let i=0;i<15;i++)line(c,i*w/14,h*.59,(i+.45)*w/14,h*.59,'#94bdb6');stone(c,0,h*.63,w,h*.37);
  for(const x of [w*.04,w*.91]){stone(c,x,h*.38,w*.05,h*.25);rect(c,x-5,h*.37,w*.05+10,7,'#e1d4ac');}
  for(const x of [w*.065,w*.935])sprite(c,'angel',x-13,h*.17,26,h*.24);
  for(const x of [w*.15,w*.85]){stone(c,x-27,h*.5-2,54,11);sprite(c,'fountain0',x-25,h*.5-75,50,75);}
  for(const x of [w*.32,w*.68])sprite(c,'column',x-11,h*.13,22,h*.29);
  for(let x=20;x<w;x+=44){scroll(c,x,h*.68,9);line(c,x-12,h*.72,x+12,h*.72,'#c3ac74');}
  rect(c,0,h*.62,w,4,'#f4e4b7');c.restore();}
 function obscures(o,u){if(o.kind==='royal-palace-door')return Math.abs(u.x-(o.x+o.w/2))<2&&u.y>=36;
  if(o.kind==='royal-wall')return u.x>=o.x-1&&u.x<o.x+(o.w||1)+1&&u.y<o.y+(o.h||1)&&o.y+(o.h||1)-u.y<2;
  if(o.kind==='royal-angel'||o.kind==='royal-knight'||o.kind==='royal-urn'||o.kind==='palace-statue'||o.kind==='palace-font')return Math.abs(u.x-o.x)<1.2&&u.y<=o.y&&o.y-u.y<2.7;
  // Fountain beds stay inside their blocked footprint without fading for nearby riders.
  if(o.kind==='royal-parterre')return false;return M.PalaceMap.obscures(o,u);}
 const rift=id=>id==='garden_rift_pegasus';
 // Use chapter nine's established cyan double-ring identity for the new rift captain.
 const map=C.drawMap;C.drawMap=function(c,u,x,y,h,now,opts){return map(c,rift(u.id)?{...u,id:'rift_pegasus'}:u,x,y,h,now,opts);};
 const battle=C.drawBattlePose;C.drawBattlePose=function(c,u,x,y,h,state,frame,facing,action){return battle(c,rift(u.id)?{...u,id:'rift_pegasus'}:u,x,y,h,state,frame,facing,action);};
 const portrait=C.drawPortrait;C.drawPortrait=function(c,id,x,y,w,h,opts){return portrait(c,rift(id)?'rift_pegasus':id,x,y,w,h,opts);};
 M.RoyalGardenMap={drawGround,makeObjects,drawObject,drawLights,drawEffects,drawBattleBackground,obscures};M.RoyalGardenArt={load,images,sprites,sprite,door};
})(window);
