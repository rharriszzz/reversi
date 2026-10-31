# Flip optimization — cross-platform decision

**Retain the shared portable 4 KiB geometry-table/sentinel kernel.** The actual M4 and WSL2 PC complete-search comparisons favor it, with preserved rules, frozen models, fixed scores, continuations and search/TT counters. No architecture-specific dispatch is justified. Keep the results on `perf/fast-flips`; this experiment does not merge into `main`.

Original baseline: `1058f013581e0566277586f857b0a2884be260f6`. Selected source: `9357d4b3510d7931b3ea4b8739b7c8e693414f33`, published in Mac head `1b83a2b2c158078962afd48a48479346f854c813`. Selected engine SHA-256: `b97d526697e68aa04186b67d2e13dc0f4eab21fb086921532e8b9b63cf47e7a5`. PC work does not change that engine.

## Separate complete-search decisions

Elapsed change versus the **same-machine, same-flags original**; negative is faster. Each cell uses nine alternating/rotating timing pairs and its own descriptive 95% paired-log Student-t interval. These intervals describe fixed-panel run variation, not all Reversi positions or playing strength.

| Fixed panel / model | Distinct roots | M4 Apple Clang portable | WSL2 GCC 15 portable | WSL2 GCC 15 -march=native |
| --- | --- | --- | --- | --- |
| mixed48/B | 48 | -20.87% [-21.52, -20.21] | -14.14% [-17.21, -10.97] | -19.60% [-22.15, -16.97] |
| mixed48/P | 48 | -17.55% [-18.01, -17.09] | -9.06% [-11.41, -6.65] | -16.42% [-17.82, -15.01] |
| exact12/B | 12 | -37.22% [-37.88, -36.56] | -26.85% [-31.60, -21.76] | -33.96% [-36.87, -30.92] |
| exact12/P | 12 | -36.98% [-37.58, -36.37] | -26.62% [-29.79, -23.30] | -34.17% [-36.97, -31.24] |
| profile-root/B | 1 | -44.21% [-44.80, -43.61] | -27.61% [-29.02, -26.18] | -37.26% [-39.23, -35.22] |
| profile-root/P | 1 | -44.15% [-44.73, -43.56] | -25.75% [-28.42, -22.98] | -35.85% [-37.26, -34.42] |
| opening/B | 4 | -12.18% [-13.04, -11.32] | -7.54% [-11.69, -3.19] | -12.78% [-14.89, -10.61] |
| opening/P | 4 | -12.39% [-12.70, -12.08] | -8.21% [-11.01, -5.33] | -10.51% [-12.74, -8.22] |
| middle/B | 6 | -13.98% [-14.38, -13.58] | -6.84% [-8.50, -5.15] | -13.23% [-14.46, -11.99] |
| middle/P | 6 | -13.10% [-13.55, -12.65] | -5.73% [-8.08, -3.31] | -11.88% [-12.52, -11.23] |
| coaching/B | 2 | -14.90% [-15.37, -14.43] | -6.95% [-9.45, -4.39] | -14.12% [-15.70, -12.51] |
| coaching/P | 2 | -13.40% [-13.81, -12.98] | -9.52% [-12.34, -6.61] | -8.55% [-12.27, -4.67] |

Model L also passes and improves; full per-model clocks, CPU times, NPS/EPS, variability and counters are in the [Mac report](FLIP_OPTIMIZATION_MAC.md) and [PC report](FLIP_OPTIMIZATION_PC.md). The exact panel has twelve distinct **8–12-empty** roots; the single profiling root is a separate D12 workload. Mixed48 includes those exact roots plus legacy36 at their disclosed horizons. Opening/middle/coaching contain 4/6/2 roots. The slowest exact root dominates panel time, so individual-root results remain disclosed.

## Microbenchmarks and compiler dependence

| Same legal-phase mixture, 65,731 cases | Original → selected ns | Weighted point speedup |
| --- | --- | --- |
| M4 / Apple Clang portable | 13.29 → 3.28 | 4.05× |
| WSL2 / GCC 15 portable | 19.789 → 10.736 | 1.84× |
| WSL2 / GCC 15 native | 18.904 → 4.372 | 4.32× |

Mac and PC corpus counts and ordered checksums match exactly. Weighted micro ratios use class medians; complete-search effects use paired elapsed ratios. The distinct exact-tree micro sample has 1,779 cases and much smaller gains; it is not the legal-mixture denominator. Portable GCC favors doubling propagation in the microbenchmark, while native GCC favors the selected kernel. Doubling has not been independently promoted by a new PC complete-search campaign. A standalone ranking is not the retention criterion.

Portable GCC emits 126 selected instructions/444 bytes with four conditional branches; native GCC emits 90/358 with no conditional branches, using ordinary compiler-selected BMI/LZCNT instructions. The M4 selected body is 86/344, no conditional branches and four paired table loads. These static counts are architecture-specific, not comparable cycle units. The portable fallback does not require BMI. The extra geometry data remains 4096 bytes.

## Hardware PMU availability and workaround decision

The physical i7-14700F has hardware profiling facilities: Windows `wpr -pmcsources` actually lists cycle, retired-instruction, branch, cache and fixed counter sources. This is enumeration, **not a qualified host capture**. In this WSL instance, guest CPUID PMU leaf is all zero, the kernel reports software events only, and direct user-only hardware `perf_event_open` probes return ENOENT; software `cpu-clock` opens and records successfully. An existing perf 5.15.222 frontend was reused without installation.

No documented virtual-PMU control for this WSL utility VM was established; managed Hyper-V `Set-VMProcessor -Perfmon` support cannot be assumed to apply. No inspected Windows compiler/VTune/WPA environment is ready. A future native Windows build would profile different compiler/ABI/runtime code; direct Linux boot would better preserve GCC/source but require separate setup and runtime qualification. No security, VM, driver, BIOS, disk or boot changes were made.

**Proceed without another hardware campaign.** Qualified unprofiled WSL timings, disassembly and six explicitly labeled software IP captures answer the current retention question. Genuine Intel PMU setup could explain branch/cache mechanisms, but has little likely decision value given the broad gains. Revisit only for a consequential regression or unresolved bottleneck. See the [actual probes, source documentation and scored workaround comparison](FLIP_OPTIMIZATION_PC.md#hardware-pmu-availability-and-workaround-decision).

## Correctness, scope and evidence

Both PC configurations pass the independent exhaustive mailbox flip suite, independent complete exact solutions on the twelve panel roots plus disclosed D12 root, B/L/P heuristic/terminal/pass tests, coaching/PVs, all fixed search/TT counters, sanitizers, and actual 80/300-ms completed-publication checks. Mac already qualified the unchanged selected C++ source through Emscripten and actual Chrome. Distributed Wasm assets are unchanged; no new PC candidate-browser acceptance is claimed.

The original Mac 58.77% hotspot and its 72.1% reduction in sampled flip cycle weight per disclosed root remain Mac/root-specific evidence, not PC cycle percentages. The helper-only Mac experiment saves 16–17% on its exact panel; PC call diagnostics preserve the 62.57% helper call fraction but do not separately measure its time. No fixed-horizon playing behavior changes or new learning/strength claims follow.

Cross-machine absolute timing is secondary and confounded by hardware, OS, compiler and scheduling. This decision uses **within-machine** matched comparisons, without treating native tuning itself as an algorithm speedup. The two PC measurement ledgers total 13.67 minutes, below the single 90-minute machine allowance.

[Mac compact evidence](data/fast-flips-mac/manifest.json), [PC compact evidence](data/fast-flips-pc/manifest.json), [PC reproduction and audits](../scripts/fast-flips/PC_README.md).
