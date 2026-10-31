"""Matched M4 baseline/candidate/actual Chrome Wasm/original JS measurements."""
import contextlib,importlib.util,json,os,re,statistics,subprocess,sys,tempfile,time
from pathlib import Path
from playwright.sync_api import sync_playwright
from resources import check
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'.local-research/mac-modernization-20261030'
def module(name,path):
    spec=importlib.util.spec_from_file_location(name,ROOT/path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
client=module('client','scripts/native/client.py')
def args(p,model):
    b=p['board'];return f'{sum(1<<q for q,v in enumerate(b) if v==1):x} {sum(1<<q for q,v in enumerate(b) if v==-1):x} {p["player"]} {0 if model=="B" else 2}'
def depth(p):return 7 if p['occupied']<28 else 6 if p['occupied']<52 else max(1,min(9,64-p['occupied']))
def main():
    fixtures=json.loads((OUT/'fixtures.json').read_text());rows=[];timed=[];steady=[];start=time.monotonic();before=check()
    with tempfile.TemporaryDirectory() as temp,contextlib.ExitStack() as stack:
        server=subprocess.Popen([sys.executable,str(ROOT/'launch.py'),'--no-browser','--port','0','--http-log',str(Path(temp)/'http.log')],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
        stack.callback(lambda:(server.terminate(),server.communicate(timeout=5)))
        url=re.search(r'http://127\.0\.0\.1:\d+/',server.stdout.readline()).group()
        engines={k:stack.enter_context(client.NativeEngine(p)) for k,p in {'baseline':OUT/'variant-baseline/build.json','candidate':ROOT/'.local-research/native/build.json'}.items()}
        pw=stack.enter_context(sync_playwright());browser=pw.chromium.launch(channel='chrome');stack.callback(browser.close)
        page=browser.new_page();page.goto(url+'tests/wasm_benchmark.html');page.wait_for_function('()=>typeof measure==="function"')
        measure=lambda op,**a:page.evaluate('([op,a])=>measure(op,a)',[op,a]);cold=measure('init')
        for model in ['B','P']:
            for _ in range(2):
                for p in fixtures['positions']:
                    for e in engines.values():e.request(f'search {args(p,model)} {depth(p)} 0 1 0 0 0')
                    for op in ['search','javascript']:measure(op,p=p,model=model,depth=depth(p))
        names=['baseline','candidate','wasm','javascript']
        for rep in range(5):
            check();order=names[rep%4:]+names[:rep%4]
            if rep%2:order=order[::-1]
            for model in ['B','P'] if rep%2==0 else ['P','B']:
                for p in fixtures['positions']:
                    results={};static={}
                    for name in order:
                        results[name]=engines[name].request(f'search {args(p,model)} {depth(p)} 0 1 0 0 0') if name in engines else measure('search' if name=='wasm' else 'javascript',p=p,model=model,depth=depth(p))
                    assert len({r['score'] for r in results.values()})==1
                    assert results['candidate']['nodes']==results['wasm']['nodes']
                    for name in order:
                        static[name]=engines[name].request(f'evalbench {args(p,model)} 100000') if name in engines else measure('static' if name=='wasm' else 'js-static',p=p,model=model,n=100000)
                    assert len({r['checksum'] for r in static.values()})==1
                    rows.append({'rep':rep,'model':model,'position':p['id'],'depth':depth(p),'order':order,'results':results,'static':static})
            print(json.dumps({'fixedRepComplete':rep+1}),flush=True)
        for rep in range(7):
            order=['baseline','candidate','wasm'];order=order[rep%3:]+order[:rep%3]
            if rep%2:order.reverse()
            for model in ['B','P'] if rep%2==0 else ['P','B']:
                results={}
                for name in order:
                    if name=='wasm':results[name]=measure('batch',positions=fixtures['positions'],model=model,backend='wasm',repeats=10)
                    else:
                        rs=[];wall=time.monotonic()
                        for _ in range(10):
                            for p in fixtures['positions']:rs.append(engines[name].request(f'search {args(p,model)} {depth(p)} 0 1 0 0 0'))
                        results[name]={'coreMs':sum(r['elapsedMs'] for r in rs),'cpuMs':sum(r['cpuMs'] for r in rs),'wallMs':(time.monotonic()-wall)*1000,'nodes':sum(r['nodes'] for r in rs),'evaluations':sum(r['evaluations'] for r in rs),'values':[r['score'] for r in rs[:8]]}
                assert all(r['values']==results['baseline']['values'] for r in results.values())
                assert results['candidate']['nodes']==results['wasm']['nodes']
                steady.append({'rep':rep,'model':model,'order':order,'repeats':10,'results':results})
        for rep in range(3):
            check();order=names[rep%4:]+names[:rep%4]
            if rep%2:order.reverse()
            for model in ['B','P']:
                for budget in [80,300]:
                    for p in fixtures['positions'][:6]:
                        results={}
                        for name in order:results[name]=engines[name].request(f'search {args(p,model)} 0 {budget} 1 0 0 0') if name in engines else measure('search' if name=='wasm' else 'javascript',p=p,model=model,timeMs=budget)
                        timed.append({'rep':rep,'model':model,'budgetMs':budget,'position':p['id'],'order':order,'results':results})
            print(json.dumps({'timedRepComplete':rep+1}),flush=True)
        boundary=[]
        for model in ['B','P']:
            for p in fixtures['positions'][:2]:boundary.append({'model':model,'position':p['id'],'result':measure('boundary',p=p,model=model,n=1000)})
        data={'browser':browser.version,'fixtures':fixtures,'receipts':{k:e.receipt for k,e in engines.items()},'cold':cold,'rows':rows,'steady':steady,'timed':timed,'boundary':boundary,'resourcesBefore':before,'resourcesAfter':check(),'wallSeconds':time.monotonic()-start,'policy':'serial rotated/reversed fixed trials, 2 complete warmups; 7 ten-batch steady blocks; 3 timed repetitions, no profiler'}
        (OUT/'benchmarks.json').write_text(json.dumps(data)+'\n')
        summary=[]
        for model in ['B','P']:
            selected=[r for r in rows if r['model']==model]
            for name in names:
                batches=[sum(r['results'][name]['elapsedMs'] for r in selected if r['rep']==rep) for rep in range(5)]
                nodes=sum(r['results'][name]['nodes'] for r in selected if r['rep']==0)
                static=[r['static'][name]['elapsedMs']*1e6/r['static'][name]['evaluations'] for r in selected]
                summary.append({'model':model,'backend':name,'medianBatchMs':statistics.median(batches),'batchesMs':batches,'nodes':nodes,'millionNodesPerSecond':nodes/statistics.median(batches)/1000,'medianStaticNs':statistics.median(static)})
        (OUT/'benchmark-summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary),flush=True)
if __name__=='__main__':main()
