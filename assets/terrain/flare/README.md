# 第一关 A 方案：Flare 草原与旧石堡垒

2026-11-11。以下原始素材及本项目的衍生图集按 **CC BY-SA 3.0** 使用。

- **Grassland Tileset** — Clint Bellanger 等：<https://opengameart.org/content/grassland-tileset>
- **Old ruins tileset** — rubberduck：<https://opengameart.org/content/old-ruins-tileset>
- 许可证：<https://creativecommons.org/licenses/by-sa/3.0/>。

完整原始署名保留在 `grassland-source/grassland/CREDITS.txt` 与 `old-ruins/CREDITS.txt`。请随作品及衍生素材一起分发这两份文件和本说明。允许商用；修改后的相关素材仍需按相同许可共享并注明修改。此许可说明针对美术素材，不改变项目其余文件各自的授权。

草原包署名：Clint Bellanger、Lamoot、Blender Foundation（apricot.blender.org）、lattice、p0ss、Bart K.、Sindwiller、Zuendholz、Yughues、Blender Texture Disc、Public Domain Textures。旧遗迹包及其依赖署名：rubberduck、Spelle、Clint Bellanger、MrCraftAnimation、Daniel Andersson、Scribe、Blender Cloud。具体作品、网址及各自许可见原始 CREDITS。

## 实际使用与修改

`tools/prepare-flare-assets.py` 从下载的原始 PNG 和纹理生成 `battlefield-atlas.png`，槽位清单为 `battlefield-atlas.json`。

- 草地、石路、岩石、水体、树皮与铁材使用草原包原始纹理。
- 石板地面与石墙来自 Old Ruins 的原始单张渲染图，通过四角映射展开为适合当前地图的正交表面。
- 木桥面、树木、草丛、营火与物资由草原图集裁切；石柱、雕像与碎石由遗迹单张渲染图裁切。
- 全图统一调整饱和度、亮度和冷灰色温；透明物件统一边界与缩放。衍生图集按 CC BY-SA 3.0 提供。
- 不使用原站示例截图拼接地图，不使用任天堂美术素材。

地图保持原有的正交 36×24 方格、所有障碍、敌人位置、开门及浅滩机制。通过纹理展开适配原有透视；当前为固定俯视 2D 画面，不提供自由旋转 3D 摄像机。

## 原始下载

- <https://opengameart.org/sites/default/files/grassland_tiles.png>
- <https://opengameart.org/sites/default/files/grassland_blend.zip>
- <https://opengameart.org/sites/default/files/old_ruins_tileset_0.zip>

本地保留草原源文件、遗迹渲染原图与原始署名；下载文件的 SHA-256 见 `DOWNLOAD-HASHES.txt`。
