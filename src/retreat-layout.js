/* World coordinates shared by scenery, hit testing and walking. */
(function (global) {
  'use strict';

  const hubRim = [[-5.2,-5.55],[-2.75,-5.8],[.25,-5.62],[2.7,-5.55],[5.32,-5.18],
    [5.62,-2.8],[5.72,.3],[5.68,3.1],[5.08,5.42],[2.68,5.78],[-.45,5.62],
    [-3.15,5.7],[-5.37,5.05],[-5.7,2.58],[-5.72,-.5],[-5.73,-3.2]];
  const stageRim = [[-4.25,-2.05],[-2.2,-3.4],[1.75,-3.55],[3.8,-1.7],
    [4.05,.5],[3.4,2.38],[1.75,3.56],[-1.15,3.72],[-3.22,2.74],[-4.2,.5]];
  const loungeRim = [[-3.62,-1.82],[-2.15,-3.46],[.1,-3.87],[2.82,-2.8],
    [3.92,-.68],[4.04,1.8],[2.9,3.63],[1.08,4.12],[-1.38,3.5],[-3.18,2.2]];
  const islands = [
    { name:'营地广场', center:[0,0], scale:[1.65,1.65], rim:hubRim, palette:['#80967a','#527266','#365650'] },
    { name:'排练舞台', center:[-16.8,4.35], scale:[1.35,1.37], rim:stageRim, palette:['#79857f','#596c70','#3f515d'] },
    { name:'乐队休息区', center:[4.35,-17.2], scale:[1.36,1.38], rim:loungeRim, palette:['#8f9c72','#668571','#455e55'] },
    { name:'林间空地', center:[-15.8,-6.35], scale:[1.04,.83], rim:hubRim, palette:['#87957d','#5c816b','#3a5753'] },
    { name:'湖岸空地', center:[-6.35,-16], scale:[.83,1.04], rim:hubRim, palette:['#8e9b77','#658471','#446762'] }
  ].map(island => ({ ...island, rim:island.rim.map(([u,v])=>[
    u*island.scale[0]+island.center[0], v*island.scale[1]+island.center[1]
  ]) }));
  const bridges = [
    { rect:[-12.15,2.7,-8.72,5.45], axis:'u' },
    { rect:[2.7,-12.55,5.45,-8.72], axis:'v' },
    { rect:[-10.58,-7.55,-8.78,-5.05], axis:'u' },
    { rect:[-7.55,-10.82,-5.05,-8.78], axis:'v' }
  ];
  const stations = {
    shop:{ name:'行旅商店', point:[2.63,6], structure:[1.1,6.6], sign:[-39,61], hit:[-126,-156,127,49], footprint:[1.24,1.3] },
    classes:{ name:'转职所', point:[6.05,2.76], structure:[6.55,1.05], sign:[39,61], hit:[-131,-156,129,52], footprint:[1.24,1.3] },
    portal:{ name:'梦境传送门', point:[-2.25,-2.25], structure:[-3.38,-3.38], sign:[0,48], hit:[-61,-138,61,-4], footprint:[.93,.93] },
    stage:{ name:'排练舞台', point:[-16.1,4.7], structure:[-18.25,3.96], sign:[-70,85], hit:[-207,-154,221,56], footprint:[1.52,1.42] },
    lounge:{ name:'乐队休息区', point:[4.25,-16.3], structure:[4.38,-18.2], sign:[63,92], hit:[-157,-117,158,54], footprint:[1.38,1.5] },
    grove:{ name:'林间空地', point:[-15.6,-6.2], structure:[-15.6,-6.2], sign:[-128,-66] },
    shore:{ name:'湖岸空地', point:[-6.15,-15.8], structure:[-6.15,-15.8], sign:[128,-66] }
  };
  const trees = [
    [-7.37,-8.15,.86,'green'],[-7.8,-3.75,1.03,'pink'],[-5.93,7.32,1.32,'green'],[-4.54,8.2,.95,'pink'],
    [-3.4,6.55,1.04,'gold'],[-1.23,8.3,1.2,'pink'],[4.18,7.88,.95,'pink'],[7.11,7,.94,'green'],
    [8.38,5.48,1.07,'green'],[8.14,-2.58,1.07,'pink'],[7.07,-5.15,1.2,'gold'],[6.64,-7.44,1.26,'green'],
    [.23,-8.1,1.2,'pink'],[-3.66,-8.14,.8,'green'],[-3,1.15,.79,'green'],[.38,-3.35,.83,'pink'],
    [-19.4,6.9,1.18,'pink'],[-16.45,8.13,1.2,'green'],[-13.8,6.73,.82,'pink'],[-14.6,1.48,.93,'pink'],
    [-19.45,2,.92,'green'],[-21,4.88,.85,'gold'],[.87,-17.1,.95,'gold'],[1.53,-14.65,1.02,'pink'],
    [7.37,-15.42,1.04,'green'],[7.22,-18.21,1.1,'pink'],[5.97,-20.37,1.0,'gold'],[2.72,-20.88,.87,'green'],
    [-19.12,-8.83,1.2,'green'],[-18.36,-9.67,.92,'pink'],[-15.5,-9.8,.9,'gold'],[-17.86,-3.45,1.14,'pink'],
    [-12.99,-8.75,.96,'green'],[-12.86,-3.55,1.1,'gold'],[-19.3,-5.04,.92,'green'],
    [-9.48,-16.68,.96,'green'],[-8.48,-19.78,1.18,'pink'],[-5.45,-20.3,.86,'gold'],[-3.3,-18.85,1.08,'green'],
    [-3.49,-15.14,.95,'pink'],[-8.8,-13.24,.85,'pink'],[-5.1,-11.99,1.06,'gold']
  ];
  const obstacles = Object.values(stations).filter(station=>station.footprint).map(station=>{
    const [u,v]=station.structure, [halfU,halfV]=station.footprint;
    return [u-halfU,v-halfV,u+halfU,v+halfV];
  });
  for(const [u,v,size] of trees){
    const radius=.26*size;
    obstacles.push([u-radius,v-radius,u+radius,v+radius]);
  }

  function rectangle(u,v,[left,top,right,bottom],padding=0) {
    return u>=left-padding && u<=right+padding && v>=top-padding && v<=bottom+padding;
  }

  function inside(u,v,outline) {
    let contained=false;
    for(let i=0,j=outline.length-1;i<outline.length;j=i++){
      const [a,b]=outline[i], [c,d]=outline[j];
      if((b>v)!==(d>v) && u<(c-a)*(v-b)/(d-b)+a) contained=!contained;
    }
    return contained;
  }

  function onLand(u,v) {
    return bridges.some(bridge=>rectangle(u,v,bridge.rect)) || islands.some(island=>inside(u,v,island.rim));
  }

  function walkable(u,v,margin=.16) {
    return onLand(u,v) && onLand(u-margin,v) && onLand(u+margin,v) && onLand(u,v-margin) && onLand(u,v+margin) &&
      !obstacles.some(rect=>rectangle(u,v,rect,margin-.16));
  }

  function clearLine(from,to) {
    const du=to[0]-from[0], dv=to[1]-from[1];
    const distance=Math.hypot(du,dv), steps=Math.ceil(distance/.07);
    for(let i=1;i<=steps;i++){
      const fraction=i/steps;
      // Keep shortcuts clear of the corners of a bridge or building. Taper
      // the extra clearance at the endpoints so near-edge destinations work.
      const margin=.16+Math.min(.06,Math.min(fraction,1-fraction)*distance*.15);
      if(!walkable(from[0]+du*fraction,from[1]+dv*fraction,margin)) return false;
    }
    return true;
  }

  const grid=new Map();
  const key=(u,v)=>u+','+v;
  const adjacent=[[1,0],[0,1],[-1,0],[0,-1]];

  function buildGrid() {
    const corners=islands.flatMap(island=>island.rim);
    const us=corners.map(point=>point[0]*2), vs=corners.map(point=>point[1]*2);
    for(let u=Math.ceil(Math.min(...us));u<=Math.floor(Math.max(...us));u++){
      for(let v=Math.ceil(Math.min(...vs));v<=Math.floor(Math.max(...vs));v++){
        if(walkable(u/2,v/2)) grid.set(key(u,v),{u,v,point:[u/2,v/2]});
      }
    }
    for(const node of grid.values()){
      node.neighbors=[];
      for(const [du,dv] of adjacent){
        const next=grid.get(key(node.u+du,node.v+dv));
        if(next && clearLine(node.point,next.point)) node.neighbors.push(next);
      }
    }
  }

  function nearestNode(point) {
    const u0=Math.round(point[0]*2), v0=Math.round(point[1]*2);
    let closest=null, best=Infinity;
    for(let u=u0-2;u<=u0+2;u++) for(let v=v0-2;v<=v0+2;v++){
      const node=grid.get(key(u,v));
      if(!node) continue;
      const distance=Math.hypot(point[0]-u/2,point[1]-v/2);
      if(distance<best && clearLine(point,node.point)){ closest=node; best=distance; }
    }
    return closest;
  }

  function route(from,to) {
    if(clearLine(from,to)) return [to];
    if(!grid.size) buildGrid();
    const start=nearestNode(from), end=nearestNode(to);
    if(!start || !end) return [];
    const queue=[start], parent=new Map([[start,null]]);
    for(let i=0;i<queue.length && !parent.has(end);i++){
      const node=queue[i];
      for(const next of node.neighbors){
        if(!parent.has(next)){
          parent.set(next,node);
          queue.push(next);
        }
      }
    }
    if(!parent.has(end)) return [];
    const points=[to];
    for(let node=end;node;node=parent.get(node)) points.push(node.point);
    points.reverse();
    const smooth=[];
    let anchor=from;
    for(let i=0;i<points.length;){
      let next=points.length-1;
      while(next>i && !clearLine(anchor,points[next])) next--;
      anchor=points[next];
      smooth.push(anchor);
      i=next+1;
    }
    return smooth;
  }

  function district(u,v) {
    const island=islands.find(land=>inside(u,v,land.rim));
    return island?.name || '水岸栈桥';
  }

  function facing(du,dv) {
    if(Math.abs(du-dv)>Math.abs(du+dv)) return du>dv?'right':'left';
    return du+dv>0?'down':'up';
  }

  global.MyGO.RetreatLayout={islands,bridges,stations,trees,walkable,route,district,facing};
})(window);
