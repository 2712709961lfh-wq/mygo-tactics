/* The supplied masked woman, unified LPC court scenery and violet portal effects. */
(function(global){
  'use strict';
  const M=global.MyGO,C=M.Characters,P=M.ParkMap,T=M.CONFIG.TILE,images={};
  const files={actions:'mask-actions.png',walk:'mask-walk.png',idle:'mask-idle.png',portrait:'mask-portrait.png',throne:'throne.png',lamp:'palace-lamp.png',circle:'void-circle.png'};
  function load(){return Promise.all(Object.entries(files).map(([id,file])=>new Promise(resolve=>{
    const img=new Image();img.onload=()=>{images[id]=img;resolve(true);};img.onerror=()=>resolve(false);
    img.src=(global.MYGO_MAP_DATA||{})['mask'+id]||'assets/chapter-six/'+file;
  })));}
  function circle(c,x,y,w,h,t,alpha=1){
    c.save();c.globalAlpha*=alpha;
    if(images.circle){const frame=Math.max(0,Math.min(15,Math.floor(t*16)));c.drawImage(images.circle,frame%4*256,Math.floor(frame/4)*256,256,256,x-w/2,y-h/2,w,h);}
    c.restore();
  }
  function aura(c,x,y,h,now,active=false){
    c.save();const g=c.createRadialGradient(x,y-h*.4,1,x,y-h*.4,h*.8);
    g.addColorStop(0,active?'rgba(148,54,197,.48)':'rgba(92,37,141,.25)');g.addColorStop(1,'rgba(30,14,51,0)');c.fillStyle=g;c.fillRect(x-h,y-h*1.4,h*2,h*1.7);
    circle(c,x,y,h*.95,h*.3,.45+(Math.sin(now/1100)+1)*.15,.6);
    c.fillStyle='#d5a5ef';
    for(let i=0;i<7;i++){const a=now/1300+i*1.7;c.globalAlpha=.25+.3*(1+Math.sin(a))/2;c.beginPath();c.arc(x+Math.cos(a)*h*.45,y-h*.45+Math.sin(a*1.3)*h*.45,h*.015,0,Math.PI*2);c.fill();}
    c.restore();
  }
  const specs={idle:[0,7],walk:[1,7],run:[1,7],attack:[2,6],summon:[2,6],hurt:[3,3],down:[4,4]};
  for(const spec of Object.values(specs))Object.freeze(spec);Object.freeze(specs);
  function frameAt(state,progress){const count=(specs[state]||specs.idle)[1];return Math.max(0,Math.min(count-1,Math.floor(progress*count)));}
  function action(c,x,y,h,state,frame,facing='right',now=0){
    if(!images.actions)return false;
    const spec=specs[state]||specs.idle,k=Math.max(0,Math.min(spec[1]-1,Math.floor(frame||0))),scale=h/108;
    aura(c,x,y,h,now,state==='summon');c.save();c.translate(x,y);if(facing==='left')c.scale(-1,1);
    c.imageSmoothingEnabled=true;c.drawImage(images.actions,k*256,spec[0]*160,256,160,-64*scale,-143*scale,256*scale,160*scale);c.restore();return true;
  }
  const alias=id=>M.CONFIG.STAGE_ROYAL_GARDEN?.enemies.find(u=>u.id===id)?.art||M.CONFIG.STAGE_PALACE?.enemies.find(u=>u.id===id)?.art||M.CONFIG.STAGE_SIX.summonTemplates.find(u=>u.id===id)?.art||M.CONFIG.STAGE_EIGHT?.enemies.find(u=>u.id===id)?.art||M.CONFIG.STAGE_NINE?.enemies.find(u=>u.id===id)?.art||M.CONFIG.STAGE_TEN?.enemies.find(u=>u.id===id)?.art;
  const armored=M.WatercourtArt.isArmored;M.WatercourtArt.isArmored=id=>alias(id)==='park-armor'||armored(id);
  const has=C.has,hasActions=C.hasActions;C.has=id=>id==='masked_stranger'||['park-armor','park-pegasus'].includes(alias(id))||has(id);C.hasActions=id=>id==='masked_stranger'||['park-armor','park-pegasus'].includes(alias(id))||hasActions(id);
  const map=C.drawMap;C.drawMap=function(c,u,x,y,h,now,opts){
    if(u.id!=='masked_stranger'){
      const a=alias(u.id);
      if(a==='park-armor'||a==='park-pegasus')return M.WatercourtArt.draw(c,a==='park-armor'?'court-armor-n':'court-pegasus-guard-n',x,y,h,now,u._walking?'walk':'idle',u.facing);
      return map(c,u,x,y,h,now,opts);
    }
    if(u._casting)return action(c,x,y-8,h*1.1,'summon',frameAt('summon',u._casting),'right',now);
    if(u._teleporting)return action(c,x,y-8,h*1.1,'idle',Math.floor(now/180)%specs.idle[1],'right',now);
    if(!images.idle)return false;
    aura(c,x,y-8,h,now);c.save();c.imageSmoothingEnabled=true;
    const dir={down:0,up:1,left:2,right:3}[u.facing]||0;
    if(u._walking&&images.walk){const tick=Math.floor(now/130)%3,row={down:0,up:1,left:2,right:3}[u.facing]||0;c.drawImage(images.walk,tick*128,row*144,128,144,x-h*.5,y-h,h, h*1.125);}
    else{
      // The upper body rests above the throne seat; compressed lower legs hang below it.
      const w=h*.95,top=y-h-12;c.drawImage(images.idle,dir*128,0,128,108,x-w/2,top,w,h*.84);
      c.drawImage(images.idle,dir*128,108,128,36,x-w/2,top+h*.84,w,h*.17);
    }
    c.restore();return true;
  };
  const battle=C.drawBattlePose;C.drawBattlePose=function(c,u,x,y,h,state,frame,facing,weaponAction){
    if(u.id==='masked_stranger')return action(c,x,y,h,state,frame,facing,global.performance?.now()||0);
    const a=alias(u.id);
    if(a==='park-armor'||a==='park-pegasus')return M.WatercourtArt.draw(c,a==='park-armor'?'court-armor-n':'court-pegasus-guard-n',x,y,h,global.performance?.now()||0,state,facing,frame);
    return battle(c,u,x,y,h,state,frame,facing,weaponAction);
  };
  const portrait=C.drawPortrait;C.drawPortrait=function(c,id,x,y,w,h,opts){
    if(id!=='masked_stranger'){const a=alias(id);return portrait(c,a==='park-armor'?'court-armor-n':a==='park-pegasus'?'court-pegasus-guard-n':id,x,y,w,h,opts);}
    if(!images.portrait)return false;c.save();c.beginPath();c.rect(x,y,w,h);c.clip();
    const img=images.portrait,scale=opts?.head?Math.max(w/(img.width*.65),h/(img.height*.55)):Math.min(w/img.width,h/img.height);
    c.drawImage(img,x+(w-img.width*scale)/2,y,img.width*scale,img.height*scale);c.restore();return true;
  };
  function throne(c,x,y,scale=1){if(images.throne){c.save();c.imageSmoothingEnabled=false;c.drawImage(images.throne,x-25*scale,y-83*scale,50*scale,96*scale);c.restore();}}
  const art={...M.WatercourtMap,drawGround(c,map){
    M.WatercourtMap.drawGround(c,map);
    // A burgundy processional strip joins the modern avenue to the ceremonial plaza.
    for(let y=2;y<=10;y++)for(let x=13;x<=16;x++){
      c.fillStyle='#452735';c.fillRect(x*T,y*T,T,T);c.strokeStyle='rgba(171,135,86,.55)';c.lineWidth=1;
      if(x===13||x===16){const xx=x*T+(x===13?3:29);c.beginPath();c.moveTo(xx,y*T);c.lineTo(xx,(y+1)*T);c.stroke();}
    }
    c.fillStyle='rgba(194,175,131,.2)';for(let i=0;i<3;i++)c.fillRect(10*T,(8+i)*T,10*T,3);
  },makeObjects(map,v){
    return M.WatercourtMap.makeObjects(map,v).map(o=>o.kind==='throne'?{...o,depth:o.depth-12}:o);
  },drawObject(c,v,o){
    if(o.kind==='throne'){throne(c,o.p.x,o.p.y,1.05);return;}
    if(o.kind!=='palaceLamp'){M.WatercourtMap.drawObject(c,v,o);return;}
    if(images.lamp){c.save();c.imageSmoothingEnabled=false;c.drawImage(images.lamp,o.p.x-15,o.p.y-89,30,90);
      const g=c.createRadialGradient(o.p.x,o.p.y-76,0,o.p.x,o.p.y-76,31);g.addColorStop(0,'rgba(255,218,145,.35)');g.addColorStop(1,'rgba(255,220,140,0)');c.fillStyle=g;c.fillRect(o.p.x-32,o.p.y-108,64,64);c.restore();}
  }};
  function drawMapEffects(c,v,game,now){
    const fx=game._courtFx;if(!fx)return;
    if(fx.kind==='summon'){
      const boss=game.getUnit('masked_stranger'),p=M.MapProjection.project(v,(boss.x+.5)*T,(boss.y+.85)*T);
      circle(c,p.x,p.y,76,28,Math.min(.99,fx.progress*2.5),.8);
    }
    for(const point of fx.points){const p=M.MapProjection.project(v,(point.x+.5)*T,(point.y+.85)*T);const t=fx.progress;
      circle(c,p.x,p.y,fx.kind==='escape'?100:68,fx.kind==='escape'?38:25,Math.min(.99,t*1.1),1-t*.3);
      c.save();const hh=(fx.kind==='escape'?110:74)*Math.sin(Math.PI*t),w=fx.kind==='escape'?50:29;
      const g=c.createLinearGradient(p.x,p.y-hh,p.x,p.y);g.addColorStop(0,'rgba(133,64,205,0)');g.addColorStop(1,'rgba(188,119,242,.6)');c.fillStyle=g;c.fillRect(p.x-w/2,p.y-hh,w,hh);c.restore();
    }
  }
  M.MaskedCourtArt={load,images,specs,frameAt,action,aura,circle,throne,drawMapEffects};M.MaskedCourtMap=art;
})(window);
