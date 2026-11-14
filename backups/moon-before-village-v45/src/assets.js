/* ============================================================
 * assets.js — 32×32 像素占位素材与素材替换接口
 *
 * 本文件不引用任何外部图片路径，所有占位图均由 Canvas 即时绘制。
 * 若要替换素材，调用 MyGO.Assets.registerPack(...)，
 * 按“地形 id / 单位 id”注册绘制函数即可（见 README）。
 * ============================================================ */
(function (global) {
  'use strict';
  const MyGO = (global.MyGO = global.MyGO || {});
  const T = MyGO.CONFIG.TERRAIN;

  const terrainDrawers = {};
  // 外部素材包单独存放：内置画笔在“已平移/缩放”的局部坐标里绘制，
  // 而自定义画笔按公开接口接收绝对 x/y/size，两种坐标体系不能混用。
  const customTerrainDrawers = {};
  const unitDrawers = {};
  let installedPack = null;

  /* ---------------- 豆包生成地图贴图 ----------------
   * 直接读取原始导出的 1536×1536 图集，按源矩形裁切到 32px 地形格。
   * 原始图是使用方的豆包会话导出文件；不包含登录态或水印。
   * 若图片加载失败，下面的程序化画笔会自动接管，游戏仍可运行。
   */
  const terrainImages = {
    plain: null,
    forest: null,
    mountain: null,
    wall: null,
    water: null
  };
  const terrainImageSrc = {
    plain: 'map_assets/raw2/36_9fddb3ef.png',
    forest: 'map_assets/raw2/20_a6be3edd.png',
    mountain: 'map_assets/raw2/34_9d672dc7.png',
    wall: 'map_assets/raw2/38_c9eef3de.png',
    water: 'map_assets/raw2/40_1c3c4d45.png'
  };

  /* 建筑装饰：同样来自豆包原始导出，运行时键出棋盘格背景。 */
  const decorImages = { gate: null, tower: null, wing: null, door: null };
  const decorImageSrc = {
    gate: 'map_assets/raw2/12_dee6c5cc.png',
    tower: 'map_assets/raw2/18_97b8ee81.png',
    wing: 'map_assets/raw2/03_979a5b6c.png',
    door: 'map_assets/raw2/16_bcc11000.png'
  };

  /* 用户单独提供的庭院大门：关闭/开启两张透明 PNG。 */
  const gateImages = { closed: null, open: null };
  const gateImageSrc = {
    gateClosed: 'assets/doors/gate-closed.png',
    gateOpen: 'assets/doors/gate-open.png'
  };

  const mapBackground = { img: null };
  const MAP_BG_SRC = 'map_assets/castle-bg.jpg';

  function mapBackgroundReady() {
    return !!(mapBackground.img && mapBackground.img.complete && mapBackground.img.naturalWidth > 0);
  }

  function drawMapBackground(ctx, width, height) {
    if (!mapBackgroundReady()) return false;
    ctx.drawImage(mapBackground.img, 0, 0, width, height);
    // 稍压暗，让格子高亮和单位从背景中跳出来。
    ctx.fillStyle = 'rgba(8, 13, 25, 0.14)';
    ctx.fillRect(0, 0, width, height);
    return true;
  }

  function decorReady(id) {
    const img = decorImages[id];
    return !!(img && img.naturalWidth > 0);
  }

  function terrainReady(type) {
    const img = terrainImages[type];
    return !!(img && img.complete && img.naturalWidth > 0);
  }

  /**
   * 预载四张地图底图。返回的 Promise 永远 resolve，加载失败则回退程序化地形。
   */
  function loadTerrain() {
    const supplied = global.MYGO_MAP_DATA || {};
    const jobs = Object.keys(terrainImageSrc).map(function (key) {
      return new Promise(function (resolve) {
        const img = new Image();
        img.decoding = 'async';
        img.onload = function () {
          terrainImages[key] = img;
          resolve(true);
        };
        img.onerror = function () {
          terrainImages[key] = null;
          resolve(false);
        };
        img.src = supplied[key] || terrainImageSrc[key];
      });
    });

    Object.keys(decorImageSrc).forEach(function (key) {
      jobs.push(new Promise(function (resolve) {
        const img = new Image();
        img.decoding = 'async';
        img.onload = function () {
          // file:// 下 Canvas 会被图片污染，无法 getImageData 抠棋盘格。
          // 建筑改用 multiply 混合：浅色棋盘背景近似保留地图底色，
          // 深色屋顶则正常压暗，既不需要抠图也不会出现白底。
          decorImages[key] = img;
          resolve(true);
        };
        img.onerror = function () {
          decorImages[key] = null;
          resolve(false);
        };
        img.src = supplied[key] || decorImageSrc[key];
      }));
    });

    Object.keys(gateImageSrc).forEach(function (key) {
      jobs.push(new Promise(function (resolve) {
        const img = new Image();
        img.decoding = 'async';
        img.onload = function () {
          gateImages[key === 'gateClosed' ? 'closed' : 'open'] = img;
          resolve(true);
        };
        img.onerror = function () {
          gateImages[key === 'gateClosed' ? 'closed' : 'open'] = null;
          resolve(false);
        };
        img.src = supplied[key] || gateImageSrc[key];
      }));
    });

    jobs.push(new Promise(function (resolve) {
      const img = new Image();
      img.decoding = 'async';
      img.onload = function () { mapBackground.img = img; resolve(true); };
      img.onerror = function () { mapBackground.img = null; resolve(false); };
      img.src = supplied.mapBackground || MAP_BG_SRC;
    }));

    return Promise.all(jobs).then(function () { return true; });
  }

  /**
   * 22 号树是带棋盘格背景的导出图。运行时先键出浅色背景，
   * 再裁成透明树冠，避免把棋盘格直接贴到地图上。
   */
  function extractTree(img) {
    try {
      const size = 512;
      const c = document.createElement('canvas');
      c.width = size;
      c.height = size;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.imageSmoothingEnabled = false;
      g.drawImage(img, 0, 0, size, size);
      const data = g.getImageData(0, 0, size, size);
      const px = data.data;
      let minX = size, minY = size, maxX = -1, maxY = -1;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const i = (y * size + x) * 4;
          const r = px[i], gg = px[i + 1], b = px[i + 2];
          const max = Math.max(r, gg, b);
          const min = Math.min(r, gg, b);
          // 棋盘格是低饱和浅灰；只清除背景，保留树冠高光与树干。
          if (min > 205 && max - min < 14) {
            px[i + 3] = 0;
            continue;
          }
          if (px[i + 3] > 10) {
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (maxX < minX || maxY < minY) return null;
      g.putImageData(data, 0, 0);
      const cropW = maxX - minX + 1;
      const cropH = maxY - minY + 1;
      const out = document.createElement('canvas');
      out.width = cropW;
      out.height = cropH;
      const og = out.getContext('2d');
      og.imageSmoothingEnabled = false;
      og.drawImage(c, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
      return out;
    } catch (err) {
      return null;
    }
  }

  function drawCrop(ctx, img, sx, sy, sw, sh) {
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 32, 32);
  }

  /** 从 8×8、每格 192px 的图集中取一块，并内缩 4px 去掉网格线。 */
  function drawAtlasCell(ctx, img, col, row) {
    drawCrop(ctx, img, col * 192 + 4, row * 192 + 4, 184, 184);
  }

  /* ---------------- 基础像素工具 ---------------- */

  function px(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  function hash(x, y, seed) {
    let h = (x * 374761393 + y * 668265263 + (seed || 0) * 2246822519) >>> 0;
    h = (h ^ (h >>> 13)) >>> 0;
    h = Math.imul(h, 1274126177) >>> 0;
    return (h ^ (h >>> 16)) >>> 0;
  }

  function pick(h, arr) {
    return arr[h % arr.length];
  }

  /**
   * 一簇草。先铺一条暗色根部，再叠两层亮色叶片，
   * 即使只有 5×5 像素，也能看出“草从地里长出来”的层次。
   */
  function drawGrassTuft(ctx, x, y, h, bright) {
    const tall = 2 + (h % 3);
    px(ctx, x, y + 2, 5, 1, 'rgba(24, 44, 25, 0.30)');
    px(ctx, x + 1, y, 1, tall + 1, bright);
    px(ctx, x + 2, y + 1, 1, tall + 2, bright);
    px(ctx, x + 3, y + 1, 1, tall, 'rgba(40, 66, 34, 0.72)');
    px(ctx, x, y + 2, 1, tall, 'rgba(38, 65, 34, 0.68)');
    px(ctx, x + 2, y, 1, 1, 'rgba(255, 255, 220, 0.28)');
  }

  /** 2~3 像素的小野花 / 三叶草，给草地增加可读的节拍。 */
  function drawFlower(ctx, x, y, h) {
    if (h % 3 === 0) {
      px(ctx, x + 1, y + 2, 1, 2, '#527b45');
      px(ctx, x, y, 1, 1, '#f6b7cf');
      px(ctx, x + 2, y, 1, 1, '#ffd6e4');
      px(ctx, x + 1, y - 1, 1, 1, '#fff0f5');
      px(ctx, x + 1, y + 1, 1, 1, '#d9c96f');
    } else {
      px(ctx, x, y + 1, 1, 2, '#5d8751');
      px(ctx, x + 2, y + 1, 1, 2, '#5d8751');
      px(ctx, x + 1, y, 1, 1, '#95ba72');
      px(ctx, x + 1, y + 1, 1, 1, '#c5db96');
    }
  }

  /** 带高光与落影的石子。 */
  function drawPebble(ctx, x, y, h) {
    px(ctx, x, y, 3, 2, '#555b57');
    px(ctx, x, y, 2, 1, '#858b80');
    px(ctx, x + 1, y + 2, 2, 1, 'rgba(20, 30, 22, 0.35)');
  }

  /* ---------------- 地形 ---------------- */

  function drawPlain(ctx, meta) {
    const h = hash(meta.x, meta.y, 7);
    if (terrainReady('plain')) {
      // 36 号图是一整块泥土贴图，在中央 1280px 区域内取四个 620px 裁片。
      const v = h % 4;
      const sx = 200 + (v % 2) * 500;
      const sy = 200 + Math.floor(v / 2) * 500;
      drawCrop(ctx, terrainImages.plain, sx, sy, 620, 620);

      // 极轻的暖色夕照 + 土地裂纹/小石子，让贴图与角色阴影融合。
      px(ctx, 0, 0, 32, 1, 'rgba(255, 222, 166, 0.12)');
      px(ctx, 0, 29, 32, 3, 'rgba(59, 38, 24, 0.16)');
      if (h % 3 === 0) {
        px(ctx, 6 + (h % 18), 23, 4, 1, 'rgba(91, 61, 39, 0.38)');
        px(ctx, 7 + (h % 18), 24, 2, 1, 'rgba(58, 38, 26, 0.28)');
      }
      if (h % 5 === 0) {
        drawGrassTuft(ctx, 4 + (h % 22), 8 + ((h >> 4) % 18), h, '#8b9a5e');
      }
      if (h % 7 === 0) drawPebble(ctx, 8 + (h % 16), 6 + ((h >> 3) % 20), h);
      if (h % 11 === 0) {
        drawFlower(ctx, 9 + (h % 13), 10 + ((h >> 5) % 15), h + 2);
      }
      return;
    }
    const base = pick(h, ['#486d3f', '#4b7142', '#44683c']);
    px(ctx, 0, 0, 32, 32, base);

    // 用很淡的横向色带表现被风压过的草浪，而不是大块棋盘格。
    px(ctx, 0, 3, 32, 7, h % 2 ? 'rgba(193, 224, 151, 0.035)' : 'rgba(22, 44, 24, 0.045)');
    px(ctx, 0, 18, 32, 9, h % 3 ? 'rgba(18, 38, 21, 0.035)' : 'rgba(220, 238, 170, 0.028)');
    px(ctx, 0, 0, 32, 1, 'rgba(255, 255, 235, 0.035)');

    // 零散草簇：位置由格子坐标决定，重绘/存读档不会跳动。
    const bladeColor = pick(h, ['#6f9556', '#648c4d', '#7aa25f', '#62884b']);
    for (let i = 0; i < 5; i++) {
      const bx = 2 + ((h >> (i * 3)) % 26);
      const by = 5 + ((h >> (i * 4 + 2)) % 22);
      drawGrassTuft(ctx, bx, by, h + i * 17, i % 2 ? bladeColor : '#789d5c');
    }

    // 草叶暗部：让亮色叶片不浮在地表上。
    for (let i = 0; i < 3; i++) {
      const bx = 3 + ((h >> (i * 5 + 1)) % 25);
      const by = 9 + ((h >> (i * 2 + 3)) % 18);
      px(ctx, bx, by, 1, 2, 'rgba(34, 58, 30, 0.48)');
    }

    if (h % 7 === 0) {
      drawFlower(ctx, 7 + (h % 17), 7 + ((h >> 4) % 17), h);
    } else if (h % 5 === 0) {
      drawFlower(ctx, 9 + (h % 12), 9 + ((h >> 5) % 13), h + 1);
    }
    if (h % 11 === 0) drawPebble(ctx, 5 + (h % 20), 24 + ((h >> 6) % 5), h);
    if (h % 13 === 0) {
      // 一条很浅的动物小径/踩踏痕
      px(ctx, 2, 25, 9, 1, 'rgba(111, 102, 65, 0.20)');
      px(ctx, 13, 26, 6, 1, 'rgba(111, 102, 65, 0.14)');
    }
  }

  function drawTree(ctx, cx, baseY, scale, h) {
    const s = scale;
    const span = (n) => Math.max(1, Math.round(n * s));

    // 落影先于树干，能明确树和地面的前后关系。
    px(ctx, cx - span(9), baseY - 1, span(18), 2, 'rgba(10, 24, 15, 0.28)');
    px(ctx, cx - span(5), baseY + 1, span(11), 1, 'rgba(10, 24, 15, 0.18)');

    // 树干、根部和树皮高光
    px(ctx, cx - span(1), baseY - span(7), span(3), span(7), '#4a3224');
    px(ctx, cx - span(1), baseY - span(7), 1, span(6), '#76533a');
    px(ctx, cx - span(3), baseY - 1, span(3), 1, '#4a3224');
    px(ctx, cx + span(1), baseY - 1, span(3), 1, '#4a3224');
    if (s > 0.8) {
      px(ctx, cx + 1, baseY - 5, 1, 2, '#8d6748');
      px(ctx, cx - 2, baseY - 4, 2, 1, '#6d4b33');
      // 一根向左伸出的小枝
      px(ctx, cx - span(3), baseY - span(8), span(3), 1, '#5a3e2a');
    }

    // 树冠：暗色底层 → 中间色主体 → 亮色叶簇 → 边缘高光。
    const rows = [
      { dy: -20, w: 5, c: '#203e29' },
      { dy: -18, w: 9, c: '#294e31' },
      { dy: -16, w: 14, c: '#315b38' },
      { dy: -14, w: 17, c: '#38663e' },
      { dy: -12, w: 15, c: '#3d6f45' },
      { dy: -10, w: 11, c: '#326039' },
      { dy: -8, w: 8, c: '#2a5332' }
    ];
    for (const row of rows) {
      const w = Math.round(row.w * s);
      px(ctx, cx - w / 2, baseY + row.dy * s, w, Math.max(1, Math.round(2 * s)), row.c);
    }

    // 叶簇的“破边”：不再是一个完美三角，远看更像树。
    const leaf = h % 3 === 0 ? '#6f9d5c' : '#628f53';
    px(ctx, cx - span(5), baseY - span(16), span(4), span(2), leaf);
    px(ctx, cx + span(2), baseY - span(17), span(3), span(2), '#527f47');
    px(ctx, cx - span(2), baseY - span(19), span(4), span(1), '#7aa964');
    px(ctx, cx + span(5), baseY - span(12), span(3), span(2), '#4e7e45');
    px(ctx, cx - span(8), baseY - span(12), span(2), span(3), '#4a7742');
    px(ctx, cx - span(1), baseY - span(11), span(2), span(1), '#88b36e');
    px(ctx, cx + span(1), baseY - span(15), 1, 1, 'rgba(214, 236, 170, 0.65)');

    // 树冠底部的暗部与一两只飞虫/花点。
    px(ctx, cx - span(7), baseY - span(8), span(14), 1, 'rgba(15, 34, 20, 0.42)');
    if (h % 4 === 0) {
      px(ctx, cx + span(7), baseY - span(7), 1, 1, '#e8d98a');
      px(ctx, cx + span(6), baseY - span(9), 1, 1, '#c9dd8a');
    }
  }

  function drawForest(ctx, meta) {
    const h = hash(meta.x, meta.y, 19);
    // 树冠图集比单树抠图更稳定，森林格直接使用 20 号 8×8 图集。
    if (false && terrainReady('plain')) {
      // 森林以泥土/苔藓为底，再叠一张已去棋盘格的独立树；比整格树冠贴图更自然。
      drawCrop(ctx, terrainImages.plain, 200, 200, 620, 620);
      px(ctx, 0, 0, 32, 32, 'rgba(30, 54, 32, 0.20)');
      px(ctx, 0, 0, 32, 5, 'rgba(7, 19, 10, 0.22)');
      px(ctx, 0, 26, 32, 6, 'rgba(6, 17, 10, 0.24)');
      if (terrainImages.tree) {
        const t = terrainImages.tree;
        const th = 35 + (h % 4);
        const tw = Math.round(th * t.width / t.height);
        const tx = 16 - tw / 2 + ((h % 3) - 1);
        const ty = 33 - th;
        // 树底落影先画，树冠压在单位脚边时仍有前后关系。
        px(ctx, tx + 3, 30, Math.max(8, tw - 6), 2, 'rgba(8, 19, 11, 0.34)');
        ctx.drawImage(t, tx, ty, tw, th);
        if (h % 5 === 0) {
          const t2 = 22 + (h % 6);
          const w2 = Math.round(t2 * t.width / t.height);
          ctx.drawImage(t, 20, 33 - t2, w2, t2);
        }
      } else if (terrainReady('forest')) {
        drawAtlasCell(ctx, terrainImages.forest, 0, 0);
      }
      px(ctx, 0, 0, 32, 1, 'rgba(215, 236, 177, 0.10)');
      px(ctx, 0, 31, 32, 1, 'rgba(0, 0, 0, 0.34)');
      if (h % 4 === 0) {
        px(ctx, 25 + (h % 4), 25, 1, 4, '#557d4c');
        px(ctx, 24 + (h % 4), 26, 2, 1, '#486e43');
      }
      return;
    }
    if (terrainReady('forest')) {
      const cells = [[7, 0], [6, 0], [7, 1], [6, 1]];
      const c = cells[h % cells.length];
      drawAtlasCell(ctx, terrainImages.forest, c[0], c[1]);
      px(ctx, 0, 0, 32, 2, 'rgba(7, 20, 11, 0.24)');
      px(ctx, 0, 28, 32, 4, 'rgba(6, 17, 10, 0.30)');
      px(ctx, 0, 0, 32, 1, 'rgba(215, 236, 177, 0.10)');
      px(ctx, 0, 31, 32, 1, 'rgba(0, 0, 0, 0.34)');
      return;
    }
    px(ctx, 0, 0, 32, 32, '#294a30');
    px(ctx, 0, 0, 32, 5, 'rgba(9, 22, 13, 0.18)');
    px(ctx, 0, 25, 32, 7, 'rgba(8, 19, 11, 0.20)');

    // 苔藓、落叶与蕨类，先铺地面再立树。
    for (let i = 0; i < 10; i++) {
      const bx = 1 + ((h >> (i * 2)) % 30);
      const by = 6 + ((h >> (i * 3 + 1)) % 24);
      px(ctx, bx, by, 1, 2, i % 3 ? '#4a7445' : '#5b8752');
    }
    for (let i = 0; i < 5; i++) {
      const lx = 2 + ((h >> (i * 4 + 2)) % 27);
      const ly = 11 + ((h >> (i * 3 + 3)) % 18);
      px(ctx, lx, ly, 1, 1, i % 2 ? '#8b7740' : '#6f5b35');
    }

    drawTree(ctx, 10 + (h % 4), 27, 1.0, h);
    if (h % 4 !== 1) {
      drawTree(ctx, 24, 30, 0.72, h >> 3);
    } else {
      // 有间距时换成低矮灌木，避免森林格完全遮住单位脚底。
      px(ctx, 18, 24, 10, 4, '#284c30');
      px(ctx, 20, 21, 6, 5, '#356339');
      px(ctx, 21, 20, 4, 2, '#477e45');
      px(ctx, 24, 22, 3, 2, '#5b9452');
      px(ctx, 25, 21, 1, 1, '#a1c17a');
    }

    // 树根旁的碎石和一小丛蕨叶。
    px(ctx, 4 + (h % 5), 28, 3, 2, '#4d4b42');
    px(ctx, 5 + (h % 5), 28, 2, 1, '#747363');
    const fx = 18 + (h % 8);
    px(ctx, fx, 27, 1, 4, '#527f4b');
    px(ctx, fx - 2, 28, 2, 1, '#477446');
    px(ctx, fx + 1, 29, 3, 1, '#477446');

    // 高处漏下的光斑：让密林不是一整块黑绿。
    px(ctx, 21 + (h % 6), 4 + (h % 5), 2, 1, 'rgba(210, 231, 163, 0.20)');
    px(ctx, 12 + (h % 4), 2, 1, 1, 'rgba(235, 244, 186, 0.32)');
  }

  function mountainPeak(ctx, cx, baseY, height, width, light, dark) {
    for (let row = 0; row < height; row++) {
      const w = Math.max(1, Math.round((row / height) * width));
      const x = cx - Math.floor(w / 2);
      px(ctx, x, baseY - height + row, w, 1, dark);
      if (w > 2) {
        px(ctx, x, baseY - height + row, Math.max(1, Math.floor(w * 0.32)), 1, light);
        // 每隔几行做一段更亮的岩脊，山峰才有“面”而不是剪影。
        if (row % 5 === 0) {
          px(ctx, x + 1, baseY - height + row, Math.max(1, Math.floor(w * 0.2)), 1, 'rgba(230, 233, 242, 0.28)');
        }
      }
    }
  }

  function drawMountain(ctx, meta) {
    const h = hash(meta.x, meta.y, 31);
    if (terrainReady('mountain')) {
      // 34 号鹅卵石贴图经过冷色压暗，叠加山岩断面与落石，避免像石板路。
      drawAtlasCell(ctx, terrainImages.mountain, 2, 2);
      px(ctx, 0, 0, 32, 32, 'rgba(29, 37, 56, 0.36)');
      px(ctx, 0, 0, 32, 1, 'rgba(202, 215, 238, 0.16)');
      px(ctx, 0, 29, 32, 3, 'rgba(7, 11, 20, 0.32)');

      // 两块低多边形岩面：先铺暗面，再补受光边。
      px(ctx, 3, 8, 13, 14, 'rgba(54, 60, 78, 0.72)');
      px(ctx, 5, 6, 9, 3, 'rgba(54, 60, 78, 0.72)');
      px(ctx, 5, 8, 2, 12, 'rgba(120, 132, 156, 0.22)');
      px(ctx, 10, 7, 6, 1, 'rgba(163, 177, 201, 0.26)');
      px(ctx, 15, 12, 10, 10, 'rgba(42, 48, 65, 0.58)');
      px(ctx, 17, 10, 7, 2, 'rgba(42, 48, 65, 0.58)');
      px(ctx, 24, 14, 1, 7, 'rgba(9, 13, 24, 0.45)');

      // 风化裂纹与苔藓。
      px(ctx, 8, 8, 1, 5, 'rgba(18, 22, 34, 0.55)');
      px(ctx, 9, 13, 3, 1, 'rgba(18, 22, 34, 0.45)');
      px(ctx, 2, 25, 5, 1, 'rgba(67, 94, 61, 0.62)');
      px(ctx, 26, 22, 4, 1, 'rgba(57, 82, 53, 0.48)');
      if (h % 4 === 0) px(ctx, 4 + (h % 20), 27, 2, 1, 'rgba(167, 180, 199, 0.32)');
      return;
    }
    px(ctx, 0, 0, 32, 32, '#454651');
    // 冷色天光 + 山脚暖影，先定大关系。
    px(ctx, 0, 0, 32, 8, 'rgba(177, 198, 224, 0.055)');
    px(ctx, 0, 22, 32, 10, 'rgba(13, 16, 24, 0.18)');

    // 岩面分层：横向的细碎色带能表现风化岩层。
    for (let i = 0; i < 4; i++) {
      const y = 4 + i * 6 + (h % 3);
      px(ctx, 0, y, 32, 1, i % 2 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.08)');
    }

    // 碎石与山脚堆积
    for (let i = 0; i < 8; i++) {
      const x = 1 + ((h >> (i * 3)) % 28);
      const y = 23 + ((h >> (i * 4)) % 7);
      px(ctx, x, y, 2, 1, i % 3 ? '#5d5e68' : '#34353f');
      if (i % 3 === 0) px(ctx, x, y - 1, 1, 1, '#777984');
    }

    mountainPeak(ctx, 12, 29, 24, 20, '#777a85', '#4e505b');
    mountainPeak(ctx, 23, 28, 16, 14, '#696c77', '#42444f');

    // 主峰积雪：顶部实雪，向下用点状过渡，避免一条生硬白线。
    px(ctx, 11, 6, 3, 2, '#e0e3eb');
    px(ctx, 9, 8, 7, 2, '#c8cbd5');
    px(ctx, 8, 10, 3, 1, '#b3b6c1');
    px(ctx, 10, 10, 2, 1, '#d6d8e1');
    px(ctx, 13, 11, 2, 1, '#abb0bc');
    px(ctx, 11, 5, 2, 1, '#f1f3f8');
    px(ctx, 22, 13, 2, 1, '#d0d3dc');
    px(ctx, 21, 14, 4, 1, '#b8bbc6');

    // 裂缝、苔藓、雪线下方的阴影。
    px(ctx, 9, 12, 1, 7, '#393b46');
    px(ctx, 10, 18, 2, 1, '#393b46');
    px(ctx, 14, 15, 1, 4, '#3d3f4a');
    px(ctx, 17, 20, 1, 3, 'rgba(35, 37, 48, 0.55)');
    px(ctx, 5, 25, 4, 1, '#3d6542');
    px(ctx, 6, 24, 2, 1, '#557d4f');
    px(ctx, 24, 22, 3, 1, 'rgba(57, 95, 60, 0.65)');
    px(ctx, 4, 28, 25, 2, 'rgba(0,0,0,0.20)');
  }

  function drawWall(ctx, meta) {
    const h = hash(meta.x, meta.y, 43);
    if (terrainReady('wall')) {
      // 38 号图是灰石墙贴图：保留砌石纹理，补上顶部受光和墙脚阴影。
      drawAtlasCell(ctx, terrainImages.wall, 0, 0);
      // 用大块砌石覆盖细碎石纹，让 32px 墙格看起来是连续墙体而不是碎石堆。
      for (let row = 0; row < 3; row++) {
        const y = 3 + row * 9;
        const offset = row % 2 ? -6 : 0;
        for (let col = -1; col < 3; col++) {
          const x = offset + col * 13 + 1;
          px(ctx, x, y, 11, 7, 'rgba(72, 73, 86, 0.88)');
          px(ctx, x, y, 11, 1, 'rgba(190, 193, 207, 0.22)');
          px(ctx, x, y + 6, 11, 1, 'rgba(17, 18, 26, 0.42)');
          px(ctx, x, y, 1, 7, 'rgba(220, 222, 232, 0.10)');
        }
      }
      px(ctx, 0, 0, 32, 2, 'rgba(226, 229, 238, 0.18)');
      px(ctx, 0, 2, 32, 1, 'rgba(22, 25, 34, 0.28)');
      px(ctx, 0, 27, 32, 5, 'rgba(15, 16, 24, 0.30)');
      px(ctx, 0, 0, 2, 32, 'rgba(255, 255, 255, 0.07)');
      px(ctx, 30, 0, 2, 32, 'rgba(12, 13, 20, 0.20)');
      px(ctx, 0, 31, 32, 1, 'rgba(0, 0, 0, 0.38)');

      // 潮湿墙脚的苔藓和剥落碎屑，让连续墙面不呆板。
      if (h % 3 === 0) {
        px(ctx, 2, 25, 7, 3, 'rgba(47, 82, 52, 0.82)');
        px(ctx, 4, 24, 4, 1, 'rgba(82, 126, 72, 0.78)');
        px(ctx, 7, 26, 2, 1, 'rgba(36, 63, 42, 0.72)');
      }
      if (h % 4 === 0) {
        px(ctx, 24, 3, 1, 5, 'rgba(50, 90, 59, 0.72)');
        px(ctx, 25, 8, 1, 2, 'rgba(60, 104, 65, 0.66)');
      }
      if (h % 5 === 0) {
        px(ctx, 8, 29, 4, 2, 'rgba(43, 40, 48, 0.82)');
        px(ctx, 9, 28, 2, 1, 'rgba(104, 100, 110, 0.58)');
      }
      return;
    }
    px(ctx, 0, 0, 32, 32, '#262330');
    px(ctx, 0, 0, 32, 3, 'rgba(255,255,255,0.035)');

    // 砖块：每一块都有顶面高光、底部暗边和随机磨损。
    for (let row = 0; row < 4; row++) {
      const y = row * 8;
      const offset = row % 2 ? 0 : -8;
      for (let col = -1; col < 3; col++) {
        const x = offset + col * 16 + 1;
        const shade = pick(h + row * 7 + col * 3, ['#514c60', '#595468', '#484357']);
        px(ctx, x, y + 1, 14, 6, shade);
        px(ctx, x + 1, y + 2, 12, 1, 'rgba(255,255,255,0.10)');
        px(ctx, x + 1, y + 5, 11, 1, 'rgba(0,0,0,0.13)');
        px(ctx, x, y + 6, 14, 1, 'rgba(0,0,0,0.28)');
        px(ctx, x, y + 1, 1, 5, 'rgba(255,255,255,0.055)');
        // 每块砖的左上角高光 + 右下角缺口
        px(ctx, x + 2, y + 2, 3, 1, 'rgba(255,255,255,0.12)');
        if ((h + row * 5 + col * 9) % 4 === 0) {
          px(ctx, x + 9, y + 3, 2, 1, 'rgba(18,15,24,0.30)');
          px(ctx, x + 10, y + 4, 1, 1, 'rgba(18,15,24,0.20)');
        }
      }
    }

    // 裂缝从砖缝一路向下，旁边再补一段细裂。
    const cx = 8 + (h % 7);
    px(ctx, cx, 9, 1, 4, '#17141f');
    px(ctx, cx + 1, 13, 1, 3, '#17141f');
    px(ctx, cx + 2, 16, 2, 1, '#17141f');
    px(ctx, 18 + (h % 5), 1, 1, 2, 'rgba(15,12,20,0.55)');

    // 苔藓与垂藤：附着在墙脚和砖缝里。
    if (h % 3 === 0) {
      px(ctx, 2, 24, 6, 3, '#33553a');
      px(ctx, 3, 23, 4, 1, '#4c754a');
      px(ctx, 5, 22, 2, 1, '#658f58');
      px(ctx, 4, 26, 3, 1, '#27452f');
    }
    if (h % 4 === 0) {
      px(ctx, 25, 5, 1, 6, '#315a3b');
      px(ctx, 24, 8, 1, 2, '#47734b');
      px(ctx, 26, 10, 1, 3, '#3e6645');
      px(ctx, 27, 13, 1, 2, '#315a3b');
    }
    if (h % 5 === 0) {
      // 墙脚碎石
      px(ctx, 7, 29, 3, 2, '#45404f');
      px(ctx, 8, 29, 2, 1, '#6a6475');
      px(ctx, 22, 30, 2, 1, '#37333f');
    }
    px(ctx, 0, 0, 32, 1, 'rgba(220, 214, 238, 0.10)');
    px(ctx, 0, 31, 32, 1, 'rgba(0,0,0,0.38)');
  }

  function drawWater(ctx, meta) {
    if (terrainReady('water')) {
      const col = (meta.x * 3 + meta.y * 5) % 8;
      const row = (meta.x + meta.y * 2) % 8;
      drawAtlasCell(ctx, terrainImages.water, col, row);
      ctx.fillStyle = 'rgba(30, 74, 122, 0.16)';
      ctx.fillRect(0, 0, 32, 32);
      return;
    }
    const grad = ctx.createLinearGradient(0, 0, 0, 32);
    grad.addColorStop(0, '#1d5d83');
    grad.addColorStop(1, '#123f60');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = 'rgba(160, 225, 244, 0.18)';
      ctx.fillRect(2 + ((meta.x * 7 + i * 9) % 26), 5 + i * 7, 8, 1);
    }
  }

  function drawBridge(ctx, meta) {
    ctx.fillStyle = '#2a1d15';
    ctx.fillRect(0, 0, 32, 32);
    for (let row = 0; row < 4; row++) {
      const y = row * 8;
      ctx.fillStyle = row % 2 ? '#8a6445' : '#96704d';
      ctx.fillRect(1, y + 1, 30, 6);
      ctx.fillStyle = 'rgba(236, 197, 142, 0.18)';
      ctx.fillRect(2, y + 2, 28, 1);
      ctx.fillStyle = 'rgba(40, 26, 18, 0.35)';
      ctx.fillRect(2, y + 6, 28, 1);
    }
    // 桥面两侧的矮护栏
    ctx.fillStyle = '#3b291d';
    ctx.fillRect(0, 0, 3, 32);
    ctx.fillRect(29, 0, 3, 32);
    ctx.fillStyle = 'rgba(224, 184, 126, 0.22)';
    ctx.fillRect(1, 0, 1, 32);
    ctx.fillRect(30, 0, 1, 32);
  }

  terrainDrawers.plain = drawPlain;
  terrainDrawers.forest = drawForest;
  terrainDrawers.mountain = drawMountain;
  terrainDrawers.wall = drawWall;
  terrainDrawers.water = drawWater;
  terrainDrawers.bridge = drawBridge;

  /**
   * 庭院大门的运行时绘制。
   * 关闭时是铁栅门，开启时露出通往庭院的黑暗门洞。
   */
  function drawGateTile(ctx, x, y, open, meta) {
    // 新的大门图是透明 PNG，门格只负责铺底：使用与周围完全一致的地面，
    // 不再画旧铁栅 / 门锁 / 深色门洞，避免叠成“两扇门”。
    drawPlain(ctx, meta || { x: 0, y: 0 });
  }

  terrainDrawers.gate = function (ctx, meta) { drawGateTile(ctx, 0, 0, false, meta); };
  terrainDrawers.gateOpen = function (ctx, meta) { drawGateTile(ctx, 0, 0, true, meta); };

  /**
   * 绘制一个 32px 地形格。
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} type 地形 id
   * @param {number} x 像素坐标
   * @param {number} y 像素坐标
   * @param {number} size 输出尺寸（默认 32）
   * @param {{gx:number, gy:number}} meta 格子坐标，用于确定性纹理
   */
  function drawTerrain(ctx, type, x, y, size, meta) {
    const s = size || 32;
    const info = {
      gx: meta ? meta.gx : 0,
      gy: meta ? meta.gy : 0,
      type
    };

    // 自定义地形：公开接口为 (ctx, x, y, size, info)，x/y 是画布像素坐标。
    // 不在这里 translate/scale，由绘制函数自己按目标矩形绘制，便于直接 drawImage。
    const custom = customTerrainDrawers[type];
    if (custom) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      custom(ctx, x, y, s, info);
      ctx.restore();
      return;
    }

    // 内置占位画笔：在 32×32 的局部坐标中作画，再统一缩放到目标尺寸。
    const drawer = terrainDrawers[type] || terrainDrawers.plain;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s / 32, s / 32);
    ctx.imageSmoothingEnabled = false;
    drawer(ctx, { x: info.gx, y: info.gy });
    ctx.restore();
  }

  /**
   * 绘制用户提供的庭院大门（关闭 / 开启）。
   * 两张图是透明 PNG，按 contain 放进固定大小的门楼画框，底边固定。
   */
  function drawGateSprite(ctx, open, x, y, w, h) {
    const img = open ? gateImages.open : gateImages.closed;
    if (!img || !img.width) return false;
    const scale = Math.min(w / img.width, h / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    const dx = x + (w - dw) / 2;
    const dy = y + h - dh;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = 'rgba(4, 6, 12, 0.22)';
    ctx.fillRect(x + w * 0.2, y + h - 3, w * 0.6, 3);
    ctx.drawImage(img, Math.round(dx), Math.round(dy), Math.round(dw), Math.round(dh));
    ctx.restore();
    return true;
  }

  function gateSpriteReady(open) {
    const img = open ? gateImages.open : gateImages.closed;
    return !!(img && img.naturalWidth > 0);
  }

  /**
   * 建筑装饰绘制。坐标为逻辑像素，图片按 contain 方式放缩，
   * 底边落地，并先铺一层柔和阴影，让屋顶不会“飘”在地面上。
   */
  function drawDecor(ctx, id, x, y, w, h) {
    const img = decorImages[id];
    if (!img || !img.width) return;
    const scale = Math.min(w / img.width, h / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    const dx = x + (w - dw) / 2;
    const dy = y + h - dh;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = 'rgba(5, 8, 14, 0.28)';
    ctx.fillRect(x + w * 0.12, y + h - 5, w * 0.76, 5);
    // 用 darken 混合：白/浅灰棋盘背景接近透明，深色屋瓦正常覆盖。
    ctx.globalCompositeOperation = 'darken';
    ctx.drawImage(img, Math.round(dx), Math.round(dy), Math.round(dw), Math.round(dh));
    ctx.restore();
  }

  function drawWeapon(ctx, type, art) {
    const steel = '#d9dde8';
    const steel2 = '#9aa1b5';
    const handle = art.outfitDark;
    switch (type) {
      case 'sword':
        // 剑柄与护手
        px(ctx, 23, 21, 2, 4, handle);
        px(ctx, 21, 20, 6, 1, art.accent);
        // 剑刃向右上
        for (let i = 0; i < 11; i++) {
          px(ctx, 24 + Math.floor(i * 0.55), 20 - i, 2, 2, i < 4 ? steel2 : steel);
        }
        px(ctx, 29, 9, 2, 2, '#ffffff');
        break;
      case 'axe':
        px(ctx, 25, 10, 2, 17, '#6b4a2f');
        px(ctx, 24, 22, 2, 1, '#83603e');
        px(ctx, 21, 9, 7, 2, steel2);
        px(ctx, 20, 11, 9, 5, steel);
        px(ctx, 22, 10, 5, 7, '#b7bdcb');
        px(ctx, 20, 11, 2, 4, art.accent);
        break;
      case 'lance':
        px(ctx, 26, 6, 2, 22, '#6d5138');
        px(ctx, 25, 8, 1, 18, '#9b7955');
        px(ctx, 25, 3, 3, 4, steel);
        px(ctx, 26, 1, 1, 3, '#ffffff');
        px(ctx, 25, 25, 3, 1, art.accent);
        break;
      case 'bow':
        // 弓臂
        px(ctx, 26, 7, 2, 2, '#8a633f');
        px(ctx, 28, 9, 1, 3, '#a77a4d');
        px(ctx, 29, 12, 1, 8, '#a77a4d');
        px(ctx, 28, 20, 1, 3, '#8a633f');
        px(ctx, 26, 23, 2, 2, '#8a633f');
        // 弓弦
        px(ctx, 26, 8, 1, 1, '#e6e2d6');
        px(ctx, 26, 9, 1, 14, '#cfc9ba');
        // 箭
        px(ctx, 20, 15, 9, 1, '#d9d3c1');
        px(ctx, 19, 14, 2, 1, steel);
        px(ctx, 19, 16, 2, 1, steel);
        px(ctx, 27, 14, 2, 3, art.accent);
        break;
      case 'tome':
        px(ctx, 22, 19, 8, 9, art.outfitDark);
        px(ctx, 23, 20, 6, 7, '#efe6d4');
        px(ctx, 24, 21, 4, 1, art.accent);
        px(ctx, 24, 23, 4, 1, art.accent);
        px(ctx, 24, 25, 2, 1, art.accent);
        px(ctx, 22, 19, 8, 1, art.accent);
        px(ctx, 22, 19, 1, 9, art.hairDark || art.outfitDark);
        break;
      default:
        break;
    }
  }

  /* ---------------- 角色 ---------------- */

  /**
   * 角色背后的披风 / 外套下摆。
   * 参考 FE if 的小人：轮廓先向外扩一圈，再用亮色布料与金色扣件
   * 形成“风从左侧吹来”的动势；实际尺寸仍按 32×32 绘制，
   * 地图上会整体放大到 48px，细节因此更清楚。
   */
  function drawHeroCape(ctx, unit, art) {
    const kind = unit.weapon.type;
    const accent = art.accent || '#ff8fbd';
    const cloth = art.outfit || '#2d3147';
    const dark = art.outfitDark || '#1b1d2c';

    // 两侧披肩外轮廓。
    px(ctx, 5, 14, 4, 11, dark);
    px(ctx, 6, 15, 2, 9, cloth);
    px(ctx, 23, 13, 4, 12, dark);
    px(ctx, 24, 15, 2, 9, cloth);

    if (kind === 'sword') {
      // 主角式短披风：向右侧扬起，末端接近地面。
      px(ctx, 26, 13, 2, 12, dark);
      px(ctx, 25, 15, 2, 9, accent);
      px(ctx, 24, 23, 4, 2, accent);
      px(ctx, 27, 24, 1, 3, dark);
      px(ctx, 26, 17, 1, 5, 'rgba(255,255,255,0.22)');
    } else if (kind === 'lance') {
      // 骑士披风稍微对称，强调长枪兵的稳定重心。
      px(ctx, 4, 16, 3, 10, dark);
      px(ctx, 5, 17, 1, 8, accent);
      px(ctx, 25, 15, 3, 11, dark);
      px(ctx, 26, 17, 1, 8, accent);
      px(ctx, 4, 25, 3, 2, dark);
    } else if (kind === 'bow') {
      // 轻便短斗篷，右侧留出取箭空间。
      px(ctx, 23, 14, 3, 8, dark);
      px(ctx, 24, 15, 1, 6, accent);
      px(ctx, 24, 22, 3, 1, dark);
    } else if (kind === 'tome') {
      // 法师长袍后摆，末端有符文亮边。
      px(ctx, 5, 17, 3, 10, dark);
      px(ctx, 6, 18, 1, 8, accent);
      px(ctx, 24, 17, 3, 10, dark);
      px(ctx, 25, 19, 1, 7, accent);
      px(ctx, 6, 26, 2, 1, 'rgba(255,255,255,0.28)');
    } else {
      // 斧战士的厚重毛领与短披风。
      px(ctx, 5, 15, 3, 8, dark);
      px(ctx, 24, 14, 4, 9, dark);
      px(ctx, 24, 15, 2, 7, accent);
    }

    // 肩部固定扣，给披风一个“挂在身上”的支点。
    px(ctx, 8, 15, 2, 2, '#d8b86a');
    px(ctx, 22, 15, 2, 2, '#d8b86a');
  }

  function drawHeroHairBack(ctx, art) {
    const h = art.hair;
    const d = art.hairDark;
    const shine = art.hairLight || 'rgba(255,255,255,0.30)';
    const style = art.hairStyle;

    if (style === 'long') {
      // 外轮廓先下沉一层，长发才不会像两块贴纸。
      px(ctx, 7, 8, 4, 19, d);
      px(ctx, 21, 8, 4, 19, d);
      px(ctx, 8, 11, 3, 15, h);
      px(ctx, 21, 11, 3, 15, h);
      px(ctx, 9, 11, 1, 12, shine);
      px(ctx, 23, 12, 1, 11, 'rgba(255,255,255,0.10)');
      px(ctx, 8, 25, 2, 3, h);
      px(ctx, 22, 25, 2, 3, h);
      px(ctx, 7, 27, 2, 1, d);
      px(ctx, 23, 27, 2, 1, d);
    } else if (style === 'ponytail') {
      px(ctx, 21, 6, 4, 5, d);
      px(ctx, 23, 8, 4, 8, d);
      px(ctx, 25, 9, 3, 6, h);
      px(ctx, 26, 15, 2, 4, h);
      px(ctx, 27, 18, 1, 2, d);
      px(ctx, 24, 10, 1, 4, shine);
      // 发圈
      px(ctx, 23, 9, 2, 1, art.accent);
    } else if (style === 'bob') {
      px(ctx, 8, 8, 3, 11, d);
      px(ctx, 21, 8, 3, 11, d);
      px(ctx, 9, 10, 2, 8, h);
      px(ctx, 21, 10, 2, 8, h);
      px(ctx, 10, 17, 2, 2, h);
      px(ctx, 20, 17, 2, 2, h);
    } else if (style === 'messy') {
      px(ctx, 8, 7, 3, 5, d);
      px(ctx, 21, 7, 3, 5, d);
      px(ctx, 9, 9, 2, 3, h);
      px(ctx, 21, 9, 2, 3, h);
    } else {
      px(ctx, 8, 8, 3, 7, d);
      px(ctx, 21, 8, 3, 7, d);
      px(ctx, 9, 9, 1, 5, h);
      px(ctx, 22, 9, 1, 5, h);
    }
  }

  function drawHeroHairFront(ctx, art) {
    const h = art.hair;
    const d = art.hairDark;
    const shine = art.hairLight || 'rgba(255,255,255,0.30)';
    const style = art.hairStyle;

    // 头顶轮廓 / 后脑厚度
    px(ctx, 10, 5, 12, 3, d);
    px(ctx, 9, 6, 14, 4, d);
    px(ctx, 10, 6, 12, 2, h);
    px(ctx, 10, 8, 2, 3, h);
    px(ctx, 20, 8, 2, 3, h);

    if (style === 'bob') {
      px(ctx, 9, 8, 3, 7, h);
      px(ctx, 20, 8, 3, 7, h);
      px(ctx, 11, 9, 4, 2, h);
      px(ctx, 17, 9, 4, 2, h);
      px(ctx, 12, 11, 2, 2, h);
      px(ctx, 18, 11, 2, 2, h);
      px(ctx, 10, 14, 2, 2, h);
      px(ctx, 20, 14, 2, 2, h);
    } else if (style === 'long') {
      px(ctx, 8, 8, 3, 13, h);
      px(ctx, 21, 8, 3, 13, h);
      px(ctx, 10, 8, 12, 3, h);
      px(ctx, 12, 10, 4, 2, h);
      px(ctx, 17, 10, 4, 2, h);
      px(ctx, 9, 17, 2, 4, d);
      px(ctx, 21, 17, 2, 4, d);
    } else if (style === 'messy') {
      px(ctx, 10, 3, 3, 4, h);
      px(ctx, 13, 2, 3, 4, h);
      px(ctx, 16, 3, 3, 4, h);
      px(ctx, 19, 4, 2, 4, h);
      px(ctx, 9, 7, 2, 4, h);
      px(ctx, 21, 7, 2, 4, h);
      px(ctx, 12, 9, 4, 2, h);
      px(ctx, 17, 9, 4, 2, h);
      px(ctx, 13, 11, 2, 2, h);
      px(ctx, 18, 11, 2, 1, h);
      // 标志性的乱翘发梢
      px(ctx, 8, 5, 2, 2, h);
      px(ctx, 22, 3, 2, 3, h);
      px(ctx, 17, 1, 1, 2, d);
    } else if (style === 'short') {
      px(ctx, 10, 8, 2, 3, h);
      px(ctx, 20, 8, 2, 3, h);
      px(ctx, 12, 9, 8, 2, h);
      px(ctx, 14, 11, 2, 1, h);
      px(ctx, 19, 11, 1, 2, h);
    } else if (style === 'ponytail') {
      px(ctx, 9, 8, 3, 4, h);
      px(ctx, 20, 8, 3, 4, h);
      px(ctx, 12, 8, 8, 2, h);
      px(ctx, 13, 10, 3, 2, h);
      px(ctx, 18, 10, 3, 2, h);
    }

    // 发丝：高光、内层暗线和几缕分开的刘海。
    px(ctx, 12, 6, 5, 1, shine);
    px(ctx, 18, 7, 2, 1, 'rgba(255,255,255,0.18)');
    px(ctx, 10, 9, 1, 4, 'rgba(0,0,0,0.16)');
    px(ctx, 15, 7, 1, 3, 'rgba(0,0,0,0.10)');
    px(ctx, 19, 9, 1, 3, 'rgba(0,0,0,0.10)');
    px(ctx, 16, 5, 1, 1, shine);

    // 不同角色的小呆毛，作为 32px 下的辨识点。
    if (style === 'messy' || style === 'ponytail') {
      px(ctx, 15, 3, 2, 1, h);
      px(ctx, 17, 2, 1, 1, h);
    } else if (style === 'bob') {
      px(ctx, 18, 4, 1, 2, h);
      px(ctx, 19, 3, 1, 1, h);
    }
  }

  function drawHeroBody(ctx, unit, art, facing) {
    const outline = art.outline || '#19131f';
    const skinShade = 'rgba(104, 61, 70, 0.22)';
    const clothShade = 'rgba(0, 0, 0, 0.20)';
    const clothLight = 'rgba(255, 255, 255, 0.10)';
    const kind = unit.weapon.type;

    // 披风 / 衣摆先垫在最后面，给角色一个稳定的剪影。
    if (kind === 'lance' || kind === 'tome') {
      px(ctx, 7, 17, 4, 9, art.outfitDark);
      px(ctx, 8, 18, 2, 7, art.outfit);
      px(ctx, 7, 25, 3, 1, art.accent);
    }

    // --- 腿、靴子和地面接触处 ---
    px(ctx, 10, 22, 5, 6, outline);
    px(ctx, 17, 22, 5, 6, outline);
    px(ctx, 11, 22, 3, 5, art.outfitDark);
    px(ctx, 18, 22, 3, 5, art.outfitDark);
    px(ctx, 11, 23, 1, 3, clothShade);
    px(ctx, 18, 23, 1, 3, clothShade);
    px(ctx, 10, 26, 5, 3, outline);
    px(ctx, 17, 26, 5, 3, outline);
    px(ctx, 11, 26, 3, 2, '#2a2431');
    px(ctx, 18, 26, 3, 2, '#2a2431');
    px(ctx, 11, 27, 3, 1, '#100d15');
    px(ctx, 18, 27, 3, 1, '#100d15');
    px(ctx, 12, 26, 1, 1, 'rgba(255,255,255,0.16)');
    px(ctx, 19, 26, 1, 1, 'rgba(255,255,255,0.12)');

    // --- 外套下摆 / 百褶裙边 ---
    px(ctx, 9, 19, 14, 6, outline);
    px(ctx, 10, 19, 12, 5, art.outfit);
    px(ctx, 11, 23, 10, 2, art.outfitDark);
    px(ctx, 12, 19, 1, 5, clothShade);
    px(ctx, 19, 19, 1, 5, clothShade);
    px(ctx, 15, 20, 1, 4, art.accent);
    px(ctx, 9, 24, 14, 1, 'rgba(0,0,0,0.25)');

    // --- 躯干轮廓与制服 ---
    px(ctx, 9, 13, 14, 11, outline);
    px(ctx, 10, 14, 12, 9, art.outfit);
    px(ctx, 11, 14, 10, 8, art.outfit);
    px(ctx, 11, 15, 10, 1, clothLight);
    px(ctx, 12, 18, 8, 3, 'rgba(0,0,0,0.10)');
    // 两侧衣缘
    px(ctx, 11, 15, 2, 5, art.outfitDark);
    px(ctx, 19, 15, 2, 5, art.outfitDark);
    px(ctx, 11, 16, 1, 4, art.accent);
    px(ctx, 20, 16, 1, 4, 'rgba(255,255,255,0.12)');
    // 腰带与扣具
    px(ctx, 10, 20, 12, 2, '#2a2233');
    px(ctx, 15, 20, 2, 2, '#e8c66e');
    px(ctx, 16, 21, 1, 1, '#8e6a2d');
    // 胸口纽扣 / 领结
    px(ctx, 15, 16, 1, 1, '#e8c66e');
    px(ctx, 15, 19, 1, 1, '#c8a650');

    // --- 手臂、手套与手 ---
    px(ctx, 7, 15, 4, 8, outline);
    px(ctx, 21, 15, 4, 8, outline);
    px(ctx, 8, 16, 2, 5, art.skin);
    px(ctx, 22, 16, 2, 5, art.skin);
    px(ctx, 8, 18, 1, 2, skinShade);
    px(ctx, 23, 19, 1, 2, skinShade);
    px(ctx, 7, 20, 3, 3, art.outfitDark);
    px(ctx, 22, 20, 3, 3, art.outfitDark);
    px(ctx, 8, 22, 2, 2, art.skin);
    px(ctx, 22, 22, 2, 2, art.skin);
    px(ctx, 8, 23, 2, 1, '#6f4b46');
    px(ctx, 22, 23, 2, 1, '#6f4b46');
    // 护腕高光，握武器的手更明确
    px(ctx, 7, 21, 2, 1, art.accent);
    px(ctx, 23, 21, 1, 1, art.accent);

    // --- 领口、围巾和飘带 ---
    px(ctx, 11, 13, 10, 2, art.outfitDark);
    px(ctx, 12, 13, 8, 1, art.accent);
    px(ctx, 15, 14, 2, 3, art.skin);
    px(ctx, 12, 14, 3, 1, 'rgba(255,255,255,0.20)');
    px(ctx, 20, 14, 2, 3, art.accent);
    px(ctx, 21, 17, 2, 1, art.accent);
    px(ctx, 22, 18, 1, 2, art.accent);

    // --- 头部与脸部 ---
    px(ctx, 10, 6, 12, 10, outline);
    px(ctx, 10, 7, 3, 3, art.skin);
    px(ctx, 19, 7, 3, 3, art.skin);
    px(ctx, 11, 7, 10, 8, art.skin);
    px(ctx, 10, 8, 2, 5, art.skin);
    px(ctx, 20, 8, 2, 5, art.skin);
    // 耳朵 / 脖子 / 脸侧阴影
    px(ctx, 9, 10, 1, 2, art.skin);
    px(ctx, 22, 10, 1, 2, art.skin);
    px(ctx, 13, 14, 6, 2, skinShade);
    px(ctx, 15, 15, 2, 1, art.skin);
    px(ctx, 12, 12, 1, 3, 'rgba(255,255,255,0.08)');
    // 眼睛：上眼睑 + 瞳孔 + 高光
    px(ctx, 12, 10, 3, 2, '#2a202c');
    px(ctx, 18, 10, 3, 2, '#2a202c');
    px(ctx, 13, 10, 1, 1, art.eye);
    px(ctx, 19, 10, 1, 1, art.eye);
    px(ctx, 12, 11, 1, 1, 'rgba(255,255,255,0.18)');
    px(ctx, 18, 11, 1, 1, 'rgba(255,255,255,0.12)');
    px(ctx, 13, 12, 1, 1, '#d8a0a0');
    px(ctx, 19, 12, 1, 1, '#d8a0a0');
    // 鼻子与嘴
    px(ctx, 16, 11, 1, 1, '#d7a293');
    px(ctx, 15, 13, 2, 1, '#9a5260');
    px(ctx, 16, 13, 1, 1, '#c37a82');

    // 角色专属的小配件：只占几像素，但能一眼分出职业。
    if (kind === 'sword') {
      px(ctx, 8, 14, 3, 2, art.accent);
      px(ctx, 9, 15, 1, 2, 'rgba(255,255,255,0.22)');
      px(ctx, 8, 21, 2, 3, art.outfitDark);
      px(ctx, 7, 23, 3, 1, '#c9a95e');
    } else if (kind === 'bow') {
      // 斜挎箭袋带
      px(ctx, 11, 15, 1, 2, '#c9a95e');
      px(ctx, 12, 17, 1, 2, '#c9a95e');
      px(ctx, 13, 19, 1, 1, '#c9a95e');
      px(ctx, 22, 13, 3, 4, art.outfitDark);
      px(ctx, 22, 12, 1, 5, '#c9a95e');
      px(ctx, 24, 12, 1, 4, '#dce3ef');
    } else if (kind === 'tome') {
      // 小书袋与漂浮的符文
      px(ctx, 7, 19, 3, 4, art.outfitDark);
      px(ctx, 8, 20, 1, 2, '#c9a95e');
      px(ctx, 25, 15, 1, 1, art.accent);
      px(ctx, 26, 14, 1, 1, 'rgba(255,255,255,0.38)');
    } else if (kind === 'axe') {
      // 皮护臂和工具袋
      px(ctx, 7, 18, 3, 3, '#4b362b');
      px(ctx, 8, 19, 2, 1, '#8d6a46');
      px(ctx, 8, 22, 3, 3, art.outfitDark);
      px(ctx, 9, 23, 1, 1, '#c9a95e');
    }

    // 刘海最后画，遮住额头与部分眼睛，形成动画式的前后层次。
    drawHeroHairFront(ctx, art);
    // 武器
    drawWeapon(ctx, unit.weapon.type, art);
  }

  function drawShadow(ctx, unit, art) {
    const dark = art.outfitDark;
    const body = art.outfit;
    const glow = art.accent || '#ff5c8a';

    // 紫雾外轮廓。下摆裂成几条细缕，像被风吹散的影子。
    px(ctx, 4, 13, 2, 9, 'rgba(120,85,180,0.16)');
    px(ctx, 26, 12, 2, 10, 'rgba(120,85,180,0.13)');
    px(ctx, 8, 23, 17, 5, 'rgba(15,10,24,0.70)');
    px(ctx, 7, 27, 4, 2, dark);
    px(ctx, 12, 28, 5, 2, 'rgba(20,12,30,0.72)');
    px(ctx, 18, 27, 5, 3, dark);
    px(ctx, 23, 29, 3, 1, 'rgba(20,12,30,0.55)');
    px(ctx, 6, 24, 2, 3, dark);
    px(ctx, 24, 23, 2, 4, dark);
    px(ctx, 5, 20, 1, 4, glow);
    px(ctx, 26, 19, 1, 4, 'rgba(255,92,138,0.35)');

    // 身体：先轮廓，再内袍，最后一道发光的胸饰。
    px(ctx, 9, 13, 14, 12, '#0e0a17');
    px(ctx, 10, 14, 12, 10, body);
    px(ctx, 11, 14, 9, 8, dark);
    px(ctx, 12, 15, 7, 1, 'rgba(255,255,255,0.06)');
    px(ctx, 13, 16, 6, 1, glow);
    px(ctx, 14, 18, 4, 1, 'rgba(0,0,0,0.35)');
    px(ctx, 15, 20, 2, 2, glow);
    px(ctx, 14, 22, 4, 1, 'rgba(0,0,0,0.35)');

    // 兜帽：外沿压低，内里是一团没有脸的夜空。
    px(ctx, 9, 5, 14, 4, dark);
    px(ctx, 8, 8, 16, 7, dark);
    px(ctx, 10, 7, 12, 2, body);
    px(ctx, 10, 9, 2, 5, art.hairDark);
    px(ctx, 20, 9, 2, 5, art.hairDark);
    px(ctx, 11, 9, 10, 5, '#100c1a');
    px(ctx, 12, 8, 8, 1, 'rgba(120,85,180,0.18)');
    // 眼睛与拖尾的辉光
    px(ctx, 13, 10, 2, 1, glow);
    px(ctx, 18, 10, 2, 1, glow);
    px(ctx, 13, 11, 1, 1, 'rgba(255,255,255,0.55)');
    px(ctx, 18, 11, 1, 1, 'rgba(255,255,255,0.55)');
    px(ctx, 12, 12, 3, 1, 'rgba(255,92,138,0.25)');
    px(ctx, 18, 12, 3, 1, 'rgba(255,92,138,0.25)');
    // 兜帽边缘的磨损
    px(ctx, 9, 7, 1, 2, 'rgba(255,255,255,0.08)');
    px(ctx, 22, 8, 1, 3, 'rgba(255,255,255,0.05)');
    px(ctx, 10, 14, 1, 2, 'rgba(0,0,0,0.40)');

    // 武器，以及武器上的冷光。
    drawWeapon(ctx, unit.weapon.type, art);
    if (unit.weapon.type === 'sword') {
      px(ctx, 29, 8, 1, 2, 'rgba(255,255,255,0.70)');
      px(ctx, 28, 10, 1, 1, 'rgba(160,180,255,0.42)');
    } else if (unit.weapon.type === 'bow') {
      px(ctx, 29, 12, 1, 8, 'rgba(255,92,138,0.30)');
    }
  }

  function drawBoss(ctx, unit, art) {
    const gold = '#d8b86a';
    const goldDark = '#8f7138';
    const outline = '#0e0a17';
    const glow = art.eye || '#ff3f7f';

    // 身后的暗色披风，用阶梯边表现飘动。
    px(ctx, 5, 15, 3, 12, outline);
    px(ctx, 24, 14, 3, 13, outline);
    px(ctx, 6, 17, 2, 9, art.outfitDark);
    px(ctx, 24, 16, 2, 10, art.outfitDark);
    px(ctx, 4, 24, 4, 1, 'rgba(255,63,127,0.25)');
    px(ctx, 25, 25, 3, 1, 'rgba(255,63,127,0.20)');

    // 长袍：内衬、外层、金色滚边和衣褶。
    px(ctx, 7, 18, 19, 10, outline);
    px(ctx, 8, 18, 17, 9, art.outfit);
    px(ctx, 9, 19, 15, 7, art.outfitDark);
    px(ctx, 11, 19, 11, 1, 'rgba(255,255,255,0.06)');
    px(ctx, 12, 22, 8, 1, 'rgba(0,0,0,0.30)');
    px(ctx, 10, 24, 14, 1, goldDark);
    px(ctx, 9, 25, 15, 1, '#2a1f39');
    px(ctx, 9, 27, 5, 2, art.outfitDark);
    px(ctx, 18, 27, 5, 2, art.outfitDark);
    px(ctx, 7, 20, 2, 7, art.outfitDark);
    px(ctx, 24, 19, 2, 8, art.outfitDark);
    px(ctx, 8, 26, 3, 1, goldDark);
    px(ctx, 22, 26, 3, 1, goldDark);

    // 手臂与苍白的手。
    px(ctx, 6, 15, 4, 8, outline);
    px(ctx, 23, 15, 4, 8, outline);
    px(ctx, 7, 16, 2, 6, art.skin);
    px(ctx, 23, 16, 2, 6, art.skin);
    px(ctx, 7, 21, 3, 2, '#c7a8b8');
    px(ctx, 22, 21, 3, 2, '#c7a8b8');
    px(ctx, 8, 22, 1, 1, '#8e6b80');
    px(ctx, 24, 21, 1, 1, '#8e6b80');

    // 高领与胸前挂饰。
    px(ctx, 10, 13, 13, 3, outline);
    px(ctx, 11, 13, 11, 2, art.outfit);
    px(ctx, 12, 13, 9, 1, gold);
    px(ctx, 15, 14, 3, 3, '#3a274d');
    px(ctx, 16, 14, 1, 3, gold);
    px(ctx, 15, 17, 3, 1, gold);
    px(ctx, 16, 18, 1, 2, glow);

    // 面具：左右不对称的裂纹与金色边缘。
    px(ctx, 10, 6, 13, 9, outline);
    px(ctx, 11, 7, 11, 7, art.skin);
    px(ctx, 12, 8, 9, 5, '#261b37');
    px(ctx, 12, 9, 9, 1, 'rgba(255,255,255,0.10)');
    px(ctx, 13, 10, 2, 2, glow);
    px(ctx, 18, 10, 2, 2, glow);
    px(ctx, 13, 10, 1, 1, '#fff0f5');
    px(ctx, 18, 10, 1, 1, '#fff0f5');
    px(ctx, 17, 9, 1, 3, 'rgba(255,63,127,0.25)');
    px(ctx, 15, 12, 3, 1, '#120d1d');
    px(ctx, 20, 8, 1, 2, 'rgba(0,0,0,0.35)');
    px(ctx, 11, 12, 2, 1, 'rgba(0,0,0,0.30)');
    // 面具裂纹
    px(ctx, 14, 8, 1, 1, '#5d456e');
    px(ctx, 15, 9, 1, 1, '#5d456e');

    // 高帽 / 指挥家发冠。
    px(ctx, 9, 4, 14, 3, art.hairDark);
    px(ctx, 8, 3, 16, 2, art.outfitDark);
    px(ctx, 10, 2, 12, 2, outline);
    px(ctx, 12, 0, 3, 3, goldDark);
    px(ctx, 17, 0, 2, 3, gold);
    px(ctx, 21, 2, 1, 2, goldDark);
    px(ctx, 8, 5, 3, 2, art.outfitDark);
    px(ctx, 22, 4, 2, 3, art.outfitDark);
    px(ctx, 13, 1, 1, 1, glow);

    // 指挥棒：从手边伸向顶部的细长金色线条。
    px(ctx, 26, 4, 1, 20, '#efe5cd');
    px(ctx, 25, 3, 2, 2, gold);
    px(ctx, 27, 3, 1, 1, '#fff5d8');
    px(ctx, 26, 24, 2, 2, art.outfitDark);
    px(ctx, 25, 22, 2, 2, art.accent);
    px(ctx, 28, 8, 1, 2, 'rgba(255,255,255,0.24)');
  }

  /**
   * 48×48 原生“FE if 风”地图小人。
   * 与 32×32 立绘/战斗图分开绘制，避免 32px 放大后的方块感：
   * 大头、长发/披风、独立手脚、较大的眼睛和更清晰的武器轮廓。
   *
   * 每帧重画上百个像素块成本太高，因此先把每个单位烘焙到 48×48
   * 离屏 Canvas，地图循环中只做一次 drawImage，缩放再交给上层。
   */
  const chibiCache = new Map();

  function buildIfChibi(unit) {
    const cv = document.createElement('canvas');
    cv.width = 48;
    cv.height = 48;
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    const art = unit.art || {};
    const type = unit.weapon ? unit.weapon.type : 'sword';
    if (art.kind === 'shadow') drawIfShadow(c, unit, art, type);
    else if (art.kind === 'boss') drawIfBoss(c, unit, art, type);
    else drawIfHero(c, unit, art, type);
    return cv;
  }

  function drawIfChibi(ctx, unit, x, y, size, opts) {
    const opt = opts || {};
    const s = size || 48;
    const key = unit.id || unit.artKey || 'unit';
    let sprite = chibiCache.get(key);
    if (!sprite) {
      sprite = buildIfChibi(unit);
      chibiCache.set(key, sprite);
    }
    const bob = opt.static || opt.portrait ? 0 : (opt.bob || 0);

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    // 接地的椭圆阴影，先画在地图坐标上，不参与敌人的水平翻转。
    if (!opt.portrait) {
      const shW = Math.max(12, Math.round(s * 0.64));
      const shX = x + (s - shW) / 2;
      const shY = y + s - 3;
      ctx.globalAlpha = 0.32;
      ctx.fillStyle = '#000000';
      ctx.fillRect(shX, shY, shW, 2);
      ctx.fillRect(shX + 4, shY - 1, Math.max(2, shW - 8), 1);
      ctx.globalAlpha = 1;
    }

    if (unit.side === 'enemy' && !opt.noFlip) {
      ctx.translate(x + s, y + bob);
      ctx.scale(-1, 1);
      ctx.drawImage(sprite, 0, 0, 48, 48, 0, 0, s, s);
    } else {
      ctx.drawImage(sprite, 0, 0, 48, 48, x, y + bob, s, s);
    }
    ctx.restore();
  }


  function drawIfCape(ctx, art, type) {
    const c = art.accent;
    const d = art.outfitDark;
    // 先画披风/外套下摆，身体压在上面，形成 FE 风的背面层次。
    if (type === 'sword') {
      px(ctx, 28, 24, 9, 18, d);
      px(ctx, 29, 25, 7, 15, c);
      px(ctx, 33, 28, 2, 10, art.outfit);
      px(ctx, 30, 41, 5, 2, d);
    } else if (type === 'axe') {
      px(ctx, 10, 24, 10, 19, d);
      px(ctx, 11, 25, 7, 15, c);
      px(ctx, 12, 40, 6, 3, d);
      px(ctx, 30, 25, 7, 17, d);
      px(ctx, 31, 26, 4, 13, c);
    } else if (type === 'lance') {
      px(ctx, 9, 23, 9, 21, d);
      px(ctx, 10, 24, 6, 17, c);
      px(ctx, 31, 23, 9, 21, d);
      px(ctx, 32, 24, 6, 17, c);
      px(ctx, 12, 43, 4, 2, art.outfit);
      px(ctx, 32, 43, 4, 2, art.outfit);
    } else if (type === 'bow') {
      px(ctx, 11, 25, 8, 18, d);
      px(ctx, 12, 26, 5, 14, c);
      px(ctx, 14, 40, 3, 2, art.hairDark);
    } else {
      px(ctx, 10, 23, 10, 22, d);
      px(ctx, 11, 24, 7, 19, c);
      px(ctx, 31, 23, 9, 22, d);
      px(ctx, 32, 24, 6, 19, c);
      px(ctx, 12, 43, 5, 2, art.outfit);
      px(ctx, 32, 43, 4, 2, art.outfit);
    }
  }

  function drawIfHairBack(ctx, art) {
    const h = art.hair;
    const d = art.hairDark;
    const style = art.hairStyle;
    // 后发轮廓先铺深色，再用亮色收一层，形状更有体积。
    if (style === 'long') {
      px(ctx, 13, 6, 23, 27, d);
      px(ctx, 14, 7, 21, 22, h);
      px(ctx, 13, 27, 5, 8, d);
      px(ctx, 31, 27, 5, 9, d);
      px(ctx, 15, 12, 3, 18, h);
      px(ctx, 30, 13, 3, 17, h);
    } else if (style === 'ponytail') {
      px(ctx, 14, 6, 20, 19, d);
      px(ctx, 15, 7, 18, 16, h);
      px(ctx, 33, 8, 8, 4, d);
      px(ctx, 35, 10, 7, 13, d);
      px(ctx, 36, 11, 5, 10, h);
    } else if (style === 'bob') {
      px(ctx, 14, 6, 21, 22, d);
      px(ctx, 15, 7, 19, 19, h);
      px(ctx, 13, 18, 4, 10, d);
      px(ctx, 32, 18, 4, 10, d);
    } else if (style === 'messy') {
      px(ctx, 13, 6, 23, 19, d);
      px(ctx, 14, 7, 21, 16, h);
      px(ctx, 12, 9, 4, 5, d);
      px(ctx, 34, 8, 4, 7, d);
      px(ctx, 10, 14, 4, 4, d);
    } else {
      px(ctx, 14, 6, 20, 18, d);
      px(ctx, 15, 7, 18, 15, h);
      px(ctx, 13, 15, 3, 5, d);
      px(ctx, 33, 14, 3, 5, d);
    }
  }

  function drawIfFace(ctx, art) {
    const skin = art.skin;
    const eye = art.eye;
    const dark = '#2a1c2b';
    // 头、耳朵、脖子：头部略大，接近 FE if 小人比例。
    px(ctx, 16, 9, 18, 15, skin);
    px(ctx, 15, 13, 2, 5, skin);
    px(ctx, 33, 13, 2, 5, skin);
    px(ctx, 22, 23, 5, 3, skin);
    px(ctx, 17, 10, 16, 2, '#f8e2d6');
    // 眼白、瞳孔与高光。
    px(ctx, 18, 15, 5, 4, '#fff8f4');
    px(ctx, 27, 15, 5, 4, '#fff8f4');
    px(ctx, 20, 16, 2, 3, eye);
    px(ctx, 29, 16, 2, 3, eye);
    px(ctx, 20, 16, 1, 1, '#ffffff');
    px(ctx, 29, 16, 1, 1, '#ffffff');
    px(ctx, 19, 14, 4, 1, dark);
    px(ctx, 27, 14, 4, 1, dark);
    // 腮红、鼻尖、嘴。
    ctx.globalAlpha = 0.35;
    px(ctx, 18, 19, 2, 1, art.accent);
    px(ctx, 30, 19, 2, 1, art.accent);
    ctx.globalAlpha = 1;
    px(ctx, 24, 19, 2, 1, '#c98f85');
    px(ctx, 24, 21, 3, 1, '#8c4b59');
  }

  function drawIfHairFront(ctx, art) {
    const h = art.hair;
    const d = art.hairDark;
    const style = art.hairStyle;
    px(ctx, 16, 5, 18, 6, d);
    px(ctx, 17, 6, 16, 4, h);
    if (style === 'long') {
      px(ctx, 18, 9, 5, 5, h);
      px(ctx, 27, 9, 5, 7, h);
      px(ctx, 17, 9, 2, 12, d);
      px(ctx, 31, 9, 2, 12, d);
      px(ctx, 33, 10, 2, 4, h);
    } else if (style === 'bob') {
      px(ctx, 18, 9, 4, 5, h);
      px(ctx, 23, 9, 3, 4, h);
      px(ctx, 28, 9, 4, 6, h);
      px(ctx, 17, 9, 2, 9, d);
      px(ctx, 32, 9, 2, 9, d);
    } else if (style === 'messy') {
      px(ctx, 17, 8, 4, 4, h);
      px(ctx, 22, 8, 3, 6, h);
      px(ctx, 26, 8, 5, 4, h);
      px(ctx, 31, 10, 2, 5, d);
      px(ctx, 18, 7, 3, 2, d);
    } else if (style === 'ponytail') {
      px(ctx, 18, 9, 4, 5, h);
      px(ctx, 28, 8, 5, 4, h);
      px(ctx, 33, 8, 3, 3, d);
    } else {
      px(ctx, 17, 9, 4, 5, h);
      px(ctx, 24, 8, 4, 4, h);
      px(ctx, 30, 9, 3, 4, h);
      px(ctx, 16, 10, 2, 6, d);
    }
    // 发丝高光，避免头发成为单色块。
    px(ctx, 19, 7, 6, 1, art.hair === '#2c2733' ? '#51475c' : 'rgba(255,255,255,0.45)');
    px(ctx, 26, 8, 3, 1, art.hair === '#2c2733' ? '#3d3445' : 'rgba(255,255,255,0.28)');
  }

  function drawIfBody(ctx, unit, art) {
    const o = art.outfit;
    const d = art.outfitDark;
    const a = art.accent;
    const skin = art.skin;
    const gold = '#d7b66b';

    // 肩线、手臂、手。
    px(ctx, 13, 25, 5, 12, d);
    px(ctx, 14, 26, 3, 9, o);
    px(ctx, 32, 25, 5, 12, d);
    px(ctx, 33, 26, 3, 9, o);
    px(ctx, 12, 33, 5, 4, skin);
    px(ctx, 33, 33, 5, 4, skin);
    px(ctx, 14, 24, 20, 3, a);
    // 躯干、衣摆、腰带。
    px(ctx, 16, 25, 17, 13, d);
    px(ctx, 17, 26, 15, 10, o);
    px(ctx, 20, 27, 9, 1, a);
    px(ctx, 17, 34, 15, 3, a);
    px(ctx, 18, 35, 13, 1, gold);
    px(ctx, 15, 36, 19, 8, d);
    px(ctx, 16, 36, 17, 6, o);
    px(ctx, 17, 40, 4, 3, a);
    px(ctx, 27, 40, 4, 3, a);
    // 腿与靴子，留出中间空隙。
    px(ctx, 18, 42, 5, 5, d);
    px(ctx, 26, 42, 5, 5, d);
    px(ctx, 18, 46, 4, 1, '#0c0b12');
    px(ctx, 27, 46, 4, 1, '#0c0b12');
    px(ctx, 19, 43, 3, 1, art.accent);
    px(ctx, 27, 43, 3, 1, art.accent);
  }

  function drawIfWeapon(ctx, unit, art, type) {
    const a = art.accent;
    const steel = '#e8edf5';
    const shade = '#8f9aad';
    if (type === 'sword') {
      px(ctx, 36, 16, 2, 15, steel);
      px(ctx, 35, 16, 1, 14, '#ffffff');
      px(ctx, 38, 18, 1, 13, shade);
      px(ctx, 35, 29, 5, 2, '#d8b868');
      px(ctx, 36, 30, 2, 4, '#76533f');
      px(ctx, 35, 34, 3, 1, a);
    } else if (type === 'axe') {
      px(ctx, 34, 16, 2, 22, '#7d5137');
      px(ctx, 35, 17, 1, 20, '#b47b4e');
      px(ctx, 35, 15, 7, 6, steel);
      px(ctx, 35, 15, 6, 1, '#ffffff');
      px(ctx, 41, 17, 2, 3, shade);
      px(ctx, 33, 19, 2, 1, a);
    } else if (type === 'lance') {
      px(ctx, 37, 7, 2, 30, '#9a7549');
      px(ctx, 36, 6, 1, 28, '#d1aa70');
      px(ctx, 38, 8, 1, 27, '#6d4a2f');
      px(ctx, 36, 3, 3, 5, steel);
      px(ctx, 37, 1, 1, 3, '#ffffff');
      px(ctx, 35, 6, 5, 1, a);
    } else if (type === 'bow') {
      px(ctx, 37, 13, 2, 5, '#a8754b');
      px(ctx, 39, 15, 2, 4, '#d3a268');
      px(ctx, 40, 18, 1, 10, '#d3a268');
      px(ctx, 39, 27, 2, 4, '#a8754b');
      px(ctx, 37, 17, 1, 12, '#e7d7b1');
      px(ctx, 37, 22, 10, 1, '#f0e1ba');
      px(ctx, 47, 22, 2, 1, '#ffffff');
      px(ctx, 38, 21, 2, 2, a);
    } else {
      // 魔导书：悬浮的小书与元素色书页。
      px(ctx, 34, 25, 10, 9, art.outfitDark);
      px(ctx, 35, 26, 8, 7, '#efe6cf');
      px(ctx, 36, 27, 3, 5, a);
      px(ctx, 40, 27, 2, 5, '#b79cff');
      px(ctx, 36, 26, 7, 1, '#ffffff');
      px(ctx, 34, 33, 10, 1, art.accent);
      px(ctx, 36, 21, 2, 2, '#ffffff');
      px(ctx, 42, 23, 1, 1, a);
    }
  }

  function drawIfHero(ctx, unit, art, type) {
    drawIfCape(ctx, art, type);
    drawIfHairBack(ctx, art);
    drawIfBody(ctx, unit, art);
    drawIfWeapon(ctx, unit, art, type);
    drawIfFace(ctx, art);
    drawIfHairFront(ctx, art);
    // 剑士的肩甲 / 弓手的胸前带 / 法师的领饰。
    if (type === 'sword') {
      px(ctx, 32, 24, 6, 3, '#e9e1d1');
      px(ctx, 34, 25, 3, 1, art.accent);
    } else if (type === 'bow') {
      px(ctx, 18, 26, 2, 9, '#d6b382');
      px(ctx, 27, 27, 1, 7, '#d6b382');
    } else if (type === 'tome') {
      px(ctx, 21, 24, 7, 3, art.accent);
      px(ctx, 23, 25, 3, 1, '#fff5dd');
    }
  }

  function drawIfShadow(ctx, unit, art, type) {
    const o = art.outfit;
    const d = art.outfitDark;
    const a = art.accent;
    // 斗篷下摆的破碎布条。
    for (let i = 0; i < 6; i++) {
      const bx = 10 + i * 5;
      px(ctx, bx, 28 + (i % 2) * 3, 4, 15 - (i % 3) * 3, d);
      px(ctx, bx + 1, 29 + (i % 2) * 3, 2, 11 - (i % 3) * 2, o);
    }
    // 兜帽、阴影脸与发光眼睛。
    px(ctx, 14, 5, 21, 22, '#0b0811');
    px(ctx, 15, 6, 19, 19, d);
    px(ctx, 16, 8, 17, 15, '#08060d');
    px(ctx, 17, 11, 4, 2, art.eye);
    px(ctx, 27, 11, 4, 2, art.eye);
    px(ctx, 18, 11, 2, 1, '#ffffff');
    px(ctx, 27, 11, 2, 1, '#ffffff');
    px(ctx, 13, 8, 4, 3, a);
    px(ctx, 31, 7, 3, 5, a);
    px(ctx, 14, 23, 21, 16, d);
    px(ctx, 17, 25, 15, 11, o);
    px(ctx, 22, 27, 5, 2, a);
    // 手臂与底边破布。
    px(ctx, 11, 25, 4, 12, '#0b0811');
    px(ctx, 34, 25, 4, 12, '#0b0811');
    px(ctx, 12, 35, 3, 2, a);
    px(ctx, 34, 35, 3, 2, a);
    drawIfWeapon(ctx, unit, { ...art, accent: a }, type);
    // 细小魂火。
    px(ctx, 9, 22, 1, 1, a);
    px(ctx, 38, 18, 1, 1, a);
    px(ctx, 6, 32, 1, 1, 'rgba(180,160,255,0.8)');
  }

  function drawIfBoss(ctx, unit, art, type) {
    const a = art.accent;
    // 长披风与金边。
    px(ctx, 8, 20, 32, 26, art.outfitDark);
    px(ctx, 9, 22, 30, 22, art.outfit);
    px(ctx, 10, 42, 28, 2, '#b28b45');
    px(ctx, 12, 25, 3, 16, a);
    px(ctx, 34, 25, 3, 16, a);
    // 高领与手臂。
    px(ctx, 15, 14, 19, 17, '#0b0811');
    px(ctx, 17, 16, 15, 14, art.outfitDark);
    px(ctx, 13, 26, 5, 10, art.outfit);
    px(ctx, 31, 26, 5, 10, art.outfit);
    // 面具与指挥冠。
    px(ctx, 18, 3, 13, 13, '#efe7dc');
    px(ctx, 19, 4, 11, 11, '#f7f0e8');
    px(ctx, 21, 8, 3, 2, a);
    px(ctx, 26, 8, 3, 2, a);
    px(ctx, 23, 12, 4, 1, '#b9a5c9');
    px(ctx, 18, 1, 2, 4, '#d7b66b');
    px(ctx, 22, 0, 2, 5, '#d7b66b');
    px(ctx, 27, 1, 2, 4, '#d7b66b');
    // 指挥棒。
    px(ctx, 35, 5, 2, 34, '#efe5cd');
    px(ctx, 33, 3, 6, 2, '#d7b66b');
    px(ctx, 34, 1, 4, 2, '#fff5d8');
    px(ctx, 35, 38, 3, 3, a);
  }


  function defaultDrawUnit(ctx, unit, x, y, size, opts) {
    const opt = opts || {};
    const s = size || 32;
    // 地图使用 48px 原生 FE if 风小人；头像/战斗仍使用 32→96 的立绘比例。
    if (opt.chibi && s >= 44) {
      drawIfChibi(ctx, unit, x, y, s, opt);
      return;
    }
    const art = unit.art || {
      kind: 'hero',
      hair: '#d8cfd6',
      hairDark: '#8d8392',
      hairStyle: 'bob',
      outfit: '#2d3147',
      outfitDark: '#1b1d2c',
      accent: '#ff8fbd',
      skin: '#f4cfc0',
      eye: '#6d4d75'
    };
    const isEnemy = unit.side === 'enemy';
    const flip = isEnemy && !opt.noFlip;

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    // 阴影不跟随翻转；尺寸跟随 s，地图 48px 与头像 96px 都不会悬空。
    if (!opt.portrait) {
      const shW = Math.max(10, Math.round(s * 0.62));
      const shX = x + (s - shW) / 2;
      const shY = y + s - Math.max(2, Math.round(s * 0.07));
      ctx.globalAlpha = 0.34;
      ctx.fillStyle = '#000000';
      ctx.fillRect(shX, shY, shW, 2);
      ctx.fillRect(shX + 4, shY - 1, Math.max(2, shW - 8), 1);
      ctx.globalAlpha = 1;
    }

    const bob = opt.portrait || opt.static ? 0 : (opt.bob ? opt.bob : 0);
    if (flip) {
      ctx.translate(x + s, y + bob);
      ctx.scale(-1, 1);
    } else {
      ctx.translate(x, y + bob);
    }
    ctx.scale(s / 32, s / 32);

    if (art.kind === 'shadow') {
      drawShadow(ctx, unit, art);
    } else if (art.kind === 'boss') {
      drawBoss(ctx, unit, art);
    } else {
      drawHeroCape(ctx, unit, art);
      drawHeroHairBack(ctx, art);
      drawHeroBody(ctx, unit, art, 1);
    }

    // Boss / 影子的武器可能被身体遮挡，再补一次前景轮廓
    if (art.kind !== 'hero' && unit.weapon.type === 'tome') {
      px(ctx, 27, 20, 2, 2, art.accent);
    }

    ctx.restore();
  }

  /**
   * 绘制单位。默认朝右，敌方自动镜像朝左。
   * opts: {portrait, noFlip, static, bob}
   */
  function drawUnit(ctx, unit, x, y, size, opts) {
    const custom = unitDrawers[unit.id] || unitDrawers[unit.artKey];
    if (custom) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      custom(ctx, x, y, size || 32, unit, opts || {});
      ctx.restore();
      return;
    }
    defaultDrawUnit(ctx, unit, x, y, size, opts);
  }

  /* ---------------- 素材包接口 ---------------- */

  /**
   * 注册素材包。示例：
   * MyGO.Assets.registerPack({
   *   terrain: { forest: (ctx,x,y,size,info)=>ctx.drawImage(img, x,y,size,size) },
   *   units: { tomori: (ctx,x,y,size,unit)=>... }
   * });
   * 可只覆盖部分 id；未覆盖的继续使用程序化占位图。
   */
  function registerPack(pack) {
    if (!pack || typeof pack !== 'object') throw new Error('素材包格式无效');
    installedPack = pack;
    if (pack.terrain) {
      for (const [id, fn] of Object.entries(pack.terrain)) {
        if (typeof fn === 'function') customTerrainDrawers[id] = fn;
      }
    }
    if (pack.units) {
      for (const [id, fn] of Object.entries(pack.units)) {
        if (typeof fn === 'function') unitDrawers[id] = fn;
      }
    }
    return true;
  }

  /** 生成一个把图片绘制到目标格的函数；图片由调用方加载，不在本项目内绑定路径。 */
  function fromImage(image, crop) {
    return function (ctx, x, y, size, unit, info) {
      if (!image) return;
      const c = crop || { sx: 0, sy: 0, sw: 32, sh: 32 };
      ctx.drawImage(image, c.sx, c.sy, c.sw, c.sh, x, y, size, size);
    };
  }

  function resetPack() {
    installedPack = null;
    // 只清掉外部注册的覆盖项；内置画笔始终保留。
    for (const key of Object.keys(customTerrainDrawers)) delete customTerrainDrawers[key];
    for (const key of Object.keys(unitDrawers)) delete unitDrawers[key];
  }

  MyGO.Assets = {
    drawTerrain,
    drawDecor,
    drawGateTile,
    drawGateSprite,
    gateSpriteReady,
    drawUnit,
    loadTerrain,
    mapBackgroundReady,
    drawMapBackground,
    terrainReady,
    decorReady,
    registerPack,
    resetPack,
    fromImage,
    get installedPack() {
      return installedPack;
    },
    TERRAIN: T
  };
})(window);
