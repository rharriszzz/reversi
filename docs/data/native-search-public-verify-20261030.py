#!/usr/bin/env python3
"""Independently audit public rules, paired statistics, RNG resampling and telemetry."""
import json
import math
from pathlib import Path
import statistics
import sys
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT))
from scripts.native.verify import verify, critical
DATA=ROOT/'docs/data'
def read(name):return json.loads((DATA/name).read_text())
def near(a,b):assert math.isclose(a,b,rel_tol=1e-11,abs_tol=1e-9),(a,b)
def rng(seed):
    a=seed & 0xffffffff
    while True:
        a=(a+0x6d2b79f5)&0xffffffff
        t=((a^(a>>15))*(a|1))&0xffffffff
        t=(t^((t+(((t^(t>>7))*(t|61))&0xffffffff))&0xffffffff))&0xffffffff
        yield ((t^(t>>14))&0xffffffff)/4294967296

def quantile(xs,p):
    a=sorted(xs);q=(len(a)-1)*p;lo=int(q)
    return a[lo]+(a[math.ceil(q)]-a[lo])*(q-lo)

def bootstrap(rows,columns,seed):
    random=rng(seed);out={c:[] for c in columns};n=len(rows)
    for _ in range(10000):
        sums=[0.]*len(columns)
        for _ in range(n):
            row=rows[int(next(random)*n)]
            for i,c in enumerate(columns):sums[i]+=row[c]
        for i,c in enumerate(columns):out[c].append(sums[i]/n)
    return {c:[quantile(x,.025),quantile(x,.975)] for c,x in out.items()}

public=read('native-search-games-20261030.json');summary=read('native-search-results-20261030.json')
certificate=verify(public,summary)
pairs={}
for ms,n in [(80,256),(300,128)]:
    rows=[]
    for family in range(n):
        games=[g for g in public['games'] if g['timeMs']==ms and g['family']==family]
        rows.append({'family':family,'score':sum(g['points'] for g in games)/2,'margin':sum(g['margin'] for g in games)/2})
    pairs[ms]=rows;s=summary['statistics']['conditions'][str(ms)]
    near(s['conservativeOneSided975Lower'],max(0,s['mean']-math.sqrt(math.log(40)/(2*n))))
    bs=bootstrap(rows,['score','margin'],2026103013+ms)
    for c in bs:
        for a,b in zip(bs[c],s['bootstrap'][c]['interval95']):near(a,b)
matched=[{'short':a['score'],'long':b['score'],'difference':b['score']-a['score']} for a,b in zip(pairs[80][:128],pairs[300])]
bs=bootstrap(matched,['short','long','difference'],2026103013);m=summary['statistics']['matched']
for c in bs:
    for a,b in zip(bs[c],m['bootstrap'][c]['interval95']):near(a,b)
xs=[r['difference'] for r in matched];radius=critical(127)*statistics.stdev(xs)/math.sqrt(128)
for a,b in zip(m['interval95'],[statistics.mean(xs)-radius,statistics.mean(xs)+radius]):near(a,b)

telemetry=read('native-search-move-telemetry-20261030.json');assert telemetry['registration']==public['registration']
flat=[];fields=telemetry['columns']
for entry,game in zip(telemetry['games'],public['games']):
    assert entry['game']==game['game']
    assert [row[0] for row in entry['rows']]==[i for i,x in enumerate(game['moves']) if x['move'] is not None]
    for row in entry['rows']:
        r=dict(zip(fields,row));move=game['moves'][r['ply']]
        r.update(timeMs=game['timeMs'],backend='native' if move['player']==game['nativeColor'] else 'javascript',phase='opening' if r['occupied']<28 else 'middle' if r['occupied']<52 else 'endgame')
        assert 0<=r['depth']<=14 and 0<=r['evaluations']<=r['nodes']
        if r['backend']=='native':assert r['ttCutoffs']<=r['ttBoundHits']<=r['ttHits']<=r['ttProbes']==r['nodes']
        else:assert r['ttProbes'] is None
        flat.append(r)
for expected in summary['statistics']['telemetry']:
    rows=[r for r in flat if r['timeMs']==expected['timeMs'] and r['backend']==expected['backend'] and (expected['phase']=='all' or r['phase']==expected['phase'])]
    assert len(rows)==expected['moves'];n=len(rows)
    for k in ['nodes','evaluations','ttProbes','ttHits','ttBoundHits','ttCutoffs','cutoffs']:
        assert sum(r[k] or 0 for r in rows)==expected[k]
    near(sum(r['depth'] for r in rows)/n,expected['meanDepth']);near(statistics.median(r['depth'] for r in rows),expected['medianDepth'])
    near(sum(r['elapsedMs'] for r in rows)/n,expected['meanElapsedMs'])
    assert sum(r['timedOut'] for r in rows)==expected['interrupted']
    near(sum(r['measuredMs'] for r in rows)/n,expected['meanMoveMs']);near(statistics.median(r['measuredMs'] for r in rows),expected['medianMoveMs'])
    near(sum(r['nodes'] for r in rows)*1000/sum(r['elapsedMs'] for r in rows),expected['nodesPerSecond'])
    near(max(max(0,r['measuredMs']-r['timeMs']) for r in rows),expected['maxOverrunMs'])
    for limit,key in [(1,'overrun1'),(5,'overrun5')]:assert sum(r['measuredMs']-r['timeMs']>limit for r in rows)==expected[key]
    assert sum(r['depth']==0 for r in rows)==expected['fallbacks']
    for d,count in expected['depthHistogram'].items():assert sum(r['depth']==int(d) for r in rows)==count
certificate.update(independentExactBootstrap=True,matchedBudgetCovarianceVerified=True,publicMoveMetricsVerified=len(flat),allPhaseTelemetryVerified=True)
print(json.dumps(certificate))
