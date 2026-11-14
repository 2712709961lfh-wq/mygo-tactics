/* Chapter 1: Flare Grassland + rubberduck Old Ruins, CC BY-SA 3.0.
 * Textured 2.5D scenery above an undistorted orthogonal board. Credits and original
 * sources: assets/terrain/flare/README.md. Geometry always reads map.tiles. */
(function(global) {
  'use strict';
  const M=global.MyGO, S=M.CONFIG.TILE, A=256;
  let atlas;
  const isolatedSprites=new Map();
  function load() {
    return new Promise(resolve=>{
      const img=new Image();img.onload=()=>{
        atlas=img;isolatedSprites.clear();
        // Sampling an atlas boundary at fractional screen pixels can bleed a
        // neighbouring opaque tile into a transparent sprite's outer edge.
        for(let id=16;id<=31;id++){
          const tile=document.createElement('canvas');tile.width=tile.height=A;
          const tc=tile.getContext('2d');tc.imageSmoothingEnabled=false;
          tc.drawImage(img,id%8*A,Math.floor(id/8)*A,A,A,0,0,A,A);
          isolatedSprites.set(id,tile);
        }
        resolve(true);
      };
      img.onerror=()=>{console.error('Flare battlefield atlas could not be loaded');resolve(false);};
      img.src=(global.MYGO_MAP_DATA||{}).gardenFlare || 'assets/terrain/flare/battlefield-atlas.png';
    });
  }
  const at=(map,x,y)=>map.tiles[y]&&map.tiles[y][x];
  const wet=t=>['water','bridge','ford'].includes(t);
  const wall=t=>['wall','gate','gateOpen'].includes(t);
  const hash=(x,y)=>(Math.imul(x+23,374761393)^Math.imul(y+17,668265263))>>>0;
  // Continuous raster texture in world space, with no randomly rotated seams.
  function tex(c,id,x,y,w=S,h=S,period=4,ox=x,oy=y) {
    if(!atlas){c.fillStyle='#414d45';c.fillRect(x,y,w,h);return;}
    const step=A/period,sx=((Math.floor(ox/S)%period)+period)%period*step,
      sy=((Math.floor(oy/S)%period)+period)%period*step;
    c.drawImage(atlas,id%8*A+sx,Math.floor(id/8)*A+sy,step,step,x,y,w,h);
  }
  function sprite(c,id,x,y,w=S,h=S) {
    const tile=isolatedSprites.get(id);
    if(tile)c.drawImage(tile,x,y,w,h);
    else if(atlas)c.drawImage(atlas,id%8*A,Math.floor(id/8)*A,A,A,x,y,w,h);
  }
  function clip(c,x,y,w,h,paint) {
    c.save();c.beginPath();c.rect(x,y,w,h);c.clip();paint();c.restore();
  }
  function shade(c,x,y,w,h,alpha=.2) {
    const g=c.createLinearGradient(x,y,x,y+h);
    g.addColorStop(0,`rgba(9,16,19,${alpha})`);g.addColorStop(1,'rgba(9,16,19,0)');
    c.fillStyle=g;c.fillRect(x,y,w,h);
  }
  function bridge(c,px,py,x) {
    tex(c,7,px,py,S,S,1);
    c.strokeStyle='rgba(17,15,12,.65)';c.lineWidth=.65;
    for(let i=0;i<6;i++){const xx=px+i*S/6;c.beginPath();c.moveTo(xx,py);c.lineTo(xx,py+S);c.stroke();}
    tex(c,10,px,py+1,S,3,2);tex(c,10,px,py+S-4,S,3,2);
    c.fillStyle='#35372c';if(x%2===0)for(const yy of [py,py+S-5])c.fillRect(px+2,yy,3,6);
    shade(c,px,py+S-3,S,5,.38);
  }
  function ground(c,map,x,y,t) {
    const px=x*S,py=y*S,n=hash(x,y);tex(c,0,px,py);
    if(t==='road') {
      tex(c,1,px,py,S,S,2);
      for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        if(!['plain','forest','mountain'].includes(at(map,x+dx,y+dy)))continue;
        clip(c,px+(dx>0?S-4:0),py+(dy>0?S-4:0),dx?4:S,dy?4:S,()=>{c.globalAlpha=.48;tex(c,0,px,py);});
      }
    }
    if(['plaza','gate','gateOpen','fort','resonance'].includes(t)) {
      tex(c,n%7===0?11:32+n%4,px,py,S,S,1);
      if(t==='plaza'&&n%7===0){c.save();c.globalAlpha=.21;tex(c,0,px,py);c.restore();}
    }
    if(wet(t)) {
      tex(c,6,px,py,S,S,4);
      for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        if(wet(at(map,x+dx,y+dy)))continue;
        const bw=4+n%3,xx=px+(dx>0?S-bw:0),yy=py+(dy>0?S-bw:0);
        clip(c,xx,yy,dx?bw:S,dy?bw:S,()=>tex(c,13,px,py));
        if(dy===-1)shade(c,px,py+bw,S,6,.4);
      }
      if(t==='ford') {
        // A continuous, solid old-stone causeway. Leave water only along its
        // outer banks; adjacent ford cells and the road meet without square gaps.
        tex(c,1,px,py,S,S,2);
        for(const dy of [-1,1]) {
          if(at(map,x,y+dy)==='ford')continue;
          const edgeY=py+(dy<0?0:S-4);
          tex(c,12,px,edgeY,S,4,2);
          c.fillStyle=dy<0?'rgba(190,193,161,.28)':'rgba(8,18,19,.46)';
          c.fillRect(px,edgeY+(dy<0?0:3),S,1);
          c.save();c.globalAlpha=.6;tex(c,13,px,py+(dy<0?0:S-1),S,1,2);c.restore();
        }
        // Damp wear and moss, using the same atlas as the surrounding ruins.
        c.save();c.globalAlpha=.13;tex(c,0,px,py);c.restore();
      }
      if(t==='bridge')bridge(c,px,py,x);
    }
    if(t==='wall')tex(c,2,px,py);
    if(t==='mountain'){tex(c,5,px,py);shade(c,px,py+S*.65,S,S*.35,.38);}
  }
  function masonry(c,map,x,y) {
    const px=x*S,py=y*S,down=wall(at(map,x,y+1)),up=wall(at(map,x,y-1)),
      left=wall(at(map,x-1,y)),right=wall(at(map,x+1,y)),height=8;
    if(down) {
      const width=(!left||!right)?22:S;
      tex(c,3,px,py,width,S,1);
      c.fillStyle='rgba(16,25,24,.23)';c.fillRect(px,py,width,S);
      if(width<S)tex(c,4,px+width,py,S-width,S,1);
    } else {
      tex(c,4,px,py,S,S,1);tex(c,3,px,py,S,height,1);
    }
    if(!up){c.fillStyle='rgba(192,196,174,.2)';c.fillRect(px,py,S,1.5);}
    if(!down){c.fillStyle='rgba(10,16,16,.35)';c.fillRect(px,py+height,S,1.5);}
    if(!down){shade(c,px,py+S,S,5,.38);}
    if(!left){c.fillStyle='rgba(9,16,17,.26)';c.fillRect(px,py,2,S);}
    if(!right){c.fillStyle='rgba(9,16,17,.4)';c.fillRect(px+S-3,py,3,S);}
    if((!left||!right)&&!down)sprite(c,24,px+S*.12,py-S*.18,S*.76,S*1.1);
  }
  function details(c,map,x,y,t) {
    const px=x*S,py=y*S,n=hash(x,y);
    if(t==='wall')masonry(c,map,x,y);
    if(t==='forest') {
      sprite(c,16+n%4,px-S*.14,py-S*.44,S*1.24,S*1.44);
      if(n%5===0)sprite(c,29,px+S*.5,py+S*.5,S*.45,S*.45);
    }
    if(t==='mountain'){sprite(c,26,px-S*.05,py-S*.12,S*1.1,S*1.1);if(n%3===0)sprite(c,30,px+S*.25,py+S*.2,S*.7,S*.7);}
    if(t==='plain'&&n%13===0)sprite(c,29,px+S*.1,py+S*.15,S*.65,S*.65);
    if(t==='plain'&&n%47===0)sprite(c,30,px+S*.3,py+S*.2,S*.6,S*.6);
    if(t==='fort') {
      sprite(c,27,px-S*.05,py-S*.1,S*.85,S*.85);sprite(c,28,px+S*.45,py+S*.25,S*.52,S*.52);
      c.strokeStyle='rgba(210,182,122,.75)';c.lineWidth=1;c.strokeRect(px+3,py+3,S-6,S-6);
    }
    if(t==='resonance') {
      const g=c.createRadialGradient(px+S/2,py+S*.6,0,px+S/2,py+S*.6,S*.6);
      g.addColorStop(0,'rgba(122,200,207,.35)');g.addColorStop(1,'rgba(122,200,207,0)');
      c.fillStyle=g;c.fillRect(px-S*.1,py-S*.1,S*1.2,S*1.2);sprite(c,25,px,py-S*.3,S,S*1.3);
      c.fillStyle='#b4e2df';c.fillRect(px+S*.46,py+S*.12,2,3);
    }
    if(t==='plaza'&&(x===25||x===32)&&y===3)sprite(c,25,px-S*.1,py-S*.45,S*1.2,S*1.45);
  }
  function draw(c,map) {
    c.save();c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
    for(let y=0;y<map.rows;y++)for(let x=0;x<map.cols;x++)ground(c,map,x,y,at(map,x,y));
    for(let y=0;y<map.rows;y++)for(let x=0;x<map.cols;x++)if(at(map,x,y)==='wall'&&!wall(at(map,x,y+1)))shade(c,x*S,(y+1)*S,S,8,.25);
    for(let y=0;y<map.rows;y++)for(let x=0;x<map.cols;x++)details(c,map,x,y,at(map,x,y));
    const g=c.createLinearGradient(0,0,map.cols*S,map.rows*S);
    g.addColorStop(0,'rgba(146,160,166,.035)');g.addColorStop(1,'rgba(18,27,44,.11)');
    c.fillStyle=g;c.fillRect(0,0,map.cols*S,map.rows*S);c.restore();
  }
  function drawGate(c,map,open) {
    c.save();c.imageSmoothingEnabled=true;
    for(let y=0;y<map.rows;y++)for(let x=0;x<map.cols;x++) {
      if(!['gate','gateOpen'].includes(at(map,x,y)))continue;
      const px=x*S,py=y*S;tex(c,2,px,py,S,S,2);
      if(open){tex(c,4,px,py,S,4,1);shade(c,px,py+4,S,5,.3);}
      else {
        c.fillStyle='rgba(9,16,18,.65)';c.fillRect(px,py+5,S,S-8);
        for(let i=0;i<6;i++){tex(c,9,px+2+i*5,py+4,2,S-6,1);c.fillStyle='rgba(170,178,162,.32)';c.fillRect(px+2+i*5,py+4,.6,S-6);}
        tex(c,9,px,py+10,S,3,1);tex(c,9,px,py+24,S,3,1);
      }
      tex(c,3,px,py,S,4,1);
    }c.restore();
  }
  function drawSample(c,type,x=0,y=0,size=S) {
    c.save();c.translate(x,y);c.scale(size/S,size/S);c.imageSmoothingEnabled=true;
    const map={tiles:[[type]]};ground(c,map,0,0,type);details(c,map,0,0,type);
    if(type==='gate'||type==='gateOpen')drawGate(c,map,type==='gateOpen');c.restore();
  }
  // Ground is cached independently so pieces and scenery can share one depth order.
  function drawGround(c,map){
    c.save();c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
    for(let y=0;y<map.rows;y++)for(let x=0;x<map.cols;x++){
      const t=at(map,x,y),n=hash(x,y),px=x*S,py=y*S;
      ground(c,map,x,y,t);
      if(t==='plain'&&n%13===0)sprite(c,29,px+4,py+8,18,18);
      if(t==='plain'&&n%47===0)sprite(c,30,px+9,py+6,18,18);
      if(['forest','wall','mountain','resonance'].includes(t)){
        c.save();c.fillStyle='rgba(6,14,18,.33)';c.beginPath();
        c.ellipse(px+21,py+28,t==='forest'?20:18,t==='forest'?9:6,.28,0,Math.PI*2);c.fill();c.restore();
      }
      if(t==='fort'||t==='resonance'){
        c.strokeStyle=t==='fort'?'rgba(216,190,133,.8)':'rgba(146,224,220,.85)';
        c.lineWidth=1;c.strokeRect(px+3,py+3,S-6,S-6);
      }
    }
    const g=c.createLinearGradient(0,0,map.cols*S,map.rows*S);
    g.addColorStop(0,'rgba(146,160,166,.035)');g.addColorStop(1,'rgba(18,27,44,.11)');
    c.fillStyle=g;c.fillRect(0,0,map.cols*S,map.rows*S);c.restore();
  }
  function raised(v,x,y,z=0){const p=M.MapProjection.project(v,x,y,z);if(!v.inclinedPreview)p.x+=z*.18;return p;}
  function surface(c,id,p,q,r,dark=0){
    if(Math.abs((q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x))<.001)return;
    c.save();c.transform((q.x-p.x)/S,(q.y-p.y)/S,(r.x-p.x)/S,(r.y-p.y)/S,p.x,p.y);
    tex(c,id,0,0,S,S,1);
    if(dark){c.fillStyle=`rgba(5,13,20,${dark})`;c.fillRect(0,0,S,S);}
    c.strokeStyle='rgba(192,194,169,.25)';c.lineWidth=.6;c.strokeRect(.2,.2,S-.4,S-.4);c.restore();
  }
  function prism(c,v,x,y,w,h,z,face=4,base=0){
    const X=x*S,Y=y*S,W=w*S,H=h*S,P=(a,b,k=0)=>raised(v,a,b,k);
    surface(c,face,P(X,Y+H,z),P(X+W,Y+H,z),P(X,Y+H,base),.13);
    surface(c,face,P(X+W,Y,z),P(X+W,Y+H,z),P(X+W,Y,base),.33);
    surface(c,3,P(X,Y,z),P(X+W,Y,z),P(X,Y+H,z));
  }
  function makeObjects(map,v){
    const objects=[],add=(x,y,kind,extra={})=>{
      const p=M.MapProjection.project(v,(x+.5)*S,(y+1)*S);
      objects.push({x,y,kind,p,depth:p.y,...extra});
    };
    for(let y=0;y<map.rows;y++)for(let x=0;x<map.cols;x++){
      const t=at(map,x,y),n=hash(x,y);
      if(t==='wall'){
        // Physical side faces at the footprint edge, including the abandoned west ruin.
        add(x,y,'wall',{height:22,front:!wall(at(map,x,y+1)),east:!wall(at(map,x+1,y))});
        if(!wall(at(map,x-1,y))&&!wall(at(map,x,y-1)))add(x,y,'tower',{height:35});
        if(!wall(at(map,x+1,y))&&!wall(at(map,x,y+1)))add(x,y,'pillar',{height:28});
      }
      if(t==='gate'||t==='gateOpen')add(x,y,'gate',{open:t==='gateOpen',
        left:!['gate','gateOpen'].includes(at(map,x-1,y)),right:!['gate','gateOpen'].includes(at(map,x+1,y))});
      if(t==='forest')add(x,y,'tree',{id:16+n%4,height:68});
      if(t==='mountain')add(x,y,'rock');
      if(t==='fort')add(x,y,'camp');
      if(t==='resonance')add(x,y,'resonance');
      if(t==='plaza'&&(x===25||x===32)&&y===3)add(x,y,'statue');
      if(t==='bridge')for(const dy of [-1,1])if(at(map,x,y+dy)!=='bridge')
        add(x,y,'rail',{dy,depth:M.MapProjection.project(v,(x+.5)*S,(y+(dy<0?.05:.98))*S).y});
      if(t==='water')for(const dx of [-1,1])if(at(map,x+dx,y)&&!wet(at(map,x+dx,y)))add(x,y,'bank',{dx});
    }
    return objects;
  }
  function drawObject(c,v,o){
    const {x,y,p,kind}=o;
    c.save();c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
    if(kind==='wall'){
      const X=x*S,Y=y*S,P=(a,b,z=0)=>raised(v,a,b,z),h=o.height;
      if(o.front)surface(c,4,P(X,Y+S,h),P(X+S,Y+S,h),P(X,Y+S),.12);
      if(o.east)surface(c,4,P(X+S,Y,h),P(X+S,Y+S,h),P(X+S,Y),.34);
      surface(c,3,P(X,Y,h),P(X+S,Y,h),P(X,Y+S,h));
      // Narrow coping and broken stonework retain the worn fortress texture.
      if(o.front)surface(c,12,P(X,Y+S,h),P(X+S,Y+S,h),P(X,Y+S,h-4),.08);
    }
    if(kind==='tower'){
      prism(c,v,x+.06,y+.06,.88,.88,o.height,4);
      prism(c,v,x-.015,y-.015,1.03,1.03,o.height+4,4,o.height-3);
      for(const xx of [x+.02,x+.72])prism(c,v,xx,y+.72,.22,.23,o.height+10,4,o.height+4);
    }
    if(kind==='pillar')sprite(c,24,p.x-12,p.y-44,24,46);
    if(kind==='tree')sprite(c,o.id,p.x-28,p.y-70,56,70);
    if(kind==='rock'){prism(c,v,x+.12,y+.16,.76,.68,7,5);sprite(c,26,p.x-22,p.y-37,44,40);}
    if(kind==='camp'){
      prism(c,v,x+.12,y+.13,.76,.74,4,12);
      sprite(c,27,p.x-20,p.y-31,32,34);sprite(c,28,p.x+3,p.y-20,22,24);
    }
    if(kind==='statue'||kind==='resonance'){
      prism(c,v,x+.2,y+.2,.6,.6,6,4);sprite(c,25,p.x-16,p.y-52,32,54);
      if(kind==='resonance'){
        c.fillStyle='rgba(116,220,220,.16)';c.beginPath();c.ellipse(p.x,p.y-4,19,7,0,0,Math.PI*2);c.fill();
        c.fillStyle='#c0ede8';c.fillRect(p.x+1,p.y-34,2,4);
      }
    }
    if(kind==='rail'){
      const yy=y+(o.dy<0?.03:.91);
      prism(c,v,x,yy,1,.07,9,10,6);
      prism(c,v,x+.04,yy-.025,.09,.12,13,10);
    }
    if(kind==='bank'){
      const xx=(x+(o.dx<0?0:1))*S,edge=M.MapProjection.project(v,xx,y*S),end=M.MapProjection.project(v,xx,(y+1)*S);
      surface(c,13,edge,end,{x:edge.x+3,y:edge.y+5},.28);
    }
    if(kind==='gate'){
      // Open passage and locked portcullis use the same real footprint.
      if(!o.open){
        const base=raised(v,x*S,(y+1)*S),top=raised(v,x*S,(y+1)*S,31);
        const right=raised(v,(x+1)*S,(y+1)*S,31);
        c.save();c.globalAlpha=.6;surface(c,9,top,right,base,.35);c.restore();
        for(let i=0;i<6;i++){
          const b=raised(v,(x+.08+i*.16)*S,(y+.98)*S),t=raised(v,(x+.08+i*.16)*S,(y+.98)*S,30);
          c.strokeStyle='#9ba795';c.lineWidth=1.2;c.beginPath();c.moveTo(t.x,t.y);c.lineTo(b.x,b.y);c.stroke();
        }
      }
      if(o.left)prism(c,v,x-.05,y+.68,.16,.32,36,4);
      if(o.right)prism(c,v,x+.89,y+.68,.16,.32,36,4);
      prism(c,v,x,y+.78,1,.22,38,4,30);
    }
    c.restore();
  }
  function obscures(o,u,v){
    if(!['tree','wall','tower','pillar','statue','resonance','gate'].includes(o.kind))return false;
    if(v&&v.inclinedPreview){
      const p=M.MapProjection.project(v,(u.x+.5)*S,(u.y+1)*S);
      const reach=o.kind==='tree'?26:30,height=o.height||54;
      return Math.abs(p.x-o.p.x)<reach&&p.y<=o.p.y&&o.p.y-p.y<height;
    }
    return Math.abs(u.x-o.x)<=.75 && u.y<=o.y && o.y-u.y<=2;
  }
  M.GardenMap={load,draw,drawGate,drawSample,drawGround,makeObjects,drawObject,obscures};
})(window);
