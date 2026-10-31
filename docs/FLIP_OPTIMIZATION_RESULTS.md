# Flip optimization — cross-platform decision

**Mac phase complete; PC phase pending.** Keep the portable 4 KiB ray/sentinel
kernel provisionally on `perf/fast-flips`. No merge or universal speed claim.
Baseline `1058f013581e0566277586f857b0a2884be260f6`; tested candidate
`9357d4b3510d7931b3ea4b8739b7c8e693414f33`; engine SHA-256
`b97d526697e68aa04186b67d2e13dc0f4eab21fb086921532e8b9b63cf47e7a5`.

| Separate fixed panel | Distinct roots | M4 B elapsed change [95%] | M4 P elapsed change [95%] | WSL2/x86-64 |
| --- | --- | --- | --- | --- |
| mixed48 | 48 | -20.87% [-21.52, -20.21] | -17.55% [-18.01, -17.09] | Pending actual PC qualification |
| exact12 | 12 | -37.22% [-37.88, -36.56] | -36.98% [-37.58, -36.37] | Pending actual PC qualification |
| profile-root | 1 | -44.21% [-44.80, -43.61] | -44.15% [-44.73, -43.56] | Pending actual PC qualification |
| opening | 4 | -12.18% [-13.04, -11.32] | -12.39% [-12.70, -12.08] | Pending actual PC qualification |
| middle | 6 | -13.98% [-14.38, -13.58] | -13.10% [-13.55, -12.65] | Pending actual PC qualification |
| coaching | 2 | -14.90% [-15.37, -14.43] | -13.40% [-13.81, -12.98] | Pending actual PC qualification |

Mac numbers use nine alternating/rotating timing pairs, complete fixed-work wall
time, Apple Clang 21 portable production options and identical scores/counters.
Intervals describe run variation on each disclosed panel; the twelve-root exact
panel and one twelve-empty root are different denominators. Model L also passes
and improves; the [full Mac report](FLIP_OPTIMIZATION_MAC.md) includes all tables.

The legal-phase micro point is 4.05×; the exact-search
micro corpus is 1.98×. Actual Chrome/Wasm and all independent correctness,
sanitizer and regression checks pass. Distributed browser assets stay unchanged.
Fixed-horizon playing behavior is preserved; timed playing strength was not tested.

PC must independently rebuild both revisions using its qualified GCC 15 / Python
3.14 environment, probe perf availability without privilege/kernel changes,
qualify scores/trees/PVs, and measure the same inputs/panels. Portable and
`-march=native` comparisons must have their own matched baselines. Fill PC cells
and make the combined retention decision only after actual PC results. Do not
infer PC timings from this Mac or compare absolute cross-machine time as an
isolated architecture effect. See [the exact PC handoff](FLIP_OPTIMIZATION_MAC.md#pc-handoff).
