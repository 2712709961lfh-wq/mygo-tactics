'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),root=path.resolve(__dirname,'..');
const {version}=require('../version.json');
const server=http.createServer((req,res)=>{const file=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'')||'index.html');if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(e,b)=>{if(e){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg'})[path.extname(file)]||'application/octet-stream');res.end(b);});});
async function bounded(page){assert(await page.evaluate(()=>{const r=document.getElementById('unit-commands'),f=r.parentElement;return !r.hidden&&r.offsetLeft>=0&&r.offsetTop>=0&&r.offsetLeft+r.offsetWidth<=f.clientWidth&&r.offsetTop+r.offsetHeight<=f.clientHeight;}),'commands stay inside battlefield');}
async function mapSelection(page) {
 assert(await page.locator('#unit-commands').isHidden());
 assert(await page.locator('#info-side #action-buttons').isVisible());
 assert.equal(await page.locator('#board-frame .board-tools').count(),0);
 assert.equal(await page.locator('#board-frame #toast').count(),0);
 const cells=await page.evaluate(()=>{
   const ui=MYGO_UI, board=ui.dom.board;
   const rect=board.getBoundingClientRect(), clip=ui.dom.boardViewport.getBoundingClientRect();
   const rotated=document.getElementById('game-shell').dataset.rotated==='true';
   const records=ui.mode==='warp'?ui.pendingWarp.cells:[...ui.reachable.values()].filter(r=>r.stoppable);
   const tile=MyGO.CONFIG.TILE;
   return records.map(({x,y})=>{
     const point=MyGO.MapProjection.project(ui.renderer.projection,(x+.5)*tile,(y+.5)*tile);
     const nx=point.x/ui.renderer.logicalWidth, ny=point.y/ui.renderer.logicalHeight;
     const px=rect.left+(rotated?1-ny:nx)*rect.width, py=rect.top+(rotated?nx:ny)*rect.height;
     return {x,y,px,py,clear:document.elementFromPoint(px,py)===board};
   }).filter(c=>c.px>clip.left+2&&c.px<clip.right-2&&c.py>clip.top+2&&c.py<clip.bottom-2);
 });
 assert(cells.length>0,'at least one valid tile is visible');
 assert(cells.every(c=>c.clear),'all visible selectable tile centers receive pointer input');
 return cells;
}
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,channel:'msedge'}),base='http://127.0.0.1:'+server.address().port;
try{for(const name of ['index.html','standalone.html']){
 const page=await browser.newPage({viewport:{width:1360,height:768}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const preview=async label=>{
   if(name==='index.html'&&process.env.MYGO_UI_SCREENSHOTS)await page.screenshot({path:path.join(process.env.MYGO_UI_SCREENSHOTS,'ui-v'+version+'-'+label+'.png')});
 };
 if(name==='standalone.html')await page.route('**/*',r=>r.request().url()===base+'/'+name?r.continue():r.abort());
 await page.goto(base+'/'+name);await page.waitForFunction(()=>window.MYGO_ENTRY&&window.MYGO_UI);
 assert.equal(await page.locator('[data-game-version]').innerText(),'游戏版本 · v'+version);
 await page.locator('[data-entry-action="formation"]').click();
 assert.equal(await page.locator('.sheet-column').count(),3);
 assert.equal(await page.locator('.sheet-skill[open]').count(),0);
 assert(!(await page.locator('#formation-detail').innerText()).includes('未说出口的话'));
 await page.locator('.sheet-skill summary').first().click();assert.equal(await page.locator('.sheet-skill[open]').count(),1);
 await page.locator('.sheet-skill summary').nth(1).click();assert.equal(await page.locator('.sheet-skill[open]').count(),1);
 assert(await page.evaluate(()=>{const d=document.getElementById('formation-detail');return d.scrollWidth<=d.clientWidth+1&&[...d.querySelectorAll('.sheet-column')].every(c=>c.scrollWidth<=c.clientWidth+1);}),'status sheet has no horizontal overflow');
 await page.locator('.sheet-skill[open] summary').click();
 assert(await page.evaluate(()=>{const c=document.querySelector('.sheet-person');return c.scrollHeight<=c.clientHeight+1;}),'all basic stats fit without scrolling');
 await preview('status');
 await page.locator('[data-loadout-tab="bag"]').click();assert(await page.locator('.bag-slots').isVisible());
 await page.locator('[data-loadout-tab="stats"]').click();assert.equal(await page.locator('.sheet-column').count(),3);
 await page.locator('[data-formation-close]').click();await page.locator('[data-entry-action="start"]').click();await page.keyboard.press('Enter');await page.waitForFunction(()=>MYGO_UI.dom.chapterIntro.hidden);await page.waitForFunction(()=>MYGO_UI.dom.turnBanner.hidden&&MYGO_UI.dom.toast.hidden);
 await page.locator('[data-party-id="tomori"]').click();
 const origin=await page.evaluate(()=>MYGO_UI.origin);
 const landing=(await mapSelection(page)).filter(c=>c.x>origin.x).sort((a,b)=>b.x-a.x)[0];
 assert(landing,'a landing tile on the former menu side is visible');
 await page.mouse.move(landing.px,landing.py);
 assert.deepEqual(await page.evaluate(()=>MYGO_UI.previewPath.at(-1)),{x:landing.x,y:landing.y});
 await preview('move');
 await page.mouse.click(landing.px,landing.py);
 await page.waitForFunction(()=>MYGO_UI.mode==='action'&&!MYGO_UI.busy);await bounded(page);
 assert(await page.evaluate(({x,y})=>{const u=MYGO_UI.game.getUnit(MYGO_UI.activeId);return u.x===x&&u.y===y;},landing));
 assert(await page.locator('#action-buttons').evaluate(e=>e.closest('#unit-commands')!==null));
 await preview('actions');
 const moved=await page.evaluate(()=>{const u=MYGO_UI.game.getUnit(MYGO_UI.activeId);return {x:u.x,y:u.y,origin:MYGO_UI.origin};});
 const menu=page.locator('#command-actions');
 assert.equal(await menu.locator('.attack, .heal-action, .dance-action').count(),0);
 await menu.getByRole('button',{name:'装备',exact:true}).click();
 assert(await page.locator('#command-picker [data-equip-choice].is-equipped').isVisible());
 assert.equal(await page.locator('#command-picker [data-support-choice]').count(),0);
 assert(await page.locator('#overlay-root').isHidden());await bounded(page);
 await preview('weapons');
 await page.keyboard.press('Escape');assert(await page.locator('#command-picker').isHidden());assert.equal(await page.evaluate(()=>MYGO_UI.moved),true);
 await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>MYGO_UI.mode),'move');
 assert(await page.evaluate(o=>{const u=MYGO_UI.game.getUnit(MYGO_UI.activeId);return u.x===o.x&&u.y===o.y;},moved.origin));
 await mapSelection(page);
 await page.evaluate(()=>MYGO_UI.setZoom(2.2));
 await page.setViewportSize({width:390,height:844});
 await page.waitForFunction(()=>document.getElementById('game-shell').dataset.rotated==='true');
 await page.evaluate(({x,y})=>MYGO_UI.revealCell(x,y),origin);
 await mapSelection(page);
 await page.locator('#info-side button').filter({hasText:'原地行动'}).click();
 assert.equal(await page.evaluate(()=>MYGO_UI.mode),'action');
 await page.setViewportSize({width:1360,height:768});await page.evaluate(()=>MYGO_UI.setZoom(1));
 // A reachable target for the spare weapon enables Attack. Equipment changes at settlement.
 await page.evaluate(()=>{
   const ui=MYGO_UI,u=ui.game.getUnit('tomori'),e=ui.game.getUnit('shadow_axe');
   const cell=[{x:u.x+2,y:u.y},{x:u.x-2,y:u.y},{x:u.x,y:u.y+2},{x:u.x,y:u.y-2}]
     .find(c=>MyGO.Grid.inBounds(ui.game.map,c.x,c.y)&&!ui.game.unitAt(c.x,c.y));
   Object.assign(e,cell,{hp:200,maxHp:200});ui.renderer.snapUnit(e);
   u.inventory.push(MyGO.Inventory.make('levin_sword'));ui.enterActionMode();
 });
 const equipped=await page.evaluate(()=>MYGO_UI.game.getUnit('tomori').equippedWeapon);
 assert.deepEqual(await menu.locator('button').allTextContents().then(items=>items.slice(0,2)),['攻击›','装备›']);
 await menu.locator('.attack').click();
 assert.equal(await page.locator('[data-attack-choice]').count(),1);
 await page.locator('[data-attack-choice="levin_sword"]').click();
 assert.equal(await page.evaluate(()=>MYGO_UI.mode),'attack');assert(await page.locator('#overlay-root').isHidden());
 assert(await page.locator('#unit-commands').isHidden());
 assert(await page.locator('#info-side #action-buttons').getByRole('button',{name:'返回行动'}).isVisible());
 await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>MYGO_UI.mode),'action');
 assert.equal(await page.evaluate(()=>MYGO_UI.game.getUnit('tomori').equippedWeapon),equipped);

 await menu.locator('.attack').click();
 await page.locator('[data-attack-choice="levin_sword"]').click();
 await page.evaluate(()=>{
   const ui=MYGO_UI,e=ui.game.getUnit('shadow_axe');
   ui.showCutin=async()=>{}; // Skip animation while keeping the real attack and settlement handlers.
   void ui.playerAttack(e);
 });
 const settle=page.locator('#overlay-card [data-confirm]').filter({hasText:'确认结算'});
 await settle.waitFor();
 assert.equal(await page.evaluate(()=>MYGO_UI.game.getUnit('tomori').equippedWeapon),equipped);
 await settle.click();
 await page.waitForFunction(()=>!MYGO_UI.busy&&MYGO_UI.mode==='idle');
 assert.deepEqual(await page.evaluate(()=>{
   const game=MYGO_UI.game,u=game.getUnit('tomori'),e=game.getUnit('shadow_axe');
   const weapon=u.inventory.find(i=>i.id==='levin_sword');
   return {equipped:u.equippedWeapon,counter:MyGO.Combat.forecast(e,u,game.map).canCounter,
     spent:weapon.uses<MyGO.Inventory.item(weapon.id).uses,acted:u.acted};
 }),{equipped:'levin_sword',counter:true,spent:true,acted:true});
 await page.evaluate(()=>{
   const ui=MYGO_UI,u=ui.game.getUnit('tomori');delete ui.showCutin;
   u.acted=false;ui.selectUnit(u);ui.enterActionMode();
 });
 await menu.locator('.equip-action').click();
 await page.locator('[data-equip-choice="'+equipped+'"]').click();
 assert.deepEqual(await page.evaluate(()=>{
   const game=MYGO_UI.game,u=game.getUnit('tomori'),e=game.getUnit('shadow_axe');
   return {equipped:u.equippedWeapon,counter:MyGO.Combat.forecast(e,u,game.map).canCounter,acted:u.acted};
 }),{equipped,counter:false,acted:false});
 await page.evaluate(()=>{
   const ui=MYGO_UI,u=ui.game.getUnit('tomori'),e=ui.game.getUnit('shadow_axe');
   const cell=[{x:u.x+1,y:u.y},{x:u.x-1,y:u.y},{x:u.x,y:u.y+1},{x:u.x,y:u.y-1}]
     .find(c=>MyGO.Grid.inBounds(ui.game.map,c.x,c.y)&&!ui.game.unitAt(c.x,c.y));
   Object.assign(e,cell);ui.renderer.snapUnit(e);ui.enterActionMode();
 });
 // Scroll and rotate while the same selection is active.
 await page.evaluate(()=>MYGO_UI.setZoom(2.2));await page.waitForTimeout(100);await bounded(page);
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);await bounded(page);
 assert.equal(await page.locator('#game-shell').getAttribute('data-rotated'),'true');
 await preview('portrait');
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
 await page.evaluate(()=>{const ui=MYGO_UI,u=ui.game.getUnit('soyo');u.learnedSpells.push('warp');u.spellUses.warp=1;u.mag=20;ui.enterActionMode();});
 await menu.locator('.support-action').click();
 assert.equal(await page.locator('[data-support-choice="heal"]').count(),0);
 await page.locator('[data-support-choice="warp"]').click();
 await page.locator('[data-support-target="tomori"]').click();
 const warp=(await mapSelection(page))[0];
 await page.mouse.click(warp.px,warp.py);
 await page.keyboard.press('Escape');
 assert(await page.locator('#overlay-root').isHidden());
 assert.equal(await page.evaluate(()=>MYGO_UI.mode),'warp');
 await page.mouse.click(warp.px,warp.py);
 await page.locator('#overlay-root [data-support-back]').click();
 assert(await page.locator('#command-picker [data-support-target="tomori"]').isVisible());
 await page.keyboard.press('Escape');
 await page.keyboard.press('Escape');
 await menu.locator('.heal-action').click();
 assert.equal(await page.locator('[data-support-choice="warp"]').count(),0);
 await page.locator('[data-support-choice="heal"]').click();assert(await page.locator('[data-support-target="tomori"]').isVisible());assert(await page.locator('#overlay-root').isHidden());
 await page.keyboard.press('Escape');assert(await page.locator('[data-support-choice="heal"]').isVisible());
 await page.locator('[data-support-choice="heal"]').click();await page.locator('[data-support-target="tomori"]').click();assert(await page.locator('[data-cast-confirm]').isVisible());
 await page.locator('[data-cast-confirm]').click();await page.waitForFunction(()=>!MYGO_UI.busy&&MYGO_UI.mode==='idle');assert.equal(await page.evaluate(()=>MYGO_UI.game.getUnit('soyo').spellUses.heal),9);assert.equal(await page.evaluate(()=>MYGO_UI.game.getUnit('soyo').acted),true);
 // Dance is a separate command for dancers, and refreshes a spent adjacent ally.
 await page.evaluate(()=>{
   const ui=MYGO_UI,u=ui.game.getUnit('anon'),t=ui.game.getUnit('tomori');
   const cell=[{x:t.x+1,y:t.y},{x:t.x-1,y:t.y},{x:t.x,y:t.y+1},{x:t.x,y:t.y-1}]
     .find(c=>MyGO.Grid.inBounds(ui.game.map,c.x,c.y)&&!ui.game.unitAt(c.x,c.y));
   Object.assign(u,cell,{classId:'dancer'});ui.renderer.snapUnit(u);
   ui.selectUnit(u);ui.enterActionMode();
 });
 await menu.getByRole('button',{name:'跳舞',exact:true}).click();
 assert.equal(await page.locator('[data-mastery-action="dance"]').count(),0);
 await page.locator('[data-mastery-target="tomori"]').click();
 await page.waitForFunction(()=>!MYGO_UI.busy&&MYGO_UI.mode==='idle');
 assert(await page.evaluate(()=>MYGO_UI.game.getUnit('anon').acted&&!MYGO_UI.game.getUnit('tomori').acted));
 await page.evaluate(()=>MYGO_UI.resetSelection());assert(await page.locator('#unit-commands').isHidden());
 assert(await page.locator('#info-side #action-buttons').isVisible(),'idle actions return to the information panel');

 // Reproduce the reported map and unit. Use real clicks before and after undo.
 await page.waitForFunction(()=>MYGO_UI.dom.toast.hidden);
 await page.evaluate(()=>{
   const game=new MyGO.Game({seed:42,stage:5,recruited:['xueyue','nina']});
   MYGO_UI.loadSnapshot({snapshot:game.serialize(),savedAt:new Date().toISOString()});
   MYGO_UI.setZoom(1.6,false);
 });
 await page.locator('[data-party-id="xueyue"]').click();
 const start=await page.evaluate(()=>MYGO_UI.origin);
 const east=(await mapSelection(page)).filter(c=>c.x>start.x).sort((a,b)=>b.x-a.x)[0];
 assert(east,'Xueyue can reach a tile toward the bridges');
 await page.mouse.move(east.px,east.py);
 await preview('chapter5-move');
 await page.mouse.click(east.px,east.py);
 await page.waitForFunction(()=>MYGO_UI.mode==='action'&&!MYGO_UI.busy);
 await bounded(page);
 await preview('chapter5-actions');
 await page.keyboard.press('Escape');
 const own=(await mapSelection(page)).find(c=>c.x===start.x&&c.y===start.y);
 assert(own,'the original tile is visible after undo');
 await page.mouse.click(own.px,own.py);
 await page.waitForFunction(()=>MYGO_UI.mode==='action'&&!MYGO_UI.moved);

 assert.deepEqual(errors,[]);console.log(name+': movement hit testing, path preview, weapons, targeting, warp, undo, zoom, portrait, status and console passed');await page.close();
}}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
