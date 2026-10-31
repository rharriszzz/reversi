"""Legacy command name: frozen B Safari play/review and saved-data preservation smoke."""
import base64,hashlib,importlib.util,json,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'.local-research/safari-qualification-20261030'
spec=importlib.util.spec_from_file_location('safari_qualification',ROOT/'scripts/mac/safari-qualification.py');safari=importlib.util.module_from_spec(spec);spec.loader.exec_module(safari)
def main():
    start=time.monotonic();build=safari.manifest()
    with safari.Safari() as s:
        safari.setup_ui(s);s.select('#evaluator','B');s.select('#computer-time',0);s.select('#computer-depth',2);s.select('#human-color',1)
        saved='historical user model bytes';s.js('localStorage.setItem("reversi-coach-lab-learning-v1",arguments[0])',saved)
        assert s.js('return document.querySelectorAll("#train,#export-model,#reset-model,#weights-table").length')==0
        s.click('#new-game')
        for _ in range(64):
            safari.ready(s)
            if s.text('#turn-title')=='Game over':break
            s.click('#board button:not(:disabled)')
        assert s.text('#turn-title')=='Game over';labels=s.js('return [...document.querySelectorAll("#history .history-item")].map(e=>e.textContent)')
        b=[0]*64;b[28]=b[35]=1;b[27]=b[36]=-1;p=1;steps=[];passes=0;states=[]
        for label in labels:
            m=safari.re.fullmatch(r'\d+\. ([BW]) ([A-H])([1-8])',label);assert m,label;q=(int(m[3])-1)*8+ord(m[2])-65;children=safari.independent.moves(b,p)
            if not children:assert safari.independent.moves(b,-p);p=-p;passes+=1;children=safari.independent.moves(b,p)
            assert (1 if m[1]=='B' else -1)==p and q in children;states.append((b,p,q));steps.append({'player':p,'move':q});b=children[q];p=-p
        assert b==safari.board(s) and not safari.independent.moves(b,1) and not safari.independent.moves(b,-1)
        plays=s.js('return __safari.events.filter(e=>e.response.type==="played")')
        for event in plays:
            r=event['response']['choice'];req=event['request'];assert r['backend']=='WebAssembly' and r['model']=='B';assert (req['board'],req['player'],r['move']) in states
        s.click('#review-game');s.wait('document.querySelector("#game-review button")',timeout=120);assert 'B · WebAssembly' in s.text('#backend-status');s.click('#game-review button');s.wait('document.querySelector("#status").textContent.includes("earlier position")');assert not s.js('return __safari.errors')
        (OUT/'safari-player-final.png').write_bytes(base64.b64decode(s.request('/screenshot')))
        result={'passed':True,'browserVersion':s.capabilities['browserVersion'],'savedModelBytesPreserved':s.js('return localStorage.getItem("reversi-coach-lab-learning-v1")')==saved,'moves':steps,'board':b,'forcedPasses':passes,'appliedReplies':len(plays),'reviewPassed':True,'pageErrors':s.js('return __safari.errors'),'wallSeconds':time.monotonic()-start,'wasmBuildIdentity':build['fingerprint'],'scope':'One frozen B Wasm game/review; saved model bytes preserved; no fitting or strength claim.'}
    assert safari.manifest()==build;result['sourceSha256']=hashlib.sha256(Path(__file__).read_bytes()).hexdigest();(OUT/'player-game.json').write_text(json.dumps(result)+'\n');print(json.dumps({k:result[k] for k in ['passed','savedModelBytesPreserved','appliedReplies','forcedPasses','wallSeconds']}))
if __name__=='__main__':main()
