"""Offline normalization reused from the qualified PMI pipeline."""
import collections,importlib.util,json,os,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];OUT=(ROOT/os.environ.get('REVERSI_FLIP_RUN','.local-research/fast-flips-m4-20261031')).resolve()
os.environ['REVERSI_PROFILE_RUN']=str(OUT)
spec=importlib.util.spec_from_file_location('normalize',ROOT/'scripts/profiling/normalize.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
manifest=json.loads((OUT/'builds.json').read_text());rows=json.loads((OUT/(os.environ.get('FLIP_PROFILE_DATA','profiles')+'.json')).read_text());positions=json.loads((OUT/'positions.json').read_text());workloads=json.loads((OUT/'workloads.json').read_text())
symbols={};builds={}
for tag in {r['tag'] for r in rows}:
    receipt=manifest['builds'][tag]
    b={**receipt,'executable':str(OUT/tag/'fixed-work'),'commit':receipt.get('commit',manifest['baseline'] if tag=='original' else manifest['experimentCommit'])};builds[tag]=b;symbols[tag]=m.Symbols(b)
profiles=[];summary=[]
for row in rows:
    if not row['raw']:continue
    w=next(w for w in workloads if w['id']==row['workload']);p=next(p for p in positions if p['id']==w['positionIds'][0])
    reg={'builds':builds,'workloads':[{'id':row['workload'],'mode':w['mode'],'position':{'panel':w['panel'],'positions':[p for p in positions if p['id'] in w['positionIds']]},'depth':12 if w['panel']=='profile-root' else 8 if w['panel']=='opening' else 7,'model':w['model'],'repeats':row['repeats']}]}
    stats,profile=m.parse_capture(row,reg,symbols[row['tag']],True)
    # This campaign's same-basename driver.cpp has its own source mapping.
    for f in profile['frames']:
        if f.get('source')=='scripts/profiling/driver.cpp':
            f['source']='scripts/fast-flips/driver.cpp';lines=(ROOT/f['source']).read_text().splitlines();f['sourceText']=lines[f['line']-1] if 0<f['line']<=len(lines) else None
    weights=collections.Counter()
    for sample in profile['samples']:
        fid=sample[1] if profile['kind']=='ip' else profile['stacks'][sample[1]][-1] if profile['stacks'][sample[1]] else None
        f=profile['frames'][fid] if fid is not None else {};symbol=f.get('containingSymbol','(unresolved)')
        if 'flips(' in symbol:weights[f.get('assembly','unknown')]+=sample[2]
    stats['topFlipInstructions']=weights.most_common(15)
    stats['workWallSeconds']=row['result']['wallSeconds'];stats['repeats']=row['repeats']
    summary.append(stats);profiles.append(profile)
    target=OUT/(row['id']+'.normalized.json');target.write_text(json.dumps(profile,separators=(',',':'))+'\n')
(OUT/(os.environ.get('FLIP_PROFILE_ANALYSIS','profile-analysis')+'.json')).write_text(json.dumps({'captures':summary,'postprocess':m.POSTPROCESS},indent=2)+'\n')
print(json.dumps([{k:c[k] for k in ['id','samples','functionWeights','topFlipInstructions']} for c in summary],indent=2))
