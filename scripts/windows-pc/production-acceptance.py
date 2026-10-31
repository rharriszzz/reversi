"""Short Windows production UI gate; no games, benchmarks, SDK or app changes.

Reuse the packaged-browser helper, worker observer and independent mailbox
reference. Run once per browser with REVERSI_WINDOWS_CHANNEL=edge/chrome.
"""
import ast,hashlib,importlib.util,json,os,re,signal,socket,subprocess,sys
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/os.environ['REVERSI_PC_FINAL_OUTPUT']
sys.path.insert(0,str(ROOT/'scripts/wasm'))
from browser import launch_browser
def module(name,path):
    spec=importlib.util.spec_from_file_location(name,ROOT/path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
children=module('independent','scripts/native/verify.py').children
NativeEngine=module('native_client','scripts/native/client.py').NativeEngine
observer=ROOT/'scripts/wasm/fast-flips-production-acceptance.py'
SPY=next(ast.literal_eval(n.value) for n in ast.parse(observer.read_text()).body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='SPY' for t in n.targets))
def args(board,player,model):
    bits=lambda side:format(sum(1<<q for q,v in enumerate(board) if v==side),'x')
    return f'{bits(1)} {bits(-1)} {player} {"BLP".index(model)}'
def main():
    assert os.environ.get('REVERSI_WINDOWS_BROWSER')=='1','Actual Windows browser required'
    kind=os.environ['REVERSI_WINDOWS_CHANNEL'];manifest=json.loads((ROOT/'src/wasm/manifest.js').read_text().split('export default ')[1].strip().removesuffix(';'))
    server=subprocess.Popen([str(ROOT/'start.sh'),'--no-browser','--port','0','--http-log',str(OUT/(kind+'-http.log'))],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    url=re.search(r'http://127\.0\.0\.1:\d+/',server.stdout.readline()).group();port=int(url.split(':')[2].strip('/'));result=None;profile=None
    try:
        with sync_playwright() as pw,NativeEngine(ROOT/'.local-research/native-dispatch/build.json') as native:
            browser=launch_browser(pw);profile=Path(subprocess.check_output(['wslpath','-u',browser.reversi_windows_profile],text=True).strip())
            try:
                context=browser.new_context();context.add_init_script(SPY);page=context.new_page();errors=[];warnings=[];requests=[]
                page.on('pageerror',lambda e:errors.append(str(e)))
                def console(msg):
                    if msg.type=='error':
                        item={'text':msg.text,'url':msg.location.get('url','')}
                        (warnings if item['url'].endswith('/favicon.ico') and '404' in item['text'] else errors).append(item)
                page.on('console',console);context.on('request',lambda r:requests.append(r.url));page.goto(url)
                expect(page.locator('#board button')).to_have_count(64)
                def wait_analysis(model):
                    page.wait_for_function('(m)=>__accept.events.some(e=>e.response.type==="analyzed"&&e.response.analysis.model===m)',arg=model)
                    expect(page.locator('#search-metrics')).to_contain_text(model+' · WebAssembly');expect(page.locator('#move-rows tr')).to_have_count(4)
                value=lambda board,turn,depth,model:native.request(f'windows {args(board,turn,model)} {depth} 1 1 -1000000000 1000000000')['values'][0]
                coaching=[];pv_steps=0
                for model in 'BLP':
                    page.locator('#evaluator').select_option(model);wait_analysis(model)
                    event=page.evaluate('(m)=>__accept.events.filter(e=>e.response.type==="analyzed"&&e.response.analysis.model===m).at(-1)',model)
                    request=event['request'];analysis=event['response']['analysis'];board=request['board'];turn=request['player'];legal=children(board,turn)
                    assert analysis['depth']==3 and {r['move'] for r in analysis['results']}==set(legal)
                    for row in analysis['results']:
                        assert abs(row['score']+value(legal[row['move']],-turn,2,model))<=1e-10
                        current=board;player=turn;remaining=3
                        for index,q in enumerate(row['pv']):
                            moves=children(current,player)
                            if q=='pass':assert not moves and children(current,-player);player=-player;continue
                            move=(int(q[1])-1)*8+ord(q[0])-65;assert move in moves
                            if index:assert abs(value(current,player,remaining,model)+value(moves[move],-player,remaining-1,model))<=1e-10
                            current=moves[move];player=-player;remaining-=1;pv_steps+=1
                    assert all(row['pv'] for row in analysis['results'])
                    page.locator('#move-rows tr').nth(1).click();expect(page.locator('#interpretation')).to_contain_text('verified depth-3 line')
                    coaching.append({'model':model,'depth':3,'rows':[{'move':r['move'],'score':r['score'],'pv':r['pv']} for r in analysis['results']]})
                page.locator('#computer-time').select_option('80')
                # All actions in one UI task: cancel actual pending workers before
                # any old response can publish, then verify their replacements.
                before=page.evaluate('({created:__accept.created,terminated:__accept.terminated})')
                page.evaluate('''()=>{const d=document.querySelector('#analysis-depth');d.value='6';d.dispatchEvent(new Event('change'));document.querySelector('#new-game').click();d.value='3';d.dispatchEvent(new Event('change'));}''')
                wait_analysis('P')
                page.evaluate('''()=>{document.querySelector('[aria-label="D3: legal move"]').click();document.querySelector('#new-game').click();}''')
                wait_analysis('P');page.wait_for_timeout(150);expect(page.locator('#history .history-item')).to_have_count(0)
                after=page.evaluate('({created:__accept.created,terminated:__accept.terminated})');assert after['created']>before['created'] and after['terminated']>before['terminated']
                page.get_by_role('gridcell',name='D3: legal move',exact=True).click();expect(page.locator('#history .history-item')).to_have_count(2)
                expect(page.locator('#play-metrics')).to_contain_text('P · WebAssembly')
                event=page.evaluate('__accept.events.filter(e=>e.response.type==="played").at(-1)');r=event['response']['choice'];request=event['request']
                assert request['timeMs']==80 and r['depth']>0 and r['backend']=='WebAssembly' and r['move'] in children(request['board'],request['player'])
                assert abs(r['score']-value(request['board'],request['player'],r['depth'],'P'))<=1e-10
                child=children(request['board'],request['player'])[r['move']];assert abs(r['score']+value(child,-request['player'],r['depth']-1,'P'))<=1e-10
                page.reload();expect(page.locator('#evaluator')).to_have_value('P');expect(page.locator('#computer-time')).to_have_value('80');wait_analysis('P')
                identity=page.evaluate('''async()=>{const m=(await import('/src/wasm/manifest.js')).default;const r=await fetch('/src/wasm/'+m.module.replace('.mjs','.wasm'));if(!r.ok)throw Error(r.status);const hash=await crypto.subtle.digest('SHA-256',await r.arrayBuffer());return {fingerprint:m.fingerprint,models:m.models,sha256:[...new Uint8Array(hash)].map(v=>v.toString(16).padStart(2,'0')).join('')};}''')
                assert identity['fingerprint']==manifest['fingerprint'] and identity['models']==manifest['models'] and identity['sha256']==manifest['artifacts'][manifest['module'].replace('.mjs','.wasm')]
                wasm_requests=[u for u in requests if u.endswith('.wasm')];assert wasm_requests and all('/src/wasm/'+manifest['module'].replace('.mjs','.wasm') in u for u in wasm_requests)
                assert not any('/.local-research/' in u for u in requests) and not errors,errors
                agent=page.evaluate('navigator.userAgent');assert 'Windows NT' in agent
                result={'passed':True,'channel':kind,'browser':browser.version,'userAgent':agent,'identity':identity,'coaching':coaching,'pvSteps':pv_steps,'timedReply':r,'workersBefore':before,'workersAfter':after,'wasmRequests':wasm_requests,'errors':errors,'warnings':warnings,'observerSha256':hashlib.sha256(observer.read_bytes()).hexdigest()}
                context.close()
            finally:browser.close()
    finally:
        server.send_signal(signal.SIGINT);server.communicate(timeout=5)
        assert server.returncode==0
        with socket.socket() as sock:assert sock.connect_ex(('127.0.0.1',port))!=0
    assert profile is not None and not profile.exists(),'Owned disposable profile remains'
    result['cleanup']={'profileRemoved':True,'serverExit':0,'portClosed':True};print(json.dumps(result))
if __name__=='__main__':main()
