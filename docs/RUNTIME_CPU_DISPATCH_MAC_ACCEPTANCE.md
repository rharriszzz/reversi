# Runtime CPU dispatch — M4 qualification and production acceptance

The selected PC implementation passes M4 native, reproducible Wasm packaging and
actual Chrome/Safari acceptance. Retain the unsigned-mask source with original
generic tuning. M4 native complete-search performance is effectively equivalent
to preceding production on the measured panels. No Mac-specific adjustment,
compiler sweep, evaluator experiment or training run was introduced.

[Compact evidence](data/runtime-cpu-mac/manifest.json),
[builds/provenance](data/runtime-cpu-mac/builds.json),
[correctness](data/runtime-cpu-mac/qualification.json),
[paired statistics](data/runtime-cpu-mac/summary.json),
[actual browsers](data/runtime-cpu-mac/browsers.json),
[reproduction](../scripts/runtime-cpu-mac/README.md).

## History, isolation and actual environment

Initial local `main` was clean at
`e7b79b9510278b815606c47b667ddeff396e289b`. Fetch found exactly the expected remote
`main`, `6b480ed1bc6ddcdde2fdb37872c0ca8d0a804425`, and selected PC branch
`perf/runtime-cpu-branchless-probe`,
`911ce40096a869a684b21496f2c3060cd316fada`. The one newer production commit is the
completed Windows follow-up; it changes only the request ledger and acceptance
records. No unexpected newer history appeared. The original checkout, branches,
worktrees and ignored research data were preserved. Acceptance uses the separate
`/Users/rharris/git/reversi-runtime-cpu-mac` worktree on
`integrate/runtime-cpu-mac`, descended from the complete qualified PC history.

Actual hardware: iMac Mac16,3, Apple M4, ten cores (four performance/six
efficiency), 24 GiB RAM. macOS 27.2 (26B123), Darwin 27.2.0; Xcode 27.2 (27B52),
Apple Clang 21.0.0 (clang-2100.4.1.1). Existing project Python **3.14.10** is
`/Users/rharris/git/reversi/.venv/bin/python`, explicitly selected through
`REVERSI_PYTHON` in the separate worktree; its base is the existing user-scoped
CPython installation. Node **24.22.1**, npm **11.21.0**. Existing
`~/.local/share/reversi-emsdk` is Emscripten **4.0.22**, compiler revision
`0f3d2e62bccf8e14497ff19e05a1202c51eb0c65`; compiler subprocesses use that selected
Python. Nothing was installed and no system/power/security setting changed.

Startup: approximately 558 GiB free disk, 78.8% aggregate CPU idle, normal memory
pressure, 0.38 MiB swap used. Ordinary desktop/background XProtect activity was
present; no competing Reversi research computation was found. No other app was
closed. Demanding suites, builds and measurements ran serially.

## Ordinary native and independent correctness

Both old production and selected source are compiled with Apple Clang using
`-O3 -std=c++17 -Wall -Wextra -Wpedantic -ffp-contract=off -fno-fast-math`, without
host tuning, LTO or dispatch definitions. Each matching header compiles the same
fixed-work driver separately: the refactor changes private Engine layout, so an
old-header driver is not linked against the new object. Frozen coefficient
headers compare identically. Performance executables have no sanitizers/profiler.

The ordinary path compiles `engine.cpp` alone; it includes `engine-impl.inc` and
`engine-tables.hpp`. `engine-enhanced.cpp` is excluded. ARM64 preprocessing has
no `__builtin_cpu_init`/`__builtin_cpu_supports`; the linked executable has no
enhanced-backend/CPU-detector symbols. No x86 flag or intrinsic enters this build.

| Gate | Verified result |
| --- | --- |
| Initial full serial Node suite | 182 pass, 0 fail; one Linux x86 dispatch test correctly skipped on ARM64 |
| Final full serial Node suite, actual new distribution | 182 pass, 0 fail; same one platform skip |
| Python 3.14 suite | 46 pass |
| ASan/UBSan native search, V2 and tiny-endgame suites | 16/16 groups pass, including final run with new Wasm |
| Independent exhaustive/random/legal-history flip harness | 1,258,311 cases pass, ordinary and ASan/UBSan builds |
| Old/new native against independent mailbox/minimax | 221 boards, 7,956 root queries, 4,908 child comparisons; no mismatch |
| Native coaching/verified PVs | 732 D3 rows, 2,196 PV placements, 126 additional D6 rows/PVs |
| Independent completed-horizon/native interruption | 270 node-stop/fallback publications pass |
| Cross-source deterministic interruptions on reused one-entry TT | 270 queries; every deterministic result field/counter agrees through evaluator/depth changes |
| Actual native 80/300-ms publications | 216 agree with complete old-production root/chosen-child searches at their published horizons |
| Independent exact mailbox solver | All twelve 8–12-empty panel roots plus separate D12 root, both builds and all B/L/P models |
| Actual new Wasm/native/mailbox/minimax | 1,236 static queries, 3,708 searches, 303 coaching rows, 909 PV placements; maximum numerical error **0** |
| Actual Wasm standalone internal assertions | Pattern encoding/sums, TT rollover/bounds, full-window analysis, interruption and natural-depth assertions pass |

Existing rules/native/Wasm suites exercise one/two empties, passes that retain
placement depth, terminal empties, depth 15/16/64, narrow/full windows, TT
collisions/replacement/generations, horizon/model isolation, deterministic ties,
repeated handles/objects and completed-iteration publication. Every fixed-work
result and all thirteen deterministic native search/TT counters match across
old/new native builds. All exposed actual-Wasm counters also agree across the
old/new modules and new native path. All 63 double weights and 21,870 stored Float32
pattern cells retain their frozen identities. No score or counter discrepancy
required a change. Existing Python HTTPError/subprocess ResourceWarnings remain
visible in the logs; they are not numerical failures, and owned test children
finish before performance work or publication.

## M4 complete-search performance

The corpus remains the ordered 48-root file, SHA-256
`a8deadc89f811e02da19910a702b073de12707ef19895a10f7d9861d088dcfee`.
Exact12 is twelve distinct **8–12-empty** roots, not twelve D12 roots. The
separate disclosed profile root is D12. Opening/middle/coaching have 4/6/2 roots;
coaching is full-window D6 with verified continuations. Identical models,
positions, horizons and flags are used. The original algorithm is compared with
the selected source/refactor together, not an isolated estimate of one mask.

Each block has two complete warmup batches and repeat counts calibrated to about
350 ms of original work. Seven matched trials rotate/reverse build and workload
order, using fresh processes per block. Times below are means per complete panel
batch in milliseconds; thread CPU is measured independently from process CPU.
Full wall/thread/process trials, SD/CV/ranges, node/evaluation/TT counts and root
signatures remain in the compact evidence. Effects are geometric means of paired
elapsed ratios, with two-sided Student-t 95% intervals on seven log ratios
(df=6). These intervals describe ordinary desktop variation on fixed engineering
panels, without multiplicity correction or a population/playing-strength claim.

| Panel/model | Wall ms old → new | Thread CPU ms old → new | Elapsed change [95%] |
| --- | ---: | ---: | ---: |
| mixed48-B | 61.549 → 62.055 | 61.543 → 62.048 | +0.82% [-0.04, +1.70] |
| exact12-B | 13.609 → 13.638 | 13.608 → 13.637 | +0.21% [-0.75, +1.19] |
| profile-root-B | 2.088 → 2.071 | 2.088 → 2.071 | -0.82% [-1.92, +0.30] |
| opening-B | 28.722 → 28.899 | 28.720 → 28.896 | +0.62% [-0.25, +1.49] |
| middle-B | 8.139 → 8.103 | 8.138 → 8.102 | -0.44% [-1.04, +0.16] |
| coaching-B | 6.101 → 6.075 | 6.100 → 6.074 | -0.42% [-1.16, +0.32] |
| mixed48-L | 70.855 → 71.216 | 70.847 → 71.209 | +0.51% [-0.00, +1.02] |
| exact12-L | 13.677 → 13.699 | 13.676 → 13.698 | +0.17% [-0.79, +1.14] |
| profile-root-L | 2.091 → 2.095 | 2.091 → 2.094 | +0.16% [-0.99, +1.33] |
| opening-L | 33.628 → 33.753 | 33.625 → 33.749 | +0.37% [-0.51, +1.25] |
| middle-L | 10.557 → 10.586 | 10.556 → 10.585 | +0.27% [-0.24, +0.79] |
| coaching-L | 7.572 → 7.567 | 7.571 → 7.566 | -0.06% [-0.90, +0.78] |
| mixed48-P | 99.893 → 100.644 | 99.881 → 100.632 | +0.75% [-0.09, +1.59] |
| exact12-P | 13.636 → 13.670 | 13.635 → 13.669 | +0.25% [-0.36, +0.85] |
| profile-root-P | 2.085 → 2.088 | 2.085 → 2.088 | +0.16% [-0.51, +0.84] |
| opening-P | 56.970 → 57.372 | 56.964 → 57.366 | +0.71% [-0.03, +1.45] |
| middle-P | 15.628 → 15.612 | 15.627 → 15.611 | -0.10% [-0.69, +0.49] |
| coaching-P | 9.656 → 9.677 | 9.655 → 9.677 | +0.22% [-0.33, +0.77] |

All 18 native intervals include zero. Exact12 point changes are about +0.2%;
mixed48 +0.5–0.8%. New wall-time CVs are about 0.5–1.3%. This supports effectively
equivalent native execution on these panels, not proof of universal equivalence.
No substantial regression justifies ARM assembly investigation or a Mac-specific
compile-time adjustment. None was tried or rejected. The fixed exact batch still
visits 551,969 nodes and zero static evaluations; the mixed B/L/P batches retain
1,780,838 / 2,018,500 / 2,578,323 nodes and 841,839 / 1,023,170 / 1,438,599 static
evaluations. This is not a new playing-strength experiment.

The PC improvements remain the separate qualified comparison: branchless source
versus preceding dispatch saves exact12 **13.26% / 15.51% / 14.28%**, mixed48
**5.64% / 8.46% / 4.52%** B/L/P, including fallback improvements. The additional
Alder Lake tuning is not applied. Historical reconstruction scripts/data retain
rejected variants solely as auditable research history, not active build options.

## Rebuilt distribution, reproducibility and provenance

Before replacement, the committed manifest, JavaScript and Wasm were copied into
the fresh ignored run directory and retained. The original historical verifier
also passed in the preserved original checkout. It remains unchanged and pins
that earlier source; it is not weakened to accept a different implementation.
`node scripts/runtime-cpu-mac/verify-production.mjs` is the independent new-source
gate. It pins all seven provenance files to `911ce40`, hashes both shared include
files, reconstructs the exact fingerprint, hashes artifacts, compares ABI/raw
exports and generated interfaces, verifies frozen coefficients and loads Wasm.
The public evidence audit independently checks identities and replayable results.

Two consecutive builds with the existing Emscripten 4.0.22 and selected Python
produce byte-identical manifests, JavaScript modules and Wasm binaries. The first
outputs are retained separately. No generated reference names a temporary path
or the enhanced x86 backend. Compiler flags, ABI **1**, all six `_rv_*` JS
interfaces and the raw minified Wasm export list match preceding production.
Initial/max linear memory remain **32/128 MiB**, stack **1 MiB**; the default TT
remains **10,485,760 bytes**. No memory or compiler setting changed.

| Identity | SHA-256 / fingerprint |
| --- | --- |
| Previous production fingerprint | `eb25fd26b0e29d8e3ba5d2b0eb865c7658790b7791d8076cf4515235c369549b` |
| Previous Wasm | `a6540b1b9b83d80098fad424bfdf14a71b72e073e2aa972daa03366175a5414e` |
| New fingerprint | `934b888ad89f8d754d1ace6acfcd3cd84b6b48e948431916153d5d29c5f2b223` |
| New manifest | `e7a71fdcda5c85d244a67e706b4ff14374b50d9adaf5d2c8af3d477cc9d64057` |
| `engine-934b888ad89f8d75.mjs` | `95dbaf41ff32dbf04f41d6ff8936f8bf113ffbdbc0beafa2f69f481f00fb72c6` |
| `engine-934b888ad89f8d75.wasm` (378,665 bytes) | `7a9d43dd937af75999d5db11b018bd98a1d87eb655bbf05053957993dec0c9d0` |
| `native/engine.cpp` | `2495c91660133996c79fb9cd06e5f98441136eb12f030b61f89763a527f93ee5` |
| `native/engine-impl.inc` | `c3317e89cc77c4b989b5c9a5a636092eef5b8e078aa58f4d0e9df42d1f1ca266` |
| `native/engine-tables.hpp` | `c9b33d20a084d7200168aa64a5eeffb51572c5ba23f1504b3a655be50dc999e5` |
| Frozen generated header | `1b286ed8371f0a2cd957b06b679e7422b68b3699cb7c8fe7c9f50968d27ceba1` |

B remains `original-production`; L remains
`ecf3fd376c680ced77d0b002ea2efb9fa4385737c4fffff734b901ab2968d97f`; P remains
`de4b84745589b0384ea3639f879e3c98990e802d176298ff8ef54f681520067f`.
The loaded geometry remains 4,096 bytes, SHA-256
`0540f902224a73c794cec44491946155bab64925f3db98227f52c10da11c5774`.
The complete manifest lists the remaining header/boundary/build-script hashes.

## Actual Chrome, Safari and launcher

Chrome **156.0.8078.74** and Safari **27.2** both pass against the new distribution.
Six B/L/P × 80/300-ms games per browser use `start.sh`, real interactions, and
independent mailbox replay: 720 placements, 110 forced passes and 418 applied
computer replies across the twelve games. Chrome checks 45 live coaching scores,
Safari 44; all continuations have independent legal/horizon checks. Both pass
fixed D3 replies for each model, complete-game review/replay, undo/restart,
rapid evaluator/depth changes, worker cancellation/recreation, reload/persistence,
worker-error recovery and current module identities. Additional Chrome integration
runs two B/P games and load-failure/fallback/refusal/ABI-recovery checks.

Safari's genuine WebDriver checks also pass **823 numerical comparisons**, maximum
error zero, 20 module reinitializations, ten worker restarts, one-entry collisions,
independent deep endings and invalid-build checks. Its desktop is unlocked;
meaningful UI checks use actual WebDriver clicks/keys, with no synthetic DOM
click substitute. Test selection changes dispatch normal change events. The
rapid restart check also uses real clicks. No training run was started.

Both browsers hash the actual fetched Wasm and match the manifest, build ID and
model identities after reload. The production UI requests the generated module
in `src/wasm`, never ignored research paths. Page exceptions and unexpected
console errors are absent. The preexisting `/favicon.ico` 404 is retained and
classified by that exact URL/status. Wasm buffers stay **32 MiB**. Chrome summed
process RSS samples are approximately 1,221 → 1,236 MiB across six games; this is
not unique physical allocation or proof of leak-freedom. No accumulating linear
memory allocation is observed; finite restart tests retain the historical
module/RSS limitations.

The actual default-browser launcher is separately verified without
`--no-browser`: `./start.sh --port 0` opens Chrome at the printed URL. Native
accessibility inspection confirms the board, four all-move rows and P WebAssembly
coaching/verified continuation. The HTTP log confirms the new Wasm fetch. Only
the owned test tab is closed; Ctrl+C exits the launcher with status zero, and
its listening socket is verified closed. No WSL2 launcher claim is inferred.

Short matched old/new actual-Wasm worker comparisons have one full warmup per
block, three batches per block and seven alternating pairs. Chrome includes
mixed/exact/opening/middle/coaching for B/L/P; Safari confirms mixed/exact B/L/P.
Batch wall time includes adapter/JSON work. Per-search browser CPU time is not
available; native CPU clocks and Chrome acceptance process accounting are
separately retained. Same fixed results, counters and coaching continuations
match; browser/native coaching defaults differ, so absolute coaching times are
not a matched native-versus-Wasm comparison.

| Browser / panel-model | Wall ms old → new | Elapsed change [95%] |
| --- | ---: | ---: |
| chrome / mixed48-B | 81.743 → 81.881 | +0.18% [-1.14, +1.51] |
| chrome / mixed48-L | 93.352 → 93.371 | +0.02% [-1.44, +1.52] |
| chrome / mixed48-P | 133.410 → 133.724 | +0.24% [-1.39, +1.90] |
| chrome / exact12-B | 17.410 → 17.481 | +0.38% [-2.25, +3.07] |
| chrome / exact12-L | 17.457 → 17.500 | +0.25% [-1.52, +2.05] |
| chrome / exact12-P | 17.252 → 17.333 | +0.47% [-0.68, +1.63] |
| safari / mixed48-B | 79.667 → 76.810 | -3.32% [-9.58, +3.37] |
| safari / mixed48-L | 90.524 → 88.524 | -2.10% [-4.64, +0.51] |
| safari / mixed48-P | 125.857 → 127.333 | +1.10% [-1.88, +4.17] |
| safari / exact12-B | 16.381 → 16.143 | -1.46% [-2.37, -0.54] |
| safari / exact12-L | 16.095 → 16.143 | +0.29% [-1.02, +1.62] |
| safari / exact12-P | 16.238 → 16.190 | -0.29% [-1.01, +0.43] |

There is no established general Wasm speedup. The other Chrome panels have small
point changes; **middle-P +2.00% [+0.58, +3.45]**, about 0.39 ms/batch, and the
borderline middle-L +0.52% [+0.0006, +1.04] are disclosed small unadjusted slowdowns.
Safari exact-B has a small favorable interval; mixed-B is noisy. None establishes
a broad improvement or a substantial application regression. No new optimization
or selective timing rerun was undertaken.

## Resources, portability and integration decision

The durable resource/timing ledger charges **246.23 seconds (4.10 minutes)**:
189.07 native including timed publications, 35.23 Chrome comparison/UI and 21.92
Safari comparison. This is comfortably within the approximately 30-minute
measurement allowance. Correctness/browser acceptance takes additional time.
Memory pressure stays normal, sampled swap stays 0.38 MiB, and no memory
allocation is increased. Owned servers, test profiles/sessions and workers are
closed. Existing apps and research files remain in place.

Intel Mac compatibility is checked by Apple Clang cross-compiling and linking
ordinary x86_64 engine, CLI and browser C ABI dylib with the installed SDK.
**No Intel binary is executed and no Intel hardware runtime is claimed.**
ARM64 preprocessing/symbol checks exclude x86 detection/enhanced code. Linux
x86-64 GCC dispatch source/build selection remains byte-for-byte the PC-qualified
version: original generic tuning, guarded POPCNT/BMI1/BMI2/LZCNT, isolated compiled
backends sharing one Engine/TT and immutable data. Enhanced instructions are
optional, never a requirement of the ordinary native or browser distribution.
No Windows performance campaign is repeated on the Mac.

All acceptance gates pass, including final tests and the independent evidence
audit (252 native build blocks, 105 Chrome pairs, twelve replayed browser games
and 52 independent small exact checks). The integration decision is to promote
by fast-forward after final diff review. `main` must still fast-forward from its
fetched state; stop on unexpected
modifications, remote changes or a failed gate. Only source, scripts/tests, compact
evidence, docs, the verbatim appended request and intentional distributed Wasm
artifacts are committed. Native binaries, cross-compiled objects, SDKs, virtual
environments, profiles and bulk traces stay ignored. The PC branch/history is
preserved and the rejected tuning is not applied to production.

Publication uses the dedicated integration branch and a fast-forward only:

```bash
git commit -m 'Qualify M4 runtime dispatch source and rebuild production Wasm'
git push -u origin integrate/runtime-cpu-mac
git -C /Users/rharris/git/reversi merge --ff-only integrate/runtime-cpu-mac
git -C /Users/rharris/git/reversi push origin main
git fetch origin main
git rev-parse HEAD origin/main
git ls-remote origin refs/heads/main refs/heads/integrate/runtime-cpu-mac refs/heads/perf/runtime-cpu-branchless-probe
```

The final production commit is the commit introducing this report, descended from
`911ce40`; the exact commit and matching fetched/remote SHA are returned after
publication. This report does not attempt to embed its own commit hash. Its
source/artifact identities and independently auditable acceptance are fixed
above. Resolve the publication identity with `git log -1 --format=%H --
docs/RUNTIME_CPU_DISPATCH_MAC_ACCEPTANCE.md`; compare it with `git ls-remote
origin refs/heads/main`.

## Explicit answers and remaining PC check

1. **M4 compile/execute:** yes, ordinary portable Apple Clang path and sanitizers pass.
2. **M4 speed:** effectively equivalent on these fixed panels; no new native speedup claimed.
3. **Exact/deterministic B/L/P:** independent solutions, scores, moves, PVs and counters agree.
4. **Reproducible Wasm:** yes, manifest/JS/Wasm are byte-identical across two builds.
5. **Native/Wasm:** observed maximum error zero (established tolerance 1e-10); deterministic fixed counters agree.
6. **Actual Chrome/Safari:** both pass genuine application and numerical acceptance.
7. **Packaging/provenance:** all hashes, fingerprint, fetched binary, ABI and frozen identities pass.
8. **Linux dispatch/Mac isolation:** preserved; Mac/Wasm exclude the enhanced translation unit and detector.
9. **Promotion:** see the publication decision above and exact verified SHA in the completion response.
10. **Windows follow-up:** pull promoted main, verify the new packaged Wasm in actual Edge and Chrome, rebuild/test automatic and forced-portable dispatch, one brief fixed-work smoke, and normal WSL2 launcher. No compiler/performance campaign.

Use the already qualified PC environment. Stop if switching/pulling would overwrite
local work; use another worktree instead. No SDK or Wasm rebuild is needed.

```bash
cd ~/git/reversi
git status --short --branch
git fetch origin
git switch main
git pull --ff-only origin main
git rev-parse HEAD
source .venv/bin/activate
export CXX=g++ NATIVE_CPU=dispatch
unset REVERSI_CPU_BACKEND
npm run native:build
printf '1 hello\n' | .local-research/native-dispatch/reversi-native
printf '1 hello\n' | REVERSI_CPU_BACKEND=portable .local-research/native-dispatch/reversi-native
node --test --test-concurrency=1 tests/rules.test.mjs tests/native-search.test.mjs tests/runtime-cpu-dispatch.test.mjs tests/wasm-engine.test.mjs tests/mac-endgame.test.mjs
node scripts/runtime-cpu-mac/verify-production.mjs
node scripts/fast-flips/production-smoke.mjs > .local-research/pc-dispatch-production-smoke.json
REVERSI_CPU_BACKEND=portable node scripts/fast-flips/production-smoke.mjs > .local-research/pc-dispatch-fallback-smoke.json
REVERSI_WINDOWS_BROWSER=1 REVERSI_WINDOWS_CHANNEL=edge python scripts/fast-flips/packaged-browser-check.py
REVERSI_WINDOWS_BROWSER=1 REVERSI_WINDOWS_CHANNEL=chrome python scripts/fast-flips/packaged-browser-check.py
./start.sh --port 0
```

Check the automatic native `hello` reports `x86-popcnt-bmi1-bmi2-lzcnt` on the
qualified PC and the forced reply reports `portable`, with the same models and
single TT. Verify the final command opens the Windows default browser; Ctrl+C
must stop its server. These post-promotion Windows checks are not performed on
this Mac. They are short packaging/dispatcher acceptance, not another campaign.
