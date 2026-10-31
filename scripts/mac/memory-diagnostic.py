"""Diagnostic-only forced worker GC; no ordinary settings or timing claims."""
import json,re,subprocess,sys,tempfile,time
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'.local-research/mac-modernization-20261030'
def main():
    fixtures=json.loads((OUT/'fixtures.json').read_text());rows=[]
    with tempfile.TemporaryDirectory() as temp:
        server=subprocess.Popen([sys.executable,str(ROOT/'launch.py'),'--no-browser','--port','0','--http-log',str(Path(temp)/'http.log')],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
        try:
            url=re.search(r'http://127\.0\.0\.1:\d+/',server.stdout.readline()).group()
            with sync_playwright() as pw:
                browser=pw.chromium.launch(channel='chrome');page=browser.new_page();page.goto(url+'tests/wasm_benchmark.html');page.wait_for_function('()=>typeof measure==="function"')
                measure=lambda op,**a:page.evaluate('([op,a])=>measure(op,a)',[op,a]);measure('init');cdp=browser.new_browser_cdp_session()
                target=next(t for t in cdp.send('Target.getTargets')['targetInfos'] if t['type']=='worker' and t['url'].endswith('wasm_benchmark_worker.js'))
                sid=cdp.send('Target.attachToTarget',{'targetId':target['targetId'],'flatten':False})['sessionId'];replies={};seq=0
                def receive(e):
                    if e['sessionId']==sid:
                        m=json.loads(e['message'])
                        if 'id' in m:replies[m['id']]=m
                cdp.on('Target.receivedMessageFromTarget',receive)
                def rpc(method):
                    nonlocal seq
                    seq+=1;call=seq;cdp.send('Target.sendMessageToTarget',{'sessionId':sid,'message':json.dumps({'id':call,'method':method})});limit=time.monotonic()+15
                    while call not in replies:
                        assert time.monotonic()<limit,'GC diagnostic reply timed out';page.wait_for_timeout(10)
                    r=replies.pop(call);assert 'error' not in r,r;return r.get('result',{})
                def process_rss():
                    pids=','.join(str(p['id']) for p in cdp.send('SystemInfo.getProcessInfo')['processInfo'])
                    r=subprocess.run(['ps','-o','rss=','-p',pids],text=True,capture_output=True);return sum(int(v) for v in r.stdout.split())
                for cycle in range(1,65):
                    measure('reinit');measure('search',p=fixtures['positions'][1],model='P',timeMs=2)
                    if cycle%8==0:
                        before=rpc('Runtime.getHeapUsage');rss_before=process_rss();rpc('HeapProfiler.collectGarbage')
                        after=rpc('Runtime.getHeapUsage');rss_after=process_rss()
                        rows.append({'cycles':cycle,'workerHeapBefore':before,'workerHeapAfter':after,'browserRssSumKiBBefore':rss_before,'browserRssSumKiBAfter':rss_after,'liveMemoryBytes':measure('inspect',p=fixtures['positions'][1],model='P')['memoryBytes']})
                result={'browser':browser.version,'moduleReinitializations':64,'forcedGcEvery':8,'rows':rows,'scope':'Disposable worker diagnostic; forced GC perturbs timing and is not part of production benchmarks. Process RSS sums are not unique allocation; V8 heap fields retain their API meanings.'}
                (OUT/'memory-diagnostic.json').write_text(json.dumps(result)+'\n');print(json.dumps(result));browser.close()
        finally:server.terminate();server.communicate(timeout=5)
if __name__=='__main__':main()
