# 千早爱音弓手动作（v3.7）

用户制作并提供原图：`D:/Gemini_Generated_Image_wwiw56wwiw56wwiw.jpg`，1248×862。原始 JPEG 完整保存在 `source/anon-bow-original.jpg`。角色素材由用户提供，不属于项目其他素材的 CC0 授权范围。

运行 `python tools/prepare-anon-actions.py`（需要 Pillow）重新生成透明图集、箭矢、倒地单图与预览。`anon-actions.png` 为 8 列×5 行，每格 224×144；脚底锚点 `(88,124)`，身体参考高度 110。`anon-actions.json` 记录规格；修改切图规格后需同步 `src/characters.js`。

| 行 | 动作 | 帧数 | 游戏用途 |
| --- | --- | --- | --- |
| 0 | idle | 6 | 战斗待机循环 |
| 1 | walk | 8 | 射击后收势、闪避侧步 |
| 2 | attack | 7 | 举弓、拉弦、释放与后续姿态 |
| 3 | hurt | 3 | 受伤后恢复待机 |
| 4 | down | 5 | 倒地并保持最后一帧 |

合计 29 帧；原图攻击行最右侧的箭矢作为独立投射物 `anon-arrow.png`（65×13），不计为人物帧。

## 图像处理与游戏表现

使用软绿幕遮罩和边缘去溢色，保留粉色头发、暗绿裙装、弓弦与受伤花瓣。按共同身体高度与脚底位置对齐；倒地姿态保留原图从站立、跪坐到横躺的变化。清除射箭行第 3–6 帧弓外的箭矢部分，将飞行交由独立箭图表现；弓内原有细线保留，没有重画人物。

战斗中爱音保持远程射击位置，举弓和拉弦在前，第三帧从 `CAST_RELEASE = 0.46` 开始释放，随后按战斗时间依次播放剩余姿态。独立箭矢从弓的位置飞向对手，仅在 `0.46 <= t < 0.58` 显示，`IMPACT_T = 0.58` 时交给命中特效。原来的程序绘制弓、弦和箭在爱音自定义动作加载成功后不再叠加；其他角色的旧弓箭绘制回退保留。普通与暴击共用这套弓手动作，暴击保留现有镜头和命中特效。

射击后播放持弓行走收势；闪避使用侧步，原图没有跳跃行。受伤播放三帧后恢复待机；击破时播放五帧倒地，停止呼吸浮动与倾斜，保持最后一帧。编队页同步显示新待机、拉弓、受伤与倒地姿态。

头像、档案立绘、标题合照保持现有版本。原图只有单侧行走，地图继续使用原有四方向待机／移动素材。战斗属性、装备和结算规则未变。

## 预览与验证

在 `index.html` 或 `standalone.html` 后加参数，末尾再加 `-freeze` 可定格：

- `?battle-demo=anon`：普通射箭。
- `?battle-demo=anon-crit`：暴击射箭。
- `?battle-demo=anon-hurt`：受伤。
- `?battle-demo=anon-dodge`：持弓侧步闪避。
- `?battle-demo=anon-down`：倒地。

例如 `?battle-demo=anon-freeze` 定格箭矢飞行，`?battle-demo=anon-down-freeze` 检查最终倒地姿态。预览不会扣实际 HP 或写入存档。

预览文件为 `docs/previews/anon-actions-dark.png`、`anon-actions-light.png` 与 `anon-actions.gif`。替换前相关代码及爱音头像、倒地素材保存在 `backups/before-anon-actions-20261111.zip`。

`node tests/test-character-actions.js` 检查四名自定义角色的真实 PNG、帧数、锚点、左右朝向、地图素材保留、射击位置、举弓／释放／收势时序、箭矢比例及显示时段、受伤恢复与倒地保持。执行 `node build-standalone.js` 同步内嵌图集与箭矢。
