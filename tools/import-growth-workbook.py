"""Read the user's workbook without editing it; update the game personal growth table."""
from pathlib import Path
import openpyxl,json,re,hashlib
ROOT=Path(__file__).resolve().parents[1];source=ROOT/'character assets/角色成长值.xlsx';w=openpyxl.load_workbook(source,read_only=True,data_only=True)
ids={'高松灯':'tomori','千早爱音':'anon','要乐奈':'rana','长崎爽世':'soyo','椎名立希':'taki','雪月':'xueyue','井芹仁菜':'nina','伊地知虹夏':'nijika'};keys=['maxHp','str','mag','dex','spd','lck','def','res'];data={}
for row in w['Sheet1'].iter_rows(min_row=2,max_col=9,values_only=True):
 name,*rates=row
 if name is None:continue
 assert name in ids and len(rates)==8 and all(isinstance(n,(int,float)) and 0<=n<=100 for n in rates),row
 data[ids[name]]={'name':name,'rates':dict(zip(keys,rates))}
assert set(data)==set(ids.values());w.close()
p=ROOT/'src/growth-data.js';s=p.read_text(encoding='utf8');s=re.sub(r'const personal=\{.*?\n\};', 'const personal='+json.dumps(data,ensure_ascii=False,indent=2)+';',s,count=1,flags=re.S);s=s.replace('Sheet1!A1:I8 (%), updated 2026-11-13','Sheet1!A1:I9 (%), updated 2026-11-14');p.write_text(s,encoding='utf8')
(ROOT/'docs/research/chapter-seven/growth-source.json').write_text(json.dumps({'source':'character assets/角色成长值.xlsx','range':'Sheet1!A1:I9','sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'personal':data},ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps(data,ensure_ascii=False))
