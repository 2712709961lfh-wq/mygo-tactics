/* Chapter 2: Moonlit fairy garden. Raster attribution: assets/terrain/moon-dream/README.md */
(function(global) {
  'use strict';
  const M=global.MyGO,S=M.CONFIG.TILE,A=256;
  let atlas;
  function load(){return new Promise(resolve=>{
    const img=new Image();img.onload=()=>{atlas=img;resolve(true);};
    img.onerror=()=>{console.error('Moon garden atlas could not be loaded');resolve(false);};
    img.src=(global.MYGO_MAP_DATA||{}).moonDream||'assets/terrain/moon-dream/moon-atlas.png';
  });}
  const at=(m,x,y)=>m.tiles[y]&&m.tiles[y][x];
  const wet=t=>t==='water'||t==='bridge';
  const hash=(x,y)=>(Math.imul(x+31,374761393)^Math.imul(y+19,668265263))>>>0;
  function tex(c,id,x,y,w=S,h=S,period=4){
    if(!atlas){c.fillStyle='#809eaa';c.fillRect(x,y,w,h);return;}
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
    const px=x*S,py=y*S,n=hash(x,y);tex(c,0,px,py);
    if(t==='road')tex(c,1,px,py,S,S,2);
    if(t==='plaza')tex(c,n%7===0?9:2,px,py,S,S,1);
    if(t==='wall')tex(c,2,px,py);
    if(t==='mountain')tex(c,5,px,py,S,S,2);
    if(wet(t)){
      tex(c,6,px,py,S,S,4);
      // Broken reflections follow the river, without covering the grid or units.
      c.strokeStyle='rgba(190,219,247,.2)';c.lineWidth=.6;
      for(let i=0;i<3;i++){const a=(n>>(i*5))%22;c.beginPath();c.moveTo(px+a,py+5+i*9);c.lineTo(px+a+6,py+4+i*9);c.stroke();}
      for(const dy of [-1,1])if(!wet(at(map,x,y+dy))){
        tex(c,8,px,py+(dy>0?S-4:0),S,4,2);
        c.fillStyle='rgba(192,224,217,.55)';c.fillRect(px,py+(dy>0?S-4:3),S,.8);
      }
      if(t==='bridge'){
        tex(c,7,px,py,S,S,2);
        c.fillStyle='rgba(247,227,216,.3)';c.fillRect(px+3,py,S-6,S);
        for(const dx of [-1,1])if(at(map,x+dx,y)!=='bridge'){
          const rx=px+(dx>0?S-4:0);tex(c,3,rx,py,4,S,1);
          c.fillStyle='rgba(43,52,82,.48)';c.fillRect(rx+(dx<0?4:-2),py,2,S);
          if(!wet(at(map,x,y-1))||!wet(at(map,x,y+1))){
            sprite(c,11,rx-3,py-4,10,26);glow(c,rx+2,py+4,13,'rgba(237,214,255,.28)');
          }
        }
      }
    }
  }
  function details(c,map,x,y,t){
    const px=x*S,py=y*S,n=hash(x,y);
    if(t==='wall'){
      const below=at(map,x,y+1)==='wall';
      tex(c,below?3:4,px,py,S,S,1);
      if(!below){tex(c,3,px,py,S,7,1);c.fillStyle='rgba(40,48,79,.26)';c.fillRect(px,py+S,S,5);}
      c.strokeStyle='rgba(244,225,210,.5)';c.lineWidth=.7;c.strokeRect(px+2,py+2,S-4,Math.max(3,below?S-4:4));
      if((x===5||x===18)&&y===2)sprite(c,12,px-S*.05,py-S*.3,S*1.1,S*1.3);
      if(y===5&&(x===8||x===15))sprite(c,11,px+3,py-8,26,40);
    }
    if(t==='forest'){
      sprite(c,14+n%3,px-S*.16,py-S*.49,S*1.3,S*1.52);
      if(n%3===0)sprite(c,17+n%3,px+S*.55,py+S*.55,S*.35,S*.4);
    }
    if(t==='mountain'){sprite(c,13,px-2,py-7,S+4,S+7);if(n%2===0)sprite(c,18,px+10,py+15,15,17);}
    if(t==='plain'&&(n%4===0||y>=13)){
      sprite(c,17+n%3,px+5+n%11,py+12+n%7,9+n%5,12+n%4);
    }
    if(t==='plaza'&&y===2&&(x===7||x===16))sprite(c,12,px+1,py-8,S-2,S+8);
  }
  function draw(c,map){
    c.save();c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
    for(let y=0;y<map.rows;y++)for(let x=0;x<map.cols;x++)ground(c,map,x,y,at(map,x,y));
    // Palace carpet, tiled borders and moon medallion lie beneath the pieces.
    if(map.cols===24&&map.rows===16){
      c.fillStyle='rgba(126,112,170,.22)';c.fillRect(10*S,2*S,4*S,4*S);
      c.strokeStyle='rgba(232,214,186,.65)';c.lineWidth=1.2;c.strokeRect(10*S+3,2*S+3,4*S-6,4*S-6);
      sprite(c,20,10*S,2*S,3*S,3*S);
      glow(c,12*S,3.5*S,3*S,'rgba(224,205,251,.12)');
    }
    for(let y=0;y<map.rows;y++)for(let x=0;x<map.cols;x++)details(c,map,x,y,at(map,x,y));
    for(let y=0;y<map.rows;y++)for(let x=0;x<map.cols;x++){
      const n=hash(x,y);if(at(map,x,y)==='water'&&n%5===0){
        glow(c,x*S+16,y*S+16,22,'rgba(177,194,255,.18)');
        c.fillStyle='rgba(229,224,255,.64)';c.fillRect(x*S+15,y*S+15,1.5,1.5);
      }
    }
    c.restore();
  }
  function drawSample(c,type,x=0,y=0,size=S){
    c.save();c.translate(x,y);c.scale(size/S,size/S);
    const map={tiles:[[type]]};ground(c,map,0,0,type);details(c,map,0,0,type);c.restore();
  }
  M.MoonMap={load,draw,drawSample};
})(window);
