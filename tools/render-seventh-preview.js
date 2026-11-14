'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const {createCanvas,Image,GlobalFonts}=require('@napi-rs/canvas');GlobalFonts.registerFromPath('C:/Windows/Fonts/msyh.ttc','Microsoft YaHei');
const root=path.resolve(__dirname,'..');class LocalImage extends Image{set src(v){super.src=v.startsWith('data:')?v:fs.readFileSync(path.join(root,v.split('?')[0]));}}
const w={console,Date,Math,Map,Set,Image:LocalImage,performance:{now:()=>1600},requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},document:{createElement:()=>createCanvas(1,1)}};w.window=w;vm.createContext(w);
for(const n of ['equipment-data','magic-data','inventory','class-data','config','chapter-three','chapter-four','chapter-five','chapter-six','chapter-seven','map-projection','rng','growth-data','growth','grid','pathfinding','combat','game','assets','garden-map','moon-map','park-map','characters','dark-soyo','watercourt-art','masked-court-art','livehouse-art','renderer','battle'])vm.runInContext(fs.readFileSync(path.join(root,'src',n+'.js'),'utf8'),w,{filename:n});
(async()=>{const M=w.MyGO;await Promise.all([M.MoonMap.load(),M.Characters.load(),M.WatercourtArt.load(),M.MaskedCourtArt.load(),M.LivehouseArt.load()]);
 const g=new M.Game({stage:7,recruited:['xueyue','nina'],seed:66}),canvas=createCanvas(1,1),r=new M.Renderer(canvas,g);g.joinNijika();r.showGrid=true;r.render(1600);
 const out=path.join(root,'docs/previews');fs.writeFileSync(path.join(out,'chapter-07-map.png'),canvas.toBuffer('image/png'));
 const atlas=JSON.parse(fs.readFileSync(path.join(root,'assets/characters/actions/nijika-actions.json'),'utf8')),probe=createCanvas(460,280),pc=probe.getContext('2d');let frames=0;
 for(const [state,info] of Object.entries(atlas.frames))for(let frame=0;frame<info.count;frame++){
  pc.clearRect(0,0,460,280);M.Characters.drawBattlePose(pc,g.getUnit('nijika'),160,240,170,state,frame,'right');
  assert(pc.getImageData(0,0,460,280).data.some((v,i)=>i%4===3&&v),'empty action '+state+':'+frame);frames++;
 }
 assert.equal(frames,47);
 for(const facing of ['up','down','left','right'])for(const moving of [false,true]){
  pc.clearRect(0,0,460,280);M.Characters.drawMap(pc,{...g.getUnit('nijika'),facing,_walking:moving},160,240,170,1000);
  assert(pc.getImageData(0,0,460,280).data.some((v,i)=>i%4===3&&v),'empty direction '+facing);
 }
 console.log('Seventh map, all 47 action cells and four map directions rendered.');
})().catch(e=>{console.error(e);process.exitCode=1;});
