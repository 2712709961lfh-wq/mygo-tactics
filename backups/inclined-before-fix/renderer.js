/* ============================================================
 * renderer.js — Canvas 俯视地图渲染
 *
 * 负责：地形、网格、移动/攻击高亮、单位、头顶血条、
 *       路径预览、伤害数字与暴击粒子。
 * 不处理点击逻辑与游戏规则。
 * ============================================================ */
(function (global) {
  'use strict';
  const MyGO = (global.MyGO = global.MyGO || {});
  const C = MyGO.CONFIG;
  const TILE = C.TILE;
  const SPRITE_HEIGHT = C.SPRITE_SIZE || 60;
  const SPRITE_WIDTH = Math.round(SPRITE_HEIGHT * (80 / 96));

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  class Renderer {
    constructor(canvas, game) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      // 逻辑坐标固定为地图列数×行数×格子边长；back-buffer 放大 2× 后再交给 CSS 缩放，
      // 这样 1px 像素线在屏幕上不会因为非整数缩放而糊成灰色。
      this.scale = C.RENDER_SCALE || 1;
      this.projection = MyGO.MapProjection.create(game.stage,game.map.cols,game.map.rows);
      this.logicalWidth = this.projection.width;
      this.logicalHeight = this.projection.height;
      this.canvas.width = this.logicalWidth * this.scale;
      this.canvas.height = this.logicalHeight * this.scale;
      this.ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
      this.ctx.imageSmoothingEnabled = false;
      this.game = game;
      this.time = 0;
      this.visuals = new Map();
      this.effects = [];
      this.flashes = new Map();
      this.shakeUntil = 0;
      this.shakePower = 0;
      this.terrainLayer = null;
      this.ambient = this._makeAmbient();
      this.view = {
        mode: 'idle',
        selectedId: null,
        hoverKey: null,
        moveTiles: new Set(),
        attackTiles: new Set(),
        targetIds: new Set(),
        path: [],
        actionableIds: new Set()
      };
      this.resetVisuals();
      this._loop = this._loop.bind(this);
      this._raf = requestAnimationFrame(this._loop);
    }

    /**
     * 生成固定的环境粒子。位置来自简单哈希，刷新后仍然稳定，
     * 不会每帧随机跳动。
     */
    _makeAmbient() {
      let seed = 0x9e3779b9;
      const rnd = () => {
        seed ^= seed << 13;
        seed ^= seed >>> 17;
        seed ^= seed << 5;
        return ((seed >>> 0) % 10000) / 10000;
      };
      const motes = [];
      for (let i = 0; i < 42; i++) {
        motes.push({
          x: rnd() * this.logicalWidth,
          y: rnd() * this.logicalHeight,
          phase: rnd() * Math.PI * 2,
          drift: 2 + rnd() * 5,
          size: rnd() > 0.82 ? 2 : 1,
          warm: rnd() > 0.45
        });
      }
      return { motes };
    }

    /**
     * 预渲染地形层：地形素材、地块接缝、墙体投影和静态光照只算一次。
     * 战斗过程中每帧只需一次 drawImage，给粒子和单位动画留出预算。
     */
    _buildTerrainLayer() {
      const layer = document.createElement('canvas');
      // 缓存层也必须使用超采样背板，否则地形会被重新拉成 32px 的糊图。
      layer.width = this.logicalWidth * this.scale;
      layer.height = this.logicalHeight * this.scale;
      const lc = layer.getContext('2d');
      lc.imageSmoothingEnabled = false;
      // 用逻辑坐标排版，绘制结果落到 2× 背板上。
      lc.setTransform(this.scale, 0, 0, this.scale, 0, 0);
      const map = this.game.map;
      if (this.game.stage === 2 && MyGO.MoonMap) {
        const bg=lc.createLinearGradient(0,0,0,this.logicalHeight);
        bg.addColorStop(0,'#172b40');bg.addColorStop(1,'#304055');
        lc.fillStyle=bg;lc.fillRect(0,0,this.logicalWidth,this.logicalHeight);
        lc.save();MyGO.MapProjection.apply(lc,this.projection);
        MyGO.MoonMap.drawGround(lc,map);lc.restore();
        this._depthScene=null;
        this.terrainLayer = layer;
        return;
      }
      if (this.game.stage === 1 && MyGO.GardenMap) {
        lc.fillStyle='#111c22';lc.fillRect(0,0,this.logicalWidth,this.logicalHeight);
        lc.save();MyGO.MapProjection.apply(lc,this.projection);
        MyGO.GardenMap.drawGround(lc, map);
        lc.restore();
        this._depthScene=null;
        this.terrainLayer = layer;
        return;
      }

      for (let y = 0; y < map.rows; y++) {
        for (let x = 0; x < map.cols; x++) {
          MyGO.Assets.drawTerrain(lc, map.tiles[y][x], x * TILE, y * TILE, TILE, {
            gx: x,
            gy: y
          });
        }
      }

      // 不同地形的接缝：一条极细的暗线，避免整张地图像平铺壁纸。
      for (let y = 0; y < map.rows; y++) {
        for (let x = 0; x < map.cols; x++) {
          const here = map.tiles[y][x];
          const right = x + 1 < map.cols ? map.tiles[y][x + 1] : null;
          const down = y + 1 < map.rows ? map.tiles[y + 1][x] : null;
          if (right && right !== here) {
            lc.fillStyle = 'rgba(5, 7, 14, 0.28)';
            lc.fillRect(x * TILE + TILE - 1, y * TILE, 1, TILE);
          }
          if (down && down !== here) {
            lc.fillStyle = 'rgba(5, 7, 14, 0.30)';
            lc.fillRect(x * TILE, y * TILE + TILE - 1, TILE, 1);
            // 高地形把阴影投到下方低地形，制造微弱的立体层级。
            if (here === 'wall' || here === 'mountain') {
              lc.fillStyle = 'rgba(4, 6, 12, 0.16)';
              lc.fillRect(x * TILE, y * TILE + TILE, TILE, 3);
            }
          }
        }
      }

      // 建筑屋顶作为地形缓存的一部分绘制；下方仍是不可通行墙体，
      // 因此单位不会走到屋顶上，也不会出现角色被屋檐遮住的问题。
      const decor = (this.game.map.decor || []).slice();
      decor.forEach(function (d) {
        MyGO.Assets.drawDecor(
          lc, d.id,
          d.x * TILE, d.y * TILE,
          d.w * TILE, d.h * TILE
        );
      });

      // 固定方向的暖光 + 底部冷色，统一整张地图的色温。
      const warm = lc.createLinearGradient(0, 0, this.logicalWidth * 0.7, this.logicalHeight);
      warm.addColorStop(0, 'rgba(255, 220, 150, 0.10)');
      warm.addColorStop(0.45, 'rgba(255, 220, 150, 0.025)');
      warm.addColorStop(1, 'rgba(18, 29, 54, 0.10)');
      lc.fillStyle = warm;
      lc.fillRect(0, 0, this.logicalWidth, this.logicalHeight);

      const cool = lc.createLinearGradient(0, this.logicalHeight * 0.45, 0, this.logicalHeight);
      cool.addColorStop(0, 'rgba(26, 42, 72, 0)');
      cool.addColorStop(1, 'rgba(20, 28, 50, 0.16)');
      lc.fillStyle = cool;
      lc.fillRect(0, 0, this.logicalWidth, this.logicalHeight);

      this.terrainLayer = layer;
    }

    setGame(game) {
      this.game = game;
      this.projection = MyGO.MapProjection.create(game.stage,game.map.cols,game.map.rows);
      this.logicalWidth = this.projection.width;
      this.logicalHeight = this.projection.height;
      this.canvas.width = this.logicalWidth * this.scale;
      this.canvas.height = this.logicalHeight * this.scale;
      this.ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
      this.ctx.imageSmoothingEnabled = false;
      this.ambient = this._makeAmbient();
      this.effects = [];
      this.flashes.clear();
      this.terrainLayer = null;
      this._depthScene = null;
      this.resetVisuals();
    }

    /** Optional camera used by the art comparison page; gameplay uses chapter defaults. */
    setMapProjection(projection) {
      this.projection=projection;
      this.logicalWidth=projection.width;this.logicalHeight=projection.height;
      this.canvas.width=this.logicalWidth*this.scale;this.canvas.height=this.logicalHeight*this.scale;
      this.ctx.setTransform(this.scale,0,0,this.scale,0,0);
      this.terrainLayer=null;this._depthScene=null;this.ambient=this._makeAmbient();
    }

    resetVisuals() {
      this.visuals.clear();
      for (const unit of this.game.units) {
        this.visuals.set(unit.id, {
          px: unit.x * TILE,
          py: unit.y * TILE,
          moving: false
        });
      }
    }

    snapUnit(unit) {
      this.visuals.set(unit.id, {
        px: unit.x * TILE,
        py: unit.y * TILE,
        moving: false
      });
    }

    setView(view) {
      this.view = {
        mode: view.mode || 'idle',
        selectedId: view.selectedId || null,
        hoverKey: view.hoverKey || null,
        moveTiles: view.moveTiles || new Set(),
        attackTiles: view.attackTiles || new Set(),
        targetIds: view.targetIds || new Set(),
        path: view.path || [],
        actionableIds: view.actionableIds || new Set()
      };
    }

    /**
     * 沿路径播放移动动画。
     * 逻辑坐标由调用方在动画结束后写入 Game，渲染层只维护视觉位置。
     */
    animateMove(unitId, path, msPerTile) {
      const speed = msPerTile || 62;
      const visual = this.visuals.get(unitId);
      if (!visual || !path || path.length <= 1) {
        return Promise.resolve();
      }
      const points = path.map((p) => ({ x: p.x * TILE, y: p.y * TILE }));
      points[0] = { x: visual.px, y: visual.py };
      const total = Math.max(1, path.length - 1);
      const duration = Math.max(80, total * speed);
      const start = performance.now();
      visual.moving = true;
      const movingUnit = this.game.getUnit(unitId);
      if (movingUnit) {
        movingUnit._walking = true;
        movingUnit._walkUntil = start + duration + 80;
        movingUnit._spritePhase = movingUnit._spritePhase || 0;
      }

      return new Promise((resolve) => {
        const step = (now) => {
          const t = clamp((now - start) / duration, 0, 1);
          const pos = t * total;
          const idx = Math.min(total - 1, Math.floor(pos));
          const local = pos - idx;
          const a = points[idx];
          const b = points[idx + 1] || points[idx];
          const v = this.visuals.get(unitId);
          if (movingUnit) {
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            if (Math.abs(dx) > Math.abs(dy)) movingUnit.facing = dx >= 0 ? 'right' : 'left';
            else if (Math.abs(dy) > 0.1) movingUnit.facing = dy >= 0 ? 'down' : 'up';
          }
          if (v) {
            v.px = a.x + (b.x - a.x) * local;
            v.py = a.y + (b.y - a.y) * local;
            v.moving = true;
          }
          if (t >= 1) {
            const last = points[points.length - 1];
            if (v) {
              v.px = last.x;
              v.py = last.y;
              v.moving = false;
            }
            if (movingUnit) {
              movingUnit._walking = false;
              movingUnit._walkUntil = 0;
            }
            resolve();
            return;
          }
          requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    }

    /** 闪烁格子/单位。 */
    flash(unitId, color, ms) {
      const duration = ms || 320;
      this.flashes.set(unitId, {
        start: performance.now(),
        until: performance.now() + duration,
        duration,
        color: color || 'rgba(255,70,100,0.65)'
      });
    }

    shake(ms, power) {
      this.shakeUntil = performance.now() + (ms || 260);
      this.shakePower = power || 2;
    }

    floatText(text, gx, gy, color, size) {
      this.effects.push({
        type: 'text',
        text,
        x: gx * TILE + TILE / 2,
        y: gy * TILE + 4,
        color: color || '#ffffff',
        size: size || 9,
        start: performance.now(),
        life: 1000
      });
    }

    critBurst(gx, gy) {
      const cx = gx * TILE + TILE / 2;
      const cy = gy * TILE + TILE / 2;
      for (let i = 0; i < 14; i++) {
        const angle = (Math.PI * 2 * i) / 14 + Math.random() * 0.4;
        const speed = 0.5 + Math.random() * 1.1;
        this.effects.push({
          type: 'spark',
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: i % 2 ? '#ffd166' : '#fff4c2',
          start: performance.now(),
          life: 520 + Math.random() * 220
        });
      }
    }

    _loop(now) {
      this.time = now;
      this.render(now);
      this._raf = requestAnimationFrame(this._loop);
    }

    _drawRange(set, fill, border) {
      const ctx = this.ctx;
      if (!set || set.size === 0) return;
      const pulse = 0.88 + Math.sin(this.time / 420) * 0.12;

      ctx.save();
      ctx.globalAlpha = pulse;
      for (const key of set) {
        const [x, y] = key.split(',').map(Number);
        ctx.fillStyle = fill;
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
        // 顶部一道很淡的高光，让色块像发光玻璃而不是油漆。
        const sheen = ctx.createLinearGradient(0, y * TILE, 0, y * TILE + TILE);
        sheen.addColorStop(0, 'rgba(255,255,255,0.055)');
        sheen.addColorStop(0.45, 'rgba(255,255,255,0)');
        ctx.fillStyle = sheen;
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      }

      // 只描外轮廓，范围内部不会被网格线切碎。
      ctx.strokeStyle = border;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (const key of set) {
        const [x, y] = key.split(',').map(Number);
        const px = x * TILE;
        const py = y * TILE;
        if (!set.has((x - 1) + ',' + y)) {
          ctx.moveTo(px + 0.75, py);
          ctx.lineTo(px + 0.75, py + TILE);
        }
        if (!set.has((x + 1) + ',' + y)) {
          ctx.moveTo(px + TILE - 0.75, py);
          ctx.lineTo(px + TILE - 0.75, py + TILE);
        }
        if (!set.has(x + ',' + (y - 1))) {
          ctx.moveTo(px, py + 0.75);
          ctx.lineTo(px + TILE, py + 0.75);
        }
        if (!set.has(x + ',' + (y + 1))) {
          ctx.moveTo(px, py + TILE - 0.75);
          ctx.lineTo(px + TILE, py + TILE - 0.75);
        }
      }
      ctx.stroke();
      ctx.restore();
    }

    /** 以像素坐标绘制选中四角，供移动中的单位与准星复用。 */
    _drawCornersPx(baseX, baseY, color, inset, length) {
      const ctx = this.ctx;
      const i = inset == null ? 2 : inset;
      const l = length || 7;
      const px = baseX + i;
      const py = baseY + i;
      const w = TILE - i * 2;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      // 左上
      ctx.moveTo(px, py + l);
      ctx.lineTo(px, py);
      ctx.lineTo(px + l, py);
      // 右上
      ctx.moveTo(px + w - l, py);
      ctx.lineTo(px + w, py);
      ctx.lineTo(px + w, py + l);
      // 右下
      ctx.moveTo(px + w, py + w - l);
      ctx.lineTo(px + w, py + w);
      ctx.lineTo(px + w - l, py + w);
      // 左下
      ctx.moveTo(px + l, py + w);
      ctx.lineTo(px, py + w);
      ctx.lineTo(px, py + w - l);
      ctx.stroke();
    }

    _drawGrid() {
      if (this.showGrid === false) return;
      const ctx = this.ctx;
      ctx.strokeStyle = this.game.stage === 1 ? 'rgba(24, 39, 37, 0.16)' : 'rgba(54, 66, 100, 0.17)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= this.game.map.cols; x++) {
        ctx.moveTo(x * TILE + 0.5, 0);
        ctx.lineTo(x * TILE + 0.5, this.game.map.rows * TILE);
      }
      for (let y = 0; y <= this.game.map.rows; y++) {
        ctx.moveTo(0, y * TILE + 0.5);
        ctx.lineTo(this.game.map.cols * TILE, y * TILE + 0.5);
      }
      ctx.stroke();
    }

    /** 以格子坐标绘制四角。 */
    _drawCorners(x, y, color, inset, length) {
      this._drawCornersPx(x * TILE, y * TILE, color, inset, length);
    }

    _drawPath() {
      const path = this.view.path;
      if (!path || path.length < 2) return;
      const ctx = this.ctx;
      ctx.save();
      // 先画一层深色底线，亮线在草地/石地上都不会消失。
      ctx.strokeStyle = 'rgba(20, 14, 8, 0.55)';
      ctx.lineWidth = 4;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let i = 0; i < path.length; i++) {
        const cx = path[i].x * TILE + TILE / 2;
        const cy = path[i].y * TILE + TILE / 2;
        if (i === 0) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
      }
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255, 220, 130, 0.95)';
      ctx.shadowColor = 'rgba(255, 205, 100, 0.5)';
      ctx.shadowBlur = 4;
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      for (let i = 0; i < path.length; i++) {
        const cx = path[i].x * TILE + TILE / 2;
        const cy = path[i].y * TILE + TILE / 2;
        if (i === 0) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;

      // 每格节点放一个亮点，表现“逐格行走”而不是一条直线。
      for (let i = 1; i < path.length - 1; i++) {
        const cx = path[i].x * TILE + TILE / 2;
        const cy = path[i].y * TILE + TILE / 2;
        ctx.fillStyle = 'rgba(255, 241, 190, 0.88)';
        ctx.fillRect(cx - 1, cy - 1, 2, 2);
      }

      const last = path[path.length - 1];
      const cx = last.x * TILE + TILE / 2;
      const cy = last.y * TILE + TILE / 2;
      ctx.fillStyle = 'rgba(255, 230, 160, 0.96)';
      ctx.beginPath();
      ctx.moveTo(cx, cy - 5);
      ctx.lineTo(cx + 5, cy + 3);
      ctx.lineTo(cx, cy + 1);
      ctx.lineTo(cx - 5, cy + 3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    _drawTerrain() {
      if (!this.terrainLayer) this._buildTerrainLayer();
      // 缓存是 2× 像素尺寸，这里按逻辑尺寸回贴，在 2× 变换下恰好 1:1。
      this.ctx.drawImage(this.terrainLayer, 0, 0, this.logicalWidth, this.logicalHeight);

      if (this.game.stage === 1 && MyGO.GardenMap) {
        MyGO.GardenMap.drawGate(this.ctx, this.game.map, this.game.gateOpen);
        return;
      }

      // 大门状态会在战斗中变化，不能烘进静态地形缓存。
      if (this.game && this.game.map) {
        let gx0 = Infinity, gy0 = Infinity, gx1 = -1, gy1 = -1, hasGate = false;
        for (let y = 0; y < this.game.map.rows; y++) {
          for (let x = 0; x < this.game.map.cols; x++) {
            const type = this.game.map.tiles[y][x];
            if (type === 'gate' || type === 'gateOpen') {
              hasGate = true;
              gx0 = Math.min(gx0, x);
              gy0 = Math.min(gy0, y);
              gx1 = Math.max(gx1, x);
              gy1 = Math.max(gy1, y);
            }
          }
        }
        if (hasGate) {
          const open = this.game.gateOpen || this.game.map.tiles[gy1][gx0] === 'gateOpen';
          this.ctx.save();
          this.ctx.imageSmoothingEnabled = false;
          if (MyGO.Assets.gateSpriteReady(open)) {
            const fw = Math.round(TILE * 3.8);
            const fh = Math.round(TILE * 3.4);
            const cx = ((gx0 + gx1 + 1) / 2) * TILE;
            MyGO.Assets.drawGateSprite(
              this.ctx, open,
              Math.round(cx - fw / 2 - TILE * 0.6),
              (gy1 + 1) * TILE - fh + 2,
              fw, fh
            );
          } else {
            // 素材缺失时回退到程序化门格。
            for (let y = gy0; y <= gy1; y++) {
              for (let x = gx0; x <= gx1; x++) {
                MyGO.Assets.drawGateTile(this.ctx, x * TILE, y * TILE, open);
              }
            }
          }
          this.ctx.restore();
        }
      }
    }

    _unitVisual(unit) {
      let v = this.visuals.get(unit.id);
      if (!v) {
        v = { px: unit.x * TILE, py: unit.y * TILE, moving: false };
        this.visuals.set(unit.id, v);
      }
      return v;
    }

    /**
     * 环境层：缓慢移动的树影、暖色光斑和萤火尘。
     * 全部是低透明度装饰，不参与任何命中/地形判定。
     */
    _drawAmbient(now) {
      const ctx = this.ctx;
      ctx.save();

      // 只保留轻量尘埃。整屏的云影/阳光径向渐变已烘焙进地形缓存，
      // 否则 24×16 的 2× 画布每帧重绘两张全屏渐变会拖慢低配设备。
      for (const m of this.ambient.motes) {
        const driftX = Math.sin(now / 3400 + m.phase) * m.drift;
        const driftY = Math.cos(now / 4700 + m.phase * 1.7) * m.drift * 0.55;
        const x = Math.round(m.x + driftX);
        const y = Math.round(m.y + driftY);
        const twinkle = 0.5 + Math.sin(now / 900 + m.phase * 2) * 0.5;
        ctx.globalAlpha = 0.10 + twinkle * 0.22;
        ctx.fillStyle = m.warm ? '#ffe6a8' : '#9fe9e0';
        ctx.fillRect(x, y, m.size, m.size);
        if (m.size === 2 && twinkle > 0.82) {
          ctx.globalAlpha *= 0.5;
          ctx.fillRect(x - 1, y, 1, 1);
          ctx.fillRect(x + 2, y, 1, 1);
          ctx.fillRect(x, y - 1, 1, 1);
          ctx.fillRect(x, y + 2, 1, 1);
        }
      }
      ctx.restore();
    }

    _drawBossAura(unit, v, now) {
      if (!unit.boss) return;
      const ctx = this.ctx;
      const cx = v.px + TILE / 2;
      const cy = v.py + TILE / 2;
      const pulse = 0.65 + Math.sin(now / 620) * 0.2;
      ctx.save();
      const aura = ctx.createRadialGradient(cx, cy, 4, cx, cy, 25);
      aura.addColorStop(0, 'rgba(255, 67, 132, 0.18)');
      aura.addColorStop(0.55, 'rgba(151, 82, 255, 0.10)');
      aura.addColorStop(1, 'rgba(151, 82, 255, 0)');
      ctx.fillStyle = aura;
      ctx.fillRect(v.px - 10, v.py - 10, TILE + 20, TILE + 20);

      ctx.globalAlpha = pulse * 0.8;
      ctx.strokeStyle = 'rgba(255, 92, 150, 0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(cx, v.py + 27, 12, 4, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    _drawFactionRing(unit, v, acted) {
      const ctx = this.ctx;
      const color = unit.side === 'player'
        ? 'rgba(96, 210, 255, 0.55)'
        : unit.boss ? 'rgba(255, 104, 160, 0.72)' : 'rgba(255, 96, 132, 0.48)';
      ctx.save();
      ctx.globalAlpha = acted ? 0.25 : 0.9;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(v.px + TILE / 2, v.py + 27, 10, 3.5, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    _drawUnits(now) {
      const ctx = this.ctx;
      const units = this.game.units
        .filter((u) => !u.dead)
        .map((u) => ({ u, v: this._unitVisual(u) }))
        .sort((a, b) => a.v.py - b.v.py || a.v.px - b.v.px);

      for (const { u, v } of units) {
        const selected = this.view.selectedId === u.id;
        const acted = u.acted && u.side === 'player';
        const isTarget = this.view.targetIds.has(u.id);
        const bob = v.moving || acted ? 0 : Math.sin(now / 460 + u.x * 1.7) > 0.72 ? -1 : 0;

        // 首领光环与脚下阵营环，先于角色绘制。
        this._drawBossAura(u, v, now);
        this._drawFactionRing(u, v, acted);

        if (selected) {
          const pulse = 0.68 + Math.sin(now / 180) * 0.22;
          ctx.save();
          ctx.globalAlpha = pulse;
          ctx.fillStyle = 'rgba(255, 224, 138, 0.20)';
          ctx.fillRect(v.px + 1, v.py + 1, TILE - 2, TILE - 2);
          // 选中格使用柔和的内发光 + 四角，移动中也跟随视觉坐标。
          const glow = ctx.createRadialGradient(v.px + TILE / 2, v.py + TILE / 2, 2, v.px + TILE / 2, v.py + TILE / 2, 22);
          glow.addColorStop(0, 'rgba(255, 235, 170, 0.20)');
          glow.addColorStop(1, 'rgba(255, 235, 170, 0)');
          ctx.fillStyle = glow;
          ctx.fillRect(v.px, v.py, TILE, TILE);
          this._drawCornersPx(v.px, v.py, '#ffe08a', 0, 9);
          ctx.restore();
        }

        ctx.save();
        if (acted) ctx.globalAlpha = 0.52;
        const spriteX = Math.round(v.px + TILE / 2);
        const spriteY = Math.round(v.py + TILE);
        const custom = MyGO.Characters && MyGO.Characters.has(u.id)
          ? MyGO.Characters.drawMap(ctx, u, spriteX, spriteY, SPRITE_HEIGHT, now, { moving: v.moving })
          : false;
        if (!custom) {
          MyGO.Assets.drawUnit(ctx, u, Math.round(spriteX - 24), Math.round(spriteY - 48), 48, {
            bob,
            static: false,
            chibi: true
          });
        }
        ctx.restore();

        if (acted) {
          ctx.fillStyle = 'rgba(15, 18, 32, 0.45)';
          ctx.fillRect(v.px + 2, v.py + 2, TILE - 4, TILE - 4);
          ctx.fillStyle = 'rgba(200, 210, 230, 0.8)';
          ctx.fillRect(v.px + 24, v.py + 3, 3, 1);
          ctx.fillRect(v.px + 25, v.py + 4, 1, 2);
        }

        if (isTarget) {
          const pulse = 1 + Math.sin(now / 150) * 0.12;
          ctx.save();
          ctx.translate(v.px + TILE / 2, v.py + TILE / 2);
          ctx.scale(pulse, pulse);
          ctx.translate(-TILE / 2, -TILE / 2);
          const halo = ctx.createRadialGradient(TILE / 2, TILE / 2, 5, TILE / 2, TILE / 2, 20);
          halo.addColorStop(0, 'rgba(255, 70, 110, 0)');
          halo.addColorStop(0.7, 'rgba(255, 70, 110, 0.10)');
          halo.addColorStop(1, 'rgba(255, 70, 110, 0)');
          ctx.fillStyle = halo;
          ctx.fillRect(-4, -4, TILE + 8, TILE + 8);
          this._drawCornersPx(0, 0, '#ff5c8a', -2, 8);
          ctx.restore();
        }
      }

      // 头顶血条放在最后绘制，避免被相邻单位精灵遮挡。
      for (const { u, v } of units) {
        this._drawHpBar(u, v);
        if (u.key && !u.dead) this._drawKeyMarker(u, v);
      }
    }

    _drawKeyMarker(unit, v) {
      const ctx = this.ctx;
      const x = Math.round(v.px) + TILE / 2 + 14;
      const y = Math.max(3, Math.round(v.py) + TILE - SPRITE_HEIGHT - 4);
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = 'rgba(8, 10, 18, 0.82)';
      ctx.fillRect(x - 4, y - 3, 9, 12);
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(x - 2, y - 1, 5, 3);
      ctx.fillRect(x - 1, y + 1, 2, 4);
      ctx.fillRect(x, y + 4, 3, 1);
      ctx.fillRect(x + 2, y + 3, 1, 2);
      ctx.fillStyle = '#fff1b8';
      ctx.fillRect(x - 1, y, 2, 1);
      ctx.restore();
    }

    _drawHpBar(unit, v) {
      const ctx = this.ctx;
      // 血条悬在 60px 素材小人头顶上方，宽度略大于一格。
      const w = SPRITE_WIDTH - 10;
      const x = Math.round(v.px) + TILE / 2 - w / 2;
      const y = Math.max(2, Math.round(v.py) + TILE - SPRITE_HEIGHT - 7);
      const h = 5;
      const ratio = clamp(unit.hp / unit.maxHp, 0, 1);
      const color = ratio > 0.6 ? '#68d98a' : ratio > 0.3 ? '#ffd166' : '#ff5b6e';
      const glow = ratio > 0.3 ? 'rgba(104, 217, 138, 0.35)' : 'rgba(255, 91, 110, 0.4)';

      ctx.save();
      // 外框 + 顶部高光 + 底部暗边，比单条色块更有“仪表”感。
      ctx.fillStyle = 'rgba(5, 7, 14, 0.96)';
      ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.10)';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.fillRect(x, y, w, 1);
      const fillW = Math.round(w * ratio);
      if (fillW > 0) {
        ctx.shadowColor = glow;
        ctx.shadowBlur = 3;
        ctx.fillStyle = color;
        ctx.fillRect(x, y + 1, fillW, h - 2);
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.38)';
        ctx.fillRect(x, y + 1, fillW, 1);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
        ctx.fillRect(x, y + h - 2, fillW, 1);
      }
      // 三段刻度，便于快速估算血量。
      ctx.fillStyle = 'rgba(7, 10, 20, 0.55)';
      ctx.fillRect(x + Math.round(w / 3), y + 1, 1, h - 2);
      ctx.fillRect(x + Math.round((w * 2) / 3), y + 1, 1, h - 2);
      if (unit.boss) {
        ctx.fillStyle = '#ffd166';
        ctx.fillRect(x - 3, y + 1, 2, 3);
        ctx.fillRect(x - 1, y + 2, 1, 1);
      }
      ctx.restore();
    }

    _drawHover() {
      if (!this.view.hoverKey) return;
      const [x, y] = this.view.hoverKey.split(',').map(Number);
      if (x < 0 || y < 0 || x >= this.game.map.cols || y >= this.game.map.rows) return;
      this.ctx.strokeStyle = 'rgba(235, 244, 255, 0.74)';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(x * TILE + 1, y * TILE + 1, TILE - 2, TILE - 2);
    }

    _drawFlashes(now) {
      const ctx = this.ctx;
      for (const [id, flash] of this.flashes) {
        if (now > flash.until) {
          this.flashes.delete(id);
          continue;
        }
        const unit = this.game.getUnit(id);
        if (!unit) continue;
        const v = this._unitVisual(unit);
        const a = 1 - (now - flash.start) / flash.duration;
        ctx.globalAlpha = clamp(a, 0, 0.7);
        ctx.fillStyle = flash.color;
        ctx.fillRect(v.px, v.py, TILE, TILE);
        ctx.globalAlpha = 1;
      }
    }

    _drawEffects(now) {
      const ctx = this.ctx;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = this.effects.length - 1; i >= 0; i--) {
        const e = this.effects[i];
        const age = now - e.start;
        if (age > e.life) {
          this.effects.splice(i, 1);
          continue;
        }
        const t = age / e.life;
        if (e.type === 'text') {
          const y = e.y - t * 20;
          const alpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
          ctx.globalAlpha = alpha;
          ctx.font = 'bold ' + e.size + 'px "Courier New", monospace';
          ctx.lineWidth = 3;
          ctx.strokeStyle = 'rgba(10, 8, 18, 0.95)';
          ctx.strokeText(e.text, e.x, y);
          ctx.fillStyle = e.color;
          ctx.fillText(e.text, e.x, y);
        } else if (e.type === 'spark') {
          const x = e.x + e.vx * age * 0.06;
          const y = e.y + e.vy * age * 0.06 + t * t * 8;
          ctx.globalAlpha = 1 - t;
          ctx.fillStyle = e.color;
          ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
        }
      }
      ctx.restore();
    }

    /** Upright pieces and scenery share foot depth above an undistorted square board. */
    _renderDepth(now) {
      const ctx=this.ctx,P=MyGO.MapProjection,v=this.projection;
      const first=this.game.stage===1,art=first?MyGO.GardenMap:MyGO.MoonMap;
      this.time=now;
      ctx.clearRect(0,0,this.logicalWidth,this.logicalHeight);
      if(!this.terrainLayer)this._buildTerrainLayer();
      ctx.save();
      if(now<this.shakeUntil)ctx.translate(Math.sin(now*.2)*this.shakePower,Math.cos(now*.3)*this.shakePower);
      ctx.imageSmoothingEnabled=true;
      ctx.drawImage(this.terrainLayer,0,0,this.logicalWidth,this.logicalHeight);
      ctx.save();P.apply(ctx,v);
      if(this.view.mode==='move')this._drawRange(this.view.moveTiles,'rgba(59,170,255,.24)','rgba(133,219,255,.68)');
      if(this.view.mode==='attack')this._drawRange(this.view.attackTiles,'rgba(255,69,105,.24)','rgba(255,130,157,.65)');
      this._drawGrid();this._drawPath();this._drawHover();this._drawFlashes(now);
      ctx.restore();
      if(!this._depthScene||this._depthGate!==this.game.gateOpen){
        this._depthScene=art.makeObjects(this.game.map,v);this._depthGate=this.game.gateOpen;
      }
      const units=this.game.living().map(u=>{
        const visual=this._unitVisual(u),p=P.project(v,visual.px+TILE/2,visual.py+TILE*(first?1:.84));
        return {u,visual,p,depth:p.y};
      });
      // Both trees and walls become translucent when a piece stands immediately behind them.
      const layers=this._depthScene.concat(units).sort((a,b)=>a.depth-b.depth);
      for(const item of layers){
        if(item.u){this._drawDepthUnit(item,now);continue;}
        ctx.save();
        if(item.kind==='bell')item.awakened=this.game.awakenedBells.includes(item.bellId);
        if(item.kind==='house'&&units.some(q=>q.u.x>=item.x&&q.u.x<item.x+item.w&&q.u.y<item.y&&item.y-q.u.y<=2))ctx.globalAlpha=.5;
        if(art.obscures?units.some(q=>art.obscures(item,q.u))
          : ['tree','wall','tower'].includes(item.kind)&&units.some(q=>Math.abs(q.u.x-item.x)<=.7&&q.u.y<item.y&&item.y-q.u.y<=1))ctx.globalAlpha=.46;
        art.drawObject(ctx,v,item);ctx.restore();
      }
      // Status bars stay visible even behind a flowering canopy.
      for(const {u,p,visual} of units){
        if(first){
          const projected={px:p.x-TILE/2,py:p.y-TILE};
          this._drawHpBar(u,projected);if(u.key)this._drawKeyMarker(u,projected);continue;
        }
        const ratio=clamp(u.hp/u.maxHp,0,1),w=25;
        ctx.fillStyle='#122032';ctx.fillRect(p.x-w/2-1,p.y-48,w+2,4);
        ctx.fillStyle=ratio>.6?'#8be4b5':ratio>.3?'#e5d18a':'#fa8798';ctx.fillRect(p.x-w/2,p.y-47,w*ratio,2);
        if(u.boss){ctx.fillStyle='#ebcf8c';ctx.fillRect(p.x-w/2-4,p.y-48,2,4);}
        if(u.key){ctx.fillStyle='#ffe3a0';ctx.font='bold 10px serif';ctx.fillText('⚿',p.x+16,p.y-41);}
      }
      // Numbered objective tags remain readable when a unit stands on a bell.
      ctx.save();ctx.textAlign='center';ctx.font='bold 9px sans-serif';
      for(const bell of this.game.mission.bells||[]){
        const p=P.project(v,(bell.x+.5)*TILE,(bell.y+1)*TILE+7),active=this.game.awakenedBells.includes(bell.id);
        ctx.fillStyle='rgba(24,30,53,.92)';ctx.fillRect(p.x-19,p.y-7,38,12);
        ctx.fillStyle=active?'#9affe0':'#f3d7ff';ctx.fillText((active?'✓ ':'')+(this.game.mission.bells.indexOf(bell)+1)+' 星铃',p.x,p.y+2);
      }ctx.restore();
      this._drawAmbient(now);
      // Floating damage text uses the same world projection, but remains upright.
      ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';
      for(let i=this.effects.length-1;i>=0;i--){
        const e=this.effects[i],age=now-e.start;if(age>e.life){this.effects.splice(i,1);continue;}
        const p=P.project(v,e.x,e.y),t=age/e.life;ctx.globalAlpha=1-t;
        if(e.type==='text'){
          ctx.font='bold '+e.size+'px sans-serif';ctx.lineWidth=2.5;ctx.strokeStyle='#102031';
          ctx.strokeText(e.text,p.x,p.y-t*20);ctx.fillStyle=e.color;ctx.fillText(e.text,p.x,p.y-t*20);
        }else{ctx.fillStyle=e.color;ctx.fillRect(p.x+e.vx*age*.06,p.y+e.vy*age*.06,2,2);}
      }ctx.restore();ctx.restore();
    }

    _drawDepthUnit(item,now){
      const {u,visual,p}=item,ctx=this.ctx,selected=this.view.selectedId===u.id;
      const first=this.game.stage===1,height=first?SPRITE_HEIGHT:44,fallback=first?48:36;
      ctx.save();
      if(first)this._drawBossAura(u,{px:p.x-TILE/2,py:p.y-TILE},now);
      ctx.fillStyle='rgba(10,24,36,.4)';ctx.beginPath();ctx.ellipse(p.x+3,p.y+1,12,4,.1,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle=selected?'#ffe2a1':u.side==='player'?'#8ddfff':'#f98fab';ctx.lineWidth=selected?1.8:1;
      ctx.beginPath();ctx.ellipse(p.x,p.y,11,4,.1,0,Math.PI*2);ctx.stroke();
      if(this.view.targetIds.has(u.id)){ctx.strokeStyle='#ff719d';ctx.strokeRect(p.x-height*.32,p.y-height+2,height*.64,height);}
      if(u.acted&&u.side==='player')ctx.globalAlpha=.48;
      const custom=MyGO.Characters&&MyGO.Characters.has(u.id)
        ? MyGO.Characters.drawMap(ctx,u,p.x,p.y,height,now,{moving:visual.moving}):false;
      if(!custom)MyGO.Assets.drawUnit(ctx,u,Math.round(p.x-fallback/2),Math.round(p.y-fallback),fallback,{bob:0,static:false,chibi:true});
      ctx.restore();
    }

    pickProjectedUnit(x,y){
      const first=this.game.stage===1,height=first?SPRITE_HEIGHT:44;
      const list=this.game.living().map(u=>({u,p:MyGO.MapProjection.project(this.projection,(u.x+.5)*TILE,(u.y+(first?1:.84))*TILE)}))
        .sort((a,b)=>b.p.y-a.p.y);
      const hit=list.find(({p})=>Math.abs(x-p.x)<height*.3&&y>=p.y-height+1&&y<=p.y+3);
      return hit?{x:hit.u.x,y:hit.u.y}:null;
    }

    render(now) {
      if((this.game.stage===1&&MyGO.GardenMap)||(this.game.stage===2&&MyGO.MoonMap)){this._renderDepth(now);return;}
      const ctx = this.ctx;
      const width = this.game.map.cols * TILE;
      const height = this.game.map.rows * TILE;
      ctx.clearRect(0, 0, width, height);
      ctx.imageSmoothingEnabled = false;

      ctx.save();
      if (now < this.shakeUntil) {
        const power = this.shakePower * (1 - (this.shakeUntil - now) / 300);
        ctx.translate(
          Math.round((Math.random() - 0.5) * power * 2),
          Math.round((Math.random() - 0.5) * power * 2)
        );
      }

      this._drawTerrain();

      // 范围高亮在单位下方
      if (this.view.mode === 'move') {
        this._drawRange(this.view.moveTiles, 'rgba(67, 164, 255, 0.20)', 'rgba(103, 199, 255, 0.42)');
      } else if (this.view.mode === 'attack') {
        this._drawRange(this.view.attackTiles, 'rgba(255, 69, 105, 0.16)', 'rgba(255, 100, 130, 0.36)');
      }

      this._drawGrid();
      this._drawPath();
      this._drawUnits(now);
      this._drawAmbient(now);
      this._drawHover();
      this._drawFlashes(now);
      this._drawEffects(now);
      // 暗角交给 .board-frame::after 的 CSS 内阴影，避免每帧再铺一张全屏渐变。
      ctx.restore();
    }
  }

  MyGO.Renderer = Renderer;
})(window);
