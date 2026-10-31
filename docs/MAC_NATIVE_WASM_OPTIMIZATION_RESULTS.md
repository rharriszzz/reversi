# M4 Mac native/Wasm modernization and optimization qualification

This report is in progress. Stage 1 qualifies current shared source on the M4;
optimization experiments and the frozen final acceptance campaign follow in
separate checkpoints. No evaluator is trained or promoted. Historical P/B
results and their provenance restrictions remain intact.

## Stage 1: environment and current-source qualification

The clean Mac checkout was fetched with `git fetch origin` and fast-forwarded
with `git merge --ff-only origin/main`, from `c605503` to `7dfb056`. There were
no unrelated working-tree changes. Both requested PC commits are present.

Actual hardware: iMac Mac16,3, Apple M4, ten cores (four performance, six
efficiency), 24 GiB RAM. macOS 27.2 / build 26B123; Xcode/Instruments 27.2,
Apple Clang 21.0.0. No GCC installation or OS upgrade was necessary. Initial
free disk was about 519 GiB. Spotlight and Time Machine were initially busy;
timing was deferred. Memory pressure was normal, estimated readily reclaimable
memory approximately 8.5–8.8 GiB and allocated swap 0.38 MiB. macOS provides no
Linux-style MemAvailable; the recorded estimate is explicitly described in
the resource certificate. Historical swap allocation is not a swapping rate.
No applications, services, power, security or browser preferences were changed.

| Tool | PC | Qualified Mac selection |
| --- | --- | --- |
| Python | 3.14.4 | **3.14.10**, `.venv/bin/python`, ARM64 |
| Node | 24.16.0 | **24.22.1**, existing MacPorts |
| npm | 12.0.2 | **12.2.1**, user-scoped, selected by `.venv` activation |
| Codex CLI | 0.166.0 | **0.166.0**, existing user installation |
| Playwright / WebSockets | 1.64.1 / 15.0.1 | Same versions |
| NumPy / Matplotlib | 2.5.4 / 3.11.2 | Same versions |
| Emscripten | qualified 4.0.22 artifacts | **4.0.22**, existing user SDK, LLVM 22 |
| Native compiler | GCC 15.2 | Apple Clang 21; features/numerics qualified independently |
| Actual browser | Chrome 156.0.8078.48 | Chrome **156.0.8078.74** |
| Safari | not applicable | 27.2, automation qualification pending |

MacPorts 2.12.7 offers Python 3.14.10, but installation requires an unavailable
administrator password. A single user-managed Astral standalone CPython was
installed with a local uv 0.13.6 bootstrap instead. Apple's Python and MacPorts
selections remain untouched. Existing research venvs retain their historical
Python 3.13 metadata; active project work selects `.venv`. Minimum supported
Python remains **3.13**. See [interpreter setup](PYTHON_ENVIRONMENT.md) and
[exact Mac developer dependencies](../requirements-dev-mac-20261030.txt).

`sys.executable`, `sys.version`, prefix/base prefix, PATH, dependency versions,
Node-to-Python selection and actual Emscripten Python subprocess observations
are recorded in the [Stage 1 certificate](data/mac-stage1-qualification-20261030.json).
All direct Python tests, browsers, reports and benchmark commands use `.venv`;
Python children use `sys.executable`. Node and SDK wrappers select that same
interpreter. No assumption is made from the shell's bare `python3` alone.
`pip check`, imports, Playwright startup and actual browser automation pass.

Two clean production Wasm compilations produce byte-identical manifests and
artifacts, including the current shared completed-iteration correction. An
additional Python-audited build is identical. Old build identity
`5dab45b8a8edfae11a0c9b3821f296a3ee6d06ed5f52c9394cef4e95d9cb1cef`
and its artifact hashes are preserved in the certificate. New build identity:
`2f1bd1d7fc0ce143969cb2cde9b1175aeb09c7b42e492f24b09d37f5f662dc37`.
B/L/P coefficients, model identities, ABI 1, numerical tolerance 1e-10,
floating-point restrictions and bounded memory remain unchanged.

The initial fast panel exposed a real Mac concurrent-build publication race:
separate temporary Mach-O link outputs can have different hashes. Atomic rename
alone did not make both client receipts coherent. Native builds now serialize
cache lookup/compilation/publication per output directory, reclaim only a
recorded dead owner's lock, and retain atomic output publication. A real
three-process fresh-build regression passes. No search mathematics changed.

Stage 1 passes **171 Node tests**, **39 Python 3.14 tests**, **15 ASan/UBSan
groups**, 23 targeted build/native/Wasm tests and the compiled-Wasm standalone
assertions. Broad native qualification checks **2,007 positions, 12,042 static
queries, 96,720 legal children, 96 fixed searches and 12 independent endgames**;
all recorded numerical errors are zero. Wasm qualification includes all B/L/P
cells/weights, full-window alternatives and optimal PV steps, terminal empties,
forced passes, horizons 15/16/64, interrupted iterations/null fallback,
collisions, generation rollover and bounds/model/horizon isolation.

Actual installed Chrome passes B/L/P coaching, complete B/P games and review,
timed play, undo/replay, cancellation/recreation, reload, fallback/refusal,
injected ABI failure/recovery, and the separate custom-weight persistence,
training/export/full-game/review check. SDKs, venvs, local binaries, browser
profiles, raw traces and personal exports are not committed. Existing nonfatal
Python HTTPError ResourceWarnings remain visible.

Reproduce Stage 1 from the repository, in macOS zsh/bash or WSL2 bash with
appropriate installed tools (these Mac results do not newly test WSL or Intel):

```bash
source .venv/bin/activate
python -m pip check
node scripts/native/build.mjs
node scripts/wasm/build.mjs
node --test tests/native-build.test.mjs tests/native-search.test.mjs tests/native-v2.test.mjs tests/wasm-engine.test.mjs
node scripts/wasm/internals.mjs
NATIVE_RUN=.local-research/mac-stage1 node scripts/native/qualify.mjs
npm test
python -m unittest discover -s tests -p 'test_*.py'
NATIVE_SANITIZE=1 node --test tests/native-search.test.mjs tests/native-v2.test.mjs
REVERSI_BROWSER_CHANNEL=chrome python tests/wasm_browser_check.py
REVERSI_BROWSER_CHANNEL=chrome python tests/browser_check.py
```

## Optimization experiments and independent candidate qualification

The reference is copied shared source from Checkpoint 1 (`43e52d2`), built with
identical Apple Clang production flags, frozen header and CPU target. Its local
executable/receipt remain reproducible, without using a research model export.
The panel contains the existing 36 phase/pass/terminal roots plus twelve new
seeded exact roots with 8–12 empties. Every board, seed, placement horizon, build
identity, repetition and counter is preserved in
[compact experiment matrices](data/mac-optimization-experiments-20261030.json).
Nine serial repetitions rotate/reverse build order after a complete warmup;
B/P order alternates. No other computational experiment runs concurrently.

| Initial complete-batch median ms | Baseline | Last one | Last two | Compact TT | Last two + compact |
| --- | ---: | ---: | ---: | ---: | ---: |
| B, all 48 roots | 96.763 | 90.100 | 89.613 | 98.184 | 91.676 |
| P, all 48 roots | 141.502 | 135.321 | 135.435 | 143.814 | 137.040 |
| B, twelve exact roots | 33.308 | 25.802 | 23.638 | 34.181 | 24.206 |
| P, twelve exact roots | 32.243 | 24.877 | 22.964 | 33.058 | 23.373 |

**Retain last-one/two handling.** One empty square needs at most two directional
flip checks and an exact raw-margin calculation. Two empties test the two
candidate flip masks, reuse captures when constructing children, and retain
alpha-beta/pass behavior. No unplayed square is awarded. Truncated horizons,
including two empties at depth one, preserve their original heuristic value.
Independent rules still determine terminal positions, including unused squares.
No general three-or-more-empty specialization was introduced.

**Reject the compact TT and its combination.** This is a new 32-byte direct
entry, not the previous two-way 80-byte bucket. Packing bound/solved metadata
into one byte retains both complete 64-bit bitboards, side to move, the full
double score, 32-bit generation, depth and move. A multiply-based range mapping
allows 327,680 entries in exactly the same **10,485,760 allocated bytes** as
262,144 forty-byte baseline entries; no inactive padding is counted as useful
capacity. Zero-MiB diagnostic tables have one 32-byte entry rather than forty.
Same-generation/same-horizon reuse, model isolation, solved metadata, replacement
and rollover remain correct. This concrete design is about 1.5–1.6% slower on
the mixed panel, and its combined version is slower than last-two alone.
More capacity/hits do not compensate for its execution cost. No cache-miss
explanation is claimed. Reproducible rejected patches are in `scripts/mac/variants/`.

All five candidates pass independent same-depth/exact comparisons under
ASan/UBSan: **11,088 root/window queries and 2,802 legal alternatives per build**,
with both turns, B/L/P, one-slot and ordinary TTs. Arbitrary occupancies cover
every final empty square; reachable small endings and forced-pass/terminal
fixtures add rules coverage. Each standalone sanitizer executable also checks
all 174,960 ordered pattern sums, generation rollover, verified all-move values,
interruption and depth storage. All 4,320 initial matched variant root results
have the same score. The initial qualification harness accidentally included
a twelve-empty exhaustive mailbox reference; that bounded engineering attempt
was stopped and corrected to the intended small independent references before
accepted qualification. Deeper 15/16-empty independent reference fixtures are
qualified separately, not silently replaced by a shallower engine oracle.

## Profiling, two small follow-ups, and repeated measurements

The first 8-root steady panel exposed approximately 2% opening/middle overhead
from placing the specialized tail directly in general recursion. Initial profiles
still concentrate CPU work in negamax, rules and TT/ordering control. Two bounded
changes were investigated, then the complete benchmark/profile campaign repeated:

1. Decide once per root/analysis/window whether its placement horizon reaches
   every remaining empty square. Truncated trees cannot reach the tiny exact
   tail. Gating removes unnecessary empty tests there; by itself its measured
   gain is less than 1%, so it is not presented as a major improvement.
2. Keep the specialized body in a separate, non-inlined shared C++ method.
   This recovers more general-search overhead. The combined final version saves
   1.84% B / 1.13% P against the initial last-two candidate on the matched
   48-root rerun, while preserving its node counts and values exactly.

The final focused tests additionally check horizon zero on fully occupied
terminal boards, both colors and all models. This edge case was explicitly
handled during helper code review before final qualification. Native and Wasm
retain the same final implementation. No third profile-driven search change,
move-ordering experiment, PVS, aspiration window or selective pruning was added.

| Matched repeated complete-batch median ms | Original qualified baseline | Initial last-two | Final |
| --- | ---: | ---: | ---: |
| B, all 48 | 94.728 | 89.975 | 88.323 |
| P, all 48 | 141.547 | 136.851 | 135.309 |
| B, twelve exact | 32.190 | 24.101 | 23.841 |
| P, twelve exact | 31.413 | 23.206 | 23.122 |

Cumulative elapsed reductions are **6.76% B / 4.41% P** on this disclosed mixed
panel, or **1.073× / 1.046×** speed. The independent exact-root batch takes
**25.94% / 26.39% less time**, or **1.350× / 1.359×** speed. These are workload
results, not a universal speed or playing-strength claim. The legacy 36-root
subset at its deeper horizons is still 2.58% B / 2.16% P slower than baseline;
its published matrix scope `nonexact` means "not one of the twelve added roots",
not that every legacy late root is heuristic. The gain is concentrated in exact
solving. The shorter 8-root steady workload below is essentially unchanged.
All initial, gate-only and final measurements are retained, including unfavorable
trials; differing cohort medians are not spliced into a causal speedup.

![Complete-search results and actual-browser comparisons](mac-search-optimization-20261030.svg)

Separate diagnostic builds have symbols/frame pointers; span instrumentation
adds clocks and is never used for production throughput. Eight native recordings
cover baseline/final opening D8, middle D7, exact twelve-empty solving and actual
all-move/PV coaching D5. Each runs four seconds, with a three-second, 1-ms `sample`
recording. Compact self counts retain only the tool's collapsed >=5-sample table;
percentages below use that reported subset, include any blocked samples, and are
not hardware cycle fractions. The driver avoids repeated process IPC within its
work loop. Initial/gate/final data and exclusive legal/flips/features/patterns/
TT/ordering spans are in [profiles](data/mac-optimization-profiles-20261030.json).

| Final native self-sample share | Opening | Middle | Exact | Coaching |
| --- | ---: | ---: | ---: | ---: |
| General negamax / inlined TT and ordering | 39.2% | 32.4% | 29.0% | 27.5% |
| Separately visible flips | 26.1% | 26.0% | 57.9% | 17.5% |
| Separately visible legal generation | 15.7% | 20.0% | 4.3% | 25.3% |
| Tiny exact helper, outside general search | ~0 | ~0 | 8.9% | ~0 |
| Seven features / evaluator wrapper | 10.7% | 12.5% | ~0 | 16.8% |
| Patterns | 8.2% | 9.2% | ~0 | 12.4% |

Actual Chrome worker CDP profiles request 100-μs sampling during four separate
2.5-second workloads. Final playing profiles have 19,516–19,602 samples.
Opening/middle general search takes about 62.2% / 41.7%, separately visible
flips 5.9% / 18.6%, legal generation 15.1% / 18.3%, features 7.4% / 9.4%, and
patterns 8.6% / 10.7%. Exact solving takes approximately 56.4% in general search,
38.2% in flips and 4.6% in legal generation. Compiler inlining can fold the tiny
helper, ordering and TT work into negamax; native/Wasm symbol shares are not
identical scopes. The full coaching profile also exposes JS immediate
explanations, `flipsFor`, JSON/conversion, stack helpers and Wasm transitions.
Those adapter costs merit future batching work, rather than being mislabeled
as a new playing-search evaluator bottleneck.

A separate Instruments **Time Profiler** capture/export succeeds. The bounded
**Allocations** recording times out; no allocation rate is reported from it.
No settings or profiling permissions were changed. Source inspection finds no
recursive per-node heap allocation; all-move/PV result vectors and request
formatting do allocate outside ordinary playing recursion. Neither sampling nor
these recordings establish cache misses, CPU frequencies or memory bandwidth.

The remaining exact-solving cost is chiefly flipping and control. Even halving
all of the native 57.9% separately visible flip work would imply at most about
1.41× under a fixed-work Amdahl estimate; a narrower final-square change affects
less. That is an upper-bound estimate, not a measured prospective gain.
There is no further sufficiently small, justified change within this round's
boundary. Engine source and performance settings are frozen before acceptance.

## Initial and final native / actual Chrome Wasm / original JS benchmarks

The browser comparison uses the same eight disclosed roots and placement depths
as the published PC/M4 study: D7 below 28 occupied, D6 below 52, otherwise
min(9, empties), at least one. Five single-batch trials rotate/reverse all four
backends after two complete warmups. Static batches perform 100,000 full
feature/evaluation calls per root. Seven additional serial blocks each contain
ten complete batches for baseline/native/Wasm; their results have a separate
scope. B/P order alternates. The JS reference is the original compiled P closure
and frozen Float32 tables, with its unchanged old TT/hint policies and depth-14
timed cap. No substitute P formula is introduced.

| Final primary 8-root panel | Baseline native | Final native | Chrome Wasm | Chrome JS |
| --- | ---: | ---: | ---: | ---: |
| B median complete ms | 8.659 | 8.634 | 9.900 | 409.300 |
| P median complete ms | 10.655 | 10.572 | 12.800 | 545.800 |
| B million nodes/s | 17.17 | 17.21 | 15.01 | .362 |
| P million nodes/s | 15.91 | 16.03 | 13.24 | .308 |
| B median static ns/evaluation | 19.35 | 19.52 | 25.00 | 1123.50 |
| P median static ns/evaluation | 26.16 | 26.67 | 33.00 | 1249.00 |

Wasm is **41.3× B / 42.6× P faster than JS**, while taking **14.7% / 21.1%**
more elapsed time than final native on this panel. The final C++/Wasm trees match:
148,608 B and 169,504 P nodes. The baseline visits 28 additional nodes per batch;
analytic tiny tails deliberately change visited-node counts. Different JS TT
policies produce 148,004 / 168,301 nodes with identical fixed scores. Every
static checksum agrees exactly. Same-model complete time, node count and NPS
remain separate quantities; static rates are not stronger-play evidence.

Steady median batch ms are baseline/final/Wasm **6.964/6.923/8.110 B** and
**8.701/8.699/10.560 P**. The final ordinary 8-root change is smaller than
plausible desktop variability, so no general opening/middle gain is claimed.
These longer blocks must not be compared with historical single-batch timings
as if they were a new optimization. Full core CPU/wall, IPC-inclusive wall,
alpha-beta first-move cutoffs, TT probes/useful cutoffs/collisions/replacements,
static calls, warmups and trial orders are in
[benchmark evidence](data/mac-optimization-benchmarks-20261030.json).
The default TT is the same actual 10 MiB in native and Wasm. Useful-hit rates
alone are not performance decisions.

Three repetitions of six roots at 80/300 ms give 18 observations per model/
budget/backend. Mean completed placement depths:

| Model/budget | Baseline native | Final native | Wasm | JS |
| --- | ---: | ---: | ---: | ---: |
| B / 80 | 9.500 | 9.500 | 9.000 | 6.167 |
| B / 300 | 10.333 | 10.333 | 9.833 | 7.056 |
| P / 80 | 8.833 | 8.833 | 8.667 | 6.167 |
| P / 300 | 9.500 | 9.500 | 9.333 | 7.333 |

Native/Wasm solve 6/18 in each cell; JS 3/18. This small repeated-root sample
shows no additional completed depth from the optimization; it is not a claim of
no possible game-level effect. Final native maximum core overrun is .052 ms;
Wasm .3 ms. Browser timers are quantized near .1 ms. These are core deadlines,
not UI delivery bounds. Full inspect/conversion/JSON boundary batches cost
approximately **14.2–16.9 μs per Wasm request**. They include static work and
children, not a bare ABI call. Actual application delivery/initialization,
process CPU scope, memory and game results follow below.

## Comparison with the upgraded PC and prior Mac

The previous same-M4 primary medians were 8.493/10.416 ms native and
9.8/12.6 ms Wasm. Current 8.634/10.572 and 9.9/12.8 ms are essentially the same
workload class with ordinary cohort/browser/layout variation; they do not show
a universal speedup. The stronger before/after evidence is the matched twelve
exact roots and 48-root panel above, not a favorable historical denominator.

The upgraded PC GCC 15 portable seven-block medians were **10.621 ms B /
14.489 ms P**, host 10.348/13.472 and POPCNT-only 10.302/13.050. Current M4
steady native is about **1.53× / 1.67×** faster than PC portable and
**1.49× / 1.50×** faster than PC POPCNT on the disclosed workload. Architecture,
compiler target, WSL virtualization, hybrid scheduling and desktop conditions
are confounded; this is an observed implementation comparison, not isolated
CPU/compiler causality. The new tiny tail changes 28 nodes out of about 150k,
without a value difference. PC Windows Chrome's later three-batch sanity
medians (12.367/15.300 ms) and M4 single/ten-batch results use different work-block
lengths and browser display modes; they support a faster observed M4 browser
here, not a precise controlled browser/platform ranking. The PC reports retain
all original GCC 11 and GCC 15 measurements and limitations.

## Frozen final campaign and feasibility

The measured unscored backend pilots take **3.194 s at 80 ms** and **10.727 s at
300 ms** per complete game from separate pilot openings. Eight balanced actual-
application pilot games take **47.729 s**. The pre-play forecast reserves 50%
game-time contingency, 300 seconds for audits/analysis/stress/lifecycle, and
**1,200 seconds for reporting** inside the four-hour active measurement ceiling.
Including measurements already completed, the complete conservative forecast
is **5,514 seconds (91.9 minutes)**. No sample reduction is necessary.

[Backend registration](data/mac-backend-registration-20261030.json) freezes
64 opening families, both colors at 80 and 300 ms: **128 games per budget,
256 total**, primarily/exclusively frozen P. All roots/seeds, complete schedule,
source/native/Wasm/model identities, 10 MiB allocation, same D3 warmup, hints,
statistics, stopping/reading policy and checksums are published before play.
Duplicate symmetry/color-equivalent roots are excluded before outcomes.
Each game gets a fresh native process and fresh actual Chrome Wasm worker;
requests run serially. Equal **core** elapsed budgets avoid charging Python/CDP
transport to only one backend; all interface, worker and outer-wall costs are
recorded separately. This is explicit engineering scope, not ordinary UI latency.
No score/outcome summary is opened until all 256 games pass independent replay,
small exact references, completed-horizon checks and source/artifact audits.
Opening families, not moves or color-swapped games, are the statistical units.

[Browser acceptance registration](data/mac-acceptance-registration-20261030.json)
freezes **96 full actual-application games**, twelve per B/P × 80/300 ms × human
color cell, with 96 deterministic human-policy seeds and depth-two full-window
coaching. These produce varied human opening choices through normal UI play;
arbitrary starting boards are not injected into application state. Custom
training/export/review is qualified separately. Checkpoint 2 is committed and
remote-verified before either substantial final campaign starts.

A direct historical-Wasm/current-Wasm worker comparison additionally runs the
same complete 48-root panel and nine alternating-order repetitions in one actual
Mac Chrome worker. The qualified Checkpoint 1 module is extracted from Git into
ignored storage and checked through its actual ABI build string; production
continues to load only the final shared implementation. Both builds have the
same 10 MiB TT and frozen identities. All 864 matched root scores agree.

| Matched Wasm median ms | Before, all 48 | Final, all 48 | Before, exact twelve | Final, exact twelve |
| --- | ---: | ---: | ---: | ---: |
| B | 117.3 | 105.1 | 41.3 | 27.9 |
| P | 178.6 | 166.9 | 40.9 | 27.5 |

Wasm complete-batch elapsed falls **10.40% B / 6.55% P** on the mixed panel,
and **32.45% / 32.76%** on the exact subset. The exact speed ratios are
**1.48× / 1.49×**. These measured gains are independent of native NPS or a
historical cross-browser denominator; they do not imply every timed move
completes another depth. The [experiment evidence](data/mac-optimization-experiments-20261030.json)
retains both ABI identities, original manifest, boards, orders and every result.
The additional check consumed under ten seconds of intensive time; the
pre-play forecast remains comfortably inside the allowance.

Checkpoint 2 validation passes **172 Node tests** (using project npm 12.2.1),
**39 Python tests**, **15 native sanitizer groups**, the extra focused
native/actual-Wasm sanitizer test, current-source standalone Wasm assertions,
23 targeted groups, 786 installed-Chrome numerical comparisons and final actual-
app integration/recovery checks. Both final Wasm compilations match exactly.
Final distribution identity:
`01ae1b4aec535cf2a2b431d0d4fe3d1b8e76c60b021cc80cf507bcd5f462bc2d`.
Its Wasm SHA-256 is
`924de12404edc637789ed705575c2b274070198666af5767157dd12d0de75150`.
Complete source/header/native executable/model hashes are in
[the results certificate](data/mac-optimization-results-20261030.json).

Reproduce the engineering measurements serially after activating `.venv`:

```bash
python scripts/mac/run.py experiments node scripts/mac/experiment.mjs
node scripts/mac/qualify-variants.mjs
python scripts/mac/run.py repeated node scripts/mac/recompare.mjs
python scripts/mac/run.py benchmarks python scripts/mac/benchmark.py
python scripts/mac/run.py native-profile node scripts/mac/profile.mjs
python scripts/mac/run.py wasm-profile python scripts/mac/wasm-profile.py
python scripts/mac/run.py wasm-compare python scripts/mac/wasm-compare.py
python scripts/mac/run.py instruments python scripts/mac/instruments.py
```

The experiment runner reconstructs the qualified reference from Git and compiles
all experimental copies into ignored storage. It does not apply rejected patches
to production. Use a separate ignored output directory or archive old local
outputs before rerunning, rather than overwriting the completed evidence. The
measurement wrapper records CPU/process/memory/disk snapshots, checks normal
pressure and a 4 GiB cache-headroom estimate, and stops on sustained swap output.
A cache estimate is not a guaranteed free-memory lower bound; pressure and
observed swap deltas constrain interpretation. No user process is terminated.

Final substantial acceptance results are pending at this engineering checkpoint.
