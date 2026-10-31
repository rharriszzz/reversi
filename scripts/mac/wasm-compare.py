"""Direct before/after actual worker Wasm comparison, 48 matched roots."""
import json,re,statistics,subprocess,sys,tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'.local-research/mac-modernization-20261030'
def main():
    reference='43e52d2235c17670f302ab822636f11660e4f8b7';directory=OUT/'wasm-reference';directory.mkdir(exist_ok=True)
    old=json.loads(subprocess.check_output(['git','show',reference+':src/wasm/manifest.js'],text=True).split('export default ')[1].strip().removesuffix(';'))
    for file in old['artifacts']:(directory/file).write_bytes(subprocess.check_output(['git','show',reference+':src/wasm/'+file]))
    expected={**old,'module':'../../.local-research/mac-modernization-20261030/wasm-reference/'+old['module']}
    experiment=json.loads((OUT/'experiments.json').read_text());positions=experiment['positions'];rows=[]
    def depth(p):return 64-p['occupied'] if p.get('exactRoot') else 8 if p['occupied']<28 else 7 if p['occupied']<52 else max(1,min(10,64-p['occupied']))
    with tempfile.TemporaryDirectory() as temp:
        server=subprocess.Popen([sys.executable,str(ROOT/'launch.py'),'--no-browser','--port','0','--http-log',str(Path(temp)/'http.log')],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
        try:
            url=re.search(r'http://127\.0\.0\.1:\d+/',server.stdout.readline()).group()
            with sync_playwright() as pw:
                browser=pw.chromium.launch(channel='chrome');page=browser.new_page();page.goto(url+'tests/mac_wasm_compare.html');page.wait_for_function('()=>typeof compare==="function"')
                measure=lambda op,**args:page.evaluate('([op,args])=>compare(op,args)',[op,args]);identities=measure('init',baseline=expected)
                assert identities['baseline']['actualBuildIdentity']==old['fingerprint']
                for model in ['B','P']:
                    for p in positions:
                        for tag in ['baseline','final']:measure('search',tag=tag,p=p,model=model,depth=depth(p))
                for rep in range(9):
                    order=['baseline','final'] if rep%2==0 else ['final','baseline']
                    for model in ['B','P'] if rep%2==0 else ['P','B']:
                        for p in positions:
                            results={tag:measure('search',tag=tag,p=p,model=model,depth=depth(p)) for tag in order}
                            assert results['baseline']['score']==results['final']['score']
                            rows.append({'rep':rep,'model':model,'position':p['id'],'depth':depth(p),'order':order,'results':results})
                summary=[]
                for scope in ['all','exact']:
                    selected={p['id'] for p in positions if scope=='all' or p.get('exactRoot')}
                    for model in ['B','P']:
                        for tag in ['baseline','final']:
                            batches=[sum(r['results'][tag]['elapsedMs'] for r in rows if r['rep']==rep and r['model']==model and r['position'] in selected) for rep in range(9)]
                            summary.append({'scope':scope,'model':model,'tag':tag,'medianMs':statistics.median(batches),'batches':batches})
                (OUT/'wasm-comparison.json').write_text(json.dumps({'referenceCommit':reference,'browser':browser.version,'builds':identities,'baselineManifest':old,'positions':positions,'rows':rows,'summary':summary})+'\n');print(json.dumps(summary));browser.close()
        finally:server.terminate();server.communicate(timeout=5)
if __name__=='__main__':main()
