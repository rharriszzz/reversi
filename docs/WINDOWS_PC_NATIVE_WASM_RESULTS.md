# Windows PC native C++ and browser Wasm qualification

Actual Windows Chrome runs the committed Wasm binary correctly. On the directly
matched eight-root panel it is **51.8× faster than JavaScript B and 49.9× faster
than JavaScript P**, while taking **1.38× / 1.48× native elapsed time**. The M4
completes those native batches **1.81× / 1.87× faster than this PC**. Longer work
blocks retain a roughly 50× Wasm/JS advantage and expose important timing
variability; their separate results below should accompany these ratios.

All 24 balanced engineering acceptance games pass independent replay. No frozen
model changed, and no strength tournament or learning campaign was started.
The clean PC checkout was fetched and fast-forwarded from
`40a0cf2` to published `main` at `c605503`. Historical research remains read-only.
No frozen evaluator was retrained and no frozen coefficient changed.

## Initial resource audit

Windows 11 Home 10.0.26300, i7-14700F: 16 GiB installed / 15.725 GiB OS-visible
physical RAM, approximately 4.45 GiB available at the initial sample; committed
26.22 GiB against a 59.72 GiB limit. Pages input/output and page reads were zero
in that sample. This is materially better headroom than the earlier 1.5 GiB
reported in the request. WSL2 initially had approximately 6.23 GiB available of
7.61 GiB, with 88.6 MiB swap allocated and zero observed vmstat swap activity.
Free storage: approximately 883 GiB on the Linux filesystem and 348 GiB on C:.

Windows reports 20 physical cores / 28 logical processors; the VM exposes 14
virtual two-thread cores / 28 processors. These are different topology views.
Initial Windows CPU load was 2%; Linux was essentially idle. Chrome had 18
processes with summed working sets 2.72 GiB and private bytes 3.00 GiB; Edge had
eight processes, 150 MiB working sets / 262 MiB private bytes. The WSL VM had
1.34 GiB working set / 3.50 GiB private bytes. Memory Compression, Explorer,
Defender, Steam and Dell services were other visible consumers. Process working
sets share pages; their sum is not unique physical use. Private committed bytes
are not resident memory. Cumulative process CPU time is not current utilization.

Python 3.10.12, Node 24.16.0, Ubuntu GCC 11.4.0, Codex CLI 0.163.0 and installed
Windows VS Code 1.141.1. No running Windows VS Code process appears in the app
samples; the WSL Codex process is roughly 206 MiB RSS during the audit. Windows Chrome
156.0.8078.48 and installed Edge 156.0.4314.42 were detected; Chrome is the browser
actually qualified here. Linux hardware performance events report
`<not supported>`; software `cpu-clock:u` works using locally extracted Ubuntu
perf 5.15.222. No kernel settings or privileged configuration was changed.

## Native and actual Windows qualification

The production build retains C++17, `-O3 -ffp-contract=off -fno-fast-math` and all
frozen model identities. The initial timed-search regressions exposed a GCC 11
aggregate return-slot issue: assigning `result=root(...)` allowed the return
object to overwrite the previous completed iteration before a deeper search
threw. Fixed-depth values were correct, but interrupted search could report
depth zero or an invalid fallback. A separate completed return object now
precedes assignment. All 15 native regression groups then pass, including
ASan/UBSan. No search algorithm or floating-point tolerance changed.

Broad native qualification covers 2,007 legal positions, 12,042 B/L/P static
queries, 96,720 independent legal children, 96 fixed searches and twelve exact
endgames. Maximum numerical error is zero at absolute tolerance 1e-10. All
169 Node tests pass, including actual committed-Wasm execution and independent
depth-15/16 references. The Wasm binary is unchanged; it was compiled by the
previous pinned Clang/Emscripten toolchain, whose exception path passes.
The manifest retains its original source/build identity; the small native
exception workaround is explicitly a later source change, not a rebuilt Wasm.

Actual **Windows** Chrome reports `navigator.platform=Win32` and Windows NT in
its browser identity. The unchanged 372,213-byte module loads through WSL
localhost with `application/wasm`. A disposable Windows TEMP profile is launched;
WSL NAT is bridged through a Windows loopback CDP websocket over PowerShell
stdio and a private WSL loopback relay. No Windows listening interface, firewall
rule, ordinary profile or Chrome preference is changed.

The Windows worker independently passes 524 numerical comparisons with maximum
error zero: 208 static queries, 94 full-window root alternatives, 282 independently
legal PV placements with optimal reply values checked against native, and 30
exact alternatives from the preserved depth-15/16 reference roots. Twenty
close/reinitialize cycles retain 32 MiB linear memory. Actual application tests
pass B/L/P coaching, P timed play, complete B/P games, model-consistent review,
undo/replay, cancellation/model changes, cached reload, B fallback, P refusal,
custom recovery, injected ABI mismatch and reload recovery.
The original custom-weight browser check also passes training, the actual export
download/Blob, persistence across reload, keyboard comparisons and game review.

Harness problems were retained locally and repaired: stdio needed explicit
UTF-8 for middle-dot text assertions, large CDP messages needed a larger reader
limit, and cleanup PID token substitution initially damaged `/PID`. Only test
Chrome instances created by this task were closed during recovery. Existing
user applications and saved settings were left alone.

Two legacy Python smoke tests initially stopped. Their 60-second allowance left
only 16.2 seconds before the data-stage cutoff, close to the expanded actual-Wasm
correctness cost. Their test-only allowance is now
180 seconds, with a 90-second subprocess/poll timeout; the scientific runner,
old protocols and experiment allowances are unchanged. An additional run safely
stopped after source files were edited while its immutability timer was active;
the final unchanged-source rerun passes all **38 Python tests** in 130.8 seconds.
The initial assertions did not retain a stopping reason, so the exact cause of
each first stop cannot be proved from those retained diagnostics alone.
The existing nonfatal subprocess ResourceWarnings remain visible in its log.

`NATIVE_CPU=native node scripts/native/build.mjs` now provides an explicit,
optional host-target build in `.local-research/native-host`, using `-march=native`
on x86 or `-mcpu=native` on ARM64. The default remains portable. Both retain
floating-point restrictions and complete flag/source/binary receipts. On this
PC, the default GCC target uses software `__popcountdi2`; both builds will be
measured rather than confusing that build choice with hardware performance.
The host build also passes all 15 native regression groups.

[Compact qualification and build identities](data/windows-pc-qualification-20261030.json).
Raw logs, extracted tools, temporary profiles and executable files stay ignored.

## Matched performance and variability

The primary panel exactly matches the published M4 browser study: eight disclosed
roots, including opening, middle, late, forced pass and terminal empties. Depth
is 7 below 28 occupied, 6 below 52, otherwise min(9, empties), at least one.
Five serial repetitions reverse implementation order; the optional host native
build is included as a fourth condition. The original compiled JavaScript P
closure and Float32 tables have the **same reference SHA-256 as the Mac export**.
No invented substitute P evaluator is benchmarked. Browser work runs in a worker;
native runs in persistent WSL2 processes. No correctness suite or native profiler
runs concurrently with these timings. Hardware affinity and saved power settings
are unchanged.

| Model / backend | Median complete batch ms | Five-trial range ms | Million nodes/s | Median static ns/eval | Million static evals/s |
| --- | ---: | ---: | ---: | ---: | ---: |
| B / native portable | 15.342 | 14.929–16.834 | 9.69 | 45.82 | 21.83 |
| B / native host target | 16.762 | 14.907–19.543 | 8.87 | 37.76 | 26.49 |
| B / Windows Wasm | 21.200 | 19.000–23.500 | 7.01 | 54.00 | 18.52 |
| B / Windows JS | 1097.300 | 1034.000–1107.600 | .135 | 2527.00 | .396 |
| P / native portable | 19.484 | 18.616–20.200 | 8.70 | 56.87 | 17.58 |
| P / native host target | 18.807 | 17.967–20.547 | 9.01 | 48.93 | 20.44 |
| P / Windows Wasm | 28.900 | 20.200–38.600 | 5.87 | 93.00 | 10.75 |
| P / Windows JS | 1441.900 | 1305.500–1519.800 | .117 | 2728.00 | .367 |

Static numbers are medians of the 40 repeated-position rates, using the same
aggregation as the Mac report. They include complete feature extraction and
mobility. Sub-resolution browser times are not interpreted as precise differences.
The fixed B tree has 148,636 nodes / 90,353 evaluations; P has 169,532 / 108,829.
Native and Wasm trees/evaluation counts match exactly. JS visits 148,004 / 168,301
nodes, respectively, because its TT and hint policies differ. Every fixed score
and accumulated static checksum agrees exactly. Different B/P trees are never
used as a direct measure of evaluator speed.

The P Wasm range and the surprising initial host-target B regression warranted
a bounded follow-up. All original trials are retained. Seven additional rotated
conditions per model execute **ten complete eight-root batches inside each work
block**, after two warmup batches. Browser batches run wholly inside their worker;
native batches use persistent IPC. Values and native/Wasm node/evaluation totals
remain identical. These are supplemental steady-work measurements, not replacement
Mac trials or a reason to discard inconvenient primary observations.

| Model / backend | Median ms per batch | Seven-block range ms |
| --- | ---: | ---: |
| B / native portable | 12.499 | 11.820–14.070 |
| B / native host target | 11.424 | 11.156–11.976 |
| B / Windows Wasm | 19.910 | 17.910–24.260 |
| B / Windows JS | 957.900 | 938.970–980.310 |
| P / native portable | 15.933 | 14.069–16.792 |
| P / native host target | 14.785 | 12.949–16.224 |
| P / Windows Wasm | 24.720 | 19.760–26.990 |
| P / Windows JS | 1293.460 | 1263.270–1323.600 |

Here Wasm is **48.1× B / 52.3× P** faster than JS. It takes **1.59× / 1.55×**
portable-native time, or **1.74× / 1.67×** host-native time. Host targeting increases
median native throughput **9.4% B / 7.8% P**, equivalent to 8.6% / 7.2% less
elapsed time. These correct the preliminary 11–13% progress-update estimate.
Disassembly and sampling verify that it eliminates software population-count
calls; it changes no tree or coefficient. The optional target remains explicit
because these binaries depend on the compiling CPU. The default stays portable.

The longer blocks reduce several discrepancies but do not eliminate ordinary
desktop variability. The unchanged tree rules out different scientific work as
the cause of these same-model variations. No sampled Windows page output occurs
during either timing panel. Warmup/tiering, frequency, hybrid-core placement,
background applications and scheduling remain plausible contributors, not
independently identified causes. No cache-miss or per-core frequency attribution
is available. A few-percent universal speed claim is not warranted.

### Comparison with the existing M4 measurements

| Same primary workload, median ms | PC native portable | M4 native | PC Windows Wasm | M4 Wasm | PC Windows JS | M4 JS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| B | 15.342 | 8.493 | 21.200 | 9.800 | 1097.300 | 413.800 |
| P | 19.484 | 10.416 | 28.900 | 12.600 | 1441.900 | 551.000 |

The primary native throughput advantage favors M4 by 1.81× B / 1.87× P; its
browser batches are 2.16× / 2.29× faster for Wasm and 2.65× / 2.62× for JS.
Comparing the supplemental PC blocks with the *earlier single-batch* Mac medians
narrows the native gap to 1.47× / 1.53× portable, or 1.35× / 1.42× host-targeted.
That sensitivity is disclosed rather than picking the most favorable number.

These compare observed complete implementations: Apple Clang 21 / native ARM64
macOS versus GCC 11 / Intel WSL2, and Mac diagnostic Chromium 156.0.8078.4
(headless benchmark) versus installed visible Windows Chrome 156.0.8078.48.
Compiler target, V8 patch, display mode, virtualization, hybrid scheduling and
background conditions differ. Identical positions, horizons and trees support
the workload comparison; they do not isolate CPU architecture or predict
multi-worker research throughput. No fresh Mac hardware test was run this round.

### Timed searches, exactness and deadlines

Three repetitions × six matched nontrivial roots yield 18 observations per cell,
72 conditions overall. Implementation order alternates; no profiling is active.
Mean completed placement depths:

| Model / budget | Native portable | Native host | Windows Wasm | Windows JS | Prior M4 native | Prior M4 Wasm | Prior M4 JS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| B / 80 ms | 8.83 | 8.83 | 8.56 | 5.50 | 9.50 | 9.00 | 6.17 |
| B / 300 ms | 9.67 | 9.67 | 9.61 | 6.44 | 10.33 | 9.83 | 7.00 |
| P / 80 ms | 8.67 | 8.67 | 8.28 | 5.22 | 8.83 | 8.67 | 6.17 |
| P / 300 ms | 9.33 | 9.33 | 9.00 | 6.33 | 9.50 | 9.44 | 7.33 |

Both native builds and Wasm solve 6/18 searches in every cell; JS solves 3/18.
The panel contains repeated roots and its exact fraction is descriptive. Original
JS retains its depth-14 ceiling, whereas C++ uses the natural empty-square limit.
Separate deep-reference checks and actual Windows games establish beyond-14
behavior. All per-trial depths, nodes, evaluations, core times and available TT
counters are published; higher timed node totals need not cross another whole
depth. These engineering games establish no new playing-strength conclusion.

Maximum core overrun in the matched timed panel is .082 ms portable native,
.456 ms host native, 1.2 ms Wasm and .4 ms JS. Real application games have a
larger Wasm tail: 5.4 ms maximum core overrun and 46.7 ms maximum worker-request
overrun, including initialization/message delivery. These tails are retained.
Browser timer resolution is roughly .1 ms. Core deadlines do not guarantee an
identical UI-delivery deadline under Windows scheduling.

### TT and allocation observations

| First primary batch, native portable | B | P |
| --- | ---: | ---: |
| Nodes / actual static evaluations | 148,636 / 90,353 | 169,532 / 108,829 |
| TT probes | 56,524 | 59,730 |
| Same-generation bound hits / TT cutoffs | 5,600 / 4,560 | 5,513 / 4,729 |
| Identity hits including older hints | 5,600 | 28,508 |
| Collisions / replacements | 4,703 / 4,159 | 10,968 / 10,601 |
| Stores / rejected stores | 51,110 / 494 | 54,455 / 314 |
| Alpha-beta cutoffs / first-move cutoffs | 35,921 / 24,969 | 39,603 / 28,611 |

Wasm's useful bound cutoffs, complete trees and evaluation counts match; older
identity hits/collisions differ slightly because its handle receives additional
warmup queries. Hints are disabled in these fixed comparisons. Every engine
allocates the same 10 MiB direct table. Code inspection finds no recursive
per-node heap allocation; native RSS peaks at about 13.8–13.9 MiB with one thread
in the separate startup/search probe. This is an observed finite workload, not
an allocation-event census.

## CPU profiling and interpretation

Linux perf 5.15.222 is extracted locally from Ubuntu's tools package, without
system installation. Hardware `cycles`, `instructions` and `cache-misses` report
unsupported events. User `cpu-clock` works. Six four-second recordings at 999 Hz
produce 3,864–4,017 samples each with zero reported lost samples. Profile builds
add symbols/frame pointers; production timing uses separate uninstrumented
binaries. Self samples are CPU-clock samples, excluding blocked IPC waits.

Representative portable-native P shares:

| Self sample share | Opening | Middle | Exact 12-empty endgame |
| --- | ---: | ---: | ---: |
| Negamax / inlined TT and alpha-beta | 27.2% | 19.8% | 55.6% |
| Move ordering | 11.2% | 10.5% | 4.0% |
| Legal generation | 17.3% | 18.8% | 17.9% |
| Flipping | 12.5% | 14.1% | 21.4% |
| Linear features plus evaluator wrapper | 18.1% | 20.7% | ~0 |
| Pattern gathers/lookups/sum | 6.8% | 7.2% | ~0 |
| Software popcount plus its PLT thunk | 6.5% | 8.0% | .6% |

Host targeting removes the software popcount symbols. Its patterns remain
7.4% / 8.2% of opening/middle samples, and exact solving still spends about
39% in separately visible rules plus 60% in negamax/ordering. There is no newly
dominant pattern bottleneck demanding another evaluator rewrite.

Separate exclusive span instrumentation reports legal/flips/features/patterns/TT/
ordering. Among those instrumented spans, portable TT accounts for 20.0% opening,
13.0% middle and 48.6% endgame; host figures are 20.8%, 11.5%, 48.9%.
These are **fractions of instrumented spans**, not uninstrumented CPU percentages.
Clocks and inhibited optimization substantially perturb this small core. Call
counts and full timings are retained; no cache behavior is inferred from them.

Actual Windows Wasm worker CDP profiles request 100-µs sampling during separate
2.5-second P workloads, yielding 3,644–3,888 samples (effective intervals around
.65–.69 ms, substantially coarser than requested):

| Self sample share | Opening | Middle | Exact endgame |
| --- | ---: | ---: | ---: |
| Negamax including inlined flips/TT/ordering | 58.8% | 51.9% | 79.3% |
| Separately visible legal generation | 19.7% | 20.7% | 19.6% |
| Seven-feature evaluation | 12.3% | 13.7% | ~0 |
| Pattern gathers/lookups/sum | 8.0% | 11.4% | ~0 |

The earlier M4 Wasm profile has the same broad bottlenecks: search/rules dominate,
and patterns take roughly 8–10% in nonterminal search. The Windows nonterminal
feature share is larger. Native exact-endgame attribution differs more: the
earlier Mac exposed 39.1% legal / 30.7% combined search, while GCC exposes 17.9%
legal / 59.6% search plus ordering. Different inlining, sampling scope and code
generation prevent interpreting that shift as a measured cache regression.
Both agree that exact solving spends essentially no time in static patterns.

The warmed browser lifecycle probe consumes 3.989 aggregate process CPU seconds
over 2.712 wall seconds, including browser/worker/transport/background work.
It is not per-search thread CPU. Native rows carry `std::clock` CPU times.
No hardware cache-miss, bandwidth or exact allocation-rate measurements are
available. Raw perf, CDP profiles and timeline traces stay local; compact symbol
counts, counters and reproducible commands are public.

## Startup, boundary costs and browser acceptance

Five native starts per build measure median complete startup/hello 3.59 ms
portable / 3.42 ms host, including receipt/hash checking, process creation and TT
allocation. Warmed Python/native hello round trips are 28.8 / 29.3 µs median.
The primary Windows worker initializes Wasm in 19.0 ms. Five fresh contexts in
one browser process initialize modules in 16.2–29.5 ms; navigation/worker/module
readiness is 67.9–85.7 ms including automation. Later contexts can reuse browser
code caches; these are not five independent disk-cold browser starts.

Full inspect/JSON conversion costs 32.5–59.5 µs per Wasm request in 1,000-query
batches, including static work and child formatting. Python→Windows-browser→worker
round trips are typically 2–3 ms through the debugging bridge. That bridge is
test automation, not part of ordinary UI search latency. Per-search computation
crosses the Wasm boundary once; no per-leaf JS callback exists.

The fixed 24-game schedule crosses B/P, 80/300 ms, both human colors and three
disclosed deterministic random-human seeds per cell. It finishes in 172.2 seconds,
with 810 applied computer replies, 173 forced passes, four terminals with empty
squares and 178 native-matched coach alternatives. Independent sentinel rules
replay every placement/pass/final outcome. A separate public audit independently
solves 68 small exact computer searches. There are zero page errors and zero
depth-zero fallbacks. All depth-two coaching PVs are independently legal; the
separate depth-three Windows qualification checks optimal continuation values.

| Model / budget | Games | Computer moves | Mean depth | Max depth | Exact moves |
| --- | ---: | ---: | ---: | ---: | ---: |
| B / 80 ms | 6 | 202 | 8.61 | 14 | 50 |
| B / 300 ms | 6 | 200 | 9.44 | 19 | 59 |
| P / 80 ms | 6 | 202 | 8.61 | 17 | 56 |
| P / 300 ms | 6 | 206 | 9.76 | 20 | 61 |

These different game paths are not matched strength observations. Visible frame
gaps peak at 20.0 ms; maximum per-game p95 is 17.7 ms. A separate 20-cancellation
300-ms P timeline records maximum/p95 frame gaps 16.8 ms, no observed main-thread
long task and no main trace event above 20 ms. Automation click times include
driver/actionability waits and are not UI computation times.

Wasm linear memory remains exactly 32 MiB per live engine, with a 128 MiB cap.
Twenty explicit close/reinitialize cycles and repeated worker termination/restart
pass. The test browser's process working-set sums decrease from 968 to 890 to
875 MiB across games 1/12/24; private committed sums decrease from 678 to 629 to
597 MiB. Shared pages are counted more than once in working-set sums. This finite
run supports memory stability, without proving absence of all future leaks.

The actual UI checks cover all-move B/L/P coaching and comparisons, P playing,
model-consistent historical review, undo/replay, rapid changes and stale work,
module failure and ABI mismatch recovery, custom weights and ephemeral custom
training. The final export check redirects only its disposable browser context's
download into that temporary profile, verifies the saved Windows JSON file
against the exact export Blob, then checks saved-state reload. Frozen B/P tables
and ordinary user profiles remain untouched. The Windows screenshot was visually
inspected. Edge is detected but not executed; no Safari, Firefox, native Windows
C++ or new Mac execution is claimed.

## Final resources and pressure findings

Continuous samples are approximately 15 seconds apart plus query time. WSL2
available memory never drops below 5.63 GiB; swap output is zero throughout the
monitor, with only eleven pages (44 KiB) of swap input and zero memory-pressure
`avg10`. The initially allocated ~88.6 MiB swap is historical allocation, not
evidence of continuous thrashing.

Windows headroom is not uniformly above the preferred 3 GiB target. The initial
audit is ~4.45 GiB; monitored availability reaches a low of **2.18 GiB**, including
test browsers and ordinary applications. Two isolated page-output samples during
qualification reach 1,645 and 27,382 pages/s; these are genuine observed paging
activity and are not omitted. **Every sampled page-output rate during the primary
and supplemental timing panels is zero.** There are intermittent page-input reads
(overall maximum 882 pages/s); file-backed faults also contribute, so these are
not a measured page-file-thrashing rate. The smaller serial test was retained
because headroom remained above its emergency floor, WSL had ample reserve and
page output was not sustained during measurements.

Windows application/system CPU activity varies; per-condition memory, aggregate
CPU counters and leading active processes are preserved. WMI, Defender, Task
Manager, Chrome and other services appear in these snapshots. Global CPU samples
include test execution and monitor overhead; they are not exact background-only
or per-search CPU measurements. Neither user apps nor saved settings were changed
to improve numbers. This supports the large speed comparisons, with the observed
variability limiting finer platform conclusions.

The final audit and all intermediate samples are in the resource evidence linked
below. At 22:21 UTC, after the final UI/export and fast checks:

| Resource | Initial audit | Final audit |
| --- | ---: | ---: |
| Windows OS-visible / installed physical GiB | 15.725 / 16.000 | same |
| Windows available physical GiB | ~4.45 | 4.277 |
| Windows committed / limit GiB | 26.22 / 59.725 | 24.873 / 59.725 |
| Windows sampled pages input / output per second | 0 / 0 | 0 / 0 |
| WSL2 available GiB | 6.23 | 6.44 |
| WSL2 allocated swap MiB | 88.63 | 88.62 |
| Linux filesystem free GiB | 882.57 | 882.21 |
| Windows C: free GiB | 347.93 | 346.28 |

All task-created Chrome roots are closed and temporary profiles removed;
the resource monitor is stopped after its final audit. Ordinary Chrome/YouTube,
Codex, WSL2 and other applications remain under user control.

## Ranked next engineering steps

1. **Use the qualified optional host build for local native work**, while keeping
   portable output as the default and preserving binary receipts. The longer
   blocks show a modest 9.4% B / 7.8% P throughput benefit, not a reason to change
   Wasm flags. Further compiler comparison is optional; it was not expanded here.
2. **Investigate final-empty move/flip specialization next.** Rules plus search/TT
   dominate exact solving in both native and Wasm. A small last-one/two-empty
   path, checked against independent raw-margin endings and forced passes, is a
   focused experiment. The roughly 39% separately visible native endgame rule
   share gives an Amdahl ceiling, not a promised gain: even halving all of that
   share would improve total time only about 1.24×. A narrower path will affect
   less work. Require complete-search gains across multiple roots before retention.
3. **Consider a genuinely packed/aligned TT as a separate experiment.** The old
   80-byte two-way bucket already lost about 10–12% on M4 despite more hits; do
   not repeat it unchanged. A full-identity, double-score layout fitting a cache
   line deserves costing, with equal allocated memory, generation/horizon/bound
   qualification and elapsed time as the criterion. Current profiles justify
   investigating TT cost but cannot establish a cache-miss benefit.
4. **Try cheap ordering only after a bounded tree/cost pilot.** First-move cutoffs
   already cover 69.5% B / 72.2% P of fixed-panel alpha-beta cutoffs. There may be
   room for inexpensive ordering, but lower node counts alone do not establish
   a speed win. More elaborate PVS would need its own window/re-search review.
5. **Batch shallow coaching facts if UI overhead matters.** P performs immediate
   inspection per candidate; the boundary costs are measurable but small beside
   ordinary 80/300-ms play. This is lower priority than endgame/search work.

The remaining bottlenecks justify one small endgame experiment. They do not
justify another evaluator training campaign, a large tournament, or a broad
search rewrite on this evidence. No further optimization was started.

## Evidence and reproduction

- [Complete compact results, profiles, identities and acceptance summary](data/windows-pc-results-20261030.json).
- [Every primary/timed trial and supplemental work block](data/windows-pc-benchmarks-20261030.json).
- [All 24 replayable games and applied computer metrics](data/windows-pc-games-20261030.json).
- [Initial/final and intermediate resource snapshots](data/windows-pc-resources-20261030.json).

Native portable executable SHA-256:
`06d301e9cfd424e0f299f847910e6cbf098262cbdd4c95a241cea142340fce3c`.
Host executable:
`b160f196dc76f3111b5f0c449df5b78d801407f014793d377d3ba31c125f9bbf`.
Full source/header/model/build hashes and original Wasm artifact hashes are in
the evidence. Intermediate qualification was committed/pushed as
`a00ba4c69ca13ea173909ec7b0206202506cf6ca`, before timing began. The final report
and public verification are committed separately; its exact hash is reported
after push/remote verification, avoiding a self-referential hash in this file.
The commands are `git commit -m "Qualify WSL2 native search and actual Windows Chrome Wasm"`
and `git commit -m "Report Windows native Wasm benchmarks and browser acceptance"`,
each followed by `git push origin main` and remote `refs/heads/main` verification.

The active measurement stages occupy roughly ten minutes, well below the
approximately two-hour intensive-measurement ceiling; setup/correctness is
separate. Large raw traces, local executables, downloaded tools, temporary model
exports and browser profiles are excluded from Git.

### Qualification commands

From WSL2 bash, with Windows Chrome installed:

```bash
node scripts/native/build.mjs
node --test --test-concurrency=1 tests/*.test.mjs
NATIVE_SANITIZE=1 node --test --test-concurrency=1 tests/native-search.test.mjs tests/native-v2.test.mjs
NATIVE_RUN=.local-research/windows-pc-20261030 node scripts/native/qualify.mjs
python3 -m venv .local-research/windows-pc-20261030/venv
.local-research/windows-pc-20261030/venv/bin/pip install playwright==1.64.1 websockets==15.0.1
node scripts/wasm/fixtures.mjs
cp .local-research/wasm-20261030/fixtures.json .local-research/windows-pc-20261030/fixtures.json
.local-research/windows-pc-20261030/venv/bin/python scripts/windows-pc/qualify.py
REVERSI_WINDOWS_BROWSER=1 REVERSI_WASM_OUTPUT=.local-research/windows-pc-20261030 \
  .local-research/windows-pc-20261030/venv/bin/python tests/wasm_browser_check.py
```

### Measurement commands

Start the resource monitor only after the initial audit, then run each command
serially. These Windows commands are for WSL2 bash; the default existing Wasm
scripts still use the normal test Chromium on macOS when the Windows environment
variable is absent.

```bash
pc_python=.local-research/windows-pc-20261030/venv/bin/python
python3 scripts/windows-pc/resources.py > .local-research/windows-pc-20261030/resource-monitor.log 2>&1 &
reversi_monitor_pid=$!
trap 'kill "$reversi_monitor_pid" 2>/dev/null || true' EXIT
NATIVE_CPU=native node scripts/native/build.mjs
REVERSI_WINDOWS_BROWSER=1 REVERSI_WASM_OUTPUT=.local-research/windows-pc-20261030 \
  REVERSI_HOST_RECEIPT=.local-research/native-host/build.json \
  "$pc_python" scripts/wasm/benchmark.py
node scripts/windows-pc/profile.mjs
REVERSI_WINDOWS_BROWSER=1 REVERSI_WASM_OUTPUT=.local-research/windows-pc-20261030 \
  REVERSI_ACCEPTANCE_REPS=3 "$pc_python" scripts/wasm/acceptance.py
REVERSI_WINDOWS_BROWSER=1 REVERSI_WASM_OUTPUT=.local-research/windows-pc-20261030 \
  "$pc_python" scripts/wasm/lifecycle.py
REVERSI_WINDOWS_BROWSER=1 REVERSI_WASM_OUTPUT=.local-research/windows-pc-20261030 \
  "$pc_python" scripts/wasm/ui-stress.py
"$pc_python" scripts/windows-pc/steady.py
"$pc_python" scripts/windows-pc/native-overhead.py
REVERSI_WINDOWS_BROWSER=1 "$pc_python" tests/browser_check.py
kill "$reversi_monitor_pid"
python3 scripts/windows-pc/resources.py --once
python3 scripts/windows-pc/publish.py
python3 scripts/windows-pc/verify.py
```

The native profile command expects the local perf path shown in its source;
override `PERF=/path/to/perf` if already installed. This run used the user-local
extraction, with no kernel changes:

```bash
cd .local-research/windows-pc-20261030
apt download linux-tools-5.15.0-202
dpkg-deb -x linux-tools-5.15.0-202_5.15.0-202.212_amd64.deb perf-tools
./perf-tools/usr/lib/linux-tools-5.15.0-202/perf stat -e cycles,instructions,cache-misses true
./perf-tools/usr/lib/linux-tools-5.15.0-202/perf stat -e cpu-clock true
cd ../..
```

Public verification alone needs only Python 3 and the committed checkout:
`python3 scripts/windows-pc/verify.py`. It replays all games, solves small exact
searches, checks every fixed/steady score and tree, proves that the Mac panel and
original JS evaluator export match, and verifies current source/Wasm hashes.
Final fast correctness checks pass all 15 rules/search tests after modifications;
the qualified full suites pass 169 Node / 38 Python tests and 15 native sanitizer
groups. Benchmark-only additions execute in the actual Windows worker; all raw
failures and complete successful logs remain under the ignored run directory.
