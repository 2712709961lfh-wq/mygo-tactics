#!/usr/bin/env python3
"""把 character assets/xingzou/ 的绿幕行走图转成游戏用的透明图集。

输入：3 列（步态帧）× 4 行（下 / 上 / 左 / 右），纯绿背景。
输出：assets/characters/walk/{id}-walk.png，
      3×4 个 128×128 单元格，透明背景、每行统一裁剪、脚底对齐。

用法：
    python tools/prepare-walk-assets.py
"""
from pathlib import Path
from collections import deque

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'character assets' / 'xingzou'
OUT = ROOT / 'assets' / 'characters' / 'walk'
CELL = 128
COLS, ROWS = 3, 4
BG = (92, 148, 90)          # 绿幕采样值
KEY_RADIUS = 52             # 与绿幕的颜色距离阈值

FILES = {
    'tomori': '高松灯.png',
    'anon': '千早爱音.png',
    'rana': '要乐奈.png',
    'soyo': '长崎爽世.png',
    'taki': '椎名立希.png',
}


def key_green(im):
    """只把与边缘连通的绿幕变透明，避免误伤深绿色裙子。"""
    im = im.convert('RGBA')
    w, h = im.size
    pix = im.load()
    bg = bytearray(w * h)
    for y in range(h):
        for x in range(w):
            r, g, b, _ = pix[x, y]
            if (r - BG[0]) ** 2 + (g - BG[1]) ** 2 + (b - BG[2]) ** 2 < KEY_RADIUS ** 2:
                bg[y * w + x] = 1

    # 从四条边做 flood fill，内部绿色（眼睛/衣服）保持不透明。
    seen = bytearray(w * h)
    queue = deque()
    for x in range(w):
        for y in (0, h - 1):
            i = y * w + x
            if bg[i] and not seen[i]:
                seen[i] = 1
                queue.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            i = y * w + x
            if bg[i] and not seen[i]:
                seen[i] = 1
                queue.append((x, y))
    while queue:
        x, y = queue.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h:
                i = ny * w + nx
                if bg[i] and not seen[i]:
                    seen[i] = 1
                    queue.append((nx, ny))
    for y in range(h):
        for x in range(w):
            if seen[y * w + x]:
                pix[x, y] = (0, 0, 0, 0)
    return im


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for uid, filename in FILES.items():
        src = Image.open(SRC / filename).convert('RGB')
        sw, sh = src.size
        sheet = Image.new('RGBA', (COLS * CELL, ROWS * CELL), (0, 0, 0, 0))
        for row in range(ROWS):
            y0, y1 = round(row * sh / ROWS), round((row + 1) * sh / ROWS)
            cells = []
            for col in range(COLS):
                x0, x1 = round(col * sw / COLS), round((col + 1) * sw / COLS)
                cell = src.crop((x0, y0, x1, y1)).resize((CELL, CELL), Image.Resampling.LANCZOS)
                cells.append(key_green(cell))

            # 同一行三帧共用一个裁剪窗口，保留步态相对位移、避免抖动。
            boxes = [c.getbbox() for c in cells if c.getbbox()]
            if not boxes:
                continue
            min_x = max(0, min(b[0] for b in boxes) - 3)
            min_y = max(0, min(b[1] for b in boxes) - 3)
            max_x = min(CELL, max(b[2] for b in boxes) + 3)
            max_y = min(CELL, max(b[3] for b in boxes) + 3)
            side = max(max_x - min_x, max_y - min_y)
            nx = (min_x + max_x) // 2 - side // 2
            ny = max_y - side
            nx = max(0, min(CELL - side, nx))
            ny = max(0, min(CELL - side, ny))
            for col, cell in enumerate(cells):
                crop = cell.crop((nx, ny, nx + side, ny + side)).resize(
                    (CELL, CELL), Image.Resampling.NEAREST)
                sheet.alpha_composite(crop, (col * CELL, row * CELL))

        target = OUT / f'{uid}-walk.png'
        sheet.save(target)
        print(f'{uid}: {sheet.width}×{sheet.height} -> {target}')


if __name__ == '__main__':
    main()
