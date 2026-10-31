"""SDK/browser-independent integrity and statistical audit of compact evidence."""
import hashlib,json,math,statistics
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'docs/data/runtime-cpu-dispatch'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
    manifest=json.loads((OUT/'manifest.json').read_text())
    for file,digest in manifest['files'].items():assert sha(OUT/file)==digest,file
    for file,digest in manifest['finalSourceHashes'].items():assert sha(ROOT/file)==digest,file
    h=manifest['benchmarkHarness'];current=(ROOT/'scripts/runtime-cpu/benchmark.py').read_text()
    assert hashlib.sha256(current.replace(h['addedPreflight'],'').encode()).hexdigest()==h['executedSha256']
    search=json.loads((OUT/'search.json').read_text());summary=json.loads((OUT/'summary.json').read_text())
    for w in search['workloads']:
        rows=[r for r in search['rows'] if r['workload']==w['id']];assert len(rows)==9
        assert len(search['rootReferences'][w['id']])==len(w['positionIds'])
        expected=search['rootReferences'][w['id']]*w['repeats']
        digest=hashlib.sha256(json.dumps(expected,sort_keys=True,separators=(',',':')).encode()).hexdigest()
        total={k:sum(x['metrics'][k] for x in expected) for k in expected[0]['metrics']}
        for r in rows:
            assert r['results']['A']['signatureSha256']==digest
            assert r['results']['A']['metrics']==total
            assert len({x['signatureSha256'] for x in r['results'].values()})==1
            assert all(x['metrics']==r['results']['A']['metrics'] for x in r['results'].values())
        for a,b in [('B','A'),('C','A'),('C','B'),('C','D'),('D','A'),('E','A')]:
            xs=[math.log(r['results'][a]['wallSeconds']/r['results'][b]['wallSeconds']) for r in rows]
            mean=statistics.mean(xs);half=2.306004135204166*statistics.stdev(xs)/3
            expected=[100*math.expm1(mean),100*math.expm1(mean-half),100*math.expm1(mean+half)]
            actual=summary[w['id']][a+'/'+b]
            assert all(abs(x-actual[k])<1e-10 for x,k in zip(expected,['percent','low95','high95']))
    builds=json.loads((OUT/'builds.json').read_text())
    assert builds['records']['B']['fixedWorkSha256']==builds['records']['C']['fixedWorkSha256']
    assert '-march=native' in builds['records']['D']['flags']
    cpu=json.loads((OUT/'qualification.json').read_text());assert cpu['independent']['passed']
    for k in ['exact','timed']:assert cpu[k]['passed']
    for panel in cpu['exact']['rows']:
        for model in 'BLP':
            for actual,ref in zip(search['rootReferences'][panel['panel']+'-'+model],panel['references']):assert actual['exact'] and actual['score']==ref['score']
    count=0
    for trial in search['timed']:
        for result in trial['results'].values():
            for i,r in enumerate(result['roots']):
                key=f"{trial['positionIds'][i]}/{trial['model']}/{r['depth']}"
                assert r['score']==cpu['timed']['rootReferences'][key]
                assert r['score']==cpu['timed']['chosenMoveReferences'][key+'/'+str(r['move'])]
                count+=1
    assert count==540==cpu['timed']['publications']
    micro=json.loads((OUT/'micro.json').read_text());assert len(micro['rows'])==15
    corpus=micro['rows'][0]['corpus']
    historical=json.loads((ROOT/'docs/data/fast-flips-pc/portable-micro.json').read_text())
    assert historical['corpus']==corpus,'Historical corpus identity changed'
    assert all(r['corpus']==corpus and r['checkedCases']>1200000 for r in micro['rows'])
    assert sum(c['cases'] for c in corpus[:5])==65731 and corpus[-1]['cases']==1779
    manifestjs=(ROOT/'src/wasm/manifest.js').read_text();wasm=json.loads(manifestjs.split('export default ')[1].strip().removesuffix(';'))
    assert wasm['fingerprint']=='eb25fd26b0e29d8e3ba5d2b0eb865c7658790b7791d8076cf4515235c369549b'
    assert builds['records']['C']['receipt']['models']==wasm['models']
    assert builds['records']['C']['receipt']['modelHeaderSha256']==wasm['modelHeaderSha256']
    for f,d in wasm['artifacts'].items():assert sha(ROOT/'src/wasm'/f)==d
    assert manifest['budget']['activeSeconds']<5400
    print(json.dumps({'passed':True,'files':len(manifest['files']),'panels':len(search['workloads']),'trials':len(search['rows']),'wasmUnchanged':True,'activeSeconds':manifest['budget']['activeSeconds']}))
if __name__=='__main__':main()
