# 长崎爽世动作替换（v3.2）

雪月的首领、招募与 61 帧动作说明见 [XUEYUE.md](XUEYUE.md)（v4.0）。

高松灯的新版持剑动作替换记录与预览入口见 [TOMORI.md](TOMORI.md)（v3.9，替代 v3.5 版动作）。
要乐奈的长枪动作替换记录与预览入口见 [RANA.md](RANA.md)（v3.6）。
千早爱音的弓手动作替换记录与预览入口见 [ANON.md](ANON.md)（v3.7）。
椎名立希的持斧动作替换记录与预览入口见 [TAKI.md](TAKI.md)（v3.8）。

素材由用户提供：`D:/像素风校园女孩魔法动作图鉴.png`，1536×1024。原图副本保存在 `source/soyo-magic-original.png`。此人物素材不属于 UI 材质的 CC0 授权范围。

使用 `python tools/prepare-soyo-actions.py`（需要 Pillow）可重新去绿幕、裁切并生成以下文件：

- `soyo-actions.png`：8 列×5 行，每格 320×208；火球 7 帧、喷焰 7 帧、跳跃 8 帧、受伤 7 帧、倒地 6 帧，共 35 个有效帧。
- `soyo-actions.json`：图集尺寸、脚底锚点和行信息，便于以后修改；运行时常量在 `src/characters.js`，调整切图规格时需同步。
- `soyo-fireball.png`：从原图提取的飞行火焰。
- `../sprites/soyo-down.png`：新的最终倒地姿态。`soyo-portrait.png` 使用替换动作前的原版，与其他四人保持一致，加工脚本不会覆盖头像。
- `docs/previews/soyo-actions.jpg`：所有有效帧的深色底检查图。

原图第一行最右第八个人物被画布边缘截断，因此不纳入火球序列。第二行前一帧的火焰覆盖了后一帧左侧头发，最终喷焰帧使用同图前一帧的完整伸手人物与最终喷焰组合。没有重新生成或绘制角色。

战斗中：普通施法播放火球行，暴击播放喷焰行；命中时播放受伤行，闪避时播放跳跃行，击破时顺序播放倒地行。所有帧按共同身体高度与脚底锚点绘制，向左时整体镜像。头像、档案及标题合照已按用户要求恢复为替换动作前的原版。原图没有四方向行走，因此地图继续使用现有四方向待机/行走素材。

月森之杖的演出属性由冰改为火，配合画面上的原始火焰；武器名称、威力、命中、暴击、射程以及角色能力未变。现有战斗规则没有元素克制或元素抗性结算。

替换前备份：`backups/before-soyo-actions.zip`。重建标题合照执行 `python tools/prepare-ui-assets.py`；重建单文件执行 `node build-standalone.js`，会内嵌新的动作图集与飞行火焰。

## 预览入口

在 `index.html` 或 `standalone.html` 后加以下参数：

| 参数 | 用途 |
| --- | --- |
| `?battle-demo=soyo` | 播放普通火球施法 |
| `?battle-demo=soyo-crit` | 播放暴击喷焰 |
| `?battle-demo=soyo-hurt` | 播放爽世受伤 |
| `?battle-demo=soyo-dodge` | 播放爽世闪避 |
| `?battle-demo=soyo-down` | 播放爽世倒地 |

以上各参数末尾加 `-freeze` 可定格检查，例如 `?battle-demo=soyo-crit-freeze`。预览不写入存档、不扣除真实对局 HP。

验证：`node tests/test-character-actions.js` 检查真实素材加载、共同锚点、朝向、动画随战斗时间推进、暴击行选择、跳跃闪避、倒地末帧与投射物显示时段；其他战斗、存档和地图检查继续运行。
