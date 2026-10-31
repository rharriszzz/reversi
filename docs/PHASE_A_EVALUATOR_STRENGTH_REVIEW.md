# Phase A: strength evidence and a proposed minimum confirmation

Read-only review, 2026-10-31, after qualified UI cleanup `1d94a3a67598580e92d274b52e15df8bdd2d115c`.
**No new tournament, training, source admission or teacher query was started.**
This is a proposal for review, not a registered experiment or execution approval.

## What the evidence establishes

The [frozen P confirmation](P_CONFIRMATION_RESULTS.md) supplies substantial
statistical evidence against B on its registered opening distribution:

| Time | Independent opening-family pairs | P points | One-sided 97.5% Student lower | Hoeffding lower |
| --- | ---: | ---: | ---: | ---: |
| 80 ms | 768 | 63.5742% | 61.37% | 58.6736% |
| 300 ms | 256 | 61.7188% | 57.92% | 53.2306% |

Both registered tests and bootstrap sensitivities pass. The nested 300 ms
subset is dependent on the 80 ms sample; neither individual games nor moves are
extra independent observations. This review independently recomputed means,
pair variances (0.09652722 / 0.09503676) and Hoeffding bounds from the committed
1,024 pair rows. It did not repeat the raw historical archive audit. Statistical
power is not the missing gate. Results remain conditional on source-family
sampling, runtime stability and the admitted opening distribution, against B only.

The [prospective contract](P_CONFIRMATION_PROTOCOL.md) also prohibited reuse of
historical direct targets/assessment states, including older experiments. Source
admission passed; later played paths diverged from the reserved generation paths.
The [focused outcome-blind audit](data/p-confirmation-historical-target-audit-20261030.json)
proves one distinct **nonterminal two-empty board**, represented by two conservative
turn keys, was reached by family `games-337`, `game-395`, at occupied 62. It is
`states[42]` of accepted old training game `train-22614-1035056215`, shard 2826.
The archived learner sampled even state indices; completed applied fit
`cycle-36-fit-linear-margin-p4-2823`, its receipt and the final cursor establish
actual fitting use. This was an **older linear-margin evaluator**, not frozen P
or its nested frozen L. It was not merely an intended training role on a rejected
source. The two keys do not represent two independent leaked boards.

The audit reports **zero matches to the verified direct L/P training/development
panels**. Thus this finding does not establish that P trained on the board, that
its model contains that target, or that the overlap caused its advantage. The
other **63 identities remain conservatively restricted or unresolved**, not 63
proved gradient-training leaks. The failed broader provenance condition still
blocks the requested independent-confirmation claim. Confidence intervals cannot
repair that contract, and an audit of known panels is not proof of universal
historical completeness. Keep every game and the original failed gate; do not
remove affected families or redefine the old criterion after outcomes.

The [earlier screen's role audit](data/frozen-player-overlap-role-audit-20261029.json)
is different: it checked 2,000 actual L/P panels / 76,274 direct-state keys and
resolved false flags from rejected generators and a derived game-key list.
Its 18 adjudications do not clear the later confirmation's 65 flags. The earlier
[residual experiment](NEXT_RESIDUAL_RESULTS.md) also retains its separate four-source
teacher-PV independence failure and failed positional gates.

Model names must not conflate experiments. The old
[strong campaign](STRONG_EVALUATOR_RESULTS_20261028.md) linear-preference results
44.43%/47.07%, and [long-pattern screen](NEXT_EVALUATOR_RESEARCH.md) negatives,
concern different models from today's L/P. For actual frozen L,
[the B/L/P screen](FROZEN_PLAYER_SCREEN_RESULTS.md) reports 47.27%/39.84% against B;
it establishes no L superiority. P's screen nominated it for confirmation.
Later [native V2 evidence](NATIVE_SEARCH_V2_RESULTS.md) is favorable too
(65.76%/63.48%, 2,048 games), but retains a distinct old **development-query**
encounter and 48 unresolved keys. It neither repairs the earlier failure nor
forms a pooled independent sample. Different engines/time horizons/hardware
also limit transfer to current browser strength. No absolute rating or universal
B/L/P strength order follows.

## Smallest useful next step and proposed experiment

**First resolve provenance, without playing games.** Review the existing 63
flags and later native restrictions against actual accepted reservations, fit
and selection receipts, rather than generator-intended roles. Preserve all
occurrences and ambiguous restrictions. Reuse verified sorted full-SHA membership
and role records, add every later research reservation/trajectory, direct target,
assessment, played path and available engineering fixture/path, and enumerate
coverage gaps. Bind inventories and canonical D4/color/both-turn identities.
The PC has original strong/residual corpora, but the documented Mac
`pc-import-20261029` and `p-independent-confirmation-v1-20261029` run directories
are absent here. Verified Mac index/role/receipt updates must be available before
certifying a complete PC exclusion set. A committed summary is not that index.

Keep the strict prohibition on all known nonterminal historical direct targets
and assessment states, including unrelated old fits. Separate it from permitted
incidental internal/terminal convergence prospectively. If a narrower causal
claim about data influencing P is desired instead, that requires an explicit new
policy reviewed before outcomes; it cannot make the old broad contract pass.
Root exclusions cannot guarantee future played-path novelty. Any prohibited or
unresolved encounter in the new audit blocks confirmation of the **whole** fixed
sample; no outcome-dependent rejection, replacement or clean-subset inference.
Under this strict policy another clean tournament is not guaranteed.

After that gate, the recommended minimum scope is **P versus B only, 256 new
families at 80 ms, both colors: 512 games**. It tests a single, narrower claim
of superiority at 80 ms. L adds no necessary contrast. A 300 ms durability
confirmation remains necessary before any two-budget promotion recommendation;
this small test alone cannot satisfy the old two-budget contract.

- Freeze current qualified production native dispatch source/build, B/P complete
  identities (P `de4b8474…`, including nested L), rules, utility, TT/warmup,
  natural timed depth limit and deadline behavior. No fitting or search changes.
  This tests the WSL2 native player, not a browser-specific Elo claim.
- Before outcomes, publish literal opening boards, complete source paths, new
  seed namespace, admission/rejection log, hashes, shuffle and color/order schedule.
  Retain the documented B1/12% and B4/2% generation mixture and 12/13-occupied
  starts: 16 policy/parity/actual-turn/first-color cells, 16 families per cell.
  Use fresh independent families; symmetry/color variants are not new samples.
  Check historical and mutual ancestry from occupied 12, roots and every legal
  root child. No root or seed is generated by this review.
- Serial games, identical 80 ms search limits, both colors adjacent per family,
  symmetric disclosed-root warmup and isolated player TT/process lifetimes.
  No concurrent fitting/labeling/tests. Preserve legal paths, receipts, depth,
  nodes, evaluations, elapsed time, fallbacks and overruns. Replay games and
  provenance with a separate Python path **before opening aggregate scores**.
- One primary endpoint: mean of complete pair scores, win/draw/loss points
  1/.5/0. Fix n=256 and one-sided alpha=.05. Require integrity plus
  `mean - sqrt(log(20)/(2*256)) > .5`; also require the predeclared approximate
  Student 95% lower bound positive relative to .5 and report 10,000 seeded
  whole-family bootstrap resamples within the 16 strata as sensitivity. No interim testing, sample
  extension, pooling with old results or rescue by another metric. Report all
  disagreements. Hoeffding assumes independent bounded family scores and stable
  execution; source disjointness alone is not a universal independence proof.
- The bounded radius is **7.65 percentage points** (pass requires >57.65% points).
  Using old pair SD about .31 gives approximately 89% planning power for a true
  +10 pp effect; this normal approximation is not a guaranteed power bound.
  At 128 pairs the radius is 10.82 pp and planning power at +10 pp only about
  38%. Hence 256 is a practical minimum for this aim, not a mathematical minimum
  for every possible effect. Modest +5 pp improvements will often be inconclusive.
- Proposed **two active hours total**, including provenance preparation,
  qualification, admission, games, replay/statistics and reporting. Before scored
  launch require `1.35 × complete conservative raw forecast + 15 minutes <= 120
  minutes`, using only disclosed historical engineering cases for calibration.
  At most 52 placements/game gives about 35.5 nominal search minutes for 512
  games; this excludes overhead and soft deadline overruns and is not a measured
  completion promise. If archive preparation/qualification cannot fit, stop
  before outcomes. Never shrink n to meet the cap. Check resources, checkpoint
  complete pairs and validate interrupted prefixes; a cap hit yields incomplete
  evidence, not a confirmatory partial-sample result.

No launch is authorized by this proposal. B remains the player default; P's
favorable statistical evidence is retained for scientific review.
