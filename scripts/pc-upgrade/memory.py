"""Finite Edge worker-cancellation/memory observations, with no forced GC."""
import importlib.util
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'.local-research/pc-upgrade-20261030'
sys.path.insert(0,str(ROOT/'scripts/windows-pc'))
from browser import WindowsBrowser
spec=importlib.util.spec_from_file_location('wasm_browser_helpers',ROOT/'scripts/wasm/browser.py');helper=importlib.util.module_from_spec(spec);spec.loader.exec_module(helper)
SPY="""(()=>{const Original=Worker;window.workerCounts={created:0,terminated:0};window.Worker=class extends Original{constructor(...a){super(...a);workerCounts.created++;}terminate(){workerCounts.terminated++;return super.terminate();}};})()"""
def main():
    with tempfile.TemporaryDirectory() as temp:
        server=subprocess.Popen([sys.executable,str(ROOT/'launch.py'),'--no-browser','--port','0','--http-log',str(Path(temp)/'http.log')],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
        try:
            url=re.search(r'http://127\.0\.0\.1:\d+/',server.stdout.readline()).group()
            with sync_playwright() as pw,WindowsBrowser(pw,'edge') as browser:
                context=browser.new_context();context.add_init_script(SPY);page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
                page.goto(url);page.locator('#evaluator').select_option('P');page.locator('#analysis-depth').select_option('2');page.locator('#computer-time').select_option('300')
                expect(page.locator('#search-metrics')).to_contain_text('P · WebAssembly')
                session=browser.new_browser_cdp_session();cdp=context.new_cdp_session(page);cdp.send('Performance.enable');samples=[]
                for group in range(5):
                    if group:
                        page.locator('#human-color').select_option('-1')
                        for _ in range(10):page.locator('#new-game').click();page.wait_for_timeout(40)
                        page.locator('#human-color').select_option('1')
                        page.locator('#new-game').click();expect(page.locator('#search-metrics')).to_contain_text('P · WebAssembly')
                    counts=page.evaluate('workerCounts');assert counts['created']-counts['terminated']<=4,counts
                    metrics=cdp.send('Performance.getMetrics')['metrics']
                    samples.append({'restarts':10*group,'workers':counts,'rendererMetrics':{m['name']:m['value'] for m in metrics if m['name'] in ['JSHeapUsedSize','JSHeapTotalSize','Nodes','Documents']},'processes':helper.process_resources(session)})
                idle=[]
                for seconds in [5,10,15]:
                    page.wait_for_timeout(seconds*1000)
                    idle.append({'idleSeconds':sum([5,10,15][:len(idle)+1]),'workers':page.evaluate('workerCounts'),'rendererMetrics':{m['name']:m['value'] for m in cdp.send('Performance.getMetrics')['metrics'] if m['name'] in ['JSHeapUsedSize','JSHeapTotalSize','Nodes','Documents']},'processes':helper.process_resources(session)})
                assert not errors,errors
                result={'passed':True,'browser':browser.version,'channel':'edge','platform':page.evaluate('navigator.platform'),'restarts':40,'samples':samples,'idle':idle,'errors':errors,'scope':'Five finite observations plus 30 seconds idle, no forced GC; renderer JS heap excludes worker Wasm memory. Process working sets include shared pages; this is not a proof of no long-term leak.'}
                (OUT/'edge-memory.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
        finally:server.terminate();server.communicate(timeout=5)
if __name__=='__main__':main()
