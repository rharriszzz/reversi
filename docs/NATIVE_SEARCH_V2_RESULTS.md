# Native search V2: engineering results and registered P versus B comparison

The qualified engine completes the disclosed fixed-search batch **1.14× faster
for B and 1.44× faster for P** than the previous native production engine.
A separately rotated nine-repetition history measures 1.18× and 1.47×.
The depth-14 timed ceiling is removed: controlled 300 ms trials complete depth
15, including exact solutions that the capped search cannot certify.
**This engineering checkpoint contains no scored tournament outcomes.** The
complete 2,048-game native P-versus-native B comparison is the next frozen stage.
B remains production, and every B/L/P coefficient and previous result is intact.

[Prospective scientific contract](NATIVE_SEARCH_V2_PROTOCOL.md) ·
[complete compact engineering evidence](data/native-v2-engineering-20261030.json) ·
[evidence reproduction](data/native-v2-engineering-20261030.mjs).

![Qualified complete searches, evaluation cost, profiles and ceiling effects](native-v2-engineering-20261030.svg)

## Retained changes

1. Ordinary native timed requests use the number of empty squares as their
   iterative placement-depth limit. Deadline interruption returns the last
   completed iteration; an exact result stops early. Passes retain placement
   depth, and terminal checks still precede horizon evaluation. Explicit fixed
   depths 1–64 and qualification windows 0–64 preserve their specified horizons;
   a fixed search may also have an independent diagnostic node budget. Protocol
   version 1 is retained; timed depth 0 requests the natural limit. Omitting
   depth in Node/Python timed calls and ordinary native playing selects it.
   JavaScript/browser search is unchanged. TT placement depth is now unsigned
   with explicit 0–64 validation; 64 is the board's natural maximum, not another
   arbitrary timed ceiling. Recursion has at most 64 placements with intervening
   passes and no heap allocation per node. Already terminal boards need only
   terminal detection, regardless of their requested fixed horizon.
2. Depth-zero nodes bypass hashing and TT probes. They still generate legal
   moves, distinguish forced pass from double-pass termination, and count actual
   static evaluations and heuristic horizons. They never stored useful entries.
   The full fixed trees, scores, evaluations, hits and bound cutoffs are unchanged.
3. Pattern occupancy is gathered into a three-by-three corner region or an edge
   byte. Small constexpr integer contribution tables encode ternary weights;
   file bytes use masked unsigned multiplication. The 16 geometry tables total
   at most 12 KiB before compiler merging. These are integer geometry tables,
   not changed evaluation weights. All original Float32 cells, phase boundaries,
   color coding, normalization, symmetry order and ordered double summation
   remain exact. No incremental state or evaluator redesign was introduced.
4. Added cheap TT stores/rejected-stores and first-move-cutoff counters. All
   score reuse still requires full board/turn identity, same placement horizon
   and current generation. Requested TT capacity remains 16 MiB, allocating
   262,144 forty-byte entries, exactly 10 MiB. No replacement policy was tuned.

Parallel-prefix directional fills and branchless propagated flips passed the
reference checks but failed to produce a worthwhile overall gain. They were
reverted. The simpler original directional rule kernels remain. Reproducible
patches for every tried variant are under `scripts/native-v2/variants/`; the
history runner rebuilds them from commit b05e903 without altering that commit.

## Correctness and integration qualification

All **160 JavaScript tests and 38 Python tests pass**. Fifteen native regression
groups pass ASan/UBSan. The broad qualification checks 2,007 legally replayed
positions, **12,042 static queries**, **96,720 independent legal children**,
96 fixed-depth JavaScript comparisons, and twelve independently solved endgames.
Observed maximum feature, B/L/P static and minimax error is **zero**; the declared
cross-language regression tolerance remains absolute 1e-10.

New checks enumerate every occupancy of each of the 16 pattern geometries at
all phases: **174,960 complete ordered pattern-sum comparisons** against the
original digit-by-digit formulation. Additional arbitrary-board and long-ray
fixtures exercise all directions, masks, wraps and flipping lengths. Tests cover
fixed depths 15, 16 and 64; every legal alternative of independent exact fixtures;
zero-horizon forced passes; terminal empties; actual depth above 14; interrupted
iterations; independent fixed node budgets; model/horizon changes; one-slot TT
collisions; narrow/full bounds; generation rollover; cancellation and restart.
Existing bit-for-bit exports verify all 21,870 Float32 cells and 63 double weights.

A real coordinator exit after a durable move, fresh processes, independent replay
and corrupt-prefix rejection qualify the new B/P pipeline. Competitors have
separate processes/TTs within each game; both restart and receive symmetric
model-specific warmup before every game. No cross-game TT history is inherited.
Checkpoints fsync the file, rename it and fsync its directory. All full game and
per-move metrics are retained locally; source/model/build identities are checked.

Two earlier engineering test invocations failed while preparation code was still
being written, including a legacy frozen-source mismatch and two nested smoke
failures. The standalone legacy smoke then passed; the complete unchanged-source
suite subsequently passed all 38 tests. Test-only restart probes now use 5 ms,
so millisecond deadline quantization does not make a 1 ms probe unreliable.
No scientific game or old result was changed. Legacy Python launcher tests retain
their known nonfatal subprocess ResourceWarnings and expected argument-rejection
messages. Native macOS ARM64 execution is tested; no new Intel, WSL2 or native
Windows execution is claimed. The dependency-free browser implementation and
its UI regressions pass; this work does not add browser/Wasm acceleration.

Frozen models are B `original-production`, L
`ecf3fd376c680ced77d0b002ea2efb9fa4385737c4fffff734b901ab2968d97f`, and P
`de4b84745589b0384ea3639f879e3c98990e802d176298ff8ef54f681520067f`.
The qualified production executable SHA-256 is
`0a0e1f0d92e5a6540a2c533eb673930f80d94b5385deaae5c19843ca61efc720`;
previous-engine production SHA-256 is
`57292de408d2b2cd34babe176af01a495b4e514001102c054c2f306292912451`.
Complete source/header/build fingerprints, compiler and flags are in the evidence.

## Complete-search benchmarks

M4 iMac, 24 GiB, Apple Clang 21.0.0, optimized C++17 with contraction and fast-math
disabled. Thirty-six fixed disclosed roots cover opening, middle, 12–20-empty
late positions, forced pass and terminal empties. Both models use fixed depth
8 in opening, 7 in middle and min(10, empties) in the endgame. Seven rotated
repetitions alternate implementation order; hints are disabled so previous
requests cannot change tree size. All 504 matched searches have identical
scores, nodes and evaluation counts. CPU and interface times accompany every row.

| Complete batch / metric | Previous B | V2 B | Previous P | V2 P |
| --- | ---: | ---: | ---: | ---: |
| Median search ms | 75.705 | 66.331 | 165.990 | 115.030 |
| Seven-batch min–max ms | 74.573–79.612 | 65.786–66.603 | 162.456–174.527 | 113.867–118.585 |
| Nodes per batch | 1,230,233 | 1,230,233 | 2,027,718 | 2,027,718 |
| Static evaluations per batch | 841,839 | 841,839 | 1,438,599 | 1,438,599 |
| Search million nodes/s | 16.25 | 18.55 | 12.22 | 17.63 |
| Complete static evaluation ns | 19.44 | 19.43 | 49.84 | 26.59 |
| Static million evaluations/s | 51.44 | 51.47 | 20.06 | 37.61 |
| TT probes per batch | 1,230,233 | 385,040 | 2,027,718 | 585,424 |
| TT bound hits / cutoffs | 43,196 / 37,614 | same | 67,658 / 56,267 | same |
| Alpha-beta cutoffs | 242,249 | same | 376,542 | same |

Static times include all features and legal mobility, averaged over position
medians. They are repeated-position microbenchmarks, not whole-game rates.
V2 B stores/rejects 339,954/5,280 entries; P 513,737/13,362. Replacement counts
are 275,534 and 429,383. First-move cutoffs are 180,520/242,249 for B and
236,937/376,542 for P. No new inference about playing strength follows from them.
Median warmed empty round trip is **13.50 μs previous / 12.92 μs V2**. Per-request
startup, CPU, observed transport and deadline data are published. Tiny solved
queries remain dominated by the boundary; ordinary 80/300 ms searches amortize it.

A second nine-repetition rotation tests all intermediate sources under identical
production flags. Median batch ms:

| Variant | B | P | Decision |
| --- | ---: | ---: | --- |
| Previous engine | 77.269 | 165.346 | Reference |
| Skip depth-zero TT | 64.880 | 146.692 | Retained |
| Plus geometry tables | 64.500 | 110.794 | Retained |
| Plus parallel legal fills | 64.240 | 111.811 | Reverted: no useful overall gain |
| Plus propagated flips | 66.596 | 113.987 | Reverted |
| Final, including extra counters | 65.459 | 112.673 | Frozen |

P's static cost is now about 1.37× B in this panel, versus 2.56× before.
Different evaluators still generate different trees, so this does not predict the
winner. Small B differences between pattern/no-pattern code are layout/noise,
not mathematical work saved for B. Early candidate screens used a frame-pointer
baseline; their raw local evidence remains, but the tables above use matched
production flags. No gain is attributed to profiling instrumentation.

## Quantitative CPU profiles

Four-second macOS sampling captures roughly 3,350–3,440 self samples per workload.
Opening/middle are complete P searches; endgame repeatedly solves the same
12-empty root, reducing the IPC dominance of the earlier six-empty microquery.
The optimized sample build adds symbols/frame pointers; final throughput above
uses separate uninstrumented production builds.

| Work / self sample share | Old opening | V2 opening | Old middle | V2 middle | Old exact endgame | V2 exact endgame |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Search / TT / ordering combined | 31.9% | 41.7% | 22.6% | 31.1% | 31.0% | 30.7% |
| Legal moves | 12.8% | 18.6% | 14.5% | 23.7% | 36.9% | 39.1% |
| Flips | 16.8% | 19.5% | 11.9% | 18.9% | 23.7% | 22.2% |
| Linear features and evaluator wrapper | 7.3% | 10.3% | 8.8% | 13.6% | ~0 | ~0 |
| Patterns | 30.6% | 8.9% | 39.5% | 10.7% | ~0 | ~0 |
| Other / protocol / waits | 0.6% | 1.1% | 2.7% | 2.0% | 8.4% | 8.0% |

Fractions are workload-dependent self samples, include waits, and are **not**
additive CPU-cycle guarantees. A growing legal/search fraction after removing
pattern work does not show a slowdown there. Separate exclusive instrumentation
splits legal, flips, seven features, patterns, TT and ordering, with call counts
and nanoseconds retained. It substantially perturbs this fast core and is used
for attribution only. TT's share of instrumented spans falls from 18.9% to 13.2%
in opening and 16.8% to 9.9% in middle; these percentages must not be substituted
for production speedups. Uninstrumented sampling cannot cleanly separate inlined
hashing, alpha-beta and ordering; that resolution limit is explicit.

An eight-second Instruments `CPU Counters` recording succeeded. Its local trace,
status and log are retained. No unsupported raw cache-miss or allocation-rate
numbers are inferred from the guided counters. The recursive core still allocates
no heap memory; parsing and result formatting allocate outside search.

## Removing the ceiling: controlled effects

Three repetitions, both models, both budgets and all 36 roots yield 432 matched
conditions, each measured with old code capped at 14, new code capped at 14 and
new code using the natural maximum. Every variant starts a fresh process and
identical disclosed depth-three warmup, avoiding inherited ordering histories.

| Model / budget | Trials stopped by old-style V2 cap, unsolved | Natural search completed above 14 | Newly exact among cap-stopped trials |
| --- | ---: | ---: | ---: |
| B / 80 | 3 / 108 | 0 | 0 |
| P / 80 | 3 / 108 | 0 | 0 |
| B / 300 | 24 / 108 | 15 | 6 |
| P / 300 | 21 / 108 | 6 | 6 |

Maximum completed depth is 15 in this panel. All above-14 results add one placement;
remaining time does not always suffice to complete another iteration. At 300 ms,
mean depths old/V2-capped/V2-natural are B **10.630/10.648/10.796**, P
**10.333/10.361/10.417**. At 80 ms they are B **9.889/9.935/9.926** and P
**9.583/9.750/9.750**; millisecond quantization and scheduling produce small
marginal differences. Late depth averages include solved positions with few
empties and cannot be treated as pure strength measurements. Independent fixed
endgames and explicit deep-horizon regressions qualify the depth semantics.
A prior warm-history timing pilot remains local and is not mixed into this panel.
Actual game depths will be reported after the complete fixed tournament.

## Scientific stage and remaining work at this checkpoint

The engine and scientific code are ready for independent registration. The full
sample is fixed at 768 color-swapped families at 80 ms and the cycle-modulo-three
256-family subset at 300 ms: 2,048 games. Source namespaces, role-aware historical
exclusions, statistical methods, isolated native state, checkpoints and stopping
rules are defined prospectively. Preparation measures eight disclosed complete
native B/P games and admits fresh complete trajectories. Before scored play,
a conservative full-work forecast must fit eight hours with 35% contingency and
an additional 20-minute reporting reserve. Separate Python admission verification
and a committed public registration are required. No scored outcomes have been
opened, and no superiority claim is made at this engineering checkpoint.

The final revision of this report will add every game, paired inference, phase
telemetry, thinking-time contrast, provenance limitations, resource/runtime audit
and evidence-based next action. It will not change the frozen engine or sample.

## Ranked remaining opportunities

These are estimates from measured bottlenecks, **not promised speedups**.

| Priority | Evidence and possible work | Potential complete-search gain | Complexity / correctness risk |
| --- | --- | --- | --- |
| 1 | Search/TT/order is 31–42% of V2 opening/middle samples. Test a compact bucket layout and replacement/locality policy, keeping full identity and exact horizon rules. | Approximately 3–15%; pruning changes may matter more than NPS | Medium; bound/generation/collision risk requires full requalification |
| 2 | Legal/flips together are about 38–43% early/middle and 61% in exact endgames. Investigate well-targeted final-empty specializations; the broad propagation trials here did not help. | Approximately 0–10% early, potentially 5–20% exact workloads | Medium; edge masks, terminal empties and passes are principal risks |
| 3 | Cheap ordering or principal-variation search could reduce visited nodes; present static corner ordering leaves many non-first cutoffs. | Unmeasured and tree-dependent, plausibly 0–20% | Medium/high; window re-search and exactness must preserve minimax |
| 4 | Patterns now occupy only 9–11% of sampled early/middle work. Further grouped/incremental gathers have less headroom. | Likely 0–5% overall | Medium; update cost and summation/index correctness can erase benefit |
| 5 | Linear feature math/wrapper is 10–14%, with mobility counted separately. Reuse mobility where callers truly already know it. | Roughly 1–4% | Low/medium; exact normalization and phase rules stay fixed |
| 6 | Empty round trips are ~13 μs; tiny exact queries show transport overhead. Batch research reference requests if a pipeline needs them. | Negligible timed-game gain; useful tiny-query throughput possible | Low for batching; no protocol expansion justified for ordinary play |
| Separate | Browser still uses JavaScript. Qualify a worker/Wasm ABI and matching mutable-model/coaching semantics separately. | Browser benefit unmeasured | Medium/high integration risk; native numbers are not Wasm measurements |

## Reproduction

Use a fresh ignored output directory for new measurements; never overwrite the
retained run or describe this disclosed panel as new independent evidence.

```bash
npm test
NATIVE_SANITIZE=1 node --test tests/native-search.test.mjs tests/native-v2.test.mjs
TMPDIR=/private/tmp python3 -m unittest discover -s tests -p 'test_*.py'
NATIVE_RUN=.local-research/native-v2-repeat node scripts/native-v2/history-benchmark.mjs
node docs/data/native-v2-engineering-20261030.mjs .local-research/native-v2-20261030
.local-research/frozen-player-screen-v1-20261029/plot-venv/bin/python \
  docs/data/native-v2-engineering-figure-20261030.py
git diff --check
```

The history runner reconstructs the previous source from Git, so the original
baseline binary is unnecessary. Primary matched benchmarking/timing additionally
requires the explicitly preserved baseline build receipt; profiling uses macOS
`sample` and optional Instruments. Normal build/play remains Python 3 plus a modern
browser, with Node 20+ for tests/research and C++17 only for the opt-in native core.
