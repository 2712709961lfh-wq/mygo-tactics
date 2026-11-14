"""Cache the existing illustration library's public catalogue for asset selection."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import re, subprocess, json

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'tmp/equipment-catalogue'
CACHE.mkdir(parents=True, exist_ok=True)

def fetch(page):
    target = CACHE / ('page-%02d.html' % page)
    if not target.exists():
        subprocess.run(['curl.exe', '-L', '--fail', '--silent', '--show-error',
                        '--retry', '2', '--max-time', '45',
                        'https://www.freegameassets.com/fantasy-rpg-icons?page=%d' % page,
                        '-o', str(target)], check=True)
    content = target.read_text(encoding='utf-8')
    return sorted(set(re.findall(r'([a-z0-9-]+)-001\.png', content)))

with ThreadPoolExecutor(max_workers=5) as pool:
    pages = list(pool.map(fetch, range(1, 16)))
slugs = sorted(set(s for p in pages for s in p))
(CACHE / 'slugs.json').write_text(json.dumps(slugs, indent=2), encoding='utf-8')
print('Catalogue:', len(slugs), 'illustrations')
print('\n'.join(slugs))
