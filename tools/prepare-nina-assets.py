"""Extract the four user-supplied Nina images; preserve originals and foot anchors."""
from pathlib import Path
from collections import deque
import json, shutil
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/characters'
SOURCE=OUT/'actions/source'
SOURCES={'battle':'scg4niscg4niscg4','walk':'e7za7ye7za7ye7za',
         'idle':'c0d6glc0d6glc0d6','portrait':'n7lftpn7lftpn7lf'}
for name,code in SOURCES.items():
    shutil.copyfile(Path('D:/')/f'Gemini_Generated_Image_{code}.jpg',SOURCE/f'nina-{name}-original.jpg')

def keyed(im,white=False):
    im=im.convert('RGBA')
    if white:
        # Only remove the connected white exterior; preserve collar, socks and shirt.
        p=im.load();w,h=im.size;seen=set();q=deque()
        def add(x,y):
            if (x,y) not in seen and min(p[x,y][:3])>225:
                seen.add((x,y));q.append((x,y))
        for x in range(w):add(x,0);add(x,h-1)
        for y in range(h):add(0,y);add(w-1,y)
        while q:
            x,y=q.popleft()
            for nx,ny in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]:
                if 0<=nx<w and 0<=ny<h:add(nx,ny)
        for x,y in seen:p[x,y]=(0,0,0,0)
        return im
    data=[]
    for r,g,b,a in im.getdata():
        if white:
            a=0 if min(r,g,b)>235 else 255
        else:
            # Green screens differ between sheets; character colours are neutral/dark.
            a=round(255*max(0,min(1,(34-(g-max(r,b)))/22)))
            if a<10:a=0
            if a<255:g=min(g,max(r,b)+3)
        data.append((r,g,b,a))
    im.putdata(data)
    return im

def clean(im):
    # Remove isolated JPEG specks, retain actual limbs and kick trails.
    a=im.getchannel('A');p=a.load();seen=set()
    for y in range(im.height):
        for x in range(im.width):
            if not p[x,y] or (x,y) in seen:continue
            group=[];q=deque([(x,y)]);seen.add((x,y))
            while q:
                xx,yy=q.popleft();group.append((xx,yy))
                for nx,ny in [(xx-1,yy),(xx+1,yy),(xx,yy-1),(xx,yy+1)]:
                    if 0<=nx<im.width and 0<=ny<im.height and p[nx,ny] and (nx,ny) not in seen:
                        seen.add((nx,ny));q.append((nx,ny))
            if len(group)<12:
                for xx,yy in group:im.putpixel((xx,yy),(0,0,0,0))
    return im

src=keyed(Image.open(SOURCE/'nina-battle-original.jpg'))
# Source layout includes intentional extra space above ATTACK2.
centres=[157,252,347,442,537,632,727,822]
rows=[('idle',48,145,6,139),('walk',155,257,8,249),('run',275,372,8,363),
      ('jump',378,478,8,465),('attack',485,583,4,577),('attack2',642,740,3,732),
      ('attack3',751,849,4,839),('shield',870,971,2,959),('hurt',980,1075,3,1066),
      ('down',1095,1181,3,1171)]
CW,CH,AX,AY=160,144,64,124
atlas=Image.new('RGBA',(8*CW,10*CH));frames={}
for row,(name,top,bottom,count,floor) in enumerate(rows):
    for col in range(count):
        cx=centres[col];left=cx-45;right=cx+48
        if name=='attack3' and col==2:right=cx+62
        if name=='down' and col==2:left=cx-40;right=cx+53
        crop=clean(src.crop((left,top,right,bottom)))
        if name=='attack3' and col==3:
            ImageDraw.Draw(crop).rectangle((0,0,15,crop.height),fill=(0,0,0,0))
        cell=Image.new('RGBA',(CW,CH))
        cell.alpha_composite(crop,(AX+left-cx,AY+top-floor))
        assert cell.getbbox() and 0<cell.getbbox()[0] and cell.getbbox()[2]<CW,(name,col)
        atlas.alpha_composite(cell,(col*CW,row*CH))
    frames[name]={'row':row,'count':count}
atlas.save(OUT/'actions/nina-actions.png',optimize=True)
(OUT/'actions/nina-actions.json').write_text(json.dumps({'cellWidth':CW,'cellHeight':CH,'anchorX':AX,
    'anchorY':AY,'bodyHeight':84,'frames':frames,'sourceFacing':'right',
    'source':'source/nina-battle-original.jpg'},indent=2)+'\n',encoding='utf-8')
down=atlas.crop((2*CW,9*CH,3*CW,10*CH));down.crop(down.getbbox()).save(OUT/'sprites/nina-down.png')

def fit(im,w,h,body_height):
    im=im.crop(im.getbbox());scale=body_height/im.height
    im=im.resize((round(im.width*scale),body_height),Image.Resampling.LANCZOS)
    cell=Image.new('RGBA',(w,h));cell.alpha_composite(im,((w-im.width)//2,h-5-im.height));return cell

walksrc=keyed(Image.open(SOURCE/'nina-walk-original.jpg'))
walk=Image.new('RGBA',(128*3,128*4))
# Input rows up / down / left / right, output down / up / left / right.
for outrow,inrow in enumerate([1,0,2,3]):
    for col in range(3):
        crop=clean(walksrc.crop((col*298,inrow*300,(col+1)*298,(inrow+1)*300)))
        walk.alpha_composite(fit(crop,128,128,112),(col*128,outrow*128))
walk.save(OUT/'walk/nina-walk.png',optimize=True)
idleimg=keyed(Image.open(SOURCE/'nina-idle-original.jpg'))
idle=Image.new('RGBA',(256,284))
for col,row,box in [(0,0,(0,0,480,540)),(1,0,(490,0,976,540)),
                    (0,1,(0,540,480,1082)),(1,1,(490,540,976,1082))]:
    idle.alpha_composite(fit(clean(idleimg.crop(box)),128,142,127),(col*128,row*142))
idle.save(OUT/'idle/nina-idle.png',optimize=True)
portrait=keyed(Image.open(SOURCE/'nina-portrait-original.jpg'),white=True)
portrait=portrait.crop(portrait.getbbox());portrait.thumbnail((480,680),Image.Resampling.LANCZOS)
portrait.save(OUT/'sprites/nina-portrait.png',optimize=True)
# Compatibility sheet for the existing loader; actual battle/map paths use the authored atlases.
sheet=Image.new('RGBA',(320,768))
for row in range(8):
    for col in range(4):
        if row<4:
            c=walk.crop(((col%3)*128,(0 if row==0 else 3 if row==1 else 1 if row==2 else 2)*128,(col%3+1)*128,(1 if row==0 else 4 if row==1 else 2 if row==2 else 3)*128))
        else:
            rr=4 if row==4 else 8 if row<7 else 9
            cc=min(col,3 if rr==4 else 2)
            c=atlas.crop((cc*CW,rr*CH,(cc+1)*CW,(rr+1)*CH))
        sheet.alpha_composite(fit(c,80,96,82),(col*80,row*96))
sheet.save(OUT/'sprites/nina-sheet.png',optimize=True)
preview=Image.new('RGB',(1280,1440),'#223447');preview.paste(atlas,(0,0),atlas)
draw=ImageDraw.Draw(preview)
for row,(name,*_) in enumerate(rows):draw.text((3,row*CH+3),name,fill='#f1d7af')
preview.save(ROOT/'docs/previews/nina-actions.png')
overview=Image.new('RGB',(880,650),'#223447')
overview.paste(portrait,(20,10),portrait)
overview.paste(idle,(490,5),idle);overview.paste(walk,(490,300),walk)
overview.save(ROOT/'docs/previews/nina-materials.png')
print('Prepared Nina: 49 authored battle frames, 12 walk frames, 4 idle directions, portrait and down sprite.')
