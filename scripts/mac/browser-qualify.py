"""Numerical checks in an actual Mac Chrome worker, independent rules for all PVs."""
import importlib.util
import json
import os
import random
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright
from contextlib import contextmanager
@contextmanager
def Chrome(pw):
    browser=pw.chromium.launch(channel='chrome')
    try:yield browser
    finally:browser.close()
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'.local-research/mac-modernization-20261030'

def module(name,path):
    spec=importlib.util.spec_from_file_location(name,ROOT/path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
client=module('native_client','scripts/native/client.py');rules=module('independent','scripts/native/verify.py')
def args(b,p,model):return f'{sum(1<<q for q,v in enumerate(b) if v==1):x} {sum(1<<q for q,v in enumerate(b) if v==-1):x} {p} {["B","L","P"].index(model)}'
def value(native,b,p,model,depth):return native.request(f'windows {args(b,p,model)} {depth} 1 1 -1000000000 1000000000')['values'][0]

def main():
    fixtures=json.loads((OUT/'fixtures.json').read_text());checks=0;max_error=0;pv_steps=0;static=0;alternatives=0
    def near(a,b):
        nonlocal checks,max_error
        error=abs(a-b);checks+=1;max_error=max(max_error,error);assert error<=1e-10,(a,b)
    with tempfile.TemporaryDirectory() as temp:
        server=subprocess.Popen([sys.executable,str(ROOT/'launch.py'),'--no-browser','--port','0','--http-log',str(Path(temp)/'http.log')],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
        try:
            url=re.search(r'http://127\.0\.0\.1:\d+/',server.stdout.readline()).group()
            with sync_playwright() as pw,Chrome(pw) as browser,client.NativeEngine() as native:
                page=browser.new_page();page.goto(url+'tests/wasm_benchmark.html');page.wait_for_function('()=>typeof window.measure==="function"')
                measure=lambda op,**a:page.evaluate('([op,a])=>measure(op,a)',[op,a]);init=measure('init')
                rng=random.Random(0x57494e50)
                boards=fixtures['positions']+[{'board':[rng.choice([-1,0,1]) for _ in range(64)],'player':rng.choice([-1,1])} for _ in range(96)]
                for p in boards:
                    for model in ['B','L','P']:
                        w=measure('inspect',p=p,model=model);n=native.request(f'inspect {args(p["board"],p["player"],model)}');near(w['evaluation'],n['evaluation']);assert w['features']==n['features'];assert w['children']==n['children'];static+=1
                for p in fixtures['positions']:
                    for model in ['B','L','P']:
                        analysis=measure('analyze',p=p,model=model,depth=3);children=rules.children(p['board'],p['player'])
                        assert {r['move'] for r in analysis['results']}==set(children)
                        for row in analysis['results']:
                            near(row['score'],-value(native,children[row['move']],-p['player'],model,2));alternatives+=1
                            b=p['board'];turn=p['player'];remaining=3
                            for j,q in enumerate(row['pv']):
                                moves=rules.children(b,turn)
                                if q=='pass':assert not moves and rules.children(b,-turn);turn=-turn;continue
                                move=(int(q[1])-1)*8+ord(q[0])-65;assert move in moves
                                if j:near(value(native,b,turn,model,remaining),-value(native,moves[move],-turn,model,remaining-1))
                                b=moves[move];turn=-turn;remaining-=1;pv_steps+=1
                            assert remaining>=0
                deep=json.loads((ROOT/'docs/data/native-v2-deep-qualification-20261030.json').read_text())
                deep_checks=0
                for p in deep['rows']:
                    for model in ['B','L','P']:
                        utility=lambda v:(10000 if v>0 else -10000)+v if v else 0
                        r=measure('search',p=p,model=model,depth=p['depth']);near(r['score'],utility(p['independent']['value']));assert r['exact']
                        for row in p['independent']['rows']:
                            child={'board':rules.children(p['board'],p['player'])[row['move']],'player':-p['player']}
                            r=measure('search',p=child,model=model,depth=p['depth']-1);near(-r['score'],utility(row['value']));assert r['exact'];deep_checks+=1
                cycles=[]
                for _ in range(20):cycles.append(measure('reinit'))
                assert set(r['memoryBytes'] for r in cycles)=={33554432}
                result={'passed':True,'channel':os.environ.get('REVERSI_WINDOWS_CHANNEL','chrome'),'browser':browser.version,'userAgent':page.evaluate('navigator.userAgent'),'platform':page.evaluate('navigator.platform'),'checks':checks,'maxAbsError':max_error,'tolerance':1e-10,'staticQueries':static,'rootAlternatives':alternatives,'pvPlacements':pv_steps,'deepAlternativeChecks':deep_checks,'deepReferences':deep['rows'],'initialization':init,'reinitializations':cycles}
                (OUT/'browser-numerical.json').write_text(json.dumps(result));print(json.dumps({k:v for k,v in result.items() if k not in ['deepReferences','reinitializations']}),flush=True)
        finally:server.terminate();server.communicate(timeout=5)
if __name__=='__main__':main()
