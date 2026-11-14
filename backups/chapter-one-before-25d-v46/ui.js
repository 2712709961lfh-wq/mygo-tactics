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
    sword: '剑',
    lance: '枪',
    axe: '斧',
    bow: '弓',
    tome: '魔'
  };

  const WEAPON_NAME = {
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
      this.initialStage = opts.stage === 2 ? 2 : 1;
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
      if(this.game.stage===2)this.dom.objectiveText.textContent='星铃 '+this.game.awakenedBells.length+'/3 · 指挥家'+
        (this.game.getUnit('conductor').dead?'已击败':'待击败');
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
        return;
      }

      this.chapterPlayed = true;
      this.chapterOpen = true;
      document.body.classList.add('chapter-open');
      root.hidden = false;
      root.classList.remove('is-leaving');
      // 强制一帧初始态，保证 opacity 过渡从 0 开始。
      void root.offsetWidth;
      requestAnimationFrame(() => root.classList.add('is-visible'));

      // 留足阅读时间后自动淡出；点击/按键可以提前结束。
      this.chapterTimers.push(setTimeout(() => this.finishChapterIntro(), 3300));
    }

    finishChapterIntro() {
      if (!this.chapterOpen) return;
      this.chapterOpen = false;
      this.chapterTimers.forEach((timer) => clearTimeout(timer));
      this.chapterTimers = [];
      const root = this.dom.chapterIntro;
      if (!root) {
        if (this.chapterDone) this.chapterDone();
        this.chapterDone = null;
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
      }, 720);
    }

    newGame(seed, stage) {
      this.closeOverlay();
      this.endShown = false;
      this.busy = false;
      const nextStage = stage === 2 ? 2 : (stage === 1 ? 1 : this.game.stage || 1);
      this.game = new MyGO.Game({ seed: seed || Date.now(), stage: nextStage,
        recruited: nextStage === 2 ? this.game.recruited : [] });
      this.renderer.setGame(this.game);
      this.chapterPlayed = false;
      this.resetSelection({ silent: true });
      this.updateAll();
      this.renderIdleInfo();
      this.setZoom(1, false);
      this.syncMission();
      this.showBanner('第 1 回合', '我方行动 · PLAYER PHASE', 1600);
      this.showToast('新的战斗开始了。', 'success', 1600);
    }

    /** 开始下一章（或直接指定章节）。 */
    startNextStage() {
      const next = this.game.stage === 1 ? 2 : 1;
      this.chapterPlayed = false;
      this.closeOverlay();
      this.endShown = false;
      this.busy = false;
      this.game = new MyGO.Game({ seed: Date.now(), stage: next,
        recruited: next === 2 ? this.game.recruited : [] });
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
          (document.getElementById('equipment-screen') && !document.getElementById('equipment-screen').hidden)) return;
      if (this.chapterOpen) {
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
      if (/^[1-6]$/.test(event.key)) {
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

    updateAll() {
      this.updateChrome();
      this.updateCounts();
      if(this.game.stage===2){
        const g=this.game;
        this.dom.objectiveText.textContent='星铃 '+g.awakenedBells.length+'/'+g.mission.requiredBells+
          ' · 指挥家'+(g.getUnit('conductor').dead?'已击败':'待击败');
      }
    }

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
      this.dom.enemyCount.textContent = String(this.game.livingCount('enemy'));
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
        const width = Math.max(1, Math.min(frame.clientWidth - 2, (frame.clientHeight - 2) * aspect));
        vp.style.width = width + 'px';
        vp.style.height = width / aspect + 'px';
      }
      const baseW = vp.offsetWidth;
      const baseH = vp.offsetHeight;
      const zoomed = this.zoom > 1.001;
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
      if (!vp || this.zoom <= 1.001) return;
      const cellW = this.dom.board.offsetWidth / this.game.map.cols;
      const cellH = this.dom.board.offsetHeight / this.game.map.rows;
      const projected = this.game.stage===2 && MyGO.MapProjection
        ? MyGO.MapProjection.project(this.renderer.projection,(x+.5)*C.TILE,(y+.5)*C.TILE) : null;
      const left = projected ? projected.x / this.renderer.logicalWidth * this.dom.board.offsetWidth - cellW/2 : x * cellW;
      const top = projected ? projected.y / this.renderer.logicalHeight * this.dom.board.offsetHeight - cellH/2 : y * cellH;
      // 至少留出 1.5 格的观察余量，避免选中单位贴边。
      const pad = Math.max(24, Math.round(cellW * 1.5));
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
      if(this.game.stage===2 && (this.mode==='idle'||this.mode==='attack')){
        const rotated=!!shell&&shell.dataset.rotated==='true';
        const nx=rotated?(event.clientY-rect.top)/rect.height:(event.clientX-rect.left)/rect.width;
        const ny=rotated?(rect.left+rect.width-event.clientX)/rect.width:(event.clientY-rect.top)/rect.height;
        const hit=this.renderer.pickProjectedUnit(nx*this.renderer.logicalWidth,ny*this.renderer.logicalHeight);
        if(hit)return hit;
      }
      return MyGO.Viewport.pointToCell(rect, event.clientX, event.clientY, this.game.map.cols, this.game.map.rows,
        !!shell && shell.dataset.rotated === 'true', this.game.stage===2 ? this.renderer.projection : null);
    }

    /* ============================================================
     * 选择、移动、行动
     * ============================================================ */

    onBoardClick(event) {
      if (this.busy || !this.game.isPlayerPhase()) return;
      const cell = this.eventToCell(event);
      if (!cell) return;
      const unit = this.game.unitAt(cell.x, cell.y);

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
        this.game.setUnitPosition(unit.id, x, y);
        this.renderer.snapUnit(unit);
        this.moved = true;
        this.setBusy(false);
        this.enterActionMode();
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
      if (this.game.allPlayerActed()) {
        setTimeout(() => {
          if (this.game.isPlayerPhase() && !this.busy) {
            this.showToast('我方全员行动完毕，点击“结束回合”。', 'success', 2300);
          }
        }, 700);
      }
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
      if (this.game.stage === 1 && MyGO.GardenMap) {
        MyGO.GardenMap.drawSample(ctx, terrainId || 'plain');
      } else if (this.game.stage === 2 && MyGO.MoonMap) {
        MyGO.MoonMap.drawSample(ctx, terrainId || 'plain');
      } else {
        MyGO.Assets.drawTerrain(ctx, terrainId || 'plain', 0, 0, 32, { gx: 0, gy: 0 });
      }
    }

    setPortrait(unit) {
      this.dom.portraitBlock.dataset.side = unit.side;
      this.dom.portraitBadge.textContent = unit.side === 'player' ? '我方' : unit.boss ? '首领' : '敌方';
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
        '<span class="tag ' + (unit.side === 'player' ? 'side-player' : 'side-enemy') + '">' +
          (unit.side === 'player' ? '我方' : '敌方') + '</span>',
        '<span class="tag">' + esc(unit.className) + '</span>',
        '<span class="tag">' + esc(WEAPON_NAME[weapon.type] || '武器') + '</span>'
      ];
      if (unit.boss) tags.push('<span class="tag gold">首领</span>');
      if (unit.key) tags.push('<span class="tag gold">钥匙</span>');
      if (unit.dormant && !this.game.gateOpen) tags.push('<span class="tag">沉眠</span>');
      if (unit.side==='enemy' && unit.guardRadius) tags.push('<span class="tag">'+
        (unit.alerted ? '整队已警觉' : '整队警戒 '+unit.guardRadius+' 移动点')+'</span>');
      if (unit.acted && !unit.dead) tags.push('<span class="tag">已行动</span>');
      this.dom.infoTags.innerHTML = tags.join('');

      const terrain = this.game.getTerrain(unit.x, unit.y);
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
        '  <div class="stat' + (magic ? '' : ' accent') + '"><i>力量</i><b>' + unit.str + '</b></div>',
        '  <div class="stat' + (magic ? ' accent' : '') + '"><i>魔力</i><b>' + unit.mag + '</b></div>',
        '  <div class="stat"><i>速度</i><b>' + unit.spd + '</b></div>',
        '  <div class="stat"><i>守备</i><b>' + unit.def + (!magic && terrain.def ? '<small>+' + terrain.def + '</small>' : '') + '</b></div>',
        '  <div class="stat"><i>魔防</i><b>' + unit.res + '</b></div>',
        '  <div class="stat"><i>技巧</i><b>' + unit.dex + '</b></div>',
        '  <div class="stat warm"><i>幸运</i><b>' + unit.lck + '</b></div>',
        '  <div class="stat"><i>移动</i><b>' + unit.move + '</b></div>',
        '</div>',
        '<div class="derived-line">',
        '  <span class="unit-stat-total" title="HP上限＋力量＋魔力＋技巧＋速度＋幸运＋守备＋魔防＋移动；不含武器/地形加成">属性总和 <b>' + Combat.statTotalOf(unit) + '</b></span>',
        '  <span>命中率 <b>' + (unit.hit + weapon.hit) + '</b></span>',
        '  <span>基础暴击率 <b>' + Combat.critRateOf(unit) + '%</b></span>',
        '  <span>必杀回避 <b>' + Combat.critAvoidOf(unit) + '</b></span>',
        '  <span>伤害类型 <b>' + (magic ? '魔法' : '物理') + '</b></span>',
        '  <span>' + (magic ? '战斗魔防' : '战斗守备') + ' <b>' + defense + '</b></span>',
        '  <span>回避 <b>' + avoid + '</b></span>',
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

      this.setActions([
        ...(this.game.canAwakenBell(unit)?[{label:'唤醒星铃 · '+this.game.bellAt(unit.x,unit.y).name,className:'primary',onClick:()=>{
          const bell=this.game.awakenBell(unit);if(!bell)return;
          this.renderer.floatText('星铃苏醒',unit.x,unit.y,'#a0ffdf',11);
          this.resetSelection();this.updateAll();
          this.showToast(bell.name+'已唤醒（'+this.game.awakenedBells.length+'/3），当地守卫已警觉。','success',3200);
          if(this.game.isOver())this.showEndScreen();
        }}]:[]),
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
        '<span>伤害 DMG<b class="damage">' + preview.damage + '</b></span>' +
        '<span>暴击 CRT<b>' + preview.crit + '%</b></span></div>' +
        '<span class="hint-line">' + esc(preview.damageTypeName) + ' · ' + esc(preview.triangleLabel) +
        ' · 地形回避 +' + preview.terrainAvoid + '</span>';
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
      this.dom.portraitLevel.textContent = this.game.stage === 2 ? 'M02' : 'M01';
      this.drawTerrainPortrait(this.dom.infoPortrait, 'plain');
      this.dom.infoName.textContent = this.game.mission.title;
      this.dom.infoTags.innerHTML = [
        '<span class="tag gold">' + esc(this.game.mission.chapter) + '</span>',
        '<span class="tag">' + esc(this.game.mission.mapName) + '</span>',
        '<span class="tag">第 ' + this.game.turn + ' 回合</span>'
      ].join('');
      const open = this.game.gateOpen;
      const steps = this.game.stage === 2 ? [
        ['择路探访花镇', '西侧花屋、南方约定屋、北方回忆屋、东侧心愿屋与晨光屋各有星铃；可选择分兵或集中推进。'],
        ['唤醒星铃 '+this.game.awakenedBells.length+'/3', '停在星铃格，在行动菜单唤醒；回复自身 30% HP，并惊动当地守卫。五处任选三处。'],
        ['击败露台上的指挥家', this.game.getUnit('conductor').dead?'指挥家已被击败，完成星铃目标即可通关。':'穿过中央集市或沿北侧花林迂回，击败东北露台的指挥家。无需全灭敌军。']
      ] : [
        ['选择渡河路线', '北桥有林地掩护，南桥适合集结；在西岸共鸣碑消耗行动，可开启中央浅滩。'],
        ['取回失落的钥匙', '击破东南方的钥匙影弓；休憩据点可在我方阶段开始回复 20% HP。'],
        ['推开封闭的门', open ? '内庭南门已经开启。' : '夺取钥匙后，内庭南门会开启。'],
        ['与雪月交锋', '击败剑士雪月与全部敌人，雪月战败后加入同行者。']
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
        (this.game.stage === 2
          ? '五处星铃任选三处 + 击败指挥家。中央集市便于转线，花林提供掩护；沿房舍外侧可绕开部分警戒队。点击编号星铃查看位置。'
          : (this.game.gateOpen
            ? '大门已开启。进入庭院，击破首领与全部敌人。'
            : '敌人分区警戒：沿可通行地形接近，或攻击任一成员会惊动整队。点击敌人查看警戒距离；据点可以回复 HP。')) +
        '</span>';
      this.setActions([
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
        '<span class="hint-line">我方单位会自动承受攻击，不会反击。</span>';
      this.setActions([{ label: '敌方行动中…', disabled: true }]);
    }

    renderTerrainInfo(x, y) {
      const terrain = this.game.getTerrain(x, y);
      const bell=this.game.bellAt(x,y);
      this.dom.portraitBlock.dataset.side = 'terrain';
      this.dom.portraitBadge.textContent = '地形';
      this.dom.portraitLevel.textContent = columnLabel(x) + (y + 1);
      this.drawTerrainPortrait(this.dom.infoPortrait, terrain.id);
      this.dom.infoName.textContent = bell ? bell.name : terrain.name;
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

    inspectUnit(unit) {
      this.inspectedId = unit.id;
      this.setView();
      this.renderUnitInfo(unit);
      const enemy = unit.side === 'enemy';
      this.dom.contextTitle.textContent = enemy ? '敌方情报' : '单位情报';
      let detail = '“' + esc(unit.quote) + '”';
      if (enemy) {
        if(unit.guardGroup) {
          const groupName={west:'西岸',north:'北桥',south:'南桥',key:'钥匙区',approach:'内庭前沿',inner:'内庭',
            'moon-west':'西侧花屋','moon-southwest':'南方约定屋','moon-market':'中央集市',
            'moon-north':'北方回忆屋','moon-east':'东侧心愿屋','moon-stage':'晨光露台'}[unit.guardGroup]||'此区域';
          detail+='<span class="hint-line">所属警戒队：'+groupName+' · '+
            this.game.living('enemy').filter(u=>u.guardGroup===unit.guardGroup).length+' 人。'+
            (unit.alerted?'全队已惊动，持续追击。':unit.guardRadius?'接近 '+unit.guardRadius+' 移动点内或攻击任一队员，会惊动全队。':'开门后行动。')+'</span>';
        }
        detail += '<span class="hint-line">攻击范围 ' + unit.weapon.range[0] + '–' + unit.weapon.range[1] +
          ' 格 · 基础命中 ' + (unit.hit + unit.weapon.hit) + ' · 基础暴击率 ' + Combat.critRateOf(unit) + '% · 必杀回避 ' + Combat.critAvoidOf(unit) + '</span>';
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
        this.game.markActed(attacker);
        this.setBusy(false);
        this.resetSelection();
        this.updateAll();
        if (result && result.hit) {
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
        } else if (this.game.allPlayerActed()) {
          this.showToast('我方全员行动完毕，点击“结束回合”。', 'success', 2400);
        }
      } catch (err) {
        this.handleError(err);
      }
    }

    async performAttackSequence(attacker, defender, isEnemy) {
      const result = this.game.rollCombat(attacker, defender);
      await this.showCutin(attacker, defender, result);
      await this.showResultModal(result, isEnemy);
      const applied = this.game.applyCombat(result);

      if (applied.hit && applied.finalDamage > 0) {
        this.renderer.flash(defender.id, applied.crit ? 'rgba(255, 209, 102, 0.72)' : 'rgba(255, 80, 110, 0.65)', 380);
        this.renderer.floatText('-' + applied.finalDamage, defender.x, defender.y, applied.crit ? '#ffe08a' : '#ff8fa4', applied.crit ? 12 : 10);
        if (applied.crit) {
          this.renderer.critBurst(defender.x, defender.y);
          this.renderer.shake(360, 3);
        }
      } else {
        this.renderer.floatText('MISS', defender.x, defender.y, '#78e6ee', 10);
      }
      if (applied.killed && !applied.recruitedId) {
        this.renderer.floatText('击破', defender.x, defender.y - 0.35, '#ffd166', 9);
      }
      if (applied.gateOpened) {
        let gx = 11;
        let gy = 10;
        for (let y = 0; y < this.game.map.rows; y++) {
          for (let x = 0; x < this.game.map.cols; x++) {
            if (this.game.map.tiles[y][x] === 'gateOpen') {
              gx = x;
              gy = y;
            }
          }
        }
        this.renderer.floatText('门开了', gx, gy - 0.2, '#ffe08a', 9);
        this.renderer.shake(260, 2);
        this.showToast('钥匙掉落，庭院大门开启了！', 'success', 2800);
        const objective = document.getElementById('objective-text');
        if (objective) objective.textContent = '进入庭院，击破所有迷途回声';
      }
      this.updateAll();
      if (applied.recruitedId) await this.showRecruitment(this.game.getUnit(applied.recruitedId));
      return applied;
    }

    showRecruitment(unit) {
      return new Promise(resolve => {
        this.confirmHandler = resolve;
        this.openOverlay('<div class="modal-kicker">NEW COMPANION</div>' +
          '<h2 class="modal-title" id="overlay-title">雪月加入同行之人</h2>' +
          '<canvas id="recruit-portrait" width="180" height="210" style="display:block;margin:0 auto"></canvas>' +
          '<p class="modal-sub">“心声已经传达到了。今后，请让我与你同行。”</p>' +
          '<div class="modal-section">剑士 · 雪月之刃<br>生命已恢复，当回合已行动；下一我方回合即可操作。<br>可在「同行之人」查看能力，并随队进入第二关。</div>' +
          '<div class="modal-actions"><button class="modal-btn primary" data-confirm>一起前行</button></div>', '', false);
        const canvas = document.getElementById('recruit-portrait');
        const ctx = canvas.getContext('2d');
        MyGO.Characters.drawPortrait(ctx, unit.id, 0, 0, canvas.width, canvas.height);
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
        this.battle.play(attacker, defender, result, options).then(finish, (err) => {
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

    showResultModal(result, isEnemy) {
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
          (hit ? 'D100 ' + result.hitRoll + ' ≤ ' + result.hitChance : 'MISS · D100 ' + result.hitRoll + ' &gt; ' + result.hitChance) + '</b></div>',
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

    /* ============================================================
     * 敌方回合
     * ============================================================ */

    async endTurn() {
      if (this.busy || !this.game.isPlayerPhase() || this.game.isOver()) return;
      if (this.mode !== 'idle') {
        this.showToast('请先完成当前单位的行动（攻击 / 待机）。', 'error', 2000);
        return;
      }
      this.setBusy(true);
      this.resetSelection({ silent: true });
      this.game.beginEnemyPhase();
      this.updateAll();
      this.renderEnemyPhaseInfo();
      this.showBanner('敌方行动', '第 ' + this.game.turn + ' 回合 · ENEMY PHASE', 1400);
      await sleep(1050);

      try {
        const enemies = this.game.living('enemy').slice();
        for (const enemy of enemies) {
          if (this.game.isOver() || enemy.dead) break;
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
        this.showToast(healed.length ? '据点休憩 · '+healed.join('，') : '轮到你了。选择我方单位开始行动。', 'info', 3000);
      } catch (err) {
        this.handleError(err);
      }
    }

    async runEnemyAction(enemy) {
      const plan = MyGO.AI.planAction(this.game, enemy);
      this.inspectedId = enemy.id;
      this.mode = 'idle';
      this.setView();
      this.renderUnitInfo(enemy);
      this.dom.contextTitle.textContent = '敌方行动';
      this.dom.contextText.innerHTML =
        '<strong>' + esc(enemy.name) + '</strong> 正在行动……' +
        '<span class="hint-line">敌方倾向于靠近最近的同伴，并攻击生命值较低者。</span>';
      this.setActions([{ label: '敌方行动中…', disabled: true }]);
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
          await this.performAttackSequence(enemy, target, true);
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
      const at = timeText(loaded.savedAt) || '未知时间';
      this.game.restore(loaded.snapshot);
      this.renderer.setGame(this.game);
      this.endShown = false;
      this.resetSelection({ silent: true });
      this.lastSaveAt = at;
      this.syncMission();
      this.updateAll();
      if (this.game.isOver()) {
        // 正常流程不会写入终局存档；这里防御旧版本或手工构造的存档。
        this.showEndScreen();
        return false;
      }
      this.renderIdleInfo();
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
          '  <div class="help-card"><h3>移动</h3><p>点击我方单位，蓝色格为可移动范围。消耗等于地形移动费；<em>敌方单位阻挡通行</em>，友军可穿过但不能停留。</p></div>',
          '  <div class="help-card"><h3>攻击</h3><p>近战武器射程 <em>1</em>，弓与魔法射程 <em>2–3</em>。移动后选择攻击，只有红色范围内的敌人才可被点击。</p></div>',
          '  <div class="help-card"><h3>力量 / 魔力</h3><p>物理武器读取<em>力量</em>，以目标<em>守备</em>减伤；魔法武器读取<em>魔力</em>，以目标<em>魔防</em>减伤。</p></div>',
          '  <div class="help-card"><h3>伤害公式</h3><p>攻击力 = 力量/魔力 + 武器威力×克制×有效 + 修正；伤害 = 攻击力 − 守备/魔防。目标站在山地时，物理伤害还会受到额外守备减免。</p></div>',
          '  <div class="help-card"><h3>武器三角</h3><p>剑克斧，斧克枪，枪克剑。克制时武器威力 <em>×1.2</em>、命中 <em>+15</em>；被克制时威力 ×0.8、命中 −15。弓与魔法不参与。</p></div>',
          '  <div class="help-card"><h3>地形</h3><p>森林 <em>闪避 +20</em>；山地 <em>守备 +3</em>；草地无加成。加成读取<em>防守方</em>脚下地形，魔法伤害不吃地形守备。</p></div>',
          '  <div class="help-card"><h3>幸运与暴击</h3><p>基础暴击率＝⌊（技巧＋幸运）÷2⌋＋武器暴击；实战暴击率还要减去目标幸运，限制在 0–100%。暴击伤害仍为 ×2，<em>点击确认才扣 HP</em>。本原型不设反击。</p></div>',
          '  <div class="help-card"><h3>回声的行动</h3><p>优先接近最近的我方单位；距离相同时，优先攻击 <em>HP 最低</em> 者。无法攻击时会向目标靠近。</p></div>',
          '</div>',
          '<div class="help-foot">快捷键：1–6 选择同伴（6 为加入后的雪月） · G 网格 · F 全屏 · E 结束回合 · Esc / 右键 返回 · Enter 确认结算</div>',
          '<div class="modal-actions">',
          '  <button class="modal-btn primary" type="button" data-overlay-close>回到战场</button>',
          '</div>'
        ].join(''),
        'wide',
        true
      );
    }

    showEndScreen() {
      if (this.endShown) return;
      this.endShown = true;
      const win = this.game.phase === 'victory';
      const defeated = this.game.mission.enemyCount - this.game.livingCount('enemy');
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
        '    <div class="end-stat"><span>击破</span><b>' + Math.max(0, defeated) + ' / ' + this.game.mission.enemyCount + '</b></div>',
        '  </div>',
        '  <div class="end-copy">' + (win
          ? '“即使迷路，也要把这首歌传达出去。”<br>' + esc(this.game.mission.chapter) + ' · ' + esc(this.game.mission.title) + ' · CLEAR'
          : '我方全灭。调整站位，利用森林与武器三角，再试一次。') + '</div>',
        '  <div class="modal-actions">',
        win ? '<button class="modal-btn" type="button" data-end-save>保存通关</button>' : '',
        '<button class="modal-btn" type="button" data-end-formation>同行之人</button>',
        win && this.game.stage === 1
          ? '    <button class="modal-btn gold" type="button" data-end-next>进入第二章</button>'
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
      if (this.game.phase === 'enemy') {
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
