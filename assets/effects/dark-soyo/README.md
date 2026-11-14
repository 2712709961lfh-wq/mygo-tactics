# 往日之影长崎爽世 · 贴图来源

2026-11-13 在线检索并下载。

- 作者：**Kenney Vleugels (Kenney.nl)**。
- 素材包：[Particle Pack (80 sprites)](https://opengameart.org/content/particle-pack-80-sprites)。原发布页：[Kenney Particle Pack](https://kenney.nl/assets/particle-pack)。
- 原始下载：[kenney_particlePack.zip](https://opengameart.org/sites/default/files/kenney_particlePack.zip)。
- 许可：**CC0 1.0**，允许修改、个人及商业项目使用。原始许可保留于 `source/License.txt`；滤镜模板贡献者见原文件。
- 具体使用：`source/PNG/smoke_04.png`（烟雾）、`magic_03.png`（光环纹样）、`scratch_01.png`（裂痕）。
- 本项目修改：将黑底灰度转换为透明度，分别染成暗紫、玫红与浅红；魔法纹样切去两个扇区，形成破碎光环；合并为 `corruption-atlas.png`（768×256）。工具：`tools/prepare-dark-soyo.py`。
- 游戏实际使用：地图、战斗与头像均保留项目已有爽世角色形象，叠加上述贴图。`src/dark-soyo.js` 同时调整人物色调，加入漂浮粒子及赤色泪光。没有将普通敌人的棋子替代为爽世。

公园草地、水面仍使用已有 Moon Dream 图集，其作者、修改与许可见 `assets/terrain/moon-dream/README.md`。路灯、现代混凝土步道、长椅、花圃、指示牌由 `src/park-map.js` 绘制。
