"""Extract Awa Subaru's five user-supplied sheets; retain originals unchanged."""
from pathlib import Path
from collections import deque
from PIL import Image
import numpy as np
import shutil,json
ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/'assets/characters/subaru-source';SRC.mkdir(parents=True,exist_ok=True)
names={'actions':'bzkjoibzkjoibzkj','hurt':'j9zcckj9zcckj9zc','walk':'b44xsxb44xsxb44x','idle':'rlmr3wrlmr3wrlmr','portrait':'nwoe4lnwoe4lnwoe'}
for name,code in names.items():shutil.copyfile(Path('D:/')/('Gemini_Generated_Image_'+code+'.jpg'),SRC/(name+'.jpg'))
OUT=ROOT/'assets/characters'
for folder in ['actions','idle','walk','sprites']:(OUT/folder).mkdir(exist_ok=True)
def key(im,white=False):
 im=im.convert('RGBA')
 if white:
  p=im.load();w,h=im.size;seen=set();q=deque()
  def add(x,y):
   if (x,y) not in seen and min(p[x,y][:3])>220:seen.add((x,y));q.append((x,y))
  for x in range(w):add(x,0);add(x,h-1)
  for y in range(h):add(0,y);add(w-1,y)
  while q:
   x,y=q.popleft()
   for xx,yy in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]:
    if 0<=xx<w and 0<=yy<h:add(xx,yy)
  for x,y in seen:p[x,y]=(0,0,0,0)
  return im
 a=np.array(im);rgb=a[:,:,:3].astype(np.int16);diff=rgb[:,:,1]-np.maximum(rgb[:,:,0],rgb[:,:,2]);alpha=np.clip((27-diff)/18,0,1)*255
 a[:,:,3]=np.where(alpha<25,0,alpha).astype(np.uint8)
 fringe=(alpha<255);a[:,:,1]=np.where(fringe,np.minimum(rgb[:,:,1],np.maximum(rgb[:,:,0],rgb[:,:,2])+2),rgb[:,:,1])
 return Image.fromarray(a)
def fit(im,w,h,body):
 box=im.getbbox()
 if not box:raise ValueError('Empty frame')
 im=im.crop(box);scale=body/im.height;im=im.resize((round(im.width*scale),body),Image.Resampling.NEAREST)
 out=Image.new('RGBA',(w,h));out.alpha_composite(im,((w-im.width)//2,h-5-body));return out
CW,CH,AX,AY,BODY=192,160,80,144,104
atlas=Image.new('RGBA',(CW*8,CH*8));meta={}
actions=key(Image.open(SRC/'actions.jpg'));centers=[238,377,516,655,794,933,1072,1211]
rows=[('idle',0,35,158,149,6),('walk',1,204,322,310,7),('run',2,359,484,473,8),('attack',3,502,640,625,8),('attack2',4,669,807,786,4)]
for name,row,top,bottom,floor,count in rows:
 for col,cx in enumerate(centers[:count]):
  left=max(181,cx-69);right=min(actions.width,cx+70);crop=actions.crop((left,top,right,bottom));cell=Image.new('RGBA',(CW,CH))
  cell.alpha_composite(crop,(AX+left-cx,AY+top-floor));atlas.alpha_composite(cell,(col*CW,row*CH))
 meta[name]={'row':row,'count':count}
hurt=key(Image.open(SRC/'hurt.jpg'))
for name,row,top,bottom,floor,count in [('jump',5,0,231,217,8),('hurt',6,250,426,414,3),('down',7,445,617,602,5)]:
 for col in range(count):
  cx=320+172*col;left=cx-85;crop=hurt.crop((left,top,min(hurt.width,cx+87),bottom));scale=.66
  crop=crop.resize((round(crop.width*scale),round(crop.height*scale)),Image.Resampling.NEAREST)
  cell=Image.new('RGBA',(CW,CH));cell.alpha_composite(crop,(AX-round(85*scale),AY-round((floor-top)*scale)));atlas.alpha_composite(cell,(col*CW,row*CH))
 meta[name]={'row':row,'count':count}
atlas.save(OUT/'actions/subaru-actions.png',optimize=True)
(OUT/'actions/subaru-actions.json').write_text(json.dumps({'cellWidth':CW,'cellHeight':CH,'anchorX':AX,'anchorY':AY,'bodyHeight':BODY,'frames':meta},indent=2),encoding='utf8')
idle=key(Image.open(SRC/'idle.jpg'));idles=Image.new('RGBA',(256,284))
for row in range(2):
 for col in range(2):idles.alpha_composite(fit(idle.crop((col*488,row*541,(col+1)*488,(row+1)*541)),128,142,128),(col*128,row*142))
idles.save(OUT/'idle/subaru-idle.png',optimize=True)
walk=key(Image.open(SRC/'walk.jpg'));walks=Image.new('RGBA',(384,512))
for row,inrow in enumerate([1,0,2,3]):
 for col in range(3):
  # Both side rows contain one opposite-facing pose. Reflect it to keep each row coherent.
  crop=walk.crop((col*298,inrow*300,min(walk.width,(col+1)*298),(inrow+1)*300))
  if (inrow==2 and col==2) or (inrow==3 and col==0):crop=crop.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
  walks.alpha_composite(fit(crop,128,128,112),(col*128,row*128))
walks.save(OUT/'walk/subaru-walk.png',optimize=True)
portrait=key(Image.open(SRC/'portrait.jpg'),True);portrait=portrait.crop(portrait.getbbox());portrait.thumbnail((420,580),Image.Resampling.NEAREST);portrait.save(OUT/'sprites/subaru-portrait.png',optimize=True)
down=atlas.crop((4*CW,7*CH,5*CW,8*CH));down.crop(down.getbbox()).save(OUT/'sprites/subaru-down.png',optimize=True)
sheet=Image.new('RGBA',(320,768))
for row,walkrow in enumerate([0,3,1,2]):
 for col in range(4):sheet.alpha_composite(fit(walks.crop(((col%3)*128,walkrow*128,(col%3+1)*128,(walkrow+1)*128)),80,96,84),(col*80,row*96))
for row,actionrow in [(4,3),(5,6),(6,7),(7,7)]:
 for col in range(4):
  frame=min(col,2) if actionrow==6 else col
  sheet.alpha_composite(fit(atlas.crop((frame*CW,actionrow*CH,(frame+1)*CW,(actionrow+1)*CH)),80,96,84),(col*80,row*96))
sheet.save(OUT/'sprites/subaru-sheet.png',optimize=True)
preview=Image.new('RGB',atlas.size,'#28313d');preview.paste(atlas,(0,0),atlas);preview.save(ROOT/'docs/previews/subaru-actions.png')
print('Prepared Subaru: 49 action frames, four map directions, idle, portrait, down and fallback sheets.')
