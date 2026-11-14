# 要乐奈长枪动作（v3.6）

用户制作并提供：`D:/Gemini_Generated_Image_zdfdojzdfdojzdfd.jpg`，896×1185。原图完整副本位于 `source/rana-lance-original.jpg`。该角色素材由用户提供，不属于其他项目素材的 CC0 授权范围。

执行 `python tools/prepare-rana-actions.py`（需要 Pillow）可重新生成透明图集、倒地单图、深浅背景检查图与 GIF。图集 `rana-actions.png` 为 8 列×10 行，每格 224×128，脚底锚点 `(96,108)`，身体参考高度 84。`rana-actions.json` 记录规格；修改规格后需同步 `src/characters.js` 的配置。

| 行 | 动作 | 帧数 | 游戏用途 |
| --- | --- | --- | --- |
| 0 | idle | 6 | 战斗待机前半组 |
| 1 | idle2 | 6 | 战斗待机后半组 |
| 2 | walk | 8 | 战斗后撤回原位 |
| 3 | run | 8 | 持枪接近对手 |
| 4 | charge | 5 | 接近末段的冲刺攻击 |
| 5 | jump | 8 | 闪避跳跃 |
| 6 | attack | 4 | 普通突刺，第三帧对应命中 |
| 7 | attack2 | 5 | 暴击突刺，第四帧对应命中 |
| 8 | hurt | 3 | 受伤后恢复待机 |
| 9 | down | 5 | 倒地并保持最后一帧 |

共 58 个有效帧。处理使用软绿幕遮罩与轮廓去溢色，保留白发、格纹衣装和枪尖细节。长枪跨入相邻动作范围，使用连通轮廓与逐帧武器范围分离，清除多余枪杆／枪尖及倒地串帧。末个奔跑帧的枪尖被源图右边界截断，使用同图第六帧的干净枪尖补齐末端；普通突刺最后一帧的后段枪杆受到前一帧白色枪光覆盖，使用同图干净枪杆局部修复。没有重新生成角色。

战斗中长枪已包含在角色帧内，原来程序绘制的额外长枪替换为短暂的细速度线，按新枪尖位置调整接近距离。跳跃帧使用固定地面锚点保留原有腾空高度；倒地时停止呼吸浮动和身体倾斜。编队页使用新待机、突刺、受伤和倒地静帧。头像、档案立绘与标题合照沿用原版，地图沿用原有四方向待机／移动图（本张图只有单一侧向行走），战斗属性、装备与结算规则未变。

## 预览

`index.html` 或 `standalone.html` 后可加以下参数；末尾再加 `-freeze` 可定格检查：

- `?battle-demo=rana`：普通突刺。
- `?battle-demo=rana-crit`：第二套暴击突刺。
- `?battle-demo=rana-hurt`：受伤。
- `?battle-demo=rana-dodge`：跳跃闪避。
- `?battle-demo=rana-down`：倒地。

如 `?battle-demo=rana-crit-freeze`、`?battle-demo=rana-down-freeze`。预览不会写入存档或扣实际 HP。

全部帧检查图在 `docs/previews/rana-actions-dark.png`、`rana-actions-light.png`，动作预览在 `docs/previews/rana-actions.gif`。`../sprites/rana-down.png` 为包含落地长枪的最终倒地单图。

替换前备份为 `backups/before-rana-actions-20261111.zip`。执行 `node tests/test-character-actions.js` 验证三名自定义角色图集、锚点、朝向、战斗时序与地图素材保留；执行 `node build-standalone.js` 更新内嵌单文件。
