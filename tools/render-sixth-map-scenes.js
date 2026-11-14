'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {createCanvas,Image,GlobalFonts}=require('@napi-rs/canvas');
GlobalFonts.registerFromPath('C:/Windows/Fonts/msyh.ttc','Microsoft YaHei');
GlobalFonts.registerFromPath('C:/Windows/Fonts/msyh.ttc','sans-serif');
const root=path.resolve(__dirname,'..');let now=1600,nextFrame;
class LocalImage extends Image{set src(v){super.src=v.startsWith('data:')?v:fs.readFileSync(path.join(root,v.split('?')[0]));}}
const w={console,Date,Math,Map,Set,Image:LocalImage,performance:{now:()=>now},requestAnimationFrame:fn=>(nextFrame=fn,1),
 cancelAnimationFrame:()=>{nextFrame=null;},document:{createElement:()=>createCanvas(1,1),addEventListener(){},removeEventListener(){}}};
w.window=w;vm.createContext(w);
for(const n of ['equipment-data','magic-data','inventory','class-data','config','chapter-three','chapter-four','chapter-five','chapter-six',
 'map-projection','rng','growth-data','growth','grid','pathfinding','combat','game','assets','garden-map','moon-map','park-map','characters',
 'dark-soyo','watercourt-art','masked-court-art','renderer','battle','ui','masked-court-ui'])
 vm.runInContext(fs.readFileSync(path.join(root,'src',n+'.js'),'utf8'),w,{filename:n});
(async()=>{
 const M=w.MyGO;await Promise.all([M.MoonMap.load(),M.Characters.load(),M.WatercourtArt.load(),M.MaskedCourtArt.load()]);
 const g=new M.Game({stage:6,seed:66}),board=createCanvas(1,1),renderer=new M.Renderer(board,g);renderer.showGrid=true;
 let focus={x:14,y:4};const ui=Object.create(M.UI.prototype);
 Object.assign(ui,{game:g,renderer,busy:true,dom:{contextTitle:{},contextText:{}},setBusy(v){this.busy=v;},setActions(a){this.actions=a;},
  revealCell(x,y){focus={x,y};},updateAll(){},resetSelection(){},
  openOverlay(){throw Error('No separate scene canvas allowed');}});
 function frame(ms){now+=ms;assert(nextFrame);const fn=nextFrame;nextFrame=null;fn(now);}
 function capture(file,label){
  const image=createCanvas(900,620),c=image.getContext('2d'),p=M.MapProjection.project(renderer.projection,(focus.x+.5)*32,(focus.y+.5)*32);
  const sw=Math.min(board.width,900*renderer.scale),sh=Math.min(board.height,570*renderer.scale);
  const sx=Math.max(0,Math.min(board.width-sw,p.x*renderer.scale-sw/2));
  const sy=Math.max(0,Math.min(board.height-sh,p.y*renderer.scale-sh/2));
  c.fillStyle='#122032';c.fillRect(0,0,900,620);c.drawImage(board,sx,sy,sw,sh,0,50,900,570);
  c.fillStyle='#efd1f5';c.font='22px Microsoft YaHei';c.fillText(label,24,33);
  fs.writeFileSync(path.join(root,'docs/previews',file),image.toBuffer('image/png'));
 }
 g.phase='enemy';g.getUnit('tomori').y=32;renderer.snapUnit(g.getUnit('tomori'));
 const wave=g.summonNearParty(),summoning=ui.playCourtScene('summon',wave);
 frame(650);capture('chapter-06-map-summon-caster.png','地图内演出 · 面具人在王座处施法');
 frame(850);capture('chapter-06-map-summon-reinforcements.png','地图内演出 · 援军在队伍附近的法阵中现身');
 frame(1100);await summoning;
 g.phase='player';g.applyCombat({attackerId:'soyo',defenderId:'masked_stranger',hit:true,finalDamage:999});
 const escaping=ui.playMaskedEscape();frame(1900);capture('chapter-06-map-teleport.png','地图内演出 · “留你们一命。” · 王座处传送离场');
 frame(1500);await escaping;assert(g.maskEscaped);assert.equal(g.phase,'victory');
 console.log('Three actual map-scene previews rendered; no separate cinematic canvas; retreat ends in victory.');
})().catch(e=>{console.error(e);process.exitCode=1;});
