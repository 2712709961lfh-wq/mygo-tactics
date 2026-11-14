/* Browser flow checks use isolated contexts and fixture combat positions. */
'use strict';
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('node:assert/strict');const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),shots=path.join(root,'docs/previews');
const server=http.createServer((req,res)=>{const f=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'')||'index.html');if(!f.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(f,(e,b)=>{if(e){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg'})[path.extname(f)]||'application/octet-stream');res.end(b);});});
async function clickCell(page,x,y){const p=await page.evaluate(({x,y})=>{const ui=MYGO_UI,p=MyGO.MapProjection.project(ui.renderer.projection,(x+.5)*32,(y+.5)*32),r=ui.dom.board.getBoundingClientRect();return{x:r.left+p.x/ui.renderer.logicalWidth*r.width,y:r.top+p.y/ui.renderer.logicalHeight*r.height};},{x,y});await page.mouse.click(p.x,p.y);}
async function finishReports(page){for(let i=0;i<100;i++){
 const s=await page.evaluate(()=>({battle:MYGO_UI.battle.running,report:!MYGO_UI.dom.overlayRoot.hidden&&!!document.querySelector('.exchange-card,.growth-modal'),busy:MYGO_UI.busy}));
 if(s.battle)await page.evaluate(()=>MYGO_UI.battle.skip());else if(s.report)await page.locator('[data-confirm]').click();else if(!s.busy)return;await page.waitForTimeout(100);
 }throw Error('battle did not finish');}
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true,channel:'msedge'});
try{for(const name of ['index.html','standalone.html']){
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],missing=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))missing.push(r.url());});
 if(name==='standalone.html')await page.route('**/*',r=>r.request().url().startsWith(base+'/'+name)?r.continue():r.abort());
 await page.goto(base+'/'+name);await page.waitForFunction(()=>window.MYGO_ENTRY);await page.locator('[data-entry-action="chapter7"]').click();await page.waitForSelector('.livehouse-opening');
 assert.equal(await page.evaluate(()=>MYGO_UI.game.stage),7);assert.equal(await page.evaluate(()=>MYGO_UI.game.getUnit('nijika').side),'ally');
 if(name==='index.html'){
  await page.waitForFunction(()=>document.querySelector('.livehouse-opening')?.dataset.beat==='1');assert.equal(await page.evaluate(()=>MYGO_UI.game._liveIntro.visible(MYGO_UI.game.living('enemy')[0])),true);assert.equal(await page.evaluate(()=>MYGO_UI.game._liveIntro.visible(MYGO_UI.game.getUnit('tomori'))),false);
  await page.waitForFunction(()=>document.querySelector('.livehouse-opening')?.dataset.beat==='3');await page.screenshot({path:path.join(shots,'chapter-07-browser-opening.png')});
  await page.waitForFunction(()=>document.querySelector('.livehouse-opening')?.dataset.beat==='4');assert(await page.evaluate(()=>MYGO_UI.game.nijikaJoined));
  await page.waitForFunction(()=>document.getElementById('chapter-intro').hidden);
 }else {await page.keyboard.press('Enter');await page.waitForFunction(()=>document.getElementById('chapter-intro').hidden);}
 assert(await page.evaluate(()=>MyGO.Characters.hasActions('nijika')&&MyGO.Characters.has('nijika')));assert.equal(await page.evaluate(()=>Object.keys(MyGO.LivehouseArt.images).length),3);
 assert.equal(await page.evaluate(()=>MYGO_UI.game.livingCount('player')),6);
 assert((await page.locator('#objective-text').innerText()).includes('18 / 18'));assert((await page.locator('#party-list').innerText()).includes('虹夏'));
 await page.waitForTimeout(1300);if(name==='index.html')await page.screenshot({path:path.join(shots,'chapter-07-browser-map.png')});
 // Joined saves never replay the opening or duplicate the new companion.
 await page.evaluate(()=>{const u=MYGO_UI,s=u.game.serialize();u.loadSnapshot({snapshot:s,savedAt:new Date().toISOString()});u.playChapterIntro();});assert.equal(await page.evaluate(()=>MYGO_UI.chapterOpen),false);assert.equal(await page.evaluate(()=>MYGO_UI.game.units.filter(u=>u.id==='nijika').length),1);
 // Actual movement and action menu, followed by actual combat selection/cut-in.
 await page.evaluate(()=>{const u=MYGO_UI,n=u.game.getUnit('nijika');u.game.setUnitPosition(n.id,14,21);u.renderer.snapUnit(n);u.chooseParty(n.id);});await clickCell(page,14,22);await page.waitForFunction(()=>MYGO_UI.mode==='action'&&!MYGO_UI.busy);await page.getByRole('button',{name:/^待机/}).click();assert(await page.evaluate(()=>MYGO_UI.game.getUnit('nijika').acted));
 await page.evaluate(()=>{const u=MYGO_UI,n=u.game.getUnit('nijika'),e=u.game.getUnit('live-blade');Object.assign(n,{x:14,y:16,acted:false});Object.assign(e,{x:14,y:15,hp:1,spd:0,lck:0});n.dex=100;u.renderer.resetVisuals();u.resetSelection();u.selectUnit(n);u.enterActionMode();});
 await page.getByRole('button',{name:/^攻击/}).click();await clickCell(page,14,15);await page.waitForFunction(()=>MYGO_UI.battle.running);await page.waitForTimeout(400);
 if(name==='index.html')await page.screenshot({path:path.join(shots,'chapter-07-browser-battle.png')});await finishReports(page);assert(await page.evaluate(()=>MYGO_UI.game.getUnit('live-blade').dead));assert.equal(await page.evaluate(()=>MYGO_UI.game.phase),'player');
 // Healing uses production support rules and shares the normal action/EXP systems.
 await page.evaluate(()=>{const u=MYGO_UI,n=u.game.getUnit('nijika'),t=u.game.getUnit('tomori');Object.assign(n,{x:14,y:21,acted:false});Object.assign(t,{x:13,y:21,hp:1});const r=u.game.castSupport(n,'heal',t);if(!r.experience.length||t.hp<=1)throw Error('Nijika heal/EXP failed');u.updateAll();});
 // One living enemy keeps the battle going; all 18 dead opens CLEAR.
 await page.evaluate(()=>{const u=MYGO_UI,en=u.game.living('enemy');for(const e of en.slice(1)){e.dead=true;e.hp=0;}u.game.checkOutcome();if(u.game.phase!=='player')throw Error('early victory');en[0].dead=true;en[0].hp=0;u.game.checkOutcome();u.showEndScreen();});await page.waitForSelector('[data-end-restart]');assert((await page.locator('#overlay-card').innerText()).includes('全部敌人已击败'));if(name==='index.html')await page.screenshot({path:path.join(shots,'chapter-07-browser-victory.png')});
 // Restart reliably recruits on skip as well.
 await page.locator('[data-end-restart]').click();await page.waitForSelector('.livehouse-opening');await page.keyboard.press('Enter');await page.waitForFunction(()=>document.getElementById('chapter-intro').hidden);assert(await page.evaluate(()=>MYGO_UI.game.nijikaJoined));
 assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);console.log(name+': natural/skip intro, join, restore, movement, magic battle, heal, all-clear and restart passed');await page.close();
 }
 // A pending save replays opening; six-to-seven and an eight-person mobile rail.
 const page=await browser.newPage({viewport:{width:1440,height:1000}});await page.goto(base+'/index.html?stage=6');await page.waitForFunction(()=>window.MYGO_ENTRY);
 await page.evaluate(()=>{const u=MYGO_UI;u.game=new MyGO.Game({stage:6,recruited:['xueyue','nina']});u.game.maskEscaped=true;u.game.getUnit('masked_stranger').escaped=true;u.game.getUnit('masked_stranger').hp=1;u.game.checkOutcome();u.renderer.setGame(u.game);MYGO_ENTRY.dom.root.hidden=true;u.startNextStage();});await page.waitForSelector('.livehouse-opening');await page.keyboard.press('Enter');await page.waitForFunction(()=>document.getElementById('chapter-intro').hidden);assert.equal(await page.evaluate(()=>MYGO_UI.game.livingCount('player')),8);
 await page.setViewportSize({width:430,height:932});await page.waitForTimeout(700);await page.locator('.party-unit').last().scrollIntoViewIfNeeded();await page.locator('.party-unit').last().click();assert.equal(await page.evaluate(()=>MYGO_UI.activeId),'nijika');await page.screenshot({path:path.join(shots,'chapter-07-mobile.png')});
 await page.evaluate(()=>{const g=new MyGO.Game({stage:7}),u=MYGO_UI;u.loadSnapshot({snapshot:g.serialize(),savedAt:new Date().toISOString()});});await page.waitForSelector('.livehouse-opening');assert.equal(await page.evaluate(()=>MYGO_UI.game.nijikaJoined),false);await page.keyboard.press('Enter');await page.waitForFunction(()=>document.getElementById('chapter-intro').hidden);assert(await page.evaluate(()=>MYGO_UI.game.nijikaJoined));await page.close();
 // Double-click file:// standalone while all HTTP requests are blocked.
 const offline=await browser.newPage();await offline.route('http{,s}://**/*',r=>r.abort());await offline.goto('file:///'+path.join(root,'standalone.html').replace(/\\/g,'/'));await offline.waitForFunction(()=>window.MYGO_ENTRY);await offline.locator('[data-entry-action="chapter7"]').click();await offline.waitForSelector('.livehouse-opening');await offline.keyboard.press('Enter');await offline.waitForFunction(()=>document.getElementById('chapter-intro').hidden);assert(await offline.evaluate(()=>MYGO_UI.game.nijikaJoined&&MyGO.Characters.hasActions('nijika')&&Object.keys(MyGO.LivehouseArt.images).length===3));await offline.close();
 console.log('6→7, eight-person mobile rail, pending save and file:// offline passed.');
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
