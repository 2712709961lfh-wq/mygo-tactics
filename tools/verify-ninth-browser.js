/* Browser acceptance for the ninth chapter, normal and offline standalone. */
'use strict';
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),root=path.resolve(__dirname,'..'),shots=path.join(root,'docs/previews');
const server=http.createServer((req,res)=>{const f=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'')||'index.html');if(!f.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(f,(e,b)=>{if(e){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg'})[path.extname(f)]||'application/octet-stream');res.end(b);});});
const skip=async p=>{await p.keyboard.press('Enter');await p.waitForFunction(()=>document.getElementById('chapter-intro').hidden);};
async function finishReports(page){for(let i=0;i<100;i++){const s=await page.evaluate(()=>({battle:MYGO_UI.battle.running,report:!MYGO_UI.dom.overlayRoot.hidden&&!!document.querySelector('.exchange-card,.growth-modal'),busy:MYGO_UI.busy}));if(s.battle)await page.evaluate(()=>MYGO_UI.battle.skip());else if(s.report)await page.locator('[data-confirm]').click();else if(!s.busy)return;await page.waitForTimeout(100);}throw Error('battle did not finish');}
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true,channel:'msedge'});
try{
 for(const name of ['index.html','standalone.html']){
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],missing=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))missing.push(r.url());});
  if(name==='standalone.html')await page.route('**/*',r=>r.request().url().startsWith(base+'/'+name)?r.continue():r.abort());
  await page.goto(base+'/'+name);await page.waitForFunction(()=>window.MYGO_ENTRY);await page.locator('[data-entry-action="chapter9"]').click();await page.waitForSelector('.ninth-opening');
  assert.equal(await page.evaluate(()=>MYGO_UI.game.stage),9);assert.equal(await page.evaluate(()=>MYGO_UI.game.getUnit('nijika').side),'player');assert(await page.evaluate(()=>!!MYGO_UI.game.getUnit('nina')));
  if(name==='index.html'){
   await page.waitForFunction(()=>document.querySelector('.ninth-opening')?.dataset.beat==='1');
   assert((await page.locator('.ninth-opening .live-opening-caption p').innerText()).includes('我们乐队的排练室'));
   assert(await page.evaluate(()=>MYGO_UI.game.living('enemy').every(e=>!MYGO_UI.game._liveIntro.visible(e))));
   await page.screenshot({path:path.join(shots,'chapter-09-browser-opening.png')});
   await page.waitForFunction(()=>{const n=document.querySelector('.ninth-opening');return n&&+n.dataset.roomGrowth>.4&&+n.dataset.roomGrowth<.9;});await page.screenshot({path:path.join(shots,'chapter-09-browser-expansion.png')});
   await page.waitForFunction(()=>document.querySelector('.ninth-opening')?.dataset.beat==='4');await page.waitForTimeout(1700);
   assert(await page.evaluate(()=>MYGO_UI.game._liveIntro.doorAlpha===1&&MYGO_UI.game.living('enemy').every(e=>MYGO_UI.game._liveIntro.visible(e))));
   await page.screenshot({path:path.join(shots,'chapter-09-browser-door.png')});
   await page.waitForFunction(()=>document.getElementById('chapter-intro').hidden);
  }else await skip(page);
  assert(await page.evaluate(()=>MYGO_UI.game.stageNineIntroSeen&&!MYGO_UI.game._liveIntro&&MYGO_UI.game.units.every(u=>u._summonAlpha===undefined&&Number.isInteger(u.y))));
  assert((await page.locator('#objective-text').innerText()).includes('击败裂空天马'));
  assert(await page.evaluate(()=>['rift_pegasus','rehearsal-armor-0','rehearsal-pegasus-0'].every(id=>MyGO.Characters.hasActions(id))));
  if(name==='index.html'){
   await page.waitForTimeout(300);await page.screenshot({path:path.join(shots,'chapter-09-browser-map.png')});
   const data=await page.evaluate(()=>{MYGO_UI.renderer.render(performance.now());return MYGO_UI.renderer.canvas.toDataURL('image/png').split(',')[1];});fs.writeFileSync(path.join(shots,'chapter-09-map.png'),Buffer.from(data,'base64'));
  }
  // A completed save resumes at the board; a pending save resumes its own movie.
  await page.evaluate(()=>{const u=MYGO_UI;u.loadSnapshot({snapshot:u.game.serialize(),savedAt:new Date().toISOString()});u.playChapterIntro();});assert.equal(await page.evaluate(()=>MYGO_UI.chapterOpen),false);
  // Actual battle UI, with the enhanced Pegasus visible in the rehearsal-room backdrop.
  await page.evaluate(()=>{const u=MYGO_UI,t=u.game.getUnit('tomori'),b=u.game.getUnit('rift_pegasus');Object.assign(t,{x:13,y:7,acted:false,dex:100,str:80});Object.assign(b,{x:13,y:6,hp:1,spd:0,lck:0});u.renderer.resetVisuals();u.resetSelection();u.selectUnit(t);u.enterActionMode();u.revealCell(t.x,t.y);});
  await page.evaluate(()=>{const u=MYGO_UI,b=u.game.getUnit('rift_pegasus'),t=u.game.getUnit('tomori'),round=u.game.rollCombat(b,t);window.bossPreview=u.showCutin(b,t,round.strikes[0],{freezeAt:.59});});
  await page.waitForFunction(()=>MYGO_UI.battle.running);await page.waitForTimeout(1000);if(name==='index.html')await page.screenshot({path:path.join(shots,'chapter-09-browser-boss.png')});await page.evaluate(()=>MYGO_UI.battle.skip());await page.waitForFunction(()=>MYGO_UI.dom.cutin.hidden);
  await page.getByRole('button',{name:/^攻击/}).click();
  const point=await page.evaluate(()=>{const u=MYGO_UI,e=u.game.getUnit('rift_pegasus'),p=MyGO.MapProjection.project(u.renderer.projection,(e.x+.5)*32,(e.y+.5)*32),b=u.dom.board.getBoundingClientRect();return {x:b.left+p.x/u.renderer.logicalWidth*b.width,y:b.top+p.y/u.renderer.logicalHeight*b.height};});await page.mouse.click(point.x,point.y);
  await page.waitForFunction(()=>MYGO_UI.battle.running);await finishReports(page);
  assert(await page.evaluate(()=>{const g=MYGO_UI.game,t=g.getUnit('tomori');return g.getUnit('rift_pegasus').dead&&g.phase==='player'&&t.inventory.some(i=>i.id==='strange_door_key')&&t.inventory.some(i=>i.id==='steel_lance');}));
  assert((await page.locator('#objective-text').innerText()).includes('到北端门旁使用钥匙'));
  // The real action button consumes the key and shows a door opening before victory.
  await page.evaluate(()=>{const u=MYGO_UI,t=u.game.getUnit('tomori');Object.assign(t,{x:13,y:3,acted:false});u.resetSelection();u.renderer.resetVisuals();u.selectUnit(t);u.enterActionMode();u.revealCell(t.x,t.y);u.renderTerrainInfo(13,2);if(u.dom.infoName.textContent!=='奇怪的门')throw Error('wrong gate label');u.renderActionSide(t);});
  await page.getByRole('button',{name:'使用门的钥匙 · 开启奇怪的门'}).click();await page.waitForFunction(()=>MYGO_UI.game.gateOpen);
  await page.evaluate(()=>{const c=document.createElement('canvas').getContext('2d'),u=MYGO_UI;MyGO.RehearsalMap.drawEffects(c,u.renderer.projection,u.game,u.game._doorOpenedAt-50);});
  if(name==='index.html'){await page.waitForTimeout(500);await page.screenshot({path:path.join(shots,'chapter-09-browser-door-open.png')});}
  await page.waitForSelector('[data-end-restart]');assert.equal(await page.locator('[data-end-next]').count(),0);assert((await page.locator('#overlay-card').innerText()).includes('奇怪的门'));
  assert(await page.evaluate(()=>MYGO_UI.game.phase==='victory'&&MYGO_UI.game.map.tiles[2][13]==='gateOpen'&&!MYGO_UI.game.getUnit('tomori').inventory.some(i=>i.id==='strange_door_key')));
  if(name==='index.html')await page.screenshot({path:path.join(shots,'chapter-09-browser-victory.png')});
  await page.evaluate(()=>{const u=MYGO_UI;u.loadSnapshot({snapshot:u.game.serialize(),savedAt:new Date().toISOString()});});assert(await page.evaluate(()=>MYGO_UI.game.phase==='victory'&&MYGO_UI.game.gateOpen));
  await page.locator('[data-end-restart]').click();await page.waitForSelector('.ninth-opening');await skip(page);assert(await page.evaluate(()=>MYGO_UI.game.stageNineIntroSeen&&!MYGO_UI.game.gateOpen&&!MYGO_UI.game.getUnit('rift_pegasus').dead));
  await page.evaluate(()=>{const g=new MyGO.Game({stage:9});MYGO_UI.loadSnapshot({snapshot:g.serialize(),savedAt:new Date().toISOString()});});await page.waitForSelector('.ninth-opening');await skip(page);
  // Even with a full convoy and a fallen carrier, the recovered quest key works in the real menu.
  await page.evaluate(()=>{const u=MYGO_UI,g=new MyGO.Game({stage:9});g.completeNinthIntro();g.applyCombat({attackerId:'tomori',defenderId:'rift_pegasus',hit:true,finalDamage:999});g.convoy=Array.from({length:500},()=>MyGO.Inventory.make('iron_sword'));g.applyCombat({attackerId:'rehearsal-bow-b',defenderId:'tomori',hit:true,finalDamage:999});u.loadSnapshot({snapshot:g.serialize(),savedAt:new Date().toISOString()});const a=u.game.getUnit('anon');Object.assign(a,{x:13,y:3,acted:false});u.renderer.resetVisuals();u.selectUnit(a);u.enterActionMode();});
  await page.getByRole('button',{name:'使用门的钥匙 · 开启奇怪的门'}).click();await page.waitForSelector('[data-end-restart]');assert(await page.evaluate(()=>MYGO_UI.game.phase==='victory'&&MYGO_UI.game.lootReserve.every(i=>i.id!=='strange_door_key')));
  assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);assert((await page.locator('[data-game-version]').innerText()).includes('5.11.0'));
  console.log(name+': opening/expansion/summons/door, battle, drops, key action, victory, restart and saves passed');await page.close();
 }
 // Real 8→9 route carries recruited members and growth through the chapter button.
 const page=await browser.newPage();await page.goto(base+'/index.html');await page.waitForFunction(()=>window.MYGO_ENTRY);
 await page.evaluate(()=>{const u=MYGO_UI,g=new MyGO.Game({stage:8,recruited:['xueyue','nina']});g.completeEighthIntro();const n=g.getUnit('nijika');MyGO.Growth.award(n,MyGO.Growth.required(n.level));n.exp=31;g.gold=7777;for(const id of g.mission.phantomIds){g.getUnit(id).dead=true;g.getUnit(id).hp=0;}g.checkOutcome();u.game=g;u.renderer.setGame(g);MYGO_ENTRY.dom.root.hidden=true;u.showEndScreen();});
 await page.waitForSelector('[data-end-next]');assert((await page.locator('[data-end-next]').innerText()).includes('第九章'));await page.locator('[data-end-next]').click();await page.waitForSelector('.ninth-opening');await skip(page);
 assert(await page.evaluate(()=>MYGO_UI.game.stage===9&&MYGO_UI.game.livingCount('player')===8&&MYGO_UI.game.getUnit('nijika').level===10&&MYGO_UI.game.getUnit('nijika').exp===31&&MYGO_UI.game.gold===9777));await page.close();
 const offline=await browser.newPage();await offline.route('http{,s}://**/*',r=>r.abort());await offline.goto('file:///'+path.join(root,'standalone.html').replace(/\\/g,'/'));await offline.waitForFunction(()=>window.MYGO_ENTRY);await offline.locator('[data-entry-action="chapter9"]').click();await offline.waitForSelector('.ninth-opening');await skip(offline);
 assert(await offline.evaluate(()=>MYGO_UI.game.stage===9&&MYGO_UI.game.stageNineIntroSeen&&MyGO.LivehouseArt.images.drums&&MyGO.WatercourtArt.images.pegasus));await offline.close();
 console.log('8→9 inheritance and file:// offline standalone passed.');
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
