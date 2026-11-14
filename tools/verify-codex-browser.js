/* Real browser acceptance for catalogue art, filters, classes and offline build.
 * NODE_PATH=<workspace runtime node_modules> node tools/verify-codex-browser.js
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),shots=path.join(root,'docs/previews');
const server=http.createServer((req,res)=>{
  const relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'');
  const file=path.resolve(root,relative||'index.html');
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(error,bytes)=>{
    if(error){res.writeHead(404).end();return;}
    const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg'};
    res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(bytes);
  });
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,channel:process.env.CODEX_BROWSER_CHANNEL||'msedge'});
  try{
    for(const name of ['index.html','standalone.html']){
      const page=await browser.newPage({viewport:{width:1360,height:768}}),errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      // Standalone must boot with every network request disabled after its HTML.
      if(name==='standalone.html')await page.route('**/*',route=>route.request().url()===base+'/'+name?route.continue():route.abort());
      await page.goto(base+'/'+name,{waitUntil:'load'});
      await page.waitForFunction(()=>window.MYGO_ENTRY&&window.MYGO_ENTRY.codex);
      if(name==='index.html')await page.screenshot({path:path.join(shots,'title-shop-v53.png')});
      await page.locator('[data-entry-action="equipment"]').click();
      assert.equal(await page.locator('.eq-card').count(),123);
      await page.locator('[data-eq-filter="edition"]').selectOption('all');
      assert.equal(await page.locator('.eq-card').count(),166);
      const art=await page.evaluate(async()=>{
        const data=MyGO.Codex.items,ui=MYGO_ENTRY.codex;
        return Promise.all(data.map(async i=>{
          const image=new Image();image.src=ui.image(i);await image.decode();
          const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
          const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
          const rgba=ctx.getImageData(0,0,256,256).data;
          let transparent=0,visible=0;
          for(let n=3;n<rgba.length;n+=4){if(rgba[n]<8)transparent++;if(rgba[n]>128)visible++;}
          return {id:i.id,width:image.naturalWidth,height:image.naturalHeight,transparent,visible,src:ui.image(i),pixels:canvas.toDataURL()};
        }));
      });
      for(const i of art){assert.equal(i.width,256,i.id);assert.equal(i.height,256,i.id);assert(i.transparent>1000,i.id);assert(i.visible>500,i.id);}
      assert.equal(new Set(art.map(i=>i.src)).size,166);assert.equal(new Set(art.map(i=>i.pixels)).size,166);
      await page.locator('#eq-search').fill('天帝之剑');assert.equal(await page.locator('.eq-card').count(),0);
      await page.locator('[data-eq-reset]').first().click();
      await page.locator('[data-eq-category="sword"]').click();
      await page.locator('[data-eq-filter="edition"]').selectOption('all');
      assert.equal(await page.locator('.eq-card').count(),18);
      await page.locator('[data-eq-item="iron_sword_plus"]').click();
      assert((await page.locator('#eq-detail').innerText()).includes('铁剑＋'));
      if(name==='index.html')await page.screenshot({path:path.join(shots,'codex-weapons-v491.png')});
      await page.locator('[data-eq-category="magic"]').click();
      assert.equal(await page.locator('.eq-card').count(),36);
      await page.locator('[data-eq-item="fire"]').click();
      assert((await page.locator('#eq-detail').innerText()).includes('每章次数'));
      if(name==='index.html')await page.screenshot({path:path.join(shots,'codex-magic-v491.png')});
      await page.locator('[data-eq-close]').click();
      await page.locator('[data-entry-action="formation"]').click();
      await page.locator('[data-loadout-tab="classes"]').click();
      assert.equal(await page.locator('.class-card').count(),44);
      await page.locator('[data-class-tier]').selectOption('intermediate');
      assert.equal(await page.locator('.class-card').count(),12);
      const dancer=page.locator('.class-card').filter({hasText:'Dancer'});
      assert((await dancer.innerText()).includes('舞者转职证'));assert.equal(await dancer.count(),1);
      if(name==='index.html')await page.screenshot({path:path.join(shots,'classes-intermediate-v491.png')});
      await page.locator('[data-class-tier]').selectOption('master');
      assert.equal(await page.locator('.class-card').count(),14);
      for(const label of ['诈术师','战争僧侣','战争修女','暗天马骑士','瓦尔基里'])assert.equal(await page.locator('.class-card').filter({hasText:label}).count(),1);
      assert(!(await page.locator('#formation-detail').innerText()).includes('死神骑士'));
      if(name==='index.html')await page.screenshot({path:path.join(shots,'classes-master-v491.png')});
      await page.locator('[data-formation-close]').click();
      await page.locator('[data-entry-action="shop"]').click();
      assert(await page.locator('#shop-screen').isVisible());
      assert(await page.locator('[data-shop-buy="steel_sword"]').isDisabled());
      const startGold=await page.evaluate(()=>MYGO_UI.game.gold);
      await page.locator('[data-shop-category="medicine"]').click();
      await page.locator('[data-quantity="vulnerary"]').fill('2');
      await page.locator('[data-shop-buy="vulnerary"]').click();
      assert.equal(await page.evaluate(()=>MYGO_UI.game.gold),startGold-600);
      assert.equal(await page.evaluate(()=>MYGO_UI.game.convoy.filter(i=>i.id==='vulnerary').length),27);
      if(name==='index.html')await page.screenshot({path:path.join(shots,'shop-medicine-v53.png')});
      await page.locator('[data-shop-mode="sell"]').click();
      const beforeSell=await page.evaluate(()=>MYGO_UI.game.gold);
      await page.locator('[data-shop-sell]').first().click();
      assert.equal(await page.evaluate(()=>MYGO_UI.game.gold),beforeSell+150);
      await page.keyboard.press('Escape');assert(await page.locator('#shop-screen').isHidden());
      await page.locator('[data-entry-action="formation"]').click();
      await page.locator('[data-formation-unit="tomori"]').click();
      await page.locator('[data-loadout-tab="bag"]').click();
      await page.locator('[data-bag-take="0"]').click();
      await page.evaluate(()=>{MYGO_UI.game.getUnit('tomori').hp=5;MYGO_ENTRY.renderFormationDetail();});
      await page.locator('[data-medicine-use="1"]').click();
      assert.equal(await page.evaluate(()=>MYGO_UI.game.getUnit('tomori').hp),15);
      assert(await page.evaluate(()=>MYGO_UI.game.getUnit('tomori').acted));
      await page.locator('[data-formation-close]').click();
      // Move to the next authored chapter using the real cross-chapter transfer.
      await page.evaluate(()=>{
        const ui=MYGO_UI;ui.game=new MyGO.Game({stage:2,loadout:ui.game.exportLoadout()});ui.renderer.setGame(ui.game);
        ui.game.gold=10000;const u=ui.game.getUnit('soyo');while(u.level<10)MyGO.Growth.award(u,MyGO.Growth.required(u.level));ui.updateAll();
      });
      await page.locator('[data-entry-action="shop"]').click();
      await page.locator('[data-shop-mode="buy"]').click();
      await page.locator('[data-shop-category="seal"]').click();
      await page.locator('[data-shop-buy="intermediate_seal"]').click();
      assert.equal(await page.evaluate(()=>MYGO_UI.game.shopPurchases.intermediate_seal),1);
      await page.locator('[data-shop-close]').click();
      await page.locator('[data-entry-action="formation"]').click();
      await page.locator('[data-formation-unit="soyo"]').click();
      await page.locator('[data-loadout-tab="classes"]').click();
      await page.locator('[data-class-tier]').selectOption('intermediate');
      assert(await page.locator('[data-reclass="mage"]').isEnabled());
      await page.locator('[data-reclass="mage"]').click();
      assert.equal(await page.evaluate(()=>MYGO_UI.game.getUnit('soyo').classId),'mage');
      assert.equal(await page.evaluate(()=>MYGO_UI.game.convoy.filter(i=>i.id==='intermediate_seal').length),0);
      if(name==='index.html')await page.screenshot({path:path.join(shots,'reclass-mage-v53.png')});
      await page.locator('[data-loadout-tab="magic"]').click();
      assert((await page.locator('#formation-detail').innerText()).includes('等级学法术'));
      assert(await page.evaluate(()=>MYGO_UI.game.getUnit('soyo').learnedSpells.includes('wind')));
      assert(await page.evaluate(()=>MYGO_UI.game.getUnit('soyo').learnedSpells.includes('thunder')));
      if(name==='index.html')await page.screenshot({path:path.join(shots,'magic-learning-v53.png')});
      await page.evaluate(()=>{const ui=MYGO_UI,s=ui.game.serialize(),g=new MyGO.Game();g.restore(s);
        if(JSON.stringify(g.serialize())!==JSON.stringify(s))throw Error('Economy save round trip changed data');});
      await page.locator('[data-formation-close]').click();
      await page.locator('[data-entry-action="equipment"]').click();
      await page.locator('[data-eq-category="medicine"]').click();
      assert.equal(await page.locator('.eq-card').count(),5);
      await page.locator('[data-eq-item="vulnerary"]').click();
      assert((await page.locator('#eq-detail').innerText()).includes('使用次数'));
      assert.deepEqual(errors,[]);await page.close();
      console.log(name+': 166 icons, medicine use, shop purchase/sale, chapter unlock, reclass, spell learning and save round trip passed.');
    }
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
