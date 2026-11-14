# 战斗攻击特效素材

2026-11-14 在线查找、下载并实装。游戏运行只读取本地图集，无网络请求。

| 原作与作者 | 来源 | 许可 | 游戏中的使用 |
| --- | --- | --- | --- |
| Weapon Slash - Effect — **Cethiel** | https://opengameart.org/content/weapon-slash-effect | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 枪刺长拖尾、命中火花及魔法球飞行拖尾纹理 |
| Animated particle effects #1 — **para** | https://opengameart.org/content/animated-particle-effects-1 | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 剑斧放射接触闪光、爆燃、冰晶光爆、风旋、暗雾、雷光、圣光、奥术涡流及斧击尘土 |

两页原始网页存于 `source/*/source.html`，原始 ZIP 下载地址和 SHA-256 存于 `sources.json`。图集元数据 `combat-atlas.json` 记录每个使用的原图路径、SHA-256 与帧数。原素材作者无需为本项目的调整负责。

## 制作方式

`tools/fetch-combat-vfx.py` 可重新获取并校验原始素材；`tools/prepare-combat-vfx.py` 从原始文件制作 19 条动画、250 帧的透明 PNG 图集。

- v5.7.1：剑斧使用 para 光爆的中心六帧，裁切放大并按冷／暖色重新配色，以无固定挥砍方向的接触闪光适配不同角色。角色动作表内自带的刀光保留。
- 枪刺和魔法拖尾保留原动画六帧，统一画布与比例，旋转为水平方向。枪刺纹理宽度由166提高至312像素，另加250像素渐淡速度轨迹。
- 魔法球由体积渐变球体、亮心、属性色光晕和原素材纹理叠加绘制，球心直径32–35像素，飞行全程不缩成细线。手边蓄力球逐渐增长；飞行时保留渐淡残影，命中后衔接原属性爆散。
- para 的 64 帧序列等距采样为 24 帧，尘土采样为 16 帧，保留原透明度与柔和边缘；风、暗及奥术略去前段空帧以对齐命中。
- 运行时根据战斗时间轴选择帧：魔法 46% 释放、58% 命中，命中动画最长 650 毫秒。未命中仅播放挥击或飞行，不播放目标爆散；暴击放大命中效果。
- 原有角色武器、动作帧、弓箭、伤害数字及闪避动作继续使用。贴图加载失败时沿用旧程序特效。
- 图集约 3.02 MB；单文件构建内嵌图集，正常版启动时预载。

## 验证与预览

- `node tests/test-combat-vfx.js`：帧边界、源图哈希、七种属性、全程可见的魔法球球心、加长枪刺、主角与重装路径、未命中、伤害文字、加载失败及内嵌加载。
- `tools/render-combat-vfx-preview.js`：使用真实 `BattleScene` 渲染 48 帧剑／斧／枪／火焰动画、九宫格和主角／重装／Boss 的命中、闪避、暴击组合。
- `tools/prepare-combat-vfx-preview.py`：生成 `docs/previews/combat-vfx-battle.gif`。
