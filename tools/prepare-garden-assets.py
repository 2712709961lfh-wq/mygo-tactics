"""Unify the palette of the CC0 Kenney atlas, preserving source and alpha."""
from pathlib import Path
from PIL import Image, ImageEnhance
root = Path(__file__).resolve().parents[1]
folder = root / 'assets/terrain/kenney/roguelike-rpg'
source = Image.open(folder / 'Spritesheet/roguelikeSheet_transparent.png').convert('RGBA')
rgb = ImageEnhance.Color(source.convert('RGB')).enhance(.63)
rgb = ImageEnhance.Brightness(rgb).enhance(.86)
rgb = Image.blend(rgb, Image.new('RGB', rgb.size, '#51636a'), .07)
rgb.putalpha(source.getchannel('A'))
rgb.save(folder / 'garden-atlas.png')
print('Prepared unified dusk palette: garden-atlas.png')
