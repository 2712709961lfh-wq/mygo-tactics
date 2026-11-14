from PIL import Image,ImageDraw
from pathlib import Path
from collections import deque
r=Path('assets/chapter-five')
im=Image.open(r/'templar.png').convert('RGBA');print(im.size,im.getpixel((0,0)))
# Remove only the contiguous flat backdrop; retain the original painted silhouette.
pix=im.load();W,H=im.size;q=deque([(0,0)]);seen=set();bg=pix[0,0][:3]
while q:
 x,y=q.popleft()
 if (x,y) in seen or not (0<=x<W and 0<=y<H):continue
 seen.add((x,y));c=pix[x,y]
 if max(abs(c[i]-bg[i]) for i in range(3))>11:continue
 pix[x,y]=(0,0,0,0)
 q.extend(((x+1,y),(x-1,y),(x,y+1),(x,y-1)))
im=im.crop((270,0,1150,850));im.thumbnail((512,512),Image.Resampling.LANCZOS);im.save(r/'armored-cutout.png')
# Retain a minimal, actually used Kenney tile atlas for the standalone build.
ids=[13,64,208,250,253,263,275,190];atlas=Image.new('RGBA',(32*len(ids),32))
for i,n in enumerate(ids):
 tile=Image.open(r/f'urban-source/Tiles/tile_{n:04}.png').convert('RGBA').resize((32,32),Image.Resampling.NEAREST);atlas.paste(tile,(32*i,0))
atlas.save(r/'urban-atlas.png')
# Authored pixel rider, over Spring Spring's CC0 animated winged horse (33px frame stride).
sheet=Image.open(r/'pegasus.png').convert('RGBA');out=Image.new('RGBA',(36*7,48))
for i in range(7):
 frame=Image.new('RGBA',(36,48));frame.alpha_composite(sheet.crop((i*33+1,0,i*33+33,32)),(2,16));d=ImageDraw.Draw(frame)
 d.polygon([(13,12),(20,13),(23,29),(11,27),(10,17)],fill='#6e294a')
 d.line((13,14,12,25),fill='#b94c72',width=2)
 d.rectangle((15,13,20,22),fill='#a4b3c4');d.line((16,14,18,19),fill='#dce6e9',width=1)
 d.rectangle((15,7,20,13),fill='#c8d2dc');d.rectangle((18,9,22,11),fill='#29364b');d.point((20,10),fill='#d9e8ef')
 d.rectangle((14,6,19,8),fill='#e3e7eb');d.line((14,5,10,5),fill='#bb5275',width=2)
 d.line((19,17,24,20),fill='#7b8b9c',width=2);d.line((24,20,31,5),fill='#c1a476',width=1);d.polygon([(31,5),(32,1),(29,5)],fill='#e4f0f2')
 d.polygon([(13,18),(18,19),(18,26),(14,28),(11,24)],fill='#334b65',outline='#a7bac4')
 d.line((17,24,19,31),fill='#566478',width=3);d.line((18,31,22,31),fill='#313a50',width=2)
 out.alpha_composite(frame,(i*36,0))
out.save(r/'pegasus-rider.png')
