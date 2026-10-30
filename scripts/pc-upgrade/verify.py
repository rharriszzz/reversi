"""Verify committed final-PC evidence without browsers, SDK or private corpora."""
from pathlib import Path
import hashlib
import json
import statistics
ROOT=Path(__file__).resolve().parents[2];DATA=ROOT/'docs/data'
def read(name):return json.loads((DATA/name).read_text())
def main():
    r=read('pc-upgrade-results-20261030.json');b=read('pc-upgrade-benchmarks-20261030.json');w=read('pc-upgrade-browsers-20261030.json');q=read(r['qualification'])
    for p,digest in r['currentSourceHashes'].items():assert hashlib.sha256((ROOT/p).read_bytes()).hexdigest()==digest,p
    for p,digest in r['wasmManifest']['artifacts'].items():assert hashlib.sha256((ROOT/'src/wasm'/p).read_bytes()).hexdigest()==digest,p
    old=read('windows-pc-benchmarks-20261030.json');assert b['fixtures']==old['fixtures']['positions']
    expected={'B':(148636,90353),'P':(169532,108829)}
    for row in b['rows']:
        base=row['results']['portable'];n,e=expected[row['model']]
        assert base['nodes']==10*n and base['evaluations']==10*e
        for x in row['results'].values():
            for key in ['values','nodes','evaluations']:assert x[key]==base[key]
            for p,z in zip(x['positions'],base['positions']):assert p['static']['checksum']==z['static']['checksum']
    for summary in b['summary']:
        times=[row['results'][summary['build']]['elapsedMs']/10 for row in b['rows'] if row['model']==summary['model']]
        assert summary['medianBatchMs']==statistics.median(times)
        assert summary['batchMs']==times and summary['rangeBatchMs']==[min(times),max(times)]
    assert q['nativeQualification']['maxStaticError']=={'B':0,'L':0,'P':0} and q['nativeQualification']['maxSearchError']==0
    for channel in ['chrome','edge']:
        x=w['numerical'][channel];assert x['passed'] and x['platform']=='Win32' and 'Windows NT' in x['userAgent']
        assert x['checks']==524 and x['maxAbsError']==0 and x['staticQueries']==208 and x['rootAlternatives']==94 and x['pvPlacements']==282 and x['deepAlternativeChecks']==30
        assert len(x['reinitializations'])==20 and all(z['memoryBytes']==33554432 for z in x['reinitializations'])
        assert w['integration'][channel]['passed'] and w['integration'][channel]['wasm']=={'type':'application/wasm','bytes':372213}
    for x in w['sanity']['rows']:
        n,e=expected[x['model']];assert x['nodes']==3*n and x['evaluations']==3*e
        assert 'Windows NT' in x['identity']['userAgent'] and x['identity']['platform']=='Win32'
    for x in r['instructions']:
        if x['build']=='portable':assert x['popcntInstructionSites']==0 and x['softwarePopcountCallSites']>0
        else:assert x['popcntInstructionSites']>0 and x['softwarePopcountCallSites']==0
    assert len(r['profiles']['rows'])==9 and all(x['status']['code']==0 and x['selfSamples'] for x in r['profiles']['rows'])
    assert r['resources']['linuxSwapInDeltaPages']==r['resources']['linuxSwapOutDeltaPages']==0
    assert r['intensiveToolWallSeconds']<5400
    assert all(x['passed'] for x in r['finalTests'].values())
    assert w['memory']['passed'] and w['memory']['restarts']==40 and not w['memory']['errors']
    assert all(x['workers']['created']-x['workers']['terminated']==4 for x in w['memory']['samples'])
    print(json.dumps({'passed':True,'nativeConditions':42,'windowsNumericalChecks':1048,'windowsSanityBatches':20,'windowsTimedChecks':len(w['sanity']['timed']),'profileRecordings':9,'edgeWorkerRestarts':40,'originalWasmArtifacts':'unchanged','sourceHashes':'matched'}))
if __name__=='__main__':main()
