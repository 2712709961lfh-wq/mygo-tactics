'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const {createCanvas,Image,GlobalFonts}=require('@napi-rs/canvas');
GlobalFonts.registerFromPath('C:/Windows/Fonts/msyh.ttc','Microsoft YaHei');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/previews');
class LocalImage extends Image{set src(v){super.src=v.startsWith('data:')?v:fs.readFileSync(path.join(root,v.split('?')[0]));}}
const w={console,Date,Math,Map,Set,Image:LocalImage,performance:{now:()=>1600},requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},document:{createElement:()=>createCanvas(1,1)}};w.window=w;vm.createContext(w);
for(const n of ['equipment-data','magic-data','inventory','class-data','config','chapter-three','chapter-four','chapter-five','chapter-six','chapter-seven','chapter-eight','chapter-nine','chapter-ten','chapter-palace','map-projection','rng','growth-data','talents','growth','grid','pathfinding','combat','game','assets','garden-map','moon-map','park-map','characters','dark-soyo','watercourt-art','masked-court-art','livehouse-art','eighth-art','rehearsal-art','tenth-art','palace-art','renderer','battle'])vm.runInContext(fs.readFileSync(path.join(root,'src',n+'.js'),'utf8'),w,{filename:n});
(async()=>{
 const M=w.MyGO;await Promise.all([M.Characters.load(),M.MoonMap.load(),M.WatercourtArt.load(),M.MaskedCourtArt.load(),M.LivehouseArt.load(),M.PalaceArt.load()]);
 const g=new M.Game({stage:11,recruited:['xueyue','nina','nijika','subaru'],seed:1118});g.palaceIntroSeen=true;
 const canvas=createCanvas(1,1),r=new M.Renderer(canvas,g);r.render(1600);
 fs.writeFileSync(path.join(out,'chapter-10-palace-map.png'),canvas.toBuffer('image/png'));
 const guide=createCanvas(1500,1050),c=guide.getContext('2d');c.fillStyle='#192331';c.fillRect(0,0,1500,1050);c.fillStyle='#ecd7a4';c.font='bold 29px Microsoft YaHei';c.fillText('第十关 · 鎏金王座的铁蹄',35,48);
 c.font='17px Microsoft YaHei';c.fillStyle='#acbac5';c.fillText('LPC 四方向骑乘动画 / 银甲棕马与金甲白马 / 宫殿场景更新',35,80);
 c.drawImage(canvas,22,105,730,900);
 for(const [i,id]of ['palace-cavalier-0','gilded_cavalier'].entries()){
  const x=930+i*340;c.fillStyle='#dcd0b9';c.fillRect(x-140,145,290,230);
  M.Characters.drawBattlePose(c,g.getUnit(id),x,340,180,'idle',0,'left');
  c.fillStyle='#eed8aa';c.font='bold 21px Microsoft YaHei';c.fillText(i?'金鬃卫长':'宫廷战马骑士',x-100,410);
 }
 const bg=createCanvas(660,380),bc=bg.getContext('2d');M.PalaceMap.drawBattleBackground(bc,660,380);
 c.drawImage(bg,790,465);
 M.Characters.drawBattlePose(c,g.getUnit('palace-cavalier-0'),990,790,145,'attack',5,'right');
 M.Characters.drawBattlePose(c,g.getUnit('gilded_cavalier'),1280,790,145,'hurt',1,'left');
 c.font='18px Microsoft YaHei';c.fillStyle='#d9cba8';c.fillText('六帧行走与奔跑 · 八帧枪刺 · 独立受击 / 倒地 / 闪避',790,910);
 c.fillText('地图、侧视战斗与头像共用同一套完整骑乘图集',790,950);
 fs.writeFileSync(path.join(out,'chapter-10-palace-upgrade.png'),guide.toBuffer('image/png'));
 const sheet=createCanvas(1280,980),sc=sheet.getContext('2d');sc.fillStyle='#cabfa9';sc.fillRect(0,0,1280,980);sc.font='20px Microsoft YaHei';sc.fillStyle='#263343';
 for(const [row,state]of ['idle','walk','run','attack','hurt','down','jump'].entries()){
  sc.fillText(state,12,row*140+24);
  for(let i=0;i<8;i++){const p=M.PalaceArt.pose('gilded_cavalier',state,i,'right');M.PalaceArt.drawMounted(sc,'gilded_cavalier',100+i*150,row*140+131,115,1000,state,p.frame,'right');}
 }
 fs.writeFileSync(path.join(out,'chapter-10-mounted-actions.png'),sheet.toBuffer('image/png'));
 const frames=createCanvas(576,324*32),fc=frames.getContext('2d');
 for(let i=0;i<32;i++){
  const t=i/31,scene=Object.create(M.BattleScene.prototype);Object.assign(scene,{attacker:g.getUnit('gilded_cavalier'),defender:g.getUnit('tomori'),duration:1800,particles:[],result:{hit:true,crit:false,finalDamage:8,hpAfter:10},palette:{core:'#fff',mid:'#e8c889',glow:'#cf963e'}});
  fc.save();fc.translate(0,i*324);M.PalaceMap.drawBattleBackground(fc,576,324);scene._drawParticles=()=>{};scene._drawImpact=()=>{};scene._drawBattle(fc,t,(t-.58)*1800);fc.restore();
 }
 fs.writeFileSync(path.join(out,'chapter-10-mounted-battle-strip.png'),frames.toBuffer('image/png'));
 const meta=JSON.parse(fs.readFileSync(path.join(root,'assets/chapter-ten/mounted-actions.json')));
 const probe=createCanvas(260,240),pc=probe.getContext('2d');
 for(const [kind,unit]of Object.entries(meta.units))for(const [state,spec]of Object.entries(unit.actions))for(const dir of meta.directions){
  const hashes=new Set();for(let f=0;f<spec.count;f++){
   pc.clearRect(0,0,260,240);assert(M.PalaceArt.drawMounted(pc,kind==='elite'?'gilded_cavalier':'palace-cavalier-0',130,210,140,1000,state,f,dir));
   assert(pc.getImageData(0,0,260,240).data.some((v,i)=>i%4===3&&v));hashes.add(require('crypto').createHash('sha256').update(probe.toBuffer('image/png')).digest('hex'));
  }assert.equal(hashes.size,spec.count,kind+' '+state+' '+dir+' unique frames');
 }
 console.log('Rendered actual palace map, cavalry poses and 32 battle frames; all 288 poses nonempty and unique within each action/direction.');
})().catch(e=>{console.error(e);process.exitCode=1;});
