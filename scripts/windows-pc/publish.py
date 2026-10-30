"""Compact PC evidence and an independent audit of every applied game reply."""
from pathlib import Path
from functools import lru_cache
from collections import Counter
import hashlib
import importlib.util
import json
import re
import statistics as stats
import subprocess
import platform
import datetime

ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'.local-research/windows-pc-20261030';DATA=ROOT/'docs/data'
def read(name):return json.loads((OUT/name).read_text())
def write(name,value):(DATA/name).write_text(json.dumps(value,separators=(',',':'))+'\n')
def environment():
    if (OUT/'environment-final.json').exists():return read('environment-final.json')
    return {'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'uname':platform.uname()._asdict(),'python':platform.python_version(),'node':subprocess.check_output(['node','--version'],text=True).strip(),'storageBytes':subprocess.check_output(['df','-B1','/','/mnt/c'],text=True)}
def load_rules():
    spec=importlib.util.spec_from_file_location('independent',ROOT/'scripts/native/verify.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m.children
children=load_rules()
@lru_cache(maxsize=20000)
def exact(board,player):
    moves=children(board,player)
    if not moves:
        if children(board,-player):return -exact(board,-player)
        margin=sum(board)*player
        return (10000 if margin>0 else -10000)+margin if margin else 0
    return max(-exact(tuple(b),-player) for b in moves.values())
def performance(x,backends):
    result=[]
    for model in ['B','P']:
        rows=[r for r in x['rows'] if r['model']==model]
        for b in backends:
            batches=[sum(r['results'][b]['elapsedMs'] for r in rows if r['rep']==rep) for rep in range(5)]
            nodes=sum(r['results'][b]['nodes'] for r in rows if r['rep']==0)
            evaluations=sum(r['results'][b]['evaluations'] for r in rows if r['rep']==0)
            sample=rows[0]['results'][b]
            counters={k:sum(r['results'][b][k] for r in rows if r['rep']==0) for k in ['ttProbes','ttHits','ttBoundHits','ttCollisions','ttReplacements','ttCutoffs','ttStores','ttRejectedStores','cutoffs','firstMoveCutoffs'] if k in sample}
            static=[r['static'][b]['elapsedMs']*1e6/r['static'][b]['evaluations'] for r in rows]
            result.append({'model':model,'backend':b,'batchesMs':batches,'medianBatchMs':stats.median(batches),'rangeBatchMs':[min(batches),max(batches)],'nodes':nodes,'evaluations':evaluations,'millionNodesPerSecond':nodes/stats.median(batches)/1000,'medianStaticNs':stats.median(static),'staticMillionPerSecond':1000/stats.median(static),'counters':counters})
    return result
def condition(row):
    if row is None:return None
    w=row.get('windows',{});l=row['linux']
    return {'linux':{k:l[k] for k in ['at','availableBytes','swapUsedBytes','swapInPages','swapOutPages','load','cpuTicks','pressure']},'windows':{k:w[k] for k in ['at','availableBytes','committedBytes','pagesInputPerSec','pagesOutputPerSec','pageReadsPerSec','cpuPercent','activeProcesses'] if k in w}}
def compact_trials(x):
    rows=[]
    for row in x:
        r=dict(row)
        for key in ['resourcesBefore','resourcesAfter']:
            if key in r:r[key]=condition(r[key])
        rows.append(r)
    return rows

def main():
    b=read('browser-benchmarks.json');steady=read('steady.json');accept=read('acceptance-games.json');summary=read('acceptance-summary.json')
    assert len(b['rows'])==80 and len(b['timed'])==72 and len(steady['rows'])==14
    assert len(accept['games'])==24 and not summary['errors']
    for row in b['rows']:
        n=row['results']['native']
        for backend,r in row['results'].items():
            assert abs(r['score']-n['score'])<=1e-10
            if backend!='javascript':assert r['nodes']==n['nodes'] and r['evaluations']==n['evaluations']
        for s in row['static'].values():assert s['checksum']==row['static']['native']['checksum']
    games=[];searches=passes=solves=0;cells=Counter()
    for g in accept['games']:
        board=[0]*64;board[28]=board[35]=1;board[27]=board[36]=-1;player=1;states=[];local_passes=0
        for move in g['moves']:
            legal=children(board,player)
            if not legal:assert children(board,-player);player=-player;local_passes+=1;legal=children(board,player)
            assert move['player']==player and move['move'] in legal
            states.append((board,player,move['move']));board=legal[move['move']];player=-player
        assert board==g['board'] and not children(board,1) and not children(board,-1)
        assert local_passes==g['forcedPasses'];passes+=local_passes;cells[g['model'],g['budgetMs'],g['human']]+=1
        record={k:v for k,v in g.items() if k!='plays'};record['searches']=[]
        for ply,(board,player,move) in enumerate(states):
            if player!=-g['human']:continue
            replies=[e for e in g['plays'] if e['request']['board']==board and e['request']['player']==player and e['response']['choice']['move']==move]
            assert replies,(g['index'],ply)
            e=replies[-1];r=e['response']['choice'];assert r['model']==g['model'] and r['backend']=='WebAssembly'
            assert r['memoryBytes']==33554432 and r['tableBytes']==10485760
            if r['depth']==0:assert r['score'] is None and not r['exact']
            if r['exact'] and board.count(0)<=4:assert r['score']==exact(tuple(board),player);solves+=1
            keys=['move','score','depth','exact','timedOut','elapsedMs','interfaceMs','nodes','evaluations','ttProbes','ttHits','ttCutoffs','ttCollisions','ttReplacements','cutoffs','initializationMs']
            record['searches'].append({'ply':ply,'player':player,'roundTripMs':e['roundTripMs'],**{k:r[k] for k in keys if k in r}});searches+=1
        games.append(record)
    assert len(cells)==8 and set(cells.values())=={3}
    profiles=read('native-profiles.json');compact_profiles=[]
    for p in profiles['rows']:
        samples=[]
        for line in p['report'].splitlines():
            m=re.match(r'\s*([\d.]+)%\s*;\s*(\d+)\s*;\[.\] (.*?)\s*;',line)
            if m:samples.append({'symbol':m[3],'percent':float(m[1]),'samples':int(m[2])})
        assert p['status']['code']==0 and samples
        compact_profiles.append({k:v for k,v in p.items() if k!='report'}|{'selfSamples':samples})
    resource_rows=[json.loads(line) for line in (OUT/'resources.jsonl').read_text().splitlines()]
    resource_summary={'samples':len(resource_rows),'first':resource_rows[0],'last':resource_rows[-1],
        'minWindowsAvailableGiB':min(r['windows']['availableBytes']/2**30 for r in resource_rows),'maxWindowsAvailableGiB':max(r['windows']['availableBytes']/2**30 for r in resource_rows),
        'maxPagesInputPerSec':max(r['windows']['pagesInputPerSec'] for r in resource_rows),'maxPagesOutputPerSec':max(r['windows']['pagesOutputPerSec'] for r in resource_rows),
        'minLinuxAvailableGiB':min(r['linux']['availableBytes']/2**30 for r in resource_rows),'swapInPagesDelta':resource_rows[-1]['linux']['swapInPages']-resource_rows[0]['linux']['swapInPages'],'swapOutPagesDelta':resource_rows[-1]['linux']['swapOutPages']-resource_rows[0]['linux']['swapOutPages'],
        'maxLinuxMemoryPressureAvg10':max(float(re.search(r'some avg10=([\d.]+)',r['linux']['pressure']['memory'])[1]) for r in resource_rows)}
    conditions=[]
    for model in ['B','P']:
        for budget in [80,300]:
            gs=[g for g in games if g['model']==model and g['budgetMs']==budget];rs=[r for g in gs for r in g['searches']]
            conditions.append({'model':model,'budgetMs':budget,'games':len(gs),'searches':len(rs),'meanDepth':stats.mean(r['depth'] for r in rs),'maxDepth':max(r['depth'] for r in rs),'exact':sum(r['exact'] for r in rs),'depthZero':sum(r['depth']==0 for r in rs),'maxCoreOverrunMs':max(r['elapsedMs']-budget for r in rs),'maxRoundTripOverrunMs':max(r['roundTripMs']-budget for r in rs),'nodes':sum(r['nodes'] for r in rs)})
    timed=[]
    for model in ['B','P']:
        for budget in [80,300]:
            rs=[r for r in b['timed'] if r['model']==model and r['budgetMs']==budget]
            for backend in ['native','host','wasm','javascript']:
                timed.append({'model':model,'budgetMs':budget,'backend':backend,'n':len(rs),'meanDepth':stats.mean(r[backend]['depth'] for r in rs),'depths':[r[backend]['depth'] for r in rs],'exact':sum(r[backend]['exact'] for r in rs),'nodes':sum(r[backend]['nodes'] for r in rs),'evaluations':sum(r[backend]['evaluations'] for r in rs),'maxCoreOverrunMs':max(r[backend]['elapsedMs']-budget for r in rs)})
    steady_summary=[]
    for model in ['B','P']:
        for backend in ['native','host','wasm','javascript']:
            xs=[r['results'][backend]['coreMs']/r['repeats'] for r in steady['rows'] if r['model']==model]
            steady_summary.append({'model':model,'backend':backend,'msPerBatch':xs,'medianMs':stats.median(xs),'rangeMs':[min(xs),max(xs)]})
    files=['native/engine.cpp','native/engine.hpp','native/main.cpp','native/browser.cpp','scripts/native/build.mjs','scripts/native/client.mjs','scripts/native/client.py','tests/wasm_benchmark_worker.js','tests/wasm_benchmark.html','tests/wasm_browser_check.py','tests/browser_check.py']
    files+=['src/'+p for p in ['search.js','features.js','fast-features.js','rules.js','app.js','worker.js','backend.js','wasm-engine.js','coaching.js','review.js']]
    files += [str(p.relative_to(ROOT)) for p in sorted((ROOT/'scripts/windows-pc').glob('*')) if p.is_file()]
    files += [str(p.relative_to(ROOT)) for p in sorted((ROOT/'scripts/wasm').glob('*.py'))]
    hashes={p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in files}
    manifest=json.loads((ROOT/'src/wasm/manifest.js').read_text().split('export default ',1)[1].rsplit(';',1)[0])
    for p,digest in manifest['artifacts'].items():assert hashlib.sha256((ROOT/'src/wasm'/p).read_bytes()).hexdigest()==digest
    audit={'passed':True,'games':len(games),'appliedComputerReplies':searches,'forcedPasses':passes,'smallIndependentExactChecks':solves,'fixedRows':80,'timedRows':72,'steadyConditions':14,'balancedCells':3,'maxFixedScoreError':0,'maxStaticChecksumError':0,'wasmArtifacts':'unchanged and hash-matched'}
    mac=json.loads((DATA/'wasm-browser-benchmarks-20261030.json').read_text())
    result={'qualificationCommit':'a00ba4c69ca13ea173909ec7b0206202506cf6ca','environment':environment(),'sourceHashes':hashes,'mainBenchmarkSourceCommit':'a00ba4c69ca13ea173909ec7b0206202506cf6ca','wasmManifest':manifest,'nativeBuild':b['fixtures']['native'],'hostBuild':b['hostBuild'],
        'performance':performance(b,['native','host','wasm','javascript']),'macPerformanceRecomputedSameMethod':performance(mac,['native','wasm','javascript']),'steadyPerformance':steady_summary,'timed':timed,'browserProfiles':b['profiles'],'nativeProfiles':compact_profiles,'instrumentedSpans':profiles['spans'],
        'resources':resource_summary,'lifecycle':read('lifecycle.json'),'nativeOverhead':read('native-overhead.json'),'uiStress':read('ui-stress.json'),
        'acceptance':{**summary,'conditions':conditions,'forcedPasses':passes,'terminalWithEmpties':sum(0 in g['board'] for g in games),'maxFrameGapMs':max(g['frames']['maxMs'] for g in games),'maxGameP95FrameGapMs':max(g['frames']['p95Ms'] for g in games)},'audit':audit}
    write('windows-pc-benchmarks-20261030.json',{'browser':b['browser'],'fixtures':b['fixtures'],'hostBuild':b['hostBuild'],'cold':b['cold'],'rows':compact_trials(b['rows']),'timed':compact_trials(b['timed']),'boundary':b['boundary'],'steadyRows':compact_trials(steady['rows'])})
    write('windows-pc-games-20261030.json',{'purpose':'engineering acceptance, not playing-strength inference','browser':accept['browser'],'games':games})
    write('windows-pc-resources-20261030.json',{'sampling':'approximately 15 s plus query time; not a complete page-fault trace','rows':resource_rows})
    write('windows-pc-results-20261030.json',result)
    print(json.dumps({'audit':audit,'performance':result['performance'],'steadyPerformance':steady_summary,'resources':resource_summary,'acceptanceConditions':conditions},indent=2))
if __name__=='__main__':main()
