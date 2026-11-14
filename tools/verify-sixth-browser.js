/* Isolated production UI verification; combat stats/positions are fixtures. */
'use strict';
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('node:assert/strict');const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),shots=path.join(root,'docs/previews');
const server=http.createServer((req,res)=>{const f=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'')||'index.html');if(!f.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(f,(e,b)=>{if(e){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg'})[path.extname(f)]||'application/octet-stream');res.end(b);});});
async function clickCell(page,x,y){const p=await page.evaluate(({x,y})=>{const ui=MYGO_UI,p=MyGO.MapProjection.project(ui.renderer.projection,(x+.5)*32,(y+.5)*32),r=ui.dom.board.getBoundingClientRect();return{x:r.left+p.x/ui.renderer.logicalWidth*r.width,y:r.top+p.y/ui.renderer.logicalHeight*r.height};},{x,y});await page.mouse.click(p.x,p.y);}
async function closeReports(page){for(let i=0;i<80;i++){
 const s=await page.evaluate(()=>({battle:MYGO_UI.battle.running,report:!MYGO_UI.dom.overlayRoot.hidden&&!!document.querySelector('.exchange-card,.growth-modal'),escape:MYGO_UI.game._courtFx?.kind==='escape',busy:MYGO_UI.busy}));
 if(s.escape)return;if(s.battle)await page.evaluate(()=>MYGO_UI.battle.skip());else if(s.report)await page.locator('[data-confirm]').click();else if(!s.busy)throw Error('combat ended without retreat');await page.waitForTimeout(120);
 }throw Error('combat report timeout');}
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true,channel:'msedge'});
try{for(const name of ['index.html','standalone.html']){
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],missing=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)missing.push(r.url());});
 if(name==='standalone.html')await page.route('**/*',r=>r.request().url().startsWith(base+'/'+name)?r.continue():r.abort());
 await page.goto(base+'/'+name);await page.waitForFunction(()=>window.MYGO_ENTRY);await page.locator('[data-entry-action="chapter6"]').click();await page.waitForFunction(()=>MYGO_UI.chapterOpen&&MYGO_UI.game.stage===6);await page.keyboard.press('Enter');await page.waitForFunction(()=>document.getElementById('chapter-intro').hidden);await page.waitForTimeout(1600);
 assert.equal(await page.evaluate(()=>Object.keys(MyGO.MaskedCourtArt.images).length),7);assert((await page.locator('#objective-text').innerText()).includes('0/4'));assert.equal(await page.evaluate(()=>MYGO_UI.game.livingCount('enemy')),3);
 if(name==='index.html')await page.screenshot({path:path.join(shots,'chapter-06-browser-map.png')});
 // Move the vanguard to the first trigger using the real movement/action controls.
 await page.evaluate(()=>{const ui=MYGO_UI;for(const id of ['avenue-sentry-blade','avenue-sentry-bow'])Object.assign(ui.game.getUnit(id),{dead:true,hp:0});const u=ui.game.getUnit('tomori');ui.game.setUnitPosition(u.id,14,34);ui.renderer.snapUnit(u);ui.resetSelection();ui.updateAll();ui.selectUnit(u);});
 await clickCell(page,14,32);await page.waitForFunction(()=>MYGO_UI.mode==='action'&&!MYGO_UI.busy);await page.getByRole('button',{name:/^待机/}).click();
 await page.evaluate(()=>{window.__sixthEnd=MYGO_UI.endTurn();});await page.waitForFunction(()=>MYGO_UI.game._courtFx?.kind==='summon');await page.waitForTimeout(1450);
 assert(await page.evaluate(()=>MYGO_UI.dom.overlayRoot.hidden));assert.equal(await page.locator('.court-cinematic').count(),0);
 assert.equal(await page.evaluate(()=>MYGO_UI.game.summonedWaves.length),1);assert(await page.evaluate(()=>MYGO_UI.game.getUnit('masked_stranger')._casting>0));assert(await page.evaluate(()=>MYGO_UI.game.getUnit('mask-summon-1-1')._summonAlpha>0));
 if(name==='index.html')await page.screenshot({path:path.join(shots,'chapter-06-browser-summon.png')});
 await page.getByRole('button',{name:'跳过演出 · Enter / Esc',exact:true}).click();await page.waitForFunction(()=>MYGO_UI.game.turn===2&&!MYGO_UI.busy);assert.equal(await page.evaluate(()=>MYGO_UI.game.getUnit('tomori').hp),await page.evaluate(()=>MYGO_UI.game.getUnit('tomori').maxHp));
 const pendingSnapshot=await page.evaluate(()=>{const ui=MYGO_UI,s=JSON.parse(JSON.stringify(ui.game.serialize()));ui.loadSnapshot({snapshot:s,savedAt:new Date().toISOString()});return ui.game.summonedWaves.length;});assert.equal(pendingSnapshot,1);
 // Real target click, cut-in, battle and report confirmation, followed by retreat.
 await page.evaluate(()=>{const ui=MYGO_UI,a=ui.game.getUnit('soyo'),b=ui.game.getUnit('masked_stranger');Object.assign(a,{x:14,y:6,acted:false,mag:100,dex:120,lck:0,exp:0});b.hp=6;b.lck=0;ui.renderer.snapUnit(a);ui.resetSelection();ui.updateAll();ui.selectUnit(a);ui.enterActionMode();ui.enterAttackMode();});
 await clickCell(page,14,4);await page.waitForFunction(()=>MYGO_UI.battle.running);assert(await page.evaluate(()=>MYGO_UI.battle.result.hpAfter===1));
 if(name==='index.html'){await page.waitForTimeout(350);await page.screenshot({path:path.join(shots,'chapter-06-browser-battle.png')});}
 await closeReports(page);await page.waitForTimeout(1500);assert(await page.evaluate(()=>MYGO_UI.game.maskRetreatPending&&!MYGO_UI.game.isOver()&&MYGO_UI.game.getUnit('masked_stranger').hp===1&&!MYGO_UI.game.getUnit('masked_stranger').dead));assert((await page.evaluate(()=>MYGO_UI.dom.contextText.textContent)).includes('留你们一命。'));assert(await page.evaluate(()=>MYGO_UI.dom.overlayRoot.hidden));
 const savedPending=await page.evaluate(()=>JSON.parse(JSON.stringify(MYGO_UI.game.serialize())));
 if(name==='index.html')await page.screenshot({path:path.join(shots,'chapter-06-browser-teleport.png')});
 await page.waitForFunction(()=>MYGO_UI.game.phase==='victory'&&MYGO_UI.endShown);assert(await page.evaluate(()=>MYGO_UI.game.maskEscaped&&MYGO_UI.game.getUnit('masked_stranger').escaped&&!MYGO_UI.game.getUnit('masked_stranger').dead&&MYGO_UI.game.unitAt(14,4)===null));assert((await page.locator('#overlay-card').innerText()).includes('王座已空'));assert.equal(await page.locator('[data-end-next]').count(),1);
 if(name==='index.html')await page.screenshot({path:path.join(shots,'chapter-06-browser-victory.png')});
 // Loading the interrupted retreat resumes the scene and finishes exactly once.
 await page.evaluate(s=>MYGO_UI.loadSnapshot({snapshot:s,savedAt:new Date().toISOString()}),savedPending);await page.waitForFunction(()=>MYGO_UI.game._courtFx?.kind==='escape');await page.keyboard.press('Enter');await page.waitForFunction(()=>MYGO_UI.game.phase==='victory'&&MYGO_UI.endShown);
 await page.evaluate(()=>{const ui=MYGO_UI;ui.closeOverlay();ui.newGame(57,5);ui.game.applyCombat({attackerId:'soyo',defenderId:'iron_warden',finalDamage:999,hit:true});ui.showEndScreen();});await page.getByRole('button',{name:'进入第六章',exact:true}).click();await page.waitForFunction(()=>MYGO_UI.game.stage===6&&MYGO_UI.chapterOpen);await page.keyboard.press('Enter');await page.waitForFunction(()=>document.getElementById('chapter-intro').hidden);
 if(name==='index.html'){await page.setViewportSize({width:390,height:844});await page.waitForTimeout(1800);await page.screenshot({path:path.join(shots,'chapter-06-mobile.png')});}
 assert.deepEqual(errors,[],name);assert.deepEqual(missing,[],name);console.log(name+': PASS (entry, art, real move, end-turn summoning, battle lock, natural teleport, pending restore, fifth-to-sixth'+(name==='standalone.html'?', offline':', mobile')+')');await page.close();
}
for(const name of ['index.html','standalone.html']){const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(require('url').pathToFileURL(path.join(root,name)).href);await page.waitForFunction(()=>window.MYGO_ENTRY);await page.locator('[data-entry-action="chapter6"]').click();await page.waitForFunction(()=>MYGO_UI.game.stage===6&&MYGO_UI.chapterOpen);assert.equal(await page.evaluate(()=>Object.keys(MyGO.MaskedCourtArt.images).length),7);assert.deepEqual(errors,[]);await page.close();console.log(name+': file:// direct-open PASS');}
}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
