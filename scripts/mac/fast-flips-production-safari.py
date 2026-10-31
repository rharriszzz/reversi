"""Production fast-flips Safari acceptance, derived from safari-qualification.py.

Six representative B/L/P games use start.sh; fault injection uses the existing
isolated test server. Safari's automation session leaves normal profiles alone.
"""
import base64,contextlib,datetime,hashlib,http.server,importlib.util,json,os,random,re,socket,subprocess,sys,threading,time,urllib.error,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/os.environ.get('REVERSI_SAFARI_OUTPUT','.local-research/fast-flips-production-20261031/safari')
def module(name,path):
    spec=importlib.util.spec_from_file_location(name,ROOT/path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
client=module('native_client','scripts/native/client.py');rules=module('independent_rules','scripts/native/verify.py');independent=module('mailbox','scripts/mac/audit.py')
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def args(board,player,model):return f'{sum(1<<q for q,v in enumerate(board) if v==1):x} {sum(1<<q for q,v in enumerate(board) if v==-1):x} {player} {["B","L","P"].index(model)}'
def value(native,board,player,model,depth):return native.request(f'windows {args(board,player,model)} {depth} 1 1 -1000000000 1000000000')['values'][0]
def manifest():return json.loads((ROOT/'src/wasm/manifest.js').read_text().split('export default ')[1].strip().removesuffix(';'))

class Safari:
    def __enter__(self):
        OUT.mkdir(parents=True,exist_ok=True);self.fault=None;self.session=None;self.log=(OUT/'http.log').open('a');owner=self
        class Handler(http.server.SimpleHTTPRequestHandler):
            extensions_map={**http.server.SimpleHTTPRequestHandler.extensions_map,'.mjs':'text/javascript','.wasm':'application/wasm'}
            def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT),**kw)
            def log_message(self,fmt,*a):owner.log.write(fmt%a+'\n');owner.log.flush()
            def end_headers(self):self.send_header('Cache-Control','no-store');super().end_headers()
            def do_GET(self):
                if owner.fault=='wasm' and self.path.endswith('.wasm'):
                    self.send_error(503,'Injected qualification load failure');return
                if owner.fault=='abi' and self.path.endswith('/manifest.js'):
                    data=(ROOT/'src/wasm/manifest.js').read_text().replace('"abi": 1','"abi": 999',1).encode()
                    self.send_response(200);self.send_header('Content-Type','text/javascript');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data);return
                super().do_GET()
        self.server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler);self.thread=threading.Thread(target=self.server.serve_forever,daemon=True);self.thread.start();self.url=f'http://127.0.0.1:{self.server.server_port}/'
        with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
        self.driver=subprocess.Popen(['/usr/bin/safaridriver','-p',str(port)],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True);self.base=f'http://127.0.0.1:{port}'
        try:
            for _ in range(100):
                try:self.request('/status');break
                except urllib.error.URLError:time.sleep(.05)
            reply=self.request('/session',{'capabilities':{'alwaysMatch':{'browserName':'safari'}}});self.session=reply['sessionId'];self.capabilities=reply['capabilities']
            self.request('/timeouts',{'script':120000,'pageLoad':30000,'implicit':0});return self
        except BaseException:self.__exit__(None,None,None);raise
    def request(self,path,body=None,method=None):
        prefix=f'/session/{self.session}' if self.session and path not in ['/status','/session'] else ''
        data=None if body is None else json.dumps(body).encode();req=urllib.request.Request(self.base+prefix+path,data=data,headers={'Content-Type':'application/json'},method=method)
        try:
            with urllib.request.urlopen(req,timeout=125) as response:result=json.load(response)['value']
        except urllib.error.HTTPError as e:
            with e:result=json.load(e)['value']
        if isinstance(result,dict) and 'error' in result and 'ok' not in result:raise RuntimeError(f"WebDriver {result['error']}: {result.get('message')}")
        return result
    def js(self,script,*args):return self.request('/execute/sync',{'script':script,'args':list(args)})
    def async_js(self,expression,*args):
        body='const done=arguments[arguments.length-1];Promise.resolve().then(()=>('+expression+')).then(value=>done({ok:true,value}),e=>done({ok:false,error:String(e.message??e)+"\\n"+String(e.stack??"")}));'
        result=self.request('/execute/async',{'script':body,'args':list(args)})
        if not result['ok']:raise RuntimeError(result['error'])
        return result.get('value')
    def navigate(self,path=''):self.request('/url',{'url':self.url+path})
    def wait(self,condition,timeout=25):
        end=time.monotonic()+timeout;last=None
        while time.monotonic()<end:
            last=self.js('return ('+condition+');')
            if last:return last
            time.sleep(.025)
        raise TimeoutError('Safari condition timed out: '+condition+'; '+str(last))
    def text(self,selector):return self.js('return document.querySelector(arguments[0])?.textContent',selector)
    def select(self,selector,selected):self.js('const e=document.querySelector(arguments[0]);e.value=String(arguments[1]);e.dispatchEvent(new Event(e.type==="range"?"input":"change",{bubbles:true}));',selector,selected)
    def element(self,selector):return self.request('/element',{'using':'css selector','value':selector})['element-6066-11e4-a52e-4f735466cecf']
    def click(self,selector):
        self.js('document.querySelector(arguments[0]).scrollIntoView({block:"center"})',selector)
        self.request(f'/element/{self.element(selector)}/click',{})
    def key(self,selector,key):
        self.js('document.querySelector(arguments[0]).focus()',selector)
        self.request('/actions',{'actions':[{'type':'key','id':'keyboard','actions':[{'type':'keyDown','value':key},{'type':'keyUp','value':key}]}]})
    def measure(self,op,**kw):return self.async_js('safariRequest(arguments[0],arguments[1])',op,kw)
    def __exit__(self,*ignored):
        if self.session:
            try:self.request('',method='DELETE')
            finally:self.session=None
        if hasattr(self,'driver'):
            self.driver.terminate()
            try:self.driver.communicate(timeout=5)
            except subprocess.TimeoutExpired:self.driver.kill();self.driver.communicate()
        self.server.shutdown();self.server.server_close();self.thread.join(timeout=5);self.log.close()

SPY='''(()=>{
window.__safari={events:[],errors:[],consoleErrors:[],terminated:0};
const consoleError=console.error.bind(console);console.error=(...args)=>{__safari.consoleErrors.push(args.map(String).join(" "));return consoleError(...args);};
addEventListener('error',e=>__safari.errors.push(String(e.message)));
addEventListener('unhandledrejection',e=>__safari.errors.push(String(e.reason)));
const post=Worker.prototype.postMessage,terminate=Worker.prototype.terminate,seen=new WeakMap();
Worker.prototype.postMessage=function(request,...rest){
 let jobs=seen.get(this);if(!jobs){jobs=new Map();seen.set(this,jobs);this.addEventListener('message',({data})=>{
 const job=jobs.get(data.id);if(job){__safari.events.push({request:job.request,response:data,roundTripMs:performance.now()-job.start});jobs.delete(data.id);}
 });}jobs.set(request.id,{request,start:performance.now()});return post.call(this,request,...rest);
};
Worker.prototype.terminate=function(...args){__safari.terminated++;return terminate.apply(this,args);};
})()'''

def numerical(s,native):
    fixtures=json.loads((ROOT/'docs/data/mac-optimization-benchmarks-20261030.json').read_text())['final']['fixtures'];positions=fixtures['positions'];checks=0;max_error=0;static=0;alternatives=0;pv=0;deep_checks=0
    def near(a,b):
        nonlocal checks,max_error
        error=abs(a-b);checks+=1;max_error=max(max_error,error);assert error<=1e-10,(a,b)
    s.navigate('tests/safari_qualification.html');s.wait('typeof safariReset==="function"');init=s.async_js('safariReset()');assert init['buildIdentity']==manifest()['fingerprint'];assert init['models']==native.receipt['models']
    rng=random.Random(0x57494e50);boards=positions+[{'board':[rng.choice([-1,0,1]) for _ in range(64)],'player':rng.choice([-1,1])} for _ in range(96)]
    for p in boards:
        for model in ['B','L','P']:
            w=s.measure('inspect',p=p,model=model);n=native.request(f'inspect {args(p["board"],p["player"],model)}');near(w['evaluation'],n['evaluation']);assert w['features']==n['features'] and w['children']==n['children'];static+=1
            expected=independent.moves(p['board'],p['player']);assert {c['move'] for c in w['children']}==set(expected)
            for c in w['children']:
                b=int(c['black'],16);white=int(c['white'],16);assert [(1 if b>>q&1 else -1 if white>>q&1 else 0) for q in range(64)]==expected[c['move']]
    for p in positions:
        for model in ['B','L','P']:
            a=s.measure('analyze',p=p,model=model,depth=3);children=independent.moves(p['board'],p['player']);assert {r['move'] for r in a['results']}==set(children)
            for row in a['results']:
                near(row['score'],-value(native,children[row['move']],-p['player'],model,2));alternatives+=1;b=p['board'];turn=p['player'];remaining=3
                for j,q in enumerate(row['pv']):
                    moves=independent.moves(b,turn)
                    if q=='pass':assert not moves and independent.moves(b,-turn);turn=-turn;continue
                    move=(int(q[1])-1)*8+ord(q[0])-65;assert move in moves and remaining>0
                    if j:near(value(native,b,turn,model,remaining),-value(native,moves[move],-turn,model,remaining-1))
                    b=moves[move];turn=-turn;remaining-=1;pv+=1
    deep=json.loads((ROOT/'docs/data/native-v2-deep-qualification-20261030.json').read_text())
    for p in deep['rows']:
        for model in ['B','L','P']:
            utility=lambda v:(10000 if v>0 else -10000)+v if v else 0
            r=s.measure('search',p=p,model=model,depth=p['depth']);near(r['score'],utility(p['independent']['value']));assert r['exact']
            for row in p['independent']['rows']:
                child={'board':independent.moves(p['board'],p['player'])[row['move']],'player':-p['player']};r=s.measure('search',p=child,model=model,depth=64);near(-r['score'],utility(row['value']));assert r['exact'];deep_checks+=1
    # Depth-zero full boards, heuristic two-empty D1, pass and raw terminal empties.
    special=[{'board':([1]*48+[0]*16),'player':1},{'board':[1]*64,'player':-1},{'board':[0,-1]+[1]*61+[0],'player':-1}]
    for p in special:
        for model in ['B','L','P']:
            for depth in [0,1,2,64]:near(s.measure('windows',p=p,model=model,depth=depth,alpha=-1e9,beta=1e9)[-1],value(native,p['board'],p['player'],model,depth))
    cycles=[s.measure('reinit') for _ in range(20)];assert {r['memoryBytes'] for r in cycles}=={33554432}
    p=positions[1];one=s.measure('search',p=p,depth=1);interrupted=s.measure('search',p=p,timeMs=60000,nodeLimit=one['nodes']+1);assert interrupted['depth']==1 and interrupted['score']==one['score'] and interrupted['timedOut']
    fallback=s.measure('search',p=p,timeMs=60000,nodeLimit=1);assert fallback['depth']==0 and fallback['score'] is None and not fallback['exact'];assert fallback['move'] in independent.moves(p['board'],p['player'])
    tiny=s.measure('reinit',ttMiB=0);assert tiny['memoryBytes']==33554432
    collision=s.measure('search',p=positions[3],depth=5);expected=native.request(f'search {args(positions[3]["board"],positions[3]["player"],"P")} 5 0 0 0 0 0');near(collision['score'],expected['score']);assert collision['ttCollisions']>0
    failed=[]
    for op,fragment in [('wrong-abi','version mismatch'),('wrong-model','identity mismatch')]:
        try:s.measure(op);raise AssertionError('Invalid build accepted')
        except RuntimeError as e:assert fragment in str(e);failed.append(op)
    s.measure('close')
    try:s.measure('inspect',p=p);raise AssertionError('Closed handle accepted')
    except RuntimeError as e:assert 'closed' in str(e)
    restarted=[]
    for _ in range(10):restarted.append(s.async_js('safariReset()'));s.measure('search',p=p,model='P',timeMs=10)
    assert {r['memoryBytes'] for r in restarted}=={33554432}
    result={'passed':True,'checks':checks,'maxAbsError':max_error,'tolerance':1e-10,'staticQueries':static,'rootAlternatives':alternatives,'pvPlacements':pv,'deepAlternativeChecks':deep_checks,'initialization':init,'reinitializations':cycles,'workerRestarts':restarted,'interruption':interrupted,'fallback':fallback,'collision':collision,'invalidBuildChecks':failed,'specialPositions':special,'deepReferences':deep['rows']}
    (OUT/'numerical.json').write_text(json.dumps(result)+'\n');print(json.dumps({'numericalPassed':True,'comparisons':checks,'maxAbsError':max_error}),flush=True);return result

def setup_ui(s):
    s.navigate();s.wait('document.querySelectorAll("#move-rows tr").length===4');s.js(SPY);s.select('#analysis-depth','2')
def ready(s):return s.wait('document.querySelector("#turn-title").textContent==="Game over"||(document.querySelector("#board button:not(:disabled)")&&!document.querySelector("#move-rows .empty-row"))')
def board(s):return s.js('return [...document.querySelectorAll("#board button")].map(n=>n.getAttribute("aria-label")).map(t=>t.includes("black disc")?1:t.includes("white disc")?-1:0)')

def games(s,native):
    setup_ui(s);results=[];start=time.monotonic();coach_checks=0
    schedule=[(m,b,c,rep) for rep in range(2) for b in [80,300] for m in ['B','P'] for c in [1,-1]]
    if os.environ.get('REVERSI_SAFARI_SHORT'):
        schedule=[(m,b,1 if (i+j)%2==0 else -1,0) for i,m in enumerate(['B','L','P']) for j,b in enumerate([80,300])]
    for index,(model,budget,color,rep) in enumerate(schedule):
        s.select('#evaluator',model);s.select('#computer-time',budget);s.select('#human-color',color);s.js('__safari.events=[]');s.click('#new-game');rng=random.Random(0x53414600+index);wall=time.monotonic()
        for decision in range(64):
            ready(s)
            if s.text('#turn-title')=='Game over':break
            b=board(s);legal=independent.moves(b,color);assert legal
            a=s.js('return __safari.events.filter(e=>e.response.type==="analyzed"&&JSON.stringify(e.request.board)===JSON.stringify(arguments[0])).at(-1)',b);assert a,'Missing current Safari analysis'
            analysis=a['response']['analysis'];assert analysis['model']==model and analysis['backend']=='WebAssembly' and analysis['depth']==2
            assert {r['move'] for r in analysis['results']}==set(legal)
            for r in analysis['results']:
                current=b;turn=color;remaining=2
                for notation in r['pv']:
                    options=independent.moves(current,turn)
                    if notation=='pass':assert not options and independent.moves(current,-turn);turn=-turn;continue
                    q=(int(notation[1])-1)*8+ord(notation[0])-65;assert q in options and remaining>0;current=options[q];turn=-turn;remaining-=1
                if decision==0 or sum(v!=0 for v in b)>=54:assert abs(r['score']+value(native,legal[r['move']],-color,model,1))<=1e-10;coach_checks+=1
            q=rng.choice(sorted(legal));before=s.js('return document.querySelectorAll("#history .history-item").length');s.click(f'#board button[aria-label^="{chr(65+q%8)}{q//8+1}:"]')
            try:s.wait(f'document.querySelectorAll("#history .history-item").length>{before}',timeout=5)
            except Exception:
                (OUT/'click-failure.json').write_text(json.dumps({'game':index,'decision':decision,'move':q,'beforeHistory':before,'board':board(s),'status':s.text('#status'),'turn':s.text('#turn-title'),'events':s.js('return __safari'),'body':s.js('return document.body.innerText')})+'\n')
                (OUT/'click-failure.png').write_bytes(base64.b64decode(s.request('/screenshot')));raise
        assert s.text('#turn-title')=='Game over';labels=s.js('return [...document.querySelectorAll("#history .history-item")].map(n=>n.textContent)');steps=[]
        b=[0]*64;b[28]=b[35]=1;b[27]=b[36]=-1;p=1;passes=0;states=[]
        for label in labels:
            m=re.fullmatch(r'\d+\. ([BW]) ([A-H])([1-8])',label);assert m,label;player=1 if m[1]=='B' else -1;q=(int(m[3])-1)*8+ord(m[2])-65;legal=independent.moves(b,p)
            if not legal:assert independent.moves(b,-p);p=-p;passes+=1;legal=independent.moves(b,p)
            assert player==p and q in legal;states.append((b,p,q));steps.append({'player':p,'move':q});b=legal[q];p=-p
        assert not independent.moves(b,1) and not independent.moves(b,-1) and b==board(s)
        events=s.js('return __safari.events.filter(e=>e.response.type==="played")');assert events
        for event in events:
            r=event['response']['choice'];req=event['request'];assert r['model']==model and r['backend']=='WebAssembly' and r['memoryBytes']==33554432
            assert (req['board'],req['player'],r['move']) in states and req['player']==-color
            if r['exact'] and req['board'].count(0)<=6:assert r['score']==independent.exact(tuple(req['board']),req['player'])
        independent.exact.cache_clear()
        if index in [0,3,7,15]:
            s.click('#review-game');s.wait('document.querySelector("#game-review button")',timeout=90);assert model+' · WebAssembly' in s.text('#backend-status');s.click('#game-review button');s.wait('document.querySelector("#status").textContent.includes("earlier position")')
        results.append({'index':index,'model':model,'budgetMs':budget,'human':color,'seed':0x53414600+index,'moves':steps,'board':b,'forcedPasses':passes,'plays':events,'wallSeconds':time.monotonic()-wall})
        (OUT/'games.json').write_text(json.dumps({'games':results,'coachScoreChecks':coach_checks,'elapsedSeconds':time.monotonic()-start})+'\n');print(json.dumps({'completeGames':index+1,'total':len(schedule),'elapsedSeconds':round(time.monotonic()-start,1)}),flush=True)
    assert not s.js('return __safari.errors');assert not s.js('return __safari.consoleErrors');return {'games':len(schedule),'coachScoreChecks':coach_checks,'elapsedSeconds':time.monotonic()-start,'pageErrors':s.js('return __safari.errors'),'consoleErrors':s.js('return __safari.consoleErrors')}

def ui_cases(s):
    checks=[];s.select('#human-color',1);s.select('#evaluator','P');s.select('#computer-time','80');s.click('#new-game');ready(s)
    s.click('#move-rows tr:nth-child(2) td:nth-child(2)');s.key('#move-rows tr:nth-child(3)','\ue007');assert s.js('return document.querySelector("#move-rows tr:nth-child(3)").classList.contains("active")');s.select('#compare-move',37);assert 'verified depth-2 line' in s.text('#interpretation');checks.append('alternative comparison and Enter keyboard')
    s.click('#board button[aria-label^="D3:"]');s.wait('document.querySelectorAll("#history .history-item").length===2');s.select('#review-slider',0);s.wait('document.querySelector("#status").textContent.includes("earlier position")');s.select('#review-slider',2);s.click('#undo');s.wait('document.querySelectorAll("#history .history-item").length===0');checks.append('historical analysis and undo/replay')
    s.js('for(const model of ["B","P","L","P"]){const e=document.querySelector("#evaluator");e.value=model;e.dispatchEvent(new Event("change"));const d=document.querySelector("#analysis-depth");d.value="6";d.dispatchEvent(new Event("change"));document.querySelector("#new-game").click();}')
    s.select('#analysis-depth',2);s.wait('document.querySelector("#search-metrics").textContent.includes("P · WebAssembly")');assert s.text('#depth-label')=='Depth 2';checks.append('rapid model/depth cancellation and worker recreation')
    s.request('/refresh',{});s.wait('document.querySelector("#search-metrics").textContent.includes("P · WebAssembly")');assert s.js('return document.querySelector("#evaluator").value')=='P';s.js(SPY);checks.append('model preference and cache reload')
    # Capture the actual generated Blob and download link without changing
    # Safari's download preferences or writing into the user's Downloads folder.
    s.select('#evaluator','custom');s.select('#computer-time','0');s.select('#computer-depth','2');s.click('#train');s.wait('!document.querySelector("#train").disabled',timeout=120);assert 'challenger' in s.text('#training-status').lower()
    s.js('window.__export={};const original=URL.createObjectURL.bind(URL);URL.createObjectURL=blob=>{__export.blob=blob;return original(blob);};const click=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(this.download){__export.filename=this.download;return;}return click.call(this);};')
    s.click('#export-model');exported=json.loads(s.async_js('__export.blob.text()'));assert exported['attempts']==1 and exported['format']=='reversi-coach-lab-model-v1';assert s.js('return __export.filename').endswith('.json')
    saved=s.js('return localStorage.getItem("reversi-coach-lab-learning-v1")');assert json.loads(saved)['weights']==exported['weights'];s.request('/refresh',{});s.wait('document.querySelector("#training-status").textContent.includes("1 training attempts")');assert s.js('return localStorage.getItem("reversi-coach-lab-learning-v1")')==saved;s.js(SPY);checks.append('bounded custom training, export Blob/link and exact persistence reload')
    # Exercise real app fallback and ABI failure using only the owned test server.
    s.fault='wasm';s.request('/refresh',{});s.wait('document.querySelector("#evaluator")');s.select('#evaluator','B');s.wait('document.querySelector("#backend-status").textContent.includes("JavaScript fallback")');s.select('#evaluator','P');s.wait('document.querySelector("#backend-status").textContent.includes("No evaluator was substituted")');s.select('#evaluator','custom');s.wait('document.querySelector("#search-metrics").textContent.includes("custom · JavaScript")');checks.append('real load failure, B fallback, P refusal and custom recovery')
    s.fault=None;s.request('/refresh',{});s.wait('document.querySelector("#evaluator")');s.select('#evaluator','P');s.wait('document.querySelector("#search-metrics").textContent.includes("P · WebAssembly")')
    s.fault='abi';s.request('/refresh',{});s.wait('document.querySelector("#backend-status").textContent.includes("module version mismatch")');s.fault=None;s.request('/refresh',{});s.wait('document.querySelector("#search-metrics").textContent.includes("P · WebAssembly")');checks.append('real ABI mismatch and normal reload recovery')
    return {'passed':True,'checks':checks,'customExport':{'attempts':exported['attempts'],'version':exported['version'],'weightsSha256':hashlib.sha256(json.dumps(exported['weights'],sort_keys=True).encode()).hexdigest(),'scope':'Actual Blob contents and download link verified; disk download intentionally not triggered'},'cancelledWorkersObserved':s.js('return window.__safari?.terminated??null')}

def main():
    OUT.mkdir(parents=True,exist_ok=True);before=module('resources','scripts/mac/resources.py').check();build=manifest();start=time.monotonic();result={'passed':False,'startedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'python':{'executable':sys.executable,'version':sys.version},'wasmBuild':build,'resourcesBefore':before}
    launcher=subprocess.Popen([str(ROOT/'start.sh'),'--no-browser','--port','0','--http-log',str(OUT/'launcher-http.log')],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,env={**os.environ,'REVERSI_PYTHON':sys.executable})
    try:
        url=re.search(r'http://127\.0\.0\.1:\d+/',launcher.stdout.readline()).group();result['launcherUrl']=url
        with Safari() as s,client.NativeEngine() as native:
            result['capabilities']=s.capabilities;assert s.capabilities['browserName'].lower()=='safari';result['nativeBuild']=native.receipt;result['numerical']=numerical(s,native)
            fault_url=s.url;s.url=url;result['acceptance']=games(s,native)
            fixed=[]
            for model in ['B','L','P']:
                s.select('#evaluator',model);s.select('#human-color',1);s.select('#computer-time',0);s.select('#computer-depth',3);s.click('#new-game');ready(s);s.js('__safari.events=[]');s.click('#board button[aria-label^="D3:"]');s.wait('document.querySelectorAll("#history .history-item").length===2')
                event=s.js('return __safari.events.find(e=>e.response.type==="played")');assert event['response']['choice']['depth']==3 and event['response']['choice']['model']==model;fixed.append(event)
            result['fixedDepthReplies']=fixed
            s.js('const post=Worker.prototype.postMessage;Worker.prototype.postMessage=function(r,...a){if(r.type==="analyze"){Worker.prototype.postMessage=post;setTimeout(()=>this.dispatchEvent(new ErrorEvent("error",{message:"Injected acceptance worker error"})),0);return;}return post.call(this,r,...a);};')
            s.click('#new-game');s.wait('document.querySelector("#backend-status").textContent.includes("Worker failed: Injected acceptance worker error")');s.request('/refresh',{});s.wait('document.querySelector("#search-metrics").textContent.includes("P · WebAssembly")');result['workerErrorRecovery']=True
            actual=s.async_js('import("./src/wasm/manifest.js").then(m=>m.default.fingerprint)');assert actual==build['fingerprint'];result['launcherBuildIdentity']=actual
            s.url=fault_url;setup_ui(s);result['ui']=ui_cases(s)
            result['userAgent']=s.js('return navigator.userAgent');result['wasmMime']=s.async_js('fetch("./src/wasm/"+arguments[0]).then(r=>({type:r.headers.get("content-type"),status:r.status}))',build['module'].replace('.mjs','.wasm'));assert result['wasmMime']=={'type':'application/wasm','status':200}
            (OUT/'safari-final.png').write_bytes(base64.b64decode(s.request('/screenshot')))
        assert manifest()==build
        for file,digest in build['artifacts'].items():assert sha(ROOT/'src/wasm'/file)==digest
        result['passed']=True
    except Exception as e:result['error']=type(e).__name__+': '+str(e);raise
    finally:
        launcher.terminate();launcher.communicate(timeout=5)
        result['wallSeconds']=time.monotonic()-start;result['resourcesAfter']=module('resources_after','scripts/mac/resources.py').snapshot();result['sourceHashes']={p:sha(ROOT/p) for p in ['scripts/mac/fast-flips-production-safari.py','tests/safari_qualification.html','tests/safari_qualification_worker.js','native/engine.cpp','native/engine.hpp','native/browser.cpp','src/wasm-engine.js','src/app.js','src/backend.js','src/worker.js']};(OUT/'qualification.json').write_text(json.dumps(result)+'\n')
    print(json.dumps({'passed':True,'browser':result['capabilities']['browserVersion'],'numericalChecks':result['numerical']['checks'],'games':result['acceptance']['games'],'wallSeconds':result['wallSeconds']}),flush=True)
if __name__=='__main__':main()
