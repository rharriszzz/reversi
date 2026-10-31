"""Public verification: standard library, committed evidence, no private data."""
import hashlib,importlib.util,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];DATA=ROOT/'docs/data'
spec=importlib.util.spec_from_file_location('audit',ROOT/'scripts/mac/audit.py');audit=importlib.util.module_from_spec(spec);spec.loader.exec_module(audit)
def read(name):return json.loads((DATA/name).read_text())
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def main():
    r=read('mac-optimization-results-20261030.json');assert r['stage']=='final'
    for path,digest in r['sourceHashes'].items():assert sha(ROOT/path)==digest,path
    for path,digest in r['wasmBuild']['artifacts'].items():assert sha(ROOT/'src/wasm'/path)==digest,path
    assert r['wasmBuild']['models']==r['nativeBuild']['models'];assert r['wasmQualification']['maxAbsError']==0
    exp=read('mac-optimization-experiments-20261030.json');roots=0
    for cohort in ['initial','repeated','gateExperiment','coldFirstExperiment']:
        d=exp[cohort];score=d['columns'].index('score')
        for row in d['rows']:assert len({v[score] for v in row['results']})==1;roots+=1
    for row in exp['wasmComparison']['rows']:assert row['results']['baseline']['score']==row['results']['final']['score']
    bench=read('mac-optimization-benchmarks-20261030.json');fixed=0
    for cohort in bench.values():
        for row in cohort['rows']:
            assert len({r['score'] for r in row['results'].values()})==1
            assert row['results']['candidate']['nodes']==row['results']['wasm']['nodes']
            assert len({r['checksum'] for r in row['static'].values()})==1;fixed+=1
    registration=read('mac-backend-registration-20261030.json');encoded=dict(registration);digest=encoded.pop('registrationSha256')
    assert hashlib.sha256(json.dumps(encoded,sort_keys=True,separators=(',',':')).encode()).hexdigest()==digest
    for path,h in registration['sourceHashes'].items():assert sha(ROOT/path)==h,path
    data=read('mac-backend-games-20261030.json');assert len(data['games'])==256 and data['registrationSha256']==digest
    placements=0;exacts=0
    for item,g in zip(registration['schedule'],data['games']):
        assert all(g[k]==item[k] for k in ['index','family','budgetMs','nativeColor'])
        root=registration['families'][g['family']];b=root['board'];p=root['player'];passes=0
        for values in g['steps']:
            s=dict(zip(data['columns'],values,strict=True));children=audit.moves(b,p)
            if not children:assert audit.moves(b,-p);p=-p;passes+=1;children=audit.moves(b,p)
            assert s['player']==p and s['move'] in children
            assert s['backend']==('native' if p==g['nativeColor'] else 'wasm')
            if s['exact'] and b.count(0)<=6:assert s['score']==audit.exact(tuple(b),p);exacts+=1
            b=children[s['move']];p=-p;placements+=1
        assert b==g['board'] and not audit.moves(b,1) and not audit.moves(b,-1) and passes==g['forcedPasses'] and sum(b)==g['rawBlackMargin'];audit.exact.cache_clear()
    accepted=read('mac-browser-acceptance-20261030.json');assert len(accepted['games'])==96
    for g in accepted['games']:
        b=[0]*64;b[28]=b[35]=1;b[27]=b[36]=-1;p=1;states=[];passes=0
        for step in g['moves']:
            children=audit.moves(b,p)
            if not children:assert audit.moves(b,-p);p=-p;passes+=1;children=audit.moves(b,p)
            assert step['player']==p and step['move'] in children;states.append((b,p,step['move']));b=children[step['move']];p=-p
        assert b==g['board'] and not audit.moves(b,1) and not audit.moves(b,-1) and passes==g['forcedPasses']
        for search in g['searches']:
            s=dict(zip(accepted['columns'],search['result'],strict=True));board,p,move=states[search['ply']]
            assert s['move']==move and p==search['player']==-g['human']
            if s['exact'] and board.count(0)<=6:assert s['score']==audit.exact(tuple(board),p);exacts+=1
        audit.exact.cache_clear()
    result={'passed':True,'sourceAndArtifactHashes':'matched','matchedExperimentalRootRows':roots,'matchedFixedBrowserRows':fixed,'backendGames':256,'acceptanceGames':96,'backendPlacements':placements,'independentExactMoveChecks':exacts}
    (DATA/'mac-public-verification-20261030.json').write_text(json.dumps(result,separators=(',',':'))+'\n');print(json.dumps(result))
if __name__=='__main__':main()
