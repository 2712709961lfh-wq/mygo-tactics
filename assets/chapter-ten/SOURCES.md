# 第十关骑兵与宫殿素材

检索、下载和加工日期：2026-11-18。所有实际游戏素材均在本地加载，单文件版嵌入相同图集，无运行时网络请求。

| 用途 | 作者与来源 | 原始许可 | 加工与运行文件 |
| --- | --- | --- | --- |
| 四方向马匹、六帧行走／奔跑、鞍毯、马鞍 | bluecarrot16；Benjamin K. Smith（BenCreating），[LPC Horse Extended](https://opengameart.org/content/lpc-horse-extended)，基于 [LPC Horses](https://opengameart.org/content/lpc-horses) | 原包 Read Me 明确提供 CC BY 3.0 / GPL / OGA-BY，本项目选择 [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 选取棕马与白马、配套鞍具，原包 `source/LPC-Horse-Extended.zip`，署名 `source/horse-credits.txt`。组合铠甲骑手、弯曲的骑乘腿部、缰绳、护额与红色盔缨，输出 `cavalier-actions.png` / `elite-actions.png`。 |
| 骑手身体、封闭头盔、板甲、护手、胫甲与真实长枪突刺 | Universal LPC Spritesheet Character Generator 多作者，完整逐文件作者见[第五关清单](../chapter-five/knight-source-manifest.json)及[署名说明](../chapter-five/SOURCES.md) | 选择 [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) | 使用已有原始分层素材，保留头、躯干和持枪手臂，重新适配坐姿和腿部；八帧枪刺逐帧组合，同一图集用于地图、头像、战斗。 |
| 石砖、红毯、王座纹章、旗帜、石质底座、半身像、盆栽 | Tuomo Untinen（Reemax），[LPC City Inside](https://opengameart.org/content/lpc-city-inside)。红毯与黄石地砖基于 Daniel Armstrong（HughSpectrum）；完整来源见原包 `credits.txt` | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/)（原页面也提供 GPL 备选） | `source/LPC_city_inside.zip`、`source/city-credits.txt`；裁取小图块，石砖改为象牙白色，组合 `palace-scenery.png`。柱体、拱窗、圣泉、灯光、回廊拼花和整体布局沿用／扩展项目原创绘制。 |

两套骑乘图集与宫殿图块作为组合衍生美术，统一以 **CC BY-SA 3.0** 提供。保留原始素材包、逐文件 SHA-256 清单 `source-manifest.json` 和复现工具 `tools/prepare-palace-art.py`；修改包括鞍毯改色、骑手金甲改色、骑乘姿势、攻击合成、受击／倒地／闪避变体和石砖改色。

每套图集包含上／左／下／右四方向，待机2、行走6、奔跑6、枪刺8、受击3、倒地6、闪避5帧，共144帧，两套合计288帧。行走与奔跑来自原始马匹的真实逐帧腿部动作；攻击采用原始LPC长枪突刺配合马匹动作；受击、倒地和闪避为本项目基于上述动作制作的变体，并非声称源素材提供了马匹死亡动画。格子192×192，脚底锚点(96,152)，身体参考高90；元数据见 `mounted-actions.json`。

检索时另比较了 [LPC Horses Rework](https://opengameart.org/content/lpc-horses-rework)（三帧）和 [cavalry sprite for freeSiege](https://opengameart.org/content/cavalry-sprite-for-freesiege)（少量侧向帧），最终选用方向和动作更完整、与现有LPC重装风格一致的 Extended 版本。


v5.16.1 骑乘修正：按每帧原始鞍具的像素范围定位坐骨，保留原始上身至腰胯；基于LPC板甲配色分别重绘屈曲大腿、膝甲和胫甲，并保留单只原始板甲靴，补充马镫、鞍带和缰绳。侧面远腿先于马身绘制、近腿后绘制；正面仅将原始马头置于内侧腿之前，不把马鞍覆盖到胸腰。保持原始马匹逐帧动作、四方向及图集协议；许可与署名沿用上述组合衍生美术条款。
