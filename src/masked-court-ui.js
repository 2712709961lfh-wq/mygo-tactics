/* Summoning and retreat are rendered from real game state, with skippable, atomic endings. */
(function(global){
  'use strict';
  const M=global.MyGO,UP=M.UI.prototype,A=M.MaskedCourtArt;
  UP.playCourtScene=function(kind,wave){
    const ui=this,g=this.game,boss=g.getUnit('masked_stranger'),escape=kind==='escape',duration=escape?3400:2600;
    const points=escape?[boss]:wave.units;
    const priorBusy=this.busy;this.setBusy(true);
    if(!escape)for(const u of points)u._summonAlpha=0;
    return new Promise(resolve=>{
      let raf=0,finished=false,start=performance.now();
      const finish=()=>{
        if(finished)return;finished=true;cancelAnimationFrame(raf);delete g._courtFx;delete boss._casting;delete boss._escapeAlpha;
        for(const u of points)delete u._summonAlpha;
        ui.confirmHandler=null;ui.closeOverlay();ui.setBusy(priorBusy);ui.updateAll();resolve();
      };
      ui.openOverlay('<div class="modal-kicker">'+(escape?'THE MASK / DEPARTURE':'DARK SUMMON / '+wave.name)+'</div>'+
        '<h2 class="modal-title" id="overlay-title">'+(escape?'神秘面具人':'神秘面具人 · 暗幕召唤')+'</h2>'+
        '<canvas class="court-cinematic" width="1120" height="500" style="display:block;width:100%;height:auto;background:#0b1422;border:1px solid #71647c" aria-label="'+(escape?'面具人锁血后打开传送法阵离场':'面具人施法，敌军从队伍附近的法阵中现身')+'"></canvas>'+
        '<p class="modal-sub court-scene-line" aria-live="polite">'+(escape?'她的生命停在了 1 HP。脚下，暗紫色的法阵缓缓张开……':'“就让这些影子，陪你们再走一段。”')+'</p>'+
        '<div class="modal-actions"><button class="modal-btn" data-confirm>跳过演出 · Enter</button></div>','wide court-cinematic-host',false);
      ui.confirmHandler=finish;
      const canvas=ui.dom.overlayCard.querySelector('canvas'),c=canvas.getContext('2d'),line=ui.dom.overlayCard.querySelector('.court-scene-line');
      const center=escape?boss:points.reduce((p,u)=>({x:p.x+u.x/points.length,y:p.y+u.y/points.length}),{x:0,y:0});
      function draw(now){
        if(finished)return;if(ui.game!==g){finish();return;}
        const t=Math.min(1,(now-start)/duration);g._courtFx={kind,points,progress:t};
        if(escape){boss._escapeAlpha=Math.max(0,1-Math.max(0,t-.42)/.35);if(t>.3)line.textContent='“留你们一命。”';}
        else{boss._casting=Math.min(.99,t);for(const u of points)u._summonAlpha=Math.max(0,Math.min(1,(t-.34)/.34));}
        ui.renderer.render(now);c.fillStyle='#0c1727';c.fillRect(0,0,1120,500);
        M.ParkMap.drawBattleBackground(c,1120,500,true);
        // Close view of the supplied boss pose, alongside the actual reinforcement area.
        c.fillStyle='rgba(5,10,22,.54)';c.fillRect(0,0,440,500);A.throne(c,210,400,2.6);
        A.circle(c,210,420,285,88,Math.min(.99,t),.9);
        if(escape){c.save();c.globalAlpha=boss._escapeAlpha;A.action(c,210,413,230,'idle',Math.floor(now/180)%A.specs.idle[1],'right',now);c.restore();
          const beam=c.createLinearGradient(210,80,210,440);beam.addColorStop(0,'rgba(170,110,231,0)');beam.addColorStop(1,'rgba(180,101,242,'+Math.sin(Math.PI*t)*.55+')');c.fillStyle=beam;c.fillRect(150,80,120,360);
        }else A.action(c,190,420,238,'summon',A.frameAt('summon',t*1.14),'right',now);
        c.fillStyle='#f0d3ef';c.font='bold 24px sans-serif';c.textAlign='center';c.fillText(escape?'“留你们一命。”':'“回应我的召唤。”',218,52);
        const v=ui.renderer.projection,s=ui.renderer.scale,p=M.MapProjection.project(v,(center.x+.5)*32,(center.y+.5)*32);
        const sourceSize=350*s,left=Math.max(0,Math.min(ui.renderer.canvas.width-sourceSize,(p.x-175)*s)),top=Math.max(0,Math.min(ui.renderer.canvas.height-sourceSize,(p.y-175)*s));
        c.drawImage(ui.renderer.canvas,left,top,sourceSize,sourceSize,476,20,460,460);
        c.strokeStyle='#8b719d';c.lineWidth=2;c.strokeRect(476,20,460,460);
        c.textAlign='left';c.font='17px sans-serif';c.fillStyle='#e7d2ee';
        const lines=escape?['生命锁定','1 HP','传送离场', '未被击杀']:['第 '+g.summonedWaves.length+' 波',points.length+' 名援军','现身当轮','不会行动'];
        lines.forEach((text,i)=>c.fillText(text,958,135+i*57));
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
    this._maskedEscapePromise=(async()=>{await this.playCourtScene('escape');if(this.game===g){g.finishMaskedEscape();this.resetSelection({silent:true});this.updateAll();}})().finally(()=>{this._maskedEscapePromise=null;});
    return this._maskedEscapePromise;
  };
})(window);
