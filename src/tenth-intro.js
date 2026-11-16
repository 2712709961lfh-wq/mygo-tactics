/* A real-map cinematic: enter the strange door and discover Subaru fighting Nina's double. */
(function(global){
 'use strict';const M=global.MyGO,T=M.CONFIG.TILE,clamp=x=>Math.max(0,Math.min(1,x)),ease=x=>{x=clamp(x);return x*x*(3-2*x);};
 M.UI.prototype.playTenthIntro=function(){
  const ui=this,g=this.game,r=this.renderer,root=this.dom.chapterIntro;
  if(g.stageTenIntroSeen){this.finishChapterIntro();return;}
  root.classList.add('livehouse-intro');root.querySelector('.livehouse-opening')?.remove();
  const scene=document.createElement('div');scene.className='livehouse-opening tenth-opening';
  scene.innerHTML='<div class="live-opening-head"><small>CHAPTER 10 / THE ROOM BEYOND</small><h2>回环休息室的真假仁菜</h2><span>奇怪的门的另一侧 · 中央传来打斗声</span></div>'+
   '<canvas class="live-opening-canvas" width="1200" height="660" aria-label="众人穿过奇怪的门，发现安和昴与拳斗士仁菜幻影交战，对话后四周出现更多敌人，昴加入队伍"></canvas>'+
   '<div class="live-opening-caption" aria-live="polite"><canvas width="110" height="125"></canvas><div><small></small><p></p></div></div>'+
   '<div class="live-opening-skip">自动播放 · 点击 / Enter / Esc 跳过演出</div>';
  root.appendChild(scene);root.hidden=false;root.classList.remove('is-leaving');void root.offsetWidth;root.classList.add('is-visible');
  const c=scene.querySelector('.live-opening-canvas').getContext('2d'),face=scene.querySelector('.live-opening-caption canvas'),speaker=scene.querySelector('.live-opening-caption small'),line=scene.querySelector('.live-opening-caption p');
  const world=document.createElement('canvas');world.width=g.map.cols*T;world.height=g.map.rows*T;const wc=world.getContext('2d');
  const nina=g.getUnit('nina'),subaru=g.getUnit('subaru'),phantom=g.getUnit('dark_nina'),enemies=g.living('enemy').filter(u=>u.id!=='dark_nina');
  const beats=[['奇怪的门','众人打开奇怪的门，走进光芒。门后，却还是刚才那间休息室。','nijika'],
   ['伊地知虹夏','“又是同一个房间？……等一下，中间有人在战斗！”','nijika'],
   [nina?'井芹仁菜':'长崎爽世',nina?'“安和昴，你怎么在这里？”':'“安和昴？你怎么会在这里？那个长得像仁菜的人是谁？”',nina?'nina':'soyo'],
   ['安和昴','“mmk叫我抓你回去训练，可一见面这个长得像你的人就开始攻击我。”','subaru'],
   [nina?'井芹仁菜':'高松灯',nina?'“小心，那个是幻影！”':'“小心……那个是仁菜的幻影！”',nina?'nina':'tomori'],
   ['安和昴','“幻影？！原来如此……周围也全是敌人。那就一起把它们解决掉！”','subaru'],
   ['安和昴 · 加入队伍','昴走到大家身边，准备共同迎战。击败仁菜幻影后，仍需清除排练室里的全部敌人。','subaru'],
   ['任务目标 · 击败所有敌人','仁菜幻影：拳斗士，钢拳套连续攻击。保护后排，用魔法突破重装，用弓应对天马。','subaru']];
  const bounds=[2900,5600,8200,11900,14400,17700,20300,22900],start=performance.now(),positions=g.living('player').map(u=>({u,x:u.x,y:u.y}));
  const savedSubaru={x:subaru.x,y:subaru.y,facing:subaru.facing},oldView=r.view;
  let raf=0,stopped=false,part=-1,last=start,camera={x:6,y:22,w:16,h:12};
  r.setView({mode:'idle'});g._liveIntro={visible:()=>false,doorAlpha:0};
  const reveal=u=>14500+enemies.indexOf(u)*120;
  const draw=now=>{
   if(stopped||!ui.chapterOpen||ui.game!==g)return;
   const elapsed=now-start,step=bounds.findIndex(t=>elapsed<t);
   if(step<0){ui.finishChapterIntro();return;}
   const entered=ease((elapsed-1100)/2300),joined=ease((elapsed-17700)/1800);
   scene.dataset.beat=String(step);scene.dataset.entered=entered.toFixed(3);scene.dataset.summoned=String(elapsed>=14500);scene.dataset.subaruJoined=String(g.subaruJoined);
   if(part!==step){part=step;speaker.textContent=beats[step][0];line.textContent=beats[step][1];const f=face.getContext('2d');f.clearRect(0,0,110,125);M.Characters.drawPortrait(f,beats[step][2],0,0,110,125,{head:true});}
   // The group enters this room through a glowing strange door, not a second lounge arrival.
   for(const p of positions){p.u.y=p.y+(31.5-p.y)*(1-entered);p.u._walking=entered<1;r.snapUnit(p.u);}
   subaru.x=savedSubaru.x+joined*1.5;subaru.y=savedSubaru.y+joined*2;subaru._walking=joined>0&&joined<1;subaru.facing=joined>0?'down':'up';r.snapUnit(subaru);
   const show=u=>u.id==='subaru'||u.id==='dark_nina'||u.side!=='enemy'&&elapsed>1100||u.side==='enemy'&&elapsed>=reveal(u);
   g._liveIntro={visible:show,doorAlpha:1};for(const u of enemies)u._summonAlpha=ease((elapsed-reveal(u))/800);
   // Replace just these two map poses while the central skirmish is being shown.
   const duel=elapsed>=2900&&elapsed<14400;g._liveIntro.visible=u=>show(u)&&!(duel&&(u.id==='subaru'||u.id==='dark_nina'));
   r.render(now);const scale=r.scale,p=M.MapProjection.project(r.projection,0,0);wc.clearRect(0,0,world.width,world.height);
   wc.drawImage(r.canvas,p.x*scale,p.y*scale,world.width*scale,world.height*scale,0,0,world.width,world.height);
   if(duel){
    const cycle=((elapsed-2900)%2400)/2400,attack=cycle>.12&&cycle<.58,frame=attack?Math.min(3,Math.floor(clamp((cycle-.12)/.46)*4)):0;
    const sx=(savedSubaru.x+.5)*T,sy=(savedSubaru.y+.85)*T,px=(phantom.x+.5)*T,py=(phantom.y+.85)*T;
    // Rotate side-view poses onto a short diagonal so both supplied actions remain readable.
    M.Characters.drawBattlePose(wc,subaru,sx+15,sy,49,cycle>.55?'attack':'hurt',Math.floor(cycle*7)%3,'left','attack');
    M.Characters.drawBattlePose(wc,phantom,px-15,py+25+(attack?Math.sin(cycle*Math.PI)*22:0),49,attack?'attack':'idle',frame,'right','attack');
    if(cycle>.35&&cycle<.53){wc.save();wc.strokeStyle='#d9b2ef';wc.lineWidth=3;wc.beginPath();wc.arc(sx+2,sy-25,12+cycle*10,0,Math.PI*1.6);wc.stroke();wc.restore();}
   }
   for(const u of enemies){const age=elapsed-reveal(u);if(age>-400&&age<1450){const alpha=age<0?clamp((age+400)/400):1-clamp((age-700)/750);M.MaskedCourtArt.circle(wc,(u.x+.5)*T,(u.y+.9)*T,70,26,clamp((age+400)/1800),alpha);}}
   if(elapsed<2900){const x=13.5*T,y=32*T-4;M.RehearsalMap.drawDoor(wc,x,y,elapsed>700,1,now);if(elapsed>700&&elapsed<1400){wc.save();wc.globalAlpha=Math.sin((elapsed-700)/700*Math.PI)*.45;wc.fillStyle='#d4efff';wc.fillRect(0,0,world.width,world.height);wc.restore();}}
   const target=step===0?{x:6,y:22,w:16,h:12}:step>=1&&step<=4?{x:7,y:10,w:14,h:12}:step===5?{x:0,y:7,w:28,h:22}:step===6?{x:6,y:12,w:17,h:15}:{x:0,y:0,w:28,h:34};
   const blend=1-Math.exp(-Math.min(now-last,100)/650);last=now;for(const k of ['x','y','w','h'])camera[k]+=(target[k]-camera[k])*blend;
   c.fillStyle='#15181c';c.fillRect(0,0,1200,660);const fit=Math.min(1200/(camera.w*T),660/(camera.h*T)),ww=camera.w*T*fit,hh=camera.h*T*fit;
   c.drawImage(world,camera.x*T,camera.y*T,camera.w*T,camera.h*T,(1200-ww)/2,(660-hh)/2,ww,hh);
   raf=requestAnimationFrame(draw);
  };
  this.parkIntroCleanup=()=>{
   stopped=true;cancelAnimationFrame(raf);for(const p of positions){Object.assign(p.u,{x:p.x,y:p.y,_walking:false});r.snapUnit(p.u);}
   Object.assign(subaru,{...savedSubaru,_walking:false});r.snapUnit(subaru);
   g.completeTenthIntro();
   if(ui.game===g){r.setView(oldView);ui.updateAll();ui.renderIdleInfo();}
   setTimeout(()=>{root.classList.remove('livehouse-intro');scene.remove();},720);
  };
  raf=requestAnimationFrame(draw);
 };
})(window);
