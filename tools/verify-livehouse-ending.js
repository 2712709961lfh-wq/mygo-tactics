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
   // Victory is fought at the stage, with one companion still covering the rear.
   const places={nijika:[14,6],anon:[12,7],soyo:[16,7],tomori:[11,5],rana:[18,5],taki:[15,9],xueyue:[10,8],nina:[24,23]};
   for(const u of g.living('player')){const [x,y]=places[u.id];Object.assign(u,{x,y,facing:u.id==='nijika'?'down':'up',_walking:false,acted:true});}
   for(const e of g.living('enemy')){e.hp=0;e.dead=true;}g.checkOutcome();
   const snapshot=g.serialize();delete snapshot.livehouseEndingShown;
   MYGO_UI.loadSnapshot({snapshot,savedAt:new Date().toISOString()});MYGO_ENTRY.hideToGame();
  });
  await loadUnplayedVictory();await page.waitForSelector('.live-ending');assert.equal(await page.locator('.live-ending').count(),1);
  const expected=await page.evaluate(()=>MYGO_UI.game.living('player').map(u=>({id:u.id,x:u.x*32,y:u.y*32,facing:u.facing})));
  const assertNoRestaging=async()=>{
   const actual=await page.evaluate(()=>MYGO_UI.game.living('player').map(u=>{const v=MYGO_UI.renderer.visuals.get(u.id);return {id:u.id,x:v.px,y:v.py,facing:u.facing};}));
   assert.deepEqual(actual,expected,'cinematic must keep actual stage/rearguard positions and facing');
   assert.equal(await page.evaluate(()=>MYGO_UI.game.living('player').some(u=>u._walking)),false,'no re-entry walk animation');
  };
  await page.waitForTimeout(120);await assertNoRestaging();await page.waitForTimeout(1800);await assertNoRestaging();
  for(let i=1;i<=4;i++){await page.keyboard.press('Enter');await page.waitForSelector('.live-ending[data-ending-page="'+i+'"]');await assertNoRestaging();}
  await page.waitForTimeout(750);
  if(file==='index.html')await page.screenshot({path:path.join(root,'docs/previews/chapter-07-browser-ending.png')});
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
  await page.close();console.log(file+': stage victory continuity, unchanged visuals/facing, rear guard stays put, no entrance walk, title return, narrow screen, Esc, fade cancellation and old/watched saves passed.');
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
