# v3.1 界面贴图来源与授权

核对日期：2026-11-10。以下两组新增外部素材的来源页均明确标注 **CC0**，允许免费复制、修改、再分发及商业使用，无强制署名要求。这里仍保留作者与下载地址以便追溯。CC0 法律文本保存在 [licenses/CC0-1.0.txt](licenses/CC0-1.0.txt)。

## 1. yd — GUI elements

- 作者：**yd**。
- 来源页：<https://opengameart.org/content/gui-elements>。
- 授权：CC0，页面 License(s) 栏。
- 下载原文件：<https://opengameart.org/sites/default/files/gui2.svg>、<https://opengameart.org/sites/default/files/Quest_0.svg>。
- 原预览图：<https://opengameart.org/sites/default/files/gui2.png>、<https://opengameart.org/sites/default/files/quests_0.png>。
- 本地保存：`yd/source/gui2.svg`、`Quest.svg`、`gui2-preview.png`、`quest-preview.png`。
- 使用内容：缝线皮革外框、旧纸卷边与线条装饰，以及预览图空白处的皮纹。去除原示例文字与控件，裁剪、重新配色，导出透明框与装饰条。

矢量清理步骤：读取 `Quest.svg`，找到 `id="layer1"` 的图层。`quest-clean.svg` 保留其前 107 个直接子节点（索引 0–106）；`leather-clean.svg` 保留前 90 个直接子节点（索引 0–89）。其余图层、defs、渐变引用保留；根节点改为 `viewBox="25 40 695 880"`、`width="695"`、`height="880"`。这两个清理后的 SVG 与对应 PNG 已保存在同一目录。PNG 以原尺寸 695×880 栅格化，例如使用 sharp 的 `sharp(input).png().toFile(output)`。

## 2. Andrea Stöckel — Parchment Paper Background Texture

- 作者：**Andrea Stöckel**。
- 来源页：<https://www.publicdomainpictures.net/en/view-image.php?image=488604&picture=parchment-paper-background-texture>。
- 授权：CC0，页面 License 栏标明可自由修改与商业使用。
- 原图：<https://www.publicdomainpictures.net/pictures/490000/velka/pergament-papier-hintergrund-textur-1675508658pDH.jpg>。
- 本地原图：`paper/source/parchment.jpg`，1920×1242。
- 使用内容：真实旧纸照片，用于信息栏、标题菜单、档案、存档、弹窗、章节卡片和合照底纸。经过裁剪与轻度色调统一。

## 游戏运行素材

| 文件（`diary/`） | 来源及处理 |
| --- | --- |
| `paper.jpg` | Andrea Stöckel 原图，裁剪到 1024×768 并统一色调 |
| `leather.jpg` | yd 预览图皮纹，裁剪、灰度调色、镜像拼成无缝 512×512 |
| `frame-paper.png` | yd 空白面板，保留外框与卷边，内部透明以显示真实纸纹 |
| `frame-ink.png` | yd 缝线外框，改为墨蓝与旧黄铜配色 |
| `portrait-frame.png` | 从缝线外框四角拼成头像边框 |
| `flourish.png` / `flourish-ink.png` | yd 卷曲线条装饰，提取透明度并分别着金色和墨色 |
| `title-companions.png` | 旧纸底与装饰，加上项目已有五名角色素材的合照排版 |

**角色图片并非上述 CC0 下载素材。** `title-companions.png` 中的人物来自本项目原有 `assets/characters/sprites/*-portrait.png`；它们继续遵循原有权利状态。本记录只确认新增的纸张、皮纹、框线与装饰素材授权，不对整个游戏、MyGO!!!!! 角色或原有资源作 CC0 声明。

## 重新生成

安装 Pillow 后，在项目目录运行 `python tools/prepare-ui-assets.py`，会从保存的原图及清理后框图生成 8 张运行贴图和 `docs/previews/ui-materials.jpg` 素材展示图。脚本中的联系表字体使用 Windows 自带 Segoe UI；字体本身没有打包分发。运行 `node build-standalone.js` 后，CSS 引用的贴图也会全部内嵌到单文件版。

`source-sha256.json` 记录下载原文件的 SHA-256，便于确认本地原始素材未被意外修改。运行只依赖本地资源，不会向上述站点请求图片。
