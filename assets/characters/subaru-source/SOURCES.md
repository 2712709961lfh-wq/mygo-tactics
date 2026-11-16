# 安和昴 · 用户提供素材

整理日期：2026-11-16。以下五张 JPG 来自用户本次提供的角色图，不将其标记为 CC0 或其他开放许可。原图在本目录保留副本，未修改用户的原始文件。

| 用户原始文件 | 本地副本 | 用途 |
| --- | --- | --- |
| `D:/Gemini_Generated_Image_bzkjoibzkjoibzkj.jpg` | `actions.jpg` | 待机、行走、奔跑、施法及备用攻击 |
| `D:/Gemini_Generated_Image_j9zcckj9zcckj9zc.jpg` | `hurt.jpg` | 跳跃、受伤及倒地 |
| `D:/Gemini_Generated_Image_b44xsxb44xsxb44x.jpg` | `walk.jpg` | 四方向地图行走 |
| `D:/Gemini_Generated_Image_rlmr3wrlmr3wrlmr.jpg` | `idle.jpg` | 四方向地图待机 |
| `D:/Gemini_Generated_Image_nwoe4lnwoe4lnwoe.jpg` | `portrait.jpg` | 人物头像及资料立绘 |

`tools/prepare-subaru-assets.py` 去除绿色背景并清理边缘，头像去除与外界连通的白底，保留人物内部白色，并只保留人物主体连通区域后紧贴轮廓裁切，避免边缘杂点撑大透明留白。少数侧向行走帧镜像为同一朝向，统一脚底锚点，去除动作区域外的文字标记。

输出位于 `assets/characters/`：

- `actions/subaru-actions.png`、`actions/subaru-actions.json`：每格 192×160，脚底锚点 (80,144)，参考身体高度 104；待机 6、行走 7、奔跑 8、攻击 8、备用攻击 4、跳跃 8、受伤 3、倒地 5，共 49 帧。
- `idle/subaru-idle.png`、`walk/subaru-walk.png`：地图四方向图集。
- `sprites/subaru-portrait.png`、`sprites/subaru-down.png`、`sprites/subaru-sheet.png`：头像、倒地图和通用回退图集。
- 动作预览：`docs/previews/subaru-actions.png`。

第十关的排练室继续使用第九关代码绘制的场景。鼓组与电吉他来自 AntumDeluge / OpenClipart 的 CC0 Music Icons，完整说明见 [第七关素材来源](../../chapter-seven/SOURCES.md)。重装沿用 LPC 衍生图集（CC BY-SA 3.0），天马沿用 Spring Spring 的 CC0 图集，完整作者和许可见 [第五关素材来源](../../chapter-five/SOURCES.md)。

仁菜幻影复用项目现有的仁菜素材，在运行时添加暗色及紫色光环。光门、召唤阵和幻影光效由代码绘制，不含新增下载图像。普通版使用本地文件，单文件版嵌入相同素材，无外部运行时请求。

2026-11-16（v5.12.3）：修正头像偏右、偏小与脚底悬空；输出为369×580透明PNG，继续使用与其他角色相同的展示规则。可运行 `python tools/prepare-subaru-assets.py --portrait-only`，从本目录的原图副本单独重建头像，不重新生成动作和地图图集。
