/* Opening recruits Nijika at the party's answer, including when skipped. */
(function(global){
 'use strict';const M=global.MyGO;
 const ending=[
  {id:'nijika',name:'伊地知虹夏',line:'真的太谢谢大家了！多亏你们，才守住了这里。'},
  {id:'anon',name:'千早爱音',line:'不用客气啦！不过，虹夏，你为什么会出现在这里？'},
  {id:'nijika',name:'伊地知虹夏',line:'我和乐队的大家约好了，今天来 Live House 彩排。'},
  {id:'nijika',name:'伊地知虹夏',line:'可是推开门，就发现里面全是怪物……我也不知道为什么会变成这样。'},
  {id:'soyo',name:'长崎爽世',line:'那你就和我们同行吧。我们也在寻找回到现实世界的方法。'},
  {id:'nijika',name:'伊地知虹夏',line:'真的吗？太好了！那就请多关照啦！能和大家一起走，我很开心！'}
 ];
 M.UI.prototype.showLivehouseEnding=function(){
  const ui=this,game=this.game,r=this.renderer,root=this.dom.chapterIntro,priorBusy=this.busy;
  game._liveEnding=true;
  this.closeOverlay();this.setBusy(true);this.chapterOpen=true;document.body.classList.add('chapter-open');
  root.classList.add('livehouse-intro','livehouse-ending');root.classList.remove('is-leaving');
  const scene=document.createElement('div');scene.className='livehouse-opening live-ending';
  scene.innerHTML='<div class="live-opening-head"><small>CHAPTER 07 / AFTER STORY</small><h2>一同寻找归途</h2><span>STARRY · 战斗后的 Live House</span></div>'+
   '<canvas class="live-opening-canvas live-ending-scene" width="1200" height="660" aria-label="战斗结束，众人留在最后交战的位置，虹夏在舞台附近向大家道谢"></canvas>'+
   '<div class="live-opening-caption live-ending-dialogue" aria-live="polite"><canvas width="110" height="125" aria-hidden="true"></canvas><div><small><strong></strong></small><p></p></div></div>'+
   '<div class="live-ending-controls"><span class="live-ending-progress"></span><span>自动播放 · 点击画面 / Enter 下一句</span><button type="button" data-confirm>下一句</button><button type="button" data-live-ending-skip>跳过剧情 · Esc</button></div>';
  root.appendChild(scene);root.hidden=false;void root.offsetWidth;root.classList.add('is-visible');
  const canvas=scene.querySelector('.live-ending-scene'),ctx=canvas.getContext('2d'),face=scene.querySelector('.live-ending-dialogue canvas'),speaker=scene.querySelector('.live-ending-dialogue strong'),line=scene.querySelector('.live-ending-dialogue p');
  const party=game.living('player');
  // Continue from the battle's actual positions. Only the camera moves.
  const points=party.map(u=>({id:u.id,x:(r.visuals.get(u.id)?.px??u.x*32)/32+.5,y:(r.visuals.get(u.id)?.py??u.y*32)/32+.5}));
  const frame=positions=>{
   const xs=positions.map(p=>p.x),ys=positions.map(p=>p.y),w=Math.min(game.map.cols,Math.max(18,Math.max(...xs)-Math.min(...xs)+7)),h=Math.min(game.map.rows,Math.max(12,Math.max(...ys)-Math.min(...ys)+7));
   return {x:Math.max(0,Math.min(game.map.cols-w,(Math.min(...xs)+Math.max(...xs)-w)/2)),y:Math.max(0,Math.min(game.map.rows-h,(Math.min(...ys)+Math.max(...ys)-h)/2)),w,h};
  };
  const overview=frame([...points,{x:7,y:1},{x:23,y:9}]);
  const oldView=r.view;r.setView({mode:'idle'});
  return new Promise(resolve=>{
   let page=0,state='playing',raf=0,fade=0,start=performance.now(),beatStart=start,previous=start,camera={...overview};
   const duration=[3600,3500,3900,4300,4700,4200];
   const settle=completed=>{
    if(state==='done')return;state='done';clearTimeout(fade);cancelAnimationFrame(raf);
    if(ui._livehouseEndingCancel===cancel)ui._livehouseEndingCancel=null;
    root.hidden=true;root.classList.remove('livehouse-intro','livehouse-ending','is-visible','is-leaving');scene.remove();document.body.classList.remove('chapter-open');
    ui.setBusy(priorBusy);resolve(completed&&ui.game===game);
   };
   const finish=completed=>{
    if(state==='done')return;
    if(state==='leaving'){if(!completed)settle(false);return;}
    state='leaving';cancelAnimationFrame(raf);ui.chapterOpen=false;
    delete game._liveEnding;
    ui._livehouseEndingAdvance=null;ui._livehouseEndingSkip=null;
    if(ui.game===game)r.setView(oldView);
    if(completed){root.classList.add('is-leaving');fade=setTimeout(()=>settle(true),650);}else settle(false);
   };
   const cancel=()=>finish(false);ui._livehouseEndingCancel=cancel;
   const caption=()=>{
    const row=ending[page];
    scene.dataset.endingPage=String(page);speaker.textContent=row.name;line.textContent='“'+row.line+'”';
    scene.querySelector('.live-ending-progress').textContent='对话 '+(page+1)+' / '+ending.length;
    scene.querySelector('[data-confirm]').textContent=page===ending.length-1?'一同出发':'下一句';
    const fc=face.getContext('2d');fc.clearRect(0,0,110,125);M.Characters.drawPortrait(fc,row.id,0,0,110,125,{head:true});
   };
   const next=()=>{if(state!=='playing')return;if(ui.game!==game){finish(false);return;}if(page===ending.length-1){finish(true);return;}page++;beatStart=performance.now();caption();};
   ui._livehouseEndingAdvance=next;ui._livehouseEndingSkip=()=>finish(true);
   scene.querySelector('[data-confirm]').addEventListener('click',event=>{event.stopPropagation();next();});
   scene.querySelector('[data-live-ending-skip]').addEventListener('click',event=>{event.stopPropagation();finish(true);});
   const draw=now=>{
    if(state!=='playing')return;if(ui.game!==game){finish(false);return;}
    const elapsed=now-start,talk=ending[page].id,dt=Math.min(100,now-previous);previous=now;
    r.render(now);ctx.fillStyle='#0f101a';ctx.fillRect(0,0,1200,660);
    const focus=points.find(p=>p.id===talk),nearby=focus?points.filter(p=>['nijika','anon','soyo'].includes(p.id)||Math.hypot(p.x-focus.x,p.y-focus.y)<=6):points;
    const target=elapsed<1400?overview:frame(nearby.length?nearby:[{x:15,y:6}]),blend=1-Math.exp(-dt/650);
    for(const k of ['x','y','w','h'])camera[k]+=(target[k]-camera[k])*blend;
    const s=r.scale,p=M.MapProjection.project(r.projection,camera.x*32,camera.y*32),sw=camera.w*32*s,sh=camera.h*32*s,fit=Math.min(1200/sw,660/sh),ww=sw*fit,hh=sh*fit,dx=(1200-ww)/2,dy=(660-hh)/2;
    ctx.drawImage(r.canvas,p.x*s,p.y*s,sw,sh,dx,dy,ww,hh);
    const speaking=game.getUnit(talk),v=speaking&&!speaking.dead?r.visuals.get(talk):null;
    if(v){const foot=M.MapProjection.project(r.projection,v.px+16,v.py+27),x=dx+(foot.x-p.x)*s*fit,y=dy+(foot.y-p.y-52)*s*fit;
     ctx.save();ctx.fillStyle=page===5?'#f4d687':'#decb9f';ctx.font=page===5?'24px sans-serif':'16px sans-serif';ctx.textAlign='center';ctx.fillText(page===5?'♪':'•',x,y-4-Math.sin(now/240)*3);ctx.restore();}
    if(now-beatStart>=duration[page])next();
    if(state==='playing')raf=requestAnimationFrame(draw);
   };
   caption();raf=requestAnimationFrame(draw);
  });
 };
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
