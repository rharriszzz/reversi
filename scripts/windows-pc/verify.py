"""Recheck committed PC evidence without a browser, compiler or private corpus."""
import json
import hashlib
from collections import Counter
from publish import ROOT,DATA,children,exact

def main():
    result=json.loads((DATA/'windows-pc-results-20261030.json').read_text());bench=json.loads((DATA/'windows-pc-benchmarks-20261030.json').read_text());games=json.loads((DATA/'windows-pc-games-20261030.json').read_text())['games']
    for path,digest in result['sourceHashes'].items():assert hashlib.sha256((ROOT/path).read_bytes()).hexdigest()==digest,path
    for path,digest in result['wasmManifest']['artifacts'].items():assert hashlib.sha256((ROOT/'src/wasm'/path).read_bytes()).hexdigest()==digest,path
    mac=json.loads((DATA/'wasm-browser-benchmarks-20261030.json').read_text())
    assert bench['fixtures']['positions']==mac['fixtures']['positions']
    assert bench['fixtures']['referenceSha256']==mac['fixtures']['referenceSha256']
    assert bench['fixtures']['native']['models']==result['wasmManifest']['models']==result['hostBuild']['models']
    expected_nodes={p['model']:p['nodes'] for p in result['performance'] if p['backend']=='native'}
    for row in bench['rows']:
        n=row['results']['native']
        for backend,r in row['results'].items():
            assert r['score']==n['score']
            if backend!='javascript':assert r['nodes']==n['nodes'] and r['evaluations']==n['evaluations']
        for r in row['static'].values():assert r['checksum']==row['static']['native']['checksum']
    for row in bench['steadyRows']:
        for backend,r in row['results'].items():
            assert r['values']==row['results']['native']['values']
            if backend!='javascript':assert r['nodes']==expected_nodes[row['model']]*row['repeats']
    cells=Counter();searches=solves=passes=0
    for g in games:
        b=[0]*64;b[28]=b[35]=1;b[27]=b[36]=-1;p=1;states=[];local_passes=0
        for item in g['moves']:
            legal=children(b,p)
            if not legal:assert children(b,-p);p=-p;local_passes+=1;legal=children(b,p)
            assert item['player']==p and item['move'] in legal
            states.append((tuple(b),p,item['move']));b=legal[item['move']];p=-p
        assert b==g['board'] and not children(b,1) and not children(b,-1)
        assert local_passes==g['forcedPasses'];passes+=local_passes
        assert len(g['searches'])==sum(p==-g['human'] for _,p,_ in states)
        for r in g['searches']:
            board,p,move=states[r['ply']];assert r['player']==p and r['move']==move
            if r['exact'] and board.count(0)<=4:assert r['score']==exact(board,p);solves+=1
            searches+=1
        cells[g['model'],g['budgetMs'],g['human']]+=1
    assert len(games)==24 and len(cells)==8 and set(cells.values())=={3}
    assert searches==810 and passes==173 and solves==68
    print(json.dumps({'passed':True,'games':24,'computerReplies':searches,'forcedPasses':passes,'independentSmallExactChecks':solves,'fixedRows':len(bench['rows']),'steadyConditions':len(bench['steadyRows']),'MacPositionsAndOriginalJsEvaluator':'identical','sourceAndWasmHashes':'matched'}))

if __name__=='__main__':main()
