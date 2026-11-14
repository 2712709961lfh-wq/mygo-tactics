"""Build a compact, transparent animation atlas from credited CC0 originals."""
from PIL import Image
from pathlib import Path
import json, hashlib, math

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'assets/effects/combat'
SOURCE = BASE / 'source'
CELL = 128
tracks = {}
inputs = {}

def read(rel):
    p = SOURCE / rel
    inputs[rel] = hashlib.sha256(p.read_bytes()).hexdigest()
    return Image.open(p).convert('RGBA')

def tint(im, color):
    # Keep authored alpha/soft falloff; map bright cores toward white.
    rgb = Image.new('RGB', im.size)
    rgb.putdata([tuple(round(c * (0.48 + 0.52 * max(r,g,b)/255) + (255-c)*(max(r,g,b)/255)**5)
                       for c in color) for r,g,b,a in im.getdata()])
    rgb.putalpha(im.getchannel('A'))
    return rgb

def weapon(group, variant, color=None, horizontal=False):
    frames=[]
    for i in range(6):
        prefix = 'Classic' if variant == 'Classic' else 'Alternative_'+variant[-1]
        im=read(f'cethiel/unpacked/{variant}/{group}/{prefix}_{(group-1)*6+i+1:02d}.png')
        if horizontal: im=im.rotate(-45, resample=Image.Resampling.BICUBIC, expand=True)
        if color: im=tint(im,color)
        im.thumbnail((120,120),Image.Resampling.LANCZOS)
        cell=Image.new('RGBA',(CELL,CELL));cell.alpha_composite(im,((CELL-im.width)//2,(CELL-im.height)//2));frames.append(cell)
    return frames

def particles(pack, file, count=24, color=None):
    sheet=read(f'{pack}/unpacked/{file}.png');frames=[]
    for i in range(count):
        f=round(i*63/(count-1));x=f%8*128;y=f//8*128
        im=sheet.crop((x,y,x+128,y+128))
        if color: im=tint(im,color)
        frames.append(im)
    return frames

def contact_glints(color):
    # A compact radial flash has no authored swing direction. It can accompany
    # horizontal cuts, overhead chops and spinning attacks without contradicting them.
    sheet=read('para1/unpacked/particlefx_14.png')
    frames=[]
    for f in [4,5,6,7,6,5]:
        im=sheet.crop((f%8*128,f//8*128,(f%8+1)*128,(f//8+1)*128))
        im=im.crop((32,32,96,96)).resize((128,128),Image.Resampling.LANCZOS)
        frames.append(tint(im,color))
    return frames

tracks['sword']=contact_glints((142,225,255))
tracks['axe']=contact_glints((255,192,100))
tracks['lance']=weapon(5,'Alternative 2',horizontal=True)
tracks['spark']=weapon(4,'Classic')
colors={'fire':(255,112,36),'ice':(111,217,255),'wind':(112,242,173),'thunder':(255,222,93),
        'dark':(169,96,246),'light':(255,228,152),'arcane':(181,150,255)}
for element,color in colors.items(): tracks['bolt_'+element]=weapon(4 if element=='fire' else 5,'Classic',color,True)
sources={'fire':'particlefx_10','ice':'particlefx_14','wind':'particlefx_08','thunder':'particlefx_13',
         'dark':'particlefx_12','light':'particlefx_13','arcane':'particlefx_08'}
for element,file in sources.items(): tracks['hit_'+element]=particles('para1',file,color=None if element in ['fire','ice'] else colors[element])
tracks['dust']=particles('para1','particlefx_04',16)

row=0;meta={}
for key,frames in tracks.items():
    meta[key]={'row':row,'count':len(frames)};row+=math.ceil(len(frames)/8)
atlas=Image.new('RGBA',(8*CELL,row*CELL))
for key,frames in tracks.items():
    for i,im in enumerate(frames): atlas.alpha_composite(im,(i%8*CELL,(meta[key]['row']+i//8)*CELL))
atlas.save(BASE/'combat-atlas.png',optimize=True)
(BASE/'combat-atlas.json').write_text(json.dumps({'cell':CELL,'columns':8,'tracks':meta,'inputs':inputs},indent=2)+'\n',encoding='utf8')
print(f'{len(tracks)} tracks, {sum(map(len,tracks.values()))} frames, atlas {atlas.size}, {(BASE/"combat-atlas.png").stat().st_size:,} bytes')
