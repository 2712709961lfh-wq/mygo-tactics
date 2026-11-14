"""Extract the updated user-supplied mask sheet; keep scale and foot anchors fixed."""
from pathlib import Path
from collections import deque
import argparse
import hashlib
import json
import shutil
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/chapter-six'
SOURCE = OUT / 'source/mask-actions-2026-11-14-original.jpg'
# Row crops exclude the printed labels. Every pose uses one scale, including crouches.
ROWS = [
    ('idle', 85, 260, [136,247,365,486,607,736,872,1008], [174,292,410,531,653,780,918], 254),
    ('walk', 310, 472, [136,247,367,487,608,737,875,1008], [174,291,407,529,650,779,917], 466),
    ('attack', 500, 668, [136,246,358,481,607,809,1008], [176,289,404,521,647,849], 661),
    ('hurt', 697, 851, [136,248,363,456], [177,293,408], 845),
    ('down', 890, 1033, [136,242,367,511,682], [177,292,416,550], 1027),
]
CW, CH, AX, AY, BODY = 256, 160, 64, 143, 108

def key_green(image):
    image = image.convert('RGBA')
    values = []
    for r,g,b,_ in image.getdata():
        alpha = round(255 * max(0, min(1, (28 - (g-max(r,b))) / 18)))
        if alpha < 12:
            values.append((0,0,0,0))
        else:
            values.append((r,min(g,max(r,b)+2) if alpha < 255 else g,b,alpha))
    image.putdata(values)
    return image

def remove_specks(image):
    alpha = image.getchannel('A')
    points = {(x,y) for y in range(image.height) for x in range(image.width) if alpha.getpixel((x,y))}
    while points:
        first = points.pop()
        queue = deque([first])
        group = [first]
        while queue:
            x,y = queue.popleft()
            for p in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]:
                if p in points:
                    points.remove(p)
                    queue.append(p)
                    group.append(p)
        if len(group) < 7:
            for p in group:
                image.putpixel(p,(0,0,0,0))
    return image

def prepare(source=None):
    if source is not None:
        source = Path(source)
        if source.resolve() != SOURCE.resolve():
            if SOURCE.exists() and SOURCE.read_bytes() != source.read_bytes():
                raise ValueError('Dated source already exists with different contents')
            shutil.copyfile(source,SOURCE)
    original = Image.open(SOURCE)
    if original.size != (1008,1054):
        raise ValueError('Expected the supplied 1008 x 1054 action sheet')
    keyed = key_green(original)
    atlas = Image.new('RGBA',(CW*7,CH*5))
    frames = {}
    scale = BODY/146
    for row,(name,top,bottom,bounds,anchors,floor) in enumerate(ROWS):
        for col,anchor in enumerate(anchors):
            left,right = bounds[col:col+2]
            crop = remove_specks(keyed.crop((left,top,right,bottom)))
            crop = crop.resize((round(crop.width*scale),round(crop.height*scale)),Image.Resampling.LANCZOS)
            dx,dy = AX+round((left-anchor)*scale),AY+round((top-floor)*scale)
            assert 0 <= dx and 0 <= dy and dx+crop.width <= CW and dy+crop.height <= CH
            atlas.alpha_composite(crop,(col*CW+dx,row*CH+dy))
        frames[name] = {'row':row,'count':len(anchors)}
    atlas.save(OUT/'mask-actions.png',optimize=True)
    metadata = {'cellWidth':CW,'cellHeight':CH,'anchorX':AX,'anchorY':AY,'bodyHeight':BODY,
                'sourceFacing':'right','source':str(SOURCE.relative_to(ROOT)).replace('\\','/'),
                'sourceSha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'frames':frames}
    (OUT/'mask-actions.json').write_text(json.dumps(metadata,indent=2)+'\n',encoding='utf-8')
    preview = Image.new('RGB',(CW*7,CH*5),'#192537')
    preview.paste(atlas,(0,0),atlas)
    draw = ImageDraw.Draw(preview)
    for row,(name,*_) in enumerate(ROWS):
        draw.text((4,row*CH+3),f'{name} ({frames[name]["count"]})',fill='#f0d9b6')
    preview.save(ROOT/'docs/previews/mask-actions.png')
    print('Prepared 27 mask frames: idle 7, walk 7, attack 6, hurt 3, down 4.')
    return atlas

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source',type=Path)
    prepare(parser.parse_args().source)
