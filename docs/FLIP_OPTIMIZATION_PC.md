# Faster disc flipping — independent WSL2 PC qualification

**Subsequent production status:** see [production acceptance](FAST_FLIPS_PRODUCTION_ACCEPTANCE.md)
for integration and the rebuilt distribution. This report retains the original
PC experiment's recommendation and publication scope.

**Recommendation: retain the shared portable geometry-table/sentinel kernel on
`perf/fast-flips`.** Both matched GCC configurations improve complete exact,
mixed, opening, middle and coaching work. No architecture dispatch or new engine
variant is needed. This experiment does not merge into `main`, replace the
distributed Wasm assets, change frozen models, or establish stronger timed play.

## Recovery, environment and identities

The interrupted session had already fetched and checked out the published Mac
head, and built the six baseline/experimental engine objects. There were no
uncommitted changes or other worktrees. Recovery verified the remote head,
retained those builds, and compiled the checked-out selected engine beside them.
No reset, stash, deletion, merge or unrelated process termination was needed.

| Identity | Complete revision / checksum |
| --- | --- |
| Published Mac head, actual PC checkout at build | `1b83a2b2c158078962afd48a48479346f854c813` |
| Selected engine's tested source revision | `9357d4b3510d7931b3ea4b8739b7c8e693414f33` |
| Original baseline, including retained tiny-endgame specialization | `1058f013581e0566277586f857b0a2884be260f6` |
| Selected `native/engine.cpp` SHA-256 | `b97d526697e68aa04186b67d2e13dc0f4eab21fb086921532e8b9b63cf47e7a5` |
| Header SHA-256 | `f84153d587755542b6006150100e55e5ceb0b1f0e79111a8f91faa8fe4c784d6` |
| Frozen model header SHA-256 | `1b286ed8371f0a2cd957b06b679e7422b68b3699cb7c8fe7c9f50968d27ceba1` |
| Ordered 48-position file SHA-256 | `a8deadc89f811e02da19910a702b073de12707ef19895a10f7d9861d088dcfee` |
| Exact-tree micro input SHA-256 | `014873c3a35eae87a03e99c65a855931c95246ebfd16e65b692853948efd660b` |

Actual hardware: Intel Core i7-14700F, host 20 cores/28 logical processors,
16 GiB RAM; Windows 11 Home build 26300.9711, WSL 2.7.10.0. Guest: Ubuntu
26.04.1, kernel `6.18.33.2-microsoft-standard-WSL2`, x86-64, GCC 15.2.0
(`Ubuntu 15.2.0-16ubuntu1`), project Python 3.14.4, Node 24.16.0.
The guest reports fourteen two-thread cores; that virtual topology does not
identify the host's P/E cores. No P-core-only, affinity or frequency claim is made.

Initial WSL available memory was about 6.5 GiB of 7.6 GiB, swap usage 1 MiB,
free disk 885 GiB, and memory/CPU pressure averages zero. Host free physical
memory was only about 1.38 GiB; ordinary Chrome and system services stayed open.
Runs remained serial and small, with repeated memory/process snapshots. This
was a working desktop, with scheduling/frequency variability, not an isolated
laboratory. Raw profiles, binaries, logs and bulk call rows remain ignored.

## Methods and correctness

Both configurations use the unchanged Mac harness, separate engine/driver/kernel
translation units, common driver object, no LTO or per-call instrumentation:

```text
-O3 -std=c++17 -Wall -Wextra -Wpedantic -ffp-contract=off -fno-fast-math -g
```

The second configuration adds **only `-march=native` to every compared build**.
Its baseline is also native-tuned. Build receipts retain compiler, flags, full
source revisions, individual source hashes, frozen identities, and measured
binary SHA-256 values. No engine source changed during the PC phase.

The deterministic micro corpus exactly matches all Mac class counts and ordered
checksums. Cases are generated before timing; complete flip calls cross a
translation-unit boundary and feed consumed checksums. Seven rotated/reversed
trials use approximately twenty million calls per class/algorithm/trial, with
equal warmups. No per-call clocks are used.

Fixed searches have two full warmup batches, approximately 0.35 seconds of
baseline work per timed block, and nine paired trials with rotating/reversing
algorithm order and rotating workload order. Original, guarded table and selected
sentinel participate in the same campaign. Complete batch wall time is primary;
thread/process CPU, all thirteen search/TT counters, scores and full result
signature hashes are retained. Intervals below are descriptive 95% Student-t
intervals on paired log elapsed ratios. They describe these fixed panels' run
variation, with no multiplicity/drift correction or population-strength inference.

The twelve-root exact panel comprises twelve distinct **8–12-empty** positions.
The separate disclosed D12 root is `native-engineering-10`. Mixed48 includes
the twelve exact roots and legacy36, whose horizons are D8 before 28 occupied,
D7 before 52, otherwise min(10, empties). Its disclosed root is therefore D10,
not the separate D12 workload. Opening uses four D8 roots; middle six D7 roots;
coaching two D6 roots with full-window all-move scores and verified lines.
TT allocation is unchanged at 10,485,760 actual bytes; ordering hints are disabled
consistently. This does not rerun the previous final-empty optimization comparison.

Each configuration passes 1,260,090 independent flip case checks, including
exhaustive mailbox line patterns, all squares/directions, boundaries, both players,
seeded legal histories, arbitrary disjoint boards and the exact-search input pool.
Both resulting colored `Board` values are checked. ASan/UBSan pass for original
and selected native internals plus the exhaustive candidate flip suite, outside
timing. The sanitizer flip suite checks 1,258,311 cases without the search input.

Per configuration, the independent mailbox/minimax qualification passes **11,934
root queries** across original/guarded/selected builds on 221 boards, including
one/two/three empties, both turns, forced passes, terminal empties, B/L/P and
truncated horizons. It checks 1,098 depth-3 coaching rows, 3,294 PV steps,
189 depth-6 rows/PVs, and 405 deterministic interrupted publications.
All **324 actual 80/300-ms publications per configuration** are checked for legal
chosen moves and exact score identity against completed baseline searches and
full-window child values at their published horizons.

A new independent **10x10 mailbox exact alpha-beta solver**, with direct ray scans
and no production header, bitboard flip algorithm, TT, evaluator or tiny helper,
additionally solves all twelve exact roots and the disclosed D12 root. Every
fixed-call exact score for all three algorithms and B/L/P matches it. This closes
the distinction between agreeing with the original engine and agreeing with an
independent reference on the actual performance panel.

Closing suites pass **182 Node tests, 16 sanitizer groups and 46 Python tests**, with no failures or skipped Node cases. The unchanged Mac compact evidence audit also passes (1,134 fixed build blocks, 26 historical hardware captures, and the original Wasm/browser receipts). Those Mac records were audited, not recollected on this PC. All full suite commands and return codes are in [the closing receipt](data/fast-flips-pc/tests.json).

## Microbenchmarks — PC only

| Class / cases | Portable original → selected ns | Native original → selected ns | Portable / native speedup |
| --- | --- | --- | --- |
| opening / 25,686 | 15.991 → 9.566 | 15.566 → 4.352 | 1.67× / 3.58× |
| middle / 33,195 | 21.849 → 12.098 | 20.807 → 4.396 | 1.81× / 4.73× |
| late / 6,418 | 25.264 → 8.804 | 23.332 → 4.332 | 2.87× / 5.39× |
| last-two / 276 | 6.186 → 4.333 | 5.437 → 4.338 | 1.43× / 1.25× |
| last-one / 156 | 5.794 → 4.384 | 5.492 → 4.406 | 1.32× / 1.25× |
| edge-corner / 30,820 | 19.241 → 10.411 | 18.561 → 4.311 | 1.85× / 4.31× |
| controlled / 7,680 | 23.175 → 5.091 | 21.588 → 4.312 | 4.55× / 5.01× |
| search-tail / 1,779 | 6.322 → 4.447 | 5.702 → 4.398 | 1.42× / 1.30× |

The legal-phase weighted mixture contains 65,731 disjoint cases, excluding the
overlapping edge subset and controlled stress. The exact-tree sample contains
1,779 one-in-97 baseline flip inputs by remaining-empty count. Its distribution
has many cheap short rays; it must not be replaced by the legal-mixture denominator.

| Configuration | Weighted original → selected ns | Selected M calls/s | Point speedup | Paired elapsed effect [95%] |
| --- | --- | --- | --- | --- |
| portable | 19.789 → 10.736 | 93.1 | 1.84× | -45.92% [-46.26, -45.57] |
| native | 18.904 → 4.372 | 228.7 | 4.32× | -77.31% [-77.92, -76.68] |

Weighted point ratios use case-weighted class medians; intervals use paired per-trial weighted log ratios. They need not coincide exactly. Complete per-class clocks, CPU times, checksums and results for **all six** kernels are in the micro datasets.

All five original experimental alternatives plus the actual selected engine are
tested in the microbenchmark: original loop, masked loop, six-step propagation,
pair/doubling, guarded geometry and selected sentinel. Doubling is the fastest
portable legal-mixture micro kernel; selected sentinel is fastest under native
tuning. Some nearly-full/search-tail classes still favor the guarded table.
These differences are preserved, not averaged away into a universal kernel claim.
No new x86 algorithm or architecture-specific production dispatch was introduced.
Doubling's portable micro win is not evidence of an integrated-search win;
the complete PC campaign qualifies the selected Mac implementation against the
original and guarded table, without opening another optimization campaign.
The guarded table's P exact-panel point effects are -23.14% portable and -21.95%
native, versus the selected kernel's -26.62% and -34.17% in the same campaigns.
Its cheaper short-ray micro results do not overturn the complete-search decision;
all guarded-table blocks and intervals remain in the compact datasets.

## Complete searches — decision evidence

Negative elapsed changes mean less time. Wall and CPU columns are median
milliseconds per complete batch. Paired effects need not equal ratios of medians.
Counters shown are identical between algorithms and compiler configurations.
Every complete fixed-call score, move, exactness, horizon and search/TT counter
matches. No important panel shows a repeatable >2% regression with an interval
excluding zero, the Mac handoff's material-regression threshold.

### Portable GCC

| Panel / model | Wall ms original → selected | Thread CPU ms original → selected | Elapsed change [95%] | Nodes / evaluations per batch | Selected M nodes/s / M evals/s |
| --- | --- | --- | --- | --- | --- |
| mixed48/B | 120.222 → 105.681 | 120.222 → 105.678 | -14.14% [-17.21, -10.97] | 1,780,838 / 841,839 | 16.85 / 7.97 |
| exact12/B | 30.933 → 22.305 | 30.932 → 22.305 | -26.85% [-31.60, -21.76] | 551,969 / 0 | 24.75 / 0.00 |
| profile-root/B | 5.357 → 3.789 | 5.357 → 3.789 | -27.61% [-29.02, -26.18] | 104,996 / 0 | 27.71 / 0.00 |
| opening/B | 53.569 → 47.260 | 53.567 → 47.258 | -7.54% [-11.69, -3.19] | 682,869 / 494,133 | 14.45 / 10.46 |
| middle/B | 14.177 → 13.422 | 14.176 → 13.421 | -6.84% [-8.50, -5.15] | 205,607 / 150,300 | 15.32 / 11.20 |
| coaching/B | 10.707 → 10.085 | 10.706 → 10.084 | -6.95% [-9.45, -4.39] | 152,950 / 109,151 | 15.17 / 10.82 |
| mixed48/L | 142.033 → 127.676 | 141.510 → 127.676 | -10.12% [-12.77, -7.39] | 2,018,500 / 1,023,170 | 15.81 / 8.01 |
| exact12/L | 30.624 → 22.499 | 30.621 → 22.497 | -25.35% [-26.80, -23.87] | 551,969 / 0 | 24.53 / 0.00 |
| profile-root/L | 5.185 → 3.806 | 5.184 → 3.805 | -27.77% [-29.84, -25.63] | 104,996 / 0 | 27.59 / 0.00 |
| opening/L | 60.341 → 54.776 | 60.338 → 54.776 | -6.94% [-8.96, -4.87] | 794,754 / 581,968 | 14.51 / 10.62 |
| middle/L | 18.744 → 17.676 | 18.744 → 17.676 | -7.60% [-10.76, -4.32] | 264,071 / 195,756 | 14.94 / 11.07 |
| coaching/L | 13.916 → 12.530 | 13.916 → 12.529 | -8.36% [-11.19, -5.44] | 188,884 / 138,097 | 15.07 / 11.02 |
| mixed48/P | 195.135 → 183.217 | 195.124 → 183.210 | -9.06% [-11.41, -6.65] | 2,578,323 / 1,438,599 | 14.07 / 7.85 |
| exact12/P | 31.037 → 22.440 | 31.037 → 22.440 | -26.62% [-29.79, -23.30] | 551,969 / 0 | 24.60 / 0.00 |
| profile-root/P | 5.464 → 4.012 | 5.464 → 4.012 | -25.75% [-28.42, -22.98] | 104,996 / 0 | 26.17 / 0.00 |
| opening/P | 106.844 → 100.639 | 106.837 → 100.639 | -8.21% [-11.01, -5.33] | 1,247,297 / 923,034 | 12.39 / 9.17 |
| middle/P | 28.013 → 26.239 | 28.012 → 26.239 | -5.73% [-8.08, -3.31] | 348,867 / 258,750 | 13.30 / 9.86 |
| coaching/P | 18.303 → 16.166 | 18.303 → 16.166 | -9.52% [-12.34, -6.61] | 218,363 / 164,000 | 13.51 / 10.14 |

### Separately matched -march=native GCC

| Panel / model | Wall ms original → selected | Thread CPU ms original → selected | Elapsed change [95%] | Nodes / evaluations per batch | Selected M nodes/s / M evals/s |
| --- | --- | --- | --- | --- | --- |
| mixed48/B | 113.116 → 92.321 | 113.115 → 92.321 | -19.60% [-22.15, -16.97] | 1,780,838 / 841,839 | 19.29 / 9.12 |
| exact12/B | 28.583 → 18.928 | 28.583 → 18.928 | -33.96% [-36.87, -30.92] | 551,969 / 0 | 29.16 / 0.00 |
| profile-root/B | 5.149 → 3.288 | 5.148 → 3.287 | -37.26% [-39.23, -35.22] | 104,996 / 0 | 31.94 / 0.00 |
| opening/B | 47.918 → 41.706 | 47.917 → 41.706 | -12.78% [-14.89, -10.61] | 682,869 / 494,133 | 16.37 / 11.85 |
| middle/B | 13.336 → 11.496 | 13.335 → 11.494 | -13.23% [-14.46, -11.99] | 205,607 / 150,300 | 17.89 / 13.07 |
| coaching/B | 10.048 → 8.794 | 10.048 → 8.794 | -14.12% [-15.70, -12.51] | 152,950 / 109,151 | 17.39 / 12.41 |
| mixed48/L | 137.882 → 109.529 | 137.713 → 109.526 | -19.99% [-22.28, -17.63] | 2,018,500 / 1,023,170 | 18.43 / 9.34 |
| exact12/L | 30.002 → 19.041 | 30.002 → 19.041 | -35.87% [-37.80, -33.88] | 551,969 / 0 | 28.99 / 0.00 |
| profile-root/L | 5.104 → 3.290 | 5.104 → 3.290 | -36.24% [-38.03, -34.40] | 104,996 / 0 | 31.91 / 0.00 |
| opening/L | 55.697 → 48.233 | 55.697 → 48.231 | -12.28% [-15.98, -8.41] | 794,754 / 581,968 | 16.48 / 12.07 |
| middle/L | 17.266 → 14.930 | 17.266 → 14.930 | -13.66% [-16.65, -10.56] | 264,071 / 195,756 | 17.69 / 13.11 |
| coaching/L | 12.379 → 10.789 | 12.379 → 10.789 | -13.28% [-14.07, -12.48] | 188,884 / 138,097 | 17.51 / 12.80 |
| mixed48/P | 185.429 → 154.767 | 185.421 → 154.764 | -16.42% [-17.82, -15.01] | 2,578,323 / 1,438,599 | 16.66 / 9.30 |
| exact12/P | 28.634 → 18.609 | 28.633 → 18.607 | -34.17% [-36.97, -31.24] | 551,969 / 0 | 29.66 / 0.00 |
| profile-root/P | 5.089 → 3.318 | 5.089 → 3.318 | -35.85% [-37.26, -34.42] | 104,996 / 0 | 31.64 / 0.00 |
| opening/P | 95.968 → 85.543 | 95.966 → 85.540 | -10.51% [-12.74, -8.22] | 1,247,297 / 923,034 | 14.58 / 10.79 |
| middle/P | 25.890 → 23.042 | 25.889 → 23.039 | -11.88% [-12.52, -11.23] | 348,867 / 258,750 | 15.14 / 11.23 |
| coaching/P | 15.835 → 14.336 | 15.835 → 14.335 | -8.55% [-12.27, -4.67] | 218,363 / 164,000 | 15.23 / 11.44 |

### Individual exact roots (P; secondary API elapsed)

| Root | Empties | Portable original → selected ms | Portable effect [95%] | Native original → selected ms | Native effect [95%] |
| --- | --- | --- | --- | --- | --- |
| mac-exact-0 | 12 | 21.243 → 15.392 | -27.36% [-31.01, -23.52] | 19.789 → 12.974 | -33.82% [-36.62, -30.89] |
| mac-exact-1 | 11 | 0.577 → 0.422 | -26.73% [-36.57, -15.36] | 0.559 → 0.349 | -39.68% [-43.45, -35.67] |
| mac-exact-2 | 10 | 0.399 → 0.302 | -15.04% [-31.85, +5.91] | 0.390 → 0.262 | -34.53% [-42.16, -25.90] |
| mac-exact-3 | 9 | 0.160 → 0.119 | -26.53% [-28.82, -24.17] | 0.161 → 0.094 | -42.18% [-44.77, -39.47] |
| mac-exact-4 | 8 | 0.040 → 0.033 | -17.19% [-19.33, -14.99] | 0.039 → 0.025 | -40.82% [-48.49, -32.01] |
| mac-exact-5 | 12 | 1.695 → 1.387 | -18.07% [-21.71, -14.25] | 1.689 → 1.161 | -30.32% [-31.71, -28.91] |
| mac-exact-6 | 11 | 1.851 → 1.386 | -29.85% [-34.45, -24.92] | 1.809 → 1.161 | -36.52% [-38.18, -34.82] |
| mac-exact-7 | 10 | 0.267 → 0.210 | -19.43% [-28.25, -9.53] | 0.260 → 0.166 | -35.41% [-37.69, -33.04] |
| mac-exact-8 | 9 | 0.277 → 0.200 | -30.87% [-39.24, -21.35] | 0.266 → 0.157 | -35.08% [-52.67, -10.96] |
| mac-exact-9 | 8 | 0.049 → 0.039 | -21.83% [-24.59, -18.97] | 0.050 → 0.029 | -42.29% [-44.70, -39.77] |
| mac-exact-10 | 12 | 2.029 → 1.501 | -27.94% [-35.50, -19.50] | 1.923 → 1.280 | -33.13% [-36.70, -29.35] |
| mac-exact-11 | 11 | 1.544 → 1.185 | -23.36% [-30.89, -15.02] | 1.537 → 0.965 | -38.34% [-44.29, -31.76] |

All twelve point estimates favor the candidate. The individual portable
`mac-exact-2` interval includes zero, so that root's benefit remains unresolved;
the complete exact panel's improvement is clear.

The panel is not twelve equal-duration roots. The slowest original root carries
most of its elapsed time; per-root values above are mean API elapsed within each
block, secondary to complete batch time. Neither that panel nor the selected
profiling root represents all endgames. The primary totals, CPU times, NPS/EPS,
variation, every batch counter and root-signature hash remain in the compact data.

### Supplementary timed searches

Each cell has six disclosed opening/middle roots × three trials, with both
80 and 300 ms budgets and one full warmup. Publication horizons, scores, chosen
moves, elapsed times and counters are preserved, including any overruns. These
short timing samples are supplementary throughput evidence, not a strength test.

| Config / model / budget | Median completed depth original → selected | Mean ms original → selected | Maximum selected overrun ms |
| --- | --- | --- | --- |
| portable/B/80 | 9 → 9.5 | 80.02 → 80.10 | 1.46 |
| portable/B/300 | 10.5 → 10.5 | 300.02 → 300.06 | 0.33 |
| portable/L/80 | 9 → 9 | 80.02 → 80.02 | 0.03 |
| portable/L/300 | 10 → 10 | 300.02 → 300.02 | 0.02 |
| portable/P/80 | 9 → 9 | 80.20 → 80.02 | 0.02 |
| portable/P/300 | 10 → 10 | 300.02 → 300.02 | 0.03 |
| native/B/80 | 9.5 → 10 | 80.02 → 80.02 | 0.02 |
| native/B/300 | 10.5 → 11 | 300.02 → 300.06 | 0.77 |
| native/L/80 | 9 → 9 | 80.02 → 80.10 | 1.53 |
| native/L/300 | 10 → 10.5 | 300.05 → 300.02 | 0.02 |
| native/P/80 | 9 → 9 | 80.02 → 80.04 | 0.38 |
| native/P/300 | 10 → 10 | 300.02 → 300.02 | 0.03 |

## What x86-64 compilation reveals

| Config / kernel | Text bytes | Static instructions | Conditional branches | Loop backedges | Geometry bytes |
| --- | --- | --- | --- | --- | --- |
| portable/original | 493 | 135 | 16 | 8 | 0 |
| portable/ray-table | 493 | 138 | 12 | 0 | 4096 |
| portable/refined | 444 | 126 | 4 | 0 | 4096 |
| native/original | 493 | 134 | 16 | 8 | 0 |
| native/ray-table | 442 | 116 | 8 | 0 | 4096 |
| native/refined | 358 | 90 | 0 | 0 | 4096 |

All eight `flipsIn<D>()` templates are inlined into the physical `flips()` body;
there are no independent direction symbols. The original contains eight real
data-dependent loop backedges plus eight entry/termination branches. Horizontal
and diagonal traversal repeatedly shifts/masks the edge geometry; vertical rays
need no file-edge masks. Applying an already calculated mask is only OR/AND/NOT
plus move-bit preparation, much smaller than either complete capture kernel.
Optimized general search can inline `play`, so its absence as a physical caller
does not imply absence of general move application.

The selected function uses the precomputed 64×8×8-byte geometry table to eliminate
dynamic traversal. The table remains **4096 bytes**. Ray endpoints are calculated
without occupancy tables or gathering intrinsics. The sentinel makes every
leading-zero operand nonzero; actual-stop/own membership still rejects false
brackets, empty-square stops and unbracketed edge chains.

Portable GCC emits four `bsr`/XOR/variable-`shr` endpoint sequences, four
conditional moves for increasing rays and four conditional branches for
decreasing rays. It repeats some row-address work and reloads ray operands:
12 memory-source operands in this flip body, rather than eight unique rays.
Native tuning emits four `lzcnt`, four `shrx`, four `blsi`, twelve `andn` and
eight conditional moves, with **no conditional branches**; fifteen memory-source
operands fold ray loads into arithmetic. These are static emitted instructions,
not executed instruction/cycle counts. No production vectorization, ARM intrinsic
or unconditional BMI dependency was added: portable x86 uses its ordinary ISA.

Apple Clang's measured ARM64 selected body was 86 instructions/344 bytes, no
conditional branches and four paired ray loads, versus 89 instructions/356 bytes
for its original. x86's variable-length instruction totals are not comparable
performance units. The ordinary source is portable, but its machine-code quality
depends on tuning and compiler; native GCC's branch removal agrees with its much
better general-class micro performance. Branch miss and cache-stall causality
remain unmeasured on this PC.

| Isolated wrapper / config | E | W | S | N | SE | SW | NE | NW |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| original/portable | 20 | 21 | 17 | 18 | 20 | 20 | 21 | 21 |
| refined/portable | 15 | 23 | 15 | 23 | 15 | 15 | 23 | 23 |
| original/native | 19 | 20 | 16 | 17 | 19 | 19 | 20 | 20 |
| refined/native | 13 | 20 | 13 | 20 | 13 | 13 | 20 | 20 |

Compiler sharing and reordering prevent a unique additive direction decomposition
of the full function. These separate diagnostic wrappers include move-bit/row
setup and return, and are **not** measured search binaries or dynamic costs.
Their totals must not be summed to claim the complete function executes that many
instructions. Full measured-symbol assembly and byte sizes are also retained.

### General play and the tiny-endgame helper

The counting-only diagnostic agrees byte-for-byte between original and selected,
including the sampled corpus, score and nodes: **171,939 calls**, **107,588
(62.57%)** inside `lastEmpties` on the disclosed D12 root. This is a call fraction,
not a CPU-time fraction. The same distribution occurs in both compiler builds.
Existing one/two-empty geometry, precomputed flip reuse, pass handling and raw
unplayed-square margins stay intact. PC helper-only substitution was not separately
timed; its independently measured 16–17% exact-panel benefit remains **Mac-only**.
Software IP samples provide no reliable caller ancestry. Mac reconstructed-stack
fractions are not substituted for PC caller costs.

## Hardware PMU availability and workaround decision

### Actual Linux probes

The missing PMU directories alone were not the conclusion. An existing local
`perf` frontend was recovered; no package or older toolchain was installed.
It reports **perf 5.15.222** and successfully records software IP samples against
this kernel. Direct syscalls independently bypass that older frontend:

```bash
.venv/bin/python scripts/fast-flips/pc-pmu-probe.py
perf_local=.local-research/windows-pc-20261030/perf-tools/usr/lib/linux-tools-5.15.0-202/perf
"$perf_local" --version
cat /proc/sys/kernel/perf_event_paranoid
"$perf_local" stat -e cycles:u,instructions:u -- sleep 0.2
"$perf_local" stat -e cpu-clock:u -- sleep 0.2
```

| Observed probe | Actual result |
| --- | --- |
| Kernel/guest PMU sources | `breakpoint,kprobe,msr,power,software,tracepoint,uprobe`; no CPU PMU |
| Kernel log | `Performance Events: unsupported CPU family 6 model 183 no PMU driver, software events only.` |
| Guest CPUID leaf 0x0A | EAX/EBX/ECX/EDX all zero: no architectural PMU advertised to this guest |
| Kernel config | `CONFIG_PERF_EVENTS=y`, `CONFIG_X86_LOCAL_APIC=y` |
| Current permission policy | `perf_event_paranoid=2`, ordinary uid 1000; probes exclude kernel/hypervisor |
| Direct hardware `perf_event_open` | cycles, instructions, reference cycles: `ENOENT (2)` at both `precise_ip=0` and `2` |
| Direct software `perf_event_open` | `cpu-clock` opens successfully |
| Existing perf hardware count | cycles/instructions `<not supported>`; frontend returns 0 despite unsupported counters |
| Existing perf software count/record | Counting succeeds; six actual software IP captures succeed |

Thus this is an unavailable **guest CPU PMU**, not missing PMU capability in the
physical i7, a missing frontend, an observed `EACCES`/`EPERM` restriction, or merely
an inability to provide precise sampling. No ordinary hardware event opens at
all; precise-event support cannot be qualified independently. Replacing perf or
relaxing the permission setting would not make CPUID advertise a PMU.
The syscall receipt and manual distinguish invalid/unavailable event types from
permission and precise-sampling failures. [Linux perf_event_open manual](https://man7.org/linux/man-pages/man2/perf_event_open.2.html).

### A. Expose a WSL virtual PMU

Microsoft documents administrator `Set-VMProcessor -Perfmon` controls for stopped
managed Hyper-V guests, including PMU/PEBS/LBR options. That is not evidence of
a WSL utility-VM control. This Windows Home host has no inspected Hyper-V module,
`Get-VM`, `Get-VMProcessor` or `Set-VMProcessor` commands. The documented WSL
configuration table supplies no virtual-PMU key. A supported way to expose it
to **this instance remains unconfirmed**, and this investigation stopped there.
No speculative key, shutdown, feature enablement, VM edit or restart was tried.
An ordinary separately managed VM would be a different environment and could
require an edition/features change. [Microsoft Hyper-V PMU controls](https://learn.microsoft.com/en-us/windows-server/virtualization/hyper-v/manage/performance-monitoring-hardware),
[documented WSL settings](https://learn.microsoft.com/en-us/windows/wsl/wsl-config).

### B. Windows-native hardware sampling

Read-only `wpr -pmcsources` succeeds (WPR file version 10.0.26100.9711), listing
TotalCycles, UnhaltedCoreCycles, InstructionRetired, reference cycles, cache misses,
branch mispredictions, fixed counters and LBR support. **Windows exposes hardware
sources; no successful host overflow capture or precise-IP attribution is claimed.**
Enumeration does not prove that a recording session can reserve them. WPR supports
event-overflow sampling with `SampledCounters`/`PmcProfile`; this differs from
reading counters on context switches and from periodic timer sampling.
[Microsoft PMU recording documentation](https://learn.microsoft.com/en-us/windows-hardware/test/wpt/recording-pmu-events).

The inspected command paths and standard installation locations contain no VTune,
WPA/xperf, Visual Studio C++ compiler/vswhere, MinGW GCC or LLVM compiler. A native
Windows benchmark is therefore not ready using the inspected existing tools.
VTune supports hardware analysis on modern Intel/Hyper-V hosts with restrictions;
this host has VBS/HVCI running, and some driver/event access may require further
qualification. No driver, elevation or security change was attempted.
[Intel's Hyper-V profiling requirements](https://www.intel.com/content/www/us/en/docs/vtune-profiler/user-guide/2026-0/profiling-on-hyper-v.html).

A future native build could compare identical original/selected sources, strict
FP settings, shared driver boundaries and inputs, with baseline/candidate built
by the same Windows compiler. GCC/Clang builtins and the Linux thread-CPU clock
would need compatible compiler/runtime handling; an MSVC port is not assumed
drop-in. The Windows x64 ABI, code layout, runtime and scheduler differ from
Linux SysV; it would explain native Windows code, not profile the exact Linux
ELF. Host samples around WSL are not assumed to resolve Linux functions.
P/E core type and event semantics would need separate attribution; VTune can
group by core type, but the present virtual CPU IDs cannot provide that mapping.
[Intel hybrid CPU analysis](https://www.intel.com/content/www/us/en/docs/vtune-profiler/user-guide/2023-1/hybrid-cpu-analysis.html).

### C. Direct Linux boot

An external-media bare-metal Linux boot is the most plausible future route to
hardware profiling of the same GCC/source algorithm without the Hyper-V PMU
mask. A suitably current kernel should expose the Intel hybrid PMUs, but actual
events/interrupts, user permissions and precise sampling must still be probed.
The exact existing ELF also requires compatible loader/libraries. None of this
was boot-tested. It would measure bare-metal Linux, not WSL2 runtime.

Preparing signed live media, rebooting, retaining any BitLocker recovery key and
checking firmware/boot policy cost more than this experiment needs. Do not alter
partitions, mount Windows disks for writing, disable Secure Boot or edit firmware
merely to profile. A future separately authorized session could assess those
steps; no boot media, disk or boot changes occurred here.

### Engineering choice

Scores are engineering judgments, **0–5 with higher better**, not measurements.
Hardware availability is scored from actual qualification, not physical potential.
Setup/environment scores favor low effort and low interference. Hypothetical
attribution assumes a correctly configured future capture, explicitly untested.

| Option | Exact Linux executable | Actual HW IP availability | Attribution confidence | Easy/low-risk setup | Low environment interference | Useful now | Likely decision value |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| A. WSL virtual PMU | 5 | 0; absent | 0; unqualified | 1 | 1 | 1 | 1 |
| B. Windows native | 0 | 3; sources enumerated | 2; future native symbols | 1 | 2 | 2 | 1 |
| C. Direct Linux | 4; loader-dependent | 2; plausible, untested | 3; future ELF symbols | 1 | 1 | 2 | 1 |
| D. Current WSL timings + assembly + software IP | 5 | 0; explicitly none | 4; qualified software symbols | 5 | 5 | 5 | 5 |

**Choose D for this experiment.** Both configurations establish broad complete-
search gains without unexplained regressions. Hardware counters might further
separate branch misses, dependency latency and cache effects, but are unlikely
to change retention. No new Windows environment or boot session is justified
for redundant evidence. Revisit hardware setup if a future workload/compiler
regresses, or a cache/branch hypothesis becomes consequential. The bounded
read-only investigation did not defer the principal benchmarks.

### Supplemental software IP evidence

| Work / kernel | All user IP samples | Flip samples / share of all | Negamax share | Legal share | Unresolved |
| --- | --- | --- | --- | --- | --- |
| profile-root/original | 3,970 | 1,784 / 44.94% | 32.77% | 6.20% | 19 |
| profile-root/refined | 3,595 | 1,181 / 32.85% | 42.31% | 7.43% | 32 |
| opening/original | 4,209 | 488 / 11.59% | 34.90% | 22.00% | 87 |
| opening/refined | 4,022 | 325 / 8.08% | 36.10% | 22.40% | 95 |
| middle/original | 4,086 | 471 / 11.53% | 34.21% | 21.00% | 89 |
| middle/refined | 4,129 | 370 / 8.96% | 34.56% | 22.04% | 103 |

On the exact root, old flip samples include `+0xa3` (vertical shift, 71 samples) and `+0x1d3` (diagonal shift, 58); selected samples include `+0x59` (`bsr`, 81) and `+0x8d` (ray load, 47). Offsets are within their own measured ELF flip symbol. Complete flip IP aggregates retain raw addresses, offsets and assembly; timer aliasing/skid prevents attributing an intrinsic latency to these instructions.

These are **cpu-clock user IP** samples requested at 999 Hz, without stacks,
on the unchanged measured portable binaries. Their denominators include process
startup/warmup/teardown, so they are not signpost-filtered hardware work intervals.
Unresolved samples remain explicit; no `PERF_RECORD_LOST` records were exported,
and unknown unreported loss stays unknown. No cycle-weight, precise instruction
latency, cache behavior, branch-miss rate or caller ancestry is inferred.

The flip hotspot falls while legal/evaluation/control occupy larger relative
shares; unchanged tree/evaluation counters and improved complete elapsed/CPU time
provide the performance evidence. The profiles alone do not prove time moved
elsewhere or explain every residual change. The first JSON publication had an
outer-output collision; its fixed structural prefix was restored and all six
records/sample counts verified against untouched raw exports. The publisher now
has one stdout owner. No sample, clock or counter value was replaced.

## Decisions and answers to the requested questions

| Question | Finding |
| --- | --- |
| Why is WSL PMU sampling unavailable? | Guest CPUID advertises no architectural PMU; the kernel registers no CPU PMU; hardware opens return ENOENT. Software events work under current permissions. |
| Can this WSL expose a supported virtual PMU? | Unconfirmed; managed Hyper-V support does not establish a supported WSL control, and management tools are absent here. |
| Can Windows collect Intel PMU samples? | Hardware sources are actually enumerated; event-overflow recording is documented, but a capture/reservation/precise-IP path was not qualified here. |
| Could native Windows Reversi give meaningful profiles? | Yes for a separately built/qualified Windows executable. No inspected native compiler/profiler environment is ready, and its results would not be Linux ELF attribution. |
| Would direct Linux be better? | Likely best for future genuine Linux hardware attribution; setup/reboot/permissions remain untested, and it would measure bare-metal runtime. |
| Additional value of a workaround? | Better branch/cache/dependency attribution, little likely value for the present clear retain/reject decision. |
| Did exact/opening/middle/coaching improve? | Yes in both matched GCC configurations; full paired intervals and denominators are above. |
| Portable and native tuning? | Both improve against their own baseline. Their code generation and micro rankings differ; tuning alone is never counted as algorithm benefit. |
| Rules, scores, continuations and counters preserved? | Independent flip/mailbox exact/heuristic references, B/L/P, full PV/counter comparisons, sanitizers and completed-horizon audits pass. |
| Enough evidence without another hardware campaign? | Yes. Retain the shared kernel; no architecture-specific complexity or further profiling setup is needed for this decision. |

The original twelve experiment questions are also resolved: the tested algorithms
are listed above; the [Mac-only micro winner was sentinel at 4.05×](FLIP_OPTIMIZATION_MAC.md#flip-microbenchmark--mac-only),
with about 37% less exact-panel time across twelve roots and 12–15% opening/
middle/coaching gains. Mac hardware sampling found about 72.1% less flip cycle
weight per disclosed root, equivalent to 41.9% of the old accepted total, alongside
44% less unprofiled complete time. The original 58.77% hotspot was specific to
that investigation/root. **No PC hardware-cycle fraction is inferred from it.**
The unchanged helper's separate Mac benefit remains separate; PC correctness and
call counts preserve it. The PC tables establish portability, without claiming
an identical magnitude, universal fastest algorithm, or new playing strength.

## Evidence, reproduction and publication

The combined serial measurement/profiling ledgers total **13.67 minutes** (820.13 seconds), including pilots, calibration, warmups and all six software captures. This is one machine budget across both configurations, well below 90 minutes. Read-only feasibility probes are separate; ordinary builds, independent correctness, sanitizers, offline decoding and reporting are outside the active performance budget.

Read [the PC reproduction commands](../scripts/fast-flips/PC_README.md) and
[compact manifest](data/fast-flips-pc/manifest.json). Both configurations preserve
every complete batch elapsed/CPU/counter, per-root elapsed mean and full result
signature hash; micro trials/corpus checksums, timed publications, independent
references, source/binary fingerprints, assembly, probes and resource snapshots
are committed. Raw perf files, binaries, venvs and bulk fixed-call rows are not.
Mac evidence is unchanged and independently re-audited. Candidate source is the
same one already qualified by Emscripten and actual Mac Chrome; this phase did
not rebuild candidate Wasm or claim a new Windows-browser acceptance run.

Public evidence audits require neither profiling tools nor a new campaign:

```bash
.venv/bin/python scripts/fast-flips/verify-public.py
.venv/bin/python scripts/fast-flips/pc-verify-public.py
```

Publication commands, after passing closing suites and evidence audits:

```bash
git add USER_REQUESTS.md docs/FLIP_OPTIMIZATION_PC.md docs/FLIP_OPTIMIZATION_RESULTS.md \
  docs/data/fast-flips-pc scripts/fast-flips/PC_README.md scripts/fast-flips/pc-*
git commit -m 'Qualify fast flips on GCC 15 WSL2 and assess hardware PMU options'
git push origin perf/fast-flips
git rev-parse HEAD
git ls-remote origin refs/heads/perf/fast-flips
```

The final commit/remote identity is returned after publication to avoid a
self-referential report hash. `main` is not merged or pushed.
