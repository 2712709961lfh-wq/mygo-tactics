/* Stage-side continuation: a visible spatial distortion, summons and portal exit. */
(function(global){
 'use strict';const M=global.MyGO,T=M.CONFIG.TILE,clamp=x=>Math.max(0,Math.min(1,x)),ease=x=>{x=clamp(x);return x*x*(3-2*x);};
 M.UI.prototype.playEighthIntro=function(){
  const ui=this,game=this.game,r=this.renderer,root=this.dom.chapterIntro;
  if(game.stageEightIntroSeen){this.finishChapterIntro();return;}
  root.classList.add('livehouse-intro');root.querySelector('.livehouse-opening')?.remove();
  const scene=document.createElement('div');scene.className='livehouse-opening eighth-opening';
  scene.innerHTML='<div class="live-opening-head"><small>CHAPTER 08 / STARRY</small><h2>无尽舞台的往日之影</h2><span>舞台前沿 · 未散的暗幕</span></div>'+
   '<canvas class="live-opening-canvas" width="1200" height="660" aria-label="面具人现身并施法扩张舞台，召唤普通敌人、重装、天马与两名往日之影，随后消失"></canvas>'+
   '<div class="live-opening-caption" aria-live="polite"><canvas width="110" height="125"></canvas><div><small></small><p></p></div></div>'+
   '<div class="live-opening-skip">自动播放 · 点击 / Enter / Esc 跳过演出</div>';
  root.appendChild(scene);root.hidden=false;root.classList.remove('is-leaving');void root.offsetWidth;root.classList.add('is-visible');
  const ctx=scene.querySelector('.live-opening-canvas').getContext('2d'),face=scene.querySelector('.live-opening-caption canvas'),speaker=scene.querySelector('.live-opening-caption small'),line=scene.querySelector('.live-opening-caption p');
  const world=document.createElement('canvas');world.width=30*T;world.height=36*T;const wc=world.getContext('2d');
  const folded=document.createElement('canvas');folded.width=30*T;folded.height=36*T;const fc=folded.getContext('2d');
  const beats=[['舞台前沿','虹夏刚刚答应同行。众人还站在舞台附近，暗处却再次传来脚步声。','nijika'],
   ['神秘面具人','“你们以为这么简单吗！”','masked_stranger'],
   ['神秘面具人 · 暗幕施法','她举起手，幕布后的空间被扭曲。原本熟悉的舞台，正向看不见的深处延伸。','masked_stranger'],
   ['神秘面具人 · 召唤','法阵一一亮起，幻兵、重装与天马骑士从暗幕中现身。','masked_stranger'],
   ['长崎爽世','“舞台最里面的……是我和灯？那些是我们的幻影……”','soyo'],
   ['高松灯','“那个人……消失了。但我们会一起，把眼前的幻影击败。”','tomori'],
   ['任务目标 · 击败幻影','击败往日之影长崎爽世（术士）与往日之影高松灯（佣兵）。三名携钥天马各带一把宝箱钥匙。','tomori']];
  const bounds=[1800,4200,7200,10600,13200,15400,17800],enemies=game.living('enemy'),normal=enemies.filter(u=>!u.boss),start=performance.now();
  let raf=0,part=-1,stopped=false,last=start,camera={x:2,y:1,w:26,h:16};
  const oldView=r.view;r.setView({mode:'idle'});game._liveIntro={visible:u=>u.side!=='enemy'};
  const draw=now=>{
   if(stopped||!ui.chapterOpen||ui.game!==game)return;
   const elapsed=now-start,step=bounds.findIndex(t=>elapsed<t),growth=ease((elapsed-4200)/3000);
   if(step<0){ui.finishChapterIntro();return;}
   scene.dataset.beat=String(step);scene.dataset.stageGrowth=growth.toFixed(3);scene.dataset.maskVisible=String(elapsed<15100);
   const reveal=u=>u.boss?10600+game.mission.phantomIds.indexOf(u.id)*450:7200+normal.indexOf(u)*105;
   game._liveIntro={visible:u=>u.side!=='enemy'||elapsed>=reveal(u)};
   for(const u of enemies)u._summonAlpha=ease((elapsed-reveal(u))/800);
   if(part!==step){part=step;speaker.textContent=beats[step][0];line.textContent=beats[step][1];const f=face.getContext('2d');f.clearRect(0,0,110,125);M.Characters.drawPortrait(f,beats[step][2],0,0,110,125,{head:true});}
   r.render(now);const s=r.scale,p=M.MapProjection.project(r.projection,0,0);wc.clearRect(0,0,world.width,world.height);
   wc.drawImage(r.canvas,p.x*s,p.y*s,world.width*s,world.height*s,0,0,world.width,world.height);
   for(const u of enemies){const age=elapsed-reveal(u);if(age>=-450&&age<1600){const a=age<0?clamp((age+450)/450):1-clamp((age-850)/750);
    M.MaskedCourtArt.circle(wc,(u.x+.5)*T,(u.y+.84)*T,62,25,clamp((age+450)/1700),a);
    wc.save();wc.globalAlpha=a*.32;wc.fillStyle='#c090ef';wc.fillRect((u.x+.5)*T-12,(u.y+.84)*T-48,24,48);wc.restore();}}
   // Split along the new rows: the original room remains rigid while the stage unfolds.
   fc.clearRect(0,0,folded.width,folded.height);fc.drawImage(world,0,0,30*T,6*T,0,0,30*T,6*T);
   if(growth>0)fc.drawImage(world,0,6*T,30*T,8*T,0,6*T,30*T,8*T*growth);
   fc.drawImage(world,0,14*T,30*T,22*T,0,(6+8*growth)*T,30*T,22*T);
   const mx=14.5*T,my=5.9*T,maskAlpha=clamp(elapsed/850)*(1-ease((elapsed-13200)/1900));
   if(maskAlpha>0){fc.save();fc.globalAlpha=maskAlpha;
    M.MaskedCourtArt.circle(fc,mx,my,100,35,(elapsed%1700)/1700,.8);
    const casting=elapsed>=1800&&elapsed<13200,action=casting?'summon':'idle',progress=casting?clamp((elapsed-1800)%2100/1400):(elapsed%1400)/1400;
    M.MaskedCourtArt.action(fc,mx,my,65,action,M.MaskedCourtArt.frameAt(action,progress),'right',now);fc.restore();}
   if(elapsed>=13200&&elapsed<15400){M.MaskedCourtArt.circle(fc,mx,my,145,50,clamp((elapsed-13200)/2200),1-clamp((elapsed-14700)/700));}
   if(elapsed>=4200&&elapsed<7600){fc.save();fc.strokeStyle='rgba(202,141,241,'+(.5*Math.sin(growth*Math.PI))+')';fc.lineWidth=3;
    fc.strokeRect(7*T,6*T,16*T,8*T*growth+1);fc.restore();}
   const target=step===4?{x:5,y:0,w:21,h:13}:step>=5?{x:1,y:0,w:28,h:23}:{x:2,y:0,w:26,h:16+8*growth};
   const dt=Math.min(100,now-last);last=now;const blend=1-Math.exp(-dt/650);for(const k of ['x','y','w','h'])camera[k]+=(target[k]-camera[k])*blend;
   ctx.fillStyle='#0f101a';ctx.fillRect(0,0,1200,660);const fit=Math.min(1200/(camera.w*T),660/(camera.h*T)),ww=camera.w*T*fit,hh=camera.h*T*fit;
   ctx.drawImage(folded,camera.x*T,camera.y*T,camera.w*T,camera.h*T,(1200-ww)/2,(660-hh)/2,ww,hh);
   raf=requestAnimationFrame(draw);
  };
  this.parkIntroCleanup=()=>{
   stopped=true;cancelAnimationFrame(raf);
   game.completeEighthIntro();
   if(ui.game===game){r.setView(oldView);ui.updateAll();ui.renderIdleInfo();}
   setTimeout(()=>{root.classList.remove('livehouse-intro');scene.remove();},720);
  };
  raf=requestAnimationFrame(draw);
 };
})(window);
