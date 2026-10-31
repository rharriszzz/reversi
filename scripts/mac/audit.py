"""Outcome-blind admission audit: independent mailbox replay and small exacts."""
import functools,hashlib,importlib.util,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'.local-research/mac-modernization-20261030'
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def moves(board,player):
    box=[2]*100
    for q,v in enumerate(board):box[11+q//8*10+q%8]=v
    children={}
    for q,v in enumerate(board):
        if v:continue
        at=11+q//8*10+q%8;captured=[]
        for delta in [-11,-10,-9,-1,1,9,10,11]:
            cursor=at+delta;ray=[]
            while box[cursor]==-player:ray.append(cursor);cursor+=delta
            if box[cursor]==player:captured+=ray
        if captured:
            child=box[:];child[at]=player
            for pos in captured:child[pos]=player
            children[q]=[child[11+j//8*10+j%8] for j in range(64)]
    return children
@functools.lru_cache(maxsize=100000)
def exact(board,player):
    children=moves(board,player)
    if children:return max(-exact(tuple(b),-player) for b in children.values())
    if moves(board,-player):return -exact(board,-player)
    margin=sum(board)*player;return (10000 if margin>0 else -10000)+margin if margin else 0

def backend_audit():
    r=json.loads((OUT/'backend-registration.json').read_text());completion=json.loads((OUT/'backend-completion.json').read_text());file=OUT/'backend-games.sealed.jsonl'
    assert completion['complete'] and completion['games']==256 and completion['outcomesOpened'] is False
    assert sha(file)==completion['sealedSha256']
    for p,h in r['sourceHashes'].items():assert sha(ROOT/p)==h,p
    for p,h in r['wasmBuild']['artifacts'].items():assert sha(ROOT/'src/wasm'/p)==h,p
    registration=dict(r);digest=registration.pop('registrationSha256');assert hashlib.sha256(json.dumps(registration,sort_keys=True,separators=(',',':')).encode()).hexdigest()==digest
    games=[json.loads(line) for line in file.read_text().splitlines()];assert len(games)==len(r['schedule'])==256
    spec=importlib.util.spec_from_file_location('client',ROOT/'scripts/native/client.py');client=importlib.util.module_from_spec(spec);spec.loader.exec_module(client)
    checks=0;fixed=0;placements=0;passes=0
    with client.NativeEngine() as native:
        for item,g in zip(r['schedule'],games):
            for key in ['index','family','budgetMs','nativeColor']:assert g[key]==item[key],key
            root=r['families'][item['family']];b=[0]*64;b[28]=b[35]=1;b[27]=b[36]=-1;p=1
            for s in root['moves']:
                children=moves(b,p)
                if not children:p=-p;children=moves(b,p)
                assert s['player']==p and s['move'] in children;b=children[s['move']];p=-p
            assert b==root['board'] and p==root['player'];local_passes=0;sampled=set()
            for step in g['steps']:
                children=moves(b,p)
                if not children:assert moves(b,-p);p=-p;local_passes+=1;children=moves(b,p)
                assert step['player']==p and step['move'] in children
                expected_backend='native' if p==g['nativeColor'] else 'wasm';assert step['backend']==expected_backend
                assert step['nodes']>=0 and 0<=step['depth']<=64
                if step['depth']==0:assert step['score'] is None and not step['exact']
                if step['exact'] and b.count(0)<=6:assert step['score']==exact(tuple(b),p);checks+=1
                if expected_backend not in sampled and step['depth']>0:
                    black=sum(1<<q for q,v in enumerate(b) if v==1);white=sum(1<<q for q,v in enumerate(b) if v==-1)
                    result=native.request(f'search {black:x} {white:x} {p} 2 {step["depth"]} 0 1 0 0 0');assert result['score']==step['score'];fixed+=1;sampled.add(expected_backend)
                b=children[step['move']];p=-p;placements+=1
            assert not moves(b,1) and not moves(b,-1) and b==g['board']
            assert sum(b)==g['rawBlackMargin'] and local_passes==g['forcedPasses'];passes+=local_passes
            exact.cache_clear()
    result={'passed':True,'games':256,'placements':placements,'forcedPasses':passes,'independentExactSearchChecks':checks,'completedHorizonNativeChecks':fixed,'sealedSha256':sha(file),'registrationSha256':digest,'sourceAndArtifactHashes':'matched','outcomeSummariesOpened':False}
    (OUT/'backend-audit.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))

def acceptance_audit():
    data=json.loads((OUT/'acceptance-games.json').read_text());assert len(data['games'])==96
    summary=json.loads((OUT/'acceptance-summary.json').read_text());assert not summary['errors']
    cells={};placements=0;checks=0;passes=0
    for g in data['games']:
        key=f"{g['model']}/{g['budgetMs']}/{g['human']}";cells[key]=cells.get(key,0)+1
        b=[0]*64;b[28]=b[35]=1;b[27]=b[36]=-1;p=1;states=[];local=0
        for step in g['moves']:
            children=moves(b,p)
            if not children:assert moves(b,-p);p=-p;local+=1;children=moves(b,p)
            assert step['player']==p and step['move'] in children;states.append((b[:],p,step['move']));b=children[step['move']];p=-p;placements+=1
        assert b==g['board'] and not moves(b,1) and not moves(b,-1) and local==g['forcedPasses'];passes+=local
        for event in g['plays']:
            req=event['request'];r=event['response']['choice'];assert r['move'] in moves(req['board'],req['player'])
            assert (req['board'],req['player'],r['move']) in states and req['player']==-g['human']
            if r['exact'] and req['board'].count(0)<=6:assert r['score']==exact(tuple(req['board']),req['player']);checks+=1
        exact.cache_clear()
    assert len(cells)==8 and set(cells.values())=={12}
    result={'passed':True,'games':96,'placements':placements,'cells':cells,'forcedPasses':passes,'independentExactSearchChecks':checks,'pageErrors':summary['errors']}
    (OUT/'acceptance-audit.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
if __name__=='__main__':{'backend':backend_audit,'acceptance':acceptance_audit}[sys.argv[1]]()
