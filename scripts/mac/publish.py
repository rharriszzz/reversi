"""Publish compact reproducible engineering evidence; never raw traces/binaries."""
import hashlib,json,statistics,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'.local-research/mac-modernization-20261030';DATA=ROOT/'docs/data'
def read(name):return json.loads((OUT/name).read_text())
def write(name,value):(DATA/name).write_text(json.dumps(value,separators=(',',':'))+'\n')
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def optional(name):return read(name) if (OUT/name).exists() else None
COLUMNS=['move','score','depth','exact','timedOut','elapsedMs','cpuMs','nodes','evaluations','ttProbes','ttHits','ttBoundHits','ttCollisions','ttReplacements','ttCutoffs','ttStores','ttRejectedStores','cutoffs','firstMoveCutoffs','tableBytes']
def compact_trials(d):
    names=list(d['receipts']);rows=[]
    for row in d['rows']:
        rows.append({**{k:v for k,v in row.items() if k!='results'},'results':[[row['results'][name].get(c) for c in COLUMNS] for name in names]})
    return {**{k:v for k,v in d.items() if k!='rows'},'backends':names,'columns':COLUMNS,'rows':rows}
def group(name):
    if 'lastEmpties' in name:return 'tinyTail'
    if 'negamax' in name or 'ordered' in name:return 'searchTTOrdering'
    if 'legal' in name:return 'legal'
    if 'flips' in name:return 'flips'
    if 'features' in name or 'evaluate' in name:return 'featuresWrapper'
    if 'pattern' in name:return 'patterns'
    if 'malloc' in name or 'operator new' in name or 'vector' in name:return 'allocationMovement'
    return 'other'
def add_groups(native,wasm):
    for row in native['rows']:
        counts={}
        for x in row['selfSamples']:
            k=group(x['symbol']);counts[k]=counts.get(k,0)+x['samples']
        row['groupedSelfPercent']={k:v/row['totalReportedSelfSamples']*100 for k,v in counts.items()}
    for row in wasm['profiles']:
        counts={}
        for name,n in row['selfSamples'].items():
            k=group(name);counts[k]=counts.get(k,0)+n
        row['groupedSelfPercent']={k:v/row['totalSamples']*100 for k,v in counts.items()}
    return {'native':native,'wasm':wasm}
def summaries(bench):
    result=[]
    for model in ['B','P']:
        for backend in ['baseline','candidate','wasm','javascript']:
            rows=[r for r in bench['rows'] if r['model']==model]
            batches=[sum(r['results'][backend]['elapsedMs'] for r in rows if r['rep']==rep) for rep in range(5)]
            nodes=sum(r['results'][backend]['nodes'] for r in rows if r['rep']==0)
            static=[r['static'][backend]['elapsedMs']*1e6/r['static'][backend]['evaluations'] for r in rows]
            timed={}
            for budget in [80,300]:
                rs=[r['results'][backend] for r in bench['timed'] if r['model']==model and r['budgetMs']==budget]
                timed[budget]={'searches':len(rs),'meanDepth':statistics.mean(r['depth'] for r in rs),'exact':sum(r['exact'] for r in rs),'maxCoreOverrunMs':max(r['elapsedMs']-budget for r in rs)}
            steady=[r['results'][backend]['coreMs']/r['repeats'] for r in bench['steady'] if r['model']==model] if backend!='javascript' else []
            result.append({'model':model,'backend':backend,'batchMs':batches,'medianBatchMs':statistics.median(batches),'nodes':nodes,'millionNodesPerSecond':nodes/statistics.median(batches)/1000,'medianStaticNs':statistics.median(static),'steadyBatchMs':steady,'medianSteadyBatchMs':statistics.median(steady) if steady else None,'timed':timed})
    return result

def pack_games():
    audit=read('backend-audit.json');assert audit['passed'];registration=read('backend-registration.json');source=OUT/'backend-games.sealed.jsonl';assert sha(source)==audit['sealedSha256']
    games=[json.loads(l) for l in source.read_text().splitlines()];assert len(games)==256
    columns=list(dict.fromkeys(k for g in games for s in g['steps'] for k in s));packed=[]
    for g in games:packed.append({**{k:v for k,v in g.items() if k!='steps'},'steps':[[s.get(k) for k in columns] for s in g['steps']]})
    write('mac-backend-games-20261030.json',{'format':'column-matrix-v1','purpose':registration['purpose'],'registrationSha256':registration['registrationSha256'],'columns':columns,'games':packed,'analysis':read('backend-analysis.json'),'audit':audit})
    acceptance=read('acceptance-games.json');assert len(acceptance['games'])==96;assert read('acceptance-audit.json')['passed']
    columns=list(dict.fromkeys(k for g in acceptance['games'] for e in g['plays'] for k in e['response']['choice']));games=[]
    for g in acceptance['games']:
        searches=[]
        for e in g['plays']:
            r=e['response']['choice'];searches.append({'ply':sum(v!=0 for v in e['request']['board'])-4,'player':e['request']['player'],'worker':e['worker'],'roundTripMs':e['roundTripMs'],'result':[r.get(k) for k in columns]})
        games.append({**{k:v for k,v in g.items() if k!='plays'},'searches':searches})
    write('mac-browser-acceptance-20261030.json',{'format':'column-matrix-v1','browser':acceptance['browser'],'columns':columns,'games':games,'summary':read('acceptance-summary.json'),'audit':read('acceptance-audit.json')})

def main():
    final='--final' in sys.argv
    experiments={'initial':compact_trials(read('experiments.json')),'repeated':compact_trials(read('repeated-experiments.json')),'gateExperiment':compact_trials(read('gate-repeated-experiments.json')),'coldFirstExperiment':compact_trials(read('cold-first-experiments.json')),'wasmComparison':read('wasm-comparison.json'),'qualification':read('variant-qualification.json'),'initialSummary':read('experiment-summary.json')}
    benchmark={'initial':read('initial-benchmarks.json'),'gate':read('gate-benchmarks.json'),'final':read('benchmarks.json')}
    profiles={'initial':add_groups(read('initial-native-profiles.json'),read('initial-wasm-profiles.json')),'gate':add_groups(read('gate-native-profiles.json'),read('gate-wasm-profiles.json')),'final':add_groups(read('native-profiles.json'),read('wasm-profiles.json')),'instruments':optional('instruments.json')}
    tests={}
    for name,file,count,needle in [('node','checkpoint2-node.log',172,'pass 172'),('python','checkpoint2-python.log',39,'Ran 39 tests'),('nativeSanitizer','final-sanitizer.log',15,'pass 15'),('targeted','final-targeted.log',23,'pass 23')]:
        path=OUT/file
        if path.exists():
            text=path.read_text();assert needle in text and ('fail 0' in text if name!='python' else '\nOK\n' in text)
            tests[name]={'passed':True,'tests':count,'logSha256':sha(path)}
    m=json.loads((ROOT/'src/wasm/manifest.js').read_text().split('export default ')[1].strip().removesuffix(';'))
    for file,digest in m['artifacts'].items():assert sha(ROOT/'src/wasm'/file)==digest
    paths=['native/engine.cpp','native/engine.hpp','native/main.cpp','native/browser.cpp','src/wasm-engine.js','src/app.js','src/worker.js','src/backend.js','scripts/native/build.mjs','scripts/wasm/build.mjs','scripts/python.mjs','scripts/wasm/acceptance.py','tests/wasm_benchmark_worker.js','tests/mac-endgame.test.mjs','tests/mac_wasm_compare.html','tests/mac_backend.html',*[str(p.relative_to(ROOT)) for p in sorted((ROOT/'scripts/mac').glob('*')) if p.suffix in ['.py','.mjs','.js','.cpp']]]
    histories=[json.loads(l) for l in (OUT/'resources.jsonl').read_text().splitlines()]
    resources={'history':histories,'samples':len(histories),'minimumCacheHeadroomEstimateGiB':min(r['estimatedReadilyReclaimableBytes']/2**30 for r in histories),'swapOutPagesDelta':histories[-1]['vmPages'].get('Swapouts',0)-histories[0]['vmPages'].get('Swapouts',0),'swapInPagesDelta':histories[-1]['vmPages'].get('Swapins',0)-histories[0]['vmPages'].get('Swapins',0),'scope':'Cache-based headroom estimate is not exact OS available memory or a guaranteed intersection of inactive and file-backed pages; pressure and actual swap activity are recorded separately.'}
    result={'stage':'final' if final else 'engineering checkpoint; acceptance pending','checkpoint1':'43e52d2235c17670f302ab822636f11660e4f8b7','sourceHashes':{p:sha(ROOT/p) for p in paths},'wasmBuild':m,'initialWasmBuild':json.loads((OUT/'candidate-manifest-1.js').read_text().split('export default ')[1].strip().removesuffix(';')),'nativeBuild':json.loads((ROOT/'.local-research/native/build.json').read_text()),'optimizationSummary':experiments['repeated']['summary'],'wasmOptimizationSummary':experiments['wasmComparison']['summary'],'performance':summaries(benchmark['final']),'initialPerformance':summaries(benchmark['initial']),'gatePerformance':summaries(benchmark['gate']),'tests':tests,'wasmQualification':json.loads((ROOT/'.local-research/wasm-build/qualification.json').read_text()),'browserNumerical':optional('browser-numerical.json'),'browserIntegration':read('browser-integration.json'),'budget':read('measurement-budget.json'),'forecast':optional('acceptance-forecast.json'),'resources':resources,'safari':optional('safari.json'),'stress':optional('stress.json'),'lifecycle':optional('lifecycle.json'),'uiStress':optional('ui-stress.json'),'backendAnalysis':optional('backend-analysis.json'),'backendAudit':optional('backend-audit.json'),'acceptanceAudit':optional('acceptance-audit.json'),'acceptanceSummary':optional('acceptance-summary.json'),'acceptancePilot':optional('acceptance-pilot/acceptance-summary.json')}
    result['gateWasmBuild']={'fingerprint':benchmark['gate']['rows'][0]['results']['wasm']['buildIdentity'],'sourceHashes':{'native/engine.cpp':sha(OUT/'gate-engine.cpp'),'native/engine.hpp':sha(OUT/'gate-engine.hpp')},'artifacts':{'engine-4475000232510050.mjs':'82d2f21557d6a46ec1d46b1cbe6c45476768edc3e9443c103b5a9a30cc7dc2a4','engine-4475000232510050.wasm':'4c3cf57e0a93aed4c58fec84d670d76ab26622f8f3ae939a0127a52cf499a049'},'scope':'Executed gate build identity and artifact receipts preserved before final helper rebuild; same pinned flags and frozen header.'}
    if final:pack_games()
    write('mac-optimization-experiments-20261030.json',experiments);write('mac-optimization-benchmarks-20261030.json',benchmark);write('mac-optimization-profiles-20261030.json',profiles);write('mac-optimization-results-20261030.json',result)
    print(json.dumps({'published':True,'stage':result['stage'],'activeMeasurementSeconds':result['budget']['spentSeconds'],'tests':tests}))
if __name__=='__main__':main()
