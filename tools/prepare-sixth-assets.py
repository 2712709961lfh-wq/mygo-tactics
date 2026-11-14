"""Extract supplied masked-boss sheets, plus licensed LPC scenery and teleport VFX."""
from pathlib import Path
from collections import deque
from PIL import Image,ImageDraw,ImageOps
import shutil,json
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'assets/chapter-six';SRC=OUT/'source';SRC.mkdir(parents=True,exist_ok=True)
files={'actions':'v0yc14v0yc14v0yc','walk':'3n8ots3n8ots3n8o','idle':'lftf6qlftf6qlftf','portrait':'2ka2xo2ka2xo2ka2'}
for k,v in files.items():shutil.copyfile(Path('D:/')/('Gemini_Generated_Image_'+v+'.jpg'),SRC/('mask-'+k+'-original.jpg'))
def key(im,white=False):
 im=im.convert('RGBA');p=im.load();w,h=im.size
 if white:
  seen=set();q=deque()
  def add(x,y):
   if (x,y) not in seen and min(p[x,y][:3])>222:seen.add((x,y));q.append((x,y))
  for x in range(w):add(x,0);add(x,h-1)
  for y in range(h):add(0,y);add(w-1,y)
  while q:
   x,y=q.popleft()
   for xx,yy in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
    if 0<=xx<w and 0<=yy<h:add(xx,yy)
  for x,y in seen:p[x,y]=(0,0,0,0)
 else:
  values=[]
  for r,g,b,a in im.getdata():
   a=round(255*max(0,min(1,(28-(g-max(r,b)))/18)))
   if a<12:a=0
   if a<255:g=min(g,max(r,b)+2)
   values.append((r,g,b,a))
  im.putdata(values)
 return im

def clean(im,left_cut=None):
 # Background lettering is excluded by measured crops; remove JPEG specks only.
 a=im.getchannel('A');p=a.load();seen=set()
 for y in range(im.height):
  for x in range(im.width):
   if not p[x,y] or (x,y) in seen:continue
   q=deque([(x,y)]);seen.add((x,y));group=[]
   while q:
    xx,yy=q.popleft();group.append((xx,yy))
    for nx,ny in ((xx-1,yy),(xx+1,yy),(xx,yy-1),(xx,yy+1)):
     if 0<=nx<im.width and 0<=ny<im.height and p[nx,ny] and (nx,ny) not in seen:seen.add((nx,ny));q.append((nx,ny))
   if len(group)<10 or left_cut is not None and max(xx for xx,yy in group)<left_cut:
    for xx,yy in group:im.putpixel((xx,yy),(0,0,0,0))
 return im
src=key(Image.open(SRC/'mask-actions-original.jpg'));print('battle',src.size)
rows=[('idle',101,226,[235,370,505,640,775,910,1045,1180],219),('walk',270,391,[235,370,505,640,775,910,1045],382),
 ('attack',417,550,[234,370,505,638,771,906,1073],536),('hurt',574,700,[235,370,505],686),('down',735,852,[238,397,531,661],838)]
CW,CH,AX,AY=256,160,64,143;atlas=Image.new('RGBA',(CW*8,CH*5));meta={}
for row,(name,top,bottom,centers,floor) in enumerate(rows):
 for col,cx in enumerate(centers):
  left=cx-47;right=cx+58
  if name=='attack':right=([285,420,555,715,881,1019,1236][col])
  if name=='down':left=cx-70;right=cx+74
  # Late spell frames contain the previous column's detached projectile.
  # Keep the connected character and rightward spell; remove left-only groups.
  crop=clean(src.crop((left,top,right,bottom)),47 if name=='attack' and col>=5 else None)
  if name=='attack' and col==6:
   # The previous projectile touches this final pose at the upper-left edge.
   # Exclude that measured overlap while retaining the extended left hand below.
   for xx in range(27):
    for yy in range(62):crop.putpixel((xx,yy),(0,0,0,0))
  cell=Image.new('RGBA',(CW,CH));cell.alpha_composite(crop,(AX+left-cx,AY+top-floor));atlas.alpha_composite(cell,(col*CW,row*CH))
 meta[name]={'row':row,'count':len(centers)}
atlas.save(OUT/'mask-actions.png',optimize=True)
(OUT/'mask-actions.json').write_text(json.dumps({'cellWidth':CW,'cellHeight':CH,'anchorX':AX,'anchorY':AY,'bodyHeight':108,'sourceFacing':'right','frames':meta},indent=2),encoding='utf8')
def fit(im,w,h,body):
 im=clean(im);im=im.crop(im.getbbox());k=body/im.height;im=im.resize((round(im.width*k),body),Image.Resampling.LANCZOS);out=Image.new('RGBA',(w,h));out.alpha_composite(im,((w-im.width)//2,h-5-body));return out
walksrc=key(Image.open(SRC/'mask-walk-original.jpg'));walk=Image.new('RGBA',(128*3,144*4))
for outrow,inrow in enumerate([1,0,2,3]):
 for col in range(3):
  crop=walksrc.crop((col*298,inrow*300,(col+1)*298,(inrow+1)*300));walk.alpha_composite(fit(crop,128,144,128),(col*128,outrow*144))
walk.save(OUT/'mask-walk.png',optimize=True)
idle=key(Image.open(SRC/'mask-idle-original.jpg'));idleout=Image.new('RGBA',(128*4,144))
for i,box in enumerate([(0,0,480,550),(490,0,976,550),(0,550,480,1082),(490,550,976,1082)]):idleout.alpha_composite(fit(idle.crop(box),128,144,128),(i*128,0))
idleout.save(OUT/'mask-idle.png',optimize=True)
portrait=key(Image.open(SRC/'mask-portrait-original.jpg'),True);portrait=portrait.crop(portrait.getbbox());portrait.thumbnail((420,580),Image.Resampling.LANCZOS);portrait.save(OUT/'mask-portrait.png',optimize=True)
# Source throne and double bronze street lamp, from the same LPC pixel art family.
furniture=Image.open(SRC/'furniture/LPC_city_inside/city_inside.png').convert('RGBA');throne=furniture.crop((608,0,640,96));throne.save(OUT/'throne.png')
lamp=Image.open(SRC/'lamps/PNG/32x32/lamp-1-post-1/lamp-1-post-1-tall-twin-U-bronze.png').convert('RGBA');lamp.save(OUT/'palace-lamp.png')
# Recolour the complete 16-frame CC0 circle sheet from blue to violet, preserve alpha.
im=Image.open(SRC/'teleport.png').convert('RGBA');alpha=im.getchannel('A');gray=ImageOps.grayscale(im);fx=ImageOps.colorize(gray,'#491b76','#f2b3ff').convert('RGBA');fx.putalpha(alpha);fx.save(OUT/'void-circle.png',optimize=True)
preview=Image.new('RGB',(2048,800),'#192537');preview.paste(atlas,(0,0),atlas);preview.save(ROOT/'docs/previews/mask-actions.png')
preview=Image.new('RGB',(1000,650),'#192537');preview.paste(portrait,(10,15),portrait);preview.paste(idleout,(460,30),idleout);preview.paste(walk,(480,190),walk);preview.paste(throne.resize((64,96)),(890,40),throne.resize((64,96)));preview.save(ROOT/'docs/previews/mask-materials.png')
print('Prepared four user images, LPC throne/lamps, and sixteen portal frames.')

