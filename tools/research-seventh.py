"""Fetch visual references and free music-room art pages, retaining source HTML."""
from pathlib import Path
import urllib.request,urllib.parse,re,html,concurrent.futures
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/research/chapter-seven';OUT.mkdir(parents=True,exist_ok=True)
urls={
 'speaker':'https://opengameart.org/content/speaker',
 'music-icons':'https://opengameart.org/content/cc0-music-icons',
 'tavern':'https://opengameart.org/content/lpc-tavern',
 'urban-pack':'https://opengameart.org/content/rpg-urban-pack',
 'shelter':'https://www.loft-prj.co.jp/SHELTER/',
 'starry':'https://bocchi-the-rock.fandom.com/wiki/STARRY',
 'oga-pixel-music':'https://opengameart.org/art-search-advanced?keys=music&field_art_type_tid%5B%5D=9',
 'oga-drums':'https://opengameart.org/art-search-advanced?keys=drum&field_art_type_tid%5B%5D=9',
 'oga-speaker':'https://opengameart.org/art-search-advanced?keys=speaker&field_art_type_tid%5B%5D=9',
 'oga-guitar':'https://opengameart.org/art-search-advanced?keys=guitar&field_art_type_tid%5B%5D=9',
 'concert-props':'https://opengameart.org/content/lowpoly-concert-props',
 'modern-furniture':'https://opengameart.org/content/lpc-simple-modern-furniture',
 'kenney':'https://kenney.nl/assets/roguelike-modern-city',
 'shelter-about':'https://www.loft-prj.co.jp/SHELTER/about.html',
}
def fetch(item):
 name,url=item
 try:
  data=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=25).read().decode('utf8','replace');(OUT/(name+'.html')).write_text(data,encoding='utf8')
  links=list(dict.fromkeys(re.findall(r'href="([^"]+)"',data)));links=[html.unescape(x) for x in links if '/content/' in x or re.search(r'\.(png|zip|jpg)',x) or 'download' in x]
  text=re.sub(r'\s+',' ',html.unescape(re.sub('<[^>]+>',' ',data)))
  return name,links[:55],text[text.find('License'):text.find('License')+700]
 except Exception as e:return name,str(e)
with concurrent.futures.ThreadPoolExecutor() as pool:
 for result in pool.map(fetch,urls.items()):print(result)
