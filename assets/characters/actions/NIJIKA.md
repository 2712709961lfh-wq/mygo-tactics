# 伊地知虹夏素材

由用户 2026-11-14 提供的五张原图导出。原图备份位于 `../nijika-source/`，项目外的原 JPG 不改写。

| 素材 | 原文件标识 | 导出 |
| --- | --- | --- |
| 受伤／倒地 | `Gemini_Generated_Image_67cv8t67cv8t67cv.jpg` | 受伤 3 帧、倒地 6 帧 |
| 动作 | `Gemini_Generated_Image_dohbj6dohbj6dohb.jpg` | 待机 8、对话 8、特殊 6、行走 8、魔法攻击 8 帧 |
| 四方向站立 | `Gemini_Generated_Image_130aj0130aj0130a.jpg` | 下／左／上／右，2×2 |
| 四方向行走 | `Gemini_Generated_Image_5g0kiu5g0kiu5g0k.jpg` | 下／上／左／右，每向 3 帧 |
| 头像 | `Gemini_Generated_Image_xzjvukxzjvukxzjv.jpg` | 保留服装白色，仅清除连通外部背景 |

动作图集 `nijika-actions.png` 每格 192×160，锚点 (72,144)，身体基准高 112。共七行，每行最多八列，实际 47 帧，详细行列在同名 JSON 中。战斗施法顺序播放全部八帧，受伤三帧，倒地六帧；没有跳跃原图，闪避使用站姿与位移。

构建命令：`python tools/prepare-nijika-assets.py`。素材已嵌入 `standalone.html`。本章初始职业修道士，Lv.8，攻击与治疗使用统一魔法规则，个人成长率读自用户 Excel。
