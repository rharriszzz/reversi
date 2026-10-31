# Runtime CPU dispatch — PC results

**Retain the two-backend experiment, pending Mac qualification before promotion.**
Stage 1 passed and was committed/pushed on main at
`6b480ed1bc6ddcdde2fdb37872c0ca8d0a804425`. Stage 2 is isolated on
`perf/runtime-cpu-dispatch`; it is not merged into main. The intermediate design/
correctness checkpoint was pushed at `1028930db922bc89a65f9cae751a01c91755464e`.
Final publication SHA is returned separately to avoid self-reference.

[Design and usage](RUNTIME_CPU_DISPATCH_DESIGN.md),
[reproduction commands](../scripts/runtime-cpu/README.md),
[compact evidence index](data/runtime-cpu-dispatch/manifest.json),
[Stage 1 acceptance](PC_PRODUCTION_FOLLOWUP.md).

## Environment and variants

Actual i7-14700F, WSL2 Ubuntu 26.04.1, kernel 6.18.33.2, GCC 15.2.0-16ubuntu1,
Python 3.14.4, Node 24.16.0. Guest memory stayed comfortably available; no competing
research run, observed guest swap pressure, installation, power/security/kernel
change or PMU investigation. Demanding stages ran serially. Ordinary desktop scheduling is
part of the measured variability; no P/E-core attribution or hardware cycles
are claimed.

Common options: `-O3 -std=c++17 -Wall -Wextra -Wpedantic -ffp-contract=off
-fno-fast-math`, no LTO, no sanitizer or profiler in performance builds.

| Tag | Engine and whole-program targeting |
| --- | --- |
| A | Exact production `e7b79b9` source, portable GCC defaults; no dispatch |
| B | New dispatch executable, `REVERSI_CPU_BACKEND=portable` |
| C | Same executable bytes as B, `REVERSI_CPU_BACKEND=auto`; enhanced selected |
| D | Exact production algorithms, **all** translation units `-march=native` |
| E | Exact production algorithms, **all** translation units `-mpopcnt` |

B/C compile the dispatcher, portable engine, driver and adapter with explicit
`-march=x86-64 -mtune=generic -DREVERSI_CPU_DISPATCH`; only the enhanced engine
adds `-mpopcnt -mbmi -mbmi2 -mlzcnt`. D resolves to `-march=alderlake
-mtune=alderlake` here, also permitting AVX/AVX2/FMA and other extensions, while
strict floating-point options remain effective. It is a reference, not a
portable deliverable or an isolated instruction-extension experiment.

The same driver source is compiled against each corresponding header. This
avoids mixing inline configuration/member offsets after the private layout
refactor. B/C driver/executable hashes are identical. Runtime `hello` reports
POPCNT, BMI1, BMI2 and LZCNT all available, and
`cpuBackend=x86-popcnt-bmi1-bmi2-lzcnt`; forcing portable reports `portable`.
Feature exposure comes from the guest GCC detector, not CPU branding or PMU
availability. These scalar features are common to this processor's core types;
no AVX-family state support is required by C.

| Binary | SHA-256 |
| --- | --- |
| A fixed-work | `aba476a48937502687dce9657f845762c87ca723db898d0c3f866e3c17d88487` |
| B fixed-work | `78cafaf78db605927e87f59fe2d8d2b5b94a604b867f420d9599b7301d0eaa53` |
| C fixed-work | `78cafaf78db605927e87f59fe2d8d2b5b94a604b867f420d9599b7301d0eaa53` |
| D fixed-work | `745b8349f7b5abb1ef40e2ec9ce37006827302b58e4f904eecdb0fa107dd746d` |
| E fixed-work | `66562d2b53a01500161c108457ab3980d838835551597af3ef68771308e1dcb5` |
| Actual dispatch CLI | `7a8f4b740d5c827ea2ad26f96d66c42c658c0497b290120e5ecb37a5740e1727` |

The full build receipts include compiler identification, source/header hashes, all
unit flags and qualification/micro binary hashes. A fresh final-source build
reproduces all sixteen accepted binary identities (five of each harness plus CLI).

## Complete-search decision gate

Use the unchanged ordered 48-root corpus, SHA-256
`a8deadc89f811e02da19910a702b073de12707ef19895a10f7d9861d088dcfee`.
Exact12 has twelve distinct 8–12-empty roots; the separate disclosed profile
root is D12. Opening/middle/coaching contain 4/6/2 roots. Full horizons and
position IDs remain in the compact receipt. Coaching is D6, full-window for
every alternative with verified PVs. These are engineering panels, not a new
playing-strength sample or a claim covering every position.

Each accepted block has two complete warmups and repeats calibrated to a
250-ms baseline target. Nine trials rotate/reverse the five executable orders
and workload orders. Every fixed result and **all thirteen** counters must match
across variants. Core batch wall time and thread/process CPU are recorded;
per-root API elapsed times are secondary. Table cells below are geometric mean
paired elapsed changes with two-sided Student-t intervals on nine log ratios
(df=8). Intervals describe desktop/run variation on these fixed panels, without
multiplicity correction or a population-of-positions interpretation.
Negative means less elapsed time. All absolute means, SD/CV/ranges, CPU times,
per-root references/times, complete block counters and signature hashes are in
[the search data](data/runtime-cpu-dispatch/search.json) and
[summary](data/runtime-cpu-dispatch/summary.json).

| Panel/model | A ms | B/A % [95%] | C/A % [95%] | D/A % [95%] | E/A % [95%] | C/D % [95%] |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| mixed48-B | 107.920 | +1.45 [-3.29, +6.42] | -7.83 [-10.37, -5.22] | -10.24 [-13.58, -6.76] | -6.39 [-10.38, -2.22] | +2.68 [-1.25, +6.76] |
| exact12-B | 22.893 | -0.33 [-2.69, +2.09] | -5.38 [-9.29, -1.30] | -16.00 [-18.19, -13.76] | -4.41 [-7.68, -1.02] | +12.65 [+8.47, +16.99] |
| profile-root-B | 3.873 | -0.48 [-1.84, +0.90] | -7.01 [-9.19, -4.77] | -14.10 [-16.60, -11.54] | -1.73 [-4.57, +1.20] | +8.26 [+4.95, +11.67] |
| opening-B | 48.266 | -0.66 [-3.86, +2.65] | -11.40 [-13.75, -8.99] | -13.04 [-14.66, -11.38] | -10.44 [-12.35, -8.49] | +1.88 [-0.27, +4.08] |
| middle-B | 13.447 | -0.03 [-3.37, +3.43] | -10.49 [-12.91, -8.00] | -12.93 [-15.51, -10.27] | -9.04 [-11.61, -6.40] | +2.80 [-1.35, +7.11] |
| coaching-B | 10.134 | -0.15 [-1.27, +0.99] | -10.15 [-11.83, -8.44] | -9.79 [-11.59, -7.96] | -8.93 [-11.52, -6.27] | -0.40 [-2.89, +2.16] |
| mixed48-L | 121.122 | +1.75 [+0.00, +3.54] | -7.55 [-10.41, -4.59] | -10.93 [-14.06, -7.68] | -4.75 [-9.18, -0.11] | +3.80 [+1.81, +5.82] |
| exact12-L | 22.022 | -0.98 [-3.89, +2.02] | -3.55 [-8.79, +1.98] | -13.74 [-17.01, -10.35] | -2.94 [-4.66, -1.19] | +11.81 [+7.28, +16.53] |
| profile-root-L | 3.890 | +0.48 [-1.31, +2.31] | -7.08 [-8.60, -5.54] | -13.97 [-16.35, -11.53] | -3.41 [-6.10, -0.65] | +8.01 [+3.95, +12.23] |
| opening-L | 55.429 | +0.58 [-1.04, +2.23] | -9.93 [-11.75, -8.06] | -10.99 [-13.79, -8.09] | -8.73 [-10.73, -6.67] | +1.19 [-1.82, +4.29] |
| middle-L | 17.770 | -2.14 [-4.86, +0.66] | -13.42 [-16.20, -10.56] | -14.37 [-17.53, -11.10] | -10.24 [-12.51, -7.91] | +1.11 [-2.31, +4.65] |
| coaching-L | 12.514 | +0.29 [-1.57, +2.18] | -9.90 [-12.96, -6.74] | -11.37 [-13.15, -9.55] | -8.22 [-10.81, -5.56] | +1.66 [-1.71, +5.14] |
| mixed48-P | 176.141 | +0.85 [-1.78, +3.54] | -10.24 [-12.45, -7.98] | -10.16 [-12.97, -7.25] | -6.60 [-9.58, -3.53] | -0.09 [-3.28, +3.20] |
| exact12-P | 22.034 | +1.51 [-2.83, +6.04] | -4.49 [-8.63, -0.17] | -13.68 [-16.01, -11.29] | -1.24 [-4.87, +2.52] | +10.65 [+7.60, +13.79] |
| profile-root-P | 3.888 | -2.67 [-4.85, -0.45] | -8.02 [-9.88, -6.12] | -14.59 [-16.09, -13.07] | -3.16 [-5.56, -0.71] | +7.69 [+5.76, +9.66] |
| opening-P | 94.595 | +1.68 [-0.97, +4.40] | -9.11 [-10.44, -7.77] | -9.47 [-11.55, -7.34] | -7.15 [-9.92, -4.28] | +0.40 [-1.51, +2.33] |
| middle-P | 26.456 | +0.13 [-1.39, +1.68] | -12.28 [-14.24, -10.27] | -11.96 [-13.18, -10.73] | -10.31 [-12.62, -7.94] | -0.36 [-2.70, +2.03] |
| coaching-P | 16.357 | -2.20 [-5.75, +1.48] | -11.31 [-15.07, -7.38] | -10.83 [-13.06, -8.53] | -8.94 [-11.41, -6.40] | -0.54 [-4.27, +3.33] |

Automatic C saves **7.83% B / 7.55% L / 10.24% P** on mixed48 (about
1.08–1.11× throughput), and roughly **9–13%** on opening/middle/coaching.
Exact12 point savings are **5.38% / 3.55% / 4.49%**; L's exact interval includes
zero. C is within roughly 0–4% of D on the nonterminal/coaching panels, but
**10.65–12.65% slower** on exact12. Much of the exact host-tuning advantage
remains unrecovered. The slowest exact root dominates panel time; per-root
measurements remain available.

Fallback B is mostly close to A. Mixed L shows a small **+1.753%** slowdown,
interval **[+0.001%, +3.536%]**, without multiplicity correction. This is a
borderline panel-specific regression and prevents an assertion of universally
zero overhead. Other point effects and intervals, including favorable layout
variation, remain visible rather than selectively discarded. POPCNT-only E
already supplies much of the nonterminal improvement on these panels; the
additional bundle is useful, without isolating any single extension's causality.

B/A includes the refactor, code placement and outer boundary together; it is
not a separate nanosecond estimate of one branch. The mixed-L borderline result
above limits any stronger fallback equivalence claim. The CPU feature test and constructor are
outside the fixed batch clock, as intended; the cached per-search branch is
inside it. A conservative maintainability decision does not require attaining
D exactly. E is a useful ablation/reference, but measurements on this capable
CPU do not establish enough deployment value for a third POPCNT-only runtime
tier on older hardware. Keep two variants.

## Supporting micro and timed measurements

Micro inputs exactly match the earlier ordered legal-phase corpus (65,731
cases across the first five classes) and 1,779-case exact-tree tail. Exhaustive
mailbox verification runs before timings. There are three rotating/reversed
executable rounds with seven inner trials and a 3-million-call target per class.
Values below weight class median nanoseconds by case count; they are not
complete-search speedups. Raw compact class trials/corpus checksums remain in
[the micro receipt](data/runtime-cpu-dispatch/micro.json).

| Tag | Legal-phase weighted median ns/call | Exact-tail median ns/call |
| --- | ---: | ---: |
| A | 10.977 | 4.459 |
| B | 10.989 | 4.451 |
| C | 10.005 | 3.713 |
| D | 4.340 | 4.357 |
| E | 11.468 | 4.542 |

C recovers only a small part of D's large legal-phase micro advantage. C's tail
micro is faster than D's even though D wins the full exact panel. This is a
concrete reason to keep complete-search evidence primary. POPCNT is not used
inside flips itself; E's flip timing is not evidence that bit counting improves
that kernel. These are new measurements with their own identities, not revisions
to the historical 10.74/4.37-ns results.

Timed 80/300-ms searches use six disclosed opening/middle roots, B/L/P, three
trials and a full warmup per block. All 540 actual publications pass independent
legal-child checks and original production fixed-depth/full-window reference
searches at their published horizons. Faster engines can finish different depths
and visit different partial iterations, so wall-time counters/moves are not
required to be identical across CPUs. This is throughput/publication evidence,
not an equal-time playing-strength claim.

| Model / ms | A median depth | B | C | D | E | C mean / max overrun ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| B / 80 | 9.5 | 9.5 | 10 | 10 | 10 | 80.020 / 0.047 |
| B / 300 | 10.5 | 10.5 | 11 | 11 | 11 | 300.021 / 0.052 |
| L / 80 | 9 | 9 | 9 | 9 | 9 | 80.027 / 0.177 |
| L / 300 | 10 | 10 | 10.5 | 10.5 | 10.5 | 300.130 / 1.176 |
| P / 80 | 9 | 9 | 9 | 9 | 9 | 80.020 / 0.031 |
| P / 300 | 10 | 10 | 10 | 10 | 10 | 300.019 / 0.031 |

Each cell summarizes 18 actual calls. Individual elapsed/CPU block times,
completed depths, scores/moves and partial-search counters remain in the data.

## Generated code, layout and memory

`objdump`, `nm`, ELF section information and ordinary linker maps inspect actual
linked executables. Static instruction counts exclude padding beyond symbol
size; they are neither executed instruction counts nor cycle samples. Both
`negamax<0>` and `negamax<1>` and their exact-tail/root/analysis/window entries
occupy distinct addresses. All recursive/search-helper call targets bind to the
same variant. No resolver, CPU test, function-pointer recursion or per-move
indirect call is introduced. Remaining runtime calls are allocation, clocks,
exceptions and standard-library operations, often through normal PLT imports.

| Body | Portable instructions / bytes | Enhanced instructions / bytes | Conditional branches P/E |
| --- | ---: | ---: | ---: |
| flips | 126 / 444 | 101 / 405 | 4 / 4 |
| legal | 262 / 908 | 263 / 913 | 0 / 0 |
| pop | 5 / 18 | 4 / 12 | 0 / 0 |
| features | 334 / 1306 | 319 / 1217 | 7 / 7 |
| P sum | 285 / 1176 | 285 / 1176 | 0 / 0 |
| negamax | 514 / 2238 | 494 / 2177 | 51 / 51 |
| lastEmpties | 336 / 1375 | 337 / 1385 | 24 / 24 |
| TT index | 41 / 171 | 41 / 171 | 0 / 0 |

In the measured B/C executable, ordinary portable object text is
`0x58c0..0xb7b2` (24,306 bytes; end exclusive); enhanced object text is
`0xba00..0x11104` (22,276 bytes). Portable/enhanced negamax entries are
`0x88a0` / `0xe950`, at cache-line offsets 32 / 16; exact-tail entries are
`0x9160` / `0xf1e0`, both offset 32. P sums are at `0x58c0` / `0xba00`.
The public search wrapper at `0xb430` branches directly to its selected entry.
The maps/disassembly are preserved locally; their compact symbol/section facts
are committed. CPU detection at `0xb180` uses baseline instructions.

POPCNT replaces software popcount calls. BMI1 produces ANDN, BLSI and BLSR;
LZCNT supplies four upper-endpoint counts in flips; BMI2 supplies four SHRX
operations there and SHLX in exact-tail code. These instructions actually occur,
but no separate BMI2 ablation establishes its individual speed contribution.
The enhanced flip body still has four conditional branches; D instead uses
conditional selection and no branches. Both load the eight geometry rays.
GCC's broader target/tuning choice changes code generation beyond these four
feature permissions. This provides a plausible explanation of the remaining
C/D gap, not a hardware-counter attribution of its exact cause.

Seven-feature code shrinks and uses ten POPCNTs. The P pattern sum is unchanged
at 285 instructions / 1,176 bytes in both dispatch variants: constant shifts,
file-gather multiply and contribution-table loads, no PEXT/PDEP. TT identity,
hash/replacement and counters are algorithmically unchanged; search disassembly
shows local inlining of those operations. Static mnemonic/stack-reference counts
and direct call targets are retained in [the assembly receipt](data/runtime-cpu-dispatch/assembly.json).
There is no measured assertion that register pressure or cache misses caused a
particular fraction of the gain.

| Binary | ELF .text bytes | GNU size text* | File bytes |
| --- | ---: | ---: | ---: |
| A | 32,145 | 148,614 | 171,712 |
| B | 61,761 | 182,628 | 210,168 |
| C | 61,761 | 182,628 | 210,168 |
| D | 44,337 | 160,810 | 183,952 |
| E | 32,273 | 148,606 | 171,664 |
| dispatch | 66,727 | 192,071 | 221,056 |

*GNU `size` text also includes read-only data/metadata; it is not just machine
code. The actual dispatch CLI includes protocol/diagnostic I/O beyond the
matched fixed-work driver. Both old and new `sizeof(Engine)` are 168 bytes, and
`sizeof(Entry)` is 40 bytes. The backend flag fits existing object padding.

Separate objects group each backend's normal text; cold exception fragments are
in the ordinary linker cold area. Hot entry addresses/alignment are recorded.
There is no cross-backend alias/folding, interleaved per-move dispatch or custom
linker script. Normal compiler alignment was retained. No additional padding or
alignment experiment was justified by the healthy fallback results, so **no
separate measurable alignment benefit is claimed**. Inactive code is not
normally fetched into L1I merely because it resides in the same executable.

There is one read-only 4,096-byte flip table, one 2,048-byte priority table, one
set of 12,288-byte pattern-contribution tables, one 504-byte weight array and
one 87,480-byte pair of frozen P arrays. `nm` verifies those shared definitions.
Each engine owns one original 40-byte-entry TT: 10,485,760 bytes at the default
setting, or one entry for the collision tests. No second backend object or TT is
constructed. Public copy/assignment behavior is preserved; ordinary searches
retain their construction-time backend.

## Correctness, provenance and limits

| Check | Result |
| --- | --- |
| Full Node suite | 183/183 pass, no skips |
| Forced portable native/V2/endgame | 16/16 pass, no skips |
| ASan/UBSan auto + paired dispatch regression | 17/17 pass, no skips |
| ASan/UBSan portable | 16/16 pass, no skips |
| Python suite | 46/46 pass, no skips |
| Five-build independent mailbox/minimax | 221 boards, 19,890 root queries, 12,270 children |
| Full-window coaching/PVs | 1,830 D3 rows, 5,490 PV placements; 315 D6 rows |
| Deterministic completed-horizon qualification | 675 publications, plus paired same-object result/counter checks |
| Exhaustive flips | >1.2 million mailbox cases per backend, including sanitizer execution |
| Independent exact mailbox solver | All twelve panel roots plus disclosed D12 root, B/L/P, every build |
| Actual 80/300-ms publications | 540/540 optimal score/chosen-child checks; 41 distinct root horizons |
| Final-source reconstruction | All 16 binary hashes reproduced |
| Ordinary non-dispatch C++ browser ABI | 90/90 B/L/P queries/counters against original native; Linux only |

Both execution paths pass independent mailbox flipping, forced passes, terminal
empty squares, exact margins, B/L/P truncated horizons, full-window alternatives,
PV optimality/legality, collisions, bound/model/depth isolation, generation
rollover and completed-iteration publication. The explicit paired state test
reuses the same two objects through model/depth/window changes, narrow TT
collisions and deterministic node-limit interruption, comparing every result,
PV and all counters. Changing the environment after construction does not alter
those objects. Copy/assignment and repeated creation/destruction are checked.
Enhanced pattern extraction also runs the standalone exhaustive ordered-sum
assertions directly, not only through portable diagnostic wrappers.

Fixed-work scores, moves, exactness, counters and continuations are identical.
Deterministic node-stop results/counters are identical. Real wall deadlines
preserve the same last-completed-iteration rule while allowing different amounts
of work. ASan/UBSan tests are correctness evidence only.

Forcing portable establishes execution correctness on this PC; baseline
instruction inspection establishes the intended ISA contract. No compatible
CPU emulator is installed and no older physical processor is available, so
**older-hardware fallback compatibility is statically verified, not physically
tested**. Baseline REP-BSF sequences may be displayed as TZCNT; their operands
are nonzero and their BSF interpretation is safe. LZCNT/BMI/POPCNT requirements
are absent from baseline application search/dispatch code. The ELF note declares
`x86-64-baseline`. The dynamically linked binary requires a compatible Linux C++
runtime (observed symbol requirements include GLIBC 2.38 and GLIBCXX 3.4.32).

The ordinary single-target C++/C ABI path compiles and executes on Linux. No
ARM64 cross compiler, Mac hardware or qualified PC Wasm SDK is available for
new target compilation. Existing distributed Wasm numerical tests still pass;
its module, manifest, hashes and frozen identities are unchanged. The original
`verify-production.mjs` intentionally also hashes the pre-refactor source; run
that production provenance check from qualified main. The experimental public
audit separately checks the unchanged artifacts without weakening that verifier.
Future Wasm provenance now includes the two new implementation/table files. This is not
new M4, Intel Mac or freshly compiled Wasm qualification.

The initial two-trial pilot and first nine-trial exploration are preserved in
ignored storage. Audit found their D engine was native-targeted but their driver/
adapter baseline-targeted. They are excluded from accepted performance results.
The complete final campaign corrects all translation-unit flags; A/B/C binaries
remain byte-identical. Their elapsed time is still charged to the common budget.
A final fresh-source reconstruction reproduces every accepted binary hash.
No measurement directory, old report or production artifact was overwritten.

Total active performance time is **1026.71 seconds
(17.11 minutes)**, including the 38.56-second pilot,
473.86-second superseded campaign, 494.51-second accepted complete-search/timed
campaign and 19.78-second supporting micro run. Resource snapshots and binary
immutability checks are in the durable ledger. Correctness, builds and reporting
are separate. There was no profiling capture. A subsequent runner preflight
only adds a capability assertion before workload generation; the evidence
receipt reconstructs the exact executed runner by removing those two lines.
The measured loop, workloads, clocks and binaries were not changed.

`target_clones` was considered but not benchmarked as another maintained engine.
Independent helper clones would require additional proof of direct call binding;
the explicit object design already supplies it. No third runtime tier, AVX
backend, new search algorithm, coefficient training or alignment framework was
added. No playing-strength improvement is claimed.

## M4 follow-up before promotion

On the existing M4 environment, compile the ordinary single-source path with
Apple Clang and run native/rules/endgame/coaching/TT/interruption and sanitizer
checks. Confirm frozen identities/coefficients and the shared immutable table
sizes. Build Wasm twice with the already qualified Emscripten 4.0.22/Python
setup, checking reproducibility and provenance of `engine-impl.inc` and
`engine-tables.hpp`. Compare actual new native/Wasm B/L/P scores, counters and
PVs, then run bounded actual Chrome/Safari coaching, 80/300-ms reply, reload,
module identity and cancellation checks. Confirm native/default-browser launch
and clean shutdown. No x86 enhanced source belongs in that build. Current Intel
Mac support must remain clean; this PC cannot claim its hardware qualification.
A short matched M4 smoke can check refactor cost without repeating the previous
performance campaign. Do not promote the experimental branch until those gates
pass.

## Publication and audit

```bash
.venv/bin/python scripts/runtime-cpu/verify-public.py
git diff --check
git commit -m 'Qualify runtime CPU dispatch with matched production references'
git push origin perf/runtime-cpu-dispatch
git ls-remote origin refs/heads/main refs/heads/perf/runtime-cpu-dispatch
git status --short --branch
```

Only source, tests, documentation and compact JSON receipts are staged. No
binary, shared object, generated header, map/full disassembly, perf trace,
SDK, venv or browser profile is committed. Main retains the Stage 1 acceptance
commit. Final local/remote hashes and clean status are reported after publication.
