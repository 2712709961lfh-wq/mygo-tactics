# 高松灯新版持剑动作（v3.9）

用户制作并提供新图 `D:/Gemini_Generated_Image_d0k3zvd0k3zvd0k3.jpg`，891×1200。未经修改的副本保存在 `source/tomori-sword-v2-original.jpg`。旧版原图 `source/tomori-sword-original.jpg` 仍保留；本次替换前的图集、加工脚本、预览、相关代码及头像保存在 `backups/before-tomori-actions-v2-20261111.zip`。这些角色图片由用户提供，不属于项目其他素材的 CC0 授权范围。

运行 `python tools/prepare-tomori-actions.py`（需要 Pillow）可重建：

- `tomori-actions.png`：8 列×10 行，每格 192×144；共 58 个有效帧。
- `tomori-actions.json`：共同锚点 `(72,124)`、身体参考高度 76 及各行帧数；对应运行时配置在 `src/characters.js`。
- `../sprites/tomori-down.png`：新版最终倒地单图。
- `docs/previews/tomori-actions-dark.png`、`tomori-actions-light.png`、`tomori-actions.gif`：深浅背景逐帧预览及动画。

| 行 | 动作 | 帧数 | 游戏用途 |
| --- | --- | --- | --- |
| 0 | idle | 6 | 持剑待机 |
| 1 | idle2 | 6 | 眨眼、闭眼待机，与上一组交替 |
| 2 | walk | 8 | 战斗后撤 |
| 3 | run | 8 | 普通攻击接近对手 |
| 4 | rush | 8 | RUN＋ATTACK，暴击冲刺拔剑与回旋收势 |
| 5 | jump | 8 | 跳跃闪避 |
| 6 | attack | 4 | 普通拔剑挥击 |
| 7 | attack2 | 3 | 普通举剑劈斩 |
| 8 | hurt | 3 | 受伤后恢复待机 |
| 9 | down | 4 | 站立、跪坐、侧倒、最终横躺 |

## 图像处理与动作时序

按绿幕与灰色衣装、深绿裙装、剑柄的颜色差异生成软透明遮罩；去除边缘溢色，保留白色剑光的柔边。逐帧测量身体中心并共用脚底锚点，不任意缩放单帧。清除攻击行混入的相邻剑尖、剑鞘和轨迹残片；保留本帧的剑身和斩击弧线。没有重画人物。

普通攻击交替使用 ATTACK 1 和 ATTACK 2，交替计数只存在于演出层，不写入存档。第一套第 3 帧、第二套第 2 帧从 `IMPACT_T = 0.58` 开始，配合命中数字。普通接近使用 RUN，收势后在 `t=0.70` 开始 WALK 后撤，避免剑挥到一半便离开对手。

暴击完整播放 RUN＋ATTACK：前 3 帧随接近推进，随后拔剑、举剑，第 6 帧在 `t=0.58` 挥向对手，再播放最后两帧回旋收势。自定义素材加载成功时停止叠加旧程序剑光，通用命中粒子、镜头与伤害数字保留。

闪避使用新图的 8 帧跳跃，地面锚点固定，保留原图高低变化。受伤使用 3 帧后恢复待机；被击破使用 4 帧倒地，停止呼吸浮动和倾斜，保持最后一帧。编队页同步使用新待机、攻击、受伤与倒地姿态。

头像、档案立绘及标题合照沿用现有版本。新图只有单侧行走，地图继续使用现有四方向待机／移动素材。属性、装备和战斗结算规则保持原设置。

## 预览与验证

在 `index.html` 或 `standalone.html` 后追加参数，末尾再加 `-freeze` 可定格：

- `?battle-demo=tomori`：普通拔剑挥击。
- `?battle-demo=tomori-heavy`：指定举剑劈斩，不推进交替计数。
- `?battle-demo=tomori-crit`：RUN＋ATTACK 冲刺暴击。
- `?battle-demo=tomori-hurt`：受伤。
- `?battle-demo=tomori-dodge`：跳跃闪避。
- `?battle-demo=tomori-down`：倒地。

预览不扣真实对局 HP、不写入存档。例：`?battle-demo=tomori-crit-freeze` 检查冲刺斩击命中姿态，`?battle-demo=tomori-down-freeze` 检查完整横躺轮廓。

`node tests/test-character-actions.js` 检查五名少女真实图集、帧数、锚点、朝向、地图方向素材；灯另检查两套普通剑击、交替计数、冲刺暴击时序、原图剑光、接近后撤、跳跃地面位置、受伤恢复及新版倒地末帧。其他核心、视口、UI 流程与装备检查共 76 项。运行 `node build-standalone.js` 同步单文件内嵌素材。
