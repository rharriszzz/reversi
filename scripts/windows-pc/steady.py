"""Bounded follow-up: longer fixed-work blocks, retaining the original trials."""
import json
import re
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser import WindowsBrowser
from qualify import client,args
from resources import latest
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'.local-research/windows-pc-20261030'

def main():
    fixtures=json.loads((OUT/'fixtures.json').read_text());positions=fixtures['positions'];rows=[];repeat=10
    with tempfile.TemporaryDirectory() as temp:
        server=subprocess.Popen([sys.executable,str(ROOT/'launch.py'),'--no-browser','--port','0','--http-log',str(Path(temp)/'http.log')],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
        try:
            url=re.search(r'http://127\.0\.0\.1:\d+/',server.stdout.readline()).group()
            with sync_playwright() as pw,WindowsBrowser(pw) as browser,client.NativeEngine() as portable,client.NativeEngine(ROOT/'.local-research/native-host/build.json') as host:
                page=browser.new_page();page.goto(url+'tests/wasm_benchmark.html');page.wait_for_function('()=>typeof window.measure==="function"');page.evaluate('()=>measure("init")')
                def run(backend,model,repeats):
                    if backend in ['wasm','javascript']:
                        return page.evaluate('(a)=>measure("batch",a)',{'positions':positions,'model':model,'backend':backend,'repeats':repeats})
                    engine=portable if backend=='native' else host
                    start=time.monotonic();core=cpu=nodes=evaluations=0;values=[]
                    for rep in range(repeats):
                        for p in positions:
                            d=7 if p['occupied']<28 else 6 if p['occupied']<52 else max(1,min(9,64-p['occupied']))
                            r=engine.request(f'search {args(p["board"],p["player"],model)} {d} 0 1 0 0 0')
                            core+=r['elapsedMs'];cpu+=r['cpuMs'];nodes+=r['nodes'];evaluations+=r['evaluations']
                            if rep==0:values.append(r['score'])
                    return {'coreMs':core,'cpuMs':cpu,'wallMs':(time.monotonic()-start)*1000,'nodes':nodes,'evaluations':evaluations,'values':values}
                for model in ['B','P']:
                    for backend in ['native','host','wasm','javascript']:run(backend,model,2)
                backends=['native','wasm','javascript','host']
                for rep in range(7):
                    order=backends[rep%4:]+backends[:rep%4]
                    if rep%2:order=order[::-1]
                    for model in (['B','P'] if rep%2==0 else ['P','B']):
                        before=latest();results={b:run(b,model,repeat) for b in order}
                        for b,r in results.items():
                            assert r['values']==results['native']['values']
                            if b!='javascript':assert r['nodes']==results['native']['nodes']
                        rows.append({'rep':rep,'model':model,'order':order,'repeats':repeat,'results':results,'resourcesBefore':before,'resourcesAfter':latest()})
                        (OUT/'steady.json').write_text(json.dumps({'browser':browser.version,'fixtures':fixtures,'rows':rows}))
                        print(json.dumps({'rep':rep,'model':model,'msPerBatch':{b:round(r['coreMs']/repeat,3) for b,r in results.items()}}),flush=True)
        finally:server.terminate();server.communicate(timeout=5)
if __name__=='__main__':main()
