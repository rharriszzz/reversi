#!/usr/bin/env python3
"""Publish audited engineering preparation; never manufacture strength results."""
import collections
import hashlib
import json
from pathlib import Path
import statistics
import sys

ROOT = Path(__file__).resolve().parents[2]
run = Path(sys.argv[1] if len(sys.argv) > 1 else '.local-research/frozen-player-screen-v1-20261029/engineering')
r = json.loads((run / 'qualification.json').read_text())
a = json.loads((run / 'audit.json').read_text())
assert a['passed'] and a['qualificationSha256'] == hashlib.sha256((run / 'qualification.json').read_bytes()).hexdigest()
assert r['scientific'] == {'activeMs': 0, 'reservedSources': 0, 'reservedOpenings': 0, 'scoredGames': 0}
assert len(r['games']) == a['replayedGames'] == 8
names = ['B', 'L', 'P']
costs = {}
for name in names:
    costs[name] = {}
    for known in [False, True]:
        values = [x['ns'] / 1000 for x in r['static']['rows'] if x['name'] == name and x['known'] == known]
        costs[name]['known' if known else 'standalone'] = dict(medianUs=statistics.median(values),
                                                            rangeUs=[min(values), max(values)], repetitions=5)

depth = []
for name in names:
    for time in [80, 300]:
        rows = [x for x in r['timed'] if x['name'] == name and x['timeMs'] == time]
        depth.append(dict(name=name, timeMs=time, roots=len(rows),
                          medianDepth=statistics.median(x['depth'] for x in rows),
                          meanMs=statistics.mean(x['elapsedMs'] for x in rows),
                          maxMs=max(x['elapsedMs'] for x in rows),
                          nodes=sum(x['nodes'] for x in rows), evaluations=sum(x['evaluations'] for x in rows),
                          incompleteIterations=sum(x['timedOut'] for x in rows),
                          depthHistogram=dict(sorted(collections.Counter(x['depth'] for x in rows).items()))))

# A component calculation, explicitly NOT a qualified end-to-end forecast.
# Serial cost is assumed, even if six workers may eventually be admitted.
game_bound_ms = sum((256 if budget == 80 else 128) * (52 * (budget + 1) + 1000) for budget in [80, 300])
root_label_ms = 0
for phase in range(4):
    for d in [10, 12]:
        values = [x['wallMs'] for x in r['nativeQueries'] if x['depth'] == d and
                  [16, 30, 44, 52].index(next(s['occupied'] for s in json.loads((ROOT / 'scripts/machine-benchmark/positions.json').read_text())['roots'] if s['id'] == x['id'])) == phase]
        root_label_ms += 32 * max(values)
root_search_ms = 128 * max(sum(x['wallMs'] for x in r['search'] if x['id'] == root['id']) for root in json.loads((run / 'engineering-inputs.json').read_text())['roots'])
timed_roots_ms = 128 * 3 * (80 + 300 + 2)
frontier_ms = 32 * max(x['wallMs'] for x in r['frontierQueries']) + 32 * max(sum(x['wallMs'] for x in r['frontiers'] if x['id'] == root['id']) for root in json.loads((run / 'engineering-inputs.json').read_text())['roots'])
exact_ms = 32 * max(x['wallMs'] for x in r['exact'])
components = dict(serialGamesMs=game_bound_ms, rootLabelMs=root_label_ms, fixedSearchMs=root_search_ms,
                  timedRootsMs=timed_roots_ms, frontierReconstructionAndLabelsMs=frontier_ms,
                  exactWithReferenceChecksMs=exact_ms)
forecast = dict(components=components, componentTotalMs=sum(components.values()),
                with35PercentAndReportingMs=1.35 * sum(components.values()) + 900000,
                scientificCeilingMs=14400000, qualified=False,
                missing=['complete historical import/coverage audit and source-family admission/rejection cost',
                         'joint reservation memory and tail/rejection measurements under actual historical index',
                         'full scientific coordinator, sealed release and integrity/restart pilot',
                         'complete analysis/audit/report stage cost and final tail qualification'],
                assumptions='Serial work; 52 possible placements per game, +1 ms per move and +1 s/game engineering overhead. Root labels use measured phase maxima; other core diagnostics use complete measured maxima. No throughput extrapolation from configured workers. Component estimate cannot authorize launch.')

samples = a['occupancy']
resources = dict(configuredWorkers=1, safeCap=1, actualWorkers=1,
                 maxActiveNativeSearches=max(x['activeNativeSearches'] for x in samples),
                 activeNativeHistogram=dict(collections.Counter(x['activeNativeSearches'] for x in samples)),
                 occupancySamples=len(samples), firstSampleUtc=samples[0]['utc'], lastSampleUtc=samples[-1]['utc'],
                 minimumAvailableEstimateGiB=min(x['availableEstimateGiB'] for x in samples),
                 swapinPagesDelta=samples[-1]['swapins']-samples[0]['swapins'],
                 swapoutPagesDelta=samples[-1]['swapouts']-samples[0]['swapouts'],
                 nodeMaxRssBytes=r['maxRssBytes'], nodeCpu=r['cpu'],
                 correction=a['occupancyCorrection'],
                 caveat='5-second samples cover only the recorded window, not every instant of engineering. Available estimate is free+inactive+speculative pages, not a claim about uncompressed free memory. One-worker policy is conservative, not maximum machine capacity.')
usage=[]
def native_usage(value):
    if isinstance(value, dict):
        if isinstance(value.get('native'), dict) and 'userSeconds' in value['native']:
            usage.append(value['native'])
        for key, item in value.items():
            if key != 'native': native_usage(item)
    elif isinstance(value, list):
        for item in value: native_usage(item)
for task in (run / 'tasks').glob('*.json'):
    native_usage(json.loads(task.read_text())['result'])
resources['measuredNativeCpuSeconds'] = sum(x['userSeconds'] + x['systemSeconds'] for x in usage)
resources['maxMeasuredNativeRssBytes'] = max(x['maxRssBytes'] for x in usage)
resources['nativeCpuCaveat'] = 'Only wait4-metered accepted native tasks; excludes unmetered adapter queries and Python wrapper CPU. Node counters exclude separate restart subprocess and child CPU.'

evidence = dict(format='frozen-player-screen-prelaunch-v1', status='provenance-blocked-before-reservation',
                protocolHash=r['protocolHash'], source=r['source'], machine=r['machine'], models=r['models'],
                sourceInventory=json.loads((run / 'source.json').read_text())['inventory'],
                engineeringRoots=json.loads((run / 'engineering-inputs.json').read_text())['roots'],
                validation=r['validation'], native=r['native'], teacher=r['teacher'], history=r['history'],
                scientific=r['scientific'], engineeringWallMs=r['engineeringWallMs'],
                static=costs, staticRepetitions=r['static']['rows'], timedSummary=depth, timedRoots=r['timed'],
                search=r['search'], frontierLabelCosts=r['frontierQueries'], exact=r['exact'],
                nativeQueries=r['nativeQueries'], engineeringGames=r['games'], forecast=forecast, resources=resources,
                audit={k:v for k,v in a.items() if k != 'occupancy'},
                strengthResults=None, nomination=None, production='B')
verification_path = run / 'verification.json'
verification = json.loads(verification_path.read_text()) if verification_path.exists() else None
evidence['verification'] = verification
data = ROOT / 'docs/data/frozen-player-engineering-20261029.json'
data.write_text(json.dumps(evidence, separators=(',', ':')) + '\n')

svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="760" height="284" viewBox="0 0 760 284" role="img" aria-label="Engineering evaluator cost only, not playing strength">',
       '<rect width="760" height="284" fill="#fff"/>',
       '<g font-family="system-ui,sans-serif" fill="#172033">',
       '<text x="24" y="29" font-size="19">Frozen evaluators: M4 engineering cost</text>',
       '<text x="24" y="52" font-size="12">Known mobility; median and observed range of 5 rotated repetitions, 16 disclosed roots</text>']
for i, name in enumerate(names):
    x=costs[name]['known']; y=79+i*52; scale=350
    svg.extend([f'<text x="28" y="{y+18}" font-size="16">{name}</text>',
                f'<rect x="64" y="{y}" width="{x["medianUs"]*scale:.2f}" height="27" rx="3" fill="{["#64748b","#2563eb","#0f766e"][i]}"/>',
                f'<line x1="{64+x["rangeUs"][0]*scale:.2f}" x2="{64+x["rangeUs"][1]*scale:.2f}" y1="{y+14}" y2="{y+14}" stroke="#111827" stroke-width="2"/>',
                f'<text x="590" y="{y+18}" font-size="15">{x["medianUs"]:.3f} μs</text>'])
svg.extend(['<text x="24" y="255" font-size="13">No independent scored games: this does not establish which evaluator plays better.</text>', '</g></svg>'])
(ROOT / 'docs/frozen-player-engineering-cost-20261029.svg').write_text('\n'.join(svg)+'\n')

lines = ['# Frozen B/L/P playing-strength screen: preparation and blocker', '',
         '**Independent playing-strength experiment not started: essential PC historical provenance is absent on the M4.** No fresh assessment source or opening was reserved; no scored game or new fit occurred. All earlier scientific evidence remains unchanged. B remains production.', '',
         '29 October 2026. [Scientific protocol](FROZEN_PLAYER_SCREEN_PROTOCOL.md) · [exact PC transfer specification](FROZEN_PLAYER_HISTORY_TRANSFER.md) · [audited machine-readable engineering evidence](data/frozen-player-engineering-20261029.json).', '',
         '## Answers to the scientific questions', '',
         '| Question | Supported answer |', '| --- | --- |',
         '| Does L win more games against B? | Unknown; 0 of 128+64 planned scored games played. |',
         '| Does P win more games against B? | Unknown; 0 of 128+64 planned scored games played. |',
         '| Does the answer change at 80 versus 300 ms? | Unknown. |',
         '| Does P compensate for its evaluation overhead? | Unknown in play. P costs more per evaluation and completed less median depth on disclosed engineering roots. |',
         '| Where do frontier gains fail through minimax? | No new independent transfer evidence. Engineering continuation witnesses passed; historical conclusions are unchanged. |',
         '| Do root regrets predict game outcomes? | Unmeasured. Disjoint assessment and game panels cannot support per-opening predictive correlations without additional predeclared labels. |',
         '| Are there systematic phase differences? | No independent phase claim. Engineering roots and all their timings are published by occupied count. |',
         '| Confirmation, another objective or faster search? | No new strength evidence chooses among them. First complete this already authorized screen after provenance recovery. |', '',
         'These are missing measurements, not evidence that the players are equal, successful or unsuccessful. No confidence interval, significance test or nomination is reported from engineering games.', '',
         '## What completed on the actual M4', '',
         f'The isolated engineering run took **{r["engineeringWallMs"]/1000:.3f} seconds** ({r["engineeringWallMs"]/60000:.3f} minutes), separate from implementation, regression tests, auditing and publication. Scientific active time is **zero**; the four-hour allowance has not started. The complete scientific coordinator/independence and runtime qualification remains pending.', '',
         '* Reconstructed L and P from complete committed coefficients/metadata. Both required checksums match exactly; no fit was run. Verified embedded L, exact weights/specification, support hash and unsupported zero coefficients.',
         '* Used 16 previously disclosed roots, one from each original phase/policy/source-depth cell. They are engineering evidence only; the previous assessment and its outcome remain unchanged.',
         f'* Checked {r["validation"]["states"]} disclosed trajectory states and {r["validation"]["symmetryChecks"]} board-symmetry comparisons, color/perspective transforms, pass/terminal behavior, boundaries 27/28 and 51/52, sparse versus compiled P and zero controls. Maximum sparse/Float32 discrepancy: {r["validation"]["maxSparseDifference"]:.10g}. Zero-table production move/score/node/evaluation/exactness counts match B/L on all 16 roots.',
         '* All 144 full-window versus production fixed-depth comparisons passed at depths four, five and six. Reconstructed 48 selector frontiers, including P-selected ones; every nonterminal witness endpoint was observed in the corresponding root search. Independent shallow mailbox minimax also matched all three evaluators.',
         '* Reverified the native ARM64 teacher: 35 adapter fixtures, seven extrema/pass/terminal fixtures and horizon/color/coordinate regressions; all 32 D10/D12 benchmark-root queries matched the frozen PC numerical references exactly. Eight ten/twelve-empty roots matched both the optimized independent solver and a separate straightforward mailbox reference under both raw/awarded conventions. No engineering fit from the hardware benchmark was rerun.',
         '* Measured 146 D10/D12 queries over the engineering B/L/P frontier union and 96 ordinary timed-root searches. These reused disclosed boards solely to measure cost and verify replay, without independence claims.',
         '* Completed four engineering opening pairs (eight games), one pair per candidate/time-control condition. All moves/final boards/outcomes independently replayed. A separate process exited with status 73 immediately after its first durable move; a new process resumed and completed that game. This verifies durable-prefix recovery, not recovery from every possible mid-filesystem-write or machine failure.',
         f'* Independently audited **{a["taskCount"]} immutable task receipts**, reconstructed every expected input identity, checked source bytes and model identities, numerical teacher/exact references and all game replays. Raw receipts/transcripts stay ignored locally.', '',
         'The legacy adapter preflight records `readyForQualification=false` because that flag requires PC-specific deep engineering receipts bound to its x86 executable. It is not silently changed or treated as Mac failure: native acceptance here uses the previously qualified ARM64 pin, exact PC reference equality and the actual fresh adapter/exact checks. The binary/patch/data identities below bind that interpretation.', '',
         '| Identity | SHA-256 |', '| --- | --- |',
         *[f'| {n} | `{r["models"][n]}` |' for n in ['L','P']],
         f'| ARM64 teacher | `{r["teacher"]["binarySha"]}` |',
         f'| Evaluation data | `{r["teacher"]["evalSha"]}` |',
         f'| Engineering source inventory | `{r["source"]}` |',
         f'| Scientific design | `{r["protocolHash"]}` |', '',
         'The exact executable/source inventory and every task result/file digest are in the compact evidence. New publication/audit code was added after timing; the timed input inventory still matches every original file. No production or historical numerical source was modified.', '',
         '## Evaluation cost and search depth', '',
         'Five rotated repetitions, complete static evaluation including features, on the 16 disclosed roots. Ranges are observed repetition ranges, not confidence intervals. Timing and JIT order can affect these short measurements.', '',
         '| Evaluator | Standalone median μs (range) | Known-mobility median μs (range) |', '| --- | ---: | ---: |']
for name in names:
    x,y=costs[name]['standalone'],costs[name]['known']
    lines.append(f'| {name} | {x["medianUs"]:.3f} ({x["rangeUs"][0]:.3f}–{x["rangeUs"][1]:.3f}) | {y["medianUs"]:.3f} ({y["rangeUs"][0]:.3f}–{y["rangeUs"][1]:.3f}) |')
lines += ['', f'P adds **{100*(costs["P"]["known"]["medianUs"]/costs["L"]["known"]["medianUs"]-1):.2f}%** known-mobility evaluation cost over L on this panel. Production depth-six totals across the same 16 roots were B {sum(x["production"]["elapsedMs"] for x in r["search"] if x["name"]=="B" and x["depth"]==6):.1f} ms, L {sum(x["production"]["elapsedMs"] for x in r["search"] if x["name"]=="L" and x["depth"]==6):.1f} ms and P {sum(x["production"]["elapsedMs"] for x in r["search"] if x["name"]=="P" and x["depth"]==6):.1f} ms. Learned searches visit different trees: total search-time differences cannot all be attributed to static-evaluation overhead.', '',
          '![Engineering evaluation cost, not strength](frozen-player-engineering-cost-20261029.svg)', '',
          '| Evaluator | Budget ms | Median completed depth | Mean elapsed ms | Maximum elapsed ms |', '| --- | ---: | ---: | ---: | ---: |']
for x in depth: lines.append(f'| {x["name"]} | {x["timeMs"]} | {x["medianDepth"]:.1f} | {x["meanMs"]:.3f} | {x["maxMs"]:.3f} |')
move_rows = [m for g in r['games'] for m in g['moves'] if m['move'] is not None]
lines += ['', f'The eight engineering games contain {len(move_rows)} searched placements; maximum measured move overrun was {max(m["overrunMs"] for m in move_rows):.3f} ms, with {sum(m["overrunMs"]>1 for m in move_rows)} moves beyond budget+1 ms. Incomplete iterative-deepening iterations: {sum(m["timedOut"] for m in move_rows)}; depth-zero fallbacks: {sum(m["depth"]==0 for m in move_rows)}. These are telemetry, not independent scientific observations. All eight engineering game move histories, openings, margins, outcomes and counters are published for replay; their scores are excluded from strength inference.', '',
          '## Resources and incomplete forecast', '',
          f'Actual host: macOS/Darwin ARM64, Node {r["machine"]["node"]}, M4 with 24 GiB. Engineering configured workers, conservative admitted safe cap and actual worker count were all **one**. No fitting or labeling competed with timed probes/games. Corrected independent occupancy samples observed at most **{resources["maxActiveNativeSearches"]} native search**, with histogram `{resources["activeNativeHistogram"]}` across {len(samples)} samples. Task IDs and full costs distinguish useful work from occupied slots; no six-worker speedup is assumed.', '',
          f'The free+inactive+speculative physical-memory estimate reached a sampled minimum of **{resources["minimumAvailableEstimateGiB"]:.3f} GiB**; swap-in/out deltas were **{resources["swapinPagesDelta"]}/{resources["swapoutPagesDelta"]} pages** over the sampled window. Node peak RSS was **{resources["nodeMaxRssBytes"]/2**20:.1f} MiB**; metered native peak RSS was **{resources["maxMeasuredNativeRssBytes"]/2**20:.1f} MiB**. Sampled counters do not exclude unsampled transients or prior compression. Initial disk availability was about 606 GiB. Temporary `caffeinate -i -s` covered engineering only and exited; no saved settings or unrelated processes changed.', '',
          f'Node coordinator CPU was {(r["cpu"]["user"]+r["cpu"]["system"])/1e6:.2f} seconds, excluding separate child/restart CPU. Accepted wait4-metered native tasks used {resources["measuredNativeCpuSeconds"]:.2f} CPU seconds; unmetered adapter calls and Python wrapper CPU are excluded. Occupancy logging began after engineering started; its sample window is disclosed in JSON.', '',
          'The first external monitor counted a Python resource wrapper as another active native search because it matched the executable anywhere in argv. The audit retained the raw samples and corrected classification using argv[0]; the corrected count never exceeds one. This was a telemetry classification defect, not concurrent teacher searches or game contention.', '',
          f'The conservative **measured-core component estimate** is {forecast["componentTotalMs"]/3600000:.3f} serial hours, or **{forecast["with35PercentAndReportingMs"]/3600000:.3f} hours with 35% contingency and a separate 15-minute reserve**. Games alone reserve {game_bound_ms/60000:.2f} minutes: all possible 52 placements at the declared budgets, +1 ms/move and +1 second/game overhead. The JSON gives measured phase/tail assumptions for every included component. This is **not a qualified full forecast**: source admission/rejection under the missing index, complete reservation memory, the scientific coordinator/recovery/overlap pipeline and full analysis/audit/report cost are unmeasured. No scientific launch was authorized by this calculation.', '',
          '## Provenance blocker and remaining implementation', '',
          'None of the six required historical campaign directories is present. The old compact binary index and its inventory are also absent. Committed summaries contain model coefficients and disclosed roots, but lack the complete direct-target/source/family/role registry. The PC final coverage audit already established 1,326 additional engineering-game keys missing from its frozen index. Copying that old binary alone would repeat a known coverage defect.', '',
          'The required transfer is a compact **audited new export** of full-SHA membership, all-occurrence roles/provenance, source-family ancestry, seeds and unused reservations, plus complete hashed inventory and legal-replay/coverage/preservation audits. The [transfer specification](FROZEN_PLAYER_HISTORY_TRANSFER.md) lists exact runs, receipt/checksum anchors, the missing-game digest, data fields and a read-only inventory command. No multi-gigabyte raw dataset or refitted model is needed on the Mac. Role metadata must be derived on the PC; it cannot be invented from published counts.', '',
          'Prepared implementation covers exact model reconstruction, deep-frozen design/384-game schedule, complete-source slot balance, production game telemetry, independent prefix/full replay, atomic move checkpoints, immutable receipts, real subprocess restart, pair-level t/bounded inference and tested joint bootstrap/nomination primitives. Admission, compact role-index import, sealed result release, overlap classification, complete diagnostic/statistical coordinator and scientific launcher remain **unimplemented/unqualified pending inspection of the real PC provenance formats**. The historical gated runner is incompatible and must not be used as a substitute. Sample identities have deliberately not been claimed frozen.', '',
          '## Failures, regression checks and reproduction', '',
          'No native numerical mismatch, search correctness failure or engineering-game crash occurred. The intentional status-73 exit is a recorded restart probe. No old experiment was resumed or repaired. Windows/WSL2 and Intel macOS hardware were not exercised in this round; this is actual Apple Silicon engineering validation. Browser interaction was unchanged and not retested.', '',
          'The first Python regression invocation failed the historical benchmark portability test: it assumed the live checkout inventory still differed from the old PC only in four portability files. New experiment scripts correctly invalidate that historical equivalence. The test now constructs the explicit historical portability-only inventory and still rejects new scientific/numerical files. The benchmark comparator and old published source inventories remain unchanged. Final test results are recorded below after a stable-source run.', '',
          '```bash',
          'caffeinate -i -s node scripts/frozen-player/qualify.mjs \\',
          '  .local-research/frozen-player-screen-v1-20261029/engineering',
          'node scripts/frozen-player/audit-engineering.mjs',
          'python3 scripts/frozen-player/publish.py',
          'npm test',
          "TMPDIR=/private/tmp python3 -m unittest discover -s tests -p 'test_*.py'",
          'git diff --check', '```', '',
          'The engineering directory binds its original timed source inventory; later new audit/publication files make a fresh qualification directory necessary for a new full timed qualification. Existing completed receipts remain immutable and auditable. The commands are engineering tools, not a scientific launch command.', '',
          '## One scientific next step', '',
          '**Recover and verify the compact PC provenance package, then complete and execute this same frozen-player screen.** There is no new playing evidence that justifies choosing a candidate, paying for another learner, blaming the objective/representation/search cost, or starting a larger tournament. Once the fixed screen is actually complete, apply its unchanged nomination rule and use fresh separately powered confirmation if warranted. Until then the main question remains unanswered.']
if verification:
    location = lines.index('## One scientific next step')
    lines[location:location] = [f'Final stable-source regression verification: **{verification["javascriptPassed"]} JavaScript tests and {verification["pythonPassed"]} Python tests passed**, plus the 485-receipt native/engineering audit, report-link/SVG checks, original ledger byte-prefix check and `git diff --check`. The historical launcher tests print nonfatal subprocess ResourceWarnings. These test-only temporary launches do not constitute a scientific campaign.', '']
(ROOT / 'docs/FROZEN_PLAYER_SCREEN_RESULTS.md').write_text('\n'.join(lines)+'\n')
print(json.dumps({'data': str(data.relative_to(ROOT)), 'bytes': data.stat().st_size,
                  'status': evidence['status'], 'componentEstimateHoursWithReserve': forecast['with35PercentAndReportingMs']/3600000}))
