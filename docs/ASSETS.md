# 替换像素素材

第一关已改用 `src/garden-map.js` 的原创庭院画笔与 Kenney CC0 图集，详细来源和许可证见 [第一关重制说明](MAP-REMAKE.md)。下文的 `map_assets/raw2/` 地形流程继续用于第二关与旧素材接口。

当前版本包含三套我方角色美术：`assets/characters/sprites/` 的 80×96 动作图集负责编队、头像与战斗；`assets/characters/walk/` 的 128×128×3 帧 ×4 行透明图集负责地图移动；`assets/characters/idle/` 的 128×142×2×2 站立图负责移动前/后的静止姿态。行走图来自 `character assets/xingzou/` 的绿幕原图，站立图来自 `character assets/jingzhi/`，分别由 `tools/prepare-walk-assets.py`、`tools/prepare-idle-assets.py` 去背并统一裁剪。地形底图来自 `map_assets/raw2/` 的豆包生成素材，由 `src/assets.js` 预载并按 32px 格裁切，加载失败时仍会回退到程序化地形。敌方影子和兜底棋子仍由 `src/assets.js` 程序化绘制。  
`RENDER_SCALE = 2` 只把画布背板放大 2 倍，不改变逻辑坐标；地图小人按 `CONFIG.SPRITE_SIZE`（默认 60）绘制，侧视战斗立绘约 90–105px 高，编队头像使用独立大立绘裁切。
替换素材时优先修改 `assets/characters/sprites/`；若只想快速覆盖某个单位，仍可注册 `MyGO.Assets.registerPack`，不需要修改战斗逻辑或渲染器。

## 0. 内置角色图集

原始图集位于 `character assets/`，每张约 262×1199，上方是一张大立绘，下方是 4 列 × 8 行的小人。  
运行 `python tools/prepare-character-assets.py` 会生成：

```text
assets/characters/sprites/
├── tomori-sheet.png    # 4×8 网格，每格 80×96
├── tomori-portrait.png # 大立绘透明裁切
└── tomori-down.png     # 横躺姿态
```

行顺序：0 向下走、1 向右走、2 向上走、3 向左走、4 攻击、5 受伤、6 倒地过渡、7 倒地。  
如果 `character assets/processed/{id}.png` 存在，生成器会优先使用这张已去背的独立立绘；高松灯与千早爱音使用的是作者后来提供的完整去背立绘。没有独立立绘时，才按每名角色的实际帧中心取窗口并保留最大连通域。  
生成器会清理单元格边缘的邻人残发；倒地图由受伤帧顺时针旋转后裁切，避免原始拼图里的多角色残影。  
`index.html` 加载 `characters.js` 后，`main.js` 会先等待 `MyGO.Characters.load()`，再启动 UI；`standalone.html` 构建时会把全部图片内嵌为 data URL，因此单文件版仍可离线运行。

---

## 1. 工作方式

```text
assets.js
  ├─ drawTerrain(ctx, type, x, y, size, info)
  │     └─ customTerrainDrawers[type] 或内置 terrainDrawers[type]
  └─ drawUnit(ctx, unit, x, y, size, opts)
        └─ unitDrawers[unit.id || unit.artKey] 或默认画笔
```

`registerPack({ terrain, units })` 会覆盖指定 id 的画笔；未覆盖的 id 继续使用内置占位图。

五名我方角色的地图、战斗、编队头像统一由 `src/characters.js` 读取 `assets/characters/sprites/`：地图走图集，战斗用同一图集的攻击/受伤/倒地帧，头像用独立大立绘。`src/battle.js` 和 `src/entry.js` 通过 `MyGO.Characters` 调用素材，图片加载失败时自动回退到 `assets.js` 的程序化棋子。

攻击特效与角色素材分离：剑光、斧劈、枪刺、箭矢和魔法球由 `battle.js` 直接用 Canvas 绘制；魔法球颜色读取武器的 `element` 字段，不需要额外图片。因此替换角色图后，武器专属动作仍会自动生效；地图单位默认高 60px，战斗立绘约 90–105px 高。

---

## 2. 最简示例：一张图对应一个角色

```html
<!-- index.html：在 ui.js 之前加入你自己的脚本 -->
<script src="src/assets.js"></script>
<script src="assets/my-assets.js"></script>
<script src="src/renderer.js"></script>
<script src="src/battle.js"></script>
<script src="src/ui.js"></script>
<script src="src/entry.js"></script>
<script src="src/main.js"></script>
```

```js
// assets/my-assets.js
(function () {
  const tomori = new Image();
  tomori.src = 'assets/tomori.png';   // 路径完全由你决定，项目本身不绑定

  MyGO.Assets.registerPack({
    units: {
      // 函数签名固定：ctx, x, y, size, unit, opts
      tomori(ctx, x, y, size) {
        if (!tomori.complete || !tomori.naturalWidth) return; // 未加载完则保持空/占位
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(tomori, x, y, size, size);
      }
    }
  });
})();
```

在自定义函数里可以继续使用 `unit` 的数据：

```js
tomori(ctx, x, y, size, unit, opts) {
  ctx.drawImage(tomori, x, y, size, size);

  // 例如：敌方镜像
  if (unit.side === 'enemy') {
    ctx.save();
    ctx.translate(x + size, y);
    ctx.scale(-1, 1);
    ctx.drawImage(tomori, 0, 0, size, size);
    ctx.restore();
  }
}
```

---

## 3. 用图集裁切

`fromImage(image, crop)` 返回一个可直接注册的函数：

```js
const atlas = new Image();
atlas.src = 'assets/units-atlas.png'; // 假定每格 32×32

MyGO.Assets.registerPack({
  units: {
    tomori: MyGO.Assets.fromImage(atlas, { sx: 0,  sy: 0,  sw: 32, sh: 32 }),
    anon:   MyGO.Assets.fromImage(atlas, { sx: 32, sy: 0,  sw: 32, sh: 32 }),
    rana:   MyGO.Assets.fromImage(atlas, { sx: 64, sy: 0,  sw: 32, sh: 32 }),
    soyo:   MyGO.Assets.fromImage(atlas, { sx: 96, sy: 0,  sw: 32, sh: 32 }),
    taki:   MyGO.Assets.fromImage(atlas, { sx: 128, sy: 0, sw: 32, sh: 32 })
  }
});
```

`fromImage` 的默认裁切为 `{ sx:0, sy:0, sw:32, sh:32 }`。

### 图集建议

- 单格 32×32。
- 透明背景 PNG。
- 角色脚底尽量落在格子底部 2–4 像素内，避免“漂浮”。
- 保持 `imageSmoothingEnabled = false`，否则像素会被插值模糊。

---

## 4. 替换地形

```js
const forest = new Image();
forest.src = 'assets/forest.png';

MyGO.Assets.registerPack({
  terrain: {
    forest: MyGO.Assets.fromImage(forest),
    mountain: MyGO.Assets.fromImage(mountainImg),
    // plain 和 wall 未覆盖，仍使用内置占位图
  }
});
```

地形函数签名：

```js
(ctx, x, y, size, info) => void
```

`info` 通常包含：

```js
{
  gx, gy,          // 逻辑格坐标
  type,            // 'plain' | 'forest' | 'mountain' | 'wall'
  terrain,         // CONFIG.TERRAIN 中的定义
  seed             // 用于纹理变化的稳定哈希
}
```

---

## 5. 可覆盖的 ID

### 单位

| ID | 角色 | 阵营 | 默认造型 |
| --- | --- | --- | --- |
| `tomori` | 高松灯 | 我方 | 黑发红瞳剑士 |
| `anon` | 千早爱音 | 我方 | 粉发弓手 |
| `rana` | 要乐奈 | 我方 | 银发枪手 |
| `soyo` | 长崎爽世 | 我方 | 亚麻发法师 |
| `taki` | 椎名立希 | 我方 | 黑发斧手 |
| `shadow_blade_1` | 迷途剑影 | 敌方 | 紫色影子 |
| `shadow_lance` | 迷途枪影 | 敌方 | 紫色影子 |
| `shadow_bow` | 迷途弓影 | 敌方 | 紫色影子 |
| `shadow_axe` | 迷途斧影 | 敌方 | 紫色影子 |
| `shadow_blade_2` | 迷途剑影 | 敌方 | 紫色影子 |
| `conductor` | 无面指挥家 | 敌方 Boss | 红色指挥家 |

单位注册时会优先匹配 `unit.id`，再匹配 `unit.artKey`。若两者都没有自定义函数，回退到程序化通用造型。

### 地形

`plain`、`forest`、`mountain`、`wall`

---

## 6. 绘制顺序与坐标系

渲染器按以下顺序绘制：

```text
地形 → 范围高亮 → 路径 → 单位影子 → 单位 → 血条 → 特效
```

自定义函数的 `x/y` 是当前格左上角的**画布像素坐标**，不是格坐标。  
`size` 是目标边长（默认 32），可以直接用它适配不同缩放。

不要假设 Canvas 的变换状态；`drawUnit` / `drawTerrain` 会在调用自定义函数前后保存/恢复上下文，但建议你的函数自己保持无副作用。

---

## 7. 头像与特写

`opts.portrait === true` 时，绘制器用于：

- 底部信息面板头像
- 战斗特写中的角色由 `Characters.drawBattlePose` 绘制；旧的 32×32 程序化立绘仅作为素材加载失败时的兜底

如果你的角色图在头像模式下需要不同的裁切，可以判断 `opts.portrait`：

```js
tomori(ctx, x, y, size, unit, opts) {
  const crop = opts.portrait ? portraitCrop : fieldCrop;
  ctx.drawImage(atlas, crop.sx, crop.sy, crop.sw, crop.sh, x, y, size, size);
}
```

---

## 8. 常见问题

### 图片不显示

- 图片尚未加载完成。可监听 `image.onload` 后再注册，或在函数内检测 `naturalWidth`。
- 路径相对 `index.html`，不是相对 `assets.js`。
- `file://` 下某些浏览器会限制图片读取，建议使用同目录本地图片，或运行本地静态服务器。

### 像素模糊

```js
ctx.imageSmoothingEnabled = false;
```

同时确保 CSS 中 `#board` 保留了：

```css
image-rendering: pixelated;
```

### 角色方向反了

默认渲染器会根据阵营自动镜像。若你的素材已经朝左，注册时可在函数内反向补偿，或在单位数据中设置 `noFlip` 相关选项（具体以 `drawUnit` 的 `opts` 为准）。

### 想恢复默认素材

```js
MyGO.Assets.resetPack();
```

---

## 9. 不绑定外部路径的约定

本项目源码中不出现任何 `assets/xxx.png` 之类的硬编码路径。  
上面的路径只是**使用示例**，由使用者在自己的脚本中决定。

这样做的好处：

- 原型可以离线独立运行。
- 你可以整体替换美术风格而不改逻辑。
- 打包、CDN、Base64、雪碧图都可以按需接入。
