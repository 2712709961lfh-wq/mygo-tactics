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
    bare_horse=horse.copy()
    horse.alpha_composite(cloth(get(horsepart('Accessories/Blanket '+gait+'.png')),kind=='elite'))
    saddle=get(horsepart('Accessories/Saddle '+gait+'.png'))
    horse.alpha_composite(saddle)
    # Locate the seat from this exact saddle frame, including gallop suspension.
    x0,y0,x1,y1=saddle.getbbox()
    seat=((x0+x1)//2,y0+(9 if direction==0 else 7 if direction==2 else 3))
    # The front-facing head must occlude the inner thighs, never the saddle.
    front=bare_horse.crop((seat[0]-10,y0+6,seat[0]+11,y0+34))
    return horse,seat,front

PARTS=['body/bodies/male','feet/armour/plate/male','legs/armour/plate/male',
       'torso/armour/plate/male','arms/armour/plate/male','head/heads/human/male',
       'hat/helmet/armet/adult']

def composite(kind,state,index,direction):
    elite=kind=='elite'
    horse,seat,front=horse_frame(kind,state,index,direction)
    # Fixed hoof-space origin preserves the source gait's suspension.
    foot=108 if direction==0 else 94
    hx,hy=32,AY-foot
    sx,sy=hx+seat[0],hy+seat[1]
    # The human pelvis is at (32,47), not the bottom of a standing sprite.
    rx,ry=sx-32,sy-47
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
            # Frontal foreshortening keeps the source hand/shaft occlusions;
            # stretching their transparent gaps makes the spear float.
            pos=(rx,ry)
        target.alpha_composite(weapon,pos)
    out=Image.new('RGBA',(CW,CW))
    col='#7f263c' if elite else '#303f73'
    edge='#342e34';dark='#70552f' if elite else '#4c4c5b'
    metal='#bc9851' if elite else '#8d8d9d'
    light='#f4daa0' if elite else '#d1d0cb'

    def mounted_leg(target,hip,knee,ankle,side,far=False):
        # Each thigh and greave articulates separately. A standing pair of legs
        # cannot be rotated into a seated silhouette.
        d=ImageDraw.Draw(target)
        for start,end,width in [(hip,knee,8),(knee,ankle,6)]:
            d.line([start,end],fill=edge,width=width)
            d.line([start,end],fill=dark if far else metal,width=width-2)
            if not far:d.line([(start[0]-1,start[1]),(end[0]-1,end[1])],fill=light,width=1)
        kx,ky=knee
        d.ellipse((kx-3,ky-3,kx+3,ky+3),fill=edge)
        d.ellipse((kx-2,ky-2,kx+2,ky+1),fill=dark if far else light)
        # Keep the authored plate boot's toe and outline, using one foot only.
        box={0:(22 if side<0 else 33,55,31 if side<0 else 42,62),
             1:(21,55,31,63),2:(20 if side<0 else 34,55,30 if side<0 else 44,64),
             3:(33,55,43,63)}[direction]
        boot=cell(layer('feet/armour/plate/male','thrust'),ri,direction).crop(box)
        if elite:boot=gold(boot)
        ax,ay=ankle
        target.alpha_composite(boot,(ax-boot.width//2,ay-2))
        # Leather descends from the saddle to a metal stirrup beneath the boot.
        d=ImageDraw.Draw(target)
        d.line([(hip[0],hip[1]+2),(ax+2,ay+2)],fill='#64452d',width=1)
        d.line([(ax-4,ay+2),(ax-4,ay+4),(ax+4,ay+4),(ax+4,ay+2)],fill=dark if far else light,width=1)

    if direction in [1,3]:
        facing=-1 if direction==1 else 1
        # Far thigh passes behind the barrel; near thigh goes over the blanket.
        mounted_leg(out,(sx+3,sy),(sx+3+facing*10,sy+9),(sx+3+facing*6,sy+21),facing,True)
    out.alpha_composite(horse,(hx,hy))
    add_spear(out,'background')
    d=ImageDraw.Draw(out)
    # Small skirt over the hips; the complete breastplate ends at the seat.
    d.polygon([(sx-8,sy-5),(sx+8,sy-5),(sx+10,sy+3),(sx,sy+5),(sx-10,sy+3)],fill=col)
    if direction in [1,3]:
        mounted_leg(out,(sx,sy),(sx+facing*10,sy+9),(sx+facing*6,sy+21),facing)
    else:
        for side in [-1,1]:
            mounted_leg(out,(sx+side*6,sy),(sx+side*15,sy+9),(sx+side*14,sy+22),side)
    # Preserve the whole torso down to its pelvis. Breathing changes the chest,
    # while the pelvis and both articulated legs remain fixed to the saddle.
    upper=rider.copy();upper.paste((0,0,0,0),(0,49,64,64))
    breath=-1 if state=='idle' and index==1 else 0
    out.alpha_composite(upper,(rx,ry+breath))
    if direction==2:
        # From the front the horse's neck/head stands in front of the rider's
        # waist and inner thighs, while the knees remain outside its shoulders.
        out.alpha_composite(front,(sx-10,sy-1))
    # Reins connect the saddle-side hand to the actual moving horse head.
    d=ImageDraw.Draw(out)
    if direction in [1,3]:
        # The brow's frame-dependent bounds follow the galloping head, rather
        # than an unrelated sinusoidal rider bob.
        head=horse.crop((0 if direction==1 else 80,20,48 if direction==1 else 128,54)).getbbox()
        headx=hx+(head[0]+5 if direction==1 else 80+head[2]-5)
        heady=hy+20+head[3]-4
        hand=(rx+(37 if direction==1 else 26),ry+41+breath)
        d.line([(headx,heady),(sx+facing*10,sy-1),hand],fill='#302b29',width=2)
        d.line([(headx,heady),(sx+facing*10,sy-1),hand],fill='#b08a56',width=1)
    elif direction==2:
        d.line([(sx-9,sy-7),(sx-10,sy-12),(sx-7,sy-14)],fill='#8d653c',width=1)
        d.line([(sx+9,sy-7),(sx+10,sy-12),(sx+7,sy-14)],fill='#8d653c',width=1)
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
