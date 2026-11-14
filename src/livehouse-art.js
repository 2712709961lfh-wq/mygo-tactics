/* Free CC0 music props, with a coherent STARRY-inspired basement venue. */
(function(global){
 'use strict';const M=global.MyGO,T=M.CONFIG.TILE,images={};
 const files={speaker:'speaker.png',drums:'music-icons/32x32/drums.png',guitar:'music-icons/32x32/guitar_electric.png'};
 function load(){return Promise.all(Object.entries(files).map(([id,file])=>new Promise(resolve=>{
  const im=new Image();im.onload=()=>{images[id]=im;resolve(true);};im.onerror=()=>resolve(false);
  im.src=(global.MYGO_MAP_DATA||{})['live'+id]||'assets/chapter-seven/source/'+file;
 })));}
 function line(c,x,y,xx,yy,color,width=1){c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x,y);c.lineTo(xx,yy);c.stroke();}
 function brick(c,x,y,w,h){c.fillStyle='#4d3037';c.fillRect(x,y,w,h);for(let j=0;j<h;j+=10)for(let i=-20;i<w;i+=30){const xx=x+i+(j/10%2)*15;c.fillStyle=((i+j)%3)?'#663e40':'#59343b';c.fillRect(xx,y+j,28,8);}c.fillStyle='rgba(10,10,20,.25)';c.fillRect(x,y,w,h);}
 function sign(c,x,y,w,h){c.fillStyle='#171a23';c.fillRect(x,y,w,h);c.strokeStyle='#ac9766';c.lineWidth=2;c.strokeRect(x+2,y+2,w-4,h-4);c.textAlign='center';c.fillStyle='#e7d394';c.font='900 '+Math.floor(h*.62)+'px Georgia';c.fillText('STARRY',x+w/2,y+h*.7);c.font=Math.max(6,h*.15)+'px sans-serif';c.fillStyle='#998968';c.fillText('LIVE HOUSE  /  SHIMOKITAZAWA',x+w/2,y+h*.9);}
 function drawGround(c,map){
  c.save();c.fillStyle='#10121b';c.fillRect(0,0,map.cols*T,map.rows*T);
  for(let y=2;y<map.rows-1;y++)for(let x=2;x<map.cols-2;x++){
   const stage=x>=7&&x<=22&&y<=8;
   c.fillStyle=stage?((x+y)%2?'#24232d':'#272630'):((x*13+y*7)%5===0?'#39333b':'#343039');
   c.fillRect(x*T,y*T,T,T);c.fillStyle=stage?'#302c34':'#403941';c.fillRect(x*T,y*T,T,1);
   c.fillStyle='rgba(8,10,18,.19)';c.fillRect(x*T,y*T,T,1);c.fillRect(x*T,y*T,1,T);
   if(!stage){c.fillStyle='rgba(122,94,94,.08)';c.fillRect(x*T+3,y*T+5,2,1);}
  }
  brick(c,0,0,30*T,2*T);brick(c,0,2*T,2*T,25*T);brick(c,28*T,2*T,2*T,25*T);
  c.fillStyle='#17131d';c.fillRect(7*T,2*T,16*T,T*.8);
  for(let x=7*T;x<23*T;x+=9){const g=c.createLinearGradient(x,0,x+9,0);g.addColorStop(0,'#321d2c');g.addColorStop(.5,'#4c273a');g.addColorStop(1,'#261b29');c.fillStyle=g;c.fillRect(x,2*T,9,27);}
  sign(c,11*T,8,8*T,47);
  c.fillStyle='#100e18';c.fillRect(7*T,8.7*T,16*T,10);c.fillStyle='#846957';c.fillRect(7*T,8.7*T,16*T,3);
  for(let k=0;k<2;k++){c.fillStyle=k?'#625253':'#493c44';c.fillRect(13*T,(9+k*.18)*T,4*T,6);}
  // Truss and stage fixtures sit against the back wall, leaving all tiles legible.
  line(c,7*T,2*T-4,23*T,2*T-4,'#73727b',3);line(c,7*T,2*T-13,23*T,2*T-13,'#545560',2);
  for(let x=7*T;x<23*T;x+=24)line(c,x,2*T-13,x+24,2*T-4,'#494a55');
  for(const [i,x] of [8,11,15,19,22].entries()){c.fillStyle=['#a86485','#bca975','#5596a6'][i%3];c.fillRect(x*T-6,2*T-2,12,7);}
  // A subtle safety stripe outlines the stage and the two equipment islands.
  c.fillStyle='#c1a965';for(let x=7*T+4;x<23*T;x+=24)c.fillRect(x,8.7*T+1,9,2);
  for(const [x,y] of [[5,23],[24,23]]){c.fillStyle='#284b48';c.fillRect(x*T+3,y*T+3,T-6,T-6);c.strokeStyle='#7ca398';c.strokeRect(x*T+3,y*T+3,T-6,T-6);c.fillStyle='#bbd3ba';c.fillRect(x*T+13,y*T+7,6,18);c.fillRect(x*T+7,y*T+13,18,6);}
  for(const [x,y] of [[2.4,6],[28.5,7],[2.4,22],[28.5,23]]){c.fillStyle='#d2b57a';c.fillRect(x*T,y*T,4,14);}
  // Posters, cable runs and floor channels belong to the venue, not to terrain rules.
  for(const [x,y] of [[2.1,5],[28.1,10],[2.1,9],[28.1,15]]){c.fillStyle='#a86a70';c.fillRect(x*T,y*T,20,28);c.fillStyle='#d6bc8c';c.fillRect(x*T+3,y*T+4,14,2);c.fillRect(x*T+3,y*T+9,8,10);}
  line(c,8*T,9*T,8*T,21*T,'#22202b',3);line(c,22*T,9*T,22*T,21*T,'#22202b',3);
  c.fillStyle='#1d2528';c.fillRect(12.5*T,26.5*T,5*T,.5*T);c.fillStyle='#304d46';c.fillRect(13*T,26.5*T,4*T,4);
  c.restore();
 }
 function makeObjects(map,v){return map.decor.map(o=>{const p=M.MapProjection.project(v,(o.x+.5)*T,(o.y+.9)*T);return {...o,p,depth:p.y};});}
 function sprite(c,id,x,y,w,h){if(!images[id])return false;c.drawImage(images[id],x-w/2,y-h,w,h);return true;}
 function drawObject(c,v,o){const x=o.p.x,y=o.p.y;c.save();c.imageSmoothingEnabled=false;
  if(o.kind==='amp'){
   c.fillStyle='#10131b';c.fillRect(x-26,y-74,52,78);c.strokeStyle='#696470';c.strokeRect(x-26,y-74,52,78);
   sprite(c,'speaker',x,y-4,58,64);c.fillStyle='#b7a681';c.fillRect(x-21,y-71,42,5);for(let i=0;i<5;i++){c.fillStyle='#99938b';c.fillRect(x-17+i*8,y-70,2,3);}
  }else if(o.kind==='drums'){
   c.fillStyle='#1a1822';c.beginPath();c.ellipse(x,y,50,15,0,0,Math.PI*2);c.fill();sprite(c,'drums',x,y+4,108,108);
   c.fillStyle='#ded1a2';c.textAlign='center';c.font='bold 8px sans-serif';c.fillText('STARRY',x,y-16);
  }else if(o.kind==='guitar'){line(c,x-10,y+3,x,y-43,'#8a858c',2);line(c,x-10,y+3,x+10,y+3,'#8a858c',2);sprite(c,'guitar',x,y,40,64);
  }else if(o.kind==='mic'){
   line(c,x,y,x,y-43,'#c4b9b4',2);line(c,x,y-43,x+14,y-50,'#bcb4ba',2);line(c,x+10,y-49,x+18,y-52,'#ddd6d0',3);line(c,x-11,y,x+11,y,'#aaa3a6',2);line(c,x,y-1,x-7,y+5,'#99929d',2);
   c.strokeStyle='#15131c';c.beginPath();c.moveTo(x,y);c.bezierCurveTo(x+35,y+25,x+55,y-5,x+64,y+12);c.stroke();
  }else if(o.kind==='monitor'){
   c.fillStyle='#171a24';c.beginPath();c.moveTo(x-16,y);c.lineTo(x-13,y-15);c.lineTo(x+13,y-19);c.lineTo(x+18,y-2);c.closePath();c.fill();line(c,x-11,y-13,x+11,y-16,'#5c5867',2);line(c,x-10,y-9,x+12,y-12,'#373642',2);
  }else if(o.kind==='pillar'){
   c.fillStyle='rgba(4,6,16,.28)';c.fillRect(x-10,y-4,34,16);c.fillStyle='#292a36';c.fillRect(x-12,y-68,24,72);c.fillStyle='#4c414b';c.fillRect(x-12,y-68,7,72);c.fillStyle='#82756a';c.fillRect(x-14,y-69,28,5);c.fillStyle='#be9e56';c.fillRect(x-12,y-17,24,3);
  }else if(o.kind==='cases'){
   for(let i=0;i<2;i++){const xx=x-28+i*28;c.fillStyle='#242936';c.fillRect(xx,y-32,27,34);c.strokeStyle='#8f8790';c.strokeRect(xx,y-32,27,34);c.fillStyle='#aca6a6';c.fillRect(xx+9,y-17,9,3);c.fillRect(xx+1,y-30,3,4);c.fillRect(xx+23,y-3,3,4);}
  }else if(o.kind==='bar'){
   c.fillStyle='#352b34';c.fillRect(x-25,y-7*T,44,7*T);c.fillStyle='#8b6658';c.fillRect(x-29,y-7*T,52,13);c.fillStyle='#3f363c';c.fillRect(x-25,y-7*T+13,44,10);for(let j=0;j<7;j++){c.fillStyle=j%2?'#a6b2a3':'#9e6d7d';c.fillRect(x-15,y-j*28-30,5,12);c.fillStyle='#bca786';c.fillRect(x-16,y-j*28-32,7,3);}
   c.save();c.translate(x+5,y-100);c.rotate(-Math.PI/2);c.fillStyle='#d6bd93';c.font='bold 10px sans-serif';c.textAlign='center';c.fillText('DRINK COUNTER',0,0);c.restore();
  }else if(o.kind==='mixdesk'){
   c.fillStyle='#171e2a';c.fillRect(x-42,y-51,84,53);c.strokeStyle='#797784';c.strokeRect(x-42,y-51,84,53);c.fillStyle='#86b6af';c.fillRect(x-33,y-43,25,12);c.fillStyle='#9c6d91';c.fillRect(x+8,y-43,25,12);
   for(let i=0;i<12;i++){const xx=x-34+i*6;line(c,xx,y-23,xx,y-4,'#4a4859');c.fillStyle='#c3b5a9';c.fillRect(xx-1,y-18+(i%3)*4,3,3);}
   c.fillStyle='#1b1a26';c.fillRect(x-25,y+4,50,9);
  }else if(o.kind==='exit'){
   c.fillStyle='#143e36';c.fillRect(x-46,y-12,92,18);c.fillStyle='#b7debd';c.font='bold 11px sans-serif';c.textAlign='center';c.fillText('EXIT   ↓   入口',x,y+1);
  }c.restore();
 }
 function drawLights(c,v,game){c.save();M.MapProjection.apply(c,v);c.globalCompositeOperation='screen';
  for(const [i,x] of [8,11,15,19,22].entries()){
   const color=['185,76,126','194,165,89','66,143,172'][i%3],g=c.createLinearGradient(0,2*T,0,13*T);g.addColorStop(0,'rgba('+color+',.23)');g.addColorStop(1,'rgba('+color+',0)');c.fillStyle=g;c.beginPath();c.moveTo(x*T,2*T);c.lineTo((x+3)*T,12*T);c.lineTo((x-3)*T,12*T);c.closePath();c.fill();
  }c.restore();}
 function drawBattleBackground(c,w,h){
  c.save();c.fillStyle='#14151f';c.fillRect(0,0,w,h);brick(c,0,0,w,h*.7);
  c.fillStyle='#261c2c';c.fillRect(w*.16,0,w*.68,h*.64);
  for(let x=w*.16;x<w*.84;x+=12){c.fillStyle=(Math.floor(x)%3)?'#3c2335':'#211d2a';c.fillRect(x,0,6,h*.64);}
  sign(c,w*.32,12,w*.36,h*.19);c.fillStyle='#242332';c.fillRect(0,h*.64,w,h*.36);
  c.fillStyle='#695246';c.fillRect(0,h*.67,w,4);sprite(c,'drums',w*.5,h*.65,w*.21,h*.37);sprite(c,'speaker',w*.09,h*.66,w*.12,h*.31);sprite(c,'speaker',w*.91,h*.66,w*.12,h*.31);
  for(const [i,x] of [.12,.38,.65,.88].entries()){const color=['186,71,133','213,170,90','69,149,182'][i%3],g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'rgba('+color+',.22)');g.addColorStop(1,'rgba('+color+',0)');c.fillStyle=g;c.beginPath();c.moveTo(w*x,0);c.lineTo(w*(x+.18),h*.85);c.lineTo(w*(x-.18),h*.85);c.fill();}
  c.restore();
 }
 M.LivehouseArt={load,images,drawBattleBackground};M.LivehouseMap={drawGround,makeObjects,drawObject,drawLights};
})(window);
