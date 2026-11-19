/* Backpack pages share the diary's portraits, paper, and CC0 equipment artwork. */
(function(global){
  'use strict';
  const M=global.MyGO,I=M.Inventory,Magic=M.Magic;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function icon(e){if(e.kind==='unarmed')return '<span aria-hidden="true">拳</span>';if(e.kind==='key')return '<span class="key-item-icon" aria-hidden="true">⚿</span>';const id=e.kind==='spell'?'spell_'+e.id:e.icon;
    return '<img alt="" src="'+(global.MYGO_EQUIPMENT_ICONS?.[id]||'assets/equipment/icons/'+id+'.png')+'">';}
  function stats(e,u){return e.kind==='unarmed'?'空手格斗 · 威力0 · 命中80 · 无耐久消耗':e.kind==='weapon'?'威力 '+e.might+' · 命中 '+e.hit+' · 重量 '+e.weight+' · 射程 '+e.range:
    e.kind==='spell'?'威力 '+e.might+' · 命中 '+e.hit+' · 重量 '+e.weight+' · 射程 '+(u?Magic.rangeOf(e,u).join('–'):e.rangeText.replace('mag/','魔力/')) :e.effect;}
  function tabs(active){return '<nav class="loadout-tabs" aria-label="角色资料页">'+[['stats','能力资料'],['growth','成长率'],['bag','背包配置'],['magic','已学魔法'],['classes','职业目录'],['mastery','职业专精']].map(([id,n])=>'<button type="button" data-loadout-tab="'+id+'" aria-pressed="'+(active===id)+'">'+n+'</button>').join('')+'</nav>';}
  function experienceSummary(u){const need=M.Growth.required(u.level),pct=need?Math.floor(u.exp/need*100):100;
    return '<div class="growth-exp"><div><strong>Lv.'+u.level+'</strong><span>'+(need?'EXP '+u.exp+' / '+need+' · 距下一级 '+(need-u.exp):'EXP MAX · 已达最高等级')+'</span></div><div class="growth-exp-track" role="progressbar" aria-label="升级经验" aria-valuemin="0" aria-valuemax="'+(need||1)+'" aria-valuenow="'+(need?u.exp:1)+'"><i style="width:'+pct+'%"></i></div></div>';}
  function growthCatalogue(u){const D=M.GrowthData,personal=M.Growth.personalRates(u),job=D.classes[u.classId]||{},total=M.Growth.rates(u);
    return '<header class="growth-heading"><small>CHARACTER GROWTH</small><h3>'+esc(u.name)+' · 成长率</h3><p>'+esc(u.className)+' · 困难难度经验规则</p></header>'+experienceSummary(u)+
      '<table class="growth-table"><caption>升级时各属性提升的概率（%）</caption><thead><tr><th scope="col">属性</th><th scope="col">个人成长</th><th scope="col">职业修正</th><th scope="col">实际成长</th></tr></thead><tbody>'+D.keys.map(k=>'<tr><th scope="row">'+D.labels[k]+'</th><td>'+personal[k]+'%</td><td>'+((job[k]||0)>0?'+':'')+(job[k]||0)+'%</td><td><strong>'+total[k]+'%</strong></td></tr>').join('')+'</tbody></table>'+
      '<p class="loadout-footnote">实际成长率＝个人成长率＋当前职业修正。每次升级逐项随机判定，同伴采用学生规则，至少提升两项属性；移动不参与成长。</p><p class="loadout-footnote">对敌造成伤害、击破与反击均可获得经验；未造成伤害不获得经验。圣疗等辅助魔法按施法者等级与魔法类型给予经验。升级所需经验随等级增加，等级上限为 99。</p>';
  }
  function classSummary(u){
    const job=M.Classes.get(u.classId);if(!job)return '';
    return (M.MasteryUI?.bar(u)||'')+'<aside class="class-current"><span>当前职业 · '+esc(job.tierName)+'</span><strong>'+esc(job.name)+' <small>'+esc(job.en)+'</small></strong><p>擅长 '+esc(job.specialties)+' · '+esc(job.movement)+' · 移动 '+u.move+' 格</p><p class="class-path">培养方向：'+esc(M.Classes.paths[u.id]||'按擅长技能选择后续职业')+'</p></aside>';
  }
  function classCatalogue(u,tier,game,lock){
    return classSummary(u)+'<div class="loadout-section-title"><strong>风花雪月 · '+M.Classes.items.length+' 种职业</strong><select aria-label="职业阶段筛选" data-class-tier><option value="all"'+(tier==='all'?' selected':'')+'>全部阶段</option>'+M.Classes.tiers.map(t=>'<option value="'+t.id+'"'+(tier===t.id?' selected':'')+'>'+esc(t.name)+'</option>').join('')+'</select></div>'+
      '<p class="loadout-footnote">初级 Lv.5 → 中级 Lv.10 → 高级 Lv.20 → 最上级 Lv.30。普通职业达到等级并使用对应转职证即可取得资格，无需技能等级考试。拳斗士不限性别，其他职业保留原有性别、专用证件及前置职业限制。首次转职消耗证件；已取得资格可免费切换。战斗中转职结束本次行动；撤退同伴也可转职，仍保持撤退与原有 HP。</p>'+
      M.Classes.tiers.filter(t=>tier==='all'||t.id===tier).map(t=>'<section class="class-tier"><h4>'+esc(t.name)+' <small>'+M.Classes.query(t.id).length+' 种 · Lv.'+t.level+' 起</small></h4><div class="class-grid">'+M.Classes.query(t.id).map(job=>{
        const reason=lock||game.reclassReason(u,job.id),certified=(u.certifiedClasses||[]).includes(job.id);
        return '<article class="class-card'+(job.id===u.classId?' is-current':'')+'"><div><strong>'+esc(job.name)+'</strong>'+(job.id===u.classId?'<span class="class-badge">当前职业</span>':'')+'</div><small>'+esc(job.en)+'</small><p>擅长 '+esc(job.specialties)+'</p><p>'+esc(job.requirements)+'</p><footer>移动 '+job.move+' · '+(job.magic?'可使用魔法':'不可使用魔法')+(job.gender?' · '+job.gender+'性限定':'')+(job.dlc?' · DLC':'')+'</footer>'+(M.MasteryUI?.rewards(u,job.id)||'')+'<button type="button" data-reclass="'+job.id+'"'+(reason?' disabled':'')+' title="'+esc(reason||'战斗中转职会结束行动')+'">'+esc(reason||(certified?'切换职业 · 已取得资格':'使用转职证'))+'</button></article>';
      }).join('')+'</div></section>').join('')+
      '<p class="loadout-footnote">转职后移动、移动类型、武器类别、魔法使用与职业成长率立即生效，已学魔法记录保留。专精经验与奖励在职业目录和「职业专精」页查看；满条自动习得，转职保留进度。</p>';
  }
  const EP=M.EntryScreen.prototype,baseRender=EP.renderFormationDetail,baseBind=EP.bind;
  function talentSummary(u){
    if(!M.Talents||u.side==='enemy')return '';
    return M.Talents.list(u).map(t=>'<aside class="class-current"><span>'+(t.slot===0?'通用天赋':'个人天赋'+t.slot)+' · Lv.'+t.level+'觉醒 · '+(t.active?'已觉醒':'未觉醒')+'</span><strong>'+esc(t.name)+'</strong><p>'+esc(t.description)+'</p></aside>').join('');
  }
  EP.bind=function(){baseBind.call(this);this.dom.formationDetail.addEventListener('click',e=>{
    const t=e.target.closest('button');if(!t)return;
    if(t.dataset.loadoutTab){this.loadoutTab=t.dataset.loadoutTab;this.renderFormationDetail();this.dom.formationDetail.scrollTop=0;return;}
    const u=this.players().find(u=>u.id===this.selectedUnitId);if(!u)return;
    try{
      const reason=(t.hasAttribute('data-reclass')||t.hasAttribute('data-mastery-equip'))?this.reclassLock(u):this.loadoutLock(u);if(reason)throw Error(reason);
      if(t.hasAttribute('data-bag-equip'))this.ui.game.equipItem(u,+t.dataset.bagEquip);
      else if(t.hasAttribute('data-bag-store'))this.ui.game.transferItem(u,+t.dataset.bagStore,true);
      else if(t.hasAttribute('data-bag-take'))this.ui.game.transferItem(u,+t.dataset.bagTake,false);
      else if(t.hasAttribute('data-spell-equip'))this.ui.game.selectAttack(u,t.dataset.spellEquip);
      else if(t.hasAttribute('data-mastery-equip'))this.ui.game.equipMasterySkill(u,t.dataset.masteryEquip);
      else if(t.hasAttribute('data-reclass')){
        this.ui.game.reclassUnit(u,t.dataset.reclass);
        const message=u.name+'转职为'+u.className;
        if(this.retreat?.root.hidden===false)this.retreat.announce(message);
        this.ui.showToast(message,'success',2500);
      }
      else if(t.hasAttribute('data-medicine-use')){const r=this.ui.game.useMedicine(u,+t.dataset.medicineUse);this.ui.showToast(u.name+'使用'+r.item.name+(r.healed?'，回复 '+r.healed+' HP':'')+(r.resourcePreserved?' · 爱笑女孩：未消耗次数':''),'success',2500);}
      else return;
      this.renderFormationList();this.renderFormationDetail();this.ui.updateAll();
    }catch(err){this.ui.showToast(err.message,'error',2200);}
  });this.dom.formationDetail.addEventListener('change',e=>{if(e.target.matches('[data-stock-filter]')){this.stockFilter=e.target.value;this.renderFormationDetail();}if(e.target.matches('[data-class-tier]')){this.classTier=e.target.value;this.renderFormationDetail();}});};
  EP.loadoutLock=function(u){return this.ui.busy?'正在结算战斗':this.ui.mode!=='idle'?'请先返回战场，完成或取消当前单位的行动':this.ui.game.loadoutReason(u);};
  EP.reclassLock=function(u){return this.ui.busy?'正在结算战斗':this.ui.mode!=='idle'?'请先返回战场，完成或取消当前单位的行动':this.ui.game.reclassLockReason(u);};
  EP.renderFormationDetail=function(){
    const active=this.loadoutTab||'stats';
    if(active==='stats'){baseRender.call(this);const unit=this.players().find(u=>u.id===this.selectedUnitId);this.dom.formationDetail.insertAdjacentHTML('afterbegin',tabs(active)+(unit?classSummary(unit)+experienceSummary(unit)+talentSummary(unit):''));return;}
    const u=this.players().find(u=>u.id===this.selectedUnitId);if(!u)return;
    if(active==='growth'){this.dom.formationDetail.innerHTML=tabs(active)+talentSummary(u)+(M.MasteryUI?.bar(u)||'')+growthCatalogue(u);this.renderPoseDock(u);return;}
    if(active==='mastery'&&M.MasteryUI){this.dom.formationDetail.innerHTML=tabs(active)+M.MasteryUI.skills(u,this.reclassLock(u));this.renderPoseDock(u);return;}
    if(active==='classes'){
      this.dom.formationDetail.innerHTML=tabs(active)+classCatalogue(u,this.classTier||'all',this.ui.game,this.reclassLock(u));
      this.renderPoseDock(u);return;
    }
    const lock=this.loadoutLock(u),dis=lock?' disabled':'';
    const header=tabs(active)+'<header class="loadout-person"><canvas width="92" height="92" data-loadout-portrait></canvas><div><small>COMPANIONS / '+(active==='bag'?'INVENTORY':'LEARNED MAGIC')+'</small><h3>'+esc(u.name)+'</h3><p>'+esc(u.className)+' · 当前攻击：'+esc(u.weapon.name)+'</p></div><span class="loadout-count">'+(active==='bag'?u.inventory.length+' / 5':'魔法独立')+'</span></header>'+
      '<p class="loadout-notice'+(lock?' is-locked':'')+'">'+esc(lock||'配置会保留在本局中，使用「存档」保存至浏览器；下一章继承背包。')+'</p>';
    let body='';
    if(active==='bag'){
      body='<div class="loadout-section-title"><strong>随身背包</strong><span>武器、装备、药品、转职证与钥匙共用 5 格</span></div><div class="bag-slots">'+
        Array.from({length:5},(_,n)=>{
          const slot=u.inventory[n];if(!slot)return '<div class="bag-slot is-empty"><span class="bag-index">0'+(n+1)+'</span><span>空背包格</span><small>从下方运输队领取物品</small></div>';
          const e=I.item(slot.id),equipped=e.kind==='weapon'?u.equippedWeapon===e.id&&u.inventory.findIndex(i=>i.id===e.id&&i.uses>0)===n:u.equippedAccessory===e.id;
          const ok=I.canEquip(u,e)&&slot.uses!==0;
          return '<div class="bag-slot'+(equipped?' is-equipped':'')+'"><span class="bag-index">0'+(n+1)+'</span><span class="bag-icon">'+icon(e)+'</span><div class="bag-copy"><strong>'+esc(e.name)+(equipped?'<em>装备中</em>':'')+'</strong><small>'+esc(stats(e))+'</small><small>'+(e.kind==='key'?'钥匙 · 1 次':e.uses!==null?'剩余 '+slot.uses+' / '+e.uses+(slot.uses===0?' · 已损坏':''):e.category==='staff'?'辅助装备 · 不能作为魔法攻击':'辅助装备')+'</small></div><div class="bag-buttons">'+(e.kind==='key'?'<span>'+(e.id==='chest_key'?'到宝箱旁使用':'到门旁使用')+'</span>':e.kind==='seal'?'<span>在职业目录使用</span>':e.kind==='consumable'?'<button type="button" data-medicine-use="'+n+'"'+(dis||(this.ui.game.medicineReason(u,n)?' disabled':''))+' title="'+esc(this.ui.game.medicineReason(u,n))+'">使用 · 结束行动</button>':'<button type="button" data-bag-equip="'+n+'"'+(dis||(!ok?' disabled':''))+'>'+(e.kind==='weapon'?(equipped?'已装备':'装备'):(equipped?'卸下':'装备'))+'</button>')+'<button type="button" data-bag-store="'+n+'"'+dis+'>存入运输队</button></div></div>';
        }).join('')+'</div><p class="loadout-footnote">魔法不占格数。职业决定可装备的武器类别；可携带其他类别供运输队调配。武器每次出手消耗 1 耐久，损坏后自动切换可用攻击手段。</p>';
      const filter=this.stockFilter||'usable';
      body+='<div class="loadout-section-title"><strong>运输队 <small>'+this.ui.game.convoy.length+' 件'+(this.ui.game.lootReserve?.length?' · 战利品暂存 '+this.ui.game.lootReserve.length+' 件':'')+'</small></strong><select aria-label="运输队筛选" data-stock-filter><option value="usable"'+(filter==='usable'?' selected':'')+'>适合当前职业</option><option value="all"'+(filter==='all'?' selected':'')+'>全部物品</option><option value="equipment"'+(filter==='equipment'?' selected':'')+'>辅助装备</option></select></div><div class="convoy-list">'+this.ui.game.convoy.map((slot,n)=>{
        const e=I.item(slot.id);if(filter==='usable'&&e.kind==='weapon'&&!I.canEquip(u,e)||filter==='equipment'&&e.kind!=='equipment')return '';
        return '<div class="convoy-row"><span class="bag-icon">'+icon(e)+'</span><div class="bag-copy"><strong>'+esc(e.name)+'</strong><small>'+esc(stats(e))+(e.kind==='weapon'?' · 耐久 '+slot.uses+'/'+e.uses:'')+'</small></div><button type="button" data-bag-take="'+n+'"'+(dis||(u.inventory.length>=5?' disabled':''))+'>领取</button></div>';
      }).join('')+'</div>';
    }else{
      body=(!I.magicAllowed(u)?'<p class="loadout-notice is-locked">当前职业不能使用魔法；已学记录保留，转为魔法职业后可继续施放。</p>':'')+'<div class="loadout-section-title"><strong>已学魔法 <small>'+u.learnedSpells.length+' 种</small></strong><span>不占背包 · 每次出手消耗 1 次 · 下一章恢复</span></div><div class="spell-list">'+
        (u.learnedSpells.length?u.learnedSpells.map(id=>{
          const s=Magic.get(id),selected=u.equippedWeapon===id;
          return '<article class="spell-card'+(selected?' is-equipped':'')+'"><span class="bag-icon">'+icon(s)+'</span><div class="bag-copy"><strong>'+esc(s.name)+' <small>'+esc(s.en)+'</small></strong><small>'+Magic.schoolName(s)+' · '+s.rank+' · '+esc(stats(s,u))+'</small><p>'+esc(s.description)+'</p></div><div class="spell-charge"><b>'+u.spellUses[id]+'<small>/'+s.uses+'</small></b>'+(s.support?'<small>战斗中使用辅助魔法</small>':'<button type="button" data-spell-equip="'+id+'"'+(dis||(!I.magicAllowed(u)||!u.spellUses[id]?' disabled':''))+'>'+(selected?'当前攻击':'设为攻击')+'</button>')+'</div></article>';
        }).join(''):'<p class="loadout-empty">该角色目前未学会魔法。法师的魔法记录在这里，无需领取魔法书。</p>')+'</div>'+
        '<div class="loadout-section-title"><strong>等级学法术</strong><span>法师按等级自动习得；原作法术效果，等级安排为本作设定</span></div><div class="spell-reference">'+(u.mageTrained||M.Classes.get(u.classId)?.magic?Magic.learning.map(row=>'<article><strong>Lv.'+row.level+' · '+esc(Magic.get(row.id).name)+'</strong><p>'+(u.learnedSpells.includes(row.id)?'已习得':'达到等级后自动习得')+'</p></article>').join(''):'<p>转为可使用魔法的职业后开始学习。</p>')+'</div><details class="spell-codex"><summary>风花雪月魔法图鉴 · 36 种可学习魔法</summary><p class="loadout-footnote">数值来自 Serenes Forest。下表为参考图鉴；各角色只可使用已学魔法，当前职业须允许魔法。</p>'+['black','dark','faith'].map(school=>'<h4>'+Magic.schoolName({school})+'</h4><div class="spell-reference">'+Magic.items.filter(s=>s.school===school).map(s=>'<article><strong>'+esc(s.name)+' <small>'+s.rank+' · '+s.uses+'次</small></strong><small>'+esc(s.en)+' · '+esc(stats(s,u))+'</small><p>'+esc(s.description)+'</p></article>').join('')+'</div>').join('')+'</details>';
    }
    this.dom.formationDetail.innerHTML=header+body;
    this.drawPortrait(this.dom.formationDetail.querySelector('[data-loadout-portrait]'),u,true);this.renderPoseDock(u);
  };

  const UP=M.UI.prototype,baseAction=UP.renderActionSide;
  const baseUnitInfo=UP.renderUnitInfo;
  UP.renderUnitInfo=function(u){baseUnitInfo.call(this,u);if(!u)return;
    if(M.Talents&&u.side!=='enemy')this.dom.infoBody.insertAdjacentHTML('beforeend',talentSummary(u));
    const guard=M.Talents?.guardBonus(u,this.game.map)||0;
    if(guard)this.dom.infoTags.insertAdjacentHTML('beforeend','<span class="tag">天赋守护 · 守备／魔防＋'+guard+'</span>');
    const line=this.dom.infoBody.querySelector('.weapon-line');
    if(line&&!u.weapon.cannotAttack)line.textContent+=' · '+(u.weapon.kind==='unarmed'?'空手 · 无耐久消耗':u.weapon.kind==='spell'?'剩余 '+u.spellUses[u.weaponId]+'/'+u.weapon.uses+' 次':'耐久 '+(u.inventory.find(i=>i.id===u.weaponId&&i.uses>0)?.uses||0)+'/'+u.weapon.uses);
    if(u.id==='nina'&&M.Talents?.active(u,3))this.dom.infoTags.insertAdjacentHTML('beforeend','<span class="tag">拳拳到肉 · 下次拳套／空手伤害＋'+(u.talentAttackCount||0)+'</span>');
    const labels={masteryDance:'特殊舞蹈 · 技巧／速度／幸运＋4',masteryTransmute:'魔力转换 · 七项属性＋3',masterySealDef:'防守封锁 · 守备−6',masterySealRes:'魔防封锁 · 魔防−6',defDown:'守备−5',spdDown:'速度−5',moveDown:'移动−5',talentResDown:'魔力打击 · 魔防／守备−5',frostSpeedDown:'冰霜剑气 · 速度−6',silence:'沉默',ward:'魔防支援',poison:'中毒'};
    for(const [id,n] of Object.entries(u.status))if(n&&id!=='frostFresh'&&!(M.Talents?.immune(u)&&['defDown','spdDown','moveDown','talentResDown','frostSpeedDown','masterySealDef','masterySealRes'].includes(id)))this.dom.infoTags.insertAdjacentHTML('beforeend','<span class="tag">'+esc(labels[id]||id)+(id==='ward'?'＋'+n:id==='frostSpeedDown'?' · 剩余'+n+'回合':'')+'</span>');
    if(u.equippedAccessory)this.dom.infoTags.insertAdjacentHTML('beforeend','<span class="tag">'+esc(I.item(u.equippedAccessory).name)+'</span>');
  };
  UP.renderActionSide=function(u){baseAction.call(this,u);
    if(u.id==='anon'&&M.Talents?.active(u,3)){
      const swap=document.createElement('button');swap.type='button';swap.className='action-btn';swap.textContent='待机后交换 · 幸福者退让';
      swap.onclick=()=>{this.game.markActed(u);this.resetSelection({silent:true});this.updateAll();this.showTalentSwap(u);};this.dom.actionButtons.appendChild(swap);
    }
  };
  UP.showTalentSwap=function(u){
    if(this.busy||this.dom.overlayRoot?.hidden===false)return;
    const targets=this.game.talentSwapTargets(u);if(!targets.length){this.game.skipTalentSwap(u);this.updateAll();return;}
    this.openOverlay('<div class="modal-kicker">PERSONAL TALENT 3</div><h2 class="modal-title" id="overlay-title">幸福者退让 · 交换位置</h2><p class="modal-sub">爱音本次未攻击，可与一名相邻队友交换位置。队友保留原有行动状态，爱音仍为已行动。</p><div class="battle-loadout-list">'+targets.map(t=>'<button class="battle-loadout-row" data-talent-swap="'+esc(t.id)+'"><span><strong>'+esc(t.name)+'</strong><small>位置 '+(t.x+1)+','+(t.y+1)+' · '+(t.acted?'已行动':'未行动')+'</small></span><b>交换</b></button>').join('')+'</div><div class="modal-actions"><button class="modal-btn" data-talent-swap-skip>不交换</button></div>','loadout-modal',true);
    this.dom.overlayCard.querySelector('[data-talent-swap-skip]').onclick=()=>{this.game.skipTalentSwap(u);this.closeOverlay();this.updateAll();};
    this.dom.overlayCard.querySelectorAll('[data-talent-swap]').forEach(b=>b.onclick=()=>{
      const target=this.game.getUnit(b.dataset.talentSwap);
      try{this.game.talentSwap(u,target);this.renderer.snapUnit(u);this.renderer.snapUnit(target);this.closeOverlay();this.resetSelection({silent:true});this.updateAll();this.showToast('幸福者退让：爱音与'+target.name+'交换了位置。','success',2400);}
      catch(err){this.closeOverlay();this.showToast(err.message,'error',2200);this.updateAll();}
    });
  };
  const baseWait=UP.waitActiveUnit,baseInspect=UP.inspectUnit;
  UP.waitActiveUnit=function(){const u=this.game.getUnit(this.activeId);baseWait.call(this);if(u&&this.game.talentSwapTargets(u).length)this.showTalentSwap(u);};
  UP.inspectUnit=function(u){baseInspect.call(this,u);if(this.game.talentSwapTargets(u).length){
    const b=document.createElement('button');b.type='button';b.className='action-btn primary';b.textContent='幸福者退让 · 交换位置';b.onclick=()=>this.showTalentSwap(u);this.dom.actionButtons.appendChild(b);
  }};
  UP.offerTalentSwap=function(){
    if(this.busy||this.chapterOpen||this.mode!=='idle'||this.game.isOver()||this.dom.overlayRoot?.hidden!==true||
      M.entry?.ui===this&&(!M.entry.dom.root.hidden||!M.entry.dom.formation.hidden))return;
    const u=this.game.getUnit('anon');if(this.game.talentSwapTargets(u).length)this.showTalentSwap(u);
  };
  const baseUpdate=UP.updateAll,baseBusy=UP.setBusy;
  UP.updateAll=function(){baseUpdate.call(this);this.offerTalentSwap();};
  UP.setBusy=function(value){baseBusy.call(this,value);if(!value)this.offerTalentSwap();};
  UP.supportSpells=function(u,healing){
    if(!I.magicAllowed(u))return [];
    return u.learnedSpells.filter(id=>{
      const spell=Magic.get(id);
      return spell.support&&spell.effect!=='torch'&&M.Talents.healingSpell(spell)===healing;
    });
  };
  UP.showSupportSpells=function(u,healing){
    if(this.busy||u.acted||!this.game.isPlayerPhase())return;
    const rows=this.supportSpells(u,healing).map(id=>{
      const spell=Magic.get(id), count=this.game.supportTargets(u,id).length;
      return '<button type="button" class="battle-loadout-row" data-support-choice="'+esc(id)+'"'+(count?'':' disabled')+'>'+
        '<span class="bag-icon">'+icon(spell)+'</span><span><strong>'+esc(spell.name)+'</strong><small>射程 '+Magic.rangeOf(spell,u).join('–')+' · '+count+' 个目标</small></span><b>'+u.spellUses[id]+' / '+spell.uses+'</b></button>';
    });
    const card=this.openActionPicker('<h3>'+(healing?'治疗':'辅助魔法')+'</h3><div class="battle-loadout-list">'+rows.join('')+
      '</div><button type="button" class="command-back" data-overlay-close>‹ 返回行动</button>');
    card.querySelectorAll('[data-support-choice]').forEach(b=>b.onclick=()=>this.chooseSupportTarget(u,b.dataset.supportChoice));
  };
  UP.chooseSupportTarget=function(caster,id){
    const s=Magic.get(id),targets=this.game.supportTargets(caster,id),amount=Magic.healAmount(s,caster);
    this.openActionPicker('<div class="modal-kicker">FAITH MAGIC</div><h2 class="modal-title" id="overlay-title">'+esc(s.name)+' · 选择目标</h2><p class="modal-sub">'+esc(s.description)+' 剩余 '+caster.spellUses[id]+'/'+s.uses+' 次。</p><div class="battle-loadout-list">'+targets.map(t=>'<button class="battle-loadout-row" data-support-target="'+esc(t.id)+'"><span><strong>'+esc(t.name)+'</strong><small>HP '+t.hp+'/'+t.maxHp+' · 距离 '+M.Grid.manhattan(caster,t)+' 格'+(['heal','fortify'].includes(s.effect)?' · 预计回复 '+Math.min(t.maxHp-t.hp,amount):'')+'</small></span><b>'+(s.effect==='fortify'||s.effect==='restore'?'范围内全体':'选择')+'</b></button>').join('')+'</div><div class="modal-actions"><button class="modal-btn" data-support-back>返回魔法</button></div>');
    const back=()=>this.showSupportSpells(caster,M.Talents.healingSpell(s));
    this.pickerBack=back;
    this.actionPickerCard.querySelector('[data-support-back]').onclick=back;
    this.actionPickerCard.querySelectorAll('[data-support-target]').forEach(b=>b.onclick=()=>{
      const target=this.game.getUnit(b.dataset.supportTarget);
      if(s.effect==='warp'){this.closeActionPicker();this.beginWarpTarget(caster,id,target);}else this.confirmSupport(caster,id,target);
    });
  };
  UP.confirmSupport=function(caster,id,target,destination){
    const s=Magic.get(id),affected=['fortify','restore'].includes(s.effect)?this.game.supportTargets(caster,id):[target];
    this.openOverlay('<div class="modal-kicker">CONFIRM SPELL</div><h2 class="modal-title" id="overlay-title">施放'+esc(s.name)+'？</h2><p class="modal-sub">目标：'+esc(affected.map(t=>t.name).join('、'))+(destination?' · 落点 '+(destination.x+1)+','+(destination.y+1):'')+'。消耗 1 次魔法，并结束'+esc(caster.name)+'的行动。</p><div class="modal-actions"><button class="modal-btn" data-support-back>取消</button><button class="modal-btn primary" data-cast-confirm>确认施放</button></div>','',true);
    this.dom.overlayCard.querySelector('[data-support-back]').onclick=()=>{
      if (this.mode === 'warp') {
        this.pendingWarp = null;
        this.enterActionMode();
      }
      this.chooseSupportTarget(caster,id);
    };
    this.dom.overlayCard.querySelector('[data-cast-confirm]').onclick=async()=>{
      if(this.busy)return;this.setBusy(true);
      try{const result=this.game.castSupport(caster,id,target,destination);this.closeOverlay();this.pendingWarp=null;
        for(const tid of result.affected){const t=this.game.getUnit(tid);this.renderer.snapUnit(t);this.renderer.floatText(result.changes.find(c=>c.id===tid)?.amount?'+'+result.changes.find(c=>c.id===tid).amount:s.name,t.x,t.y,'#bcebd7',11);}
        await this.showGrowthResults(result.experience);
        this.resetSelection({silent:true});this.updateAll();this.renderIdleInfo();this.showToast(caster.name+'施放了'+s.name+'，剩余 '+caster.spellUses[id]+' 次。'+(result.resourcePreserved?' 爱笑女孩：未消耗次数。':'')+(result.experience.length?' 经验 +'+result.experience[0].gained:''),'success',2600);
      }catch(e){this.showToast(e.message,'error');}finally{this.setBusy(false);}
    };
  };
  UP.beginWarpTarget=function(caster,id,target){
    const cells=this.game.supportDestinations(caster,id,target);this.pendingWarp={caster,id,target,cells};this.mode='warp';
    this.renderer.setView({mode:'move',selectedId:caster.id,moveTiles:new Set(cells.map(c=>M.Grid.key(c.x,c.y))),attackTiles:new Set(),targetIds:new Set(),path:[]});
    this.dom.contextTitle.textContent='传送 · 选择落点';this.dom.contextText.textContent='点击蓝色空格，将'+target.name+'传送至该格。确认前不会消耗魔法。';
    this.setActions([{label:'取消传送',onClick:()=>{this.pendingWarp=null;this.enterActionMode();}}]);
  };
  const boardClick=UP.onBoardClick,cancel=UP.cancelCurrent;
  UP.onBoardClick=function(event){if(this.mode==='warp'&&this.pendingWarp){const c=this.eventToCell(event),p=this.pendingWarp;if(c&&p.cells.some(t=>t.x===c.x&&t.y===c.y))this.confirmSupport(p.caster,p.id,p.target,c);return;}return boardClick.call(this,event);};
  UP.cancelCurrent=function(){if(this.mode==='warp'&&this.dom.overlayRoot.hidden){this.pendingWarp=null;this.enterActionMode();return;}return cancel.call(this);};
})(window);
