/* Run-in, voice, blackout and Soyo's memory, using the real map and character art. */
(function(global){
  'use strict';
  const M=global.MyGO;
  M.UI.prototype.playParkIntro=function(){
    const root=this.dom.chapterIntro,game=this.game,renderer=this.renderer;
    root.querySelector('.park-opening')?.remove();root.classList.add('park-intro');
    const scene=document.createElement('div');scene.className='park-opening';
    scene.innerHTML='<div class="park-opening-kicker">CHAPTER 04 / 飞鸟山公园</div><h2>飞鸟山公园的往日之影</h2>'+
      '<canvas class="park-opening-scene" width="1328" height="924" aria-label="主角团跑进夜间公园，路灯随声音熄灭"></canvas>'+
      '<div class="park-memory" aria-hidden="true"><canvas width="240" height="300"></canvas><div><small>SOYO / MEMORY</small><p>“明明只是想让大家回来……”</p><span>那段拼命挽留，却无人回应的过去。</span></div></div>'+
      '<div class="park-opening-caption" aria-live="polite"><small></small><p></p></div><button class="park-opening-skip" type="button">点击任意处 / Enter 跳过</button>';
    root.appendChild(scene);root.hidden=false;root.classList.remove('is-leaving');
    void root.offsetWidth;root.classList.add('is-visible');
    const canvas=scene.querySelector('.park-opening-scene'),ctx=canvas.getContext('2d');
    const speaker=scene.querySelector('.park-opening-caption small'),line=scene.querySelector('.park-opening-caption p');
    M.Characters.drawPortrait(scene.querySelector('.park-memory canvas').getContext('2d'),'soyo',0,0,240,300);
    const party=game.living('player'),start=performance.now();let raf=0,part=-1,spoken=false,stopped=false;
    const voice=typeof global.Audio==='function'?new global.Audio((global.MYGO_AUDIO_DATA||{}).parkOpening||'assets/audio/chapter-04-opening.mp3'):null;
    if(voice){voice.preload='auto';voice.volume=1;voice.load();}
    // The supplied recording lasts 5.669 seconds and starts at 2.8 seconds.
    const blackoutAt=8500,memoryAt=blackoutAt+1500,objectiveAt=blackoutAt+5000,finishAt=blackoutAt+8700;
    game.parkIntroLights=true;
    const speak=()=>{
      if(!voice)return;
      const playing=voice.play();
      // Keep subtitles and the scene running if the browser blocks playback.
      playing?.catch(()=>{});
    };
    const beats=[['飞鸟山公园','众人追着远处的回声，跑进了公园。'],['不知从何处传来的声音','“欧内该，瓦达西......”'],
      ['灯光，骤然熄灭','那一刻，整座公园沉入黑暗。'],['长崎爽世','“这个声音……为什么，偏偏是……”'],
      ['任务目标','找到发出这个声音的神秘幻影，并击败它。']];
    const draw=now=>{
      if(stopped||!this.chapterOpen)return;const elapsed=now-start;
      const step=elapsed<2800?0:elapsed<blackoutAt?1:elapsed<memoryAt?2:elapsed<objectiveAt?3:4;
      if(step!==part){part=step;speaker.textContent=beats[step][0];line.textContent=beats[step][1];
        scene.dataset.beat=String(step);if(step===1&&!spoken){spoken=true;speak();}}
      game.parkIntroLights=elapsed<blackoutAt;
      for(const [i,u] of party.entries()){
        const visual=renderer.visuals.get(u.id),progress=Math.max(0,Math.min(1,(elapsed-i*110)/2200));
        if(visual){visual.px=(u.x-(1-progress)*8)*M.CONFIG.TILE;visual.py=u.y*M.CONFIG.TILE;visual.moving=progress<1;}
        u._walking=progress<1;u._walkUntil=now+150;
      }
      renderer.render(now);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(renderer.canvas,0,0,canvas.width,canvas.height);
      if(elapsed>blackoutAt&&elapsed<blackoutAt+600){ctx.fillStyle='rgba(0,0,0,'+(.8*(1-(elapsed-blackoutAt)/600))+')';ctx.fillRect(0,0,canvas.width,canvas.height);}
      if(elapsed>=finishAt){this.finishChapterIntro();return;}
      raf=requestAnimationFrame(draw);
    };
    this.parkIntroCleanup=()=>{
      stopped=true;cancelAnimationFrame(raf);delete game.parkIntroLights;
      for(const u of party){u._walking=false;u._walkUntil=0;renderer.snapUnit(u);}
      if(voice){voice.pause();voice.currentTime=0;}
      setTimeout(()=>{root.classList.remove('park-intro');scene.remove();},720);
    };
    raf=requestAnimationFrame(draw);
  };
})(window);
