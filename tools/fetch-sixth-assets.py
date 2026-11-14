import urllib.request,concurrent.futures,zipfile,io
from pathlib import Path
root=Path(__file__).resolve().parents[1]/'assets/chapter-six/source';root.mkdir(parents=True,exist_ok=True)
urls={'lamps.zip':'https://opengameart.org/sites/default/files/lpc_lamp_posts_rework-1.0.zip','furniture.zip':'https://opengameart.org/sites/default/files/LPC_city_inside.zip','teleport.png':'https://opengameart.org/sites/default/files/teleportCircle_0.png'}
def get(kv):
 k,u=kv;data=urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'Mozilla/5.0'}),timeout=25).read();(root/k).write_bytes(data)
 if k.endswith('.zip'):zipfile.ZipFile(io.BytesIO(data)).extractall(root/k[:-4])
 return k,len(data)
with concurrent.futures.ThreadPoolExecutor() as p:
 for v in p.map(get,urls.items()):print(v)
