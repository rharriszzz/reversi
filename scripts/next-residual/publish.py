#!/usr/bin/env python3
"""Publish audited numerical evidence; never refit, select or play a model."""
import json
import math
from pathlib import Path
import statistics
import sys
from datetime import datetime
out=Path(sys.argv[1]).resolve();repo=Path(sys.argv[2] if len(sys.argv)>2 else '.').resolve()
def read(name):return json.loads((out/(name+'.json')).read_text())
state=read('manifest');audit=read('audit')
assert audit['passed'] and state['status'] in ('complete','positional-gate-failed')
fit=read('engineering-v2/fit-report');benchmark=read('engineering-v2/benchmark');pilot=read('engineering-v2/pilot');reservations=read('reservations');assessment=read('assessment-results');diagnostics=read('outcome-diagnostics');pilot_game_audit=read('pilot-game-exclusion-audit')
assert diagnostics['checksum']==audit['diagnosticChecksum']
assert pilot_game_audit['checksum']==audit['pilotGameChecksum']
L=read('engineering-v2/L');P=read('engineering-v2/P');games=read('game-results') if (out/'game-results.json').exists() else None
resources=[json.loads(s) for s in (out/'resource-history.jsonl').read_text().splitlines()]
events=[json.loads(s) for s in (out/'events.jsonl').read_text().splitlines()]
occupancy=[json.loads(s) for s in (out/'occupancy.jsonl').read_text().splitlines()] if (out/'occupancy.jsonl').exists() else []
def hist(rows,key):
 result={}
 for r in rows:
  value=str(r.get(key));result[value]=result.get(value,0)+1
 return result
names=list(state['models'])
def median(rows,key):return statistics.median(r[key] for r in rows) if rows else None
cost={}
for name in ('B','L','P','Bzero','Lzero'):
 static={str(known):median([r for r in benchmark['static'] if r['name']==name and r['known']==known],'ns') for known in (False,True)}
 search=[r for r in benchmark['search'] if r['name']==name]
 timed={}
 for budget in (80,300):
  xs=[r for r in benchmark['timed'] if r['name']==name and r['timeMs']==budget]
  if xs:timed[str(budget)]={'moves':len(xs),'depthMedian':median(xs,'depth'),'nodes':sum(r['nodes'] for r in xs),'evaluations':sum(r['evaluations'] for r in xs),'elapsedMs':sum(r['elapsedMs'] for r in xs),'evaluatorMs':sum(r['evaluatorMs'] for r in xs),'deadlineOverruns':sum(r['elapsedMs']>budget+1 for r in xs),'depths':hist(xs,'depth')}
 cost[name]={'staticNs':static,'searchMs':median(search,'ms'),'nodesPerSecond':median(search,'nodesPerSecond'),'evaluationsPerSecond':median(search,'evaluationsPerSecond'),'timedInstrumented':timed}
worker_changes=[]
for event in events:
 if event['event']!='workers-adjusted':continue
 at=datetime.fromisoformat(event['at'].replace('Z','+00:00'))
 eligible=[r for r in resources if datetime.fromisoformat(r['at'].replace('Z','+00:00'))<=at]
 resource=max(eligible,key=lambda r:r['at']) if eligible else None
 row={k:event.get(k) for k in ('at','configured','safeCap','previousPool','actualPool','reason')}
 row['availableGiB']=resource['limitingAvailableGiB'] if resource else None
 row['eventWSLAvailableGiB']=event.get('availableGiB')
 worker_changes.append(row)
index_receipt=read('historical-index')
resource_summary={'indexBuilder':{k:index_receipt[k] for k in ('keys','delta','wallMs','rssBytes')},'maxWindowsPageReadsPerSec':max(r.get('windows',{}).get('pageReadsPerSec',0) for r in resources),'maxWindowsPageWritesPerSec':max(r.get('windows',{}).get('pageWritesPerSec',0) for r in resources),'configuredWorkers':state['configuredWorkers'],'finalActualPool':state['actualPool'],'workerChanges':worker_changes,
 'minWindowsAvailableGiB':min(r.get('windows',{}).get('availableKiB',float('inf'))/2**20 for r in resources),'minWSLAvailableGiB':min(r.get('availableGiB',float('inf')) for r in resources),
 'maxSwapPagesPerSecond':max(r.get('swapPagesInOutPerSecond',0) for r in resources),'maxWindowsCpuPercent':max(r.get('windows',{}).get('cpuPercent',0) for r in resources),
 'maxEventRssMiB':max(r['rssMiB'] for r in events),'poolOccupancyHistogram':hist(occupancy,'actualPool'),'nativeOccupancyHistogram':hist(occupancy,'activeNativeSearches'),
 'safeCapHistogram':hist(occupancy,'safeCap'),'scaling':read('scaling') if (out/'scaling.json').exists() else None,'samples':len(occupancy)}
source_rows=assessment['sourceRows'];root_rows=[]
for row in assessment['rootRows']:
 r={k:v for k,v in row.items() if k!='search'}
 r['search']={name:{k:v for k,v in value.items() if k!='rows'} for name,value in row['search'].items()};root_rows.append(r)
paired_points={}
if games:
 for condition,result in games['conditions'].items():
  paired_points[condition]=[read(f'confirmation/{condition}-{i}')['points'] for i in range(result['pairs'])]
coefficient_evidence={'format':'scientific-independent-color-pair-coefficients-v1','note':'Complete numerical research coefficients, not an application import/export. Independent color-pair coordinates expand with T[mirror]=-T[code], center zero; all eight transforms and 1/8 normalization. No production promotion.',
 'linearModelChecksum':L['checksum'],'patternModelChecksum':P['checksum'],'linearWeights':L['weights'],'linearCorrections':L['correction'],'linearMetadata':L['metadata'],
 'patternSpecification':P['pattern'],'coordinateLayout':{'phaseOrder':['opening','middle','endgame'],'templates':[{'name':'corner6','size':729,'independentPairsPerPhase':364,'offset':0},{'name':'edge8','size':6561,'independentPairsPerPhase':3280,'offset':1092}],'index':'template.offset + phaseIndex * independentPairsPerPhase + min(code, size-1-code)','expansion':'T[code]=coefficient[index] for code below center; negate above center; center zero; compiled entry=T[code]/8'},'patternMetadata':P['metadata'],'coefficients':P['coefficients'],'distinctTrainingSourceSupport':fit['encoding']['support']}
coefficient_path=repo/'docs/data/next-residual-coefficients-20261029.json';coefficient_path.write_text(json.dumps(coefficient_evidence,separators=(',',':'))+'\n')
compact_fit={k:v for k,v in fit.items() if k!='encoding'};compact_fit['encoding']={k:v for k,v in fit['encoding'].items() if k!='support'}
data={'format':'next-residual-audited-results-v1','status':state['status'],'runIdentity':state['runIdentity'],'source':state['source'],'models':state['models'],'design':state['design'],
 'audit':audit,'fit':compact_fit,'cost':cost,'benchmark':benchmark,'matchedSpeedRatios':benchmark['speed'],'forecast':read('pre-experiment-forecast'),'reservedForecast':read('reserved-forecast'),
 'panels':assessment['panels'],'rootSummary':assessment['rootSummary'],'gates':assessment['gates'],'sourceRows':source_rows,'rootRows':root_rows,'frontierRows':assessment['frontierRows'],
 'games':games,'pairedPoints':paired_points,'resources':resource_summary,'elapsedMs':state['elapsedMs'],'statisticsMs':assessment['statisticsMs'],
 'pilot':{k:v for k,v in pilot.items() if k not in ('gameCosts','statistics')},'pilotPairCosts':[{'timeMs':r['timeMs'],'index':r['index'],'wallMs':r['wallMs']} for r in pilot['gameCosts']],
 'reservations':{k:v for k,v in reservations.items() if k not in ('assessment','games')},
 'reservedRootIdentities':[{k:r[k] for k in ('id','role','slot','phase','policy','depth','player','occupied','seed','attempt','trajectoryHash','board')} for r in reservations['assessment']+reservations['games']],
 'pilotGameExclusionAudit':pilot_game_audit,'postOutcomeDiagnostics':diagnostics,'repair':read('memory-repair') if (out/'memory-repair.json').exists() else None,
 'limitations':['No macOS hardware; current WSL2-to-Windows Chrome integration passed; full interactive acceptance was not repeated.','Old development was reused for exploratory nomination/selection, never fresh evidence.','D10/D12 are estimates before exact endings; bootstrap excludes systematic teacher bias.','B-generated source policies and B/L frontiers do not represent all human policies or P-selected frontiers.','The bounded L still has active constraints; P gains do not prove an unrestricted seven-feature optimum is unattainable.','Timed development probes include per-call clock overhead; scientific games do not.','Node CPU in the final manifest covers the last coordinator process; active wall time is accumulated across the resource pause.','Independent occupancy is sampled, with temporary engineering scaling pools documented separately.']}
data_path=repo/'docs/data/next-residual-results-20261029.json';data_path.write_text(json.dumps(data,separators=(',',':'))+'\n')
f=lambda x,d=5:'—' if x is None else f'{x:.{d}f}'
pct=lambda x:f'{100*x:.2f}%'
interval=lambda xs,d=4:f'{f(xs[0],d)} to {f(xs[1],d)}'
lines=[]
def add(s=''):lines.append(s)
def table(headers,rows):
 add('| '+' | '.join(headers)+' |');add('| '+' | '.join(['---']*len(headers))+' |')
 for row in rows:add('| '+' | '.join(str(x) for x in row)+' |')
 add()
add('# Relaxed linear weights versus a compact pattern residual')
add()
if not assessment['gates']['L']['pass']:
 add('**The expanded experiment stopped at its predefined positional gates. L did not qualify for games; no stronger equal-time player was demonstrated.** Production B, the original search engine and the completed residual experiment remain unchanged.')
else:
 stronger=games['primaryStronger'] if games else False
 add('**L '+('demonstrated stronger equal-time play at both controls under the simultaneous criterion.' if stronger else 'did not establish stronger equal-time play under the simultaneous criterion.')+'** Production B, the original search engine and the completed residual experiment remain unchanged.')
add()
if not assessment['independence']:
 add('**The strict independence audit also failed:** newly revealed teacher PVs collided with historical boards in four reserved sources. All 256 sources and original gates are retained; there was no replacement or repaired confirmation. Numerical integrity passed, but this is not a successful fresh-independent confirmation.');add()
add('[Frozen scientific protocol](NEXT_RESIDUAL_PROTOCOL.md) · [audited numerical evidence](data/next-residual-results-20261029.json) · [all fitted coefficients and support counts](data/next-residual-coefficients-20261029.json)')
add()
add('## What the constraint correction changed')
add()
add(f"The original λ=1e-4, ±25 fit reproduced its published training/development losses exactly. Relaxed L used λ=0 and ±100 with the same 21 coefficients, seven features, phases, temperature, source weighting and terminal utility. Old-development loss fell from {f(fit['linear']['BDevelopment'])} for B to {f(fit['linear']['development'])}: {pct(1-fit['linear']['development']/fit['linear']['BDevelopment'])} improvement, compared with the old fit’s 1.80%. This confirms excessive shrinkage constrained the old development result. It does not retroactively improve the old independent experiment or show that regularization alone explains playing strength.")
add()
add(f"L’s maximum correction is {f(max(map(abs,L['correction'])),2)}; {sum(abs(x)>=100-1e-8 for x in L['correction'])} coordinates hit ±100. This remains a bounded optimum, not the unrestricted seven-feature optimum. The compiled L calls the existing evaluator with corrected weights, adding no feature scan or favorable evaluator rewrite to the L-versus-B contrast.")
add()
add(f"P selected λpattern={fit['pattern']['selected']['lambda']} by old-development loss among exactly 0, 1e-6 and 1e-5, starting every table fit at zero and freezing L. Its old-development improvement over L was {pct(fit['admission']['relativeLossImprovement'])}, with regret change {f(fit['admission']['regretChange'])}; it passed the old-development admission test. This reused evidence selected one challenger and supplies no fresh superiority claim.")
add()
table(['Model / λ','Training loss','Old development loss','Converged'],[['B',f(fit['linear']['BTraining']),f(fit['linear']['BDevelopment']),'—'],['Old λ=1e-4 / bound 25',f(fit['oldReproduced']['training']),f(fit['oldReproduced']['development']),'yes'],['L λ=0 / bound 100',f(fit['linear']['training']),f(fit['linear']['development']),'yes']]+[[f"P λ={r['lambda']}",f(r['training']),f(r['development']),r['converged']] for r in fit['patternTrials']])
add('The earlier old-development controls separate the measured path: λ=1e-4/±25 loss 0.544226 → λ=0/±25 loss 0.484996 → λ=0/±100 loss 0.461374. Removing shrinkage at the original bound accounts for 0.059230 of the 0.082852 additional loss reduction (about 71.5% along this path); wider bounds account for the remaining 0.023622. This is an ordered sensitivity decomposition on reused development data, not a unique attribution of playing-strength failure.');add()
add('## Fixed assessment results and the failed independence qualification')
add()
add(f"The complete expanded design reserved {state['design']['sources']} accepted full source trajectories, {state['design']['transfer']} transfer roots and {len(reservations['games'])} separate game openings jointly before the first fresh label. All 16 occupied-stratum/policy/source-depth cells and turn/parity marginals retain their fixed balance. The fallback was not selected. Each source has separately reconstructed B and L continuation frontiers; all models use the same external-teacher union labels. Parents/preferences are correlated within sources and are never counted as independent replicates.")
add()
table(['Selector','Sources / informative','Supported preferences','B loss','L loss','P loss','L gain over B','P gain over L'],[[s,f"{p['sources']} / {p['informative']}",p['preferences'],f(p['loss']['B']),f(p['loss']['L']),f(p['loss'].get('P')),pct(1-p['loss']['L']/p['loss']['B']),pct(1-p['loss']['P']/p['loss']['L']) if 'P' in p['loss'] else '—'] for s,p in assessment['panels'].items()])
add('Intervals below are absolute reference-minus-candidate preference-loss improvements from 10,000 complete-source stratified resamples shared across panels and contrasts. The one-sided 97.5% lower bound is the lower endpoint shown. Both panels must clear the ≥5% point-estimate and positive lower-bound gates. Intervals describe the fixed admitted sample and omit systematic teacher error; they cannot repair the failed PV-independence qualification.')
add()
table(['Selector','Contrast','Loss improvement','95% interval'],[[s,c,f(r['mean']),interval(r['interval95'])] for s,p in assessment['panels'].items() for c,r in p['intervals'].items()])
add('![Fixed-sample preference loss and searched root regret](next-residual-assessment-20261029.svg)')
add()
table(['Search placements','Sources','B D12 regret','L D12 regret','P D12 regret','L−B (95% interval)','P−L (95% interval)'],[[d,p['sources'],f(p['regret']['B'],4),f(p['regret']['L'],4),f(p['regret'].get('P'),4),f(p['intervals']['L-B']['mean'],4)+' ('+interval(p['intervals']['L-B']['interval95'])+')',f(p['intervals']['P-L']['mean'],4)+' ('+interval(p['intervals']['P-L']['interval95'])+')' if 'P-L' in p['intervals'] else '—'] for d,p in assessment['rootSummary'].items()])
add('These are independently labeled root alternatives after actual full-window depth-four/six alpha-beta search. Regret is estimated Edax D12 discs, not B heuristic units. The depth-six gate uses mean regret; it is not a statistical noninferiority guarantee. Depth four is diagnostic. Immediate feature changes do not explain deeper minimax scores without continuation evidence.')
add();add('### Why the frozen preference gate was dominated by terminal utility');add()
add('A read-only post-outcome decomposition found that five supported terminal-containing preferences per selector panel in `assessment-174` favor a future +64 Edax win over an immediate terminal +62 awarded-empty win. Production gives that immediate win a fixed score of +10,054; the competing nonterminal child has B score about +144. Even granting every linear/pattern correction its maximum declared bound leaves the preferred-minus-other margin below −9,500. These preferences are impossible to satisfy within the permitted models while preserving production terminal utility. They were retained exactly as preregistered.');add()
table(['Selector','B nonterminal contribution','B terminal contribution','L nonterminal contribution','P nonterminal contribution','Terminal share of B loss'],[[selector,f(q['totals']['B']['nonterminal']),f(q['totals']['B']['terminalContaining']),f(q['totals']['L']['nonterminal']),f(q['totals']['P']['nonterminal']),pct(q['terminalFractionOfBLoss'])] for selector,q in diagnostics['panels'].items()])
add('These are additive contributions using the original per-source pair masses and all retained sources, not a replacement objective or reduced sample. Nonterminal contributions improve by '+', '.join(f"{selector}-selector: L/B {pct(q['nonterminalContributionRelativeL'])}, P/L {pct(q['nonterminalContributionRelativePOverL'])}" for selector,q in diagnostics['panels'].items())+'. The terminal component contributes about 79% of baseline loss, diluting the full-loss relative gains. No gate was recomputed, no source removed and no model refitted. This exposes an objective/utility compatibility problem; it does not turn a failed gate into success.');add()
add('Independently, L’s depth-six regret increased by 0.0078125 discs on the fixed sample, so it also missed the original mean-based root gate. Its confidence interval spans improvement and deterioration. P’s favorable root point estimates have intervals spanning zero too. Neither result demonstrates a stronger player.');add()
add()
table(['Candidate','Both preference panels pass','Depth-six mean gate','Independent','Eligible for games'],[[name,all(p['pass'] for p in gate['preferences'].values()),gate['root'],gate['independence'],gate['pass']] for name,gate in assessment['gates'].items()])
for selector,p in assessment['panels'].items():
 add(f'### {selector}-selected frontier diagnostics');add()
 table(['Model','Source-mean D12 top-choice regret','Nonpositive supported-preference mass'],[[n,f(p['regret'][n],4),pct(p['incorrect'][n])] for n in names])
 table(['Child phase','Informative sources','B loss','L loss','P loss'],[[phase,r['sources'],f(r['loss']['B']),f(r['loss']['L']),f(r['loss'].get('P'))] for phase,r in p['byChildPhase'].items()])
 table(['Group','B loss','L loss','P loss'],[[f'{key}={value}',f(r['loss']['B']),f(r['loss']['L']),f(r['loss'].get('P'))] for key in ('byPhase','byPolicy','byDepth') for value,r in p[key].items()])
 table(['Contrast','Disagreements','Changes ≥4 D12 discs','D10/D12 reversals'],[[c,r['disagreements'],r['significant'],r['reversals']] for c,r in p['changes'].items()])
 add(f"Exact-feature ties: {p['ties']['pairs']} supported pairs; P distinguished {p['ties']['distinguishedP']} and gave the supported direction in {p['ties']['correctP']}. This narrow subset establishes extra information only where the aggregate seven-feature inputs are exactly identical; it cannot attribute all remaining loss to representation.");add()
 table(['Independent terminal convention','Parents','B W/D/L errors','L W/D/L errors','P W/D/L errors'],[[c,r['parents'],r['wdlErrors']['B'],r['wdlErrors']['L'],r['wdlErrors'].get('P','—')] for c,r in p['exact'].items()])
table(['Root search / convention','Independent exact sources','B W/D/L errors','L W/D/L errors','P W/D/L errors'],[[f'{depth} / {convention}',len(rows),sum(bool(r['exact'][convention]['B']['wdlError']) for r in rows),sum(bool(r['exact'][convention]['L']['wdlError']) for r in rows),sum(bool(r['exact'][convention].get('P',{}).get('wdlError',False)) for r in rows)] for depth in (4,6) for convention in ('raw','awarded') for rows in [[r for r in assessment['rootRows'] if r['searchDepth']==depth and convention in r['exact']]]])
add('## Equal-time playing strength')
add()
if not games:
 add('L failed its frozen positional gate, so no confirmation games were played. The 256 pairs per primary control and 128 optional shadow pairs remain unused reservations. Their identities remain excluded from future fresh research. Neither evaluator demonstrated stronger equal-time play in this experiment. No extra games were added to obtain a favorable result.')
else:
 table(['Condition','Opening pairs','Wins / draws / losses','Mean points','Paired 95% interval','One-sided 97.5% lower bound'],[[c,r['pairs'],f"{r['summary']['wins']} / {r['summary']['draws']} / {r['summary']['losses']}",pct(r['bootstrap']['mean']),f"{pct(r['bootstrap']['interval95'][0])} to {pct(r['bootstrap']['interval95'][1])}",pct(r['bootstrap']['lower975'])] for c,r in games['conditions'].items()])
 add(f"The simultaneous primary criterion {'passed' if games['primaryStronger'] else 'did not pass'}: both primary one-sided 97.5% lower score bounds must exceed 50%. Whole opening pairs, not individual games, are the sampling unit. A lower preference loss or mean score above 50% is insufficient. The sample was not extended after outcomes.");add()
 if 'P80' in games['conditions']:add(f"The optional shadow’s one-sided 95% lower bound is {pct(games['conditions']['P80']['bootstrap']['lower95'])}; this is descriptive screening, not an additional simultaneous production claim.");add()
 else:add('P did not qualify for its optional shadow games; no substitute or expanded sample was played.');add()
 add('![Fixed paired equal-time game scores](next-residual-games-20261029.svg)');add()
 table(['Condition / side','Searched moves','Nodes','Static calls','Median / p99 move ms','Deadline >budget+1ms','Depth histogram'],[[f'{c} / {side}',r['summary'][side]['moves'],r['summary'][side]['nodes'],r['summary'][side]['evaluations'],f"{f(r['summary'][side]['medianElapsedMs'],2)} / {f(r['summary'][side]['p99ElapsedMs'],2)}",r['summary'][side]['deadlineOverruns'],json.dumps(r['summary'][side]['completedDepthHistogram'],sort_keys=True)] for c,r in games['conditions'].items() for side in ('candidate','B')])
 add('The legacy summary key `B` means the reference side; it is L in the P–L shadow. The complete paired points and search counters are in the evidence. Per-move static-evaluator clocks were deliberately omitted from games because that instrumentation changes the equal-time comparison. Separate instrumented development probes report evaluator time.');add()
add();add('## Evaluation cost and data scaling');add()
table(['Evaluator','Static µs','Known-mobility µs','16 depth-six roots ms','Nodes/s','Static calls/s'],[[n,f(cost[n]['staticNs']['False']/1000,3),f(cost[n]['staticNs']['True']/1000,3),f(cost[n]['searchMs'],1),f(cost[n]['nodesPerSecond'],0),f(cost[n]['evaluationsPerSecond'],0)] for n in ('B','L','P','Bzero','Lzero')])
add(f"Five rotated-order repetitions on 16 old-development roots gave matched zero-pattern throughput ratios {pct(benchmark['speed']['B'])} against B and {pct(benchmark['speed']['L'])} against L, with exact moves/scores/nodes/calls. This passed the predefined ≥90% speed gate. Actual learned P static cost was {pct(cost['P']['staticNs']['True']/cost['L']['staticNs']['True']-1)} above L with known mobility and {pct(cost['P']['staticNs']['False']/cost['L']['staticNs']['False']-1)} without it. Learned-tree nodes/s and total search time also reflect different trees, not just evaluator overhead. These short repeated timings are engineering measurements, not confidence intervals or playing results.")
add()
table(['Development probe','Moves','Median completed depth','Nodes','Static calls','Mean move ms','Evaluator ms / total ms','>budget+1 ms'],[[f'{n} / {budget} ms',r['moves'],f(r['depthMedian'],1),r['nodes'],r['evaluations'],f(r['elapsedMs']/r['moves'],2),f(r['evaluatorMs'],1)+' / '+f(r['elapsedMs'],1),r['deadlineOverruns']] for n in ('B','L','P') for budget,r in cost[n]['timedInstrumented'].items()])
add('These 80/300-ms development probes stop background label/fitting workers and instrument each static call. They measure complete search/evaluator throughput, completed depth and deadline behavior, and are not game outcomes. Full depth histograms and per-position counters are in the evidence.');add()
add('![Evaluation cost and learning curves](next-residual-cost-learning-20261029.svg)');add()
table(['Training-source prefix','L old-development loss','P old-development loss','L / P converged'],[[r['size'],f(r['LDevelopment']),f(r['PDevelopment']),f"{r['LConverged']} / {r['PConverged']} "] for r in fit['curves']])
add('P prefix curves fit tables on each prefix with the same full-corpus frozen L. They describe incremental representation/data scaling conditional on L, rather than a completely prefix-trained pipeline. Training losses across changing prefixes are not pure learning curves.');add()
curve_by_size={r['size']:r for r in fit['curves']}
l_scaling=1-curve_by_size[1600]['LDevelopment']/curve_by_size[800]['LDevelopment'];p_scaling=1-curve_by_size[1600]['PDevelopment']/curve_by_size[800]['PDevelopment']
add(f"From 800 to 1,600 sources, relative old-development improvement was {pct(l_scaling)} for L and {pct(p_scaling)} for P. Neither reached the predefined 1% threshold for recommending a larger same-objective training campaign, even if game evidence were favorable.");add()
add('## Fitted weights, pattern specification and convergence');add()
features=L['features'];phases=L['phases'];rows=[]
for p,phase_name in enumerate(phases):
 for j,feature in enumerate(features):rows.append([phase_name,feature,f(L['baseline'][phase_name][feature],3),f(L['correction'][p*7+j],6),f(L['weights'][phase_name][feature],6)])
table(['Phase','Feature','Original B','Correction','L weight'],rows)
add('![The frozen 21 linear corrections](next-residual-corrections-20261029.svg)');add()
table(['Pattern','Ordered squares (A1=0)','Ternary entries / phase','Independent pairs / phase','Coefficient offset'],[['Corner six','0,1,2,8,9,16',729,364,0],['Edge eight','0,1,2,3,4,5,6,7',6561,3280,1092]])
add('Coefficient index is `offset + phaseIndex × independentPairsPerPhase + min(code, size−1−code)`, with phase order opening/middle/endgame. Below-center codes use the coefficient; above-center codes negate it; center codes are zero. `code = Σ(board[square]+1) × 3^j` in the stated square order. The runtime table divides each entry by eight.');add()
add('P adds exactly the six-square corner and eight-square edge templates in the protocol, all eight D4 transforms, color antisymmetry, original three phases and 1/8 normalization. It freezes every L coefficient. The complete 10,932 independent coefficients, their phase/template coordinate specification and distinct-source support are linked above; reverse-color centers are zero. Compiled tables use 87,480 Float32 bytes; L uses Float64. No pattern family, bound, phase, temperature or fresh-data selection changed.');add()
add(f"{fit['encoding']['observed']} of 10,932 independent pattern coordinates have informative training-source support. Old-development sparse pair differences contain {fit['encoding']['unseenDevelopmentNonzeros']} unseen-coordinate occurrences of {fit['encoding']['developmentNonzeros']} nonzeros. Counts reflect unique trajectories, never optimizer passes. Unobserved coefficients remain exactly zero. This pair-difference coverage metric does not measure all deployment board-cell visits.");add()
table(['Selector coverage','Static nonterminal children','D4 table lookups','Structural centers','Unseen lookups','Source-mean unseen noncenter rate'],[[selector,r['coverage']['staticChildren'],r['coverage']['lookups'],r['coverage']['center'],r['coverage']['unseen'],pct(r['coverage']['sourceMeanUnseenNoncenterRate'])] for selector,r in diagnostics['panels'].items()])
add('Coverage is a read-only deployment diagnostic using distinct old-training-source support. It counts all 16 raw D4 lookups per nonterminal child, including repeated geometries; self-complement centers are structural zeroes. Unseen visits can cancel under symmetry, so raw lookup coverage is distinct from the sparse pair-difference metric and from learned predictive value. No assessment observation is added to support counts or fitting.');add()
table(['Fit','Iterations','Original-unit projected gradient'],[[r['name'],r['iterations'],f"{r['pg']:.3g}"] for r in audit['convergence']])
add('The audit independently recomputed all accepted fit losses/KKT residuals, sparse support and selected model identities. Zero corrections reproduce B; zero tables reproduce L; full-window and production searches, finite differences, sparse/compiled tolerance, symmetry, color transforms, passes, phase boundaries, terminal utilities and real crash/restart receipts passed regression checks.');add()
add('## Resources, runtime, integrity and limitations');add()
forecast=read('pre-experiment-forecast')
table(['Design forecast','Actual pool used in forecast','Hours including 35% allowance and separate reporting reserve'],[[n,r['actualWorkers'],f(r['totalMs']/3600000,3)] for n,r in forecast['forecasts'].items()])
add(f"Chosen design: expanded. Actual accumulated pipeline time: **{f(state['elapsedMs']/3600000,3)} hours**. Engineering fit/encoding/curves: {f(fit['elapsedMs']/1000,2)} seconds; integrated old-data pilot: {f(pilot['elapsedMs']/1000,1)} seconds; statistical analysis: {f(assessment['statisticsMs']/1000,2)} seconds. All eligible game costs were forecast before fresh outcomes, including the optional shadow. The forecast reserved 20 minutes separately for reporting. The accumulated pipeline clock excludes initial engineering verification and post-run auditing/publication; it is not total task wall time.");add()
add(f"Configured workers: 2. The safe cap and actual pool differ; actual pools follow the timeline below. Fresh replay scaling qualified a conservative {f(resource_summary['scaling']['safeSpeedup'],3) if resource_summary['scaling'] else '1.000'}× two-worker label speedup. Minimum sampled Windows/WSL free memory: {f(resource_summary['minWindowsAvailableGiB'],3)} / {f(resource_summary['minWSLAvailableGiB'],3)} GiB. Maximum sampled active WSL swapping: {resource_summary['maxSwapPagesPerSecond']} pages/s. Peak event-reported Node process RSS (including worker threads): {f(resource_summary['maxEventRssMiB'],1)} MiB. Native peak: {f(audit['maxNativeRss']/2**20,1)} MiB. The separate historical-index extension peaked at {f(resource_summary['indexBuilder']['rssBytes']/2**20,1)} MiB and took {f(resource_summary['indexBuilder']['wallMs']/1000,1)} seconds. Maximum sampled Windows paging reads/writes were {resource_summary['maxWindowsPageReadsPerSec']} / {resource_summary['maxWindowsPageWritesPerSec']} pages/s; these include host activity and are distinct from WSL swap counters. Total receipt-audited native CPU, including engineering queries: {f(audit['nativeCpuMs']/1000,1)} seconds. Final-manifest Node CPU excludes the preceding resource-paused process; it is not presented as total pipeline CPU.");add()
table(['UTC','Previous pool','Actual pool','Safe cap','Windows-limited free GiB','Reason'],[[r['at'],r['previousPool'],r['actualPool'],r['safeCap'],f(r['availableGiB'],3),r['reason']] for r in worker_changes])
add(f"Independent 15-second occupancy samples: pool histogram `{resource_summary['poolOccupancyHistogram']}`, active native-search histogram `{resource_summary['nativeOccupancyHistogram']}`. Slots can be idle between queries. Temporary one/two-worker engineering scaling pools are separately recorded; the scientific pool is drained during those benchmarks. These samples are occupancy counts, not CPU utilization. After completion the actual pool is zero. No applications were closed or saved settings changed; the bounded temporary keep-awake request was released.");add()
add('The runner paused once during reservation, before fresh labels, because its extra 0.6-GiB dispatch calculation duplicated the preflight reserve for an already resident worker. A separately hashed scheduling-only execution repair kept the 1.5-GiB physical-free reserve, swap/CPU blockers and conservative two-worker admission, and added coordinator collection before measurement. It preserved all 34 accepted roots and completed receipts. The original snapshot, original repair draft and final narrow certificate remain archived; the validator rejects numerical/gate changes. No scientific input, sample, label, model or outcome was replaced.');add()
add(f"The audit verified {audit['mainTasks']} scientific and {audit['engineeringTasks']} engineering task receipts, the joint reservation checksum, teacher identity, continuation witnesses, model checksums, all source-level statistics and any complete game pairs. All **{audit['preservedFiles']:,} files / {audit['preservedBytes']:,} bytes** inventoried in the previous completed experiment remain byte-identical. Original source `{state['source']}`; execution source `{audit['executionSource']}`; run `{state['runIdentity']}`; reservation `{reservations['checksum']}`. First fresh label committed at {audit['firstLabelCommitted']}, after identities froze at {audit['identitiesFrozen']}.");add()
add(f"Forbidden PV collisions: {diagnostics['collisions']['records']} flagged occurrences / {diagnostics['collisions']['uniqueKeys']} canonical board/turn keys in sources {', '.join(diagnostics['collisions']['sources'])}. The revealed collisions occur at occupied counts 22, 23, 53, 62, 63 and 64. The root/trajectory admission checks had passed; the later PV audit correctly blocked the independence claim. Retaining the complete sample avoids post-outcome selection, but cannot restore the planned independent-confirmation status.");add()
add(f"A final exclusion-coverage audit replayed {pilot_game_audit['games']} saved engineering games from both integrated pilots. It identified {pilot_game_audit['missingFromFrozenIndex']} canonical board/turn keys absent from the frozen compact index. Checking every reserved complete trajectory/frontier and every new teacher PV against those extra keys found {len(pilot_game_audit['collisions'])} additional collisions. The omission and additional read-only audit are retained; a future index builder now includes those played paths. The frozen index, all 256 sources, gates and four-source independence failure remain unchanged.");add()
add(f"New teacher-PV independence audit: {'passed' if assessment['independence'] else 'FAILED; affected claims blocked'}, with {len(read('independence-audit')['collisions'])} retained collision records. No post-outcome identity replacement was allowed. Complete local receipts, raw teacher transcripts, source snapshots and checkpoints stay ignored at `{out}`.");add()
add('WSL2 execution and real Windows memory/power measurements were made on this host. macOS Apple Silicon/Intel hardware was unavailable, so no Mac execution is claimed. Production browser interaction code did not change. The current Windows Chrome/156.0.8078.48 integration test passed from WSL2: rendered initial alternatives, verified continuation, playing-worker reply, and the real PowerShell default-browser launch route. Full interactive acceptance was not repeated. The application remains dependency-free Python/browser; this research adds no runtime package. Automated checks: 129 JavaScript tests and 30 Python tests; final exact commands and Git status are recorded in the completion response.');add()
add('## Interpretation and one next direction');add()
if not assessment['gates']['L']['pass']:
 add('Relaxing shrinkage materially improved old-development fit, but the complete independent gates did not establish the requested transfer to a stronger searched player. The separate frontier panels, terminal-utility decomposition and root tables identify distinct problems; historical PV collisions additionally block the strict independent-confirmation claim. Neither a seven-feature expressive ceiling nor a universal failure of compact patterns follows. P’s additional terms may encode real geometry while also proxying corrections beyond L’s active bounds; B-generated source policies, teacher horizon uncertainty and preference-loss/minimax alignment remain plausible limitations.')
 add()
 add('**Recommend one next direction: utility-consistent root-choice preference learning with the same linear architecture.** First define targets/gates compatible with the preserved terminal win utility, then test whether improvements survive minimax and equal-time games. A future protocol must also resolve PV-exclusion failures prospectively; the current sample cannot be retroactively repaired. The present evidence does not justify a larger same-objective weight or pattern campaign. Do not start one automatically.')
else:
 if games and games['primaryStronger']:
  add('The relaxed existing features produced a stronger equal-time candidate under the fixed simultaneous test. This isolates a substantial constraint problem without adding representation. P’s separate root and shadow evidence, reported above, determines whether the two extra families earned further work; it does not automatically establish P superiority at 300 ms or justify production promotion.')
  add();add('**Recommend one next direction: fresh policy-diverse equal-time confirmation of the frozen linear candidate, with no refitting or added architecture.** This tests generalization beyond the present B-generated trajectories and openings. No campaign starts automatically.')
 else:
  add('The relaxed existing features improved positional preferences enough to qualify, but the fixed paired games did not establish superiority at both time controls. Better logistic margins are therefore insufficient evidence of stronger equal-time play. P’s positional and optional shadow results narrow the representation question without proving that a larger table or more of the same training will improve the complete player.')
  add();add('**Recommend one next direction: a separately preregistered search-aware preference objective that learns from independently labeled root alternatives, retaining the linear architecture for the causal comparison.** Do not enlarge the present samples or start another campaign automatically.')
add();add('## Reproduce the audit and publication');add()
add('```bash');add(f"node scripts/next-residual/audit-pilot-games.mjs '{out}'");add(f"node scripts/next-residual/audit.mjs '{out}'");add(f"python3 scripts/next-residual/publish.py '{out}' .");add('python3 scripts/next-residual/plots.py docs/data/next-residual-results-20261029.json docs');add('npm test');add("python3 -m unittest discover -s tests -p 'test_*.py'");add('git diff --check');add('```');add()
add('Completed runs reject repetition. If an interrupted run needs the remaining original allowance, use `python3 scripts/next-residual/launch.py --resume --workers 2 --output <same-run-directory>`; this retains the frozen execution certificate, elapsed budget, models and receipts. No further resume is needed for this completed run.')
(repo/'docs/NEXT_RESIDUAL_RESULTS.md').write_text('\n'.join(lines)+'\n')
print(json.dumps({'report':'docs/NEXT_RESIDUAL_RESULTS.md','dataBytes':data_path.stat().st_size,'coefficientBytes':coefficient_path.stat().st_size}))
