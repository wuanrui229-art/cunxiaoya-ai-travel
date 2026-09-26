"""Export only bundled destination examples; never user data."""
import re, json
from pathlib import Path
src=Path('villagetour.sql').read_text()
out={}
for table,key in [('village','villages'),('village_dining','dining'),('village_accommodation','accommodation'),('village_activity','activities')]:
 m=re.search(r'INSERT INTO `'+table+r'` \((.*?)\) VALUES\s*(.*?);',src,re.S)
 cols=re.findall(r'`([^`]+)`',m[1]); raw=re.sub(r'^\s*--[^\n]*','',m[2],flags=re.M)
 rows=[]; row=[]; token=''; quoted=False; escaped=False; string=False
 def convert(s,was_string):
  if was_string: return s
  s=s.strip()
  if s=='NULL': return None
  return float(s) if '.' in s else int(s)
 for ch in raw:
  if escaped: token+=ch; escaped=False; continue
  if quoted:
   if ch=='\\': escaped=True
   elif ch=="'": quoted=False
   else: token+=ch
  elif ch=="'": quoted=True; string=True; token=''
  elif ch=='(': row=[]; token=''; string=False
  elif ch in ',)':
   if token.strip() or string:
    row.append(convert(token,string));token='';string=False
   if ch==')': rows.append(dict(zip(cols,row)))
  elif not string: token+=ch
 for r in rows:
  for f in ['images','related_links']:
   if f in r: r[f]=json.loads(r[f])
  for f in ['verified_by','verified_at','is_verified']: r.pop(f,None)
 out[key]=rows
Path('public/demo-data.json').write_text(json.dumps(out,ensure_ascii=False,indent=2))
print({k:len(v) for k,v in out.items()})
