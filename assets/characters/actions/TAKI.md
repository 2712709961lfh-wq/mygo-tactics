# 椎名立希持斧动作（v3.8）

用户制作并提供原图 `D:/Gemini_Generated_Image_8wakm88wakm88wak.jpg`，896×1176。原始 JPEG 完整保存在 `source/taki-axe-original.jpg`，不覆盖源文件。此角色素材由用户提供，不属于项目其他素材的 CC0 授权范围。

运行 `python tools/prepare-taki-actions.py`（需要 Pillow）可重建透明图集、倒地单图、深浅背景预览与 GIF。图集 `taki-actions.png` 为 8 列×10 行，每格 160×128；共同锚点 `(64,112)`，身体参考高度 70。规格另存于 `taki-actions.json`；修改裁切规格后需同步 `src/characters.js`。

| 行 | 动作 | 帧数 | 游戏用途 |
| --- | --- | --- | --- |
| 0 | idle | 6 | 持斧待机 |
| 1 | idle2 | 6 | 放松待机，与上一组交替 |
| 2 | walk | 8 | 战斗后撤 |
| 3 | run | 8 | 近战接近及残影 |
| 4 | jump | 8 | 跳跃闪避 |
| 5 | attack | 6 | 普通横扫 |
| 6 | attack2 | 7 | 普通举斧下劈 |
| 7 | special | 8 | 暴击回旋挥斧 |
| 8 | hurt | 4 | 受伤并恢复待机 |
| 9 | down | 5 | 倒地并保持最后一帧 |

合计 66 帧。软绿幕遮罩按亮绿色背景与深色斧头、服装的颜色差异处理，边缘去溢色；不重画人物、不逐帧拉伸。按共同脚底锚点定位，跳跃保留原图高度变化，倒地停止倾斜和呼吸浮动。SPECIAL 第 6、7 帧的轨迹紧邻，按局部遮罩分离相邻帧，保持各自斧头完整。

普通攻击按演出次数交替使用横扫和下劈，计数仅存在于战斗画面，不写入存档；暴击使用 SPECIAL。横扫第 4 帧、下劈第 6 帧、SPECIAL 第 4 帧的向前伸斧从 `IMPACT_T = 0.58` 开始，配合既有命中与伤害数字；SPECIAL 后续举斧和向后回旋作为命中后的收势。挥斧完成前保持近战站位，`t=0.70` 后播放行走后撤。斧头和轨迹已在图中，自定义动作加载成功时停止叠加旧程序斧光，通用命中粒子保留。

编队预览使用新待机、横扫、受伤和倒地姿态。头像、档案立绘、标题合照沿用现有版本。原图只有单侧行走，地图继续使用原有四方向待机／行走图集。角色能力、装备、命中与伤害公式不受此替换影响。

## 预览入口

打开 `index.html` 或 `standalone.html`，追加以下参数；末尾再加 `-freeze` 可定格：

- `?battle-demo=taki`：普通横扫。
- `?battle-demo=taki-heavy`：指定举斧下劈，不推进交替计数。
- `?battle-demo=taki-crit`：SPECIAL 暴击。
- `?battle-demo=taki-hurt`：受伤。
- `?battle-demo=taki-dodge`：跳跃闪避。
- `?battle-demo=taki-down`：倒地。

预览不扣实际对局 HP、不写入存档。例如 `?battle-demo=taki-crit-freeze` 检查挥斧击中姿态，`?battle-demo=taki-down-freeze` 检查最终倒地姿态。图形预览：`docs/previews/taki-actions-dark.png`、`taki-actions-light.png`、`taki-actions.gif`。

替换前相关文件及立希头像、倒地素材备份：`backups/before-taki-actions-20261111.zip`。运行 `node build-standalone.js` 同步单文件内嵌素材。

`node tests/test-character-actions.js` 检查五名角色的真实 PNG、动作规格、锚点与朝向；立希另检查三套挥斧与伤害时机、普通动作交替、接近／后撤、跳跃地面锚点、受伤恢复、倒地末帧保持及地图方向素材保留。核心、视口、UI 流程与装备图鉴共 76 项检查一并运行。
