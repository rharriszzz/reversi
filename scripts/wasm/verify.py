"""Independent public engineering-evidence audit. Python standard library only."""
from pathlib import Path
import json,hashlib,importlib.util,collections,functools
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('independent',ROOT/'scripts/native/verify.py');rules=importlib.util.module_from_spec(spec);spec.loader.exec_module(rules)
children=rules.children
@functools.lru_cache(maxsize=20000)
def exact(board,player):
 moves=children(board,player)
 if not moves:
  if children(board,-player):return -exact(board,-player)
  margin=sum(board)*player
  return (10000 if margin>0 else -10000)+margin if margin else 0
 return max(-exact(tuple(b),-player) for b in moves.values())
def main():
 data=json.loads((ROOT/'docs/data/wasm-acceptance-games-20261030.json').read_text());result=json.loads((ROOT/'docs/data/wasm-engine-results-20261030.json').read_text());bench=json.loads((ROOT/'docs/data/wasm-browser-benchmarks-20261030.json').read_text())
 for path,digest in result['sourceHashes'].items():assert hashlib.sha256((ROOT/path).read_bytes()).hexdigest()==digest,path
 for name,digest in result['wasmBuild']['artifacts'].items():assert hashlib.sha256((ROOT/'src/wasm'/name).read_bytes()).hexdigest()==digest,name
 assert bench['fixtures']['native']['models']==result['wasmBuild']['models']
 assert len(data['games'])==48;cells=collections.Counter();searches=passes=solves=0
 for g in data['games']:
  cells[g['model'],g['budgetMs'],g['human']]+=1
  b=[0]*64;b[28]=b[35]=1;b[27]=b[36]=-1;p=1;states=[];local_passes=0
  for step in g['moves']:
   legal=children(b,p)
   if not legal:assert children(b,-p);p=-p;local_passes+=1;legal=children(b,p)
   assert step['player']==p and step['move'] in legal
   states.append((tuple(b),p,step['move']));b=legal[step['move']];p=-p
  assert b==g['board'] and not children(b,1) and not children(b,-1)
  assert local_passes==g['forcedPasses'];passes+=local_passes
  for r in g['searches']:
   board,player,move=states[r['ply']];assert r['player']==player and r['move']==move and player==-g['human']
   assert r['tableBytes']==10485760 and r['depth']>0 and r['score'] is not None
   if r['exact'] and board.count(0)<=4:assert r['score']==exact(board,player);solves+=1
   searches+=1
 assert set(cells.values())=={6} and len(cells)==8
 for r in bench['rows']:
  native=r['results']['native'];wasm=r['results']['wasm'];js=r['results']['javascript']
  assert native['score']==wasm['score']==js['score']
  assert native['nodes']==wasm['nodes'] and native['tableBytes']==wasm['tableBytes']==10485760
  assert r['static']['native']['checksum']==r['static']['wasm']['checksum']==r['static']['javascript']['checksum']
 assert result['finalQualification']['maxAbsError']==0
 print(json.dumps({'passed':True,'games':48,'searches':searches,'forcedPasses':passes,'independentExactSearchChecks':solves,'fixedBenchmarkRows':len(bench['rows']),'sourceAndArtifactHashes':'matched'}))
if __name__=='__main__':main()
