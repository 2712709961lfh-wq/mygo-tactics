# 装备图鉴插图来源

采集日期：2026-11-10；同系列扩充与去重：2026-11-12、2026-11-13。

- 素材库：[Free Game Assets / Fantasy RPG Icons](https://www.freegameassets.com/fantasy-rpg-icons)
- 站点关联制作方：[Surge Studio](https://surge.studio/)
- 图标详情页原文：**“Created using AI. Released as CC0.”**
- 授权：[CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/)，可免费使用、修改和商用，无强制署名要求；本项目仍保留来源记录。
- 当前图鉴为 166 条记录分别配置 166 张不同图标，来自该素材库的 166 张不同原图。原图保存在 `originals/`，256×256 游戏用图标保存在 `icons/`，缩小使用 Lanczos。
- 每个原始文件的下载地址、SHA-256、CC0 声明及 AI 制作标记见 `manifest.json`。
- 明确映射见 `icon-assignments.json`；每张衍生图的来源 ID、文件 SHA-256、解码像素 SHA-256、尺寸与抠图处理记录见 `icon-manifest.json`。
- 获取和转换脚本：`tools/prepare-equipment-icons.py`，可重复运行，校验并复用已有原文件；遇到重复图片或无透明通道的图片会报错。

这些是同一套 painterly 奇幻插画素材，**不是《火焰纹章》的原版图标**。每件装备、每个强化版、每种魔法、药品及转职证分别配图，不再共享图标。魔法使用对应元素的魔力球、晶石、卷轴和魔法物件作通用示意，并不表示可以装备这些物件。

三张弓箭原图带有场景背景：Archery、Bowyer、Power Shot。转换脚本使用逐图轮廓蒙版去除背景，保留原画中的木材、金属、弓弦和箭矢。其余当前图标直接保留原 PNG 的透明通道。保持现有图鉴的透明底、纸张与皮革视觉，未混入其他画风。

早期的 38 张来源记录与历史图标文件保留，便于追溯；历史别名 `amulet`、`gem`、`holy-shield` 已不被当前图鉴引用。单文件版仅内嵌 `icon-manifest.json` 中的 166 张现行图标。

验证同时覆盖：166 个不同图标键、166 张不同原图、166 个文件哈希和 166 个解码像素哈希；真实浏览器逐张解码检查尺寸、透明区域和可见主体。全量预览见 `docs/previews/codex-unique-icons.png`。

2026-11-13 新增五种药品和七种转职证，分别使用同库的药瓶、徽戒、印章与胸针插画，沿用现有透明底与材质。

数值与图像来源分开：数值核对自 [Triangle Attack 的武器资料](https://www.fe3h.com/weapons) 与 [装备资料](https://www.fe3h.com/equipment)。未下载该资料站的任天堂装备图片。
