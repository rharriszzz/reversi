# Safari 27.2 qualification on the M4

**Passed.** Actual installed Safari **27.2**, macOS **27.2 / 26B123**, on the
24 GiB M4 iMac runs the frozen current-source Wasm engine correctly. This is
Apple's native `/usr/bin/safaridriver`, not Playwright's WebKit port. The user
enabled Safari automation before this follow-up; the test runner changes no
Safari/security preferences and closes only its own automation sessions.

The engine, frozen B/L/P evaluators, native build and Wasm distribution remain
unchanged from `c0412ec6d9a1391f10f04fa6caf788736f3dfb76`. No compilation,
optimization, evaluator promotion or strength campaign was needed. The earlier
[Mac report](MAC_NATIVE_WASM_OPTIMIZATION_RESULTS.md) records that Safari was
blocked at its original checkpoint; this follow-up resolves that limitation for
this Safari/M4 combination. Intel Macs, iOS Safari and other browser versions
are not newly qualified.

## Numerical and functional results

| Actual Safari check | Result |
| --- | --- |
| Native/Wasm numerical comparisons | **823 passed**, maximum absolute error **0**, tolerance 1e-10 |
| B/L/P static queries | 312, including representative roots and 96 seeded arbitrary occupancies |
| Full-window alternative scores | 141, all at the same placement horizon |
| Independently legal PV placements | 423; subsequent reply values checked against full-window native values |
| Deep exact alternatives | 45, across all B/L/P and preserved independent 15/16-empty references |
| Special terminal/pass/horizon comparisons | 36, including full boards at depth zero, terminal unused squares and two-empty shallow horizons |
| Tiny-TT collision comparison | Same fixed value as native with TT disabled |
| Deterministic interruption | Last completed iteration retained; legal null-score fallback explicitly checked |
| Wrong ABI / wrong model / closed handle | Rejected, followed by successful recovery |
| Close/reinitialize | 20 cycles, each retaining 32 MiB linear memory |
| Actual worker termination/recreation | 10 cycles, each followed by a successful timed search |

Static features and every returned legal child match native; an independent
mailbox implementation separately verifies legal moves and flips. Exact deep
values use preserved independent references; native equality alone is not
presented as an independent game-theoretic oracle. Frozen model identities and
actual module/build identity are checked before testing. No numerical discrepancy
is waived or rounded away.

## Actual application acceptance

The final clean application run completes **16 games**, balanced across B/P,
80/300 ms and both human colors: two games per eight-way cell, using predetermined
seeds `0x53414600` through `0x5341460f`. These are engineering acceptance games
against seeded legal human choices, not evaluator strength observations.

- **955 placements, 148 forced passes and 555 computer replies** independently
  replay correctly through terminal boards, including actual unplayed squares.
- **121 coaching alternative scores** match native at selected first/late roots.
  Every inspected continuation respects independent legal moves, passes and depth.
- A separate public audit uses coordinate-based rules, distinct from the live
  mailbox replay, and checks **68 small exact computer-search results**.
- There are **zero page errors and zero depth-zero fallbacks** in these games.
  Maximum completed depth is **20**; every live engine reports **32 MiB** linear
  memory against its unchanged 128 MiB configured ceiling.

The application games take **97.8 seconds**; the complete numerical/application/
recovery pass takes **103.6 seconds**. These are qualification timings, not a
controlled Safari-versus-Chrome performance ranking. Reported maximum core
overrun is zero at Safari's observed timer granularity; it is not a hard
real-time guarantee or evidence that Safari has finer deadline precision.

Actual UI checks pass alternative selection, comparison, Enter keyboard actions,
historical analysis, undo/replay, four rapid model/depth/new-game changes,
worker cancellation/recreation, model preference reload and cached-page recovery.
Selected complete frozen games also pass model-consistent post-game review.
A test-only loopback server injects actual Wasm-load failure and a wrong manifest
ABI: B falls back visibly to JavaScript, P refuses substitution, custom selection
recovers, and normal reload restores P/Wasm. Production files are never modified
for these injected faults. Served Wasm MIME is `application/wasm`.

A separate disposable custom-weight smoke passes one bounded UI training attempt,
a **complete 60-placement custom JavaScript game**, two forced passes, 31 applied
computer replies and post-game mistake review/historical replay. Custom export's
actual JSON Blob, download-link construction and exact localStorage persistence
across reload also pass. No frozen coefficients change. Safari disk-download
behavior is **not** claimed: the test captures the Blob/link without writing into
the user's Downloads folder or changing download preferences. Screenshots of
actual Safari rendering and custom review were inspected and remain local.

## Harness findings and limits

The new WebDriver adapter needed three test-only corrections: Safari's
`Error.stack` omits its error message, so bridges preserve both; WebDriver rejected
a `tr` container click, so real pointer clicks target the cell and Enter uses
WebDriver keyboard actions; and replay range controls dispatch `input` rather
than `change`. No application or engine correction was required. A preceding
16-game pass had already replayed successfully before its later UI adapter
interaction failed. Its logs/data remain local; the final clean run above is
reported separately, without selecting games based on their outcomes.

Resources remain normal: cache-headroom estimates are about **7.96 GiB before /
8.19 GiB after** the accepted run, with unchanged **0.38 MiB** allocated swap and
zero observed swap-output delta. The estimate is not an exact OS MemAvailable
measurement. This finite Safari check establishes bounded live linear memory,
not universal heap/RSS leak-freedom. Earlier Chrome allocation/retention and
cross-platform limitations remain in the main report.

Fast correctness passes **7 tests before** the test additions; the complete
Node suite passes **172 tests afterward**, with no skips. Existing public Mac
replay and registered statistical audits still pass. Native/shared source,
production JavaScript and every Wasm artifact remain byte-identical to the
published engine. No Python 3.13 policy, Python 3.14.10 selection, package,
ordinary user browser profile or system setting is changed.

## Evidence and reproduction

[Complete certificate and replayable games](data/safari-qualification-20261030.json)
include actual Safari capabilities, Python executable/version, native receipt,
all model/source/build/artifact identities, negative/lifecycle checks, resources,
custom smoke and named-column telemetry. [Public verification](data/safari-public-verification-20261030.json)
replays all seventeen final games without needing Safari or private files.
Raw screenshots, browser logs and incomplete harness attempts stay ignored.

Qualified Wasm build:
`01ae1b4aec535cf2a2b431d0d4fe3d1b8e76c60b021cc80cf507bcd5f462bc2d`.
Wasm SHA-256:
`924de12404edc637789ed705575c2b274070198666af5767157dd12d0de75150`.
Native build fingerprint:
`65370a665d28b3286009ae1dd7194eb868ec32438eb00a3e62296a91150cc5d1`.

With Safari automation already enabled by the user:

```bash
cd ~/git/reversi
source .venv/bin/activate
node scripts/native/build.mjs
python scripts/mac/safari-qualification.py
python scripts/mac/safari-custom.py
npm test
python scripts/mac/verify-safari.py --publish
# Public evidence only, no browser or SDK needed:
python scripts/mac/verify-safari.py
```

Outputs use ignored `.local-research/safari-qualification-20261030`; archive
completed local outputs before intentionally rerunning. No Selenium or additional
package installation is required. Existing larger M4 results remain intact.
The publication commands are
`git commit -m 'Qualify Safari 27.2 native Wasm parity and browser acceptance'`,
`git push origin main`, `git rev-parse HEAD`, and
`git ls-remote origin refs/heads/main`. The exact publication SHA is reported
after push to avoid a self-referential commit hash in this document.
