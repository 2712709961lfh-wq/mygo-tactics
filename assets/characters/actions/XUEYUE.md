# 雪月 · 第一关剑士首领 / 第六名同行者

2026-11-11，使用作者提供的三张原图接入完整角色。原图保存在本目录的 `source/`，处理脚本为 `tools/prepare-xueyue-assets.py`。

## 关卡与招募

- 第一关：雪月占据内庭首领位置 `(16, 2)`。关门时沉眠，击破携钥匙的影弓开门后恢复行动。
- 职业：剑士，等级 7，武器「雪月之刃」。
- 真正应用致命战报时触发加入；战斗预演和未命中不会加入。角色恢复到 34 HP，转为我方，取消首领/沉眠状态，当回合已行动，下一个我方回合可操作。
- 招募不要求先清除其他敌人；若仍有敌人，战斗继续；若雪月是最后的敌人，则先显示加入提示，再进入胜利界面。
- 「同行之人」动态显示六名角色，战场快捷键支持 1–6。
- 第一关通关后可保存通关、查看同行之人或进入第二章。进入第二章后雪月在 `(8, 14)` 随队出击；从未招募的第二章新游戏不会提前解锁。
- 存档增加 `recruited` 名单。旧版第一关 `conductor` 首领映射为雪月；未击败时保留坐标/生命，已击败则补发加入。旧地图版本仍遵循原有版本检查，需要重开地图。
- 已加入后再次倒地遵循现有战棋规则，读档不会自动复活。

| HP | 力量 | 魔力 | 速度 | 守备 | 魔防 | 技巧 | 幸运 | 移动 | 总和 |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 34 | 11 | 4 | 11 | 5 | 6 | 12 | 8 | 5 | 96 |

雪月之刃：物理剑，射程 1，威力 6，命中修正 +5，武器暴击 +5。沿用当前游戏的战斗公式。

## 素材处理

| 原图副本 | 内容 |
|---|---|
| `source/xueyue-sword-original.jpg` | 878×1216 绿色背景战斗动作 |
| `source/xueyue-directions-original.png` | 625×1025 四方向各三帧地图动作 |
| `source/xueyue-portrait-original.png` | 870×935 白底立绘 |

战斗图去除 JPEG 绿幕、清理溢色与相邻剑光残片，保留原绘剑光。统一脚底锚点 `(72,124)`，单元格 192×144，图集 8 列×10 行，基准身高 76。

| 动作 | 帧数 | 使用方式 |
|---|---:|---|
| idle / idle2 | 6 / 8 | 两组待机 |
| walk / run | 8 / 8 | 步行、接近与退回 |
| rush | 7 | 暴击冲刺斩击 |
| jump | 8 | 跳跃闪避 |
| attack / attack2 | 4 / 4 | 普通攻击交替两套剑击 |
| hurt | 3 | 受伤与恢复 |
| down | 5 | 倒地并保持末帧 |

总计 61 帧。普通横斩、举剑劈斩和冲刺剑光均在战斗命中时刻同步。地图按原图真实下/上/左/右重排，不用镜像替代雪月的右侧图。去白底时保护白发与白裙，移除原截图中的独立装饰光环。头像由作者立绘独立提取。

输出文件包括动作 PNG/JSON、四方向 idle/walk 图集、portrait、down 和兼容用标准 sheet。原有五名少女的头像与素材保持原版本。

这些是作者提供的角色素材，不沿用项目中第三方 UI/装备素材的 CC0 声明；对外分发须由作者确认相应权利。

## 预览与验证

- `index.html?battle-demo=xueyue`：普通横斩；`xueyue-heavy`：举剑劈斩。
- `index.html?battle-demo=xueyue-crit-freeze`：冲刺暴击定格。
- `index.html?battle-demo=xueyue-dodge-freeze` / `xueyue-down-freeze`：闪避 / 倒地。
- `index.html?recruit-demo=1`：独立验收场景，雪月剩余 1 HP，其余敌人清除，灯位于相邻格且命中提高到 100%。点击雪月 → 战斗 → 确认结算 → 一起前行 → 查看六人档案 / 保存通关 / 第二章。全部调用正式战斗、招募和换章代码；该页面保存、读取、删除仅访问独立内存对象，刷新即清空，不接触正式存档。
- 动作动图：`docs/previews/xueyue-actions.gif`；深/浅底接触表：`xueyue-actions-dark.png` / `xueyue-actions-light.png`；头像与四方向：`xueyue-portrait-map.png`。

回归：`node tests/test-core.js`（54 项），`test-character-actions.js`（六角色 307 帧图集和战斗时序），`test-viewport.js`（11 项），`test-ui-flow.js`（7 项），`test-equipment.js`（12 项），`node build-standalone.js`。

浏览器验收通过：正式模块版击败→结算→加入→六人档案→第二章雪月可选择；单文件版暴击定格、完整立绘加入提示、通关保存→重开→读档恢复六人、六人档案均正常。控制台无警告或错误。截图为 `docs/previews/xueyue-critical-game.jpg`、`xueyue-recruited-game.jpg` 和 `xueyue-formation-game.jpg`。修改前备份：`backups/before-xueyue-boss-20261111.zip`。


## 2026-11-11：地图四方向站立图替换

使用作者新提供的 `Gemini_Generated_Image_jzw7o6jzw7o6jzw7.jpg`（976×1082），原图保存在 `../idle/source/xueyue-standing-original.jpg`。仅更新地图移动前和停下后的站姿；头像、战斗动作与四方向行走动画沿用已有素材。

- 四格顺序：左上朝下、右上朝左、左下朝上、右下朝右；各方向直接使用作者原图，不镜像。
- 去除 JPEG 绿色背景及边缘绿污染，保留黑色轮廓、花饰和浅色头发；先去背后缩放。
- 输出 `../idle/xueyue-idle.png`：256×284，每格 128×142，角色高度 106px、脚底基线 131px，与原地图站姿接口一致。
- 处理记录：`../idle/xueyue-idle.json`；可重复执行 `tools/prepare-xueyue-idle.py`。原角色全套处理脚本也会优先保留这套新站姿。
- 透明素材与游戏尺寸预览：`docs/previews/xueyue-standing-new.png`。修改前备份在 `backups/xueyue-idle-before-20261111/`；单文件版同步内嵌。
