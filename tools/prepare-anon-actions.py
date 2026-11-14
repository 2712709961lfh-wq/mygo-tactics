"""Prepare the author's Anon bow sheet (Pillow). Preserve the original JPEG.

Create a transparent, foot-aligned atlas and extract the separate painted arrow.
Do not modify portraits or four-direction map sprites.
"""
from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/characters/actions'
source=Image.open(OUT/'source/anon-bow-original.jpg').convert('RGB')
assert source.size==(1248,862),'Re-measure crops for a different source size'
pixels=[]
for r,g,b in source.get_flattened_data():
    # The screen has green excess ~83, while the olive skirt is below 28.
    alpha=max(0.,min(1.,(78-(g-max(r,b)))/50))
    if alpha<.04:
        pixels.append((0,0,0,0))
        continue
    if alpha<1:
        r,g,b=[round(max(0,min(255,(c-(1-alpha)*bg)/alpha)))
               for c,bg in zip((r,g,b),(65,159,76))]
        g=min(g,max(r,b)+8)
    pixels.append((r,g,b,round(alpha*255)))
keyed=Image.new('RGBA',source.size)
keyed.putdata(pixels)
edge=keyed.getchannel('A').filter(ImageFilter.MinFilter(5))
keyed.putdata([(r,min(g,max(r,b)+5),b,a) if e<240 and g>max(r,b)+8
              else (r,g,b,a) for (r,g,b,a),e in zip(pixels,edge.get_flattened_data())])

CW,CH,AX,AY,BODY=224,144,88,124,110
rows=[
    ('idle',0,182,[(p,(p-54,70,p+54,189)) for p in [225,361,497,633,769,905]]),
    ('walk',1,345,[(p,(p-46,226,p+46,353)) for p in [220,356,492,628,764,900,1036,1172]]),
    ('attack',2,500,[(226,(180,379,281,508)),(363,(318,379,419,508)),
                    (501,(455,379,571,508)),(635,(589,379,721,508)),
                    (770,(724,379,857,508)),(906,(860,379,984,508)),
                    (1040,(994,379,1092,508))]),
    ('hurt',3,649,[(p,(p-56,539,p+56,658)) for p in [225,359,495]]),
    ('down',4,800,[(222,(166,691,261,809)),(372,(310,691,415,809)),
                  (525,(447,691,564,809)),(675,(617,691,726,809)),
                  (795,(734,691,854,809))]),
]
atlas=Image.new('RGBA',(CW*8,CH*5))
frames={}
for name,row,floor,crops in rows:
    for col,(pivot,box) in enumerate(crops):
        cell=Image.new('RGBA',(CW,CH))
        crop=keyed.crop(box)
        if name=='attack' and 2<=col<=5:
            # Remove arrow portions outside the bow, so the standalone arrow
            # can travel once without a second floating arrow on the character.
            bow_right=[549,679,818,953][col-2]
            ImageDraw.Draw(crop).rectangle((bow_right-box[0],0,crop.width,crop.height),fill=(0,0,0,0))
        cell.alpha_composite(crop,(AX+box[0]-pivot,AY+box[1]-floor))
        atlas.alpha_composite(cell,(col*CW,row*CH))
    frames[name]={'row':row,'count':len(crops)}
atlas.save(OUT/'anon-actions.png',optimize=True)
meta={'cellWidth':CW,'cellHeight':CH,'anchorX':AX,'anchorY':AY,'bodyHeight':BODY,
      'frames':frames,'sourceFacing':'right','source':'source/anon-bow-original.jpg',
      'projectile':'anon-arrow.png'}
(OUT/'anon-actions.json').write_text(json.dumps(meta,indent=2)+'\n','utf-8')
arrow=keyed.crop((1140,414,1211,438))
arrow=arrow.crop(arrow.getbbox())
arrow.save(OUT/'anon-arrow.png')
down=atlas.crop((4*CW,4*CH,5*CW,5*CH))
down.crop(down.getbbox()).save(ROOT/'assets/characters/sprites/anon-down.png')

PREVIEW=ROOT/'docs/previews'
font=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',15)
for theme,bg,ink in [('dark','#182431','#ead9ba'),('light','#e9e2d2','#263446')]:
    sheet=Image.new('RGB',(CW*8,CH*5+35),bg)
    draw=ImageDraw.Draw(sheet)
    for name,row,floor,crops in rows:
        draw.text((8,row*CH+3),name.upper(),font=font,fill=ink)
        for col in range(len(crops)):
            cell=atlas.crop((col*CW,row*CH,(col+1)*CW,(row+1)*CH))
            sheet.paste(cell,(col*CW,row*CH+20),cell)
            draw.text((col*CW+6,row*CH+25),str(col+1),font=font,fill=ink)
    sheet.save(PREVIEW/f'anon-actions-{theme}.png')

animations=[]
for tick in range(48):
    image=Image.new('RGB',(CW*5,CH+42),'#182431')
    draw=ImageDraw.Draw(image)
    for i,(name,row,floor,crops) in enumerate(rows):
        frame=tick%len(crops) if name in ('idle','walk') else min(len(crops)-1,max(0,tick%24-3)//2)
        cell=atlas.crop((frame*CW,row*CH,(frame+1)*CW,(row+1)*CH))
        image.paste(cell,(i*CW,34),cell)
        draw.text((i*CW+12,9),f'{name.upper()} / {frame+1}',font=font,fill='#ead9ba')
        if name=='attack' and 2<=frame<6:
            # Demonstrate the independently extracted arrow alongside the bow.
            image.paste(arrow,(i*CW+AX+45+(frame-2)*10,34+AY-75),arrow)
    animations.append(image)
animations[0].save(PREVIEW/'anon-actions.gif',save_all=True,append_images=animations[1:],
                   duration=90,loop=0,disposal=2)
print(f'Prepared Anon: 29 action frames and a separate {arrow.width}x{arrow.height} arrow.')
