# Faster disc flipping — production acceptance

**All production acceptance gates pass.** The exact qualified source and rebuilt
distribution are promoted through `integrate/fast-flips-production`, preserving
the experiment's complete history. This report records the new production
version; older experimental reports retain their original scope.

[Compact evidence index](data/fast-flips-production/manifest.json),
[builds and old/new manifests](data/fast-flips-production/builds.json),
[numerical/tests receipt](data/fast-flips-production/qualification.json),
[actual browsers](data/fast-flips-production/browsers.json).

## Decision and integration

Accept the portable **4 KiB geometry-table/sentinel** kernel. Each square has
eight 64-bit rays; the nearest non-opponent endpoint determines whether the
intervening discs are bracketed. There is no occupancy lookup, architecture
intrinsic or instruction-set dispatch. The engine is copied from the qualified
history, not reimplemented.

| Identity | Revision / SHA-256 |
| --- | --- |
| Original main / pre-flip baseline | `1058f013581e0566277586f857b0a2884be260f6` |
| Selected source introduced | `9357d4b3510d7931b3ea4b8739b7c8e693414f33` |
| Reviewed Mac/PC publication | `791c0f8516eb34d9ba683804b0e62428eb068c56` |
| Integrated `native/engine.cpp` | `b97d526697e68aa04186b67d2e13dc0f4eab21fb086921532e8b9b63cf47e7a5` |
| Unchanged `native/engine.hpp` | `f84153d587755542b6006150100e55e5ceb0b1f0e79111a8f91faa8fe4c784d6` |
| Unchanged frozen generated header | `1b286ed8371f0a2cd957b06b679e7422b68b3699cb7c8fe7c9f50968d27ceba1` |
| Ordered 48-root file | `a8deadc89f811e02da19910a702b073de12707ef19895a10f7d9861d088dcfee` |

The checkout started clean on local `perf/fast-flips` at `1b83a2b`. Fetch found
only the completed PC publication above; local/remote main remained at `1058f01`.
The two commits after the selected source contain reporting, tests and PC
qualification, with no native source change. Local experiment history was
fast-forwarded, then a new integration branch was created from main and
fast-forwarded through that complete history. This preserves every experiment,
rejected candidate, test and qualified receipt without cherry-pick provenance
loss. The final production commit can fast-forward main after acceptance.
`perf/fast-flips` remains at its original completed publication.

Only the flip calculation differs from the original main engine. The B seven
features/weights, L/P models, alpha-beta, move ordering, TT layout/policy,
one/two-empty helper, passes, raw terminal margins, exact/heuristic semantics,
full-window all-move coaching, verified PVs and completed-iteration publication
remain unchanged. No further kernel, search or evaluator optimization is added.

The [Mac experiment](FLIP_OPTIMIZATION_MAC.md), [independent PC experiment](FLIP_OPTIMIZATION_PC.md)
and [cross-platform decision](FLIP_OPTIMIZATION_RESULTS.md) remain historical
evidence. Both portable and host-tuned GCC 15 improve their own baselines.
An isolated portable microbenchmark ranking does not overturn that whole-search
result. Both committed evidence audits pass without recollecting old profiles.

## Distributed build and reproducibility

The old distribution was saved before replacement and remains available in Git.
The existing `npm run wasm:build` procedure was run twice with project Python
**3.14.10**, the existing **Emscripten 4.0.22** installation and unchanged flags.
No compiler, SDK, dependency or system setting was installed or upgraded.
Both complete builds produce byte-identical manifests, JS modules and binaries.

| Distribution | Build fingerprint | Wasm SHA-256 |
| --- | --- | --- |
| Original production, final-empty engine before fast flips | `01ae1b4aec535cf2a2b431d0d4fe3d1b8e76c60b021cc80cf507bcd5f462bc2d` | `924de12404edc637789ed705575c2b274070198666af5767157dd12d0de75150` |
| New production fast-flip engine | `eb25fd26b0e29d8e3ba5d2b0eb865c7658790b7791d8076cf4515235c369549b` | `a6540b1b9b83d80098fad424bfdf14a71b72e073e2aa972daa03366175a5414e` |

Old generated JS SHA-256:
`a14730889a1ef7c573ca6e0dcffe5cdfc4fbf1ca06fedeae7ffc71556c13d7b7`.
New `engine-eb25fd26b0e29d8e.mjs` SHA-256:
`4b58ea9939eb73941f4ef2ea12f5a9a2e42f6e6d60a61a3740fceeb511f2fd8e`.
The new Wasm is 377,970 bytes. The generated manifest names only its production
basename; it contains no experimental or ignored build path. The earlier Mac
experimental fingerprint `6e2607a0…` is not the production artifact.

The manifest hashes the exact qualified source, unchanged header/boundary/build
scripts and frozen header. Runtime initialization verifies ABI **1**, actual
compiled build ID and all model IDs. The six `_rv_*` JS interfaces and the raw
minified Wasm export list match the old distribution. Flags, all 63 linear
weights and B/L/P identities compare exactly against the saved old manifest:

- B: `original-production`.
- L: `ecf3fd376c680ced77d0b002ea2efb9fa4385737c4fffff734b901ab2968d97f`.
- P: `de4b84745589b0384ea3639f879e3c98990e802d176298ff8ef54f681520067f`.

The actual binary's `flips` disassembly has eight table loads and four `i64.clz`
endpoint operations. Its entire 4,096-byte geometry is verified after loading
Wasm data segments, SHA-256
`0540f902224a73c794cec44491946155bab64925f3db98227f52c10da11c5774`.
Emscripten splits zero-filled data segments, so searching the raw file for one
contiguous 4 KiB byte string is not a valid table-presence test. Likewise raw
exports are minified: compatibility is checked through the generated JS ABI as
well as the matched raw export list. These inspection details changed no build
or production source.

## Numerical acceptance

All completed commands return zero. Existing extensive Mac/PC evidence is reused;
new tests qualify the integrated source and actual production distribution.

| Check | Result |
| --- | --- |
| Before changes, `npm test` | 182/182 pass |
| After rebuilding, serial Node suite | 182/182 pass; no skipped tests |
| Python 3.14 suite | 46/46 pass |
| ASan/UBSan native search/V2/tiny-endgame suites | 16/16 groups pass |
| Exhaustive mailbox lines, randomized disjoint boards and legal histories | Over 1.25 million case checks pass in the Node flip suite |
| Native baseline vs integrated source | 221 boards; 7,956 root queries; independent children/minimax; zero mismatch |
| Native all-move/PV checks | 732 D3 rows, 2,196 PV placements, 126 additional D6 rows/PVs |
| Deterministic interruption | 270 completed-horizon/null-fallback publications pass |
| Actual native 80/300-ms publications | All 216 match complete baseline root and chosen-child searches at their published horizons |
| Packaged Wasm vs native and mailbox/minimax | 1,236 static queries; 3,708 searches; 303 coaching rows; 909 PV placements; maximum error zero |
| Standalone assertions compiled to actual Wasm | Pattern sums, TT generation rollover, bounds, analysis, interruption and natural-depth assertions pass |
| Full fixed-work result and counter comparison | All 18 workload hashes and signatures match qualified historical Mac evidence |

The regular native/Wasm suites include forced passes, terminal empties, depth
15/16/64, narrow/full windows, one-slot TT collisions, model/horizon isolation,
generation handling and completed-depth publication. The preserved PC mailbox
solver is rebuilt on this Mac and independently checks all twelve exact panel
roots plus the disclosed D12 root, for every build/model. All match. Final
production rechecks and actual 80/300-ms publications are recorded in the receipt.
Existing Python HTTPError/subprocess ResourceWarnings occur in runner tests;
all 46 tests pass and owned temporary research children finish. These warnings
are not engine numerical discrepancies.

## Final confirmation benchmarks

Apple M4 iMac, ten cores, 24 GiB, macOS 27.2 (26B123), Apple Clang 21 and
Node 24.22.1. The qualified pre-flip source and exact integrated source use a
common separately compiled driver, matched portable `-O3` strict FP flags,
no LTO, no profiler and identical work. Debug symbols do not change engine text.
Performance stages are serial. One preliminary pilot overlapped nested Node
suites launched by the Python tests; it was stopped, retained locally as
rejected evidence, and excluded from accepted results. Its 27.58 seconds remain
charged to the measurement ledger. Accepted measurements start after those
correctness processes finish.

Native has two warmup batches and five rotated/reversed paired trials, with
about 0.35 seconds of original work per timed block. The actual Chrome worker
has one warmup, three batches per block and seven alternating pairs. Wall time
is complete batch time, including the normal adapter/JSON and JS coaching work
for Wasm. Native records thread and process CPU; per-search Wasm CPU is
unavailable. Native coaching disables ordering hints in both builds; browser
coaching uses the normal adapter defaults in both builds, so their absolute
coaching times are not a native/Wasm matched-work comparison.

Exact12 contains twelve distinct **8–12-empty roots**, not twelve D12 roots.
Mixed48 includes those twelve plus legacy36 at the original disclosed horizons.
Opening is four D8 roots, middle six D7 roots, coaching two D6 roots with verified
full-window continuations. The separate disclosed D12 root is reported separately.
The 10,485,760-byte TT is unchanged. All fixed scores, best moves, exactness,
horizons and thirteen search/TT counters match for every call. This is execution
cost reduction, not a smaller search tree.

Times below are median milliseconds per complete batch. Percentages and 95%
intervals use paired log ratios (Student-t, five or seven pairs), so ratios of
medians need not exactly equal the effect. Intervals describe these fixed
panels' variation; they are not population or playing-strength intervals.
The desktop remains in ordinary use; no OS service or unrelated app is closed.

### Native

| Panel / model | Roots | Wall ms old → production | Thread CPU ms old → production | Elapsed change [95%] |
| --- | ---: | ---: | ---: | --- |
| mixed48-B | 48 | 78.161 → 62.493 | 78.156 → 62.484 | -19.94% [-21.19, -18.68] |
| exact12-B | 12 | 21.866 → 13.738 | 21.864 → 13.735 | -37.41% [-38.25, -36.56] |
| profile-root-B | 1 | 3.766 → 2.090 | 3.766 → 2.090 | -44.00% [-44.93, -43.05] |
| opening-B | 4 | 33.204 → 28.790 | 33.201 → 28.788 | -13.46% [-14.87, -12.03] |
| middle-B | 6 | 9.487 → 8.193 | 9.486 → 8.193 | -13.61% [-13.81, -13.41] |
| coaching-B | 2 | 7.188 → 6.086 | 7.188 → 6.086 | -15.43% [-16.11, -14.75] |
| mixed48-L | 48 | 88.752 → 70.525 | 88.736 → 70.521 | -20.24% [-20.93, -19.55] |
| exact12-L | 12 | 22.022 → 13.702 | 22.020 → 13.700 | -37.98% [-38.48, -37.47] |
| profile-root-L | 1 | 3.758 → 2.091 | 3.758 → 2.091 | -44.28% [-45.07, -43.48] |
| opening-L | 4 | 38.665 → 33.775 | 38.663 → 33.773 | -12.76% [-12.99, -12.53] |
| middle-L | 6 | 12.285 → 10.548 | 12.283 → 10.546 | -14.08% [-14.53, -13.63] |
| coaching-L | 2 | 8.830 → 7.566 | 8.828 → 7.566 | -14.18% [-14.63, -13.73] |
| mixed48-P | 48 | 122.504 → 99.889 | 122.494 → 99.880 | -19.15% [-21.83, -16.39] |
| exact12-P | 12 | 21.931 → 13.650 | 21.929 → 13.648 | -37.51% [-37.93, -37.09] |
| profile-root-P | 1 | 3.728 → 2.110 | 3.728 → 2.109 | -43.84% [-44.33, -43.34] |
| opening-P | 4 | 65.722 → 57.071 | 65.716 → 57.066 | -13.13% [-13.74, -12.51] |
| middle-P | 6 | 18.018 → 15.630 | 18.015 → 15.629 | -13.11% [-13.51, -12.71] |
| coaching-P | 2 | 11.155 → 9.684 | 11.154 → 9.682 | -13.31% [-13.80, -12.81] |

### Actual production Wasm in Chrome

| Panel / model | Worker wall ms old → production | Elapsed change [95%] |
| --- | ---: | --- |
| mixed48-B | 99.133 → 81.867 | -17.64% [-18.58, -16.70] |
| mixed48-P | 157.333 → 133.667 | -14.78% [-15.86, -13.70] |
| exact12-B | 25.067 → 17.500 | -30.45% [-31.35, -29.52] |
| exact12-P | 25.500 → 17.567 | -31.12% [-32.15, -30.08] |
| opening-B | 39.967 → 34.967 | -12.75% [-13.56, -11.94] |
| opening-P | 81.967 → 71.933 | -12.07% [-12.81, -11.32] |
| middle-B | 11.467 → 10.033 | -12.54% [-13.75, -11.31] |
| middle-P | 22.333 → 19.433 | -12.70% [-13.52, -11.87] |
| coaching-B | 5.000 → 4.500 | -11.15% [-13.24, -9.00] |
| coaching-P | 6.200 → 5.500 | -10.96% [-12.58, -9.31] |

These production results agree with the preceding M4 experiment: approximately
37–38% less native exact time, 19–20% mixed time and 13–15% opening/middle/coaching;
actual production Wasm saves about 30–31% exact, 15–18% mixed and 11–13% on the
other panels. No important workload has an unexplained regression. All L native
panels also improve. The slowest exact root dominates aggregate time, as disclosed
in the experiment; these panels do not establish universal speedups.

The earlier WSL2 experiments remain separate: portable GCC 15 saves roughly
25–27% exact time, host-tuned GCC roughly 34–36%, with gains on every important
panel. No post-merge PC run is claimed here. Faster fixed work may permit a
deeper completed horizon at fixed time budgets. This task measures no new
playing-strength improvement and promotes no evaluator.

## Actual application acceptance

Chrome **156.0.8078.74** uses disposable Playwright profiles/contexts and the
real `start.sh --no-browser --port 0` launcher. Six representative complete
B/L/P × 80/300-ms games pass independent replay: 360 placements, 63 forced passes
and 213 applied computer replies. Live coaching checks 45 first/late alternative
scores against native, and verifies every continuation's legality and horizon.
The numerical suite separately verifies PV optimality. Fixed D3 replies pass for
B/L/P, as do game review/replay, undo/restart, rapid model/depth changes,
obsolete-computation cancellation, injected worker-error/reload recovery, and
current manifest/network/artifact identity after reload.

Separate existing Chrome procedures pass two B/P full games and reviews, normal
B/L/P coaching, load-failure fallback/refusal, ABI-mismatch recovery, custom JS
training/export/persistence, one full custom game and review. This is a bounded
UI smoke test using disposable custom weights; frozen models remain untouched.
The production UI requests the new generated module directly and never requests
ignored experimental paths. Browser-fetched Wasm SHA-256 matches the manifest.

There are no page exceptions or unexpected console errors. The existing missing
`/favicon.ico` produces one browser 404, recorded explicitly and excluded only
by that exact URL/status. The first console-gate attempt exposed that preexisting
resource request; the full final six-game run was repeated with the precise
classification. No application source was changed to suppress it.

All observed live Wasm buffers remain **32 MiB**. Chrome's summed process RSS
samples are about 1,211 → 1,226 MiB over the six games; summed RSS is not unique
physical allocation. This small finite change does not establish a memory leak
or leak-freedom. The historical module-reinitialization RSS limitation remains;
no large accumulating linear-memory allocation is observed.

**Safari 27.2 passes:** actual native WebDriver checks 823 numerical comparisons
with maximum error zero, 20 module reinitializations, ten worker restarts,
bounded memory, independent deep endings and failure/ABI checks. Six complete
B/L/P × 80/300-ms games through `start.sh` pass independent replay, 44 live
coaching-score checks, fixed D3 replies for B/L/P, game review/replay,
undo/restart, rapid model/depth cancellation, custom JS/export/persistence,
worker-error recovery and current build identity after reload. There are no
observed page exceptions or captured console errors; all live Wasm buffers
remain 32 MiB. The run takes 43.32 seconds.

The initial UI attempts exposed a locked macOS desktop: real pointer clicks were
not delivered and screenshots were black, despite passing numerical checks.
The user unlocked the desktop, and the entire final Safari run passed using
real WebDriver clicks and keyboard actions. No synthetic DOM-click workaround,
security preference change or reduced acceptance gate was used.

The public audit independently replays **all twelve new Chrome/Safari games**:
720 placements, 114 forced passes, 420 applied replies and 51 small exact checks.
It verifies source/artifact identities, all 180 native fixed build blocks and
70 Wasm comparison pairs. Run `python scripts/fast-flips/production-evidence.py`
without an SDK, browser or private research directory to reproduce that audit.

## Resources, log and limits

Startup: about 85.6% CPU idle, normal memory pressure, allocated swap 0.38 MiB,
about 552 GiB free disk. No competing Reversi research run is present. Resource
snapshots accompany benchmark blocks and browser acceptance; expensive performance
work is serial. The benchmark ledger charges **209.28 seconds (3.49 minutes)**,
including the discarded pilot and production-worker/UI comparison. The separate
brief follow-up smoke benchmark adds less than a few seconds. There is no
hardware profiling, Processor Trace, SDK installation, ordinary-profile change,
application termination or saved system/security setting change.

Concise log: audit identities/resources → pass 182 pre-tests → preserve old
Wasm → integrate qualified history on a separate branch → build production twice
identically → pass native/Wasm/sanitizer/Python checks → accept native and actual
production-Wasm confirmation panels → pass Chrome games/recovery/custom checks →
resolve locked desktop and pass actual Safari UI → independently audit all twelve
games and compact evidence → final diff/packaging audit → publish after all gates.

Limits: this is M4 acceptance, not an Intel Mac or post-merge Windows runtime
claim. The PC already qualified the exact source under GCC 15; the commands below
finish packaging/launcher checks there. The historical fixed-panel and desktop
variation limitations remain. The earlier independent P learning/strength
provenance restrictions remain unchanged.

## Reproduction on this Mac

Use the existing project environment and a **fresh ignored output directory**;
preserve completed artifacts and evidence. Production-specific runners are
derived from the original qualified procedures, leaving their hashed historical
runners unchanged. Original build/check runners reconstruct rejected forms for
reproducibility; this task measures only original versus integrated production.
Production runners default to the production output directory. That housekeeping
change followed acceptance, whose commands already set the same explicit output
paths. The Safari receipt retains its measured script hash; the public audit
reconstructs and verifies the sole fallback-directory literal change. No executed
UI path, test assertion, engine or timing code changed.

```bash
source .venv/bin/activate
npm test
# Save src/wasm/manifest.js and its two old artifacts before replacing them.
npm run wasm:build
# Copy manifest/artifacts to ignored storage, repeat, compare all three files.
npm run wasm:build
node scripts/fast-flips/verify-production.mjs
node scripts/wasm/internals.mjs
NATIVE_SANITIZE=1 node --test --test-concurrency=1 tests/native-search.test.mjs tests/native-v2.test.mjs tests/mac-endgame.test.mjs
python -m unittest discover -s tests -p 'test_*.py'
```

The completed run uses `REVERSI_FLIP_RUN=.local-research/fast-flips-production-20261031`;
its old manifest/artifacts are required for the browser comparison. Subsequent
reproduction must extract the pre-flip distribution from `1058f01` into its own
ignored run directory, not compare the current build against itself.

```bash
export REVERSI_FLIP_RUN=.local-research/fast-flips-production-new
node scripts/fast-flips/build.mjs
FLIP_SELECTED_TAG=production node scripts/fast-flips/selected-build.mjs
FLIP_TAGS=original,production node scripts/fast-flips/qualify.mjs
FLIP_SELECTED_TAG=production FLIP_WASM_PRODUCTION=1 node scripts/fast-flips/production-wasm-qualify.mjs
FLIP_TAGS=original,production FLIP_REPS=5 python scripts/fast-flips/run.py integrated-final python scripts/fast-flips/integrated.py
node scripts/fast-flips/verify-timed.mjs
CXX=c++ python scripts/fast-flips/pc-verify-exact.py
FLIP_WASM_PRODUCTION=1 python scripts/fast-flips/run.py production-wasm-browser python scripts/fast-flips/production-browser.py
REVERSI_BROWSER_CHANNEL=chrome REVERSI_WASM_OUTPUT="$REVERSI_FLIP_RUN" python scripts/wasm/fast-flips-production-acceptance.py
REVERSI_BROWSER_CHANNEL=chrome REVERSI_WASM_OUTPUT="$REVERSI_FLIP_RUN" python tests/wasm_browser_check.py
REVERSI_BROWSER_CHANNEL=chrome python tests/browser_check.py
REVERSI_SAFARI_SHORT=1 REVERSI_SAFARI_OUTPUT="$REVERSI_FLIP_RUN/safari" python scripts/mac/fast-flips-production-safari.py
```

## Short PC follow-up (not performed on this Mac)

Keep local PC work intact; stop if switching/pulling would overwrite it. Use the
already qualified Ubuntu/GCC 15/Python environment, without installing a new SDK
or repeating the optimization campaign.

```bash
cd ~/git/reversi
git status --short --branch
git fetch origin
git switch main
git pull --ff-only origin main
git rev-parse HEAD
printf '%s  %s\n' b97d526697e68aa04186b67d2e13dc0f4eab21fb086921532e8b9b63cf47e7a5 native/engine.cpp | sha256sum -c -
source .venv/bin/activate
export CXX=g++
unset NATIVE_CPU
npm run native:build
node --test --test-concurrency=1 tests/rules.test.mjs tests/native-search.test.mjs tests/wasm-engine.test.mjs tests/fast-flips.test.mjs
node scripts/fast-flips/verify-production.mjs
node scripts/fast-flips/production-smoke.mjs > .local-research/pc-production-smoke.json
REVERSI_WINDOWS_BROWSER=1 REVERSI_WINDOWS_CHANNEL=edge python scripts/fast-flips/packaged-browser-check.py
./start.sh --port 0
```

Use `chrome` instead of `edge` for actual Windows Chrome. The browser helper
creates/cleans a temporary Windows profile and checks B/L/P coaching, a timed
reply, reload and the packaged identity/hash. The smoke benchmark has one full
warmup and three fixed mixed48 batches per B/P, checking published scores/nodes
and reporting core/CPU/outer elapsed times. Verify that the last launcher command
opens the Windows default browser at its printed URL; stop it with Ctrl+C.
No full PC campaign or Wasm rebuild is needed.

## Publication

After all gates and the complete diff pass, stage only the named production docs,
compact evidence, acceptance runners, request ledger and generated distribution.
No native binary, trace, SDK, venv, browser profile or raw bulk output is staged.
The final commit SHA and matching remote SHA are returned after publication,
avoiding a self-referential report hash. Actual publication commands:

```bash
git commit -m 'Promote qualified fast flips and rebuild production Wasm'
git switch main
git merge --ff-only integrate/fast-flips-production
git push origin main
git fetch origin main
git rev-parse HEAD origin/main
git ls-remote origin refs/heads/main refs/heads/perf/fast-flips
git status --short --branch
```
