/* Chapter 1: Flare Grassland + rubberduck Old Ruins, CC BY-SA 3.0.
 * Orthogonal derivatives: tools/prepare-flare-assets.py. Credits and original
 * sources: assets/terrain/flare/README.md. Geometry always reads map.tiles. */
(function(global) {
  'use strict';
  const M=global.MyGO, S=M.CONFIG.TILE, A=256;
  let atlas;
  function load() {
    return new Promise(resolve=>{
      const img=new Image();img.onload=()=>{atlas=img;resolve(true);};
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
    if(atlas)c.drawImage(atlas,id%8*A,Math.floor(id/8)*A,A,A,x,y,w,h);
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
        c.save();c.globalAlpha=.64;tex(c,1,px+3,py+3,S-6,S-6,2);c.restore();
        c.fillStyle='rgba(100,157,165,.18)';c.fillRect(px+3,py+3,S-6,S-6);
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
  M.GardenMap={load,draw,drawGate,drawSample};
})(window);
