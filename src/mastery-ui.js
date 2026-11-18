/* Diary pages and battle commands for class mastery. */
(function(global){
  'use strict';
  const M=global.MyGO,A=M.Mastery;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function bar(u,id=u.classId){const p=A.progress(u,id);if(!p||u.side==='enemy')return '';
    return '<div class="growth-exp mastery-exp"><div><strong>'+esc(M.Classes.get(id).name)+' · '+(p.mastered?'已专精':'职业经验')+'</strong><span>'+p.xp+' / '+p.required+' CEXP</span></div><div class="growth-exp-track mastery-track" role="progressbar" aria-label="'+esc(M.Classes.get(id).name)+'职业经验" aria-valuemin="0" aria-valuemax="'+p.required+'" aria-valuenow="'+p.xp+'"><i style="width:'+Math.floor(p.xp/p.required*100)+'%"></i></div></div>';
  }
  function rewards(u,id){const p=A.progress(u,id);return '<div class="mastery-rewards"><strong>'+(p.mastered?'✓ 已专精':'专精奖励 · '+p.xp+'/'+p.required)+'</strong>'+p.rewards.map(r=>'<p><b>'+esc(r.name)+'</b> <small>'+(r.kind==='art'?'战技'+(r.exclusive?' · 职业限定':''):'可装备技能')+'</small><br>'+esc(r.description)+'</p>').join('')+'</div>';}
  function skills(u,lock){const ids=A.learned(u),passives=ids.filter(id=>A.abilities[id]),arts=ids.filter(id=>A.arts[id]);
    return '<header class="growth-heading"><small>CLASS MASTERY</small><h3>'+esc(u.name)+' · 职业专精</h3><p>已装备 '+u.masteryEquipped.length+' / 5 个专精技能</p></header>'+bar(u)+
      '<p class="loadout-footnote">参与一场敌我交战（包括未命中、未造成伤害与防守），或成功使用一次辅助魔法／辅助战技，当前职业经验＋1。多段攻击按整场计一次，满条自动习得奖励；已专精职业停止积累。转职保留每种职业的独立进度。</p>'+
      (lock?'<p class="loadout-notice is-locked">'+esc(lock)+'</p>':'')+
      '<h4>已学技能 · 自动装备至多5个</h4><div class="mastery-skill-list">'+(passives.length?passives.map(id=>{const a=A.abilities[id],on=A.has(u,id);return '<article class="class-card'+(on?' is-current':'')+'"><strong>'+esc(a.name)+(on?' · 装备中':'')+'</strong><p>'+esc(a.description)+'</p><button type="button" data-mastery-equip="'+id+'"'+(lock||!on&&u.masteryEquipped.length>=5?' disabled':'')+'>'+(on?'卸下技能':'装备技能')+'</button></article>';}).join(''):'<p>职业经验满后，会在这里学会专精技能。</p>')+'</div>'+
      '<h4>已学战技</h4><div class="mastery-skill-list">'+(arts.length?arts.map(id=>{const a=A.arts[id];return '<article class="class-card"><strong>'+esc(a.name)+'</strong><p>'+esc(a.description)+'</p><small>'+(a.exclusive?'限 '+a.exclusive.map(c=>esc(M.Classes.get(c).name)).join(' / '):'转职后保留使用')+(a.cost?' · 每次消耗'+a.cost+'武器耐久':' · 消耗一次行动')+'</small></article>';}).join(''):'<p>部分职业满经验后还会习得战技。</p>')+'</div>'+
      '<p class="loadout-footnote">战技不占5个技能栏。战斗行动中点击「职业战技」使用；切换武器或待机会取消本次选择。技能与各职业经验会随存档及跨章继承，旧存档从0职业经验开始。</p>';
  }
  M.MasteryUI=Object.freeze({bar,rewards,skills});
  const UP=M.UI.prototype,baseInfo=UP.renderUnitInfo,baseAction=UP.renderActionSide;
  UP.renderUnitInfo=function(u){baseInfo.call(this,u);if(u&&u.side!=='enemy')this.dom.infoBody.insertAdjacentHTML('beforeend',bar(u));};
  UP.renderActionSide=function(u){baseAction.call(this,u);
    const available=A.availableArts(u);if(!available.length&&!A.has(u,'steal')&&u.classId!=='dancer')return;
    const b=document.createElement('button');b.type='button';b.className='action-btn loadout-action';b.textContent='职业战技'+(A.selectedArt(u)?' · '+A.selectedArt(u).name:'');b.onclick=()=>this.showMasteryActions(u);this.dom.actionButtons.appendChild(b);
  };
  UP.showMasteryActions=function(u){
    if(this.busy||u.acted||!this.game.isPlayerPhase())return;
    const rows=A.availableArts(u).concat(u.classId==='dancer'?[{id:'dance',name:'舞蹈',assist:true,description:'令相邻且已行动的同伴再次行动；无法对舞者使用。'}]:[],A.has(u,'steal')?[{id:'steal',name:'偷窃',assist:true,description:A.abilities.steal.description}]:[]);
    this.openOverlay('<div class="modal-kicker">CLASS COMBAT ARTS</div><h2 class="modal-title" id="overlay-title">'+esc(u.name)+' · 职业战技</h2><p class="modal-sub">攻击战技选定后，在地图上选择敌人并确认交战。辅助战技选目标后立即使用并结束行动。</p><div class="battle-loadout-list">'+rows.map(a=>{const reason=a.assist?(A.assistTargets(this.game,u,a.id).length?'':'当前没有有效目标'):A.artReason(u,a.id);return '<button class="battle-loadout-row" data-mastery-action="'+a.id+'"'+(reason?' disabled':'')+' title="'+esc(reason)+'"><span><strong>'+esc(a.name)+'</strong><small>'+esc(a.description)+'</small><small>'+esc(reason)+'</small></span><b>'+(a.assist?'选择目标':a.cost+'耐久')+'</b></button>';}).join('')+'</div><div class="modal-actions"><button class="modal-btn" data-normal-attack>改用普通攻击</button><button class="modal-btn" data-overlay-close>返回</button></div>','loadout-modal',true);
    this.dom.overlayCard.querySelector('[data-normal-attack]').onclick=()=>{u.combatArtId=null;this.closeOverlay();this.enterActionMode();};
    this.dom.overlayCard.querySelectorAll('[data-mastery-action]').forEach(b=>b.onclick=()=>{const id=b.dataset.masteryAction,a=A.arts[id];if(a&&!a.assist){try{this.game.selectCombatArt(u,id);this.closeOverlay();this.enterActionMode();}catch(e){this.showToast(e.message,'error');}}else this.chooseMasteryTarget(u,id);});
  };
  UP.chooseMasteryTarget=function(u,id){const name=A.arts[id]?.name||(id==='dance'?'舞蹈':'偷窃'),targets=A.assistTargets(this.game,u,id);
    this.openOverlay('<div class="modal-kicker">ASSIST ART</div><h2 class="modal-title" id="overlay-title">'+esc(name)+' · 选择目标</h2><div class="battle-loadout-list">'+targets.map(t=>{
      const button=(label,index='')=>'<button class="battle-loadout-row" data-mastery-target="'+esc(t.id)+'" data-steal-index="'+index+'"><span><strong>'+esc(t.name)+'</strong><small>'+esc(label)+' · 距离'+M.Grid.manhattan(u,t)+'格</small></span><b>使用并结束行动</b></button>';
      return id==='steal'?t.inventory.map((i,n)=>A.stealable(t).includes(i)?button(M.Inventory.item(i.id).name,n):'').join(''):button('HP '+t.hp+'/'+t.maxHp);
    }).join('')+'</div><div class="modal-actions"><button class="modal-btn" data-mastery-back>返回战技</button></div>','loadout-modal',true);
    this.dom.overlayCard.querySelector('[data-mastery-back]').onclick=()=>this.showMasteryActions(u);
    this.dom.overlayCard.querySelectorAll('[data-mastery-target]').forEach(b=>b.onclick=async()=>{
      if(this.busy)return;this.setBusy(true);
      try{const r=this.game.useMasteryAssist(u,this.game.getUnit(b.dataset.masteryTarget),id,+b.dataset.stealIndex);this.closeOverlay();for(const tid of r.affected){const t=this.game.getUnit(tid);this.renderer.snapUnit(t);this.renderer.floatText(name,t.x,t.y,'#d9c58f',11);}await this.showGrowthResults(r.experience);this.resetSelection({silent:true});this.updateAll();this.renderIdleInfo();this.showToast(u.name+'使用了'+name,'success',2400);}catch(e){this.showToast(e.message,'error');}finally{this.setBusy(false);}
    });
  };
})(window);
