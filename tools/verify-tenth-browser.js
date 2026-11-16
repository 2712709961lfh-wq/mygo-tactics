/* Chapter ten: real Edge input, movie beats, both new combatants, saves and offline build. */
'use strict';
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),root=path.resolve(__dirname,'..'),shots=path.join(root,'docs/previews');
const server=http.createServer((req,res)=>{const f=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'')||'index.html');if(!f.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(f,(e,b)=>{if(e){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg'})[path.extname(f)]||'application/octet-stream');res.end(b);});});
const skip=async p=>{await p.keyboard.press('Enter');await p.waitForFunction(()=>document.getElementById('chapter-intro').hidden);};
async function finishReports(p){for(let i=0;i<100;i++){const s=await p.evaluate(()=>({battle:MYGO_UI.battle.running,report:!MYGO_UI.dom.overlayRoot.hidden&&!!document.querySelector('.exchange-card,.growth-modal'),busy:MYGO_UI.busy}));if(s.battle)await p.evaluate(()=>MYGO_UI.battle.skip());else if(s.report)await p.locator('[data-confirm]').click();else if(!s.busy)return;await p.waitForTimeout(100);}throw Error('battle did not finish');}
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true,channel:'msedge'});
try{
 for(const name of ['index.html','standalone.html']){
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],missing=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))missing.push(r.url());});
  if(name==='standalone.html')await page.route('**/*',r=>r.request().url().startsWith(base+'/'+name)?r.continue():r.abort());
  await page.goto(base+'/'+name);await page.waitForFunction(()=>window.MYGO_ENTRY);await page.locator('[data-entry-action="chapter10"]').click();await page.waitForSelector('.tenth-opening');
  assert.equal(await page.evaluate(()=>MYGO_UI.game.stage),10);assert.equal(await page.evaluate(()=>MYGO_UI.game.getUnit('subaru').side),'ally');assert(await page.evaluate(()=>!!MYGO_UI.game.getUnit('nina')));
  if(name==='index.html'){
   await page.waitForTimeout(1700);await page.screenshot({path:path.join(shots,'chapter-10-browser-entry.png')});
   await page.waitForFunction(()=>document.querySelector('.tenth-opening')?.dataset.beat==='1');await page.waitForTimeout(1400);await page.screenshot({path:path.join(shots,'chapter-10-browser-duel.png')});
   assert(await page.evaluate(()=>MYGO_UI.game.living('enemy').filter(e=>e.id!=='dark_nina').every(e=>!MYGO_UI.game._liveIntro.visible(e))));
   await page.waitForFunction(()=>document.querySelector('.tenth-opening')?.dataset.beat==='2');assert((await page.locator('.tenth-opening .live-opening-caption p').innerText()).includes('安和昴，你怎么在这里'));
   await page.waitForFunction(()=>document.querySelector('.tenth-opening')?.dataset.beat==='3');assert((await page.locator('.tenth-opening .live-opening-caption p').innerText()).includes('mmk叫我抓你回去训练'));await page.screenshot({path:path.join(shots,'chapter-10-browser-dialogue.png')});
   await page.waitForFunction(()=>document.querySelector('.tenth-opening')?.dataset.beat==='4');assert((await page.locator('.tenth-opening .live-opening-caption p').innerText()).includes('那个是幻影'));
   await page.waitForFunction(()=>document.querySelector('.tenth-opening')?.dataset.beat==='5');await page.waitForTimeout(2300);assert(await page.evaluate(()=>MYGO_UI.game.living('enemy').every(e=>MYGO_UI.game._liveIntro.visible(e))));await page.screenshot({path:path.join(shots,'chapter-10-browser-summons.png')});
   await page.waitForFunction(()=>document.getElementById('chapter-intro').hidden);
  }else await skip(page);
  assert(await page.evaluate(()=>{const g=MYGO_UI.game,s=g.getUnit('subaru');return g.stageTenIntroSeen&&g.subaruJoined&&s.side==='player'&&s.hp===s.maxHp&&!s.acted&&MyGO.Inventory.usable(s)&&!g._liveIntro&&g.units.every(u=>u._summonAlpha===undefined&&Number.isInteger(u.x)&&Number.isInteger(u.y));}));
  assert((await page.locator('#objective-text').innerText()).includes('15 / 15'));assert((await page.locator('#objective-text').innerText()).includes('昴已入队'));
  assert(await page.evaluate(()=>MyGO.Characters.hasActions('subaru')&&MyGO.Characters.hasActions('dark_nina')));
  await page.evaluate(()=>{const u=MYGO_UI;u.inspectUnit(u.game.getUnit('dark_nina'));if(!u.dom.infoName.textContent.includes('井芹仁菜幻影')||!u.dom.infoTags.textContent.includes('拳斗士'))throw Error('phantom identity/class missing');u.resetSelection();u.renderIdleInfo();});
  if(name==='index.html'){
   await page.screenshot({path:path.join(shots,'chapter-10-browser-map.png')});
   const data=await page.evaluate(()=>{MYGO_UI.renderer.render(performance.now());return MYGO_UI.renderer.canvas.toDataURL('image/png').split(',')[1];});fs.writeFileSync(path.join(shots,'chapter-10-map.png'),Buffer.from(data,'base64'));
  }
  await page.evaluate(()=>{const u=MYGO_UI;u.loadSnapshot({snapshot:u.game.serialize(),savedAt:new Date().toISOString()});u.playChapterIntro();});assert.equal(await page.evaluate(()=>MYGO_UI.chapterOpen),false);
  // Nina's double uses the actual gauntlet battle sequence, with purple phantom shading.
  await page.evaluate(()=>{const u=MYGO_UI,g=u.game,p=g.getUnit('dark_nina'),s=g.getUnit('subaru');Object.assign(p,{x:13,y:16});Object.assign(s,{x:13,y:17});const round=g.rollCombat(p,s);window.duelPreview=u.showCutin(p,s,round.strikes[0],{freezeAt:.59});});
  await page.waitForFunction(()=>MYGO_UI.battle.running);await page.waitForTimeout(1000);if(name==='index.html')await page.screenshot({path:path.join(shots,'chapter-10-browser-phantom.png')});await page.evaluate(()=>MYGO_UI.battle.skip());await page.waitForFunction(()=>MYGO_UI.dom.cutin.hidden);
  // Actual spell selection/input: Subaru defeats the phantom but the map continues.
  await page.evaluate(()=>{const u=MYGO_UI,g=u.game,p=g.getUnit('dark_nina'),s=g.getUnit('subaru');Object.assign(s,{x:13,y:18,acted:false,dex:100,mag:80});Object.assign(p,{x:13,y:16,hp:1,spd:0,lck:0});u.renderer.resetVisuals();u.resetSelection();u.selectUnit(s);u.enterActionMode();u.revealCell(s.x,s.y);});
  await page.getByRole('button',{name:/^攻击/}).click();const point=await page.evaluate(()=>{const u=MYGO_UI,e=u.game.getUnit('dark_nina'),p=MyGO.MapProjection.project(u.renderer.projection,(e.x+.5)*32,(e.y+.5)*32),b=u.dom.board.getBoundingClientRect();return{x:b.left+p.x/u.renderer.logicalWidth*b.width,y:b.top+p.y/u.renderer.logicalHeight*b.height};});await page.mouse.click(point.x,point.y);
  await page.waitForFunction(()=>MYGO_UI.battle.running);await page.waitForTimeout(750);if(name==='index.html')await page.screenshot({path:path.join(shots,'chapter-10-browser-subaru-magic.png')});await finishReports(page);
  assert(await page.evaluate(()=>MYGO_UI.game.getUnit('dark_nina').dead&&MYGO_UI.game.getUnit('subaru').exp>0&&MYGO_UI.game.phase==='player'&&MYGO_UI.game.livingCount('enemy')===14));
  // A normal soldier is the last required enemy, rather than an early Boss victory.
  await page.evaluate(()=>{const u=MYGO_UI,g=u.game;for(const e of g.living('enemy'))if(e.id!=='loop-soldier-8')g.applyCombat({attackerId:'tomori',defenderId:e.id,hit:true,finalDamage:999});u.updateAll();});assert.equal(await page.evaluate(()=>MYGO_UI.game.phase),'player');
  await page.evaluate(()=>{const u=MYGO_UI;u.game.applyCombat({attackerId:'tomori',defenderId:'loop-soldier-8',hit:true,finalDamage:999});u.updateAll();u.showEndScreen();});await page.waitForSelector('[data-end-restart]');assert.equal(await page.locator('[data-end-next]').count(),0);assert((await page.locator('#overlay-card').innerText()).includes('全部消散'));
  if(name==='index.html')await page.screenshot({path:path.join(shots,'chapter-10-browser-victory.png')});
  await page.evaluate(()=>{const u=MYGO_UI;u.loadSnapshot({snapshot:u.game.serialize(),savedAt:new Date().toISOString()});});assert(await page.evaluate(()=>MYGO_UI.game.phase==='victory'&&MYGO_UI.game.subaruJoined));
  await page.locator('[data-end-restart]').click();await page.waitForSelector('.tenth-opening');await skip(page);assert(await page.evaluate(()=>MYGO_UI.game.stageTenIntroSeen&&MYGO_UI.game.subaruJoined&&MYGO_UI.game.units.filter(u=>u.id==='subaru').length===1));
  await page.evaluate(()=>{const g=new MyGO.Game({stage:10});MYGO_UI.loadSnapshot({snapshot:g.serialize(),savedAt:new Date().toISOString()});});await page.waitForSelector('.tenth-opening');await skip(page);assert(await page.evaluate(()=>MYGO_UI.game.subaruJoined));
  assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);assert((await page.locator('[data-game-version]').innerText()).includes('5.12.0'));
  console.log(name+': entrance, duel/dialogue, summons, recruitment, both combatants, all-enemy victory, restart and saves passed');await page.close();
 }
 // Chapter9 clear button →10, full nine-person roster, and keyboard shortcut for the ninth member.
 const page=await browser.newPage({viewport:{width:1440,height:1000}});await page.goto(base+'/index.html');await page.waitForFunction(()=>window.MYGO_ENTRY);
 await page.evaluate(()=>{const u=MYGO_UI,g=new MyGO.Game({stage:9,recruited:['xueyue','nina']});g.completeNinthIntro();const n=g.getUnit('nijika');MyGO.Growth.award(n,MyGO.Growth.required(n.level));n.exp=31;g.gold=7777;g.applyCombat({attackerId:'tomori',defenderId:'rift_pegasus',hit:true,finalDamage:999});Object.assign(g.getUnit('tomori'),{x:13,y:3,acted:false});g.useGateKey(g.getUnit('tomori'));u.game=g;u.renderer.setGame(g);MYGO_ENTRY.dom.root.hidden=true;u.showEndScreen();});
 await page.waitForSelector('[data-end-next]');assert((await page.locator('[data-end-next]').innerText()).includes('第十章'));await page.locator('[data-end-next]').click();await page.waitForSelector('.tenth-opening');await skip(page);
 assert(await page.evaluate(()=>MYGO_UI.game.stage===10&&MYGO_UI.game.livingCount('player')===9&&MYGO_UI.game.getUnit('nijika').level===10&&MYGO_UI.game.getUnit('nijika').exp===31&&MYGO_UI.game.gold===9777));
 await page.keyboard.press('9');assert.equal(await page.evaluate(()=>MYGO_UI.activeId),'subaru');await page.close();
 const offline=await browser.newPage();await offline.route('http{,s}://**/*',r=>r.abort());await offline.goto('file:///'+path.join(root,'standalone.html').replace(/\\/g,'/'));await offline.waitForFunction(()=>window.MYGO_ENTRY);await offline.locator('[data-entry-action="chapter10"]').click();await offline.waitForSelector('.tenth-opening');await skip(offline);
 assert(await offline.evaluate(()=>MYGO_UI.game.stage===10&&MYGO_UI.game.subaruJoined&&MyGO.Characters.hasActions('subaru')&&MyGO.Characters.hasActions('dark_nina')&&MyGO.Characters.isReady()));await offline.close();
 console.log('9→10 inheritance, nine-member selection and file:// offline standalone passed.');
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
