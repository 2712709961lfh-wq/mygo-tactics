"""Extract the user's 1536x1024 Soyo magic sheet. Requires Pillow.

The original is preserved in assets/characters/actions/source. No scaling is
applied to the animation atlas: all frames share a stable character/foot anchor.
The incomplete eighth FIREBALL at the right edge is intentionally omitted.
"""
from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/characters/actions'
source = Image.open(OUT / 'source/soyo-magic-original.png').convert('RGBA')
assert source.size == (1536, 1024), 'Re-measure frame crops for a different source size'

# Soft chroma key with green-spill removal. Orange flames and dark outlines are
# retained; only pixels where green exceeds both other channels are keyed.
pixels = []
for r, g, b, a in source.get_flattened_data():
    excess = g - max(r, b)
    if excess > 24:
        a = round(a * max(0, 1 - (excess - 24) / 120))
        g = min(g, max(r, b) + 12)
    pixels.append((r, g, b, a) if a else (0, 0, 0, 0))
keyed = Image.new('RGBA', source.size)
keyed.putdata(pixels)

CW, CH, AX, AY, BODY_H = 320, 208, 86, 180, 136
atlas = Image.new('RGBA', (CW * 8, CH * 5))
centers = [252, 432, 612, 792, 972, 1152, 1326, 1490]
rows = [
    ('fireball', 0, 7, (34, 210), 190),
    ('flame', 1, 7, (244, 418), 404),
    ('jump', 2, 8, (435, 615), 599),
    ('hurt', 3, 7, (630, 798), 781),
    ('down', 4, 6, (826, 985), 969),
]
frames = {}
for name, row, count, (top, bottom), baseline in rows:
    for col in range(count):
        cx = centers[col]
        left = cx - 65
        right = min(1536, cx + 101)
        if name == 'fireball' and col == 6:
            right = 1410
        if name == 'flame':
            right = [317, 497, 718, 918, 1108, 1269, 1536][col]
            if col == 4:
                left = 922
            if col == 5:
                left = 1106
            if col == 6:
                left = 1277
        if name == 'down' and col >= 3:
            left, right = cx - 82, cx + 85
        if name == 'jump' and col == 7:
            right = 1536
        crop = keyed.crop((left, top, right, bottom))
        cell = Image.new('RGBA', (CW, CH))
        # Put collapsed bodies back on the same floor; preserve the jump arc.
        floor = baseline
        if name == 'down' and col >= 3:
            floor = [959, 953, 956][col - 3]
        if name == 'flame' and col == 6:
            # In the original, frame 5's flame covers frame 6's left hair.
            # Reuse the clean outstretched pose and attach the final large jet.
            actor = keyed.crop((1106, top, 1208, bottom))
            cell.alpha_composite(actor, (AX + 1106 - centers[5], AY + top - floor))
            jet = keyed.crop((1360, top, 1536, bottom))
            cell.alpha_composite(jet, (AX + 1360 - cx, AY + top - floor))
        else:
            cell.alpha_composite(crop, (AX + left - cx, AY + top - floor))
        atlas.alpha_composite(cell, (col * CW, row * CH))
    frames[name] = {'row': row, 'count': count}
atlas.save(OUT / 'soyo-actions.png')
metadata = {'cellWidth': CW, 'cellHeight': CH, 'anchorX': AX, 'anchorY': AY,
            'bodyHeight': BODY_H, 'frames': frames}
(OUT / 'soyo-actions.json').write_text(json.dumps(metadata, indent=2) + '\n', 'utf-8')

# Keep the original portrait so the five party members share one portrait style.
# This script only replaces combat action assets, not interface portraits.
down = atlas.crop((5 * CW, 4 * CH, 6 * CW, 5 * CH))
down = down.crop(down.getbbox())
down.save(ROOT / 'assets/characters/sprites/soyo-down.png')
projectile = keyed.crop((1392, 252, 1530, 391))
projectile = projectile.crop(projectile.getbbox())
projectile.save(OUT / 'soyo-fireball.png')

# Contact sheet on a non-green background for visual review of every frame.
sheet = Image.new('RGB', (1504, 840), '#182431')
draw = ImageDraw.Draw(sheet)
font = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 16)
for name, row, count, _, _ in rows:
    draw.text((12, row * 168 + 6), name.upper(), fill='#e5d6b0', font=font)
    for col in range(count):
        frame = atlas.crop((col * CW, row * CH, (col + 1) * CW, (row + 1) * CH))
        frame.thumbnail((174, 142), Image.Resampling.NEAREST)
        sheet.paste(frame, (84 + col * 176, row * 168 + 20), frame)
sheet.save(ROOT / 'docs/previews/soyo-actions.jpg', quality=95)
animation = []
for frame in [0, 0, 1, 2, 3, 4, 5, 6, 6, 6, 3, 1, 0, 0]:
    image = Image.new('RGB', (640, 246), '#182431')
    label = ImageDraw.Draw(image)
    for row, title in [(0, 'SOYO / FIREBALL'), (1, 'SOYO / CRITICAL FLAME')]:
        label.text((row * 320 + 18, 12), title, font=font, fill='#e5d6b0')
        cell = atlas.crop((frame * CW, row * CH, (frame + 1) * CW, (row + 1) * CH))
        image.paste(cell, (row * 320 + 12, 35), cell)
    animation.append(image)
animation[0].save(ROOT / 'docs/previews/soyo-casting.gif', save_all=True,
                  append_images=animation[1:], duration=110, loop=0, disposal=2)
print('Prepared Soyo: 35 transparent action frames, down pose and contact sheet; original portrait preserved.')
