/* Real Edge UI integration, cinematics and standalone/offline validation. */
'use strict';
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),root=path.resolve(__dirname,'..'),shots=path.join(root,'docs/previews');
const server=http.createServer((req,res)=>{const f=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'')||'index.html');if(!f.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(f,(e,b)=>{if(e){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg'})[path.extname(f)]||'application/octet-stream');res.end(b);});});
async function finishReports(page){for(let i=0;i<100;i++){const s=await page.evaluate(()=>({battle:MYGO_UI.battle.running,report:!MYGO_UI.dom.overlayRoot.hidden&&!!document.querySelector('.exchange-card,.growth-modal'),busy:MYGO_UI.busy}));if(s.battle)await page.evaluate(()=>MYGO_UI.battle.skip());else if(s.report)await page.locator('[data-confirm]').click();else if(!s.busy)return;await page.waitForTimeout(100);}throw Error('battle did not finish');}
async function skip(page){await page.keyboard.press('Enter');await page.waitForFunction(()=>document.getElementById('chapter-intro').hidden);}
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true,channel:'msedge'});
try{
 for(const name of ['index.html','standalone.html']){
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],missing=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))missing.push(r.url());});
  if(name==='standalone.html')await page.route('**/*',r=>r.request().url().startsWith(base+'/'+name)?r.continue():r.abort());
  await page.goto(base+'/'+name);await page.waitForFunction(()=>window.MYGO_ENTRY);await page.locator('[data-entry-action="chapter8"]').click();await page.waitForSelector('.eighth-opening');
  assert.equal(await page.evaluate(()=>MYGO_UI.game.stage),8);assert.equal(await page.evaluate(()=>MYGO_UI.game.getUnit('nijika').side),'player');
  if(name==='index.html'){
   await page.waitForFunction(()=>document.querySelector('.eighth-opening')?.dataset.beat==='1');assert((await page.locator('.eighth-opening .live-opening-caption p').innerText()).includes('你们以为这么简单吗！'));
   assert(await page.evaluate(()=>MYGO_UI.game.living('enemy').every(e=>!MYGO_UI.game._liveIntro.visible(e))));
   await page.screenshot({path:path.join(shots,'chapter-08-browser-mask.png')});
   await page.waitForFunction(()=>{const n=document.querySelector('.eighth-opening');return n&&+n.dataset.stageGrowth>.35&&+n.dataset.stageGrowth<.95;});await page.screenshot({path:path.join(shots,'chapter-08-browser-expansion.png')});
   await page.waitForFunction(()=>document.querySelector('.eighth-opening')?.dataset.beat==='4');await page.waitForTimeout(900);assert(await page.evaluate(()=>MYGO_UI.game.mission.phantomIds.every(id=>MYGO_UI.game._liveIntro.visible(MYGO_UI.game.getUnit(id)))));await page.screenshot({path:path.join(shots,'chapter-08-browser-phantoms.png')});
   await page.waitForFunction(()=>document.querySelector('.eighth-opening')?.dataset.beat==='6');assert.equal(await page.locator('.eighth-opening').getAttribute('data-mask-visible'),'false');
   await page.waitForFunction(()=>document.getElementById('chapter-intro').hidden);
  }else await skip(page);
  assert(await page.evaluate(()=>MYGO_UI.game.stageEightIntroSeen&&!MYGO_UI.game._liveIntro&&MYGO_UI.game.units.every(u=>u._summonAlpha===undefined)));
  assert((await page.locator('#objective-text').innerText()).includes('0/2'));assert((await page.locator('#objective-text').innerText()).includes('0/3'));
  assert(await page.evaluate(()=>['dark_soyo','dark_tomori','echo-armor-0','echo-pegasus-0'].every(id=>MyGO.Characters.hasActions(id))));
  const strength=await page.evaluate(()=>{const u=MYGO_UI,g=u.game,M=MyGO;for(const e of g.living('enemy')){const rate=e.boss?1.3:e.tags.includes('armor')?1.05:e.tags.includes('flying')?1:.95;if(M.Combat.statTotalOf(e)<Math.ceil(g.enemyScalePower*rate))throw Error('enemy too weak: '+e.id);}
   const e=g.getUnit('echo-blade'),before=M.Combat.statTotalOf(e),n=g.getUnit('nijika');e.hp=Math.floor(e.maxHp/2);const ratio=e.hp/e.maxHp;M.Growth.award(n,M.Growth.required(n.level));g.beginNextPlayerPhase();if(M.Combat.statTotalOf(e)<=before||Math.abs(e.hp/e.maxHp-ratio)>1/e.maxHp)throw Error('turn scaling/wounds failed');
   return {nijika:M.Combat.statTotalOf(n),enemy:M.Combat.statTotalOf(e),phantom:M.Combat.statTotalOf(g.getUnit('dark_soyo'))};});console.log(name+' strength: '+JSON.stringify(strength));
  // Static map art must not paint either phantom name; inspection keeps their identity.
  const painted=await page.evaluate(()=>{const u=MYGO_UI,c=document.createElement('canvas');c.width=960;c.height=1152;const ctx=c.getContext('2d'),texts=[],base=ctx.fillText;ctx.fillText=function(text,...args){texts.push(String(text));return base.call(this,text,...args);};MyGO.EighthMap.drawGround(ctx,u.game.map);u.inspectUnit(u.game.getUnit('dark_soyo'));if(!u.dom.infoName.textContent.includes('往日之影长崎爽世'))throw Error('inspection identity missing');u.resetSelection();u.renderIdleInfo();return texts;});assert(!painted.some(t=>/爽世|灯之影|往日之影/.test(t)));

  // Completed load does not replay; every enemy and all three chest props survive.
  await page.evaluate(()=>{const u=MYGO_UI;u.loadSnapshot({snapshot:u.game.serialize(),savedAt:new Date().toISOString()});u.playChapterIntro();});assert.equal(await page.evaluate(()=>MYGO_UI.chapterOpen),false);
  if(name==='index.html'){
   await page.waitForTimeout(2000);await page.screenshot({path:path.join(shots,'chapter-08-browser-map.png')});
   const data=await page.evaluate(()=>{const u=MYGO_UI;u.renderer.render(performance.now());return u.renderer.canvas.toDataURL('image/png').split(',')[1];});fs.writeFileSync(path.join(shots,'chapter-08-map.png'),Buffer.from(data,'base64'));
  }
  // Show all three treasure tooltips, then use the real action button for the 1500 G chest.
  await page.evaluate(()=>{const u=MYGO_UI;for(const c of u.game.mission.chests){u.renderTerrainInfo(c.x,c.y);if(!u.dom.contextText.innerHTML.includes(c.gold?'1500 G':MyGO.Inventory.item(c.item).name))throw Error('chest tooltip incorrect');}
   const t=u.game.getUnit('tomori'),c=u.game.mission.chests.find(c=>c.gold);Object.assign(t,{x:c.x,y:c.y,acted:false});t.inventory.push(MyGO.Inventory.make('chest_key'));u.renderer.snapUnit(t);u.selectUnit(t);u.enterActionMode();window.beforeChestGold=u.game.gold;});
  await page.getByRole('button',{name:'使用宝箱钥匙 · 开箱'}).click();assert(await page.evaluate(()=>MYGO_UI.game.gold===window.beforeChestGold+1500&&MYGO_UI.game.openedChests.includes('echo-gold')));assert((await page.locator('#toast').innerText()).includes('1500'));
  // An actual attack selection launches the Tomori phantom's sword battle and returns to play.
  await page.evaluate(()=>{const u=MYGO_UI,t=u.game.getUnit('tomori'),e=u.game.getUnit('dark_tomori');Object.assign(t,{x:13,y:15,acted:false,dex:100});Object.assign(e,{x:13,y:14,hp:1,spd:0,lck:0});u.renderer.resetVisuals();u.resetSelection();u.selectUnit(t);u.enterActionMode();u.revealCell(t.x,t.y);});
  await page.evaluate(()=>{const u=MYGO_UI,e=u.game.getUnit('dark_tomori'),t=u.game.getUnit('tomori'),round=u.game.rollCombat(e,t);window.phantomPreview=u.showCutin(e,t,round.strikes[0],{freezeAt:.59});});
  await page.waitForFunction(()=>MYGO_UI.battle.running);await page.waitForTimeout(1050);if(name==='index.html')await page.screenshot({path:path.join(shots,'chapter-08-browser-shadow-sword.png')});await page.evaluate(()=>MYGO_UI.battle.skip());await page.waitForFunction(()=>MYGO_UI.dom.cutin.hidden);
  await page.getByRole('button',{name:/^攻击/}).click();
  const point=await page.evaluate(()=>{const u=MYGO_UI,e=u.game.getUnit('dark_tomori'),p=MyGO.MapProjection.project(u.renderer.projection,(e.x+.5)*32,(e.y+.5)*32),b=u.dom.board.getBoundingClientRect();return {x:b.left+p.x/u.renderer.logicalWidth*b.width,y:b.top+p.y/u.renderer.logicalHeight*b.height};});await page.mouse.click(point.x,point.y);
  await page.waitForFunction(()=>MYGO_UI.battle.running);await page.waitForTimeout(600);if(name==='index.html')await page.screenshot({path:path.join(shots,'chapter-08-browser-battle.png')});await finishReports(page);
  assert(await page.evaluate(()=>MYGO_UI.game.getUnit('dark_tomori').dead&&MYGO_UI.game.phase==='player'));
  // The other phantom completes victory while fifteen ordinary enemies remain.
  await page.evaluate(()=>{const u=MYGO_UI;u.game.applyCombat({attackerId:'soyo',defenderId:'dark_soyo',hit:true,finalDamage:999});u.updateAll();u.showEndScreen();});await page.waitForSelector('[data-end-restart]');assert.equal(await page.locator('[data-end-next]').count(),0);assert.equal(await page.evaluate(()=>MYGO_UI.game.livingCount('enemy')),15);assert((await page.locator('#overlay-card').innerText()).includes('两名往日之影已消散'));
  if(name==='index.html')await page.screenshot({path:path.join(shots,'chapter-08-browser-victory.png')});
  await page.locator('[data-end-restart]').click();await page.waitForSelector('.eighth-opening');await skip(page);assert(await page.evaluate(()=>MYGO_UI.game.stageEightIntroSeen&&MYGO_UI.game.openedChests.length===0));
  // Pending opening restores and replays, then completes once on skip.
  await page.evaluate(()=>{const g=new MyGO.Game({stage:8});MYGO_UI.loadSnapshot({snapshot:g.serialize(),savedAt:new Date().toISOString()});});await page.waitForSelector('.eighth-opening');await skip(page);assert(await page.evaluate(()=>MYGO_UI.game.stageEightIntroSeen));
  assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);assert((await page.locator('[data-game-version]').innerText()).includes(JSON.parse(fs.readFileSync(path.join(root,'version.json'),'utf8')).version));console.log(name+': cinematic, expansion, summons/exit, chest UI, phantom combat, victory, restart and snapshots passed');await page.close();
 }
 // Actual seventh-chapter next-stage route keeps Nijika's growth and economy.
 const page=await browser.newPage();await page.goto(base+'/index.html');await page.waitForFunction(()=>window.MYGO_ENTRY);
 await page.evaluate(()=>{const u=MYGO_UI,g=new MyGO.Game({stage:7,recruited:['xueyue','nina']});g.joinNijika();const n=g.getUnit('nijika');MyGO.Growth.award(n,MyGO.Growth.required(n.level));n.exp=31;g.gold=7777;for(const e of g.living('enemy')){e.dead=true;e.hp=0;}g.checkOutcome();g.livehouseEndingShown=true;u.game=g;u.renderer.setGame(g);MYGO_ENTRY.dom.root.hidden=true;u.showEndScreen();});await page.waitForSelector('[data-end-next]');assert((await page.locator('[data-end-next]').innerText()).includes('第八章'));await page.locator('[data-end-next]').click();await page.waitForSelector('.eighth-opening');await skip(page);assert(await page.evaluate(()=>MYGO_UI.game.stage===8&&MYGO_UI.game.livingCount('player')===8&&MYGO_UI.game.getUnit('nijika').level===10&&MYGO_UI.game.getUnit('nijika').exp===31&&MYGO_UI.game.gold===9777));await page.close();
 const offline=await browser.newPage();await offline.route('http{,s}://**/*',r=>r.abort());await offline.goto('file:///'+path.join(root,'standalone.html').replace(/\\/g,'/'));await offline.waitForFunction(()=>window.MYGO_ENTRY);await offline.locator('[data-entry-action="chapter8"]').click();await offline.waitForSelector('.eighth-opening');await skip(offline);assert(await offline.evaluate(()=>MYGO_UI.game.stage===8&&MYGO_UI.game.stageEightIntroSeen&&Object.keys(MyGO.LivehouseArt.images).length===3&&Object.keys(MyGO.MaskedCourtArt.images).length===7));await offline.close();
 console.log('7→8 inheritance and file:// standalone with network blocked passed.');
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
