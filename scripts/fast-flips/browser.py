"""Actual Chrome worker comparison and short candidate UI acceptance.

Uses an ignored compiled candidate via an explicit manifest; packaged Wasm files
remain unchanged. Invoke through run.py after native measurements.
"""
import json,os,re,subprocess,sys,tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from run import snapshot
ROOT=Path(__file__).resolve().parents[2];OUT=(ROOT/os.environ.get('REVERSI_FLIP_RUN','.local-research/fast-flips-m4-20261031')).resolve()
def main():
    expected=json.loads((OUT/'wasm-selected/manifest.json').read_text());positions=json.loads((OUT/'positions.json').read_text())
    def depth(p):return 64-p['occupied'] if p.get('exactRoot') else 8 if p['occupied']<28 else 7 if p['occupied']<52 else max(1,min(10,64-p['occupied']))
    for p in positions:p['depth']=depth(p)
    panels={'mixed48':positions,'exact12':[p for p in positions if p.get('exactRoot')],'opening':positions[:4],'middle':positions[4:10],'coaching':[positions[1],positions[5]]}
    with tempfile.TemporaryDirectory() as temp:
        server=subprocess.Popen([sys.executable,str(ROOT/'launch.py'),'--no-browser','--port','0','--http-log',str(Path(temp)/'http.log')],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
        try:
            url=re.search(r'http://127\.0\.0\.1:\d+/',server.stdout.readline()).group()
            with sync_playwright() as pw:
                browser=pw.chromium.launch(channel='chrome');page=browser.new_page();page.goto(url)
                page.evaluate('''()=>{const worker=new Worker('/scripts/fast-flips/browser-worker.js',{type:'module'});let next=0;const pending=new Map();worker.onmessage=({data})=>{const p=pending.get(data.id);pending.delete(data.id);data.error?p.reject(Error(data.error)):p.resolve(data.result);};window.flipMeasure=a=>new Promise((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject});worker.postMessage({id,...a});});}''')
                measure=lambda **a:page.evaluate('(a)=>flipMeasure(a)',a)
                identities=measure(op='init',expected=expected);assert identities['selected']==expected['fingerprint']
                rows=[]
                for rep in range(7):
                    resources=snapshot();order=['original','selected'] if rep%2==0 else ['selected','original']
                    for panel,roots in panels.items():
                        for model in ['B','P']:
                            results={tag:measure(op='batch',tag=tag,positions=roots,model=model,mode='coach' if panel=='coaching' else 'play',repeats=3) for tag in order}
                            assert results['original']['roots']==results['selected']['roots'],panel
                            assert results['original']['nodes']==results['selected']['nodes']
                            rows.append({'rep':rep,'panel':panel,'model':model,'positionIds':[p['id'] for p in roots],'order':order,'results':results})
                    print(f'Wasm pair {rep+1}/7',file=sys.stderr,flush=True)
                page.close()
                context=browser.new_context();body='export default '+json.dumps(expected)+';\n'
                context.route('**/src/wasm/manifest.js',lambda route:route.fulfill(status=200,content_type='text/javascript',body=body))
                app=context.new_page();errors=[];requests=[]
                app.on('pageerror',lambda e:errors.append(str(e)));app.on('request',lambda r:requests.append(r.url))
                app.goto(url);expect(app.locator('#move-rows tr')).to_have_count(4)
                for model in ['B','L','P']:
                    app.locator('#evaluator').select_option(model);expect(app.locator('#search-metrics')).to_contain_text(f'{model} · WebAssembly')
                    expect(app.locator('#move-rows tr')).to_have_count(4);app.locator('#move-rows tr').nth(1).click();expect(app.locator('#interpretation')).to_contain_text('verified depth-3 line')
                actual=app.evaluate("async()=>{const m=await import('/src/wasm/manifest.js');return m.default.fingerprint}");assert actual==expected['fingerprint']
                assert any(expected['fingerprint'][:16] in r and r.endswith('.wasm') for r in requests)
                app.locator('#computer-time').select_option('80');app.get_by_role('gridcell',name='D3: legal move',exact=True).click();expect(app.locator('#history .history-item')).to_have_count(2)
                expect(app.locator('#play-metrics')).to_contain_text('P · WebAssembly');app.locator('#undo').click();expect(app.locator('#history .history-item')).to_have_count(0)
                for model in ['B','P','B','P']:
                    app.locator('#evaluator').select_option(model);app.locator('#analysis-depth').select_option('6');app.locator('#new-game').click()
                app.locator('#analysis-depth').select_option('2');expect(app.locator('#depth-label')).to_have_text('Depth 2');expect(app.locator('#search-metrics')).to_contain_text('P · WebAssembly')
                app.reload();expect(app.locator('#evaluator')).to_have_value('P');expect(app.locator('#search-metrics')).to_contain_text('P · WebAssembly');assert not errors,errors
                checks=['candidate module fingerprint/network request','B/L/P coaching','verified line display','timed computer reply','undo','cancellation/model changes','reload']
                result={'passed':True,'browser':browser.version,'identities':identities,'rows':rows,'uiChecks':checks,'pageErrors':errors,'sourceCommit':expected['sourceCommit'],'method':'Real Chrome worker complete batch wall time includes adapter/JSON/JS coaching; 1 full warmup per block, 3 batches per block, 7 alternating pairs; CPU time unavailable.'}
                (OUT/'browser-qualification.json').write_text(json.dumps(result)+'\n');print(json.dumps(result));context.close();browser.close()
        finally:server.terminate();server.communicate(timeout=5)
if __name__=='__main__':main()
