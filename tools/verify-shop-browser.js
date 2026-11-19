/* Browser acceptance for ten-chapter shop progression; isolated game contexts. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),version=JSON.parse(fs.readFileSync(path.join(root,'version.json'),'utf8')).version;
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1)||'index.html');
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(error,bytes)=>{
    if(error){res.writeHead(404).end();return;}
    res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg'})[path.extname(file)]||'application/octet-stream');res.end(bytes);
  });
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true,channel:'msedge'});
  try{
    for(const name of ['index.html','standalone.html']){
      const page=await browser.newPage({viewport:{width:1360,height:768}}),errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      if(name==='standalone.html')await page.route('**/*',r=>r.request().url()===base+'/'+name?r.continue():r.abort());
      await page.goto(base+'/'+name,{waitUntil:'load'});await page.waitForFunction(()=>window.MYGO_ENTRY?.shop);
      assert.equal(await page.locator('[data-game-version]').innerText(),'游戏版本 · v'+version);
      await page.locator('[data-entry-action="shop"]').click();
      assert.equal(await page.locator('[data-shop-buy]').count(),18);
      assert.equal(await page.locator('[data-shop-buy="silver_sword"]').count(),0);
      assert.equal(await page.locator('[data-shop-buy="training_sword"]').count(),0);
      for(const id of ['iron_sword','leather_shield','beginner_seal','intermediate_seal','vulnerary'])assert(await page.locator('[data-shop-buy="'+id+'"]').isEnabled());
      for(const id of ['steel_sword','iron_shield','concoction','antitoxin'])assert(await page.locator('[data-shop-buy="'+id+'"]').isDisabled());
      assert((await page.locator('[data-shop-buy="antitoxin"]').locator('..').innerText()).includes('第 6 关通关后开放'));
      if(name==='index.html')await page.screenshot({path:path.join(root,'docs/previews/shop-early-v5243.png')});
      // Real chapter-six victory unlocks immediately, without crossing a chapter or resetting limits.
      await page.evaluate(()=>{
        const ui=MYGO_UI;ui.game=new MyGO.Game({stage:6,recruited:['xueyue','nina'],seed:1319});ui.game.gold=99999;
        ui.renderer.setGame(ui.game);MYGO_ENTRY.shop.render();
      });
      assert(await page.locator('[data-shop-buy="steel_sword"]').isDisabled());
      await page.locator('[data-quantity="intermediate_seal"]').fill('3');await page.locator('[data-shop-buy="intermediate_seal"]').click();
      assert(await page.locator('[data-shop-buy="intermediate_seal"]').isDisabled());
      await page.evaluate(()=>{
        const g=MYGO_UI.game;g.applyCombat({attackerId:'soyo',defenderId:'masked_stranger',hit:true,finalDamage:999});
        if(!g.finishMaskedEscape())throw Error('Chapter six did not complete');MYGO_ENTRY.shop.render();
      });
      assert(await page.locator('[data-shop-buy="intermediate_seal"]').isDisabled());
      for(const id of ['steel_sword','steel_lance','steel_axe','steel_bow','steel_gauntlets','iron_shield','concoction','antitoxin'])assert(await page.locator('[data-shop-buy="'+id+'"]').isEnabled());
      const gold=await page.evaluate(()=>MYGO_UI.game.gold);await page.locator('[data-shop-buy="steel_sword"]').click();
      assert.equal(await page.evaluate(()=>MYGO_UI.game.gold),gold-910);
      assert.equal(await page.evaluate(()=>MYGO_UI.game.convoy.at(-1).id),'steel_sword');
      await page.locator('[data-shop-category="medicine"]').click();
      assert.equal(await page.locator('[data-shop-buy]').count(),3);
      if(name==='index.html')await page.screenshot({path:path.join(root,'docs/previews/shop-cleared-six-v5243.png')});
      await page.evaluate(()=>{
        const ui=MYGO_UI,s=ui.game.serialize(),g=new MyGO.Game();g.restore(s);
        if(g.shopPurchases.intermediate_seal!==3||!MyGO.Shop.steelUnlocked(g))throw Error('Shop save restore mismatch');
        ui.game=new MyGO.Game({stage:7,recruited:g.recruited,loadout:g.exportLoadout()});ui.renderer.setGame(ui.game);
        MYGO_ENTRY.shop.category='seal';MYGO_ENTRY.shop.render();
      });
      assert(await page.locator('[data-shop-buy="intermediate_seal"]').isEnabled());
      assert.equal(await page.locator('[data-shop-buy]').count(),2);
      await page.evaluate(()=>{
        const ui=MYGO_UI;ui.game=new MyGO.Game({stage:11,seed:1319});ui.game.gold=99999;
        ui.renderer.setGame(ui.game);MYGO_ENTRY.shop.category='all';MYGO_ENTRY.shop.render();
      });
      assert(await page.locator('[data-shop-buy="steel_sword"]').isEnabled());
      assert.equal(await page.locator('[data-shop-buy="advanced_seal"]').count(),0);
      assert.equal(await page.locator('[data-shop-buy="silver_sword"]').count(),0);
      await page.locator('[data-shop-close]').click();assert(await page.locator('#shop-screen').isHidden());
      assert.deepEqual(errors,[]);await page.close();
      console.log(name+': v'+version+', early shelves, actual chapter-six clear, purchase, limits, save, chapter-seven restock and chapter-ten gates passed.');
    }
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
