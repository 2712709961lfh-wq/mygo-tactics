/* Chapter 1: one CC0 raster tileset, Kenney Roguelike RPG Pack.
 * Borders use actual map.tiles; atlas: 16px tiles with 1px gutters.
 * Source/license and design references: docs/FATES-MAP-REMAKE.md. */
(function(global) {
  'use strict';
  const M=global.MyGO, S=M.CONFIG.TILE;
  let atlas;
  function load() {
    return new Promise(resolve=>{
      const img=new Image();
      img.onload=()=>{atlas=img;resolve(true);}; img.onerror=()=>resolve(false);
      img.src=(global.MYGO_MAP_DATA||{}).gardenRpg || 'assets/terrain/kenney/roguelike-rpg/garden-atlas.png';
    });
  }
  function tile(c,col,row,x,y,w=S,h=S) {
    if(atlas) c.drawImage(atlas,col*17,row*17,16,16,x,y,w,h);
    else { c.fillStyle='#536d52';c.fillRect(x,y,w,h); }
  }
  const at=(map,x,y)=>map.tiles[y]&&map.tiles[y][x];
  const wet=t=>t==='water'||t==='bridge'||t==='ford';
  const stone=t=>t==='wall'||t==='gate'||t==='gateOpen';
  function grass(c,x,y) { tile(c,5,(x*3+y*7)%9===0?1:0,x*S,y*S); }
  function drawCell(c,map,x,y,type) {
    const px=x*S,py=y*S;
    grass(c,x,y);
    if(type==='road') {
      tile(c,6,0,px,py);
      for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const n=at(map,x+dx,y+dy);
        if(n==='plain'||n==='forest') {
          c.save();c.globalAlpha=.28;
          c.beginPath();
          if(dx) c.rect(px+(dx>0?S-2:0),py,2,S);
          else c.rect(px,py+(dy>0?S-2:0),S,2);
          c.clip();grass(c,x,y);c.restore();
        }
      }
    }
    if(['plaza','gate','gateOpen','fort','resonance'].includes(type)) tile(c,9,0,px,py);
    if(wet(type)) {
      tile(c,0,(x+y)%3===0?1:0,px,py);
      if(!wet(at(map,x-1,y))) tile(c,2,1,px,py);
      if(!wet(at(map,x+1,y))) tile(c,4,1,px,py);
      if(!wet(at(map,x,y-1))) tile(c,3,0,px,py);
      if(!wet(at(map,x,y+1))) tile(c,3,2,px,py);
      if(type==='bridge') {
        tile(c,8,3,px,py);
        tile(c,49,23,px,py+2,S,7);tile(c,49,23,px,py+S-9,S,7);
      }
      if(type==='ford') {
        c.save();c.globalAlpha=.65;tile(c,7,0,px+4,py+5,24,22);c.restore();
        tile(c,9,18,px+6,py+8,13,13);
      }
    }
    if(type==='forest') {
      const variants=[[13,9],[16,9],[18,9],[19,9]],v=variants[(x*11+y*3)%4];
      c.fillStyle='rgba(20,34,29,.18)';c.fillRect(px+3,py+23,27,7);
      tile(c,v[0],v[1],px-1,py-5,34,38);
    }
    if(type==='mountain') tile(c,56,19,px-1,py-1,34,34);
    if(type==='wall') {
      const l=stone(at(map,x-1,y)),r=stone(at(map,x+1,y)),u=stone(at(map,x,y-1));
      tile(c,24,18,px,py);
      if(!u) tile(c,24,14,px,py-4,S,S);
      if(!l) tile(c,22,18,px,py);
      if(!r) tile(c,23,18,px,py);
      if(!stone(at(map,x,y+1))) {c.fillStyle='rgba(14,23,27,.25)';c.fillRect(px,py+S-2,S,5);}
      if((x+y*3)%7===0) tile(c,24,19,px+5,py+5,22,22);
    }
    if(type==='fort') {
      tile(c,13,0,px+2,py+3,27,27);tile(c,51,6,px+19,py-7,16,24);
    }
    if(type==='resonance') {
      tile(c,49,9,px+2,py-4,28,34);tile(c,48,9,px+8,py+3,16,16);
    }
    if(type==='plain'&&(x*17+y*31)%29===0) tile(c,28+(x%4),9,px+8,py+10,16,16);
    if(type==='plaza'&&((x===25||x===32)&&y===3)) tile(c,45,9,px+6,py+2,22,28);
  }
  function draw(c,map) {
    c.save();c.imageSmoothingEnabled=false;
    for(let y=0;y<map.rows;y++) for(let x=0;x<map.cols;x++) drawCell(c,map,x,y,at(map,x,y));
    const light=c.createLinearGradient(0,0,map.cols*S,map.rows*S);
    light.addColorStop(0,'rgba(244,216,160,.055)');light.addColorStop(1,'rgba(25,35,62,.10)');
    c.fillStyle=light;c.fillRect(0,0,map.cols*S,map.rows*S);c.restore();
  }
  function drawGate(c,map,open) {
    for(let y=0;y<map.rows;y++) for(let x=0;x<map.cols;x++) {
      if(!['gate','gateOpen'].includes(at(map,x,y))) continue;
      const left=at(map,x-1,y)!=='gate'&&at(map,x-1,y)!=='gateOpen';
      tile(c,9,0,x*S,y*S);tile(c,left?32:33,open?8:3,x*S,y*S-4,S,S+4);
    }
  }
  function drawSample(c,type,x=0,y=0,size=S) {
    c.save();c.translate(x,y);c.scale(size/S,size/S);
    drawCell(c,{tiles:[[type]]},0,0,type);c.restore();
  }
  M.GardenMap={load,draw,drawGate,drawSample};
})(window);
