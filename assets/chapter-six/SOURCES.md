# 第六关素材来源与许可证

检索、下载及制作日期：2026-11-14。所有运行时图片保存在本地，离线单文件版内嵌相同内容。检索网页保存在 `docs/research/chapter-six/`，下载原包、署名及用户原图保存在 `source/`。

| 用途 | 作者及来源 | 选用许可 | 本项目加工 |
| --- | --- | --- | --- |
| 北端宫廷式双头立灯 | [LPC Lamp Posts Rework](https://opengameart.org/content/lpc-lamp-posts-rework)，发布者 AntumDeluge；原作者 Curt、Lanea Zimmerman（Sharm）、Hyptosis、William Thompson（contributor），U 形横梁编辑 mold | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 从原包选取 `lamp-1-post-1-tall-twin-U-bronze.png`，输出 `palace-lamp.png`；地图叠加暖色灯光。原包 README、sources.md 及许可全文保留。 |
| 王座 | [LPC City Inside](https://opengameart.org/content/lpc-city-inside)，Tuomo Untinen（Reemax） | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) | 从 `city_inside.png` 的 (608,0) 裁取32×96王座，输出 `throne.png`。运行时按场景尺寸缩放；此衍生图片仍按 CC BY-SA 3.0 提供。原包 `credits.txt` 保留，完整图集其余作者见该文件。 |
| 召唤及传送法阵 | [Teleport Circle Sprite Sheet](https://opengameart.org/content/teleport-circle-sprite-sheet)，gfroad | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 原始4×4、16帧蓝色图集保存在 `source/teleport.png`，保留透明通道并统一染为紫色，生成 `void-circle.png`；叠加代码绘制的光柱、光晕和粒子。 |
| 神秘面具人动作、站姿、步行及头像 | 用户提供的四张 Gemini_Generated_Image JPG，以及本次替换动作图 `Gemini_Generated_Image_f59j6sf59j6sf59j.jpg` | 用户提供用于本项目；未声明公开美术许可 | 旧原图保留为 `source/mask-*-original.jpg`，新版动作原图另存为 `source/mask-actions-2026-11-14-original.jpg`；去背景、去边缘杂点、逐帧裁切，生成透明动作图集。地图四方向站姿/步行与头像沿用。不得将该角色素材视为上述 CC0/CC BY 素材。 |

重装兵与天马延续第五关同一套素材，普通敌人继续使用现有暗影阵营形象，以夜蓝、暖金和暗紫保持风格一致。重装图集作者、逐文件来源与 CC BY-SA 3.0 许可见 [第五关素材清单](../chapter-five/SOURCES.md) 及 `knight-source-manifest.json`；天马由 Spring Spring 的 CC0 动画提取并叠加骑手。草地、水面、铺装与公园设施沿用第四、五关，来源继续显示于标题页「地图素材与署名」。

`tools/fetch-sixth-assets.py` 下载原包，`tools/prepare-sixth-assets.py` 生成运行时图片，其中动作部分统一调用 `tools/prepare-mask-actions.py`。新版动作可独立运行 `python tools/prepare-mask-actions.py` 从项目内保留的原图重新生成，无需再次访问 D 盘原文件。旧动作原图仍保留作历史来源。

v5.6.4 Boss 战斗图集为 1792×800，每格256×160，脚底锚点(64,143)，身体参考高度108；包含待机7、步行7、施法6、受击3、倒地4帧，共27帧。原图1008×1054，统一按108/146缩放，保留蹲下和倒地姿势的自然高度差，裁切避开英文行标签和相邻姿势，完整保留最后两帧右侧暗红法术。图集元数据记录原图路径、SHA-256与帧数，运行时按同样布局播放；地图召唤、近景召唤、传送待机与战斗动作均使用新帧数。受击动画从0到2连续播放，倒地行修正为第4行4帧。游戏中仍锁血后传送离场，不播放倒地动画。地图待机采用既有四方向站姿，坐姿通过上身与腿部分段绘制到王座上。

`node tools/render-sixth-preview.js` 渲染实际战斗时钟下40帧施法与受击，随后 `python tools/prepare-mask-animation-preview.py` 生成 `docs/previews/chapter-06-mask-battle.gif`；逐帧总览见 `docs/previews/mask-actions.png`。
