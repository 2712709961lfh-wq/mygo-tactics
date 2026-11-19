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

  function update(actor,dt) {
    if(actor.waypoints){
      const point=actor.waypoints[actor.waypointIndex];
      const du=point[0]-actor.point[0], dv=point[1]-actor.point[1];
      const distance=Math.hypot(du,dv), stride=actor.speed*dt;
      if(distance<=stride){
        actor.point=point;
        actor.waypointIndex++;
        if(actor.waypointIndex===actor.waypoints.length) arrive(actor,actor.stops[actor.stopIndex]);
      }else{
        actor.point=[actor.point[0]+du*stride/distance,actor.point[1]+dv*stride/distance];
        actor.facing=facing(du,dv);
      }
      return;
    }

    actor.taskTime+=dt;
    actor.remaining-=dt;
    if(actor.remaining>0) return;
    const nextIndex=(actor.stopIndex+1)%actor.stops.length;
    const waypoints=actor.routes[actor.stopIndex] ??= route(actor.point,actor.stops[nextIndex].point);
    if(!waypoints.length){
      actor.remaining=actor.activity.seconds;
      return;
    }
    actor.stopIndex=nextIndex;
    actor.waypoints=waypoints;
    actor.waypointIndex=0;
    actor.activity=null;
    actor._walking=true;
  }

  M.RetreatVisitors={create,update};
})(window);
