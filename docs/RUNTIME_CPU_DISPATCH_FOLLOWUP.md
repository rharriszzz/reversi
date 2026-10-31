# Final PC CPU dispatch compiler follow-up

Current-source qualification and rebuilt distribution are recorded in
[M4 production acceptance](RUNTIME_CPU_DISPATCH_MAC_ACCEPTANCE.md). The report
below preserves its original experiment/publication scope and artifact identities.

**Retain B: the unsigned-mask source from `a3165e0`, with original generic tuning.**
Do not retain the Alder Lake tuning change. The branch remains
`perf/runtime-cpu-branchless-probe`; nothing is merged into main.
The pre-timing checkpoint was pushed at `4895381e4461d65475898354facb62ba26a2b0e3`.
This report supersedes that checkpoint, preserved in Git history. All original
CPU-dispatch and fast-flip reports/data remain unchanged.

The branchless implementation saves **13.26% / 15.51% / 14.28%** elapsed time
on exact12 B/L/P, and **5.64% / 8.46% / 4.52%** on mixed48. All six paired
95% intervals exclude zero. The forced fallback also improves on these panels.
No search algorithm, model, result, PV, counter or interruption rule changes.
Acceptance is for this PC experiment; Mac and fresh Wasm qualification precede
any promotion.

[Reproduction](../scripts/runtime-cpu-followup/README.md),
[evidence manifest](data/runtime-cpu-followup/manifest.json),
[build receipts](data/runtime-cpu-followup/builds.json),
[all search clocks/counters/signatures](data/runtime-cpu-followup/search.json),
[statistics](data/runtime-cpu-followup/summary.json),
[correctness](data/runtime-cpu-followup/qualification.json).

## Environment, compiler and builds

Actual Windows 11 / WSL2 i7-14700F, Ubuntu GCC 15.2.0-16ubuntu1,
Python 3.14.4 and Node 24.16.0. Baseline source is exactly
`a77712eb89e3a822d77048694227f39be5d62337`; the mask source is exactly
`a3165e01a6f4e240a7f4c2e77774bd5dc8f8a7bd`.

Common: `-O3 -std=c++17 -Wall -Wextra -Wpedantic -ffp-contract=off
-fno-fast-math`, no LTO. Dispatcher, detector, portable backend, driver and
qualification adapters use `-march=x86-64 -mtune=generic
-DREVERSI_CPU_DISPATCH`. Only the enhanced translation unit changes tuning:

| Tag | Shared source | Enhanced target flags |
| --- | --- | --- |
| A | Qualified conditional expressions | `-march=x86-64 -mtune=generic -mpopcnt -mbmi -mbmi2 -mlzcnt` |
| B | Unsigned masks | Same as A |
| C | Original conditional expressions | `-march=x86-64 -mtune=alderlake -mpopcnt -mbmi -mbmi2 -mlzcnt` |
| D | Unsigned masks | Same as C |
| N | Original production algorithms from `e7b79b9` | Full program `-march=native`, strict FP retained |

AP/BP/CP/DP force `REVERSI_CPU_BACKEND=portable` in precisely the same
executable bytes as A/B/C/D respectively. All others use auto selection;
A–D report `x86-popcnt-bmi1-bmi2-lzcnt`, with all four detected features true.
N is the historical host-only comparison, not a deliverable. Its reconstruction
reproduced the prior accepted binary exactly, allowing a matched remeasurement.
The same driver is compiled against each corresponding Engine header/layout.

| Fixed-work executable | SHA-256 |
| --- | --- |
| A | `78cafaf78db605927e87f59fe2d8d2b5b94a604b867f420d9599b7301d0eaa53` |
| B | `ef29ae1f038066b74a4aca6e894133564a718295ea753d5181e2c7f90c3cd25a` |
| C | `786c41cef14e73de38f36579ea8ed3b343e34f8d509262d36151670a56efe243` |
| D | `256d176f7a497052ccc95992c41ab0fa693b6babef28999e3fb0952d9256350f` |
| N | `745b8349f7b5abb1ef40e2ec9ce37006827302b58e4f904eecdb0fa107dd746d` |

Receipts contain source and generated-driver hashes, compiler/unit flags,
binary hashes, ISA contracts and linked test results. Frozen B/L/P identities are
unchanged, including the generated coefficient-header hash. A reproduces the
qualified dispatch fixed-work binary. A final build from the actual worktree
through `scripts/native/build.mjs` reproduced **all four B hashes**: fixed-work,
CLI, qualification adapter and micro executable. The CLI hash is
`09d0df1c895466768b986696cdf5300ff8a208b5d82ffe5cab03e6ae880a34db`.

GCC `-Q --help=optimizers` and `--help=target` are retained in the evidence.
Alder Lake changes the loop-alignment default from `16` to `16:11:8`, move/store
width preferences from 128 to 256, and machine tuning; it enables no new ISA.
The Boolean optimizer settings, including both if-conversion passes, are already
enabled identically. No additional flag had a sufficiently clear low-risk case.
No flag sweep, fast math, AVX backend, alignment experiment or linker script was
introduced. Existing strict FP flags remain effective in every configuration.

## Complete-search comparison

The unchanged ordered 48-root corpus has SHA-256
`a8deadc89f811e02da19910a702b073de12707ef19895a10f7d9861d088dcfee`.
Exact12 has twelve distinct 8–12-empty roots; the disclosed profile root is D12.
Opening/middle/coaching have 4/6/2 roots. Coaching uses full-window D6 with
verified continuations. All original model identities and horizons are retained.
The three exact model panels repeat the same twelve positions, not 36 distinct
positions. Each exact12 batch visits 551,969 nodes and zero static evaluations.

Two full warmups per block; repeats calibrated to a 250-ms baseline target;
nine rotating/reversed executable and workload trials; fresh processes per block.
A separate two-trial 100-ms pilot is retained and excluded from intervals.
All fixed results and all thirteen search/TT counters match, including across
repeats. Table effects are geometric means of paired elapsed ratios with
Student-t 95% intervals on nine log ratios (df=8). Negative means less time.
These describe variation on fixed engineering panels, without multiplicity
correction or claims about a population of positions or playing strength.

| Panel/model | A ms | B/A % [95%] | C/A % [95%] | D/A % [95%] | D/B % [95%] | B/N % [95%] |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| mixed48-B | 95.461 | -5.64 [-8.68, -2.51] | -4.36 [-5.83, -2.87] | -6.76 [-9.10, -4.36] | -1.18 [-4.59, +2.34] | -3.28 [-5.91, -0.57] |
| exact12-B | 20.495 | -13.26 [-14.99, -11.50] | -12.18 [-14.56, -9.73] | -12.74 [-14.48, -10.96] | +0.60 [-2.29, +3.57] | -6.08 [-9.75, -2.26] |
| profile-root-B | 3.603 | -14.74 [-18.35, -10.96] | -11.15 [-15.74, -6.31] | -15.41 [-19.01, -11.66] | -0.80 [-4.66, +3.22] | -7.95 [-10.13, -5.72] |
| opening-B | 42.197 | -5.07 [-7.13, -2.95] | -2.09 [-6.41, +2.42] | -4.49 [-6.40, -2.54] | +0.60 [-0.46, +1.68] | -3.34 [-5.23, -1.40] |
| middle-B | 12.050 | -5.54 [-9.35, -1.56] | -6.33 [-9.65, -2.90] | -4.70 [-8.03, -1.24] | +0.89 [-0.45, +2.24] | -3.69 [-6.57, -0.71] |
| coaching-B | 9.109 | -5.94 [-8.85, -2.94] | -2.72 [-6.55, +1.27] | -5.56 [-8.22, -2.81] | +0.41 [-1.48, +2.33] | -6.33 [-8.83, -3.76] |
| mixed48-L | 112.132 | -8.46 [-11.56, -5.25] | -6.57 [-10.04, -2.96] | -6.35 [-9.93, -2.64] | +2.30 [+0.03, +4.62] | -5.37 [-7.55, -3.14] |
| exact12-L | 21.272 | -15.51 [-19.29, -11.56] | -12.88 [-14.56, -11.17] | -15.38 [-17.57, -13.13] | +0.16 [-2.87, +3.28] | -5.78 [-11.61, +0.43] |
| profile-root-L | 3.751 | -17.53 [-20.32, -14.64] | -12.90 [-14.79, -10.97] | -17.06 [-19.02, -15.05] | +0.57 [-1.64, +2.83] | -8.78 [-10.16, -7.39] |
| opening-L | 50.061 | -5.29 [-7.98, -2.52] | -4.49 [-6.83, -2.11] | -4.68 [-6.50, -2.84] | +0.64 [-2.64, +4.03] | -4.06 [-8.01, +0.06] |
| middle-L | 15.566 | -3.04 [-6.30, +0.33] | -6.36 [-9.34, -3.29] | -2.29 [-5.53, +1.05] | +0.77 [-1.33, +2.91] | -4.48 [-6.29, -2.63] |
| coaching-L | 11.270 | -3.14 [-6.41, +0.24] | -1.83 [-5.18, +1.64] | -3.06 [-5.60, -0.47] | +0.08 [-3.55, +3.84] | -3.78 [-6.67, -0.79] |
| mixed48-P | 159.562 | -4.52 [-8.33, -0.55] | -5.14 [-8.74, -1.39] | -3.69 [-7.78, +0.59] | +0.87 [-2.96, +4.86] | -5.01 [-6.87, -3.11] |
| exact12-P | 20.787 | -14.28 [-18.27, -10.09] | -11.22 [-15.31, -6.93] | -12.91 [-17.29, -8.29] | +1.60 [-2.77, +6.17] | -5.94 [-8.49, -3.32] |
| profile-root-P | 3.612 | -14.77 [-16.77, -12.73] | -12.67 [-14.10, -11.22] | -16.02 [-17.49, -14.53] | -1.47 [-3.96, +1.08] | -10.03 [-13.39, -6.54] |
| opening-P | 86.484 | -3.42 [-8.40, +1.82] | -5.68 [-7.18, -4.16] | -4.61 [-7.44, -1.68] | -1.23 [-4.04, +1.67] | -1.89 [-6.91, +3.40] |
| middle-P | 23.369 | -7.38 [-9.38, -5.34] | -5.73 [-7.59, -3.83] | -6.00 [-9.73, -2.12] | +1.49 [-2.22, +5.34] | -5.62 [-7.67, -3.52] |
| coaching-P | 14.418 | -5.54 [-7.87, -3.15] | -4.75 [-6.40, -3.07] | -4.60 [-7.51, -1.59] | +1.00 [-3.83, +6.07] | -5.26 [-6.88, -3.62] |

B improves every panel's point estimate versus A. Middle-L, coaching-L and
opening-P intervals include zero; none establishes a regression versus A.
C independently helps exact12 by 11–13% and mixed48 by 4–7%, but this does not
establish an incremental benefit after adopting masks. Direct B/C exact12
intervals include zero. C beats B on middle-L by a small, unadjusted borderline
effect: B/C +3.55% [+0.06, +7.17]. B beats C on mixed-L by -2.03%
[-3.96, -0.05], also borderline. Neither dominates every panel.

D/B exact intervals all include zero, and combined tuning has an unadjusted
mixed-L slowdown of +2.30% [+0.03, +4.62]. There is no reliable overall reason
to add that compiler dependency. Prefer B's simple source change and substantial
fallback benefits; this is a measured tradeoff, not a claim that B is fastest on
every root or that a barely excluded zero proves universal superiority.

Selected B absolute work and variability (means per complete panel batch):

| Panel | Wall ms | Thread CPU ms | CV % | Nodes | Evaluations |
| --- | ---: | ---: | ---: | ---: | ---: |
| exact12-B | 17.788 | 17.788 | 5.29 | 551,969 | 0 |
| exact12-L | 17.986 | 17.986 | 7.05 | 551,969 | 0 |
| exact12-P | 17.815 | 17.815 | 6.38 | 551,969 | 0 |
| mixed48-B | 90.130 | 90.111 | 5.39 | 1,780,838 | 841,839 |
| mixed48-L | 102.593 | 102.570 | 4.46 | 2,018,500 | 1,023,170 |
| mixed48-P | 152.556 | 152.554 | 7.42 | 2,578,323 | 1,438,599 |

The data retain wall, thread and process CPU clocks, per-root timing, every
counter, score signatures, standard deviations/CVs, minima/maxima and all paired
comparisons, rather than only the favorable means.

### Portable fallback

| Panel/model | AP ms | BP/AP % [95%] | CP/AP % [95%] | DP/AP % [95%] |
| --- | ---: | ---: | ---: | ---: |
| mixed48-B | 108.065 | -9.13 [-12.02, -6.15] | -1.10 [-4.59, +2.53] | -8.45 [-11.34, -5.46] |
| exact12-B | 22.012 | -12.38 [-14.51, -10.20] | -0.27 [-2.77, +2.30] | -12.62 [-14.39, -10.82] |
| profile-root-B | 3.772 | -13.82 [-15.59, -12.01] | +2.68 [-1.15, +6.66] | -12.34 [-15.42, -9.14] |
| opening-B | 48.074 | -3.90 [-8.00, +0.39] | +1.31 [-2.90, +5.69] | -4.14 [-8.34, +0.25] |
| middle-B | 13.656 | -5.86 [-8.01, -3.66] | +1.09 [-1.08, +3.31] | -6.29 [-9.44, -3.03] |
| coaching-B | 10.271 | -5.97 [-8.82, -3.03] | -1.17 [-2.53, +0.22] | -6.98 [-7.78, -6.18] |
| mixed48-L | 123.615 | -7.52 [-9.35, -5.65] | -0.51 [-2.07, +1.07] | -7.96 [-10.38, -5.47] |
| exact12-L | 22.187 | -14.45 [-16.22, -12.64] | +0.31 [-2.84, +3.57] | -13.98 [-16.46, -11.42] |
| profile-root-L | 3.989 | -14.58 [-15.59, -13.55] | -2.44 [-6.12, +1.39] | -16.21 [-18.43, -13.93] |
| opening-L | 56.044 | -5.01 [-9.42, -0.40] | +0.18 [-4.36, +4.94] | -4.71 [-8.48, -0.78] |
| middle-L | 17.885 | -4.81 [-8.15, -1.36] | -0.15 [-2.55, +2.31] | -6.66 [-9.13, -4.11] |
| coaching-L | 12.981 | -5.37 [-7.23, -3.47] | -0.28 [-3.04, +2.55] | -6.74 [-10.50, -2.82] |
| mixed48-P | 178.746 | -6.25 [-10.07, -2.26] | -0.18 [-4.32, +4.15] | -5.64 [-10.85, -0.13] |
| exact12-P | 22.087 | -12.17 [-15.08, -9.15] | -1.18 [-6.54, +4.50] | -13.45 [-15.16, -11.71] |
| profile-root-P | 3.914 | -14.46 [-17.62, -11.19] | +0.31 [-2.17, +2.85] | -14.41 [-17.07, -11.67] |
| opening-P | 95.458 | -4.93 [-5.84, -4.01] | +0.94 [-1.53, +3.47] | -4.97 [-6.51, -3.39] |
| middle-P | 26.224 | -5.91 [-7.64, -4.16] | -0.58 [-2.92, +1.81] | -6.83 [-9.65, -3.91] |
| coaching-P | 16.394 | -6.09 [-9.80, -2.23] | -0.94 [-4.37, +2.61] | -8.17 [-11.63, -4.58] |

BP improves all point estimates, with no significant complete-search regression;
opening-B's interval includes zero. Exact12 savings are 12.38% / 14.45% / 12.17%,
and mixed48 savings are 9.13% / 7.52% / 6.25%. No compile-time specialization is
needed. C's portable object is byte-identical to A's; changing only the enhanced
object can still move linked addresses. CP/AP variations do not represent new
portable instructions. The supporting exact-tail micro does regress under masks,
but complete endgame searches improve; that distinction is disclosed below.

## Linked assembly and interpretation

Full `objdump -dC` and `nm -SC` listings, ordinary linker maps and section
information remain with the local linked executables. Compact function sizes,
mnemonics, registers, stack references, addresses/alignment, calls and shared
symbols are published in [assembly.json](data/runtime-cpu-followup/assembly.json).

| Enhanced body | A instructions/bytes | B | C | D | N |
| --- | ---: | ---: | ---: | ---: | ---: |
| flips | 101/405 | 118/455 | 90/358 | 118/455 | 90/358 |
| legal | 263/913 | 263/913 | 263/913 | 263/913 | 263/913 |
| pop | 4/12 | 4/12 | 3/10 | 3/10 | 3/10 |
| Seven features | 319/1217 | 319/1217 | 317/1209 | 317/1209 | 318/1221 |
| P pattern sum | 285/1176 | 285/1176 | 285/1176 | 285/1176 | 270/1116 |
| negamax | 494/2177 | 497/2209 | 499/2209 | 496/2177 | 942/4705 |
| lastEmpties | 337/1385 | 337/1385 | 331/1369 | 329/1385 | 698/3482 |

A has four flip conditional branches; **B, C, D and N have zero**. All use eight
ray-table loads. The explicit masks are mathematically equivalent unsigned
zero/all-ones selections; the low sentinel and membership test still prevent a
false bracket. GCC lowers the mask source to conditional moves, not necessarily
a literal subtract-and-mask sequence.

B/D enhanced flips expand from A's 101 instructions/405 bytes to 118/455, add six
callee-saved register push/pop pairs and fourteen `%rsp` memory operands, and use
more GPRs. Portable flips similarly grow from 126/444 to 143/488 and lose four
branches. C produces 90/358 with zero stack operands and the same normalized
flip instruction sequence as N. Its code generation alone does not predict the
complete-search winner. Register lists are static observations, not measured
peak liveness or hardware register-pressure counters.

All dispatch candidates use POPCNT, BMI1 ANDN/BLSI/BLSR, BMI2 SHRX/SHLX and
LZCNT where expected. Portable software popcount becomes hardware POPCNT in the
enhanced code. Tuning additionally removes one XOR from pop. P extraction keeps
constant shifts, gather multiplication and coefficient lookups; it emits no
PEXT/PDEP. The dispatch P sum is unchanged across A–D. No AVX, AVX2 or FMA is
introduced by masks or Alder Lake tuning, and target reports keep those feature
permissions disabled. Baseline REP-BSF encodings disassembled as TZCNT operate
on nonzero operands and remain valid as BSF on older processors.

N enables broader ISA and cost-model choices: its recursive functions contain
AVX2 integer permutations/comparisons and vector stores, while feature arithmetic
also uses AVX forms. Strict FP prevents contraction. Its much larger recursive
bodies reflect different compiler expansion/inlining/vectorization choices; they
are not different search algorithms. N's stack references often use `%rbp`, so
`%rsp`-only counts cannot be compared as total stack traffic. The receipt records
both addressing forms; neither is an executed-load count.

B increases GNU size's text/read-only category by only 160 bytes versus A
(182,788 vs 182,628); C is 182,556, D 182,756 and N 160,810. These totals include
read-only data/metadata, not just instructions. ELF section sizes are retained
separately. B enhanced negamax/lastEmpties begin at `0xe970`/`0xf220`, cache-line
offsets 48/32, versus A's 16/32. Ordinary object grouping remains; no measured
alignment benefit or causal cache attribution is claimed.

The hot graph has distinct portable/enhanced recursive symbols, exclusively
statically bound calls within the selected backend, and no indirect recursion,
public rule-wrapper bounce, per-node CPU check or inactive-backend call. CPU
detection and outer selection stay baseline-compatible. There is one shared
4-KiB geometry table and one set of frozen/contribution tables. Engine and Entry
remain 168 and 40 bytes, with one 10,485,760-byte default TT per engine.

Branch prediction, instruction scheduling/liveness and layout are plausible
contributors to the timing differences; this campaign does not isolate their
cycle costs. More static instructions and stack accesses can coexist with faster
searches, as B demonstrates. Fewer branches alone do not explain the full gap.

## Supporting micro and timed results

Unchanged 65,731-case legal-phase and 1,779-case exact-tail corpora; three
rotating/reversed executable rounds, seven inner trials/class, three-million-call
targets. Values are case-weighted class medians for legal phases and pooled tail
medians, in ns/call. Independent mailbox checks precede timing.

| Tag | Legal-phase ns | Exact-tail ns |
| --- | ---: | ---: |
| A | 10.020 | 3.677 |
| B | 4.431 | 4.443 |
| C | 4.396 | 4.366 |
| D | 4.448 | 4.449 |
| AP | 11.008 | 4.446 |
| BP | 5.472 | 5.273 |
| CP | 11.012 | 4.433 |
| DP | 5.576 | 5.268 |
| N | 4.341 | 4.331 |

B improves the common legal-phase kernel substantially, but its tail micro is
slower than A (4.443 vs 3.677 ns); BP is slower than AP there too (5.273 vs
4.446 ns). Complete exact12 searches nevertheless improve substantially in both
backends. This excludes microbenchmarks as the acceptance gate and prevents a
claim of universally faster flips. Historical measurements retain their identity.

Actual 80/300-ms publications: 972/972 verified against baseline fixed-depth
roots and full-window chosen-child searches, with independent mailbox legality;
42 distinct root horizons. Each following cell summarizes 18 calls.

| Model/budget ms | A median depth | B median depth | B mean elapsed ms | B max overrun ms |
| --- | ---: | ---: | ---: | ---: |
| B/80 | 9.5 | 10 | 80.019 | 0.031 |
| B/300 | 11 | 11 | 300.019 | 0.025 |
| L/80 | 9 | 9 | 80.017 | 0.020 |
| L/300 | 10.5 | 11 | 300.018 | 0.020 |
| P/80 | 9 | 9 | 80.018 | 0.023 |
| P/300 | 10 | 10 | 300.064 | 0.850 |

Wall-limited partial iterations naturally have different counters/depths;
deterministic node-stop tests separately establish exact interruption equality.
These are throughput/publication checks, not tournament strength evidence.

## Correctness, resources and limitations

| Gate | Result |
| --- | --- |
| Initial rules/flips/exact tests | 14/14 |
| Branchless native/dispatch regression | 17/17; also 17/17 under ASan/UBSan |
| Every A–D backend, ordinary and sanitized | 1,258,311 independent mailbox flip cases each; TT rollover, pattern sums, PVs, shared state/copy, guarded backend selection pass |
| Nine-configuration mailbox/minimax | 221 boards, 35,802 root queries, 22,086 children |
| Coaching/PVs | 3,294 rows, 9,882 PV steps, 567 deep coaching rows |
| Independent interrupted horizon checks | 1,215 publications |
| Additional cross-configuration deterministic interruption | 1,215 queries, complete fields/counters equal, repeated objects with model/depth changes and one-entry TT collisions |
| Independent exact solver | All twelve panel roots plus D12, every configuration/model |
| Actual timed publications | 972/972 optimal root/chosen-child checks |
| Final full Node suite | 183/183, no skips |
| Final forced portable native/V2/endgame | 16/16; ASan/UBSan 16/16, no skips |
| Final source reconstruction | All four B executable hashes identical |
| Ordinary non-dispatch C++/browser C ABI on Linux | 90/90 queries/counters; object sizes unchanged |

Final logs and exact commands are hashed in the qualification receipt. Demanding
work ran serially. A separate measurement directory and durable ledger preserve
the pilot, fixed/timed campaign, micro runs and executable hashes before/after.
Total active performance time: **973.718 seconds (16.23 minutes)**, comfortably
inside 45 minutes. No profiled timings, PMU investigation or system changes.

Precheck: WSL about 5.9 GiB available, about 1 MiB swap occupied, load
0.01/0.02/0.04, 885 GiB free disk. During recorded search snapshots, available
RAM was 6.24–6.38 GiB, and maximum one-minute load was about 1.10. Windows had
about 4.6 GiB free physical RAM. Chrome eight processes/about 592 MiB and Edge
five/about 291 MiB were open but insignificant sampled CPU consumers; the
largest observed non-benchmark Windows consumer was Task Manager, 0.312 CPU
seconds over three seconds. Normal desktop variation remains in the intervals;
no core affinity, P/E-core assignment or cycle attribution is claimed.

The fallback was executed on this capable PC and audited statically, not tested
on old physical hardware or a CPU emulator. None was available. The detector
and all portable application code remain baseline-targeted; enhanced requests
cannot bypass actual feature checks. Linux runtime-library compatibility is
still required. No fresh ARM/Mac or Wasm compilation, actual Mac hardware test,
or browser launch campaign is claimed this round. Existing packaged Wasm
numerical tests pass and its artifacts/manifest remain unchanged. The Linux C ABI
check is useful shared-source evidence, not Mac/Wasm target qualification.

## Explicit decisions and answers

1. **Did masks remove four branches?** Yes, in both GCC 15.2 linked backends.
   They grow code/register use; tuning alone also removes them more compactly.
2. **Did actual complete searches improve?** Yes: B exact12 saves 13.26–15.51%,
   mixed48 4.52–8.46%, with no established regression in the other panels.
3. **Did Alder Lake tuning help independently?** Yes, C improves original-source
   exact12 and mixed48. It does not establish a better overall choice than B.
4. **Is combining better?** No demonstrated incremental benefit over B; most
   D/B intervals include zero and mixed-L shows a small borderline slowdown.
5. **What native endgame gap remains?** The current matched A/N gap is
   +8.28% / +11.52% / +9.73%, versus historical roughly 11–13%. B/N is
   **-6.08% [-9.75, -2.26] / -5.78% [-11.61, +0.43] /
   -5.94% [-8.49, -3.32]**. The old gap is recovered on this panel; L cannot
   distinguish a small remaining gap from noise. The original full-native
   executable is a reference, not a mathematical upper bound. No revised
   branchless full-native campaign is needed for this decision.
6. **Are isolation and CPU safety intact?** Yes within static/PC qualification:
   two backends, same four scalar feature requirements, baseline dispatcher,
   direct recursive calls, shared immutable storage, one TT. No new AVX needs.
7. **Fallback regressions?** None established in complete searches. BP exact12
   saves 12–14%, mixed48 6–9%. The disclosed tail micro slows about 19%.
8. **Best implementation to carry forward?** B: existing mask source with generic
   enhanced tuning. Retain the opt-in two-backend architecture. No third backend,
   new default, duplicated source or compile-time specialization is justified.
9. **More PC compiler work or M4?** Stop this compiler round. The remaining
   differences do not support another flag campaign. Next qualify B against the
   prior source on M4: native/ordinary-path correctness and sanitizers, full B/L/P
   search/coaching/timed panels, then the pinned Wasm rebuild and browser checks.
   Keep Mac/Intel support requirements and provenance checks; promote only after
   the required Mac and WebAssembly qualification.

Publication uses `git add docs/RUNTIME_CPU_DISPATCH_FOLLOWUP.md
scripts/runtime-cpu-followup docs/data/runtime-cpu-followup`, then
`git commit -m 'Qualify branchless flips and close PC compiler tuning comparison'`,
`git push origin perf/runtime-cpu-branchless-probe`, and
`git ls-remote origin refs/heads/perf/runtime-cpu-branchless-probe`.
The final publication SHA is reported separately to avoid self-reference.
