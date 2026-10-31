#!/usr/bin/env python3
"""Supplement the retained extraction's scalar seed records with old seed arrays.

Pre-play audit only; never reads scored games or selects replacement openings.
The original literal registration is immutable. A collision blocks this sample.
"""
import gzip,hashlib,json,pathlib,sys
ROOT=pathlib.Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT))
from importlib.util import spec_from_file_location,module_from_spec
s=spec_from_file_location('tournament_verify',ROOT/'scripts/phase-a-mac/verify-tournament.py');v=module_from_spec(s);s.loader.exec_module(v)
out=ROOT/'.local-research/phase-a-m4-tournament-v1'
r=v.checked(out/'registration.json');base=pathlib.Path('/Users/rharris/git/reversi/.local-research')
ex=pathlib.Path(r['historicalInventory']['extraction']);seeds=set(v.read(ex/'manifest.json')['seeds']);initial=len(seeds);rows=[]
with gzip.open(ex/'files.jsonl.gz','rt') as f:catalog={x['localPath']:x for x in map(json.loads,f)}
for rel in ('frozen-player-screen-v1-20261029/history-v2/manifest.json','frozen-player-screen-v1-20261029/preflight-final/preflight.json','p-independent-confirmation-v1-20261029/history.json','native-v2-20261030/history.json'):
    path=base/rel;h=v.sha(path);assert h==catalog[str(path)]['sha256'];record=v.read(path);values=set(record.get('seeds',[]));seeds.update(values);rows.append(dict(path=str(path),sha256=h,seeds=len(values)))
seed_collisions=[]
for i in range(r['attempts']):
    a=v.checked(out/'attempts'/f'{i}.json')
    if a['seed'] in seeds:seed_collisions.append(dict(attempt=i,seed=a['seed'],decision=a['decision']))
# No attempt in this registered sample reused a historical seed, so the stronger
# check would make exactly the same admission decisions. Never reroll on failure.
assert not seed_collisions,seed_collisions
new_fixture_seeds={x['seed'] for x in v.checked(out/'fixtures.json')['attempts']}|{x['seed'] for x in v.read(out/'development-test-trajectories.json')}
accepted=[root['seed'] for root in r['literalOpenings']]
assert len(set(accepted))==256 and not set(accepted)&(seeds|new_fixture_seeds)
result=dict(format='phase-a-preplay-seed-registry-supplement-v1',registration=r['checksum'],passed=True,extractionSeeds=initial,fullHistoricalSeeds=len(seeds),additionalArraySeeds=len(seeds)-initial,registries=rows,attemptsChecked=r['attempts'],historicalSeedCollisions=seed_collisions,acceptedSeedsUnique=True,sourceOpeningsAndScheduleUnchanged=True,allOutcomesUnopened=True,sourceSha256=v.sha(__file__))
if (out/'seed-registry-verification.json').exists():
    old=v.checked(out/'seed-registry-verification.json')
    assert all(old[k]==value for k,value in result.items())
else:
    import datetime
    result['at']=datetime.datetime.now(datetime.timezone.utc).isoformat();v.seal(out/'seed-registry-verification.json',result)
print(json.dumps(dict(passed=True,fullHistoricalSeeds=len(seeds),additionalArraySeeds=len(seeds)-initial,attemptsChecked=r['attempts'])))
