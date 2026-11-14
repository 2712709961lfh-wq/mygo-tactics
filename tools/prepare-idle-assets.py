#!/usr/bin/env python3
"""把 character assets/jingzhi/ 的四方向站立图转为透明图集。

输入：2 列 × 2 行（左上=下，右上=右，左下=上，右下=左），绿幕背景。
输出：assets/characters/idle/{id}-idle.png，
      2×2 个 128×142 单元格，透明背景。

用法：
    python tools/prepare-idle-assets.py
"""
from pathlib import Path
from collections import deque

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'character assets' / 'jingzhi'
OUT = ROOT / 'assets' / 'characters' / 'idle'
CW, CH = 128, 142

FILES = {
    'tomori': '高松灯.jpg',
    'anon': '千早爱音.jpg',
    'rana': '要乐奈.jpg',
    'soyo': '长崎爽世.png',
    'taki': '椎名立希.jpg',
}


def key_green(im):
    """从四边泛洪去掉绿幕，内部深绿色服饰保持不透明。"""
    im = im.convert('RGBA')
    w, h = im.size
    pix = im.load()
    bg = pix[0, 0][:3]
    mask = bytearray(w * h)
    for y in range(h):
        for x in range(w):
            r, g, b, _ = pix[x, y]
            if (r - bg[0]) ** 2 + (g - bg[1]) ** 2 + (b - bg[2]) ** 2 < 58 ** 2:
                mask[y * w + x] = 1

    seen = bytearray(w * h)
    queue = deque()
    for x in range(w):
        for y in (0, h - 1):
            i = y * w + x
            if mask[i] and not seen[i]:
                seen[i] = 1
                queue.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            i = y * w + x
            if mask[i] and not seen[i]:
                seen[i] = 1
                queue.append((x, y))
    while queue:
        x, y = queue.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h:
                i = ny * w + nx
                if mask[i] and not seen[i]:
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
        sheet = Image.new('RGBA', (CW * 2, CH * 2), (0, 0, 0, 0))
        for row in range(2):
            for col in range(2):
                cell = src.crop((
                    round(col * sw / 2), round(row * sh / 2),
                    round((col + 1) * sw / 2), round((row + 1) * sh / 2),
                )).resize((CW, CH), Image.Resampling.LANCZOS)
                sheet.alpha_composite(key_green(cell), (col * CW, row * CH))
        target = OUT / f'{uid}-idle.png'
        sheet.save(target)
        print(f'{uid}: {sheet.width}×{sheet.height} -> {target}')


if __name__ == '__main__':
    main()
