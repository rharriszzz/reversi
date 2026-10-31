"""Runtime dispatch Mac evidence; derived from historical production-evidence.py.

Run --publish only after the local production run passes, then run without args
for an SDK/browser-independent audit of the committed evidence.
"""
import copy,hashlib,json,os,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
LOCAL=ROOT/os.environ.get('REVERSI_FLIP_RUN','.local-research/runtime-cpu-mac-20261031')
PUBLIC=ROOT/'docs/data/runtime-cpu-mac'
def read(p):return json.loads(p.read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def canonical(x):return hashlib.sha256(json.dumps(x,sort_keys=True,separators=(',',':')).encode()).hexdigest()
def manifest(p):return json.loads(p.read_text().split('export default ')[1].strip().removesuffix(';'))
def signatures(roots):return [{k:v for k,v in x.items() if k!='elapsedMs'} for x in roots]
def compact_native(data):
    data=copy.deepcopy(data);references={}
    for w in data['workloads']:
        n=len(w['positionIds']);r=next(r for r in data['rows'] if r['workload']==w['id']);references[w['id']]=signatures(r['results']['original']['roots'][:n])
        w['file']=Path(w['file']).name
    for row in data['rows']:
        for r in row['results'].values():
            actual=signatures(r.pop('roots'));assert actual==references[row['workload']]*r['repeats']
            r['fullRootSignatureSha256']=canonical(actual);r.pop('loadAddress',None)
    data['rootReferences']=references
    return data

def compact_wasm(data):
    data=copy.deepcopy(data);batches={}
    for row in data['rows']:
        for r in row['results'].values():
            roots=r.pop('roots');key=canonical(roots);batches[key]=roots;r['rootBatchSha256']=key
        assert row['results']['original']['rootBatchSha256']==row['results']['selected']['rootBatchSha256']
    data['rootBatches']=batches
    return data

def compact_games(data):
    data=copy.deepcopy(data)
    columns=list(dict.fromkeys(k for g in data['games'] for e in g['plays'] for k in e['response']['choice']))
    for g in data['games']:
        g['searches']=[{'ply':sum(v!=0 for v in e['request']['board'])-4,'player':e['request']['player'],'roundTripMs':e['roundTripMs'],'values':[e['response']['choice'].get(k) for k in columns]} for e in g.pop('plays')]
    data['searchColumns']=columns
    return data

def publish():
    chrome=read(LOCAL/'acceptance-summary.json');safari=read(LOCAL/'safari/qualification.json')
    assert chrome['passed'] and safari['passed'],'Do not publish incomplete Chrome/Safari acceptance'
    assert chrome['reloadIdentity']['fingerprint']==safari['wasmBuild']['fingerprint']
    harness_changes={}
    for path,measured in safari['sourceHashes'].items():assert sha(ROOT/path)==measured,path
    PUBLIC.mkdir(parents=True,exist_ok=True)
    files={'native.json':compact_native(read(LOCAL/'integrated-final.json')),'wasm.json':compact_wasm(read(LOCAL/'browser-qualification.json')),
      'chrome-games.json':compact_games(read(LOCAL/'acceptance-games.json')),'safari-games.json':compact_games(read(LOCAL/'safari/games.json')),
      'browsers.json':{'chrome':chrome,'safari':safari,'harnessChanges':harness_changes,'chromeIntegration':read(LOCAL/'browser-integration.json'),'safariBenchmark':compact_wasm(read(LOCAL/'safari-browser-qualification.json'))},
      'qualification.json':{'native':read(LOCAL/'qualification.json'),'wasm':read(LOCAL/'wasm-qualification.json'),'interruption':read(LOCAL/'interruption-qualification.json'),'packaging':read(LOCAL/'build-proof.json'),'compatibility':read(LOCAL/'compatibility.json'),'timed':read(LOCAL/'timed-qualification.json'),'mailboxExact':read(LOCAL/'mailbox-exact.json'),'closingChecks':read(LOCAL/'closing-checks.json')},
      'summary.json':read(LOCAL/'summary.json'),'builds.json':{'reproducibility':read(LOCAL/'reproducibility.json'),'oldWasm':manifest(LOCAL/'old-manifest.js'),'newWasm':manifest(ROOT/'src/wasm/manifest.js'),'proof':read(LOCAL/'build-proof.json'),'native':read(LOCAL/'builds.json'),'reproducible':all((LOCAL/f).read_bytes()==(ROOT/'src/wasm'/f).read_bytes() for f in manifest(ROOT/'src/wasm/manifest.js')['artifacts']) and (LOCAL/'new-manifest-first.js').read_bytes()==(ROOT/'src/wasm/manifest.js').read_bytes()},
      'resources.json':{**read(LOCAL/'budget.json'),'closingSnapshot':read(LOCAL/'resources-final.json'),'environment':read(LOCAL/'environment.json'),'launcher':read(LOCAL/'launcher.json')}}
    # Keep meaningful final suite summaries and exact log identities, not raw logs.
    tests=[('node-final.log','pass 182'),('final-sanitize.log','pass 16'),('python-tests.log','Ran 46 tests'),('wasm-internals.log','PASS actual Wasm')]
    files['qualification.json']['tests']=[]
    for name,needle in tests:
        text=(LOCAL/name).read_text();assert needle in text
        files['qualification.json']['tests'].append({'log':name,'sha256':sha(LOCAL/name),'requiredSummary':needle,'returnCode':0,'tail':text.splitlines()[-12:]})
    for name,data in files.items():(PUBLIC/name).write_text(json.dumps(data,separators=(',',':'))+'\n')
    sources=['native/engine-impl.inc','native/engine-tables.hpp','native/engine-enhanced.cpp','scripts/native/build.mjs','scripts/wasm/build.mjs','native/engine.cpp','native/engine.hpp','native/browser.cpp','src/wasm-engine.js','src/backend.js','src/app.js','src/worker.js']
    sources += [str(p.relative_to(ROOT)) for p in (ROOT/'scripts/fast-flips').glob('*production*') if p.suffix in ['.py','.js','.mjs']]
    sources += ['tests/wasm_browser_check.py','scripts/mac/runtime-cpu-safari.py','scripts/wasm/fast-flips-production-acceptance.py']
    sources += [str(p.relative_to(ROOT)) for p in (ROOT/'scripts/runtime-cpu-mac').glob('*') if p.suffix in ['.py','.js','.mjs']]
    index={'passed':True,'baseline':'6b480ed1bc6ddcdde2fdb37872c0ca8d0a804425','qualifiedPublication':'911ce40096a869a684b21496f2c3060cd316fada','sourceHashes':{p:sha(ROOT/p) for p in sources},'files':{name:sha(PUBLIC/name) for name in files}}
    (PUBLIC/'manifest.json').write_text(json.dumps(index,separators=(',',':'))+'\n')

def verify():
    m=read(PUBLIC/'manifest.json');assert m['passed']
    for f,h in m['files'].items():assert sha(PUBLIC/f)==h,f
    for f,h in m['sourceHashes'].items():assert sha(ROOT/f)==h,f
    builds=read(PUBLIC/'builds.json');new=builds['newWasm'];old=builds['oldWasm']
    assert new==manifest(ROOT/'src/wasm/manifest.js') and builds['reproducible']
    for f,h in new['artifacts'].items():assert sha(ROOT/'src/wasm'/f)==h
    for key in ['models','weights','flags','abi','modelHeaderSha256']:assert new[key]==old[key],key
    assert new['sourceHashes']['native/engine.cpp']==m['sourceHashes']['native/engine.cpp']
    for f in ['native/engine-impl.inc','native/engine-tables.hpp']:assert new['sourceHashes'][f]==m['sourceHashes'][f]
    native=read(PUBLIC/'native.json');blocks=0
    for row in native['rows']:
        baseline=row['results']['original']
        for r in row['results'].values():
            assert r['metrics']==baseline['metrics'] and r['fullRootSignatureSha256']==canonical(native['rootReferences'][row['workload']]*r['repeats']);blocks+=1
    wasm=read(PUBLIC/'wasm.json')
    for key,value in wasm['rootBatches'].items():assert canonical(value)==key
    for row in wasm['rows']:assert row['results']['original']['rootBatchSha256']==row['results']['selected']['rootBatchSha256']
    q=read(PUBLIC/'qualification.json');assert all(q[k]['passed'] for k in ['native','wasm','timed','mailboxExact'])
    assert all(r['returnCode']==0 for r in q['closingChecks']+q['tests'])
    for key in ['interruption','packaging','compatibility']:assert q[key]['passed']
    for panel in q['mailboxExact']['rows']:
        for model in ['B','L','P']:
            actual=native['rootReferences'][panel['panel']+'-'+model]
            assert [r['score'] for r in actual]==[r['score'] for r in panel['references']]
    resources=read(PUBLIC/'resources.json');assert resources['launcher']['passed'] and resources['launcher']['shutdownVerified']
    assert builds['reproducibility']['passed'] and all(builds['reproducibility']['byteIdentical'].values())
    browsers=read(PUBLIC/'browsers.json');assert browsers['chrome']['passed'] and browsers['safari']['passed'] and browsers['chromeIntegration']['passed']
    for path,measured in browsers['safari']['sourceHashes'].items():assert sha(ROOT/path)==measured,path
    assert browsers['safari']['launcherBuildIdentity']==browsers['chrome']['reloadIdentity']['fingerprint']==new['fingerprint']
    assert browsers['safari']['fetchedWasmSha256']==new['artifacts'][new['module'].replace('.mjs','.wasm')]
    safari_bench=browsers['safariBenchmark']
    for key,value in safari_bench['rootBatches'].items():assert canonical(value)==key
    for row in safari_bench['rows']:assert row['results']['original']['rootBatchSha256']==row['results']['selected']['rootBatchSha256']
    # Independent sentinel mailbox replay, passes, final boards and small exacts.
    import importlib.util
    spec=importlib.util.spec_from_file_location('mailbox',ROOT/'scripts/mac/audit.py');rules=importlib.util.module_from_spec(spec);spec.loader.exec_module(rules)
    games=placements=passes=searches=exact=0
    for file in ['chrome-games.json','safari-games.json']:
        data=read(PUBLIC/file)
        for g in data['games']:
            board=[0]*64;board[28]=board[35]=1;board[27]=board[36]=-1;turn=1;states={};local_passes=0
            for i,step in enumerate(g['moves']):
                options=rules.moves(board,turn)
                if not options:assert rules.moves(board,-turn);turn=-turn;local_passes+=1;options=rules.moves(board,turn)
                assert step['player']==turn and step['move'] in options;states[i]=(board,turn,step['move']);board=options[step['move']];turn=-turn;placements+=1
            assert board==g['board'] and not rules.moves(board,1) and not rules.moves(board,-1) and local_passes==g['forcedPasses'];passes+=local_passes
            for r in g['searches']:
                value=dict(zip(data['searchColumns'],r['values'],strict=True));board,turn,move=states[r['ply']]
                assert value['move']==move and turn==r['player']==-g['human'];assert value['model']==g['model'] and value['backend']=='WebAssembly' and value['memoryBytes']==33554432
                assert value['buildIdentity']==new['fingerprint']
                if value['exact'] and board.count(0)<=6:assert value['score']==rules.exact(tuple(board),turn);exact+=1
                searches+=1
            rules.exact.cache_clear();games+=1
    assert games==12 and read(PUBLIC/'resources.json')['activeSeconds']<1800
    print(json.dumps({'passed':True,'nativeFixedBuildBlocks':blocks,'wasmFixedPairs':len(wasm['rows']),'browserGames':games,'placements':placements,'forcedPasses':passes,'appliedReplies':searches,'independentExactChecks':exact,'fingerprint':new['fingerprint']}))
if __name__=='__main__':
    if '--publish' in sys.argv:publish()
    verify()
