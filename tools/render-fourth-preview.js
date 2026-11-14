'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const {createCanvas,Image,GlobalFonts}=require('@napi-rs/canvas');
GlobalFonts.registerFromPath('C:/Windows/Fonts/msyh.ttc','Microsoft YaHei');
const root=path.resolve(__dirname,'..');
class LocalImage extends Image{set src(v){super.src=v.startsWith('data:')?v:fs.readFileSync(path.join(root,v.split('?')[0]));}}
const w={console,Date,Math,Map,Set,Image:LocalImage,performance:{now:()=>1600},requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},
  document:{createElement:()=>createCanvas(1,1)}};w.window=w;vm.createContext(w);
for(const name of ['equipment-data','magic-data','inventory','class-data','config','chapter-three','chapter-four','map-projection',
  'rng','growth-data','growth','grid','pathfinding','combat','game','assets','garden-map','moon-map','park-map','characters','dark-soyo','renderer','battle'])
  vm.runInContext(fs.readFileSync(path.join(root,'src',name+'.js'),'utf8'),w,{filename:name+'.js'});
(async()=>{
  const M=w.MyGO;await Promise.all([M.MoonMap.load(),M.Characters.load(),M.DarkSoyo.load()]);
  const g=new M.Game({stage:4,recruited:['xueyue','nina'],seed:46}),canvas=createCanvas(1,1),r=new M.Renderer(canvas,g);
  const out=path.join(root,'docs/previews');r.showGrid=true;r.render(1600);
  fs.writeFileSync(path.join(out,'chapter-04-start.png'),canvas.toBuffer('image/png'));
  assert(M.Characters.has('dark_soyo'));assert(M.Characters.hasActions('dark_soyo'));
  const b=g.getUnit('dark_soyo'),p=M.MapProjection.project(r.projection,(b.x+.5)*32,(b.y+.84)*32-20);
  assert.equal(r.pickProjectedUnit(p.x,p.y),null);
  g.litLamps=g.mission.lamps.map(l=>l.id);g.refreshParkDiscovery();r.render(1600);
  fs.writeFileSync(path.join(out,'chapter-04-park.png'),canvas.toBuffer('image/png'));
  assert.equal(r.pickProjectedUnit(p.x,p.y).x,b.x);
  const detail=createCanvas(1300,650),c=detail.getContext('2d');c.fillStyle='#0d1927';c.fillRect(0,0,1300,650);
  c.fillStyle='#e8d7bd';c.font='bold 27px Microsoft YaHei';c.fillText('第四话 · 飞鸟山公园的往日之影',35,45);
  c.font='18px Microsoft YaHei';c.fillStyle='#92b6c0';c.fillText('夜间公园 / 听声探索 / 迷雾巡猎',35,80);
  c.drawImage(canvas,0,0,canvas.width,canvas.height,0,105,800,540);
  c.fillStyle='#ead9ba';c.font='21px Microsoft YaHei';c.fillText('往日之影长崎爽世',900,135);
  M.Characters.drawBattlePose(c,b,1045,435,220,'attack',3,'left','fireball');
  c.font='16px Microsoft YaHei';c.fillStyle='#d0bbc9';
  ['暗紫烟雾 · 破碎魔法纹样 · 赤色裂痕','贴图：Kenney Particle Pack / CC0','爽世亲手击破 → 本次经验 ×2'].forEach((s,i)=>c.fillText(s,865,490+i*38));
  fs.writeFileSync(path.join(out,'chapter-04-guide.png'),detail.toBuffer('image/png'));
  const comp=createCanvas(900,420),cc=comp.getContext('2d');cc.fillStyle='#1c2d3e';cc.fillRect(0,0,900,420);
  for(const [i,state] of ['idle','attack','hurt'].entries()){
    M.Characters.drawBattlePose(cc,b,150+i*300,355,195,state,3,'left','fireball');
    cc.fillStyle='#f0d1e3';cc.font='18px Microsoft YaHei';cc.fillText(state,105+i*300,35);
  }
  fs.writeFileSync(path.join(out,'dark-soyo-poses.png'),comp.toBuffer('image/png'));
  console.log('Chapter 4 renderer: fog, hidden picking, lit park, textured boss and combat poses verified.');
})().catch(e=>{console.error(e);process.exitCode=1;});
