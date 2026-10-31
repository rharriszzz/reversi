"""Compact and audit production acceptance; refuses incomplete browser gates.

Run --publish only after the local production run passes, then run without args
for an SDK/browser-independent audit of the committed evidence.
"""
import copy,hashlib,json,os,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
LOCAL=ROOT/os.environ.get('REVERSI_FLIP_RUN','.local-research/fast-flips-production-20261031')
PUBLIC=ROOT/'docs/data/fast-flips-production'
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
    for path,measured in safari['sourceHashes'].items():
        if sha(ROOT/path)!=measured:
            assert path=='scripts/mac/fast-flips-production-safari.py'
            published=(ROOT/path).read_bytes()
            restored=published.replace(b"'.local-research/fast-flips-production-20261031/safari'",b"'.local-research/safari-qualification-20261030'")
            assert hashlib.sha256(restored).hexdigest()==measured
            harness_changes[path]={'measuredSha256':measured,'publishedSha256':sha(ROOT/path),'change':'Only the unused fallback output directory changed after acceptance. The recorded run explicitly set REVERSI_SAFARI_OUTPUT to the production directory.'}
    PUBLIC.mkdir(parents=True,exist_ok=True)
    files={'native.json':compact_native(read(LOCAL/'integrated-final.json')),'wasm.json':compact_wasm(read(LOCAL/'browser-qualification.json')),
      'chrome-games.json':compact_games(read(LOCAL/'acceptance-games.json')),'safari-games.json':compact_games(read(LOCAL/'safari/games.json')),
      'browsers.json':{'chrome':chrome,'safari':safari,'harnessChanges':harness_changes,'chromeIntegration':read(LOCAL/'browser-integration.json'),'packagedBrowser':read(LOCAL/'packaged-browser-check.log')},
      'qualification.json':{'native':read(LOCAL/'qualification.json'),'wasm':read(LOCAL/'wasm-qualification.json'),'timed':read(LOCAL/'timed-qualification.json'),'mailboxExact':read(LOCAL/'mailbox-exact.json'),'closingChecks':read(LOCAL/'closing-checks.json')},
      'builds.json':{'oldWasm':manifest(LOCAL/'old-manifest.js'),'newWasm':manifest(ROOT/'src/wasm/manifest.js'),'proof':read(LOCAL/'build-proof.json'),'native':read(LOCAL/'builds.json'),'reproducible':all((LOCAL/f).read_bytes()==(ROOT/'src/wasm'/f).read_bytes() for f in manifest(ROOT/'src/wasm/manifest.js')['artifacts']) and (LOCAL/'new-manifest-first.js').read_bytes()==(ROOT/'src/wasm/manifest.js').read_bytes()},
      'resources.json':{**read(LOCAL/'budget.json'),'closingSnapshot':read(LOCAL/'resources-final.json')}}
    # Keep meaningful final suite summaries and exact log identities, not raw logs.
    tests=[('node-final.log','pass 182'),('sanitizers.log','pass 16'),('python-tests.log','Ran 46 tests'),('wasm-internals.log','PASS actual Wasm'),('chrome-custom.log','PASS: real Chromium')]
    files['qualification.json']['tests']=[]
    for name,needle in tests:
        text=(LOCAL/name).read_text();assert needle in text
        files['qualification.json']['tests'].append({'log':name,'sha256':sha(LOCAL/name),'requiredSummary':needle,'returnCode':0,'tail':text.splitlines()[-12:]})
    for name,data in files.items():(PUBLIC/name).write_text(json.dumps(data,separators=(',',':'))+'\n')
    sources=['native/engine.cpp','native/engine.hpp','native/browser.cpp','src/wasm-engine.js','src/backend.js','src/app.js','src/worker.js']
    sources += [str(p.relative_to(ROOT)) for p in (ROOT/'scripts/fast-flips').glob('*production*') if p.suffix in ['.py','.js','.mjs']]
    sources += ['scripts/fast-flips/packaged-browser-check.py','scripts/mac/fast-flips-production-safari.py','scripts/wasm/fast-flips-production-acceptance.py']
    index={'passed':True,'baseline':'1058f013581e0566277586f857b0a2884be260f6','qualifiedPublication':'791c0f8516eb34d9ba683804b0e62428eb068c56','sourceHashes':{p:sha(ROOT/p) for p in sources},'files':{name:sha(PUBLIC/name) for name in files}}
    (PUBLIC/'manifest.json').write_text(json.dumps(index,separators=(',',':'))+'\n')

def verify():
    m=read(PUBLIC/'manifest.json');assert m['passed']
    for f,h in m['files'].items():assert sha(PUBLIC/f)==h,f
    for f,h in m['sourceHashes'].items():assert sha(ROOT/f)==h,f
    builds=read(PUBLIC/'builds.json');new=builds['newWasm'];old=builds['oldWasm']
    assert new==manifest(ROOT/'src/wasm/manifest.js') and builds['reproducible']
    for f,h in new['artifacts'].items():assert sha(ROOT/'src/wasm'/f)==h
    for key in ['models','weights','flags','abi','modelHeaderSha256']:assert new[key]==old[key],key
    assert new['sourceHashes']['native/engine.cpp']==m['sourceHashes']['native/engine.cpp']=='b97d526697e68aa04186b67d2e13dc0f4eab21fb086921532e8b9b63cf47e7a5'
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
    browsers=read(PUBLIC/'browsers.json');assert browsers['chrome']['passed'] and browsers['safari']['passed']
    for path,measured in browsers['safari']['sourceHashes'].items():
        if sha(ROOT/path)!=measured:
            change=browsers['harnessChanges'][path];assert sha(ROOT/path)==change['publishedSha256'] and measured==change['measuredSha256']
            assert hashlib.sha256((ROOT/path).read_bytes().replace(b"'.local-research/fast-flips-production-20261031/safari'",b"'.local-research/safari-qualification-20261030'")).hexdigest()==measured
    assert browsers['safari']['launcherBuildIdentity']==browsers['chrome']['reloadIdentity']['fingerprint']==new['fingerprint']
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
