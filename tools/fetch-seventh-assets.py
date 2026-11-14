"""Download CC0 music props and preserve the original packages."""
from pathlib import Path
import urllib.request,zipfile,io,concurrent.futures
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'assets/chapter-seven/source';OUT.mkdir(parents=True,exist_ok=True)
urls={'speaker.png':'https://opengameart.org/sites/default/files/speaker_1.png','music-icons.zip':'https://opengameart.org/sites/default/files/music-ocal_20201227.zip','music-dcss.zip':'https://opengameart.org/sites/default/files/music-dcss_20201227.zip','music-fleurman.zip':'https://opengameart.org/sites/default/files/music-fleurman_20201227.zip'}
def fetch(item):
 name,url=item;data=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=30).read();(OUT/name).write_bytes(data)
 if name.endswith('.zip'):zipfile.ZipFile(io.BytesIO(data)).extractall(OUT/name[:-4])
 return name,len(data)
with concurrent.futures.ThreadPoolExecutor() as pool:
 for result in pool.map(fetch,urls.items()):print(result)
