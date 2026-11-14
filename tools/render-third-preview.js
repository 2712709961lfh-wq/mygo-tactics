/* Render the actual chapter 3 canvas and Nina assets without a browser or save data. */
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const {createCanvas,Image,GlobalFonts}=require('@napi-rs/canvas');
GlobalFonts.registerFromPath('C:/Windows/Fonts/msyh.ttc','Microsoft YaHei');
const root=path.resolve(__dirname,'..');
class LocalImage extends Image {set src(v){super.src=v.startsWith('data:')?v:fs.readFileSync(path.join(root,v.split('?')[0]));}}
const w={console,Date,Math,Map,Set,Image:LocalImage,performance:{now:()=>0},requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},
  document:{createElement:tag=>{if(tag!=='canvas')throw Error(tag);return createCanvas(1,1);}}};
w.window=w;vm.createContext(w);
for(const name of ['equipment-data','magic-data','inventory','class-data','config','chapter-three','map-projection','rng','growth-data','growth','grid','pathfinding','combat','game','assets','garden-map','moon-map','characters','renderer','battle'])
  vm.runInContext(fs.readFileSync(path.join(root,'src',name+'.js'),'utf8'),w,{filename:name+'.js'});
(async()=>{
  const M=w.MyGO;await Promise.all([M.MoonMap.load(),M.Characters.load()]);assert(M.Characters.hasActions('nina'));assert(M.Characters.has('nina'));
  const g=new M.Game({stage:3,recruited:['xueyue'],seed:46}),canvas=createCanvas(1,1),r=new M.Renderer(canvas,g);
  r.showGrid=true;r.render(0);const out=path.join(root,'docs/previews');
  fs.writeFileSync(path.join(out,'chapter-03-deployment.png'),canvas.toBuffer('image/png'));
  // A readable landscape guide retains the actual textured ground and sprite positions.
  const guide=createCanvas(1440,980),c=guide.getContext('2d');
  c.fillStyle='#182b3c';c.fillRect(0,0,1440,980);
  c.drawImage(canvas,0,0,canvas.width,canvas.height,0,35,1200,940);
  c.fillStyle='#f5e4c9';c.font='bold 24px Microsoft YaHei';c.fillText('第三话 · 梦醒的呼救',28,29);
  c.font='bold 19px Microsoft YaHei';c.fillText('月下蔷薇街',1220,95);
  c.font='15px Microsoft YaHei';
  for(const [i,line] of ['40 × 30 · 24 名敌人','北部中央集结','中央大道 / 两侧花巷','绿色友军：井芹仁菜','Lv.7 战士 · 铁拳套','第四回合南部围兵逼近','全灭敌军即可通关','仁菜生还 → 加入队伍','仁菜阵亡 → 永久失去招募'].entries())c.fillText(line,1210,145+i*45);
  const v=r.projection,T=M.CONFIG.TILE;
  function callout(x,y,label,color){const p=M.MapProjection.project(v,(x+.5)*T,(y+.5)*T);const xx=p.x/r.logicalWidth*1200,yy=35+p.y/r.logicalHeight*940;
    c.strokeStyle=color;c.lineWidth=2;c.strokeRect(xx-49,yy-32,98,64);c.fillStyle='#152c3f';c.fillRect(xx+56,yy-14,145,29);c.fillStyle=color;c.font='bold 17px Microsoft YaHei';c.fillText(label,xx+62,yy+7);}
  callout(20,4,'MYGO · 南下救援','#9cdeff');callout(20,22,'仁菜 · 等待支援','#a4f3b4');
  fs.writeFileSync(path.join(out,'chapter-03-guide.png'),guide.toBuffer('image/png'));
  // Verify transformed picking on every cell and on Nina's upper body.
  const n=g.getUnit('nina'),p=M.MapProjection.project(v,(n.x+.5)*T,(n.y+.84)*T-25);
  const picked=r.pickProjectedUnit(p.x,p.y);assert.equal(picked.x,n.x);assert.equal(picked.y,n.y);
  for(let y=0;y<30;y++)for(let x=0;x<40;x++){
    const p=M.MapProjection.project(v,(x+.5)*T,(y+.5)*T),q=M.MapProjection.unproject(v,p.x,p.y);
    assert.equal(Math.floor(q.x/T),x);assert.equal(Math.floor(q.y/T),y);
  }
  // Render all 49 authored poses through the game's real drawBattlePose path.
  const poses=createCanvas(1280,1440),pc=poses.getContext('2d');pc.fillStyle='#203447';pc.fillRect(0,0,1280,1440);
  const meta=JSON.parse(fs.readFileSync(path.join(root,'assets/characters/actions/nina-actions.json'),'utf8'));
  let frames=0;
  for(const [name,spec] of Object.entries(meta.frames)){
    pc.fillStyle='#f2dcbc';pc.font='14px sans-serif';pc.fillText(name,7,spec.row*144+18);
    for(let f=0;f<spec.count;f++){
      const action=name.startsWith('attack')?name:undefined,state=action?'attack':name;
      assert(M.Characters.drawBattlePose(pc,n,f*160+72,spec.row*144+130,84,state,f,'right',action));frames++;
    }
  }
  assert.equal(frames,49);fs.writeFileSync(path.join(out,'nina-engine-poses.png'),poses.toBuffer('image/png'));
  // Real battle animation pose selection for punch/combo/critical/hurt/down.
  const battle=M.BattleScene.prototype,shots=createCanvas(1152,648),bc=shots.getContext('2d');
  const enemy=g.getUnit('siege_blade');
  for(const [i,kind] of ['attack','combo','critical','hurt'].entries()){
    const attacker=kind==='hurt'?enemy:n,defender=kind==='hurt'?n:enemy;
    const b=Object.create(battle);Object.assign(b,{attacker,defender,result:{hit:true,crit:kind==='critical',kind:kind==='combo'?'combo':'attack',finalDamage:8,hpAfter:10},
      duration:1800,particles:[],palette:{core:'#fff',mid:'#ffd68e',glow:'#ffc566'},dom:{}});
    bc.save();bc.translate(i%2*576,Math.floor(i/2)*324);bc.fillStyle='#233b4d';bc.fillRect(0,0,576,324);
    b._drawParticles=()=>{};b._drawImpact=()=>{};b._drawWeaponFx=()=>{};
    b._drawBattle(bc,.61,54);
    bc.fillStyle='#f3dfbe';bc.font='18px Microsoft YaHei';bc.fillText(['直拳','连击','暴击踢击','受伤'][i],24,30);bc.restore();
  }
  fs.writeFileSync(path.join(out,'nina-battle-preview.png'),shots.toBuffer('image/png'));
  console.log('Chapter 3 renderer: square projection, 1,200 picks, NPC upper-body selection, 49 poses and battle clips verified.');
})().catch(e=>{console.error(e);process.exitCode=1;});
