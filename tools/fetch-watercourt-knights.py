"""Restore missing LPC source layers from the recorded manifest; verify hashes."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import base64, hashlib, json, urllib.request

ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/'assets/chapter-five/lpc-source'
manifest=json.loads((DEST.parent/'knight-source-manifest.json').read_text(encoding='utf-8'))
cdn='https://cdn.jsdelivr.net/gh/liberatedpixelcup/Universal-LPC-Spritesheet-Character-Generator@master/'
api='https://api.github.com/repos/liberatedpixelcup/Universal-LPC-Spritesheet-Character-Generator/contents/'

def fetch(entry):
    target=DEST/entry['path'].replace('/','__')
    if target.exists() and hashlib.sha256(target.read_bytes()).hexdigest()==entry['sha256']:
        return entry['path']+' (verified local)'
    errors=[]
    for endpoint in [cdn,api]:
        try:
            with urllib.request.urlopen(endpoint+entry['path'],timeout=20) as response:data=response.read()
            if endpoint==api:data=base64.b64decode(json.loads(data)['content'])
            if hashlib.sha256(data).hexdigest()!=entry['sha256']:
                raise ValueError('upstream changed; refusing to overwrite recorded source')
            target.write_bytes(data)
            return entry['path']+' (downloaded and verified)'
        except Exception as error:errors.append(str(error))
    raise RuntimeError(entry['path']+': '+'; '.join(errors))

if __name__=='__main__':
    DEST.mkdir(exist_ok=True)
    with ThreadPoolExecutor(5) as pool:
        for result in pool.map(fetch,manifest['files']):print(result,flush=True)
