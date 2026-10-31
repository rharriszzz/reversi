"""Publish/audit Safari evidence. Verification needs only Python standard library."""
import hashlib,importlib.util,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];LOCAL=ROOT/'.local-research/safari-qualification-20261030';PUBLIC=ROOT/'docs/data/safari-qualification-20261030.json'
def load_module(name,path):
    spec=importlib.util.spec_from_file_location(name,ROOT/path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
rules=load_module('coordinate_rules','scripts/native/verify.py');mailbox=load_module('mailbox','scripts/mac/audit.py')
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def publish():
    read=lambda n:json.loads((LOCAL/n).read_text());q=read('qualification.json');assert q['passed'];custom=read('custom-game.json');assert custom['passed']
    for p,h in q['sourceHashes'].items():assert sha(ROOT/p)==h,p
    source=read('games.json');assert len(source['games'])==16
    columns=list(dict.fromkeys(k for g in source['games'] for event in g['plays'] for k in event['response']['choice']));games=[]
    for g in source['games']:
        searches=[]
        for event in g['plays']:
            r=event['response']['choice'];req=event['request'];searches.append({'ply':sum(v!=0 for v in req['board'])-4,'player':req['player'],'roundTripMs':event['roundTripMs'],'result':[r.get(k) for k in columns]})
        games.append({**{k:v for k,v in g.items() if k!='plays'},'searches':searches})
    for file,needle in [('fast-before.log','pass 7'),('node-after.log','pass 172')]:assert needle in (LOCAL/file).read_text() and 'fail 0' in (LOCAL/file).read_text()
    paths=['scripts/mac/safari-qualification.py','scripts/mac/safari-custom.py','scripts/mac/verify-safari.py','tests/safari_qualification.html','tests/safari_qualification_worker.js','scripts/native/verify.py','scripts/mac/audit.py']
    data={'format':'reversi-safari-qualification-v1','passed':True,'qualification':q,'gameTelemetryColumns':columns,'games':games,'customGame':custom,'tests':{'fastBefore':7,'nodeAfter':172,'logSha256':{f:sha(LOCAL/f) for f in ['fast-before.log','node-after.log']}},'resourcesBefore':read('resources-before.json'),'resourcesAfter':read('resources-final.json'),'testSourceHashes':{p:sha(ROOT/p) for p in paths},'previousArtifactSourceCommit':'c0412ec6d9a1391f10f04fa6caf788736f3dfb76','harnessFindings':['Safari Error.stack does not include Error.message; test bridges now preserve both.','Safari WebDriver rejected clicking a tr container; real clicks target its cell, and keyboard input uses WebDriver actions.','Replay range uses input, not change. The adapter dispatches the actual control event.'],'preliminaryRun':{'completeGames':16,'numericalError':0,'scope':'Preliminary games passed; later UI test-adapter interaction failed. Kept locally; final clean run reported separately.'},'limits':['Export Blob and download-link construction verified; disk download intentionally not triggered or Safari preferences changed.','No controlled Safari-versus-Chrome performance ranking.','No new evaluator learning or playing-strength claim.','No heap/allocation/RSS leak proof from this finite Safari run.']}
    PUBLIC.write_text(json.dumps(data,separators=(',',':'))+'\n')
def verify():
    d=json.loads(PUBLIC.read_text());q=d['qualification'];assert d['passed'] and q['passed'];assert q['capabilities']['browserName'].lower()=='safari'
    for p,h in {**q['sourceHashes'],**d['testSourceHashes']}.items():assert sha(ROOT/p)==h,p
    for p,h in q['wasmBuild']['artifacts'].items():assert sha(ROOT/'src/wasm'/p)==h,p
    assert q['wasmBuild']['models']==q['nativeBuild']['models'];assert q['numerical']['maxAbsError']==0 and q['numerical']['checks']==823
    assert q['ui']['passed'] and d['customGame']['passed'] and len(d['games'])==16
    cells={};placements=passes=replies=small=0
    for g in d['games']:
        key=f"{g['model']}/{g['budgetMs']}/{g['human']}";cells[key]=cells.get(key,0)+1
        b=[0]*64;b[28]=b[35]=1;b[27]=b[36]=-1;p=1;states=[];local=0
        for step in g['moves']:
            children=rules.children(b,p)
            if not children:assert rules.children(b,-p);p=-p;local+=1;children=rules.children(b,p)
            assert step['player']==p and step['move'] in children;states.append((b,p,step['move']));b=children[step['move']];p=-p;placements+=1
        assert b==g['board'] and not rules.children(b,1) and not rules.children(b,-1) and local==g['forcedPasses'];passes+=local
        for search in g['searches']:
            r=dict(zip(d['gameTelemetryColumns'],search['result'],strict=True));board,p,move=states[search['ply']]
            assert r['move']==move and p==search['player']==-g['human'];assert r['model']==g['model'] and r['backend']=='WebAssembly';assert r['memoryBytes']==33554432
            if r['exact'] and board.count(0)<=6:assert r['score']==mailbox.exact(tuple(board),p);small+=1
            replies+=1
        mailbox.exact.cache_clear()
    assert len(cells)==8 and set(cells.values())=={2}
    c=d['customGame'];b=[0]*64;b[28]=b[35]=1;b[27]=b[36]=-1;p=1;custom_passes=0
    for step in c['moves']:
        children=rules.children(b,p)
        if not children:assert rules.children(b,-p);p=-p;custom_passes+=1;children=rules.children(b,p)
        assert step['player']==p and step['move'] in children;b=children[step['move']];p=-p
    assert b==c['board'] and not rules.children(b,1) and not rules.children(b,-1) and custom_passes==c['forcedPasses']
    result={'passed':True,'actualBrowser':q['capabilities']['browserName'],'browserVersion':q['capabilities']['browserVersion'],'frozenGames':16,'cells':cells,'placements':placements,'forcedPasses':passes,'appliedReplies':replies,'independentExactSearchChecks':small,'customGamePlacements':len(c['moves']),'customGamePasses':custom_passes,'numericalComparisons':823,'maxAbsError':0,'sourceAndArtifactHashes':'matched'}
    (ROOT/'docs/data/safari-public-verification-20261030.json').write_text(json.dumps(result,separators=(',',':'))+'\n');print(json.dumps(result))
if __name__=='__main__':
    if '--publish' in sys.argv:publish()
    verify()
