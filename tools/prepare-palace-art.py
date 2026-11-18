"""Build mounted LPC knights and palace scenery from credited, local sources.

Horse animation: bluecarrot16 / Benjamin K. Smith, CC BY 3.0.
Rider plate/helmet/spear layers: same CC BY-SA 3.0 sources as chapter five.
City interiors: Tuomo Untinen and LPC contributors, CC BY-SA 3.0.
All composite art is distributed under CC BY-SA 3.0.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps
import zipfile, io, json, hashlib
from functools import lru_cache

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/chapter-ten'
SRC=OUT/'source'
LPC=ROOT/'assets/chapter-five/lpc-source'
horsezip=zipfile.ZipFile(SRC/'LPC-Horse-Extended.zip')
cityzip=zipfile.ZipFile(SRC/'LPC_city_inside.zip')
used={}
CW=192; AX=96; AY=152; BODY=90
DIRECTIONS=['up','left','down','right']
ACTIONS={'idle':2,'walk':6,'run':6,'attack':8,'hurt':3,'down':6,'jump':5}

def record(label,data):
    used[label]=hashlib.sha256(data).hexdigest()
    return Image.open(io.BytesIO(data)).convert('RGBA')

@lru_cache(None)
def horsepart(path):
    name='LPC Horse Extended/'+path
    return record('LPC-Horse-Extended.zip!'+name,horsezip.read(name))

@lru_cache(None)
def layer(part,action):
    path='spritesheets/'+part+'/'+action+'.png'
    return record('chapter-five/lpc-source/'+path,(LPC/path.replace('/','__')).read_bytes())

def cell(im,col,row,size=64):
    return im.crop((col*size,row*size,(col+1)*size,(row+1)*size))

def gold(im):
    out=im.copy();pixels=[]
    for r,g,b,a in im.getdata():
        light=(r*3+g*6+b)/2550
        pixels.append((round(39+209*light),round(30+182*light),round(27+113*light),a))
    out.putdata(pixels);return out

def cloth(im,elite):
    out=im.copy();pixels=[]
    for r,g,b,a in im.getdata():
        light=(r+g+b)/765
        low,high=((55,16,38),(177,62,76)) if elite else ((21,29,62),(76,103,163))
        pixels.append(tuple(round(low[k]+(high[k]-low[k])*light) for k in range(3))+(a,))
    out.putdata(pixels);return out

def horse_frame(kind,state,index,direction):
    gait='Idle' if state=='idle' else 'Gallop' if state in ['run','attack','jump'] else 'Walk'
    frame=index%6
    color='White' if kind=='elite' else 'Brown'
    im=horsepart('Horse/Horse '+gait+' '+color+'.png')
    get=lambda image:cell(image,direction if gait=='Idle' else frame,0 if gait=='Idle' else direction,128)
    horse=get(im)
    horse.alpha_composite(cloth(get(horsepart('Accessories/Blanket '+gait+'.png')),kind=='elite'))
    horse.alpha_composite(get(horsepart('Accessories/Saddle '+gait+'.png')))
    return horse

PARTS=['body/bodies/male','feet/armour/plate/male','legs/armour/plate/male',
       'torso/armour/plate/male','arms/armour/plate/male','head/heads/human/male',
       'hat/helmet/armet/adult']

def composite(kind,state,index,direction):
    elite=kind=='elite'
    horse=horse_frame(kind,state,index,direction)
    # Anchors are fixed by view, rather than normalized per frame: hooves really
    # rise and fall during a gallop, without the body sliding vertically.
    foot=108 if direction==0 else 94
    hx,hy=32,AY-foot
    if state in ['run','attack','jump']:
        bob=[0,1,2,1,-1,-1][index%6]
    elif state=='walk':bob=[0,0,1,0,0,1][index%6]
    else:bob=index%2
    # The rider is seated on the source saddle. Preserve upper-body anatomy and
    # source-authored arm/spear poses; articulate the plate-clad legs at the knee.
    rx=64+(-1 if direction==1 else 1 if direction==3 else 0)
    ry=hy+(14 if direction in [1,3] else 20 if direction==0 else 10)+bob
    action='thrust'
    ri=index if state=='attack' else 3 if direction in [0,2] else 0
    rider=Image.new('RGBA',(64,64))
    for part in PARTS:
        im=cell(layer(part,action),ri,direction)
        if elite and ('armour' in part or 'helmet' in part):im=gold(im)
        rider.alpha_composite(im)
    # A real layered spear uses the matching arm pose, including its return.
    weapon_action='thrust'
    wi=ri
    def spear(part):
        path='spritesheets/weapon/polearm/spear/'+weapon_action+'/'+part+'.png'
        return cell(record('chapter-five/lpc-source/'+path,(LPC/path.replace('/','__')).read_bytes()),wi,direction)
    def add_spear(target,part):
        # A cavalry lance must reach beyond the horse's muzzle. Extend the
        # original pixel-art weapon around its hand grip, not a runtime line.
        weapon=spear(part)
        if direction in [1,3]:
            weapon=weapon.resize((112,64),Image.Resampling.NEAREST);pos=(rx-24,ry)
        else:
            weapon=weapon.resize((64,96),Image.Resampling.NEAREST);pos=(rx,ry-16)
        target.alpha_composite(weapon,pos)
    out=Image.new('RGBA',(CW,CW));out.alpha_composite(horse,(hx,hy))
    # Reins follow the source horse head and a fixed grip at the saddle.
    d=ImageDraw.Draw(out)
    if direction in [1,3]:
        headx=hx+(34 if direction==1 else 94)
        d.line([(headx,hy+49),(hx+64,hy+57+bob),(hx+65,hy+43+bob)],fill='#8d653c',width=1)
    # A short fitted tabard behind the rider; no duplicate procedural weapon.
    col='#7f263c' if elite else '#303f73';trim='#dbb567' if elite else '#a9bacb'
    d.polygon([(rx+22,ry+28),(rx+42,ry+28),(rx+45,ry+44),(rx+31,ry+48),(rx+19,ry+43)],fill=col)
    d.line([(rx+19,ry+43),(rx+31,ry+48),(rx+45,ry+44)],fill=trim,width=1)
    # Upper body retains the complete torso, head, arms and gauntlets.
    upper=rider.copy();upper.paste((0,0,0,0),(0,43,64,64))
    add_spear(out,'background')
    out.alpha_composite(upper,(rx,ry))
    if direction in [1,3]:
        # Lift the far leg behind the saddle; the near greave bends forward.
        leg=rider.crop((24,42,40,62))
        leg=leg.rotate(28 if direction==1 else -28,resample=Image.Resampling.NEAREST,expand=True)
        out.alpha_composite(leg,(rx+22,ry+36))
    else:
        for box,dx,rot in [((19,42,31,62),17,-19),((33,42,45,62),34,19)]:
            leg=rider.crop(box).rotate(rot,expand=True,resample=Image.Resampling.NEAREST)
            out.alpha_composite(leg,(rx+dx,ry+37))
    add_spear(out,'foreground')
    # Horse brow armour uses the helmet metal palette; the boss gets a crest.
    if elite:
        d=ImageDraw.Draw(out)
        if direction in [1,3]:
            xx=hx+(32 if direction==1 else 96)
            d.line([(xx,hy+40),(xx+(-3 if direction==1 else 3),hy+50)],fill='#ddc18a',width=2)
        d.line([(rx+29,ry+15),(rx+29,ry+8),(rx+36,ry+6),(rx+41,ry+10)],fill='#a53751',width=3)
    if state=='hurt':
        out=out.rotate([0,-5,0][index] if direction!=1 else [0,5,0][index],resample=Image.Resampling.NEAREST,center=(AX,AY))
    elif state=='down':
        # Six authored composite poses: knees buckle, rider falls with the mount.
        angles=[0,8,22,43,65,78];shift=[0,0,2,5,8,9]
        out=out.rotate((-1 if direction in [1,0] else 1)*angles[index],resample=Image.Resampling.NEAREST,center=(AX,AY-12))
        moved=Image.new('RGBA',(CW,CW));moved.alpha_composite(out,(0,shift[index]));out=moved
    return out

meta={'cellWidth':CW,'cellHeight':CW,'anchorX':AX,'anchorY':AY,'bodyHeight':BODY,
      'directions':DIRECTIONS,'license':'CC-BY-SA-3.0','units':{}}
for kind in ['cavalier','elite']:
    atlas=Image.new('RGBA',(8*CW,len(ACTIONS)*4*CW));rows={}
    for block,(state,count) in enumerate(ACTIONS.items()):
        rows[state]={'row':block*4,'count':count}
        for direction in range(4):
            for i in range(count):
                image=composite(kind,state,i,direction)
                assert image.getbbox(),(kind,state,i,direction)
                atlas.alpha_composite(image,(i*CW,(block*4+direction)*CW))
    atlas.save(OUT/(kind+'-actions.png'),optimize=True)
    meta['units'][kind]={'file':kind+'-actions.png','actions':rows}
(OUT/'mounted-actions.json').write_text(json.dumps(meta,indent=2)+'\n',encoding='utf-8')

city=record('LPC_city_inside.zip!LPC_city_inside/city_inside.png',cityzip.read('LPC_city_inside/city_inside.png'))
scenery=Image.new('RGBA',(512,512))
pieces={
 'stone':(288,160,32,32),
 'carpet':(0,0,160,96),'crest':(128,128,32,32),
 'plinth':(448,64,32,96),'bust':(480,64,32,32),
 'banner':(160,96,32,96),'plant':(352,96,32,64),
 'window':(384,96,32,64),'brazier':(512,0,32,32)
}
scenemeta={};sx=sy=0;rowh=0
for name,(x,y,w,h) in pieces.items():
    if sx+w>512:sx=0;sy+=rowh;rowh=0
    cut=city.crop((x,y,x+w,y+h))
    if name=='stone':
        # Recolour the source masonry to ivory while preserving its pixel texture.
        cut=ImageOps.colorize(ImageOps.grayscale(cut),'#b5a78c','#f1e5cf').convert('RGBA')
    # City carpet includes adjacent unrelated objects only outside the crop.
    scenery.alpha_composite(cut,(sx,sy));scenemeta[name]={'x':sx,'y':sy,'w':w,'h':h}
    sx+=w;rowh=max(rowh,h)
scenery.save(OUT/'palace-scenery.png',optimize=True)
(OUT/'scenery.json').write_text(json.dumps(scenemeta,indent=2)+'\n',encoding='utf-8')
(SRC/'horse-credits.txt').write_bytes(horsezip.read('LPC Horse Extended/Read Me.txt'))
(SRC/'city-credits.txt').write_bytes(cityzip.read('LPC_city_inside/credits.txt'))
manifest={'retrieved':'2026-11-18','derivativeLicense':'CC-BY-SA-3.0',
 'horseSource':'https://opengameart.org/content/lpc-horse-extended',
 'citySource':'https://opengameart.org/content/lpc-city-inside',
 'riderSource':'assets/chapter-five/knight-source-manifest.json',
 'files':[{'path':k,'sha256':v} for k,v in sorted(used.items())]}
(OUT/'source-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Built two mounted atlases: 288 poses, four directions, seven actions; palace scenery and source hashes.')
