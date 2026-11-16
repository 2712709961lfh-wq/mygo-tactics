/* Enter through the lounge door, recognize the room, then watch its space unfold. */
(function(global){
 'use strict';const M=global.MyGO,T=M.CONFIG.TILE,clamp=x=>Math.max(0,Math.min(1,x)),ease=x=>{x=clamp(x);return x*x*(3-2*x);};
 M.UI.prototype.playNinthIntro=function(){
  const ui=this,g=this.game,r=this.renderer,root=this.dom.chapterIntro;
  if(g.stageNineIntroSeen){this.finishChapterIntro();return;}
  root.classList.add('livehouse-intro');root.querySelector('.livehouse-opening')?.remove();
  const scene=document.createElement('div');scene.className='livehouse-opening ninth-opening';
  scene.innerHTML='<div class="live-opening-head"><small>CHAPTER 09 / REHEARSAL ROOM</small><h2>门后的排练回声</h2><span>Live House 休息室入口 · 熟悉而陌生的空间</span></div>'+
   '<canvas class="live-opening-canvas" width="1200" height="660" aria-label="众人打开休息室的门，仁菜认出排练室；房间扩张，敌人与奇怪的门出现"></canvas>'+
   '<div class="live-opening-caption" aria-live="polite"><canvas width="110" height="125"></canvas><div><small></small><p></p></div></div>'+
   '<div class="live-opening-skip">自动播放 · 点击 / Enter / Esc 跳过演出</div>';
  root.appendChild(scene);root.hidden=false;root.classList.remove('is-leaving');void root.offsetWidth;root.classList.add('is-visible');
  const c=scene.querySelector('.live-opening-canvas').getContext('2d'),face=scene.querySelector('.live-opening-caption canvas'),speaker=scene.querySelector('.live-opening-caption small'),line=scene.querySelector('.live-opening-caption p');
  const world=document.createElement('canvas'),folded=document.createElement('canvas');world.width=folded.width=g.map.cols*T;world.height=folded.height=g.map.rows*T;
  const wc=world.getContext('2d'),fc=folded.getContext('2d'),nina=g.getUnit('nina');
  const beats=[['伊地知虹夏','“休息室应该就在这边。大家先进去歇一会儿吧。”','nijika'],
   [nina?'井芹仁菜':'长崎爽世',nina?'“等一下……这不是我们乐队的排练室吗？！为什么会在这里？”':'“这里……和仁菜说过的排练室很像。休息室的门后，为什么会是这里？”',nina?'nina':'soyo'],
   ['井芹仁菜的记忆 · 空间异变','镜面里熟悉的房间忽然拉长。吸音墙、地毯与音箱之间，出现了原本不存在的距离。',nina?'nina':'tomori'],
   ['高松灯','“又有敌人……大家小心！”','tomori'],
   ['伊地知虹夏','“看最里面！那扇门……刚才还没有。守在前面的天马，身上好像有钥匙。”','nijika'],
   [nina?'井芹仁菜':'椎名立希',nina?'“别把我们的排练室弄成这种样子！先打倒它，再把那扇门打开！”':'“先击败守门的天马，拿到钥匙。我们一起打开那扇门。”',nina?'nina':'taki'],
   ['任务目标 · 击败 Boss，打开奇怪的门','击败裂空天马，获得门的钥匙与钢枪。随后派队员到北端门旁使用钥匙，打开出口。','nijika']];
  const bounds=[2300,5100,8700,11900,14900,17500,20400],enemies=g.living('enemy'),party=g.living('player'),positions=party.map(u=>({u,x:u.x,y:u.y}));
  const oldView=r.view,start=performance.now();let raf=0,part=-1,stopped=false,last=start,camera={x:0,y:5,w:28,h:16};
  r.setView({mode:'idle'});g._liveIntro={visible:u=>u.side!=='enemy',doorAlpha:0};
  const reveal=u=>u.boss?11000:8700+enemies.filter(e=>!e.boss).indexOf(u)*145;
  const draw=now=>{
   if(stopped||!ui.chapterOpen||ui.game!==g)return;
   const elapsed=now-start,step=bounds.findIndex(t=>elapsed<t),growth=ease((elapsed-5100)/3600),doorAlpha=ease((elapsed-11900)/1500);
   if(step<0){ui.finishChapterIntro();return;}
   scene.dataset.beat=String(step);scene.dataset.roomGrowth=growth.toFixed(3);scene.dataset.doorAlpha=doorAlpha.toFixed(3);
   if(part!==step){part=step;speaker.textContent=beats[step][0];line.textContent=beats[step][1];const f=face.getContext('2d');f.clearRect(0,0,110,125);M.Characters.drawPortrait(f,beats[step][2],0,0,110,125,{head:true});}
   const entered=ease((elapsed-450)/2000);
   for(const p of positions){p.u.y=p.y+(31.5-p.y)*(1-entered);p.u._walking=entered<1;r.snapUnit(p.u);}
   g._liveIntro={visible:u=>u.side!=='enemy'||elapsed>=reveal(u),doorAlpha};
   for(const u of enemies)u._summonAlpha=ease((elapsed-reveal(u))/850);
   r.render(now);const scale=r.scale,p=M.MapProjection.project(r.projection,0,0);wc.clearRect(0,0,world.width,world.height);
   wc.drawImage(r.canvas,p.x*scale,p.y*scale,world.width*scale,world.height*scale,0,0,world.width,world.height);
   for(const u of enemies){const age=elapsed-reveal(u);if(age>-500&&age<1500){const a=age<0?clamp((age+500)/500):1-clamp((age-750)/750);
    M.MaskedCourtArt.circle(wc,(u.x+.5)*T,(u.y+.9)*T,u.boss?98:65,25,clamp((age+500)/2000),a);
    wc.save();wc.globalAlpha=a*.25;wc.fillStyle='#b8d5f5';wc.fillRect((u.x+.5)*T-12,(u.y+.9)*T-60,24,60);wc.restore();}}
   fc.clearRect(0,0,folded.width,folded.height);
   fc.drawImage(world,0,0,world.width,10*T,0,0,world.width,10*T);
   if(growth>0)fc.drawImage(world,0,10*T,world.width,14*T,0,10*T,world.width,14*T*growth);
   fc.drawImage(world,0,24*T,world.width,10*T,0,(10+14*growth)*T,world.width,10*T);
   // Open two visible leaves at the actual lounge entrance before the party runs in.
   if(elapsed<2600){const a=1-ease(elapsed/1700),ey=(32-14*(1-growth))*T;fc.fillStyle='#8a7664';fc.fillRect(12.5*T,ey-30,1.5*T*a,35);fc.fillRect((15.5-1.5*a)*T,ey-30,1.5*T*a,35);}
   if(step===2){fc.save();fc.strokeStyle='rgba(162,202,229,'+(Math.sin(growth*Math.PI)*.7)+')';fc.lineWidth=3;fc.strokeRect(2*T,10*T,24*T,14*T*growth);fc.restore();}
   const target=step<2?{x:0,y:3,w:28,h:18}:step===2?{x:0,y:0,w:28,h:20+14*growth}:step===4?{x:2,y:0,w:24,h:16}:step>=5?{x:0,y:0,w:28,h:34}:{x:0,y:0,w:28,h:34};
   const blend=1-Math.exp(-Math.min(now-last,100)/650);last=now;for(const k of ['x','y','w','h'])camera[k]+=(target[k]-camera[k])*blend;
   c.fillStyle='#15181c';c.fillRect(0,0,1200,660);const fit=Math.min(1200/(camera.w*T),660/(camera.h*T)),ww=camera.w*T*fit,hh=camera.h*T*fit;
   c.drawImage(folded,camera.x*T,camera.y*T,camera.w*T,camera.h*T,(1200-ww)/2,(660-hh)/2,ww,hh);
   raf=requestAnimationFrame(draw);
  };
  this.parkIntroCleanup=()=>{
   stopped=true;cancelAnimationFrame(raf);for(const p of positions){Object.assign(p.u,{x:p.x,y:p.y,_walking:false});r.snapUnit(p.u);}
   g.completeNinthIntro();
   if(ui.game===g){r.setView(oldView);ui.updateAll();ui.renderIdleInfo();}
   setTimeout(()=>{root.classList.remove('livehouse-intro');scene.remove();},720);
  };
  raf=requestAnimationFrame(draw);
 };
 M.UI.prototype.openNinthDoor=function(unit){
  const g=this.game,gate=g.useGateKey(unit);if(!gate)return;
  this.busy=true;g._doorOpenedAt=performance.now();this.renderer.terrainLayer=null;
  this.renderer.floatText('奇怪的门开启了',gate.x,gate.y-.4,'#bceaff',12);this.renderer.shake(500,2);
  this.resetSelection({silent:true});this.updateAll();this.revealCell(gate.x,gate.y);
  this.renderTerrainInfo(gate.x,gate.y);this.dom.contextTitle.textContent='出口已开启';
  this.dom.contextText.textContent='钥匙化作光芒，门后的道路打开了。即将结算本章。';
  this.setActions([{label:'出口已开启',disabled:true}]);
  this.showToast('钥匙化作光芒，门后的道路打开了。','success',2000);
  setTimeout(()=>{if(this.game!==g)return;this.busy=false;this.updateAll();this.showEndScreen();},1550);
 };
})(window);
