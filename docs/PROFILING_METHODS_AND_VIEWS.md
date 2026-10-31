# Hardware sampling, calling stacks and performance views

**[Open the local profiling explorer](../profiling/index.html)** through the
ordinary server: `./start.sh`, then append `profiling/` to the printed URL.
Committed examples work without collecting another profile. The
[performance overview](PERFORMANCE_OVERVIEW.md) separates established Mac/PC
speedups from this investigation's narrower workloads.

The central distinction is between **collection** and **presentation**. A table,
sunburst or flame graph does not determine how its underlying measurements were
made. In particular, taking the leaf of an already-collected stack does not make
the collection stack-free. This investigation uses an explicit hardware PMI
collector with empty stack requirements, and a matching collector with user
stacks, on the same production-compiled engine.

## Scope, recovery and build qualification

This is a profiling investigation, not another optimization/training campaign.
Production engine source, frozen models and Wasm artifacts are unchanged.
The qualified predecessor is `43e52d2235c17670f302ab822636f11660e4f8b7`;
the current published source is `1f0faa3b7fac3ca42f7ccd06aec1d8c27e38acbf`.
The [data manifest](data/profiling/manifest.json) records complete engine/header,
harness, compiler, flags, executable hashes and build fingerprints.

At recovery, local `main`, fetched `origin/main` and the user's last verified
published checkpoint were all `1f0faa3`. The only uncommitted source was
`scripts/profiling/`. No profiling or benchmark process from the interrupted task
was running. The old scripts were copied into ignored recovery storage before
editing. Existing traces, notebooks, reference image, pilot output and logs
remain intact under `.local-research/profiling-views-20261030/`.

Useful components were reused: fixed boards, native fixed-work driver, source
reconstruction and resource checks. Two experimental assumptions were replaced:

- The earlier in-process address sampler periodically suspends a thread and reads
  its ARM PC. That is **software** sampling. Its optional implementation remains
  inspectable but was disabled throughout the new campaign (`ipIntervalUs=0`).
- The earlier builds forced frame pointers. The new build retains production
  optimization/FP-contraction options and adds only debug information. Compiling
  engine objects with and without `-g` produces identical `__TEXT,__text` bytes.
  No stack-friendly recompilation was needed; no engine algorithm was edited.

Measurements use an original harness linked against those engine objects, not
the native JSON command-line adapter. A separate correctness qualification links
each original adapter against its matching production object and checks static
checksums/search values and exposed counters against the measured harness.
No adapter-versus-harness timing conclusion is drawn. All compared profiler conditions for a
build use the **identical executable**. Two signposts bracket a complete work
interval, outside its timers; no profiling clocks or callbacks are inserted into
individual evaluator/search calls. Warmup, process startup, logging and
symbolization are outside target fixed-work elapsed/CPU time.

The initial audit found an M4 iMac (`Mac16,3`), ten cores, 24 GiB RAM, normal
memory pressure, about 0.38 MiB swap used and about 519 GiB disk free. The Mac had
ordinary desktop/system activity; it was not a laboratory-isolated machine.
Resource checks precede every timed run, with a swap-output stop gate. Intensive
work is serial. Browser tests, correctness tests and offline symbolization run
after collection. The compact qualification receipt records the completed
budget, tests and the verified intermediate remote checkpoint. Final publication
verification is reported with the completed commit.

## Mechanisms actually distinguished

| Technique | Trigger / records | Context and costs | Availability here |
| --- | --- | --- | --- |
| Unprofiled fixed work | No profiler; target wall/thread/process CPU clocks outside the work loop | Authoritative runtime and throughput, no hotspot locations | Both qualified builds, all workloads |
| Minimal hardware IP collector | `CORE_ACTIVE_CYCLE` PMU overflow; raw PC, cumulative counter, core, thread and real timestamp | No requested user/kernel stacks; finite interrupt/buffering/collector cost and possible skid | Qualified on this M4 |
| Matching hardware stack collector | Same event, period and counter configuration; `callstack=[user]` | Captured PC and frame-chain return addresses; unwinding can omit inline/tail-call context | Qualified on the identical binaries |
| Instruments CPU Profiler | Apple documents hardware cycle-triggered stacks; export supplies cycle weights | Symbolic stacks can include debug inline frames; shipped template also includes auxiliary instruments | Tested independently, normal/high settings |
| Instruments Time Profiler | Periodic software sampling; export supplies time weights | Captures running user stacks; periodic aliasing and hybrid-core weighting differ from cycle sampling | Tested independently, normal/high settings |
| Optional old software IP sampler | Sleep, thread suspension and ARM state read | Stack-free software sampling with suspension interference; **not** hardware PMI | Preserved, not used as the hardware substitute |
| Per-call instrumentation | Entry/exit or component clocks on each invocation | Can distort tiny frequently called functions; not sampled stacks | Historical results only; excluded from these baselines |
| Processor Trace | Hardware branch/control-flow trace, reconstructed against executable code | Detailed execution between samples, substantial data/decoding, distinct fourth technique | M4 hardware supports it; existing Mac setting blocks capture |
| Chrome worker CPU profile | V8/CDP periodic software stack sampler | Wasm/JS/runtime context, actual deltas; no Apple PMU event or core attribution | Separate actual-Chrome worker captures |

Apple distinguishes cycle-triggered CPU Profiler stacks from Time Profiler's
periodic stacks, and describes CPU Counters' instruction event modes. These
statements concern collection, not whether the viewer draws a table or flame
graph. [Apple's CPU performance session](https://developer.apple.com/videos/play/wwdc2025/308/).
The current Instruments 27 presentation work also adds Top Functions and run
comparisons; a flat self-cost view is useful when one helper is split across many
calling paths. [Apple's 2026 profiling session](https://developer.apple.com/videos/play/wwdc2026/268/).

### Qualifying genuine stack-free hardware records

The normal CPU Counters template includes Time Profiler. More subtly, removing
Time Profiler from the visible template still leaves its guided instruction
view requesting `time-sample` with `callstack=user` and a derived `time-profile`.
The preserved guided probe therefore **does not qualify as stack-free
collection**, even though its instruction-sample rows are not call stacks.

The independent [minimal Instruments package](../scripts/profiling/hardware.instrpkg)
requests `pmi-sample` with `callstack=[]`. It also requests stack-free counter
reads every 10,000 µs to configure/read `CORE_ACTIVE_CYCLE`, plus workload-boundary
signposts. The periodic counter reads are **not** the source of the presented
instruction locations: those come only from the PMI records. No Time Profiler
or CPU Profiler stack table is requested by the IP instrument.

Counter setup matters. A probe requesting only raw PMI records appeared to
produce samples, but their rate/count behavior did not qualify its claimed event.
It can reuse a stale PMU configuration; it is rejected, not relabeled as cycle
evidence. Alias-only probes returned no records. Explicit counter configuration
produced the qualified cycle record stream. An initial package schema/type error
also crashed the collector; that failed probe is preserved and never enters the
performance matrix.

The actual CPU-family PMU database is
`/usr/share/kpep/cpu_100000c_2_6f5129ac.plist`, SHA-256
`742940d55092983b55f13531a106a605addecd0e36975e37cccda53912cf2f95`.
It identifies `CORE_ACTIVE_CYCLE` as event 17, active-core cycles.
The package and exported table requirements establish which event is configured;
raw records retain counter ID and cumulative count as further evidence. The
published IP captures are checked for empty stack fields on **every row**,
including discarded startup/warmup rows, and their exported requirements are
checked for hidden stack requests.

The qualified example traces use Deferred recording mode. Periods are
1,000,000 and 10,000,000 events. This is not a fixed-Hz timer.
Samples carry the configured period as their approximate cycle weight; raw
cumulative counter values are retained separately and are **not summed** as
sample weights. Counter privilege-level filtering is not independently exposed
by this minimal interface, so it is not asserted to be an EL0-only cycle total.
This is PMU-overflow interrupt sampling with an OS/collector record path;
it is not claimed to be an autonomous, precise-retirement instruction recorder.
Sampling can have skid/interrupt attribution effects. The two cycle periods
are multiplicatively related; their comparison is not a randomized phase test
and cannot rule out periodic aliasing. These distributions locate
sampled active-cycle hotspots; they are not exact instruction latencies or
elapsed-time distributions.

Apple's public XNU kperf implementation calls `backtrace_user`, which walks
saved frame pointers and return addresses; this corroborates the raw captured
frame-chain format. Faults, frame limits, tail calls and inlining can leave
incomplete context. We did not reverse-engineer every fallback in this exact
shipping kernel. Symbolization/inline expansion is a later operation, not a
hardware event. [Apple kperf source](https://github.com/apple-oss-distributions/xnu/blob/main/osfmk/kperf/callstack.c),
[Apple backtrace source](https://github.com/apple-oss-distributions/xnu/blob/main/osfmk/kern/backtrace.c).

These custom instruments use bundled schema interfaces. Their behavior must be
requalified after Xcode/OS upgrades; this result is not a portable guarantee for
all Apple hardware or older Instruments releases.

CPU Profiler's exported TOC requirements identify `CORE_ACTIVE_CYCLE` in
`kdebug-counters-with-pmi-sample`, at 1,000,000 cycles (normal) and 100,000
(high). Its symbolic sample table exports individual cycle weights, which are
retained rather than replaced with a constant. This event identification comes
from the collector requirements, not from similar sample rates. The recovered guided probe exposes branch
misprediction-related instruction events, but no branch/cache-miss dataset is
used as a CPU-time distribution or as the primary overhead control.

## Experimental design and measured results

Six fixed workloads use published engineering boards: static B, static P,
opening B at depth 9, middle P at depth 8, a twelve-empty exact P root and
full-window/PV coaching P at depth 6. Boards, sides, counts, model identities and
all counters are in the registration inside
[the benchmark matrix](data/profiling/benchmarks.json).

One native static work block makes 4,096 calls to the production external
`evaluate` function on a fixed middle board. Its `ownMoves` argument is computed
once, matching that function's API. This isolates the evaluator body; it is not a
random-board benchmark or a measurement of separately recomputing own legal moves
on every call. Separate translation units and no LTO prevent the harness from
folding the evaluator loop into a constant. The final checksum is consumed.
Complete searches include their normal legal-move and tree costs.

Three warmup blocks precede each complete fixed repetition count. Both builds
use the same registered work count within a workload. There are seven plain
trials and five per profiler condition, with rotated mode/workload order and
alternating old/current order. Fixed work is verified through checksums, exactness,
horizon and identical same-build search counters across every condition.
Unprofiled old/current trees can differ because the qualified exact shortcut
changes actual work; NPS alone is not the optimization's benefit.

Target elapsed, workload-thread CPU, process CPU and outer launch-to-save time
are separate fields. Effects use paired block log ratios against the same build's
plain control. Reported 95% intervals use Student t on those five log ratios;
these small-sample intervals are descriptive, not a guarantee against drift or
correlated noise. The many nominal per-comparison intervals are not a family-wise
false-alarm guarantee. A small point estimate whose interval crosses zero is not
called demonstrated profiler overhead. Mode rotation reduces, but does not
eliminate, order/thermal/core-selection effects.

<!-- MEASURED_RESULTS -->

**Completed native matrix:** 564 full fixed-work trials, 480 profiler captures. Cells below are elapsed change with a descriptive 95% paired interval; negative means less elapsed time. Both complete old/current trial matrices remain in the JSON.

| Workload | Previous median s | Current median s | Current vs previous | Current plain CV | Current M nodes/s | Current M eval/s |
| --- | --- | --- | --- | --- | --- | --- |
| evaluate-B | 2.1950 | 2.1947 | -0.18% [-0.97%, +0.61%] | 1.28% | 0.00 | 67.97 |
| evaluate-P | 2.3048 | 2.3108 | +0.21% [-0.28%, +0.70%] | 0.53% | 0.00 | 50.80 |
| opening-B | 2.6580 | 2.6422 | -0.81% [-1.40%, -0.22%] | 1.66% | 20.31 | 14.95 |
| middle-P | 2.6768 | 2.6804 | +0.01% [-0.33%, +0.35%] | 1.05% | 17.75 | 11.33 |
| exact-P | 4.0447 | 2.6562 | -34.25% [-34.55%, -33.96%] | 1.71% | 27.51 | 0.00 |
| coaching-P | 2.6317 | 2.6267 | -0.19% [-0.33%, -0.04%] | 0.44% | 19.47 | 14.35 |

Current-engine application interference:

| Workload | ip-1000000 | ip-10000000 | stacks-1000000 | stacks-10000000 |
| --- | --- | --- | --- | --- |
| evaluate-B | +1.56% [+0.85%, +2.28%] | +1.80% [+0.72%, +2.88%] | +1.58% [+0.55%, +2.63%] | +1.55% [+0.11%, +3.01%] |
| evaluate-P | +0.62% [-0.37%, +1.61%] | +0.69% [+0.22%, +1.17%] | +0.54% [-0.21%, +1.30%] | +1.10% [+0.09%, +2.12%] |
| opening-B | +0.74% [-0.09%, +1.57%] | +0.16% [-0.48%, +0.81%] | +0.16% [-0.35%, +0.66%] | -0.12% [-0.61%, +0.38%] |
| middle-P | +0.23% [-0.30%, +0.77%] | +0.05% [-0.39%, +0.50%] | +1.21% [-1.96%, +4.48%] | +0.54% [-1.10%, +2.21%] |
| exact-P | -0.52% [-2.41%, +1.41%] | -0.42% [-2.57%, +1.78%] | -0.39% [-2.72%, +1.99%] | +0.34% [-2.07%, +2.81%] |
| coaching-P | +0.43% [+0.30%, +0.57%] | +1.03% [-0.57%, +2.66%] | +0.81% [-0.20%, +1.82%] | +0.72% [-0.40%, +1.86%] |

| Workload | cpu-normal | cpu-high | time-normal | time-high |
| --- | --- | --- | --- | --- |
| evaluate-B | +1.63% [+0.05%, +3.23%] | +3.29% [+1.46%, +5.15%] | +1.49% [+0.21%, +2.80%] | +1.96% [+0.47%, +3.48%] |
| evaluate-P | +0.83% [+0.19%, +1.48%] | +2.26% [+1.33%, +3.21%] | +1.27% [+0.20%, +2.36%] | +1.33% [+0.54%, +2.12%] |
| opening-B | +0.26% [-0.22%, +0.75%] | +2.81% [+2.45%, +3.18%] | +0.12% [-0.18%, +0.43%] | +0.62% [+0.38%, +0.86%] |
| middle-P | +0.81% [-0.91%, +2.56%] | +3.35% [+2.40%, +4.32%] | +0.02% [-0.44%, +0.48%] | +0.74% [+0.49%, +1.00%] |
| exact-P | +0.30% [-1.14%, +1.77%] | +2.46% [+1.19%, +3.74%] | +1.03% [+0.30%, +1.78%] | +0.99% [+0.67%, +1.31%] |
| coaching-P | +0.90% [-0.07%, +1.89%] | +2.40% [+2.09%, +2.71%] | +0.51% [+0.08%, +0.93%] | +1.04% [+0.50%, +1.58%] |

Additional interference from requesting user stacks, with the minimal collectors otherwise matched:

| Workload | 1 M cycles: elapsed | 1 M cycles: thread CPU | 10 M cycles: elapsed | 10 M cycles: thread CPU |
| --- | --- | --- | --- | --- |
| evaluate-B | +0.02% [-0.44%, +0.49%] | +0.02% [-0.44%, +0.49%] | -0.25% [-1.27%, +0.79%] | -0.25% [-1.27%, +0.79%] |
| evaluate-P | -0.07% [-0.78%, +0.64%] | -0.07% [-0.77%, +0.64%] | +0.41% [-0.89%, +1.72%] | +0.40% [-0.88%, +1.69%] |
| opening-B | -0.58% [-1.82%, +0.68%] | -0.58% [-1.83%, +0.68%] | -0.28% [-1.32%, +0.78%] | -0.28% [-1.33%, +0.79%] |
| middle-P | +0.97% [-1.89%, +3.93%] | +0.97% [-1.88%, +3.90%] | +0.49% [-1.27%, +2.28%] | +0.49% [-1.26%, +2.27%] |
| exact-P | +0.13% [-0.92%, +1.18%] | +0.13% [-0.92%, +1.18%] | +0.77% [-1.85%, +3.46%] | +0.75% [-1.82%, +3.38%] |
| coaching-P | +0.37% [-0.61%, +1.36%] | +0.37% [-0.61%, +1.36%] | -0.31% [-0.99%, +0.38%] | -0.31% [-0.99%, +0.38%] |

Density/volume example, current static B (five captures per condition):

| Mode | Median samples | Median accepted samples/s | Median raw MiB | Exported median weight |
| --- | --- | --- | --- | --- |
| ip-1000000 | 8,873 | 3,985 | 7.81 | 1,000,000 |
| ip-10000000 | 887 | 400 | 7.63 | 10,000,000 |
| stacks-1000000 | 8,861 | 3,984 | 7.81 | 1,000,000 |
| stacks-10000000 | 886 | 399 | 7.63 | 10,000,000 |
| cpu-normal | 8,862 | 3,991 | 8.45 | 1,000,158 |
| cpu-high | 88,708 | 39,353 | 11.55 | 100,158 |
| time-normal | 2,215 | 1,000 | 8.22 | 1,000,000 |
| time-high | 22,245 | 10,000 | 8.87 | 100,000 |

Weights in that last column are configured cycle periods for minimal PMIs, exported cycles for CPU Profiler, and nominal nanoseconds for Time Profiler. They are not a common elapsed-time scale.

Physical-function distribution agreement, pooled over five captures per method (total variation is half the absolute share differences, in percentage points):

| Workload | IP vs raw cycle stacks | IP vs CPU Profiler | IP vs Time Profiler |
| --- | --- | --- | --- |
| evaluate-B | 0.17 pp | 0.36 pp | 0.53 pp |
| evaluate-P | 0.29 pp | 0.39 pp | 0.29 pp |
| opening-B | 0.31 pp | 0.41 pp | 0.70 pp |
| middle-P | 0.61 pp | 0.54 pp | 0.11 pp |
| exact-P | 0.44 pp | 0.41 pp | 0.43 pp |
| coaching-P | 0.56 pp | 0.68 pp | 1.28 pp |

Fine instruction/64-byte region comparisons, every function share, depth/core distribution and accepted/discarded/unresolved counts are in [the analysis](data/profiling/analysis.json) and capture statistics. Fine address rankings have substantially less count support than whole-function rankings; disagreement at that level can reflect sparse observations, skid, period/phase effects and representation differences.

<!-- END_MEASURED_RESULTS -->

### What the interference experiment can establish

The clean incremental stack comparison is minimal hardware stacks versus minimal
hardware IP at the **same event and period**. Comparing CPU Profiler against
Time Profiler changes more than unwinding: trigger, weights, auxiliary template
facilities and potentially sample frequency all differ. Those are comparisons
of useful real facilities, not a pure estimate of the cost of stack collection.

Workload clocks measure the effect on the application. Child CPU and the separate
collector audit account for launcher/reaped-process work; shared collector-daemon
CPU deltas are reported with their attribution limits. Outer time minus target
work includes startup, warmup and trace sealing and cannot all be called sampling
interference. Raw trace size describes data volume. Offline export,
symbolization and Python normalization have their own measured wall/CPU costs.
Persistent system daemon CPU is not fully task-exclusive; no exact total collector
CPU is claimed where the system interface does not supply it.

Lost sample counts are not exposed by these exports. They remain `null`/unknown,
not zero. All accepted low-count observations are retained. Real startup/warmup/
teardown and nonrunning exclusions have explicit counts and use different
denominators from the fixed-work views. The sample density, unique-PC coverage,
unresolved weight, depth and core distributions accompany the capture statistics.

## Collector resources, postprocessing and context quality

The [compact receipt](data/profiling/receipt.json) and
[separate collector audit](data/profiling/collector-resources.json) preserve these
scopes. Active measurement, including the conservative probe allowance and the
supplementary resource/Chrome captures, used **3,432.0 s (57.2 minutes)**.
All 564 pre-trial snapshots reported normal memory pressure; swap-outs remained
24 throughout. Snapshots precede work, so they do not certify an isolated CPU
throughout each trial. No competing benchmark, browser acceptance or offline
symbolization was run during the primary matrix.

The supplementary resource audit uses one static-B run per condition with a
5 Hz process observer. It is separate from the repeated overhead experiment:

| Condition | Target thread CPU s | Launch/save wall s | Timed process-family CPU s | Last observed xctrace own CPU s | Peak observed xctrace RSS MiB |
| --- | --- | --- | --- | --- | --- |
| Plain | 2.135 | 2.150 | 2.13 | — | — |
| IP, 1 M | 2.169 | 5.391 | 3.97 | 1.49 | 408.8 |
| Raw stacks, 1 M | 2.183 | 5.394 | 4.00 | 1.47 | 338.4 |
| CPU Profiler normal | 2.190 | 5.856 | 4.36 | 2.03 | 525.0 |
| Time Profiler normal | 2.197 | 5.902 | 4.37 | 2.04 | 521.9 |
| Time Profiler high | 2.208 | 5.888 | 4.47 | 2.11 | 533.5 |

PID/PPID observations confirm that the target is a child of xctrace. Process-family
CPU includes target, launcher and charged descendants plus startup/sealing; it
must not be added to target CPU as if independent. The observed xctrace values
are lower bounds before exit, not exact lifetime totals. Shared-daemon deltas
are retained but can include other clients. RSS is resident address-space usage,
not uniquely allocated physical memory. The roughly three seconds outside the
target work include startup, warmup and saving, rather than three seconds of
interference with a two-second evaluator loop.

The 480 primary raw traces occupy **4.09 GiB**, kept ignored. The successful final
offline normalization pass took **2,048.2 s wall**, **257.7 s Python CPU** and
**1,069.3 s charged child CPU**. Its 988 xctrace export commands accounted for
1,790.9 s wall / 1,068.7 s child CPU; cached symbol/assembly commands were much
smaller. Earlier cached exports and failed format-qualification passes are
**outside that subtotal**, with their logs preserved. It is not a complete
lifetime postprocessing total and none of it is application interference.
Analysis/report/browser rendering are additional offline work. The expense of
exporting hundreds of captures reinforces the value of reusing normalized data.

Across the matrix there are **10,234,702 accepted native sample records**;
1,190 are attributed to E cores, about **0.012% of observations**. This count
mixes different sampling densities and is not an elapsed-time fraction. It gives
no useful independent E-core performance estimate. P-core migration is visible;
no processor affinity was forced. Capture-specific core distributions remain in
the data.

For the current exact rep-0 example, raw stack depths range **5–19**, median
**14**, versus CPU Profiler **9–21**, median **17**. CPU Profiler exports 222 inline
frame definitions in that capture; this counts definitions at distinct metadata
locations, not calls. Raw fragments have no invented inline frames and contain
an unresolved system ancestor in every accepted stack, despite **zero unresolved
leaf weight**. The UI reports both diagnostics. Unknown system symbolization
alone does not prove the unwind was truncated; the separately retained LR fixups
and omitted frameless callers do limit claims about immediate caller adjacency.

That distinction changes a practical conclusion: the helper has about **23.45%**
inclusive raw-fragment weight but **42.76%** in CPU Profiler's reconstructed
context. Their physical leaf-function distributions still agree closely.
A missing intervening helper frame while inside `flips` can explain this
inclusive discrepancy; it is not evidence that one profiler measured twice as
much helper execution. Use the richer symbolic context for caller questions.
Individual-instruction IP/raw-stack variation on the selected rep-0 pairs ranges
**3.11–9.58 pp**, versus **2.56–5.36 pp** for 64-byte regions. Pooled function
shares are much more stable. This does not separate skid from phase/aliasing or
sparse-count uncertainty; no exact instruction-latency claim is made.

CPU Profiler high versus normal adds **1.42–2.54%** elapsed time across these six
current workloads, with each descriptive paired interval above zero. Raw IP
1 M versus 10 M does not show a uniform resolved increase; only the opening
comparison's interval is wholly positive. Time Profiler's denser mode has a
smaller and less consistently resolved effect. Higher density supplies more
observations and finer support, not guaranteed unbiased instruction rankings.

### Separate Chrome worker evidence

Actual Chrome **156.0.8078.74** collected four dedicated production-Wasm worker
profiles. The worker includes normal Wasm adapter/JSON work; it is a research
capture target, not a claim to have profiled every browser-game interaction.
Both unprofiled checksums match their profiled checksums. These supplementary
single observations do not support confidence intervals or a fresh backend ratio.

| Work | Requested interval µs | Plain before ms | Profiled ms | Plain after ms | Actual samples |
| --- | --- | --- | --- | --- | --- |
| 10 million static P evaluations | 1,000 | 337.0 | 324.0 | 324.4 | 224 |
| Same static work | 100 | 337.0 | 333.5 | 324.4 | 2,257 |
| 696 exact P searches | 1,000 | 2,860.8 | 2,877.4 | 2,894.5 | 1,920 |
| Same exact work | 100 | 2,860.8 | 3,017.8 | 2,894.5 | 19,778 |

The requested interval does not guarantee the achieved rate. Full profile
`startTime`/actual deltas, dispatch and idle observations remain available;
chronology begins at **Chrome CPU profile start**, not a native signpost.
The dense exact capture is slower in this observation, but repetitions would be
needed for a statistical Chrome overhead conclusion. The stack view reveals
Wasm, V8/JS, `rv_query`, serialization and idle context. No native instruction
address hierarchy or core attribution is invented for it. These captures do not
measure all-move coaching or its explanation pipeline.

## One reusable model, several independent views

[Collection scripts](../scripts/profiling/README.md) and
[the browser accounting module](../profiling/model.js) are separate. The raw
`.trace`, XML exports and `.cpuprofile` records stay in ignored local storage;
compact full records for selected complete captures and statistics for every
native capture are committed. Repeated visual experiments never launch a profiler.

Each profile records event/trigger/period/weight meaning, build/workload identity,
raw PCs where available, modules, physical symbol containment, actual stacks,
timestamp provenance and accepted/unresolved/discarded/unknown-loss mass.
Module-relative PCs remove ASLR for containment; raw PCs remain available.
`nm` physical text ranges end at the next linked text symbol or `__text` boundary.
They do not magically distinguish logical inline functions, aliases or source
causality. `atos`/DWARF and exact `otool` instructions add attribution where reliable.
System addresses without qualified symbol/range metadata remain unresolved.
Leaf unresolved weight and the weight of stacks containing an unresolved symbol
anywhere are separate diagnostics: an unknown system ancestor does not imply
that an engine leaf/caller is unknown, nor prove the unwind itself was truncated.

A raw PMI stack retains its actual PC and captured return-address chain in
root-first order. Its ARM64 link-register fixup values are retained separately;
this independent decoder does not guess whether to insert them as callers.
Adjacent fragment nodes are observed ancestors and can omit frameless functions,
not a promise of complete immediate-call relationships. It gains no invented
inline frames. The richer CPU Profiler export is used for the final helper
calling-context explanation. CPU Profiler/Time Profiler
exports can supply inline frames explicitly, and those are labeled. A flat IP
profile has no stack field. Its timestamps exist only because this collector
actually supplied them; a timestamp-free imported profile cannot acquire a chart.
Chrome frames retain actual V8 call-frame metadata but do not acquire native PCs
or processor attribution.

| Presentation | Required data / visual meaning | Best questions / information gained | Limits, bias and collection cost |
| --- | --- | --- | --- |
| Instruction/function table + source/assembly | PCs and trustworthy module/symbol ranges; rows show observations, weighted shares, actual address and attribution | Exact hot offsets, scattered short helpers, sortable flat ranking; strongest first view for evaluator instruction cost | No callers from IP data; inlining, skid and physical-symbol bounds complicate source causality. Reuses low-context PMI data; symbolic/source work is offline. |
| Address sunburst | Address containment, not callers; angle is weight, rings refine module → symbol → smaller byte ranges | See whether a large function is broadly hot or dominated by a compact region; zoom a heavily sampled region | Angular comparison is less precise than a table. Tiny branches need explicit Other. It cannot answer who called a function. No additional capture is required. |
| Aggregate icicle / flame graph | Genuine sampled stacks; width is inclusive weight and vertical position is stack depth | Separate a helper's callers, recursive search/tiny-tail paths, UI/Wasm adapter context; self space distinguishes local from child work | Same helper can be scattered across paths. Missing/tail/inlined frames matter. Width is not chronological duration. Requires stack collection, whose interference is measured separately. |
| Differential function/path table | Matched workload, method and event; independently normalized before/after shares; unprofiled runtime shown beside them | Explain redistribution after the final-empty change, including newly visible helper paths | Shares are compositional; a larger share is not a slowdown. Addresses move across builds. No precise absolute time saving is assigned to one instruction from sparse samples. Paths require real stacks. |
| Chronological sample chart | Real sample timestamps plus thread/core/context; each mark is an observation at that time | See phase/core movement, worker/dispatch/idle observations and whether paths appear in bursts | No reconstruction of activity between samples or exact call durations. A single synchronous search thread offers less extra information than multiworker work. Timestamp-free data gets no timeline. |
| Benchmark/interference plots | Complete unprofiled/profiled fixed-work timings, repeated trials, counts and raw sizes | Establish practical speedup, noise, profiler interference and density/volume tradeoffs | Hotspot location is absent; thermal/scheduling/order noise still applies. Fixed-work identity and serial collection are essential. This is the authoritative optimization benefit view. |

### Calling ancestry in plain language

**Calling ancestry** means the chain of functions that led to the instruction
being sampled. For example:

`search → negamax → lastEmpties → flips`

If a sample lands inside `flips`, an IP-only profile identifies that instruction.
A stack profile can additionally show that `lastEmpties` called it. That sample
belongs to `flips`' **self cost** and, when the helper is present among the
captured callers, also to `lastEmpties`' **inclusive cost**. Inclusive cost includes
work performed by descendants; it is not just instructions inside the helper.

A raw stack fragment does not necessarily retain every intermediate caller.
Frameless functions, inlining, tail calls and unwind/reconstruction limitations
can affect the recovered chain. Adjacent nodes in such a fragment can be
observed ancestors rather than a complete immediate caller/callee pair.

In the selected exact-search captures, the helper appears in about **23%** of
inclusive raw-fragment weight, versus **43%** in CPU Profiler's richer recovered
context. Their physical leaf-function distributions still agree closely. This
is a difference in **recovered calling context**, not evidence that the helper
performed twice as much work, and not a measurement of profiling overhead.
The repeated fixed-work clocks answer the overhead question independently.

This is why IP sampling is useful for locating hot instructions, while richer
sampled stacks are useful when the question is **who called them**.

A function's **self** weight belongs to the observed leaf. A function-table
**inclusive** weight counts a function once per sample even if recursion repeats
it; rows overlap and cannot be summed. A path tree instead retains recursive
occurrences at their actual depths; all node self weights sum to the accepted
weight. Search/filtering never silently renormalizes the profile denominator.
Other is a presentation grouping with accessible children, not discarded mass.
Address views of stack data use leaf observations; caller return addresses are
context, not additional self-cost instruction samples.

The explorer offers a small local icicle and exports actual stacks in
[Speedscope's sampled format](https://www.speedscope.app/file-format-schema.json).
Its generic `none` weight unit preserves cycles/counts without claiming they are
seconds. Use aggregate Speedscope views for that export; chronological gaps are
preserved in the original normalized data, not inferred from its generic sample
weights. Speedscope's interactions are an optional complement, not a dependency
of the local explorer. [Speedscope project](https://github.com/jlfwong/speedscope).
The aggregate flame graph convention is established independently of any one
profiler. [Brendan Gregg's flame graphs](https://www.brendangregg.com/flamegraphs.html).

## Two concrete examples

### Position evaluation

A flat IP function table answers whether production evaluator code is hot; its
instruction table and address zoom can expose where within it samples cluster.
This remains useful when an evaluator call is too short to be represented by a
separate sampled frame. A physical `evaluate`/`features` symbol can contain inline
work; a debug logical frame can split the same machine instructions differently.
No frame count is treated as an invocation count.

Actual calling stacks answer who requested evaluation: the benchmark loop,
ordinary depth-zero search, or full-window coaching. A missing physical frame can
result from inlining, tail calls or unwind limitations. It does not establish
that evaluation is cheap or absent. The standard symbolic profiles and raw
frame-chain profiles make those representation differences inspectable.
The microbenchmark throughput and its repeated controls test whether collection
changes the observed cost of these tiny calls; source-level per-call timers are
not used to establish that cost.

<!-- EVALUATOR_EXAMPLE -->

For **evaluate-B**, the unprofiled body-only rate is **67.97 million evaluations/s**, plain CV 1.28%. At 1 M cycles, IP elapsed change is +1.56% [+0.85%, +2.28%]; raw stacks versus plain is +1.58% [+0.55%, +2.63%]. The incremental stack request is +0.02% [-0.44%, +0.49%]. Leading physical IP symbols are `reversi::features(reversi::Board, int, unsigned long long)` (51.68%); `reversi::legal(unsigned long long, unsigned long long)` (36.66%); `reversi::evaluate(reversi::Board, int, int, unsigned long long)` (11.59%). IP/stack function-distribution variation is 0.17 pp.

For **evaluate-P**, the unprofiled body-only rate is **50.80 million evaluations/s**, plain CV 0.53%. At 1 M cycles, IP elapsed change is +0.62% [-0.37%, +1.61%]; raw stacks versus plain is +0.54% [-0.21%, +1.30%]. The incremental stack request is -0.07% [-0.78%, +0.64%]. Leading physical IP symbols are `double reversi::patternSum<0ul, 1ul, 2ul, 3ul, 4ul, 5ul, 6ul, 7ul, 8ul, 9ul, 10ul, 11ul, 12ul, 13ul, 14ul, 15ul>(reversi::Board, int, std::__1::integer_sequence<unsigned long, 0ul, 1ul, 2ul, 3ul, 4ul, 5ul, 6ul, 7ul, 8ul, 9ul, 10ul, 11ul, 12ul, 13ul, 14ul, 15ul>)` (33.95%); `reversi::features(reversi::Board, int, unsigned long long)` (31.11%); `reversi::legal(unsigned long long, unsigned long long)` (27.01%). IP/stack function-distribution variation is 0.29 pp.

These rates include the external call/loop/checksum and exclude recomputing own legal moves, so they must not be substituted for the older full-static benchmark rates. No invocation count is inferred from a sampled frame. The committed standard CPU/Time profiles show whatever inline expansion their actual exports supplied; raw PMI stacks add none.

<!-- END_EVALUATOR_EXAMPLE -->

### Final-empty optimization

The predecessor and current engines solve the same twelve-empty root to the same
exact value. The current source has a separately compiled specialized final-one/
two-empty helper and avoids unnecessary general propagation/pass/control work.
An address/function differential shows where sampled weight moved. Genuine
stack paths establish that the helper is reached from search and how its own
cost relates to its callers; an address sunburst alone cannot establish that
relationship. Exact instruction addresses are not naively aligned across two
different binaries. The complete unprofiled runtime comparison establishes the
benefit, rather than the helper's percentage or its new function name.

<!-- FINAL_EMPTY_EXAMPLE -->

On this **one disclosed twelve-empty root**, complete fixed work falls from **4.0447 s to 2.6562 s**; current/previous paired change is -34.25% [-34.55%, -33.96%]. This is a narrower root-specific result than the earlier independent twelve-root batch. The CPU Profiler capture places the helper in 42.76% of accepted inclusive cycle-period weight; 100.00% of its weight retains a `main` frame.

Actual observed helper caller paths include:

- `reversi::Engine::negamax(reversi::Board, int, int, double, double) → reversi::Engine::negamax(reversi::Board, int, int, double, double) → reversi::Engine::lastEmpties(reversi::Board, int, int, double, double, unsigned long long)`.

The differential table explains redistribution, the real icicle establishes calling context, and the unprofiled benchmark establishes the practical benefit. A larger helper share is not a regression.

Selected complete rep-0 IP captures (independent all-accepted denominators, same event/period):

| Physical function | Previous cycle-sample share | Current cycle-sample share |
| --- | --- | --- |
| negamax | 47.44% | 28.03% |
| flips | 39.14% | 58.77% |
| legal | 13.39% | 4.37% |
| lastEmpties | 0.00% | 8.77% |

`flips` gains share while the complete search becomes faster. General recursion/legal-work share falls and the specialized helper appears. This supports redistribution, not a precise absolute time saving for any instruction. Build-specific instruction addresses and source/assembly remain inspectable in the IP table and address zoom; they are not aligned solely by equal numeric offsets.

<!-- END_FINAL_EMPTY_EXAMPLE -->

## HIS_profile relationship

The [HIS reference](https://github.com/rharriszzz/HIS_profile) maps samples through
address-space/module metadata, resolves heavily sampled regions, and refines
large hot ranges at 4,096- and 16-byte scales. Its
[analysis source](https://github.com/rharriszzz/HIS_profile/blob/master/his_profile/his_profile.py)
reuses collected address records as mappings become more detailed. The example
notebook profiles a Gray–Scott/SciPy workload and sends the resulting hierarchy
to the sunburst. This is address containment, not a sampled call tree.

The original [plotting source](https://github.com/rharriszzz/HIS_profile/blob/master/his_profile/his_plotting.py)
uses a global small-branch display cutoff; its optional Other wedge is disabled.
The new viewer makes that mass explicit and zoomable, uses smaller ranges suited
to the native engine, and refines presentation without recollecting data.
Tables, address rings and stack views consume the same normalized records.
The original copyrighted source/notebook/reference image remain separate in
ignored local reference storage. None of their implementation is copied or
vendored into this repository.

## Modern tools and optional tracing

CPU Counters also offers discarded-branch and L1D-miss instruction modes, plus
guided bottleneck/counter views. Their event distributions answer different
questions from cycle sampling. The preserved guided probe illustrates the
available events; it is not mixed into the stack-free cycle results.
[Apple's bottleneck documentation](https://developer.apple.com/documentation/xcode/addressing-cpu-bottlenecks).

Processor Trace could expose control flow and short calls between sample points,
call counts, branch choices and sequences of specialized final-empty work.
Inlining still requires debug/source interpretation, and traces do not reveal
arbitrary data values. It is a fourth technique, not an IP sampler. The earlier
bounded probe failed because this Mac is not enabled for tracing; no Developer
Tools setting was changed and no large trace was captured. No Reversi trace
interference estimate is inferred from a vendor demonstration.
[Apple Processor Trace documentation](https://developer.apple.com/documentation/xcode/analyzing-cpu-usage-with-processor-trace).

V8's current POSIX sampler sends `SIGPROF` to its target thread and reads the
saved register context before collecting a software stack sample. This is
source-level corroboration, not a disassembly of the installed Chrome build;
CDP itself does not expose its internal unwind implementation. [V8 sampler
source](https://github.com/v8/v8/blob/main/src/libsampler/sampler.cc).

Chrome's worker CPU profiles have their own software-sampler configuration,
V8/JS/Wasm frames and actual `startTime`/`timeDeltas` provenance. They include
worker dispatch/idle within the profiler interval, unlike the native fixed-work
signpost selection. The Performance panel can add broader task/rendering context;
a CPU profile alone does not supply all those records.
[Chrome Performance documentation](https://developer.chrome.com/docs/devtools/performance),
[CDP Profiler protocol](https://github.com/ChromeDevTools/devtools-protocol/blob/master/json/js_protocol.json).

Perfetto is useful for a future cross-thread scheduling/trace question; it is
also a consumer/analysis system rather than one universal measurement mechanism.
Its documented CPU-profiling setup separately configures a sampling timebase and
stack collection. Nothing about a Perfetto chart alone proves hardware triggering
or stack-free collection. No continuous-profiling service is installed here.
[Perfetto CPU sampling](https://perfetto.dev/docs/quickstart/callstack-sampling).

## Qualification, recommendations and answers

Tests cover event/weight denominators, self/inclusive recursion accounting,
address bounds, unknown references, malformed imports, explicit unresolved/Other
mass, matched differential normalization and real timestamp requirements. Actual
Chrome acceptance exercises filtering/sorting, source details, zoom, tooltips,
icicle search, Speedscope export, differential paths, chronology, malformed data
and timestamp-free refusal. Fast Reversi correctness tests run before and after.
Detailed counts and complete source/build identities are in the committed receipt.

<!-- RECOMMENDATIONS_AND_ANSWERS -->

Regular use should center on three views: **(1) repeated unprofiled benchmark/interference plots, (2) flat hardware-IP tables with source/assembly and optional address sunburst zoom, and (3) an on-demand genuine-stack icicle/Speedscope view**. The sunburst is particularly useful for a broad physical function with a compact hot region; a table remains more precise for ranking. The chronological sample chart adds less to these steady single-thread loops, but is useful for phase/core movement and worker/idle context.

Start a future pilot with 10 M cycle IP sampling for coarse function questions, then use 1 M when finer instruction support is needed. Recheck target interference and sample coverage for that workload. Collect stacks when caller information can resolve a question; do not reject them on an assumption that unwinding must be expensive. The measured intervals and data costs, rather than a zero-overhead claim, should decide the period.

| Question | Answer |
| --- | --- |
| 1. Genuine M4 hardware IP-only samples? | **Yes.** Explicit counter configuration plus PMI records with empty user/kernel stack requirements and fields; selected exports are checked for hidden stack tables. |
| 2. Actual hardware events? | Accepted minimal captures use **CORE_ACTIVE_CYCLE**, event 17 in this CPU-family database, at 1 M / 10 M periods. CPU Profiler’s exported collector requirements also identify CORE_ACTIVE_CYCLE at 1 M / 100 k cycles; its individual cycle weights are retained. Periodic/V8 profiles are separate software samples; recovered branch-related probes are not primary cycle evidence. |
| 3. Measurable IP interference? | Current-engine point estimates span -0.52% to +1.80%; 4 of 12 mode/workload intervals lie wholly above zero. Other small differences remain unresolved at this precision; this does not prove zero overhead. |
| 4. Additional stack interference? | Matched raw-stack versus IP elapsed estimates span -0.58% to +0.97%; 0 of 12 intervals lie wholly above zero. See per-period CPU/elapsed intervals and collector costs; do not substitute differences between shipped templates for a pure unwinding cost. |
| 5. Tiny evaluator performance? | Static B at 1 M-cycle IP shows +1.56% [+0.85%, +2.28%]; static P shows +0.62% [-0.37%, +1.61%]. Dense CPU Profiler shows +3.29% [+1.46%, +5.15%] B and +2.26% [+1.33%, +3.21%] P. B has a resolved condition-associated increase; P's IP result is unresolved. No per-call instrumentation was added. |
| 6. Frequency dependence? | The static B 1 M-cycle IP capture density is 10.00× the 10 M setting. CPU Profiler high is about 10× normal density; Time Profiler uses 1,000/100 µs. Dense CPU Profiler consistently adds a clearer elapsed penalty; raw IP frequency effects are smaller and are not uniformly resolved. The tables/plots retain actual counts, volume, weights and uncertainty. |
| 7. Same important hotspots? | IP and matched raw stacks have the same leading physical symbol in 6/6 current workloads; pooled function-distribution variation spans 0.17–0.61 pp. Individual instructions/regions are less stable; sparse counts, skid, aliasing, inlining and core weighting remain limits. |
| 8. Best instruction-cost views? | Sortable IP/function tables with actual assembly/source, followed by address-containment sunburst refinement. No caller inference is made from these rings. |
| 9. Best calling-context views? | A real sampled-stack icicle/flame graph, supported by self/inclusive tables and weighted Speedscope export. |
| 10. Best final-empty explanation? | Function/path differential plus genuine helper caller paths explain redistribution; unprofiled full-search elapsed time establishes benefit. |
| 11. What would Processor Trace add? | Control-flow/branch sequences and short-call behavior between samples, with much larger data/decoding cost. Hardware support exists, but this Mac is not enabled; no setting was changed and no Reversi trace-overhead claim is made. |
| 12. Future combination? | Fixed-work unprofiled controls + qualified hardware IP tables/refinement + selective real stacks. Use chronology when timing/context is the question, and bounded trace only for a question sampling cannot resolve. |

<!-- END_RECOMMENDATIONS_AND_ANSWERS -->
