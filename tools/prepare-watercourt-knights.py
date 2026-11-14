"""Compose complete LPC plate knights from real synchronized animation layers.

No generated weapon geometry or single-image motion: spear/axe pixels are baked
into each source-authored pose. Local inputs and their SHA256s travel with repo.
"""
from pathlib import Path
import csv, hashlib, json
from PIL import Image, ImageOps, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/chapter-five'
SRC=OUT/'lpc-source'
CW=CH=192
AX,AY=96,124
PARTS=['body/bodies/male','feet/armour/plate/male','legs/armour/plate/male',
       'torso/armour/plate/male','arms/armour/plate/male','head/heads/human/male',
       'hat/helmet/armet/adult']
used=set()

def source(path):
    used.add(path)
    return Image.open(SRC/path.replace('/','__')).convert('RGBA')

def frame(im, index, direction, size=64):
    row=direction if im.height>size else 0
    return im.crop((index*size,row*size,(index+1)*size,(row+1)*size))

def gold(im):
    # Recolour only metal layers, retaining every original highlight and contour.
    im=im.copy();pixels=[]
    for r,g,b,a in im.getdata():
        l=(r*3+g*6+b)/10/255
        pixels.append((round(36+211*l),round(27+182*l),round(30+112*l),a))
    im.putdata(pixels);return im

def composite(kind,action,index,direction):
    state='thrust' if action=='attack' and kind=='armor' else 'slash' if action=='attack' else \
          'hurt' if action in ['hurt','down'] else action
    srcindex=[0,1,0][index] if action=='hurt' else index+1 if action=='walk' else index
    im=Image.new('RGBA',(CW,CH))
    if kind=='armor':
        ws='thrust' if action=='attack' else 'hurt' if action in ['hurt','down'] else 'walk'
        wi=srcindex if ws in ['thrust','hurt'] else srcindex if action=='walk' else 0
        back=frame(source('spritesheets/weapon/polearm/spear/'+ws+'/background.png'),wi,direction)
        front=frame(source('spritesheets/weapon/polearm/spear/'+ws+'/foreground.png'),wi,direction)
        im.alpha_composite(back,(64,64))
    else:
        ws='attack_slash' if action=='attack' else 'hurt' if action in ['hurt','down'] else 'walk'
        wi=srcindex if ws in ['attack_slash','hurt'] or action=='walk' else 0
        size=192 if ws=='attack_slash' else 64
        front=frame(source('spritesheets/weapon/blunt/waraxe/'+ws+'/waraxe.png'),wi,direction,size)
        if ws=='attack_slash':
            back=frame(source('spritesheets/weapon/blunt/waraxe/attack_slash/behind/waraxe.png'),wi,direction,192)
            im.alpha_composite(back,(0,0))
        elif ws=='walk':
            back=frame(source('spritesheets/weapon/blunt/waraxe/behind/walk/waraxe.png'),wi,direction)
            im.alpha_composite(back,(64,64))
    for part in PARTS:
        layer=frame(source('spritesheets/'+part+'/'+state+'.png'),srcindex,direction)
        if kind=='warden' and ('armour' in part or 'helmet' in part):layer=gold(layer)
        im.alpha_composite(layer,(64,64))
    im.alpha_composite(front,(0,0) if front.width==192 else (64,64))
    return im

meta={'cellWidth':CW,'cellHeight':CH,'anchorX':AX,'anchorY':AY,'bodyHeight':48,
      'directions':['up','left','down','right'],'license':'CC-BY-SA-3.0',
      'source':'LPC synchronized body, plate armour, armet helmet and weapon animation layers',
      'units':{}}
for kind in ['armor','warden']:
    actions={'idle':2,'walk':8,'attack':8 if kind=='armor' else 6,'hurt':3,'down':6,'jump':5}
    atlas=Image.new('RGBA',(8*CW,len(actions)*4*CH));rows={}
    for row,(action,count) in enumerate(actions.items()):
        rows[action]={'row':row*4,'count':count}
        for direction in range(4):
            for i in range(count):
                cell=composite(kind,action,i,direction)
                assert cell.getbbox(),(kind,action,i,direction)
                atlas.alpha_composite(cell,(i*CW,(row*4+direction)*CH))
    atlas.save(OUT/(kind+'-actions.png'),optimize=True)
    meta['units'][kind]={'file':kind+'-actions.png','actions':rows}

# Readable contact sheet: weapon motion is visible in each attack frame.
preview=Image.new('RGB',(1152,880),'#192c3c');d=ImageDraw.Draw(preview)
font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',18)
for k,kind in enumerate(['armor','warden']):
    d.text((18,k*440+8),'重装兵 · 连贯突刺' if k==0 else '铁幕守卫长 · 连贯挥斧',font=font,fill='#ebd4ab')
    for action,y,indices in [('attack',50,range(8 if kind=='armor' else 6)),('walk',250,range(8))]:
        for i in indices:
            cell=composite(kind,action,i,3)
            # Actual 64px character fits ~90px high, with room for oversized axe.
            cell=cell.resize((288,288),Image.Resampling.NEAREST)
            preview.paste(cell,(i*144-72,k*440+y-66),cell)
preview.save(ROOT/'docs/previews/chapter-05-knight-actions.png')

# Full upstream credit table is retained, plus a focused manifest for used files.
with (SRC/'CREDITS.csv').open(encoding='utf-8') as f:credits=list(csv.DictReader(f))
prefixes={p.rsplit('/',1)[0].replace('spritesheets/','') for p in used}
relevant=[r for r in credits if any(r['filename'].startswith(p+'/') for p in prefixes) or
          any(s in r['filename'] for s in ['weapon/blunt/waraxe/','weapon/polearm/spear/'])]
manifest={'repository':'https://github.com/liberatedpixelcup/Universal-LPC-Spritesheet-Character-Generator',
          'retrieved':'2026-11-13','selectedLicense':'CC-BY-SA-3.0',
          'files':[{'path':p,'sha256':hashlib.sha256((SRC/p.replace('/','__')).read_bytes()).hexdigest()}
                   for p in sorted(used)],'credits':relevant}
(OUT/'knight-source-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(OUT/'knight-actions.json').write_text(json.dumps(meta,indent=2)+'\n',encoding='utf-8')
print('Composed plate knight and axe commander: 128 / 120 direction-specific real poses; source hashes and credits saved.')
