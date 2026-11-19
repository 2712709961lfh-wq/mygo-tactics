/* TinyWorlds' CC0 slimes in an original inlaid-stone training hall. */
(function (global) {
  'use strict';
  const M=global.MyGO;
  let sprites;

  function load(){
    return new Promise(resolve=>{
      const image=new Image();
      image.onload=()=>{ sprites=image; resolve(); };
      image.onerror=()=>resolve();
      image.src=global.MYGO_MAP_DATA?.trainingslimes||'assets/training/slimes.png';
    });
  }

  function slime(ctx,x,y,size,unit,options){
    const width=size*.81, height=width*159/212, left=x+(size-width)/2;
    const now=performance.now();
    const frame=options?.static?0:Math.floor((now+unit._spritePhase*83)/(unit._walking?115:360))%2;
    if(sprites){
      const column=(unit.slimeGroup?8:0)+frame;
      ctx.imageSmoothingEnabled=true;
      ctx.drawImage(sprites,column*212,0,212,159,left,y+size-height-2,width,height);
    }else{
      ctx.fillStyle=unit.slimeGroup?'#83aed3':'#a8c85e';
      ctx.beginPath();ctx.ellipse(x+size/2,y+size-height*.55,width/2,height/2,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#263841';ctx.fillRect(x+size*.4,y+size-height*.6,2,4);ctx.fillRect(x+size*.57,y+size-height*.6,2,4);
    }
  }

  function polygon(ctx,points,fill){
    ctx.beginPath();
    points.forEach(([x,y],index)=>index?ctx.lineTo(x,y):ctx.moveTo(x,y));
    ctx.closePath();ctx.fillStyle=fill;ctx.fill();
  }

  function drawGround(ctx,map){
    const tile=M.CONFIG.TILE;
    const stone=['#304953','#354e55','#3c565c','#3a5058'];
    for(let row=0;row<map.rows;row++)for(let col=0;col<map.cols;col++){
      const x=col*tile,y=row*tile,kind=map.tiles[row][col],variant=(31*col+15*row+col*row)%stone.length;
      ctx.fillStyle='#23343e';ctx.fillRect(x,y,tile,tile);
      ctx.fillStyle=stone[variant];ctx.fillRect(x+1,y+1,tile-2,tile-2);
      ctx.fillStyle='#9cb2a327';ctx.fillRect(x+2,y+2,tile-4,1);
      if(kind==='wall'){
        polygon(ctx,[[x+1,y+7],[x+7,y+3],[x+tile-5,y+3],[x+tile-2,y+7],[x+tile-2,y+22],[x+1,y+22]],'#728684');
        polygon(ctx,[[x+1,y+14],[x+tile-2,y+14],[x+tile-2,y+25],[x+1,y+29]],'#384a51');
        ctx.fillStyle='#95a39b';ctx.fillRect(x+6,y+6,tile-12,2);
      }else if(kind==='forest'){
        polygon(ctx,[[x+4,y+22],[x+9,y+13],[x+18,y+17],[x+13,y+25]],'#687e7c');
        polygon(ctx,[[x+14,y+25],[x+20,y+13],[x+28,y+20],[x+24,y+27]],'#77938b');
        ctx.fillStyle='#8fb8a6';ctx.fillRect(x+20,y+16,3,2);
      }else if(kind==='fort'){
        ctx.strokeStyle='#a6d9c4';ctx.lineWidth=1;
        ctx.strokeRect(x+4,y+4,tile-8,tile-8);
        polygon(ctx,[[x+16,y+7],[x+24,y+16],[x+16,y+24],[x+8,y+16]],'#75ad9b');
      }else if((col+row)%5===0){
        polygon(ctx,[[x+16,y+11],[x+22,y+16],[x+16,y+21],[x+10,y+16]],'#9ab6aa45');
      }
    }
  }

  function drawTower(ctx,x,y){
    const face=(points,color)=>polygon(ctx,points.map(([dx,dy])=>[x+dx,y+dy]),color);
    face([[-85,14],[-34,-23],[46,-23],[87,8],[36,38],[-38,38]],'#213e465a');
    face([[-67,8],[-27,-16],[30,-16],[69,8],[29,28],[-30,28]],'#8e9c8b');
    face([[-46,-3],[-46,-96],[-1,-75],[-1,18]],'#647c79');
    face([[-1,-75],[45,-96],[45,-3],[-1,18]],'#435e66');
    for(let dy=-74;dy<9;dy+=12){
      ctx.strokeStyle='#233d454e';ctx.beginPath();
      ctx.moveTo(x-44,y+dy-19);ctx.lineTo(x-1,y+dy);ctx.lineTo(x+46,y+dy-19);ctx.stroke();
    }
    face([[-50,-99],[-28,-119],[27,-119],[50,-99],[-1,-73]],'#89a69c');
    face([[-40,-101],[-1,-163],[-1,-79]],'#477776');
    face([[-1,-163],[42,-101],[-1,-79]],'#30575f');
    face([[-1,-164],[6,-148],[-1,-139],[-8,-148]],'#c9e2b0');
    face([[-27,6],[-27,-24],[-17,-40],[-7,-27],[-7,14]],'#213944');
    face([[-14,-47],[-18,-59],[-12,-67],[-7,-54]],'#a7d1bd');
    face([[-31,10],[-5,21],[-4,27],[-35,15]],'#aebeab');
    face([[16,-15],[16,-41],[24,-52],[30,-43],[30,-21]],'#85b9ab');
  }

  function drawBattleBackground(ctx,width,height){
    const floor=height*.61;
    const haze=ctx.createLinearGradient(0,0,0,height);
    haze.addColorStop(0,'#142737');haze.addColorStop(.58,'#3b5b62');haze.addColorStop(1,'#203d48');
    ctx.fillStyle=haze;ctx.fillRect(0,0,width,height);
    for(let y=10;y<floor;y+=38){
      ctx.fillStyle='#152c3550';ctx.fillRect(0,y,width,2);
      for(let x=(y%76<38?0:34);x<width;x+=68)ctx.fillRect(x,y,2,37);
    }
    for(const scale of [.12,.37,.63,.88]){
      const x=width*scale;
      const light=ctx.createRadialGradient(x,floor*.64,1,x,floor*.64,69);
      light.addColorStop(0,'#8bd4b66e');light.addColorStop(1,'#91d4ae00');
      ctx.fillStyle=light;ctx.fillRect(x-70,floor*.64-70,140,140);
      ctx.fillStyle='#526e72';ctx.fillRect(x-14,0,28,floor);
      ctx.fillStyle='#7b928b';ctx.fillRect(x-14,0,5,floor);
      polygon(ctx,[[x,floor*.55],[x+7,floor*.63],[x,floor*.72],[x-7,floor*.63]],'#a3dfbd');
    }
    ctx.fillStyle='#425f65';ctx.fillRect(0,floor,width,height-floor);
    ctx.strokeStyle='#253e48';
    for(let x=-width; x<=width*2; x+=width/8){
      ctx.beginPath();ctx.moveTo(width/2+(x-width/2)*.34,floor);ctx.lineTo(x,height);ctx.stroke();
    }
    for(const fraction of [0,.13,.32,.58,.94]){
      const y=floor+(height-floor)*fraction;
      ctx.fillStyle='#2d4850';ctx.fillRect(0,y,width,1.7);
    }
  }

  M.Assets.registerPack({units:{training_slime:slime}});
  M.TrainingArt={load,drawGround,drawTower,drawBattleBackground};
})(window);
