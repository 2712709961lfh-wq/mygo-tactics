/* ============================================================
 * config.js — 全局规则、地图、角色与武器数据
 * 所有数值集中在此处，方便后续平衡调整。
 * 使用普通 <script> 加载，因此挂载到 window.MyGO 命名空间。
 * ============================================================ */
(function (global) {
  'use strict';

  const MyGO = (global.MyGO = global.MyGO || {});

  /** 单个格子的像素尺寸。素材接口固定以 32×32 为基准。 */
  const TILE = 32;

  /**
   * 画布内部超采样倍率：逻辑坐标仍是 32px 一格，
   * 但实际 back-buffer 以 2× 绘制，放大到屏幕时像素边缘更干净。
   */
  const RENDER_SCALE = 2;

  /** 第一关地图尺寸（单位：格）；第二关独立保存尺寸。 */
  const COLS = 36;
  const ROWS = 24;

  /**
   * 地图单位的绘制高度（逻辑像素）。角色素材为 80×96，
   * 按高度 60 等比缩放；横向约 50px，会略微溢出 32px 格子。
   */
  const SPRITE_SIZE = 60;

  /** 地形定义：移动消耗、闪避、守备、是否阻挡。 */
  const TERRAIN = {
    bell: {id:'bell',name:'星铃',moveCost:1,avoid:0,def:0,blocked:false,
      desc:'停在此格可消耗一次行动唤醒星铃，恢复自身 30% 最大 HP，并惊动此地警戒队。五处任选三处，再击败指挥家即可获胜。'},
    ford: { id: 'ford', name: '共鸣浅滩', moveCost: 2, avoid: 0, def: 0, blocked: false,
      desc: '共鸣使水位下降，移动消耗 2。' },
    resonance: { id: 'resonance', name: '共鸣碑', moveCost: 1, avoid: 0, def: 0, blocked: false,
      desc: '我方停在此处可消耗一次行动，永久开启中央四格浅滩。' },
    fort: { id: 'fort', name: '休憩据点', moveCost: 1, avoid: 10, def: 2, blocked: false,
      desc: '守备 +2，闪避 +10；我方阶段开始回复最大 HP 的 20%（向上取整）。' },
    plain: {
      id: 'plain',
      name: '草地',
      moveCost: 1,
      avoid: 0,
      def: 0,
      blocked: false,
      desc: '无额外加成，移动消耗 1。'
    },
    road: {
      id: 'road', name: '花园小径', moveCost: 1, avoid: 0, def: 0, blocked: false,
      desc: '清晰的主路，移动消耗 1。'
    },
    plaza: {
      id: 'plaza', name: '内庭石坪', moveCost: 1, avoid: 0, def: 0, blocked: false,
      desc: '庭院石砖地面，移动消耗 1。'
    },
    forest: {
      id: 'forest',
      name: '森林',
      moveCost: 2,
      avoid: 20,
      def: 0,
      blocked: false,
      desc: '闪避 +20，移动消耗 2。'
    },
    mountain: {
      id: 'mountain',
      name: '山地',
      moveCost: 2,
      avoid: 0,
      def: 3,
      blocked: false,
      desc: '守备 +3，移动消耗 2。'
    },
    wall: {
      id: 'wall',
      name: '残垣',
      moveCost: Infinity,
      avoid: 0,
      def: 0,
      blocked: true,
      desc: '无法通行，也无法停留。'
    },
    gate: {
      id: 'gate',
      name: '庭院大门',
      moveCost: Infinity,
      avoid: 0,
      def: 0,
      blocked: true,
      desc: '被锁住的庭院门。击败携带钥匙的敌人后开启。'
    },
    gateOpen: {
      id: 'gateOpen',
      name: '开启的庭院门',
      moveCost: 1,
      avoid: 0,
      def: 0,
      blocked: false,
      desc: '门已开启，可以进入庭院。'
    },
    water: {
      id: 'water',
      name: '深水',
      moveCost: Infinity,
      avoid: 0,
      def: 0,
      blocked: true,
      desc: '水流湍急，无法通行。'
    },
    bridge: {
      id: 'bridge',
      name: '渡桥',
      moveCost: 1,
      avoid: 0,
      def: 0,
      blocked: false,
      desc: '横跨河面的桥梁，移动消耗 1。'
    }
  };

  /**
   * 武器三角：剑 > 斧 > 枪 > 剑。
   * 克制修正直接乘在“武器威力”上，而不是平加固定伤害：
   *   优势：威力 × 1.2；劣势：威力 × 0.8。
   * 命中仍为 +15 / -15。弓与魔法不参与三角，但拥有 2~3 格射程。
   */
  const TRIANGLE = {
    sword: { beats: 'axe', name: '剑' },
    axe: { beats: 'lance', name: '斧' },
    lance: { beats: 'sword', name: '枪' }
  };

  const TRIANGLE_BONUS = {
    /** 克制方武器威力倍率。 */
    advantageMultiplier: 1.2,
    /** 被克制方武器威力倍率。 */
    disadvantageMultiplier: 0.8,
    /** 命中修正。 */
    hit: 15,
    /** 对“有效目标”的默认威力倍率，可在武器 effectiveAgainst 中启用。 */
    effectivenessMultiplier: 1.5
  };

  /** 战斗常数。保留原型暴击 ×2；普通交战支持射程内反击与攻速追击。 */
  const COMBAT = {
    critMultiplier: 2,
    minHit: 5,
    maxHit: 100,
    minDamage: 1,
    speedAvoidFactor: 1.5,
    criticalDamage: 2
  };

  /** 第一关：三路渡河、分区警戒、据点休憩与封闭内庭。
   * 每行严格 36 格，画面和寻路共用数据，禁止静默修补出生格。 */
  // 手工分区：北路有林地掩护，南桥便于集结，中路需主动唤醒共鸣碑。
  const MAP_CHARS = (() => {
    const a = Array.from({length: ROWS}, () => Array(COLS).fill('.'));
    const rect = (x,y,w,h,t) => { for(let j=y;j<y+h;j++) for(let i=x;i<x+w;i++) a[j][i]=t; };
    rect(0,0,36,1,'f'); rect(0,23,36,1,'f'); rect(0,0,1,24,'f'); rect(35,0,1,24,'f');
    rect(2,2,5,4,'#'); rect(3,7,5,4,'f'); rect(3,11,3,3,'f'); rect(9,2,2,3,'m');
    rect(1,15,2,3,'f'); rect(7,21,4,2,'f'); rect(9,10,2,2,'m');
    rect(14,1,7,3,'f'); rect(18,5,3,3,'f'); rect(15,9,2,3,'f');
    rect(16,14,3,2,'f'); rect(14,21,2,2,'m'); rect(22,21,4,2,'f');
    rect(30,13,4,3,'f'); rect(33,18,2,4,'f');
    rect(4,18,9,2,'r'); rect(6,5,2,14,'r'); rect(7,6,14,2,'r');
    rect(7,12,14,2,'r'); rect(13,18,18,2,'r'); rect(27,11,3,8,'r');
    rect(17,10,4,4,'p'); rect(18,10,2,1,'#'); rect(20,12,1,2,'#');
    rect(20,15,4,5,'#'); rect(21,16,2,3,'p'); rect(20,17,1,1,'r'); rect(21,19,1,1,'r');
    rect(23,1,12,11,'#'); rect(24,2,10,9,'p');
    rect(25,7,2,2,'f'); rect(31,7,2,2,'f'); rect(28,6,2,2,'w');
    rect(28,11,2,1,'G'); rect(12,0,2,24,'w');
    rect(12,6,2,2,'b'); rect(12,18,2,2,'b');
    a[4][7]='H'; a[17][21]='H'; a[13][7]='R';
    return a.map(row=>row.join(''));
  })();
  const MAP_DECOR = [];
  const STAGE_ONE_SPAWNS = {
    tomori: { x: 4, y: 19 }, anon: { x: 3, y: 20 }, rana: { x: 6, y: 20 },
    soyo: { x: 4, y: 21 }, taki: { x: 3, y: 18 },
    shadow_blade_1: { x: 8, y: 12, guardGroup: 'west', guardRadius: 6 },
    shadow_axe: { x: 16, y: 18, guardGroup: 'south', guardRadius: 6 },
    shadow_blade_2: { x: 32, y: 20, guardGroup: 'key', guardRadius: 5 },
    shadow_bow: { x: 30, y: 18, guardGroup: 'key', guardRadius: 5 },
    shadow_lance: { x: 30, y: 9, guardGroup: 'inner' },
    xueyue: { x: 28, y: 3, facing: 'down', guardGroup: 'inner' }
  };
  const MAP_REVISION = 3;
  const FORD_CELLS = [{x:12,y:12},{x:13,y:12},{x:12,y:13},{x:13,y:13}];
  const STAGE_ONE_EXTRA_UNITS = [
    ['west_axe','shadow_axe',9,16,'west',6], ['west_bow','shadow_bow',7,8,'west',6],
    ['north_lance','shadow_lance',16,6,'north',5], ['north_bow','shadow_bow',19,8,'north',5],
    ['north_blade','shadow_blade_1',18,11,'north',5],
    ['south_bow','shadow_bow',19,20,'south',6], ['south_blade','shadow_blade_1',17,21,'south',6],
    ['key_lance','shadow_lance',29,16,'key',5], ['key_mage','shadow_blade_1',27,20,'key',5],
    ['approach_lance','shadow_lance',25,14,'approach',5],
    ['inner_mage','shadow_blade_1',25,9,'inner',0], ['inner_blade','shadow_blade_1',32,5,'inner',0]
  ].map(([id,base,x,y,guardGroup,guardRadius]) => ({id,base,x,y,guardGroup,guardRadius,
    dormant:guardGroup==='inner', key:false, boss:false,
    ...(id.includes('mage') ? {className:'影术师',shortName:'影术',name:'迷途回声·咒',weapon:'shadowTome',maxHp:18,str:3,mag:7,def:2,res:6} : {})}));

  const CHAR_TO_TERRAIN = {
    '.': 'plain',
    H: 'fort', R: 'resonance', B: 'bell',
    f: 'forest',
    m: 'mountain',
    '#': 'wall',
    G: 'gate',
    w: 'water',
    b: 'bridge', s: 'ford',
    r: 'road',
    p: 'plaza'
  };

  /** 将字符地图转换为二维地形 id 数组。 */
  function buildTerrainGrid(chars) {
    return (chars || MAP_CHARS).map((row) =>
      row.split('').map((ch) => CHAR_TO_TERRAIN[ch] || 'plain')
    );
  }

  /** 第二章：参考 if 暗夜第 8 章的分散村落访问，采用非对称花镇与择路目标。 */
  const STAGE_TWO_DECOR = [
    {kind:'house',x:5,y:7,w:4,h:3,roof:'lavender'},
    {kind:'house',x:11,y:18,w:4,h:3,roof:'rose'},
    {kind:'house',x:17,y:3,w:4,h:3,roof:'blue'},
    {kind:'house',x:24,y:14,w:4,h:3,roof:'lavender'},
    {kind:'house',x:30,y:7,w:3,h:3,roof:'rose'}
  ];
  const STAGE_TWO_BELLS = [
    {id:'petal',name:'花语之铃',x:7,y:11,group:'moon-west'},
    {id:'promise',name:'约定之铃',x:13,y:22,group:'moon-southwest'},
    {id:'memory',name:'回忆之铃',x:19,y:7,group:'moon-north'},
    {id:'wish',name:'心愿之铃',x:26,y:18,group:'moon-east'},
    {id:'dawn',name:'晨光之铃',x:32,y:11,group:'moon-stage'}
  ];
  const STAGE_TWO_MAP = (()=>{
    const a=Array.from({length:28},()=>Array(40).fill('.'));
    const rect=(x,y,w,h,t)=>{for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)a[j][i]=t;};
    rect(0,0,40,1,'f');rect(0,27,40,1,'f');rect(0,0,1,28,'f');rect(39,0,1,28,'f');
    // Offset groves divide neighborhoods; grass shortcuts keep the routes connected.
    for(const [x,y,w,h] of [[2,2,3,4],[10,2,4,5],[2,21,5,5],[7,23,2,3],
      [15,10,2,7],[18,18,4,3],[20,23,5,3],[24,9,3,3],[28,2,2,4],
      [34,13,4,2],[31,22,7,4],[36,10,3,2],[5,18,2,3]])rect(x,y,w,h,'f');
    // Two small ornamental ponds, never a river crossing or a mandatory chokepoint.
    rect(11,8,3,3,'w');rect(10,9,1,2,'w');rect(21,22,4,2,'w');rect(22,24,2,1,'w');
    rect(27,24,2,2,'m');rect(36,18,2,3,'m');rect(2,8,2,3,'m');
    // An irregular loop through five village forecourts, with a central market shortcut.
    rect(3,14,10,2,'r');rect(6,10,2,5,'r');rect(8,12,15,2,'r');
    rect(11,14,2,10,'r');rect(12,22,7,2,'r');rect(17,8,2,16,'r');
    rect(17,7,7,2,'r');rect(22,7,2,12,'r');rect(23,17,10,2,'r');
    rect(29,11,5,2,'r');rect(31,11,2,7,'r');rect(33,5,3,8,'r');
    rect(16,12,6,4,'p');rect(32,2,6,5,'p');
    // Short ruins flank the market; north and south both remain open.
    rect(21,14,1,2,'#');rect(15,18,2,1,'#');rect(27,10,2,1,'#');
    for(const d of STAGE_TWO_DECOR)rect(d.x,d.y,d.w,d.h,'#');
    for(const b of STAGE_TWO_BELLS){rect(b.x-1,b.y-1,3,3,'p');a[b.y][b.x]='B';}
    for(const [x,y] of [[5,16],[18,14],[28,20]])a[y][x]='H';
    return a.map(row=>row.join(''));
  })();

  const STAGE_TWO = {
    cols:40,rows:28,enemyCount:24,mapRevision:3,
    id:'mission-02',chapter:'MISSION 02',chapterJp:'第二话',chapterEn:'CHAPTER 02',
    title:'星铃花镇',mapName:'沉睡的花语',
    subtitle:'被遗忘的约定沉睡在花屋之间，三声星铃将为少女们唤回前路。',
    objective:'唤醒任意 3 处星铃，并击败指挥家（无需全灭敌军）',
    gateHint:'站上星铃格，选择「唤醒星铃」；五处任选三处，消耗一次行动。',
    turnLimit:0,bells:STAGE_TWO_BELLS,requiredBells:3,
    mapChars:STAGE_TWO_MAP,terrain:buildTerrainGrid(STAGE_TWO_MAP),decor:STAGE_TWO_DECOR,
    spawns:{
      anon:{x:3,y:16},soyo:{x:2,y:17},tomori:{x:3,y:14},
      rana:{x:4,y:15},taki:{x:2,y:15},xueyue:{x:4,y:17},
      shadow_blade_1:{x:8,y:15,guardGroup:'moon-west',guardRadius:4},
      shadow_lance:{x:17,y:13,dormant:false,guardGroup:'moon-market',guardRadius:4},
      shadow_bow:{x:26,y:21,key:false,guardGroup:'moon-east',guardRadius:4},
      shadow_axe:{x:12,y:23,guardGroup:'moon-southwest',guardRadius:4},
      shadow_blade_2:{x:23,y:5,guardGroup:'moon-north',guardRadius:4},
      conductor:{x:35,y:4,dormant:false,guardGroup:'moon-stage',guardRadius:5,facing:'down'}
    }
  };
  const STAGE_TWO_EXTRA_UNITS = [
    ['moon_west_bow','shadow_bow',10,12,'moon-west',4],
    ['moon_west_axe','shadow_axe',10,16,'moon-west',4],
    ['moon_west_mage','shadow_blade_1',8,19,'moon-west',4],
    ['moon_sw_lance','shadow_lance',16,23,'moon-southwest',4],
    ['moon_sw_bow','shadow_bow',17,20,'moon-southwest',4],
    ['moon_sw_mage','shadow_blade_1',10,22,'moon-southwest',4],
    ['moon_market_blade','shadow_blade_1',20,13,'moon-market',4],
    ['moon_market_bow','shadow_bow',22,11,'moon-market',4],
    ['moon_market_mage','shadow_blade_1',19,16,'moon-market',4],
    ['moon_north_lance','shadow_lance',17,8,'moon-north',4],
    ['moon_north_bow','shadow_bow',22,8,'moon-north',4],
    ['moon_north_mage','shadow_blade_1',25,4,'moon-north',4],
    ['moon_east_axe','shadow_axe',29,19,'moon-east',4],
    ['moon_east_lance','shadow_lance',30,14,'moon-east',4],
    ['moon_east_mage','shadow_blade_1',34,17,'moon-east',4],
    ['moon_stage_blade','shadow_blade_1',33,4,'moon-stage',5],
    ['moon_stage_lance','shadow_lance',36,8,'moon-stage',5],
    ['moon_stage_mage','shadow_blade_1',36,5,'moon-stage',5]
  ].map(([id,base,x,y,guardGroup,guardRadius])=>({id,base,x,y,guardGroup,guardRadius,
    dormant:false,key:false,boss:false,
    ...(id.includes('mage')?{name:'迷途回声·梦咒',shortName:'梦咒',className:'梦境术士',weapon:'shadowTome',str:3,mag:9,res:5}: {})}));

  /**
   * 武器数据。
   * damageType 决定攻击使用力量还是魔力，也决定目标用守备还是魔防减伤：
   *   physical -> 力量 / 守备；magic -> 魔力 / 魔防。
   * effectiveAgainst 可填目标 tags（如 ['armor','flying']），命中时威力再乘
   * TRIANGLE_BONUS.effectivenessMultiplier。
   * 魔法武器可额外设置 element / elementName，战斗演出会据此切换魔法球颜色：
   *   fire 火红、ice 冰蓝、wind 翠绿、thunder 金黄、dark 紫黑、light 白金。
   */
  const WEAPONS = {
    shadowTome: {id:'shadowTome',name:'失语之书',type:'tome',range:[2,3],might:4,hit:0,crit:0,
      damageType:'magic',element:'dark',elementName:'暗',color:'#a78ecb'},
    starblade: {
      id: 'starblade',
      name: '星屑之剑',
      type: 'sword',
      range: [1, 1],
      might: 5,
      hit: 5,
      crit: 5,
      damageType: 'physical',
      color: '#ff9ec7'
    },
    snowMoonBlade: {
      id: 'snowMoonBlade', name: '雪月之刃', type: 'sword', range: [1, 1],
      might: 6, hit: 5, crit: 5, damageType: 'physical', color: '#b7e9ff'
    },
    spotlightBow: {
      id: 'spotlightBow',
      name: '追光之弓',
      type: 'bow',
      range: [2, 3],
      might: 4,
      hit: 10,
      crit: 0,
      damageType: 'physical',
      color: '#ffd166'
    },
    strayLance: {
      id: 'strayLance',
      name: '野猫之枪',
      type: 'lance',
      range: [1, 1],
      might: 5,
      hit: 5,
      crit: 5,
      damageType: 'physical',
      color: '#7ee0d2'
    },
    moonwoodStaff: {
      id: 'moonwoodStaff',
      name: '月森之杖',
      type: 'tome',
      range: [2, 3],
      might: 6,
      hit: 10,
      crit: 5,
      damageType: 'magic',
      element: 'fire',
      elementName: '火',
      color: '#b79cff'
    },
    heartbeatAxe: {
      id: 'heartbeatAxe',
      name: '鼓动之斧',
      type: 'axe',
      range: [1, 1],
      might: 7,
      hit: 0,
      crit: 0,
      damageType: 'physical',
      color: '#ff7a7a'
    },
    shadowBlade: {
      id: 'shadowBlade',
      name: '残缺之刃',
      type: 'sword',
      range: [1, 1],
      might: 4,
      hit: 0,
      crit: 0,
      damageType: 'physical',
      color: '#9d7cff'
    },
    shadowLance: {
      id: 'shadowLance',
      name: '回声之枪',
      type: 'lance',
      range: [1, 1],
      might: 5,
      hit: 0,
      crit: 0,
      damageType: 'physical',
      color: '#9d7cff'
    },
    shadowBow: {
      id: 'shadowBow',
      name: '空响之弓',
      type: 'bow',
      range: [2, 3],
      might: 3,
      hit: 0,
      crit: 0,
      damageType: 'physical',
      color: '#9d7cff'
    },
    shadowAxe: {
      id: 'shadowAxe',
      name: '沉默之斧',
      type: 'axe',
      range: [1, 1],
      might: 6,
      hit: 0,
      crit: 0,
      damageType: 'physical',
      color: '#9d7cff'
    },
    conductorBaton: {
      id: 'conductorBaton',
      name: '无面指挥棒',
      type: 'tome',
      range: [2, 3],
      might: 7,
      hit: 5,
      crit: 0,
      damageType: 'magic',
      element: 'fire',
      elementName: '火',
      color: '#ff6b8a'
    }
  };

  /**
   * 角色模板。x/y 为出生格。
   * art 字段交给 assets.js 生成 32px 像素占位图；替换素材时无需改战斗数据。
   */
  const UNITS = [
    {
      id: 'tomori',
      name: '高松灯',
      shortName: '灯',
      side: 'player',
      className: '剑士',
      level: 5,
      gender: '女',
      maxHp: 26,
      str: 10,
      mag: 5,
      spd: 9,
      def: 5,
      res: 4,
      hit: 90,
      dex: 10,
      lck: 10,
      move: 5,
      weapon: 'starblade',
      x: 2,
      y: 5,
      quote: '即使迷路，也要把这首歌传达出去。',
      art: {
        kind: 'hero',
        hair: '#d8cfd6',
        hairDark: '#8d8392',
        hairStyle: 'bob',
        outfit: '#2d3147',
        outfitDark: '#1b1d2c',
        accent: '#ff8fbd',
        skin: '#f4cfc0',
        eye: '#6d4d75'
      }
    },
    {
      id: 'anon',
      name: '千早爱音',
      shortName: '爱音',
      side: 'player',
      className: '弓手',
      level: 5,
      gender: '女',
      maxHp: 22,
      str: 9,
      mag: 6,
      spd: 11,
      def: 3,
      res: 5,
      hit: 85,
      dex: 14,
      lck: 12,
      move: 5,
      weapon: 'spotlightBow',
      x: 1,
      y: 4,
      quote: '既然要组乐队，当然要站在最亮的地方！',
      art: {
        kind: 'hero',
        hair: '#f4a8c4',
        hairDark: '#bc6e8d',
        hairStyle: 'long',
        outfit: '#f0e8ee',
        outfitDark: '#b8a7b3',
        accent: '#ff5f9e',
        skin: '#f8d8c8',
        eye: '#88506a'
      }
    },
    {
      id: 'rana',
      name: '要乐奈',
      shortName: '乐奈',
      side: 'player',
      className: '枪骑士',
      level: 5,
      gender: '女',
      maxHp: 24,
      str: 10,
      mag: 4,
      spd: 12,
      def: 4,
      res: 3,
      hit: 88,
      dex: 12,
      lck: 8,
      move: 6,
      weapon: 'strayLance',
      x: 1,
      y: 7,
      quote: '有趣的女人。……抹茶芭菲，吃吗？',
      art: {
        kind: 'hero',
        hair: '#f2f0e6',
        hairDark: '#b8b6a8',
        hairStyle: 'messy',
        outfit: '#22212d',
        outfitDark: '#111118',
        accent: '#6de3d4',
        skin: '#f5d6c4',
        eye: '#d9b44a'
      }
    },
    {
      id: 'soyo',
      name: '长崎爽世',
      shortName: '爽世',
      side: 'player',
      className: '法师',
      level: 5,
      gender: '女',
      maxHp: 20,
      str: 4,
      mag: 12,
      spd: 8,
      def: 2,
      res: 9,
      hit: 92,
      dex: 10,
      lck: 8,
      move: 4,
      weapon: 'moonwoodStaff',
      x: 2,
      y: 8,
      quote: '为了不让大家再次走散……这次，我会好好说清楚。',
      art: {
        kind: 'hero',
        hair: '#c8a678',
        hairDark: '#8c6f4c',
        hairStyle: 'long',
        outfit: '#3d5a4e',
        outfitDark: '#22332c',
        accent: '#d8c28c',
        skin: '#f7d9c9',
        eye: '#7b5d45'
      }
    },
    {
      id: 'taki',
      name: '椎名立希',
      shortName: '立希',
      side: 'player',
      className: '斧战士',
      level: 5,
      gender: '女',
      maxHp: 32,
      str: 12,
      mag: 3,
      spd: 5,
      def: 8,
      res: 3,
      hit: 78,
      dex: 6,
      lck: 6,
      move: 4,
      weapon: 'heartbeatAxe',
      x: 1,
      y: 2,
      quote: '别拖后腿。节奏，由我来守住。',
      art: {
        kind: 'hero',
        hair: '#2c2733',
        hairDark: '#151219',
        hairStyle: 'short',
        outfit: '#2b1c24',
        outfitDark: '#170e14',
        accent: '#ff6b6b',
        skin: '#f2cfbd',
        eye: '#b86a7b'
      }
    },
    {
      id: 'shadow_blade_1',
      name: '迷途回声·刃',
      shortName: '影刃',
      side: 'enemy',
      className: '影剑士',
      level: 4,
      maxHp: 20,
      str: 8,
      mag: 2,
      spd: 8,
      def: 3,
      res: 2,
      hit: 80,
      dex: 8,
      lck: 5,
      move: 4,
      weapon: 'shadowBlade',
      x: 17,
      y: 2,
      quote: '……回来……',
      art: {
        kind: 'shadow',
        hair: '#5b4b83',
        hairDark: '#2d2445',
        hairStyle: 'bob',
        outfit: '#342c50',
        outfitDark: '#191429',
        accent: '#a88cff',
        skin: '#6f6391',
        eye: '#ff7ea8'
      }
    },
    {
      id: 'shadow_lance',
      name: '迷途回声·枪',
      shortName: '影枪',
      side: 'enemy',
      className: '影枪兵',
      level: 4,
      maxHp: 22,
      str: 9,
      mag: 3,
      spd: 7,
      def: 5,
      res: 2,
      hit: 80,
      dex: 7,
      lck: 3,
      move: 4,
      weapon: 'shadowLance',
      x: 13,
      y: 8,
      dormant: true,
      quote: '……不要……忘记……',
      art: {
        kind: 'shadow',
        hair: '#6a4b83',
        hairDark: '#332445',
        hairStyle: 'short',
        outfit: '#3a2b50',
        outfitDark: '#1b1429',
        accent: '#9d7cff',
        skin: '#726391',
        eye: '#ff8aa8'
      }
    },
    {
      id: 'shadow_bow',
      name: '迷途回声·弓',
      shortName: '影弓',
      side: 'enemy',
      className: '影弓手',
      level: 4,
      maxHp: 18,
      str: 8,
      mag: 2,
      spd: 8,
      def: 2,
      res: 2,
      hit: 78,
      dex: 9,
      lck: 5,
      move: 4,
      weapon: 'shadowBow',
      x: 18,
      y: 8,
      key: true,
      quote: '……听不见……',
      art: {
        kind: 'shadow',
        hair: '#4b5b83',
        hairDark: '#243045',
        hairStyle: 'ponytail',
        outfit: '#2b3a50',
        outfitDark: '#141d29',
        accent: '#7ec8ff',
        skin: '#647391',
        eye: '#ff9eb8'
      }
    },
    {
      id: 'shadow_axe',
      name: '迷途回声·斧',
      shortName: '影斧',
      side: 'enemy',
      className: '影斧兵',
      level: 4,
      maxHp: 26,
      str: 11,
      mag: 2,
      spd: 4,
      def: 6,
      res: 1,
      hit: 72,
      dex: 5,
      lck: 2,
      move: 3,
      weapon: 'shadowAxe',
      x: 16,
      y: 13,
      quote: '……好重……',
      art: {
        kind: 'shadow',
        hair: '#5b3b5b',
        hairDark: '#301d30',
        hairStyle: 'messy',
        outfit: '#3b2742',
        outfitDark: '#1d1322',
        accent: '#d17cff',
        skin: '#715b75',
        eye: '#ff7ea8'
      }
    },
    {
      id: 'shadow_blade_2',
      name: '迷途回声·刃',
      shortName: '影刃',
      side: 'enemy',
      className: '影剑士',
      level: 4,
      maxHp: 20,
      str: 8,
      mag: 2,
      spd: 8,
      def: 3,
      res: 2,
      hit: 80,
      dex: 8,
      lck: 5,
      move: 4,
      weapon: 'shadowBlade',
      x: 21,
      y: 14,
      quote: '……回来……',
      art: {
        kind: 'shadow',
        hair: '#5b4b83',
        hairDark: '#2d2445',
        hairStyle: 'bob',
        outfit: '#342c50',
        outfitDark: '#191429',
        accent: '#a88cff',
        skin: '#6f6391',
        eye: '#ff7ea8'
      }
    },
    {
      id: 'xueyue',
      name: '雪月', shortName: '雪月', side: 'enemy', className: '剑士', gender: '女',
      level: 7, maxHp: 34, str: 11, mag: 4, spd: 11, def: 5, res: 6,
      hit: 88, dex: 12, lck: 8, move: 5, weapon: 'snowMoonBlade', x: 16, y: 2,
      boss: true, dormant: true,
      quote: '若你们能斩断这片寂静……我愿与你同行。',
      art: { kind: 'hero', hair: '#e5efff', hairDark: '#9eaccb', hairStyle: 'long',
        outfit: '#235a98', outfitDark: '#173b65', accent: '#b7e9ff', skin: '#f8dfd2', eye: '#8884ce' }
    },
    {
      id: 'conductor',
      name: '无面指挥家',
      shortName: '指挥家',
      side: 'enemy',
      className: '迷途首领',
      level: 8,
      maxHp: 38,
      str: 5,
      mag: 14,
      spd: 7,
      def: 6,
      res: 8,
      hit: 90,
      dex: 12,
      lck: 8,
      move: 4,
      weapon: 'conductorBaton',
      x: 12,
      y: 4,
      boss: true,
      dormant: true,
      quote: '迷路的孩子，留在这里就好。',
      art: {
        kind: 'boss',
        hair: '#2a1838',
        hairDark: '#120a1a',
        hairStyle: 'long',
        outfit: '#271a38',
        outfitDark: '#0e0916',
        accent: '#ff4f8b',
        skin: '#b9a5c9',
        eye: '#ff3f7f'
      }
    }
  ];

  /** 关卡信息。 */
  const MISSION = {
    enemyCount: 18,
    id: 'mission-01',
    chapter: 'MISSION 01',
    chapterJp: '第一话',
    chapterEn: 'CHAPTER 01',
    title: '黄昏的迷途庭院',
    objective: '夺取钥匙、开启内庭，击败剑士雪月与全部敌人 · 雪月战败后加入',
    subtitle: '在封闭心声的庭院，找回第一道回声。',
    mapName: '迷途庭院',
    gateHint: '北桥有林地掩护，南桥适合集结；西岸共鸣碑可开启中央浅滩。击破东南钥匙影弓后，东北内庭开放。',
    turnLimit: 0
  };

  /** 操作/提示文案。 */
  const TEXT = {
    hints: {
      idle: '点击我方单位开始行动 · 点击敌方单位查看情报',
      move: '点击蓝色格子移动 · 右键 / Esc 取消选择',
      action: '选择行动：攻击、待机，或取消刚才的移动',
      attack: '点击红色范围内的敌方单位 · 右键 / Esc 返回',
      enemy: '敌方正在行动……',
      busy: '结算中……'
    }
  };

  // Narrative fragments for this inner-world adaptation; no additional combat stats.
  const CHARACTER_STORIES = {
    tomori: '那些来不及说出口的话，被她一一留在心底。即使害怕再次失去，她仍想把同伴的声音带回去。',
    anon: '笑容能遮住孤独，却不能让它消失。她想在这段旅程里，找到一个不必假装坚强的位置。',
    rana: '她追逐心底微弱的响动，在寂静中寻找方向。比起解释，她选择留在同伴身边。',
    soyo: '她握着关于过去的碎片，不敢松手。穿过庭院之后，她也许能学会面对离开与新的相遇。',
    taki: '她把脆弱藏在锋利的言语后面。只要还有需要守护的人，她就不会停下脚步。',
    xueyue: '她曾独自守在封闭的内庭，以剑阻挡所有靠近的声音。败给少女们后，她终于选择放下戒备，让自己的心声加入同行的回响。'
  };

  MyGO.CONFIG = {
    CHARACTER_STORIES,
    TILE,
    RENDER_SCALE,
    SPRITE_SIZE,
    COLS,
    ROWS,
    TERRAIN,
    TRIANGLE,
    TRIANGLE_BONUS,
    COMBAT,
    MAP_CHARS,
    MAP_TERRAIN: buildTerrainGrid(),
    MAP_DECOR,
    STAGE_ONE_SPAWNS,
    STAGE_ONE_EXTRA_UNITS,
    FORD_CELLS,
    MAP_REVISION,
    WEAPONS,
    UNITS,
    MISSION,
    STAGE_TWO,
    STAGE_TWO_EXTRA_UNITS,
    buildTerrainGrid,
    TEXT,
    SAVE_KEY: 'mygo_tactics_save_v1',
    SAVE_VERSION: 1
  };
})(window);
