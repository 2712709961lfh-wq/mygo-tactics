/* Reuse the same room, instruments, knight sheets and authored character actions. */
(function(global){
 'use strict';const M=global.MyGO,T=M.CONFIG.TILE,C=M.Characters;
 function drawGround(c,map){
  const old=document.createElement('canvas');old.width=30*T;old.height=28*T;
  M.LivehouseMap.drawGround(old.getContext('2d'),{...map,rows:28});
  c.drawImage(old,0,0,30*T,6*T,0,0,30*T,6*T);
  for(let y=6;y<14;y++)c.drawImage(old,0,6*T,30*T,T,0,y*T,30*T,T);
  c.drawImage(old,0,6*T,30*T,22*T,0,14*T,30*T,22*T);
  // The impossible extension belongs to the old stage: same floor, safety lines and truss palette.
  c.save();c.strokeStyle='rgba(163,110,193,.32)';c.lineWidth=1;
  for(let y=6;y<15;y+=2){c.beginPath();c.moveTo(7*T+4,y*T);c.lineTo(23*T-4,y*T);c.stroke();}
  c.fillStyle='rgba(43,16,66,.16)';c.fillRect(7*T,6*T,16*T,8*T);
  for(const y of [18,14,10]){
   c.fillStyle='rgba(208,175,224,.55)';c.beginPath();c.moveTo(15*T,y*T);c.lineTo(15*T-7,y*T+9);c.lineTo(15*T+7,y*T+9);c.closePath();c.fill();
  }c.restore();
 }
 M.EighthMap={drawGround,makeObjects:M.LivehouseMap.makeObjects,
  drawObject(c,v,o){if(o.kind==='chest')M.WatercourtMap.drawObject(c,v,o);else M.LivehouseMap.drawObject(c,v,o);},
  drawLights(c,v,game){
   M.LivehouseMap.drawLights(c,v,game);c.save();M.MapProjection.apply(c,v);c.globalCompositeOperation='screen';
   for(const [x,color] of [[9,'122,74,174'],[20,'78,109,173']]){
    const g=c.createLinearGradient(0,2*T,0,18*T);g.addColorStop(0,'rgba('+color+',.21)');g.addColorStop(1,'rgba('+color+',0)');c.fillStyle=g;
    c.beginPath();c.moveTo(x*T,2*T);c.lineTo((x+4)*T,18*T);c.lineTo((x-4)*T,18*T);c.closePath();c.fill();
   }c.restore();
  }};
 const alias=id=>id==='dark_tomori'?'tomori':id;
 for(const key of ['has','hasActions']){const base=C[key];C[key]=id=>base(alias(id));}
 const map=C.drawMap;C.drawMap=function(c,u,x,y,h,now,opts){
  if(u.id!=='dark_tomori')return map(c,u,x,y,h,now,opts);
  M.DarkSoyo.aura(c,x,y,h,now);c.save();c.filter='brightness(.65) saturate(.45) hue-rotate(235deg)';
  const ok=map(c,{...u,id:'tomori'},x,y,h,now,opts);c.restore();M.DarkSoyo.aura(c,x,y,h,now,true);return ok;
 };
 const battle=C.drawBattlePose;C.drawBattlePose=function(c,u,x,y,h,state,frame,facing,action){
  if(u.id!=='dark_tomori')return battle(c,u,x,y,h,state,frame,facing,action);
  const now=global.performance?.now()||0;M.DarkSoyo.aura(c,x,y,h,now);c.save();c.filter='brightness(.65) saturate(.45) hue-rotate(235deg)';
  const ok=battle(c,{...u,id:'tomori'},x,y,h,state,frame,facing,action);c.restore();if(state!=='down')M.DarkSoyo.aura(c,x,y,h,now,true);return ok;
 };
 const portrait=C.drawPortrait;C.drawPortrait=function(c,id,x,y,w,h,opts){
  if(id!=='dark_tomori')return portrait(c,id,x,y,w,h,opts);
  c.save();c.filter='brightness(.6) saturate(.4) hue-rotate(235deg)';const ok=portrait(c,'tomori',x,y,w,h,opts);c.restore();return ok;
 };
})(window);
