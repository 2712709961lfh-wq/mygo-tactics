"""Derive the diary skin from CC0 source art. Run with Pillow installed.
See assets/ui/SOURCES.md for authors, URLs and the source-to-output mapping.
"""
from pathlib import Path
from PIL import Image, ImageOps, ImageEnhance, ImageFilter, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/ui/diary'
OUT.mkdir(parents=True, exist_ok=True)

paper = Image.open(ROOT / 'assets/ui/paper/source/parchment.jpg').convert('RGB')
paper = ImageOps.fit(paper, (1024, 768))
paper = Image.blend(paper, ImageOps.colorize(ImageOps.grayscale(paper), '#a18b70', '#f2e8ce'), .55)
paper.save(OUT / 'paper.jpg', quality=91)

original = Image.open(ROOT / 'assets/ui/yd/source/quest-clean.png').convert('RGBA')
leather = Image.open(ROOT / 'assets/ui/yd/source/leather-clean.png').convert('RGBA')

def tinted(image, low, high):
    image = image.convert('RGBA')
    result = ImageOps.colorize(ImageOps.grayscale(image), low, high).convert('RGBA')
    result.putalpha(image.getchannel('A'))
    return result

# The original outside frame and inner curled border are retained. Only the
# empty center is transparent so the photographic paper remains visible.
frame = tinted(original, '#483b30', '#e4d7b7')
ImageDraw.Draw(frame).rectangle((91, 91, 616, 788), fill=(0, 0, 0, 0))
frame.save(OUT / 'frame-paper.png')
ink_frame = tinted(leather, '#111d26', '#c5a979')
ImageDraw.Draw(ink_frame).rectangle((45, 44, 648, 832), fill=(0, 0, 0, 0))
ink_frame.save(OUT / 'frame-ink.png')

# Extract the grain from yd's original presentation, then color it as midnight
# leather. Mirroring four quadrants avoids a visible seam at tile boundaries.
grain = Image.open(ROOT / 'assets/ui/yd/source/gui2-preview.png').convert('RGB').crop((1400, 100, 1656, 356))
grain = ImageOps.autocontrast(ImageOps.grayscale(grain)).convert('RGB')
grain = tinted(grain, '#121e28', '#344650').convert('RGB')
tile = Image.new('RGB', (512, 512))
tile.paste(grain, (0, 0)); tile.paste(ImageOps.mirror(grain), (256, 0))
tile.paste(ImageOps.flip(grain), (0, 256)); tile.paste(ImageOps.flip(ImageOps.mirror(grain)), (256, 256))
tile.save(OUT / 'leather.jpg', quality=92)

# Gold scrolling divider, extracted from the original top ornamental band.
band = original.crop((81, 60, 617, 84))
gray = ImageOps.grayscale(band)
alpha = gray.point(lambda p: max(0, min(255, (185-p)*3)))
ornament = Image.new('RGBA', band.size, '#c5aa79'); ornament.putalpha(alpha)
ornament.save(OUT / 'flourish.png')
dark_ornament = Image.new('RGBA', band.size, '#77644c'); dark_ornament.putalpha(alpha)
dark_ornament.save(OUT / 'flourish-ink.png')

# Small stitched brass frames for portraits and clickable controls.
square = Image.new('RGBA', (200, 200))
for box, dest in [((0,0,100,100),(0,0)), ((595,0,695,100),(100,0)),
                  ((0,780,100,880),(0,100)), ((595,780,695,880),(100,100))]:
    square.alpha_composite(ink_frame.crop(box), dest)
square.save(OUT / 'portrait-frame.png')

# Title illustration uses the project's existing character art, not downloaded
# characters. The worn paper mount is the licensed photographic texture.
scene = Image.new('RGBA', (660, 620))
mount = ImageOps.fit(paper, (430, 505)).convert('RGBA')
mask = Image.new('L', mount.size, 0)
ImageDraw.Draw(mask).rounded_rectangle((0, 0, 429, 504), radius=4, fill=255)
mount.putalpha(mask)
scene.alpha_composite(mount.rotate(-4, expand=True, resample=Image.Resampling.BICUBIC), (92, 34))
mount2 = ImageOps.fit(paper, (430, 505)).convert('RGBA')
mount2.putalpha(mask)
scene.alpha_composite(mount2.rotate(3, expand=True, resample=Image.Resampling.BICUBIC), (106, 44))
order = [('soyo', 63, 139, 203), ('taki', 416, 127, 207),
         ('anon', 151, 187, 224), ('rana', 332, 189, 222), ('tomori', 245, 214, 242)]
for uid, x, y, height in order:
    char = Image.open(ROOT / f'assets/characters/sprites/{uid}-portrait.png').convert('RGBA')
    char = char.resize((round(char.width * height / char.height), height), Image.Resampling.NEAREST)
    shadow = Image.new('RGBA', scene.size)
    silhouette = Image.new('RGBA', char.size, '#1c162a')
    silhouette.putalpha(char.getchannel('A').point(lambda p: round(p*.5)))
    shadow.alpha_composite(silhouette, (x+4, y+8)); shadow = shadow.filter(ImageFilter.GaussianBlur(7))
    scene.alpha_composite(shadow); scene.alpha_composite(char, (x, y))
decor = dark_ornament.resize((350, 17), Image.Resampling.LANCZOS)
scene.alpha_composite(decor, (165, 475))
scene.alpha_composite(ImageOps.flip(decor), (139, 92))
scene.save(OUT / 'title-companions.png')

# A real asset contact sheet is useful for auditing the chosen materials.
sheet = Image.new('RGB', (1200, 690), '#14212a')
draw = ImageDraw.Draw(sheet)
font = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 17)
draw.text((32, 20), 'ECHOES OF THE LOST / CC0 TEXTURE & UI MATERIALS', font=font, fill='#e7d5b3')
for name, box, label in [('paper.jpg',(32,70,295,250),'Photographic parchment'),
                          ('leather.jpg',(32,300,295,480),'Midnight leather grain'),
                          ('frame-paper.png',(335,70,595,535),'Curled parchment / stitched frame'),
                          ('title-companions.png',(645,70,1170,565),'Existing cast / diary composition')]:
    img = Image.open(OUT/name).convert('RGBA')
    img.thumbnail((box[2]-box[0],box[3]-box[1]), Image.Resampling.LANCZOS)
    sheet.paste(img, box[:2], img)
    draw.text((box[0],box[3]+12),label,font=font,fill='#d5c6a7')
sheet.save(ROOT/'docs/previews/ui-materials.jpg',quality=93)
print('Prepared 8 diary UI images and the material contact sheet.')
