"""Bounded repeated native/Wasm searches and fresh-worker memory observations."""
import importlib.util,json,re,subprocess,sys,tempfile,time
from pathlib import Path
from playwright.sync_api import sync_playwright
from resources import check
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'.local-research/mac-modernization-20261030'
spec=importlib.util.spec_from_file_location('client',ROOT/'scripts/native/client.py');client=importlib.util.module_from_spec(spec);spec.loader.exec_module(client)
def main():
    fixtures=json.loads((OUT/'fixtures.json').read_text());p=fixtures['positions'][1];before=check();start=time.monotonic();native_rows=[];rss=[]
    b=sum(1<<q for q,v in enumerate(p['board']) if v==1);w=sum(1<<q for q,v in enumerate(p['board']) if v==-1)
    with client.NativeEngine() as native:
        for i in range(2000):
            r=native.request(f'search {b:x} {w:x} {p["player"]} 2 0 1 1 1 0 0');assert r['move'] is not None
            if r['depth']==0:assert r['score'] is None and not r['exact']
            if i%100==0 or i==1999:rss.append({'search':i+1,'rssKiB':int(subprocess.check_output(['ps','-o','rss=','-p',str(native.process.pid)],text=True))})
            native_rows.append({k:r[k] for k in ['depth','exact','elapsedMs','cpuMs','nodes','timedOut']})
    with tempfile.TemporaryDirectory() as temp:
        server=subprocess.Popen([sys.executable,str(ROOT/'launch.py'),'--no-browser','--port','0','--http-log',str(Path(temp)/'http.log')],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
        try:
            url=re.search(r'http://127\.0\.0\.1:\d+/',server.stdout.readline()).group()
            with sync_playwright() as pw:
                browser=pw.chromium.launch(channel='chrome');page=browser.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(url+'tests/wasm_benchmark.html');page.wait_for_function('()=>typeof measure==="function"')
                measure=lambda op,**a:page.evaluate('([op,a])=>measure(op,a)',[op,a]);measure('init');cycles=[];wasm=[]
                session=browser.new_browser_cdp_session();processes=[]
                for i in range(50):
                    cycles.append(measure('reinit'))
                    for _ in range(20):
                        r=measure('search',p=p,model='P',timeMs=2);assert r['move'] is not None and r['memoryBytes']<=134217728
                        if r['depth']==0:assert r['score'] is None and not r['exact']
                        wasm.append({k:r[k] for k in ['depth','exact','elapsedMs','nodes','timedOut','memoryBytes']})
                    if i%10==0 or i==49:
                        pids=','.join(str(x['id']) for x in session.send('SystemInfo.getProcessInfo')['processInfo']);raw=subprocess.run(['ps','-o','rss=','-p',pids],capture_output=True,text=True)
                        processes.append({'cycle':i+1,'browserProcessRssSumKiB':sum(int(s) for s in raw.stdout.split()),'scope':'Sum includes shared pages; not unique allocation'})
                assert not errors;browser.close()
        finally:server.terminate();server.communicate(timeout=5)
    data={'passed':True,'nativeSearches':2000,'wasmSearches':1000,'moduleReinitializations':50,'nativeRss':rss,'nativeTrials':native_rows,'wasmTrials':wasm,'moduleCycles':cycles,'browserProcesses':processes,'resourcesBefore':before,'resourcesAfter':check(),'wallSeconds':time.monotonic()-start,'scope':'Finite stability test, native RSS is resident memory, summed browser RSS double-counts shared pages; Wasm linear memory is separately bounded. No claim of proof against all leaks.'}
    (OUT/'stress.json').write_text(json.dumps(data)+'\n');print(json.dumps({k:data[k] for k in ['passed','nativeSearches','wasmSearches','moduleReinitializations','wallSeconds']}))
if __name__=='__main__':main()
