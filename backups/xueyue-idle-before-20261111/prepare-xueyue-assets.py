"""Prepare the author's Xueyue battle sheet, directional map art and portrait.

Requires Pillow. All three unmodified originals live under actions/source/.
"""
from pathlib import Path
from collections import deque
import json
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT/'assets/characters/actions'
source = Image.open(OUT/'source/xueyue-sword-original.jpg').convert('RGB')
assert source.size == (878, 1216)
pixels = []
for r, g, b in source.get_flattened_data():
    alpha = max(0., min(1., (129-(g-max(r,b)))/75))
    if alpha < .04:
        pixels.append((0,0,0,0)); continue
    if alpha < 1:
        r,g,b = [round(max(0,min(255,(c-(1-alpha)*bg)/alpha)))
                 for c,bg in zip((r,g,b),(24,185,47))]
    pixels.append((r,g,b,round(alpha*255)))
keyed=Image.new('RGBA',source.size); keyed.putdata(pixels)
edge=keyed.getchannel('A').filter(ImageFilter.MinFilter(5))
keyed.putdata([(r,min(g,max(r,b)+3),b,a) if e<250 and g>max(r,b)+6 else (r,g,b,a)
              for (r,g,b,a),e in zip(pixels,edge.get_flattened_data())])
CW,CH,AX,AY,BODY=192,144,72,124,76
centers=[160,255,350,445,540,635,730,825]
rows=[
 ('idle',0,130,[(p,(p-37,48,p+32,136)) for p in centers[:6]]),
 ('idle2',1,246,[(p,(p-37,163,p+32,252)) for p in centers]),
 ('walk',2,356,[(p,(p-43,271,p+32,362)) for p in centers]),
 ('run',3,461,[(p,(p-43,377,p+36,467)) for p in centers]),
 ('rush',4,564,[(p,(p-45,483,p+36,570)) for p in centers[:5]]+
   [(635,(590,483,707,570)),(735,(693,483,772,570))]),
 ('jump',5,725,[(p,(p-41,639,p+44,731)) for p in [166,261,356,451,546,641,736,831]]),
 ('attack',6,840,[(160,(122,754,194,846)),(255,(217,754,289,846)),
   (350,(312,754,418,846)),(445,(407,754,479,846))]),
 ('attack2',7,950,[(160,(123,859,194,956)),(255,(210,855,289,956)),
   (350,(312,853,418,956)),(445,(407,859,505,956))]),
 ('hurt',8,1054,[(p,(p-44,968,p+36,1060)) for p in [160,255,350]]),
 ('down',9,1160,[(160,(121,1075,194,1166)),(255,(217,1084,289,1166)),
   (350,(310,1090,389,1166)),(445,(407,1098,483,1166)),(545,(506,1130,588,1166))])
]
atlas=Image.new('RGBA',(CW*8,CH*10));frames={}
for name,row,floor,crops in rows:
 for col,(pivot,box) in enumerate(crops):
  crop=keyed.crop(box)
  # Exclude the preceding slash arc where it enters the next body's crop.
  if name=='attack' and col==3:
   ImageDraw.Draw(crop).rectangle((0,0,421-box[0],815-box[1]),fill=(0,0,0,0))
  if name=='attack2' and col==3:
   ImageDraw.Draw(crop).rectangle((0,0,421-box[0],924-box[1]),fill=(0,0,0,0))
  if name in ('attack','attack2') and col==2:
   cutoff=818 if name=='attack' else 924
   ImageDraw.Draw(crop).rectangle(((412 if name=='attack' else 410)-box[0],cutoff-box[1],crop.width,crop.height),fill=(0,0,0,0))
  if name=='rush' and col==5:
   ImageDraw.Draw(crop).rectangle((699-box[0],531-box[1],crop.width,crop.height),fill=(0,0,0,0))
  if name=='rush' and col==6:
   ImageDraw.Draw(crop).rectangle((0,0,710-box[0],546-box[1]),fill=(0,0,0,0))
  # Remove tiny JPEG residue islands while retaining the authored sword arcs
  # and hurt particles (all larger than this threshold).
  alpha=crop.getchannel('A');px=alpha.load();visited=set()
  for yy in range(crop.height):
   for xx in range(crop.width):
    if px[xx,yy]==0 or (xx,yy) in visited:continue
    component=[];q=deque([(xx,yy)]);visited.add((xx,yy))
    while q:
     x,y=q.popleft();component.append((x,y))
     for nx,ny in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
      if 0<=nx<crop.width and 0<=ny<crop.height and (nx,ny) not in visited and px[nx,ny]>0:
       visited.add((nx,ny));q.append((nx,ny))
    if len(component)<25:
     for point in component:crop.putpixel(point,(0,0,0,0))
  cell=Image.new('RGBA',(CW,CH));cell.alpha_composite(crop,(AX+box[0]-pivot,AY+box[1]-floor))
  b=cell.getbbox();assert b and 0<b[0]<b[2]<CW and 0<b[1]<b[3]<CH,(name,col,b)
  atlas.alpha_composite(cell,(col*CW,row*CH))
 frames[name]={'row':row,'count':len(crops)}
atlas.save(OUT/'xueyue-actions.png',optimize=True)
(OUT/'xueyue-actions.json').write_text(json.dumps({'cellWidth':CW,'cellHeight':CH,
 'anchorX':AX,'anchorY':AY,'bodyHeight':BODY,'frames':frames,'sourceFacing':'right',
 'source':'source/xueyue-sword-original.jpg'},indent=2)+'\n','utf-8')
down=atlas.crop((4*CW,9*CH,5*CW,10*CH));down.crop(down.getbbox()).save(ROOT/'assets/characters/sprites/xueyue-down.png')

def remove_white_exterior(im, restore_hair=False):
 """Flood external near-white only, preserving the enclosed white hair/skirt."""
 im=im.convert('RGBA');original=im.copy();w,h=im.size;p=im.load();seen=set();q=deque()
 def add(x,y):
  if (x,y) not in seen and min(p[x,y][:3])>215:
   seen.add((x,y));q.append((x,y))
 for x in range(w):add(x,0);add(x,h-1)
 for y in range(h):add(0,y);add(w-1,y)
 while q:
  x,y=q.popleft()
  for nx,ny in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
   if 0<=nx<w and 0<=ny<h:add(nx,ny)
 for x,y in seen:p[x,y]=(0,0,0,0)
 # Detached pale decorative halos in the screenshot are not map sprites.
 visited=set();largest=[]
 for y in range(h):
  for x in range(w):
   if p[x,y][3]==0 or (x,y) in visited:continue
   comp=[];q=deque([(x,y)]);visited.add((x,y))
   while q:
    a,b=q.popleft();comp.append((a,b))
    for nx,ny in ((a-1,b),(a+1,b),(a,b-1),(a,b+1)):
     if 0<=nx<w and 0<=ny<h and (nx,ny) not in visited and p[nx,ny][3]>0:
      visited.add((nx,ny));q.append((nx,ny))
   if len(comp)>len(largest):largest=comp
 keep=set(largest)
 for y in range(h):
  for x in range(w):
   if (x,y) not in keep:p[x,y]=(0,0,0,0)
 if restore_hair:
  # The back-view hair has a deliberately open, nearly white top outline.
  # Restore original pixels between the retained silhouette edges, rather
  # than treating that enclosed white hair as background.
  raw=original.load()
  for y in range(h):
   xs=[x for x in range(w) if p[x,y][3]>0]
   if len(xs)>1:
    for x in range(min(xs),max(xs)+1):p[x,y]=raw[x,y]
 return im.crop(im.getbbox())

portrait=remove_white_exterior(Image.open(OUT/'source/xueyue-portrait-original.png'))
portrait=portrait.resize((round(portrait.width*285/portrait.height),285),Image.Resampling.NEAREST)
portrait.save(ROOT/'assets/characters/sprites/xueyue-portrait.png')
directions=Image.open(OUT/'source/xueyue-directions-original.png')
walk=Image.new('RGBA',(128*3,128*4));idle=Image.new('RGBA',(128*2,142*2))
ordered=[0,3,1,2] # down / up / left / right from supplied screenshot
body_crops={}
for outrow,srcrow in enumerate(ordered):
 for col in range(3):
  x0=[12,213,420][col];x1=[204,411,619][col]
  y0=[24,286,543,797][srcrow];y1=[258,517,774,1022][srcrow]
  body=remove_white_exterior(directions.crop((x0,y0,x1,y1)),restore_hair=True)
  body=body.resize((round(body.width*106/body.height),106),Image.Resampling.LANCZOS)
  walk.alpha_composite(body,(col*128+(128-body.width)//2,outrow*128+117-body.height))
  if col==0:body_crops[outrow]=body
for direction,col,row in [(0,0,0),(2,1,0),(1,0,1),(3,1,1)]:
 body=body_crops[direction]
 idle.alpha_composite(body,(col*128+(128-body.width)//2,row*142+131-body.height))
walk.save(ROOT/'assets/characters/walk/xueyue-walk.png')
idle.save(ROOT/'assets/characters/idle/xueyue-idle.png')
# Standard fallback sheet; normal rendering uses the full custom atlas.
sheet=Image.new('RGBA',(80*4,96*8))
for row in range(8):
 for col in range(4):
  name='walk' if row<4 else 'attack' if row==4 else 'hurt' if row<7 else 'down'
  spec=frames[name];frame=min(col,spec['count']-1)
  cell=atlas.crop((frame*CW,spec['row']*CH,(frame+1)*CW,(spec['row']+1)*CH))
  body=cell.crop(cell.getbbox());body.thumbnail((76,88),Image.Resampling.NEAREST)
  sheet.alpha_composite(body,(col*80+(80-body.width)//2,row*96+94-body.height))
sheet.save(ROOT/'assets/characters/sprites/xueyue-sheet.png')

PREVIEW=ROOT/'docs/previews';font=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',14)
for theme,bg,ink in [('dark','#182431','#ead9ba'),('light','#e9e2d2','#263446')]:
 preview=Image.new('RGB',(CW*8,CH*10+26),bg);d=ImageDraw.Draw(preview)
 for name,row,floor,crops in rows:
  d.text((5,row*CH+2),name.upper(),font=font,fill=ink)
  for col in range(len(crops)):
   cell=atlas.crop((col*CW,row*CH,(col+1)*CW,(row+1)*CH));preview.paste(cell,(col*CW,row*CH+22),cell)
 preview.save(PREVIEW/f'xueyue-actions-{theme}.png')
animations=[]
for tick in range(56):
 preview=Image.new('RGB',(CW*5,(CH+32)*2),'#182431');d=ImageDraw.Draw(preview)
 for i,(name,row,floor,crops) in enumerate(rows):
  n=len(crops);frame=tick%n if name in ('idle','idle2','walk','run') else min(n-1,max(0,tick%28-3)//3)
  cell=atlas.crop((frame*CW,row*CH,(frame+1)*CW,(row+1)*CH));x,y=(i%5)*CW,(i//5)*(CH+32)
  preview.paste(cell,(x,y+28),cell);d.text((x+8,y+7),f'{name.upper()} / {frame+1}',font=font,fill='#ead9ba')
 animations.append(preview)
animations[0].save(PREVIEW/'xueyue-actions.gif',save_all=True,append_images=animations[1:],duration=90,loop=0,disposal=2)
preview=Image.new('RGB',(650,570),'#182431');preview.paste(portrait,(20,15),portrait)
preview.paste(walk,(230,15),walk);preview.save(PREVIEW/'xueyue-portrait-map.png')
print('Prepared Xueyue: 61 battle frames, portrait and genuine four-direction map art.')
