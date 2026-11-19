/* Camp-only routines. The actors share sprite art with the party, but keep their own positions. */
(function (global) {
  'use strict';

  const M = global.MyGO;
  const {route, facing} = M.RetreatLayout;
  const stop = (point, label, effect, direction, seconds) => ({point, label, effect, direction, seconds});
  const routines = {
    tomori: [
      stop([-1.7,1.6],'整理歌词','book','down',3.8),
      stop([1.12,4],'记录旋律','book','right',4.6),
      stop([-2.8,3.3],'寻找灵感','look','left',2.6)
    ],
    anon: [
      stop([-14.15,4.42],'检查效果器','gear','up',3.4),
      stop([-16.55,5.77],'给吉他调音','guitar','right',3.6),
      stop([-15.76,2.52],'试弹和弦','guitar','down',4.2)
    ],
    rana: [
      stop([.74,2.68],'练习吉他','guitar','down',3.4),
      stop([-1.35,5.34],'听湖水声','look','left',3.2),
      stop([-3.2,3.43],'试弹新乐句','guitar','right',4.2)
    ],
    soyo: [
      stop([3.15,5.4],'清点补给','gear','left',3.1),
      stop([4.4,4.75],'核对补给单','book','down',4.2),
      stop([5.81,-15.32],'到露台核对贝斯谱','book','right',4.6)
    ],
    taki: [
      stop([-16.32,2.9],'检查鼓架','gear','left',2.8),
      stop([-17.28,6.18],'练习节拍','drums','down',4.1),
      stop([-15.02,3.67],'调整舞台站位','look','left',2.7)
    ],
    xueyue: [
      stop([-6.84,-5.74],'查看栈桥','look','left',2.8),
      stop([-13.35,-6.06],'巡视林边','look','up',2.7),
      stop([-5.6,-7.75],'查看湖岸入口','look','right',2.6)
    ],
    nina: [
      stop([-15.66,5.51],'练习发声','voice','down',3.5),
      stop([-14.42,2.25],'确认麦克风位置','gear','left',3.5),
      stop([-16.32,6.59],'默背歌词','book','right',4)
    ],
    nijika: [
      stop([-13.68,3.45],'整理舞台线缆','gear','left',3.7),
      stop([-16.7,6.77],'校准鼓组','drums','up',3.5),
      stop([-13.94,5.48],'清点器材箱','gear','right',3.2)
    ],
    subaru: [
      stop([5.39,-15.78],'核对演出曲目','book','up',3.1),
      stop([2.88,-15.66],'到露台喝水','drink','down',4.2),
      stop([-5.73,-14.88],'记录湖岸灯位','book','right',3.6)
    ]
  };

  const plazaMeeting=[[.42,3.32],[1.22,2.9]];
  const interactions = [
    {
      ids:['rana','soyo'], points:plazaMeeting, label:'合练副歌', effects:['guitar','bass'],
      lines:[[0,'从副歌开始吧。'],[1,'好，我用贝斯接你的尾音。'],[0,'这遍再慢一点。']]
    },
    {
      ids:['anon','taki'], points:[[-15.98,3.78],[-15.66,2.7]], label:'对练节拍', effects:['guitar','drums'],
      lines:[[0,'进副歌前数四拍，好吗？'],[1,'我先敲四下，你听到第四下再进。']]
    },
    {
      ids:['nina','nijika'], points:[[-15.92,5.77],[-15.04,5.22]], label:'试唱与伴奏', effects:['voice','drums'],
      lines:[[0,'副歌的最后一个字，我想唱得再长一点。'],[1,'好，那一拍我给你留出来。']]
    },
    {
      ids:['xueyue','subaru'], points:[[-5.92,-6.85],[-4.94,-7.33]], label:'核对栈桥灯位', effects:['look','book'],
      lines:[[0,'这座桥两端的灯都亮了。'],[1,'我记下了，等会儿沿湖再看一圈。']]
    },
    {
      ids:['anon','rana'], points:[[-13.42,4.72],[-12.64,4.27]], label:'交流吉他指法', effects:['guitar','guitar'],
      lines:[[0,'刚才那句你是从哪一品滑上去的？'],[1,'看我的手。慢一点弹就知道啦。']]
    },
    {
      ids:['soyo','subaru'], points:[[4.44,-15.63],[5.18,-16.19]], label:'讨论排练顺序', effects:['book','drink'],
      lines:[[0,'下一轮先从最难接的那一段开始吧。'],[1,'好，我去把曲谱翻到那一页。']]
    }
  ];
  const secondsPerLine = 3.1;

  function create(unit,index) {
    const stops=routines[unit.id] || routines.tomori;
    const first=stops[0];
    return {
      id:unit.id, name:unit.name, stops, point:first.point, facing:first.direction,
      activity:first, remaining:.48+index*.37, taskTime:0, stopIndex:0, speed:2.6+(index%3)*.26,
      routes:[], waypointIndex:0, _spritePhase:index*.72
    };
  }

  function arrive(actor,next) {
    actor.activity=next;
    actor.facing=next.direction;
    actor.remaining=next.seconds;
    actor.taskTime=0;
    actor.waypoints=null;
    actor._walking=false;
  }

  function beginWalk(actor,waypoints) {
    actor.waypoints=waypoints;
    actor.waypointIndex=0;
    actor.activity=null;
    actor._walking=true;
  }

  function advanceWalk(actor,dt) {
    const point=actor.waypoints[actor.waypointIndex];
    const du=point[0]-actor.point[0], dv=point[1]-actor.point[1];
    const distance=Math.hypot(du,dv), stride=actor.speed*dt;
    if(distance<=stride){
      actor.point=point;
      actor.waypointIndex++;
      if(actor.waypointIndex<actor.waypoints.length)return false;
      actor.waypoints=null;
      actor._walking=false;
      return true;
    }
    actor.point=[actor.point[0]+du*stride/distance,actor.point[1]+dv*stride/distance];
    actor.facing=facing(du,dv);
    return false;
  }

  function update(actor,dt) {
    if(actor.interacting)return;
    if(actor.waypoints){
      if(advanceWalk(actor,dt)) arrive(actor,actor.stops[actor.stopIndex]);
      return;
    }

    actor.taskTime+=dt;
    actor.remaining-=dt;
    if(actor.remaining>0) return;
    const nextIndex=(actor.stopIndex+1)%actor.stops.length;
    const destination=actor.stops[nextIndex].point;
    const waypoints=actor.point===actor.stops[actor.stopIndex].point
      ? (actor.routes[actor.stopIndex] ??= route(actor.point,destination)) : route(actor.point,destination);
    if(!waypoints.length){
      actor.remaining=actor.activity.seconds;
      return;
    }
    actor.stopIndex=nextIndex;
    beginWalk(actor,waypoints);
  }

  function createInteractions(actors) {
    const byId=new Map(actors.map(actor=>[actor.id,actor]));
    const available=interactions.filter(scene=>scene.ids.every(id=>byId.has(id)))
      .map(scene=>({...scene,actors:scene.ids.map(id=>byId.get(id))}));
    if(!available.length&&actors.length>=2){
      available.push({actors:actors.slice(0,2),points:plazaMeeting,label:'在广场聊天',effects:[],
        lines:[[0,'今晚的风很舒服。'],[1,'嗯，在出发前多坐一会儿吧。']]});
    }
    return {available,next:0,wait:1.2,active:null};
  }

  function updateInteractions(state,dt) {
    const active=state.active;
    if(!active){
      if(!state.available.length)return;
      state.wait-=dt;
      if(state.wait>0)return;
      const scene=state.available[state.next];
      state.next=(state.next+1)%state.available.length;
      const paths=scene.actors.map((actor,i)=>route(actor.point,scene.points[i]));
      if(paths.some(path=>!path.length)){
        state.wait=3;
        return;
      }
      scene.actors.forEach((actor,i)=>{
        actor.interacting=true;
        beginWalk(actor,paths[i]);
      });
      state.active={scene,elapsed:null};
      return;
    }

    const {scene}=active;
    if(active.elapsed===null){
      for(const actor of scene.actors)if(actor.waypoints)advanceWalk(actor,dt);
      if(scene.actors.some(actor=>actor.waypoints))return;
      scene.actors.forEach((actor,i)=>{
        const other=scene.actors[1-i];
        actor.facing=facing(other.point[0]-actor.point[0],other.point[1]-actor.point[1]);
        actor.activity={label:scene.label,effect:scene.effects[i]};
        actor.taskTime=0;
      });
      active.elapsed=0;
      return;
    }

    active.elapsed+=dt;
    for(const actor of scene.actors)actor.taskTime=active.elapsed;
    if(active.elapsed<scene.lines.length*secondsPerLine+1.1)return;
    for(const actor of scene.actors){
      actor.interacting=false;
      const task=actor.stops[actor.stopIndex];
      const waypoints=route(actor.point,task.point);
      if(waypoints.length)beginWalk(actor,waypoints);
      else arrive(actor,task);
    }
    state.active=null;
    state.wait=5.5;
  }

  function conversation(state) {
    const active=state.active;
    if(!active||active.elapsed===null)return null;
    const line=active.scene.lines[Math.floor(active.elapsed/secondsPerLine)];
    return line?{speaker:active.scene.actors[line[0]],text:line[1]}:null;
  }

  M.RetreatVisitors={create,update,createInteractions,updateInteractions,conversation};
})(window);
