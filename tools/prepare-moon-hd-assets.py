"""Chapter 2: preserve native 512–1024px texture detail in a 512px-slot atlas.
Object art retains its actual source resolution; enlarging slots does not invent detail.
Attribution: assets/terrain/moon-dream/README.md.
"""
from pathlib import Path
import json
from PIL import Image, ImageOps, ImageEnhance, ImageFilter, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/'assets/terrain/moon-dream'
FLARE=ROOT/'assets/terrain/flare'
SOURCE=FLARE/'grassland-source/grassland'
RUINS=FLARE/'old-ruins/origin_render_output'
S=512
atlas=Image.new('RGBA',(S*8,S*4))
names=[]
def grade(im,low,high):
    im=im.convert('RGBA')
    lum=ImageOps.autocontrast(ImageOps.grayscale(im),cutoff=.3)
    rgb=ImageOps.colorize(lum,low,high).convert('RGBA')
    rgb.putalpha(im.getchannel('A'))
    return rgb
def add(name,im,sprite=False):
    i=len(names); names.append({'name':name,'sourceSize':list(im.size),'sprite':sprite})
    im=im.convert('RGBA')
    if sprite:
        im=im.crop(im.getchannel('A').point(lambda a:255 if a>24 else 0).getbbox())
        im=ImageOps.contain(im,(S-12,S-12),Image.Resampling.LANCZOS)
        xy=(i%8*S+(S-im.width)//2,i//8*S+S-im.height)
    else:
        im=im.resize((S,S),Image.Resampling.LANCZOS)
        xy=(i%8*S,i//8*S)
    im=im.filter(ImageFilter.UnsharpMask(radius=.7,percent=75,threshold=3))
    atlas.alpha_composite(im,xy)
def raw(name):return Image.open(SOURCE/name).convert('RGBA')
def extra(n):return Image.open(RUINS/'basic'/f'ruin_extra_{n:04}.png').convert('RGBA')

add('meadow-native512',grade(raw('grass_overcast.png'),'#244c46','#b6cf9a'))
add('garden-cobbles-native512',grade(raw('path.png'),'#41585d','#d6d7bb'))
stone=grade(raw('rock_diffuse.png'),'#65778d','#e9e2cf').resize((S,S))
floor=stone.copy();d=ImageDraw.Draw(floor)
for x in range(0,S,128):
    d.line([(x,0),(x,S)],fill='#6e7e8a',width=3)
    d.line([(x+4,0),(x+4,S)],fill='#e8e4d0',width=2)
for y in range(0,S,128):
    d.line([(0,y),(S,y)],fill='#6e7e8a',width=3)
    d.line([(0,y+4),(S,y+4)],fill='#ece4d2',width=2)
add('pearl-slab-native512',floor)
add('wall-coping-native512',grade(raw('rock_diffuse.png'),'#667184','#ede5ce'))
add('palace-masonry-native1024',grade(raw('brick.png'),'#3c5168','#e1dfd4'))
add('lavender-rock-native512',grade(raw('rock_diffuse.png'),'#455777','#d4d7db'))
add('moon-water-native512',grade(raw('water.png'),'#103952','#63bec5'))
add('bridge-masonry-native1024',grade(raw('brick.png'),'#667080','#ece3d1'))
add('shore-native512',grade(raw('rock_diffuse_wet.png'),'#304a5c','#a2bfc1'))
inlay=floor.copy();d=ImageDraw.Draw(inlay)
d.rectangle((12,12,500,500),outline='#bbab83',width=7)
d.ellipse((68,68,444,444),outline='#af9cbd',width=10)
d.ellipse((96,96,416,416),outline='#64799a',width=5)
for x,y in [(256,93),(419,256),(256,419),(93,256)]:d.ellipse((x-10,y-10,x+10,y+10),fill='#d2bc8e',outline='#8b7e97',width=3)
add('moon-inlay',inlay)
add('side-path-native512',grade(raw('path2.png'),'#425b5d','#bdc7ab'))
add('moon-pillar',grade(extra(15),'#425572','#f6e7c9'),True)
add('garden-statue',grade(extra(74),'#415471','#ede7d3'),True)
add('garden-rocks',grade(extra(20),'#4a607d','#c9cfce'),True)
trees=Image.open(DEST/'source/avalon-trees.psd').convert('RGBA')
for i,(low,high) in enumerate([('#614678','#e4a9d0'),('#3c567e','#bdcde9'),('#575287','#d9bfe6')]):
    im=trees.crop((128 if i==1 else 0,0,256 if i==1 else 128,192))
    canopy=grade(im,low,high);trunk=grade(im,'#2e3345','#ad9b9e')
    mask=Image.new('L',im.size);mask.putdata([255 if y<124 else max(0,255-(y-124)*32) for y in range(192) for x in range(128)])
    result=Image.composite(canopy,trunk,mask);result.putalpha(im.getchannel('A'))
    add('blossom-tree-'+str(i),result,True)
objects=Image.open(DEST/'source/avalon-objects.png').convert('RGBA')
for i,box in enumerate([(352,32,368,64),(368,32,384,64),(384,32,416,64)]):add('flowers-'+str(i),objects.crop(box),True)
add('moon-medallion',inlay)
add('iron-gate-native256',grade(raw('metal_contrast.png'),'#293848','#bfcad4'))
add('bark-native256',grade(raw('bark.png'),'#303447','#b4a7ac'))
atlas.save(DEST/'moon-hd-atlas.png',optimize=True)
(DEST/'moon-hd-atlas.json').write_text(json.dumps({'slotSize':S,'items':names},indent=2),encoding='utf8')
print('Prepared moon-hd-atlas.png:',atlas.size,len(names),'slots')
