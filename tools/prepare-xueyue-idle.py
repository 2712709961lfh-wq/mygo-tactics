#!/usr/bin/env python3
"""Prepare the author's four-direction standing artwork, without changing walking or portraits."""
from pathlib import Path
import json
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'assets/characters/idle/source/xueyue-standing-original.jpg'
OUTPUT = ROOT / 'assets/characters/idle/xueyue-idle.png'
CW, CH, BODY_HEIGHT, FOOT_Y = 128, 142, 106, 131


def remove_green(image):
    """Key before resampling, with a short soft edge for JPEG green contamination.

    The authored costume, hair and flowers contain no green material. Removing
    green throughout also clears the small enclosed gaps between hair and arms.
    """
    result = image.convert('RGBA')
    pixels = result.load()
    for y in range(result.height):
        for x in range(result.width):
            r, g, b, _ = pixels[x, y]
            excess = g - max(r, b)
            alpha = round(255 * max(0, min(1, (24 - excess) / 14)))
            if not alpha:
                pixels[x, y] = (0, 0, 0, 0)
            else:
                # Neutralize the green fringe while keeping black outlines sharp.
                if excess > 0:
                    g = max(r, b)
                pixels[x, y] = (r, g, b, alpha)
    return result


def prepare():
    original = Image.open(SOURCE).convert('RGB')
    sw, sh = original.size
    sheet = Image.new('RGBA', (CW * 2, CH * 2))
    records = []
    for name, col, row in [('down', 0, 0), ('left', 1, 0), ('up', 0, 1), ('right', 1, 1)]:
        bounds = (round(col * sw / 2), round(row * sh / 2),
                  round((col + 1) * sw / 2), round((row + 1) * sh / 2))
        cutout = remove_green(original.crop(bounds))
        box = cutout.getbbox()
        assert box, f'Missing {name} standing frame'
        body = cutout.crop(box)
        width = round(body.width * BODY_HEIGHT / body.height)
        assert width < CW - 8, f'{name} silhouette exceeds its frame'
        body = body.resize((width, BODY_HEIGHT), Image.Resampling.LANCZOS)
        # Remove invisible RGB and barely visible compression residue.
        body.putalpha(body.getchannel('A').point(lambda a: 0 if a < 8 else a))
        sheet.alpha_composite(body, (col * CW + (CW - width) // 2, row * CH + FOOT_Y - BODY_HEIGHT))
        records.append(dict(direction=name, col=col, row=row, sourceBounds=bounds,
                            silhouetteBounds=box, bodyWidth=width))
    sheet.save(OUTPUT, optimize=True)
    OUTPUT.with_suffix('.json').write_text(json.dumps(dict(
        source='source/xueyue-standing-original.jpg', sourceSize=original.size,
        cellWidth=CW, cellHeight=CH, bodyHeight=BODY_HEIGHT, footY=FOOT_Y,
        directions=records), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    # Show transparency against light/dark backgrounds, and actual game-scale silhouettes.
    preview = Image.new('RGB', (1000, 640), '#142332')
    draw = ImageDraw.Draw(preview)
    draw.text((24, 15), 'XUEYUE / NEW MAP STANDING / DOWN - LEFT - UP - RIGHT', fill='#eee0c6')
    for i, frame in enumerate(records):
        col, row = frame['col'], frame['row']
        cell = sheet.crop((col * CW, row * CH, (col + 1) * CW, (row + 1) * CH))
        px = 18 + i * 246
        draw.rectangle((px, 47, px + 232, 357), fill='#d9dfdb')
        large = cell.resize((232, 258), Image.Resampling.NEAREST)
        preview.paste(large, (px, 60), large)
        draw.text((px + 12, 330), frame['direction'].upper(), fill='#263441')
        for j, height in enumerate([60, 44]):
            width = round(height * CW / CH)
            small = cell.resize((width, height), Image.Resampling.NEAREST)
            sx, sy = px + 36 + j * 98, 422
            draw.line((sx - 12, sy + height * FOOT_Y / CH, sx + width + 12, sy + height * FOOT_Y / CH), fill='#718d84')
            preview.paste(small, (sx, sy), small)
            draw.text((sx - 3, 500), f'{height}px', fill='#c4d8d4')
    draw.text((24, 558), '256 x 284 transparent atlas / 128 x 142 per direction / body 106px / foot 131px', fill='#b4d0cc')
    draw.text((24, 589), 'Original walking animation and portraits remain separate assets.', fill='#b4d0cc')
    path = ROOT / 'docs/previews/xueyue-standing-new.png'
    preview.save(path)
    print(f'Prepared {OUTPUT.name}: {sheet.width} x {sheet.height}; four authored directions.')


if __name__ == '__main__':
    prepare()
