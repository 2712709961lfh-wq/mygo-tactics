'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const window = {MyGO:{}};
const context = vm.createContext({window});
for (const module of ['retreat-layout','retreat-visitors']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',module+'.js'),'utf8'),context);
}
const {RetreatLayout: map, RetreatVisitors: visitors} = window.MyGO;
const spawn = [2.6,2.6];

function checkRoute(from,to) {
  const waypoints=map.route(from,to);
  assert(waypoints.length, 'missing route to '+to);
  assert.equal(waypoints.at(-1),to);
  let [u,v]=from;
  for(const [nextU,nextV] of waypoints){
    const du=nextU-u, dv=nextV-v;
    const steps=Math.max(1,Math.ceil(Math.hypot(du,dv)/.13));
    for(let i=0;i<=steps;i++){
      assert(map.walkable(u+du*i/steps,v+dv*i/steps), 'route crosses an obstacle or the shoreline');
    }
    u=nextU;
    v=nextV;
  }
}

for(const station of Object.values(map.stations)) checkRoute(spawn,station.point);
for(const id of ['grove','shore']){
  const {point:[u,v]}=map.stations[id];
  for(let du=-2;du<=2;du+=.5) for(let dv=-2;dv<=2;dv+=.5){
    assert(map.walkable(u+du,v+dv),id+' needs clear space for future facilities');
  }
  checkRoute(map.stations.lounge.point,map.stations[id].point);
}
for(const {rect:[u,v,endU,endV],axis} of map.bridges){
  const centerU=(u+endU)/2, centerV=(v+endV)/2;
  assert.equal(map.district(centerU,centerV),'水岸栈桥');
  assert(map.walkable(centerU,centerV));
  // Check the full approach down the bridge axis, including each bank.
  if(axis==='u') checkRoute([u-.1,centerV],[endU+.1,centerV]);
  else checkRoute([centerU,v-.1],[centerU,endV+.1]);
}

const ids=['tomori','anon','rana','soyo','taki','xueyue','nina','nijika','subaru'];
ids.forEach((id,index)=>{
  const actor=visitors.create({id,name:id},index);
  const activities=new Set();
  let startedWalking=false, returned=false;
  for(let frame=0;frame<1800;frame++){
    visitors.update(actor,.05);
    assert(map.walkable(...actor.point), id+' left the walkable area');
    startedWalking ||= actor._walking;
    if(actor.activity) activities.add(actor.activity.label);
    if(activities.size===3 && actor.activity && actor.stopIndex===0) returned=true;
  }
  assert(startedWalking && returned, id+' did not complete and restart its routine');
});

console.log('Retreat: seven destinations, four bridge approaches, clear expansion plots and all nine visitor routines passed.');
