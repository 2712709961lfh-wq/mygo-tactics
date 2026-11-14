/* Kenney park tiles, CC0 pegasus and synchronized CC BY-SA LPC plate-knight actions. */
(function(global){
  'use strict';
  const M=global.MyGO,C=M.Characters,P=M.ParkMap,S=M.CONFIG.TILE;
  const images={};
  function load(){return Promise.all(Object.entries({urban:'urban-atlas.png',armor:'armor-actions.png',warden:'warden-actions.png',pegasus:'pegasus-rider.png'}).map(([id,file])=>
    new Promise(resolve=>{const img=new Image();img.onload=()=>{images[id]=img;resolve(true);};img.onerror=()=>resolve(false);
      img.src=(global.MYGO_MAP_DATA||{})['watercourt'+id]||'assets/chapter-five/'+file;})));}
  function tile(c,i,x,y,w,h){if(images.urban)c.drawImage(images.urban,i*32,0,32,32,x,y,w,h);}
  const art={...P,drawGround(c,map){
    P.drawGround(c,map);
    if(!images.urban)return;
    for(let y=0;y<map.rows;y++)for(let x=0;x<map.cols;x++){
      const t=map.tiles[y][x];if(!['road','plaza','bridge'].includes(t))continue;
      const px=x*S,py=y*S;tile(c,t==='bridge'?2:t==='plaza'?1:0,px,py,S,S);
      c.fillStyle=t==='bridge'?'rgba(7,21,31,.52)':'rgba(9,25,37,.62)';c.fillRect(px,py,S,S);
      if(t==='bridge'&&(map.tiles[y-1]?.[x]==='water'||map.tiles[y+1]?.[x]==='water')){
        const yy=py+(map.tiles[y-1]?.[x]==='water'?2:S-3);c.strokeStyle='#81908b';c.lineWidth=2;c.beginPath();c.moveTo(px,yy);c.lineTo(px+S,yy);c.stroke();
      }
    }
  },drawObject(c,v,o){
    if(o.kind!=='chest'){P.drawObject(c,v,o);return;}
    const {p}=o;c.save();
    c.fillStyle='rgba(0,0,0,.5)';c.beginPath();c.ellipse(p.x,p.y+2,16,5,0,0,Math.PI*2);c.fill();
    c.fillStyle='#553b31';c.fillRect(p.x-13,p.y-15,26,17);c.strokeStyle='#c8a45e';c.lineWidth=2;c.strokeRect(p.x-13,p.y-15,26,17);
    if(o.opened){c.fillStyle='#141a25';c.fillRect(p.x-10,p.y-13,20,8);c.fillStyle='#a37a44';c.fillRect(p.x-13,p.y-23,26,6);}
    else{c.fillStyle='#967049';c.fillRect(p.x-12,p.y-19,24,7);c.fillStyle='#edcf78';c.fillRect(p.x-2,p.y-13,5,7);}
    c.textAlign='center';c.font='bold 9px sans-serif';c.strokeStyle='#101b26';c.lineWidth=3;c.strokeText(o.opened?'已开启':'宝箱',p.x,p.y+14);c.fillStyle=o.opened?'#8fa4a1':'#ffe0a0';c.fillText(o.opened?'已开启':'宝箱',p.x,p.y+14);c.restore();
  }};
  const ids=new Map([['court-armor-n','armor'],['court-armor-s','armor'],['court-armor-east','armor'],['iron_warden','warden'],
    ['court-pegasus-n','pegasus'],['court-pegasus-s','pegasus'],['court-pegasus-guard-n','pegasus'],['court-pegasus-guard-s','pegasus']]);
  const actions={idle:[0,2],walk:[4,8],attack:[8,8],hurt:[12,3],down:[16,6],jump:[20,5]};
  const isArmored=id=>ids.has(id)&&ids.get(id)!=='pegasus';
  function pose(id,state,frame=0,facing='left'){
    const kind=ids.get(id),name=state==='run'?'walk':actions[state]?state:'idle',spec=actions[name];
    const count=kind==='warden'&&name==='attack'?6:spec[1];
    return {kind,state:name,frame:Math.max(0,Math.min(count-1,Math.floor(frame))),
      row:spec[0]+({up:0,left:1,down:2,right:3}[facing]??1),count};
  }
  function draw(ctx,id,x,y,h,time=0,state='idle',facing='left',frame){
    const kind=ids.get(id),img=images[kind];if(!img)return false;
    ctx.save();ctx.translate(x,y);
    const hurt=state==='hurt';if(hurt)ctx.filter='brightness(1.5)';
    if(id==='iron_warden'){ctx.shadowColor='#efa655';ctx.shadowBlur=h*.08;}
    if(kind==='pegasus'){
      // The horse and rider source faces RIGHT; mirror it to face the western party.
      if(facing==='left')ctx.scale(-1,1);
      const tick=Math.floor(time/140)%7,w=h*.75,bob=Math.sin(time/220)*h*.025;
      ctx.imageSmoothingEnabled=false;ctx.drawImage(img,tick*36,0,36,48,-w/2,-h+bob,w,h);
    }else{
      const p=pose(id,state,frame??Math.floor(time/(state==='walk'?100:240))%(actions[state]?.[1]||2),facing),scale=h/48;
      ctx.imageSmoothingEnabled=false;
      ctx.drawImage(img,p.frame*192,p.row*192,192,192,-96*scale,-124*scale,192*scale,192*scale);
    }
    ctx.restore();return true;
  }
  for(const name of ['has','hasActions']){const base=C[name];C[name]=id=>ids.has(id)||base(id);}
  const map=C.drawMap;C.drawMap=(ctx,u,x,y,h,time,opts)=>{
    if(!ids.has(u.id))return map(ctx,u,x,y,h,time,opts);
    const moving=!!u._walking&&(!u._walkUntil||time<=u._walkUntil);
    return draw(ctx,u.id,x,y,u.boss?h*1.16:h,time,moving?'walk':'idle',u.facing);
  };
  const battle=C.drawBattlePose;C.drawBattlePose=(ctx,u,x,y,h,state,frame,facing,action)=>ids.has(u.id)?draw(ctx,u.id,x,y,h,global.performance?.now()||0,state,facing,frame):battle(ctx,u,x,y,h,state,frame,facing,action);
  const portrait=C.drawPortrait;C.drawPortrait=(ctx,id,x,y,w,h,opts)=>ids.has(id)?draw(ctx,id,x+w/2,y+h,h*.95,0,'idle','left'):portrait(ctx,id,x,y,w,h,opts);
  M.WatercourtArt={load,draw,images,isArmored,pose};M.WatercourtMap=art;
})(window);
