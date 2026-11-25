"""Pack LPC Victorian Buildings windows/doors into a small campus atlas; CC BY-SA 3.0."""
from pathlib import Path
from PIL import Image,ImageDraw
import zipfile,io,json
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'assets/chapter-twelve';z=zipfile.ZipFile(OUT/'source/lpc-victorian-buildings.zip')
windows=Image.open(io.BytesIO(z.read('lpc-victorian-buildings/victorian-windows-doors.png'))).convert('RGBA')
specs={'window':(windows,(390,3696,442,3764)),'door':(windows,(848,1312,880,1376)),'fence':(windows,(432,4466,496,4480))}
treeszip=zipfile.ZipFile(OUT/'source/lpc-trees.zip')
trees=Image.open(io.BytesIO(treeszip.read('lpc-trees/trees-green.png'))).convert('RGBA')
atlas=Image.new('RGBA',(512,256));meta={}
for i,(name,(im,box)) in enumerate(specs.items()):
 crop=im.crop(box)
 if name=='window':
  for y in range(crop.height):
   for x in range(crop.width):
    r,g,b,a=crop.getpixel((x,y))
    if a and max(r,g,b)<70:crop.putpixel((x,y),(115,149,162,a))
 crop.thumbnail((96,128),Image.Resampling.NEAREST);atlas.alpha_composite(crop,(i*96,0));meta[name]=[i*96,0,crop.width,crop.height]
for i,(name,box) in enumerate({'campusOak':(704,224,832,352),'campusLinden':(576,224,704,352)}.items()):
 crop=trees.crop(box)
 # Match the animation's cool green shadows and sunlit foliage, without neon edges.
 pixels=[]
 for r,g,b,a in crop.getdata():
  if a and g>r*1.1 and g>b*1.1:
   r,g,b=round(r*.84+10),round(g*.86+10),round(b*.94+10)
  pixels.append((r,g,b,a))
 crop.putdata(pixels);atlas.alpha_composite(crop,(i*160,128));meta[name]=[i*160,128,128,128]
atlas.save(OUT/'school-scenery.png',optimize=True);(OUT/'school-scenery.json').write_text(json.dumps(meta,indent=2),encoding='utf-8')
bg=Image.new('RGBA',atlas.size,'#d0c9b7');bg.alpha_composite(atlas);bg.resize((1024,512),Image.Resampling.NEAREST).save(ROOT/'docs/previews/chapter-12-atlas.png');print(meta)
