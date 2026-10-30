#!/usr/bin/env python3
"""Analysis-only emulation of the FROZEN JavaScript Number RNG; no scientific source edits."""
import hashlib,json,pathlib,subprocess,sys
ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=pathlib.Path(sys.argv[2]) if len(sys.argv)>2 else ROOT/'.local-research/native-v2-20261030'
mode=sys.argv[1] if len(sys.argv)>1 else 'final'
if mode=='public':OUT.mkdir(parents=True,exist_ok=True)
reg=json.loads((OUT/'registration.json').read_text()) if mode!='public' else json.loads((ROOT/'docs/data/native-v2-registration-20261030.json').read_text())
path=ROOT/'scripts/native-v2/verify.py';source=path.read_text();digest=hashlib.sha256(path.read_bytes()).hexdigest()
assert digest==reg['sources']['scripts/native-v2/verify.py']
if mode!='public':assert path.read_bytes()==(OUT/'snapshot/scripts/native-v2/verify.py').read_bytes()
old='''def rng(seed):
    a=seed&0xffffffff
    while True:
        a=(a+0x6d2b79f5)&0xffffffff;t=((a^(a>>15))*(a|1))&0xffffffff
        t=(t^((t+(((t^(t>>7))*(t|61))&0xffffffff))&0xffffffff))&0xffffffff
        yield ((t^(t>>14))&0xffffffff)/4294967296
'''
new='''def rng(seed):
    # JS a += constant uses binary64 Number, including rounding above 2**53.
    a=float(seed&0xffffffff)
    while True:
        a+=0x6d2b79f5;u=int(a)&0xffffffff;t=((u^(u>>15))*(u|1))&0xffffffff
        t=(t^((t+(((t^(t>>7))*(t|61))&0xffffffff))&0xffffffff))&0xffffffff
        yield ((t^(t>>14))&0xffffffff)/4294967296
'''
assert source.count(old)==1
# Validate the port before and after JS loses integer precision. Node invokes
# the exact registered production RNG, not a rewritten JS implementation.
js='''import {seededRandom} from './src/learning.js';
const points=new Set([1,2,3,1000,4900000,4920000,5000000,7680000]),r=seededRandom(2026103097),out=[];
for(let draw=1;draw<=7680000;draw++){const value=r();if(points.has(draw))out.push([draw,value]);}console.log(JSON.stringify(out));'''
expected=json.loads(subprocess.check_output(['node','--input-type=module','-e',js],cwd=ROOT,text=True))
namespace={};exec(new,namespace);rng=namespace['rng'](2026103097);values=[];points={d for d,v in expected}
for draw in range(1,7680001):
    value=next(rng)
    if draw in points:values.append([draw,value])
assert values==expected,(values,expected)
patched=source.replace(old,new)
assert patched.replace(new,old)==source
certificate=dict(format='native-v2-verification-emulation-v1',registration=reg['checksum'],originalVerifierSha256=digest,patchedVerifierSha256=hashlib.sha256(patched.encode()).hexdigest(),changes=1,scope='Only independent Python RNG emulation matches registered JavaScript binary64 accumulation. No game, model, search, opening, source snapshot, statistical method, bootstrap sample or original statistical output changes.',checkpoints=expected,sourceAndSnapshotUnchanged=True)
if mode!='public':
    target=OUT/'verification-repair.json'
    if target.exists():assert json.loads(target.read_text())==certificate
    else:target.write_text(json.dumps(certificate,separators=(',',':'))+'\n')
if mode=='check-only':print(json.dumps(certificate));sys.exit(0)
assert mode in ['final','public']
sys.argv=[str(path),mode,str(OUT)]
exec(compile(patched,str(path)+' [RNG verification emulation]','exec'),{'__file__':str(path),'__name__':'__main__'})
