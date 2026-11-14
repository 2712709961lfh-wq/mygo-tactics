# 第五关素材来源与许可证

检索与下载日期：2026-11-13。所有运行时素材均为本地文件，单文件版嵌入相同图集。

| 用途 | 原作者与来源 | 许可 | 本项目改动 |
| --- | --- | --- | --- |
| 公园石路、铺装、双桥木板 | Kenney， [RPG Urban Pack](https://opengameart.org/content/rpg-urban-pack)，[作者站点](https://kenney.nl/) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 从原包选取图块合成 `urban-atlas.png`，运行时覆盖夜色与桥栏。原包与 License.txt 保留在 `urban-source/`。 |
| 天马及拍翼帧 | Spring Spring，[greek hypaspist, persian foot archer, pegasus pony](https://opengameart.org/content/greek-hypaspist-persian-foot-archer-pegasus-pony) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 原图 `pegasus.png`，按 33 像素帧距提取七帧，叠加自绘骑士、头盔、披风、盾与长枪，输出 `pegasus-rider.png`。 |
| 重装兵与统领的完整精灵动作（当前使用） | [Universal LPC Spritesheet Character Generator](https://github.com/liberatedpixelcup/Universal-LPC-Spritesheet-Character-Generator)，作者逐文件记录见 `knight-source-manifest.json` 与上游 `lpc-source/CREDITS.csv` | 选用各图层共同提供的 [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) | 组合身体、头部、板甲、护腿、护臂、铁靴、封闭头盔与同步长枪/战斧帧；统领金色重着色。生成 `armor-actions.png`、`warden-actions.png` 和元数据，保留全部来源层和 SHA-256。衍生图集以同许可共享。 |
| 旧版重装立绘（已退出运行时） | killyoverdrive，[knight Templar](https://opengameart.org/content/knight-templar) | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) | `templar.png`、`armored-cutout.png` 作为旧素材保留，不再加载；程序绘制的统领斧形标志已移除。 |

`templar.png` 与 `armored-cutout.png` 的 CC BY-SA 3.0 适用于这些美术文件；原图、加工脚本 `tools/prepare-fifth-art.py` 与改动说明随项目提供。其他文件遵循各自标明的许可。

LPC 图层作者包括 Stephen Challener（Redshrike）、Johannes Sjölund（wulax）、bluecarrot16、JaidynReiman、Eliza Wyatt（ElizaWy）、Benjamin K. Smith（BenCreating）、Michael Whitlock（bigbeargames）、Napsio（Vitruvian Studio）、Matthew Krohn（makrohn）、Pierre Vigier（pvigier）、Inboxninja、Sander Frenken（castelonia）等；完整作者、原始作品链接与许可选项按文件保存在上面的清单中，不以此段代替逐文件署名。`lpc-source/LICENSE` 为上游附带的 GPL 3.0 备选许可文本；本项目的美术衍生图集选择 CC BY-SA 3.0。

执行 `tools/prepare-watercourt-knights.py` 可从本地原始图层重新合成两套四方向精灵图。每格192×192，脚底锚点(96,124)，身体参考高48；方向顺序上、左、下、右。重装兵各方向包含待机2、步行8、突刺8、受击3、倒地6、跳跃5帧，共128格；统领挥斧6帧，其余相同，共120格。受击使用原倒地动画前两帧组成恢复动作。图集中武器已经与手臂动作合成，运行时没有另画斧头或枪尖。

第四关的草地、水面、花丛、路灯与长椅继续使用原有美术及代码，来源见地图署名弹窗和 `assets/terrain/` 的现有说明。城市图块用于第五关地面；骑士与天马用于地图、角色信息头像及侧视战斗。天马原图朝右，游戏开局明确向左，绘制时镜像面对西侧玩家；地图与战斗采用一致规则。
