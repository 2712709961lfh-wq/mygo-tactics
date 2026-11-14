"""Tint CC0 Kenney particle textures into an authored three-slot overlay atlas."""
from pathlib import Path
from PIL import Image, ImageOps, ImageChops, ImageDraw
root=Path(__file__).resolve().parents[1]/'assets/effects/dark-soyo'
atlas=Image.new('RGBA',(768,256))
for i,(name,color) in enumerate([('smoke_04.png',(107,45,164)),('magic_03.png',(235,62,133)),('scratch_01.png',(255,93,157))]):
    original=Image.open(root/'source/PNG'/name).convert('RGBA').resize((256,256))
    tinted=Image.new('RGBA',original.size,color+(255,))
    # These source textures have opaque black backgrounds and are intended for
    # additive blending. Convert luminance to alpha before using normal overlays.
    alpha=ImageChops.multiply(ImageOps.grayscale(original),original.getchannel('A'))
    if i==1:
        d=ImageDraw.Draw(alpha)
        d.pieslice((12,12,244,244),30,42,fill=0)
        d.pieslice((12,12,244,244),197,213,fill=0)
    tinted.putalpha(alpha)
    atlas.paste(tinted,(i*256,0))
atlas.save(root/'corruption-atlas.png')
print('Saved corruption-atlas.png (smoke / magic / scratch)')
