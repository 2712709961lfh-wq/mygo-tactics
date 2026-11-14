import urllib.request,re,html,concurrent.futures
from pathlib import Path
urls=['lpc-lamp-posts-rework','lpc-city-inside','teleport-circle-sprite-sheet','magic-summoning-circle']
def get(n):
 try:
  s=urllib.request.urlopen(urllib.request.Request('https://opengameart.org/content/'+n,headers={'User-Agent':'Mozilla/5.0'}),timeout=20).read().decode('utf8','replace');Path('docs/research/chapter-six/'+n+'.html').write_text(s,encoding='utf8')
  t=re.sub(r'\s+',' ',html.unescape(re.sub('<[^>]+>',' ',s)));i=t.find('Author:');return n,re.findall(r'https?[^\s<>\"\']+\.(?:zip|png)',s)[:18],t[i:i+1500]
 except Exception as e:return n,str(e)
with concurrent.futures.ThreadPoolExecutor() as p:
 for r in p.map(get,urls):print(r)
