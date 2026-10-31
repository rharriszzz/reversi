# Reversi performance overview

Use the **[local performance explorer](../profiling/index.html)** through the
Python server: run `./start.sh`, then append `profiling/` to the printed URL.
It opens committed evidence without launching a profiler. Read
[profiling methods and views](PROFILING_METHODS_AND_VIEWS.md) before interpreting
sample percentages as performance results.

## Established improvements

**Current production:** the portable 4 KiB ray/sentinel flip kernel is retained
in shared native/Wasm source. See [production acceptance and packaged build
identities](FAST_FLIPS_PRODUCTION_ACCEPTANCE.md). Fixed-depth scores, trees and
search/TT counters are unchanged. Reduced elapsed time can permit deeper timed
searches, but establishes no new playing-strength result.

The fast-flip experiments measured about **37% less exact-panel time on M4**;
WSL2 GCC 15 measured **25–27% portable / 34–36% host-tuned** across B/L/P.
Opening, middle and coaching improve on both machines. Read the
[cross-platform decision](FLIP_OPTIMIZATION_RESULTS.md) for separate workloads,
intervals and compiler controls; do not combine those figures into a CPU ranking.

The following table and profiling paragraphs describe the **pre-fast-flip**
engine and their historical comparisons, not new production measurements.

These are published measurements, with their original panels and limitations.
They are not new measurements of every supported platform in this investigation.

| Machine / comparison | Established result | Scope and evidence |
| --- | --- | --- |
| M4 native, qualified predecessor → final-empty engine | 6.76% B / 4.41% P less elapsed time on the mixed 48-root panel; 25.94% / 26.39% less on twelve independent exact roots | [Matched repeated Mac results](MAC_NATIVE_WASM_OPTIMIZATION_RESULTS.md); 1.350× / 1.359× exact-batch speed |
| M4 Wasm, before → final-empty engine | About 33% less exact-batch time | [Actual browser and build qualification](MAC_NATIVE_WASM_OPTIMIZATION_RESULTS.md) |
| M4 frozen Wasm versus original JS | About 41–43× faster complete fixed searches; Wasm takes about 15–21% more time than native | Same published Mac engineering panel; boundary and worker overhead are separate |
| WSL2 GCC 15 portable versus historical GCC 11 portable | 15.0% B / 9.1% P less elapsed time on the corresponding repeated eight-root batch | [PC handoff](PC_TO_MAC_HANDOFF.md); no matched GCC 11 rerun, so this does not isolate compiler or OS causality |
| WSL2 GCC 15 host / POPCNT-only versus portable | Host saves 2.6% B / 7.0% P; POPCNT-only saves 3.0% / 9.9% | Same current-source work and node counts; overlap/desktop variability limit small distinctions; portable remains default |

The historical Mac deeper legacy 36-root subset was **2.58% B / 2.16% P slower** than
its old baseline before faster flipping. That final-empty improvement was concentrated in exact solving;
it is not a universal search speedup. The separate short steady panel is nearly
unchanged. Real-game native search throughput is about 33–34% higher than Wasm
in the published backend comparison, but paired game outcomes show no convincing
backend strength difference. Faster microbenchmarks do not establish stronger play.

The new M4 investigation rechecks matched old/current fixed-work searches and
static evaluator throughput with production compiler options. Its complete trial
matrix, uncertainty and profiler interference plots are in the explorer; those
results have a narrower workload scope than the original twelve-root experiment.

In the new seven-pair fixed-work check, this one twelve-empty root takes
**4.0447 s → 2.6562 s**, a **34.25%** paired elapsed reduction (descriptive 95%
interval **33.96–34.55%**). Static B/P and middle P differences are unresolved;
the opening/coaching point changes are small. This is not a replacement estimate
for the historical twelve-root panel. Hardware-IP versus matched-stack function
rankings agree closely, while the richer CPU Profiler context recovers helper
ancestors missing from raw unwind fragments. See the methods report for the
measured interference and its limitations.

## Retained and rejected engineering work

**Retained:** original bitboard alpha-beta search, complete-position TT identity,
correct pass/terminal semantics, the uncapped natural-depth timed search,
completed-iteration publication, omission of unnecessary depth-zero TT work,
qualified evaluator implementation improvements, the portable geometry-table/
sentinel flip kernel, and specialized final one/two
empty-square handling. The tiny exact helper is gated to trees that can reach it
and kept out of the general recursion body. Frozen evaluator coefficients remain
unchanged. The details and numerical qualification are in the
[Mac report](MAC_NATIVE_WASM_OPTIMIZATION_RESULTS.md),
[native V2 report](NATIVE_SEARCH_V2_RESULTS.md) and
[shared native/Wasm report](NATIVE_FINAL_OPTIMIZATIONS.md).

**Rejected:** both the earlier two-way 80-byte TT-bucket experiment and the later
32-byte direct-entry design. The latter compared **10,485,760 actual allocated
bytes** against the 40-byte baseline layout, passed independent correctness, and
was roughly 1.5–2% slower alone and with the tiny-endgame specialization. More
entries or hits did not compensate for execution costs. No cache-miss mechanism
was demonstrated. Reproducible variants and negative evidence remain preserved.

The earlier profiling/explorer work changed no search algorithm or model.
Production promotion rebuilds Wasm from the already qualified flip source;
it introduces no additional optimization or training campaign.

## Bottlenecks and evidence quality

Native exact solving spends most sampled work in general control/TT/ordering,
flipping and the specialized exact tail. Nonterminal searches also show legal
move generation, seven-feature evaluation and P's pattern evaluation. All-move
coaching additionally verifies continuations and builds result/explanation data.
The new dedicated Wasm worker profiles expose adapter/JSON costs. Their static
and exact workloads do not measure coaching explanations; that pipeline needs
its own worker capture.

Older tables based on `sample` retained only its collapsed ≥5-count output;
older exclusive component timers perturb short calls. Their percentages are not
production cycle fractions. Do not combine their denominators with the new full
record hardware profiles. Inlining also means that a large `negamax` row can
contain TT, ordering and rule work; a missing evaluator frame does not imply no
evaluation cost. The new report distinguishes direct hardware IP observations,
hardware-triggered stacks, periodic stacks and Chrome's software sampler.

Profiler throughput measurements and unprofiled controls determine whether
sampling measurably affects tiny evaluations. Collector CPU, trace volume and
offline export/symbolization are reported separately from target elapsed/CPU time.
Unknown loss and unresolved addresses remain visible. Source/assembly metadata
is attribution evidence, not precise causal time accounting for one instruction.

## Ranked future work

The [Mac](FLIP_OPTIMIZATION_MAC.md) and [WSL2 PC](FLIP_OPTIMIZATION_PC.md)
fast-flip experiments are complete. Their historical reports preserve the
experiment-only status and unchanged distribution at that time. The
[production acceptance](FAST_FLIPS_PRODUCTION_ACCEPTANCE.md) records the subsequent
integration, actual distributed rebuild and final browser/benchmark checks.
Further optimization requires a separate task.

1. **Use matched unprofiled complete-work benchmarks as the decision gate.**
   Keep multiple exact roots, nonterminal searches and evaluator microbenchmarks;
   disclose trees, counts, compiler flags and variability. A percentage change in
   a profile is not the optimization's benefit.
2. **Use hardware IP tables plus selective address drill-down to locate costs.**
   Start with a modest qualified event period, check sample count and interference,
   then collect stacks only for questions requiring callers. The new experiment's
   measured limits and recommended defaults are in the methods report.
3. **Complete the short post-merge PC packaging/launcher check.** The exact
   source already passes actual WSL2 GCC 15 correctness and performance, with
   portable and host-tuned flags. The production report gives a small follow-up;
   another full PC optimization campaign is unnecessary.
4. **Consider batching coaching adapter work.** Real worker profiles can reveal
   repeated conversions and verified-PV work. Measure the full all-move response,
   preserve comparable horizons, and separate UI/worker latency from engine time.
5. **Defer another TT layout, elaborate selective search or evaluator expansion.**
   Existing failed TT experiments raise the evidence bar. Hardware cache/miss
   events could test a locality hypothesis, but their distributions would be miss
   distributions, not CPU-time profiles. Learning/strength questions need separate
   prospective protocols and are outside this investigation.

A short Processor Trace could answer call-frequency/control-flow questions that
sampling misses, if separately permitted and bounded. Its hardware support is not
permission to alter this Mac's Developer Tools security setting. No trace-derived
performance claim is made without a real capture.

Use the [Processor Trace decision guide](PROFILING_METHODS_AND_VIEWS.md#when-to-enable-processor-trace)
to choose by the question: aggregate cycle cost and throughput usually need no
trace; exact short-call sequences may benefit. Branchless bodies can still be
reconstructed and have callers, but their stall costs often call for counter
evidence rather than more control-flow detail.
