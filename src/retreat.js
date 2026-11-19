/* Camp navigation and facilities. The party and progression still use the current Game. */
(function (global) {
  'use strict';

  const M = global.MyGO;
  const art = M.RetreatArt;
  const visitors = M.RetreatVisitors;
  const {stations,walkable,route,district,facing} = M.RetreatLayout;
  const keys = {
    w: [0, -1], arrowup: [0, -1], a: [-1, 0], arrowleft: [-1, 0],
    s: [0, 1], arrowdown: [0, 1], d: [1, 0], arrowright: [1, 0]
  };
  const width=1360, height=768;
  const {left,right,top,bottom}=art.bounds;
  const overviewFrame={x:(left+right)/2,y:(top+bottom)/2,
    zoom:Math.min((width-116)/(right-left),(height-158)/(bottom-top))};

  class RetreatScreen {
    constructor(entry) {
      this.entry = entry;
      this.ui = entry.ui;
      this.root = document.getElementById('retreat-screen');
      this.canvas = this.root.querySelector('canvas');
      this.ctx = this.canvas.getContext('2d');
      this.buttons = this.root.querySelectorAll('[data-station]');
      this.gold = this.root.querySelector('[data-retreat-gold]');
      this.chapter = this.root.querySelector('[data-retreat-chapter]');
      this.destination = this.root.querySelector('[data-retreat-destination]');
      this.status = this.root.querySelector('[data-retreat-status]');
      this.save = this.root.querySelector('[data-retreat-save]');
      this.overviewButton = this.root.querySelector('[data-retreat-overview]');
      this.districtLabel = this.root.querySelector('[data-retreat-district]');
      this.stageButton = this.root.querySelector('[data-station="stage"]');
      this.portalButton = this.root.querySelector('[data-station="portal"]');
      this.reduceMotion = global.matchMedia('(prefers-reduced-motion: reduce)');
      this.pressed = new Set();
      this.update = this.update.bind(this);

      this.buttons.forEach(button => button.addEventListener('click', () => {
        const id = button.dataset.station;
        this.root.focus();
        this.setTarget(stations[id].point, id);
      }));
      this.canvas.addEventListener('click', event => this.onMapClick(event));
      this.overviewButton.addEventListener('click', () => this.setOverview(!this.overview));
      this.save.addEventListener('click', () => {
        const result = this.ui.saveGame();
        if (result) this.announce(result.message);
      });
      this.root.querySelector('[data-retreat-title]').addEventListener('click', () => entry.open());
      global.addEventListener('keyup', event => this.pressed.delete(event.key.toLowerCase()));
      global.addEventListener('blur', () => this.pressed.clear());
    }

    open() {
      const game = this.ui.game;
      this.scene ??= art.prepare();
      const party = game.living('player');
      const leader = party.find(unit => unit.id === 'tomori') || party[0];
      this.avatar = { id: leader?.id || 'tomori', facing: 'up', point: [2.6, 2.6] };
      this.companions = party.filter(unit => unit !== leader).map(visitors.create);
      this.setOverview(false);
      this.camera = this.cameraGoal();
      this.stageLit = false;
      this.updateStageButton();
      this.announce('');
      game.retreat ??= { chapterIntroPlayed: this.ui.chapterPlayed };
      this.root.hidden = false;
      this.positionSigns();
      this.resume();
    }

    close() {
      this.root.hidden = true;
      this.pause();
      this.target = null;
    }

    pause() {
      this.pressed.clear();
      this.root.inert = true;
      cancelAnimationFrame(this.frame);
      this.frame = null;
    }

    resume() {
      if (this.root.hidden) return;
      this.root.inert = false;
      this.refresh();
      this.root.focus();
      this.lastFrame = null;
      this.frame ??= requestAnimationFrame(this.update);
    }

    refresh() {
      const game = this.ui.game;
      const victory = game.phase === 'victory';
      const defeat = game.phase === 'defeat';
      this.gold.textContent = game.gold.toLocaleString();
      this.chapter.textContent = '第 ' + game.chapterNumber + ' 章 · ' + game.mission.title + (victory ? ' · 已通关' : '');
      this.destination.textContent = defeat ? '再次挑战本关' : victory
        ? (game.nextChapterStage ? '继续冒险 · 第 ' + (game.chapterNumber + 1) + ' 章' : '目前章节已全部通关')
        : (this.ui.chapterPlayed ? '返回当前战场' : '出发 · 第 ' + game.chapterNumber + ' 章');
      this.save.disabled = defeat;
      this.buttons.forEach(button => {
        const id=button.dataset.station;
        button.disabled = id === 'portal' ? victory && !game.nextChapterStage : defeat && (id==='shop'||id==='classes');
      });
    }

    announce(message) {
      this.status.textContent = message;
    }

    setOverview(open) {
      this.overview = open;
      this.root.classList.toggle('is-overview',open);
      this.overviewButton.setAttribute('aria-pressed', String(open));
      this.overviewButton.textContent = open ? '返回跟随视角' : '营地图';
    }

    cameraGoal() {
      if (this.overview) return {...overviewFrame};
      const [x,y]=art.project(...this.avatar.point);
      return {x,y:y-63,zoom:.81};
    }

    positionSigns() {
      const {x,y,zoom}=this.camera;
      const near=this.nearbyStation();
      this.buttons.forEach(button=>{
        const station=stations[button.dataset.station];
        const [sx,sy]=art.project(...station.structure);
        const anchorX=width/2+(sx-x)*zoom, anchorY=height/2+(sy-y)*zoom;
        const left=anchorX+station.sign[0]*zoom, top=anchorY+station.sign[1]*zoom;
        button.hidden=anchorX<45||anchorX>width-45||anchorY<80||anchorY>height-91;
        button.style.left=Math.max(107,Math.min(width-107,left))+'px';
        button.style.top=Math.max(117,Math.min(height-126,top))+'px';
        button.classList.toggle('is-near',button===near);
      });
    }

    onMapClick(event) {
      const rect = this.canvas.getBoundingClientRect();
      const nx = (event.clientX - rect.left) / rect.width;
      const ny = (event.clientY - rect.top) / rect.height;
      const rotated = this.canvas.closest('#game-shell').dataset.rotated === 'true';
      const x = this.camera.x+((rotated ? ny : nx)*width-width/2)/this.camera.zoom;
      const y = this.camera.y+((rotated ? 1-nx : ny)*height-height/2)/this.camera.zoom;
      const point = art.unproject(x, y);
      const ground=walkable(...point);
      const building = [...this.buttons].find(button => {
        const station=stations[button.dataset.station];
        if(button.disabled || !station.hit) return false;
        const [sx,sy]=art.project(...station.structure), [left,top,right,bottom]=station.hit;
        return (y<sy-25||!ground) && x>=sx+left && x<=sx+right && y>=sy+top && y<=sy+bottom;
      });
      if (building) building.click();
      else if (ground) {
        this.root.focus();
        this.setTarget(point);
      }
    }

    setTarget(point, station = null) {
      const waypoints=route(this.avatar.point,point);
      if (!waypoints.length) {
        this.announce('沿步道或栈桥前往');
        return;
      }
      this.pressed.clear();
      this.target = { point, station, waypoints };
      if(this.overview) this.setOverview(false);
      this.announce(station ? '前往' + stations[station].name + '…' : '');
    }

    nearbyStation() {
      const [u, v] = this.avatar.point;
      return [...this.buttons].find(button => {
        const [a, b] = stations[button.dataset.station].point;
        return !button.disabled && Math.hypot(u - a, v - b) < .76;
      });
    }

    onKeyDown(event) {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === 'tab') {
        const enabled = [...this.root.querySelectorAll('button:enabled:not([hidden])')];
        const first = enabled[0], last = enabled.at(-1), focus = document.activeElement;
        if (!enabled.includes(focus) || (event.shiftKey ? focus === first : focus === last)) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        }
      } else if (keys[key]) {
        event.preventDefault();
        if(this.overview) this.setOverview(false);
        this.pressed.add(key);
        this.target = null;
        this.announce('');
      } else if (key === 'e' || (key === 'enter' && event.target === this.root)) {
        event.preventDefault();
        const station = this.nearbyStation();
        if (station && stations[station.dataset.station].hit && !event.repeat) this.useStation(station.dataset.station);
      }
    }

    updateStageButton() {
      this.stageButton.setAttribute('aria-pressed',String(this.stageLit));
      this.stageButton.querySelector('[data-retreat-lights]').textContent=this.stageLit?'关闭舞台灯':'开启舞台灯';
    }

    useStation(id) {
      this.target = null;
      this.announce('');
      if (id === 'shop') {
        this.pause();
        this.entry.shop.open();
      } else if (id === 'classes') {
        this.pause();
        this.entry.openFormation('classes');
      } else if (id === 'stage') {
        this.stageLit=!this.stageLit;
        this.updateStageButton();
        this.announce(this.stageLit?'舞台灯已亮起':'舞台灯已熄灭');
      } else if (id === 'lounge') {
        this.announce('已抵达水岸露台');
      } else if (id === 'portal') {
        const game = this.ui.game;
        this.close();
        game.retreat = null;
        if (game.phase === 'victory') this.ui.startNextStage();
        else if (game.phase === 'defeat') {
          this.ui.newGame();
          this.entry.hideToGame();
        } else this.entry.hideToGame();
      }
    }

    move(dt) {
      if (!dt) return;
      const [u, v] = this.avatar.point;
      let du = 0, dv = 0;
      if (this.target) {
        const [nextU,nextV]=this.target.waypoints[0];
        du = nextU - u;
        dv = nextV - v;
      } else {
        let x = 0, y = 0;
        for (const key of this.pressed) { x += keys[key][0]; y += keys[key][1]; }
        du = y + x;
        dv = y - x;
      }
      this.avatar._walking = false;
      const distance = Math.hypot(du, dv), stride = dt * 7.6;
      if (this.target && distance <= stride) {
        this.avatar.point = this.target.waypoints.shift();
        if (this.target.waypoints.length) return;
        const station = this.target.station;
        this.target = null;
        if (station) this.useStation(station);
      } else if (distance > 0) {
        const a = u + du * stride / distance, b = v + dv * stride / distance;
        if (walkable(a,b)) this.avatar.point=[a,b];
        else if (!this.target && a!==u && walkable(a,v)) this.avatar.point=[a,v];
        else if (!this.target && b!==v && walkable(u,b)) this.avatar.point=[u,b];
        else if (this.target) {
          this.target=null;
          this.announce('沿步道或栈桥前往');
          return;
        } else return;
        this.avatar._walking = true;
        this.avatar.facing = facing(du,dv);
      }
    }

    update(now) {
      this.frame = null;
      const dt = this.lastFrame === null ? 0 : Math.min(.05, (now - this.lastFrame) / 1000);
      this.lastFrame = now;
      this.move(dt);
      if (this.root.hidden || this.root.inert) return;
      for(const companion of this.companions) visitors.update(companion,dt);

      const goal=this.cameraGoal();
      const blend=this.reduceMotion.matches?1:1-Math.exp(-dt*7.8);
      for(const key of ['x','y','zoom']) this.camera[key]+=(goal[key]-this.camera[key])*blend;
      this.positionSigns();
      const area=district(...this.avatar.point);
      if(this.districtLabel.textContent!==area) this.districtLabel.textContent=area;
      const ctx = this.ctx;
      const time=this.reduceMotion.matches ? 0 : now / 1000;
      ctx.drawImage(this.scene.water.canvas,0,0);
      art.animateLake(ctx,time);
      ctx.save();
      ctx.translate(width/2,height/2);
      ctx.scale(this.camera.zoom,this.camera.zoom);
      ctx.translate(-this.camera.x,-this.camera.y);
      const {land,props}=this.scene;
      ctx.drawImage(land.canvas,land.x,land.y);
      if (this.target) {
        const [x, y] = art.project(...this.target.point);
        ctx.strokeStyle = '#e9ddaa';
        ctx.beginPath();
        ctx.ellipse(x, y, 15, 7, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      const actors=[...this.companions,this.avatar].map(actor=>({actor,depth:art.project(...actor.point)[1]}));
      let activeVisitor=null, closest=3.4;
      for(const companion of this.companions){
        if(!companion.activity) continue;
        const distance=Math.hypot(companion.point[0]-this.avatar.point[0],companion.point[1]-this.avatar.point[1]);
        if(distance<closest){ activeVisitor=companion; closest=distance; }
      }
      const horizontal=width/(2*this.camera.zoom), vertical=height/(2*this.camera.zoom);
      const view={left:this.camera.x-horizontal,right:this.camera.x+horizontal,
        top:this.camera.y-vertical,bottom:this.camera.y+vertical};
      const scene=[...props,...actors].sort((a,b)=>a.depth-b.depth);
      for(const prop of scene){
        if(prop.actor) this.drawActor(ctx,prop.actor,now,prop.actor===activeVisitor);
        else if(prop.x<view.right && prop.y<view.bottom && prop.x+prop.canvas.width>view.left && prop.y+prop.canvas.height>view.top){
          ctx.drawImage(prop.canvas,prop.x,prop.y);
        }
      }
      art.animatePortal(ctx,time,!this.portalButton.disabled);
      art.animateStage(ctx,time,this.stageLit);
      ctx.restore();
      this.frame = requestAnimationFrame(this.update);
    }

    drawActor(ctx,actor,now,showActivity){
      const [x,y]=art.project(...actor.point);
      if (actor === this.avatar) {
        ctx.strokeStyle = '#f4dfa0';
        ctx.beginPath();
        ctx.ellipse(x, y, 19, 8, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      const work=actor.activity && !this.reduceMotion.matches;
      const bob=work && ['guitar','drums','voice'].includes(actor.activity.effect)
        ? Math.sin(actor.taskTime*11)*1.35 : 0;
      if (!M.Characters.drawMap(ctx, actor, x, y+bob, 61, now)) {
        const unit = this.ui.game.getUnit(actor.id);
        if (unit) M.Assets.drawUnit(ctx, unit, x - 16, y - 32, 32);
      }
      if(actor.activity && !this.overview){
        art.drawActivity(ctx,actor,x,y,showActivity,this.reduceMotion.matches?0:actor.taskTime);
      }
    }
  }

  M.RetreatScreen = RetreatScreen;
})(window);
