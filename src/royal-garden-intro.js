/* Continuous geography: palace rear door, then the south facade of its garden. */
(function(global){
 'use strict';const M=global.MyGO,T=M.CONFIG.TILE,clamp=x=>Math.max(0,Math.min(1,x)),ease=x=>{x=clamp(x);return x*x*(3-2*x);};
 M.UI.prototype.playRoyalGardenIntro=function(){
  const ui=this,g=this.game,r=this.renderer,root=this.dom.chapterIntro;if(g.royalGardenIntroSeen){this.finishChapterIntro();return;}
  root.classList.add('livehouse-intro');root.querySelector('.livehouse-opening')?.remove();const scene=document.createElement('div');scene.className='livehouse-opening royal-garden-opening';
  scene.innerHTML='<div class="live-opening-head"><small>CHAPTER 11 / THE ROYAL GARDEN</small><h2>花墙水道的双骑士</h2><span>王座后的门 · 围墙与水道交错的御苑</span></div><canvas class="live-opening-canvas" width="1200" height="660" aria-label="众人穿过第十关Boss身后的门，进入王宫后花园，发现水道、围墙与双骑士"></canvas><div class="live-opening-caption" aria-live="polite"><canvas width="110" height="125"></canvas><div><small></small><p></p></div></div><div class="live-opening-skip">自动播放 · 点击 / Enter / Esc 跳过演出</div>';
  root.appendChild(scene);root.hidden=false;root.classList.remove('is-leaving');void root.offsetWidth;root.classList.add('is-visible');
  const c=scene.querySelector('.live-opening-canvas').getContext('2d'),face=scene.querySelector('.live-opening-caption canvas').getContext('2d'),speaker=scene.querySelector('.live-opening-caption small'),caption=scene.querySelector('.live-opening-caption p');
  const world=document.createElement('canvas');world.width=g.map.cols*T;world.height=g.map.rows*T;const wc=world.getContext('2d');
  const palace=document.createElement('canvas');palace.width=M.CONFIG.STAGE_PALACE.cols*T;palace.height=M.CONFIG.STAGE_PALACE.rows*T;const pc=palace.getContext('2d'),palaceMap={...M.CONFIG.STAGE_PALACE,tiles:M.CONFIG.STAGE_PALACE.terrain};
  const palaceV={a:1,b:0,c:0,d:1,ox:0,oy:0};
  const beats=[['长崎爽世','“卫长身后的门打开了……大家，往这边走。”','soyo'],['千早爱音','“这里是王宫的后花园？围墙和水道，把路都分开了。”','anon'],['安和昴','“天马能飞过水道，战马却得经过桥。先看清它们能到哪里。”','subaru'],['裂空天马骑士 · 苍穹卫','“水道无法拦住裂空的羽翼。御苑不会放你们离开。”','garden_rift_pegasus'],['战马骑士 · 御苑统领','“桥头由我驻守。谁也别想突破。”','garden_cavalier_boss'],['任务目标 · 击败双骑士','绕过围墙、争夺桥头，同时击败北侧的裂空天马骑士与战马统领。','tomori']];
  const bounds=[3800,7000,10000,12800,15300,18000],positions=g.living('player').map(u=>({u,x:u.x,y:u.y})),start=performance.now(),oldView=r.view;let last=start,part=-1,raf=0,stopped=false,wasGarden=false;
  const camera={x:7,y:0,w:16,h:12};r.setView({mode:'idle'});
  const draw=now=>{if(stopped||!ui.chapterOpen||ui.game!==g)return;const elapsed=now-start,step=bounds.findIndex(t=>elapsed<t);if(step<0){ui.finishChapterIntro();return;}
   scene.dataset.beat=String(step);if(part!==step){part=step;speaker.textContent=beats[step][0];caption.textContent=beats[step][1];face.clearRect(0,0,110,125);M.Characters.drawPortrait(face,beats[step][2],0,0,110,125,{head:true});}
   let source=world,target;
   if(step===0){
    pc.clearRect(0,0,palace.width,palace.height);M.PalaceMap.drawGround(pc,palaceMap);for(const o of M.PalaceMap.makeObjects(palaceMap,palaceV).sort((a,b)=>a.depth-b.depth))M.PalaceMap.drawObject(pc,palaceV,o);
    const p=ease(elapsed/3100);for(let i=0;i<positions.length;i++){const u=positions[i].u,lane=i%2?17.5:12.5,turn=ease((p-.7)/.3),x=(lane+(15-lane)*turn)*T,y=((8.5+Math.floor(i/2)*.65)*(1-Math.min(1,p/.7))+2.35*Math.min(1,p/.7)-turn*.8)*T;pc.save();pc.globalAlpha=1-clamp((p-.88)/.12);M.Characters.drawMap(pc,{...u,facing:turn>0?(lane<15?'right':'left'):'up',_walking:true},x,y,48,now);pc.restore();}
    pc.save();pc.translate(15*T,2*T-4);pc.scale(.58,.58);M.RoyalGardenArt.door(pc,0,0,elapsed>600);pc.restore();source=palace;target={x:7,y:0,w:16,h:12};
   }else{
    if(!wasGarden){Object.assign(camera,{x:8,y:28,w:18,h:12});wasGarden=true;}
    const entered=ease((elapsed-3800)/2400);for(const p of positions){p.u.y=p.y+(38.5-p.y)*(1-entered);p.u._walking=entered<1;r.snapUnit(p.u);}
    r.render(now);const scale=r.scale,p=M.MapProjection.project(r.projection,0,0);wc.clearRect(0,0,world.width,world.height);wc.drawImage(r.canvas,p.x*scale,p.y*scale,world.width*scale,world.height*scale,0,0,world.width,world.height);
    target=step===1?{x:7,y:27,w:20,h:13}:step===2?{x:0,y:13,w:34,h:22}:step===3?{x:2,y:0,w:16,h:12}:step===4?{x:16,y:0,w:16,h:12}:{x:0,y:0,w:34,h:40};
   }
   const blend=1-Math.exp(-Math.min(now-last,100)/550);last=now;for(const key of ['x','y','w','h'])camera[key]+=(target[key]-camera[key])*blend;
   c.fillStyle='#182c27';c.fillRect(0,0,1200,660);const fit=Math.min(1200/(camera.w*T),660/(camera.h*T)),w=camera.w*T*fit,h=camera.h*T*fit;c.drawImage(source,camera.x*T,camera.y*T,camera.w*T,camera.h*T,(1200-w)/2,(660-h)/2,w,h);
   const flash=1-Math.abs(elapsed-3800)/340;if(flash>0){c.fillStyle='rgba(238,237,202,'+clamp(flash)+')';c.fillRect(0,0,1200,660);}raf=requestAnimationFrame(draw);
  };
  this.parkIntroCleanup=()=>{stopped=true;cancelAnimationFrame(raf);for(const p of positions){Object.assign(p.u,{x:p.x,y:p.y,_walking:false});r.snapUnit(p.u);}g.royalGardenIntroSeen=true;if(ui.game===g){r.setView(oldView);ui.updateAll();ui.renderIdleInfo();}setTimeout(()=>{root.classList.remove('livehouse-intro');scene.remove();},720);};
  raf=requestAnimationFrame(draw);
 };
})(window);
