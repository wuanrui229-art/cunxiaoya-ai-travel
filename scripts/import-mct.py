# coding: utf-8
"""Import factual directory records from MCT's public data page; never execute its scripts.
Run with pypinyin==0.55.0 installed; --refresh fetches the source again.
"""
from pathlib import Path
import argparse,collections,csv,hashlib,json,re,urllib.request,datetime
from pypinyin import lazy_pinyin
ROOT=Path(__file__).resolve().parents[1]
URL='https://sjfw.mct.gov.cn/site/dataservice/rural'
parser=argparse.ArgumentParser();parser.add_argument('--refresh',action='store_true');args=parser.parse_args()
source=ROOT/'data/sources/mct-rural.html'
if args.refresh or not source.exists():
 source.parent.mkdir(parents=True,exist_ok=True)
 source.write_bytes(urllib.request.urlopen(URL,timeout=45).read())
raw=source.read_bytes();html=raw.decode('utf8')
code=re.search(r'<script>window.__NUXT__=(.*?)</script>',html,re.S).group(1)
# Nuxt emits a de-duplicated literal table. Decode only JSON literals and literal record fields.
params=re.search(r'function\((.*?)\)',code).group(1).split(',')
argtext=code[code.rfind('}}(')+3:-3]
argtext=re.sub(r'Array\(\d+\)','[]',argtext)
values=json.loads('['+argtext+']');assert len(params)==len(values)
env=dict(zip(params,values))
def literal(s):
 return env[s] if s in env else json.loads(s)
provinces={literal(a):literal(b) for a,b in re.findall(r'province:\{code:(\w+),name:(\w+),sort:\w+\}',code)}
# Guangdong's province descriptor has a literal rather than an interned name.
provinces[440000]='广东';provinces[990288]='新疆生产建设兵团'
pat=r'\{id:(\d+),grade:([^,]+),batch:([^,]+),code:([^,]+),name:("(?:\\.|[^"\\])*"),province:([^,]+),place:([^,]+),year:([^,]+),created_at:([^}]+)\}'
rows=[];translations={};date=datetime.datetime.now(datetime.timezone.utc).date().isoformat()
for sid,grade,batch,code_,name,province,place,year,created in re.findall(pat,code):
 full=json.loads(name).strip();province=provinces[literal(province)];batch=literal(batch)
 clean=full
 for prefix in [province+'维吾尔自治区',province+'壮族自治区',province+'回族自治区',province+'自治区',province+'省']:
  if clean.startswith(prefix):clean=clean[len(prefix):];break
 if province in ['北京','天津','上海','重庆']:city=province;basis='municipality'
 else:
  match=re.match(r'^(.+?(?:自治州|地区|盟|市))',clean)
  city=(match.group(1) if match else province);basis='name_prefix' if match else 'province_fallback'
  if city.endswith('市'):city=city[:-1]
 roman=lambda t:' '.join(lazy_pinyin(t)).title()
 for t in [full,province,city]:translations[t]=roman(t)
 rows.append(dict(id=1000000+int(sid),source_id=str(sid),source_kind='public',village_name=full,province=province,city=city,region_basis=basis,name_en=roman(full),batch=batch,source_url=URL,source_as_of='2022-12-07',retrieved_at=date,latitude=None,longitude=None,description='公开名录确认名称与所属地区；活动、餐饮、住宿和坐标尚未补充。'))
counts=collections.Counter(r['batch'] for r in rows)
assert counts=={1:320,2:680,3:199,4:200},counts
assert len({r['source_id'] for r in rows})==1399
assert all(r['province'] and r['city'] and r['village_name'] for r in rows)
manifest=dict(title='全国乡村旅游重点村（第一至第四批）',source_url=URL,source_as_of='2022-12-07',retrieved_at=date,source_sha256=hashlib.sha256(raw).hexdigest(),record_count=len(rows),province_count=len(set(r['province'] for r in rows)),region_count=len(set(r['city'] for r in rows)),batch_counts=dict(counts),coordinate_count=0,license_note='Public government directory facts; no general open-data license identified. No source photographs or editorial descriptions imported.',name_en_note='Automatically generated pinyin for search; not official English names.')
(ROOT/'public/public-villages.json').write_text(json.dumps(dict(manifest=manifest,villages=rows),ensure_ascii=False,indent=2)+'\n')
(ROOT/'public/locales/places-en.json').write_text(json.dumps(translations,ensure_ascii=False,indent=2)+'\n')
(ROOT/'data/mct-import-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
with (ROOT/'data/mct-villages.csv').open('w',encoding='utf-8-sig',newline='') as f:
 writer=csv.DictWriter(f,fieldnames=rows[0].keys());writer.writeheader();writer.writerows(rows)
print(json.dumps(manifest,ensure_ascii=False,indent=2))
print('Province fallback regions:',sorted({r['city'] for r in rows if r['region_basis']=='province_fallback'}))
