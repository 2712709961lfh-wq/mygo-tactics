"""Inspect the actual mounted atlases at pixel scale, with looping gait previews."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/previews'
ART=ROOT/'assets/chapter-ten'
META=json.loads((ART/'mounted-actions.json').read_text())
FONT=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',18)
TITLE=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',23)
ATLAS={k:Image.open(ART/v['file']).convert('RGBA') for k,v in META['units'].items()}
DIRS=['背面','朝左','正面','朝右']


def preview(state,index):
    out=Image.new('RGB',(1280,590),'#cbbfa9');d=ImageDraw.Draw(out)
    d.text((20,10),'战马骑士 · 马鞍定位、跨坐双腿与脚蹬',font=TITLE,fill='#283442')
    for row,(kind,atlas) in enumerate(ATLAS.items()):
        spec=META['units'][kind]['actions'][state]
        for direction in range(4):
            f=index%spec['count'];y=(spec['row']+direction)*192
            pose=atlas.crop((f*192,y,(f+1)*192,y+192)).crop((16,40,176,168))
            pose=pose.resize((320,256),Image.Resampling.NEAREST)
            x=direction*320;y=40+row*270
            out.paste(pose,(x,y+14),pose)
            label=('金鬃卫长' if kind=='elite' else '战马骑士')+' / '+DIRS[direction]
            d.text((x+18,y+6),label,font=FONT,fill='#283442')
    return out

preview('idle',0).save(OUT/'chapter-10-mounted-seat.png')
for state,delay in [('walk',140),('run',100)]:
    frames=[preview(state,i) for i in range(6)]
    frames[0].save(OUT/('chapter-10-mounted-seat-'+state+'.gif'),save_all=True,
                   append_images=frames[1:],duration=delay,loop=0,optimize=True)
# All running poses together reveal per-frame pelvis, knee and saddle drift.
sheet=Image.new('RGB',(1152,808),'#cbbfa9');d=ImageDraw.Draw(sheet)
for direction in range(4):
    for f in range(6):
        y=(META['units']['elite']['actions']['run']['row']+direction)*192
        pose=ATLAS['elite'].crop((f*192,y,(f+1)*192,y+192))
        sheet.paste(pose,(f*192,direction*202+10),pose)
        d.text((f*192+8,direction*202+5),DIRS[direction]+' '+str(f+1),font=FONT,fill='#283442')
sheet.save(OUT/'chapter-10-mounted-seat-run-frames.png')
strip=OUT/'chapter-10-mounted-battle-strip.png'
if strip.exists():
    im=Image.open(strip)
    frames=[im.crop((0,i*324,576,(i+1)*324)).convert('RGB').resize((864,486),Image.Resampling.NEAREST) for i in range(32)]
    frames[0].save(OUT/'chapter-10-mounted-battle.gif',save_all=True,append_images=frames[1:],duration=65,loop=0,optimize=True)
print('Rendered four-direction seated closeups, walking/running loops and all 24 boss running poses.')
