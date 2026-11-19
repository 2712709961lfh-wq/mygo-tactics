/* Isometric scenery for the camp. All positions are independent of the battle grid. */
(function (global) {
  'use strict';

  const layout = global.MyGO.RetreatLayout;
  const TAU = Math.PI * 2;
  const project = (u, v, height = 0) => [680 + (u - v) * 53, 326 + (u + v) * 24 - height];
  const coast = layout.islands.flatMap(island => island.rim.map(point => project(...point)));
  const across = coast.map(point => point[0]), depth = coast.map(point => point[1]);
  const bounds = {
    left:Math.floor(Math.min(...across)-70), right:Math.ceil(Math.max(...across)+70),
    top:Math.floor(Math.min(...depth)-135), bottom:Math.ceil(Math.max(...depth)+85)
  };
  function unproject(x, y) {
    const across = (x - 680) / 53;
    const depth = (y - 326) / 24;
    return [(depth + across) / 2, (depth - across) / 2];
  }

  function polygon(ctx, points, fill, stroke) {
    ctx.beginPath();
    points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
  }

  function ground(ctx, points, fill, stroke) {
    polygon(ctx, points.map(point => project(...point)), fill, stroke);
  }

  function oval(ctx, x, y, w, h, fill, stroke) {
    ctx.beginPath();
    ctx.ellipse(x, y, w, h, 0, 0, TAU);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
  }

  function line(ctx, points, color, width = 1) {
    ctx.beginPath();
    points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  function glow(ctx, x, y, radius, color) {
    const light = ctx.createRadialGradient(x, y, 1, x, y, radius);
    light.addColorStop(0, color);
    light.addColorStop(1, 'transparent');
    oval(ctx, x, y, radius, radius, light);
  }

  function randomSource() {
    let seed = 7949;
    return () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }

  function drawLake(ctx, random) {
    const lake = ctx.createRadialGradient(690, 95, 48, 690, 338, 750);
    lake.addColorStop(0, '#38656a');
    lake.addColorStop(.52, '#1b444b');
    lake.addColorStop(1, '#091c28');
    ctx.fillStyle = lake;
    ctx.fillRect(0, 0, 1360, 768);
    glow(ctx, 683, 104, 280, '#aac3ab45');
    glow(ctx, 210, 534, 270, '#437d7136');
    glow(ctx, 1134, 560, 325, '#48748532');
    for (let i = 0; i < 550; i++) {
      const x = random() * 1360, y = random() * 768;
      const length = 3 + random() ** 2 * 82;
      line(ctx, [[x, y], [x + length, y]], i % 4 ? '#9dcebe16' : '#b9d9c531');
    }
  }

  function drawIsland(ctx, { rim, center, palette }, random) {
    const [cx,cy]=project(...center);
    const shore = rim.map(point => project(...point));
    const rock = shore.map(([x, y], i) => [x + (cx - x) * .027, y + 49 + (i % 3) * 4]);
    for(const spread of [1.035,1.08,1.14]){
      polygon(ctx,rock.map(([x,y])=>[cx+(x-cx)*spread,cy+36+(y-cy-36)*spread]),null,'#8acabd20');
    }
    polygon(ctx, rock.map(([x, y]) => [x, y + 5]), '#0d2c35', '#6ca19350');
    for (let i = 0; i < shore.length; i++) {
      const j = (i + 1) % shore.length;
      if(shore[j][0] >= shore[i][0]) continue;
      polygon(ctx, [shore[i], shore[j], rock[j], rock[i]], i < 8 ? '#3d514e' : '#4d6154', '#213d3d');
      for (let k = 0; k < 12; k++) {
        const f = random(), height = 9 + random() * 39;
        const [x, y] = shore[i].map((coord, axis) => coord + (shore[j][axis] - coord) * f);
        polygon(ctx, [[x, y + 6], [x + 4 + random() * 15, y + 11], [x - 5, y + height]], '#172e3438');
      }
      line(ctx, [[shore[i][0], shore[i][1] + 10], [shore[j][0], shore[j][1] + 10]], '#b1a88250', 2);
    }
    const grass = ctx.createLinearGradient(0, cy-250, 0, cy+250);
    grass.addColorStop(0, palette[0]);
    grass.addColorStop(.55, palette[1]);
    grass.addColorStop(1, palette[2]);
    polygon(ctx, shore, grass, '#a6ae80');

    ctx.save();
    ctx.clip();
    const us=rim.map(point=>point[0]), vs=rim.map(point=>point[1]);
    const minU=Math.min(...us), minV=Math.min(...vs), spanU=Math.max(...us)-minU, spanV=Math.max(...vs)-minV;
    const grassMarks=Math.ceil(spanU*spanV*7.2);
    for (let i = 0; i < grassMarks; i++) {
      const [x, y] = project(minU+random()*spanU,minV+random()*spanV);
      oval(ctx, x, y, 1 + random() * 5, .7 + random() * 2, i % 3 ? '#d2ce8b26' : '#193d3d44');
      if (i % 9 === 0) line(ctx, [[x - 3, y], [x - 2, y - 4], [x, y], [x + 4, y - 7]], '#b3bd7e60');
    }
    ctx.restore();
  }

  function drawRoad(ctx, path, width, color) {
    ctx.save();
    ctx.lineCap='round';
    ctx.lineJoin='round';
    const points=path.map(point=>project(...point));
    line(ctx,points,'#3d5b515c',width+7);
    line(ctx,points,'#a6ae8e',width+2);
    line(ctx,points,color,width);
    ctx.restore();
  }

  function drawClearing(ctx, [u,v], tone) {
    const [x,y]=project(u,v);
    const turf=ctx.createRadialGradient(x,y,10,x,y,235);
    turf.addColorStop(0,tone);
    turf.addColorStop(1,'transparent');
    oval(ctx,x,y,211,92,turf);
  }

  function bridge(ctx, {rect:[u,v,right,bottom],axis}) {
    const corners=[[u,v],[right,v],[right,bottom],[u,bottom]];
    const surface=corners.map(point=>project(...point));
    polygon(ctx,surface.map(([x,y])=>[x+5,y+23]),'#182e38b0');
    polygon(ctx,surface,'#695350','#cab285');
    const alongU=axis==='u', start=alongU?u:v, end=alongU?right:bottom;
    const from=alongU?v:u,to=alongU?bottom:right;
    const point=(a,b,z=0)=>alongU?project(a,b,z):project(b,a,z);
    for(let a=start;a<end;a+=.18){
      const next=Math.min(a+.166,end);
      polygon(ctx,[point(a,from),point(next,from),point(next,to),point(a,to)],a%0.36<-.18?'#ae9273':'#907861');
    }
    for(const edge of [from,to]){
      line(ctx,[point(start,edge,16),point(end,edge,16)],'#514540',4);
      line(ctx,[point(start,edge,18),point(end,edge,18)],'#bf9d78',2);
      for(let a=start;a<=end+.01;a+=(end-start)/4){
        line(ctx,[point(a,edge),point(a,edge,22)],'#5b5045',5);
        const [x,y]=point(a,edge,22);
        oval(ctx,x,y,3,2,'#dcc093');
      }
    }
  }

  function drawCourt(ctx, random) {
    const edge = [[-2.35, -2.35], [2.35, -2.35], [2.35, 2.35], [-2.35, 2.35]];
    ground(ctx, [[-3.55, -3.55], [-1.75, -3.55], [3.7, -2.95], [3.7, -1.6], [2.6, .1], [2.6, 2.35],
      [1.05, 3.33], [-2.87, 3.67], [-3.75, 2.91], [-2.52, 1.13], [-2.52, -1.32]], '#828f72', '#b1ae81');
    ground(ctx, edge, '#a2a68a', '#ced3aa');
    for (let u = 0; u < 8; u++) {
      for (let v = 0; v < 8; v++) {
        const a = -2.28 + u * .57, b = -2.28 + v * .57;
        const colors = ['#899983', '#9da58d', '#a1aa8d', '#8a9c87', '#a8ac92'];
        ground(ctx, [[a, b], [a + .54, b], [a + .54, b + .54], [a, b + .54]], colors[Math.floor(random() * colors.length)]);
      }
    }
    const [x, y] = project(0, 0);
    oval(ctx, x, y, 127, 58, '#627f75', '#d9ca96');
    oval(ctx, x, y, 113, 51, '#344f50', '#9ca984');
    oval(ctx, x, y, 98, 44, '#476c64', '#c1b87a');
    const compass = [[x, y - 43], [x + 15, y - 8], [x + 94, y], [x + 15, y + 8],
      [x, y + 43], [x - 15, y + 8], [x - 94, y], [x - 15, y - 8]];
    polygon(ctx, compass, '#bdaf79', '#e5d1a0');
    polygon(ctx, [[x, y - 43], [x + 15, y - 8], [x, y], [x + 94, y], [x + 15, y + 8], [x, y + 43],
      [x - 15, y + 8], [x, y], [x - 94, y], [x - 15, y - 8]], '#827e56');
    oval(ctx, x, y, 15, 7, '#314f51', '#eee1ab');
  }

  function tree(ctx, u, v, size, colors, random) {
    const [x, y] = project(u, v);
    oval(ctx, x + 13 * size, y + 4, 38 * size, 14 * size, '#112d2a67');
    line(ctx, [[x, y], [x + 1, y - 25 * size], [x - 2, y - 55 * size]], '#594839', 8 * size);
    line(ctx, [[x - 2, y], [x - 3, y - 38 * size]], '#a4815b', 2 * size);
    const clusters = [[-23, -42, 32], [22, -47, 33], [-13, -66, 34], [16, -75, 28], [2, -54, 34]];
    clusters.forEach(([dx, dy, radius], i) => {
      const cx = x + dx * size, cy = y + dy * size;
      oval(ctx, cx, cy, radius * size, radius * .79 * size, colors[0], '#294a3f66');
      oval(ctx, cx - 3 * size, cy - 5 * size, radius * .85 * size, radius * .65 * size, colors[1 + i % 2]);
      for (let k = 0; k < 22; k++) {
        const angle = random() * TAU, r = Math.sqrt(random()) * radius * .76 * size;
        oval(ctx, cx + Math.cos(angle) * r, cy - 6 * size + Math.sin(angle) * r * .7,
          (1.1 + random() * 2.5) * size, (1 + random() * 1.5) * size, k % 5 ? colors[2] : colors[3]);
      }
    });
  }

  const green = ['#294d48', '#3f6858', '#527b61', '#89a179'];
  const pink = ['#654a59', '#895969', '#a46e78', '#d79896'];
  const yellow = ['#615a40', '#8a7848', '#ad9358', '#dbb576'];

  function lantern(ctx, u, v, tint = '#ffd186') {
    const [x, y] = project(u, v);
    oval(ctx, x + 4, y + 1, 18, 7, '#15312d55');
    line(ctx, [[x, y], [x, y - 36]], '#333e39', 4);
    glow(ctx, x, y - 32, 29, tint + '60');
    polygon(ctx, [[x - 8, y - 38], [x, y - 45], [x + 8, y - 38], [x + 5, y - 27], [x - 5, y - 27]], '#584b39');
    polygon(ctx, [[x - 4, y - 37], [x + 4, y - 37], [x + 4, y - 29], [x - 4, y - 29]], tint);
  }

  function building(ctx, u, v, palette, store) {
    const center = project(u, v)[0];
    const point = (dx, dy, z = 0) => {
      const [x, y] = project(u + dx, v + dy, z);
      return [store ? 2 * center - x : x, y];
    };
    const face = (points, fill, stroke) => polygon(ctx, points.map(p => point(...p)), fill, stroke);
    const wall=70, ridge=120, overhang=1.17;
    const roofHeight=x=>ridge-(ridge-wall)*Math.abs(x);
    const eave=roofHeight(overhang);
    face([[-1.16, -.85], [1.47, -.85], [1.68, 1.22], [-1.14, 1.22]], '#1a31334f');
    face([[-1.22, -1.05], [1.28, -1.05], [1.28, 1.08], [-1.22, 1.08]], '#92977d', '#c0b391');
    face([[1, -1, 4], [1, 1, 4], [1, 1, wall], [1, -1, wall]], palette.side, '#55484d');
    face([[-1, 1, 4], [1, 1, 4], [1, 1, wall], [0, 1, ridge], [-1, 1, wall]], palette.front, '#695447');
    face([[-1, 1.01, 8], [1, 1.01, 8], [1, 1.01, 16], [-1, 1.01, 16]], '#696b5b');
    for (const d of [-.94, .94]) {
      face([[d - .04, 1.02, 7], [d + .04, 1.02, 7], [d + .04, 1.02, 72], [d - .04, 1.02, 72]], '#51433f');
    }
    // Both wall tops use the roof plane at x=±1. The fascia hangs over the joint.
    face([[-overhang,-1.16,eave],[0,-1.16,ridge],[0,1.19,ridge],[-overhang,1.19,eave]],palette.roofLight);
    face([[0,-1.16,ridge],[overhang,-1.16,eave],[overhang,1.19,eave],[0,1.19,ridge]],palette.roofDark);
    face([[overhang,-1.16,eave],[overhang,1.19,eave],[overhang,1.19,eave-5],[overhang,-1.16,eave-5]],'#5d5046');
    face([[-overhang,1.19,eave],[0,1.19,ridge],[overhang,1.19,eave],
      [overhang,1.19,eave-5],[0,1.19,ridge-5],[-overhang,1.19,eave-5]],'#795f50');
    for (let i = 1; i < 8; i++) {
      const x = i * .146;
      const z = roofHeight(x);
      line(ctx, [point(x, -1.13, z), point(x, 1.18, z)], '#1d27294c', 1.5);
      line(ctx, [point(-x, -1.13, z), point(-x, 1.18, z)], '#fff3ce20');
    }
    line(ctx,[point(-overhang,1.19,eave),point(0,1.19,ridge),point(overhang,1.19,eave)],palette.trim,2.5);
    line(ctx,[point(0,-1.16,ridge),point(0,1.19,ridge)],palette.trim,2.5);
    face([[-.29, 1.02, 6], [.29, 1.02, 6], [.29, 1.02, 45], [0, 1.02, 55], [-.29, 1.02, 45]], '#3a4846', '#dec194');
    face([[.13, 1.025, 20], [.18, 1.025, 20], [.18, 1.025, 24], [.13, 1.025, 24]], '#e4c487');
    for (const offset of [-.64, .64]) {
      face([[offset - .19, 1.03, 27], [offset + .19, 1.03, 27], [offset + .19, 1.03, 53], [offset - .19, 1.03, 53]], '#6f5344', '#5c5247');
      const [x, y] = point(offset, 1.035, 40);
      glow(ctx, x, y, 20, palette.light + '66');
      for (const panel of [-.08, .08]) {
        face([[offset + panel - .065, 1.04, 30], [offset + panel + .065, 1.04, 30],
          [offset + panel + .065, 1.04, 49], [offset + panel - .065, 1.04, 49]], palette.light);
      }
    }
    face([[1.01, -.57, 29], [1.01, .33, 29], [1.01, .33, 52], [1.01, -.57, 52]], palette.light, '#675946');
    line(ctx, [point(1.02, -.12, 30), point(1.02, -.12, 52)], '#655848', 3);
    if (store) {
      for (let i = 0; i < 8; i++) {
        const a = -.83 + i * .208, b = a + .21;
        const stripe = i % 2 ? '#ccb485' : '#965b51';
        face([[a, 1.04, 68], [b, 1.04, 68], [b, 1.65, 54], [a, 1.65, 54]], stripe, '#684f4944');
        face([[a, 1.65, 54], [b, 1.65, 54], [b, 1.65, 48], [a, 1.65, 48]], stripe, '#684f4980');
      }
    } else {
      for (const x of [-.69, .69]) {
        face([[x - .15, 1.08, 72], [x + .15, 1.08, 72], [x + .15, 1.08, 39], [x, 1.08, 31], [x - .15, 1.08, 39]], '#5c426e', '#ceb2ac');
        const [bx, by] = point(x, 1.09, 57);
        polygon(ctx, [[bx, by - 7], [bx + 5, by], [bx, by + 7], [bx - 5, by]], '#e8bd9c');
      }
    }
  }

  function portalStone(ctx) {
    const [x, y] = project(...layout.stations.portal.structure);
    oval(ctx, x + 6, y + 14, 112, 27, '#162e3461');
    for (let i = 0; i < 4; i++) {
      const width = .98 - i * .12;
      ground(ctx, [[-3.4 - width, -3.4 - width, i * 7], [-3.4 + width, -3.4 - width, i * 7],
        [-3.4 + width, -3.4 + width, i * 7], [-3.4 - width, -3.4 + width, i * 7]], '#718987', '#a6b8a2');
    }
    oval(ctx, x, y - 8, 48, 11, '#b3e5c467', '#d0f9ca98');
    for (const side of [-1, 1]) {
      const dx = x + side * 41;
      polygon(ctx, [[dx - 12, y - 10], [dx + 12, y - 10], [dx + 10, y - 65], [dx - 10, y - 65]], '#647e7c', '#acb8a1');
      line(ctx, [[dx + 6, y - 12], [dx + 6, y - 65]], '#263f4a', 3);
    }
    ctx.beginPath();
    ctx.ellipse(x, y - 66, 41, 44, 0, Math.PI, TAU);
    ctx.strokeStyle = '#698784';
    ctx.lineWidth = 23;
    ctx.stroke();
    ctx.strokeStyle = '#b9c7a9';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.lineWidth = 1;
    for (let i = 0; i < 9; i++) {
      const angle = Math.PI + i * Math.PI / 8;
      const px = x + 41 * Math.cos(angle), py = y - 66 + 44 * Math.sin(angle);
      oval(ctx, px, py, 3, 3, '#c9e2af');
    }
    polygon(ctx, [[x, y - 135], [x + 10, y - 118], [x, y - 106], [x - 10, y - 118]], '#a8e0bb', '#dbedbd');
  }

  function box(ctx,x,y,w,h,fill,edge) {
    ctx.beginPath();
    ctx.roundRect(x,y,w,h,Math.min(5,h/2));
    ctx.fillStyle=fill;
    ctx.fill();
    if(edge){ctx.strokeStyle=edge;ctx.stroke();}
  }

  function note(ctx,x,y,color) {
    oval(ctx,x,y,5,3,color);
    line(ctx,[[x+4,y],[x+4,y-15],[x+12,y-11]],color,2);
  }

  function instrument(ctx,id,x,y,w,h) {
    const image=global.MyGO.LivehouseArt?.images[id];
    if(!image) return;
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(image,x,y,w,h);
    ctx.imageSmoothingEnabled=true;
  }

  function amp(ctx,x,y,w,h) {
    polygon(ctx,[[x,y],[x+7,y-6],[x+w+8,y-6],[x+w,y]],'#55606d','#87909a');
    polygon(ctx,[[x+w,y],[x+w+8,y-6],[x+w+8,y+h-6],[x+w,y+h]],'#293540','#6f7784');
    box(ctx,x,y,w,h,'#1a2431','#9f9e9b');
    box(ctx,x+3,y+7,w-6,h-10,'#394655','#7e8290');
    instrument(ctx,'speaker',x+w*.1,y+h*.09,w*.8,h*.86);
    for(let i=0;i<4;i++) oval(ctx,x+7+i*5,y+4,1.2,1.15,i?'#a9aa94':'#95d8b1');
  }

  function microphone(ctx,x,y) {
    oval(ctx,x,y,8,3,'#19232f','#8796b0');
    line(ctx,[[x,y],[x,y-37],[x+11,y-41]],'#9ca8bd',2);
    line(ctx,[[x+9,y-40],[x+15,y-43]],'#222838',4);
    line(ctx,[[x,y],[x-10,y+4],[x-27,y+4],[x-38,y+13]],'#151c2b',1.5);
  }

  function bass(ctx,x,y) {
    ctx.save();
    ctx.translate(x,y);
    ctx.rotate(-.28);
    polygon(ctx,[[-8,-4],[-10,-13],[-6,-22],[-1,-16],[3,-18],[7,-25],[9,-20],[7,-11],[10,-5],[6,0],[-4,1]],'#7ba7b0','#d2dbba');
    polygon(ctx,[[-2,-9],[3,-9],[2,-44],[-2,-44]],'#38374a','#c0af87');
    polygon(ctx,[[-2,-42],[4,-42],[6,-51],[-2,-51]],'#b7ab85','#e8d2aa');
    for(const fret of [-16,-21,-26,-31,-36]) line(ctx,[[-1.7,fret],[2,fret]],'#a8a096');
    line(ctx,[[.5,-46],[.5,-6]],'#eddfb5');
    line(ctx,[[-3,-8],[5,-8]],'#293c4c',3);
    ctx.restore();
  }

  function drawStage(ctx) {
    const [x,y]=project(...layout.stations.stage.structure);
    ctx.save();ctx.translate(x,y);
    oval(ctx,0,16,206,62,'#13273378');
    const deck=[[-195,0],[-118,-48],[138,-46],[204,-1],[135,41],[-119,44]];
    polygon(ctx,deck.map(([a,b])=>[a,b+18]),'#202c3b','#818193');
    polygon(ctx,deck,'#494758','#a39ba2');
    for(let i=0;i<8;i++){
      const y=-32+i*8;
      line(ctx,[[-140+Math.abs(y)*.3,y],[148-Math.abs(y)*.24,y]],'#a294af45');
    }
    polygon(ctx,[[-122,43],[133,41],[133,61],[-119,61]],'#302b41','#716985');
    line(ctx,[[-116,47],[125,45]],'#b99dc0',2);
    for(let i=-2;i<=2;i++) note(ctx,i*32-5,56,'#a0a9d780');
    for(let i=0;i<3;i++){
      const z=3*i;
      polygon(ctx,[[48,40+z],[122,40+z],[131,49+z],[57,49+z]],'#726b7e','#a09abe');
    }

    const curtain=ctx.createLinearGradient(0,-126,0,-35);
    curtain.addColorStop(0,'#1b223b');curtain.addColorStop(1,'#3c3453');
    polygon(ctx,[[-138,-123],[157,-123],[146,-31],[-143,-31]],curtain,'#6b6e96');
    for(let i=0;i<18;i++){
      const dx=-132+i*16;
      polygon(ctx,[[dx,-121],[dx+5,-121],[dx+3,-32],[dx-5,-32]],'#9994bf18');
    }
    oval(ctx,8,-81,29,29,null,'#acd6d288');
    oval(ctx,8,-81,22,22,null,'#b5b3e199');
    for(const [dx,dy] of [[-84,-109],[-62,-68],[82,-68],[113,-100],[-34,-103],[52,-108]]){
      polygon(ctx,[[dx-4,dy],[dx,dy-5],[dx+4,dy],[dx,dy+5]],'#bcdae4a0');
    }
    polygon(ctx,[[8,-103],[13,-84],[28,-81],[13,-77],[8,-61],[3,-77],[-12,-81],[3,-84]],'#c4eee6bf');

    for(const dx of [-157,169]){
      line(ctx,[[dx,-20],[dx+4,-146]],'#28384b',10);
      line(ctx,[[dx+3,-27],[dx+6,-141]],'#8797af',2);
      for(let i=0;i<6;i++) line(ctx,[[dx-2,-34-i*17],[dx+7,-47-i*17]],'#65748e',2);
    }
    line(ctx,[[-156,-146],[170,-146]],'#28384a',13);
    line(ctx,[[-156,-152],[170,-152]],'#94a2b4',2);
    for(let i=-151;i<167;i+=16) line(ctx,[[i,-140],[i+12,-149]],'#6e819e',2);
    for(const [dx,color] of [[-107,'#eaaaad'],[-49,'#aaa8da'],[45,'#86c6d2'],[107,'#aaa8da']]){
      box(ctx,dx-7,-142,13,12,'#242b3f','#7788a5');
      oval(ctx,dx,-132,5,2,color);
    }

    amp(ctx,-147,-38,47,42);
    amp(ctx,111,-33,42,37);
    box(ctx,-77,-1,30,15,'#232f41','#876f80');
    box(ctx,74,8,32,14,'#243344','#87778b');
    oval(ctx,9,-8,37,9,'#202f42a7');
    // The CC0 kit is set into a hand-drawn riser and cymbal stands.
    instrument(ctx,'drums',-26,-69,72,64);
    for(const at of [-21,38]){
      line(ctx,[[at,-10],[at,-44]],'#a6a5b0',2);
      oval(ctx,at,-44,11,3,'#caad71','#eacb93');
    }
    microphone(ctx,-14,26);
    microphone(ctx,66,16);
    for(const [dx,dy] of [[-82,0],[98,-5]]){
      line(ctx,[[dx-3,dy+3],[dx-3,dy-31]],'#222c38',3);
      instrument(ctx,'guitar',dx-23,dy-43,36,36);
    }
    bass(ctx,54,-4);
    ctx.restore();
  }

  function lounge(ctx) {
    const [x,y]=project(...layout.stations.lounge.structure);
    ctx.save();ctx.translate(x,y);
    oval(ctx,5,9,155,47,'#294b42a0');
    polygon(ctx,[[-158,3],[-108,-40],[103,-44],[154,-5],[102,48],[-109,47]],'#a68c75','#e0c4a0');
    for(let i=0;i<11;i++) line(ctx,[[-134+i*20,-15],[-104+i*19,42]],'#635b4b55');
    oval(ctx,-6,12,82,29,'#825f6f','#d3a99a');
    oval(ctx,-6,12,73,23,null,'#e4b9a68c');
    for(const i of [-3,-2,-1,0,1,2,3]) note(ctx,-9+i*15,17,'#e5c7a37b');

    for(const [dx,dy] of [[-84,3],[61,-11]]){
      box(ctx,dx-22,dy-22,58,22,'#987987','#dcaaa4');
      box(ctx,dx-27,dy-8,65,17,'#be998f','#e4c3a9');
      box(ctx,dx-28,dy+1,65,12,'#6c5859','#a68580');
      box(ctx,dx-25,dy-17,12,10,'#d0af95','#e2caab');
      box(ctx,dx+15,dy-18,14,9,'#566763','#a6b294');
    }
    oval(ctx,-4,24,27,12,'#303c3b65');
    line(ctx,[[-19,22],[-19,6],[12,6],[12,22]],'#57494b',4);
    oval(ctx,-4,5,26,11,'#b38c69','#ecce9f');
    polygon(ctx,[[-13,2],[-3,-2],[8,2],[-2,7]],'#f3e6c2','#d5ab8e');
    line(ctx,[[-3,-1],[-2,6]],'#a48277');
    oval(ctx,13,1,4,2,'#e1d8bd');
    box(ctx,-118,11,28,14,'#303c50','#a9a7a7');
    box(ctx,108,1,21,22,'#414951','#a7a7a0');
    instrument(ctx,'guitar',72,-36,31,31);

    for(const [dx,dy] of [[-137,6],[-98,-35],[108,-39],[136,3]]){
      line(ctx,[[dx,dy],[dx,dy-81]],'#5f514b',5);
      line(ctx,[[dx-1,dy],[dx-1,dy-78]],'#b59576',1.4);
    }
    polygon(ctx,[[-142,-78],[-103,-119],[109,-122],[140,-79],[89,-67],[-111,-65]],'#b99e86','#e3c6a1');
    for(let i=0;i<12;i++){
      const a=-103+i*17.7;
      const b=-141+i*23.3;
      polygon(ctx,[[a,-119],[a+17.7,-119],[b+23.3,-78],[b,-78]],i%2?'#dac4a3':'#a67978');
    }
    line(ctx,[[-142,-78],[140,-79]],'#f3d5a9',2);
    ctx.beginPath();ctx.moveTo(-133,-77);ctx.quadraticCurveTo(1,-44,131,-80);ctx.strokeStyle='#483d41';ctx.stroke();
    for(let i=-117;i<=118;i+=19){
      const bulb=-62-18*(i/135)**2;
      glow(ctx,i,bulb+2,16,'#ffe1a86e');
      oval(ctx,i,bulb+2,2.3,3.3,'#ffe8b3');
    }
    ctx.restore();
  }

  function layer(width,height,x=0,y=0){
    const canvas=document.createElement('canvas');
    canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext('2d');
    ctx.translate(-x,-y);
    return {canvas,ctx,x,y};
  }

  function prepare() {
    const {left,right,top,bottom}=bounds;
    const water=layer(1360,768), land=layer(right-left,bottom-top,left,top), random=randomSource();
    drawLake(water.ctx,random);
    for(const island of layout.islands.slice().reverse()) drawIsland(land.ctx,island,random);
    for(const [path,width,color] of [
      [[[-1.45,1.45],[-3.9,3.85],[-9,4.08]],43,'#929f8b'],
      [[[1.45,-1.45],[3.92,-3.82],[4.08,-9]],43,'#929f8b'],
      [[[-2.1,-1.05],[-5.35,-3.35],[-6.35,-6.25],[-9,-6.3]],34,'#919c85'],
      [[[-1.05,-2.1],[-3.35,-5.35],[-6.25,-6.35],[-6.3,-9]],34,'#919c85'],
      [[[1.4,2.05],[2.94,4.0],[2.63,6]],32,'#9ba58d'],
      [[[2.05,1.4],[4.02,2.95],[6.05,2.76]],32,'#9ba58d'],
      [[[-11.85,4.08],[-13.7,4.08],[-16.1,4.7]],42,'#8e9897'],
      [[[4.08,-12.4],[4.08,-14.2],[4.25,-16.3]],42,'#a1aa8b'],
      [[[-10.5,-6.3],[-12.7,-6.3],[-14.24,-6.15]],30,'#a1a787'],
      [[[-6.3,-10.7],[-6.3,-12.85],[-6.1,-14.55]],30,'#a5ae8b']
    ]) drawRoad(land.ctx,path,width,color);
    for(const crossing of layout.bridges) bridge(land.ctx,crossing);
    drawCourt(land.ctx,random);

    const props=[];
    function place(u,v,paint,width=168,height=160,bottom=30,depth=0){
      const [x,y]=project(u,v);
      const entry=layer(width,height,Math.round(x-width/2),Math.round(y+bottom-height));
      paint(entry.ctx);
      props.push({...entry,depth:y+depth});
    }
    const {shop,classes,portal,stage,lounge:rest,training}=layout.stations;
    drawClearing(land.ctx,layout.clearings.grove,'#b8b98544');
    drawClearing(land.ctx,layout.clearings.shore,'#b9c38e55');
    place(...portal.structure,portalStone,250,190,32);
    place(...shop.structure,ctx=>building(ctx,...shop.structure,{front:'#ba9a74',side:'#947e65',roofLight:'#b47c61',roofDark:'#835750',trim:'#dbc394',light:'#ffe0a0'},true),310,215,49);
    place(...classes.structure,ctx=>building(ctx,...classes.structure,{front:'#bab196',side:'#909488',roofLight:'#92798d',roofDark:'#625c76',trim:'#d3bca6',light:'#e6c7e8'},false),310,215,49);
    place(...stage.structure,drawStage,465,237,74,47);
    place(...rest.structure,lounge,350,199,59,47);
    const [towerX,towerY]=project(...training.structure);
    place(...training.structure,ctx=>global.MyGO.TrainingArt.drawTower(ctx,towerX,towerY),192,219,42,17);
    const treeColors={green,pink,gold:yellow};
    for(const [u,v,size,color] of layout.trees){
      place(u,v,ctx=>tree(ctx,u,v,size,treeColors[color],random),206,189,28);
    }
    for(const [u,v] of [[-2.89,.88],[.88,-2.89],[2.7,.35],[.35,2.7],[-3.3,-1.9],[-1.9,-3.3],[3.45,3.18],
      [-8.35,2.56],[-8.35,5.6],[-12.47,2.55],[-12.47,5.55],[2.55,-8.35],[5.57,-8.35],[2.6,-12.75],[5.58,-12.75],
      [-8.4,-7.69],[-10.76,-4.91],[-7.68,-8.4],[-4.88,-11.18],[-15.4,6.18],[-15.08,2.55],
      [2.8,-16.4],[5.54,-15.73],[-14.15,-5.02],[-5,-14.7],[3.54,5.6],[5.52,3.58]]){
      place(u,v,ctx=>lantern(ctx,u,v),80,100,15);
    }
    return {water,land,props};
  }

  function animatePortal(ctx, time, active) {
    const [x, y] = project(...layout.stations.portal.structure);
    if (active) glow(ctx, x, y - 62, 106, '#92f0c358');
    const doorway = ctx.createLinearGradient(0, y - 104, 0, y - 11);
    doorway.addColorStop(0, active ? '#80d6c8' : '#233d45');
    doorway.addColorStop(.52, active ? '#336b79' : '#1f3544');
    doorway.addColorStop(1, active ? '#b1edcd' : '#395753');
    ctx.beginPath();
    ctx.ellipse(x, y - 66, 30, 34, 0, Math.PI, TAU);
    ctx.lineTo(x + 30, y - 12);
    ctx.lineTo(x - 30, y - 12);
    ctx.closePath();
    ctx.fillStyle = doorway;
    ctx.fill();
    if (active) {
      oval(ctx, x, y - 54, 20 + Math.sin(time * 1.9) * 2, 27, null, '#bcf8e2a8');
      oval(ctx, x, y - 54, 14, 21 + Math.sin(time * 2.7) * 3, null, '#d4f5d385');
      for (let i = 0; i < 15; i++) {
        const step = (time * (.12 + i % 3 * .04) + i * .17) % 1;
        oval(ctx, x + Math.sin(i * 4 + step * 5) * (11 + i % 4 * 6), y - 12 - step * 95,
          1.7, 1.7, i % 2 ? '#d7ffdd' : '#93e3c7');
      }
    }
  }

  function animateLake(ctx,time){
    for (let i = 0; i < 48; i++) {
      const x = 90 + (i * 197 % 1190) + Math.sin(time * .37 + i) * 12;
      const y = 98 + (i * 163 % 575) + Math.cos(time * .5 + i) * 8;
      ctx.globalAlpha = .23 + .17 * Math.sin(time * 1.3 + i);
      oval(ctx, x, y, i % 5 ? 1.5 : 2.5, i % 5 ? 1.5 : 2.5, i % 2 ? '#edcf8c' : '#b6efd3');
    }
    ctx.globalAlpha = 1;
  }

  function animateStage(ctx,time,on){
    const [x,y]=project(...layout.stations.stage.structure);
    if(!on) return;
    ctx.save();ctx.translate(x,y);
    for(const [i,dx,color] of [[0,-107,'rgba(237,157,178,'],[1,-49,'rgba(177,162,249,'],
      [2,45,'rgba(123,223,230,'],[3,107,'rgba(187,177,252,']]){
      const target=dx*.63+Math.sin(time*.82+i*2)*17;
      const beam=ctx.createLinearGradient(0,-131,0,17);
      beam.addColorStop(0,color+'.62)');beam.addColorStop(1,color+'.08)');
      polygon(ctx,[[dx-3,-132],[dx+4,-132],[target+36,13],[target-34,13]],beam);
      oval(ctx,target,13,29,10,color+'.18)');
      glow(ctx,dx,-132,31,color+'.4)');
    }
    ctx.restore();
  }

  function drawActivity(ctx,actor,x,y,showLabel,time){
    const {effect,label}=actor.activity;
    const side=actor.facing==='left'?-1:1;
    ctx.save();
    ctx.translate(x,y);
    if(effect==='guitar'){
      instrument(ctx,'guitar',side*12-12,-37,27,27);
    }else if(effect==='bass'){
      ctx.save();
      ctx.translate(side*15,-9);
      ctx.scale(.64,.64);
      bass(ctx,0,0);
      ctx.restore();
    }else if(effect==='drums'){
      oval(ctx,side*17,-9,11,4,'#20383c60');
      box(ctx,side*17-9,-16,18,8,'#8d6e75','#c0a998');
      oval(ctx,side*17,-16,9,3,'#ccbda7','#e1c5a3');
      const beat=Math.sin(time*13)*3;
      line(ctx,[[side*18,-17+beat],[side*10,-30]],'#e7cfa4',1.5);
    }else if(effect==='book'){
      polygon(ctx,[[side*14-8,-29],[side*14,-31],[side*14+7,-29],[side*14+6,-22],
        [side*14,-23],[side*14-7,-21]],'#f6e1b7','#997a69');
      const mark=Math.sin(time*6)*3;
      line(ctx,[[side*14+mark,-26],[side*14+mark+4,-30]],'#786762',1.3);
    }else if(effect==='gear'){
      oval(ctx,side*17,-2,13,4,'#263c3e81');
      box(ctx,side*17-10,-12,20,10,'#41474d','#b1a392');
      line(ctx,[[side*17-3,-9],[side*17+3,-9]],'#cec5a5',1.4);
      oval(ctx,side*17+5,-6,1.6,1.6,time%1>.5?'#ace2bd':'#acbc9e');
    }else if(effect==='drink'){
      box(ctx,side*15-3,-33,6,9,'#c3b3a3','#f0debf');
      const rise=time%1.2;
      line(ctx,[[side*15,-36-rise*5],[side*15+2,-38-rise*7]],'#f0debf91');
    }else if(effect==='look'){
      const blink=.45+.4*Math.sin(time*3);
      ctx.globalAlpha=blink;
      const look=side*21;
      polygon(ctx,[[look,-57],[look+2,-53],[look+6,-51],[look+2,-49],[look,-45],[look-2,-49],[look-6,-51],[look-2,-53]],'#dfd3a5');
      ctx.globalAlpha=1;
    }
    if(['guitar','bass','drums','voice'].includes(effect)){
      const lift=time%1.1;
      ctx.globalAlpha=.78-lift*.44;
      note(ctx,side*(23+lift*5),-50-lift*15,'#edcba6');
      ctx.globalAlpha=1;
    }
    if(showLabel){
      const text=actor.name+' · '+label;
      ctx.font='600 13px Microsoft YaHei, sans-serif';
      const w=ctx.measureText(text).width+16;
      box(ctx,-w/2,-87,w,23,'#162c33ee','#b5c9a978');
      ctx.fillStyle='#f1e9cb';
      ctx.textAlign='center';
      ctx.fillText(text,0,-71);
    }
    ctx.restore();
  }

  global.MyGO.RetreatArt = { project, unproject, bounds, prepare, animatePortal, animateLake, animateStage, drawActivity };
})(window);
