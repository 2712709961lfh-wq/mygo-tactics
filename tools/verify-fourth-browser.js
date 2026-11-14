/* Actual browser checks for chapter 4, with a fresh browser profile and no user saves. */
'use strict';
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),shots=path.join(root,'docs/previews');
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'')||'index.html');
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(err,bytes)=>{if(err){res.writeHead(404).end();return;}
    res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg'})[path.extname(file)]||'application/octet-stream');res.end(bytes);});
});
async function clickCell(page,x,y){
  const point=await page.evaluate(({x,y})=>{
    const ui=MYGO_UI,p=MyGO.MapProjection.project(ui.renderer.projection,(x+.5)*32,(y+.5)*32),r=ui.dom.board.getBoundingClientRect();
    const shell=document.getElementById('game-shell');
    if(shell.dataset.rotated==='true')return {x:r.right-p.y/ui.renderer.logicalHeight*r.width,y:r.top+p.x/ui.renderer.logicalWidth*r.height};
    return {x:r.left+p.x/ui.renderer.logicalWidth*r.width,y:r.top+p.y/ui.renderer.logicalHeight*r.height};
  },{x,y});await page.mouse.click(point.x,point.y);
}
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:'msedge'});
  try{
    for(const name of ['index.html','standalone.html']){
      const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],missing=[];
      page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)missing.push(r.url());});
      if(name==='standalone.html')await page.route('**/*',r=>r.request().url()===base+'/'+name?r.continue():r.abort());
      await page.goto(base+'/'+name);await page.waitForFunction(()=>window.MYGO_ENTRY);
      await page.locator('[data-entry-action="chapter4"]').click();
      await page.waitForFunction(()=>MYGO_UI.chapterOpen&&MYGO_UI.game.stage===4);
      assert.equal(await page.evaluate(()=>MYGO_UI.game.litLamps.length),0);
      if(name==='index.html'){
        await page.waitForFunction(()=>document.querySelector('.park-opening')?.dataset.beat==='1');
        assert((await page.locator('.park-opening-caption').innerText()).includes('欧内该，瓦达西......'));
        await page.screenshot({path:path.join(shots,'chapter-04-opening-voice.png')});
        await page.waitForFunction(()=>document.querySelector('.park-opening')?.dataset.beat==='3');
        await page.waitForTimeout(1300);
        assert.equal(await page.evaluate(()=>MYGO_UI.game.parkIntroLights),false);
        await page.screenshot({path:path.join(shots,'chapter-04-opening-memory.png')});
        await page.waitForFunction(()=>!MYGO_UI.chapterOpen);
      }else{
        await page.keyboard.press('Enter');await page.waitForFunction(()=>!MYGO_UI.chapterOpen);
      }
      await page.waitForFunction(()=>document.getElementById('chapter-intro').hidden);
      await page.waitForTimeout(1800);
      assert(await page.evaluate(()=>MYGO_UI.game.units.filter(u=>u.side==='player').every(u=>!u._walking&&!u.acted)));
      assert.equal(await page.evaluate(()=>MYGO_UI.game.parkIntroLights),undefined);
      const before=await page.locator('#info-name').innerText();await clickCell(page,36,10);
      assert.equal(await page.locator('#info-name').innerText(),before);
      await page.locator('[data-party-id="tomori"]').click();await clickCell(page,6,12);
      await page.waitForFunction(()=>MYGO_UI.mode==='action'&&!MYGO_UI.busy);
      assert.deepEqual(await page.evaluate(()=>({x:MYGO_UI.game.getUnit('tomori').x,y:MYGO_UI.game.getUnit('tomori').y})),{x:6,y:12});
      await page.screenshot({path:path.join(shots,'chapter-04-browser-action.png')});
      const light=page.getByRole('button',{name:/^点亮路灯 · 入口步道/});await light.click();
      assert.equal(await page.evaluate(()=>MYGO_UI.game.litLamps.length),1);
      assert(await page.evaluate(()=>MYGO_UI.game.getUnit('tomori').acted));
      assert((await page.locator('#objective-text').innerText()).includes('东北方向'));
      assert(await page.evaluate(()=>MYGO_UI.game.isVisible(11,12)));
      // Save/restore through the actual UI, using its in-memory save manager.
      const restored=await page.evaluate(()=>{
        const ui=MYGO_UI;let data;ui.saveManager={save:g=>{data=JSON.parse(JSON.stringify(g.serialize()));return {ok:true,savedAt:new Date().toISOString()};},hasSave:()=>!!data};
        ui.saveGame();const snap=JSON.parse(JSON.stringify(data));ui.game.litLamps=[];
        ui.loadSnapshot({snapshot:snap,savedAt:new Date().toISOString()});return ui.game.litLamps;
      });assert.deepEqual(restored,['park-entry']);
      if(name==='index.html')await page.screenshot({path:path.join(shots,'chapter-04-browser-first-light.png')});
      // Reveal the boss for art and real combat pose verification, retaining the rule state.
      await page.evaluate(()=>{const ui=MYGO_UI;ui.game.litLamps=ui.game.mission.lamps.map(l=>l.id);ui.game.refreshParkDiscovery();
        ui.updateAll();ui.inspectUnit(ui.game.getUnit('dark_soyo'));});
      assert((await page.locator('#info-name').innerText()).includes('往日之影长崎爽世'));
      if(name==='index.html')await page.screenshot({path:path.join(shots,'chapter-04-browser-boss.png')});
      // Exercise the production battle scene using the boss as caster and as target.
      await page.evaluate(()=>{
        const ui=MYGO_UI,b=ui.game.getUnit('dark_soyo'),s=ui.game.getUnit('soyo');
        ui.game.setUnitPosition('soyo',35,11);ui.renderer.snapUnit(s);
        const result=ui.game.rollCombat(b,s);
        window.__parkBattlePreviewDone=false;
        ui.showCutin(b,s,result.strikes[0],{freezeAt:.52}).then(()=>{window.__parkBattlePreviewDone=true;});
      });
      await page.waitForFunction(()=>MYGO_UI.battle.running);
      assert.equal(await page.locator('.bs-chapter span').innerText(),'MISSION 04');
      assert.equal(await page.locator('.bs-chapter b').innerText(),'飞鸟山公园的往日之影');
      await page.waitForTimeout(400);
      if(name==='index.html')await page.screenshot({path:path.join(shots,'chapter-04-browser-battle.png')});
      await page.evaluate(()=>MYGO_UI.battle.skip());await page.waitForFunction(()=>window.__parkBattlePreviewDone);
      // The real attack, result confirmation, growth report and victory chain.
      await page.evaluate(()=>{
        const ui=MYGO_UI,s=ui.game.getUnit('soyo'),b=ui.game.getUnit('dark_soyo');
        b.hp=1;s.mag=60;s.dex=100;ui.selectUnit(s);ui.enterActionMode();ui.enterAttackMode();
      });
      await clickCell(page,36,10);
      await page.waitForFunction(()=>MYGO_UI.confirmHandler&&document.querySelector('.exchange-card'));
      await page.locator('[data-confirm]').click();
      await page.waitForFunction(()=>!!document.querySelector('.growth-modal'));
      assert((await page.locator('.growth-modal').innerText()).includes('经验 +'));
      await page.locator('[data-confirm]').click();
      await page.waitForFunction(()=>MYGO_UI.game.phase==='victory'&&MYGO_UI.endShown);
      assert(await page.evaluate(()=>MYGO_UI.game.soyoBossBonus));
      assert((await page.locator('#overlay-card').innerText()).includes('已获得双倍击破经验'));
      await page.waitForTimeout(500);
      if(name==='index.html')await page.screenshot({path:path.join(shots,'chapter-04-browser-victory.png')});
      // Landscape portrait handling and skip cleanup on a smaller viewport.
      if(name==='index.html'){
        await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{const ui=MYGO_UI;ui.newGame(46,4);ui.playChapterIntro();});
        await page.waitForFunction(()=>MYGO_UI.chapterOpen);await page.keyboard.press('Escape');
        await page.waitForFunction(()=>document.getElementById('chapter-intro').hidden);
        await page.screenshot({path:path.join(shots,'chapter-04-mobile.png')});
        assert.equal(await page.evaluate(()=>MYGO_UI.game.litLamps.length),0);
      }
      assert.deepEqual(errors,[],name);assert.deepEqual(missing,[],name);
      console.log(name+': PASS (entry, intro, subtitles, blackout, skip, fog picking, movement, lamp action, guide, save/restore, boss combat, double-EXP victory'+(name==='standalone.html'?', network disabled':', mobile')+')');
      await page.close();
    }
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
