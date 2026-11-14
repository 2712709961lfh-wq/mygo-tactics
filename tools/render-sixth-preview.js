'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const {createCanvas,Image,GlobalFonts}=require('@napi-rs/canvas');GlobalFonts.registerFromPath('C:/Windows/Fonts/msyh.ttc','Microsoft YaHei');
const root=path.resolve(__dirname,'..');class LocalImage extends Image{set src(v){super.src=v.startsWith('data:')?v:fs.readFileSync(path.join(root,v.split('?')[0]));}}
const w={console,Date,Math,Map,Set,Image:LocalImage,performance:{now:()=>1600},requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},document:{createElement:()=>createCanvas(1,1)}};w.window=w;vm.createContext(w);
for(const n of ['equipment-data','magic-data','inventory','class-data','config','chapter-three','chapter-four','chapter-five','chapter-six','map-projection','rng','growth-data','growth','grid','pathfinding','combat','game','assets','garden-map','moon-map','park-map','characters','dark-soyo','watercourt-art','masked-court-art','renderer','battle'])vm.runInContext(fs.readFileSync(path.join(root,'src',n+'.js'),'utf8'),w,{filename:n});
(async()=>{const M=w.MyGO;await Promise.all([M.MoonMap.load(),M.Characters.load(),M.WatercourtArt.load(),M.MaskedCourtArt.load()]);
 const g=new M.Game({stage:6,recruited:['xueyue','nina'],seed:66}),canvas=createCanvas(1,1),r=new M.Renderer(canvas,g);r.showGrid=true;r.render(1600);
 const out=path.join(root,'docs/previews');fs.writeFileSync(path.join(out,'chapter-06-map.png'),canvas.toBuffer('image/png'));
 const throne=createCanvas(1008,550);throne.getContext('2d').drawImage(canvas,0,0,canvas.width,1100,0,0,1008,550);fs.writeFileSync(path.join(out,'chapter-06-throne.png'),throne.toBuffer('image/png'));
 const guide=createCanvas(1400,1150),c=guide.getContext('2d');c.fillStyle='#101b2b';c.fillRect(0,0,1400,1150);c.font='bold 32px Microsoft YaHei';c.fillStyle='#ecd5b0';c.fillText('第六话 · 灯庭王座与无名面具',40,60);c.font='19px Microsoft YaHei';c.fillStyle='#a8bec6';c.fillText('飞鸟山公园 · 北端灯庭 / 30 × 46 纵向战场',40,98);
 c.drawImage(canvas,0,0,canvas.width,canvas.height,25,125,630,978);
 c.fillStyle='#edc9ee';c.font='bold 27px Microsoft YaHei';c.fillText('神秘面具人',730,160);M.MaskedCourtArt.throne(c,900,480,2.5);M.Characters.drawBattlePose(c,g.getUnit('masked_stranger'),900,490,245,'summon',5,'right');
 c.fillStyle='#e7d3b2';c.font='21px Microsoft YaHei';c.fillText('北端：18 盏宫廷立灯环绕王座',710,550);c.fillText('初始：两名巡守与王座上的面具人',710,595);c.fillText('推进：四个区段召来 3 / 4 / 4 / 5 名敌军',710,640);c.fillText('混编：普通幻兵、天马骑士、重装兵',710,685);c.fillText('召唤：队伍附近法阵现身，当轮不行动',710,730);c.fillText('终幕：锁血 1 HP，传送离场',710,775);
 M.MaskedCourtArt.circle(c,980,930,300,130,.65);c.fillStyle='#e5b4f3';c.font='bold 35px Microsoft YaHei';c.fillText('“留你们一命。”',805,1040);
 fs.writeFileSync(path.join(out,'chapter-06-guide.png'),guide.toBuffer('image/png'));
 const probe=createCanvas(450,260),pc=probe.getContext('2d');for(const state of ['idle','walk','attack','summon','hurt'])for(let frame=0;frame<(state==='idle'?8:state==='hurt'?3:7);frame++){pc.clearRect(0,0,450,260);assert(M.MaskedCourtArt.action(pc,130,220,150,state,frame,'right',1600));assert(pc.getImageData(0,0,450,260).data.some((v,i)=>i%4===3&&v));}
 console.log('Sixth chapter map, throne, guide and all boss action cells rendered.');
})().catch(e=>{console.error(e);process.exitCode=1;});
