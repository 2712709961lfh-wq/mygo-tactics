/* Opening recruits Nijika at the party's answer, including when skipped. */
(function(global){
 'use strict';const M=global.MyGO;
 M.UI.prototype.playLivehouseIntro=function(){
  const root=this.dom.chapterIntro,game=this.game,r=this.renderer;
  if(game.nijikaJoined){this.finishChapterIntro();return;}
  root.classList.add('livehouse-intro');root.querySelector('.livehouse-opening')?.remove();
  const scene=document.createElement('div');scene.className='livehouse-opening';
  scene.innerHTML='<div class="live-opening-head"><small>CHAPTER 07 / STARRY</small><h2>繁星之下的求援</h2><span>下北泽 · 地下 Live House</span></div><canvas class="live-opening-canvas" width="1200" height="660" aria-label="虹夏进入演出厅，敌人突然现身，主角团赶来回应求助"></canvas><div class="live-opening-caption" aria-live="polite"><canvas width="110" height="125"></canvas><div><small></small><p></p></div></div><div class="live-opening-skip">点击任意处 / Enter 跳过 · 虹夏仍会入队</div>';
  root.appendChild(scene);root.hidden=false;root.classList.remove('is-leaving');void root.offsetWidth;root.classList.add('is-visible');
  const canvas=scene.querySelector('.live-opening-canvas'),ctx=canvas.getContext('2d'),face=scene.querySelector('.live-opening-caption canvas'),speaker=scene.querySelector('.live-opening-caption small'),line=scene.querySelector('.live-opening-caption p');
  const party=game.living('player'),nijika=game.getUnit('nijika'),start=performance.now();let raf=0,part=-1,stopped=false,camera={x:6,y:17,w:18,h:11};
  const beats=[['STARRY','演出结束后的 Live House，本该只剩熟悉的安静。','nijika'],['伊地知虹夏','“诶……？这些家伙，是从哪里冒出来的？！”','nijika'],['门口，传来急促的脚步','听见厅内的动静，主角团推门赶来。','tomori'],['伊地知虹夏','“请帮帮我！这些家伙突然出现在 STARRY 里……再这样下去，舞台会被毁掉的！”','nijika'],['高松灯','“我们听见了。一起……把这里守住吧。”','tomori'],['伊地知虹夏 · 加入队伍','“谢谢你们！我叫伊地知虹夏。这次，就让我和大家一起守住这里吧！”','nijika'],['任务目标','击败全部敌人，夺回 Live House 的舞台。','nijika']];
  const bounds=[2400,4700,6700,9700,12100,14600,16700];
  const draw=now=>{
   if(stopped||!this.chapterOpen||this.game!==game)return;
   const elapsed=now-start,step=Math.max(0,bounds.findIndex(t=>elapsed<t));
   game._liveIntro={visible:u=>u.id==='nijika'||u.side==='enemy'&&elapsed>=2400||u.side==='player'&&elapsed>=4700};
   if(elapsed>=9700&&!game.nijikaJoined){game.joinNijika();this.updateAll();}
   if(step!==part){part=step;scene.dataset.beat=String(step);speaker.textContent=beats[step][0];line.textContent=beats[step][1];const fc=face.getContext('2d');fc.clearRect(0,0,110,125);M.Characters.drawPortrait(fc,beats[step][2],0,0,110,125,{head:true});}
   for(const [i,u] of [nijika,...party].entries()){
    const v=r.visuals.get(u.id),p=Math.max(0,Math.min(1,(elapsed-(i===0?0:4700+(i-1)*130))/2000));
    if(v){v.px=u.x*M.CONFIG.TILE;v.py=(u.y+(1-p)*(i===0?7:5))*M.CONFIG.TILE;v.moving=p<1;}
    u._walking=p<1;u._walkUntil=now+120;
   }
   nijika.facing=step>=3&&step<=5?'down':'up';
   r.render(now);ctx.fillStyle='#0f101a';ctx.fillRect(0,0,1200,660);
   // A smooth camera reveals the room, then returns to the exchange near the door.
   const target=step===1||step===6?{x:0,y:0,w:30,h:28}:{x:6,y:17,w:18,h:11};
   for(const k of ['x','y','w','h'])camera[k]+=(target[k]-camera[k])*.045;
   const scale=r.scale,p=M.MapProjection.project(r.projection,camera.x*32,camera.y*32),sw=camera.w*32*scale,sh=camera.h*32*scale;
   const fit=Math.min(1200/sw,660/sh),ww=sw*fit,hh=sh*fit;
   ctx.drawImage(r.canvas,p.x*scale,p.y*scale,sw,sh,(1200-ww)/2,(660-hh)/2,ww,hh);
   if(elapsed>=2400&&elapsed<3000){ctx.fillStyle='rgba(142,85,175,'+(.28*(1-(elapsed-2400)/600))+')';ctx.fillRect(0,0,1200,660);}
   if(elapsed>=16700){this.finishChapterIntro();return;}
   raf=requestAnimationFrame(draw);
  };
  this.parkIntroCleanup=()=>{stopped=true;cancelAnimationFrame(raf);delete game._liveIntro;
   if(this.game===game){game.joinNijika();nijika.facing='up';for(const u of [nijika,...party]){u._walking=false;u._walkUntil=0;r.snapUnit(u);}this.updateAll();this.renderIdleInfo();}
   setTimeout(()=>{root.classList.remove('livehouse-intro');scene.remove();},720);
  };
  raf=requestAnimationFrame(draw);
 };
})(window);
