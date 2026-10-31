"""Short actual Safari worker comparison; same panels/method as Chrome."""
import importlib.util,json,os,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'scripts/fast-flips'))
from run import snapshot
spec=importlib.util.spec_from_file_location('safari',ROOT/'scripts/mac/runtime-cpu-safari.py')
safari=importlib.util.module_from_spec(spec);spec.loader.exec_module(safari)
OUT=Path(os.environ['REVERSI_FLIP_RUN']).resolve()
def main():
    expected=safari.manifest();original=json.loads((OUT/'old-manifest.js').read_text().split('export default ')[1].strip().removesuffix(';'))
    original['module']=os.path.relpath(OUT/original['module'],ROOT/'src/wasm')
    positions=json.loads((OUT/'positions.json').read_text())
    for p in positions:p['depth']=64-p['occupied'] if p.get('exactRoot') else 8 if p['occupied']<28 else 7 if p['occupied']<52 else max(1,min(10,64-p['occupied']))
    panels={'mixed48':positions,'exact12':[p for p in positions if p.get('exactRoot')]}
    rows=[];resources=[]
    with safari.Safari() as s:
        s.navigate('tests/safari_qualification.html');s.wait('typeof safariReset==="function"')
        s.js('''const worker=new Worker('/scripts/fast-flips/production-browser-worker.js',{type:'module'});let next=0;const pending=new Map();worker.onmessage=({data})=>{const p=pending.get(data.id);pending.delete(data.id);data.error?p.reject(Error(data.error)):p.resolve(data.result);};window.flipMeasure=a=>new Promise((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject});worker.postMessage({id,...a});});''')
        measure=lambda **a:s.async_js('flipMeasure(arguments[0])',a)
        identities=measure(op='init',expected=expected,originalExpected=original)
        assert identities=={'original':original['fingerprint'],'selected':expected['fingerprint']}
        for rep in range(7):
            resources.append(snapshot());order=['original','selected'] if rep%2==0 else ['selected','original']
            for panel,roots in panels.items():
                for model in ['B','L','P']:
                    results={tag:measure(op='batch',tag=tag,positions=roots,model=model,mode='play',repeats=3) for tag in order}
                    assert results['original']['roots']==results['selected']['roots']
                    assert results['original']['nodes']==results['selected']['nodes']
                    rows.append(dict(rep=rep,panel=panel,model=model,positionIds=[p['id'] for p in roots],order=order,results=results))
            print(f'Safari Wasm pair {rep+1}/7',file=sys.stderr,flush=True)
        version=s.capabilities['browserVersion']
    result={'passed':True,'browser':'Safari '+version,'identities':identities,'rows':rows,'resources':resources,'method':'Real Safari worker, 1 complete warmup/block, 3 batches/block, 7 alternating pairs. Batch wall time includes adapter/JSON; per-search CPU unavailable.'}
    (OUT/'safari-browser-qualification.json').write_text(json.dumps(result)+'\n');print(json.dumps(result))
if __name__=='__main__':main()
