"""Small Windows Edge/Chrome sanity panel; no JS benchmark or strength study."""
import json
import re
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'.local-research/pc-upgrade-20261030'
sys.path.insert(0,str(ROOT/'scripts/windows-pc'))
from browser import WindowsBrowser
from qualify import client,args
from resources import linux,windows

def snapshot():return {'linux':linux(),'windows':windows()}
def main():
    fixtures=json.loads((OUT/'fixtures.json').read_text());positions=fixtures['positions'];rows=[];timed=[];start=time.monotonic()
    before=snapshot()
    with tempfile.TemporaryDirectory() as temp:
        server=subprocess.Popen([sys.executable,str(ROOT/'launch.py'),'--no-browser','--port','0','--http-log',str(Path(temp)/'http.log')],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
        try:
            url=re.search(r'http://127\.0\.0\.1:\d+/',server.stdout.readline()).group()
            with sync_playwright() as pw,client.NativeEngine() as native:
                for channel in ['chrome','edge']:
                    with WindowsBrowser(pw,channel) as browser:
                        page=browser.new_page();page.goto(url+'tests/wasm_benchmark.html');page.wait_for_function('()=>typeof measure==="function"')
                        measure=lambda op,**a:page.evaluate('([op,a])=>measure(op,a)',[op,a]);init=measure('init')
                        identity={'channel':channel,'version':browser.version,'platform':page.evaluate('navigator.platform'),'userAgent':page.evaluate('navigator.userAgent')}
                        assert identity['platform']=='Win32' and 'Windows NT' in identity['userAgent']
                        for model in ['B','P']:measure('batch',positions=positions,model=model,backend='wasm',repeats=2)
                        for rep in range(5):
                            for model in (['B','P'] if rep%2==0 else ['P','B']):
                                r=measure('batch',positions=positions,model=model,backend='wasm',repeats=3)
                                expected_nodes=148636 if model=='B' else 169532
                                expected_evaluations=90353 if model=='B' else 108829
                                assert r['nodes']==3*expected_nodes and r['evaluations']==3*expected_evaluations
                                reference=[]
                                for p in positions:
                                    d=7 if p['occupied']<28 else 6 if p['occupied']<52 else max(1,min(9,64-p['occupied']))
                                    reference.append(native.request(f"search {args(p['board'],p['player'],model)} {d} 0 1 0 0 0")['score'])
                                assert r['values']==reference
                                rows.append({'identity':identity,'model':model,'rep':rep,'repeats':3,'initialization':init,**r})
                        # Separately check last-completed timed values against native fixed searches.
                        for p in [positions[1],positions[3],positions[4]]:
                            for model in ['B','P']:
                                r=measure('search',p=p,model=model,timeMs=30)
                                if r['depth']:
                                    n=native.request(f"search {args(p['board'],p['player'],model)} {r['depth']} 0 1 0 0 0")
                                    assert r['score']==n['score'] and r['exact']==n['exact']
                                else:assert r['score'] is None and not r['exact']
                                timed.append({'identity':identity,'position':p['id'],'model':model,'budgetMs':30,'result':r})
                        print(json.dumps({'channel':channel,'version':browser.version,'fixedBatches':10,'timedChecks':6}),flush=True)
        finally:server.terminate();server.communicate(timeout=5)
    result={'passed':True,'fixtures':positions,'rows':rows,'timed':timed,'resourcesBefore':before,'resourcesAfter':snapshot(),'wallSeconds':time.monotonic()-start,'scope':'Five serial 3-batch repetitions per browser/model, two warmups. Browser order is Chrome then Edge; small sanity check, not a controlled browser ranking. Native reference requests run between browser batches, never concurrently.'}
    (OUT/'browser-sanity.json').write_text(json.dumps(result)+'\n')
if __name__=='__main__':main()
