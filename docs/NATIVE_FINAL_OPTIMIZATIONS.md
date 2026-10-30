# Final native experiments before WebAssembly

Neither candidate is retained. The qualified shared engine remains byte-identical
to commit 2492932. No model, scientific result or historical corpus changed.

## Changes attempted

A: pair adjacent full-identity forty-byte TT entries into two-way eighty-byte
buckets. Probe both identities; choose an empty slot, an older generation, then
the shallower current entry. Recompute replacement after recursion, preserving
same-position strengthening, equal-horizon/current-generation score reuse,
rollover clearing and bounded allocation. This is a modest locality experiment,
not a packed 64-byte design; full identity and metadata were deliberately kept.

B: ordinary leaves already reuse their own legal mask. At zero-depth forced
passes, reuse the known opposite legal mask and zero original mobility instead
of recursively generating both again. Preserve feature normalization, ordered
sum, counters and interruption checks. No other caller has a reusable mobility
mask for a *changed* child board. A parent mask cannot safely describe its child.

Reproducible patches for A, B and A+B are in `scripts/native-final/variants`.
They are experimental evidence, not production flags or a second engine.

## Measurements

M4 iMac, macOS ARM64, 24 GiB, Apple Clang 21, C++17 `-O3`,
`-ffp-contract=off -fno-fast-math`. Serial queries, nine alternating variant-order
repetitions, B and P, 36 disclosed opening/middle/endgame/pass/terminal roots from
`scripts/native-v2/positions.mjs`. Depth 8 before occupied 28, 7 before occupied
52, otherwise min(10, empties). Hints disabled between requests. Each table
allocates exactly 10 MiB (262,144 entries); both designs have identical capacity.
Compare complete-search elapsed time, not only TT hit rate or node throughput.

| Median complete batch ms | Baseline | A | B | A+B |
| --- | ---: | ---: | ---: | ---: |
| B evaluator | 63.827 | 71.642 | 64.118 | 71.529 |
| P evaluator | 110.851 | 122.208 | 111.265 | 121.401 |

A is 12.2% slower for B / 10.2% slower for P. B is 0.46% / 0.37% slower,
within the small variation of these trials, with no worthwhile gain. Combining
them does not repair the TT regression. No gain is claimed. These results reject
these concrete candidates, not every possible compact bucket or mobility design.

[Compact evidence](data/native-final-experiments-20261030.json) records source,
header and executable SHA-256 identities, compiler/flags, boards/seeds, every
repetition by phase, CPU/elapsed, nodes, evaluations, collisions, hits,
replacements, stores and useful TT cutoffs. NPS is nodes / elapsed seconds;
node counts can change with A, whereas B's trees match the baseline exactly.
Full per-position trials and logs remain in ignored
`.local-research/wasm-20261030`; no native binary is committed.

[Before/candidate sampling](data/native-final-profiles-20261030.json) contains
three-second macOS `sample` self counts for complete P opening, middle and exact
12-empty searches, plus search totals. Search/TT/ordering remain combined by
inlining; no cache-miss claim is inferred. Sampling is diagnostic, separate from
the nine-repetition throughput campaign. One later test invocation overlapped
part of sampling; sample percentages are approximate and do not support the
performance decision, which uses the isolated timed campaign.

## Correctness and decision

All 648 matched fixed root conditions (nine repetitions × 36 roots × two models)
produce identical minimax scores for all four variants. Each of A, B and A+B
passes all 15 native regression groups under ASan/UBSan, including independent
rules/long flips, exact endgames/all alternatives, B/L/P features and coefficients,
model/horizon changes, narrow/full bounds, one-slot collisions, generation
rollover, depth 15–64, deadlines, interrupted iterations and process restart.
The baseline fast suite passes all 160 tests before modification. Production
`native/engine.cpp` and `engine.hpp` are restored exactly; unsuccessful patches
are preserved for review. This checkpoint qualifies retaining V2, not an invented
optimization gain. Existing native P-versus-B strength evidence and its direct
development-overlap/unresolved-role limitations remain unchanged.

Reproduce (new ignored artifacts only; no scientific tournament):

```bash
node scripts/native-final/experiment.mjs
node scripts/native-final/summarize.mjs
node scripts/native-final/profile.mjs
npm test
NATIVE_SANITIZE=1 node --test tests/native-search.test.mjs tests/native-v2.test.mjs
python3 -m unittest discover -s tests -p 'test_*.py'
```

For sanitizer qualification of a candidate, apply its patch temporarily and run
the native command, then restore the original engine before continuing. Never
apply experimental patches to a frozen scientific snapshot.

The two-way candidate reduces batch nodes only 0.16% B / 0.24% P,
while increasing hits from 102,039 to 131,130 B and 140,622 to 170,046 P.
Useful TT cutoffs rise from 37,614 to 38,165 B and 56,267 to 57,531 P.
Additional probing/replacement cost outweighs this small tree reduction.
Baseline search throughput is 19.27M nodes/s B / 18.29M P; candidate A is
17.15M / 16.55M. This explicitly separates tree savings from execution cost.
The final restored suite passes 160 tests and 38 Python tests. Existing Python
subprocess ResourceWarnings remain nonfatal; no new platform coverage is claimed.
