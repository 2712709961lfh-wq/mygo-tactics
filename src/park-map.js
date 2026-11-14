/* Modern night park: concrete walks, planting beds, steel lamps and timber benches. */
(function(global){
  'use strict';
  const M=global.MyGO,S=M.CONFIG.TILE,TAU=Math.PI*2;
  const hash=(x,y)=>(Math.imul(x+17,374761393)^Math.imul(y+31,668265263))>>>0;
  function ellipse(c,x,y,rx,ry,color){c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fill();}
  function glow(c,x,y,r,color){const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'rgba(255,211,133,0)');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);}
  function drawGround(c,map){
    M.MoonMap.drawGround(c,map);
    c.fillStyle='rgba(4,18,26,.56)';c.fillRect(0,0,map.cols*S,map.rows*S);
    for(let y=0;y<map.rows;y++)for(let x=0;x<map.cols;x++){
      const t=map.tiles[y][x],px=x*S,py=y*S,n=hash(x,y);
      if(['road','plaza','fort'].includes(t)){
        c.fillStyle=t==='plaza'?'#48545b':'#3b474e';c.fillRect(px,py,S,S);
        c.strokeStyle='#26353e';c.lineWidth=.7;c.strokeRect(px+.5,py+.5,S-1,S-1);
        c.strokeStyle='rgba(180,205,209,.12)';c.beginPath();c.moveTo(px+1,py+1);c.lineTo(px+S-1,py+1);c.stroke();
        for(let i=0;i<13;i++){c.fillStyle=i%2?'#45535a':'#33434a';c.fillRect(px+(n>>i)%31,py+(n>>(i+3))%31,.8,.8);}
        if(t==='fort'){c.strokeStyle='#b4c7b5';c.strokeRect(px+4,py+4,24,24);c.fillStyle='#a0c4af';c.fillRect(px+14,py+9,4,14);c.fillRect(px+9,py+14,14,4);}
      }
      if(t==='water'){
        c.fillStyle='rgba(3,21,42,.45)';c.fillRect(px,py,S,S);
        c.strokeStyle='rgba(108,174,199,.25)';c.lineWidth=.8;
        for(let i=0;i<3;i++){c.beginPath();c.moveTo(px+4+i*3,py+7+i*8);c.lineTo(px+17+i*2,py+6+i*8);c.stroke();}
        for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])if(map.tiles[y+dy]?.[x+dx]!=='water'){
          c.fillStyle='#637579';c.fillRect(px+(dx>0?29:0),py+(dy>0?29:0),dx?3:S,dy?3:S);
        }
        if(n%7===0){ellipse(c,px+16,py+19,5,2.6,'#365e56');ellipse(c,px+17,py+18,1.5,1,'#b98caa');}
      }
      if(t==='plain'&&n%3===0){c.strokeStyle='rgba(127,165,127,.22)';c.lineWidth=.7;
        c.beginPath();c.moveTo(px+10,py+24);c.lineTo(px+8,py+20);c.moveTo(px+10,py+24);c.lineTo(px+13,py+19);c.stroke();}
    }
    // Metal perimeter fence, leaving the west entrance open.
    c.strokeStyle='#74888d';c.lineWidth=.7;
    for(let x=1;x<map.cols;x++){c.beginPath();c.moveTo(x*S,5);c.lineTo(x*S,25);c.stroke();}
    c.strokeStyle='#34484e';c.strokeRect(S,S,(map.cols-2)*S,(map.rows-2)*S);
  }
  function makeObjects(map,v){
    const list=[];
    const add=(kind,x,y,extra={})=>{const p=M.MapProjection.project(v,(x+.5)*S,(y+.85)*S);list.push({kind,x,y,p,depth:p.y,...extra});};
    for(let y=0;y<map.rows;y++)for(let x=0;x<map.cols;x++)
      if(map.tiles[y][x]==='forest')add('bush',x,y,{tree:hash(x,y)%5===0});
    for(const d of map.decor||[])add(d.kind,d.x,d.y,d);
    return list;
  }
  function drawObject(c,v,o){
    const {p,kind}=o;c.save();
    if(kind==='lamp'){
      ellipse(c,p.x+3,p.y+2,10,3,'rgba(0,0,0,.4)');
      c.fillStyle='#182b35';c.fillRect(p.x-3,p.y-3,6,5);c.fillRect(p.x-1.5,p.y-51,3,49);
      c.fillStyle='#719092';c.fillRect(p.x-1,p.y-50,1,46);
      c.fillStyle='#223740';c.fillRect(p.x-7,p.y-54,14,4);
      c.fillStyle=o.lit?'#ffe6a8':'#718086';c.fillRect(p.x-6,p.y-50,12,2);
      if(o.lit){glow(c,p.x,p.y-49,36,'rgba(255,216,139,.42)');ellipse(c,p.x,p.y,25,8,'rgba(255,220,151,.09)');}
    }
    if(kind==='bench'){
      ellipse(c,p.x+2,p.y+3,21,5,'rgba(0,0,0,.36)');
      c.fillStyle='#182b33';for(const dx of [-13,13]){c.fillRect(p.x+dx-1,p.y-15,3,20);c.fillRect(p.x+dx-1,p.y-2,7,2);}
      for(let i=0;i<3;i++){c.fillStyle=i%2?'#9e7b58':'#7d624b';c.fillRect(p.x-19,p.y-18+i*4,38,3);c.fillRect(p.x-19,p.y-3+i*2,38,1.5);}
      c.fillStyle='#3b5159';c.fillRect(p.x+25,p.y-13,9,16);c.fillStyle='#6d7d80';c.fillRect(p.x+24,p.y-15,11,3);
    }
    if(kind==='bush'){
      const n=hash(o.x,o.y);ellipse(c,p.x+2,p.y,17,5,'rgba(0,0,0,.3)');
      if(o.tree){c.fillStyle='#504a40';c.fillRect(p.x-2,p.y-28,4,28);}
      const lift=o.tree?25:3;
      for(let i=0;i<5;i++){const dx=(i%3-1)*9,dy=(i%2)*6;ellipse(c,p.x+dx,p.y-lift-6-dy,12,9,i%2?'#24463d':'#315547');
        ellipse(c,p.x+dx-2,p.y-lift-9-dy,8,4,'rgba(110,145,110,.12)');}
    }
    if(kind==='flowerbed'){
      ellipse(c,p.x,p.y,32,12,'#48585b');ellipse(c,p.x,p.y-2,30,10,'#203b34');
      const colors=['#cf7dab','#8f87cc','#e3b482','#668a79'];
      for(let i=0;i<20;i++){const a=i*2.4,r=4+i%5*4,x=p.x+Math.cos(a)*r*1.4,y=p.y-3+Math.sin(a)*r*.35;
        c.fillStyle=colors[i%4];c.beginPath();c.arc(x,y,1.6,0,TAU);c.fill();}
    }
    if(kind==='sign'){
      c.fillStyle='#637573';c.fillRect(p.x-1,p.y-14,2,15);c.fillStyle='#233e42';c.fillRect(p.x-25,p.y-25,50,12);
      c.strokeStyle='#83968c';c.lineWidth=.7;c.strokeRect(p.x-25,p.y-25,50,12);
      c.fillStyle='#d8dcc6';c.font='7px sans-serif';c.textAlign='center';c.fillText(o.label,p.x,p.y-17);
    }
    c.restore();
  }
  function drawLights(c,v,game){
    c.save();M.MapProjection.apply(c,v);
    for(const l of game.mission.lamps)if(game.stage>=5||game.litLamps.includes(l.id)||game.parkIntroLights){
      const g=c.createRadialGradient((l.x+.5)*S,(l.y+.5)*S,0,(l.x+.5)*S,(l.y+.5)*S,game.mission.lampRadius*S);
      g.addColorStop(0,'rgba(255,221,150,.16)');g.addColorStop(1,'rgba(255,221,150,0)');c.fillStyle=g;
      c.fillRect((l.x-6)*S,(l.y-6)*S,13*S,13*S);
    }c.restore();
  }
  function drawFog(c,v,game,renderer){
    if(game.parkIntroLights)return;
    const signature=game.litLamps.join(',')+'|'+game.living('player').map(u=>u.x+','+u.y).join('|');
    if(renderer._parkFogKey!==signature){
      const fog=document.createElement('canvas');fog.width=game.map.cols*S;fog.height=game.map.rows*S;
      const f=fog.getContext('2d');f.fillStyle='#050c17';f.fillRect(0,0,fog.width,fog.height);
      f.globalCompositeOperation='destination-out';
      const sources=game.living('player').map(u=>({...u,r:game.mission.visionRadius})).concat(
        game.mission.lamps.filter(l=>game.litLamps.includes(l.id)).map(l=>({...l,r:game.mission.lampRadius})));
      for(const p of sources){const x=(p.x+.5)*S,y=(p.y+.5)*S,r=(p.r+.8)*S;
        const g=f.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(0,0,0,1)');
        g.addColorStop(.78,'rgba(0,0,0,1)');g.addColorStop(1,'rgba(0,0,0,0)');f.fillStyle=g;f.fillRect(x-r,y-r,r*2,r*2);}
      renderer._parkFog=fog;renderer._parkFogKey=signature;
    }
    c.save();M.MapProjection.apply(c,v);c.drawImage(renderer._parkFog,0,0);c.restore();
  }
  function drawBattleBackground(c,w,h,lit){
    const sky=c.createLinearGradient(0,0,0,210);sky.addColorStop(0,'#07111e');sky.addColorStop(1,'#253946');
    c.fillStyle=sky;c.fillRect(0,0,w,h);
    glow(c,370,44,60,'rgba(209,225,232,.14)');ellipse(c,370,44,11,11,'#d9e0d1');
    // Distant city blocks ground the setting in a modern park.
    for(let i=0;i<20;i++){
      const height=18+hash(i,7)%43,x=i*31;c.fillStyle=i%2?'#152634':'#192c39';c.fillRect(x,133-height,24,height);
      for(let y=136-height;y<128;y+=8)for(let xx=x+4;xx<x+22;xx+=7){c.fillStyle=(xx+y)%3?'#52625d':'#203a43';c.fillRect(xx,y,2,3);}
    }
    c.fillStyle='#203e38';c.fillRect(0,130,w,90);
    for(let i=0;i<18;i++){
      const x=i*35,y=139+hash(i,1)%13;c.fillStyle='#293d36';c.fillRect(x-2,y-27,4,47);
      ellipse(c,x,y-31,25,20,i%2?'#18352e':'#24443a');ellipse(c,x-11,y-39,14,14,'#294b3f');
    }
    // Pond, low safety railing and the concrete foreground walk.
    ellipse(c,289,178,185,29,'#39505a');ellipse(c,289,177,181,26,'#102b3e');
    c.strokeStyle='#436473';c.lineWidth=1;
    for(let i=0;i<24;i++){const x=127+hash(i,2)%310,y=159+hash(i,3)%30;c.beginPath();c.moveTo(x,y);c.lineTo(x+7+hash(i,4)%13,y);c.stroke();}
    c.strokeStyle='#748886';c.lineWidth=1;c.beginPath();c.moveTo(90,194);c.lineTo(486,194);c.moveTo(90,186);c.lineTo(486,186);c.stroke();
    for(let x=90;x<=486;x+=22){c.fillStyle='#354e51';c.fillRect(x,183,2,23);}
    c.fillStyle='#2d3d43';c.fillRect(0,209,w,h-209);
    for(let y=213;y<h;y+=23){c.strokeStyle='#3e5057';c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}
    for(let x=0;x<w;x+=49){c.strokeStyle='#1d3038';c.beginPath();c.moveTo(288+(x-288)*.8,209);c.lineTo(x,h);c.stroke();}
    const obj=(kind,x,y,extra={})=>drawObject(c,null,{kind,p:{x,y},...extra});
    for(const x of [62,515]){
      c.save();c.translate(x,202);c.scale(1.6,1.6);obj('lamp',0,0,{lit});c.restore();
      if(lit){glow(c,x,126,65,'rgba(255,215,143,.14)');ellipse(c,x,226,48,10,'rgba(244,216,154,.06)');}
    }
    obj('bench',112,205);obj('bench',469,205);obj('flowerbed',23,221);obj('flowerbed',554,221);
    c.fillStyle='rgba(4,12,24,.2)';c.fillRect(0,0,w,h);
  }
  M.ParkMap={drawGround,makeObjects,drawObject,drawLights,drawFog,drawBattleBackground,
    drawSample:(c,t)=>{M.MoonMap.drawSample(c,t);c.fillStyle='rgba(4,18,26,.45)';c.fillRect(0,0,S,S);}};
})(window);
