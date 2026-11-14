#!/usr/bin/env node
/**
 * 将项目打包成单个 HTML 文件（standalone.html）
 * ------------------------------------------------
 * 用途：
 *   1. 微信/QQ 直接发送一个 .html 文件，对方打开即可玩；
 *   2. 上传到只支持单文件的静态托管；
 *   3. 避免 styles.css / src 目录没有被一起部署导致“只有文字没有画面”。
 *
 * 用法（在项目根目录执行）：
 *   node build-standalone.js
 *
 * 生成：
 *   standalone.html
 *
 * 说明：
 *   - 不依赖任何第三方包；
 *   - 只替换 index.html 中的本地 <link> 和 <script src>；
 *   - 八名角色的 PNG 素材会转成 data URL 嵌入，单文件仍可直接打开。
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const ENTRY = path.join(ROOT, 'index.html');
const OUTPUT = path.join(ROOT, 'standalone.html');

const SCRIPTS = [
  'src/equipment-data.js',
  'src/magic-data.js',
  'src/codex-data.js',
  'src/inventory.js',
  'src/class-data.js',
  'src/config.js',
  'src/chapter-three.js',
  'src/chapter-four.js',
  'src/chapter-five.js',
  'src/chapter-six.js',
  'src/chapter-seven.js',
  'src/map-projection.js',
  'src/rng.js',
  'src/growth-data.js',
  'src/growth.js',
  'src/grid.js',
  'src/pathfinding.js',
  'src/combat.js',
  'src/game.js',
  'src/ai.js',
  'src/save.js',
  'src/assets.js',
  'src/garden-map.js',
  'src/moon-map.js',
  'src/park-map.js',
  'src/characters.js',
  'src/dark-soyo.js',
  'src/watercourt-art.js',
  'src/masked-court-art.js',
  'src/livehouse-art.js',
  'src/renderer.js',
  'src/combat-vfx.js',
  'src/battle.js',
  'src/viewport.js',
  'src/ui.js',
  'src/park-intro.js',
  'src/masked-court-ui.js',
  'src/livehouse-intro.js',
  'src/equipment-ui.js',
  'src/entry.js',
  'src/loadout-ui.js',
  'src/shop-ui.js',
  'src/main.js',
];

const STYLES = ['styles.css', 'entry.css', 'soul-ui.css', 'diary-ui.css', 'equipment.css'];
const CHARACTER_IDS = ['tomori', 'anon', 'rana', 'soyo', 'taki', 'xueyue', 'nina', 'nijika'];
const CHARACTER_DIR = 'assets/characters/sprites';
const WALK_DIR = 'assets/characters/walk';
const IDLE_DIR = 'assets/characters/idle';
const MAP_IMAGES = {
  combatVfx: 'assets/effects/combat/combat-atlas.png',
  livespeaker: 'assets/chapter-seven/source/speaker.png',
  livedrums: 'assets/chapter-seven/source/music-icons/32x32/drums.png',
  liveguitar: 'assets/chapter-seven/source/music-icons/32x32/guitar_electric.png',
  maskactions: 'assets/chapter-six/mask-actions.png',
  maskwalk: 'assets/chapter-six/mask-walk.png',
  maskidle: 'assets/chapter-six/mask-idle.png',
  maskportrait: 'assets/chapter-six/mask-portrait.png',
  maskthrone: 'assets/chapter-six/throne.png',
  masklamp: 'assets/chapter-six/palace-lamp.png',
  maskcircle: 'assets/chapter-six/void-circle.png',
  watercourturban: 'assets/chapter-five/urban-atlas.png',
  watercourtarmor: 'assets/chapter-five/armor-actions.png',
  watercourtwarden: 'assets/chapter-five/warden-actions.png',
  watercourtpegasus: 'assets/chapter-five/pegasus-rider.png',
  darkSoyo: 'assets/effects/dark-soyo/corruption-atlas.png',
  moonDream: 'assets/terrain/moon-dream/moon-hd-atlas.png',
  gardenFlare: 'assets/terrain/flare/battlefield-atlas.png',
  gardenRpg: 'assets/terrain/kenney/roguelike-rpg/garden-atlas.png',
  gardenTown: 'assets/terrain/kenney/tiny-town/tilemap_packed.png',
  gardenDungeon: 'assets/terrain/kenney/tiny-dungeon/tilemap_packed.png',
  mapBackground: 'map_assets/castle-bg.jpg',
  plain: 'map_assets/raw2/36_9fddb3ef.png',
  forest: 'map_assets/raw2/20_a6be3edd.png',
  mountain: 'map_assets/raw2/34_9d672dc7.png',
  wall: 'map_assets/raw2/38_c9eef3de.png',
  water: 'map_assets/raw2/40_1c3c4d45.png',
  gate: 'map_assets/raw2/12_dee6c5cc.png',
  tower: 'map_assets/raw2/18_97b8ee81.png',
  wing: 'map_assets/raw2/03_979a5b6c.png',
  door: 'map_assets/raw2/16_bcc11000.png',
  gateClosed: 'assets/doors/gate-closed.png',
  gateOpen: 'assets/doors/gate-open.png'
};

function read(rel) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) {
    throw new Error(`缺少文件：${rel}`);
  }
  return fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
}

function escapeClosingTag(code, tag) {
  // 防止 JS/CSS 里出现 </script> 或 </style> 提前结束标签。
  return code.replace(new RegExp(`</${tag}`, 'gi'), `<\\/${tag}`);
}

// UI textures referenced by CSS must travel with the standalone HTML as well.
function embedCssImages(css, styleFile) {
  return css.replace(/url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/g, (match, quote, source) => {
    if (/^(?:data:|https?:|#)/i.test(source)) return match;
    const file = path.resolve(ROOT, path.dirname(styleFile), source.split(/[?#]/)[0]);
    if (!file.startsWith(ROOT + path.sep)) throw new Error(`素材超出项目目录：${source}`);
    const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.webp': 'image/webp', '.svg': 'image/svg+xml' }[path.extname(file).toLowerCase()];
    if (!mime) throw new Error(`不支持的界面素材：${source}`);
    return `url("data:${mime};base64,${fs.readFileSync(file).toString('base64')}")`;
  });
}

function main() {
  let html = read('index.html');
  const { version } = JSON.parse(read('version.json'));
  if (typeof version !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
    throw new Error('version.json 的 version 必须为主版本.次版本.修订号');
  }
  const versionLabel = /(<p\b[^>]*\bdata-game-version\b[^>]*>)[^<]*(<\/p>)/g;
  if ([...html.matchAll(versionLabel)].length !== 1) throw new Error('主页必须包含一个 data-game-version 版本标记');
  html = html.replace(versionLabel, (_, open, close) => `${open}游戏版本 · v${version}${close}`);
  // Keep normal-page caches and the offline copy on the same release.
  html = html.replace(/((?:<script src|<link rel="stylesheet" href)=")([^"\s]+)(")/g,
    (tag, open, url, close) => {
      const file = url.split('?')[0];
      return /^(?:src\/[^"?]+\.js|[^/"?]+\.css)$/.test(file) ? `${open}${file}?v=${version}${close}` : tag;
    });
  const versionedEntry = html;

  // 1) 内联样式，按 index.html 中的顺序。
  for (const rel of STYLES) {
    const styleTag = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)" \/>/g)]
      .find(match => match[1].split('?')[0] === rel);
    if (!styleTag) {
      throw new Error(`index.html 中找不到样式标签：${rel}`);
    }
    const css = escapeClosingTag(embedCssImages(read(rel), rel), 'style');
    html = html.replace(styleTag[0], `<style>\n${css}\n  </style>`);
  }

  // 2) 角色 PNG 转 data URL，解决双击单文件时无法读取相对路径的问题。
  const embedded = {};
  for (const id of CHARACTER_IDS) {
    const sheet = path.join(ROOT, CHARACTER_DIR, `${id}-sheet.png`);
    const portrait = path.join(ROOT, CHARACTER_DIR, `${id}-portrait.png`);
    const down = path.join(ROOT, CHARACTER_DIR, `${id}-down.png`);
    const walk = path.join(ROOT, WALK_DIR, `${id}-walk.png`);
    const idle = path.join(ROOT, IDLE_DIR, `${id}-idle.png`);
    if (!fs.existsSync(sheet) || !fs.existsSync(portrait) || !fs.existsSync(down) || !fs.existsSync(walk) || !fs.existsSync(idle)) {
      throw new Error(`缺少角色素材：${id}-sheet.png / ${id}-portrait.png / ${id}-down.png / walk/${id}-walk.png / idle/${id}-idle.png`);
    }
    embedded[id] = {
      sheet: `data:image/png;base64,${fs.readFileSync(sheet).toString('base64')}`,
      portrait: `data:image/png;base64,${fs.readFileSync(portrait).toString('base64')}`,
      down: `data:image/png;base64,${fs.readFileSync(down).toString('base64')}`,
      walk: `data:image/png;base64,${fs.readFileSync(walk).toString('base64')}`,
      idle: `data:image/png;base64,${fs.readFileSync(idle).toString('base64')}`
    };
    if (id === 'soyo' || id === 'anon') {
      const files = id === 'anon' ? { actions: 'anon-actions.png', projectile: 'anon-arrow.png' }
        : { actions: 'soyo-actions.png', projectile: 'soyo-fireball.png' };
      for (const [key, file] of Object.entries(files)) {
        embedded[id][key] = `data:image/png;base64,${fs.readFileSync(path.join(ROOT, 'assets/characters/actions', file)).toString('base64')}`;
      }
    } else if (id === 'tomori' || id === 'rana' || id === 'taki' || id === 'xueyue' || id === 'nina' || id === 'nijika') {
      embedded[id].actions = `data:image/png;base64,${fs.readFileSync(path.join(ROOT, 'assets/characters/actions', `${id}-actions.png`)).toString('base64')}`;
    }
  }
  const dataTag = `<script>window.MYGO_CHARACTER_DATA=${JSON.stringify(embedded)};</script>`;
  html = html.replace(/<script src="src\/config\.js(?:\?[^"\s]*)?"><\/script>/, `${dataTag}\n  <script src="src/config.js"></script>`);

  // 2b) 地图底图也转 data URL。它们较大，但这样单独发送 HTML 时仍有完整地形细节。
  const mapEmbedded = {};
  for (const key of Object.keys(MAP_IMAGES)) {
    const file = path.join(ROOT, MAP_IMAGES[key]);
    if (!fs.existsSync(file)) {
      throw new Error(`缺少地图贴图：${MAP_IMAGES[key]}`);
    }
    const mime = /\.png$/i.test(file) ? 'image/png' : 'image/jpeg';
    mapEmbedded[key] = `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
  }
  const mapTag = `<script>window.MYGO_MAP_DATA=${JSON.stringify(mapEmbedded)};</script>`;
  html = html.replace(/<script src="src\/config\.js(?:\?[^"\s]*)?"><\/script>/, `${mapTag}\n  <script src="src/config.js"></script>`);

  // The user-supplied chapter-four voice also travels with the offline file.
  const audioEmbedded = {parkOpening:'data:audio/mpeg;base64,' +
    fs.readFileSync(path.join(ROOT, 'assets/audio/chapter-04-opening.mp3')).toString('base64')};
  html = html.replace(/<script src="src\/park-intro\.js(?:\?[^"\s]*)?"><\/script>/,
    `<script>window.MYGO_AUDIO_DATA=${JSON.stringify(audioEmbedded)};</script>\n  <script src="src/park-intro.js"></script>`);

  // Equipment illustrations also travel with the standalone reference catalogue.
  const equipmentIcons = {};
  const iconManifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/equipment/icon-manifest.json'), 'utf8'));
  for (const {icon} of iconManifest) {
    equipmentIcons[icon] = 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'assets/equipment/icons', icon+'.png')).toString('base64');
  }
  html = html.replace(/<script src="src\/equipment-data\.js(?:\?[^"\s]*)?"><\/script>/,
    `<script>window.MYGO_EQUIPMENT_ICONS=${JSON.stringify(equipmentIcons)};</script>\n  <script src="src/equipment-data.js"></script>`);

  // 3) 按原本顺序内联脚本。
  for (const rel of SCRIPTS) {
    const re = new RegExp('<script src="' + rel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:\\?[^"\\s]*)?"></script>');
    if (!re.test(html)) {
      throw new Error(`index.html 中找不到脚本标签：${rel}`);
    }
    const js = escapeClosingTag(read(rel), 'script');
    html = html.replace(re, `<script>\n/* ===== ${rel} ===== */\n${js}\n  </script>`);
  }

  // 3) 加一个标记，便于运行时识别单文件版本。
  html = html.replace(
    '<head>',
    '<head>\n  <!-- 单文件构建：由 build-standalone.js 生成，请勿手工编辑。 -->'
  );

  fs.writeFileSync(ENTRY, versionedEntry, 'utf8');
  fs.writeFileSync(OUTPUT, html, 'utf8');

  const bytes = Buffer.byteLength(html, 'utf8');
  console.log('✔ 已生成 standalone.html');
  console.log(`  游戏版本：v${version}（主页与本地资源缓存已同步）`);
  console.log(`  大小：${(bytes / 1024).toFixed(1)} KB`);
  console.log('  只把这一个文件发给别人，或单独上传到静态托管即可。');
}

try {
  main();
} catch (err) {
  console.error('✘ 打包失败：' + err.message);
  process.exit(1);
}
