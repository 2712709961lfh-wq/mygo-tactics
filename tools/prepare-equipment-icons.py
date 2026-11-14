"""Prepare a distinct transparent illustration per codex entry from one CC0 pack.
Assignments are explicit so catalogue reordering cannot change illustrations.
Run with Python + Pillow; downloads are validated and reused on subsequent runs.
"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import hashlib, json, subprocess
from PIL import Image, ImageOps, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'assets/equipment'
ASSIGNMENTS = json.loads((DEST / 'icon-assignments.json').read_text(encoding='utf-8'))

def download(slug):
    url = f'https://media.freegameassets.com/icons/fantasy-rpg-core/v1/icons/512/{slug}-001.png'
    original = DEST / 'originals' / f'{slug}.png'
    if not original.exists():
        partial = original.with_suffix('.download')
        subprocess.run(['curl.exe', '-L', '--fail', '--silent', '--show-error',
                        '--retry', '2', '--max-time', '45', url, '-o', str(partial)], check=True)
        with Image.open(partial) as img:
            img.verify()
        partial.replace(original)
    with Image.open(original) as img:
        img.verify()
    print('Verified '+slug, flush=True)
    return {'id':slug, 'source':url, 'catalogue':'https://www.freegameassets.com/fantasy-rpg-icons',
            'sha256':hashlib.sha256(original.read_bytes()).hexdigest(),
            'license':'CC0-1.0', 'generatedWithAI':True}

def main():
    (DEST / 'originals').mkdir(exist_ok=True)
    (DEST / 'icons').mkdir(exist_ok=True)
    slugs = sorted(set(v if isinstance(v,str) else v['source'] for v in ASSIGNMENTS.values()))
    with ThreadPoolExecutor(max_workers=8) as pool:
        sources = list(pool.map(download, slugs))
    hashes, pixels, manifest = set(), set(), []
    for icon, assignment in ASSIGNMENTS.items():
        slug = assignment if isinstance(assignment,str) else assignment['source']
        with Image.open(DEST / 'originals' / (slug+'.png')) as original:
            art = ImageOps.contain(original.convert('RGBA'), (256,256), Image.Resampling.LANCZOS)
        if isinstance(assignment,dict) and assignment.get('extract') == 'bow':
            # These catalogue illustrations include a scene background.
            # Isolate the painted bow/arrow, retaining their original material detail.
            matte = Image.new('L', (256,256))
            draw = ImageDraw.Draw(matte)
            if slug == 'archery':
                draw.polygon([(45,14),(52,15),(52,23),(62,29),(73,33),(95,39),
                    (116,48),(128,56),(139,61),(146,71),(151,77),(158,84),(159,91),
                    (151,98),(157,111),(165,114),(176,120),(185,132),(194,152),
                    (199,169),(199,194),(196,214),(195,226),(203,231),(204,243),
                    (195,249),(184,247),(178,241),(179,234),(179,225),(181,212),
                    (182,195),(181,176),(175,160),(165,147),(159,136),(155,126),
                    (152,121),(148,112),(144,101),(136,102),(128,99),(124,94),
                    (123,90),(119,85),(117,75),(112,68),(101,61),(90,56),(76,49),
                    (63,43),(58,41),(53,39),(46,36),(42,31),(40,25),(40,19)],fill=255)
                draw.polygon([(15,190),(35,173),(50,171),(56,174),(198,78),
                    (197,70),(231,56),(213,88),(209,79),(61,181),(61,193),
                    (52,212),(38,204),(33,199),(23,198)],fill=255)
                draw.line([(48,37),(24,198),(186,239)],fill=255,width=2)
            elif slug == 'bowyer':
                outline=[(490,2),(450,0),(410,6),(370,21),(345,39),(325,69),
                    (311,102),(302,141),(297,153),(283,163),(275,181),(267,204),
                    (250,221),(221,243),(190,264),(159,291),(138,315),(120,343),
                    (105,374),(92,408),(85,440),(89,470),(101,491),(117,509),
                    (134,506),(139,499),(126,487),(116,472),(110,451),(112,425),
                    (120,396),(134,366),(152,340),(175,313),(201,290),(230,266),
                    (253,247),(278,228),(290,208),(303,188),(317,170),(323,151),
                    (332,126),(339,94),(349,70),(366,49),(389,34),(415,24),
                    (443,16),(475,15),(486,17)]
                draw.polygon([(x/2,y/2) for x,y in outline],fill=255)
                draw.line([(242,5),(65,250)],fill=255,width=2)
            else:
                outline=[(99,0),(119,0),(111,12),(116,29),(126,36),(139,36),
                    (157,41),(179,51),(193,63),(209,78),(222,94),(235,107),
                    (246,115),(259,122),(253,126),(241,137),(236,155),(239,175),
                    (248,185),(266,196),(273,199),(264,207),(255,219),(252,235),
                    (251,251),(261,270),(272,284),(280,294),(289,301),(310,305),
                    (314,310),(308,324),(309,346),(319,357),(337,367),(339,377),
                    (332,386),(329,401),(330,420),(325,442),(314,465),(299,484),
                    (278,503),(279,512),(256,512),(258,500),(268,482),(276,463),
                    (281,441),(282,420),(276,401),(266,387),(254,380),(244,374),
                    (244,358),(242,344),(237,330),(236,315),(238,304),(235,294),
                    (230,279),(227,264),(219,252),(215,237),(210,222),(205,213),
                    (186,212),(179,214),(180,204),(188,185),(194,165),(199,148),
                    (199,134),(197,120),(191,102),(183,88),(171,76),(154,65),
                    (139,60),(121,55),(109,49),(100,40),(93,29),(90,15)]
                draw.polygon([(x/2,y/2) for x,y in outline],fill=255)
                arrow=[(29,369),(65,350),(318,207),(334,186),(477,141),
                    (419,208),(359,242),(354,214),(94,372),(70,392),(33,384),(51,376)]
                draw.polygon([(x/2,y/2) for x,y in arrow],fill=255)
                draw.line([(57,27),(33,169),(133,253)],fill=255,width=1)
            matte = matte.filter(ImageFilter.GaussianBlur(.5))
            rgba = list(art.getdata())
            mask = list(matte.getdata())
            processed = []
            for (r,g,b,a),m in zip(rgba,mask):
                opacity = 1
                if slug == 'archery' and g > r*1.06:
                    opacity *= max(0,1-(g-r)/24)
                processed.append((r,g,b,round(m*opacity)))
            art.putdata(processed)
        if art.getchannel('A').getextrema()[0] == 255:
            raise ValueError('Illustration lacks transparent background: '+icon+' / '+slug)
        output = DEST / 'icons' / (icon+'.png')
        art.save(output, optimize=True)
        digest = hashlib.sha256(output.read_bytes()).hexdigest()
        pixel_hash = hashlib.sha256(art.tobytes()).hexdigest()
        if digest in hashes or pixel_hash in pixels:
            raise ValueError('Duplicate illustration: '+icon)
        hashes.add(digest)
        pixels.add(pixel_hash)
        manifest.append({'icon':icon, 'sourceId':slug, 'extraction':assignment.get('extract') if isinstance(assignment,dict) else None, 'sha256':digest,
                         'pixelSha256':pixel_hash, 'width':art.width, 'height':art.height})
    previous = json.loads((DEST / 'manifest.json').read_text(encoding='utf-8'))
    combined = {entry['id']:entry for entry in previous}
    combined.update({entry['id']:entry for entry in sources})
    (DEST / 'manifest.json').write_text(json.dumps(list(combined.values()), ensure_ascii=False, indent=2), encoding='utf-8')
    (DEST / 'icon-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'Prepared {len(manifest)} distinct transparent icons from {len(sources)} CC0 sources.')

if __name__ == '__main__':
    main()
