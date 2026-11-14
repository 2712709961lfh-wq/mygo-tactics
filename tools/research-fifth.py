"""Collect chapter references and inspect reusable map/enemy art sources."""
import urllib.request, re, concurrent.futures, html
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
URLS=[
 'https://opengameart.org/content/greek-hypaspist-persian-foot-archer-pegasus-pony',
 'https://opengameart.org/content/armored-man',
 'https://opengameart.org/content/knight-2',
 'https://opengameart.org/content/rpg-urban-pack',
 'https://fireemblemwiki.org/wiki/Warrior_Realm',
 'https://serenesforest.net/awakening/miscellaneous/chapter-guide/']
def read(url):
 try:
  req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'})
  raw=urllib.request.urlopen(req,timeout=18).read().decode('utf-8','replace')
  folder=ROOT/'docs/research/chapter-five';folder.mkdir(parents=True,exist_ok=True)
  name=url.rstrip('/').split('/')[-1];(folder/(name+'.html')).write_text(raw,encoding='utf-8')
  links=re.findall(r'https?[^\s<>\"\']+\.(?:zip|png|gif|jpg|7z)',raw)
  lines=html.unescape(re.sub('<[^>]+>',' ',raw))
  lines=re.sub(r'\s+',' ',lines)
  pos=lines.find('License') if 'opengameart' in url else lines.find('Raimi')
  return url,links[:22],lines[max(0,pos-200):pos+3000]
 except Exception as e:return url,str(e)
if __name__=='__main__':
 with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
  for result in pool.map(read,URLS):print(result)
