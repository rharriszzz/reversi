#!/usr/bin/env python3
"""Publish complete frozen-player evidence; never infer from incomplete pairs."""
import collections
import hashlib
import json
from pathlib import Path
import statistics
import sys

run = Path(sys.argv[1]); root = Path(__file__).resolve().parents[2]
read = lambda p: json.loads(Path(p).read_text())
s = read(run/'summary.json'); state = read(run/'state.json'); launch = read(run/'launch.json')
assert state['status'] == 'complete' and s['integrity']
assert s['counts']['games'] == 384
roots = read(run/'root-rows.json'); games = read(run/'replayed-games.json'); witnesses = read(run/'witnesses.json')
frontier_pairs = read(run/'frontier-pairs.json'); parent_rows = read(run/'frontier-parents.json')
source_rows = read(run/'root-source-rows.json'); frontier_sources = read(run/'frontier-source-rows.json')
base = run.parent; q = read(base/'engineering-final/qualification.json'); h = read(base/'history-v2/manifest.json'); p = read(base/'preflight-final/preflight.json')
monitor = [json.loads(x) for x in (run/'monitor.jsonl').read_text().splitlines() if x]
resources = dict(samples=len(monitor), minimumAvailableGiB=min(x['availableGiB'] for x in monitor),
                 swapInPages=monitor[-1]['swapins']-monitor[0]['swapins'], swapOutPages=monitor[-1]['swapouts']-monitor[0]['swapouts'],
                 maximumNativeSearches=max(x['activeNativeSearches'] for x in monitor),
                 nativeHistogram=dict(collections.Counter(x['activeNativeSearches'] for x in monitor)),
                 configuredWorkers=6, observedSafeCapMinimum=min(x['safeCap'] for x in monitor),
                 scientificNodeMaxRssBytes=state['maxRssBytes'], coordinatorCpu=state.get('cpuTotal',state['cpu']))
task_metrics = [read(p) for p in (run/'tasks').glob('*.json')]
native = [r['result']['native'] for r in task_metrics if r['job']['type']=='label']
resources['nativeCpuSeconds'] = sum(x.get('userSeconds',0)+x.get('systemSeconds',0) for x in native)
resources['nativePeakRssBytes'] = max((x.get('maxRssBytes',0) for x in native), default=0)
resources['completeTaskSeconds'] = sum(r['wallMs']/1000 for r in task_metrics)
resources['taskCounts'] = dict(collections.Counter(r['job']['type'] for r in task_metrics))
costs = {n: {kind: statistics.median(x['ns']/1000 for x in q['static']['rows'] if x['name']==n and x['known']==known)
             for kind,known in [('standaloneUs',False),('knownMobilityUs',True)]} for n in ['B','L','P']}
compact_games = []
for g in games:
    row = {k:g[k] for k in ['family','candidate','color','timeMs','openingId','points','outcome','margin','board','moveTimeMs','receipt']}
    row['moves'] = [{k:m[k] for k in ['player','move','occupied','score','depth','nodes','evaluations','measuredMs','overrunMs','timedOut','exact'] if k in m} for m in g['moves']]
    compact_games.append(row)
compact_roots = [{k:r.get(k) for k in ['source','role','phase','policy','sourceDepth','name','condition','choice','productionChoice','tieDifference','regret','productionRegret','valueKind','rankCorrelation','teacherHorizonRegret','chosenGap10','exact']} for r in roots]
for row, full in zip(compact_roots, roots):
    search = full['search']
    row['productionSearch'] = search.get('production',search)
    if 'full' in search: row['fullWindowAlternatives'] = search['full']['rows']
queries = [{"id":r['job'].get('transcript','').split('/')[-1],"state":r['job']['state'],"depth":r['job']['depth'],"rootDepth":r['result']['rootDepth'],"rows":r['result']['rows']} for r in task_metrics if r['job']['type']=='label']
exact_solutions = [{"state":r['job']['state'],"result":r['result']} for r in task_metrics if r['job']['type']=='exact']
overlap = read(run/'overlap-audit.json')
public_overlap = dict(independence=overlap['independence'],occurrences=overlap['overlaps'],classifications=[dict(key=x['key'],restricted=x['restricted'],unknown=x['unknown'],interpretation=x['interpretation'],roles=dict(collections.Counter(y['role'] for y in x['occurrences']))) for x in overlap['classifications']])
compact = dict(summary=s,teacherQueries=queries,exactSolutions=exact_solutions,overlapAudit=public_overlap,resources=resources,evaluatorCosts=costs,rootRows=compact_roots,rootSourceRows=source_rows,
               frontierSourceRows=frontier_sources,frontierParentRows=parent_rows,witnesses=witnesses,
               terminalPreferenceCases=[x for x in frontier_pairs if x['terminal'] or x['incompatible']],games=compact_games,
               reservation=read(run/'reservations.json'),launch=launch,
               qualification=dict(checksum=q['checksum'],source=q['source'],seconds=q['engineeringWallMs']/1000,validation=q['validation'],native=q['native'],teacher=q['teacher']),
               historical=dict(checksum=h['checksum'],inventorySha256=h['inventorySha256'],keys=h['keys'],digest=h['digest'],occurrences=h['occurrenceCount'],
                               files=h['files'],receipts=h['receipts'],pvs=h['pvs'],trajectories=h['trajectories'],behaviorGames=h['behaviorGames'],corpusHash=h['corpusHash'],
                               missingPilotKeysAdded=h['missingPilotKeysAdded'],errors=h['errors']),
               forecast=p['forecast'],scientificActiveSeconds=state['elapsedMs']/1000,
               rawHashes={name:hashlib.sha256((run/name).read_bytes()).hexdigest() for name in ['summary.json','overlap-audit.json','root-rows.json','frontier-pairs.json','frontier-parents.json','replayed-games.json']})
output = root/'docs/data/frozen-player-screen-20261029.json'; output.write_text(json.dumps(compact,separators=(',',':'))+'\n')
# Standard plotting tools: standalone SVG, with pair-level uncertainty.
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
fig, axes = plt.subplots(1,2,figsize=(10,3.7),layout='constrained')
for i,n in enumerate(['L','P']):
    vals = [s['gameSummary'][str(t)][n]['mean'] for t in [80,300]]
    cis = [s['gameSummary'][str(t)][n]['approximate95'] for t in [80,300]]
    axes[0].errorbar([x+i*.12-.06 for x in [0,1]], vals,yerr=[[v-c[0] for v,c in zip(vals,cis)],[c[1]-v for v,c in zip(vals,cis)]],fmt='o',capsize=4,label=n)
    data = [next(x['meanRegret'] for x in s['rootGroups'] if x['role']=='assessment' and x['condition']==d and x['name']==n and x['phase'] is None) for d in [4,5,6]]
    axes[1].plot([4,5,6],data,'o-',label=n)
b = [next(x['meanRegret'] for x in s['rootGroups'] if x['role']=='assessment' and x['condition']==d and x['name']=='B' and x['phase'] is None) for d in [4,5,6]]
axes[1].plot([4,5,6],b,'o-',label='B',color='gray')
axes[0].axhline(.5,color='gray',ls='--');axes[0].set(xticks=[0,1],xticklabels=['80 ms','300 ms'],ylabel='Candidate game-point score vs B',ylim=(0,1),title='Complete color-swapped pairs; approximate 95% CI')
axes[1].set(xlabel='Fixed placement depth',ylabel='Mean D12 root-choice regret (estimated discs)',xticks=[4,5,6],title='128 source clusters; horizon-limited reference')
for a in axes:a.legend();a.grid(alpha=.2)
fig.savefig(root/'docs/frozen-player-screen-20261029.svg');plt.close(fig)
print(json.dumps({'evidence':str(output),'bytes':output.stat().st_size,'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'activeSeconds':state['elapsedMs']/1000,'gameSummary':s['gameSummary'],'independence':{k:v for k,v in s['independence'].items() if k!='playedPathRestrictedOrUnknown'}}))
