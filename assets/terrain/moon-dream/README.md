# 第二关 · 星铃花镇素材

2026-11-11。当前游戏使用 `moon-hd-atlas.png`，适配 **40×28 的 2.5D 战棋地图**；组合衍生图集按 **CC BY-SA 3.0** 提供。旧版 `moon-atlas.png` 保留作为 v4.3 制作记录。

- **Whispers of Avalon: Grassland Tileset** — **Leonard Pabin**。原作选择 **CC BY 3.0**：<https://opengameart.org/content/whispers-of-avalon-grassland-tileset>。许可：<https://creativecommons.org/licenses/by/3.0/>。
- **Grassland Tileset** — Clint Bellanger 等：<https://opengameart.org/content/grassland-tileset>，CC BY-SA 3.0。
- **Old ruins tileset** — rubberduck 及素材贡献者：<https://opengameart.org/content/old-ruins-tileset>，CC BY-SA 3.0。
- Flare 完整署名、依赖作者及原始 CREDITS 见 [原素材说明](../flare/README.md)、`../flare/grassland-source/grassland/CREDITS.txt` 和 `../flare/old-ruins/CREDITS.txt`。这些文件需随作品保留。

Avalon 原始下载文件保存在 `source/`：`avalon-ground.png`（ground_tiles.png）、`avalon-objects.png`（object- layer.png）和 `avalon-trees.psd`（treesv6_0.psd）。只使用地面局部、花丛和完整树木，没有使用桶或带署名的区域。

本项目修改：局部裁切、透明边界整理、缩放、对比度与色彩调整；珍珠白石材、青蓝水体和粉紫花树保持统一色温。v4.4 地面直接使用 Flare 原始 512～1024px 纹理，图集为 4096×2048，槽位为 512×512，石坪拼缝与月纹在真实石材纹理上绘制。物件保留来源原有细节，放大槽位不代表增加原作细节。重建方式：`tools/prepare-moon-hd-assets.py`；尺寸与槽位清单：`moon-hd-atlas.json`。旧版工具与图集保留供历史追溯。

组合衍生素材许可：<https://creativecommons.org/licenses/by-sa/3.0/>。允许免费使用及商用；分发修改后的相关素材需保留作者、来源、修改说明并按相同许可共享。此说明针对相关美术素材，不改变游戏其他部分的授权。


v4.5：复用现有高清图集构造花镇屋舍，石墙、双坡屋顶与门分别取砌墙和树皮纹理，屋顶染为蓝、紫与玫瑰色，搭配 Avalon 花箱及暖色窗光；地面改为端正方格，取消斜切与纵向压缩，物件高度与侧面单独绘制。素材来源和许可不变。
