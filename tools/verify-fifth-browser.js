/* Production UI checks with isolated browser storage and deterministic battle fixtures. */
'use strict';
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('node:assert/strict');const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),shots=path.join(root,'docs/previews');
const server=http.createServer((req,res)=>{const f=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'')||'index.html');
 if(!f.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(f,(e,b)=>{if(e){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg'})[path.extname(f)]||'application/octet-stream');res.end(b);});});
async function clickCell(page,x,y){const p=await page.evaluate(({x,y})=>{const ui=MYGO_UI,p=MyGO.MapProjection.project(ui.renderer.projection,(x+.5)*32,(y+.5)*32),r=ui.dom.board.getBoundingClientRect();
 if(document.getElementById('game-shell').dataset.rotated==='true')return{x:r.right-p.y/ui.renderer.logicalHeight*r.width,y:r.top+p.x/ui.renderer.logicalWidth*r.height};return{x:r.left+p.x/ui.renderer.logicalWidth*r.width,y:r.top+p.y/ui.renderer.logicalHeight*r.height};},{x,y});await page.mouse.click(p.x,p.y);}
async function fight(page,a,b,pos,shot){
 await page.evaluate(({a,b,pos})=>{const ui=MYGO_UI,u=ui.game.getUnit(a),e=ui.game.getUnit(b);u.acted=false;u.exp=0;u.dex=120;u.lck=0;u.str=80;u.mag=80;e.hp=1;e.lck=0;Object.assign(u,pos);ui.renderer.snapUnit(u);ui.resetSelection();ui.updateAll();ui.selectUnit(u);ui.enterActionMode();ui.enterAttackMode();},{a,b,pos});
 const target=await page.evaluate(b=>{const e=MYGO_UI.game.getUnit(b);return{x:e.x,y:e.y};},b);await clickCell(page,target.x,target.y);
 await page.waitForFunction(()=>MYGO_UI.battle.running);if(shot){await page.waitForTimeout(250);await page.screenshot({path:path.join(shots,shot)});}
 for(let i=0;i<60;i++){
  const state=await page.evaluate(()=>({battle:MYGO_UI.battle.running,exchange:!!document.querySelector('.exchange-card')&&!MYGO_UI.dom.overlayRoot.hidden,growth:!!document.querySelector('.growth-modal')&&!MYGO_UI.dom.overlayRoot.hidden,busy:MYGO_UI.busy}));
  if(state.battle)await page.evaluate(()=>MYGO_UI.battle.skip());
  else if(state.exchange||state.growth)await page.locator('[data-confirm]').click();
  else if(!state.busy)break;
  await page.waitForTimeout(150);
 }
 await page.waitForFunction(b=>MYGO_UI.game.getUnit(b).dead&&!MYGO_UI.busy,b);}
async function positionAction(page,id,x,y){await page.evaluate(({id,x,y})=>{const ui=MYGO_UI,u=ui.game.getUnit(id);u.acted=false;ui.game.setUnitPosition(id,x,y);ui.renderer.snapUnit(u);ui.resetSelection();ui.updateAll();},{id,x,y});await page.locator('[data-party-id="'+id+'"]').click();await clickCell(page,x,y);await page.waitForFunction(()=>MYGO_UI.mode==='action'&&!MYGO_UI.busy);}
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{for(const name of ['index.html','standalone.html']){
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],missing=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)missing.push(r.url());});
  if(name==='standalone.html')await page.route('**/*',r=>r.request().url().startsWith(base+'/'+name)?r.continue():r.abort());
  await page.goto(base+'/'+name);await page.waitForFunction(()=>window.MYGO_ENTRY);await page.locator('[data-entry-action="chapter5"]').click();await page.waitForFunction(()=>MYGO_UI.chapterOpen&&MYGO_UI.game.stage===5);await page.keyboard.press('Enter');await page.waitForFunction(()=>document.getElementById('chapter-intro').hidden);await page.waitForTimeout(1800);
  assert.equal(await page.evaluate(()=>Object.keys(MyGO.WatercourtArt.images).length),4);assert((await page.locator('#objective-text').innerText()).includes('宝箱 0/2'));
  if(name==='index.html')await page.screenshot({path:path.join(shots,'chapter-05-browser-map.png')});
  await page.evaluate(()=>MYGO_UI.inspectUnit(MYGO_UI.game.getUnit('court-pegasus-n')));assert((await page.locator('#context-text').innerText()).includes('宝箱钥匙'));
  await page.evaluate(()=>{const ui=MYGO_UI,p=ui.game.getUnit('court-pegasus-n');ui.game.setUnitPosition(p.id,14,4);ui.renderer.snapUnit(p);});
  await fight(page,'anon','court-pegasus-n',{x:12,y:4},name==='index.html'?'chapter-05-browser-pegasus-battle.png':null);
  assert(await page.evaluate(()=>MYGO_UI.game.getUnit('anon').inventory.some(i=>i.id==='chest_key')));
  assert((await page.locator('#toast').innerText()).includes('宝箱钥匙'));
  await positionAction(page,'anon',8,3);await page.getByRole('button',{name:/^使用宝箱钥匙 · 开箱/}).click();
  assert(await page.evaluate(()=>MYGO_UI.game.openedChests.includes('north-cache')&&MYGO_UI.game.getUnit('anon').acted));assert(await page.evaluate(()=>MYGO_UI.game.getUnit('anon').inventory.some(i=>i.id==='elixir')));
  if(name==='index.html')await page.screenshot({path:path.join(shots,'chapter-05-browser-chest.png')});
  await page.evaluate(()=>{const ui=MYGO_UI,p=ui.game.getUnit('court-pegasus-s');ui.game.setUnitPosition(p.id,17,19);ui.renderer.snapUnit(p);});
  await fight(page,'anon','court-pegasus-s',{x:19,y:19});const gold=await page.evaluate(()=>MYGO_UI.game.gold);
  await positionAction(page,'anon',24,20);await page.getByRole('button',{name:/^使用宝箱钥匙 · 开箱/}).click();assert.equal(await page.evaluate(()=>MYGO_UI.game.gold),gold+500);
  // Restore through the production UI with an isolated snapshot.
  assert.equal(await page.evaluate(()=>{const ui=MYGO_UI,s=JSON.parse(JSON.stringify(ui.game.serialize()));ui.loadSnapshot({snapshot:s,savedAt:new Date().toISOString()});return ui.game.openedChests.length;}),2);
  await fight(page,'soyo','iron_warden',{x:27,y:12},name==='index.html'?'chapter-05-browser-boss-battle.png':null);await page.waitForFunction(()=>MYGO_UI.game.phase==='victory'&&MYGO_UI.endShown);
  assert((await page.locator('#overlay-card').innerText()).includes('中级转职证 ×1、钢斧 ×1'));assert.equal(await page.locator('[data-end-next]').count(),0);
  assert.deepEqual(await page.evaluate(()=>['intermediate_seal','steel_axe'].map(id=>MYGO_UI.game.units.filter(u=>u.side==='player').flatMap(u=>u.inventory).concat(MYGO_UI.game.convoy).filter(i=>i.id===id).length)),[1,1]);
  if(name==='index.html'){await page.waitForTimeout(800);await page.screenshot({path:path.join(shots,'chapter-05-browser-victory.png')});}
  // Actual chapter-four victory button enters the new chapter with inherited state.
  await page.evaluate(()=>{const ui=MYGO_UI;ui.newGame(57,4);ui.game.applyCombat({attackerId:'soyo',defenderId:'dark_soyo',finalDamage:999,hit:true});ui.showEndScreen();});await page.getByRole('button',{name:'进入第五章',exact:true}).click();await page.waitForFunction(()=>MYGO_UI.game.stage===5&&MYGO_UI.chapterOpen);await page.keyboard.press('Enter');await page.waitForFunction(()=>document.getElementById('chapter-intro').hidden);
  if(name==='index.html'){
   await page.setViewportSize({width:390,height:844});await page.waitForTimeout(2200);await page.screenshot({path:path.join(shots,'chapter-05-mobile.png')});assert.equal(await page.evaluate(()=>MYGO_UI.game.stage),5);
  }
  assert.deepEqual(errors,[],name);assert.deepEqual(missing,[],name);console.log(name+': PASS (chapter entry, art loads, real key battles, both chest actions, gold, save/restore, boss battle, dual loot, victory, fourth-to-fifth'+(name==='standalone.html'?', offline':', mobile')+')');await page.close();
 }
 for(const name of ['index.html','standalone.html']){
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(require('url').pathToFileURL(path.join(root,name)).href);await page.waitForFunction(()=>window.MYGO_ENTRY);await page.locator('[data-entry-action="chapter5"]').click();
  await page.waitForFunction(()=>MYGO_UI.game.stage===5&&MYGO_UI.chapterOpen);assert.equal(await page.evaluate(()=>Object.keys(MyGO.WatercourtArt.images).length),4);assert.deepEqual(errors,[]);await page.close();console.log(name+': file:// direct-open PASS');
 }
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
