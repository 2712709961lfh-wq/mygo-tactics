"""Cut the five user-provided Nijika sheets into the established character format."""
from pathlib import Path
from collections import deque
from PIL import Image
import shutil,json
ROOT=Path(__file__).resolve().parents[1];SRC=ROOT/'assets/characters/nijika-source';SRC.mkdir(parents=True,exist_ok=True)
names={'hurt':'67cv8t67cv8t67cv','actions':'dohbj6dohbj6dohb','idle':'130aj0130aj0130a','walk':'5g0kiu5g0kiu5g0k','portrait':'xzjvukxzjvukxzjv'}
for name,code in names.items():shutil.copyfile(Path('D:/')/('Gemini_Generated_Image_'+code+'.jpg'),SRC/(name+'.jpg'))
def key(im,white=False):
 im=im.convert('RGBA');w,h=im.size;p=im.load()
 if white:
  seen=set();q=deque()
  def add(x,y):
   if (x,y) not in seen and min(p[x,y][:3])>220:seen.add((x,y));q.append((x,y))
  for x in range(w):add(x,0);add(x,h-1)
  for y in range(h):add(0,y);add(w-1,y)
  while q:
   x,y=q.popleft()
   for xx,yy in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]:
    if 0<=xx<w and 0<=yy<h:add(xx,yy)
  for x,y in seen:p[x,y]=(0,0,0,0)
 else:
  for y in range(h):
   for x in range(w):
    r,g,b,a=p[x,y];alpha=round(255*max(0,min(1,(27-(g-max(r,b)))/18)))
    p[x,y]=(r,min(g,max(r,b)+2) if alpha<255 else g,b,alpha if alpha>=25 else 0)
 return im
def fit(im,w,h,body):
 box=im.getbbox();im=im.crop(box);scale=body/im.height;im=im.resize((round(im.width*scale),body),Image.Resampling.NEAREST);out=Image.new('RGBA',(w,h));out.alpha_composite(im,((w-im.width)//2,h-5-body));return out
src=key(Image.open(SRC/'actions.jpg'));CW,CH,AX,AY=192,160,72,144;atlas=Image.new('RGBA',(CW*8,CH*7));centers=[232,369,505,641,778,915,1051,1187]
rows=[('idle',0,45,182,174,8),('dialogue',1,216,347,338,8),('special',2,369,507,496,6),('walk',3,522,658,646,8),('attack',4,677,812,797,8)]
meta={}
for name,row,top,bottom,floor,count in rows:
 for col,cx in enumerate(centers[:count]):
  left=cx-59;right=min(src.width,cx+74);crop=src.crop((left,top,right,bottom));cell=Image.new('RGBA',(CW,CH));cell.alpha_composite(crop,(AX+left-cx,AY+top-floor));atlas.alpha_composite(cell,(col*CW,row*CH))
 meta[name]={'row':row,'count':count}
hurt=key(Image.open(SRC/'hurt.jpg'))
for name,row,top,bottom,floor,cs in [('hurt',5,30,267,254,[375,608,829]),('down',6,301,519,501,[375,620,859,1109,1357,1615])]:
 for col,cx in enumerate(cs):
  left=cx-116;crop=hurt.crop((left,top,cx+117,bottom));scale=.56;crop=crop.resize((round(crop.width*scale),round(crop.height*scale)),Image.Resampling.NEAREST);cell=Image.new('RGBA',(CW,CH));cell.alpha_composite(crop,(AX-round(116*scale),AY-round((floor-top)*scale)));atlas.alpha_composite(cell,(col*CW,row*CH))
 meta[name]={'row':row,'count':len(cs)}
out=ROOT/'assets/characters';(out/'actions/nijika-actions.png').parent.mkdir(parents=True,exist_ok=True);atlas.save(out/'actions/nijika-actions.png',optimize=True)
(out/'actions/nijika-actions.json').write_text(json.dumps({'cellWidth':CW,'cellHeight':CH,'anchorX':AX,'anchorY':AY,'bodyHeight':112,'frames':meta},indent=2),encoding='utf8')
idle=key(Image.open(SRC/'idle.jpg'));idles=Image.new('RGBA',(256,284))
for col,row in [(0,0),(1,0),(0,1),(1,1)]:
 box=(col*488,row*541,(col+1)*488,(row+1)*541);idles.alpha_composite(fit(idle.crop(box),128,142,128),(col*128,row*142))
idles.save(out/'idle/nijika-idle.png',optimize=True)
walk=key(Image.open(SRC/'walk.jpg'));walks=Image.new('RGBA',(384,512))
for row,inrow in enumerate([1,0,2,3]):
 for col in range(3):walks.alpha_composite(fit(walk.crop((col*298,inrow*300,(col+1)*298,(inrow+1)*300)),128,128,112),(col*128,row*128))
walks.save(out/'walk/nijika-walk.png',optimize=True)
portrait=key(Image.open(SRC/'portrait.jpg'),True);portrait=portrait.crop(portrait.getbbox());portrait.thumbnail((420,580),Image.Resampling.NEAREST);portrait.save(out/'sprites/nijika-portrait.png',optimize=True)
down=atlas.crop((5*CW,6*CH,6*CW,7*CH));down=down.crop(down.getbbox());down.save(out/'sprites/nijika-down.png',optimize=True)
sheet=Image.new('RGBA',(320,768))
for row,walkrow in enumerate([0,3,1,2]):
 for col in range(4):
  cell=walks.crop(((col%3)*128,walkrow*128,(col%3+1)*128,(walkrow+1)*128));sheet.alpha_composite(fit(cell,80,96,84),(col*80,row*96))
for row in range(4,8):
 for col in range(4):sheet.alpha_composite(fit(atlas.crop((col*CW,(4 if row==4 else 5 if row==5 else 6)*CH,(col+1)*CW,(5 if row==4 else 6 if row==5 else 7)*CH)),80,96,84),(col*80,row*96))
sheet.save(out/'sprites/nijika-sheet.png',optimize=True)
preview=Image.new('RGB',atlas.size,'#253244');preview.paste(atlas,(0,0),atlas);preview.save(ROOT/'docs/previews/nijika-actions.png')
print('Prepared Nijika: 47 action frames, four directions, portrait and fallback sprites.')
