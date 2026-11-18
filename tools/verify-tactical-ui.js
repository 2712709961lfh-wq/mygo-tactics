'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),root=path.resolve(__dirname,'..'),shots=path.join(root,'docs/previews');
const server=http.createServer((req,res)=>{const file=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'')||'index.html');if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(e,b)=>{if(e){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg'})[path.extname(file)]||'application/octet-stream');res.end(b);});});
async function bounded(page){assert(await page.evaluate(()=>{const r=document.getElementById('unit-commands'),f=r.parentElement;return !r.hidden&&r.offsetLeft>=0&&r.offsetTop>=0&&r.offsetLeft+r.offsetWidth<=f.clientWidth&&r.offsetTop+r.offsetHeight<=f.clientHeight;}),'commands stay inside battlefield');}
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,channel:'msedge'}),base='http://127.0.0.1:'+server.address().port;
try{for(const name of ['index.html','standalone.html']){
 const page=await browser.newPage({viewport:{width:1360,height:768}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 if(name==='standalone.html')await page.route('**/*',r=>r.request().url()===base+'/'+name?r.continue():r.abort());
 await page.goto(base+'/'+name);await page.waitForFunction(()=>window.MYGO_ENTRY&&window.MYGO_UI);
 assert((await page.locator('[data-game-version]').innerText()).includes('5.19.0'));
 await page.locator('[data-entry-action="formation"]').click();
 assert.equal(await page.locator('.sheet-column').count(),3);
 assert.equal(await page.locator('.sheet-skill[open]').count(),0);
 assert(!(await page.locator('#formation-detail').innerText()).includes('未说出口的话'));
 await page.locator('.sheet-skill summary').first().click();assert.equal(await page.locator('.sheet-skill[open]').count(),1);
 await page.locator('.sheet-skill summary').nth(1).click();assert.equal(await page.locator('.sheet-skill[open]').count(),1);
 assert(await page.evaluate(()=>{const d=document.getElementById('formation-detail');return d.scrollWidth<=d.clientWidth+1&&[...d.querySelectorAll('.sheet-column')].every(c=>c.scrollWidth<=c.clientWidth+1);}),'status sheet has no horizontal overflow');
 await page.locator('.sheet-skill[open] summary').click();
 assert(await page.evaluate(()=>{const c=document.querySelector('.sheet-person');return c.scrollHeight<=c.clientHeight+1;}),'all basic stats fit without scrolling');
 if(name==='index.html')await page.screenshot({path:path.join(shots,'ui-v519-status.png')});
 await page.locator('[data-loadout-tab="bag"]').click();assert(await page.locator('.bag-slots').isVisible());
 await page.locator('[data-loadout-tab="stats"]').click();assert.equal(await page.locator('.sheet-column').count(),3);
 await page.locator('[data-formation-close]').click();await page.locator('[data-entry-action="start"]').click();await page.keyboard.press('Enter');await page.waitForFunction(()=>MYGO_UI.dom.chapterIntro.hidden);await page.waitForFunction(()=>MYGO_UI.dom.turnBanner.hidden&&MYGO_UI.dom.toast.hidden);
 // Move through the real renderer and rules, then exercise the actual buttons.
 await page.evaluate(async()=>{const ui=MYGO_UI,u=ui.game.getUnit('tomori');ui.selectUnit(u);const record=[...ui.reachable.values()].find(r=>r.stoppable&&(r.x!==u.x||r.y!==u.y));if(!record)throw Error('no move');await ui.moveActiveTo(record.x,record.y);});
 await page.waitForFunction(()=>MYGO_UI.mode==='action'&&!MYGO_UI.busy);await bounded(page);
 assert(await page.locator('#action-buttons').evaluate(e=>e.closest('#unit-commands')!==null));
 if(name==='index.html')await page.screenshot({path:path.join(shots,'ui-v519-actions.png')});
 const moved=await page.evaluate(()=>{const u=MYGO_UI.game.getUnit(MYGO_UI.activeId);return {x:u.x,y:u.y,origin:MYGO_UI.origin};});
 await page.locator('#action-buttons .attack').click();assert(await page.locator('#command-picker').isVisible());assert(await page.locator('#overlay-root').isHidden());await bounded(page);
 if(name==='index.html')await page.screenshot({path:path.join(shots,'ui-v519-weapons.png')});
 await page.keyboard.press('Escape');assert(await page.locator('#command-picker').isHidden());assert.equal(await page.evaluate(()=>MYGO_UI.moved),true);
 await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>MYGO_UI.mode),'move');
 assert(await page.evaluate(o=>{const u=MYGO_UI.game.getUnit(MYGO_UI.activeId);return u.x===o.x&&u.y===o.y;},moved.origin));
 // Put an enemy in range to verify weapon -> target without another action click.
 await page.evaluate(()=>{const ui=MYGO_UI,u=ui.game.getUnit('tomori'),e=ui.game.getUnit('shadow_axe');const cell=[{x:u.x+1,y:u.y},{x:u.x-1,y:u.y},{x:u.x,y:u.y+1},{x:u.x,y:u.y-1}].find(c=>MyGO.Grid.inBounds(ui.game.map,c.x,c.y)&&!ui.game.unitAt(c.x,c.y));Object.assign(e,cell);ui.renderer.snapUnit(e);ui.enterActionMode();});
 await page.locator('#action-buttons .attack').click();await page.locator('[data-attack-choice]').first().click();assert.equal(await page.evaluate(()=>MYGO_UI.mode),'attack');assert(await page.locator('#overlay-root').isHidden());
 await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>MYGO_UI.mode),'action');
 // Scroll and rotate while the same selection is active.
 await page.evaluate(()=>MYGO_UI.setZoom(2.2));await page.waitForTimeout(100);await bounded(page);
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);await bounded(page);
 assert.equal(await page.locator('#game-shell').getAttribute('data-rotated'),'true');
 if(name==='index.html')await page.screenshot({path:path.join(shots,'ui-v519-portrait.png')});
 await page.setViewportSize({width:1360,height:768});await page.evaluate(()=>MYGO_UI.setZoom(1));
 // Class arts use the same local menu and lead directly to map targeting.
 await page.evaluate(()=>{const ui=MYGO_UI,u=ui.game.getUnit(ui.activeId);u.classId='swordmaster';u.classXp.swordmaster=MyGO.Mastery.get('swordmaster').required;ui.enterActionMode();});
 await page.getByRole('button',{name:/^职业战技/}).click();assert(await page.locator('#command-picker').isVisible());assert(await page.locator('#overlay-root').isHidden());
 await page.locator('[data-mastery-action="astra"]').click();assert.equal(await page.evaluate(()=>MYGO_UI.mode),'attack');assert.equal(await page.evaluate(()=>MyGO.Mastery.selectedArt(MYGO_UI.game.getUnit(MYGO_UI.activeId)).id),'astra');
 await page.keyboard.press('Escape');
 // Medicine consumes one action and closes the local menu.
 await page.evaluate(()=>{const ui=MYGO_UI,u=ui.game.getUnit(ui.activeId);u.hp-=10;u.inventory.push(MyGO.Inventory.make('vulnerary'));ui.enterActionMode();});
 await page.getByRole('button',{name:'使用药品',exact:true}).click();assert(await page.locator('#overlay-root').isHidden());await page.locator('[data-battle-medicine]').click();assert.equal(await page.evaluate(()=>MYGO_UI.game.getUnit('tomori').acted),true);assert(await page.locator('#unit-commands').isHidden());
 // Support targeting and backing out stay local; confirmation uses existing rules.
 await page.evaluate(()=>{const ui=MYGO_UI,u=ui.game.getUnit('soyo'),t=ui.game.getUnit('tomori');t.hp-=6;const c=[{x:t.x+1,y:t.y},{x:t.x-1,y:t.y},{x:t.x,y:t.y+1},{x:t.x,y:t.y-1}].find(c=>MyGO.Grid.inBounds(ui.game.map,c.x,c.y)&&!ui.game.unitAt(c.x,c.y));Object.assign(u,c);if(!u.learnedSpells.includes('heal'))u.learnedSpells.push('heal');u.spellUses.heal=10;ui.renderer.snapUnit(u);ui.selectUnit(u);ui.enterActionMode();});
 await page.getByRole('button',{name:'武器 / 魔法',exact:false}).click();await page.locator('[data-support-choice="heal"]').click();assert(await page.locator('[data-support-target="tomori"]').isVisible());assert(await page.locator('#overlay-root').isHidden());
 await page.keyboard.press('Escape');assert(await page.locator('[data-support-choice="heal"]').isVisible());
 await page.locator('[data-support-choice="heal"]').click();await page.locator('[data-support-target="tomori"]').click();assert(await page.locator('[data-cast-confirm]').isVisible());
 await page.locator('[data-cast-confirm]').click();await page.waitForFunction(()=>!MYGO_UI.busy&&MYGO_UI.mode==='idle');assert.equal(await page.evaluate(()=>MYGO_UI.game.getUnit('soyo').spellUses.heal),9);assert.equal(await page.evaluate(()=>MYGO_UI.game.getUnit('soyo').acted),true);
 await page.evaluate(()=>MYGO_UI.resetSelection());assert(await page.locator('#unit-commands').isHidden());
 assert(await page.locator('#info-side #action-buttons').isVisible(),'idle actions return to the information panel');
 assert.deepEqual(errors,[]);console.log(name+': status, tabs, move, weapons, class arts, medicine, support, targeting, Esc undo, zoom, portrait, version and console passed');await page.close();
}}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
