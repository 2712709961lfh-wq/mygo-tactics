/* Contextual battle commands and a compact, three-column character sheet. */
(function (global) {
  'use strict';
  const M = global.MyGO, UP = M.UI.prototype, EP = M.EntryScreen.prototype;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const tabs = [['stats','状态'],['growth','成长率'],['bag','背包配置'],['magic','已学魔法'],['classes','职业目录'],['mastery','职业专精']];
  const icon = e => e.kind === 'unarmed' ? '<span class="sheet-glyph">拳</span>' : e.kind === 'key' ? '<span class="sheet-glyph">⚿</span>' :
    '<img alt="" src="' + (global.MYGO_EQUIPMENT_ICONS?.[e.kind === 'spell' ? 'spell_' + e.id : e.icon] || 'assets/equipment/icons/' + (e.kind === 'spell' ? 'spell_' + e.id : e.icon) + '.png') + '">';
  const uses = (u, e, slot) => e.kind === 'unarmed' ? '∞' : e.kind === 'spell' ? (u.spellUses[e.id] || 0) + ' / ' + e.uses : e.uses != null ? (slot?.uses ?? 0) + ' / ' + e.uses : '—';
  const skill = (name, meta, description, active = true) => '<details class="sheet-skill' + (active ? '' : ' is-locked') + '" name="unit-skill"><summary><span class="skill-seal" aria-hidden="true">◇</span><strong>' + esc(name) + '</strong><small>' + esc(meta) + '</small></summary><p>' + esc(description) + '</p></details>';

  UP.ensureCommands = function () {
    if (this.commandRoot) return this.commandRoot;
    const root = document.getElementById('unit-commands');
    if (!root) return null;
    this.commandRoot = root;
    this.actionPickerCard = document.getElementById('command-picker');
    this.dom.boardViewport.addEventListener('scroll', () => this.positionCommands(), {passive:true});
    root.addEventListener('contextmenu', e => { e.preventDefault(); this.cancelCurrent(); });
    new ResizeObserver(() => this.positionCommands()).observe(root);
    return root;
  };

  UP.positionCommands = function () {
    const root = this.ensureCommands();
    if (!root) return;
    const u = this.game.getUnit(this.activeId);
    // Keep map selection modes clear of command buttons so every visible tile can be clicked.
    const choosingAction = this.mode === 'action';
    const host = choosingAction ? document.getElementById('command-actions') : document.getElementById('info-side');
    if (this.dom.actionButtons.parentElement !== host) host.appendChild(this.dom.actionButtons);
    root.hidden = !u || !choosingAction || this.busy || !this.game.isPlayerPhase();
    if (root.hidden) return;
    root.classList.toggle('has-picker', !this.actionPickerCard.hidden);
    document.getElementById('command-unit-name').textContent = u.shortName || u.name;
    // Use layout coordinates inside the landscape shell, so rotation and scaling
    // affect both the board and menu identically. Scrolling only offsets the anchor.
    const board = this.dom.board, vp = this.dom.boardViewport, frame = vp.parentElement;
    const p = M.MapProjection.project(this.renderer.projection, (u.x + .5) * M.CONFIG.TILE, (u.y + .5) * M.CONFIG.TILE);
    const x = vp.offsetLeft + board.offsetLeft + p.x / this.renderer.logicalWidth * board.offsetWidth - vp.scrollLeft;
    const y = vp.offsetTop + board.offsetTop + p.y / this.renderer.logicalHeight * board.offsetHeight - vp.scrollTop;
    const width = root.offsetWidth, height = root.offsetHeight, gap = 30;
    const top = clamp(y - 38, 10, frame.clientHeight - height - 10);
    const rightFits = x + gap + width <= frame.clientWidth - 10;
    const leftFits = x - gap - width >= 10;
    const blocksTargets = left => this.game.getAttackableEnemies(u).filter(target => {
      const q = M.MapProjection.project(this.renderer.projection,(target.x+.5)*M.CONFIG.TILE,(target.y+.5)*M.CONFIG.TILE);
      const tx = vp.offsetLeft + board.offsetLeft + q.x / this.renderer.logicalWidth * board.offsetWidth - vp.scrollLeft;
      const ty = vp.offsetTop + board.offsetTop + q.y / this.renderer.logicalHeight * board.offsetHeight - vp.scrollTop;
      return tx >= left-18 && tx <= left+width+18 && ty >= top-18 && ty <= top+height+18;
    }).length;
    const right = rightFits && (!leftFits || blocksTargets(x+gap) <= blocksTargets(x-gap-width));
    root.dataset.side = right ? 'right' : 'left';
    root.style.left = clamp(right ? x + gap : x - gap - width, 10, frame.clientWidth - width - 10) + 'px';
    root.style.top = top + 'px';
    root.style.setProperty('--anchor-y', clamp(y - parseFloat(root.style.top), 16, height - 16) + 'px');
  };

  UP.openActionPicker = function (html, back) {
    this.ensureCommands();
    if (!this.dom.overlayRoot.hidden) this.closeOverlay();
    this.pickerBack = typeof back === 'function' ? back : (() => this.closeActionPicker());
    this.dom.actionButtons.hidden = true;
    const card = this.actionPickerCard;
    card.innerHTML = html;
    card.hidden = false;
    card.scrollTop = 0;
    card.querySelectorAll('[data-overlay-close]').forEach(b => b.onclick = () => this.pickerBack());
    this.positionCommands();
    requestAnimationFrame(() => card.querySelector('button:not(:disabled)')?.focus({preventScroll:true}));
    return card;
  };
  UP.closeActionPicker = function () {
    if (!this.actionPickerCard) return;
    this.actionPickerCard.hidden = true;
    this.actionPickerCard.innerHTML = '';
    this.dom.actionButtons.hidden = false;
    this.pickerBack = null;
    this.positionCommands();
  };

  for (const name of ['setView','updateChrome','layoutBoard','beginWarpTarget']) {
    const base = UP[name];
    UP[name] = function (...args) { const result = base.apply(this, args); this.positionCommands(); return result; };
  }
  for (const name of ['enterActionMode','enterAttackMode','resetSelection','revertMove','selectUnit']) {
    const base = UP[name];
    UP[name] = function (...args) { this.closeActionPicker(); const result = base.apply(this, args); this.positionCommands(); return result; };
  }
  const baseCancel = UP.cancelCurrent;
  UP.cancelCurrent = function () {
    if (!this.busy && this.dom.overlayRoot.hidden && this.actionPickerCard && !this.actionPickerCard.hidden) { this.pickerBack(); return; }
    return baseCancel.call(this);
  };
  const baseAction = UP.renderActionSide;
  UP.renderActionSide = function (u) {
    baseAction.call(this, u);
    const buttons = this.dom.actionButtons;
    const attack = buttons.querySelector('.attack');
    if (attack) attack.textContent = '攻击';
    const addCommand = (label, className, onClick, unavailable = '') => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'action-btn ' + className;
      button.textContent = label;
      button.disabled = !!unavailable;
      if (unavailable) button.title = unavailable;
      button.onclick = onClick;
      buttons.appendChild(button);
    };
    addCommand('装备', 'equip-action', () => this.showWeaponChoices(u));
    for (const [healing, label, className] of [[true,'治疗','heal-action'], [false,'辅助魔法','support-action']]) {
      const spells = this.supportSpells(u, healing);
      if (!spells.length) continue;
      const canCast = spells.some(id => this.game.supportTargets(u, id).length);
      addCommand(label, className, () => this.showSupportSpells(u, healing),
        canCast ? '' : '当前没有有效目标或可用次数');
    }
    if (u.classId === 'dancer') {
      addCommand('跳舞', 'dance-action', () => this.chooseMasteryTarget(u, 'dance'),
        M.Mastery.assistTargets(this.game, u, 'dance').length ? '' : '需要相邻且已行动的非舞者同伴');
    }
    const ordered = ['attack','equip-action','heal-action','dance-action','support-action','loadout-action'];
    const rank = b => {
      const index = ordered.findIndex(name => b.classList.contains(name));
      if (index >= 0) return index;
      return /^(待机|撤回移动|取消)$/.test(b.textContent) ? ordered.length + 1 : ordered.length;
    };
    [...buttons.children].sort((a,b) => rank(a) - rank(b)).forEach(b => {
      if (rank(b) < ordered.length) b.insertAdjacentHTML('beforeend','<span class="command-chevron" aria-hidden="true">›</span>');
      buttons.appendChild(b);
    });
    this.positionCommands();
  };

  UP.showWeaponChoices = function (u, targeting = false) {
    if (this.busy || u.acted || !this.game.isPlayerPhase()) return;
    const choices = targeting ? this.game.getAttackOptions(u).map(option => option.id) : M.Inventory.options(u);
    const choiceAttr = targeting ? 'data-attack-choice' : 'data-equip-choice';
    const heading = targeting ? '<h3>攻击 · 选择武器</h3><p class="modal-sub">攻击后装备所用武器。</p>' : '<h3>装备</h3><p class="modal-sub">当前装备：' + esc(u.weapon.name) + '。受击时以装备反击，切换不消耗行动。</p>';
    const rows = choices.map(id => {
      const w = M.Inventory.weapons[id], range = w.kind === 'spell' ? M.Magic.rangeOf(w,u) : w.range;
      const equipped = id === u.equippedWeapon;
      return '<button type="button" class="battle-loadout-row' + (equipped ? ' is-equipped' : '') + '" ' + choiceAttr + '="' + esc(id) + '"><span class="bag-icon">' + icon(w) + '</span><span><strong>' + esc(w.name) + (equipped ? ' · 已装备' : '') + '</strong><small>威力 ' + w.might + ' · 命中 ' + w.hit + ' · 射程 ' + range.join('–') + '</small></span><b>' + uses(u,w,u.inventory.find(i => i.id === id && i.uses > 0)) + '</b></button>';
    });
    const card = this.openActionPicker(heading + '<div class="battle-loadout-list">' + rows.join('') + '</div>' +
      (rows.length ? '' : '<p>当前没有可用的武器或攻击魔法。</p>') + '<button type="button" class="command-back" data-overlay-close>‹ 返回行动</button>');
    card.querySelectorAll('[' + choiceAttr + ']').forEach(button => button.onclick = () => {
      const id = button.getAttribute(choiceAttr);
      if (targeting) { this.enterAttackMode(id); return; }
      try {
        this.game.selectAttack(u, id);
        this.enterActionMode();
      } catch (e) { this.showToast(e.message, 'error'); }
    });
  };

  const baseSheet = EP.renderFormationDetail;
  EP.renderFormationDetail = function () {
    const active = this.loadoutTab || 'stats';
    this.dom.formation.classList.toggle('is-status-sheet', active === 'stats');
    if (active !== 'stats') return baseSheet.call(this);
    const u = this.players().find(u => u.id === this.selectedUnitId);
    if (!u) return baseSheet.call(this);
    const C = M.Combat, map = this.ui.game.map, w = u.weapon;
    const need = M.Growth.required(u.level), p = M.Mastery.progress(u), arts = M.Mastery.availableArts(u);
    const total = C.statTotalOf(u), guard = M.Talents?.guardBonus(u,map) || 0;
    const rows = [['力量',u.str,M.Talents?.strBonus(u,map)||0],['幸运',u.lck,0],['魔力',u.mag,0],['守备',u.def,guard],['技巧',u.dex,M.Talents?.dexBonus(u)||0],['魔防',u.res,guard],['速度',u.spd,0],['移动',u.move,0]];
    const itemRow = (e,slot,equipped=false) => '<div class="sheet-item' + (equipped ? ' is-equipped' : '') + '"><span class="sheet-item-icon">' + icon(e) + '</span><strong>' + esc(e.name) + '</strong><span>' + uses(u,e,slot) + '</span></div>';
    const talentRows = M.Talents.list(u).map(t => skill(t.name,(t.slot === 0 ? '通用' : '个人') + ' · ' + (t.active ? '已觉醒' : 'Lv.' + t.level),t.description,t.active)).join('');
    const equipped = u.masteryEquipped.map(id => { const s = M.Mastery.abilities[id]; return skill(s.name,'已装备',s.description); }).join('');
    this.dom.formationDetail.innerHTML = '<nav class="loadout-tabs" aria-label="角色资料页">' + tabs.map(([id,name]) => '<button type="button" data-loadout-tab="' + id + '" aria-pressed="' + (id === active) + '">' + name + '</button>').join('') + '</nav>' +
      '<div class="status-sheet"><section class="sheet-column sheet-person"><h4>个人情报</h4><h3 class="sheet-name">' + esc(u.name) + '<span>' + esc(u.gender || '') + '</span></h3><div class="sheet-identity"><canvas width="192" height="192" data-sheet-portrait></canvas><dl><div><dt>职业</dt><dd>' + esc(u.className) + '</dd></div><div><dt>等级</dt><dd>Lv. ' + u.level + '</dd></div><div><dt>状态</dt><dd>' + (u.dead ? '撤退' : u.acted ? '已行动' : '可行动') + '</dd></div></dl></div>' +
      '<div class="sheet-hp"><span>HP</span><strong>' + u.hp + '<small> / ' + u.maxHp + '</small></strong><i style="--fill:' + clamp(u.hp / u.maxHp * 100,0,100) + '%"></i></div>' +
      '<div class="sheet-experience"><div><span>EXP</span><b>' + (need ? u.exp + ' / ' + need : 'MAX') + '</b></div><i style="--fill:' + (need ? clamp(u.exp / need * 100,0,100) : 100) + '%"></i></div>' +
      '<h4>能力 <small>总和 ' + total + '</small></h4><div class="sheet-stats">' + rows.map(([name,value,bonus]) => '<div class="sheet-stat"><span>' + name + '</span><i style="--fill:' + clamp((value+bonus)/40*100,0,100) + '%"></i><b>' + value + (bonus ? '<small>+' + bonus + '</small>' : '') + '</b></div>').join('') + '</div>' +
      '<h4>战斗能力</h4><dl class="sheet-derived">' + [['命中',C.hitOf(u)],['必杀',C.critRateOf(u)+'%'],['攻速',C.attackSpeedOf(u,map)],['回避',C.avoidOf(u,map)],['必杀回避',C.critAvoidOf(u)]].map(([n,v]) => '<div><dt>' + n + '</dt><dd>' + v + '</dd></div>').join('') + '</dl></section>' +
      '<section class="sheet-column"><h4>装备</h4>' + itemRow(w,u.inventory.find(i => i.id === u.weaponId && i.uses > 0),true) + (u.equippedAccessory ? itemRow(M.Inventory.item(u.equippedAccessory)) : '<div class="sheet-empty-row">无辅助装备</div>') +
      '<div class="sheet-weapon-values"><span>威力 <b>' + (w.might||0) + '</b></span><span>命中 <b>' + (w.hit||0) + '</b></span><span>重量 <b>' + (w.weight||0) + '</b></span><span>射程 <b>' + w.range.join('–') + '</b></span></div>' +
      '<h4>持有物品 <small>' + u.inventory.length + ' / 5</small></h4><div class="sheet-inventory">' + Array.from({length:5},(_,n) => { const slot=u.inventory[n]; return slot ? itemRow(M.Inventory.item(slot.id),slot) : '<div class="sheet-empty-row">—</div>'; }).join('') + '</div>' +
      '<h4>战技 <small>' + arts.length + '</small></h4>' + (arts.length ? arts.map(a => skill(a.name,a.cost ? '耐久 −' + a.cost : '辅助',a.description)).join('') : '<div class="sheet-empty-row">尚未习得</div>') + '</section>' +
      '<section class="sheet-column"><h4>特技 <small>点击查看详情</small></h4><div class="sheet-skill-list">' + talentRows + '</div><h4>装备技能 <small>' + u.masteryEquipped.length + ' / 5</small></h4>' + (equipped || '<div class="sheet-empty-row">暂无装备技能</div>') +
      '<h4>职业专精</h4><div class="sheet-mastery"><strong>' + esc(u.className) + '</strong><span>' + (p.mastered ? '已专精' : p.xp + ' / ' + p.required) + '</span><i style="--fill:' + clamp(p.xp / p.required * 100,0,100) + '%"></i></div>' + p.rewards.map(r => skill(r.name,'专精奖励 · ' + (r.kind === 'art' ? '战技' : '技能'),r.description,p.mastered)).join('') + '</section></div>';
    this.drawPortrait(this.dom.formationDetail.querySelector('[data-sheet-portrait]'),u,true);
  };
})(window);
