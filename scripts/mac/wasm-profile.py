"""Actual Chrome worker CPU profiles, including full all-move/PV coaching."""
import json,re,subprocess,sys,tempfile,time
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'.local-research/mac-modernization-20261030'
def main():
    fixtures=json.loads((OUT/'fixtures.json').read_text());profiles=[]
    with tempfile.TemporaryDirectory() as temp:
        server=subprocess.Popen([sys.executable,str(ROOT/'launch.py'),'--no-browser','--port','0','--http-log',str(Path(temp)/'http.log')],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
        try:
            url=re.search(r'http://127\.0\.0\.1:\d+/',server.stdout.readline()).group()
            with sync_playwright() as pw:
                browser=pw.chromium.launch(channel='chrome');page=browser.new_page();page.goto(url+'tests/wasm_benchmark.html');page.wait_for_function('()=>typeof measure==="function"')
                measure=lambda op,**a:page.evaluate('([op,a])=>measure(op,a)',[op,a]);measure('init')
                cdp=browser.new_browser_cdp_session();target=next(t for t in cdp.send('Target.getTargets')['targetInfos'] if t['type']=='worker' and t['url'].endswith('wasm_benchmark_worker.js'))
                sid=cdp.send('Target.attachToTarget',{'targetId':target['targetId'],'flatten':False})['sessionId'];replies={};seq=0
                def receive(event):
                    if event['sessionId']==sid:
                        msg=json.loads(event['message'])
                        if 'id' in msg:replies[msg['id']]=msg
                cdp.on('Target.receivedMessageFromTarget',receive)
                def rpc(method,params={}):
                    nonlocal seq
                    seq+=1;call=seq;cdp.send('Target.sendMessageToTarget',{'sessionId':sid,'message':json.dumps({'id':call,'method':method,'params':params})});deadline=time.monotonic()+10
                    while call not in replies:
                        assert time.monotonic()<deadline,'Profiler response timeout';page.wait_for_timeout(10)
                    msg=replies.pop(call);assert 'error' not in msg,msg
                    return msg.get('result',{})
                rpc('Profiler.enable');rpc('Profiler.setSamplingInterval',{'interval':100})
                for phase,index,depth,coaching in [('opening',1,8,False),('middle',3,7,False),('endgame',4,12,False),('coaching',3,5,True)]:
                    measure('search',p=fixtures['positions'][index],model='P',depth=3)
                    rpc('Profiler.start');work=measure('profile',p=fixtures['positions'][index],model='P',depth=depth,coaching=coaching)
                    profile=rpc('Profiler.stop')['profile'];(OUT/f'wasm-{phase}.cpuprofile').write_text(json.dumps(profile))
                    frames={n['id']:n['callFrame'] for n in profile['nodes']};counts={}
                    for sample in profile.get('samples',[]):
                        name=frames[sample]['functionName'];counts[name]=counts.get(name,0)+1
                    profiles.append({'phase':phase,'position':fixtures['positions'][index],'depth':depth,'coaching':coaching,'work':work,'selfSamples':counts,'totalSamples':len(profile.get('samples',[])),'sampleTimeDeltasUs':{'sum':sum(profile.get('timeDeltas',[])),'median':__import__('statistics').median(profile.get('timeDeltas',[0]))}})
                    print(json.dumps({'phase':phase,'samples':len(profile.get('samples',[]))}),flush=True)
                (OUT/'wasm-profiles.json').write_text(json.dumps({'browser':browser.version,'requestedIntervalUs':100,'profiles':profiles,'scope':'Actual worker CDP CPU samples; compiler inlining combines search, flipping, TT and ordering.'})+'\n');browser.close()
        finally:server.terminate();server.communicate(timeout=5)
if __name__=='__main__':main()
