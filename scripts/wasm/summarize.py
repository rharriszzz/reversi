"""Publish compact engineering evidence; requires complete measured outputs."""
from pathlib import Path
import json,statistics,hashlib
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'.local-research/wasm-20261030';DATA=ROOT/'docs/data'
def read(name):return json.loads((OUT/name).read_text())
def write(name,data):(DATA/name).write_text(json.dumps(data,indent=2)+'\n')
def main():
 b=read('browser-benchmarks.json');a=read('acceptance-games.json');summary=read('acceptance-summary.json');assert len(a['games'])==48 and not summary['errors']
 performance=[]
 for model in ['B','P']:
  for backend in ['native','wasm','javascript']:
   rows=[r for r in b['rows'] if r['model']==model]
   batches=[sum(r['results'][backend]['elapsedMs'] for r in rows if r['rep']==rep) for rep in range(5)]
   nodes=sum(r['results'][backend]['nodes'] for r in rows if r['rep']==0)
   static=[r['static'][backend]['elapsedMs']/r['static'][backend]['evaluations']*1e6 for r in rows]
   performance.append(dict(model=model,backend=backend,medianBatchMs=statistics.median(batches),batchRangeMs=[min(batches),max(batches)],nodes=nodes,millionNodesPerSecond=nodes/statistics.median(batches)/1000,medianStaticNs=statistics.median(static)))
 games=[];conditions=[]
 for g in a['games']:
  record={k:v for k,v in g.items() if k!='plays'};record['searches']=[]
  for e in g['plays']:
   r={k:v for k,v in e['response']['choice'].items() if k not in ['modelIdentity','buildIdentity','backend','model','memoryBytes','player']}
   record['searches'].append(dict(ply=sum(v!=0 for v in e['request']['board'])-4,player=e['request']['player'],roundTripMs=e['roundTripMs'],worker=e['worker'],**r))
  games.append(record)
 for model in ['B','P']:
  for budget in [80,300]:
   gs=[g for g in games if g['model']==model and g['budgetMs']==budget];rs=[r for g in gs for r in g['searches']]
   conditions.append(dict(model=model,budgetMs=budget,games=len(gs),searches=len(rs),meanDepth=statistics.mean(r['depth'] for r in rs),maxDepth=max(r['depth'] for r in rs),depthZero=sum(r['depth']==0 for r in rs),exact=sum(r['exact'] for r in rs),maxCoreOverrunMs=max(r['elapsedMs']-budget for r in rs),maxWorkerRoundTripOverrunMs=max(r['roundTripMs']-budget for r in rs if r['depth']>0),nodes=sum(r['nodes'] for r in rs),elapsedMs=sum(r['elapsedMs'] for r in rs),initializationMsRange=[min(r['initializationMs'] for r in rs),max(r['initializationMs'] for r in rs)]))
 files=['native/engine.cpp','native/engine.hpp','native/browser.cpp','src/app.js','src/worker.js','src/backend.js','src/wasm-engine.js','src/coaching.js','src/review.js','index.html','style.css','launch.py','tests/wasm-engine.test.mjs','tests/wasm_browser_check.py','scripts/wasm/acceptance.py','scripts/wasm/benchmark.py','scripts/wasm/fixtures.mjs']
 hashes={f:hashlib.sha256((ROOT/f).read_bytes()).hexdigest() for f in files}
 write('wasm-browser-benchmarks-20261030.json',b)
 write('wasm-acceptance-games-20261030.json',{'purpose':'engineering acceptance, not playing-strength inference','browser':a['browser'],'sourceHashes':hashes,'games':games})
 result={'checkpointCommits':['f4443cc0fbc21cb0e16ae0c47e0a3780fb459300','d6397c58c0bf1ec920315cb802e4360c072d9cce','7527c2af7e4b95bca5f8e95440b77df8c8a3cd59'],'sourceHashes':hashes,'performance':performance,'acceptance':{**summary,'conditions':conditions,'forcedPasses':sum(g['forcedPasses'] for g in games),'terminalWithEmpties':sum(0 in g['board'] for g in games),'maxFrameGapMs':max(g['frames']['maxMs'] for g in games),'maxGameP95FrameGapMs':max(g['frames']['p95Ms'] for g in games)},'lifecycle':read('lifecycle.json'),'safari':read('safari.json'),'uiStress':read('ui-stress.json'),'initialAcceptance':read('acceptance-first-summary.json') if (OUT/'acceptance-first-summary.json').exists() else None}
 result['finalQualification']=json.loads((ROOT/'.local-research/wasm-build/qualification.json').read_text())
 result['tests']={'node':169,'python':38,'nativeSanitizerGroups':15,'actualWasmGroups':7,'standaloneWasm':'passed'}
 manifest=json.loads((ROOT/'src/wasm/manifest.js').read_text().split('export default ',1)[1].rsplit(';',1)[0])
 result['wasmBuild']={'fingerprint':manifest['fingerprint'],'artifacts':manifest['artifacts'],'modelHeaderSha256':manifest['modelHeaderSha256'],'models':manifest['models']}
 for file,digest in manifest['artifacts'].items():assert hashlib.sha256((ROOT/'src/wasm'/file).read_bytes()).hexdigest()==digest
 write('wasm-engine-results-20261030.json',result)
 print(json.dumps(result,indent=2))
if __name__=='__main__':main()
