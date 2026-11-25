/* Campus reveal starts at the school gate, in the current map's geography. */
(function(global){
 'use strict';const M=global.MyGO,T=M.CONFIG.TILE,ease=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
 M.UI.prototype.playSchoolIntro=function(){
  const ui=this,g=this.game,r=this.renderer,root=this.dom.chapterIntro;if(g.schoolIntroSeen){this.finishChapterIntro();return;}
  root.classList.add('livehouse-intro');root.querySelector('.livehouse-opening')?.remove();
  const scene=document.createElement('div');scene.className='livehouse-opening school-opening';
  scene.innerHTML='<div class="live-opening-head"><small>CHAPTER 12 / TSUKINOMORI GIRLS’ ACADEMY</small><h2>月之森校门的追击</h2><span>学校大门 · 浅色校舍与月纹前庭</span></div><canvas class="live-opening-canvas" width="1200" height="660" aria-label="主角团从月之森学校大门进入，发现骑兵防线与主楼前的裂空天马骑士"></canvas><div class="live-opening-caption" aria-live="polite"><canvas width="110" height="125"></canvas><div><small></small><p></p></div></div><div class="live-opening-skip">自动播放 · 点击 / Enter / Esc 跳过演出</div>';
  root.appendChild(scene);root.hidden=false;root.classList.remove('is-leaving');void root.offsetWidth;root.classList.add('is-visible');
  const c=scene.querySelector('.live-opening-canvas').getContext('2d'),face=scene.querySelector('.live-opening-caption canvas').getContext('2d'),speaker=scene.querySelector('.live-opening-caption small'),caption=scene.querySelector('.live-opening-caption p');
  const world=document.createElement('canvas');world.width=g.map.cols*T;world.height=g.map.rows*T;const wc=world.getContext('2d'),v={a:1,b:0,c:0,d:1,ox:0,oy:0};
  const beats=[['长崎爽世','“这道校门……是月之森女子学园。为什么我的学校也出现在这里？”','soyo'],['千早爱音','“先别停在门口。前面的骑兵和重装，已经把路堵住了！”','anon'],['椎名立希','“后面也有动静。第三、六、九、十二回合，校门各有一波追兵，总共四波。别被夹住。”','taki'],['裂空天马骑士 · 月森守望','“学园的道路由我封锁。追兵即将到来，你们还能走到这里吗？”','school_rift_pegasus'],['任务目标 · 击败裂空天马骑士','沿中央步道向主楼前推进，击败裂空天马即可通关。校门援兵最多四波，每波两名天马与一名骑兵；天马携有可掉落的药品和装备。','tomori']];
  const bounds=[3600,7000,10400,13800,17700],positions=g.living('player').map(u=>({u,x:u.x,y:u.y})),oldView=r.view,start=performance.now(),camera={x:7,y:27,w:21,h:12};let stopped=false,raf=0,last=start,part=-1;
  r.setView({mode:'idle'});
  const draw=now=>{if(stopped||!ui.chapterOpen||ui.game!==g)return;const elapsed=now-start,step=bounds.findIndex(t=>elapsed<t);if(step<0){ui.finishChapterIntro();return;}
   scene.dataset.beat=String(step);if(part!==step){part=step;speaker.textContent=beats[step][0];caption.textContent=beats[step][1];face.clearRect(0,0,110,125);M.Characters.drawPortrait(face,beats[step][2],0,0,110,125,{head:true});}
   wc.clearRect(0,0,world.width,world.height);M.SchoolMap.drawGround(wc,g.map);
   const entered=ease(elapsed/2600),objects=M.SchoolMap.makeObjects(g.map,v).map(o=>({...o,draw:()=>{wc.save();if(g.units.some(u=>!u.dead&&M.SchoolMap.obscures(o,u)))wc.globalAlpha=.46;M.SchoolMap.drawObject(wc,v,o);wc.restore();}}));
   for(const u of g.units){if(u.dead)continue;const p=positions.find(p=>p.u===u),x=u.x*T+T/2,y=(p?p.y+(36-p.y)*(1-entered):u.y)*T+T*.9;
    objects.push({depth:y,draw:()=>M.Characters.drawMap(wc,{...u,facing:p?'up':u.facing,_walking:!!p&&entered<1},x,y,48,now)});}
   objects.sort((a,b)=>a.depth-b.depth).forEach(o=>o.draw());M.SchoolMap.drawLights(wc,v,g);
   const target=step===0?{x:7,y:27,w:21,h:12}:step===1?{x:1,y:15,w:32,h:19}:step===2?{x:7,y:26,w:21,h:12}:step===3?{x:2,y:0,w:30,h:18}:{x:0,y:0,w:34,h:38};
   const blend=1-Math.exp(-Math.min(100,now-last)/500);last=now;for(const k of ['x','y','w','h'])camera[k]+=(target[k]-camera[k])*blend;
   c.fillStyle='#243d36';c.fillRect(0,0,1200,660);const scale=Math.min(1200/(camera.w*T),660/(camera.h*T)),w=camera.w*T*scale,h=camera.h*T*scale;c.drawImage(world,camera.x*T,camera.y*T,camera.w*T,camera.h*T,(1200-w)/2,(660-h)/2,w,h);raf=requestAnimationFrame(draw);
  };
  this.parkIntroCleanup=()=>{stopped=true;cancelAnimationFrame(raf);g.schoolIntroSeen=true;if(ui.game===g){r.setView(oldView);ui.updateAll();ui.renderIdleInfo();}setTimeout(()=>{root.classList.remove('livehouse-intro');scene.remove();},720);};
  raf=requestAnimationFrame(draw);
 };
})(window);
