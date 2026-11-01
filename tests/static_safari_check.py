"""Actual Safari acceptance of the static /reversi/ package (stdlib only).

Start: python3 -m http.server 8920 --bind 127.0.0.1 --directory dist
Run: python3 tests/static_safari_check.py [--device SIMULATOR_UDID --dom-input]
Use --url https://rharriszzz.github.io/reversi/ for public deployment checks.
SafariDriver must already be enabled. Never changes browser/security settings.
Use disposable simulator devices; desktop WebDriver uses isolated automation.
"""
import argparse
import base64
import importlib.util
import json
from pathlib import Path
import socket
import subprocess
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('independent_rules', ROOT/'scripts/native/verify.py')
rules = importlib.util.module_from_spec(spec)
spec.loader.exec_module(rules)
MANIFEST = json.loads((ROOT/'src/wasm/manifest.js').read_text().split('export default ')[1].strip().removesuffix(';'))

SPY = """window.__mobile={events:[],errors:[],pending:0,maxPending:0,cancelled:0,maxHeartbeatGapMs:0};
let lastBeat=performance.now();setInterval(()=>{const now=performance.now();
__mobile.maxHeartbeatGapMs=Math.max(__mobile.maxHeartbeatGapMs,now-lastBeat);lastBeat=now;},16);
addEventListener('error',e=>__mobile.errors.push(String(e.message)));
addEventListener('unhandledrejection',e=>__mobile.errors.push(String(e.reason)));
const post=Worker.prototype.postMessage, terminate=Worker.prototype.terminate, seen=new WeakMap();
Worker.prototype.terminate=function(...args){const jobs=seen.get(this);if(jobs){
__mobile.pending-=jobs.size;__mobile.cancelled+=jobs.size;jobs.clear();}return terminate.apply(this,args);};
Worker.prototype.postMessage=function(r,...args){
 let jobs=seen.get(this);if(!jobs){jobs=new Map();seen.set(this,jobs);
 this.addEventListener('message',({data})=>{let job=jobs.get(data.id);if(job){
 __mobile.pending--;__mobile.events.push({request:job.request,response:data,roundTripMs:performance.now()-job.start});jobs.delete(data.id);}});}
 jobs.set(r.id,{request:r,start:performance.now()});__mobile.pending++;
 __mobile.maxPending=Math.max(__mobile.maxPending,__mobile.pending);return post.call(this,r,...args);};
"""


class Safari:
    def __init__(self, device, out, dom_input=False):
        self.device, self.out, self.session = device, out, None
        self.dom_input = dom_input

    def __enter__(self):
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            port = sock.getsockname()[1]
        self.log = (self.out/'driver.log').open('w')
        self.driver = subprocess.Popen(['/usr/bin/safaridriver', '-p', str(port)], stdout=self.log, stderr=self.log)
        self.base = f'http://127.0.0.1:{port}'
        try:
            for _ in range(100):
                try:
                    self.request('/status')
                    break
                except urllib.error.URLError:
                    time.sleep(.05)
            caps = {'browserName':'safari'}
            if self.device:
                caps.update({'platformName':'iOS','safari:useSimulator':True,'safari:deviceUDID':self.device})
            result = self.request('/session', {'capabilities':{'alwaysMatch':caps}})
            self.session, self.capabilities = result['sessionId'], result['capabilities']
            self.request('/timeouts', {'script':120000,'pageLoad':60000,'implicit':0})
            return self
        except BaseException:
            self.__exit__()
            raise

    def request(self, path, body=None, method=None):
        prefix = f'/session/{self.session}' if self.session and path not in ('/status','/session') else ''
        req = urllib.request.Request(self.base+prefix+path, data=None if body is None else json.dumps(body).encode(), headers={'Content-Type':'application/json'}, method=method)
        try:
            with urllib.request.urlopen(req, timeout=125) as response:
                return json.load(response)['value']
        except urllib.error.HTTPError as e:
            with e:
                raise RuntimeError(json.load(e)['value']) from None

    def js(self, script, *args):
        return self.request('/execute/sync', {'script':script,'args':list(args)})

    def async_js(self, expression):
        result = self.request('/execute/async', {'script':
            'const done=arguments[arguments.length-1];Promise.resolve().then(()=>('+expression+')).then(value=>done({value}),e=>done({error:String(e)}));','args':[]})
        assert 'error' not in result, result
        return result['value']

    def wait(self, condition, timeout=45):
        until = time.monotonic()+timeout
        while time.monotonic()<until:
            result = self.js('return ('+condition+')')
            if result:
                return result
            time.sleep(.05)
        raise TimeoutError(condition)

    def select(self, selector, value):
        self.js('const e=document.querySelector(arguments[0]);e.value=arguments[1];e.dispatchEvent(new Event(e.type==="range"?"input":"change",{bubbles:true}));', selector, str(value))

    def click(self, selector, touch=False):
        self.js('document.querySelector(arguments[0]).scrollIntoView({block:"center"})', selector)
        if self.dom_input:
            self.js('document.querySelector(arguments[0]).click()', selector)
            return
        element = self.request('/element', {'using':'css selector','value':selector})['element-6066-11e4-a52e-4f735466cecf']
        if touch or self.device:
            self.request('/actions', {'actions':[{'type':'pointer','id':'finger','parameters':{'pointerType':'touch'},'actions':[
                {'type':'pointerMove','duration':0,'origin':{'element-6066-11e4-a52e-4f735466cecf':element},'x':0,'y':0},
                {'type':'pointerDown','button':0},{'type':'pause','duration':80},{'type':'pointerUp','button':0}]}]})
        else:
            self.request('/element/'+element+'/click', {})

    def screenshot(self, name):
        self.async_js('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))')
        if self.device:
            subprocess.run(['xcrun','simctl','io',self.device,'screenshot',str(self.out/name)],check=True,capture_output=True)
        else:
            (self.out/name).write_bytes(base64.b64decode(self.request('/screenshot')))

    def __exit__(self, *args):
        try:
            if self.session:
                self.request('', method='DELETE')
        finally:
            self.session = None
            self.driver.terminate()
            self.driver.wait(timeout=10)
            self.log.close()


def board(s):
    return s.js('return [...document.querySelectorAll("#board button")].map(e=>e.getAttribute("aria-label").includes("black disc")?1:e.getAttribute("aria-label").includes("white disc")?-1:0)')


def replay(s):
    labels = s.js('return [...document.querySelectorAll("#history .history-item")].map(e=>e.textContent)')
    b = [0]*64
    b[28]=b[35]=1
    b[27]=b[36]=-1
    turn, passes = 1, 0
    for label in labels:
        _, side, coord = label.split()
        children = rules.children(b, turn)
        if not children:
            turn = -turn
            passes += 1
            children = rules.children(b, turn)
        assert (1 if side=='B' else -1)==turn
        move = (int(coord[1])-1)*8+ord(coord[0])-65
        assert move in children, label
        b, turn = children[move], -turn
    assert b == board(s), 'Visible flips disagree with independent mailbox rules'
    return {'plies':len(labels),'passes':passes,'black':b.count(1),'white':b.count(-1)}


def check(s, url, full=True):
    started = time.monotonic()
    s.request('/url', {'url':url})
    s.wait('document.querySelector("#search-metrics")?.textContent.includes("P · WebAssembly")')
    initial_seconds = time.monotonic()-started
    assert s.js('return document.querySelector("#evaluator").value')=='P'
    s.js(SPY)
    s.click('#refresh-analysis')
    s.wait('__mobile.events.some(e=>e.response.type==="analyzed")')
    e = s.js('return __mobile.events.find(e=>e.response.type==="analyzed")')
    assert e['request']['evaluator']=='P'
    assert e['response']['analysis']['modelIdentity']==MANIFEST['models']['P']
    assert e['response']['analysis']['buildIdentity']==MANIFEST['fingerprint']
    assert len(e['response']['analysis']['results'])==4
    s.js('scrollTo(0,0)')
    s.screenshot('portrait-top.png')
    s.js('const b=document.querySelector("#board");if(b.getBoundingClientRect().bottom>innerHeight)b.scrollIntoView({block:"center"})')
    s.screenshot('portrait.png')
    layout = s.js('''const r=document.querySelector('#board').getBoundingClientRect();
      return {width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,
      board:{x:r.x,y:r.y,width:r.width,height:r.height},cells:document.querySelectorAll('#board button').length,
      selectHeight:document.querySelector('#evaluator').getBoundingClientRect().height};''')
    assert layout['cells']==64 and layout['scrollWidth']<=layout['width']
    assert layout['board']['x']>=0 and layout['board']['width']+layout['board']['x']<=layout['width']
    if s.device:
        assert 0<=layout['board']['y'] and layout['board']['y']+layout['board']['height']<=layout['height'], layout
    if layout['width']<=550:
        assert layout['selectHeight']>=44, layout
    resources = s.async_js('''(async()=>{const {default:m}=await import('./src/wasm/manifest.js');
      const rows=[];for(const [file,expected] of Object.entries(m.artifacts)){
        const r=await fetch('./src/wasm/'+file);const bytes=await r.arrayBuffer();
        const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
        rows.push({file,status:r.status,type:r.headers.get('content-type'),bytes:bytes.byteLength,hash,expected});}return rows;})()''')
    for resource in resources:
        assert resource['status']==200 and resource['hash']==resource['expected']
        if resource['file'].endswith('.wasm'):
            assert resource['type'].split(';')[0]=='application/wasm'
    # Real WebDriver input unless --dom-input explicitly discloses its limitation.
    s.click('#board button[aria-label="D3: legal move"]', touch=bool(s.device))
    s.wait('document.querySelectorAll("#history .history-item").length===2')
    first = replay(s)
    s.click('#undo')
    s.wait('document.querySelectorAll("#history .history-item").length===0')
    cases=[]
    for model in 'BLP':
        s.select('#evaluator', model)
        s.wait(f'document.querySelector("#search-metrics").textContent.includes("{model} · WebAssembly")')
        s.request('/refresh', {})
        s.wait(f'document.querySelector("#search-metrics").textContent.includes("{model} · WebAssembly")')
        assert s.js('return document.querySelector("#evaluator").value')==model
    s.js(SPY)
    for budget in ('0','80','300'):
        for human in ('1','-1'):
            s.select('#human-color', human)
            s.select('#computer-time', budget)
            s.click('#new-game')
            target = 1 if human=='-1' else 2
            if human=='1':
                s.click('#board button[aria-label="D3: legal move"]', touch=bool(s.device))
            s.wait(f'document.querySelectorAll("#history .history-item").length==={target}')
            s.wait('document.querySelector("#search-metrics").textContent.includes("P · WebAssembly")')
            case = dict(budget=budget,human=human,**replay(s))
            s.select('#review-slider','0')
            s.wait('document.querySelector("#position-label").textContent.includes("Historical")')
            assert board(s).count(0)==60
            s.select('#review-slider',str(target))
            s.wait('document.querySelector("#position-label").textContent==="Live position"')
            replay(s)
            s.wait('document.querySelector("#move-rows tr:nth-child(2)")')
            s.click('#move-rows tr:nth-child(2) td:nth-child(2)')
            s.select('#compare-move',s.js('return document.querySelector("#compare-move option:last-child").value'))
            assert 'verified' in s.js('return document.querySelector("#interpretation").textContent')
            cases.append(case)
    # Exercise cancellation while computation is pending, then require a P reply.
    for model in ('B','L','P'):
        s.select('#analysis-depth','6')
        s.select('#evaluator',model)
        s.click('#new-game')
    s.select('#analysis-depth','2')
    s.wait('document.querySelector("#search-metrics").textContent.includes("P · WebAssembly")')
    game = None
    if full:
        s.select('#human-color','1')
        s.select('#computer-time','80')
        s.click('#new-game')
        for _ in range(64):
            s.wait('document.querySelector("#turn-title").textContent==="Game over" || document.querySelector("#board button:not(:disabled)")')
            if s.js('return document.querySelector("#turn-title").textContent')=='Game over':
                break
            s.click('#board button:not(:disabled)')
        game = replay(s)
        b = board(s)
        assert not rules.children(b,1) and not rules.children(b,-1)
        assert int(s.js('return document.querySelector("#black-count").textContent'))==game['black']
        assert int(s.js('return document.querySelector("#white-count").textContent'))==game['white']
        s.click('#review-game')
        s.wait('document.querySelector("#game-review button")', timeout=120)
        assert 'evaluator P · WebAssembly' in s.js('return document.querySelector("#game-review").textContent')
        s.screenshot('review.png')
    events = s.js('return __mobile')
    assert not events['errors'], events['errors']
    for event in events['events']:
        response = event['response']
        result = response.get('analysis',response.get('choice',response))
        if response['type'] in ('analyzed','played'):
            assert result['backend']=='WebAssembly'
            assert result['modelIdentity']==MANIFEST['models'][event['request']['evaluator']]
        elif response['type']=='reviewed':
            assert response['backend']=='WebAssembly' and response['model']==event['request']['evaluator']
        else:
            raise AssertionError(response)
    return {'passed':True,'url':url,'capabilities':s.capabilities,'initialLoadSeconds':initial_seconds,
            'layout':layout,'resources':resources,'inputMethod':'DOM events' if s.dom_input else 'WebDriver input',
            'firstMoveAndReply':first,'cases':cases,'completeGame':game,'observations':events}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--device')
    parser.add_argument('--url',default='http://127.0.0.1:8920/reversi/')
    parser.add_argument('--output',type=Path,default=ROOT/'.local-research/iphone-pages/safari-static')
    parser.add_argument('--short',action='store_true')
    parser.add_argument('--dom-input',action='store_true',help='Use DOM events; does not establish native touch/picker acceptance')
    args = parser.parse_args()
    args.output.mkdir(parents=True,exist_ok=True)
    with Safari(args.device,args.output,args.dom_input) as s:
        try:
            result = check(s,args.url,not args.short)
            (args.output/'receipt.json').write_text(json.dumps(result,indent=2)+'\n')
            print(json.dumps({k:v for k,v in result.items() if k!='observations'}))
        except BaseException:
            s.screenshot('failure.png')
            raise


if __name__=='__main__':
    main()
