"""Build chapter 2 raster derivatives; see assets/terrain/moon-dream/README.md."""
from pathlib import Path
import json
from PIL import Image, ImageOps, ImageEnhance

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'assets/terrain/moon-dream'
FLARE = ROOT / 'assets/terrain/flare'
SOURCE = FLARE / 'grassland-source/grassland'
RUINS = FLARE / 'old-ruins/origin_render_output'
atlas = Image.new('RGBA', (2048, 768))
names = []

def tint(im, low, high):
    im = im.convert('RGBA')
    result = ImageOps.colorize(ImageOps.grayscale(im), low, high)
    result.putalpha(im.getchannel('A'))
    return result

def add(name, im, sprite=False):
    i = len(names)
    names.append(name)
    im = im.convert('RGBA')
    if sprite:
        bbox = im.getchannel('A').point(lambda a: 255 if a > 24 else 0).getbbox()
        im = im.crop(bbox)
        im = ImageOps.contain(im, (246, 246), Image.Resampling.LANCZOS)
        xy = (i % 8 * 256 + (256-im.width)//2, i // 8 * 256 + 256-im.height)
    else:
        im = im.resize((256, 256), Image.Resampling.LANCZOS)
        if i in (0, 6):
            # Mirror the full texture at its borders to remove hard repeat seams.
            half = im.resize((128, 128), Image.Resampling.LANCZOS)
            im = Image.new('RGBA', (256, 256))
            im.paste(half, (0, 0)); im.paste(ImageOps.mirror(half), (128, 0))
            im.paste(ImageOps.flip(half), (0, 128))
            im.paste(ImageOps.flip(ImageOps.mirror(half)), (128, 128))
        xy = (i % 8 * 256, i // 8 * 256)
    atlas.alpha_composite(im, xy)

def raw(name):
    return Image.open(SOURCE / name)

def ruin(kind, n):
    return Image.open(RUINS / ('floor' if kind == 'floor' else 'basic') / f'ruin_{kind}_{n:04}.png').convert('RGBA')

def floor(n):
    im = ruin('floor', n)
    x0,y0,x1,y1 = im.getchannel('A').point(lambda a: 255 if a > 180 else 0).getbbox()
    cx,cy=(x0+x1)/2,(y0+y1)/2
    return im.transform((256,256), Image.Transform.QUAD, (cx,y0+1,x0+1,cy,cx,y1-1,x1-1,cy), Image.Resampling.BICUBIC)

add('sage-grass', tint(raw('grass_overcast.png'), '#294d58', '#a5c6ab'))
add('pearl-cobbles', tint(raw('path.png'), '#526a7d', '#e3e3d5'))
add('palace-floor', tint(floor(1), '#65768f', '#e5e0dd'))
add('carved-coping', tint(floor(4), '#66768e', '#f5eade'))
face=ruin('basic',1).transform((256,256),Image.Transform.QUAD,(70,136,70,238,115,214,115,113),Image.Resampling.BICUBIC)
add('ivory-masonry', tint(face, '#52657c', '#eee4e2'))
add('lavender-rock', tint(raw('rock_diffuse.png'), '#4f597b', '#bcc1d6'))
add('moon-water', tint(raw('water.png'), '#183b66', '#77bdc8'))
add('bridge-stone', tint(raw('brick.png'), '#6b7791', '#e4dddf'))
add('shore-rock', tint(raw('rock_diffuse_wet.png'), '#426e82', '#b0c9bc'))
add('inlaid-floor', tint(floor(20), '#6d6a96', '#e8dfd3'))
add('floor-variation', tint(floor(7), '#617c91', '#e6e2db'))
add('moon-pillar', tint(ruin('extra',15), '#657696', '#faf0e3'), True)
add('garden-statue', tint(ruin('extra',74), '#687a98', '#efe9e1'), True)
add('garden-rocks', tint(ruin('extra',20), '#6b799b', '#d4d3e2'), True)
trees=Image.open(DEST/'source/avalon-trees.psd').convert('RGBA')
for i,(lo,hi) in enumerate([('#674d83','#edc7e3'),('#466c89','#c6c9f0'),('#575f82','#d1dfe8')]):
    im=trees.crop((0 if i!=1 else 128,0,128 if i!=1 else 256,192))
    # Preserve the original warm trunk and branch texture below the canopy.
    painted=tint(im,lo,hi)
    mask=Image.new('L',im.size)
    mask.putdata([255 if y<126 else max(0,255-(y-126)*22) for y in range(192) for x in range(128)])
    result=Image.composite(painted,tint(im,'#3c394e','#aaa1ad'),mask)
    result.putalpha(im.getchannel('A'))
    add('blossom-tree-'+str(i),result,True)
objects=Image.open(DEST/'source/avalon-objects.png').convert('RGBA')
for i,box in enumerate([(352,32,368,64),(368,32,384,64),(384,32,416,64)]):
    add('avalon-flowers-'+str(i),objects.crop(box),True)
ground=Image.open(DEST/'source/avalon-ground.png').convert('RGBA')
add('garden-medallion',tint(ground.crop((120,312,168,360)),'#546d85','#ede0d6'))
atlas.save(DEST/'moon-atlas.png',optimize=True)
(DEST/'moon-atlas.json').write_text(json.dumps(dict(enumerate(names)),indent=2),encoding='utf8')
print('Prepared moon-atlas.png:',atlas.size,len(names),'slots')
