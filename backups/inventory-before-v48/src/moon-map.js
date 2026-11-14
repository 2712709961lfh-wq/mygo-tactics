/* Chapter 2: square ground, textured village buildings and depth-sorted scenery.
 * Native texture sources and licenses: assets/terrain/moon-dream/README.md. */
(function(global){
  'use strict';
  const M=global.MyGO,S=M.CONFIG.TILE,A=512;
  let atlas;
  function load(){return new Promise(resolve=>{
    const img=new Image();img.onload=()=>{atlas=img;resolve(true);};
    img.onerror=()=>{console.error('Moon HD atlas could not be loaded');resolve(false);};
    img.src=(global.MYGO_MAP_DATA||{}).moonDream||'assets/terrain/moon-dream/moon-hd-atlas.png';
  });}
  const at=(m,x,y)=>m.tiles[y]&&m.tiles[y][x];
  const wet=t=>['water','bridge','ford'].includes(t);
  const masonry=t=>['wall','gate','gateOpen'].includes(t);
  const hash=(x,y)=>(Math.imul(x+31,374761393)^Math.imul(y+19,668265263))>>>0;
  function tex(c,id,x,y,w=S,h=S,period=4){
    if(!atlas){c.fillStyle='#5a827e';c.fillRect(x,y,w,h);return;}
    const step=A/period,xx=((Math.floor(x/S)%period)+period)%period*step,
      yy=((Math.floor(y/S)%period)+period)%period*step;
    c.drawImage(atlas,id%8*A+xx,Math.floor(id/8)*A+yy,step,step,x,y,w,h);
  }
  function sprite(c,id,x,y,w=S,h=S){if(atlas)c.drawImage(atlas,id%8*A,Math.floor(id/8)*A,A,A,x,y,w,h);}
  function glow(c,x,y,r,color){
    const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'rgba(180,205,255,0)');
    c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);
  }
  function ground(c,map,x,y,t){
    const px=x*S,py=y*S,n=hash(x,y);tex(c,0,px,py,S,S,4);
    if(t==='road')tex(c,1,px,py,S,S,2);
    if(['plaza','gate','gateOpen','wall','fort','bell'].includes(t))tex(c,['fort','bell'].includes(t)?9:2,px,py,S,S,2);
    if(t==='mountain')tex(c,5,px,py);
    if(wet(t)){
      tex(c,6,px,py,S,S,4);
      for(const [dx,dy] of [[0,-1],[0,1],[-1,0],[1,0]])if(!wet(at(map,x+dx,y+dy))){
        tex(c,8,px+(dx>0?S-3:0),py+(dy>0?S-3:0),dx?3:S,dy?3:S,2);
      }
      if(t==='bridge'){
        tex(c,7,px,py,S,S,2);
        c.strokeStyle='rgba(250,236,207,.65)';c.lineWidth=.65;
        c.strokeRect(px+2,py+1,S-4,S-2);
      }
      if(t==='ford'){
        c.save();c.globalAlpha=.83;tex(c,8,px+2,py+3,S-4,S-6,2);c.restore();
        for(const [dx,dy] of [[5,5],[18,16],[4,23]]){
          tex(c,3,px+dx,py+dy,9,6,1);
          c.fillStyle='rgba(237,240,222,.45)';c.fillRect(px+dx,py+dy,9,1);
        }
      }
    }
    if(t==='plain'&&n%5===0)sprite(c,17+n%3,px+8+n%9,py+12,8,12);
    if(t==='fort'){
      c.strokeStyle='#ddc68a';c.lineWidth=1;c.strokeRect(px+3,py+3,S-6,S-6);
      glow(c,px+16,py+16,24,'rgba(123,239,203,.32)');
    }
  }
  function drawGround(c,map){
    c.save();c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
    for(let y=0;y<map.rows;y++)for(let x=0;x<map.cols;x++)ground(c,map,x,y,at(map,x,y));
    // Physical contact shadows sit on the ground plane; there is no full-screen haze.
    for(let y=0;y<map.rows;y++)for(let x=0;x<map.cols;x++){
      const t=at(map,x,y),px=x*S,py=y*S,n=hash(x,y);
      if(['forest','wall','mountain'].includes(t)){
        c.save();c.fillStyle='rgba(21,32,49,.28)';c.beginPath();
        c.ellipse(px+21,py+23,t==='forest'?21:18,t==='forest'?11:9,.4,0,Math.PI*2);c.fill();c.restore();
      }
      if(t==='water'&&n%4===0){
        c.strokeStyle='rgba(184,222,231,.4)';c.lineWidth=.5;
        for(let i=0;i<3;i++){c.beginPath();c.moveTo(px+3+i*3,py+6+i*8);c.lineTo(px+14+i*3,py+5+i*8);c.stroke();}
      }
    }c.restore();
  }
  // Texture a parallelogram with its actual surface orientation, including vertical walls.
  function surface(c,id,p,q,r,shade=0,tint=null){
    if(Math.abs((q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x))<.001)return;
    c.save();c.transform((q.x-p.x)/S,(q.y-p.y)/S,(r.x-p.x)/S,(r.y-p.y)/S,p.x,p.y);
    tex(c,id,0,0,S,S,1);
    if(shade){c.fillStyle=`rgba(20,29,55,${shade})`;c.fillRect(0,0,S,S);}
    if(tint){c.fillStyle=tint;c.fillRect(0,0,S,S);}
    c.strokeStyle='rgba(232,227,209,.42)';c.lineWidth=.65;c.strokeRect(.3,.3,S-.6,S-.6);c.restore();
  }
  function prism(c,v,x,y,w,h,z,face=4){
    const P=(xx,yy,zz=0)=>raised(v,xx,yy,zz);
    const X=x*S,Y=y*S,W=w*S,H=h*S;
    surface(c,face,P(X,Y+H,z),P(X+W,Y+H,z),P(X,Y+H),.10);
    surface(c,face,P(X+W,Y,z),P(X+W,Y+H,z),P(X+W,Y),.29);
    surface(c,3,P(X,Y,z),P(X+W,Y,z),P(X,Y+H,z));
  }
  // Height extrusion is cosmetic and never shears the square ground or click grid.
  function raised(v,x,y,z=0){const p=M.MapProjection.project(v,x,y,z);p.x+=z*.18;return p;}
  function drawHouse(c,v,o){
    const {x,y,w,h}=o,X=x*S,Y=y*S,W=w*S,H=h*S;
    const P=(xx,yy,z=0)=>raised(v,xx,yy,z);
    prism(c,v,x,y,w,h,22,4);
    const tint={lavender:'rgba(114,90,157,.44)',rose:'rgba(170,94,129,.40)',blue:'rgba(77,113,155,.42)'}[o.roof];
    // The two roof slopes use real brick texture, with repeated shingle joints.
    surface(c,4,P(X-3,Y-2,24),P(X+W/2,Y-2,51),P(X-3,Y+H+3,24),.08,tint);
    surface(c,4,P(X+W/2,Y-2,51),P(X+W+3,Y-2,24),P(X+W/2,Y+H+3,51),.2,tint);
    // Front gable, timber door, and lit windows sit above the actual blocked footprint.
    const left=P(X,Y+H,23),peak=P(X+W/2,Y+H,50),right=P(X+W,Y+H,23);
    c.save();c.beginPath();c.moveTo(left.x,left.y);c.lineTo(peak.x,peak.y);c.lineTo(right.x,right.y);c.closePath();c.clip();
    tex(c,4,left.x,peak.y,W,28,2);c.fillStyle='rgba(202,187,216,.22)';c.fillRect(left.x,peak.y,W,28);c.restore();
    const foot=P(X+W/2,Y+H),doorW=13;
    tex(c,22,foot.x-doorW/2,foot.y-19,doorW,19,1);
    c.strokeStyle='#ddc995';c.lineWidth=.8;c.strokeRect(foot.x-doorW/2,foot.y-19,doorW,19);
    for(const dx of [-W*.29,W*.29]){
      const p=P(X+W/2+dx,Y+H,15);glow(c,p.x,p.y,13,'rgba(255,213,142,.18)');
      tex(c,21,p.x-6,p.y-6,12,9,1);c.fillStyle='rgba(255,222,161,.7)';c.fillRect(p.x-4,p.y-4,8,5);
      c.strokeStyle='#545068';c.lineWidth=1;c.beginPath();c.moveTo(p.x,p.y-5);c.lineTo(p.x,p.y+2);c.stroke();
    }
    // Flower boxes use the same licensed raster flowers as the surrounding groves.
    for(const dx of [-W*.34,W*.24])sprite(c,18,foot.x+dx-7,foot.y-8,20,14);
  }
  function makeObjects(map,v){
    const list=[];
    const add=(x,y,kind,extra={})=>{
      const p=M.MapProjection.project(v,(x+.5)*S,(y+.85)*S);
      list.push({x,y,kind,depth:p.y,p,...extra});
    };
    for(let y=0;y<map.rows;y++)for(let x=0;x<map.cols;x++){
      const t=at(map,x,y),n=hash(x,y);
      if(t==='wall'&&!(map.decor||[]).some(d=>d.kind==='house'&&x>=d.x&&x<d.x+d.w&&y>=d.y&&y<d.y+d.h))add(x,y,'wall',{height:14});
      if(t==='gate')add(x,y,'gate',{height:27});
      if(t==='forest')add(x,y,'tree',{id:14+n%3});
      if(t==='mountain')add(x,y,'rock');
      if(t==='fort')add(x,y,'fort');
      if(t==='bell')add(x,y,'bell',{bellId:M.CONFIG.STAGE_TWO.bells.find(b=>b.x===x&&b.y===y).id,
        number:M.CONFIG.STAGE_TWO.bells.findIndex(b=>b.x===x&&b.y===y)+1});
      if(t==='bridge')for(const dx of [-1,1])if(at(map,x+dx,y)!=='bridge')add(x,y,'rail',{dx,depth:M.MapProjection.project(v,(x+.5+dx*.4)*S,(y+1)*S).y});
      if(t==='water'&&!wet(at(map,x,y-1))&&y>0)add(x,y-1,'bank',{depth:M.MapProjection.project(v,(x+.5)*S,y*S).y-.3});
    }
    for(const d of map.decor||[])if(d.kind==='house')add(d.x,d.y,'house',{...d,depth:M.MapProjection.project(v,0,(d.y+d.h)*S).y});
    for(const [x,y] of [[32,2],[37,2]])add(x,y,'statue');
    return list;
  }
  function drawObject(c,v,o){
    const {x,y,p,kind}=o;
    c.save();c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
    if(kind==='house')drawHouse(c,v,o);
    if(kind==='bell'){
      const active=!!o.awakened;
      glow(c,p.x,p.y-8,29,active?'rgba(119,247,216,.42)':'rgba(238,201,255,.32)');
      prism(c,v,x+.18,y+.18,.64,.64,5,7);
      sprite(c,11,p.x-5,p.y-26,10,26);
      c.fillStyle=active?'#a0ffdf':'#eed7ac';c.beginPath();c.arc(p.x,p.y-25,5,Math.PI,0);c.lineTo(p.x+6,p.y-19);c.lineTo(p.x-6,p.y-19);c.closePath();c.fill();
      c.strokeStyle=active?'#8bffe0':'#e9c8ff';c.lineWidth=1;c.beginPath();c.ellipse(p.x,p.y+1,14,5,0,0,Math.PI*2);c.stroke();
    }
    if(kind==='wall'||kind==='tower'){
      prism(c,v,x,y,1,1,o.height);
      if(kind==='tower'){
        prism(c,v,x-.06,y-.06,1.12,1.12,o.height+3);
        sprite(c,11,p.x-7,p.y-o.height-21,14,25);
        glow(c,p.x,p.y-o.height-15,15,'rgba(218,188,255,.22)');
      }
    }
    if(kind==='gate'){
      const a=M.MapProjection.project(v,x*S,(y+.5)*S),b=M.MapProjection.project(v,(x+1)*S,(y+.5)*S);
      c.strokeStyle='#323d58';c.lineWidth=2;
      for(let i=0;i<=7;i++){
        const t=i/7,xx=a.x+(b.x-a.x)*t,yy=a.y+(b.y-a.y)*t;
        c.beginPath();c.moveTo(xx,yy);c.lineTo(xx,yy-o.height);c.stroke();
      }
      c.strokeStyle='#b9a5c7';c.lineWidth=2;c.beginPath();c.moveTo(a.x,a.y-18);c.lineTo(b.x,b.y-18);c.stroke();
    }
    if(kind==='tree')sprite(c,o.id,p.x-23,p.y-62,46,66);
    if(kind==='rock')sprite(c,13,p.x-20,p.y-34,40,40);
    if(kind==='statue'){prism(c,v,x+.2,y+.2,.6,.6,5);sprite(c,12,p.x-12,p.y-44,24,46);}
    if(kind==='fort'){
      prism(c,v,x+.15,y+.15,.7,.7,6,7);
      sprite(c,11,p.x-7,p.y-30,14,30);glow(c,p.x,p.y-20,20,'rgba(142,244,209,.3)');
    }
    if(kind==='bank'){
      const a=M.MapProjection.project(v,x*S,(y+1)*S),b=M.MapProjection.project(v,(x+1)*S,(y+1)*S);
      surface(c,8,{x:a.x,y:a.y-1},{x:b.x,y:b.y-1},{x:a.x,y:a.y+7},.2);
    }
    if(kind==='rail'){
      const xx=x+(o.dx<0?.02:.90);prism(c,v,xx,y,.08,1,7,7);
      for(const yy of [y+.03,y+.92])prism(c,v,xx-.025,yy,.13,.09,12,7);
    }
    c.restore();
  }
  // Portrait thumbnails use the same HD surfaces, without the perspective camera.
  function drawSample(c,type,x=0,y=0,size=S){
    c.save();c.translate(x,y);c.scale(size/S,size/S);
    ground(c,{tiles:[[type]]},0,0,type);
    if(type==='forest')sprite(c,14,0,-5,S,S+5);
    if(type==='wall')tex(c,4,0,0,S,S,1);
    if(type==='bell')sprite(c,11,8,1,16,30);
    if(type==='mountain')sprite(c,13,0,0,S,S);c.restore();
  }
  M.MoonMap={load,drawGround,makeObjects,drawObject,drawSample};
})(window);
