/* CC0 Kenney texture overlays, retaining Soyo's authored movement and combat poses. */
(function(global){
  'use strict';
  const M=global.MyGO,C=M.Characters;let atlas;
  function load(){return new Promise(resolve=>{
    const img=new Image();img.onload=()=>{atlas=img;resolve(true);};img.onerror=()=>resolve(false);
    img.src=(global.MYGO_MAP_DATA||{}).darkSoyo||'assets/effects/dark-soyo/corruption-atlas.png';
  });}
  function tex(ctx,i,x,y,w,h,alpha=1){if(!atlas)return;ctx.save();ctx.globalAlpha*=alpha;
    ctx.drawImage(atlas,i*256,0,256,256,x,y,w,h);ctx.restore();}
  function aura(ctx,x,y,h,time,front=false){
    ctx.save();const pulse=.85+Math.sin(time/420)*.15;
    if(!front){
      const g=ctx.createRadialGradient(x,y-h*.4,h*.05,x,y-h*.4,h*.8);
      g.addColorStop(0,'rgba(143,38,175,.38)');g.addColorStop(1,'rgba(55,12,88,0)');
      ctx.fillStyle=g;ctx.fillRect(x-h,y-h*1.3,h*2,h*1.6);
      ctx.save();ctx.translate(x,y-h*.52);ctx.rotate(Math.sin(time/1700)*.18);
      tex(ctx,1,-h*.65,-h*.65,h*1.3,h*1.3,.65*pulse);ctx.restore();
      for(let i=0;i<3;i++)tex(ctx,0,x-h*.6+i*h*.22,y-h*.78-Math.sin(time/700+i)*h*.13,h*.8,h*.9,.5*pulse);
    }else{
      tex(ctx,2,x-h*.22,y-h*.78,h*.48,h*.58,.8);
      // Red tear glints sit on the face; drifting motes encircle the silhouette.
      ctx.shadowColor='#ff317a';ctx.shadowBlur=h*.09;ctx.fillStyle='#ff508d';
      ctx.fillRect(x-h*.07,y-h*.66,h*.035,h*.035);
      for(let i=0;i<5;i++){
        const a=time/900+i*1.25;ctx.globalAlpha=.55+.2*Math.sin(a);
        ctx.beginPath();ctx.arc(x+Math.cos(a)*h*.47,y-h*.45+Math.sin(a*1.4)*h*.4,h*.018,0,Math.PI*2);ctx.fill();
      }
    }ctx.restore();
  }
  const alias=id=>id==='dark_soyo'?'soyo':id;
  for(const name of ['has','hasActions']){const base=C[name];C[name]=id=>base(alias(id));}
  const baseMap=C.drawMap;
  C.drawMap=function(ctx,u,x,y,h,now,opts){
    if(u.id!=='dark_soyo')return baseMap(ctx,u,x,y,h,now,opts);
    aura(ctx,x,y,h,now);ctx.save();ctx.filter='brightness(.7) saturate(.65) hue-rotate(285deg)';
    const ok=baseMap(ctx,{...u,id:'soyo'},x,y,h,now,opts);ctx.restore();aura(ctx,x,y,h,now,true);return ok;
  };
  const baseBattle=C.drawBattlePose;
  C.drawBattlePose=function(ctx,u,x,y,h,state,frame,facing,action){
    if(u.id!=='dark_soyo')return baseBattle(ctx,u,x,y,h,state,frame,facing,action);
    const now=global.performance?.now()||0;aura(ctx,x,y,h,now);
    ctx.save();ctx.filter='brightness(.66) saturate(.7) hue-rotate(285deg)';
    const ok=baseBattle(ctx,{...u,id:'soyo'},x,y,h,state,frame,facing,action);ctx.restore();
    if(state!=='down')aura(ctx,x,y,h,now,true);return ok;
  };
  const basePortrait=C.drawPortrait;
  C.drawPortrait=function(ctx,id,x,y,w,h,opts){
    if(id!=='dark_soyo')return basePortrait(ctx,id,x,y,w,h,opts);
    ctx.save();ctx.filter='brightness(.65) saturate(.6) hue-rotate(285deg)';
    const ok=basePortrait(ctx,'soyo',x,y,w,h,opts);ctx.restore();
    tex(ctx,2,x,y,w,h,.6);return ok;
  };
  const baseProjectile=C.drawProjectile;
  C.drawProjectile=function(ctx,u,...args){if(u.id!=='dark_soyo')return baseProjectile(ctx,u,...args);
    ctx.save();ctx.filter='hue-rotate(260deg) saturate(1.8)';const ok=baseProjectile(ctx,{...u,id:'soyo'},...args);ctx.restore();return ok;};
  M.DarkSoyo={load,aura};
})(window);
