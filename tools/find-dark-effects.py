"""Find reusable effect textures online and retain their exact source/license."""
import urllib.request, re, json, io, zipfile
from pathlib import Path
headers = {'User-Agent': 'Mozilla/5.0'}
def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=25).read()
for url in ['https://opengameart.org/art-search-advanced?keys=particle+pack',
            'https://kenney.nl/assets/particle-pack']:
    try:
        s=get(url).decode()
        print(url)
        print('\n'.join(re.findall(r'href=[\"\']([^\"\']+(?:zip|png|/content/[^\"\']*))[\"\']',s)[:45]))
    except Exception as e: print(type(e).__name__,str(e))
