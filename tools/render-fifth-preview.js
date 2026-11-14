'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const {createCanvas,Image,GlobalFonts}=require('@napi-rs/canvas');GlobalFonts.registerFromPath('C:/Windows/Fonts/msyh.ttc','Microsoft YaHei');
const root=path.resolve(__dirname,'..');class LocalImage extends Image{set src(v){super.src=v.startsWith('data:')?v:fs.readFileSync(path.join(root,v.split('?')[0]));}}
const w={console,Date,Math,Map,Set,Image:LocalImage,performance:{now:()=>1600},requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},document:{createElement:()=>createCanvas(1,1)}};w.window=w;vm.createContext(w);
for(const n of ['equipment-data','magic-data','inventory','class-data','config','chapter-three','chapter-four','chapter-five','chapter-six','map-projection','rng','growth-data','growth','grid','pathfinding','combat','game','assets','garden-map','moon-map','park-map','characters','dark-soyo','watercourt-art','masked-court-art','renderer','battle'])vm.runInContext(fs.readFileSync(path.join(root,'src',n+'.js'),'utf8'),w,{filename:n});
(async()=>{const M=w.MyGO;await Promise.all([M.MoonMap.load(),M.Characters.load(),M.WatercourtArt.load()]);
 const g=new M.Game({stage:5,recruited:['xueyue','nina'],seed:57}),canvas=createCanvas(1,1),r=new M.Renderer(canvas,g);r.showGrid=true;r.render(1600);
 const out=path.join(root,'docs/previews');fs.writeFileSync(path.join(out,'chapter-05-map.png'),canvas.toBuffer('image/png'));
 for(const id of ['iron_warden','court-pegasus-n','court-pegasus-guard-n','court-pegasus-guard-s'])assert(M.Characters.has(id));
 const detail=createCanvas(1500,1000),c=detail.getContext('2d');c.fillStyle='#101d2c';c.fillRect(0,0,1500,1000);c.font='bold 32px Microsoft YaHei';c.fillStyle='#f1ddaf';c.fillText('第五话 · 双桥水庭的铁幕',45,60);c.font='19px Microsoft YaHei';c.fillStyle='#9bb7bd';c.fillText('夜间现代公园 / 双路突破 / 重装防线与天马侧袭',45,98);
 c.drawImage(canvas,0,0,canvas.width,canvas.height,15,145,1080,850);
 c.fillStyle='#ecd6ab';c.font='bold 23px Microsoft YaHei';c.fillText('铁幕守卫长 · 格雷',1115,170);M.Characters.drawBattlePose(c,g.getUnit('iron_warden'),1290,455,260,'idle',0,'left');
 c.font='18px Microsoft YaHei';c.fillStyle='#b8c6cb';c.fillText('重装 · 高守备 / 低魔防',1115,490);c.fillText('掉落：中级转职证 ×1',1115,528);c.fillText('          钢斧 ×1',1115,558);
 c.fillStyle='#ecd6ab';c.font='bold 23px Microsoft YaHei';c.fillText('天马骑士',1115,620);M.Characters.drawBattlePose(c,g.getUnit('court-pegasus-n'),1290,840,185,'idle',0,'left');
 c.font='18px Microsoft YaHei';c.fillStyle='#b8c6cb';c.fillText('湖上两名携带宝箱钥匙',1115,886);c.fillText('两名较弱护卫守住 Boss 两侧',1115,925);c.fillText('四名均可飞行 / 弓特效弱点',1115,964);
 fs.writeFileSync(path.join(out,'chapter-05-guide.png'),detail.toBuffer('image/png'));
 // Use the complete renderer chain, including the chapter-six wrappers.
 const compare=createCanvas(900,330),cc=compare.getContext('2d'),boss=g.getUnit('iron_warden');
 cc.fillStyle='#182535';cc.fillRect(0,0,900,330);cc.fillStyle='#f1ddaf';cc.font='22px Microsoft YaHei';
 for(const [i,label] of ['地图造型（放大）','战斗待机','角色缩略图'].entries())cc.fillText(label,i*300+50,38);
 M.Characters.drawMap(cc,boss,150,280,180/1.16,0);
 M.Characters.drawBattlePose(cc,boss,450,280,180,'idle',0,'left');
 M.Characters.drawPortrait(cc,boss.id,650,280-180/.95,200,180/.95);
 fs.writeFileSync(path.join(out,'chapter-05-boss-consistency.png'),compare.toBuffer('image/png'));
 // Exercise every real directional cell through the production character drawer.
 const meta=JSON.parse(fs.readFileSync(path.join(root,'assets/chapter-five/knight-actions.json'))),probe=createCanvas(192,192),pc=probe.getContext('2d');
 let verified=0;
 for(const [id,kind] of [['court-armor-n','armor'],['iron_warden','warden']])for(const [action,spec] of Object.entries(meta.units[kind].actions)){
  const unique=new Set();
  for(const facing of meta.directions)for(let frame=0;frame<spec.count;frame++){
   pc.clearRect(0,0,192,192);assert(M.Characters.drawBattlePose(pc,g.getUnit(id),96,124,48,action,frame,facing));
   assert(pc.getImageData(0,0,192,192).data.some((n,i)=>i%4===3&&n),'empty '+id+'/'+action+'/'+frame);
   if(facing==='right')unique.add(require('crypto').createHash('sha256').update(probe.toBuffer('image/png')).digest('hex'));
   verified++;
  }
  if(action==='attack'||action==='walk')assert(unique.size>=6,'must contain distinct real moving poses');
 }
 assert.equal(verified,248);
 // Actual BattleScene clocks, rendered as a 40-frame two-panel animation strip.
 const frames=40,W=1152,H=324,strip=createCanvas(W,H*frames),bc=strip.getContext('2d');
 for(let f=0;f<frames;f++)for(const [i,id] of ['court-armor-n','iron_warden'].entries()){
  const time=f/(frames-1),b=Object.create(M.BattleScene.prototype);
  Object.assign(b,{attacker:g.getUnit(id),defender:g.getUnit('tomori'),duration:1800,particles:[],
   result:{hit:true,crit:false,finalDamage:8,hpAfter:10},palette:{core:'#fff',mid:'#ffe1a4',glow:'#ffc566'}});
  bc.save();bc.translate(i*576,f*H);M.ParkMap.drawBattleBackground(bc,576,H,true);
  b._drawParticles=()=>{};b._drawImpact=()=>{};b._drawBattle(bc,time,(time-.58)*1800);
  bc.fillStyle='#f1ddba';bc.font='18px Microsoft YaHei';bc.fillText(i?'铁幕守卫长 · 战斧':'水庭重装兵 · 长枪',20,30);bc.restore();
 }
 fs.writeFileSync(path.join(out,'chapter-05-animation-strip.png'),strip.toBuffer('image/png'));
 const still=createCanvas(W,H);still.getContext('2d').drawImage(strip,0,23*H,W,H,0,0,W,H);
 fs.writeFileSync(path.join(out,'chapter-05-knight-battle.png'),still.toBuffer('image/png'));
 console.log('Fifth chapter: map, 248 nonempty directional poses, distinct attack/walk frames and 40 production battle frames rendered.');
})().catch(e=>{console.error(e);process.exitCode=1;});
