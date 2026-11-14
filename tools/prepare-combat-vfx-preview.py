from PIL import Image
from pathlib import Path
root=Path(__file__).resolve().parents[1]/'docs/previews'
strip=Image.open(root/'combat-vfx-strip.png')
frames=[strip.crop((0,i*648,1152,(i+1)*648)).convert('RGB') for i in range(48)]
samples=Image.new('RGB',(1152,1296));samples.paste(frames[24],(0,0));samples.paste(frames[28],(0,648))
palette=samples.quantize(colors=256)
frames=[im.quantize(palette=palette,dither=Image.Dither.NONE) for im in frames]
frames[0].save(root/'combat-vfx-battle.gif',save_all=True,append_images=frames[1:],duration=[40]*47+[600],loop=0,optimize=False,disposal=2)
print('Wrote combat-vfx-battle.gif')
