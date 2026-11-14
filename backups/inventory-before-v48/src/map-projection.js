/* One invertible ground transform, shared by drawing, picking and camera focus.
 * Default boards keep square ground cells; an optional inclined view is preview-only. */
(function(global){
  'use strict';
  const M=global.MyGO,T=M.CONFIG.TILE;
  function create(stage,cols,rows){
    if(stage!==2)return {a:1,b:0,c:0,d:1,ox:0,oy:0,width:cols*T,height:rows*T};
    return {a:1,b:0,c:0,d:1,ox:24,oy:68,width:cols*T+48,height:rows*T+92};
  }
  function createInclinedPreview(cols,rows,rotationDegrees=0){
    // Orthographic camera: rotate the square board 45°, then tilt it 45°.
    // Both world axes retain identical lengths; no arbitrary shear/stretch.
    const s=Math.SQRT1_2,angle=rotationDegrees*Math.PI/180,co=Math.cos(angle),si=Math.sin(angle);
    // Rotate the ground in screen space without changing its scale or shape.
    // Height and billboard sprites remain upright in the shared renderer.
    const a=co*s-si*.5,b=si*s+co*.5,c=-co*s-si*.5,d=-si*s+co*.5;
    const w=cols*T,h=rows*T,corners=[[0,0],[a*w,b*w],[c*h,d*h],[a*w+c*h,b*w+d*h]];
    const xs=corners.map(p=>p[0]),ys=corners.map(p=>p[1]);
    const minX=Math.min(...xs),minY=Math.min(...ys);
    return {a,b,c,d,ox:40-minX,oy:88-minY,width:Math.ceil(Math.max(...xs)-minX+80),
      height:Math.ceil(Math.max(...ys)-minY+128),inclinedPreview:true,rotationDegrees};
  }
  function project(v,x,y,z=0){return {x:v.a*x+v.c*y+v.ox,y:v.b*x+v.d*y+v.oy-z};}
  function unproject(v,x,y){
    const dx=x-v.ox,dy=y-v.oy,det=v.a*v.d-v.b*v.c;
    return {x:(v.d*dx-v.c*dy)/det,y:(v.a*dy-v.b*dx)/det};
  }
  function apply(c,v){c.transform(v.a,v.b,v.c,v.d,v.ox,v.oy);}
  M.MapProjection={create,createInclinedPreview,project,unproject,apply};
})(window);
