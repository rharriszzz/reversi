"""Render the Mac report from compact published evidence, outside measurement."""
import collections,json,math,statistics
from pathlib import Path
from analyze import effect
ROOT=Path(__file__).resolve().parents[2];D=ROOT/'docs/data/fast-flips-mac'
def load(n):return json.loads((D/n).read_text())
def delta(e):return f"{e['percent']:+.2f}% [{e['low']:+.2f}, {e['high']:+.2f}]"
def table(headers,rows):return '\n'.join(['| '+' | '.join(headers)+' |','| '+' | '.join(['---']*len(headers))+' |',*['| '+' | '.join(map(str,r))+' |' for r in rows]])
def main():
 s=load('summary.json');m=load('manifest.json');initial=load('initial-summary.json');final=load('final-search.json');q=load('qualification.json');profiles=load('profiles.json')['captures'];browser=load('browser.json');resources=load('resources.json');by={(x['workload'],x['tag']):x for x in s['panels']}
 p=lambda panel,model='P',tag='refined':by[(panel+'-'+model,tag)]
 micro={(x['class'],x['tag']):x for x in s['micro']};weighted={x['tag']:x for x in s['legalPhaseWeightedMicro']}
 fine=lambda tag:next(c for c in profiles if c['id']==f'profile-root-P-{tag}-ip-1000000-final')
 old,new=fine('original'),fine('refined');flip=lambda c:sum(v for k,v in c['functionWeights'].items() if 'flips(' in k)
 share=lambda c:100*flip(c)/c['weight'];cycleSave=100*(1-(flip(new)/new['repeats'])/(flip(old)/old['repeats']));wholeCycle=100*((flip(old)/old['repeats'])-(flip(new)/new['repeats']))/(old['weight']/old['repeats'])
 doc=[f'''# Faster disc flipping — M4 Mac experiment

**Phase 1 complete; Mac measurements only.** Retain the portable geometry-table
kernel with the single sentinel refinement on `perf/fast-flips`, pending actual
WSL2/x86-64 qualification. Do not merge it into `main` yet.

The selected kernel takes about **{weighted['selected']['ns']:.2f} ns** per complete
flip calculation in the disclosed legal-phase mixture, versus
**{weighted['original']['ns']:.2f} ns** for the original ({weighted['original']['ns']/weighted['selected']['ns']:.2f}× throughput).
Complete searches save **37% on twelve distinct exact roots**, **18–21% on the
mixed 48-root panel**, and **12–15% on opening/middle/coaching panels**. The
separately disclosed twelve-empty profiling root saves **44%**. Scores, moves,
search/TT counters and frozen model behavior remain identical at fixed work.
These are performance results, not new playing-strength or learning evidence.

## Environment, source identity and audit

Apple M4 iMac, Mac16,3, ten cores, 24 GiB RAM; macOS 27.2 (26B123),
Apple Clang 21.0.0, Xcode/xctrace 27.2, Node 24.22.1 and the existing project
Python 3.14.10. The shell's unrelated Python 3.13 installation was not selected.
Emscripten 4.0.22 builds the experimental Wasm. No toolchain was installed.

The checkout initially had no local modifications. `git fetch origin` verified
local `main` and `origin/main` at the same complete baseline SHA below, and
`git switch -c perf/fast-flips` isolated the experiment. Baseline source/binaries
were copied into ignored storage before editing. Other work was not reset or
stashed. No merge into `main`, application termination, power/security setting
change, or Processor Trace enablement occurred.

Initial memory pressure was normal, allocated swap about 0.38 MiB and disk free
about 510 GiB. Periodic snapshots record cache-based reclaimable headroom,
pressure, swap counters and competing desktop processes. This was a working
desktop, not an isolated machine; XProtect, WindowServer and backup services
were left running. Read the [resource ledger](data/fast-flips-mac/resources.json)
for exact snapshots and the estimator's limitations. No competing Reversi
campaign was found; closing process checks found no remaining owned runs.
The charged measurement/profiling budget was **{resources['budget']['activeSeconds']/60:.2f} minutes**,
including pilots, calibration, warmups, collector launches and saving. Ordinary
compilation, correctness, offline exports and reporting are separate.

| Source | Complete revision |
| --- | --- |
| Latest verified main / original loop, including retained tiny-endgame optimization | `{m['baselineCommit']}` |
| Bounded standalone/integrated candidate kernels | `{m['kernelSourceCommit']}` |
| First production table form, subsequently rejected compiler layout | `c2f0295631c3b6228cd9e171b69797cc3df9f480` |
| Portable deterministic micro-corpus harness | `b38c6c1b` (full revision below in Git history; source hashes in manifest) |
| Final tested native/Wasm algorithm | `{m['finalNativeSourceCommit']}` |

The [manifest](data/fast-flips-mac/manifest.json) records complete source,
header/model, driver, compiler/flags and actual measured binary SHA-256 values.
It also records exact workload/corpus identities. All timing builds use
`-O3 -std=c++17 -ffp-contract=off -fno-fast-math -g` plus the same warning flags,
with no LTO, host-specific tuning, forced frame pointers or `NATIVE_PROFILE`.
Engine text with/without `-g` was verified identical. A common separately
compiled driver object is linked with each separately compiled engine object.
The original engine, evaluator, TT policy and final-one/two-empty helper remain
inspectable. Only capture calculation changes in the final shared C++ source.

## Hypotheses and bounded candidates

1. **Original:** eight masked directional ray loops. Correctness is the control.
2. **Masked loop:** remove edge opponents once, then propagate with raw shifts
   and fewer repeated edge masks. Short rays might benefit; extra branches/code
   growth could offset that gain.
3. **Six-step unrolled propagation:** fixed union/shift expansions followed by
   an own-disc bracket test. It avoids loop branches but does unnecessary work
   on short rays.
4. **Pair/doubling propagation:** grow lengths 1 → 2 → 4 → 6 with a reused
   opponent-pair mask. No data-dependent loop; ordinary compiler vectorization.
5. **Compact ray geometry:** 64 squares × eight 64-bit rays = **4096 bytes**.
   Select the first non-opponent square with low-bit isolation or leading-zero
   count, require that endpoint to be ours, and return the intervening ray bits.
   This is a geometry table, not an occupancy lookup table.
6. **Helper-only placement:** retain general flips and use the guarded geometry
   kernel only inside the existing final-one/two-empty helper. This separately
   measures a narrow endgame substitution; existing capture reuse stays intact.

Masked-loop and six-step forms lost clearly to the table in microbenchmarks and
were not expanded into full-search campaigns. Doubling, guarded table and
helper-only placement received integrated qualification. A larger ternary
rank/file/diagonal occupancy lookup was considered but not implemented: portable
gathering and a larger footprint had no demonstrated advantage over the small
geometry scheme. BMI2/ARM intrinsics and a new final-empty counting algorithm
were not introduced. Skipping bracket checks on completely occupied rays is
possible in a one-empty-only method, but was not another tested candidate.

### One profile-directed refinement

The first clean production table form generated **124 ARM64 instructions and
15 conditional branches**, versus 108/9 for the experimental wrapper. Fine
hardware samples landed in its zero-ray return blocks as well as loads and
endpoint operations. This was observed code/sample placement, not proof of a
branch-misprediction penalty. Its actual microbenchmark was slower on several
classes, so it was not silently treated as equivalent performance.

The one additional refinement removes empty-stop branches. On increasing rays,
isolating a bit from zero yields zero and cannot match our discs. On decreasing
rays, `stops | 1` defines leading-zero count even when no stop exists; requiring
the selected bit in **both own and actual stops** prevents a false sentinel
bracket. This preserves empty-square stops, board-edge stops and all passes.
ASan/UBSan and the complete independent qualification were repeated. No second
post-profile algorithm refinement was attempted. Whole searches, rather than
the small difference in weighted microbenchmarks, selected this final form.

## Independent correctness

The C++ reference scans 64 mailbox cells directly in eight `(row,column)`
directions; it shares no propagation or endpoint kernel. All four complete line
orientations through every move square exhaust ternary patterns where practical.
Explicit rays of length 0–6, unbracketed edge chains, corners, wrapping, several
simultaneous directions, arbitrary sparse/dense disjoint boards and 128 seeded
legal histories supplement that enumeration. Both colored resulting `Board`
values are checked, not merely popcounts. All six linked implementations pass
**{s['microCheckedCases']:,} case checks** including the exact-search corpus.
The sanitizer-only version checks {q['finalSanitizers']['rows'][0]['micro']['checkedCases']:,}
cases without timed work. These are case checks, not that many independent games.

The separate JS reference uses a 10×10 sentinel mailbox and exhaustive minimax.
The final native qualification checks **{q['final']['boards']} boards**, including every
possible sole empty square and arbitrary one/two/three-empty boards, both turns,
B/L/P, truncated horizons, forced passes and terminal boards with unused squares.
It passes **{q['final']['rootQueries']:,} root queries** across original/final builds,
**{q['final']['coachingRows']} independently checked depth-3 coaching rows**,
**{q['final']['pvSteps']:,} PV steps**, **{q['final']['deepCoachingRows']} additional depth-6 rows/PVs**,
and **{q['final']['timedPublications']} deterministic interrupted publications**.
Initial integrated candidates separately passed {q['initial']['rootQueries']:,} queries.
The same 221-board pool is reused across builds; it is not a new learning holdout.

All **{q['timedPublications']['publications']} actual 80/300-ms publications** were subsequently checked
against complete baseline searches at their stated horizons, including the
chosen child's full-window value and independent legality. Final compiled Wasm
passes **{q['wasm']['searches']:,} searches**, **{q['wasm']['staticQueries']:,} static queries**,
303 coaching rows and 909 verified PV steps with zero numerical error.
Full closing suites pass **182 Node tests, 16 sanitizer groups and 46 Python
tests**. Frozen Float32 cells/weights, evaluator values, bounds, TT collisions,
generation rollover, pass/depth handling and completed-iteration behavior remain
qualified. See [the exact commands and receipts](data/fast-flips-mac/qualification.json).

## Flip microbenchmark — Mac only

Cases are generated before clocks start, then shuffled with a specified integer
generator/Fisher-Yates order, independent of libc++ versus libstdc++. The exact
corpus takes one-in-97 real baseline flip inputs by remaining-empty count from
the disclosed exact tree. No random positions are generated inside timing.
Separate translation units, no LTO, external function calls, consumed checksums,
equal boundaries, warmups and seven rotated/reversed trials prevent folding or
elimination. Each timed class/algorithm trial processes about twenty million
calls. Nanoseconds below are whole-block elapsed divided by calls, not per-call
timer readings. Full CPU times, trial variation and checksums are in
[the micro data](data/fast-flips-mac/micro.json).
''']
 classes=list(dict.fromkeys(x['class'] for x in s['micro']));tags=['original','masked-loop','unrolled','doubling','ray-table','selected']
 doc.append(table(['Class / cases','Original ns','Masked ns','Six-step ns','Doubling ns','Guarded table ns','Final sentinel ns'],[[f"{g} / {micro[g,'original']['cases']:,}",*[f"{micro[g,t]['ns']['median']:.2f}" for t in tags]] for g in classes]))
 doc.append(f'''

The disjoint legal-phase mixture contains **{weighted['selected']['cases']:,} cases**;
it excludes the overlapping edge subset and controlled stress. Its final rate
is about **{1000/weighted['selected']['ns']:.1f} million calls/s**, versus
{1000/weighted['original']['ns']:.1f} million originally. The weighted paired elapsed
effect is **{delta(weighted['selected']['vsOriginal'])}** (seven timing pairs).
The quoted 4.05× point ratio uses case-weighted class medians; the interval uses
per-repetition weighted log ratios, so they need not coincide exactly.
Guarded table's weighted point is {weighted['ray-table']['ns']:.2f} ns; it remains faster
on some short-ray classes. The separate exact-search sample improves
{micro['search-tail','original']['ns']['median']:.2f} → {micro['search-tail','selected']['ns']['median']:.2f} ns
({micro['search-tail','original']['ns']['median']/micro['search-tail','selected']['ns']['median']:.2f}×), not the 4.05× legal-mixture result.
This demonstrates why a microbenchmark mixture cannot predict every search.

## Complete native searches — decision gate

All blocks execute production search objects without a profiler. Two full warmup
batches precede a fixed repetition count chosen to give about 0.35 seconds of
baseline work. Nine repetitions rotate/reverse engine order and rotate workload
order. The final comparison includes original, guarded table and final sentinel
in the **same campaign**. No source/binary is rebuilt during measurement.

The independent exact panel contains twelve distinct roots with **8–12 empties**;
it does not contain twelve twelve-empty roots. The profiling root is separately
`native-engineering-10`, searched through all twelve empties. The mixed panel
contains all 48 disclosed roots, including those twelve plus the legacy 36.
Its legacy horizons are D8 below 28 occupied, D7 below 52, otherwise min(10,
empties); added exact roots reach all empties. Thus the disclosed board's mixed
horizon D10 differs from its separate exact D12 workload. Opening uses four
roots at D8, middle six at D7, coaching two at D6 with full root windows and
verified lines. TT is the existing 10,485,760 actual bytes; native ordering hints
are disabled consistently. This does not retest the old 43e52d2-versus-final-empty
legacy comparison as though it were the present baseline.

Intervals are descriptive 95% Student-t intervals on nine paired log elapsed
ratios. They quantify run variation on these fixed panels, not uncertainty over
all Reversi positions; no multiplicity/drift correction is claimed. Desktop
variation and order/thermal effects remain possible. Wall/CPU columns are
medians per complete batch; percent effects use mean paired log ratios, so
dividing medians need not reproduce the reported effect exactly.

### Initial candidate campaign (all elapsed changes versus its own original)
''')
 ib={(x['workload'],x['tag']):x for x in initial['panels']};panels=['mixed48','exact12','profile-root','opening','middle','coaching']
 doc.append(table(['Panel / model','Original ms','Doubling','Guarded table','Helper-only table'],[[panel+'/'+model,f"{ib[panel+'-'+model,'original']['batchSeconds']['median']*1000:.3f}",*[delta(ib[panel+'-'+model,t]['vsOriginal']) for t in ['doubling','ray-table','late-ray']]] for model in ['B','L','P'] for panel in panels]))
 doc.append('''

Helper-only substitution establishes a narrower independent benefit (about
16–17% on twelve exact roots, 22% on the single root), but does not improve
opening/middle/coaching consistently. Its small unfavorable nonterminal results
are retained; no cache/layout mechanism was established for them. The general
table beats doubling and the narrow substitution. Rejected kernels remain in
the experiment header/build recipe, not in production dispatch.

### Final campaign (original → sentinel)
''')
 rows=[]
 for model in ['B','L','P']:
  for panel in panels:
   a,b=p(panel,model,'original'),p(panel,model)
   rows.append([panel+'/'+model,f"{a['batchSeconds']['median']*1000:.3f} → {b['batchSeconds']['median']*1000:.3f}",f"{a['batchCpuSeconds']['median']*1000:.3f} → {b['batchCpuSeconds']['median']*1000:.3f}",delta(b['vsOriginal']),f"{b['metricsPerBatch']['nodes']:,.0f} / {b['metricsPerBatch']['evaluations']:,.0f}",f"{b['millionNodesPerSecond']:.2f} / {b['millionEvaluationsPerSecond']:.2f}"])
 doc.append(table(['Panel / model','Complete wall ms','Thread CPU ms','Elapsed change [95%]','Nodes / evals per batch','New M nodes/s / M evals/s'],rows))
 doc.append('![Complete fixed-search reductions, with separate root counts](flip-optimization-mac.svg)')
 doc.append('''

Every fixed call has identical score, move, exactness, completed horizon and all
13 search/TT counters across builds. Full batch elapsed/CPU/counters,
per-root API elapsed means and complete result-signature hashes are retained in
[final data](data/fast-flips-mac/final-search.json); initial results are
[separate](data/fast-flips-mac/initial-search.json). This isolates flip cost from
tree reduction. No favorable single-root result is substituted for the panel.

Per-root exact P comparisons below use average API search elapsed within each
block, paired across nine trials; they are secondary to complete batch time.
''')
 w=next(w for w in final['workloads'] if w['id']=='exact12-P');rs=[r for r in final['rows'] if r['workload']==w['id']];positions=load('positions.json');rootRows=[]
 for i,id in enumerate(w['positionIds']):
  vals={t:[r['results'][t]['meanPerRootElapsedMs'][i] for r in rs] for t in ['original','refined']};e=effect([a/b for a,b in zip(vals['refined'],vals['original'])]);pos=next(p for p in positions if p['id']==id)
  rootRows.append([id,64-pos['occupied'],f"{statistics.median(vals['original']):.3f} → {statistics.median(vals['refined']):.3f}",delta(e)])
 doc.append(table(['Distinct exact root','Empties','Original → final ms','Elapsed change [95%]'],rootRows))
 doc.append('All twelve roots improve individually. The slowest root contributes about 70% of this small panel’s original time; the aggregate is not an estimate over all endgames. The table exposes that weighting rather than treating twelve roots as equal-duration work.')
 doc.append('''

### Timed native searches (supplementary)

Each cell has six opening/middle roots × three repetitions, with one full warmup
batch. Times below are native core requests, excluding process startup and
transport. All published horizons/moves passed the later complete-search audit.
These are not games and do not establish greater playing strength.
''')
 tr={(x['model'],x['budgetMs'],x['tag']):x for x in s['timed']};rows=[]
 for model in ['B','L','P']:
  for budget in [80,300]:
   a,b=tr[model,budget,'original'],tr[model,budget,'refined'];rows.append([model,budget,f"{a['depth']['mean']:.3f} → {b['depth']['mean']:.3f}",f"{a['depth']['median']} → {b['depth']['median']}",f"{a['maxOverrunMs']:.3f} → {b['maxOverrunMs']:.3f}"])
 doc.append(table(['Model','Budget ms','Mean completed depth','Median depth','Max overrun ms, old → new'],rows))
 doc.append('''

## Assembly, sampling and caller evidence

All `flipsIn<D>()` bodies inline into `flips`. The original M4 loops execute
six instructions per iteration for E/W/SE/SW/NE/NW and five for S/N, plus setup,
endpoint tests and result combination. A direction with L adjacent opponents
executes L+1 such machine-code iterations, including the final stop (L can be
seven on an unbracketed ray). Each iteration carries the old run forward, shifts,
optionally masks, accumulates, tests and branches. The compiler shares move-bit
creation, shifts destination edge masks, and uses conditional selects for own
endpoints. Register pressure saves/restores a callee pair. Capturing requires
far more instructions than applying the returned mask with OR/BIC operations;
in search, board application can be inlined into the caller.

The final kernel uses seven scalar operations per increasing direction and ten
per decreasing direction, two shared constants, four paired ray loads, shared
address setup and result combination. It has no loop or conditional branch and
no register-save spill. Masks are precomputed geometry. Four scalar `clz`
instructions and ordinary shifts/selects need no ARM/BMI2-specific intrinsic.
The general recursion/root/tiny-helper instruction counts remain 462/216/291;
both compared disassemblies retain twelve direct `flips` call sites. This is not
a new inlined flip body hidden inside general recursion.
''')
 doc.append(table(['Compiled form','flips instructions','Bytes','Static conditional branches','Load instructions','Geometry bytes'],[[a['tag'],a['flipInstructions'],a['flipBytes'],a['conditionalBranches'],a['loads'],a['tableBytes']] for a in s['assembly']]))
 doc.append(f'''

Load counts are static instructions, including the original stack restore;
four final `ldp`s read eight ray words. Propagation alternatives have compiler
vector literal pools as well, even though they have no geometry table. Clang
SLP-vectorizes parts of those alternatives; more branchless propagation was not
automatically faster. The helper-only row describes its unchanged general
flips body; it also emits a separate guarded lateFlips body. The final selected
implementation retains just one kernel. Its physical body is **356 → 344 bytes**, plus the
4 KiB readonly table. Full-search P results include interference with pattern
tables/TT and show a net benefit; no cache-miss rate was measured.

The qualified collector supplied **26 captures**: 18 initial captures to compare
forms/callers and eight final coarse/fine captures. Minimal IP collection requests
`CORE_ACTIVE_CYCLE` at 10,000,000 or 1,000,000 cycles with empty user/kernel stacks;
the existing package also configures/reads the named counter every 10,000 µs.
Only PMI rows locate instructions. Every IP row and exported table requirement
was checked for hidden stack collection. No per-call production timers,
software-IP substitute, cache/branch-miss event or Processor Trace was used.
Actual stack and CPU Profiler captures supply caller evidence separately.

''')
 captureRows=[]
 for c in profiles:
  if c['id'].endswith('-final') and c['workloadId']=='profile-root-P':captureRows.append([f"{c['buildId']} / {c['mode']}",f"{c['samples']:,}",f"{share(c):.2f}%",c['unresolvedSamples']])
 doc.append(table(['Final exact-root IP capture','Accepted samples','Physical flips share','Unknown leaf samples'],captureRows))
 doc.append(f'''

At one million cycles, sampled flip weight per identical fixed root falls
**{flip(old)/old['repeats']/1e6:.3f} → {flip(new)/new['repeats']/1e6:.3f} million cycle-weight units**,
about **{cycleSave:.1f}% less**. That removes approximately **{wholeCycle:.1f}% of the original
total accepted cycle weight per root**. Complete unprofiled elapsed falls
{abs(p('profile-root')['vsOriginal']['percent']):.2f}%. This answers how much of this root's old
~59% hotspot was improvable; it is not a universal flip fraction or an exact
wall-time attribution. The final share is {share(new):.2f}%, not zero.

Old fine-profile hotspots include loop-entry/setup and loop-carried `mov` sites (e.g. module offsets
0x8dc/0x8c4) and the restore/return region. The final profile emphasizes endpoint
loads/bit operations and 0x9e4's final OR/return region. These addresses refer to
the **profiled fixed-work binary**, not the differently linked protocol adapter.
Skid and interrupt placement mean a sampled MOV/OR is not proof of that
instruction's intrinsic latency. The [complete flip IP aggregates](data/fast-flips-mac/profiles.json)
retain instructions, addresses, source mapping, event/period, denominators,
unknown mass and export hashes. Unknown lost records stay null, not zero.

On the exact root, non-flip sampled cycle weight per root also decreases about
9.7%. Opening/middle coarse captures have non-flip point estimates about 9%/7%
higher, despite lower complete elapsed/total sampled cycles. One coarse capture
does not establish a cache regression or a causal transfer of work: layout,
cache/stall overlap, skid and core scheduling remain possible. No added
search/evaluation work appears in counters or source; remaining search/control
becomes a larger fraction. Those component observations do not override the
repeated whole-search gains, and their cause remains an explicit mechanism limit.

### General moves versus specialized endgame

The separate counting-only build records **171,939 flips**, of which **107,588
(62.57%)** originate in the one/two-empty helper. Counts by empties, final score,
nodes and sampled inputs are byte-identical before/after. This is a call fraction,
not a time fraction. The original CPU Profiler's genuine reconstructed stacks
put about **54.5% of flip cycle weight through lastEmpties**, the rest through
play/general search. Raw hardware frame-chain stacks expose that helper on only
24.2% of flip weight and omit helper/play ancestry on the remainder. Therefore
missing raw helper frames cannot be counted as general-move work. See the actual
contexts in the profile data and [ancestry limitations](PROFILING_METHODS_AND_VIEWS.md).

The endgame helper remains separate and gated to exact horizons. Its precomputed
two-square captures, reuse, passes and unplayed-square margins are preserved.
The helper-only integrated experiment above independently confirms a narrower
benefit; the final general kernel additionally improves ordinary move application.
Processor Trace was unnecessary for these conclusions; its disabled OS setting
was left unchanged. No exact dynamic branch history or misprediction rate is claimed.

## Actual Chrome Wasm qualification — Mac only

Candidate Emscripten build `{m['wasm']['fingerprint']}` was built and tested in
ignored storage; distributed `src/wasm` binaries/manifest remain unchanged.
Actual Chrome **{browser['browser']}** loaded the candidate build identity, compared fixed
scores/complete counters and passed {len(browser['uiChecks'])} UI checks with zero page errors:
B/L/P coaching, verified-line display, a timed reply, undo, rapid cancellation/
model changes and reload. It used disposable contexts; ordinary profiles were
untouched. Safari, Intel Mac and Windows were not newly tested in this experiment.

The following are complete actual-worker batch wall times, including normal
adapter/JSON costs (and JS coaching work), one full warmup, three batches per
block, seven alternating pairs. CPU time is unavailable. Browser coaching uses
its ordinary adapter's ordering hints; native coaching above disables hints, so
absolute cross-backend coaching times are not a matched-work comparison.
''')
 rows=[]
 for panel in ['mixed48','exact12','opening','middle','coaching']:
  for model in ['B','P']:
   rs=[r for r in browser['rows'] if r['panel']==panel and r['model']==model];a=[r['results']['original']['wallMs']/3 for r in rs];b=[r['results']['selected']['wallMs']/3 for r in rs]
   rows.append([panel+'/'+model,f'{statistics.median(a):.3f} → {statistics.median(b):.3f}',delta(effect([x/y for x,y in zip(b,a)]))])
 doc.append(table(['Wasm panel / model','Complete worker batch ms','Elapsed change [95%]'],rows))
 doc.append(f'''

No browser-game tournament or training was needed for a rules-preserving flip
kernel. Fixed-time depths are supplementary, not a playing-strength claim.

## Answers to the twelve requested questions

| Question | Mac finding |
| --- | --- |
| 1. Algorithms actually tested? | Original loop; masked loop; six-step propagation; pair/doubling; guarded 4 KiB ray geometry; helper-only table placement; one sentinel refinement of the table. |
| 2. Fastest microbenchmark? | Sentinel's weighted point {weighted['selected']['ns']:.2f} ns versus {weighted['original']['ns']:.2f} ns, {weighted['original']['ns']/weighted['selected']['ns']:.2f}×. Guarded table wins some short-ray classes; weighted table-form differences are small. |
| 3. Complete exact searches? | About 37% less elapsed across twelve distinct 8–12-empty roots; separate one-root D12 gain about 44%. |
| 4. Opening/middle/coaching? | All three models improve approximately 12–15% on the disclosed native panels. |
| 5. Original 59% improvable? | About {cycleSave:.1f}% less sampled flip cycle weight per fixed root, equivalent to {wholeCycle:.1f}% of old total accepted cycle weight; separate unprofiled root elapsed saves 44%. Not all searches. |
| 6. Hardware result? | Real cycle-triggered IPs move from ray-loop control to fixed endpoint/load/select work; final fine flips share {share(old):.2f}% → {share(new):.2f}%. |
| 7. Shifted elsewhere? | No added tree/evaluator work or hidden inlined flip body. Exact residual sampled weight decreases; coarse opening/middle residual point estimates rise, with cause unresolved. Whole-search time improves. |
| 8. Compiler output? | 89 → 86 instructions, eight loop branches → no conditional branches, stack restore removed, four paired table loads, 356 → 344 text bytes plus 4096 data bytes. |
| 9. Tiny helper independently? | Guarded helper-only substitution saves 16–17% on the exact panel and ~22% on the single root; existing specialization/reuse remains intact. |
| 10. Correctness preserved? | Independent mailbox/minimax, exact and heuristic B/L/P scores, all-move/PV checks, full counters, sanitizers, timed-publication audit and actual Wasm/Chrome checks pass. |
| 11. Same on WSL2 x86-64? | **Pending actual PC measurements. None inferred from this Mac.** |
| 12. Keep it? | Keep the selected portable kernel provisionally on the experimental branch. Decide shared versus architecture-specific retention only after PC qualification; no merge yet. |

## Evidence and publication

All compact datasets are under [data/fast-flips-mac](data/fast-flips-mac/manifest.json).
They preserve every complete batch clock/counter and timed publication, per-root
references/elapsed means and full-signature hashes. Repetitive raw fixed-call
rows, native/Wasm binaries, raw Instruments traces and exports stay ignored in
`.local-research/fast-flips-m4-20261031/`. No SDK, venv, cache, archive or personal
model export is committed. Reproduction/collection commands are in the
[experiment README](../scripts/fast-flips/README.md).

Actual local source checkpoints used:

```bash
git commit -m 'Add independently qualified bounded flip-kernel experiment'
git commit -m 'Select portable ray-endpoint flipping for Mac qualification'
git commit -m 'Qualify experimental Wasm and make flip corpus order portable'
git commit -m 'Remove empty-ray branches with a guarded sentinel refinement'
```

Final reporting is published with:

```bash
git commit -m 'Publish M4 fast-flip results and reproducible PC handoff'
git push -u origin perf/fast-flips
git ls-remote origin refs/heads/perf/fast-flips
```

The final publication SHA/remote verification is returned in the completion
message; embedding a report's own commit SHA is self-referential. The exact
tested native source revision below is immutable and present in that history.
No command merges or pushes to `main`.

## PC Handoff

**Branch:** `perf/fast-flips`. **Exact tested final source:**
`{m['finalNativeSourceCommit']}`. **Original baseline:**
`{m['baselineCommit']}`. The publication follow-up changes only reporting,
tests/harness bookkeeping, and documentation; the engine bytes must match the
source SHA below. All performance results above are **Mac-only**.

| Required identity | SHA-256 |
| --- | --- |
| native/engine.cpp | `{m['sourceHashes']['native/engine.cpp']}` |
| native/engine.hpp | `{m['sourceHashes']['native/engine.hpp']}` |
| Frozen generated header | `{m['modelHeaderSha256']}` |
| positions.json, exact byte order | `{m['workloadSha256']}` |
| search-cases.txt | `{m['searchCasesSha256']}` |

Preserve existing PC work. Fetch without resetting it and use a fresh worktree
(if this branch/worktree already exists, inspect/resume it instead of deleting
or overwriting it):

```bash
git fetch origin perf/fast-flips
git worktree add -b perf/fast-flips ../reversi-fast-flips FETCH_HEAD
cd ../reversi-fast-flips
git rev-parse HEAD
git merge-base --is-ancestor {m['finalNativeSourceCommit']} HEAD
git diff --exit-code {m['finalNativeSourceCommit']} -- native/engine.cpp native/engine.hpp
```

Read this handoff at fetched HEAD, verify the actual Linux/WSL2 x86-64 machine,
CPU/memory/swap/disk/contention, and activate the **existing qualified Python
3.14** environment. Use the actual GCC 15/Ubuntu installation; do not install
older tools. Run the exact common-native build/test/micro/integrated commands
in [scripts/fast-flips/README.md](../scripts/fast-flips/README.md). They rebuild
both original and selected sources with the same portable flags, and also
preserve the guarded table for a controlled architecture comparison. Match the
micro `corpus` counts/ordered checksums against the committed manifest before
timing interpretation. Use a fresh output directory for a separate
`FLIP_NATIVE=1` / `-march=native` campaign, comparing algorithms **within** each
configuration. Do not attribute a tuning-flag change to the algorithm.

Probe hardware PMU availability once with existing `perf`, e.g.:

```bash
uname -a
perf --version
cat /proc/sys/kernel/perf_event_paranoid
perf stat -e cycles,instructions -- sleep 0.2
```

If unsupported or inaccessible, report that mechanism/permission limitation and
use disassembly and repeated unprofiled timing. Do not change privileges,
kernel/hypervisor configuration or install old perf versions. If PMU sampling
works, capture representative fixed-work baseline/candidate searches and label
the actual event. The builder already saves x86 `objdump -Cd` output. Check how
GCC lowers leading-zero/variable-shift operations and eight ray loads; ARM's four
paired loads/conditional selects need not translate similarly. Investigate
cache/layout or residual-control effects only when a concrete PC result warrants it.

Selection rule for PC: any rule/score/PV/counter mismatch blocks retention.
A repeatable **>2% elapsed regression whose descriptive interval excludes zero**
on an important complete panel is material and needs explanation; do not excuse
it with a microbenchmark win. Small noisy changes are unresolved, not success.
Require meaningful repeatable complete-search benefit without important
unexplained regressions, with compiler configuration and denominators separate.
If portable x86 loses while Mac wins, consider an optional ARM implementation
with a correct portable fallback only after compatibility is requalified.

Create `docs/FLIP_OPTIMIZATION_PC.md`, update
`docs/FLIP_OPTIMIZATION_RESULTS.md`, commit/push PC evidence to this experimental
branch and verify its remote commit. Do not merge into main. Resolve the pending
x86 questions from actual PC evidence; cross-machine absolute timings are
confounded by hardware, OS and compiler and remain secondary.
''')
 # Resolve the complete harness revision rather than leaving an abbreviation.
 import subprocess
 harness=subprocess.check_output(['git','rev-parse','b38c6c1'],cwd=ROOT,text=True).strip()
 text='\n\n'.join(doc).replace('`b38c6c1b` (full revision below in Git history; source hashes in manifest)',f'`{harness}`')
 (ROOT/'docs/FLIP_OPTIMIZATION_MAC.md').write_text(text.rstrip()+'\n')
 # A compact side-by-side report leaves the other machine explicitly unmeasured.
 rows=[]
 for panel in panels:
  a=p(panel,'B')['vsOriginal'];b=p(panel,'P')['vsOriginal'];roots={'mixed48':48,'exact12':12,'profile-root':1,'opening':4,'middle':6,'coaching':2}[panel]
  rows.append([panel,roots,delta(a),delta(b),'Pending actual PC qualification'])
 combined=f'''# Flip optimization — cross-platform decision

**Mac phase complete; PC phase pending.** Keep the portable 4 KiB ray/sentinel
kernel provisionally on `perf/fast-flips`. No merge or universal speed claim.
Baseline `{m['baselineCommit']}`; tested candidate
`{m['finalNativeSourceCommit']}`; engine SHA-256
`{m['sourceHashes']['native/engine.cpp']}`.

{table(['Separate fixed panel','Distinct roots','M4 B elapsed change [95%]','M4 P elapsed change [95%]','WSL2/x86-64'],rows)}

Mac numbers use nine alternating/rotating timing pairs, complete fixed-work wall
time, Apple Clang 21 portable production options and identical scores/counters.
Intervals describe run variation on each disclosed panel; the twelve-root exact
panel and one twelve-empty root are different denominators. Model L also passes
and improves; the [full Mac report](FLIP_OPTIMIZATION_MAC.md) includes all tables.

The legal-phase micro point is {weighted['original']['ns']/weighted['selected']['ns']:.2f}×; the exact-search
micro corpus is {micro['search-tail','original']['ns']['median']/micro['search-tail','selected']['ns']['median']:.2f}×. Actual Chrome/Wasm and all independent correctness,
sanitizer and regression checks pass. Distributed browser assets stay unchanged.
Fixed-horizon playing behavior is preserved; timed playing strength was not tested.

PC must independently rebuild both revisions using its qualified GCC 15 / Python
3.14 environment, probe perf availability without privilege/kernel changes,
qualify scores/trees/PVs, and measure the same inputs/panels. Portable and
`-march=native` comparisons must have their own matched baselines. Fill PC cells
and make the combined retention decision only after actual PC results. Do not
infer PC timings from this Mac or compare absolute cross-machine time as an
isolated architecture effect. See [the exact PC handoff](FLIP_OPTIMIZATION_MAC.md#pc-handoff).
'''
 (ROOT/'docs/FLIP_OPTIMIZATION_RESULTS.md').write_text(combined)
 print('Rendered Mac report and pending cross-platform summary')
if __name__=='__main__':main()
