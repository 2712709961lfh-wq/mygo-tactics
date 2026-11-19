/* Render actual map and battle scenery, validating the downloaded sprite atlas. */
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const {createCanvas,Image}=require('@napi-rs/canvas'),root=path.resolve(__dirname,'..'),out=path.join(root,'docs/previews');
class LocalImage extends Image{set src(v){super.src=v.startsWith('data:')?v:fs.readFileSync(path.join(root,v.split('?')[0]));}}
const w={console,Date,Math,Map,Set,Image:LocalImage,performance:{now:()=>1600},requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},document:{createElement:()=>createCanvas(1,1)}};w.window=w;vm.createContext(w);
for(const n of ['equipment-data','magic-data','inventory','class-data','class-mastery','config','chapter-three','chapter-four','chapter-five','chapter-six','chapter-seven','chapter-eight','chapter-nine','chapter-ten','chapter-palace','chapter-royal-garden','map-projection','rng','growth-data','talents','growth','grid','pathfinding','combat','game','assets','garden-map','moon-map','park-map','characters','dark-soyo','watercourt-art','masked-court-art','livehouse-art','eighth-art','rehearsal-art','tenth-art','palace-art','royal-garden-art','renderer','battle'])vm.runInContext(fs.readFileSync(path.join(root,'src',n+'.js'),'utf8'),w,{filename:n});
(async()=>{
 const M=w.MyGO;await Promise.all([M.Characters.load(),M.MoonMap.load(),M.WatercourtArt.load(),M.MaskedCourtArt.load(),M.LivehouseArt.load(),M.PalaceArt.load(),M.RoyalGardenArt.load()]);
 const g=new M.Game({stage:12,recruited:['xueyue','nina','nijika','subaru'],seed:1119});g.royalGardenIntroSeen=true;
 const before=JSON.stringify(g.serialize()),canvas=createCanvas(1,1),r=new M.Renderer(canvas,g);r.render(1600);assert.equal(JSON.stringify(g.serialize()),before);
 fs.writeFileSync(path.join(out,'chapter-11-luxury-map.png'),canvas.toBuffer('image/png'));
 const crop=createCanvas(1200,480),c=crop.getContext('2d');c.imageSmoothingEnabled=false;c.drawImage(canvas,48+2*32*2,136+28*32*2,30*32*2,12*32*2,0,0,1200,480);fs.writeFileSync(path.join(out,'chapter-11-luxury-entrance.png'),crop.toBuffer('image/png'));
 const mid=createCanvas(1280,560),mc=mid.getContext('2d');mc.drawImage(canvas,48+1*64,136+14*64,32*64,14*64,0,0,1280,560);fs.writeFileSync(path.join(out,'chapter-11-luxury-canals.png'),mid.toBuffer('image/png'));
 const battle=createCanvas(1152,648),bc=battle.getContext('2d');bc.scale(2,2);M.RoyalGardenMap.drawBattleBackground(bc,576,324);M.Characters.drawBattlePose(bc,g.getUnit('subaru'),125,242,90,'idle',0,'right');M.Characters.drawBattlePose(bc,g.getUnit('garden_cavalier_boss'),438,242,105,'idle',0,'left');fs.writeFileSync(path.join(out,'chapter-11-luxury-battle.png'),battle.toBuffer('image/png'));
 const meta=JSON.parse(fs.readFileSync(path.join(root,'assets/chapter-eleven/royal-details.json'))),im=M.RoyalGardenArt.images.details,probe=createCanvas(100,130),pc=probe.getContext('2d');
 for(const [name,box]of Object.entries(meta.sprites)){assert.deepEqual(Array.from(M.RoyalGardenArt.sprites[name]),box);const [x,y,w,h]=box;assert(x>=0&&y>=0&&x+w<=im.width&&y+h<=im.height,name);pc.clearRect(0,0,100,130);assert(M.RoyalGardenArt.sprite(pc,name,0,0,w,h));assert(pc.getImageData(0,0,w,h).data.some((v,i)=>i%4===3&&v),name);}
 const map=g.map,objects=M.RoyalGardenMap.makeObjects(map,r.projection);for(const o of objects.filter(o=>['royal-angel','royal-knight','royal-urn'].includes(o.kind)))assert.equal(map.tiles[Math.floor(o.y)][Math.floor(o.x)],'wall',o.kind+' must use existing blocked footprint');
 console.log('Rendered real map and battle; all 17 atlas sprites bounded/nonempty, adornments on existing blocked ground, game state unchanged.');
})().catch(e=>{console.error(e);process.exitCode=1;});
