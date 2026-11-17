/* ============================================================
 * ui.js — 界面状态机、玩家操作、战斗演出与敌方回合调度
 *
 * 分层约定：
 *   Game      只管规则与数据，不碰 DOM；
 *   Renderer  只管把 Game 画出来，不处理点击；
 *   UI        负责“选择 → 移动 → 行动 → 结算”的流程和 DOM。
 *
 * 重要规则：攻击的随机结果在特写播放前就已掷出，但 HP 只在
 * 玩家点击结算弹窗的“确认结算”后才真正扣除。
 * ============================================================ */
(function (global) {
  'use strict';

  const MyGO = (global.MyGO = global.MyGO || {});
  const C = MyGO.CONFIG;
  const Grid = MyGO.Grid;
  const Pathfinding = MyGO.Pathfinding;
  const Combat = MyGO.Combat;

  const WEAPON_GLYPH = {
    gauntlet:'拳',
    sword: '剑',
    lance: '枪',
    axe: '斧',
    bow: '弓',
    tome: '魔'
  };

  const WEAPON_NAME = {
    gauntlet:'拳套',
    sword: '剑',
    lance: '枪',
    axe: '斧',
    bow: '弓',
    tome: '魔法'
  };

  const DELAY = 180;

  function columnLabel(x) {
    let n=x+1, text='';
    while(n>0) { n--;text=String.fromCharCode(65+n%26)+text;n=Math.floor(n/26); }
    return text;
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function pct(value) {
    return Math.max(0, Math.min(100, Math.round(value * 100)));
  }

  function timeText(iso) {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }

  class UI {
    constructor(options) {
      const opts = options || {};
      this.seed = opts.seed;
      this.initialStage = [2,3,4,5,6,7,8,9,10,11].includes(opts.stage) ? opts.stage : 1;
      this.dom = {
        partyList: document.getElementById('party-list'),
        tacticalHint: document.getElementById('tactical-hint'),
        gridBtn: document.getElementById('grid-btn'),
        fullscreenBtn: document.getElementById('fullscreen-btn'),
        missionChapter: document.getElementById('mission-chapter'),
        missionTitle: document.getElementById('mission-title'),
        missionSub: document.getElementById('mission-sub'),
        phaseBlock: document.getElementById('phase-block'),
        phaseLabel: document.getElementById('phase-label'),
        turnLabel: document.getElementById('turn-label'),
        saveBtn: document.getElementById('save-btn'),
        loadBtn: document.getElementById('load-btn'),
        helpBtn: document.getElementById('help-btn'),
        restartBtn: document.getElementById('restart-btn'),
        turnNumber: document.getElementById('turn-number'),
        phaseKicker: document.getElementById('phase-kicker'),
        turnTitle: document.getElementById('turn-title'),
        playerCount: document.getElementById('player-count'),
        enemyCount: document.getElementById('enemy-count'),
        saveNote: document.getElementById('save-note'),
        endTurnBtn: document.getElementById('end-turn-btn'),
        board: document.getElementById('board'),
        boardViewport: document.getElementById('board-viewport'),
        zoomOutBtn: document.getElementById('zoom-out'),
        zoomInBtn: document.getElementById('zoom-in'),
        zoomResetBtn: document.getElementById('zoom-reset'),
        zoomLevel: document.getElementById('zoom-level'),
        turnBanner: document.getElementById('turn-banner'),
        bannerTitle: document.getElementById('banner-title'),
        bannerSub: document.getElementById('banner-sub'),
        toast: document.getElementById('toast'),
        objectiveText: document.getElementById('objective-text'),
        portraitBlock: document.getElementById('portrait-block'),
        infoPortrait: document.getElementById('info-portrait'),
        portraitBadge: document.getElementById('portrait-badge'),
        portraitLevel: document.getElementById('portrait-level'),
        infoName: document.getElementById('info-name'),
        infoTags: document.getElementById('info-tags'),
        infoBody: document.getElementById('info-body'),
        contextTitle: document.getElementById('context-title'),
        contextText: document.getElementById('context-text'),
        actionButtons: document.getElementById('action-buttons'),
        overlayRoot: document.getElementById('overlay-root'),
        overlayCard: document.getElementById('overlay-card'),
        chapterIntro: document.getElementById('chapter-intro'),
        cutin: document.getElementById('battle-scene'),
        screenFlash: document.getElementById('screen-flash')
      };

      this.game = new MyGO.Game({ seed: this.seed, stage: this.initialStage });
      this.renderer = new MyGO.Renderer(this.dom.board, this.game);
      this.battle = new MyGO.BattleScene(this.dom.cutin);
      this.saveManager = new MyGO.SaveManager();

      this.mode = 'idle'; // idle | move | action | attack | moving
      this.activeId = null;
      this.inspectedId = null;
      this.origin = null;
      this.moved = false;
      this.reachable = null;
      this.moveTiles = new Set();
      this.attackTiles = new Set();
      this.enemyThreatId = null;
      this.enemyThreatTiles = new Set();
      this.targetIds = new Set();
      this.actionTargets = [];
      this.previewPath = [];
      this.hoverKey = null;
      this.hoveredTargetId = null;
      this.busy = false;
      this.endShown = false;
      this.modalDismissible = false;
      this.confirmHandler = null;
      this.bannerTimer = null;
      this.toastTimer = null;
      this.autoEndTurnTimer = null;
      this.cutinTimer = null;
      this.cutinSkip = null;
      this.lastSaveAt = null;
      this.zoom = 1;
      this.zoomMin = 1;
      this.zoomMax = 2.2;
      this.zoomStep = 0.15;
      this.chapterOpen = false;
      this.chapterPlayed = false;
      this.chapterDone = null;
      this.chapterTimers = [];

      this.bindEvents();
      this.start();
    }

    /* ============================================================
     * 启动与基础界面
     * ============================================================ */

    start() {
      const mission = this.game.mission;
      this.dom.missionChapter.textContent = mission.chapter;
      this.dom.missionTitle.textContent = mission.title;
      this.dom.missionSub.textContent = mission.subtitle;
      this.dom.objectiveText.textContent = mission.objective;
      if(this.game.stage===11)this.dom.objectiveText.textContent='击败精英战马骑士 · '+(this.game.getUnit('gilded_cavalier')?.dead?'已击败':'北端王座厅')+' · 敌军剩余 '+this.game.livingCount('enemy')+' 名';
      if(this.game.stage===10)this.dom.objectiveText.textContent='后半段 · 全歼敌军 · 剩余 '+this.game.livingCount('enemy')+' / '+this.game.mission.enemyCount+' 名'+(this.game.subaruJoined?' · 昴已入队':' · 与昴会合');
      if(this.game.stage===9)this.dom.objectiveText.textContent=this.game.gateOpen?'正在进入本关后半段':this.game.getUnit('rift_pegasus')?.dead?'前半段 · Boss 已击败 · 到北端门旁使用钥匙':'前半段 · 击败裂空天马 → 取得钥匙 → 开门';
      if(this.game.stage===8)this.dom.objectiveText.textContent='击败幻影 · '+this.game.mission.phantomIds.filter(id=>this.game.getUnit(id)?.dead).length+'/2 · 宝箱 '+this.game.openedChests.length+'/3';
      if(this.game.stage===6)this.dom.objectiveText.textContent=this.sixthObjectiveText();
      if(this.game.stage===7)this.dom.objectiveText.textContent='全歼敌军 · 剩余 '+this.game.livingCount('enemy')+' / '+this.game.mission.enemyCount+' 名'+(this.game.nijikaJoined?' · 虹夏已入队':' · 回应虹夏的求助');
      this.updateAll();
      this.renderIdleInfo();
      this.layoutBoard();
      this.showBanner('第 1 回合', '我方行动 · PLAYER PHASE', 1600);
      setTimeout(() => {
        if (!this.busy) this.showToast(C.TEXT.hints.idle, 'info', 2600);
      }, 620);
      if (this.dom.chapterIntro) {
        this.dom.chapterIntro.addEventListener('click', () => this.finishChapterIntro());
      }
    }

    /** 把关卡标题、任务目标同步到顶部和底部信息栏。 */
    syncMission() {
      const mission = this.game.mission;
      this.dom.missionChapter.textContent = mission.chapter;
      this.dom.missionTitle.textContent = mission.title;
      this.dom.missionSub.textContent = mission.subtitle;
      this.dom.objectiveText.textContent = mission.objective;
      if(this.game.stage===11)this.dom.objectiveText.textContent='击败精英战马骑士 · '+(this.game.getUnit('gilded_cavalier')?.dead?'已击败':'北端王座厅')+' · 敌军剩余 '+this.game.livingCount('enemy')+' 名';
      if(this.game.stage===10)this.dom.objectiveText.textContent='后半段 · 全歼敌军 · 剩余 '+this.game.livingCount('enemy')+' / '+this.game.mission.enemyCount+' 名'+(this.game.subaruJoined?' · 昴已入队':' · 与昴会合');
      if(this.game.stage===9)this.dom.objectiveText.textContent=this.game.gateOpen?'正在进入本关后半段':this.game.getUnit('rift_pegasus')?.dead?'前半段 · Boss 已击败 · 到北端门旁使用钥匙':'前半段 · 击败裂空天马 → 取得钥匙 → 开门';
      if(this.game.stage===8)this.dom.objectiveText.textContent='击败幻影 · '+this.game.mission.phantomIds.filter(id=>this.game.getUnit(id)?.dead).length+'/2 · 宝箱 '+this.game.openedChests.length+'/3';
      if(this.game.stage===6)this.dom.objectiveText.textContent=this.sixthObjectiveText();
      if(this.game.stage===7)this.dom.objectiveText.textContent='全歼敌军 · 剩余 '+this.game.livingCount('enemy')+' / '+this.game.mission.enemyCount+' 名'+(this.game.nijikaJoined?' · 虹夏已入队':' · 回应虹夏的求助');
      if(this.game.stage===2)this.dom.objectiveText.textContent='星铃 '+this.game.awakenedBells.length+'/3 · 指挥家'+
        (this.game.getUnit('conductor').dead?'已击败':'待击败');
      if(this.game.stage===4)this.dom.objectiveText.textContent=this.parkObjectiveText();
      if(this.game.stage===5)this.dom.objectiveText.textContent='击败东侧铁幕守卫长 · 宝箱 '+this.game.openedChests.length+'/2 · 钥匙持有者 '+this.game.living('enemy').filter(u=>u.drops.includes('chest_key')).length+' 人';
      const intro = this.dom.chapterIntro;
      if (intro) {
        const jp = intro.querySelector('.chapter-number-jp');
        const en = intro.querySelector('.chapter-number-en');
        const title = intro.querySelector('.chapter-title');
        const sub = intro.querySelector('.chapter-sub');
        const foot = intro.querySelector('.chapter-foot');
        if (jp) jp.textContent = mission.chapterJp || '第一话';
        if (en) en.textContent = mission.chapterEn || mission.chapter;
        if (title) title.textContent = mission.title;
        if (sub) sub.textContent = mission.subtitle;
        if (foot) foot.textContent = mission.chapter + ' · ' + mission.mapName;
      }
    }

    /* ------------------------------------------------------------
     * 章节标题演出
     * ---------------------------------------------------------- */

    /**
     * 首次进入战场时播放章节标题。只播放一次；再次从标题页返回时直接回调。
     * @param {Function} [onDone] 演出结束后的回调
     */
    playChapterIntro(onDone) {
      this.chapterDone = typeof onDone === 'function' ? onDone : null;
      this.syncMission();
      const root = this.dom.chapterIntro;
      if (!root || this.chapterPlayed) {
        this.chapterDone = null;
        if (onDone) onDone();
        this.scheduleAutoEndTurn();
        return;
      }

      this.chapterPlayed = true;
      this.chapterOpen = true;
      document.body.classList.add('chapter-open');
      if(this.game.stage===4){this.playParkIntro();return;}
      if(this.game.stage===7){this.playLivehouseIntro();return;}
      if(this.game.stage===10){this.playTenthIntro();return;}
      if(this.game.stage===11){this.playPalaceIntro();return;}
      if(this.game.stage===9){this.playNinthIntro();return;}
      if(this.game.stage===8){this.playEighthIntro();return;}
      root.hidden = false;
      root.classList.remove('is-leaving');
      // 强制一帧初始态，保证 opacity 过渡从 0 开始。
      void root.offsetWidth;
      requestAnimationFrame(() => root.classList.add('is-visible'));

      // 留足阅读时间后自动淡出；点击/按键可以提前结束。
      this.chapterTimers.push(setTimeout(() => this.finishChapterIntro(), 3300));
    }

    finishChapterIntro() {
      if(this._livehouseEndingAdvance){this._livehouseEndingAdvance();return;}
      if (!this.chapterOpen) return;
      if(this.parkIntroCleanup){this.parkIntroCleanup();this.parkIntroCleanup=null;}
      this.chapterOpen = false;
      this.chapterTimers.forEach((timer) => clearTimeout(timer));
      this.chapterTimers = [];
      const root = this.dom.chapterIntro;
      if (!root) {
        if (this.chapterDone) this.chapterDone();
        this.chapterDone = null;
        this.scheduleAutoEndTurn();
        return;
      }
      root.classList.add('is-leaving');
      setTimeout(() => {
        root.hidden = true;
        root.classList.remove('is-visible', 'is-leaving');
        document.body.classList.remove('chapter-open');
        const done = this.chapterDone;
        this.chapterDone = null;
        if (done) done();
        if([6,8,9,10,11].includes(this.game.stage)){this.layoutBoard();const lead=this.game.living('player')[0];if(lead)this.revealCell(lead.x,lead.y);}
        this.scheduleAutoEndTurn();
      }, 720);
    }

    newGame(seed, stage) {
      if(this._livehouseEndingCancel)this._livehouseEndingCancel();
      this.closeOverlay();
      this.endShown = false;
      this.busy = false;
      const requestedStage = [1,2,3,4,5,6,7,8,9,10,11].includes(stage) ? stage : this.game.stage===11?11:this.game.chapterNumber || this.game.stage || 1;
      const nextStage=requestedStage===10?11:requestedStage;
      this.game = new MyGO.Game({ seed: seed || Date.now(), stage: nextStage,
        ninaLost:nextStage>=9&&this.game.ninaLost,
        recruited: nextStage >= 2 ? [...new Set(this.game.recruited.filter(id=>nextStage!==7||id!=='nijika').concat(nextStage>=9&&!this.game.ninaLost?['nina']:[]))] : [],
        loadout: nextStage >= 2 && nextStage > this.game.stage ? this.game.exportLoadout() : undefined });
      this.renderer.setGame(this.game);
      this.chapterPlayed = false;
      this.resetSelection({ silent: true });
      this.updateAll();
      this.renderIdleInfo();
      this.setZoom(1, false);
      this.syncMission();
      this.showBanner('第 1 回合', '我方行动 · PLAYER PHASE', 1600);
      this.showToast('新的战斗开始了。', 'success', 1600);
      if(nextStage>=7)setTimeout(()=>{if(this.game.stage===nextStage&&!this.chapterPlayed&&!this.chapterOpen)this.playChapterIntro();},0);
    }

    /** 开始下一章（或直接指定章节）。 */
    startNextStage() {
      if(this.game.chapterNumber >= 10 || this.game.stage===9 || this.game.phase !== 'victory') return;
      const next = this.game.stage===10?11:this.game.stage + 1;
      this.chapterPlayed = false;
      this.closeOverlay();
      this.endShown = false;
      this.busy = false;
      this.game = new MyGO.Game({ seed: Date.now(), stage: next,
        recruited: this.game.recruited,
        ninaLost: this.game.ninaLost,
        loadout: this.game.exportLoadout() });
      this.renderer.setGame(this.game);
      this.resetSelection({ silent: true });
      this.updateAll();
      this.renderIdleInfo();
      this.setZoom(1, false);
      this.syncMission();
      this.playChapterIntro(() => {
        this.showBanner('第 1 回合', '我方行动 · PLAYER PHASE', 1500);
      });
    }

    bindEvents() {
      this.dom.board.addEventListener('click', (event) => this.onBoardClick(event));
      this.dom.board.addEventListener('pointermove', (event) => this.onPointerMove(event));
      this.dom.board.addEventListener('pointerleave', () => this.onPointerLeave());
      this.dom.board.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        this.cancelCurrent();
      });

      if (this.dom.partyList) this.dom.partyList.addEventListener('click', (event) => {
        const button = event.target.closest('[data-party-id]');
        if (button) this.chooseParty(button.dataset.partyId);
      });
      if (this.dom.gridBtn) this.dom.gridBtn.addEventListener('click', () => this.toggleGrid());
      if (this.dom.fullscreenBtn) this.dom.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
      document.addEventListener('fullscreenchange', () => {
        if (this.dom.fullscreenBtn) this.dom.fullscreenBtn.textContent = document.fullscreenElement ? '退出全屏 F' : '全屏 F';
      });
      this.dom.endTurnBtn.addEventListener('click', () => this.endTurn());
      this.dom.saveBtn.addEventListener('click', () => this.saveGame());
      this.dom.loadBtn.addEventListener('click', () => this.askLoadGame());
      this.dom.helpBtn.addEventListener('click', () => this.showHelp());
      this.dom.restartBtn.addEventListener('click', () => this.askRestart());

      // 大地图缩放：按钮、重置与 Ctrl + 滚轮；普通滚轮留给视口滚动。
      this.dom.zoomInBtn.addEventListener('click', () => this.setZoom(this.zoom + this.zoomStep));
      this.dom.zoomOutBtn.addEventListener('click', () => this.setZoom(this.zoom - this.zoomStep));
      this.dom.zoomResetBtn.addEventListener('click', () => this.setZoom(1));
      this.dom.boardViewport.addEventListener('wheel', (event) => {
        if (!event.ctrlKey && !event.metaKey) return;
        event.preventDefault();
        this.setZoom(this.zoom + (event.deltaY < 0 ? this.zoomStep : -this.zoomStep));
      }, { passive: false });
      // 窗口尺寸变化时合并到下一帧，避免连续 resize 触发尺寸回环。
      window.addEventListener('resize', () => {
        if (this.layoutRaf) return;
        this.layoutRaf = requestAnimationFrame(() => {
          this.layoutRaf = 0;
          this.layoutBoard();
        });
      });

      this.dom.overlayRoot.addEventListener('click', (event) => {
        const target = event.target;
        if (!target || typeof target.closest !== 'function') return;
        if (target.closest('[data-overlay-dismiss]') && this.modalDismissible) {
          this.closeOverlay();
          return;
        }
        if (target.closest('[data-overlay-close]')) {
          this.closeOverlay();
          return;
        }
        const confirmBtn = target.closest('[data-confirm]');
        if (confirmBtn && this.confirmHandler) {
          const handler = this.confirmHandler;
          this.confirmHandler = null;
          this.closeOverlay();
          handler();
        }
      });

      this.dom.cutin.addEventListener('click', () => {
        if (this.cutinSkip) this.cutinSkip();
      });

      document.addEventListener('keydown', (event) => this.onKeyDown(event));
    }

    onKeyDown(event) {
      if (event.ctrlKey || event.metaKey || event.altKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
      if ((document.getElementById('entry-screen') && !document.getElementById('entry-screen').hidden) ||
          (document.getElementById('formation-screen') && !document.getElementById('formation-screen').hidden) ||
          (document.getElementById('equipment-screen') && !document.getElementById('equipment-screen').hidden) ||
          (document.getElementById('shop-screen') && !document.getElementById('shop-screen').hidden)) return;
      if (this.chapterOpen) {
        if(this._livehouseEndingAdvance){
          if(event.key==='Escape'){event.preventDefault();this._livehouseEndingSkip();}
          else if(event.key==='Enter'||event.key===' '){event.preventDefault();this._livehouseEndingAdvance();}
          return;
        }
        if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          this.finishChapterIntro();
        }
        return;
      }

      if (event.key === 'Escape') {
        if (!this.dom.overlayRoot.hidden) {
          if (this.modalDismissible) this.closeOverlay();
          return;
        }
        if (this.cutinSkip) {
          this.cutinSkip();
          return;
        }
        this.cancelCurrent();
        return;
      }

      if (event.key === 'Enter' && !this.dom.overlayRoot.hidden && this.confirmHandler) {
        const button = this.dom.overlayCard.querySelector('[data-confirm]');
        if (button) {
          event.preventDefault();
          button.click();
        }
        return;
      }

      if (!this.dom.overlayRoot.hidden || this.cutinSkip) return;
      if (/^[1-9]$/.test(event.key)) {
        const unit = this.game.units.filter((u) => u.side === 'player')[Number(event.key) - 1];
        if (unit) { event.preventDefault(); this.chooseParty(unit.id); }
      }
      if (event.key.toLowerCase() === 'g') this.toggleGrid();
      if (event.key.toLowerCase() === 'f') this.toggleFullscreen();
      if (event.key === 'e' || event.key === 'E') {
        if (!this.busy) this.endTurn();
      }
    }

    chooseParty(id) {
      if (this.busy || this.chapterOpen || !this.dom.overlayRoot.hidden) return;
      const unit = this.game.getUnit(id);
      if (!unit || unit.dead) return;
      if (this.activeId && this.activeId !== id) {
        if (this.mode === 'move' && !this.moved) this.resetSelection({ silent: true });
        else { this.showToast('请先完成当前同伴的行动，或按 Esc 返回。', 'info'); return; }
      }
      if (this.activeId === id) {
        if (this.mode === 'move') this.enterActionMode();
        return;
      }
      if (this.game.isPlayerPhase() && !unit.acted && !this.game.isOver()) this.selectUnit(unit);
      else this.inspectUnit(unit);
    }

    renderParty() {
      const list = this.dom.partyList;
      if (!list) return;
      const units = this.game.units.filter((unit) => unit.side === 'player');
      if (list.children.length !== units.length || units.some((unit, i) => list.children[i].dataset.partyId !== unit.id)) {
        list.innerHTML = units.map((unit, i) => '<button class="party-unit" data-party-id="' + esc(unit.id) +
          '" data-shortcut="' + (i + 1) + '"><canvas width="32" height="32" aria-hidden="true"></canvas><strong>' +
          esc(unit.shortName || unit.name.slice(-2)) + '</strong><span class="party-hp"><i></i></span></button>').join('');
        units.forEach((unit, i) => this.drawPortrait(list.children[i].querySelector('canvas'), unit));
      }
      units.forEach((unit, i) => {
        const button = list.children[i];
        button.disabled = this.busy || unit.dead;
        button.classList.toggle('is-acted', unit.acted);
        button.classList.toggle('is-down', unit.dead);
        button.setAttribute('aria-pressed', String((this.activeId || this.inspectedId) === unit.id));
        button.setAttribute('aria-label', (i + 1) + ' · ' + unit.name + ' · HP ' + unit.hp + '/' + unit.maxHp +
          (unit.dead ? ' · 无法战斗' : unit.acted ? ' · 已行动' : ' · 可行动'));
        button.title = unit.name + ' · ' + unit.hp + '/' + unit.maxHp;
        button.querySelector('.party-hp i').style.width = pct(unit.hp / unit.maxHp) + '%';
      });
    }

    toggleGrid() {
      this.renderer.showGrid = this.renderer.showGrid === false;
      if (this.dom.gridBtn) this.dom.gridBtn.setAttribute('aria-pressed', String(this.renderer.showGrid));
    }

    async toggleFullscreen() {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await document.documentElement.requestFullscreen();
      } catch (err) { this.showToast('当前窗口无法进入全屏，可在浏览器中打开游戏后重试。', 'info'); }
    }

    parkObjectiveText() {
      const g=this.game,direction=g.parkSoundHint().match(/东北|东南|偏东|东方/)?.[0];
      return '追踪神秘幻影 · 路灯 '+g.litLamps.length+'/6 · '+
        (g.getUnit('dark_soyo').dead?'幻影已击败':direction?'声音来自'+direction:'探索附近，留意回声');
    }

    updateAll() {
      this.updateChrome();
      this.updateCounts();
      if(this.game.stage===2){
        const g=this.game;
        this.dom.objectiveText.textContent='星铃 '+g.awakenedBells.length+'/'+g.mission.requiredBells+
          ' · 指挥家'+(g.getUnit('conductor').dead?'已击败':'待击败');
      }
      if(this.game.stage===3){
        const nina=this.game.getUnit('nina');
        this.dom.objectiveText.textContent='剩余敌军 '+this.game.livingCount('enemy')+' · 仁菜'+
          (this.game.ninaLost?'已阵亡 · 无法招募':nina.side==='player'?'已获救':' HP '+nina.hp+'/'+nina.maxHp+' · 友军');
      }
      if(this.game.stage===4){
        this.dom.objectiveText.textContent=this.parkObjectiveText();
      }
      if(this.game.stage===11)this.dom.objectiveText.textContent='击败精英战马骑士 · '+(this.game.getUnit('gilded_cavalier')?.dead?'已击败':'北端王座厅')+' · 敌军剩余 '+this.game.livingCount('enemy')+' 名';
      if(this.game.stage===10)this.dom.objectiveText.textContent='后半段 · 全歼敌军 · 剩余 '+this.game.livingCount('enemy')+' / '+this.game.mission.enemyCount+' 名'+(this.game.subaruJoined?' · 昴已入队':' · 与昴会合');
      if(this.game.stage===9)this.dom.objectiveText.textContent=this.game.gateOpen?'正在进入本关后半段':this.game.getUnit('rift_pegasus')?.dead?'前半段 · Boss 已击败 · 到北端门旁使用钥匙':'前半段 · 击败裂空天马 → 取得钥匙 → 开门';
      if(this.game.stage===8)this.dom.objectiveText.textContent='击败幻影 · '+this.game.mission.phantomIds.filter(id=>this.game.getUnit(id)?.dead).length+'/2 · 宝箱 '+this.game.openedChests.length+'/3';
      if(this.game.stage===6)this.dom.objectiveText.textContent=this.sixthObjectiveText();
      if(this.game.stage===7)this.dom.objectiveText.textContent='全歼敌军 · 剩余 '+this.game.livingCount('enemy')+' / '+this.game.mission.enemyCount+' 名'+(this.game.nijikaJoined?' · 虹夏已入队':' · 回应虹夏的求助');
      if(this.game.stage===5)this.dom.objectiveText.textContent='击败东侧铁幕守卫长 · 宝箱 '+this.game.openedChests.length+'/2 · 钥匙持有者 '+this.game.living('enemy').filter(u=>u.drops.includes('chest_key')).length+' 人';
      this.refreshEnemyThreat();
      this.scheduleAutoEndTurn();
    }

    sixthObjectiveText(){return '向北逼退神秘面具人 · 已召唤 '+this.game.summonedWaves.length+'/4 波 · '+(this.game.maskEscaped?'已传送离开':'王座 HP '+this.game.getUnit('masked_stranger').hp+'/'+this.game.getUnit('masked_stranger').maxHp);}

    updateChrome() {
      const game = this.game;
      const phase = game.phase;
      const playerPhase = game.isPlayerPhase() && !game.isOver();
      this.dom.phaseBlock.dataset.phase = phase;
      this.dom.turnNumber.textContent = String(game.turn).padStart(2, '0');
      this.dom.turnLabel.textContent = '第 ' + game.turn + ' 回合';

      if (phase === 'player') {
        this.dom.phaseLabel.textContent = '我方阶段';
        this.dom.phaseKicker.textContent = 'PLAYER PHASE';
        this.dom.turnTitle.textContent = '我方行动';
      } else if (phase === 'ally') {
        this.dom.phaseLabel.textContent='友军阶段';this.dom.phaseKicker.textContent='ALLY PHASE';this.dom.turnTitle.textContent='仁菜正在行动';
      } else if (phase === 'enemy') {
        this.dom.phaseLabel.textContent = '敌方阶段';
        this.dom.phaseKicker.textContent = 'ENEMY PHASE';
        this.dom.turnTitle.textContent = '敌方行动';
      } else if (phase === 'victory') {
        this.dom.phaseLabel.textContent = '作战胜利';
        this.dom.phaseKicker.textContent = 'MISSION COMPLETE';
        this.dom.turnTitle.textContent = '迷途终有归途';
      } else {
        this.dom.phaseLabel.textContent = '作战失败';
        this.dom.phaseKicker.textContent = 'MISSION FAILED';
        this.dom.turnTitle.textContent = '声音暂时停驻';
      }

      this.dom.endTurnBtn.disabled = this.busy || !playerPhase;
      this.dom.saveBtn.disabled = this.busy || (!playerPhase && phase !== 'victory');
      this.dom.loadBtn.disabled = this.busy;
      this.dom.helpBtn.disabled = this.busy;
      this.dom.restartBtn.disabled = this.busy;
      this.updateBoardCursor();
      this.updateSaveNote();
      this.renderParty();
    }

    updateCounts() {
      this.dom.playerCount.textContent = String(this.game.livingCount('player'));
      this.dom.enemyCount.textContent = this.game.stage===4?String(this.game.living('enemy').filter(u=>this.game.isUnitVisible(u)).length)+'（可见）':String(this.game.livingCount('enemy'));
      this.renderParty();
    }

    /**
     * 让 768×512 的大地图适配 24:16 的视口。
     * 100% 时完整显示；放大后 Canvas 的 CSS 尺寸增大，由视口滚动查看，
     * 不改动 Canvas 的内部坐标，因此点击换算和高亮完全不受影响。
     */
    layoutBoard() {
      const vp = this.dom.boardViewport;
      if (!vp) return;
      const frame = vp.parentElement;
      if (document.getElementById('game-shell')) {
        const aspect = this.renderer.logicalWidth / this.renderer.logicalHeight;
        const width = [6,8,9,10,11].includes(this.game.stage)?Math.max(1,frame.clientWidth-2):Math.max(1, Math.min(frame.clientWidth - 2, (frame.clientHeight - 2) * aspect));
        vp.style.width = width + 'px';
        vp.style.height = ([6,8,9,10,11].includes(this.game.stage)?Math.max(1,frame.clientHeight-2):width/aspect) + 'px';
      }
      const baseW = vp.offsetWidth;
      const baseH = [6,8,9,10,11].includes(this.game.stage)?baseW*this.renderer.logicalHeight/this.renderer.logicalWidth:vp.offsetHeight;
      const zoomed = this.zoom > 1.001 || [6,8,9,10,11].includes(this.game.stage);
      vp.classList.toggle('is-zoomed', zoomed);
      if (zoomed) {
        this.dom.board.style.width = Math.round(baseW * this.zoom) + 'px';
        this.dom.board.style.height = Math.round(baseH * this.zoom) + 'px';
      } else {
        // 1× 时完全交给 CSS：画布恰好等于视口，不产生滚动条。
        this.dom.board.style.width = '100%';
        this.dom.board.style.height = '100%';
      }
      this.dom.zoomLevel.textContent = Math.round(this.zoom * 100) + '%';
      this.dom.zoomOutBtn.disabled = this.zoom <= this.zoomMin + 0.001;
      this.dom.zoomInBtn.disabled = this.zoom >= this.zoomMax - 0.001;
      this.dom.zoomResetBtn.disabled = Math.abs(this.zoom - 1) < 0.001;
    }

    setZoom(value, preserveCenter) {
      const next = Math.max(this.zoomMin, Math.min(this.zoomMax, value));
      if (Math.abs(next - this.zoom) < 0.001) return;
      const vp = this.dom.boardViewport;
      const keep = preserveCenter !== false;
      const oldW = this.dom.board.offsetWidth || 1;
      const oldH = this.dom.board.offsetHeight || 1;
      const cx = (vp.scrollLeft + vp.clientWidth / 2) / oldW;
      const cy = (vp.scrollTop + vp.clientHeight / 2) / oldH;
      this.zoom = next;
      this.layoutBoard();
      if (keep) {
        requestAnimationFrame(() => {
          const newW = this.dom.board.offsetWidth || 1;
          const newH = this.dom.board.offsetHeight || 1;
          vp.scrollLeft = Math.max(0, cx * newW - vp.clientWidth / 2);
          vp.scrollTop = Math.max(0, cy * newH - vp.clientHeight / 2);
        });
      }
    }

    /** 选中/查看远处单位时，把格子滚进视口。仅影响镜头，不影响规则。 */
    revealCell(x, y) {
      const vp = this.dom.boardViewport;
      if (!vp || this.zoom <= 1.001 && ![6,8,9,10,11].includes(this.game.stage)) return;
      const cellW = this.dom.board.offsetWidth / this.game.map.cols;
      const cellH = this.dom.board.offsetHeight / this.game.map.rows;
      const projected = this.game.stage>=2 && MyGO.MapProjection
        ? MyGO.MapProjection.project(this.renderer.projection,(x+.5)*C.TILE,(y+.5)*C.TILE) : null;
      const left = projected ? projected.x / this.renderer.logicalWidth * this.dom.board.offsetWidth - cellW/2 : x * cellW;
      const top = projected ? projected.y / this.renderer.logicalHeight * this.dom.board.offsetHeight - cellH/2 : y * cellH;
      // 至少留出 1.5 格的观察余量，避免选中单位贴边。
      const pad = Math.max(24, Math.round(cellW * ([6,8,9,10,11].includes(this.game.stage)?3:1.5)));
      if (left < vp.scrollLeft + pad) vp.scrollLeft = Math.max(0, left - pad);
      else if (left + cellW > vp.scrollLeft + vp.clientWidth - pad) {
        vp.scrollLeft = left + cellW - vp.clientWidth + pad;
      }
      if (top < vp.scrollTop + pad) vp.scrollTop = Math.max(0, top - pad);
      else if (top + cellH > vp.scrollTop + vp.clientHeight - pad) {
        vp.scrollTop = top + cellH - vp.clientHeight + pad;
      }
    }

    updateBoardCursor() {
      const actionable = this.game.isPlayerPhase() && !this.busy;
      this.dom.board.classList.toggle('is-actionable', actionable && (this.mode === 'idle' || this.mode === 'move'));
      this.dom.board.classList.toggle('is-attackable', actionable && this.mode === 'attack');
      if (this.dom.tacticalHint) this.dom.tacticalHint.textContent = this.busy ? C.TEXT.hints.busy :
        this.game.isOver() ? '心境之旅 · 本场战斗已结束' : C.TEXT.hints[this.game.phase === 'enemy' ? 'enemy' : this.mode] || C.TEXT.hints.idle;
    }

    setBusy(value) {
      this.busy = !!value;
      this.updateChrome();
      this.scheduleAutoEndTurn();
    }

    updateSaveNote() {
      const hasSave = this.saveManager.hasSave();
      if (this.lastSaveAt) {
        this.dom.saveNote.textContent = '已存档 ' + this.lastSaveAt;
      } else if (hasSave) {
        this.dom.saveNote.textContent = this.saveManager.storageType === 'memory' ? '内存存档可用' : '本地存档可用';
      } else {
        this.dom.saveNote.textContent = '尚未存档';
      }
    }

    showBanner(title, sub, ms) {
      clearTimeout(this.bannerTimer);
      this.dom.bannerTitle.textContent = title;
      this.dom.bannerSub.textContent = sub;
      this.dom.turnBanner.hidden = false;
      this.dom.turnBanner.style.animation = 'none';
      void this.dom.turnBanner.offsetWidth;
      this.dom.turnBanner.style.animation = '';
      this.bannerTimer = setTimeout(() => {
        this.dom.turnBanner.hidden = true;
      }, ms || 1500);
    }

    showToast(message, type, ms) {
      clearTimeout(this.toastTimer);
      this.dom.toast.textContent = message;
      this.dom.toast.dataset.type = type || 'info';
      this.dom.toast.hidden = false;
      this.dom.toast.style.animation = 'none';
      void this.dom.toast.offsetWidth;
      this.dom.toast.style.animation = '';
      this.toastTimer = setTimeout(() => {
        this.dom.toast.hidden = true;
      }, ms || 1800);
    }

    triggerScreenFlash() {
      const el = this.dom.screenFlash;
      el.classList.remove('active');
      void el.offsetWidth;
      el.classList.add('active');
      setTimeout(() => el.classList.remove('active'), 560);
    }

    /* ============================================================
     * 渲染视图（高亮、路径、选中标记）
     * ============================================================ */

    setView() {
      const actionable = new Set(
        this.game.living('player').filter((unit) => !unit.acted).map((unit) => unit.id)
      );
      const inSelection = this.mode === 'move' || this.mode === 'action' || this.mode === 'attack';
      const selectedId = inSelection ? this.activeId : this.inspectedId;
      const renderMode = this.mode === 'move' || this.mode === 'attack' ? this.mode : 'idle';

      this.renderer.setView({
        mode: renderMode,
        selectedId,
        hoverKey: this.hoverKey,
        moveTiles: this.mode === 'move' ? this.moveTiles : new Set(),
        attackTiles: this.mode === 'attack' ? this.attackTiles : new Set(),
        enemyThreatTiles: this.game.isPlayerPhase()?this.enemyThreatTiles:new Set(),
        targetIds: this.mode === 'attack' ? this.targetIds : new Set(),
        path: this.mode === 'move' ? this.previewPath : [],
        actionableIds: actionable
      });
      this.updateBoardCursor();
      this.renderParty();
    }

    onPointerMove(event) {
      if (this.busy || !this.game.isPlayerPhase() || (this.mode !== 'move' && this.mode !== 'attack')) {
        return;
      }
      const cell = this.eventToCell(event);
      if (!cell) return;
      const key = Grid.key(cell.x, cell.y);
      if (key !== this.hoverKey) {
        this.hoverKey = key;
        if (this.mode === 'move' && this.reachable) {
          const record = this.reachable.get(key);
          this.previewPath = record && record.stoppable ? Pathfinding.getPath(this.reachable, key) : [];
        } else {
          this.previewPath = [];
        }
        this.setView();
      }

      if (this.mode === 'attack') {
        const target = this.game.unitAt(cell.x, cell.y);
        if (target && this.targetIds.has(target.id)) {
          this.showHoverForecast(target);
        } else if (this.hoveredTargetId) {
          this.hoveredTargetId = null;
          const active = this.game.getUnit(this.activeId);
          if (active) this.renderAttackSide(active);
        }
      }
    }

    onPointerLeave() {
      this.hoverKey = null;
      this.previewPath = [];
      this.hoveredTargetId = null;
      if (this.mode === 'move' || this.mode === 'attack') this.setView();

      // 鼠标离开棋盘后，底部面板不应停留在“目标预测”状态。
      if (this.mode === 'attack') {
        const active = this.game.getUnit(this.activeId);
        if (active) this.renderAttackSide(active);
      }
    }

    eventToCell(event) {
      const rect = this.dom.board.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      const shell = document.getElementById('game-shell');
      if(this.renderer.pickProjectedUnit && (this.mode==='idle'||this.mode==='attack')){
        const rotated=!!shell&&shell.dataset.rotated==='true';
        const nx=rotated?(event.clientY-rect.top)/rect.height:(event.clientX-rect.left)/rect.width;
        const ny=rotated?(rect.left+rect.width-event.clientX)/rect.width:(event.clientY-rect.top)/rect.height;
        const hit=this.renderer.pickProjectedUnit(nx*this.renderer.logicalWidth,ny*this.renderer.logicalHeight);
        if(hit)return hit;
      }
      return MyGO.Viewport.pointToCell(rect, event.clientX, event.clientY, this.game.map.cols, this.game.map.rows,
        !!shell && shell.dataset.rotated === 'true', this.game.stage>=2 ? this.renderer.projection : null);
    }

    /* ============================================================
     * 选择、移动、行动
     * ============================================================ */

    onBoardClick(event) {
      if (this.busy || this.chapterOpen || !this.game.isPlayerPhase()) return;
      const cell = this.eventToCell(event);
      if (!cell) return;
      if(this.game.stage===4&&!this.game.isVisible(cell.x,cell.y)){
        this.showToast('这里还没有被照亮。靠近路灯，在行动菜单中点亮它。','info',2300);return;
      }
      const unit = this.game.unitAt(cell.x, cell.y);

      if(unit?.side==='enemy'&&['idle','move','action'].includes(this.mode)){
        this.toggleEnemyThreat(unit);
        return;
      }

      if (this.mode === 'idle') {
        if (unit && unit.side === 'player') {
          if (unit.acted) {
            this.inspectUnit(unit);
            this.showToast(unit.name + ' 本回合已经行动过了。', 'info', 1300);
          } else {
            this.selectUnit(unit);
          }
        } else if (unit) {
          this.inspectUnit(unit);
        } else {
          this.inspectedId = null;
          this.setView();
          this.renderTerrainInfo(cell.x, cell.y);
        }
        return;
      }

      if (this.mode === 'move') {
        const key = Grid.key(cell.x, cell.y);
        if (!this.moveTiles.has(key)) {
          if (unit && unit.side === 'player' && unit.id !== this.activeId) {
            this.showToast('请先完成当前单位的行动。', 'error', 1500);
          }
          return;
        }
        if (key === Grid.key(this.game.getUnit(this.activeId).x, this.game.getUnit(this.activeId).y)) {
          this.enterActionMode();
        } else {
          this.moveActiveTo(cell.x, cell.y);
        }
        return;
      }

      if (this.mode === 'attack') {
        if (unit && this.targetIds.has(unit.id)) {
          this.playerAttack(unit);
        } else if (unit && unit.side === 'enemy') {
          this.showToast('该目标不在攻击范围内。', 'error', 1500);
        }
      }
    }

    selectUnit(unit) {
      if (unit.side !== 'player' || unit.acted || unit.dead) return;
      this.activeId = unit.id;
      this.inspectedId = null;
      this.origin = { x: unit.x, y: unit.y };
      this.moved = false;
      this.mode = 'move';
      this.actionTargets = [];
      this.attackTiles = new Set();
      this.targetIds = new Set();
      this.previewPath = [];
      this.hoverKey = null;
      this.hoveredTargetId = null;
      this.reachable = this.game.getReachable(unit);
      this.moveTiles = new Set();
      for (const [key, record] of this.reachable) {
        if (record.stoppable) this.moveTiles.add(key);
      }
      this.setView();
      this.renderUnitInfo(unit);
      this.renderMoveSide(unit);
      this.revealCell(unit.x, unit.y);
    }

    async moveActiveTo(x, y) {
      const unit = this.game.getUnit(this.activeId);
      if (!unit || this.busy) return;
      const targetKey = Grid.key(x, y);
      const path = Pathfinding.getPath(this.reachable, targetKey);
      if (!path.length) {
        this.showToast('无法到达该位置。', 'error', 1400);
        return;
      }

      this.setBusy(true);
      this.mode = 'moving';
      this.hoverKey = null;
      this.previewPath = [];
      this.setView();

      try {
        await this.renderer.animateMove(unit.id, path, 58);
        unit._walking = false;
        const movedVisual = this.renderer.visuals.get(unit.id);
        if (movedVisual) movedVisual.moving = false;
        const foundBefore=this.game.bossDiscovered;
        this.game.setUnitPosition(unit.id, x, y);
        this.renderer.snapUnit(unit);
        if(this.game.stage===4){this.updateAll();if(!foundBefore&&this.game.bossDiscovered)
          this.showToast('声音的源头找到了……往日之影长崎爽世！由爽世完成最后一击，可获双倍击破经验。','info',4800);}
        this.moved = true;
        this.setBusy(false);
        this.enterActionMode();
        if (this.game.canUseGateKey(unit)) this.showGateKeyPrompt(unit);
      } catch (err) {
        console.error(err);
        this.setBusy(false);
        this.resetSelection();
        this.showToast('移动失败：' + err.message, 'error', 2200);
      }
    }

    enterActionMode() {
      const unit = this.game.getUnit(this.activeId);
      if (!unit) return;
      this.mode = 'action';
      this.actionTargets = this.game.getAttackableEnemies(unit);
      this.previewPath = [];
      this.hoverKey = null;
      this.setView();
      this.renderUnitInfo(unit);
      this.renderActionSide(unit);
    }

    enterAttackMode() {
      const unit = this.game.getUnit(this.activeId);
      if (!unit) return;
      this.actionTargets = this.game.getAttackableEnemies(unit);
      if (!this.actionTargets.length) {
        this.showToast('当前没有可攻击的目标。', 'info', 1400);
        return;
      }
      this.mode = 'attack';
      this.attackTiles = new Set(
        this.game.getAttackTiles(unit, unit.x, unit.y).map((tile) => Grid.key(tile.x, tile.y))
      );
      this.targetIds = new Set(this.actionTargets.map((target) => target.id));
      this.hoverKey = null;
      this.previewPath = [];
      this.setView();
      this.renderUnitInfo(unit);
      this.renderAttackSide(unit);
    }

    revertMove() {
      const unit = this.game.getUnit(this.activeId);
      if (!unit || !this.origin) return;
      this.game.setUnitPosition(unit.id, this.origin.x, this.origin.y);
      this.renderer.snapUnit(unit);
      this.moved = false;
      this.mode = 'move';
      this.actionTargets = [];
      this.attackTiles = new Set();
      this.targetIds = new Set();
      this.reachable = this.game.getReachable(unit);
      this.moveTiles = new Set();
      for (const [key, record] of this.reachable) {
        if (record.stoppable) this.moveTiles.add(key);
      }
      this.setView();
      this.renderUnitInfo(unit);
      this.renderMoveSide(unit);
      this.showToast('已撤回移动，可以重新选择落点。', 'info', 1500);
    }

    waitActiveUnit() {
      const unit = this.game.getUnit(this.activeId);
      if (!unit || this.busy) return;
      this.game.markActed(unit);
      this.resetSelection();
      this.updateAll();
      this.showToast(unit.name + ' 进入待机。', 'info', 1200);
    }

    cancelCurrent() {
      if (this.busy) return;
      if (!this.dom.overlayRoot.hidden) {
        if (this.modalDismissible) this.closeOverlay();
        return;
      }
      if (this.cutinSkip) {
        this.cutinSkip();
        return;
      }
      if (this.mode === 'attack') {
        this.enterActionMode();
        return;
      }
      if (this.mode === 'action') {
        if (this.moved) this.revertMove();
        else this.resetSelection();
        return;
      }
      if (this.mode === 'move') {
        this.resetSelection();
      }
    }

    resetSelection(options) {
      const opts = options || {};
      this.mode = 'idle';
      this.activeId = null;
      this.origin = null;
      this.moved = false;
      this.reachable = null;
      this.moveTiles = new Set();
      this.attackTiles = new Set();
      this.targetIds = new Set();
      this.actionTargets = [];
      this.previewPath = [];
      this.hoverKey = null;
      this.hoveredTargetId = null;
      this.inspectedId = null;
      this.setView();
      if (!opts.silent) this.renderIdleInfo();
    }

    /* ============================================================
     * 底部信息面板
     * ============================================================ */

    drawPortrait(canvas, unit, options) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, 32, 32);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#ded9cb';
      ctx.fillRect(0, 0, 32, 32);
      if (unit) {
        const drawn = MyGO.Characters && MyGO.Characters.drawPortrait(ctx, unit.id, 0, 0, 32, 32, { head: true });
        if (!drawn) {
          MyGO.Assets.drawUnit(ctx, unit, 0, 0, 32, {
            portrait: true,
            noFlip: true,
            static: true,
            ...(options || {})
          });
        }
      }
    }

    drawTerrainPortrait(canvas, terrainId) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, 32, 32);
      ctx.imageSmoothingEnabled = false;
      if(this.game.stage>=7&&MyGO.LivehouseArt){
        ctx.fillStyle=terrainId==='wall'?'#56343c':terrainId==='road'?'#25222e':'#38323b';ctx.fillRect(0,0,32,32);
        ctx.strokeStyle='#64545a';ctx.strokeRect(1,1,30,30);ctx.beginPath();ctx.moveTo(0,16);ctx.lineTo(32,16);ctx.stroke();
        if(terrainId==='fort'){ctx.fillStyle='#a6c8b4';ctx.fillRect(13,6,6,20);ctx.fillRect(6,13,20,6);}
      }else if(this.game.stage>=4&&MyGO.ParkMap){
        MyGO.ParkMap.drawSample(ctx,terrainId||'plain');
      } else if (this.game.stage === 1 && MyGO.GardenMap) {
        MyGO.GardenMap.drawSample(ctx, terrainId || 'plain');
      } else if (this.game.stage >= 2 && MyGO.MoonMap) {
        MyGO.MoonMap.drawSample(ctx, terrainId || 'plain');
      } else {
        MyGO.Assets.drawTerrain(ctx, terrainId || 'plain', 0, 0, 32, { gx: 0, gy: 0 });
      }
    }

    setPortrait(unit) {
      this.dom.portraitBlock.dataset.side = unit.side;
      this.dom.portraitBadge.textContent = unit.side === 'ally' ? '友军' : unit.side === 'player' ? '我方' : unit.boss ? '首领' : '敌方';
      this.dom.portraitLevel.textContent = 'Lv.' + unit.level;
      this.drawPortrait(this.dom.infoPortrait, unit);
    }

    setActions(actions) {
      this.dom.actionButtons.innerHTML = '';
      this.dom.actionButtons.classList.toggle('has-extra-action',actions.length>3);
      for (const action of actions) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'action-btn' + (action.className ? ' ' + action.className : '');
        btn.disabled = !!action.disabled;
        btn.innerHTML = action.html || esc(action.label || '');
        if (action.title) btn.title = action.title;
        if (action.onClick) btn.addEventListener('click', action.onClick);
        this.dom.actionButtons.appendChild(btn);
      }
    }

    renderUnitInfo(unit) {
      if (!unit) return;
      this.setPortrait(unit);
      this.dom.infoName.textContent = unit.name;
      const weapon = unit.weapon;
      const tags = [
        '<span class="tag ' + (unit.side === 'ally' ? 'side-ally' : unit.side === 'player' ? 'side-player' : 'side-enemy') + '">' +
          (unit.side === 'ally' ? '友军 · 不可操控' : unit.side === 'player' ? '我方' : '敌方') + '</span>',
        '<span class="tag">' + esc(unit.className) + '</span>',
        '<span class="tag">' + esc(WEAPON_NAME[weapon.type] || '武器') + '</span>'
      ];
      if(this.game.stage===6&&unit.id==='masked_stranger')tags.push('<span class="tag gold">致命伤锁血 1 HP · 随后传送</span>');
      if (unit.boss) tags.push('<span class="tag gold">首领</span>');
      if(unit.side==='player')tags.push('<span class="tag">EXP '+(unit.level>=99?'MAX':unit.exp+' / '+MyGO.Growth.required(unit.level))+'</span>');
      if(unit.inventory.some(i=>i.id==='chest_key'))tags.push('<span class="tag gold">宝箱钥匙</span>');
      if(unit.inventory.some(i=>i.id==='strange_door_key'))tags.push('<span class="tag gold">奇怪的门的钥匙</span>');
      if(unit.tags.includes('armor'))tags.push('<span class="tag">重装 · 高守备低魔防</span>');
      if(unit.tags.includes('flying'))tags.push('<span class="tag">飞行 · 可越水 · 弓特效弱点</span>');
      if(this.game.stage===5&&unit.boss)tags.push('<span class="tag gold">掉落：中级转职证＋钢斧</span>');
      if (unit.key) tags.push('<span class="tag gold">钥匙</span>');
      if (unit.inventory.some(i => i.id === 'courtyard_key')) tags.push('<span class="tag gold">内庭钥匙</span>');
      if (unit.dormant && !this.game.gateOpen) tags.push('<span class="tag">沉眠</span>');
      if (unit.side==='enemy' && unit.guardRadius) tags.push('<span class="tag">'+
        (unit.alerted ? '整队已警觉' : '整队警戒 '+unit.guardRadius+' 移动点')+'</span>');
      if (unit.acted && !unit.dead) tags.push('<span class="tag">已行动</span>');
      this.dom.infoTags.innerHTML = tags.join('');

      const terrain = Combat.terrainOf(unit,this.game.map);
      const hpRatio = unit.maxHp ? unit.hp / unit.maxHp : 0;
      const hpClass = hpRatio > 0.6 ? '' : hpRatio > 0.3 ? 'mid' : 'low';
      const damageType = Combat.damageTypeOf(weapon);
      const magic = damageType === 'magic';
      const defense = Combat.defenseOf(unit, this.game.map, magic);
      const avoid = Combat.avoidOf(unit, this.game.map);
      const weaponRange = weapon.range[0] === weapon.range[1]
        ? weapon.range[0] + ' 格'
        : weapon.range[0] + '–' + weapon.range[1] + ' 格';

      this.dom.infoBody.innerHTML = [
        '<div class="unit-subline">',
        unit.side==='enemy'&&unit.guardRadius ? '<small>接近至警戒距离，或攻击任一成员，整队持续追击。距离按地形移动消耗计算。</small>' : '',
        '  <span class="weapon-mark">' + esc(WEAPON_GLYPH[weapon.type] || '兵') + '</span>',
        '  <span class="weapon-line">' + esc(weapon.name) + ' · ' + (magic ? '魔法' : '物理') +
          ' · 射程 ' + weaponRange + ' · 威力 ' + weapon.might + '</span>',
        '</div>',
        '<div class="hp-line">',
        '  <span class="hp-caption">HP</span>',
        '  <div class="hp-meter"><div class="hp-fill ' + hpClass + '" style="width:' + pct(hpRatio) + '%"></div></div>',
        '  <span class="hp-values"><b>' + unit.hp + '</b><span> / ' + unit.maxHp + '</span></span>',
        '</div>',
        '<div class="stat-grid">',
        '  <div class="stat' + (magic ? '' : ' accent') + '"><i>力量</i><b>' + unit.str + ((MyGO.Talents?.strBonus(unit,this.game.map)||0)?'<small>+'+MyGO.Talents.strBonus(unit,this.game.map)+' '+(unit.id==='xueyue'?'剑意':'护灯')+'</small>':'') + '</b></div>',
        '  <div class="stat' + (magic ? ' accent' : '') + '"><i>魔力</i><b>' + unit.mag + '</b></div>',
        '  <div class="stat"><i>速度</i><b>' + unit.spd + '</b></div>',
        '  <div class="stat"><i>守备</i><b>' + unit.def + (!magic && terrain.def ? '<small>+' + terrain.def + '</small>' : '') + '</b></div>',
        '  <div class="stat"><i>魔防</i><b>' + unit.res + '</b></div>',
        '  <div class="stat"><i>技巧</i><b>' + unit.dex + ((MyGO.Talents?.dexBonus(unit)||0)?'<small>+3 天赋</small>':'') + '</b></div>',
        '  <div class="stat warm"><i>幸运</i><b>' + unit.lck + '</b></div>',
        '  <div class="stat"><i>移动</i><b>' + unit.move + '</b></div>',
        '</div>',
        '<div class="derived-line">',
        '  <span class="unit-stat-total" title="HP上限＋力量＋魔力＋技巧＋速度＋幸运＋守备＋魔防＋移动；不含武器/地形加成">属性总和 <b>' + Combat.statTotalOf(unit) + '</b></span>',
        '  <span>命中率 <b>' + Combat.hitOf(unit) + '</b></span>',
        '  <span>基础暴击率 <b>' + Combat.critRateOf(unit) + '%</b></span>',
        '  <span>必杀回避 <b>' + Combat.critAvoidOf(unit) + '</b></span>',
        '  <span>伤害类型 <b>' + (magic ? '魔法' : '物理') + '</b></span>',
        '  <span>' + (magic ? '战斗魔防' : '战斗守备') + ' <b>' + defense + '</b></span>',
        '  <span>回避 <b>' + avoid + '</b></span>',
        '  <span>攻速 AS <b>' + Combat.attackSpeedOf(unit,this.game.map) + '</b></span>',
        '  <span>脚下 <b>' + esc(terrain.name) + '</b></span>',
        '  <span>地形闪避 <b>+' + terrain.avoid + '</b></span>',
        '  <span>地形守备 <b>' + (magic ? '—' : '+' + terrain.def) + '</b></span>',
        '</div>'
      ].join('');
    }

    renderMoveSide(unit) {
      this.dom.contextTitle.textContent = '移动阶段';
      this.dom.contextText.innerHTML =
        '移动力 <strong>' + unit.move + '</strong>。蓝色格为可停留范围；' +
        '森林、山地与浅滩消耗 2 点移动力，敌方单位会阻挡道路。' +
        '<span class="hint-line">点击自身所在格可原地选择行动。</span>';
      this.setActions([
        {
          label: '原地行动',
          className: 'primary',
          onClick: () => this.enterActionMode()
        },
        {
          label: '取消',
          onClick: () => this.resetSelection()
        }
      ]);
    }

    renderActionSide(unit) {
      const targets = this.game.getAttackableEnemies(unit);
      this.actionTargets = targets;
      this.dom.contextTitle.textContent = '行动选择';
      const targetHint = targets.length
        ? '当前可攻击 <strong>' + targets.length + '</strong> 名敌人：' + esc(targets.map((t) => t.shortName).join('、')) + '。'
        : '当前攻击范围内没有敌人。可以待机，或撤回移动重新选位。';
      const rangeHint = unit.weapon.range[0] === 1 && unit.weapon.range[1] === 1
        ? '该武器为近战，射程 1 格。'
        : '该武器为远程，射程 ' + unit.weapon.range[0] + '–' + unit.weapon.range[1] + ' 格。';
      this.dom.contextText.innerHTML =
        targetHint + '<span class="hint-line">' + rangeHint + '攻击前会先显示红色范围。</span>';
      if(this.game.canActivateResonance(unit)) this.dom.contextText.innerHTML=
        '唤醒共鸣会消耗本次行动，永久开启中央四格浅滩（移动消耗 2）。';
      if(this.game.canAwakenBell(unit))this.dom.contextText.innerHTML=
        '唤醒「'+esc(this.game.bellAt(unit.x,unit.y).name)+'」会消耗本次行动，回复自身 30% 最大 HP，并惊动当地守卫。五处任选三处即可。';
      if(this.game.canLightLamp(unit))this.dom.contextText.innerHTML=
        '身旁是「'+esc(this.game.nearbyUnlitLamp(unit).name)+'」路灯。消耗本次行动，永久照亮周围 6 格；点灯后本回合不能再攻击。';

      const chest=this.game.nearbyChest(unit);
      if(chest)this.dom.contextText.innerHTML='身旁是「'+esc(chest.name)+'」。开箱消耗一把宝箱钥匙并结束行动。'+(this.game.canOpenChest(unit)?'':'请先击败携带钥匙的天马骑士，再让持有钥匙的角色靠近。');
      this.setActions([
        ...(chest?[{label:this.game.canOpenChest(unit)?'使用宝箱钥匙 · 开箱':'开箱 · 缺少宝箱钥匙',className:'primary',disabled:!this.game.canOpenChest(unit),onClick:()=>{
          const reward=this.game.openChest(unit);if(!reward)return;
          this.renderer.floatText('宝箱开启',reward.chest.x,reward.chest.y,'#ffe0a0',11);
          this.resetSelection();this.updateAll();
          this.showToast(reward.gold?'获得 '+reward.gold+' G！':'获得'+MyGO.Inventory.item(reward.drop.id).name+'，已放入'+reward.drop.location+'。','success',4500);
        }}]:[]),
        ...(this.game.canLightLamp(unit)?[{label:'点亮路灯 · '+this.game.nearbyUnlitLamp(unit).name,className:'primary',onClick:()=>{
          const wasFound=this.game.bossDiscovered,lamp=this.game.lightLamp(unit);if(!lamp)return;
          this.renderer.floatText('路灯点亮',lamp.x,lamp.y,'#ffe0a0',11);
          this.resetSelection();this.updateAll();
          const discovery=!wasFound&&this.game.bossDiscovered?'那道幻影……往日之影长崎爽世！由爽世亲手击败可获双倍击破经验。':'';
          this.showToast('路灯亮起。'+this.game.parkSoundHint()+' 开关声也惊动了附近的黑影。'+discovery,'info',6500);
        }}]:[]),
        ...(this.game.canAwakenBell(unit)?[{label:'唤醒星铃 · '+this.game.bellAt(unit.x,unit.y).name,className:'primary',onClick:()=>{
          const bell=this.game.awakenBell(unit);if(!bell)return;
          this.renderer.floatText('星铃苏醒',unit.x,unit.y,'#a0ffdf',11);
          this.resetSelection();this.updateAll();
          this.showToast(bell.name+'已唤醒（'+this.game.awakenedBells.length+'/3），当地守卫已警觉。','success',3200);
          if(this.game.isOver())this.showEndScreen();
        }}]:[]),
        ...(this.game.canUseGateKey(unit) ? [{label:this.game.stage===9?'使用门的钥匙 · 开启奇怪的门':'使用内庭钥匙 · 开门',className:'primary',onClick:()=>this.showGateKeyPrompt(unit)}] : []),
        ...(this.game.canActivateResonance(unit) ? [{label:'唤醒共鸣 · 开通浅滩',className:'primary',onClick:()=>{
          if(!this.game.activateResonance(unit)) return;
          this.renderer.terrainLayer=null;
          this.resetSelection();
          this.updateAll();
          this.showToast('共鸣已唤醒！中央浅滩永久开放，移动消耗 2。', 'info', 4000);
        }}] : []),
        {
          html: '攻击 <span class="count">' + targets.length + '</span>',
          className: 'attack',
          disabled: targets.length === 0,
          onClick: () => this.enterAttackMode()
        },
        {
          label: '待机',
          className: 'primary',
          onClick: () => this.waitActiveUnit()
        },
        {
          label: this.moved ? '撤回移动' : '取消',
          onClick: () => {
            if (this.moved) this.revertMove();
            else this.resetSelection();
          }
        }
      ]);
    }

    showGateKeyPrompt(unit) {
      if (this.busy || !this.game.canUseGateKey(unit)) return;
      if(this.game.stage===9){this.openNinthDoor(unit);return;}
      this.confirmHandler = () => {
        const gate = this.game.useGateKey(unit);
        if (!gate) return;
        this.renderer.terrainLayer = null;
        this.renderer.floatText('门开了', gate.x, gate.y - 0.2, '#ffe08a', 9);
        this.renderer.shake(260, 2);
        this.resetSelection({silent:true});
        this.updateAll();
        this.showToast(unit.name + '使用了内庭钥匙，大门开启！', 'success', 2800);
      };
      this.openOverlay('<div class="modal-kicker">USE KEY</div>' +
        '<h2 class="modal-title" id="overlay-title">使用内庭钥匙开门？</h2>' +
        '<p class="modal-sub">' + esc(unit.name) + '的背包中持有内庭钥匙。使用后消耗钥匙并结束本次行动，内庭敌人将恢复行动。</p>' +
        '<div class="modal-actions"><button class="modal-btn" data-overlay-close>暂不开门</button>' +
        '<button class="modal-btn primary" data-confirm>使用钥匙</button></div>', '', true);
    }

    renderAttackSide(unit) {
      const targets = this.game.getAttackableEnemies(unit);
      this.actionTargets = targets;
      this.dom.contextTitle.textContent = '选择攻击目标';
      const names = targets.map((target) => target.name).join('、');
      this.dom.contextText.innerHTML =
        '红色区域为攻击范围。点击范围内的敌人发动攻击。' +
        '<span class="hint-line">目标：' + esc(names) + '</span>';
      this.setActions([
        {
          label: '返回行动',
          className: 'primary',
          onClick: () => this.enterActionMode()
        },
        {
          label: '待机',
          onClick: () => this.waitActiveUnit()
        }
      ]);
    }

    showHoverForecast(target) {
      const active = this.game.getUnit(this.activeId);
      if (!active || this.busy) return;
      let preview;
      try {
        preview = this.game.previewCombat(active, target);
      } catch (err) {
        return;
      }
      this.hoveredTargetId = target.id;
      this.dom.contextTitle.textContent = '攻击预告 · ' + target.name;
      this.dom.contextText.innerHTML =
        '<div class="forecast-strip"><span>命中 HIT<b>' + preview.hit + '%</b></span>' +
        '<span>伤害 DMG<b class="damage">' + preview.damage + (preview.attackCount > 1 ? ' ×2' : '') + '</b></span>' +
        '<span>暴击 CRT<b>' + preview.crit + '%</b></span></div>' +
        '<span class="hint-line">' + esc(preview.damageTypeName) + ' · ' + esc(preview.triangleLabel) +
        ' · 地形回避 +' + preview.terrainAvoid + '</span>' +
        (preview.canCounter ? '<div class="forecast-strip counter-forecast"><span>反击命中<b>' + preview.counter.hit + '%</b></span>' +
          '<span>反击伤害<b class="damage">' + preview.counter.damage + (preview.counterCount > 1 ? ' ×2' : '') + '</b></span>' +
          '<span>反击暴击<b>' + preview.counter.crit + '%</b></span></div>'
          : '<span class="hint-line">无法反击 · ' + esc(preview.counterReason) + '</span>') +
        '<span class="hint-line">攻速 ' + preview.attackSpeed + ' / ' + preview.defenderAttackSpeed +
        ' · ' + preview.order.map(s => (s.attackerId === active.id ? '我方' : '敌方') +
          (s.kind === 'counter' ? '反击' : s.kind === 'followup' ? '追击' : '首击')+(s.resourceConditional?'（须触发爱笑女孩保留次数）':'')).join(' → ') +
        '<br>任一方被击倒，后续攻击取消。</span>';
    }

    renderIdleInfo() {
      if (this.game.phase === 'enemy') {
        this.renderEnemyPhaseInfo();
        return;
      }
      if (this.game.phase === 'victory' || this.game.phase === 'defeat') {
        return;
      }

      this.dom.portraitBlock.dataset.side = 'terrain';
      this.dom.portraitBadge.textContent = '战场';
      this.dom.portraitLevel.textContent = 'M0'+this.game.stage;
      this.drawTerrainPortrait(this.dom.infoPortrait, 'plain');
      this.dom.infoName.textContent = this.game.mission.title;
      this.dom.infoTags.innerHTML = [
        '<span class="tag gold">' + esc(this.game.mission.chapter) + '</span>',
        '<span class="tag">' + esc(this.game.mission.mapName) + '</span>',
        '<span class="tag">第 ' + this.game.turn + ' 回合</span>'
      ].join('');
      const open = this.game.gateOpen;
      const steps = this.game.stage===11?[['突破宫门','沿中央红毯推进，或从立柱两侧回廊迂回。'],['防备骑兵突击','战马骑士移动7格，先查看威胁范围；魔法突破重装，弓应对天马。'],['击败金鬃卫长','王座前的金甲白马为精英Boss，击败即可通关。两侧圣泉可提供据点防护与回复。']]:this.game.stage===10?[['与昴会合','开场对话后昴直接入队，可施法攻击并支援队伍。'],['辨认真正的仁菜','紫黑色幻影是拳斗士，钢拳套具有连续攻击。保护脆弱后排，集中火力应对。'],['清除所有敌人','幻影倒下后仍须击败四周幻兵、重装与天马。右上角显示剩余敌人数量。']]:this.game.stage===9?[['向门推进','沿中央地毯北上，利用音箱与乐器架分流敌人。'],['击败裂空天马','苍蓝羽光与双环光晕标记 Boss。弓对飞行有效；击败后获得门的钥匙与钢枪。'],['打开奇怪的门','击败 Boss 后仍可行动。队员走到最北端门旁使用钥匙；运输队与暂存中的门钥匙也可直接使用。开门后继续本关，与昴会合并全歼后半段敌军。']]:this.game.stage===8?[['击败两名幻影','向舞台最深处推进，同时击败术士爽世之影与佣兵灯之影即可获胜。'],['破甲与防空','重装高守备低魔防，使用魔法；携钥天马机动很高，注意弓的飞行特效。'],['三个宝箱','三名携钥天马各掉一把钥匙。西箱中级转职证，东箱1500 G，后台钢剑。击败最后一名幻影前完成搜宝。']]:this.game.stage===7?[['回应求助','开场回应虹夏后，她立即成为可操控同伴。'],['清理演出厅','利用两侧通道绕过设备，逐组击败失真回声。'],['夺回舞台','舞台上的敌人也要全部击败；右上角显示剩余敌人。']]:this.game.stage===6?[
        ['沿中央林荫道向北','从南部中央出发，穿过池塘、长椅与花圃，到达十八盏宫廷立灯围绕的王座。滚轮或触摸拖动纵向查看地图，点击同伴自动跟随。'],
        ['防备暗幕召唤','推进越过四个区段后，敌方阶段每轮最多召唤一波，混合普通兵、重装和天马。新援军当轮不行动。'],
        ['保持队形并应对兵种','援军会在队伍附近出现。用弓防空、用魔法破甲，保护后排并利用休憩据点恢复。'],
        ['逼退神秘面具人','面具人不会死亡。压至1 HP后她将传送离开，随即通关，无需全灭召唤物。']
      ]:this.game.stage===5?[
        ['双桥推进','北桥与南桥均通往东侧广场；可集中突破，也可分兵牵制。'],
        ['破甲与防空','重装高守备低魔防，使用魔法或破甲武器；天马可越水，弓具有飞行特效。'],
        ['天马骑士与宝箱','湖上两名天马骑士各掉一把钥匙；Boss身旁两名较弱的天马护卫不带钥匙。持有者在宝箱旁开箱。北箱特效药，南箱500 G。'],
        ['重装统领','击败铁幕守卫长立即通关，掉落中级转职证与钢斧，先搜集宝箱。']
      ]:this.game.stage===4?[
        ['探索并点亮路灯 '+this.game.litLamps.length+'/6','在视野内自行寻找路灯；停在灯旁 1 格内，在行动菜单消耗一次行动点灯。灯光永久照亮周围 6 格。'],
        ['最近听到的声音',this.game.parkSoundHint()],
        ['找到并击败神秘幻影','击败往日之影长崎爽世即可通关。由我方爽世完成最后一击（包括反击），本次击破经验翻倍。'],
        ['提防黑暗中的巡猎','敌军能在灯光之外察觉队伍，分批主动巡猎。点灯声会惊动附近敌人；留人掩护，避免让落单同伴被包围。敌军仍随队伍平均等级成长，Boss 高 2 级。']
      ]:this.game.stage === 3 ? [
        ['向南部中央广场推进','从北部中央出发；中央大道最快，左右花巷可分兵绕过哨兵。第四回合南部围兵全面逼近，请尽快救援。'],
        ['支援井芹仁菜',this.game.ninaLost?'仁菜已经阵亡，本次旅途将永久失去招募机会；仍可击败剩余敌人完成本关。':'仁菜 Lv.7 · 战士 · 铁拳套，由 AI 自主抵抗。靠近她分担围攻，也可用辅助治疗支援友军。'],
        ['击败全部敌人','存活的仁菜会在通关后加入同行之人；她阵亡不会导致任务失败。']
      ] : this.game.stage === 2 ? [
        ['择路探访花镇', '西侧花屋、南方约定屋、北方回忆屋、东侧心愿屋与晨光屋各有星铃；可选择分兵或集中推进。'],
        ['唤醒星铃 '+this.game.awakenedBells.length+'/3', '停在星铃格，在行动菜单唤醒；回复自身 30% HP，并惊动当地守卫。五处任选三处。'],
        ['击败露台上的指挥家', this.game.getUnit('conductor').dead?'指挥家已被击败，完成星铃目标即可通关。':'穿过中央集市或沿北侧花林迂回，击败东北露台的指挥家。无需全灭敌军。']
      ] : [
        ['选择渡河路线', '北桥有林地掩护，南桥适合集结；在西岸共鸣碑消耗行动，可开启中央浅滩。'],
        ['取回失落的钥匙', '击破东南方的钥匙影弓，内庭钥匙进入击败者背包。'],
        ['推开封闭的门', open ? '内庭南门已经开启。' : '让钥匙持有者走到内庭门旁，确认使用钥匙开门。'],
        ['与雪月交锋', '击败剑士雪月与全部敌人；通关后招募雪月，第二关加入队伍。']
      ];
      this.dom.infoBody.innerHTML = '<div class="mission-info"><strong>胜利条件</strong><p>' +
        esc(this.game.mission.objective) + '</p></div><ol class="seal-progress">' +
        steps.map((step, i) => '<li class="' + (this.game.stage === 1 && (open ? i === 2 : i === 0) ? 'is-current' : '') + '"><i><b>' + (i + 1) +
          '</b></i><div><strong>' + esc(step[0]) + '</strong><small>' + esc(step[1]) + '</small></div></li>').join('') +
        '</ol>'+(this.game.stage===2?'<div class="bell-directory">'+this.game.mission.bells.map((b,i)=>
          '<button type="button" data-bell-focus="'+b.id+'">'+(this.game.awakenedBells.includes(b.id)?'✓ ':'')+(i+1)+' · '+esc(b.name)+
          ' <small>'+columnLabel(b.x)+(b.y+1)+'</small></button>').join('')+'</div>':'')+
        '<div class="mission-quote">“即使声音被封闭，我也想再相信一次。”</div>';
      if(this.game.stage===2)this.dom.infoBody.querySelectorAll('[data-bell-focus]').forEach(button=>button.addEventListener('click',()=>{
        const b=this.game.mission.bells.find(b=>b.id===button.dataset.bellFocus);
        this.revealCell(b.x,b.y);this.renderTerrainInfo(b.x,b.y);
      }));
      this.dom.contextTitle.textContent = '行动指引';
      this.dom.contextText.innerHTML =
        C.TEXT.hints.idle +
        '<span class="hint-line">' +
        (this.game.stage>=5?this.game.mission.gateHint:this.game.stage===4?'找到路灯后在灯旁选择「点亮路灯」，留意随之传来的声音方向。黑暗中的敌人会主动靠近，也会被点灯声惊动，请安排掩护。':this.game.stage === 3
          ? '仁菜位于南部中央，绿色友军由 AI 控制。请尽快赶到她身边；仁菜阵亡仍可通关，但永久失去招募机会。'
          : this.game.stage === 2
          ? '五处星铃任选三处 + 击败指挥家。中央集市便于转线，花林提供掩护；沿房舍外侧可绕开部分警戒队。点击编号星铃查看位置。'
          : (this.game.gateOpen
            ? '大门已开启。进入庭院，击破首领与全部敌人。'
            : '敌人分区警戒：沿可通行地形接近，或攻击任一成员会惊动整队。点击敌人查看警戒距离；据点可以回复 HP。')) +
        '</span>';
      this.setActions([
        ...(this.game.stage===3 ? [{label:'查看仁菜 · 救援目标',onClick:()=>this.inspectUnit(this.game.getUnit('nina'))}] : []),
        {
          label: '玩法说明',
          onClick: () => this.showHelp()
        }
      ]);
    }

    renderEnemyPhaseInfo() {
      this.dom.portraitBlock.dataset.side = 'enemy';
      this.dom.portraitBadge.textContent = '敌方';
      this.dom.portraitLevel.textContent = 'ACT';
      this.drawTerrainPortrait(this.dom.infoPortrait, 'mountain');
      this.dom.infoName.textContent = '迷途回声正在行动';
      this.dom.infoTags.innerHTML =
        '<span class="tag side-enemy">敌方阶段</span><span class="tag">自动行动</span>';
      this.dom.infoBody.innerHTML =
        '<div class="mission-info">敌方会优先接近最近的单位；距离相同时，优先攻击当前 HP 最低的目标。' +
        '<div class="mission-quote">请稍候，战斗结算需要确认时页面会暂停。</div></div>';
      this.dom.contextTitle.textContent = 'ENEMY PHASE';
      this.dom.contextText.innerHTML = '迷途回声正在逼近，请留意同伴的生命值。' +
        '<span class="hint-line">同伴存活且射程覆盖敌人时会自动反击；已行动仍可反击。攻速差至少 4 可追击。</span>';
      this.setActions([{ label: '敌方行动中…', disabled: true }]);
    }

    renderTerrainInfo(x, y) {
      const rawTerrain = this.game.getTerrain(x, y);
      const names={plain:['排练室地毯','室内地毯，移动消耗 1。'],road:['中央导向地毯','沿地毯向北推进，最北端是奇怪的门。'],wall:['隔音墙 / 排练设备','吸音墙与固定设备无法通行。'],gate:['奇怪的门','击败裂空天马取得钥匙后，队员站在门旁选择开门。钥匙在运输队或暂存中也可使用。'],gateOpen:['开启的奇怪的门','钥匙已化作光芒，出口开启。']};
      if(this.game.stage===10)names.gateOpen=['回环之门','门后依然是同一间排练室。本关需击败全部敌人，无需再次使用钥匙。'];
      if(this.game.stage===11)Object.assign(names,{plaza:['宫殿大理石地面','金白色大理石大厅，可通行。'],road:['宫廷红毯','通往北端王座厅的中央大道。'],wall:['宫墙与立柱','不可通行；骑兵与飞行单位也无法穿过。'],fort:['宫廷圣泉','守备＋2、回避＋10；我方回合开始回复20%生命。']});
      const local=this.game.stage>=9?names[rawTerrain.id]:null;
      const terrain=local?{...rawTerrain,name:local[0],desc:local[1]}:rawTerrain;
      const bell=this.game.bellAt(x,y);
      const chest=[5,8].includes(this.game.stage)?this.game.mission.chests.find(c=>c.x===x&&c.y===y):null;
      this.dom.portraitBlock.dataset.side = 'terrain';
      this.dom.portraitBadge.textContent = '地形';
      this.dom.portraitLevel.textContent = columnLabel(x) + (y + 1);
      this.drawTerrainPortrait(this.dom.infoPortrait, terrain.id);
      this.dom.infoName.textContent = chest?chest.name:bell ? bell.name : terrain.name;
      this.dom.infoTags.innerHTML =
        '<span class="tag gold">地形</span>' +
        '<span class="tag">坐标 ' + columnLabel(x) + (y + 1) + '</span>' +
        '<span class="tag">' + (terrain.blocked ? '不可通行' : '可通行') + '</span>';
      this.dom.infoBody.innerHTML = [
        '<div class="terrain-info">',
        '  <div class="terrain-name-line"><strong>' + esc(terrain.name) + '</strong></div>',
        '  <div class="terrain-desc">' + esc(terrain.desc) + '</div>',
        '  <div class="effect-chips">',
        '    <span class="effect-chip">移动消耗 ' + (terrain.blocked ? '—' : terrain.moveCost) + '</span>',
        '    <span class="effect-chip">闪避 +' + terrain.avoid + '</span>',
        '    <span class="effect-chip">守备 +' + terrain.def + '</span>',
        '  </div>',
        '</div>'
      ].join('');
      this.dom.contextTitle.textContent = '地形情报';
      this.dom.contextText.innerHTML =
        '单位站上该格时获得对应加成；攻击判定读取<strong>防守方</strong>脚下的地形。' +
        '<span class="hint-line">点击空地查看地形，点击其他单位切换情报。</span>';
      if(chest)this.dom.contextText.innerHTML=this.game.openedChests.includes(chest.id)?'这只宝箱已经开启。':'持有宝箱钥匙的我方角色站在宝箱上或相邻1格，在行动菜单选择开箱。内容：'+(chest.gold?chest.gold+' G':MyGO.Inventory.item(chest.item).name)+'。击败携带钥匙的天马骑士可获得钥匙。';
      if(bell)this.dom.contextText.innerHTML=this.game.awakenedBells.includes(bell.id)
        ? '这处星铃已唤醒。当前进度 '+this.game.awakenedBells.length+'/3。'
        : '星铃仍在沉睡。我方停在此格后选择「唤醒星铃」，消耗一次行动并回复自身 30% 最大 HP。';
      this.setActions([
        {
          label: '返回任务',
          onClick: () => {
            this.inspectedId = null;
            this.setView();
            this.renderIdleInfo();
          }
        }
      ]);
    }

    refreshEnemyThreat() {
      if(!this.enemyThreatId)return;
      const unit=this.game.getUnit(this.enemyThreatId);
      if(this.enemyThreatGame!==this.game||!this.game.isPlayerPhase()||this.game.isOver()||
        !unit||unit.dead||unit.escaped||!this.game.isUnitVisible(unit)){
        this.enemyThreatId=null;this.enemyThreatTiles=new Set();
      }else this.enemyThreatTiles=this.game.getEnemyThreatTiles(unit);
      this.renderer.setView({...this.renderer.view,enemyThreatTiles:this.enemyThreatTiles});
    }

    toggleEnemyThreat(unit) {
      if(this.busy||this.chapterOpen||!this.game.isPlayerPhase()||this.game.isOver()||
        unit.side!=='enemy'||unit.dead||unit.escaped||!this.game.isUnitVisible(unit))return;
      const showing=this.enemyThreatId!==unit.id;
      this.enemyThreatId=showing?unit.id:null;
      this.enemyThreatGame=this.game;
      this.enemyThreatTiles=showing?this.game.getEnemyThreatTiles(unit):new Set();
      if(this.mode==='idle')this.inspectUnit(unit);
      else this.setView();
      this.showToast(showing?(this.enemyThreatTiles.size?'橙色格：'+unit.name+'移动后可攻击的范围。再次点击该敌人可关闭。':unit.name+'当前没有可覆盖的攻击格。再次点击可取消查看。'):'已关闭敌方攻击范围。','info',2300);
    }

    inspectUnit(unit) {
      if(this.game.stage===4&&!this.game.isUnitVisible(unit))return;
      this.inspectedId = unit.id;
      this.setView();
      this.renderUnitInfo(unit);
      const enemy = unit.side === 'enemy';
      this.dom.contextTitle.textContent = enemy ? '敌方情报' : '单位情报';
      let detail = '“' + esc(unit.quote) + '”';
      if (enemy) {
        if(unit.guardGroup) {
          const groupName={west:this.game.stage===3?'西侧花巷':'西岸',north:'北桥',south:this.game.stage===3?'南部围兵':'南桥',siege:'广场围攻队',avenue:'中央大道',east:'东侧花巷',key:'钥匙区',approach:'内庭前沿',inner:'内庭',
            'moon-west':'西侧花屋','moon-southwest':'南方约定屋','moon-market':'中央集市',
            'moon-north':'北方回忆屋','moon-east':'东侧心愿屋','moon-stage':'晨光露台'}[unit.guardGroup]||'此区域';
          detail+='<span class="hint-line">所属警戒队：'+groupName+' · '+
            this.game.living('enemy').filter(u=>u.guardGroup===unit.guardGroup).length+' 人。'+
            (unit.alerted?'全队已惊动，持续追击。':this.game.stage===3&&unit.guardGroup==='south'?'第四回合全面逼近；提前接近或攻击也会惊动守卫。':unit.guardRadius?'接近 '+unit.guardRadius+' 移动点内或攻击任一队员，会惊动全队。':this.game.stage===3?'开场即与仁菜交战。':'开门后行动。')+'</span>';
        }
        if([5,8,9].includes(this.game.stage)&&unit.drops.length)detail+='<span class="hint-line">击败掉落：'+unit.drops.map(id=>esc(MyGO.Inventory.item(id).name)).join('、')+'。'+(this.game.stage===9?'击败后取得钥匙与钢枪，再到北端门旁开门，继续本关后半段。':unit.boss?'击败后立即通关，请先搜集宝箱。':'钥匙进入击败者背包；背包已满会自动腾位或送入运输队。')+'</span>';
        detail += '<span class="hint-line">攻击范围 ' + unit.weapon.range[0] + '–' + unit.weapon.range[1] +
          ' 格 · 基础命中 ' + Combat.hitOf(unit) + ' · 基础暴击率 ' + Combat.critRateOf(unit) + '% · 必杀回避 ' + Combat.critAvoidOf(unit) + '</span>';
        if(this.enemyThreatId===unit.id)detail+='<span class="hint-line">橙色格显示该单位移动后可攻击的范围；再次点击该敌人可关闭。</span>';
      } else if (unit.side === 'ally') {
        detail+='<span class="hint-line">由 AI 控制的友军。每回合在我方行动结束后自主抵抗附近敌人；可接受我方辅助治疗。存活到全灭敌军即可加入，阵亡不会导致任务失败。</span>';
      } else if (unit.acted) {
        detail += '<span class="hint-line">本回合已行动，下回合会重新恢复。</span>';
      }
      this.dom.contextText.innerHTML = detail;
      this.setActions([
        {
          label: '返回任务',
          onClick: () => {
            this.inspectedId = null;
            this.setView();
            this.renderIdleInfo();
          }
        }
      ]);
      this.revealCell(unit.x, unit.y);
    }

    /* ============================================================
     * 战斗流程：特写 → 结算弹窗 → 确认后扣血
     * ============================================================ */

    async playerAttack(target) {
      if (this.busy) return;
      const attacker = this.game.getUnit(this.activeId);
      if (!attacker || !target || !this.targetIds.has(target.id)) return;
      this.setBusy(true);
      try {
        const result = await this.performAttackSequence(attacker, target, false);
        this.game.markActed(attacker,true);
        this.setBusy(false);
        this.resetSelection();
        this.updateAll();
        // Keep the pickup and full-bag notice visible after combat cleanup.
        if (result && !result.keyRecipientId && !result.drops?.length && !result.strikes?.some(s=>s.applied&&s.killed&&s.defenderId==='nina') && result.strikes) {
          this.showToast('交战结束 · 造成 ' + result.finalDamage + ' 伤害，承受反击 ' + result.counterDamage + ' 伤害。', 'info', 2400);
        } else if (result && !result.keyRecipientId && !result.drops?.length && result.hit) {
          this.showToast(
            result.crit
              ? '暴击！' + target.name + ' 受到 ' + result.finalDamage + ' 伤害。'
              : target.name + ' 受到 ' + result.finalDamage + ' 伤害。',
            result.crit ? 'success' : 'info',
            1800
          );
        }
        if (this.game.isOver()) {
          await sleep(420);
          this.showEndScreen();
        }
      } catch (err) {
        this.handleError(err);
      }
    }

    async performAttackSequence(attacker, defender, isEnemy) {
      const result = this.game.rollCombat(attacker, defender);
      // Rehearse the locked exchange using copies: both HP bars carry across
      // strikes, while real HP remains unchanged until the single confirmation.
      const actors = new Map([[attacker.id,{...attacker}], [defender.id,{...defender}]]);
      for (const strike of result.strikes) {
        const a = actors.get(strike.attackerId), b = actors.get(strike.defenderId);
        a.weapon = strike.weaponSnapshot || a.weapon;
        await this.showCutin(a, b, strike);
        if(strike.attackerHpAfterStrike!==undefined)a.hp=strike.attackerHpAfterStrike;
        b.hp = strike.hpAfter;
      }
      await this.showResultModal(result, isEnemy);
      const applied = this.game.applyCombat(result);
      for(const id of new Set(applied.strikes.filter(s=>s.applied&&s.talentResDown).map(s=>s.defenderId))){
        const u=this.game.getUnit(id);this.renderer.floatText('魔力打击 · 魔防−2',u.x,u.y-0.65,'#cdb4f4',10);
      }
      for(const id of new Set(applied.strikes.filter(s=>s.applied&&s.frostApplied).map(s=>s.defenderId))){
        const u=this.game.getUnit(id);this.renderer.floatText('冰霜剑气 · 速度−3',u.x,u.y-0.65,'#a6e8ff',10);
      }

      for (const strike of applied.strikes.filter(s=>s.applied)) {
        const target = this.game.getUnit(strike.defenderId);
        if(strike.talentHealed){const actor=this.game.getUnit(strike.attackerId);this.renderer.floatText('战斗爽 +'+strike.talentHealed,actor.x,actor.y-0.5,'#bcebd7',11);}
        if(strike.resourcePreserved){const actor=this.game.getUnit(strike.attackerId);this.renderer.floatText('爱笑女孩 · 未消耗次数',actor.x,actor.y-0.8,'#f5d7eb',10);}
        if(strike.angel){
          const actor=this.game.getUnit(strike.attackerId);this.renderer.floatText('天使 −'+strike.angel.cost+' HP',actor.x,actor.y-0.5,'#f5d7eb',11);
          for(const c of strike.angel.healing){const u=this.game.getUnit(c.id);this.renderer.floatText('天使 +'+c.amount,u.x,u.y-0.5,'#bcebd7',11);}
        }
        if (strike.hit) {
          this.renderer.flash(target.id, strike.crit ? 'rgba(255, 209, 102, 0.72)' : 'rgba(255, 80, 110, 0.65)', 380);
          this.renderer.floatText('-' + strike.finalDamage, target.x, target.y, strike.crit ? '#ffe08a' : '#ff8fa4', strike.crit ? 12 : 10);
          if (strike.crit) {
            this.renderer.critBurst(target.x, target.y);
            this.renderer.shake(360, 3);
          }
        } else {
          this.renderer.floatText('MISS', target.x, target.y, '#78e6ee', 10);
        }
        if (strike.killed) {
          this.renderer.floatText('击破', target.x, target.y - 0.35, '#ffd166', 9);
        }
      }
      await this.showGrowthResults(applied.experience);
      if(applied.retreatTriggered&&this.game.stage===6)await this.playMaskedEscape();
      if(applied.drops?.length)this.showToast('获得战利品：'+applied.drops.map(d=>MyGO.Inventory.item(d.id).name+' → '+d.location).join('；')+(applied.drops.some(d=>d.id==='chest_key')?'。持钥匙者靠近宝箱后选择开箱。':''),'success',7000);
      if (applied.keyRecipientId) {
        const holder = this.game.getUnit(applied.keyRecipientId);
        const stored = applied.storedForKey ? '背包已满，' + MyGO.Inventory.item(applied.storedForKey.id).name + '已送回运输队。' : '';
        this.showToast('内庭钥匙已放入' + holder.name + '的背包。' + stored + '走到内庭门旁使用钥匙开门。', 'success', 5500);
      }
      if(applied.strikes.some(s=>s.applied&&s.killed&&s.defenderId==='nina'))
        this.showToast('仁菜倒下了……任务仍可继续，但今后将无法招募她。','error',6500);
      this.updateAll();
      return applied;
    }

    async showGrowthResults(reports) {
      if(!reports?.length)return;
      for(const report of reports){const u=this.game.getUnit(report.unitId);
        if(report.bonus)this.showToast(report.bonus+' · EXP +'+report.gained,'success',5000);
        this.renderer.floatText('EXP +'+report.gained,u.x,u.y-0.6,'#d5e6aa',10);}
      const leveled=reports.filter(r=>r.levels.length);
      if(!leveled.length)return;
      this.updateAll();
      await new Promise(resolve=>{
        this.openOverlay('<div class="modal-kicker">LEVEL UP / GROWTH</div><h2 class="modal-title" id="overlay-title">成长的足迹</h2>'+
          leveled.map(r=>'<section class="growth-level"><h3>'+esc(r.name)+' <span>Lv.'+r.before.level+' → Lv.'+r.after.level+'</span></h3><p>经验 +'+r.gained+' · '+(r.after.level>=99?'已达最高等级':r.after.exp+' / '+r.after.required+' EXP')+'</p>'+
            r.levels.map(l=>'<div class="growth-level-grid">'+MyGO.GrowthData.keys.map(k=>'<div class="'+(l.after[k]>l.before[k]?'is-up':'')+'"><span>'+MyGO.GrowthData.labels[k]+'</span><strong>'+l.before[k]+' → '+l.after[k]+'</strong><b>'+(l.after[k]!==l.before[k]?'+'+(l.after[k]-l.before[k]):'—')+'</b></div>').join('')+'</div>'+(l.awakened?'<p class="learned-spells-notice">个人天赋'+(l.awakened.slot||1)+'觉醒：'+esc(l.awakened.name)+' · '+esc(l.awakened.description)+'</p>':'')+(l.learned?.length?'<p class="learned-spells-notice">新习得：'+l.learned.map(id=>esc(MyGO.Magic.get(id).name)).join('、')+'</p>':'')).join('')+'</section>').join('')+
          '<p class="modal-sub">属性提升已生效，成长结果会随存档与跨章保留。</p><div class="modal-actions"><button class="modal-btn primary" data-confirm>继续前行</button></div>','growth-modal',false);
        this.confirmHandler=resolve;
      });
    }

    showRecruitment(unit) {
      return new Promise(resolve => {
        this.confirmHandler = resolve;
        this.openOverlay('<div class="modal-kicker">NEW COMPANION</div>' +
          '<h2 class="modal-title" id="overlay-title">雪月加入同行之人</h2>' +
          '<canvas id="recruit-portrait" width="180" height="210" style="display:block;margin:0 auto"></canvas>' +
          '<p class="modal-sub">“心声已经传达到了。今后，请让我与你同行。”</p>' +
          '<div class="modal-section">剑士 · 铁剑<br>第一关已经通关，雪月决定与你们同行。<br>从第二关开始加入队伍，可在「同行之人」查看能力与背包。</div>' +
          '<div class="modal-actions"><button class="modal-btn primary" data-confirm>一起前行</button></div>', 'recruitment-card', false);
        const canvas = document.getElementById('recruit-portrait');
        const ctx = canvas.getContext('2d');
        MyGO.Characters.drawPortrait(ctx, unit.id, 0, 0, canvas.width, canvas.height);
      });
    }

    showNinaRecruitment() {
      return new Promise(resolve=>{
        this.confirmHandler=resolve;
        this.openOverlay('<div class="modal-kicker">RESCUED / NEW COMPANION</div>'+
          '<h2 class="modal-title" id="overlay-title">井芹仁菜加入同行之人</h2>'+
          '<canvas id="nina-recruit-portrait" width="180" height="210" style="display:block;margin:0 auto"></canvas>'+
          '<p class="modal-sub">“明明只是在家里睡了一觉，睁开眼就被怪物围住了……<br>刚才战斗的时候，我看见你们朝这边跑来。谢谢你们。”</p>'+
          '<div class="modal-section">Lv.7 起始 · 战士 · 铁拳套<br>“我叫井芹仁菜。既然大家都在找回去的路，那就让我也一起走吧！”<br>已加入「同行之人」，保留救援后的生命与拳套耐久。</div>'+
          '<div class="modal-actions"><button class="modal-btn primary" data-confirm>欢迎同行，仁菜</button></div>', 'recruitment-card', false);
        const canvas=document.getElementById('nina-recruit-portrait');
        MyGO.Characters.drawPortrait(canvas.getContext('2d'),'nina',0,0,canvas.width,canvas.height);
      });
    }

    /**
     * 播放侧视战斗演出。
     * result 是已经锁定的 rollCombat 结果，演出只做“预演”，
     * 真正的 HP 扣除仍要等 showResultModal 的确认按钮。
     */
    showCutin(attacker, defender, result, options) {
      return new Promise((resolve) => {
        const root = this.dom.cutin;
        let finished = false;

        const finish = () => {
          if (finished) return;
          finished = true;
          this.cutinSkip = null;
          root.classList.remove('active');
          setTimeout(() => {
            root.hidden = true;
            root.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('modal-open');
            resolve();
          }, 180);
        };

        this.cutinSkip = () => this.battle.skip();
        root.hidden = false;
        root.setAttribute('aria-hidden', 'false');
        root.classList.remove('active');
        document.body.classList.add('modal-open');
        void root.offsetWidth;
        root.classList.add('active');

        // play() 在自然播完或被 skip() 时 resolve；演示冻结模式除外。
        this.battle.play(attacker, defender, result, {...(options||{}),stage:this.game.stage,
          mission:this.game.mission,lampsLit:this.game.stage>=5||(this.game.litLamps||[]).length>0}).then(finish, (err) => {
          console.error('[battle] 演出失败', err);
          finish();
        });
      });
    }

    /**
     * 调试入口：?battle-demo=1|crit|freeze|axe|lance|bow|ice|fire|soyo
     * 六名角色支持 tomori/anon/rana/soyo/taki/xueyue 的动作与 -freeze。
     * 不改变实际游戏状态，仅用于检查不同武器的演出。
     */
    startBattleDemo(mode) {
      // 每个演示对应一种武器，方便逐个检查动作与魔法球配色。
      const demoPairs = {
        axe: ['taki', 'shadow_blade_1'],
        lance: ['rana', 'shadow_blade_1'],
        bow: ['anon', 'shadow_axe'],
        ice: ['soyo', 'shadow_axe'],
        fire: ['conductor', 'tomori']
      };
      const customId = /^(tomori|anon|rana|soyo|taki|xueyue)(?:-|$)/.exec(mode)?.[1] || null;
      const customDemo = !!customId;
      const customDefender = customDemo && /hurt|down|dodge/.test(mode);
      const pair = customDemo ? (customDefender ? [customId === 'xueyue' ? 'tomori' : 'shadow_blade_1', customId]
        : [customId, customId === 'xueyue' ? 'tomori' : 'shadow_axe'])
        : (demoPairs[mode] || ['tomori', 'shadow_axe']);
      const attacker = this.game.getUnit(pair[0]) || (pair[0] === 'conductor'
        ? MyGO.createUnit(C.UNITS.find(u => u.id === 'conductor')) : null);
      const defender = this.game.getUnit(pair[1]);
      if (!attacker || !defender) return;
      const preview = MyGO.Combat.preview(attacker, defender, this.game.map);
      const crit = mode === 'crit' || (customDemo && mode.includes('crit'));
      const hit = !(customDemo && mode.includes('dodge'));
      const damage = customDemo && mode.includes('down') ? defender.hp
        : !hit ? 0 : crit ? preview.damage * 2 : preview.damage;
      const result = Object.assign({}, preview, {
        hit,
        crit,
        hitChance: preview.hit,
        critChance: preview.crit,
        hitRoll: 17,
        hitRoll2: 17,
        critRoll: crit ? 3 : 88,
        finalDamage: damage,
        hpAfter: Math.max(0, defender.hp - damage)
      });
      let options = mode === 'freeze' ? { freezeAt: 0.62 } : undefined;
      if (customDemo && mode.endsWith('freeze')) {
        options = { freezeAt: mode.includes('down') ? 0.96 : mode.includes('dodge') ? 0.70
          : mode.includes('hurt') ? 0.68 : customId === 'soyo' || customId === 'anon' ? 0.52 : 0.60 };
      }
      if ((customId === 'taki' || customId === 'tomori' || customId === 'xueyue') && mode.includes('heavy')) {
        options = Object.assign({}, options, { action: 'attack2' });
      }
      this.showCutin(attacker, defender, result, options);
    }

    /** 独立招募验收场景；由 main.js 提供内存存档，正常游戏不会调用。 */
    startRecruitDemo() {
      this.game.openGate();
      this.game.living('enemy').forEach(u => { if (u.id !== 'xueyue') { u.hp = 0; u.dead = true; } });
      const boss = this.game.getUnit('xueyue');
      boss.hp = 1;
      const attacker = this.game.getUnit('tomori');
      Object.assign(attacker, { x: 28, y: 4, hit: 200 });
      this.renderer.snapUnit(attacker);
      this.updateAll();
      this.selectUnit(attacker);
      this.enterActionMode();
      this.enterAttackMode();
      this.showToast('招募演示 · 点击攻击雪月。演示存档仅保留在本页内存。', 'info', 6500);
    }

    /** 机关/回复验收场景，使用 main.js 注入的独立内存存档。 */
    startMapDemo() {
      for(const u of this.game.living('enemy')) if(!u.dormant) {u.dead=true;u.hp=0;}
      this.game.setUnitPosition('tomori',7,13);
      this.game.setUnitPosition('soyo',7,4);
      this.game.getUnit('soyo').hp=10;
      this.renderer.resetVisuals();this.updateAll();
      this.selectUnit(this.game.getUnit('tomori'));this.enterActionMode();
      this.showToast('机关验收 · 灯位于共鸣碑，爽世在据点（10/20 HP）。此页只使用内存存档。','info',6500);
    }

    /** Standalone acceptance fixtures; main.js isolates their saves in memory. */
    async startCounterDemo(mode) {
      const ally = this.game.getUnit(mode === 'ranged' ? 'anon' : 'tomori');
      const enemy = this.game.getUnit('shadow_axe');
      Object.assign(ally,{x:7,y:13,maxHp:40,hp:40,hit:200,lck:200,spd:10});
      Object.assign(enemy,{x:mode === 'ranged' ? 9 : 8,y:13,maxHp:40,hp:40,hit:200,lck:200,spd:6});
      this.renderer.resetVisuals();this.updateAll();
      if (mode === 'enemy') {
        this.setBusy(true);
        this.game.beginEnemyPhase();this.updateAll();
        try {
          await this.performAttackSequence(enemy,ally,true);
          if(!this.game.isOver())this.game.beginNextPlayerPhase();
        } catch(err) { this.handleError(err); }
        this.setBusy(false);this.resetSelection();this.updateAll();
      } else {
        this.selectUnit(ally);this.enterActionMode();this.enterAttackMode();
        this.showHoverForecast(enemy);
        this.showToast('反击验收 · 点击邻近影斧。此页只使用内存存档。','info',5000);
      }
    }

    showResultModal(result, isEnemy) {
      if (result.strikes) return this.showRoundResultModal(result, isEnemy);
      const hit = result.hit;
      const crit = result.crit;
      const hpAfter = hit ? result.hpAfter : result.defenderHp;
      const hpRatio = result.defenderMaxHp ? hpAfter / result.defenderMaxHp : 0;
      const title = crit ? '暴击！' : hit ? '命中' : '闪避';
      const titleClass = crit ? 'crit' : hit ? 'hit' : 'miss';
      const triangleClass = result.triangle > 0 ? '' : result.triangle < 0 ? 'disadvantage' : 'neutral';
      const critRow = crit
        ? '<b class="crit-text">暴击 · ' + result.critRoll + ' ≤ ' + result.critChance + '</b>'
        : '<b>' + (hit ? '未暴击' : '—') + '</b>';
      const damageText = hit
        ? '<b class="dmg-text">' + result.finalDamage + (crit ? '（×2）' : '') + '</b>'
        : '<b class="miss-text">0</b>';

      const html = [
        crit ? '<div class="crit-rays"></div>' : '',
        crit ? '<div class="crit-stamp">CRITICAL</div>' : '',
        '<div class="result-head">',
        '  <div class="modal-kicker">' + (isEnemy ? 'ENEMY ATTACK' : 'COMBAT RESULT') + '</div>',
        '  <h2 class="result-title ' + titleClass + '" id="overlay-title">' + title + '</h2>',
        '  <div class="result-sub">' + esc(result.attackerName) + ' → ' + esc(result.defenderName) + '</div>',
        '</div>',
        '<div class="result-rows">',
        '  <div class="result-row"><span>命中判定</span><b class="' + (hit ? '' : 'miss-text') + '">' +
          (hit ? '' : 'MISS · ') + '双随机数平均 ' + ((result.hitRoll + result.hitRoll2) / 2) + (hit ? ' &lt; ' : ' ≥ ') + result.hitChance + '</b></div>',
        '  <div class="result-row"><span>攻击力</span><b>' + result.attack +
          ' <em>' + (result.magic ? '魔力 ' + result.atkStat : '力量 ' + result.atkStat) +
          ' + 威力 ' + result.weaponPower + '</em></b></div>',
        '  <div class="result-row"><span>' + esc(result.defenseName) + '</span><b>' + result.defense +
          ' <em>' + (result.magic ? '魔法伤害' : '物理伤害') + '</em></b></div>',
        '  <div class="result-row"><span>伤害</span>' + damageText + '</div>',
        '  <div class="result-row"><span>暴击判定</span>' + critRow + '</div>',
        '  <div class="result-row"><span>武器三角</span><span class="triangle-badge ' + triangleClass + '">' +
          esc(result.triangleLabel) + '</span></div>',
        '  <div class="result-row"><span>地形修正</span><b>' + esc(result.terrainName) +
          ' · 闪避 +' + result.terrainAvoid + ' · ' +
          (result.magic ? '魔法不受地形守备加成' : '守备 +' + result.terrainDef) + '</b></div>',
        '</div>',
        '<div class="result-hpbar">',
        '  <div class="result-hp-label"><span>目标 HP</span><b>' + result.defenderHp + ' → ' + hpAfter + ' / ' + result.defenderMaxHp + '</b></div>',
        '  <div class="result-hp-track"><div class="result-hp-fill" style="width:' + pct(hpRatio) + '%"></div></div>',
        '</div>',
        '<div class="result-note">' + (crit
          ? '暴击高光！伤害 ×2。点击确认后才会扣除 HP。'
          : hit
            ? '点击“确认结算”后才会扣除 HP。'
            : '攻击被闪避，不会造成伤害。') +
          '<b> ' + result.attack + ' − ' + esc(result.defenseName) + ' ' + result.defense +
          ' = ' + result.damage + '</b></div>',
        '<div class="modal-actions">',
        '  <button class="modal-btn ' + (crit ? 'gold' : 'primary') + '" type="button" data-confirm>确认结算</button>',
        '</div>'
      ].join('');

      if (crit) {
        this.triggerScreenFlash();
        this.renderer.shake(280, 2);
      }

      return new Promise((resolve) => {
        this.confirmHandler = () => resolve(result);
        this.openOverlay(html, 'result-card' + (crit ? ' is-crit' : ''), false);
      });
    }

    showRoundResultModal(result, isEnemy) {
      const plan = result.forecast;
      const label = {attack:'首击',counter:'反击',followup:'追击',combo:'连击'};
      const rows = result.strikes.map((s,i) => '<div class="exchange-strike ' + (s.attackerSide !== 'enemy' ? 'is-player' : 'is-enemy') + '">' +
        '<span class="exchange-order">' + (i+1) + '</span><div><strong>' + label[s.kind] + ' · ' + esc(s.attackerName) +
        '</strong><small>→ ' + esc(s.defenderName) + ' · ' + esc(s.weaponName) + ' · 命中 ' + s.hitChance + '% · 暴击 ' + s.critChance + '%' +
        (s.healed ? ' · 吸取回复 ' + s.healed : '') +
        (s.talentHealed ? ' · 战斗爽回复 ' + s.talentHealed + ' HP' : '') +
        (s.resourcePreserved ? ' · 爱笑女孩：未消耗次数' : '') +
        (s.angel ? ' · 天使：自身−'+s.angel.cost+' HP，'+s.angel.healing.map(c=>esc(this.game.getUnit(c.id)?.name||c.id)+'＋'+c.amount+' HP').join('、') : '') + '</small></div>' +
        '<b class="' + (s.crit ? 'crit-text' : s.hit ? 'dmg-text' : 'miss-text') + '">' +
        (s.hit ? (s.crit ? '暴击 ' : '') + s.finalDamage : 'MISS') + '</b></div>').join('');
      const hp = (name,before,after,max) => '<div class="result-hpbar"><div class="result-hp-label"><span>' + esc(name) +
        '</span><b>' + before + ' → ' + after + ' / ' + max + '</b></div><div class="result-hp-track"><div class="result-hp-fill" style="width:' +
        pct(after/max) + '%"></div></div></div>';
      const html = '<div class="result-head"><div class="modal-kicker">COMBAT EXCHANGE / ' + (isEnemy ? 'ENEMY PHASE' : 'PLAYER PHASE') +
        '</div><h2 class="result-title hit" id="overlay-title">交战结算</h2><div class="result-sub">' + esc(result.attackerName) +
        ' ↔ ' + esc(result.defenderName) + '</div></div><div class="exchange-summary">' +
        '<span>攻速 AS <b>' + plan.attackSpeed + ' / ' + plan.defenderAttackSpeed + '</b></span><span>' +
        (plan.canCounter ? '射程内可反击' : '无法反击 · ' + esc(plan.counterReason)) + '</span></div><div class="exchange-list">' + rows + '</div>' +
        hp(result.attackerName,result.attackerHp,result.attackerHpAfter,result.attackerMaxHp) +
        hp(result.defenderName,result.defenderHp,result.defenderHpAfter,result.defenderMaxHp) +
        '<div class="result-note">' + (result.strikes.length < plan.order.length ? '因单位倒下、撤离或次数耗尽，后续攻击取消。' : '首击、反击与追击依次结算。') +
        ' 拳套主动攻击时两连击，反击时不会额外连击。反击不消耗行动。每次出手消耗 1 耐久或魔法次数，爱笑女孩触发时保留次数。点击确认后统一结算 HP、耐久和魔法次数。</div>' +
        '<div class="modal-actions"><button class="modal-btn primary" type="button" data-confirm>确认结算</button></div>';
      return new Promise(resolve => {
        this.confirmHandler = () => resolve(result);
        this.openOverlay(html, 'result-card exchange-card', false);
      });
    }

    /* ============================================================
     * 敌方回合
     * ============================================================ */

    canAutoEndTurn() {
      return !this.busy && !this.chapterOpen && !this.endShown && this.mode === 'idle' &&
        this.dom.overlayRoot?.hidden !== false && this.dom.chapterIntro?.hidden !== false &&
        !(MyGO.entry?.ui === this && !MyGO.entry.dom.root.hidden) &&
        this.game.isPlayerPhase() && !this.game.isOver() && this.game.allPlayerActed();
    }

    scheduleAutoEndTurn() {
      clearTimeout(this.autoEndTurnTimer);
      this.autoEndTurnTimer = null;
      if (!this.canAutoEndTurn()) return;
      const game = this.game, turn = game.turn;
      // Let the final action finish updating its feedback before changing phases.
      this.autoEndTurnTimer = setTimeout(() => {
        this.autoEndTurnTimer = null;
        if (this.game !== game || game.turn !== turn || !this.canAutoEndTurn()) return;
        this.endTurn();
      }, 350);
    }

    async endTurn() {
      if (this.busy || !this.game.isPlayerPhase() || this.game.isOver()) return;
      if (this.mode !== 'idle') {
        this.showToast('请先完成当前单位的行动（攻击 / 待机）。', 'error', 2000);
        return;
      }
      this.setBusy(true);
      this.resetSelection({ silent: true });
      if(this.game.beginAllyPhase()){
        this.showBanner('友军行动','井芹仁菜 · ALLY PHASE',1200);
        this.updateAll();
        try{
          for(const ally of this.game.living('ally')){
            if(this.game.isOver())break;
            await this.runEnemyAction(ally);
          }
        }catch(err){this.handleError(err);return;}
        if(this.game.isOver()){
          this.setBusy(false);this.resetSelection({silent:true});this.updateAll();this.showEndScreen();return;
        }
        this.game.finishAllyPhase();
      }else this.game.beginEnemyPhase();
      this.updateAll();
      this.renderEnemyPhaseInfo();
      this.showBanner('敌方行动', '第 ' + this.game.turn + ' 回合 · ENEMY PHASE', 1400);
      await sleep(1050);

      try {
        if(this.game.stage===6)await this.playSixthSummon();
        const enemies = this.game.living('enemy').slice();
        for (const enemy of enemies) {
          if (this.game.isOver()) break;
          if (enemy.dead || enemy.side !== 'enemy' || enemy.acted) continue;
          if (!this.game.isUnitActive(enemy)) {
            enemy.acted = true;
            continue;
          }
          await this.runEnemyAction(enemy);
          await sleep(240);
          if (this.game.isOver()) break;
        }

        if (this.game.isOver()) {
          this.setBusy(false);
          this.updateAll();
          this.showEndScreen();
          return;
        }

        this.game.beginNextPlayerPhase();
        this.resetSelection({ silent: true });
        this.setBusy(false);
        this.updateAll();
        this.renderIdleInfo();
        this.showBanner('第 ' + this.game.turn + ' 回合', '我方行动 · PLAYER PHASE', 1500);
        const healed=this.game.lastHealing.map(h=>this.game.getUnit(h.id).name+' 回复 '+h.amount+' HP');
        this.showToast(this.game.stage===3&&this.game.turn===4&&!this.game.ninaLost?'南部围兵开始全面逼近！尽快支援仁菜。':healed.length ? '据点休憩 · '+healed.join('，') : '轮到你了。选择我方单位开始行动。', 'info', 3000);
      } catch (err) {
        this.handleError(err);
      }
    }

    async runEnemyAction(enemy) {
      const plan = MyGO.AI.planAction(this.game, enemy);
      if(this.game.stage===4&&!this.game.isUnitVisible(enemy)){
        const visibleAt=(plan.path||[]).findIndex(p=>this.game.isVisible(p.x,p.y)&&
          (!this.game.unitAt(p.x,p.y)||this.game.unitAt(p.x,p.y).id===enemy.id));
        if(visibleAt<0){
          if(plan.destination)this.game.setUnitPosition(enemy.id,plan.destination.x,plan.destination.y);
          this.renderer.snapUnit(enemy);enemy.acted=true;this.updateAll();return;
        }
        // Reveal at the edge of vision, then play the remaining approach and attack.
        const entrance=plan.path[visibleAt];
        this.game.setUnitPosition(enemy.id,entrance.x,entrance.y);
        this.renderer.snapUnit(enemy);
        plan.path=plan.path.slice(visibleAt);
        this.updateAll();this.revealCell(entrance.x,entrance.y);
        this.showToast('黑暗中传来急促的脚步声——有敌人逼近！','error',3200);
      }
      this.inspectedId = enemy.id;
      this.mode = 'idle';
      this.setView();
      this.renderUnitInfo(enemy);
      this.dom.contextTitle.textContent = enemy.side==='ally'?'友军行动':'敌方行动';
      this.dom.contextText.innerHTML =
        '<strong>' + esc(enemy.name) + '</strong> 正在行动……' +
        '<span class="hint-line">'+(enemy.side==='ally'?'仁菜由 AI 自主抵抗附近敌人；玩家无法替她下达指令。':'敌方倾向于靠近最近的同伴，并攻击生命值较低者。')+'</span>';
      this.setActions([{ label: enemy.side==='ally'?'友军行动中…':'敌方行动中…', disabled: true }]);
      await sleep(360);

      if (plan.path && plan.path.length > 1) {
        this.renderer.setView({ mode: 'idle', selectedId: enemy.id });
        await this.renderer.animateMove(enemy.id, plan.path, 54);
        if (plan.destination) {
          try {
            this.game.setUnitPosition(enemy.id, plan.destination.x, plan.destination.y);
          } catch (err) {
            console.warn('AI 移动落点无效，跳过移动。', err);
          }
        }
        this.renderer.snapUnit(enemy);
        this.updateAll();
        await sleep(DELAY);
      }

      if (plan.type === 'attack' && plan.targetId) {
        const target = this.game.getUnit(plan.targetId);
        if (target && !target.dead && Pathfinding.canAttackFrom(enemy, enemy.x, enemy.y, target)) {
          this.renderUnitInfo(enemy);
          this.dom.contextText.innerHTML =
            '<strong>' + esc(enemy.name) + '</strong> 向 <strong>' + esc(target.name) + '</strong> 发起攻击！';
          await sleep(220);
          await this.performAttackSequence(enemy, target, enemy.side==='enemy');
          await sleep(260);
        }
      }

      enemy.acted = true;
      this.updateAll();
    }

    /* ============================================================
     * 存档 / 读档 / 说明 / 胜负
     * ============================================================ */

    saveGame() {
      if (this.busy) return;
      if (!this.game.isPlayerPhase() && this.game.phase !== 'victory') {
        this.showToast('只能在我方行动阶段存档。', 'error', 1700);
        return;
      }
      if (this.mode !== 'idle') {
        this.showToast('请先完成当前单位的行动，再保存进度。', 'error', 2100);
        return;
      }
      const result = this.saveManager.save(this.game);
      if (result.ok) {
        this.lastSaveAt = timeText(result.savedAt);
        this.updateSaveNote();
        this.showToast('存档成功 · ' + this.lastSaveAt, 'success', 1800);
      } else {
        this.showToast(result.message, 'error', 2200);
      }
    }

    /**
     * 把 SaveManager.load() 的快照真正应用到场上的公共入口。
     * 标题页读档也走这里，避免复制一套恢复逻辑。
     * @returns {boolean} 是否已进入一场可继续操作的对局
     */
    loadSnapshot(loaded) {
      this.enemyThreatId=null;this.enemyThreatTiles=new Set();
      if(this._livehouseEndingCancel)this._livehouseEndingCancel();
      const at = timeText(loaded.savedAt) || '未知时间';
      if(this.chapterOpen)this.finishChapterIntro();
      this.game.restore(loaded.snapshot);
      this.chapterPlayed=this.game.stage===11?this.game.palaceIntroSeen:this.game.stage===10?this.game.stageTenIntroSeen:this.game.stage===9?this.game.stageNineIntroSeen:this.game.stage===8?this.game.stageEightIntroSeen:this.game.stage!==7||this.game.nijikaJoined;
      this.renderer.setGame(this.game);
      this.endShown = false;
      this.resetSelection({ silent: true });
      this.lastSaveAt = at;
      this.syncMission();
      this.updateAll();
      if([6,8,9,10,11].includes(this.game.stage)){this.layoutBoard();const lead=this.game.living('player')[0];if(lead)this.revealCell(lead.x,lead.y);}
      if(this.game.stage===6&&this.game.maskRetreatPending){this.playMaskedEscape().then(()=>this.showEndScreen());return false;}
      if (this.game.isOver()) {
        // 正常流程不会写入终局存档；这里防御旧版本或手工构造的存档。
        this.showEndScreen();
        return false;
      }
      this.renderIdleInfo();
      if(this.game.stage===11&&!this.game.palaceIntroSeen||this.game.stage===10&&!this.game.stageTenIntroSeen||this.game.stage===9&&!this.game.stageNineIntroSeen||this.game.stage===8&&!this.game.stageEightIntroSeen||this.game.stage===7&&!this.game.nijikaJoined)setTimeout(()=>{if(!this.chapterPlayed&&!this.chapterOpen)this.playChapterIntro();},0);
      return true;
    }

    askLoadGame() {
      if (this.busy) return;
      const loaded = this.saveManager.load();
      if (!loaded.ok) {
        this.showToast(loaded.message, 'error', 1800);
        return;
      }
      const at = timeText(loaded.savedAt) || '未知时间';
      const storage = this.saveManager.storageType === 'memory' ? '内存' : '本地';
      this.confirmHandler = () => {
        try {
          if (!this.loadSnapshot(loaded)) return;
          this.showBanner('第 ' + this.game.turn + ' 回合', '读档完成 · PLAYER PHASE', 1500);
          this.showToast('已读取 ' + storage + '存档（存档时间 ' + at + '）。', 'success', 2200);
        } catch (err) {
          this.handleError(err);
        }
      };
      this.openOverlay(
        [
          '<div class="modal-kicker">LOAD GAME</div>',
          '<h2 class="modal-title" id="overlay-title">读取存档？</h2>',
          '<p class="modal-sub">当前未保存的进度会被覆盖。</p>',
          '<div class="modal-section">',
          '  <div class="detail-row"><span>存档时间</span><b>' + esc(at) + '</b></div>',
          '  <div class="detail-row"><span>存档位置</span><b>' + storage + '存储</b></div>',
          '</div>',
          '<div class="modal-actions">',
          '  <button class="modal-btn" type="button" data-overlay-close>取消</button>',
          '  <button class="modal-btn primary" type="button" data-confirm>读取存档</button>',
          '</div>'
        ].join(''),
        '',
        true
      );
    }

    askRestart() {
      if (this.busy) return;
      this.confirmHandler = () => this.newGame();
      this.openOverlay(
        [
          '<div class="modal-kicker">RESTART</div>',
          '<h2 class="modal-title" id="overlay-title">重新开始本关？</h2>',
          '<p class="modal-sub">当前战场状态会重置，本地存档不会被删除。</p>',
          '<div class="modal-actions">',
          '  <button class="modal-btn" type="button" data-overlay-close>继续战斗</button>',
          '  <button class="modal-btn primary" type="button" data-confirm>重新开始</button>',
          '</div>'
        ].join(''),
        '',
        true
      );
    }

    showHelp() {
      if (this.busy) return;
      this.openOverlay(
        [
          '<div class="modal-kicker">FIELD MANUAL</div>',
          '<h2 class="modal-title" id="overlay-title">战场说明</h2>',
          '<p class="modal-sub">内心世界 · 同行者战术手册</p>',
          '<div class="help-grid">',
          '  <div class="help-card"><h3>敌方攻击覆盖</h3><p>我方阶段点击敌人，以<em>橙色格</em>查看其移动后可攻击的范围；再次点击同一敌人关闭，点击其他敌人切换。可与蓝色移动范围对照，攻击模式下仍正常点击目标交战。</p></div>',
          '  <div class="help-card"><h3>回合结束</h3><p>所有存活的我方同伴完成行动后，<em>自动进入下一阶段</em>；有友军时先执行友军行动。也可点击「结束回合」或按 E 提前结束。</p></div>',
          '  <div class="help-card"><h3>移动</h3><p>点击我方单位，蓝色格为可移动范围。消耗等于地形移动费；<em>敌方单位阻挡通行</em>，友军可穿过但不能停留。</p></div>',
          '  <div class="help-card"><h3>攻击</h3><p>近战武器射程 <em>1</em>，弓与魔法射程 <em>2–3</em>。移动后选择攻击，只有红色范围内的敌人才可被点击。</p></div>',
          '  <div class="help-card"><h3>力量 / 魔力</h3><p>物理武器读取<em>力量</em>，以目标<em>守备</em>减伤；魔法武器读取<em>魔力</em>，以目标<em>魔防</em>减伤。</p></div>',
          '  <div class="help-card"><h3>伤害公式</h3><p>攻击力 = 力量/魔力 + 武器威力×克制×有效 + 修正；伤害 = 攻击力 − 守备/魔防。目标站在山地时，物理伤害还会受到额外守备减免。</p></div>',
          '  <div class="help-card"><h3>武器三角</h3><p>剑克斧，斧克枪，枪克剑。克制时武器威力 <em>×1.2</em>、命中 <em>+15</em>；被克制时威力 ×0.8、命中 −15。弓与魔法不参与。</p></div>',
          '  <div class="help-card"><h3>地形</h3><p>森林 <em>闪避 +20</em>；山地 <em>守备 +3</em>；草地无加成。加成读取<em>防守方</em>脚下地形，魔法伤害不吃地形守备。</p></div>',
          '  <div class="help-card"><h3>幸运与暴击</h3><p>基础暴击率＝⌊（技巧＋幸运）÷2⌋＋武器暴击；实战暴击率减去目标幸运，限制在 0–100%。暴击伤害沿用 ×2，<em>确认整场结算后才扣双方 HP</em>。</p></div>',
          '  <div class="help-card"><h3>反击与追击</h3><p>首击 → 存活且武器射程覆盖时反击 → 攻速高出至少 4 的一方追击。已行动仍可反击，反击不消耗行动；首击落空也会触发反击。任一方被击倒立即停止。弓与魔法按各自当前射程判断，贴身无法反击时预告会提示。攻速＝速度－max(0，武器与装备重量－⌊力量÷5⌋)，按图鉴中的真实重量计算。</p></div>',
          '  <div class="help-card"><h3>回声的行动</h3><p>优先接近最近的我方单位；距离相同时，优先攻击 <em>HP 最低</em> 者。无法攻击时会向目标靠近。</p></div>',
          '</div>',
          '<div class="help-foot">快捷键：1–9 选择同伴（按左侧编号；虹夏在第七关、昴在第九关后半段加入） · G 网格 · F 全屏 · E 结束回合 · Esc / 右键 返回 · Enter 确认结算</div>',
          '<div class="modal-actions">',
          '  <button class="modal-btn primary" type="button" data-overlay-close>回到战场</button>',
          '</div>'
        ].join(''),
        'wide',
        true
      );
    }

    async showEndScreen() {
      if(this.game.stage===6&&this.game.maskRetreatPending){await this.playMaskedEscape();}
      if (this.endShown) return;
      this.endShown = true;
      const win = this.game.phase === 'victory';
      if (win && this.game.stage === 1 && this.game.recruited.includes('xueyue') && !this.game.recruitmentShown) {
        const clearedGame = this.game;
        await this.showRecruitment(this.game.getUnit('xueyue'));
        if (this.game !== clearedGame) return;
        this.game.recruitmentShown = true;
      }
      if(win && this.game.stage===3 && this.game.recruited.includes('nina') && !this.game.ninaRecruitmentShown){
        const cleared=this.game;
        await this.showNinaRecruitment();
        if(this.game!==cleared)return;
        this.game.ninaRecruitmentShown=true;
      }
      if(win&&this.game.stage===7&&!this.game.livehouseEndingShown){
        const cleared=this.game,completed=await this.showLivehouseEnding();
        if(this.game!==cleared||!completed)return;
        this.game.livehouseEndingShown=true;
      }
      const firstTotal=this.game.stage===10?MyGO.CONFIG.STAGE_NINE.enemyCount:0;
      const enemyTotal=this.game.stage===6?this.game.units.filter(u=>u.side==='enemy').length:this.game.mission.enemyCount+firstTotal;
      const defeated = this.game.stage===6?this.game.units.filter(u=>u.side==='enemy'&&u.dead).length:this.game.mission.enemyCount-this.game.livingCount('enemy')+(this.game.stage===10?(this.game.rehearsalFirstDefeated||0):0);
      const alive = this.game.livingCount('player');
      const partySize = this.game.units.filter(u => u.side === 'player').length;
      const html = [
        '<div class="end-card ' + (win ? '' : 'defeat') + '">',
        '  <div class="end-hero">',
        '    <div class="end-mark">' + (win ? '✦' : '✧') + '</div>',
        '    <h2 class="end-title" id="overlay-title">' + (win ? 'VICTORY' : 'DEFEAT') + '</h2>',
        '    <div class="end-sub">' + (win ? '迷途的歌声，终于找到了归处。' : '这一次，声音停在了黄昏里。') + '</div>',
        '  </div>',
        '  <div class="end-stats">',
        '    <div class="end-stat"><span>回合</span><b>' + this.game.turn + '</b></div>',
        '    <div class="end-stat"><span>存活</span><b>' + alive + ' / ' + partySize + '</b></div>',
        '    <div class="end-stat"><span>击破</span><b>' + Math.max(0, defeated) + ' / ' + enemyTotal + '</b></div>',
        '  </div>',
        '  <div class="end-copy">' + (win
          ? (this.game.stage===11?'金鬃卫长已被击败，宫廷守军的防线随之瓦解。<br>众人穿过鎏金大厅，继续寻找回到现实的方法。<br>第十关完成，本章奖励 2000 G。':this.game.stage===10?'裂空天马已经倒下，门后的仁菜幻影与敌军也已全部消散。<br>排练室终于安静下来，安和昴已成为同行的伙伴。<br>第九关完成，本章奖励 2000 G。':this.game.stage===8?'两名往日之影已消散，扩张的舞台恢复了寂静。<br>宝箱收集：'+this.game.openedChests.length+'/3；本章奖励 2000 G。':this.game.stage===7?'失真的噪音终于平息，STARRY 的舞台再次亮起。<br>全部敌人已击败，虹夏与大家一同守住了这里。<br>本章奖励 2000 G。':this.game.stage===6?'“留你们一命。”<br>神秘面具人在 1 HP 时打开传送阵离开，王座已空。<br>众人突破暗幕包围，本章奖励 2000 G。':this.game.stage===5?'双桥防线已突破。中级转职证 ×1、钢斧 ×1 已作为 Boss 战利品领取。<br>宝箱收集：'+this.game.openedChests.length+'/2；本章奖励 2000 G。':this.game.stage===4?'“这一次，我会和大家一起向前走。”<br>神秘幻影已击败。'+(this.game.soyoBossBonus?'爽世直面过去，已获得双倍击破经验。':'由爽世亲手击败幻影可获得双倍击破经验。'):this.game.stage===3?(this.game.ninaLost?'仁菜没能走出这场梦。今后的旅途中，她将不会加入同行之人。':'井芹仁菜已获救，加入同行之人。'):'“即使迷路，也要把这首歌传达出去。”')+'<br>' + esc(this.game.mission.chapter) + ' · ' + esc(this.game.mission.title) + ' · CLEAR'
          : '我方全灭。调整站位，利用森林与武器三角，再试一次。') + '</div>',
        '  <div class="modal-actions">',
        win ? '<button class="modal-btn" type="button" data-end-save>保存通关</button>' : '',
        win ? '<button class="modal-btn" type="button" data-end-shop>商店 · 补给</button>' : '',
        '<button class="modal-btn" type="button" data-end-formation>同行之人</button>',
        win && (this.game.stage < 9||this.game.stage===10)
          ? '    <button class="modal-btn gold" type="button" data-end-next>进入第'+(['','二','三','四','五','六','七','八','九','十'][this.game.chapterNumber])+'章</button>'
          : '',
        '    <button class="modal-btn primary" type="button" data-end-restart>再次挑战</button>',
        '  </div>',
        '</div>'
      ].join('');

      this.openOverlay(html, 'end-card-host', false);
      const restart = this.dom.overlayCard.querySelector('[data-end-restart]');
      if (restart) restart.addEventListener('click', () => this.newGame());
      const next = this.dom.overlayCard.querySelector('[data-end-next]');
      if (next) next.addEventListener('click', () => this.startNextStage());
      const save = this.dom.overlayCard.querySelector('[data-end-save]');
      if (save) save.addEventListener('click', () => this.saveGame());
      const shop=this.dom.overlayCard.querySelector('[data-end-shop]');
      if(shop)shop.addEventListener('click',()=>{this.closeOverlay();if(MyGO.entry){MyGO.entry.open({force:true});MyGO.entry.shop.open();}});
      const formation = this.dom.overlayCard.querySelector('[data-end-formation]');
      if (formation) formation.addEventListener('click', () => {
        this.closeOverlay();
        if (MyGO.entry) { MyGO.entry.open({ force: true }); MyGO.entry.openFormation(); }
      });
    }

    /* ============================================================
     * 弹窗基础
     * ============================================================ */

    openOverlay(content, extraClass, dismissible) {
      this.confirmHandler = this.confirmHandler || null;
      this.modalDismissible = !!dismissible;
      this.dom.overlayCard.className = 'overlay-card' + (extraClass ? ' ' + extraClass : '');
      this.dom.overlayCard.innerHTML = content;
      this.dom.overlayCard.scrollTop = 0;
      this.dom.overlayRoot.hidden = false;
      document.body.classList.add('modal-open');
    }

    closeOverlay() {
      this.dom.overlayRoot.hidden = true;
      this.dom.overlayCard.innerHTML = '';
      this.dom.overlayCard.className = 'overlay-card';
      document.body.classList.remove('modal-open');
      this.modalDismissible = false;
      this.confirmHandler = null;
      this.scheduleAutoEndTurn();
    }

    handleError(err) {
      console.error(err);
      this.setBusy(false);
      this.closeOverlay();
      this.showToast('发生错误：' + err.message, 'error', 2600);

      // 敌方回合中抛错会让玩家无法结束回合；安全退回我方阶段。
      if (this.game.isOver()) {
        this.showEndScreen();
        return;
      }
      if (['enemy','ally'].includes(this.game.phase)) {
        this.game.phase = 'player';
        this.game.resetActed('player');
      }
      this.resetSelection();
      this.updateAll();
      this.renderIdleInfo();
    }
  }

  MyGO.UI = UI;
})(window);
