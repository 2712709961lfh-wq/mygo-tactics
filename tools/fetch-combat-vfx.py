"""Fetch the CC0 originals used for combat VFX (run from any directory)."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import urllib.request, hashlib, json, zipfile

ROOT = Path(__file__).resolve().parents[1] / 'assets/effects/combat'
SOURCES = [
    ('cethiel', 'https://opengameart.org/content/weapon-slash-effect', 'https://opengameart.org/sites/default/files/Everything_0.zip'),
    ('para1', 'https://opengameart.org/content/animated-particle-effects-1', 'https://opengameart.org/sites/default/files/para_CC0_particlefx-1.zip'),
]

def fetch(source):
    name, page, url = source
    dest = ROOT / 'source' / name
    dest.mkdir(parents=True, exist_ok=True)
    def read(url):
        return urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0'}), timeout=120).read()
    archive = dest / 'original.zip'
    if not archive.exists(): archive.write_bytes(read(url))
    if not (dest / 'source.html').exists(): (dest / 'source.html').write_bytes(read(page))
    with zipfile.ZipFile(archive) as z:
        for member in z.infolist():
            target = (dest / 'unpacked' / member.filename).resolve()
            if not target.is_relative_to((dest / 'unpacked').resolve()): raise ValueError(member.filename)
        z.extractall(dest / 'unpacked')
    return dict(name=name, page=page, download=url, license='CC0-1.0', sha256=hashlib.sha256(archive.read_bytes()).hexdigest())

if __name__ == '__main__':
    with ThreadPoolExecutor(max_workers=3) as pool: records = list(pool.map(fetch, SOURCES))
    (ROOT / 'sources.json').write_text(json.dumps(records, indent=2)+'\n', encoding='utf8')
    print(json.dumps(records, indent=2))
