# 第十二关：月之森女子学园

检索、下载与加工日期：2026-11-25。运行时素材全部保存在本地，单文件版内嵌同一图集。

## 学校设定参考

- [MyGO!!!!! 官方长崎爽世角色资料](https://anime.bang-dream.com/mygo/character/soyo/)明确记载其就读「月ノ森女子学園」。页面存档位于 `docs/research/chapter-twelve/soyo.html`。
- [MyGO 官方第十话校园预览](https://anime.bang-dream.com/mygo/wordpress/wp-content/uploads/2023/08/10202938/BD_Mygo_ep10_230705_PR422HQ_00005.png)用于核对浅黄砖墙、白色拱券、长窗与绿荫的视觉特征。研究存档位于 `docs/research/chapter-twelve/official-episode10-school-reference.png`，不进入游戏图集或单文件构建。
- 地图采用月之森主题的浅色欧式校舍、欧式窗框、灰蓝屋顶、校名标识、庭园与学校大门。战棋布局为本项目设计，并非官方校园平面图；没有提取动画截图或官方角色页面图片作为地图素材。

## 网上取得的免费建筑素材

| 用途 | 来源与作者 | 使用许可 | 加工方式 |
| --- | --- | --- | --- |
| 欧式窗框、浅色双开门、铁艺围栏 | [LPC Victorian Buildings](https://opengameart.org/content/lpc-victorian-buildings)，bluecarrot16、Lanea Zimmerman（Sharm）、Casper Nilsson、Lyndsay Takacs（cyanowl）、Redshrike | 选择 [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) | 从 `victorian-windows-doors.png` 裁切三个完整图块，去除相邻碎片；深色窗玻璃改为校园蓝灰色，组合为透明图集，地图中缩放与旋转使用。 |

- [实际下载原包](https://opengameart.org/sites/default/files/lpc-victorian-buildings.zip)保存在 `source/lpc-victorian-buildings.zip`。
- `source/CREDITS-victorian.txt` 保留原作者提供的完整署名及上游作品链接，原包各文件继续遵循各自许可。
- `source/download.json` 记录下载地址和原包 SHA-256。
- `school-scenery.png` 为本项目裁切与调色的衍生图集，按 **CC BY-SA 3.0** 提供；保留原作者署名、来源链接、许可与上述修改说明。
- `school-scenery.json` 为图集坐标，`tools/prepare-school-art.py` 可从保留的原包复现，`docs/previews/chapter-12-atlas.png` 为图集检查图。

校舍主体、拱券长窗、时钟塔、屋顶、道路、月纹广场、学校大门、告示牌、长椅和灯为项目 Canvas 绘制；5.29.1 增加砖石侧面、屋顶进深、檐口、窗框凹槽、台阶、门柱柱帽、雕花铁门和统一方向的投影。原图集欧式窗框保留，教学楼目前使用按参考重绘的拱窗。花圃沿用第十一关免费 LPC 植物素材，完整作者与 CC BY-SA 3.0 许可见 [第十一关素材说明](../chapter-eleven/SOURCES.md)。

敌军沿用现有天马、重装及宫廷骑兵素材及其许可，详见 [第五关素材说明](../chapter-five/SOURCES.md)及[第十关素材说明](../chapter-ten/SOURCES.md)。裂空天马沿用第九关苍蓝双环、羽光与裂空轨迹。新关卡不会在运行时联网请求素材。

## 5.29.1 树木与立体校园细节

- [LPC Trees Mega-Pack](https://opengameart.org/content/lpc-trees)，由 bluecarrot16 整理，按 [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) 使用。
- 完整署名：bluecarrot16、Jetrel、Zabin、Hyptosis、Surt、Buch、Johann Charlot、Stephen Challener 与 Open Surge 团队、Gaurav Munjal、Ivan Voirol（Silver IV）、Guido Bos、Yar、Paulina Riva（PauR）、William.Thompsonj、Casper Nilsson、ansimuz、qubodup、Bart K.、Blarumyrran、Lanea Zimmerman（Sharm）、Leonard Pabin、Chris Phillips、Barbara Rivera、Talosaurus。
- [实际下载包](https://opengameart.org/sites/default/files/lpc-trees.zip)保存在 `source/lpc-trees.zip`，完整原作者说明保存在 `source/CREDITS-trees.txt`，地址和 SHA-256 见 `source/trees-download.json`，来源网页已保存在研究目录。
- 从 `trees-green.png` 裁切两种阔叶树，适度降低绿色饱和度并调整阴影色温，合并到 `school-scenery.png`。图集现为 512×256，继续按 CC BY-SA 3.0 提供；脚本包含裁切、调色及组合步骤。
- 树冠保留原素材明暗与叶簇，树池、额外落地阴影、花坛的石砌侧面与压顶为 Canvas 绘制。花坛灌木与花朵继续使用第十一关已署名的 LPC 植物图集。
