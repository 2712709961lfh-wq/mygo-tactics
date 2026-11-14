/* Summoning and retreat play directly on the battle map. */
(function(global){
  'use strict';
  const M=global.MyGO,UP=M.UI.prototype;
  UP.playCourtScene=function(kind,wave){
    const ui=this,g=this.game,boss=g.getUnit('masked_stranger'),escape=kind==='escape',duration=escape?3400:2600;
    const points=escape?[boss]:wave.units;
    const priorBusy=this.busy;this.setBusy(true);
    if(!escape)for(const u of points)u._summonAlpha=0;
    return new Promise(resolve=>{
      let raf=0,finished=false,areaShown=false,lineShown=false,start=performance.now();
      const center=escape?boss:points.reduce((p,u)=>({x:p.x+u.x/points.length,y:p.y+u.y/points.length}),{x:0,y:0});
      const finish=()=>{
        if(finished)return;finished=true;cancelAnimationFrame(raf);
        document.removeEventListener('keydown',skip,true);
        delete g._courtFx;delete boss._casting;delete boss._teleporting;delete boss._escapeAlpha;
        for(const u of points)delete u._summonAlpha;
        if(ui.game===g){
          if(!escape)ui.revealCell(center.x,center.y);
          ui.setActions([]);ui.setBusy(priorBusy);ui.updateAll();
          if(!escape)ui.renderer.render(performance.now());
        }
        resolve();
      };
      const skip=event=>{
        if(ui.game!==g)return;
        if(event.key==='Enter'||event.key==='Escape'){
          event.preventDefault();event.stopImmediatePropagation();finish();
        }
      };
      document.addEventListener('keydown',skip,true);
      ui.dom.contextTitle.textContent=escape?'神秘面具人 · 传送离场':'神秘面具人 · 暗幕召唤';
      ui.dom.contextText.textContent=escape?'她的生命停在了 1 HP。脚下，暗紫色的法阵缓缓张开……':'“就让这些影子，陪你们再走一段。”';
      ui.setActions([{label:'跳过演出 · Enter / Esc',onClick:finish}]);
      ui.revealCell(boss.x,boss.y);
      // Initialize on the existing board before the first animation frame.
      g._courtFx={kind,points,progress:0};
      if(escape)boss._teleporting=true;else boss._casting=.001;
      ui.renderer.render(start);
      function draw(now){
        if(finished)return;if(ui.game!==g){finish();return;}
        const t=Math.min(1,(now-start)/duration);g._courtFx={kind,points,progress:t};
        if(escape){
          boss._escapeAlpha=Math.max(0,1-Math.max(0,t-.42)/.35);
          if(t>.3&&!lineShown){lineShown=true;ui.dom.contextText.textContent='“留你们一命。”';
            ui.renderer.floatText('“留你们一命。”',boss.x,boss.y-1,'#e5b4f3',14);}
        }else{
          boss._casting=Math.min(.99,t*2.5);
          for(const u of points)u._summonAlpha=Math.max(0,Math.min(1,(t-.4)/.34));
          if(t>=.38&&!areaShown){areaShown=true;ui.revealCell(center.x,center.y);
            ui.dom.contextText.textContent='暗紫色法阵在队伍附近展开，'+points.length+' 名援军正在现身，本轮不会行动。';}
        }
        ui.renderer.render(now);
        if(t>=1){finish();return;}raf=requestAnimationFrame(draw);
      }
      raf=requestAnimationFrame(draw);
    });
  };
  UP.playSixthSummon=async function(){const wave=this.game.summonNearParty();if(!wave)return null;
    await this.playCourtScene('summon',wave);this.showToast('暗幕援军已经现身，本轮不会行动。下个我方阶段可先调整阵型。','info',4500);return wave;};
  UP.playMaskedEscape=function(){
    if(this._maskedEscapePromise)return this._maskedEscapePromise;
    const g=this.game;if(!g.maskRetreatPending)return Promise.resolve();
    this._maskedEscapePromise=(async()=>{await this.playCourtScene('escape');if(this.game===g){g.finishMaskedEscape();this.resetSelection({silent:true});this.updateAll();this.renderer.render(performance.now());}})().finally(()=>{this._maskedEscapePromise=null;});
    return this._maskedEscapePromise;
  };
})(window);
