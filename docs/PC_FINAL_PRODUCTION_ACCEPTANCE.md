# Final Windows PC production acceptance

**PASS, 2026-10-31. CPU-dispatch and branchless-flipping production integration
is complete.** All runtime gates below passed. Publication SHA is returned after
push/remote verification, avoiding a self-referential document hash.

[Compact receipt](data/pc-final-production-acceptance/receipt.json) contains exact
identities, commands/counts, smoke rows, counter comparisons, browser/PV evidence,
launcher results and helper hashes. Raw logs, profiles and native binaries are
excluded from Git; local evidence is in
`.local-research/pc-final-production-20261031`.

## Checkout, environment and identities

Initial checkout was clean on `perf/runtime-cpu-branchless-probe` at
`911ce40096a869a684b21496f2c3060cd316fada`; local main was `6b480ed1…`.
`git fetch origin main`, `git switch main`, `git merge --ff-only origin/main`
safely advanced main to **`e955e992708b7138b5c0f704451e17e3dee4484a`**.
A second fetch confirmed the same local/remote production SHA. The expected PC
history is its ancestor; the M4 integration adds the new qualified Wasm package.
Existing branches, the single worktree, research evidence and historical reports
were preserved. No production code, existing test or instruction-selection rule
was changed during acceptance.

Actual Windows 11 Home 10.0.26300, i7-14700F; Ubuntu 26.04.1 LTS under WSL2
6.18.33.2-microsoft-standard-WSL2. GCC **15.2.0-16ubuntu1**, project Python
**3.14.4**, Node **24.16.0**. About 6.4 GiB guest RAM available, 1 MiB used swap,
884 GiB free disk, load 0.06/0.05/0.09. Windows had about 4.65 GiB free physical
RAM; sampled background CPU was low (largest: Task Manager, 0.188 CPU seconds in
two seconds). No competing research computation, installation or system setting
change. Demanding work ran serially; no profiling, training or optimization run.

Native build fingerprint:
`a7ba82955b15a46436dd1a9bef66bfd5741d4cbf253756cb3075f07db09c158f`.
CLI SHA-256:
`09d0df1c895466768b986696cdf5300ff8a208b5d82ffe5cab03e6ae880a34db`.
It is byte-identical to the qualified PC branchless executable. An isolated fresh
production rebuild also reproduces this hash. Strict FP and original generic
tuning remain intact. Auto reports **`x86-popcnt-bmi1-bmi2-lzcnt`**; forcing
portable reports **`portable`**. Both report POPCNT/BMI1/BMI2/LZCNT available,
the same frozen B/L/P identities and one **10,485,760-byte TT** per engine.
Baseline object inspection finds no required enhanced or AVX-family instruction;
its hash also matches the qualified portable object. Guarded CPU selection and
shared single-definition geometry/frozen tables are unchanged. Older physical
x86 hardware was not tested; the existing static-contract limitation remains.

Production Wasm fingerprint:
`934b888ad89f8d754d1ace6acfcd3cd84b6b48e948431916153d5d29c5f2b223`.
Fetched Wasm SHA-256:
`7a9d43dd937af75999d5db11b018bd98a1d87eb655bbf05053957993dec0c9d0`.
The provenance verifier confirms current source/include hashes, ABI, geometry,
unchanged compiler/memory options, all frozen B/L/P identities and coefficients.
The M4-built module and manifest were neither changed nor rebuilt on the PC.

## Tests and brief native smoke

Commands below returned zero, using the activated project venv and
`CXX=g++ NATIVE_CPU=dispatch`:

```bash
unset REVERSI_CPU_BACKEND
npm run native:build
node --test --test-concurrency=1 tests/rules.test.mjs tests/native-search.test.mjs tests/runtime-cpu-dispatch.test.mjs tests/wasm-engine.test.mjs tests/mac-endgame.test.mjs
node scripts/runtime-cpu-mac/verify-production.mjs
REVERSI_CPU_BACKEND=portable node --test --test-concurrency=1 tests/native-search.test.mjs tests/mac-endgame.test.mjs
node scripts/fast-flips/production-smoke.mjs
REVERSI_CPU_BACKEND=portable node scripts/fast-flips/production-smoke.mjs
node scripts/windows-pc/production-counters.mjs
```

Prescribed suite: **25/25**, no skips. Forced-portable native/endgame:
**12/12**, no skips. These exercise rules, independent mailbox flips, B/L/P
searches, exact endgames/passes/terminal empties, coaching/PVs, TT collisions and
generation/state isolation, and completed-depth/cancellation semantics.

The counter audit compares **288** B/L/P searches across both backends with the
qualified mixed48 references: scores, moves, depth, exactness and all twelve
CLI-exposed counters agree. It matches the reference driver's separate engine
per model and two full warmup batches. An initial comparison against a cold TT
correctly exposed different hit counts; that invalid collection setup was
corrected without changing production behavior or removing counter assertions.
The prescribed dispatch state regression separately compares all thirteen
internal counters, PVs and deterministic interruptions between backends.

The established smoke uses the unchanged hashed mixed48 corpus, one complete
warmup and three B/P batches. Mean milliseconds per 48-root batch:

| Backend/model | Core wall | CPU | Including IPC | Nodes | Evaluations |
| --- | ---: | ---: | ---: | ---: | ---: |
| Auto B | 93.315 | 93.321 | 101.125 | 1,780,838 | 841,839 |
| Auto P | 157.867 | 157.870 | 164.881 | 2,578,323 | 1,438,599 |
| Portable B | 105.721 | 105.724 | 114.373 | 1,780,838 | 841,839 |
| Portable P | 171.988 | 171.995 | 179.728 | 2,578,323 | 1,438,599 |

Scores, moves, exactness, nodes and evaluations match the prescribed references.
No major regression was observed. The preceding same-harness production smoke
recorded portable B/P core means 114.860/187.325 ms. Against the later tight-loop
PC campaign means, this smoke is about 3.5% slower in auto and 2.7–7.7% in
fallback; those are different timing boundaries/warmup schedules and unpaired
runs. They do not establish a new regression or speedup. Native bytes are
identical to the qualified candidate; this short check is not a precision timing
study and cannot exclude small desktop/runtime variation.

## Actual Windows browsers and normal launcher

The existing prescribed `packaged-browser-check.py` passes on actual Windows
**Edge 156.0.4314.58** and **Chrome 156.0.8078.48**. A short extension reuses its
Windows/CDP helper, existing worker observer and independent mailbox reference:

```bash
export REVERSI_WINDOWS_BROWSER=1
export REVERSI_PC_FINAL_OUTPUT=.local-research/pc-final-production-20261031
REVERSI_WINDOWS_CHANNEL=edge python scripts/fast-flips/packaged-browser-check.py
REVERSI_WINDOWS_CHANNEL=chrome python scripts/fast-flips/packaged-browser-check.py
REVERSI_WINDOWS_CHANNEL=edge python scripts/windows-pc/production-acceptance.py
REVERSI_WINDOWS_CHANNEL=chrome python scripts/windows-pc/production-acceptance.py
./start.sh --port 0
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$(wslpath -w scripts/windows-pc/launcher-ui.ps1)" -Url http://127.0.0.1:42501/
# Ctrl+C in the launcher terminal.
```

The URL above is this run's OS-assigned port; use the newly printed URL on rerun.
Both disposable-browser sessions verify actual fetched binary hash/current
manifest, unchanged B/L/P identities, all twelve opening coaching alternatives
and **36 PV placements per browser**, native full-window values, an **80-ms**
P reply with verified completed-depth score/chosen move, model switching,
reload/persistence, and cancellation/restart of pending analysis and computer
workers. Worker counts rise 4→7 with three terminations; canceled work cannot
populate the new game's history. Requests use the new committed artifact, with
no old or experimental module path. No unexpected page/console errors occur.
The pre-existing `/favicon.ico` 404 is explicitly retained as a cosmetic warning.
All disposable profiles are removed and their owned processes exit.

The actual normal launcher opens **Windows default Edge**, independently of
those disposable sessions. Windows UI Automation verifies the 64-cell board,
B/L/P coaching with equal-depth text, model controls and a P reply: D3→C5,
depth 12, 965,632 nodes, 80.3 ms. The original ordinary-profile evaluator/time
preferences are restored. The helper reads rendered text where Chromium omits
paragraph DOM IDs and activates the focused grid cell with Enter; initial UIA
collector attempts were excluded, with no application/test behavior changed.
Only the URL-verified test window is closed. Ctrl+C returns server exit **0**;
port **42501** is closed. Final checks find no owned browser, native client,
proxy or server process. The user's unrelated Chrome window remains untouched.

## Final answers

1. **Current main present?** Yes: expected `e955e99…` safely fast-forwarded and verified.
2. **Automatic enhanced selection?** Yes, with all four required detected features.
3. **Forced portable passes?** Yes, tests, smoke, counter audit and ISA checks.
4. **B/L/P results/counters unchanged?** Yes, including PVs and interruption/state semantics.
5. **New Wasm in Windows Edge/Chrome?** Yes, actual fetched hash and all prescribed UI checks pass.
6. **Normal launch/shutdown clean?** Yes, default Edge interaction and Ctrl+C/port/process checks pass.
7. **Meaningful performance regression?** None found; no new performance claim is made.
8. **Qualified work on main?** Acceptance docs, helpers and compact evidence are published with a normal fast-forward-safe push; final remote SHA is returned after verification.
9. **Remaining technical issues?** No integration blocker. Existing favicon warning and absence of older-CPU hardware testing are disclosed limitations.

Publication: `git diff --check`, `git add USER_REQUESTS.md
docs/PC_FINAL_PRODUCTION_ACCEPTANCE.md docs/data/pc-final-production-acceptance
scripts/windows-pc/production-acceptance.py scripts/windows-pc/production-counters.mjs
scripts/windows-pc/launcher-ui.ps1`, `git commit -m 'Accept final Windows production CPU dispatch and Wasm integration'`,
`git push origin main`, `git ls-remote origin refs/heads/main`.
