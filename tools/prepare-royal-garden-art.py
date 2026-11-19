"""Pack credited OpenGameArt garden details, retaining original downloads.

WaterFountain: Sharm / Curt / William.Thompsonj, CC BY 3.0.
Statues collection and plants: CC BY-SA 3.0; see assets/chapter-eleven/SOURCES.md.
Composite atlas is provided under CC BY-SA 3.0.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import zipfile, io, json, hashlib

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/chapter-eleven'; SRC=OUT/'source'
statues=zipfile.ZipFile(SRC/'statues-fountains-0.6.zip')
plantszip=zipfile.ZipFile(SRC/'lpc-flowers-plants-fungi-wood.zip')
used={}
def read_zip(z,name):
    data=z.read(name);used[name]=hashlib.sha256(data).hexdigest()
    return Image.open(io.BytesIO(data)).convert('RGBA')
def statue(name):return read_zip(statues,'static/PNG/32x32/'+name)
plants=read_zip(plantszip,'lpc-flowers-plants-fungi-wood/plants.png')
def plant(box):
    im=plants.crop(box);px=[]
    for r,g,b,a in im.getdata():
        if g>r*1.18: r,g,b=round(r*.9+10),round(g*.84+6),round(b*.9+4)
        elif r>g*1.15 and b>g*1.12:r,g,b=round(r*.88+12),round(g*.94+12),round(b*.82+8)
        px.append((r,g,b,a))
    im.putdata(px);return im
def ivory(im):
    im=im.copy();px=[]
    for r,g,b,a in im.getdata():
        light=(r*3+g*6+b)/2550
        px.append((round(43+201*light),round(50+182*light),round(45+151*light),a))
    im.putdata(px);return im
def water(im):
    im=im.copy();px=[]
    for r,g,b,a in im.getdata():
        if b>r*1.15 and g>r*1.05:
            light=(g+b)/510;px.append((round(28+93*light),round(78+124*light),round(86+121*light),a))
        elif r>g*1.1 and g>b*1.25:
            light=(r*3+g*6+b)/2550;px.append((round(70+162*light),round(63+142*light),round(42+100*light),a))
        else:px.append((r,g,b,a))
    im.putdata(px);return im

fountain=Image.open(SRC/'WaterFountain.png').convert('RGBA')
used['WaterFountain.png']=hashlib.sha256((SRC/'WaterFountain.png').read_bytes()).hexdigest()
sprites={
 'fountain0':water(fountain.crop((0,0,64,96))),
 'fountain1':water(fountain.crop((64,0,128,96))),
 'angel':ivory(statue('angel.png').crop((0,0,32,64))),
 'knight':ivory(statue('knight-sword-1-small.png').crop((0,0,64,96))),
 'lion':ivory(statue('foodog.png')),
 'column':ivory(statue('column-2.png')),
 'pedestal':ivory(statue('pedestal.png')),
 'rosePink':plant((320,64,352,96)),
 'roseIvory':plant((416,64,448,96)),
 'roseRed':plant((320,96,352,128)),
 'roseBlue':plant((384,96,416,128)),
 'flowerBush':plant((352,192,384,224)),
 'hedge':plant((256,896,320,928)),
 'roundBush':plant((448,832,480,864)),
 'cypress':plant((224,960,256,1024)),
 'topiary':plant((312,832,352,896)),
 'lily':plant((32,512,64,544)),
}
CW,CH,COLS=96,128,8
atlas=Image.new('RGBA',(CW*COLS,CH*((len(sprites)+COLS-1)//COLS)))
meta={}
preview=Image.new('RGBA',(CW*COLS,CH*((len(sprites)+COLS-1)//COLS)),'#cbbfa2');d=ImageDraw.Draw(preview)
for i,(name,im) in enumerate(sprites.items()):
    x=i%COLS*CW;y=i//COLS*CH;atlas.alpha_composite(im,(x,y));meta[name]=[x,y,im.width,im.height]
    preview.alpha_composite(im,(x+(CW-im.width)//2,y+18));d.text((x+2,y+CH-15),name,fill='#202d30')
atlas.save(OUT/'royal-details.png',optimize=True)
(OUT/'royal-details.json').write_text(json.dumps({'sprites':meta,'sourceSha256':used},indent=2),encoding='utf-8')
preview.resize((preview.width*2,preview.height*2),Image.Resampling.NEAREST).save(ROOT/'docs/previews/chapter-11-details-atlas.png')
print(json.dumps(meta,indent=2))
