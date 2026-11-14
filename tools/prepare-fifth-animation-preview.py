"""Pack the real BattleScene frame strip produced by render-fifth-preview.js."""
from pathlib import Path
from PIL import Image

OUT=Path(__file__).resolve().parents[1]/'docs/previews'
strip=Image.open(OUT/'chapter-05-animation-strip.png').convert('RGB')
frames=[strip.crop((0,i*324,1152,(i+1)*324)).resize((960,270),Image.Resampling.LANCZOS) for i in range(40)]
frames[0].save(OUT/'chapter-05-knight-battle.gif',save_all=True,append_images=frames[1:],
               duration=50,loop=0,disposal=2)
print('Saved chapter-05-knight-battle.gif from 40 production battle frames.')
