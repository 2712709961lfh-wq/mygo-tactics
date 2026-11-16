"""Read the user's workbook without editing it; update the game personal growth table."""
from pathlib import Path
from datetime import date
import openpyxl,json,re,hashlib

ROOT=Path(__file__).resolve().parents[1]
source=ROOT/'character assets/角色成长值.xlsx'
ids={'高松灯':'tomori','千早爱音':'anon','要乐奈':'rana','长崎爽世':'soyo','椎名立希':'taki',
     '雪月':'xueyue','井芹仁菜':'nina','伊地知虹夏':'nijika','安和昴':'subaru'}
keys=['maxHp','str','mag','dex','spd','lck','def','res']
data={}
with source.open('rb') as stream:
    source_hash=hashlib.sha256(stream.read()).hexdigest()
w=openpyxl.load_workbook(source,read_only=True,data_only=True)
try:
    sheet=w['Sheet1']
    header=next(sheet.iter_rows(max_row=1,max_col=11,values_only=True))
    assert header[:9]==('角色','Hp','力','魔力','技','速','幸运','守备','魔防'),header
    last_row=1
    for row_number,row in enumerate(sheet.iter_rows(min_row=2,max_col=11,values_only=True),2):
        name,*_=row
        if name is None:
            assert not any(n is not None for n in row),row
            continue
        rates=row[1:9]
        assert name in ids and ids[name] not in data,row
        assert all(type(n) in (int,float) and 0<=n<=100 for n in rates),row
        assert row[9] is None and row[10]==sum(rates),row
        data[ids[name]]={'name':name,'rates':dict(zip(keys,rates))}
        last_row=row_number
    assert set(data)==set(ids.values()),set(data)
finally:
    w.close()

cell_range=f'Sheet1!A1:I{last_row}'
updated=date.today().isoformat()
p=ROOT/'src/growth-data.js'
s=p.read_text(encoding='utf8')
# All nine characters now use the workbook, including Subaru's former fallback.
s=re.sub(r'  // Authored starting growth[^\n]*\n  personal\.subaru=\{[^\n]*\};\n','',s,count=1)
s,count=re.subn(r'const personal=\{.*?\n\};','const personal='+json.dumps(data,ensure_ascii=False,indent=2)+';',s,count=1,flags=re.S)
assert count==1,'Personal growth table not found'
s,count=re.subn(r'(?<=角色成长值\.xlsx, )Sheet1!A1:I\d+ \(%\), updated \d{4}-\d{2}-\d{2}',
                f'{cell_range} (%), updated {updated}',s,count=1)
assert count==1,'Growth source header not found'
p.write_text(s,encoding='utf8')
(ROOT/'docs/research/growth-source.json').write_text(json.dumps({
    'source':'character assets/角色成长值.xlsx','range':cell_range,'updated':updated,
    'sha256':source_hash,'personal':data},ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print(f'Imported {len(data)} characters / {len(data)*len(keys)} rates from {cell_range}.')
