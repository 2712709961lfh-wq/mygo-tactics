/* Regression checks for returning from title and cancelling a cinematic fade. */
'use strict';
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),{pathToFileURL}=require('url'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{for(const file of ['index.html','standalone.html']){
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.join(root,file)).href);await page.waitForFunction(()=>window.MYGO_ENTRY&&MyGO.Characters.has('nijika'));
  const loadUnplayedVictory=()=>page.evaluate(()=>{
   const g=new MyGO.Game({stage:7,recruited:['xueyue','nina'],seed:77});g.joinNijika();
   for(const e of g.living('enemy')){e.hp=0;e.dead=true;}g.checkOutcome();
   const snapshot=g.serialize();delete snapshot.livehouseEndingShown;
   MYGO_UI.loadSnapshot({snapshot,savedAt:new Date().toISOString()});MYGO_ENTRY.hideToGame();
  });
  await loadUnplayedVictory();await page.waitForSelector('.live-ending');assert.equal(await page.locator('.live-ending').count(),1);
  await page.waitForTimeout(1900);
  await page.setViewportSize({width:430,height:932});await page.waitForTimeout(300);
  if(file==='index.html')await page.screenshot({path:path.join(root,'docs/previews/chapter-07-ending-mobile.png')});
  // Escape starts fade-out, then loading a different stage must cancel its timer.
  await page.keyboard.press('Escape');await page.evaluate(()=>{MYGO_UI.loadSnapshot({snapshot:new MyGO.Game({stage:1}).serialize(),savedAt:new Date().toISOString()});});
  await page.waitForTimeout(850);
  assert(await page.evaluate(()=>MYGO_UI.game.stage===1&&!MYGO_UI.endShown&&!MYGO_UI.chapterOpen&&!MYGO_UI.busy&&MYGO_UI.dom.chapterIntro.hidden&&MYGO_UI.dom.overlayRoot.hidden&&!MYGO_UI._livehouseEndingCancel));
  await page.setViewportSize({width:1440,height:1000});await loadUnplayedVictory();await page.waitForSelector('.live-ending');assert.equal(await page.locator('.live-ending').count(),1);
  const positions=await page.evaluate(()=>JSON.stringify(MYGO_UI.game.serialize().units));
  await page.locator('[data-live-ending-skip]').click();await page.waitForSelector('[data-end-restart]');
  assert.equal(await page.evaluate(()=>JSON.stringify(MYGO_UI.game.serialize().units)),positions);assert(await page.evaluate(()=>MYGO_UI.game.livehouseEndingShown&&MYGO_UI.dom.chapterIntro.hidden&&!MYGO_UI.chapterOpen));
  await page.evaluate(()=>{MYGO_UI.loadSnapshot({snapshot:MYGO_UI.game.serialize(),savedAt:new Date().toISOString()});MYGO_ENTRY.hideToGame();});
  await page.waitForSelector('[data-end-restart]');assert.equal(await page.locator('.live-ending').count(),0);assert.deepEqual(errors,[]);
  assert((await page.locator('[data-game-version]').innerText()).includes(JSON.parse(fs.readFileSync(path.join(root,'version.json'),'utf8')).version));
  await page.close();console.log(file+': title return without duplicate scene, narrow screen, Esc, fade cancellation, position restoration, old/watched victory saves passed.');
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
