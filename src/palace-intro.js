/* Chapter ten opens the palace after the completed two-part rehearsal chapter. */
(function(global){
 'use strict';const M=global.MyGO,T=M.CONFIG.TILE,clamp=x=>Math.max(0,Math.min(1,x)),ease=x=>{x=clamp(x);return x*x*(3-2*x);};
 M.UI.prototype.playPalaceIntro=function(){
  const ui=this,g=this.game,r=this.renderer,root=this.dom.chapterIntro;if(g.palaceIntroSeen){this.finishChapterIntro();return;}
  root.classList.add('livehouse-intro');root.querySelector('.livehouse-opening')?.remove();const scene=document.createElement('div');scene.className='livehouse-opening palace-opening';
  scene.innerHTML='<div class="live-opening-head"><small>CHAPTER 10 / THE GILDED PALACE</small><h2>鎏金王座的铁蹄</h2><span>大理石回廊 · 金色宫门之后</span></div><canvas class="live-opening-canvas" width="1200" height="660" aria-label="众人进入宫殿，镜头沿红毯穿过列柱，精英战马骑士驻守王座厅"></canvas><div class="live-opening-caption" aria-live="polite"><canvas width="110" height="125"></canvas><div><small></small><p></p></div></div><div class="live-opening-skip">自动播放 · 点击 / Enter / Esc 跳过演出</div>';
  root.appendChild(scene);root.hidden=false;root.classList.remove('is-leaving');void root.offsetWidth;root.classList.add('is-visible');
  const c=scene.querySelector('.live-opening-canvas').getContext('2d'),face=scene.querySelector('.live-opening-caption canvas').getContext('2d'),speaker=scene.querySelector('.live-opening-caption small'),caption=scene.querySelector('.live-opening-caption p');
  const world=document.createElement('canvas');world.width=g.map.cols*T;world.height=g.map.rows*T;const wc=world.getContext('2d');
  const beats=[['长崎爽世','“排练室的回声消失了……这扇门后，居然是一座宫殿。”','soyo'],['安和昴','“前面有骑士。别被两侧的敌人分开了，大家一起走。”','subaru'],['精英战马骑士 · 金鬃卫长','“王座之前，禁止通行。”','gilded_cavalier'],['任务目标 · 击败精英战马骑士','沿中央红毯或两侧回廊推进，击败王座厅的金鬃卫长。留意骑兵的7格移动范围。','anon']];
  const bounds=[3000,6200,9800,13000],positions=g.living('player').map(u=>({u,x:u.x,y:u.y})),start=performance.now(),oldView=r.view;let last=start,part=-1,raf=0,stopped=false;
  const camera={x:6,y:24,w:18,h:12};r.setView({mode:'idle'});
  const draw=now=>{if(stopped||!ui.chapterOpen||ui.game!==g)return;const elapsed=now-start,step=bounds.findIndex(t=>elapsed<t);if(step<0){ui.finishChapterIntro();return;}
   scene.dataset.beat=String(step);if(part!==step){part=step;speaker.textContent=beats[step][0];caption.textContent=beats[step][1];face.clearRect(0,0,110,125);M.Characters.drawPortrait(face,beats[step][2],0,0,110,125,{head:true});}
   const entered=ease(elapsed/2400);for(const p of positions){p.u.y=p.y+(34-p.y)*(1-entered);p.u._walking=entered<1;r.snapUnit(p.u);}
   r.render(now);const scale=r.scale,p=M.MapProjection.project(r.projection,0,0);wc.clearRect(0,0,world.width,world.height);wc.drawImage(r.canvas,p.x*scale,p.y*scale,world.width*scale,world.height*scale,0,0,world.width,world.height);
   const target=step===0?{x:6,y:24,w:18,h:12}:step===1?{x:0,y:11,w:30,h:19}:step===2?{x:6,y:0,w:18,h:12}:{x:0,y:0,w:30,h:36};
   const blend=1-Math.exp(-Math.min(now-last,100)/550);last=now;for(const key of ['x','y','w','h'])camera[key]+=(target[key]-camera[key])*blend;
   c.fillStyle='#1d1c27';c.fillRect(0,0,1200,660);const fit=Math.min(1200/(camera.w*T),660/(camera.h*T)),w=camera.w*T*fit,h=camera.h*T*fit;c.drawImage(world,camera.x*T,camera.y*T,camera.w*T,camera.h*T,(1200-w)/2,(660-h)/2,w,h);raf=requestAnimationFrame(draw);
  };
  this.parkIntroCleanup=()=>{stopped=true;cancelAnimationFrame(raf);for(const p of positions){Object.assign(p.u,{x:p.x,y:p.y,_walking:false});r.snapUnit(p.u);}g.palaceIntroSeen=true;if(ui.game===g){r.setView(oldView);ui.updateAll();ui.renderIdleInfo();}setTimeout(()=>{root.classList.remove('livehouse-intro');scene.remove();},720);};
  raf=requestAnimationFrame(draw);
 };
})(window);
