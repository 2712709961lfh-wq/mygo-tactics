# 井芹仁菜素材接入

素材由用户于 2026-11-12 提供。原始 JPG 原样保存在 `source/`；此处记录其来源，不另行声明第三方素材许可。

| 用户原图 | 项目内原件 | 用途 |
| --- | --- | --- |
| Gemini_Generated_Image_scg4niscg4niscg4.jpg | source/nina-battle-original.jpg | 战斗动作图集 |
| Gemini_Generated_Image_e7za7ye7za7ye7za.jpg | source/nina-walk-original.jpg | 四方向行走 |
| Gemini_Generated_Image_c0d6glc0d6glc0d6.jpg | source/nina-idle-original.jpg | 四方向地图站立 |
| Gemini_Generated_Image_n7lftpn7lftpn7lf.jpg | source/nina-portrait-original.jpg | 头像与招募立绘 |

`tools/prepare-nina-assets.py` 使用 Pillow，从 D 盘这四张输入生成透明 PNG，并清除绿幕、绿边和孤立 JPEG 杂点。头像只清除与外边缘相连的白底，以保留白色衣领和袜子。动作统一脚底锚点，清理相邻踢击拖影；原图不改写。

`nina-actions.png` 为 8×10 格，单格 160×144，锚点 (64,124)，身体参考高 84。`nina-actions.json` 记录帧数：

| 动作 | 行号（从0起） | 帧数 |
| --- | --- | --- |
| idle | 0 | 6 |
| walk | 1 | 8 |
| run | 2 | 8 |
| jump | 3 | 8 |
| attack | 4 | 4 |
| attack2 | 5 | 3 |
| attack3 | 6 | 4 |
| shield | 7 | 2 |
| hurt | 8 | 3 |
| down | 9 | 3 |

共 49 帧。普通出拳与连击分别使用 attack、attack2；暴击使用 attack3 踢击，跳跃用于闪避，受伤和倒地对应专门帧。盾姿保留在姿态展示中。

四方向行走图为 3×4 格，每格 128×128，行序下、上、左、右；站立为 2×2 格，每格 128×142。右行素材直接使用原图右向行走。另生成兼容基础图集、透明头像与倒地图片，均纳入单文件版。

素材排版预览位于 `docs/previews/nina-materials.png` 与 `nina-actions.png`；实际游戏绘制预览位于 `nina-engine-poses.png` 和 `nina-battle-preview.png`。运行 `tools/render-third-preview.js` 需要 `@napi-rs/canvas`。
