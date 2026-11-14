/* ============================================================
 * main.js — 页面入口
 *
 * 所有模块均使用普通 <script> 加载，因此 index.html 可以直接
 * 双击打开（file://），不需要本地服务器或打包工具。
 * 控制台可通过 window.MYGO_UI 访问当前对局，便于调试。
 * ============================================================ */
(function (global) {
  'use strict';

  function start() {
    const params = new URLSearchParams(global.location.search);
    const hashParams = new URLSearchParams(global.location.hash.replace(/^#/, ''));
    const seed = params.get('seed') || hashParams.get('seed');
    const stage = Number(params.get('stage') || hashParams.get('stage')) === 2 ? 2 : 1;
    const ui = new global.MyGO.UI({ seed: seed ? Number(seed) : undefined, stage: stage });
    global.MYGO_UI = ui;
    global.MyGO.ui = ui;

    // 验收入口使用独立内存存档，保存、读取、删除都不会接触正式进度。
    const recruitDemo = params.get('recruit-demo') === '1';
    const mapDemo = params.get('map-demo') === '1';
    if (recruitDemo || mapDemo) {
      let saved = null;
      ui.saveManager = {
        save(game) { saved = { ok: true, snapshot: game.serialize(), savedAt: new Date().toISOString() };
          return { ok: true, savedAt: saved.savedAt }; },
        load() { return saved ? JSON.parse(JSON.stringify(saved)) : { ok: false, message: '演示尚未保存' }; },
        hasSave() { return !!saved; }, delete() { saved = null; return { ok: true }; }, storageType: 'memory'
      };
    }

    // 战斗演出调试入口（不写入存档、不影响正常对局）：
    //   index.html?battle-demo=1       播放一次普通攻击
    //   index.html?battle-demo=crit    播放一次暴击
    //   index.html?battle-demo=freeze  定格在命中瞬间，方便截图
    //   index.html?battle-demo=axe     斧劈砍 / lance 枪戳刺
    //   index.html?battle-demo=bow     弓射箭 / ice 冰魔法 / fire 火魔法
    const demo = params.get('battle-demo') || hashParams.get('battle-demo');
    if (demo) {
      global.setTimeout(() => ui.startBattleDemo(demo), 120);
    } else if (global.MyGO.EntryScreen && !global.__MYGO_SKIP_ENTRY__) {
      // 正常启动时先显示标题页；调试战斗演出时直接进入战场。
      try {
        const entry = new global.MyGO.EntryScreen(ui);
        global.MYGO_ENTRY = entry;
        global.MyGO.entry = entry;
        if (recruitDemo) ui.startRecruitDemo();
        else if (mapDemo) ui.startMapDemo();
        else entry.open({ force: true });
      } catch (err) {
        console.error('[MYGO] 进入页初始化失败', err);
        const box = document.createElement('pre');
        box.id = 'boot-error';
        box.style.cssText = 'position:fixed;left:16px;top:16px;z-index:999;max-width:90vw;padding:14px;background:#260b12;color:#ffb3c1;border:1px solid #ff6f8e;font:12px/1.5 monospace;white-space:pre-wrap;';
        box.textContent = 'BOOT ERROR: ' + err.message + '\n' + (err.stack || '');
        document.body.appendChild(box);
      }
    }
  }

  function boot() {
    // 先预加载角色图集与豆包地图贴图；任何一组加载失败也继续启动，
    // 渲染层会自动回退到程序化棋子 / 程序化地形，避免卡在加载页。
    const tasks = [];
    const chars = global.MyGO && global.MyGO.Characters;
    if (chars && typeof chars.load === 'function') {
      tasks.push(chars.load());
    }
    const assets = global.MyGO && global.MyGO.Assets;
    if (assets && typeof assets.loadTerrain === 'function') {
      tasks.push(assets.loadTerrain());
    }
    if (global.MyGO.GardenMap) tasks.push(global.MyGO.GardenMap.load());
    if (global.MyGO.MoonMap) tasks.push(global.MyGO.MoonMap.load());
    if (tasks.length) {
      Promise.all(tasks).then(start, start);
      return;
    }
    start();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})(window);
