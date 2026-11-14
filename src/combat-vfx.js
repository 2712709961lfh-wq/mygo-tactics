/* Animated CC0 effects: Cethiel / para. See assets/effects/combat/SOURCES.md. */
(function (global) {
  'use strict';
  const M = global.MyGO = global.MyGO || {};
  const elements = ['fire', 'ice', 'wind', 'thunder', 'dark', 'light', 'arcane'];
  const tracks = {};
  let row = 0, atlas = null, pending = null;
  function track(name, count) { tracks[name] = Object.freeze({row, count}); row += Math.ceil(count / 8); }
  for (const name of ['sword', 'axe', 'lance', 'spark']) track(name, 6);
  for (const element of elements) track('bolt_' + element, 6);
  for (const element of elements) track('hit_' + element, 24);
  track('dust', 16);
  Object.freeze(tracks);

  function load() {
    if (pending) return pending;
    pending = new Promise(resolve => {
      const image = new Image();
      image.onload = () => { atlas = image; resolve(true); };
      image.onerror = () => resolve(false);
      image.src = (global.MYGO_MAP_DATA || {}).combatVfx || 'assets/effects/combat/combat-atlas.png';
    });
    return pending;
  }
  function frameAt(name, progress) {
    const spec = tracks[name];
    if (!spec || !Number.isFinite(progress) || progress < 0 || progress >= 1) return -1;
    return Math.min(spec.count - 1, Math.floor(progress * spec.count));
  }
  function clip(ctx, name, progress, x, y, width, height, rotation = 0, alpha = 1) {
    const frame = frameAt(name, progress);
    if (!atlas || frame < 0) return false;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rotation);
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha *= alpha;
    // Original alpha contains the authored glow; source-over keeps the soft edges
    // and coloured cores readable without washing out faces or bright backgrounds.
    ctx.drawImage(atlas, frame % 8 * 128, (tracks[name].row + Math.floor(frame / 8)) * 128,
      128, 128, -width / 2, -height / 2, width, height);
    ctx.restore();
    return true;
  }
  const elementOf = unit => elements.includes(unit?.weapon?.element) ? unit.weapon.element : 'arcane';
  const colors = {
    fire: ['#fff5bd', '#ff972e', '#e83b17'], ice: ['#f3ffff', '#89e6ff', '#268ddd'],
    wind: ['#ecffdb', '#83eeaf', '#19957a'], thunder: ['#ffffdb', '#ffe671', '#d58c25'],
    dark: ['#f4e2ff', '#c184ff', '#692cc2'], light: ['#ffffff', '#ffe9a0', '#d39e39'],
    arcane: ['#fbecff', '#c5a3ff', '#7946d4']
  };
  function ball(ctx, element, x, y, radius, phase, alpha = 1) {
    const [core, mid, edge] = colors[element];
    ctx.save(); ctx.globalAlpha *= alpha;
    // Broad soft aura, a coloured spherical body and an offset highlight remain
    // readable throughout flight, including the last frame before impact.
    const glow = ctx.createRadialGradient(x, y, radius * .2, x, y, radius * 2.7);
    glow.addColorStop(0, mid); glow.addColorStop(.34, mid + 'bb'); glow.addColorStop(1, mid + '00');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, radius * 2.7, 0, Math.PI * 2); ctx.fill();
    clip(ctx, 'hit_' + element, .24 + phase * .16, x, y, radius * 4.1, radius * 4.1, phase * 1.2, element === 'fire' ? .28 : .75);
    const body = ctx.createRadialGradient(x - radius * .3, y - radius * .35, radius * .05, x, y, radius);
    body.addColorStop(0, '#ffffff'); body.addColorStop(.24, core);
    body.addColorStop(.58, mid); body.addColorStop(1, edge);
    ctx.fillStyle = body; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffffcc'; ctx.beginPath();
    ctx.arc(x - radius * .28, y - radius * .32, radius * .2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function weapon(ctx, kind, t, ax, ay, dx, dy) {
    if (!atlas || !['sword', 'axe', 'lance'].includes(kind)) return false;
    if (kind === 'sword' || kind === 'axe') {
      const p = (t - .50) / (kind === 'axe' ? .20 : .18);
      const size = kind === 'axe' ? 92 : 76;
      // Contact shimmer, rather than a second sword-shaped arc, fits every
      // character's existing horizontal, vertical and spinning weapon motion.
      clip(ctx, kind, p, ax + (dx - ax) * .68, ay - 59, size, size, 0,
        p >= 0 && p < 1 ? Math.sin(Math.PI * p) * .9 : 0);
    } else {
      const p = (t - .49) / .18;
      const tip = ax + 44 + (dx - ax - 42) * Math.min(1, Math.max(0, p * 2));
      if (p >= 0 && p < 1) {
        const y = dy - 59;
        ctx.save(); ctx.globalAlpha *= Math.sin(Math.PI * p) * .9;
        const trail = ctx.createLinearGradient(tip - 245, y, tip + 5, y);
        trail.addColorStop(0, '#81dfff00'); trail.addColorStop(.55, '#81dfff66');
        trail.addColorStop(.88, '#c7f7ffdd'); trail.addColorStop(1, '#ffffff');
        ctx.fillStyle = trail; ctx.fillRect(tip - 245, y - 3, 250, 6);
        ctx.fillRect(tip - 205, y - 1, 210, 2); ctx.restore();
      }
      clip(ctx, 'lance', p, tip - 95, dy - 59, 312, 66, 0, 1);
    }
    return true;
  }
  function magic(ctx, unit, t, ax, ay, dx, dy) {
    if (!atlas) return false;
    const element = elementOf(unit), handX = ax + 34, handY = ay - 66;
    if (t >= .25 && t < .46) {
      const p = (t - .25) / .21;
      ball(ctx, element, handX, handY, 3 + p * 10, p, .40 + p * .55);
    }
    if (t >= .46 && t < .58) {
      const p = (t - .46) / .12;
      const x = handX + (dx - handX) * p, y = handY + (dy - 64 - handY) * p - Math.sin(p * Math.PI) * 6;
      clip(ctx, 'bolt_' + element, .15 + p * .5, x - 44, y, 148, 44, 0, .65);
      for (let i = 3; i >= 1; i--) {
        const q = Math.max(0, p - i * .065);
        const tx = handX + (dx - handX) * q;
        const ty = handY + (dy - 64 - handY) * q - Math.sin(q * Math.PI) * 6;
        ball(ctx, element, tx, ty, 14 - i * 2.4, q, .19 - i * .035);
      }
      ball(ctx, element, x, y, 16 + Math.sin(p * Math.PI) * 1.5, p);
    }
    return true;
  }
  function impact(ctx, unit, result, kind, x, y, age) {
    if (!atlas || !['sword', 'axe', 'lance', 'tome'].includes(kind)) return false;
    if (!result.hit || age < 0) return true;
    const scale = result.crit ? 1.22 : 1;
    if (kind === 'tome') {
      const element = elementOf(unit), p = age / 650;
      const fade = Math.min(1, Math.max(0, (1 - p) * 4));
      const size = (element === 'fire' ? 148 : 132) * scale;
      // Smoke rings have a long empty lead-in in the source; skip it so the
      // visible burst starts on the same impact clock as damage and hit poses.
      const phase = ['wind', 'dark', 'arcane'].includes(element) ? .22 + p * .78 : p;
      clip(ctx, 'hit_' + element, phase, x, y, size, size,
        element === 'wind' ? p * 2.6 : element === 'dark' ? -p * 1.2 : 0, fade);
      if (element === 'thunder') {
        clip(ctx, 'bolt_thunder', age / 240, x, y - 38, 162 * scale, 43 * scale, Math.PI / 2, .95);
        clip(ctx, 'bolt_thunder', (age - 85) / 240, x + 18, y - 24, 120 * scale, 32 * scale, 1.12, .85);
      } else if (element === 'ice') {
        for (let i = 0; i < 3; i++) clip(ctx, 'bolt_ice', (age - i * 24) / 300,
          x + (i - 1) * 18, y - 7, 90 * scale, 23 * scale, -1.0 - i * .5, .85);
      }
    } else {
      const p = age / (kind === 'axe' ? 340 : 260);
      if (kind === 'lance') clip(ctx, 'spark', p, x, y, 100 * scale, 54 * scale, Math.PI / 4, 1);
      else {
        const size = (kind === 'axe' ? 108 : 88) * scale;
        clip(ctx, kind, p, x, y, size, size, 0, 1);
        clip(ctx, kind, p, x, y, size, size, Math.PI / 4, .45);
      }
      if (kind === 'axe') clip(ctx, 'dust', age / 520, x, y + 51, 155 * scale, 56 * scale, 0, .52);
      if (result.crit) clip(ctx, kind === 'lance' ? 'spark' : kind, (age - 55) / 320, x + 4, y, 124, 124, 0, .65);
    }
    return true;
  }
  M.CombatVfx = {load, weapon, magic, impact, frameAt, tracks, elementOf, get ready() { return !!atlas; }};
})(window);
