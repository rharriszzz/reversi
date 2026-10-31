"""Audit committed compact evidence without SDKs, browsers or private traces."""
import hashlib,json,math
from pathlib import Path
from analyze import effect
ROOT=Path(__file__).resolve().parents[2];D=ROOT/'docs/data/fast-flips-mac'
def load(name):return json.loads((D/name).read_text())
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def canonical(v):return hashlib.sha256(json.dumps(v,sort_keys=True,separators=(',',':')).encode()).hexdigest()
m=load('manifest.json');s=load('summary.json')
for path,value in m['sourceHashes'].items():assert digest(ROOT/path)==value,path
for path,value in m['harnessSourceSha256'].items():assert digest(ROOT/path)==value,path
for path,value in m['collectorSourceSha256'].items():assert digest(ROOT/path)==value,path
assert digest(D/'positions.json')==m['workloadSha256'];assert digest(D/'search-cases.txt')==m['searchCasesSha256']
assert load('micro.json')['corpus']==m['microCorpus']
fixed=0
for name in ['initial-search.json','final-search.json']:
    data=load(name);assert len(data['rows'])==162
    for w in data['workloads']:assert len(data['rootReferences'][w['id']])==len(w['positionIds'])
    for row in data['rows']:
        base=row['results']['original']
        for result in row['results'].values():
            assert result['wallSeconds']>0 and result['workloadCpuSeconds']>0
            assert result['metrics']==base['metrics']
            assert result['fullRootSignatureSha256']==base['fullRootSignatureSha256'];fixed+=1
    if name=='final-search.json':
        for row in s['panels']:
            values=[r['results'][row['tag']]['wallSeconds']/r['results']['original']['wallSeconds'] for r in data['rows'] if r['workload']==row['workload']]
            e=effect(values)
            for k in ['percent','low','high']:assert abs(e[k]-row['vsOriginal'][k])<1e-10
micro=load('micro.json');assert len(micro['rows'])==336
for group in {r['class'] for r in micro['rows']}:
    for rep in range(7):assert len({r['checksum'] for r in micro['rows'] if r['class']==group and r['rep']==rep})==1
profiles=load('profiles.json')['captures'];assert len(profiles)==26
for c in profiles:
    assert sum(c['functionWeights'].values())==c['weight']==c['accounting']['weight']
    flip=sum(v for k,v in c['functionWeights'].items() if 'flips(' in k)
    assert sum(r['weight'] for r in c['sampledFlipInstructions'])==flip
    if c['kind']=='ip':assert not c['genuineFlipCallerContexts']
    for r in c['sampledFlipInstructions']:
        assert int(c['flipSymbol']['start'],16)<=int(r['relativeAddress'],16)<int(c['flipSymbol']['end'],16)
browser=load('browser.json');assert browser['passed'] and not browser['pageErrors']
for key,value in browser['rootBatches'].items():assert canonical(value)==key
for r in browser['rows']:assert r['results']['original']['rootBatchSha256']==r['results']['selected']['rootBatchSha256']
q=load('qualification.json');assert q['final']['passed'] and q['wasm']['passed'] and q['finalSanitizers']['passed']
assert q['timedPublications']['passed'] and q['timedPublications']['publications']==324
assert q['tests']['passed'] and all(r['returnCode']==0 for r in q['tests']['rows'])
assert all(r['tests']==n for r,n in zip(q['tests']['rows'][-3:],[182,16,46]))
diag=load('diagnostic.json');assert diag['baseline']==diag['cleanup']==diag['final']
assert load('resources.json')['budget']['activeSeconds']<5400
print(json.dumps({'passed':True,'fixedBuildBlocks':fixed,'microTrials':336,'hardwareCaptures':26,'browserBlocks':len(browser['rows']),'actualTimedPublications':324,'sourceSha256':m['sourceHashes']['native/engine.cpp']}))
