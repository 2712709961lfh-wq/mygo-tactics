/* Same rehearsal room, with an opened loop door and a readable Nina double. */
(function(global){
 'use strict';const M=global.MyGO,C=M.Characters,T=M.CONFIG.TILE;
 M.TenthMap={...M.RehearsalMap,drawGround(c,map){
  M.RehearsalMap.drawGround(c,map);c.save();c.fillStyle='#46494a';c.fillRect(3*T,45,8*T,17);
  c.fillStyle='#e2d7b9';c.textAlign='center';c.font='bold 10px sans-serif';c.fillText('REHEARSAL  /  09',7*T,59);
  c.fillStyle='#68635c';c.fillRect(10*T,32*T+23,8*T,20);c.fillStyle='#e4d9bc';c.fillText('奇怪的门的另一侧',14*T,33*T+8);c.restore();
 },drawObject(c,v,o){
  if(o.kind!=='entrance')return M.RehearsalMap.drawObject(c,v,o);
  M.RehearsalMap.drawDoor(c,o.p.x,o.p.y,true,1,global.performance?.now()||0);
 }};
 const alias=id=>id==='dark_nina'?'nina':id;
 for(const key of ['has','hasActions']){const base=C[key];C[key]=id=>base(alias(id));}
 const map=C.drawMap;C.drawMap=function(c,u,x,y,h,now,opts){
  if(u.id!=='dark_nina')return map(c,u,x,y,h,now,opts);
  M.DarkSoyo.aura(c,x,y,h,now);c.save();c.filter='brightness(.62) saturate(.5) hue-rotate(245deg)';
  const ok=map(c,{...u,id:'nina'},x,y,h,now,opts);c.restore();return ok;
 };
 const battle=C.drawBattlePose;C.drawBattlePose=function(c,u,x,y,h,state,frame,facing,action){
  if(u.id!=='dark_nina')return battle(c,u,x,y,h,state,frame,facing,action);
  const now=global.performance?.now()||0;M.DarkSoyo.aura(c,x,y,h,now);c.save();c.filter='brightness(.62) saturate(.5) hue-rotate(245deg)';
  const ok=battle(c,{...u,id:'nina'},x,y,h,state,frame,facing,action);c.restore();return ok;
 };
 const portrait=C.drawPortrait;C.drawPortrait=function(c,id,x,y,w,h,opts){
  if(id!=='dark_nina')return portrait(c,id,x,y,w,h,opts);
  c.save();c.filter='brightness(.62) saturate(.5) hue-rotate(245deg)';const ok=portrait(c,'nina',x,y,w,h,opts);c.restore();return ok;
 };
})(window);
