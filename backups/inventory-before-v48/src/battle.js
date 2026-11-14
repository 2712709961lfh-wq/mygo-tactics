/* ============================================================
 * battle.js — 侧视战斗演出
 *
 * 设计参考 GBA《火焰纹章》的战斗画面：
 *   · 黄昏庭院像素背景，双方在石台上对峙；
 *   · 角色使用五名队员的 80×96 图集（攻击/受伤/倒地），
 *     敌方影子仍使用 32×32 程序化素材，整体保持硬像素边缘；
 *   · 攻击方蓄力后按武器类型演出：近战冲到敌人身边，
 *     剑挥砍、斧劈砍、枪戳刺；弓射箭；魔法放出属性色魔法球；
 *   · 命中 / 闪避 / 暴击拥有不同的镜头、闪光和伤害数字；
 *   · 底部 HUD 显示命中、伤害、暴击率与双方 HP。
 *
 * 这里只负责“演出”。伤害是否真正生效仍由 ui.js 在玩家
 * 点击结算确认后调用 Game.applyCombat() 决定。
 * ============================================================ */
(function (global) {
  'use strict';

  const MyGO = global.MyGO;
  if (!MyGO || !MyGO.Assets) return;

  const C = MyGO.CONFIG;
  const A = MyGO.Assets;

  const W = 576;
  const H = 324;
  const SCALE = C.RENDER_SCALE || 2;
  const IMPACT_T = 0.58;
  const DASH_START = 0.26;
  const DASH_END = 0.50;
  const CAST_RELEASE = 0.46;

  /** 魔法属性色板：core 核心、mid 主体、glow 外发光、text 飘字。 */
  const ELEMENT_PALETTES = {
    fire: { core: '#fff4d6', mid: '#ff7a3c', glow: '#ff2d2d', text: '#ff9a66' },
    ice: { core: '#ffffff', mid: '#a8ecff', glow: '#54b8ff', text: '#9fe8ff' },
    wind: { core: '#f2fff5', mid: '#7ee7a8', glow: '#3fc978', text: '#8ff0b4' },
    thunder: { core: '#fffbd0', mid: '#ffd84a', glow: '#ffae2b', text: '#ffe27a' },
    dark: { core: '#f0dcff', mid: '#b06bff', glow: '#6b2dcc', text: '#d6a8ff' },
    light: { core: '#fffdf2', mid: '#ffe08a', glow: '#ffc94a', text: '#ffe7a8' },
    arcane: { core: '#f6efff', mid: '#b79cff', glow: '#7b5cff', text: '#d9c8ff' }
  };

  const MELEE_GAP = {
    sword: 82,
    axe: 88,
    lance: 104
  };

  const WEAPON_GLYPH = {
    sword: '剑',
    lance: '枪',
    axe: '斧',
    bow: '弓',
    tome: '书'
  };

  const easeOutCubic = (p) => 1 - Math.pow(1 - p, 3);
  const easeInCubic = (p) => p * p * p;
  const easeInOutCubic = (p) =>
    p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const clamp01 = (p) => Math.max(0, Math.min(1, p));

  /** 根据武器类型 / element 取演出色板；物理武器用中性色。 */
  function paletteFor(weapon) {
    if (!weapon) return ELEMENT_PALETTES.arcane;
    if (weapon.damageType === 'magic') {
      return ELEMENT_PALETTES[weapon.element] || ELEMENT_PALETTES.arcane;
    }
    return { core: '#fffdf0', mid: '#ffe3a3', glow: '#d9b96a', text: '#ffe7a8' };
  }

  /** 稳定伪随机，保证同一格背景纹理不会逐帧跳动。 */
  function hash(x, y, seed) {
    let n = (x * 374761393 + y * 668265263 + (seed || 0) * 1442695040) | 0;
    n = (n ^ (n >>> 13)) * 1274126177;
    n = n ^ (n >>> 16);
    return (n >>> 0) / 4294967296;
  }

  function px(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
  }

  class BattleScene {
    constructor(root) {
      this.root = root || document.getElementById('battle-scene');
      this.canvas = document.getElementById('battle-canvas');
      if (!this.root || !this.canvas) throw new Error('战斗演出节点缺失');
      this.ctx = this.canvas.getContext('2d');
      this.canvas.width = W * SCALE;
      this.canvas.height = H * SCALE;
      this.ctx.imageSmoothingEnabled = false;

      this.dom = {
        viewport: document.getElementById('battle-viewport'),
        flash: document.getElementById('battle-flash'),
        atkPlate: document.getElementById('battle-atk-plate'),
        defPlate: document.getElementById('battle-def-plate'),
        atkRole: document.getElementById('cutin-atk-role'),
        defRole: document.getElementById('cutin-def-role'),
        atkName: document.getElementById('cutin-atk-name'),
        defName: document.getElementById('cutin-def-name'),
        atkClass: document.getElementById('cutin-atk-class'),
        defClass: document.getElementById('cutin-def-class'),
        atkWeapon: document.getElementById('cutin-atk-weapon'),
        defWeapon: document.getElementById('cutin-def-weapon'),
        atkIcon: document.getElementById('battle-atk-icon'),
        defIcon: document.getElementById('battle-def-icon'),
        atkHpText: document.getElementById('battle-atk-hp-text'),
        defHpText: document.getElementById('battle-def-hp-text'),
        atkHpFill: document.getElementById('battle-atk-hp-fill'),
        defHpFill: document.getElementById('battle-def-hp-fill'),
        atkPanel: document.getElementById('battle-panel-atk'),
        defPanel: document.getElementById('battle-panel-def'),
        centerTag: document.getElementById('battle-center-tag'),
        announce: document.getElementById('battle-announce'),
        crit: document.getElementById('battle-crit')
      };

      this.bg = null;
      this.duration = 1800;
      this.impactAt = this.duration * IMPACT_T;
      this.startedAt = 0;
      this.impacted = false;
      this.running = false;
      this.raf = null;
      this.resolve = null;
      this.particles = [];
      this.freezeAt = null;
      this.lastImpactAt = -1000;
      this.attacker = null;
      this.defender = null;
      this.result = null;

      this._frame = this._frame.bind(this);
      this._buildBackground();
    }

    /* ------------------------------------------------------------
     * 对外接口
     * ---------------------------------------------------------- */

    play(attacker, defender, result, options) {
      this._cancel();
      const opt = options || {};
      this.attacker = attacker;
      this.defender = defender;
      this.result = result;
      // Alternate the two authored normal swings; this counter is visual only.
      if (attacker.id === 'taki' && !result.crit) {
        if (opt.action === 'attack2') this.takiAction = 'attack2';
        else {
          this.takiAction = (this.takiAttackCount || 0) % 2 ? 'attack2' : 'attack';
          this.takiAttackCount = (this.takiAttackCount || 0) + 1;
        }
      }
      if (attacker.id === 'tomori' && !result.crit) {
        if (opt.action === 'attack2') this.tomoriAction = 'attack2';
        else {
          this.tomoriAction = (this.tomoriAttackCount || 0) % 2 ? 'attack2' : 'attack';
          this.tomoriAttackCount = (this.tomoriAttackCount || 0) + 1;
        }
      }
      if (attacker.id === 'xueyue' && !result.crit) {
        this.xueyueAction = opt.action === 'attack2' ? 'attack2'
          : (this.xueyueAttackCount || 0) % 2 ? 'attack2' : 'attack';
        if (opt.action !== 'attack2') this.xueyueAttackCount = (this.xueyueAttackCount || 0) + 1;
      }
      this.palette = paletteFor(attacker.weapon);
      this.duration = result.crit ? 2100 : 1800;
      this.impactAt = this.duration * IMPACT_T;
      this.impacted = false;
      this.particles = [];
      this.freezeAt = opt.freezeAt != null ? opt.freezeAt : null;
      this._setupDom();

      return new Promise((resolve) => {
        this.resolve = resolve;
        this.running = true;

        // 截图 / 演示模式：直接停在指定的演出帧。
        if (this.freezeAt != null) {
          const t = this.duration * this.freezeAt;
          if (this.freezeAt >= IMPACT_T) {
            this._triggerImpact();
            // 定格截图不需要瞬时白闪，否则会盖住整张画面。
            this.dom.flash.classList.remove('active', 'crit');
            this.dom.flash.style.opacity = '0';
          }
          this._draw(t);
          return;
        }

        this.startedAt = performance.now();
        this.raf = global.requestAnimationFrame(this._frame);
      });
    }

    /** 跳过：立即结算演出并触发命中反馈。 */
    skip() {
      if (!this.running) return;
      if (!this.impacted) this._triggerImpact();
      this._draw(Math.min(this.duration, this.impactAt + 180));
      this._finish();
    }

    /** 结束演出并 resolve play()。 */
    _finish() {
      if (!this.running) return;
      this.running = false;
      if (this.raf) {
        global.cancelAnimationFrame(this.raf);
        this.raf = null;
      }
      const resolve = this.resolve;
      this.resolve = null;
      if (resolve) resolve();
    }

    _cancel() {
      this.running = false;
      if (this.raf) {
        global.cancelAnimationFrame(this.raf);
        this.raf = null;
      }
      const resolve = this.resolve;
      this.resolve = null;
      if (resolve) resolve();
    }

    _frame(now) {
      if (!this.running) return;
      const elapsed = Math.min(this.duration, now - this.startedAt);

      if (!this.impacted && elapsed >= this.impactAt) this._triggerImpact();
      this._draw(elapsed);

      if (elapsed >= this.duration) {
        this._finish();
        return;
      }
      this.raf = global.requestAnimationFrame(this._frame);
    }

    /* ------------------------------------------------------------
     * DOM / HUD
     * ---------------------------------------------------------- */

    _setupDom() {
      const a = this.attacker;
      const b = this.defender;
      const r = this.result;
      const d = this.dom;

      d.atkName.textContent = a.name;
      d.defName.textContent = b.name;
      d.atkClass.textContent = a.className || '';
      d.defClass.textContent = b.className || '';
      const elementTag = a.weapon.damageType === 'magic' && a.weapon.elementName
        ? ' · ' + a.weapon.elementName
        : '';
      const defenderElementTag = b.weapon.damageType === 'magic' && b.weapon.elementName
        ? ' · ' + b.weapon.elementName
        : '';
      d.atkWeapon.textContent = a.weapon.name + elementTag;
      d.defWeapon.textContent = b.weapon.name + defenderElementTag;
      d.atkIcon.textContent = WEAPON_GLYPH[a.weapon.type] || '◆';
      d.defIcon.textContent = WEAPON_GLYPH[b.weapon.type] || '◆';

      const actionName = r.kind === 'counter' ? '反击' : r.kind === 'followup' ? '追击' : '首击';
      d.atkRole.textContent = (a.side === 'player' ? 'PLAYER' : 'ENEMY') + ' · ' + actionName;
      d.defRole.textContent = (b.side === 'player' ? 'PLAYER' : 'ENEMY') + ' · TARGET';
      d.atkPlate.classList.toggle('is-player', a.side === 'player');
      d.defPlate.classList.toggle('is-player', b.side === 'player');
      d.atkPanel.className = 'bs-panel bs-panel-atk ' + (a.side === 'player' ? 'is-player' : 'is-enemy');
      d.defPanel.className = 'bs-panel bs-panel-def ' + (b.side === 'player' ? 'is-player' : 'is-enemy');
      d.atkPanel.querySelector('[data-side-tag]').textContent = a.side === 'player' ? '我方' : '敌方';
      d.defPanel.querySelector('[data-side-tag]').textContent = b.side === 'player' ? '我方' : '敌方';

      // rollCombat 会覆盖 hit/crit 为布尔判定结果，百分比在 hitChance/critChance。
      const hitChance = r.hitChance != null ? r.hitChance : (typeof r.hit === 'number' ? r.hit : 0);
      const critChance = r.critChance != null ? r.critChance : (typeof r.crit === 'number' ? r.crit : 0);
      this._setMetrics(d.atkPanel, ['HIT', 'DMG', 'CRT'], [hitChance, r.damage, critChance]);
      const response = r.response;
      this._setMetrics(d.defPanel, ['HIT', 'DMG', 'CRT'], response
        ? [response.hit, response.damage, response.crit] : ['—', '—', '—']);

      const typeName = r.damageType === 'magic' ? '魔法' : '物理';
      const tri = r.triangle > 0 ? '克制' : r.triangle < 0 ? '被克制' : '无克制';
      d.centerTag.textContent = actionName + ' · ' + typeName + ' · ' + tri;

      this._setHp('atk', a.hp, a.maxHp, 0);
      this._setHp('def', b.hp, b.maxHp, 0);

      d.announce.textContent = '';
      d.announce.className = 'bs-announce';
      d.crit.classList.remove('show');
      d.flash.classList.remove('active', 'crit');
      d.flash.style.opacity = '';
    }

    _setMetrics(panel, labels, values) {
      ['[data-m1-label]', '[data-m2-label]', '[data-m3-label]'].forEach((sel, i) => {
        const el = panel.querySelector(sel);
        if (el) el.textContent = labels[i];
      });
      ['[data-m1]', '[data-m2]', '[data-m3]'].forEach((sel, i) => {
        const el = panel.querySelector(sel);
        if (el) el.textContent = values[i];
      });
    }

    _setHp(side, hp, maxHp, delay) {
      const fill = side === 'atk' ? this.dom.atkHpFill : this.dom.defHpFill;
      const text = side === 'atk' ? this.dom.atkHpText : this.dom.defHpText;
      const apply = () => {
        const pct = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
        fill.style.width = (pct * 100).toFixed(1) + '%';
        fill.dataset.level = pct <= 0.25 ? 'low' : pct <= 0.55 ? 'mid' : '';
        text.textContent = Math.max(0, hp) + ' / ' + maxHp;
      };
      if (delay > 0) {
        global.setTimeout(apply, delay);
      } else {
        apply();
      }
    }

    _triggerImpact() {
      if (this.impacted) return;
      this.impacted = true;
      this.lastImpactAt = performance.now();
      const r = this.result;
      const d = this.dom;

      // 屏幕白闪：暴击更亮，由 CSS 动画快速衰减。
      d.flash.classList.remove('active', 'crit');
      void d.flash.offsetWidth;
      d.flash.classList.add('active');
      if (r.crit) d.flash.classList.add('crit');

      if (!r.hit) {
        d.announce.textContent = 'MISS';
        d.announce.className = 'bs-announce show miss';
      } else if (r.crit) {
        d.announce.textContent = '会心一击';
        d.announce.className = 'bs-announce show crit';
        d.crit.classList.add('show');
      } else {
        d.announce.textContent = '命中';
        d.announce.className = 'bs-announce show hit';
      }

      // 演出层面只做“预演掉血”；真正扣血仍等结算弹窗确认。
      if (r.hit) {
        this._setHp('def', r.hpAfter, r.defenderMaxHp, 40);
      }

      this._spawnParticles(r.hit, r.crit);
    }

    /* ------------------------------------------------------------
     * 画面
     * ---------------------------------------------------------- */

    _draw(elapsed) {
      if (!this.attacker || !this.defender) return;
      const ctx = this.ctx;
      const r = this.result;
      const t = elapsed / this.duration;
      const impactAge = elapsed - this.impactAt;
      const hit = r.hit;

      ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.imageSmoothingEnabled = false;

      // 轻微镜头推进 + 冲击抖动。
      let zoom = 1;
      let shakeX = 0;
      let shakeY = 0;
      if (impactAge >= 0 && impactAge < 300) {
        const p = 1 - impactAge / 300;
        const power = (r.crit ? 5.4 : 2.8) * p;
        shakeX = Math.sin(impactAge * 0.23) * power;
        shakeY = Math.cos(impactAge * 0.31) * power * 0.55;
        zoom += (r.crit ? 0.045 : 0.018) * p;
      }

      ctx.save();
      ctx.translate(W / 2 + shakeX, H * 0.56 + shakeY);
      ctx.scale(zoom, zoom);
      ctx.translate(-W / 2, -H * 0.56);
      this._drawBackground(ctx, elapsed);
      this._drawBattle(ctx, t, impactAge);
      ctx.restore();

      // 顶部 / 底部的暗角让 HUD 更清晰。
      const vig = ctx.createLinearGradient(0, 0, 0, H);
      vig.addColorStop(0, 'rgba(3,5,12,0.55)');
      vig.addColorStop(0.18, 'rgba(3,5,12,0)');
      vig.addColorStop(0.72, 'rgba(3,5,12,0)');
      vig.addColorStop(1, 'rgba(3,5,12,0.62)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, W, H);
    }

    _drawBattle(ctx, t, impactAge) {
      const a = this.attacker;
      const b = this.defender;
      const r = this.result;
      const hit = r.hit;
      const feetY = 242;
      const atkHome = 142;
      const defHome = 434;
      const kind = a.weapon.type;
      const ranged = kind === 'bow' || kind === 'tome';
      const takiCustom = a.id === 'taki' && MyGO.Characters && MyGO.Characters.hasActions(a.id);
      const swordCustom = (a.id === 'tomori' || a.id === 'xueyue') && MyGO.Characters && MyGO.Characters.hasActions(a.id);
      const retreatStart = takiCustom || swordCustom ? 0.70 : 0.62;
      const gap = a.id === 'rana' && MyGO.Characters && MyGO.Characters.hasActions(a.id)
        ? 80 : MELEE_GAP[kind] || 60;
      const dashTarget = defHome - gap;

      let atkX = atkHome;
      let defX = defHome;
      let atkY = feetY;
      let defY = feetY;
      let atkLean = 0;
      let defLean = 0;
      let defFlash = 0;
      let defAlpha = 1;

      // 待机呼吸。
      atkY += Math.sin(performance.now() / 360) * 1.1;
      defY += Math.sin(performance.now() / 420 + 1.4) * 1.1;

      if (ranged) {
        // 弓 / 魔法：原地蓄势，不冲到敌人脸上。
        if (t > 0.14 && t < CAST_RELEASE) {
          const p = clamp01((t - 0.14) / (CAST_RELEASE - 0.14));
          atkX -= 4 * Math.sin(Math.PI * p);
          atkY += 2 * Math.sin(Math.PI * p);
          atkLean = -0.045 * Math.sin(Math.PI * p);
        } else if (t >= CAST_RELEASE && t < 0.62) {
          atkLean = 0.035;
        } else if (t >= 0.62) {
          const p = clamp01((t - 0.62) / 0.22);
          atkLean = 0.035 * (1 - p);
        }
      } else {
        // 近战：后撤蓄力 -> 跑到敌人身边 -> 挥砍 / 劈砍 / 戳刺 -> 退回。
        if (t > 0.12 && t < DASH_START) {
          const p = clamp01((t - 0.12) / (DASH_START - 0.12));
          atkX -= 8 * easeOutCubic(p);
          atkY += 2 * easeOutCubic(p);
          atkLean = -0.05 * easeOutCubic(p);
        } else if (t >= DASH_START && t < DASH_END) {
          const p = clamp01((t - DASH_START) / (DASH_END - DASH_START));
          atkX = atkHome - 8 + (dashTarget - (atkHome - 8)) * easeInOutCubic(p);
          atkY -= 3 * Math.sin(Math.PI * p);
          atkLean = 0.16 * Math.sin(Math.PI * p);
        } else if (t >= DASH_END) {
          if (t < retreatStart) {
            const p = clamp01((t - DASH_END) / (retreatStart - DASH_END));
            atkX = dashTarget + 5 * Math.sin(Math.PI * p);
            atkLean = 0.20 * Math.sin(Math.PI * p);
          } else {
            const p = clamp01((t - retreatStart) / (0.84 - retreatStart));
            atkX = dashTarget + 5 + (atkHome - dashTarget - 5) * easeInOutCubic(p);
            atkLean = 0.14 * (1 - easeInOutCubic(p));
          }
        }
      }

      // 防守方：受击后仰 / 闪避侧移。
      if (impactAge >= 0) {
        if (hit) {
          const p = clamp01(impactAge / 520);
          defX += 17 * Math.sin(p * Math.PI) + 6 * p;
          defY += 2 * Math.sin(p * Math.PI);
          defLean = -0.11 * Math.sin(p * Math.PI);
          defFlash = impactAge < 130 ? 1 - impactAge / 130 : 0;
          if (r.killed || r.hpAfter <= 0) {
            defAlpha = 1 - clamp01((impactAge - 480) / 620);
          }
        } else {
          const p = clamp01(impactAge / 420);
          defX += 19 * Math.sin(p * Math.PI);
          defY -= 7 * Math.sin(p * Math.PI);
          defLean = 0.08 * Math.sin(p * Math.PI);
        }
      }

      // 地面影子。
      this._shadow(ctx, atkX, feetY + 2, 34, 6, 0.34);
      this._shadow(ctx, defX, feetY + 2, 34, 6, 0.28 * defAlpha);

      // 冲刺残影：只在近战跑动阶段出现。
      if (!ranged && t > DASH_START && t < 0.58) {
        const after = 1 - Math.abs(t - 0.45) / 0.13;
        if (after > 0) {
          for (let i = 3; i >= 1; i--) {
            const running = (a.id === 'tomori' || a.id === 'xueyue' || a.id === 'rana' || a.id === 'taki') && MyGO.Characters && MyGO.Characters.hasActions(a.id);
            this._sprite(ctx, a, atkX - i * 13, atkY, 1, 0, atkLean * 0.4, 0.06 * after,
              swordCustom && r.crit ? 'rush' : running ? 'run' : 'attack',
              swordCustom && r.crit ? Math.min(2, Math.floor(clamp01((t - DASH_START) / .20) * 3))
                : running ? Math.floor(t * (this.duration || 1800) / 55) % 8 : 1);
          }
        }
      }

      // 防守方先画，攻击方压在前景。
      // 命中后切到受伤帧；被击破则倒地。
      let defState = (r.killed || r.hpAfter <= 0) && impactAge >= 220
        ? 'down'
        : (hit && impactAge >= 0 ? 'hurt' : 'idle');
      const customAtk = MyGO.Characters && MyGO.Characters.hasActions(a.id);
      const customDef = MyGO.Characters && MyGO.Characters.hasActions(b.id);
      let atkState = t >= (customAtk ? 0.18 : 0.34) && t < (customAtk ? 0.70 : 0.68) ? 'attack' : 'idle';
      // 攻击行第 0 帧是正面举武器，后续帧包含转身，战斗中固定用第 0 帧。
      let atkFrame = customAtk ? (t > 0.62 ? 1 : Math.min(6, Math.floor(clamp01((t - 0.18) / 0.34) * 7))) : 0;
      if (swordCustom) {
        const idleTick = Math.floor(t * (this.duration || 1800) / 150) % (a.id === 'xueyue' ? 14 : 12);
        atkState = idleTick < 6 ? 'idle' : 'idle2';
        atkFrame = idleTick < 6 ? idleTick : idleTick - 6;
        if (r.crit && t >= DASH_START && t < .70) {
          atkState = 'attack';
          // Three running poses, draw, lift, forward slash at impact, spin out.
          atkFrame = a.id === 'xueyue'
            ? (t < IMPACT_T ? Math.min(4, Math.floor((t-DASH_START) / .28 * 5)) : t < .64 ? 5 : 6)
            : t < .46 ? Math.min(2, Math.floor((t-DASH_START) / .20 * 3))
              : t < .54 ? 3 : t < IMPACT_T ? 4 : t < .62 ? 5 : t < .66 ? 6 : 7;
        } else if (t >= DASH_START && t < DASH_END) {
          atkState = 'run';
          atkFrame = Math.floor(t * (this.duration || 1800) / 55) % 8;
        } else if (t >= DASH_END && t < .70) {
          atkState = 'attack';
          const action = a.id === 'xueyue' ? this.xueyueAction : this.tomoriAction;
          atkFrame = action === 'attack2' ? (a.id === 'xueyue'
            ? (t < .54 ? 0 : t < IMPACT_T ? 1 : t < .64 ? 2 : 3)
            : (t < IMPACT_T ? 0 : t < .64 ? 1 : 2))
            : (t < .54 ? 0 : t < IMPACT_T ? 1 : t < .63 ? 2 : 3);
        } else if (t >= .70 && t < .84) {
          atkState = 'walk';
          atkFrame = Math.floor(t * (this.duration || 1800) / 65) % 8;
        }
        atkY = feetY;
        atkLean = 0;
      }
      if (customAtk && a.id === 'rana') {
        const idleTick = Math.floor(t * (this.duration || 1800) / 150) % 12;
        atkState = idleTick < 6 ? 'idle' : 'idle2';
        atkFrame = idleTick % 6;
        const attackStart = r.crit ? 0.50 : 0.54;
        if (t >= DASH_START && t < 0.40) {
          atkState = 'run';
          atkFrame = Math.floor(t * (this.duration || 1800) / 50) % 8;
        } else if (t >= 0.40 && t < attackStart) {
          atkState = 'charge';
          atkFrame = Math.min(4, Math.floor((t - 0.40) / (attackStart - 0.40) * 5));
        } else if (t >= attackStart && t < 0.70) {
          atkState = 'attack';
          atkFrame = r.crit ? (t < 0.54 ? 0 : t < 0.56 ? 1 : t < IMPACT_T ? 2 : t < 0.64 ? 3 : 4)
            : (t < 0.56 ? 0 : t < IMPACT_T ? 1 : t < 0.64 ? 2 : 3);
        } else if (t >= 0.70 && t < 0.84) {
          atkState = 'walk';
          atkFrame = Math.floor(t * (this.duration || 1800) / 65) % 8;
        }
        // Spear is already in the artwork; a small lean keeps its grip steady.
        atkLean *= 0.35;
      }
      if (customAtk && a.id === 'anon') {
        atkState = 'idle';
        atkFrame = Math.floor(t * (this.duration || 1800) / 160) % 6;
        if (t >= 0.18 && t < 0.70) {
          atkState = 'attack';
          // Raise and draw the bow; release frame 2 at CAST_RELEASE, then
          // advance the four follow-through poses while the arrow flies.
          atkFrame = t < 0.30 ? 0 : t < CAST_RELEASE ? 1
            : Math.min(6, 2 + Math.floor((t - CAST_RELEASE + 1e-8) / 0.03));
        } else if (t >= 0.70 && t < 0.90) {
          atkState = 'walk';
          atkFrame = Math.min(7, Math.floor((t - 0.70) / 0.20 * 8));
          atkX -= 3 * Math.sin(Math.PI * (t - 0.70) / 0.20);
        }
        atkLean *= 0.3;
      }
      if (takiCustom) {
        const idleTick = Math.floor(t * (this.duration || 1800) / 150) % 12;
        atkState = idleTick < 6 ? 'idle' : 'idle2';
        atkFrame = idleTick % 6;
        const start = r.crit ? 0.44 : 0.46;
        if (t >= DASH_START && t < start) {
          atkState = 'run';
          atkFrame = Math.floor(t * (this.duration || 1800) / 55) % 8;
        } else if (t >= start && t < 0.70) {
          atkState = 'attack';
          if (r.crit) {
            // The forward extension strikes first; the overhead/back sweep
            // is follow-through, not the point where the opponent takes damage.
            atkFrame = t < .49 ? 0 : t < .53 ? 1 : t < IMPACT_T ? 2 : t < .61 ? 3
              : t < .63 ? 4 : t < .65 ? 5 : t < .675 ? 6 : 7;
          } else if (this.takiAction === 'attack2') {
            atkFrame = t < .49 ? 0 : t < .52 ? 1 : t < .55 ? 2 : t < .565 ? 3
              : t < IMPACT_T ? 4 : t < .64 ? 5 : 6;
          } else {
            atkFrame = t < .50 ? 0 : t < .54 ? 1 : t < IMPACT_T ? 2 : t < .62 ? 3 : t < .66 ? 4 : 5;
          }
        } else if (t >= .70 && t < .84) {
          atkState = 'walk';
          atkFrame = Math.floor(t * (this.duration || 1800) / 65) % 8;
        }
        // Source frames already describe the body rotation and axe motion.
        atkY = feetY;
        atkLean = 0;
      }
      let defFrame = 0;
      if (customDef && b.id === 'taki') {
        const idleTick = Math.floor(t * (this.duration || 1800) / 150) % 12;
        defState = idleTick < 6 ? 'idle' : 'idle2';
        defFrame = idleTick % 6;
        if (hit && (r.killed || r.hpAfter <= 0) && impactAge >= 140) {
          defState = 'down';
          defFrame = Math.min(4, Math.floor((impactAge - 140) / 95));
          defY = feetY;
          defLean = 0;
          defAlpha = 1 - clamp01((impactAge - 620) / 520);
        } else if (hit && impactAge >= 0 && impactAge < 450) {
          defState = 'hurt';
          defFrame = Math.min(3, Math.floor(impactAge / 95));
        } else if (!hit && impactAge >= 0 && impactAge < 560) {
          defState = 'jump';
          defFrame = Math.min(7, Math.floor(impactAge / 70));
          defY = feetY;
          defLean = 0;
        }
      } else if (customDef && b.id === 'anon') {
        defState = 'idle';
        defFrame = Math.floor(t * (this.duration || 1800) / 160) % 6;
        if (hit && (r.killed || r.hpAfter <= 0) && impactAge >= 140) {
          defState = 'down';
          defFrame = Math.min(4, Math.floor((impactAge - 140) / 95));
          defY = feetY;
          defLean = 0;
          defAlpha = 1 - clamp01((impactAge - 620) / 520);
        } else if (hit && impactAge >= 0 && impactAge < 400) {
          defState = 'hurt';
          defFrame = Math.min(2, Math.floor(impactAge / 95));
        } else if (!hit && impactAge >= 0 && impactAge < 480) {
          // This sheet supplies walking, so dodge by stepping aside.
          defState = 'walk';
          defFrame = Math.min(7, Math.floor(impactAge / 60));
          defY = feetY;
          defLean = 0;
        }
      } else if (customDef && b.id === 'rana') {
        const idleTick = Math.floor(t * (this.duration || 1800) / 150) % 12;
        defState = idleTick < 6 ? 'idle' : 'idle2';
        defFrame = idleTick % 6;
        if (hit && (r.killed || r.hpAfter <= 0) && impactAge >= 140) {
          defState = 'down';
          defFrame = Math.min(4, Math.floor((impactAge - 140) / 95));
          defY = feetY;
          defLean = 0;
          defAlpha = 1 - clamp01((impactAge - 620) / 520);
        } else if (hit && impactAge >= 0 && impactAge < 400) {
          defState = 'hurt';
          defFrame = Math.min(2, Math.floor(impactAge / 95));
        } else if (!hit && impactAge >= 0 && impactAge < 560) {
          defState = 'jump';
          defFrame = Math.min(7, Math.floor(impactAge / 70));
          // The supplied frames already contain the jump arc.
          defY = feetY;
          defLean = 0;
        }
      } else if (customDef && (b.id === 'tomori' || b.id === 'xueyue')) {
        const idleTick = Math.floor(t * (this.duration || 1800) / 150) % (b.id === 'xueyue' ? 14 : 12);
        defState = idleTick < 6 ? 'idle' : 'idle2';
        defFrame = idleTick < 6 ? idleTick : idleTick - 6;
        if (hit && (r.killed || r.hpAfter <= 0) && impactAge >= 140) {
          defState = 'down';
          defFrame = Math.min(b.id === 'xueyue' ? 4 : 3, Math.floor((impactAge - 140) / 95));
          defY = feetY;
          defLean = 0;
          defAlpha = 1 - clamp01((impactAge - 620) / 520);
        } else if (hit && impactAge >= 0 && impactAge < 450) {
          defState = 'hurt';
          defFrame = Math.min(2, Math.floor(impactAge / 95));
        } else if (!hit && impactAge >= 0 && impactAge < 560) {
          defState = 'jump';
          defFrame = Math.min(7, Math.floor(impactAge / 70));
          defY = feetY;
          defLean = 0;
        }
      } else if (customDef) {
        if (!hit && impactAge >= 0 && impactAge < 540) {
          defState = 'jump';
          defFrame = Math.min(7, Math.floor(impactAge / 67));
        } else if (defState === 'down') {
          defFrame = Math.min(5, Math.floor((impactAge - 220) / 85));
        } else if (defState === 'hurt') {
          defFrame = Math.min(6, 2 + Math.floor(impactAge / 90));
        }
      }
      this._sprite(ctx, b, defX, defY, -1, defFlash, defLean, defAlpha, defState, defFrame);
      this._sprite(ctx, a, atkX, atkY, 1, 0, atkLean, 1, atkState, atkFrame,
        a.id === 'xueyue' ? (r.crit ? 'rush' : this.xueyueAction || 'attack')
          : a.id === 'tomori' ? (r.crit ? 'rush' : this.tomoriAction || 'attack')
          : a.id === 'taki' ? (r.crit ? 'special' : this.takiAction || 'attack')
          : a.id === 'rana' ? (r.crit ? 'attack2' : 'attack') : r.crit ? 'flame' : 'fireball');

      // 按武器类型绘制攻击动作与飞行道具。
      this._drawWeaponFx(ctx, kind, t, atkX, atkY, defX, feetY);

      // 命中特效 / 伤害数字。
      if (impactAge >= 0 && impactAge < 1000) {
        this._drawImpact(ctx, defX, feetY - 64, impactAge, kind, this.palette);
      }

      // 粒子。
      this._drawParticles(ctx);
    }

    _sprite(ctx, unit, x, y, facing, flash, lean, alpha, state, frame, action) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(lean || 0);
      ctx.globalAlpha = alpha == null ? 1 : alpha;
      if (flash > 0) {
        ctx.filter = 'brightness(' + (1 + flash * 2.2).toFixed(2) + ') saturate(' + (1 - flash * 0.55).toFixed(2) + ')';
      }
      const isPlayer = unit.side === 'player';
      const height = isPlayer ? 90 : 105;
      const hasSheets = !!(MyGO.Characters && MyGO.Characters.has(unit.id));
      if (hasSheets) {
        // 自定义图集直接选左右侧面行，不再依赖负缩放翻转。
        const dir = facing >= 0 ? 'right' : 'left';
        MyGO.Characters.drawBattlePose(ctx, unit, 0, 0, height, state || 'idle', frame, dir, action);
      } else {
        ctx.scale(facing, 1);
        A.drawUnit(ctx, unit, -height / 2, -height, height, { noFlip: true, portrait: true, static: true });
      }
      ctx.restore();
    }

    _shadow(ctx, x, y, rx, ry, alpha) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    /**
     * 武器专属攻击演出：
     *   sword 挥砍（短促直线剑光，不再是原来的大弧线）
     *   axe   劈砍（自上而下的重斩）
     *   lance 戳刺（笔直枪线）
     *   bow   拉弓 + 箭矢飞行
     *   tome  蓄法 + 按属性配色的魔法球
     */
    _drawWeaponFx(ctx, kind, t, atkX, atkY, defX, defY) {
      if (kind === 'sword') this._drawSwordSlash(ctx, t, atkX, atkY, defX, defY);
      else if (kind === 'axe') this._drawAxeChop(ctx, t, atkX, atkY, defX, defY);
      else if (kind === 'lance') this._drawLanceThrust(ctx, t, atkX, atkY, defX, defY);
      else if (kind === 'bow') this._drawBowShot(ctx, t, atkX, atkY, defX, defY);
      else if (kind === 'tome') this._drawMagicOrb(ctx, t, atkX, atkY, defX, defY);
    }

    _drawSwordSlash(ctx, t, atkX, atkY, defX, defY) {
      // The new Tomori artwork already contains sword and slash trails.
      if ((this.attacker.id === 'tomori' || this.attacker.id === 'xueyue')
        && MyGO.Characters && MyGO.Characters.hasActions(this.attacker.id)) return;
      if (t < 0.48 || t > 0.67) return;
      const p = clamp01((t - 0.48) / 0.19);
      const alpha = Math.sin(Math.PI * p) * 0.95;
      const x1 = atkX + 24;
      const y1 = atkY - 88;
      const x2 = Math.min(defX - 2, atkX + 82);
      const y2 = atkY - 42;

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      ctx.globalAlpha = alpha * 0.32;
      ctx.strokeStyle = '#8fe8ff';
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#fffdf0';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // 剑尖的小星芒，让“挥砍”更有落点。
      ctx.fillStyle = '#fff7d6';
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI * 0.5 + p * 2;
        px(ctx, x2 + Math.cos(a) * 5 - 1, y2 + Math.sin(a) * 5 - 1, 2, 2, '#fff7d6');
      }
      ctx.restore();
    }

    _drawAxeChop(ctx, t, atkX, atkY, defX, defY) {
      // Taki's atlas includes both axe and trails. General impact particles
      // remain, but do not paint a second slash over the authored animation.
      if (this.attacker.id === 'taki' && MyGO.Characters && MyGO.Characters.hasActions('taki')) return;
      if (t < 0.47 || t > 0.67) return;
      const p = clamp01((t - 0.47) / 0.20);
      const ease = easeInCubic(p);
      const alpha = Math.sin(Math.PI * p) * 0.95;
      const x1 = atkX + 29;
      const y1 = atkY - 122;
      const x2 = atkX + 36 + (Math.min(defX - 18, atkX + 68) - (atkX + 36)) * ease;
      const y2 = y1 + (atkY - 34 - y1) * ease;

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      ctx.globalAlpha = alpha * 0.30;
      ctx.strokeStyle = '#ffb84d';
      ctx.lineWidth = 15;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#fff3cf';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // 重斧落下时的碎石。
      if (p > 0.65) {
        for (let i = 0; i < 6; i++) {
          const q = (p - 0.65) / 0.35;
          px(ctx, x2 + (i - 3) * 5 * q, y2 + 8 + i * 2 * q, 2, 2, '#d8b16a');
        }
      }
      ctx.restore();
    }

    _drawLanceThrust(ctx, t, atkX, atkY, defX, defY) {
      if (this.attacker.id === 'rana' && MyGO.Characters && MyGO.Characters.hasActions('rana')) {
        // Keep the original spear visible; only add a brief trail at its tip.
        if (t < 0.56 || t > 0.66) return;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = Math.sin(Math.PI * clamp01((t - 0.56) / 0.10)) * 0.65;
        ctx.strokeStyle = '#d7f8f1';
        ctx.lineWidth = 1;
        for (const offset of [-6, 6]) {
          ctx.beginPath();
          ctx.moveTo(atkX + 40, atkY - 39 + offset);
          ctx.lineTo(Math.min(defX - 8, atkX + 83), atkY - 39 + offset);
          ctx.stroke();
        }
        ctx.restore();
        return;
      }
      if (t < 0.47 || t > 0.66) return;
      const p = clamp01((t - 0.47) / 0.17);
      const alpha = Math.sin(Math.PI * p) * 0.95;
      const y = atkY - 61;
      const x1 = atkX + 22;
      const x2 = x1 + (defX - 4 - x1) * easeOutCubic(p);

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = alpha * 0.28;
      ctx.strokeStyle = '#9ff4ff';
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(x1, y);
      ctx.lineTo(x2, y);
      ctx.stroke();

      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#f4feff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x1, y);
      ctx.lineTo(x2, y);
      ctx.stroke();
      // 枪尖三角。
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(x2 + 12, y);
      ctx.lineTo(x2 - 2, y - 5);
      ctx.lineTo(x2 - 2, y + 5);
      ctx.closePath();
      ctx.fill();
      // 速度线。
      ctx.globalAlpha = alpha * 0.5;
      ctx.strokeStyle = '#b9f7ff';
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const yy = y - 10 + i * 10;
        ctx.beginPath();
        ctx.moveTo(x1 - 8, yy);
        ctx.lineTo(x1 - 30 - i * 5, yy);
        ctx.stroke();
      }
      ctx.restore();
    }

    _drawBowShot(ctx, t, atkX, atkY, defX, defY) {
      if (this.attacker.id === 'anon' && MyGO.Characters && MyGO.Characters.hasActions('anon')) {
        // The painted bow and string are in the actor frames. Fly only the
        // separately extracted arrow, from release up to the impact clock.
        if (t >= CAST_RELEASE && t < IMPACT_T) {
          const p = clamp01((t - CAST_RELEASE) / (IMPACT_T - CAST_RELEASE));
          const x = atkX + 54 + (defX - 24 - atkX - 54) * p;
          const y = atkY - 61 + (defY - 64 - (atkY - 61)) * p - Math.sin(Math.PI * p) * 5;
          MyGO.Characters.drawProjectile(ctx, this.attacker, x, y, 10);
        }
        return;
      }
      const handX = atkX + 30;
      const handY = atkY - 66;
      const drawP = clamp01((t - 0.28) / 0.18);
      const flight = clamp01((t - CAST_RELEASE) / (IMPACT_T - CAST_RELEASE));

      ctx.save();
      // 拉弓：画出弓身、被拉开的弦和搭在弦上的箭。
      if (t >= 0.28 && t < 0.50) {
        const pull = 7 + 5 * drawP;
        ctx.globalAlpha = 0.85;
        ctx.strokeStyle = '#e9d7a2';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(handX, handY, 17, -1.25, 1.25);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(handX + 5, handY - 16);
        ctx.lineTo(handX - pull, handY);
        ctx.lineTo(handX + 5, handY + 16);
        ctx.stroke();
        ctx.fillStyle = '#fff4cf';
        px(ctx, handX - pull, handY - 1, 20, 2, '#fff4cf');
        ctx.beginPath();
        ctx.moveTo(handX + 20, handY);
        ctx.lineTo(handX + 13, handY - 4);
        ctx.lineTo(handX + 13, handY + 4);
        ctx.closePath();
        ctx.fill();
      }

      // 箭矢飞行：从弓弦位置飞向目标。
      if (flight > 0 && flight < 1.08) {
        const a = Math.min(1, flight);
        const x = handX + (defX - 18 - handX) * a;
        const y = handY + (defY - 64 - handY) * a - Math.sin(Math.PI * a) * 8;
        ctx.globalAlpha = 1 - Math.max(0, a - 0.86) * 4;
        ctx.strokeStyle = 'rgba(255,236,176,0.55)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - 42, y + 7);
        ctx.lineTo(x - 4, y);
        ctx.stroke();
        ctx.strokeStyle = '#fff4cf';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - 18, y);
        ctx.lineTo(x + 5, y);
        ctx.stroke();
        // 箭头。
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(x + 12, y);
        ctx.lineTo(x + 3, y - 4);
        ctx.lineTo(x + 3, y + 4);
        ctx.closePath();
        ctx.fill();
        // 箭羽。
        ctx.strokeStyle = '#ffb3c8';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x - 17, y);
        ctx.lineTo(x - 23, y - 4);
        ctx.moveTo(x - 17, y);
        ctx.lineTo(x - 23, y + 4);
        ctx.stroke();
      }
      ctx.restore();
    }

    _drawMagicOrb(ctx, t, atkX, atkY, defX, defY) {
      const pal = this.palette || ELEMENT_PALETTES.arcane;
      const handX = atkX + 27;
      const handY = atkY - 75;
      const charge = clamp01((t - 0.24) / 0.20);
      const flight = clamp01((t - CAST_RELEASE) / (IMPACT_T - CAST_RELEASE));

      // Soyo's own hand flames are already in the action frames. Fly the
      // extracted painted fireball once, then let the impact effect take over.
      if (MyGO.Characters && MyGO.Characters.hasActions(this.attacker.id)) {
        if (t > CAST_RELEASE && t < IMPACT_T) {
          const x = handX + (defX - 22 - handX) * flight;
          const y = atkY - 58 + (defY - 64 - (atkY - 58)) * flight - Math.sin(Math.PI * flight) * 10;
          MyGO.Characters.drawProjectile(ctx, this.attacker, x, y, 24);
        }
        return;
      }

      // 蓄力：手边逐渐成形的魔法球。
      if (charge > 0 && t < CAST_RELEASE + 0.03) {
        const r = 2 + 7 * charge;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(handX, handY, 0, handX, handY, r * 3.2);
        g.addColorStop(0, pal.core);
        g.addColorStop(0.28, pal.mid);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(handX, handY, r * 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = pal.core;
        ctx.beginPath();
        ctx.arc(handX, handY, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 飞行：发光魔法球 + 拖尾 + 环绕粒子。
      if (flight > 0 && flight < 1.06) {
        const a = Math.min(1, flight);
        const x = handX + (defX - 22 - handX) * a;
        const y = handY + (defY - 64 - handY) * a - Math.sin(Math.PI * a) * 14;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        // 拖尾。
        for (let i = 1; i <= 7; i++) {
          const q = Math.max(0, a - i * 0.045);
          const tx = handX + (defX - 22 - handX) * q;
          const ty = handY + (defY - 64 - handY) * q - Math.sin(Math.PI * q) * 14;
          ctx.globalAlpha = (1 - i / 8) * 0.35;
          ctx.fillStyle = pal.glow;
          ctx.beginPath();
          ctx.arc(tx, ty, 9 - i * 0.8, 0, Math.PI * 2);
          ctx.fill();
        }
        // 外发光。
        const g = ctx.createRadialGradient(x, y, 0, x, y, 28);
        g.addColorStop(0, pal.core);
        g.addColorStop(0.25, pal.mid);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = 0.95;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, 28, 0, Math.PI * 2);
        ctx.fill();
        // 核心。
        ctx.globalAlpha = 1;
        ctx.fillStyle = pal.core;
        ctx.beginPath();
        ctx.arc(x, y, 6.5, 0, Math.PI * 2);
        ctx.fill();
        // 环绕光点。
        for (let i = 0; i < 5; i++) {
          const ang = a * 9 + i * (Math.PI * 2 / 5);
          ctx.globalAlpha = 0.7;
          ctx.fillStyle = i % 2 ? pal.mid : pal.core;
          px(ctx, x + Math.cos(ang) * (13 + i), y + Math.sin(ang) * (8 + i), 2, 2, i % 2 ? pal.mid : pal.core);
        }
        ctx.restore();
      }
    }

    _drawImpact(ctx, x, y, age, kind, palette) {
      const r = this.result;
      const pal = palette || ELEMENT_PALETTES.arcane;
      if (r.hit) {
        const p = clamp01(age / 260);
        const alpha = 1 - p;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = alpha;

        if (kind === 'tome') {
          // 魔法：属性色爆炸球 + 扩散环，而不是物理斩击线。
          const radius = 18 + p * 45;
          const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
          g.addColorStop(0, pal.core);
          g.addColorStop(0.30, pal.mid);
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = pal.mid;
          ctx.lineWidth = 3 * (1 - p) + 1;
          ctx.beginPath();
          ctx.arc(x, y, 12 + p * 30, 0, Math.PI * 2);
          ctx.stroke();
          for (let i = 0; i < 8; i++) {
            const a = i * Math.PI / 4 + p;
            ctx.fillStyle = i % 2 ? pal.core : pal.mid;
            ctx.fillRect(
              x + Math.cos(a) * (12 + p * 42) - 1,
              y + Math.sin(a) * (12 + p * 42) - 1,
              3, 3
            );
          }
        } else if (kind === 'bow') {
          // 箭矢命中：小星芒 + 短冲击线。
          ctx.strokeStyle = '#fff4cf';
          ctx.lineWidth = 2;
          for (let i = 0; i < 4; i++) {
            const a = i * Math.PI / 2;
            ctx.beginPath();
            ctx.moveTo(x + Math.cos(a) * 5, y + Math.sin(a) * 5);
            ctx.lineTo(x + Math.cos(a) * 26, y + Math.sin(a) * 26);
            ctx.stroke();
          }
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(x, y, 7 * (1 - p), 0, Math.PI * 2);
          ctx.fill();
        } else {
          // 剑 / 斧 / 枪：保留线条冲击，但按武器轻重区分。
          const lines = kind === 'axe' ? 5 : kind === 'sword' ? 4 : 1;
          const weight = kind === 'axe' ? 3 : kind === 'lance' ? 3 : 2;
          ctx.strokeStyle = kind === 'axe' ? '#ffe0a3' : '#ffffff';
          ctx.lineWidth = weight;
          for (let i = 0; i < lines; i++) {
            const off = (i - (lines - 1) / 2) * (kind === 'lance' ? 9 : 13);
            ctx.beginPath();
            if (kind === 'lance') {
              ctx.moveTo(x - 42, y + off);
              ctx.lineTo(x + 32, y + off);
            } else {
              ctx.moveTo(x - 30, y - 32 + off);
              ctx.lineTo(x + 34, y + 26 + off);
            }
            ctx.stroke();
          }
        }

        if (r.crit) {
          ctx.globalAlpha = alpha * 0.85;
          ctx.strokeStyle = '#ffd166';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, y, 34 + p * 22, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }

      if (age < 880) {
        const p = age / 880;
        ctx.save();
        ctx.globalAlpha = 1 - p * p;
        ctx.textAlign = 'center';
        ctx.font = 'bold ' + (r.crit ? 27 : 21) + 'px "Courier New", monospace';
        ctx.lineWidth = 5;
        ctx.strokeStyle = 'rgba(8,8,18,0.9)';
        const text = r.hit ? '-' + r.finalDamage : 'MISS';
        const yy = y - 48 - p * 26;
        ctx.strokeText(text, x, yy);
        ctx.fillStyle = r.hit
          ? (r.crit ? '#ffe08a' : (r.damageType === 'magic' ? pal.text : '#ffffff'))
          : '#8ce9ef';
        ctx.fillText(text, x, yy);
        ctx.restore();
      }
    }

    _spawnParticles(hit, crit) {
      if (!hit) return;
      const kind = this.attacker.weapon.type;
      const pal = this.palette || ELEMENT_PALETTES.arcane;
      const count = crit ? 28 : kind === 'bow' ? 10 : kind === 'tome' ? 22 : 16;
      const colors = kind === 'tome'
        ? [pal.core, pal.mid, pal.glow, '#ffffff']
        : kind === 'bow'
          ? ['#fff4cf', '#ffd166', '#ffb3c8']
          : ['#ffe08a', '#ffffff', '#ffd166'];

      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 18 + Math.random() * (crit ? 80 : kind === 'tome' ? 64 : 48);
        this.particles.push({
          x: 434 + (Math.random() - 0.5) * 34,
          y: 176 + (Math.random() - 0.5) * 26,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 20,
          life: 0.45 + Math.random() * 0.45,
          age: 0,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: crit ? 2 : kind === 'tome' ? 2 : 1
        });
      }
    }

    _drawParticles(ctx) {
      const ageSec = this.impacted ? (performance.now() - this.lastImpactAt) / 1000 : 0;
      ctx.save();
      for (const p of this.particles) {
        const life = Math.max(0, 1 - ageSec / p.life);
        if (life <= 0) continue;
        const x = p.x + p.vx * ageSec;
        const y = p.y + p.vy * ageSec + 70 * ageSec * ageSec;
        ctx.globalAlpha = life;
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(x), Math.round(y), p.size * 2, p.size * 2);
      }
      ctx.restore();
    }

    /* ------------------------------------------------------------
     * 背景
     * ---------------------------------------------------------- */

    _buildBackground() {
      const bg = document.createElement('canvas');
      bg.width = W * SCALE;
      bg.height = H * SCALE;
      const ctx = bg.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
      this._paintBackground(ctx);
      this.bg = bg;
    }

    _drawBackground(ctx, elapsed) {
      ctx.drawImage(this.bg, 0, 0, W, H);

      // 缓慢移动的云影与萤火尘，为静态背景增加空气感。
      const cloudX = ((elapsed / 18000) % 1.4 - 0.2) * W;
      const shade = ctx.createRadialGradient(cloudX, 180, 18, cloudX, 180, 160);
      shade.addColorStop(0, 'rgba(9,14,30,0.16)');
      shade.addColorStop(1, 'rgba(9,14,30,0)');
      ctx.fillStyle = shade;
      ctx.fillRect(0, 90, W, 150);

      for (let i = 0; i < 14; i++) {
        const x = (hash(i, 5, 4) * W + elapsed * (0.002 + hash(i, 8, 2) * 0.003)) % W;
        const y = 108 + hash(i, 9, 7) * 108;
        const tw = 0.25 + Math.sin(elapsed / 600 + i) * 0.18;
        ctx.globalAlpha = Math.max(0.04, tw);
        ctx.fillStyle = i % 3 ? '#9fe9e0' : '#ffe6a8';
        ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
      }
      ctx.globalAlpha = 1;
    }

    _paintBackground(ctx) {
      // 天空：黄昏由深蓝过渡到暖橘。
      const sky = ctx.createLinearGradient(0, 0, 0, 220);
      sky.addColorStop(0, '#081021');
      sky.addColorStop(0.42, '#1d2945');
      sky.addColorStop(0.68, '#5f5261');
      sky.addColorStop(0.85, '#bb846e');
      sky.addColorStop(1, '#e3ad82');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, 224);

      // 星点。
      for (let i = 0; i < 42; i++) {
        const x = Math.floor(hash(i, 1, 11) * W);
        const y = Math.floor(hash(i, 2, 12) * 92);
        const a = 0.16 + hash(i, 3, 13) * 0.5;
        ctx.globalAlpha = a;
        ctx.fillStyle = '#ffeccd';
        ctx.fillRect(x, y, 1, 1);
      }
      ctx.globalAlpha = 1;

      // 月亮与光晕。
      const moon = ctx.createRadialGradient(356, 47, 2, 356, 47, 54);
      moon.addColorStop(0, 'rgba(255,244,210,0.65)');
      moon.addColorStop(0.24, 'rgba(255,225,180,0.18)');
      moon.addColorStop(1, 'rgba(255,225,180,0)');
      ctx.fillStyle = moon;
      ctx.fillRect(300, 0, 112, 104);
      ctx.fillStyle = '#fff0c9';
      ctx.beginPath();
      ctx.arc(356, 47, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e8d3a9';
      ctx.beginPath();
      ctx.arc(352, 44, 2, 0, Math.PI * 2);
      ctx.arc(360, 51, 1.5, 0, Math.PI * 2);
      ctx.fill();

      // 云带。
      for (let i = 0; i < 4; i++) {
        const y = 60 + i * 16;
        const alpha = 0.08 + i * 0.012;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = i % 2 ? '#f4c6a3' : '#d6d8ea';
        const shift = i * 41;
        for (let x = -30; x < W + 40; x += 58) {
          ctx.fillRect(x + shift, y, 29, 2);
          ctx.fillRect(x + shift + 8, y - 2, 17, 1);
          ctx.fillRect(x + shift + 14, y + 2, 23, 1);
        }
      }
      ctx.globalAlpha = 1;

      this._paintMountains(ctx);
      ctx.save();
      ctx.translate(64, 0);
      this._paintCastle(ctx);
      ctx.restore();
      this._paintGround(ctx);
    }

    _paintMountains(ctx) {
      // 远山。
      ctx.fillStyle = '#252b45';
      ctx.beginPath();
      ctx.moveTo(0, 156);
      ctx.lineTo(44, 105);
      ctx.lineTo(89, 146);
      ctx.lineTo(134, 92);
      ctx.lineTo(180, 145);
      ctx.lineTo(236, 100);
      ctx.lineTo(282, 149);
      ctx.lineTo(338, 88);
      ctx.lineTo(392, 146);
      ctx.lineTo(W, 112);
      ctx.lineTo(W, 190);
      ctx.lineTo(0, 190);
      ctx.closePath();
      ctx.fill();

      // 雪线。
      ctx.fillStyle = '#8f9ab6';
      const caps = [[44, 105, 10], [134, 92, 12], [236, 100, 10], [338, 88, 14]];
      for (const [x, y, w] of caps) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + w, y + 13);
        ctx.lineTo(x + 4, y + 9);
        ctx.lineTo(x - 2, y + 14);
        ctx.closePath();
        ctx.fill();
      }

      // 近处山影。
      ctx.fillStyle = '#1c2338';
      ctx.beginPath();
      ctx.moveTo(0, 182);
      ctx.lineTo(70, 140);
      ctx.lineTo(122, 175);
      ctx.lineTo(190, 132);
      ctx.lineTo(252, 178);
      ctx.lineTo(320, 138);
      ctx.lineTo(390, 176);
      ctx.lineTo(W, 150);
      ctx.lineTo(W, 214);
      ctx.lineTo(0, 214);
      ctx.closePath();
      ctx.fill();
    }

    _paintCastle(ctx) {
      // 主城墙。
      const wallY = 108;
      px(ctx, 46, wallY, 356, 112, '#3d4058');
      px(ctx, 46, wallY, 356, 5, '#5b5f78');
      px(ctx, 46, 214, 356, 5, '#24283a');

      // 砖缝。
      for (let row = 0; row < 9; row++) {
        const y = wallY + 8 + row * 12;
        px(ctx, 48, y + 10, 352, 1, '#303347');
        for (let col = 0; col < 15; col++) {
          const x = 50 + col * 24 + (row % 2 ? 12 : 0);
          px(ctx, x, y, 1, 10, '#34384e');
        }
      }

      // 顶部城齿。
      for (let x = 46; x < 402; x += 22) {
        px(ctx, x, wallY - 12, 13, 13, '#4b4f69');
        px(ctx, x, wallY - 12, 13, 2, '#6f748e');
        px(ctx, x + 10, wallY - 7, 3, 8, '#303447');
      }

      this._tower(ctx, 8, 54, 74, 166);
      this._tower(ctx, 366, 54, 74, 166);

      // 中央拱门。
      px(ctx, 184, 138, 80, 82, '#262a3d');
      ctx.fillStyle = '#202435';
      ctx.beginPath();
      ctx.arc(224, 138, 40, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#171b2a';
      ctx.beginPath();
      ctx.arc(224, 142, 32, Math.PI, 0);
      ctx.fill();
      px(ctx, 194, 142, 60, 72, '#151927');
      for (let i = 0; i < 6; i++) px(ctx, 198 + i * 10, 146, 1, 68, '#2b3042');
      px(ctx, 220, 146, 2, 68, '#3b4058');

      // 两侧塔窗。
      this._window(ctx, 38, 88);
      this._window(ctx, 394, 88);
      this._window(ctx, 74, 130);
      this._window(ctx, 358, 130);

      // 旗帜与藤蔓。
      this._banner(ctx, 142, 128, '#b74768', '#ffb3ce');
      this._banner(ctx, 288, 128, '#2d7b7c', '#9ee3d8');

      for (let i = 0; i < 5; i++) {
        const x = 104 + i * 58;
        const len = 22 + Math.floor(hash(i, 20, 9) * 30);
        px(ctx, x, wallY - 9, 1, len, '#2f6048');
        px(ctx, x + 2, wallY - 9 + len - 7, 2, 2, '#67a36e');
        px(ctx, x - 2, wallY - 9 + len - 15, 2, 2, '#67a36e');
      }

      // 墙头苔藓。
      for (let i = 0; i < 30; i++) {
        const x = 48 + Math.floor(hash(i, 30, 3) * 352);
        const y = wallY + 3 + Math.floor(hash(i, 31, 5) * 100);
        px(ctx, x, y, 1 + (i % 2), 1, i % 3 ? '#405b4a' : '#677c63');
      }
    }

    _tower(ctx, x, y, w, h) {
      px(ctx, x, y, w, h, '#43465f');
      px(ctx, x, y, 5, h, '#5d617b');
      px(ctx, x + w - 5, y, 5, h, '#2e3146');
      px(ctx, x, y, w, 4, '#70748e');

      // 锥形屋顶。
      ctx.fillStyle = '#22283d';
      ctx.beginPath();
      ctx.moveTo(x - 8, y);
      ctx.lineTo(x + w / 2, y - 34);
      ctx.lineTo(x + w + 8, y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#4b4f69';
      ctx.beginPath();
      ctx.moveTo(x + 3, y - 2);
      ctx.lineTo(x + w / 2, y - 30);
      ctx.lineTo(x + w - 3, y - 2);
      ctx.closePath();
      ctx.fill();

      for (let row = 0; row < 10; row++) {
        px(ctx, x + 4, y + 10 + row * 14, w - 8, 1, '#34374d');
      }
      for (let col = 0; col < 4; col++) {
        px(ctx, x + 7 + col * 16, y + 8, 1, h - 14, '#34374d');
      }

      // 窗口。
      px(ctx, x + w / 2 - 5, y + 48, 10, 18, '#151927');
      px(ctx, x + w / 2 - 4, y + 49, 8, 16, '#7a5c55');
      px(ctx, x + w / 2 - 1, y + 50, 2, 14, '#3a2d32');

      // 塔基倒影。
      px(ctx, x, y + h - 12, w, 3, '#292d40');
    }

    _window(ctx, x, y) {
      px(ctx, x - 2, y - 2, 8, 15, '#262a3d');
      px(ctx, x, y, 4, 11, '#e4a475');
      px(ctx, x + 1, y + 1, 2, 9, '#8d5e55');
    }

    _banner(ctx, x, y, main, light) {
      px(ctx, x - 1, y - 3, 22, 2, '#d9c6a3');
      px(ctx, x, y, 20, 48, main);
      px(ctx, x + 2, y + 2, 3, 44, light);
      px(ctx, x + 15, y + 2, 3, 44, '#171b28');
      ctx.fillStyle = light;
      ctx.beginPath();
      ctx.moveTo(x + 10, y + 13);
      ctx.lineTo(x + 15, y + 20);
      ctx.lineTo(x + 10, y + 27);
      ctx.lineTo(x + 5, y + 20);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = main;
      ctx.beginPath();
      ctx.moveTo(x + 10, y + 17);
      ctx.lineTo(x + 13, y + 20);
      ctx.lineTo(x + 10, y + 23);
      ctx.lineTo(x + 7, y + 20);
      ctx.closePath();
      ctx.fill();
      // 燕尾。
      ctx.fillStyle = main;
      ctx.beginPath();
      ctx.moveTo(x, y + 48);
      ctx.lineTo(x + 10, y + 42);
      ctx.lineTo(x + 20, y + 48);
      ctx.lineTo(x + 20, y + 52);
      ctx.lineTo(x, y + 52);
      ctx.closePath();
      ctx.fill();
    }

    _paintGround(ctx) {
      const grass = ctx.createLinearGradient(0, 190, 0, H);
      grass.addColorStop(0, '#3b4b3b');
      grass.addColorStop(0.35, '#2d4230');
      grass.addColorStop(1, '#17261d');
      ctx.fillStyle = grass;
      ctx.fillRect(0, 190, W, H - 190);

      // 中央石径。
      ctx.fillStyle = '#34394a';
      ctx.beginPath();
      ctx.moveTo(198, 214);
      ctx.lineTo(250, 214);
      ctx.lineTo(292, H);
      ctx.lineTo(156, H);
      ctx.closePath();
      ctx.fill();
      for (let row = 0; row < 6; row++) {
        const y = 226 + row * 16;
        const width = 38 + row * 6;
        for (let i = 0; i < 3; i++) {
          const x = 224 - width / 2 + i * (width / 3);
          px(ctx, x + 1, y, width / 3 - 3, 12, row % 2 ? '#3d4254' : '#383d4f');
        }
      }

      // 两侧石台。
      this._platform(ctx, 142, 244, 58, 18);
      this._platform(ctx, 434, 244, 58, 18);

      // 草地边缘与碎石。
      for (let i = 0; i < 120; i++) {
        const x = Math.floor(hash(i, 40, 21) * W);
        const y = 198 + Math.floor(hash(i, 41, 22) * 116);
        const h = 2 + Math.floor(hash(i, 42, 23) * 5);
        const color = i % 4 ? '#486848' : '#6d815b';
        px(ctx, x, y, 1, h, '#203328');
        px(ctx, x, y, 1, h - 1, color);
      }

      // 小花。
      for (let i = 0; i < 18; i++) {
        const x = Math.floor(hash(i, 50, 31) * W);
        const y = 204 + Math.floor(hash(i, 51, 32) * 104);
        px(ctx, x, y, 1, 3, '#354b34');
        px(ctx, x - 1, y - 1, 3, 2, i % 3 ? '#e9b8c6' : '#d9d5a2');
      }

      // 前景暗角。
      const fg = ctx.createLinearGradient(0, 260, 0, H);
      fg.addColorStop(0, 'rgba(7,10,16,0)');
      fg.addColorStop(1, 'rgba(7,10,16,0.55)');
      ctx.fillStyle = fg;
      ctx.fillRect(0, 260, W, H - 260);
    }

    _platform(ctx, cx, cy, rx, ry) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.32)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + 4, rx + 4, ry + 2, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#4a4c5a';
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5b5d6b';
      ctx.beginPath();
      ctx.ellipse(cx, cy - 2, rx - 4, ry - 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#747585';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(cx, cy - 2, rx - 8, ry - 7, 0, 0, Math.PI * 2);
      ctx.stroke();

      for (let i = 0; i < 11; i++) {
        const a = hash(i, 60, 4) * Math.PI * 2;
        const rr = 0.3 + hash(i, 61, 5) * 0.6;
        px(ctx, cx + Math.cos(a) * (rx - 8) * rr, cy - 2 + Math.sin(a) * (ry - 4) * rr, 1, 1, '#828391');
      }
      ctx.restore();
    }
  }

  MyGO.BattleScene = BattleScene;
})(window);
