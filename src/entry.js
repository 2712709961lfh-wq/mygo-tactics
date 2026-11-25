/* ============================================================
 * entry.js — 游戏进入页 / 编队界面
 *
 * 依赖：
 *   - MyGO.UI（当前对局、存档管理器）
 *   - MyGO.Assets.drawUnit（用同一套 32px 程序化像素图绘制头像）
 *
 * 设计原则：
 *   - 进入页与战斗页解耦：只覆盖显示层，不创建第二份游戏状态。
 *   - 编队数据直接读取当前 Game 单位，因此读档后等级/血量/存活状态
 *     都会同步显示。
 *   - 不使用外部图片；所有头像都是 Canvas 现场绘制。
 * ============================================================ */
(function (global) {
  'use strict';

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function padNumber(value) {
    return String(value).padStart(2, '0');
  }

  function fullTimeText(iso) {
    if (!iso) return '未知时间';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '未知时间';
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function weaponTypeName(weapon) {
    if (!weapon) return '无武器';
    if (weapon.type === 'sword') return '剑';
    if (weapon.type === 'axe') return '斧';
    if (weapon.type === 'lance') return '枪';
    if (weapon.type === 'bow') return '弓';
    if (weapon.type === 'tome') return '魔法';
    if (weapon.type === 'gauntlet') return '拳套';
    return weapon.type || '武器';
  }

  function damageTypeName(weapon) {
    return weapon && weapon.damageType === 'magic' ? '魔法' : '物理';
  }

  function mainStat(unit) {
    return unit.weapon && unit.weapon.damageType === 'magic' ? unit.mag : unit.str;
  }

  function hideTitle(entry) {
    entry.dom.root.hidden = true;
    if (entry.codex) entry.codex.close();
    entry.closeSavePanel();
    entry.closeFormation();
    document.body.classList.remove('entry-open');
  }

  class EntryScreen {
    constructor(ui) {
      this.ui = ui;
      this.dom = {
        root: document.getElementById('entry-screen'),
        roster: document.getElementById('entry-roster'),
        saveHint: document.getElementById('entry-save-hint'),
        savePanel: document.getElementById('entry-save-panel'),
        saveInfo: document.getElementById('entry-save-info'),
        saveStatus: document.getElementById('entry-save-status'),
        saveCurrent: document.querySelector('[data-save-current]'),
        saveLoad: document.querySelector('[data-save-load]'),
        saveManual: document.querySelector('[data-save-load-manual]'),
        saveDelete: document.querySelector('[data-save-delete]'),
        formation: document.getElementById('formation-screen'),
        formationList: document.getElementById('formation-list'),
        formationDetail: document.getElementById('formation-detail'),
        formationPoseDock: document.getElementById('formation-pose-dock'),
        formationCount: document.getElementById('formation-count'),
        titleBtn: document.getElementById('title-btn')
      };

      this.selectedUnitId = null;
      this.hasStarted = false;
      this.deleteArmed = false;
      this.deleteTimer = null;
      this.savePanelOpen = false;

      if (!this.dom.root) {
        console.warn('[EntryScreen] 未找到 #entry-screen，进入页不会显示。');
        return;
      }

      this.codex = global.MyGO.EquipmentCodex ? new global.MyGO.EquipmentCodex(this) : null;
      this.retreat = global.MyGO.RetreatScreen ? new global.MyGO.RetreatScreen(this) : null;
      this.bind();
      this.renderRosterPreview();
      this.refreshSaveHint();
    }

    /* ------------------------------------------------------------
     * 打开 / 关闭
     * ---------------------------------------------------------- */

    open(options) {
      const opts = options || {};
      if (!opts.force && this.ui.busy) {
        this.ui.showToast('战斗结算中，暂时无法返回标题页。', 'error', 1800);
        return;
      }
      this.retreat?.close();
      this.dom.root.hidden = false;
      this.dom.root.removeAttribute('hidden');
      document.body.classList.add('entry-open');
      this.closeSavePanel();
      this.closeFormation();
      if (this.codex) this.codex.close();
      this.renderRosterPreview();
      this.refreshSaveHint();
      // 让键盘用户可以直接从主菜单开始。
      const first = this.dom.root.querySelector('[data-entry-action]');
      if (first) global.setTimeout(() => first.focus(), 30);
    }

    openRetreat() {
      if (!this.retreat) return this.hideToGame();
      hideTitle(this);
      this.retreat.open();
    }

    hideToGame() {
      hideTitle(this);
      this.retreat?.close();
      this.ui.game.retreat = null;
      this.ui.layoutBoard();

      const game = this.ui.game;
      if (game.isOver()) {
        // loadSnapshot may already be awaiting a recruitment confirmation.
        if(this.ui.dom.overlayRoot.hidden&&!this.ui.chapterOpen&&!this.ui._livehouseEndingCancel)this.ui.endShown = false;
        this.ui.showEndScreen();
        return;
      }
      const returning = this.hasStarted && (game.turn > 1 || game.livingCount('player') < 5);
      this.hasStarted = true;
      this.ui.playChapterIntro(() => {
        // 章节幕间结束后，再把玩家交还给战场。
        this.ui.layoutBoard();
        if (returning) {
          this.ui.showToast('回到战场。', 'info', 1300);
        } else {
          this.ui.showBanner('第 ' + game.turn + ' 回合', '我方行动 · PLAYER PHASE', 1500);
          this.ui.showToast('点击我方单位开始行动。', 'success', 1700);
        }
      });
    }

    /* ------------------------------------------------------------
     * 事件
     * ---------------------------------------------------------- */

    bind() {
      this.dom.root.addEventListener('click', (event) => {
        const target = event.target;
        if (!target || typeof target.closest !== 'function') return;

        const action = target.closest('[data-entry-action]');
        if (action) {
          const name = action.getAttribute('data-entry-action');
          if (name === 'start') this.openRetreat();
          if(name==='chapter12'){this.ui.chapterPlayed=false;this.ui.newGame(Date.now(),13);this.hasStarted=true;this.hideToGame();}
          if(name==='chapter11'){
            this.ui.chapterPlayed=false;this.ui.newGame(Date.now(),12);this.hasStarted=true;this.hideToGame();
          }
          if(name==='chapter10'){
            this.ui.chapterPlayed=false;this.ui.newGame(Date.now(),11);this.hasStarted=true;this.hideToGame();
          }
          if (name === 'chapter2' || name === 'chapter3' || name === 'chapter4' || name === 'chapter5' || name === 'chapter6' || name === 'chapter7' || name === 'chapter8' || name === 'chapter9') {
            this.ui.chapterPlayed = false;
            this.ui.newGame(Date.now(), Number(name.slice(7)));
            this.hasStarted = true;
            this.hideToGame();
          }
          if (name === 'save') this.openSavePanel();
          if (name === 'formation') this.openFormation();
          if (name === 'equipment' && this.codex) this.codex.open();
          return;
        }

        if (target.closest('[data-save-close]')) {
          this.closeSavePanel();
          return;
        }
        if (target.closest('[data-save-current]')) {
          this.saveCurrent();
          return;
        }
        if (target.closest('[data-save-load]')) {
          this.loadSave();
          return;
        }
        if (target.closest('[data-save-load-manual]')) {
          this.loadSave('manual');
          return;
        }
        if (target.closest('[data-save-delete]')) {
          this.deleteSave();
        }
      });

      this.dom.savePanel.addEventListener('click', (event) => {
        if (event.target === this.dom.savePanel) this.closeSavePanel();
      });

      // 编队列表使用事件委托，避免每次选择都重新绑定。
      this.dom.formationList.addEventListener('click', (event) => {
        const target = event.target;
        if (!target || typeof target.closest !== 'function') return;
        const row = target.closest('[data-formation-unit]');
        if (!row) return;
        this.selectedUnitId = row.getAttribute('data-formation-unit');
        this.renderFormationList();
        this.renderFormationDetail();
      });

      const closeFormation = this.dom.formation.querySelector('[data-formation-close]');
      if (closeFormation) closeFormation.addEventListener('click', () => this.closeFormation());

      // 点羊皮纸外面也能关闭编队。
      this.dom.formation.addEventListener('click', (event) => {
        if (event.target === this.dom.formation) this.closeFormation();
      });

      if (this.dom.titleBtn) {
        this.dom.titleBtn.addEventListener('click', () => {
          if(this.ui.game.isTraining)return this.ui.askLeaveTraining();
          const overlayOpen = !this.ui.dom.overlayRoot.hidden;
          if (this.ui.busy || overlayOpen || this.ui.mode !== 'idle') {
            this.ui.showToast('请先结束当前行动，再返回标题页。', 'error', 1900);
            return;
          }
          this.open();
        });
      }

      const equipmentBtn = document.getElementById('equipment-btn');
      if (equipmentBtn) equipmentBtn.addEventListener('click', () => {
        if (this.ui.busy || this.ui.chapterOpen || !this.ui.dom.overlayRoot.hidden) {
          this.ui.showToast('请先结束当前演出或关闭弹窗，再查看图鉴。', 'info', 1800);
          return;
        }
        if (this.codex) this.codex.open();
      });

      // 捕获阶段拦截，避免 UI 的全局 E / Esc 快捷键在标题页里误触。
      document.addEventListener('keydown', (event) => this.onKeyDown(event), true);
    }

    onKeyDown(event) {
      if (this.codex && !this.codex.root.hidden) {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          this.codex.close();
        }
        return;
      }
      const inRetreat = this.retreat?.root.hidden === false;
      if (this.dom.root.hidden && !inRetreat) return;
      if(inRetreat && this.retreat.training?.onKeyDown(event)) return;

      if (!this.dom.formation.hidden) {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          this.closeFormation();
          return;
        }
        if (inRetreat) return;
      }

      if (this.savePanelOpen && event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        this.closeSavePanel();
        return;
      }

      if (event.key === 'Escape') {
        // 标题页是根界面，不允许 Esc 意外穿透到战棋操作。
        event.preventDefault();
        event.stopPropagation();
        if (inRetreat) this.open();
        return;
      }

      if (inRetreat) {
        this.retreat.onKeyDown(event);
        return;
      }

      // 战斗中 E 会结束回合；标题页/编队页/存档面板中一律屏蔽。
      if (event.key === 'e' || event.key === 'E') {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    /* ------------------------------------------------------------
     * 存档
     * ---------------------------------------------------------- */

    getSaveInfo(slot) {
      const loaded = this.ui.saveManager.load(slot);
      if (!loaded.ok) return { ok: false, loaded: null };
      return { ok: true, loaded };
    }

    refreshSaveHint() {
      const info = this.getSaveInfo();
      if (this.dom.saveHint) {
        this.dom.saveHint.textContent = info.ok
          ? '上次存档 · ' + (info.loaded.snapshot.training ? '训练之塔' : info.loaded.snapshot.retreat ? '休憩之地' : '第 ' + info.loaded.snapshot.turn + ' 回合') + ' · ' + fullTimeText(info.loaded.savedAt)
          : '暂无本地存档 · 开始一局后可保存';
      }
    }

    openSavePanel() {
      this.savePanelOpen = true;
      this.deleteArmed = false;
      this.dom.savePanel.hidden = false;
      this.refreshSavePanel();
      if (this.dom.saveStatus) this.dom.saveStatus.textContent = '';
      if (this.dom.saveLoad) this.dom.saveLoad.focus();
    }

    closeSavePanel() {
      this.savePanelOpen = false;
      this.dom.savePanel.hidden = true;
      this.deleteArmed = false;
      if (this.deleteTimer) {
        clearTimeout(this.deleteTimer);
        this.deleteTimer = null;
      }
      this.resetDeleteButton();
    }

    refreshSavePanel() {
      const info = this.getSaveInfo();
      const game = this.ui.game;
      const canSave = (game.isPlayerPhase() || game.phase === 'victory') && !this.ui.busy && this.ui.mode === 'idle';

      if (info.ok) {
        const loaded = info.loaded;
        const rawSnapshot=loaded.snapshot;
        const snapshot=rawSnapshot.schoolChapterVersion===1?{...rawSnapshot,stage:13}:rawSnapshot.royalGardenChapterVersion===1?{...rawSnapshot,stage:12}:rawSnapshot.palaceChapterVersion===1?{...rawSnapshot,stage:11}:rawSnapshot.stage===9&&rawSnapshot.rehearsalPart===2?{...rawSnapshot,stage:10}:rawSnapshot;
        // 快照只保存会变化的数据（id/x/y/hp/acted/dead），阵营要从模板反查。
        const savedMission = snapshot.stage===13?MyGO.CONFIG.STAGE_SCHOOL:snapshot.stage===12?MyGO.CONFIG.STAGE_ROYAL_GARDEN:snapshot.stage===11?MyGO.CONFIG.STAGE_PALACE:snapshot.stage===10?MyGO.CONFIG.STAGE_TEN:snapshot.stage===9?MyGO.CONFIG.STAGE_NINE:snapshot.stage===8?MyGO.CONFIG.STAGE_EIGHT:snapshot.stage===7?MyGO.CONFIG.STAGE_SEVEN:snapshot.stage===6?MyGO.CONFIG.STAGE_SIX:snapshot.stage===5?MyGO.CONFIG.STAGE_FIVE:snapshot.stage===4?MyGO.CONFIG.STAGE_FOUR:snapshot.stage === 3 ? MyGO.CONFIG.STAGE_THREE : snapshot.stage === 2 ? MyGO.CONFIG.STAGE_TWO : MyGO.CONFIG.MISSION;
        const templates = MyGO.CONFIG.UNITS.concat(snapshot.stage===13?MyGO.CONFIG.STAGE_SCHOOL.enemies.concat((snapshot.units||[]).filter(u=>/^school-wave-/.test(u.id)).map(u=>MyGO.CONFIG.STAGE_SCHOOL.templateForId(u.id)).filter(Boolean),[MyGO.CONFIG.NINA,{...MyGO.CONFIG.NIJIKA,side:'player'},{...MyGO.CONFIG.SUBARU,side:'player'}]):snapshot.stage===12?MyGO.CONFIG.STAGE_ROYAL_GARDEN.enemies.concat([MyGO.CONFIG.NINA,{...MyGO.CONFIG.NIJIKA,side:'player'},{...MyGO.CONFIG.SUBARU,side:'player'}]):snapshot.stage===11?MyGO.CONFIG.STAGE_PALACE.enemies.concat([MyGO.CONFIG.NINA,{...MyGO.CONFIG.NIJIKA,side:'player'},{...MyGO.CONFIG.SUBARU,side:'player'}]):snapshot.stage===10?MyGO.CONFIG.STAGE_TEN.enemies.concat([MyGO.CONFIG.NINA,{...MyGO.CONFIG.NIJIKA,side:'player'},{...MyGO.CONFIG.SUBARU,side:snapshot.subaruJoined?'player':'ally'}]):snapshot.stage===9?MyGO.CONFIG.STAGE_NINE.enemies.concat([MyGO.CONFIG.NINA,{...MyGO.CONFIG.NIJIKA,side:'player'}]):snapshot.stage===8?MyGO.CONFIG.STAGE_EIGHT.enemies.concat([MyGO.CONFIG.NINA,{...MyGO.CONFIG.NIJIKA,side:'player'}]):snapshot.stage===7?MyGO.CONFIG.STAGE_SEVEN.enemies.concat([MyGO.CONFIG.NINA,{...MyGO.CONFIG.NIJIKA,side:snapshot.nijikaJoined?'player':'ally'}]):snapshot.stage===6?MyGO.CONFIG.STAGE_SIX.enemies.concat(MyGO.CONFIG.STAGE_SIX.summonTemplates,[MyGO.CONFIG.NINA]):snapshot.stage===5?MyGO.CONFIG.STAGE_FIVE.enemies.concat([MyGO.CONFIG.NINA]):snapshot.stage===4?MyGO.CONFIG.STAGE_FOUR.enemies.concat([MyGO.CONFIG.NINA]):snapshot.stage===3?MyGO.CONFIG.STAGE_THREE.enemies.concat([MyGO.CONFIG.NINA]):[]);
        const sideById = new Map(templates.map((unit) => [unit.id, unit.side]));
        if (snapshot.stage >= 2 && (snapshot.recruited || []).includes('xueyue')) sideById.set('xueyue', 'player');
        if (snapshot.stage>=3 && !snapshot.ninaLost && (snapshot.recruited || []).includes('nina')) sideById.set('nina','player');
        const mine = (snapshot.units || []).filter((u) => sideById.get(u.id) === 'player' && !u.dead).length;
        const foes = (snapshot.units || []).filter((u) => sideById.get(u.id) === 'enemy' && !u.dead && !(snapshot.stage===6&&snapshot.maskEscaped&&u.id==='masked_stranger')).length;
        const storage = this.ui.saveManager.storageType === 'memory' ? '内存（本标签页有效）' : '浏览器本地';
        this.dom.saveInfo.innerHTML = [
          '<div class="entry-save-slot">',
          '  <div class="entry-save-slot-mark">' + esc(savedMission.chapter) + '</div>',
          '  <strong>' + esc(snapshot.training?'训练之塔':savedMission.title) + '</strong>',
          '  <span>' + (snapshot.training ? '训练第 '+esc(snapshot.training.turn)+' 回合' : snapshot.retreat ? '休憩之地 · 我方 ' + mine : ([9,10].includes(snapshot.stage)?(snapshot.stage===10?'后半段 · ':'前半段 · '):'')+'第 ' + esc(snapshot.turn) + ' 回合 · 我方 ' + mine + ' / 敌方 ' + foes) + '</span>',
          '  <small>' + esc(fullTimeText(loaded.savedAt)) + ' · ' + esc(storage) + (loaded.slot==='automatic'?' · 自动存档':'') + '</small>',
          '</div>'
        ].join('');
        this.dom.saveLoad.disabled = false;
        this.dom.saveDelete.disabled = false;
      } else {
        this.dom.saveInfo.innerHTML = [
          '<div class="entry-save-empty">',
          '  <span>NO DATA</span>',
          '  <strong>还没有战斗记录</strong>',
          '  <p>开始游戏后，在我方自由行动时保存一次。</p>',
          '</div>'
        ].join('');
        this.dom.saveLoad.disabled = true;
        this.dom.saveDelete.disabled = true;
      }

      if(this.dom.saveManual)this.dom.saveManual.hidden=!(info.loaded?.slot==='automatic'&&this.getSaveInfo('manual').ok);

      this.dom.saveCurrent.disabled = !canSave;
      this.dom.saveCurrent.title = canSave ? '保存当前战场进度' : '只能在无单位行动时保存';
      if (this.dom.saveStatus && !this.dom.saveStatus.textContent) {
        this.dom.saveStatus.textContent = canSave ? '' : '当前无法保存：请先完成当前单位的行动。';
      }
    }

    saveCurrent() {
      const game = this.ui.game;
      if (this.ui.busy || (!game.isPlayerPhase() && game.phase !== 'victory') || this.ui.mode !== 'idle') {
        this.setSaveStatus('现在无法保存：请结束当前单位的行动。', 'warn');
        return;
      }
      const result = this.ui.saveManager.save(game);
      if (!result.ok) {
        this.setSaveStatus(result.message || '保存失败。', 'error');
        return;
      }
      this.ui.lastSaveAt = new Date(result.savedAt).toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit'
      });
      if (typeof this.ui.updateSaveNote === 'function') this.ui.updateSaveNote();
      this.deleteArmed = false;
      this.refreshSaveHint();
      this.refreshSavePanel();
      this.setSaveStatus('已保存当前进度。', 'success');
    }

    loadSave(slot) {
      const info = this.getSaveInfo(slot);
      if (!info.ok) {
        this.setSaveStatus('没有可读取的存档。', 'warn');
        return;
      }
      try {
        const applied = this.ui.loadSnapshot(info.loaded);
        if (this.retreat?.root.hidden !== false) this.hideToGame();
        if (applied) {
          this.refreshSaveHint();
          this.ui.showToast('已读取存档 · 第 ' + this.ui.game.turn + ' 回合。', 'success', 1800);
        }
      } catch (err) {
        console.error(err);
        this.setSaveStatus('读档失败：' + err.message, 'error');
      }
    }

    deleteSave() {
      if (!this.deleteArmed) {
        this.deleteArmed = true;
        this.dom.saveDelete.textContent = '再按一次确认删除';
        this.dom.saveDelete.classList.add('is-armed');
        this.setSaveStatus('手动存档和自动存档都会删除，请再按一次确认。', 'warn');
        if (this.deleteTimer) clearTimeout(this.deleteTimer);
        this.deleteTimer = global.setTimeout(() => {
          this.deleteArmed = false;
          this.resetDeleteButton();
        }, 3200);
        return;
      }

      const result = this.ui.saveManager.delete();
      this.deleteArmed = false;
      this.resetDeleteButton();
      this.refreshSaveHint();
      this.refreshSavePanel();
      this.setSaveStatus(result.ok ? '存档已删除。' : (result.message || '删除失败。'), result.ok ? 'success' : 'error');
    }

    resetDeleteButton() {
      if (!this.dom.saveDelete) return;
      this.dom.saveDelete.textContent = '删除存档';
      this.dom.saveDelete.classList.remove('is-armed');
    }

    setSaveStatus(text, type) {
      if (!this.dom.saveStatus) return;
      this.dom.saveStatus.textContent = text;
      this.dom.saveStatus.setAttribute('data-type', type || 'info');
    }

    /* ------------------------------------------------------------
     * 编队
     * ---------------------------------------------------------- */

    players() {
      return this.ui.game.units.filter((unit) => unit.side === 'player');
    }

    openFormation(tab) {
      this.closeSavePanel();
      if (tab) this.loadoutTab = tab;
      this.dom.formation.hidden = false;
      this.dom.formation.removeAttribute('hidden');
      const players = this.players();
      this.dom.formationCount.textContent = players.filter((unit) => !unit.dead).length + ' / ' + players.length;
      if (!this.selectedUnitId || !players.some((unit) => unit.id === this.selectedUnitId)) {
        this.selectedUnitId = players[0] ? players[0].id : null;
      }
      this.renderFormationList();
      this.renderFormationDetail();
      if (this.retreat?.root.hidden === false) {
        const close = this.dom.formation.querySelector('[data-formation-close]');
        close.firstChild.textContent = '返回休憩之地 ';
        close.focus();
      }
    }

    closeFormation() {
      const wasOpen = !this.dom.formation.hidden;
      this.dom.formation.hidden = true;
      if (this.retreat && wasOpen) {
        this.dom.formation.querySelector('[data-formation-close]').firstChild.textContent = '返回标题 ';
        this.retreat.resume();
      }
    }

    renderFormationList() {
      const players = this.players();
      this.dom.formationList.innerHTML = players.map((unit, index) => {
        const selected = unit.id === this.selectedUnitId;
        const status = unit.dead ? '撤退' : '出击';
        return [
          '<button class="formation-row' + (selected ? ' is-selected' : '') + '" type="button"',
          '  data-formation-unit="' + esc(unit.id) + '" aria-pressed="' + (selected ? 'true' : 'false') + '">',
          '  <span class="formation-row-index">' + padNumber(index + 1) + '</span>',
          '  <span class="formation-avatar"><canvas width="72" height="72" data-roster-portrait="' + esc(unit.id) + '"></canvas></span>',
          '  <span class="formation-row-copy">',
          '    <strong>' + esc(unit.name) + '</strong>',
          '    <small>' + esc(unit.className) + ' · ' + esc(weaponTypeName(unit.weapon)) + '</small>',
          '  </span>',
          '  <span class="formation-row-move"><b>' + unit.move + '</b><small>MOVE</small></span>',
          '  <span class="formation-status' + (unit.dead ? ' is-down' : '') + '">' + (unit.dead ? '撤退' : '出击') + '</span>',
          '</button>'
        ].join('');
      }).join('');

      players.forEach((unit) => {
        const canvas = this.dom.formationList.querySelector('[data-roster-portrait="' + unit.id + '"]');
        if (canvas) this.drawPortrait(canvas, unit, true);
      });
    }

    renderFormationDetail() {
      const unit = this.players().find((item) => item.id === this.selectedUnitId);
      if (!unit) {
        this.dom.formationDetail.innerHTML = '<div class="formation-empty">没有可显示的单位。</div>';
        return;
      }

      const weapon = unit.weapon || {};
      const isMagic = weapon.damageType === 'magic';
      const element = weapon.elementName
        ? '<span class="formation-tag element">' + esc(weapon.elementName) + '属性</span>'
        : '';
      const range = Array.isArray(weapon.range) ? weapon.range.join('–') : '1';
      const statItems = [
        { key: 'hp', label: 'HP', value: unit.hp + '<small>/' + unit.maxHp + '</small>', hint: '生命值' },
        { key: 'str', label: '力量', value: unit.str+((MyGO.Talents?.strBonus(unit,this.ui.game.map)||0)?'<small>+'+MyGO.Talents.strBonus(unit,this.ui.game.map)+' '+(unit.id==='xueyue'?'剑意':'护灯')+'</small>':''), hint: '物理攻击' },
        { key: 'mag', label: '魔力', value: unit.mag, hint: '魔法攻击' },
        { key: 'spd', label: '速度', value: unit.spd, hint: '影响回避' },
        { key: 'def', label: '守备', value: (unit.def+(MyGO.Talents?.defBonus(unit)||0))+((MyGO.Talents?.guardBonus(unit,this.ui.game.map)||0)?'<small>+'+(MyGO.Talents?.guardBonus(unit,this.ui.game.map)||0)+' 守护</small>':''), hint: '物理减伤' },
        { key: 'res', label: '魔防', value: unit.res+((MyGO.Talents?.guardBonus(unit,this.ui.game.map)||0)?'<small>+'+(MyGO.Talents?.guardBonus(unit,this.ui.game.map)||0)+' 守护</small>':''), hint: '魔法减伤' },
        { key: 'dex', label: '技巧', value: unit.dex, hint: '影响命中与暴击率' },
        { key: 'lck', label: '幸运', value: unit.lck, hint: '暴击与必杀回避' },
        { key: 'move', label: '移动', value: unit.move, hint: '行动距离' }
      ];
      const activeStat = isMagic ? 'mag' : 'str';

      this.dom.formationDetail.innerHTML = [
        '<div class="formation-detail-top">',
        '  <div class="formation-hero-card">',
        '    <div class="formation-portrait-frame">',
        '      <canvas width="192" height="192" data-detail-portrait></canvas>',
        '      <span class="formation-level">Lv.' + unit.level + '</span>',
        '    </div>',
        '    <div class="formation-identity">',
        '      <div class="formation-unit-kicker">MYGO!!!!! / PLAYER UNIT</div>',
        '      <h3>' + esc(unit.name) + '</h3>',
        '      <p class="formation-classline">' + esc(unit.className) + ' <span>·</span> ' + esc(unit.gender || '—') + '</p>',
        '      <blockquote>“' + esc(unit.quote || '') + '”</blockquote>',
        '      <div class="formation-tags">',
        '        <span class="formation-tag">' + esc(weaponTypeName(weapon)) + '</span>',
        '        <span class="formation-tag">' + esc(damageTypeName(weapon)) + '</span>',
        '        <span class="formation-tag">射程 ' + esc(range) + '</span>',
        element,
        '        <span class="formation-total" title="HP上限＋力量＋魔力＋技巧＋速度＋幸运＋守备＋魔防＋移动；不含等级、命中率及武器/地形加成">属性总和 <b>' + MyGO.Combat.statTotalOf(unit) + '</b></span>',
        '      </div>',
        '    </div>',
        '  </div>',
        '</div>',
        '<p class="soul-fragment"><strong>未说出口的话</strong><br>' + esc(MyGO.CONFIG.CHARACTER_STORIES[unit.id] || '') + '</p>',
        '<div class="formation-stat-grid">',
        statItems.map((item) => [
          '<div class="formation-stat' + (item.key === activeStat ? ' is-primary' : '') + '">',
          '  <span>' + item.label + '</span>',
          '  <strong>' + item.value + '</strong>',
          '  <small>' + item.hint + '</small>',
          '</div>'
        ].join('')).join(''),
        '</div>',
        '<div class="formation-derived">命中率 <b>' + MyGO.Combat.hitOf(unit) + '</b> · 基础暴击率 <b>' + MyGO.Combat.critRateOf(unit) + '%</b> · 必杀回避 <b>' + MyGO.Combat.critAvoidOf(unit) + '</b><span>属性总和按九项基础能力相加，HP取上限，包含移动。</span></div>',
        '<div class="formation-info-grid">',
        '  <div class="formation-info-card">',
        '    <div class="formation-info-title">UNIT DATA <span>基本资料</span></div>',
        '    <dl>',
        '      <div><dt>姓名</dt><dd>' + esc(unit.name) + '</dd></div>',
        '      <div><dt>职业</dt><dd>' + esc(unit.className) + '</dd></div>',
        '      <div><dt>武器</dt><dd>' + esc(weapon.name || '—') + '</dd></div>',
        '      <div><dt>性别</dt><dd>' + esc(unit.gender || '—') + '</dd></div>',
        '      <div><dt>行动距离</dt><dd class="is-accent">' + unit.move + ' 格</dd></div>',
        '      <div><dt>等级</dt><dd>Lv.' + unit.level + '</dd></div>',
        '    </dl>',
        '  </div>',
        '  <div class="formation-info-card formation-weapon-card">',
        '    <div class="formation-info-title">WEAPON <span>武器参数</span></div>',
        '    <div class="formation-weapon-head">',
        '      <span class="formation-weapon-icon">' + esc(weaponTypeName(weapon)) + '</span>',
        '      <div><strong>' + esc(weapon.name || '—') + '</strong><small>' + esc(damageTypeName(weapon)) + (weapon.elementName ? ' · ' + esc(weapon.elementName) : '') + '</small></div>',
        '    </div>',
        '    <div class="formation-weapon-stats">',
        '      <span><b>' + (weapon.might || 0) + '</b>威力</span>',
        '      <span><b>' + (weapon.hit || 0) + '</b>命中</span>',
        '      <span><b>' + (weapon.crit || 0) + '</b>暴击</span>',
        '      <span><b>' + esc(range) + '</b>射程</span>',
        '    </div>',
        '    <p class="formation-weapon-note">' + (isMagic
          ? '角色已学魔法读取魔力，并以目标魔防减伤；不占背包格数。'
          : '物理武器读取力量，并以目标守备减伤；山地会额外提供守备。') + '</p>',
        '  </div>',
        '</div>',
        '<div class="formation-detail-foot">',
        '  <span class="formation-foot-mark">✦</span>',
        '  <p>本页数据直接来自当前对局，可在战斗中通过「标题 → 同行之人」再次查看。</p>',
        '  <span class="formation-power">主要攻击属性 <b>' + (isMagic ? '魔力 ' + unit.mag : '力量 ' + MyGO.Combat.strOf(unit,this.ui?.game?.map)) + '</b></span>',
        '</div>'
      ].join('');

      const detailCanvas = this.dom.formationDetail.querySelector('[data-detail-portrait]');
      if (detailCanvas) this.drawPortrait(detailCanvas, unit);
      this.renderPoseDock(unit);
    }

    renderPoseDock(unit) {
      const dock = this.dom.formationPoseDock;
      if (!dock) return;
      const states = [
        ['idle', '待机'],
        ['attack', '攻击'],
        ['hurt', '受伤'],
        ['down', '倒地']
      ];
      dock.innerHTML = [
        '<div class="formation-dock-head">BATTLE POSE <span>战斗姿态</span></div>',
        '<div class="formation-poses">',
        states.map(([state, label]) => [
          '<figure class="formation-pose">',
          '  <canvas width="104" height="104" data-pose="' + state + '"></canvas>',
          '  <figcaption>' + label + '</figcaption>',
          '</figure>'
        ].join('')).join(''),
        '</div>'
      ].join('');

      if (!MyGO.Characters) return;
      dock.querySelectorAll('[data-pose]').forEach((canvas) => {
        const state = canvas.dataset.pose;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        MyGO.Characters.drawPose(ctx, unit.id, 0, 0, canvas.width, canvas.height - 6, state, 0);
      });
    }

    /* ------------------------------------------------------------
     * 缩略图
     * ---------------------------------------------------------- */

    drawPortrait(canvas, unit, head) {
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const size = canvas.width;
      ctx.clearRect(0, 0, size, size);
      ctx.imageSmoothingEnabled = false;
      const drawn = MyGO.Characters && MyGO.Characters.drawPortrait(ctx, unit.id, 0, 0, size, size, { head: !!head });
      if (!drawn) {
        MyGO.Assets.drawUnit(ctx, unit, 0, 0, size, {
          portrait: true,
          noFlip: true,
          static: true
        });
      }
    }

    renderRosterPreview() {
      if (!this.dom.roster) return;
      const players = this.players();
      this.dom.roster.innerHTML = players.map((unit) => {
        return [
          '<span class="entry-roster-unit" title="' + esc(unit.name + ' · ' + unit.className) + '">',
          '  <canvas width="52" height="52" data-entry-portrait="' + esc(unit.id) + '"></canvas>',
          '  <small>' + esc(unit.shortName || unit.name) + '</small>',
          '</span>'
        ].join('');
      }).join('');
      players.forEach((unit) => {
        const canvas = this.dom.roster.querySelector('[data-entry-portrait="' + unit.id + '"]');
        if (canvas) this.drawPortrait(canvas, unit, true);
      });
    }
  }

  global.MyGO.EntryScreen = EntryScreen;

  /**
   * 兜底启动：如果页面被浏览器缓存、main.js 仍是旧版本，
   * 只要 UI 已创建，就由 entry.js 自己接管标题页初始化。
   * 正常情况下 main.js 会先创建，MYGO_ENTRY 存在时这里直接跳过。
   */
  function bootEntryOnce() {
    if (!global.MYGO_UI || global.MYGO_ENTRY) return;
    const params = new URLSearchParams(global.location.search);
    if (params.get('battle-demo')) return;
    const entry = new EntryScreen(global.MYGO_UI);
    global.MYGO_ENTRY = entry;
    global.MyGO.entry = entry;
    entry.open({ force: true });
  }

  if (document.readyState === 'loading') {
    global.addEventListener('load', bootEntryOnce, { once: true });
  } else {
    global.setTimeout(bootEntryOnce, 0);
  }
})(window);
