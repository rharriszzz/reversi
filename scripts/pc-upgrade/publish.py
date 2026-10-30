"""Publish compact final-PC engineering evidence; retain all historical results."""
from pathlib import Path
import datetime
import hashlib
import json
import re
import statistics
import subprocess

ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'.local-research/pc-upgrade-20261030';DATA=ROOT/'docs/data'
def read(name):return json.loads((OUT/name).read_text())
def write(name,value):(DATA/name).write_text(json.dumps(value,separators=(',',':'))+'\n')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def group(symbol):
    if 'negamax' in symbol:return 'searchTTOrdering'
    if 'ordered' in symbol:return 'searchTTOrdering'
    if 'legal' in symbol:return 'legal'
    if 'flips' in symbol:return 'flips'
    if 'features' in symbol or 'evaluate' in symbol:return 'featuresWrapper'
    if 'pattern' in symbol:return 'patterns'
    if 'popcount' in symbol:return 'softwarePopcount'
    return 'other'
def main():
    benchmark=read('native-benchmarks.json');profiles=read('native-profiles.json');browser=read('browser-sanity.json')
    assert benchmark['passed'] and len(benchmark['rows'])==14
    assert len(profiles['rows'])==9 and len(profiles['spans'])==9
    for p in profiles['rows']:
        report=(OUT/f"gcc15-{p['cpu']}-{p['phase']}.perf.txt").read_text()
        p['lostSamples']=int(re.search(r'Total Lost Samples: (\d+)',report)[1])
        assert p['lostSamples']==0
        grouped={}
        for row in p['selfSamples']:
            category=group(row['symbol'])
            # Profile executable disassembly identifies its 0x25a0 PLT entry.
            if p['cpu']=='portable' and row['symbol']=='0x00000000000025a0':category='softwarePopcount'
            grouped[category]=grouped.get(category,0)+row['percent']
        p['groupedSelfPercent']=grouped
    rows=[json.loads(l) for l in (OUT/'resources.jsonl').read_text().splitlines()]
    resources={'samples':len(rows),'first':rows[0],'last':rows[-1],
        'minLinuxAvailableGiB':min(r['linux']['availableBytes']/2**30 for r in rows),'minWindowsAvailableGiB':min(r['windows']['availableBytes']/2**30 for r in rows),
        'linuxSwapInDeltaPages':rows[-1]['linux']['swapInPages']-rows[0]['linux']['swapInPages'],'linuxSwapOutDeltaPages':rows[-1]['linux']['swapOutPages']-rows[0]['linux']['swapOutPages'],
        'maxWindowsPagingRates':{k:max(r['windows'][k] for r in rows) for k in ['pagesInputPerSec','pagesOutputPerSec','pageReadsPerSec']},
        'history':[{'linux':{k:r['linux'][k] for k in ['at','availableBytes','swapUsedBytes','swapInPages','swapOutPages','load','pressure']},'windows':{k:r['windows'][k] for k in ['at','availableBytes','committedBytes','cpuPercent','pagesInputPerSec','pagesOutputPerSec','pageReadsPerSec']}} for r in rows]}
    integrations={c:json.loads((OUT/c/'browser-integration.json').read_text()) for c in ['chrome','edge']}
    numerical={c:read(f'{c}-numerical.json') for c in ['chrome','edge']}
    assert all(r['passed'] for r in integrations.values()) and all(r['passed'] for r in numerical.values())
    custom=(OUT/'edge-custom.log').read_text();assert 'PASS: real Chromium' in custom and 'Browser: 156.0.4314.42' in custom
    browsers={'passed':True,'numerical':numerical,'integration':integrations,'edgeCustom':{'passed':True,'checks':['colors','keyboard comparison','undo/replay','rapid changes','bounded UI training smoke','actual export Blob and Windows file agreement','reload/persistence','complete custom game and review'],'logSha256':sha(OUT/'edge-custom.log')},'memory':read('edge-memory.json'),'initialMemoryObservation':read('edge-memory-first.json'),'sanity':browser}
    summaries=[]
    for channel in ['chrome','edge']:
        for model in ['B','P']:
            times=[r['coreMs']/r['repeats'] for r in browser['rows'] if r['identity']['channel']==channel and r['model']==model]
            summaries.append({'channel':channel,'model':model,'batchMs':times,'medianBatchMs':statistics.median(times),'rangeBatchMs':[min(times),max(times)]})
    browsers['performanceSummary']=summaries
    manifest=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import m from './src/wasm/manifest.js'; console.log(JSON.stringify(m));"],cwd=ROOT,text=True))
    for name,digest in manifest['artifacts'].items():assert sha(ROOT/'src/wasm'/name)==digest
    final_tests={}
    for name,file,count in [('python','python-checkpoint2.log',39),('node','node-checkpoint2.log',171)]:
        path=OUT/file
        if path.exists():
            log=path.read_text()
            assert ('\nOK\n' in log and 'Ran 39 tests' in log) if name=='python' else ('pass 171' in log and 'fail 0' in log)
            final_tests[name]={'passed':True,'tests':count,'logSha256':sha(path)}
    source_paths=[ROOT/'native/engine.cpp',ROOT/'native/engine.hpp',ROOT/'native/browser.cpp',ROOT/'native/main.cpp',ROOT/'scripts/native/build.mjs',ROOT/'scripts/wasm/build.mjs',ROOT/'scripts/wasm/internals.mjs',ROOT/'scripts/wasm/setup.sh',ROOT/'scripts/python.mjs',ROOT/'scripts/windows-pc/browser.py',ROOT/'scripts/windows-pc/qualify.py',ROOT/'scripts/windows-pc/resources.py',ROOT/'scripts/wasm/browser.py',*sorted((ROOT/'scripts/pc-upgrade').glob('*.py')),*sorted((ROOT/'scripts/pc-upgrade').glob('*.mjs'))]
    result={'format':'reversi-final-pc-upgrade-v1','at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'checkpoint1':'0ee7857ca327b8000865ade783bd0dab44a62723','pythonEnvironment':read('python-environment.json'),'qualification':'ubuntu2604-qualification-20261030.json','nativeSummary':benchmark['summary'],'instructions':read('instructions.json'),'profiles':profiles,'resources':resources,'wasmManifest':manifest,'currentSourceHashes':{str(p.relative_to(ROOT)):sha(p) for p in source_paths},'compilerComparison':'Historical GCC11 results only, per user steering; same roots/depths/counts, environment/warmup/scheduling differ. No isolated compiler-version causal claim.','intensiveToolWallSeconds':benchmark['wallSeconds']+browser['wallSeconds']+profiles['wallSeconds'],'intensiveCeilingSeconds':5400,'browserPerformance':summaries,'harnessRepairs':['Atomic concurrent native build publication, independently tested','Expected argparse rejection diagnostics captured without weakening rejection','Edge cleanup tolerates null/exited CIM process and a process that exits between identity check and taskkill; a still-live owned process failure remains fatal'],'remainingLimitations':['No new Mac or native Windows Python qualification','Pinned Emscripten SDK absent; no current-source Wasm build executed on PC','Software samples cannot establish cache misses/bandwidth/frequency or isolate inlined TT cost','Finite browser memory observations are not a proof of no long-term leaks']}
    result['finalTests']=final_tests
    assert result['intensiveToolWallSeconds']<result['intensiveCeilingSeconds']
    write('pc-upgrade-benchmarks-20261030.json',benchmark);write('pc-upgrade-browsers-20261030.json',browsers);write('pc-upgrade-results-20261030.json',result)
    print(json.dumps({'published':True,'intensiveToolWallSeconds':result['intensiveToolWallSeconds'],'resources':{k:v for k,v in resources.items() if k not in ['history','first','last']}}))
if __name__=='__main__':main()
