"""Fetch the licensed art used by chapter five; run prepare-fifth-art.py afterwards."""
import concurrent.futures,io,urllib.request,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/'assets/chapter-five'
SOURCES={
 'pegasus.png':'https://opengameart.org/sites/default/files/pegasus%20pony_0.png',
 'templar.png':'https://opengameart.org/sites/default/files/templar1.png',
 'urban.zip':'https://opengameart.org/sites/default/files/kenney_RPGurbanPack.zip',
 '../../docs/research/chapter-five/awakening-chapter-03-reference.png':'https://cdn.fireemblemwiki.org/f/fe/Cm_fe13_3_full.png'}
def fetch(source):
 name,url=source
 data=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=30).read()
 target=ART/name
 if name.startswith('../'):target=ROOT/'docs/research/chapter-five/awakening-chapter-03-reference.png'
 target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
 if name.endswith('.zip'):zipfile.ZipFile(io.BytesIO(data)).extractall(ART/'urban-source')
 return target.name,len(data)
if __name__=='__main__':
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
  for result in pool.map(fetch,SOURCES.items()):print(result)
