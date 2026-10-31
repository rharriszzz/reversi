"""Frozen engineering backend comparison; keep outcomes sealed until full audit."""
import contextlib,datetime,hashlib,importlib.util,json,os,random,re,statistics,subprocess,sys,tempfile,time
from pathlib import Path
from playwright.sync_api import sync_playwright
from resources import check,snapshot
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'.local-research/mac-modernization-20261030'
def module(name,path):
    spec=importlib.util.spec_from_file_location(name,ROOT/path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
rules=module('independent','scripts/native/verify.py');client=module('client','scripts/native/client.py')
def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def canonical(x):return json.dumps(x,sort_keys=True,separators=(',',':'))
def manifest():return json.loads((ROOT/'src/wasm/manifest.js').read_text().split('export default ')[1].strip().removesuffix(';'))
def source_hashes():
    paths=['native/engine.cpp','native/engine.hpp','native/main.cpp','native/browser.cpp','src/wasm-engine.js','scripts/mac/backend-games.py','scripts/mac/backend-worker.js','tests/mac_backend.html','scripts/native/client.py','scripts/native/verify.py','scripts/mac/audit.py','scripts/mac/analyze-games.mjs','scripts/frozen-player/statistics.mjs','scripts/p-confirmation/statistics.mjs']
    return {p:digest(ROOT/p) for p in paths}
def initial():
    b=[0]*64;b[28]=b[35]=1;b[27]=b[36]=-1;return b

def opening(seed,placements):
    rng=random.Random(seed);b=initial();p=1;moves=[]
    for _ in range(placements):
        children=rules.children(b,p)
        if not children:p=-p;children=rules.children(b,p)
        assert children
        q=rng.choice(sorted(children));moves.append({'player':p,'move':q});b=children[q];p=-p
    return {'seed':seed,'moves':moves,'board':b,'player':p}

@contextlib.contextmanager
def browser_session():
    with tempfile.TemporaryDirectory() as temp:
        server=subprocess.Popen([sys.executable,str(ROOT/'launch.py'),'--no-browser','--port','0','--http-log',str(Path(temp)/'http.log')],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
        try:
            url=re.search(r'http://127\.0\.0\.1:\d+/',server.stdout.readline()).group()
            with sync_playwright() as pw:
                browser=pw.chromium.launch(channel='chrome');page=browser.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
                page.goto(url+'tests/mac_backend.html');page.wait_for_function('()=>typeof resetBackend==="function"')
                try:yield browser,page,errors
                finally:browser.close()
        finally:server.terminate();server.communicate(timeout=5)

def game(page,root,budget,native_color):
    check();wall=time.monotonic();init=page.evaluate('()=>resetBackend()');b=root['board'][:];p=root['player'];steps=[];passes=0
    startup=time.monotonic()
    with client.NativeEngine() as native:
        native_start=(time.monotonic()-startup)*1000
        board=initial();black=sum(1<<q for q,v in enumerate(board) if v==1);white=sum(1<<q for q,v in enumerate(board) if v==-1)
        native.request(f'search {black:x} {white:x} 1 2 3 0 1 1 0 0');page.evaluate('(board)=>backend("warmup",{board,player:1})',board)
        while True:
            children=rules.children(b,p)
            if not children:
                if not rules.children(b,-p):break
                passes+=1;p=-p;continue
            backend='native' if p==native_color else 'wasm';start=time.monotonic()
            if backend=='native':
                black=sum(1<<q for q,v in enumerate(b) if v==1);white=sum(1<<q for q,v in enumerate(b) if v==-1)
                # Equal CORE elapsed budgets for both backends. External IPC
                # deadline is zero here; interface and delivery are recorded.
                result=native.request(f'search {black:x} {white:x} {p} 2 0 {budget} 1 1 0 0')
            else:result=page.evaluate('(a)=>backend("search",a)',{'board':b,'player':p,'budgetMs':budget})
            elapsed=(time.monotonic()-start)*1000;q=result['move'];assert q in children
            if result['depth']==0:assert result['score'] is None and not result['exact']
            assert result['modelIdentity']==native.receipt['models']['P'] and result['tableBytes']==10485760
            keys=['move','score','depth','exact','timedOut','elapsedMs','cpuMs','interfaceMs','workerRoundTripMs','nodes','evaluations','ttProbes','ttHits','ttBoundHits','ttCollisions','ttReplacements','ttCutoffs','ttStores','ttRejectedStores','cutoffs','firstMoveCutoffs','memoryBytes']
            steps.append({'player':p,'backend':backend,'outerWallMs':elapsed,**{k:result[k] for k in keys if k in result}})
            b=children[q];p=-p;assert len(steps)<=60
    return {'budgetMs':budget,'nativeColor':native_color,'openingSeed':root['seed'],'steps':steps,'board':b,'forcedPasses':passes,'rawBlackMargin':sum(b),'wallSeconds':time.monotonic()-wall,'wasmInitialization':init,'nativeStartupMs':native_start}

def prepare():
    roots=[];seen=set();rejected=[];seed=0x4d344200
    def canonical_root(root):
        variants=[];board=root['board']
        for color in [1,-1]:
            for mirror in [False,True]:
                for rotations in range(4):
                    transformed=[0]*64
                    for q,v in enumerate(board):
                        row,col=divmod(q,8)
                        if mirror:col=7-col
                        for _ in range(rotations):row,col=col,7-row
                        transformed[row*8+col]=v*color
                    variants.append((tuple(transformed),root['player']*color))
        return min(variants)
    while len(roots)<64:
        root=opening(seed,8+len(roots)%2);key=canonical_root(root)
        if key in seen:rejected.append(seed)
        else:seen.add(key);roots.append(dict(family=len(roots),**root))
        seed+=1
    schedule=[]
    for root in roots:
        for budget in ([80,300] if root['family']%2==0 else [300,80]):
            for color in ([1,-1] if root['family']%2==0 else [-1,1]):schedule.append({'index':len(schedule),'family':root['family'],'budgetMs':budget,'nativeColor':color})
    r={'format':'reversi-m4-backend-engineering-v1','createdUtc':datetime.datetime.now(datetime.UTC).isoformat(),'purpose':'P native versus P actual Chrome Wasm, engineering backend comparison; no evaluator promotion/learning','families':roots,'preOutcomeDuplicateSymmetryRejectedSeeds':rejected,'schedule':schedule,'model':'P','budgetsMs':[80,300],'gamesPerBudget':128,'colorSwappedFamiliesPerBudget':64,'coreBudgetPolicy':'Equal core elapsed budget, external native IPC deadline disabled; all interface, worker and outer times retained separately','ttBytes':10485760,'hints':True,'warmup':'Initial board D3 for each fresh native process and fresh Wasm worker before each game','statisticalUnit':'opening family, paired color games; same families at both budgets','inference':'Family mean native points, Student t 95% and seeded whole-family bootstrap 95%; descriptive engineering result only','bootstrapSeed':0x4d344349,'bootstrapReplicates':20000,'outcomePolicy':'No outcome summaries until exactly 256 games pass independent replay and all hashes; no interim tuning, sample selection or replacement','nativeBuild':json.loads((ROOT/'.local-research/native/build.json').read_text()),'wasmBuild':manifest(),'sourceHashes':source_hashes()}
    r['registrationSha256']=hashlib.sha256(canonical(r).encode()).hexdigest();(OUT/'backend-registration.json').write_text(json.dumps(r,indent=2)+'\n')
    (ROOT/'docs/data/mac-backend-registration-20261030.json').write_text(json.dumps(r,separators=(',',':'))+'\n');print(json.dumps({'registered':True,'games':len(schedule),'registrationSha256':r['registrationSha256']}))

def pilot():
    rows=[]
    with browser_session() as (browser,page,errors):
        for budget in [80,300]:
            result=game(page,opening(0x4d345000+budget,8),budget,1)
            rows.append({'budgetMs':budget,'wallSeconds':result['wallSeconds'],'placements':len(result['steps']),'coreMs':sum(s['elapsedMs'] for s in result['steps'])})
        assert not errors
    (OUT/'backend-pilot-timing.json').write_text(json.dumps({'rows':rows,'purpose':'Unscored timing only; separate openings; outcomes not inspected'},indent=2)+'\n');print(json.dumps(rows))

def play():
    r=json.loads((OUT/'backend-registration.json').read_text());assert source_hashes()==r['sourceHashes'];assert manifest()==r['wasmBuild'];assert digest(Path(r['nativeBuild']['executable']))==r['nativeBuild']['executableSha256']
    receipt=json.loads((ROOT/'.local-research/native/build.json').read_text());assert receipt==r['nativeBuild']
    file=OUT/'backend-games.sealed.jsonl';assert not file.exists(),'Scored execution is immutable; audit/recover instead of replacing games'
    with browser_session() as (browser,page,errors),file.open('x') as output:
        os.chmod(file,0o600);start=time.monotonic()
        for item in r['schedule']:
            result=game(page,r['families'][item['family']],item['budgetMs'],item['nativeColor']);result.update(index=item['index'],family=item['family'],browser=browser.version)
            output.write(json.dumps(result,separators=(',',':'))+'\n');output.flush();os.fsync(output.fileno())
            # Progress is outcome-blind. Do not print winner, margin or moves.
            print(json.dumps({'completed':item['index']+1,'total':256,'elapsedSeconds':round(time.monotonic()-start,1)}),flush=True)
        assert not errors,errors
    assert source_hashes()==r['sourceHashes'];(OUT/'backend-completion.json').write_text(json.dumps({'complete':True,'games':256,'browser':browser.version,'outcomesOpened':False,'sealedSha256':digest(file)})+'\n')

if __name__=='__main__':{'prepare':prepare,'pilot':pilot,'play':play}[sys.argv[1]]()
