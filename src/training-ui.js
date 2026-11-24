/* Entry selection and settlement for the tower side battle. */
(function (global) {
  'use strict';
  const M=global.MyGO, T=M.Training;
  const escape=value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  function trainingResultMember({name,mastery,growth}){
    const levels=growth?.levels||[];
    const levelChange=levels.length?`<span class="training-result-level-change">Lv.${growth.before.level} → Lv.${growth.after.level}</span>`:'';
    const growthRows=levels.map(level=>{
      const stats=M.GrowthData.keys.filter(key=>level.after[key]>level.before[key]);
      return `<section class="training-result-growth"><h4>升至 Lv.${level.level} · 属性增长</h4>
        <ul>${stats.map(key=>`<li><span>${escape(M.GrowthData.labels[key])}</span>
          <span>${level.before[key]} → ${level.after[key]}</span><strong>+${level.after[key]-level.before[key]}</strong></li>`).join('')}</ul></section>`;
    }).join('');
    return `<section class="training-result-member">
      <header><h3>${escape(name)}</h3>${levelChange}</header>
      <dl class="training-result-rewards"><div><dt>等级经验</dt><dd>+${growth?.gained||0}</dd></div>
        <div><dt>职业经验</dt><dd>+${mastery}</dd></div></dl>${growthRows}</section>`;
  }

  class TrainingScreen {
    constructor(retreat){
      this.retreat=retreat;
      this.ui=retreat.ui;
      this.root=document.createElement('section');
      this.root.className='training-entry';
      this.root.hidden=true;
      this.root.setAttribute('role','dialog');
      this.root.setAttribute('aria-modal','true');
      this.root.setAttribute('aria-labelledby','training-entry-title');
      retreat.root.after(this.root);
      this.root.addEventListener('click',event=>{
        if(event.target===this.root || event.target.closest('[data-training-close]')) return this.close();
        const picked=event.target.closest('[data-training-unit]');
        if(picked){
          const id=picked.dataset.trainingUnit;
          if(this.selection.has(id))this.selection.delete(id);
          else if(this.selection.size<2)this.selection.add(id);
          this.render(id);
        }else if(event.target.closest('[data-training-enter]')){
          try{
            this.ui.startTraining([...this.selection]);
            this.root.hidden=true;
          }catch(error){
            this.root.querySelector('[data-training-selection]').textContent=error.message;
          }
        }
      });
    }

    open(){
      const game=this.ui.game;
      if(!M.Shop.trainingUnlocked(game)){
        this.retreat.announce('第 3 章通关后解锁训练之塔。');
        return;
      }
      this.selection=new Set();
      this.retreat.pause();
      this.root.hidden=false;
      this.render();
      this.root.querySelector('[data-training-close]').focus();
    }

    close(){
      if(this.root.hidden)return;
      this.root.hidden=true;
      this.retreat.resume();
    }

    onKeyDown(event){
      if(this.root.hidden)return false;
      if(event.key==='Escape'){
        event.preventDefault();event.stopPropagation();this.close();
      }else if(event.key==='Tab'){
        const buttons=[...this.root.querySelectorAll('button:enabled')];
        const first=buttons[0], last=buttons.at(-1), active=document.activeElement;
        if(!buttons.includes(active)||(event.shiftKey?active===first:active===last)){
          event.preventDefault();(event.shiftKey?last:first).focus();
        }
      }
      return true;
    }

    render(focus){
      const game=this.ui.game, roster=T.trainees(game), reason=T.entryReason(game), count=T.ticketCount(game);
      this.root.innerHTML=`<div class="training-panel">
        <header class="training-head"><div><h2 id="training-entry-title">训练之塔</h2><p>选择两位同伴，迎战 ${T.ENEMY_COUNT} 个史莱姆。</p></div>
        <button type="button" class="modal-btn" data-training-close>返回</button></header>
        <div class="training-summary"><span>可用门票 <b>${count}</b></span><span>每次消耗 1 张</span></div>
        <div class="training-roster" aria-label="选择参训同伴">${roster.map(unit=>{
          const selected=this.selection.has(unit.id);
          return `<button type="button" class="training-recruit" data-training-unit="${escape(unit.id)}" aria-pressed="${selected}" ${!selected&&this.selection.size===2?'disabled':''}>
            <canvas width="72" height="72" aria-hidden="true"></canvas>
            <span><strong>${escape(unit.name)}</strong><small>Lv.${unit.level} · ${escape(unit.className)}</small>
            <small>属性总和 ${M.Combat.statTotalOf(unit)}</small></span></button>`;
        }).join('')}</div>
        <p class="training-note">每人对应 ${T.ENEMY_COUNT/2} 个史莱姆，总属性低 30～40 点。途中获得 ${T.MASTERY_MULTIPLIER} 倍职业经验，全部击败后两人各领取一次同级击破的等级经验。训练使用临时的生命值和装备副本。</p>
        <footer class="training-actions"><p data-training-selection role="status">${escape(reason||('已选 '+this.selection.size+' / 2'))}</p>
        <button type="button" class="modal-btn primary" data-training-enter ${reason||this.selection.size!==2?'disabled':''}>消耗门票 · 进入训练</button></footer></div>`;
      for(const unit of roster){
        const card=this.root.querySelector('[data-training-unit="'+unit.id+'"]');
        this.retreat.entry.drawPortrait(card.querySelector('canvas'),unit,true);
        if(unit.id===focus)card.focus();
      }
    }
  }

  const UI=M.UI.prototype;
  UI.trainingObjective=function(){
    return '击败全部史莱姆 · 剩余 '+this.game.livingCount('enemy')+' / '+this.game.mission.enemyCount;
  };

  UI.syncTrainingChrome=function(){
    const training=this.game.isTraining;
    const enemyLabel=document.getElementById('enemy-label');
    if(enemyLabel)enemyLabel.textContent=training?'史莱姆':'迷途回声';
    const title=document.getElementById('title-btn');
    if(title){title.textContent=training?'营地':'标题';title.title=training?'结束本次训练':'返回标题页 / 编队';}
    if(this.dom.restartBtn){
      this.dom.restartBtn.textContent=training?'退出':'重开';
      this.dom.restartBtn.title=training?'结束本次训练':'重新开始本关';
    }
  };

  UI.switchTrainingGame=function(game){
    this.closeOverlay();
    this.game=game;
    this.busy=false;
    this.endShown=false;
    this.chapterPlayed=game.isTraining||!!game.retreat?.chapterIntroPlayed;
    this.enemyThreatId=null;
    this.enemyThreatTiles=new Set();
    this.renderer.setGame(game);
    this.resetSelection({silent:true});
    this.setZoom(1,false);
    this.syncMission();
    this.updateAll();
    this.renderIdleInfo();
  };

  UI.startTraining=function(ids){
    const entry=M.entry;
    if(entry?.ui!==this||entry.retreat.root.hidden||this.busy)throw Error('请从休憩之地进入训练之塔。');
    const seed=Math.floor(Math.random()*0xffffffff)+1;
    const battle=T.Game.start(this.game,ids,seed);
    entry.retreat.close();
    this.switchTrainingGame(battle);
    this.revealCell(battle.units[0].x,battle.units[0].y);
    const saved=this.saveCheckpoint();
    this.showBanner('训练之塔',battle.mission.objective,1500);
    this.showToast(saved.ok?'已消耗 1 张训练之塔门票。':saved.message,saved.ok?'info':'error',2400);
  };

  UI.askLeaveTraining=function(){
    if(this.busy||this.mode!=='idle'||!this.dom.overlayRoot.hidden||this.game.isOver())return;
    this.confirmHandler=()=>{
      this.game.phase='defeat';
      this.game.winner='enemy';
      this.showTrainingEnd();
    };
    this.openOverlay('<h2 class="modal-title" id="overlay-title">结束本次训练？</h2><p class="modal-sub">已获得的职业经验会保留。通关等级经验仅在击败全部史莱姆后发放。</p><div class="modal-actions"><button type="button" class="modal-btn" data-overlay-close>继续训练</button><button type="button" class="modal-btn primary" data-confirm>结束训练</button></div>','',true);
  };

  UI.showTrainingEnd=function(){
    if(this.endShown)return;
    this.endShown=true;
    const battle=this.game, result=battle.settle(), saved=this.saveCheckpoint(battle.campaign);
    this.openOverlay(`<header class="training-result-heading">
      <h2 id="overlay-title">${result.complete?'训练完成':'训练结束'}</h2>
      <p>已击败 <strong>${result.defeated} / ${battle.mission.enemyCount}</strong> 个史莱姆</p></header>
      <div class="training-result-party">${result.party.map(trainingResultMember).join('')}</div>
      <footer class="training-result-footer"><p role="status">${escape(saved.ok?'营地进度已自动保存。':saved.message)}</p>
      <button type="button" class="modal-btn primary" data-training-return>返回休憩之地</button></footer>`, 'training-result', false);
    const button=this.dom.overlayCard.querySelector('[data-training-return]');
    button.onclick=async()=>{
      if(button.disabled)return;
      button.disabled=true;
      for(const member of result.party)if(member.growth?.levels.some(level=>level.learned?.length)){
        await this.showLearnedSpells(battle.campaign.getUnit(member.growth.unitId),member.growth.levels);
      }
      this.switchTrainingGame(battle.campaign);
      M.entry.openRetreat();
      M.entry.retreat.announce(saved.ok?(result.complete?'训练完成，奖励已记入队伍。':'已带着本次职业经验回到营地。'):saved.message);
    };
    button.focus({preventScroll:true});
  };

  M.TrainingScreen=TrainingScreen;
})(window);
