import urllib.request,re,concurrent.futures,html
from pathlib import Path
folder=Path('docs/research/chapter-six');folder.mkdir(parents=True,exist_ok=True)
urls=['https://opengameart.org/art-search-advanced?keys=throne','https://opengameart.org/art-search-advanced?keys=street+lamp','https://opengameart.org/content/particle-pack-80-sprites','https://opengameart.org/art-search-advanced?keys=magic+circle']
def get(u):
 try:
  s=urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'Mozilla/5.0'}),timeout=22).read().decode('utf8','replace');(folder/('search-'+str(urls.index(u))+'.html')).write_text(s,encoding='utf8')
  titles=re.findall(r'<a href="(/content/[^"?#]+)"[^>]*>(.*?)</a>',s,re.S);links=re.findall(r'https?[^\s<>\"\']+\.(?:zip|png)',s)
  t=html.unescape(re.sub('<[^>]+>',' ',s));t=re.sub(r'\s+',' ',t);i=t.find('License')
  return u,list(dict.fromkeys(a for a,b in titles))[:20],links[:10],t[max(0,i-150):i+750]
 except Exception as e:return u,str(e)
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as p:
 for r in p.map(get,urls):print(r)
