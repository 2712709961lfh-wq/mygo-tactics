"""Extract the author's Rana lance sheet. Pillow required; source stays intact.

Connected silhouettes separate overlapping crop rectangles in the spear rows.
The green matte is unmixed at edges, keeping pale hair and fine plaid lines.
"""
from pathlib import Path
from collections import deque
import json
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT/'assets/characters/actions'
source = Image.open(OUT/'source/rana-lance-original.jpg').convert('RGB')
assert source.size == (896,1185), 'Re-measure crops for a different source'
pixels=[]
for r,g,b in source.get_flattened_data():
    alpha=max(0.,min(1.,(124-(g-max(r,b)))/100))
    if alpha < .04:
        pixels.append((0,0,0,0))
        continue
    if alpha < 1:
        r,g,b=[round(max(0,min(255,(c-(1-alpha)*bg)/alpha)))
               for c,bg in zip((r,g,b),(18,180,48))]
        g=min(g,max(r,b)+7)
    pixels.append((r,g,b,round(alpha*255)))
keyed=Image.new('RGBA',source.size)
keyed.putdata(pixels)
edge=keyed.getchannel('A').filter(ImageFilter.MinFilter(3))
keyed.putdata([(r,min(g,max(r,b)+4),b,a) if e<240 and g>max(r,b)+8
              else (r,g,b,a) for (r,g,b,a),e in zip(pixels,edge.get_flattened_data())])

CW,CH,AX,AY,BODY=224,128,96,108,84
# name, row, common floor, vertical crop, body pivots, head seed y
rows=[
    ('idle',0,118,(28,124),[158,254,350,446,542,638],60),
    ('idle2',1,234,(144,240),[162,258,354,450,546,642],178),
    ('walk',2,345,(250,352),[164,260,356,452,548,644,740,836],286),
    ('run',3,449,(362,456),[168,264,360,456,552,648,744,840],392),
    ('charge',4,556,(468,563),[172,279,374,482,592],500),
    ('jump',5,718,(623,725),[168,265,362,459,556,650,746,842],666),
    ('attack',6,833,(746,840),[168,264,361,465],779),
    ('attack2',7,943,(856,950),[167,263,359,461,554],889),
    ('hurt',8,1050,(965,1057),[164,260,356],998),
    ('down',9,1156,(1066,1163),[161,260,357,460,567],1115),
]

def isolate(pivot,top,bottom,seed_y):
    """Follow a single held spear/body, rejecting the adjacent spear tips."""
    left=max(110,pivot-67)
    right=min(896,pivot+70)
    region=keyed.crop((left,top,right,bottom))
    w,h=region.size
    a=region.getchannel('A')
    data=list(a.get_flattened_data())
    # Closest opaque pixel to measured head center is a stable flood seed.
    sx,sy=pivot-left,seed_y-top
    candidates=[(abs(x-sx)+abs(y-sy),x,y) for y in range(max(0,sy-20),min(h,sy+20))
                for x in range(max(0,sx-20),min(w,sx+20)) if data[y*w+x]>=128]
    _,sx,sy=min(candidates)
    visited=bytearray(w*h)
    stack=deque([(sx,sy)])
    visited[sy*w+sx]=255
    while stack:
        x,y=stack.popleft()
        for nx,ny in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]:
            if 0<=nx<w and 0<=ny<h:
                i=ny*w+nx
                if not visited[i] and data[i]>=128:
                    visited[i]=255
                    stack.append((nx,ny))
    mask=Image.frombytes('L',(w,h),bytes(visited)).filter(ImageFilter.MaxFilter(3))
    region.putalpha(Image.composite(a,Image.new('L',(w,h)),mask))
    return region,left

atlas=Image.new('RGBA',(CW*8,CH*10))
frames={}
# Measured spear envelopes remove adjacent shafts even where JPEG edges join.
# (left x offset, right x offset, left y, right y); arrow trails get extra room.
poles={
    'run': [(-50,56,408,418),(-50,56,409,419),(-50,56,410,420),(-50,56,410,420),
            (-50,60,408,419),(-50,61,407,417),(-50,64,407,417),(-50,58,409,419)],
    'charge':[(-55,53,514,523),(-62,43,518,526),(-58,56,519,519),
              (-51,59,524,524),(-48,60,524,524)],
    'attack':[(-51,56,792,798),(-50,55,792,798),(-47,58,788,794),(-54,62,790,790)],
    'attack2':[(-47,58,900,908),(-47,57,901,915),(-46,57,900,915),
               (-41,65,902,912),(-40,65,902,913)]
}
for name,row,floor,(top,bottom),pivots,seed_y in rows:
    for col,pivot in enumerate(pivots):
        cell=Image.new('RGBA',(CW,CH))
        if name in ('run','charge','attack','attack2','jump'):
            # Jump bodies move upwards; choose the head from each pose's bbox.
            actual_seed=seed_y
            if name=='jump': actual_seed=[663,665,657,649,643,655,662,662][col]
            crop,left=isolate(pivot,top,bottom,actual_seed)
            if name in poles:
                lx,rx,ly,ry=poles[name][col]
                mask=Image.new('L',crop.size)
                draw=ImageDraw.Draw(mask)
                draw.rectangle((pivot-31-left,0,pivot+31-left,crop.height),fill=255)
                draw.polygon([(pivot+lx-left,ly-top-3),(pivot+rx-left,ry-top-5),
                              (pivot+rx-left,ry-top+5),(pivot+lx-left,ly-top+3)],fill=255)
                if (name,col) in [('charge',2),('attack',2),('attack2',3)]:
                    draw.rectangle((pivot+25-left,ry-top-13,pivot+rx-left,ry-top+14),fill=255)
                crop.putalpha(Image.composite(crop.getchannel('A'),Image.new('L',crop.size),mask))
        elif name=='down':
            left,right=[(132,192),(209,286),(291,379),(391,487),(483,610)][col]
            crop=keyed.crop((left,top,right,bottom))
            if col==3:
                ImageDraw.Draw(crop).rectangle((480-left,1148-top,crop.width,crop.height),fill=(0,0,0,0))
            if col==4:
                ImageDraw.Draw(crop).rectangle((0,0,492-left,1145-top),fill=(0,0,0,0))
        else:
            left=pivot-(85 if name=='down' and col>=2 else 48)
            right=min(896,pivot+49)
            crop=keyed.crop((left,top,right,bottom))
        cell.alpha_composite(crop,(AX+left-pivot,AY+top-floor))
        if name=='attack' and col==3:
            # Frame 3's white arrow crosses frame 4's rear shaft. Restore this
            # short shaft segment using the clean rear shaft from frame 3.
            ImageDraw.Draw(cell).rectangle((AX+411-pivot,AY+784-floor,AX+426-pivot,AY+800-floor),fill=(0,0,0,0))
            cell.alpha_composite(keyed.crop((315,784,331,793)),(AX+411-pivot,AY+786-floor))
        if name=='run' and col==7:
            # The canvas cuts off the final spear tip. Complete its last pixels
            # with the matching clean tip from run frame 6 in this same sheet.
            ImageDraw.Draw(cell).rectangle((AX+885-pivot,AY+410-floor,AX+70,AY+428-floor),fill=(0,0,0,0))
            tip=keyed.crop((698,410,711,425))
            ImageDraw.Draw(tip).rectangle((0,0,tip.width,3),fill=(0,0,0,0))
            cell.alpha_composite(tip,(AX+885-pivot,AY+412-floor))
        atlas.alpha_composite(cell,(col*CW,row*CH))
    frames[name]={'row':row,'count':len(pivots)}
atlas.save(OUT/'rana-actions.png',optimize=True)
meta={'cellWidth':CW,'cellHeight':CH,'anchorX':AX,'anchorY':AY,'bodyHeight':BODY,
      'frames':frames,'sourceFacing':'right','source':'source/rana-lance-original.jpg'}
(OUT/'rana-actions.json').write_text(json.dumps(meta,indent=2)+'\n','utf-8')
down=atlas.crop((4*CW,9*CH,5*CW,10*CH))
down.crop(down.getbbox()).save(ROOT/'assets/characters/sprites/rana-down.png')

preview=ROOT/'docs/previews'
font=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',14)
for theme,bg,ink in [('dark','#182431','#ead9ba'),('light','#e9e2d2','#263446')]:
    sheet=Image.new('RGB',(CW*8,CH*10+30),bg)
    draw=ImageDraw.Draw(sheet)
    for name,row,floor,vertical,pivots,seed_y in rows:
        draw.text((7,row*CH+2),name.upper(),font=font,fill=ink)
        for col in range(len(pivots)):
            cell=atlas.crop((col*CW,row*CH,(col+1)*CW,(row+1)*CH))
            sheet.paste(cell,(col*CW,row*CH+17),cell)
            draw.text((col*CW+6,row*CH+21),str(col+1),font=font,fill=ink)
    sheet.save(preview/f'rana-actions-{theme}.png')

animations=[]
for tick in range(48):
    image=Image.new('RGB',(CW*5,(CH+32)*2),'#182431')
    draw=ImageDraw.Draw(image)
    for i,(name,row,floor,vertical,pivots,seed_y) in enumerate(rows):
        frame=tick%len(pivots) if name in ('idle','idle2','walk','run') else min(len(pivots)-1,max(0,tick%24-3)//2)
        cell=atlas.crop((frame*CW,row*CH,(frame+1)*CW,(row+1)*CH))
        x,y=(i%5)*CW,(i//5)*(CH+32)
        image.paste(cell,(x,y+28),cell)
        draw.text((x+10,y+6),f'{name.upper()} / {frame+1}',font=font,fill='#ead9ba')
    animations.append(image)
animations[0].save(preview/'rana-actions.gif',save_all=True,append_images=animations[1:],
                   duration=85,loop=0,disposal=2)
print('Prepared Rana: '+str(sum(x['count'] for x in frames.values()))+' action frames.')
