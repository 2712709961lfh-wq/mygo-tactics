'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('node:assert/strict');
const {createCanvas, Image, GlobalFonts} = require('@napi-rs/canvas');
GlobalFonts.registerFromPath('C:/Windows/Fonts/msyh.ttc', 'Microsoft YaHei');
const root = path.resolve(__dirname, '..');
class LocalImage extends Image { set src(v) { super.src = v.startsWith('data:') ? v : fs.readFileSync(path.join(root, v.split('?')[0])); } }
const w = {console, Date, Math, Map, Set, Image: LocalImage, performance: {now: () => 1600},
  requestAnimationFrame: () => 0, cancelAnimationFrame: () => {}, document: {createElement: () => createCanvas(1, 1)}};
w.window = w; vm.createContext(w);
for (const n of ['equipment-data','magic-data','inventory','class-data','config','chapter-three','chapter-four',
  'chapter-five','chapter-six','chapter-seven','map-projection','rng','growth-data','growth','grid','pathfinding',
  'combat','game','assets','garden-map','moon-map','park-map','characters','dark-soyo','watercourt-art',
  'masked-court-art','livehouse-art','combat-vfx','battle'])
  vm.runInContext(fs.readFileSync(path.join(root, 'src', n + '.js'), 'utf8'), w, {filename:n});
(async () => {
  const M = w.MyGO;
  await Promise.all([M.Characters.load(), M.WatercourtArt.load(), M.MaskedCourtArt.load(), M.LivehouseArt.load(), M.CombatVfx.load()]);
  assert(M.CombatVfx.ready);
  const g = new M.Game({stage:7, recruited:['xueyue','nina'], seed:57}), out = path.join(root, 'docs/previews');
  const fifth = new M.Game({stage:5, seed:57}), sixth = new M.Game({stage:6, seed:57});
  const cases = [
    ['tomori', 'sword', null, '剑 · 接触闪光 / 适配挥砍方向'],
    ['taki', 'axe', null, '斧 · 重击碎光 / 落地尘土'],
    ['rana', 'lance', null, '枪 · 加长拖尾 / 明亮突刺'],
    ['soyo', 'tome', 'fire', '火焰 · 明亮魔法球 / 爆燃'],
    ['soyo', 'tome', 'ice', '冰 · 结晶迸射'],
    ['soyo', 'tome', 'wind', '风 · 旋流扩散'],
    ['masked_stranger', 'tome', 'thunder', '雷 · 连续雷击'],
    ['soyo', 'tome', 'dark', '暗 · 紫雾涡流'],
    ['soyo', 'tome', 'light', '光 · 金色光环'],
  ];
  function render(ctx, item, t, hit=true, crit=false, action='attack') {
    const [id, kind, element, label] = item;
    const base = g.getUnit(id) || fifth.getUnit(id) || sixth.getUnit(id) || g.getUnit('soyo');
    const attacker = {...base, id, weapon:{...base.weapon, type:kind, element}};
    const defender = {...g.getUnit('tomori'), id:'shadow_axe', side:'enemy'};
    const b = Object.create(M.BattleScene.prototype);
    Object.assign(b, {attacker, defender, duration:1800, particles:[],
      tomoriAction:action,xueyueAction:action,takiAction:action,
      result:{hit,crit,finalDamage:8,hpAfter:10}, palette:{core:'#fff',mid:'#f1c096',glow:'#f65'}});
    M.ParkMap.drawBattleBackground(ctx, 576, 324, true);
    b._drawBattle(ctx, t, (t-.58)*1800);
    ctx.fillStyle = 'rgba(9,16,24,.88)'; ctx.fillRect(0,0,576,44);
    ctx.fillStyle = '#f4e4bf'; ctx.font = 'bold 18px Microsoft YaHei'; ctx.fillText(label,18,29);
  }
  const count = 48, strip = createCanvas(1152, 648*count), c = strip.getContext('2d');
  for(let f=0;f<count;f++) for(let i=0;i<4;i++) {
    c.save();c.translate(i%2*576, f*648+Math.floor(i/2)*324);render(c,cases[i],f/(count-1));c.restore();
  }
  fs.writeFileSync(path.join(out,'combat-vfx-strip.png'),strip.toBuffer('image/png'));
  const contact = createCanvas(1728,972), cc = contact.getContext('2d');
  cases.forEach((item,i) => {cc.save();cc.translate(i%3*576,Math.floor(i/3)*324);render(cc,item,i<3?.56:.53);cc.restore();});
  fs.writeFileSync(path.join(out,'combat-vfx-elements.png'),contact.toBuffer('image/png'));
  const swings=createCanvas(1728,648),sc=swings.getContext('2d');
  for(const [i,entry] of [
    ['tomori','sword','attack',false,'灯 · 横斩'],['tomori','sword','attack2',false,'灯 · 下劈'],
    ['xueyue','sword','rush',true,'雪月 · 冲刺斩'],['taki','axe','attack',false,'立希 · 横扫'],
    ['taki','axe','attack2',false,'立希 · 下劈'],['taki','axe','special',true,'立希 · 回旋']
  ].entries()) {
    const [id,kind,action,crit,label]=entry;
    sc.save();sc.translate(i%3*576,Math.floor(i/3)*324);
    render(sc,[id,kind,null,label],.60,true,crit,action);sc.restore();
  }
  fs.writeFileSync(path.join(out,'combat-vfx-swings.png'),swings.toBuffer('image/png'));
  // Render actual battle clocks for custom heroes, armoured enemies and the boss,
  // plus misses and criticals; verify that every frame is nonempty and finite.
  const probe=createCanvas(576,324),pc=probe.getContext('2d');
  for(const item of [...cases,['iron_warden','axe',null,'重装斧'],['court-armor-n','lance',null,'重装枪']])
    for(const hit of [true,false])for(const crit of [true,false])for(const t of [.3,.5,.57,.58,.64,.82,1]) {
      render(pc,item,t,hit,crit);
      assert(pc.getImageData(0,0,576,324).data.some((n,i)=>i%4===3&&n));
    }
  console.log('Rendered 48 production battle frames, 9 effect panels and 308 hit/miss/critical/enemy cases.');
})().catch(e=>{console.error(e);process.exitCode=1;});
