"""Prepare the author's second Tomori sheet; preserve portraits and map art.

Requires Pillow. Keep both original sources unchanged.
"""
from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/characters/actions'
source = Image.open(OUT/'source/tomori-sword-v2-original.jpg').convert('RGB')
assert source.size == (891, 1200), 'Re-measure crops for a different source size'
pixels = []
for r, g, b in source.get_flattened_data():
    # Screen excess ~123; gray clothes, olive skirt and green hilt stay opaque.
    alpha = max(0., min(1., (115-(g-max(r, b)))/70))
    if alpha < .04:
        pixels.append((0, 0, 0, 0))
        continue
    if alpha < 1:
        r, g, b = [round(max(0, min(255, (c-(1-alpha)*bg)/alpha)))
                   for c, bg in zip((r, g, b), (10, 166, 43))]
    pixels.append((r, g, b, round(alpha*255)))
keyed = Image.new('RGBA', source.size)
keyed.putdata(pixels)
edge = keyed.getchannel('A').filter(ImageFilter.MinFilter(5))
keyed.putdata([(r, min(g, max(r, b)+3), b, a) if e < 250 and g > max(r, b)+6
              else (r, g, b, a) for (r, g, b, a), e in zip(pixels, edge.get_flattened_data())])

CW, CH, AX, AY, BODY = 192, 144, 72, 124, 76
front = [160, 256, 352, 448, 544, 640]
side = [164, 260, 356, 452, 548, 644, 740, 836]
rows = [
    ('idle', 0, 128, [(p, (p-29, 46, p+31, 134)) for p in front]),
    ('idle2', 1, 245, [(p, (p-29, 163, p+31, 251)) for p in front]),
    ('walk', 2, 356, [(p, (p-32, 270, p+28, 362)) for p in side]),
    ('run', 3, 463, [(p, (p-41, 375, p+37, 469)) for p in side]),
    ('rush', 4, 569, [(160, (123, 484, 190, 575)), (256, (218, 484, 286, 575)),
                    (352, (310, 484, 386, 575)), (452, (415, 484, 490, 575)),
                    (548, (522, 484, 586, 575)), (644, (618, 484, 706, 575)),
                    (740, (712, 484, 784, 575)), (840, (809, 484, 878, 575))]),
    ('jump', 5, 732, [(p, (p-39, 639, p+39, 738)) for p in side]),
    ('attack', 6, 848, [(160, (130, 761, 194, 853)), (256, (221, 761, 288, 853)),
                      (356, (322, 761, 430, 853)), (452, (419, 760, 526, 853))]),
    ('attack2', 7, 959, [(164, (131, 850, 198, 965)), (260, (228, 850, 333, 965)),
                       (360, (328, 879, 390, 965))]),
    ('hurt', 8, 1065, [(p, (p-35, 980, p+31, 1071)) for p in [164, 260, 356]]),
    ('down', 9, 1174, [(164, (134, 1087, 195, 1180)), (260, (224, 1105, 294, 1180)),
                      (356, (312, 1128, 402, 1180)), (452, (408, 1128, 509, 1180))]),
]
atlas = Image.new('RGBA', (CW*8, CH*10))
frames = {}
for name, row, floor, crops in rows:
    for col, (pivot, box) in enumerate(crops):
        crop = keyed.crop(box)
        # The first slash's tip and the following pose's scabbard overlap
        # the rectangular crops. Remove only these measured neighbor fragments.
        cuts = []
        if name == 'attack' and col == 2:
            cuts = [(416, 818, 430, 853)]
        elif name == 'attack' and col == 3:
            cuts = [(419, 760, 431, 813)]
        elif name == 'attack2' and col == 1:
            cuts = [(315, 936, 333, 965)]
        elif name == 'attack2' and col == 2:
            cuts = [(328, 879, 340, 924)]
        for left, top, right, bottom in cuts:
            ImageDraw.Draw(crop).rectangle((left-box[0], top-box[1], right-box[0], bottom-box[1]), fill=(0, 0, 0, 0))
        cell = Image.new('RGBA', (CW, CH))
        cell.alpha_composite(crop, (AX+box[0]-pivot, AY+box[1]-floor))
        bbox = cell.getbbox()
        assert bbox and 0 < bbox[0] < bbox[2] < CW and 0 < bbox[1] < bbox[3] < CH, (name, col, bbox)
        atlas.alpha_composite(cell, (col*CW, row*CH))
    frames[name] = {'row': row, 'count': len(crops)}
atlas.save(OUT/'tomori-actions.png', optimize=True)
meta = {'cellWidth': CW, 'cellHeight': CH, 'anchorX': AX, 'anchorY': AY,
        'bodyHeight': BODY, 'frames': frames, 'sourceFacing': 'right',
        'source': 'source/tomori-sword-v2-original.jpg'}
(OUT/'tomori-actions.json').write_text(json.dumps(meta, indent=2)+'\n', 'utf-8')
down = atlas.crop((3*CW, 9*CH, 4*CW, 10*CH))
down.crop(down.getbbox()).save(ROOT/'assets/characters/sprites/tomori-down.png')

PREVIEW = ROOT/'docs/previews'
font = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 14)
for theme, bg, ink in [('dark', '#182431', '#ead9ba'), ('light', '#e9e2d2', '#263446')]:
    sheet = Image.new('RGB', (CW*8, CH*10+26), bg)
    draw = ImageDraw.Draw(sheet)
    for name, row, floor, crops in rows:
        draw.text((5, row*CH+2), name.upper(), font=font, fill=ink)
        for col in range(len(crops)):
            cell = atlas.crop((col*CW, row*CH, (col+1)*CW, (row+1)*CH))
            sheet.paste(cell, (col*CW, row*CH+22), cell)
    sheet.save(PREVIEW/f'tomori-actions-{theme}.png')
animations = []
for tick in range(64):
    image = Image.new('RGB', (CW*5, (CH+32)*2), '#182431')
    draw = ImageDraw.Draw(image)
    for i, (name, row, floor, crops) in enumerate(rows):
        count = len(crops)
        frame = tick % count if name in ('idle', 'idle2', 'walk', 'run') else min(count-1, max(0, tick%32-3)//3)
        cell = atlas.crop((frame*CW, row*CH, (frame+1)*CW, (row+1)*CH))
        x, y = (i%5)*CW, (i//5)*(CH+32)
        image.paste(cell, (x, y+28), cell)
        draw.text((x+8, y+7), f'{name.upper()} / {frame+1}', font=font, fill='#ead9ba')
    animations.append(image)
animations[0].save(PREVIEW/'tomori-actions.gif', save_all=True, append_images=animations[1:],
                   duration=85, loop=0, disposal=2)
print('Prepared Tomori v2: 58 transparent frames; original portraits and directional map art preserved.')
