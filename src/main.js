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
    const stageParam = Number(params.get('stage') || hashParams.get('stage'));
    const stage = [2,3,4,5,6,7,8,9,10].includes(stageParam) ? stageParam : 1;
    const ui = new global.MyGO.UI({ seed: seed ? Number(seed) : undefined, stage: stage });
    global.MYGO_UI = ui;
    global.MyGO.ui = ui;

    // 验收入口使用独立内存存档，保存、读取、删除都不会接触正式进度。
    const recruitDemo = params.get('recruit-demo') === '1';
    const mapDemo = params.get('map-demo') === '1';
    const counterDemo = params.get('counter-demo');
    const inventoryDemo = params.get('inventory-demo') === '1';
    const growthDemo = params.get('growth-demo');
    const talentDemo = params.get('talent-demo');
    if (recruitDemo || mapDemo || counterDemo || inventoryDemo || growthDemo || talentDemo) {
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
        if (inventoryDemo || growthDemo || talentDemo) {
          // Isolated, deterministic fixture for checking inventory and support UI.
          ui.chapterPlayed=true;
          const soyo=ui.game.getUnit('soyo'),tomori=ui.game.getUnit('tomori');
          Object.assign(soyo,{x:7,y:13});Object.assign(tomori,{x:8,y:13,hp:10});
          ui.game.units.filter(u=>u.side==='player'&&!['soyo','tomori'].includes(u.id)).forEach((u,n)=>Object.assign(u,{x:6,y:12+n}));
          for(const unit of ui.game.units)ui.renderer.snapUnit(unit);
          ui.updateAll();entry.open({force:true});
          if(talentDemo){
            const id=global.MyGO.Talents.get(talentDemo)?talentDemo:'tomori';
            const member=ui.game.getUnit(id)||tomori;
            if(member.side!=='player')member.side='player';
            const requested=Number(params.get('talent-level')||15);
            const target=Number.isInteger(requested)&&requested>=1&&requested<=99?requested:15;
            while(member.level<target)global.MyGO.Growth.award(member,global.MyGO.Growth.required(member.level));
            ui.updateAll();entry.openFormation();entry.selectedUnitId=member.id;entry.loadoutTab='stats';entry.renderFormationList();entry.renderFormationDetail();
          }
          if(growthDemo){
            soyo.exp=global.MyGO.Growth.required(soyo.level)-1;
            entry.openFormation();entry.selectedUnitId='soyo';entry.loadoutTab='growth';entry.renderFormationList();entry.renderFormationDetail();
          }
        }
        else if (counterDemo) ui.startCounterDemo(counterDemo);
        else if (recruitDemo) ui.startRecruitDemo();
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
    if (global.MyGO.WatercourtArt) tasks.push(global.MyGO.WatercourtArt.load());
    if (global.MyGO.MaskedCourtArt) tasks.push(global.MyGO.MaskedCourtArt.load());
    if (global.MyGO.LivehouseArt) tasks.push(global.MyGO.LivehouseArt.load());
    if (global.MyGO.DarkSoyo) tasks.push(global.MyGO.DarkSoyo.load());
    if (global.MyGO.CombatVfx) tasks.push(global.MyGO.CombatVfx.load());
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
