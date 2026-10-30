#!/usr/bin/env python3
"""Publish the already audited fixed experiment, without selecting data or models."""
import json, pathlib, sys, subprocess, statistics, datetime
ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=ROOT/(sys.argv[2] if len(sys.argv)>2 else '.local-research/p-independent-confirmation-v1-20261029')
def read(p): return json.loads((OUT/p).read_text())
mode=sys.argv[1]
if mode=='register':
    launch=read('launch.json'); r=read('reservation.json'); q=read('qualification/report.json'); f=read('forecast.json'); h=read('history.json')
    # JS canonical hash, not Python's differently formatted float serialization.
    body=dict(format='p-confirmation-prospective-registration-v1',launchChecksum=launch['checksum'],launch=launch,reservation=r,forecast=f,history={k:h[k] for k in ['checksum','baseManifest','baseDigest','engineeringDigest','addedDigest','knownDirectDigest','addedKeys','knownDirectKeys','trainingSources']},qualification={k:q[k] for k in ['checksum','source','models','search','staticCost','gameCosts','wallMs','passed']})
    path=ROOT/'docs/data/p-confirmation-registration-20261029.json'
    raw=json.dumps(body,separators=(',',':'))
    result=subprocess.check_output(['node','--input-type=module','-e',"import {hash} from './scripts/p-confirmation/protocol.mjs';import {readFileSync} from 'node:fs';const b=JSON.parse(readFileSync(0,'utf8'));console.log(JSON.stringify({...b,checksum:hash(b)}));"],input=raw,text=True,cwd=ROOT)
    if path.exists(): assert json.loads(path.read_text())==json.loads(result)
    else: path.write_text(result)
    print('Published prospective registration',launch['checksum']); sys.exit()
if mode=='figure':
    import matplotlib; matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    s=read('summary.json');fig,axes=plt.subplots(1,2,figsize=(9.6,3.8),layout='constrained')
    for i,b in enumerate(['80','300']):
        d=s['statistics']['scores'][b];lo,hi=d['approximate95']; axes[0].errorbar(i,d['mean']*100,yerr=[[100*(d['mean']-lo)],[100*(hi-d['mean'])]],fmt='o',capsize=5,color='#225b99');axes[0].scatter(i+.12,d['conservativeOneSided975Lower']*100,marker='v',color='#b86022')
    axes[0].axhline(50,color='gray',ls='--');axes[0].set(xticks=[0,1],xticklabels=['80 ms / 768 pairs','300 ms / 256 pairs'],ylabel='P game points (%)',title='Independent color-paired confirmation')
    axes[0].text(.02,.02,'Bars: approximate paired 95% intervals\nTriangles: 97.5% Hoeffding lower bounds',transform=axes[0].transAxes,fontsize=8)
    d=s['statistics']['difference'];lo,hi=d['interval95'];axes[1].errorbar(0,100*d['mean'],yerr=[[100*(d['mean']-lo)],[100*(hi-d['mean'])]],fmt='o',capsize=5,color='#225b99');axes[1].axhline(0,color='gray',ls='--');axes[1].set(xticks=[0],xticklabels=['Same 256 families'],ylabel='300 ms minus 80 ms (percentage points)',title='Matched budget difference (descriptive)')
    fig.savefig(ROOT/'docs/p-confirmation-20261029.svg');plt.close(fig);sys.exit()
assert mode=='results'
s=read('summary.json'); verification=read('independent-verification.json');assert verification['passed']; registration=json.loads((ROOT/'docs/data/p-confirmation-registration-20261029.json').read_text());q=read('qualification/report.json');f=read('forecast.json');state=read('state.json');p=read('provenance-audit.json')
evidence=dict(summary=s,verification=verification,provenance={k:p[k] for k in ['checksum','launch','sourceDisjoint','independentClaim','violations','classifications','historicalOccurrenceRows','wallMs']},execution=read('completion.json'))
(ROOT/'docs/data/p-confirmation-results-20261029.json').write_text(json.dumps(evidence,separators=(',',':'))+'\n')
def pct(x): return f'{100*x:.2f}%'
def interval(xs,scale=100): return f'{scale*xs[0]:.2f} to {scale*xs[1]:.2f}'
lines=['# Independent confirmation of frozen P','',s['decision']+'. **B remains production; no automatic promotion.**','',
'[Prospective protocol](P_CONFIRMATION_PROTOCOL.md) · [registration and frozen sample](data/p-confirmation-registration-20261029.json) · [compact numerical evidence and independent audit](data/p-confirmation-results-20261029.json). All 2,048 games completed, using 768 newly reserved families at 80 ms and the fixed nested 256 at 300 ms. Each statistical observation is a complete color-swapped pair.','',
'| Budget | Pairs | W–D–L | P points | Effect above 50% | One-sided p | 97.5% t lower | Bootstrap 95% sensitivity | Hoeffding 97.5% lower | Mean disc margin |',
'| --- | ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |']
for b in ['80','300']:
    d=s['statistics']['scores'][b];o=s['outcomes'][b];bs=s['statistics']['sensitivity'][b];lines.append(f"| {b} ms | {d['n']} | {o['wins']}–{o['draws']}–{o['losses']} | {pct(d['mean'])} | {100*d['effect']:+.2f} pp | {d['approximateOneSidedP']:.6g} | {pct(d['approximateOneSided975Lower'])} | {interval(bs['interval95'])}% | {pct(d['conservativeOneSided975Lower'])} | {o['discMargins']['mean']:+.3f} |")
st=s['statistics'];d=st['difference'];lines+=['',f"The predeclared 80 ms primary {'passes' if st['scores']['80']['approximateOneSided975Lower']>.5 else 'does not pass'} its one-sided α=.025 conventional test. The separate 300 ms durability test {'passes' if st['scores']['300']['approximateOneSided975Lower']>.5 else 'does not pass'}. Bonferroni protects simultaneous two-budget claims at familywise .05 despite the shared openings. Conventional two-budget evidence: **{st['conventional']}**; bootstrap support at both: **{st['bootstrapSupport']}**; both conservative distribution-free bounds positive: **{st['bounded']}**. These methods must not be conflated. A favorable 300 ms result cannot rescue a failed primary.",'',
f"On the same 256 families, 300-minus-80 is **{100*d['mean']:+.2f} percentage points**, paired approximate 95% interval {interval(d['interval95'])} pp; joint-family bootstrap sensitivity {interval(d['bootstrap']['difference']['interval95'])} pp. Both budgets remain together in each resample. This descriptive contrast does not treat the overlapping samples as independent.",'',
'![Game scores and matched budget contrast](p-confirmation-20261029.svg)','',
'| Budget | Pair variance | Pair SD | SE | Standardized effect above .5 | Pair-mean disc-margin 95% interval |',
'| --- | ---: | ---: | ---: | ---: | --- |']
for b in ['80','300']:
    a=st['scores'][b];o=s['outcomes'][b];lines.append(f"| {b} ms | {a['variance']:.6f} | {a['sd']:.4f} | {a['standardError']:.5f} | {a['standardizedEffect']:.3f} | {interval(o['discMargins']['interval95'],1)} |")
lines+=['','Student inference is approximate, justified here by large independent source-family panels and disclosed synthetic null calibration; it is not a finite-sample universal theorem. Bootstrap uses 10,000 tested complete-family resamples and is a sensitivity analysis. Hoeffding assumes independent bounded [0,1] family scores and stable playing conditions. Admission conditions on historical and mutual trajectory exclusions, and serial timed searches experience OS variability; universal independence of every internal position is neither established nor required by the source-family claim. The conservative radii and any disagreement with conventional evidence are retained.','',
'| Budget | Evaluator | Phase | Moves | Mean / median completed depth | Nodes | Evaluations | Search seconds | Incomplete iterations | Exact moves |',
'| --- | --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |']
for t in s['telemetry']:
    lines.append(f"| {t['timeMs']} | {t['evaluator']} | {t['phase']} | {t['moves']} | {t['meanDepth']:.3f} / {t['medianDepth']:.1f} | {t['nodes']} | {t['evaluations']} | {t['totalMs']/1000:.1f} | {t['incompleteIterations']} | {t['exact']} |")
cost={n:statistics.median(x['ns'] for x in q['staticCost']['rows'] if x['name']==n)/1000 for n in ['B','P']}
lines+=['',f"Fresh standalone complete evaluation with known own mobility costs median B {cost['B']:.3f} μs and P {cost['P']:.3f} μs ({100*(cost['P']/cost['B']-1):+.2f}%). No per-leaf clocks were used during scored play. Tree shape and pruning also differ; evaluation cost alone is not a causal explanation of the game results.",'',
'Ordinary incomplete iterative-deepening iterations are expected deadline telemetry. All depth histograms, fallbacks, >1 ms and >5 ms overruns and maxima are in the evidence. Move/phase observations describe search work, not independent strength samples. Exact late moves and shrinking remaining depth make late mean depths especially hard to compare.','',
'Descriptive opening-policy, occupied-count, actual-turn and 16-cell scores are published without additional significance claims. No game positions were retrospectively labeled. Phase telemetry cannot establish a phase-specific strategic weakness or attribute minimax choices to immediate features.','',
f"Source admission excluded the verified 15,158,601-key historical index, engineering index and {registration['history']['addedKeys']:,} additive keys covering the completed exploratory screen and new qualification. The fixed allocation used {registration['reservation']['attempts']:,} ascending attempts with {registration['reservation']['rejections']:,} pre-outcome rejections. No scored opening was replaced. The archived PC data and original screen remain read-only. Reused archive-preservation evidence is bound by checksum; a fresh complete 21 GiB rehash was deliberately not repeated.",'',
f"The outcome-blind provenance audit replayed every game before score summaries, scanned {p['historicalOccurrenceRows']:,} historical occurrence records, and found {len(p['violations'])} prohibited/unresolved keys. Independent source claim: **{p['independentClaim']}**. Complete classifications, occurrence paths, direct-state checks and exceptions are in the evidence. Played-path convergence across families: {s['integrity']['nonterminalCrossFamilyConvergences']} nonterminal both-turn key occurrences; these are incidental convergence, not additional source samples. Shared admitted ancestry was forbidden. Terminal convergence is retained. A serious provenance failure blocks independent superiority irrespective of means.",'',
f"Independent Python verification passed all {verification['games']} games and {verification['families']} reservations, checking its own rules, symmetry keys, outcomes, source separation, paired variance, numerically integrated Student probabilities, bounds and separate resampling. Receipt/source checksums and immutable snapshots were verified. Real interruption/restart and tamper rejection succeeded during qualification; resumed scored prefixes, if any, are recorded in the event log. No original search/evaluation source changed.",'',
f"The complete qualified forecast was {f['rawMs']/60000:.2f} raw minutes ×1.35 plus a separate 20-minute reporting reserve = **{f['requiredMs']/60000:.2f} minutes** against the eight-hour ceiling. Qualification took {q['wallMs']/60_000:.2f} minutes outside that allowance. Scientific preparation and game active time was {state['activeMs']/60_000:.2f} minutes; complete post-qualification execution including audits is recorded in the completion receipt. Games were serial with zero competing scientific workers; fresh resource samples, memory/swap, disk and process evidence remain local. The new-artifact disk ceiling is 75 GiB. Temporary caffeinate changes no saved settings.",'',
'The point estimates test whether P’s exploratory advantage reproduces on genuinely fresh openings under the registered distribution and exclusions. They do not establish universal strength, performance against other opponents, or broader openings. B is the sole opponent. Source selection, a fixed compact model, ordinary elapsed-time nondeterminism and this M4 runtime limit external validity. Intel macOS and Windows/WSL2 were not rerun in this experiment.','',
s['decision']+'. '+('This justifies an independent production-promotion review, including portability and wider-opponent review; the distinction between conventional and distribution-free evidence above remains material.' if st['conventional'] and st['bootstrapSupport'] and p['independentClaim'] else 'The registered evidence is insufficient for a two-budget production-promotion recommendation; the missing gates are identified above. No sample extension or new evaluator training was started.'),'',
'Reproduce from the retained local run (read-only audits):','',
'```bash','node scripts/p-confirmation/audit.mjs','node scripts/p-confirmation/analyze.mjs','python3 scripts/p-confirmation/verify.py',
'python3 scripts/p-confirmation/verify.py --evidence docs/data/p-confirmation-results-20261029.json','npm test','git diff --check','```','',
'Source and reservation hashes in the prospective registration bind the exact scientific inputs. Large historical corpora, task receipts, source snapshots and per-move checkpoints remain Git-ignored. Compact public games preserve complete legal move paths, final boards, outcomes, per-game telemetry and receipt digests. Full per-move search telemetry remains in the audited local receipts.']
(ROOT/'docs/P_CONFIRMATION_RESULTS.md').write_text('\n'.join(lines)+'\n');print(s['decision'])
