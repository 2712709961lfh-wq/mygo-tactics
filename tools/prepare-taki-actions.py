"""Extract the author's Taki axe sheet without modifying portraits or map art."""
from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/characters/actions'
source = Image.open(OUT / 'source/taki-axe-original.jpg').convert('RGB')
assert source.size == (896, 1176), 'Re-measure crops for a different source size'
pixels = []
for r, g, b in source.get_flattened_data():
    # Screen excess is about 130; the dark axe and olive skirt stay opaque.
    alpha = max(0., min(1., (123 - (g - max(r, b))) / 68))
    if alpha < .05:
        pixels.append((0, 0, 0, 0))
        continue
    if alpha < 1:
        r, g, b = [round(max(0, min(255, (c - (1-alpha)*bg) / alpha)))
                   for c, bg in zip((r, g, b), (57, 190, 53))]
    pixels.append((r, g, b, round(alpha*255)))
keyed = Image.new('RGBA', source.size)
keyed.putdata(pixels)
edge = keyed.getchannel('A').filter(ImageFilter.MinFilter(5))
keyed.putdata([(r, min(g, max(r, b)), b, a) if e < 250 and g > max(r, b)+3
              else (r, g, b, a) for (r, g, b, a), e in zip(pixels, edge.get_flattened_data())])

CW, CH, AX, AY, BODY = 160, 128, 64, 112, 70
centers = [164, 260, 356, 452, 548, 644, 740, 836]
rows = [
    ('idle', 0, 102, [(p, (p-34, 27, p+29, 107)) for p in centers[:6]]),
    ('idle2', 1, 215, [(p, (p-29, 140, p+28, 220)) for p in centers[:6]]),
    ('walk', 2, 322, [(p, (p-29, 251, p+30, 327)) for p in centers]),
    ('run', 3, 430, [(p, (p-35, 356, p+40, 435)) for p in centers]),
    ('jump', 4, 536, [(p, (p-34, 452, p+42, 541)) for p in centers]),
    ('attack', 5, 700, [(164, (121, 628, 194, 705)), (260, (216, 628, 289, 705)),
                       (356, (320, 628, 388, 705)), (452, (430, 623, 521, 705)),
                       (548, (526, 622, 594, 705)), (644, (601, 628, 674, 705))]),
    ('attack2', 6, 815, [(164, (120, 747, 194, 821)), (260, (216, 747, 290, 821)),
                        (356, (309, 747, 389, 821)), (452, (414, 744, 482, 821)),
                        (548, (511, 729, 578, 821)), (652, (624, 735, 710, 821)),
                        (748, (720, 752, 798, 821))]),
    ('special', 7, 926, [(164, (120, 857, 195, 932)), (260, (215, 857, 291, 932)),
                        (356, (320, 857, 387, 932)), (452, (425, 852, 503, 932)),
                        (548, (526, 850, 605, 932)), (644, (618, 848, 703, 932)),
                        (740, (692, 849, 779, 932)), (836, (795, 863, 869, 932))]),
    ('hurt', 8, 1034, [(p, (p-37, 963, p+29, 1040)) for p in [164, 252, 348, 444]]),
    ('down', 9, 1142, [(164, (129, 1067, 193, 1147)), (260, (230, 1078, 290, 1147)),
                      (356, (324, 1084, 389, 1147)), (456, (419, 1100, 504, 1149)),
                      (552, (515, 1105, 605, 1149))]),
]
atlas = Image.new('RGBA', (CW*8, CH*10))
frames = {}
for name, row, floor, crops in rows:
    for col, (pivot, box) in enumerate(crops):
        crop = keyed.crop(box)
        # Neighboring spin trails touch. Keep each painted axe intact and
        # exclude the other frame's arc/axe rather than copying fragments.
        if name == 'special' and col in (5, 6):
            mask = Image.new('L', crop.size, 255)
            draw = ImageDraw.Draw(mask)
            if col == 5:
                poly = [(685, 871), (695, 865), (703, 865), (703, 932), (685, 932)]
            else:
                poly = [(692, 849), (715, 849), (715, 864), (707, 869), (692, 869)]
            draw.polygon([(x-box[0], y-box[1]) for x, y in poly], fill=0)
            from PIL import ImageChops
            crop.putalpha(ImageChops.multiply(crop.getchannel('A'), mask))
        cell = Image.new('RGBA', (CW, CH))
        cell.alpha_composite(crop, (AX+box[0]-pivot, AY+box[1]-floor))
        bbox = cell.getbbox()
        assert bbox and 0 < bbox[0] < bbox[2] < CW and 0 < bbox[1] < bbox[3] < CH, (name, col, bbox)
        atlas.alpha_composite(cell, (col*CW, row*CH))
    frames[name] = {'row': row, 'count': len(crops)}
atlas.save(OUT/'taki-actions.png', optimize=True)
meta = {'cellWidth': CW, 'cellHeight': CH, 'anchorX': AX, 'anchorY': AY,
        'bodyHeight': BODY, 'frames': frames, 'sourceFacing': 'right',
        'source': 'source/taki-axe-original.jpg'}
(OUT/'taki-actions.json').write_text(json.dumps(meta, indent=2)+'\n', 'utf-8')
down = atlas.crop((4*CW, 9*CH, 5*CW, 10*CH))
down.crop(down.getbbox()).save(ROOT/'assets/characters/sprites/taki-down.png')

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
    sheet.save(PREVIEW/f'taki-actions-{theme}.png')
animations = []
for tick in range(64):
    image = Image.new('RGB', (CW*5, (CH+32)*2), '#182431')
    draw = ImageDraw.Draw(image)
    for i, (name, row, floor, crops) in enumerate(rows):
        n = len(crops)
        frame = tick % n if name in ('idle', 'idle2', 'walk', 'run') else min(n-1, max(0, tick%32-3)//3)
        cell = atlas.crop((frame*CW, row*CH, (frame+1)*CW, (row+1)*CH))
        x, y = (i%5)*CW, (i//5)*(CH+32)
        image.paste(cell, (x, y+28), cell)
        draw.text((x+8, y+7), f'{name.upper()} / {frame+1}', font=font, fill='#ead9ba')
    animations.append(image)
animations[0].save(PREVIEW/'taki-actions.gif', save_all=True, append_images=animations[1:],
                   duration=85, loop=0, disposal=2)
print('Prepared Taki: 66 transparent action frames; portraits and map art preserved.')
