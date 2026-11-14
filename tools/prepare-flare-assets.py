"""Adapt the selected Flare / Old Ruins art to the existing orthogonal board.

Raster derivatives are CC BY-SA 3.0. Original files and detailed attribution
are retained in assets/terrain/flare. No screenshots or Nintendo art are used.
"""
from pathlib import Path
import json
from PIL import Image, ImageEnhance, ImageOps

ROOT = Path(__file__).resolve().parents[1]
FOLDER = ROOT / 'assets/terrain/flare'
SOURCE = FOLDER / 'grassland-source/grassland'
RUINS = FOLDER / 'old-ruins/origin_render_output'
SLOT = 256
atlas = Image.new('RGBA', (SLOT * 8, SLOT * 5))
names = []

def grade(im, brightness=1.0):
    im = im.convert('RGBA')
    rgb = ImageEnhance.Color(im.convert('RGB')).enhance(.78)
    rgb = ImageEnhance.Brightness(rgb).enhance(brightness)
    rgb = Image.blend(rgb, Image.new('RGB', rgb.size, '#607078'), .045)
    rgb.putalpha(im.getchannel('A'))
    return rgb

def add(name, im, sprite=False, brightness=1):
    index = len(names)
    names.append(name)
    im = grade(im, brightness)
    if sprite:
        # Ignore near-transparent render margins when finding the object.
        bounds = im.getchannel('A').point(lambda a: 255 if a > 24 else 0).getbbox()
        if bounds:
            im = im.crop(bounds)
        im = ImageOps.contain(im, (240, 240), Image.Resampling.LANCZOS)
        atlas.alpha_composite(im, (index % 8 * SLOT + (SLOT-im.width)//2,
                                   index // 8 * SLOT + SLOT-im.height))
    else:
        im = im.resize((SLOT, SLOT), Image.Resampling.LANCZOS)
        atlas.alpha_composite(im, (index % 8 * SLOT, index // 8 * SLOT))

def raw(name):
    return Image.open(SOURCE / name).convert('RGBA')

def ruin(kind, number):
    return Image.open(RUINS / ('floor' if kind == 'floor' else 'basic') /
                      f'ruin_{kind}_{number:04}.png').convert('RGBA')

sheet = Image.open(FOLDER/'grassland_tiles.png').convert('RGBA')

def flat_floor(number):
    # Rendered ground diamond occupies the bottom 128x64 of the source.
    im = ruin('floor', number)
    alpha = im.getchannel('A')
    bounds = alpha.point(lambda a: 255 if a > 180 else 0).getbbox()
    x0,y0,x1,y1 = bounds
    cx=(x0+x1)/2; cy=(y0+y1)/2
    return im.transform((256,256), Image.Transform.QUAD,
                        (cx,y0+1,x0+1,cy,cx,y1-1,x1-1,cy),
                        Image.Resampling.BICUBIC)

add('grass', raw('grass_overcast.png'), brightness=.96)
add('cobbled-road', raw('path.png'), brightness=1.08)
add('ruin-floor', flat_floor(1), brightness=1.27)
add('wall-cap', flat_floor(4), brightness=1.3)
face=ruin('basic',1).transform((256,256),Image.Transform.QUAD,
    (70,136,70,238,115,214,115,113),Image.Resampling.BICUBIC)
add('masonry',face,brightness=1.3)
add('rock',raw('rock_diffuse.png'),brightness=.86)
add('water',raw('water.png'),brightness=.66)
# Flatten the wooden bridge deck from the original sheet.
add('bridge-deck',sheet.transform((256,256),Image.Transform.QUAD,
    (288,641,257,656,288,672,319,656),Image.Resampling.BICUBIC),brightness=1.18)
add('rough-path',raw('path2.png'),brightness=1.06)
add('iron',raw('metal_contrast.png'),brightness=.72)
add('bark',raw('bark.png'),brightness=.9)
add('ruin-floor-broken',flat_floor(5),brightness=1.25)
add('stone',raw('brick.png'),brightness=.9)
add('water-rock',raw('rock_diffuse_wet.png'),brightness=.92)
add('ruin-floor-ornament',flat_floor(20),brightness=1.28)
add('crate-texture',raw('crate.png'))
for i in range(4):
    add(f'pine-{i}',sheet.crop((i*128,1152,i*128+128,1344)),sprite=True,brightness=1.13)
for i in range(2):
    add(f'leaf-tree-{i}',sheet.crop((i*128,984,i*128+128,1098)),sprite=True,brightness=1.08)
add('dead-tree',sheet.crop((640,960,768,1160)),sprite=True,brightness=1.2)
add('rock-pile',sheet.crop((128,384,192,470)),sprite=True,brightness=1.12)
add('pillar',ruin('extra',15),sprite=True,brightness=1.3)
add('statue',ruin('extra',74),sprite=True,brightness=1.4)
add('rubble',ruin('extra',20),sprite=True,brightness=1.3)
add('campfire',sheet.crop((384,256,448,320)),sprite=True,brightness=1.18)
add('supplies',sheet.crop((128,256,192,320)),sprite=True,brightness=1.12)
add('grass-tuft',sheet.crop((768,320,832,384)),sprite=True,brightness=1.1)
add('rubble-small',ruin('extra',25),sprite=True,brightness=1.35)
add('stone-cross',sheet.crop((896,384,960,470)),sprite=True,brightness=1.18)
for i in [7,8,6,3]:
    add(f'floor-variation-{i}',flat_floor(i),brightness=1.22)
atlas.save(FOLDER/'battlefield-atlas.png',optimize=True)
(FOLDER/'battlefield-atlas.json').write_text(json.dumps(dict(enumerate(names)),indent=2),encoding='utf8')
print('Prepared battlefield-atlas.png:',atlas.size, len(names),'slots')
