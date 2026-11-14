/* One invertible ground transform, shared by drawing, picking and camera focus.
 * Default boards keep square ground cells; an optional inclined view is preview-only. */
(function(global){
  'use strict';
  const M=global.MyGO,T=M.CONFIG.TILE;
  function create(stage,cols,rows){
    if(stage!==2)return {a:1,b:0,c:0,d:1,ox:0,oy:0,width:cols*T,height:rows*T};
    return {a:1,b:0,c:0,d:1,ox:24,oy:68,width:cols*T+48,height:rows*T+92};
  }
  function createInclinedPreview(cols,rows){
    // Orthographic camera: rotate the square board 45°, then tilt it 45°.
    // Both world axes retain identical lengths; no arbitrary shear/stretch.
    const a=Math.SQRT1_2,b=.5,c=-a,d=b,w=cols*T,h=rows*T;
    return {a,b,c,d,ox:-c*h+40,oy:88,width:Math.ceil(a*w-c*h+80),
      height:Math.ceil(b*w+d*h+128),inclinedPreview:true};
  }
  function project(v,x,y,z=0){return {x:v.a*x+v.c*y+v.ox,y:v.b*x+v.d*y+v.oy-z};}
  function unproject(v,x,y){
    const dx=x-v.ox,dy=y-v.oy,det=v.a*v.d-v.b*v.c;
    return {x:(v.d*dx-v.c*dy)/det,y:(v.a*dy-v.b*dx)/det};
  }
  function apply(c,v){c.transform(v.a,v.b,v.c,v.d,v.ox,v.oy);}
  M.MapProjection={create,createInclinedPreview,project,unproject,apply};
})(window);
