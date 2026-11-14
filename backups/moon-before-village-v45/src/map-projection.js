/* One invertible ground transform, shared by drawing, picking and camera focus.
 * Chapter 1 stays orthogonal. Chapter 2 uses an oblique ground plane with upright sprites. */
(function(global){
  'use strict';
  const M=global.MyGO,T=M.CONFIG.TILE;
  function create(stage,cols,rows){
    if(stage!==2)return {a:1,b:0,c:0,d:1,ox:0,oy:0,width:cols*T,height:rows*T};
    const a=1,b=.10,c=-.32,d=.74,ox=rows*T*.32+24,oy=68;
    return {a,b,c,d,ox,oy,width:Math.ceil(cols*T+rows*T*.32+48),height:Math.ceil(cols*T*b+rows*T*d+108)};
  }
  function project(v,x,y,z=0){return {x:v.a*x+v.c*y+v.ox,y:v.b*x+v.d*y+v.oy-z};}
  function unproject(v,x,y){
    const dx=x-v.ox,dy=y-v.oy,det=v.a*v.d-v.b*v.c;
    return {x:(v.d*dx-v.c*dy)/det,y:(v.a*dy-v.b*dx)/det};
  }
  function apply(c,v){c.transform(v.a,v.b,v.c,v.d,v.ox,v.oy);}
  M.MapProjection={create,project,unproject,apply};
})(window);
