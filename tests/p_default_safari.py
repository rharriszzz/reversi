"""P-default acceptance using the existing isolated Safari/native qualification.

No personal profile, production artifact, browser setting, or research run changes.
Six deterministic UI acceptance games are correctness checks, not strength tests.
"""
import importlib.util,json,os
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
os.environ.setdefault('REVERSI_SAFARI_OUTPUT','.local-research/p-default-integration-20261101/safari')
os.environ['REVERSI_SAFARI_SHORT']='1'
spec=importlib.util.spec_from_file_location('safari_acceptance',ROOT/'scripts/mac/runtime-cpu-safari.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
original_setup=m.setup_ui
original_cases=m.ui_cases
extra={}

def observed_analysis(s,model):
    s.js(m.SPY);s.click('#refresh-analysis')
    s.wait('__safari.events.some(e=>e.response.type==="analyzed")')
    event=s.js('return __safari.events.find(e=>e.response.type==="analyzed")')
    assert event['request']['evaluator']==model
    assert event['response']['analysis']['modelIdentity']==m.manifest()['models'][model]
    assert event['response']['analysis']['backend']=='WebAssembly'
    return dict(requested=event['request']['evaluator'],returned=event['response']['analysis']['modelIdentity'])

def setup_ui(s):
    original_setup(s)
    assert s.js('return document.querySelector("#evaluator").value')=='P'
    s.wait('document.querySelector("#search-metrics").textContent.includes("P · WebAssembly")')
    extra.setdefault('freshOrigins',[]).append(dict(url=s.url,analysis=observed_analysis(s,'P')))

def ui_cases(s):
    result=original_cases(s)
    saved='historical saved model bytes: never consumed by the player'
    migrations=[]
    cases=[(None,'P'),({'evaluator':'custom','timeMs':'80'},'P'),('{','P'),
           ({'evaluator':'unknown'},'P')]+[({'evaluator':model,'timeMs':'300'},model) for model in 'BLP']
    for pref,expected in cases:
        s.js('''localStorage.setItem('reversi-coach-lab-learning-v1',arguments[1]);
          const p=arguments[0];if(p===null)localStorage.removeItem('reversi-engine-preferences-v1');
          else localStorage.setItem('reversi-engine-preferences-v1',typeof p==='string'?p:JSON.stringify(p));''',pref,saved)
        s.request('/refresh',{})
        s.wait(f'document.querySelector("#search-metrics").textContent.includes("{expected} · WebAssembly")')
        assert s.js('return document.querySelector("#evaluator").value')==expected
        assert s.js('return localStorage.getItem("reversi-coach-lab-learning-v1")')==saved
        migrations.append(dict(preference=pref,selected=expected,actual=observed_analysis(s,expected)))
    for model in 'BLP':
        s.select('#evaluator',model);s.request('/refresh',{})
        s.wait(f'document.querySelector("#search-metrics").textContent.includes("{model} · WebAssembly")')
        assert s.js('return JSON.parse(localStorage.getItem("reversi-engine-preferences-v1")).evaluator')==model
    # Fresh P fails closed, retries in-place after repair, and offers explicit B.
    s.js('localStorage.removeItem("reversi-engine-preferences-v1")');s.fault='wasm';s.request('/refresh',{})
    s.wait('!document.querySelector("#use-baseline").hidden')
    assert 'No evaluator was substituted' in s.text('#backend-status')
    assert s.js('return document.querySelector("#evaluator").value')=='P'
    assert 'B ·' not in s.text('#search-metrics')
    s.fault=None;s.click('#retry-engine')
    s.wait('document.querySelector("#search-metrics").textContent.includes("P · WebAssembly")')
    s.fault='wasm';s.request('/refresh',{});s.wait('!document.querySelector("#use-baseline").hidden')
    s.click('#use-baseline');s.wait('document.querySelector("#search-metrics").textContent.includes("B · JavaScript")')
    assert 'JavaScript fallback' in s.text('#backend-status')
    s.fault=None;s.select('#evaluator','P');s.wait('document.querySelector("#search-metrics").textContent.includes("P · WebAssembly")')
    # A worker-level failure also recovers without reloading or losing the board.
    before=m.board(s)
    s.js('''const post=Worker.prototype.postMessage;Worker.prototype.postMessage=function(r,...a){
      if(r.type==='analyze'){Worker.prototype.postMessage=post;
        setTimeout(()=>this.dispatchEvent(new ErrorEvent('error',{message:'P-default acceptance fault'})),0);return;}
      return post.call(this,r,...a);};''')
    s.click('#refresh-analysis');s.wait('document.querySelector("#backend-status").textContent.includes("P-default acceptance fault")')
    s.click('#retry-engine');s.wait('document.querySelector("#search-metrics").textContent.includes("P · WebAssembly")')
    assert m.board(s)==before
    extra.update(migrations=migrations,explicitSelectionsPersist=True,historicalSavedBytesPreserved=True,
                 firstVisitPFailureNoSubstitution=True,inPlaceInitializationRetry=True,
                 explicitBJavaScriptFallback=True,inPlaceWorkerErrorRetry=True)
    result['checks']+=['fresh P worker identity','custom/invalid/explicit preference migration',
                      'P first-visit failure and in-place retry','explicit Use B instead','worker error retry without reload']
    (m.OUT/'p-default-extra.json').write_text(json.dumps(extra,indent=2)+'\n')
    return result

m.setup_ui=setup_ui
m.ui_cases=ui_cases
if __name__=='__main__':m.main()
