# Validation status and acceptance checks

Current active Python requirement is **3.13+**; Ubuntu 26.04 qualification uses
Python 3.14.4. See [Python setup](PYTHON_ENVIRONMENT.md). The dated tables below
retain historical results and do not establish current Mac qualification.

Latest [PC-to-Mac handoff](PC_TO_MAC_HANDOFF.md): Ubuntu 26.04.1 / Python 3.14.4 /
GCC 15.2 pass the complete suites, sanitizers and broad native qualification.
Actual Windows Chrome 156.0.8078.48 and Edge 156.0.4314.42 pass numerical and
application acceptance with disposable profiles; Edge also passes custom export
and finite memory/restart checks. Native Windows Python and current Mac Python
3.13+ execution remain separately unqualified in this PC step.

Verified 2026-10-26 local time (2026-10-27 UTC). See [INITIAL_CODEX_REVIEW.md](INITIAL_CODEX_REVIEW.md) for measurements, defects, and limitations.

| Environment | Launcher/HTTP | Browser | Status |
|---|---|---|---|
| WSL2 Ubuntu 22.04.5 x86_64, Python 3.10.12, Node 24.16.0 | Actual shell/Python launch; auto port, spaces, unrelated cwd, Ctrl+C, file logging | Actual Chromium 153.0.8010.12 automated full game and controls | Passed |
| Windows 11 Home 10.0.26300, 64-bit, browser accessing WSL2 localhost | Actual PowerShell default-browser launch returned success | Actual Windows Chrome 155.0.8059.40 headless loaded app, four analyzed moves, verified line | Passed; headless browser check, not a human visual inspection of the default browser |
| Current macOS Apple Silicon | macOS command branch mocked only | No Mac hardware available | **Not physically tested** |
| Current macOS Intel | macOS command branch mocked only | No Mac hardware available | **Not physically tested** |
| Native Windows Python / `.cmd` | Arguments forwarded; not run natively | Not tested through native server | **Not physically tested** |

## Automated correctness checks

Run from the repository root in WSL2 or macOS:

```bash
node --test tests/*.test.mjs
python3 -m unittest discover -s tests -p 'test_*.py'
```

All 40 named JavaScript tests in eleven files and six Python tests pass. Node 24's default process-isolation reporter here counts files; `node --test --test-isolation=none tests/*.test.mjs` exposes the 40 named cases (this extra reporting option is optional and not required by Node 20 users).

Coverage includes opening perft through five placements; independent sentinel-board move generation throughout 20 seeded games; exhaustive six-empty endgames; full-window root scores and continuations against exhaustive same-depth minimax; all eight board symmetries; passes without depth consumption; elimination and terminal positions with empty squares; antisymmetry; fixed-model mistake review; stale analysis/computer responses; computer depth changes; replay/restart; TD determinism; disjoint training/holdout openings and paired benchmark consistency. Python tests exercise actual HTTP 200/404 logs, port fallback, paths with spaces, an unrelated working directory, `--no-browser`, and SIGINT shutdown. macOS `open` and WSL PowerShell command tests are mocks, distinct from actual platform tests.

## Optional actual browser checks

Playwright is only for testing, never needed to play. Use an existing Playwright Python environment, or create a disposable one:

```bash
python3 -m venv /tmp/reversi-browser-env
/tmp/reversi-browser-env/bin/python -m pip install playwright
/tmp/reversi-browser-env/bin/python -m playwright install chromium
/tmp/reversi-browser-env/bin/python tests/browser_check.py --screenshot /tmp/reversi-review.png
```

The check covers human Black/White, computer moves, analysis comparison, Enter-key row selection, undo/replay, rapid depth/restart changes, eight-game training, JSON export, refresh/persistence, a complete game, and post-game review/replay. It asserts no page errors. A temporary localhost server and model storage are isolated to the test browser context. Linux hosts may need browser system libraries; supported desktop WSL/macOS runtimes do not gain a play-time dependency from this optional test.

From WSL2 with Windows Chrome in its standard installation location:

```bash
python3 tests/windows_browser_check.py
```

This exercises the real PowerShell browser-launch route and uses the Windows Chrome debugging interface to verify rendered content and worker analysis through WSL2 localhost. It creates a disposable profile in Windows TEMP, stops only Chrome processes using that profile, and removes it. The default browser window opened by the launcher remains available for manual inspection.

## Manual macOS / Windows-browser acceptance

Repeat on current macOS **Apple Silicon and Intel**; repeat interactive visual checks in the normal Windows browser as well:

```bash
./start.sh
# After stopping with Ctrl+C, exercise the fallback from another directory:
repo="$PWD"
cd /tmp
python3 "$repo/launch.py" --no-browser --port 0 --http-log /tmp/reversi-http.log
```

1. Confirm the default browser opens on ordinary startup (macOS `open`, WSL Windows default browser). For `--no-browser`, open the printed URL manually. Confirm CSS/modules/workers load without console errors.
2. Confirm HTTP requests appear in the printed log file rather than the terminal. Stop with Ctrl+C and confirm the server exits. Repeat from a path containing spaces. With 8000 occupied, confirm startup chooses another port.
3. Play each color; check legal flips, automatic passes, game termination, undo, replay, and responsive layout. Compare any two moves, inspect both replies and continuation facts. Tab to rows and press Enter/Space; check focus remains usable.
4. Change coach/computer depths, restart, undo, and enter replay while analysis is running. Confirm old results never change the new position and the computer waits during replay.
5. Train, export JSON, refresh, and check the saved model/attempt count. Finish a game, run review at a stated depth, and replay a ranked decision.
6. Run both correctness commands above and record OS/browser/CPU versions and any failures. Linux results do not substitute for this Mac check.

## Reproducible experiments

```bash
node scripts/evaluate.mjs 8 2 > /tmp/reversi-evaluation.json
node scripts/benchmark.mjs
node --cpu-prof --cpu-prof-dir=/tmp scripts/benchmark.mjs
```

The experiment prints training/holdout seeds and opening keys, candidate parameters/versions, paired results, search depth, and conservative uncertainty. It never installs an experimental model. JSON and profiler output remain outside Git. The committed review reports the measured run, including inconclusive learning results.

## Evaluation round follow-up

The subsequent three-strategy comparison is recorded in [EVALUATOR_COMPARISON.md](EVALUATOR_COMPARISON.md). New equivalence tests check every fast feature and score throughout 40 independently generated games, custom weights, known-mobility reuse, same-depth nodes/moves and exact endings. Additional tests verify that the optimized stable-edge implementation matches the original candidate and that checkpointed one-pair tournaments alternate color order with their global index. The original evaluator/weights remain a selectable reference. B's implementation is now the search default, with the same values and coaching breakdowns.

The extended evaluation plan is recorded in `CODEX_PROMPT.md`, with measurements and negative results in [EVALUATION_EXPERIMENTS.md](EVALUATION_EXPERIMENTS.md). New correctness coverage checks playing/coaching equal-depth optimum agreement (ties allowed), independent candidate minimax values, pass/terminal playing search, deadline interruption and explicit depth-0 fallback, actual evaluator-call counters, corner-anchored edge stability under every independent continuation of small endgames, interpolation anchors/continuity, symmetries, tactical fixtures, and pair-level game accounting. Browser computer workers now use `play` messages; coaching/review retain `analyze`/`review`.

Actual Chromium acceptance was rerun successfully for this worker change. The Windows Chrome check now also plays D3 and waits for the computer reply and subsequent coaching analysis. Current macOS Apple Silicon and Intel remain physically untested. Evaluation candidates are separate experiments; the browser default evaluator, saved model format, Python server and runtime dependencies remain unchanged.

Run cost benchmarks and time-budget games serially on an otherwise idle machine. Fixed-depth seeds and results are reproducible allowing ties; wall-clock cutoffs and outcomes vary with scheduling. Record completed depths, actual time and overruns, rather than assuming the requested budget was exact. Experiment commands and sample sizes are in the evaluation report.

Current verification: all 40 named JS tests and six Python tests pass for the fast default. Python integration needed execution outside the socket-restricted sandbox; this was an environment permission issue, not an app defect. The actual Chromium 153.0.8010.12 full acceptance check passed, and actual Windows 11 Home 10.0.26300 / Chrome 155.0.8059.40 verified coaching and a computer reply through WSL2 localhost. Mac hardware was unavailable. The standalone comparison graph was rendered and inspected; it shows descriptive quality/cost points and conservative cap-adjusted game intervals. The timed run ended at 724 seconds with 340 games, short of the predeclared 32-pair-per-condition target. No incomplete condition is presented as completed confirmation.

## Autonomous research verification

The offline framework adds eight JavaScript research tests (48 named JS cases total) and four Python acceptance cases (10 Python cases total). The latter exercise a completed integrated smoke, unchanged-source resume, source mismatch refusal without manifest corruption, live lock refusal, SIGTERM recovery with whole pairs, and a detached smoke that outlives its launcher. Python's HTTP cases need local sockets; the socket-restricted sandbox was rerun through the existing approved unittest command prefix. No new permission was requested.

Research tests compare allocation-light legal lists with the independent mailbox oracle through 30 games, check ordering hints against independent same-depth minimax and exact endings, test arbitrary pattern weights under all D4/color transforms, hand-calculate a TD(lambda) terminal update, check deterministic fitting against measured loss, and validate pair-level uncertainty/accounting. The original coaching, rule, endgame and UI-state tests still run. Browser assets and production defaults were not changed in this round; this does not claim new physical Mac or Windows browser acceptance.

See [LOCAL_RESEARCH_SMOKE.md](LOCAL_RESEARCH_SMOKE.md) for the generated compact evidence. A longer 120-second development integration exercised larger datasets, timed games, a bounded exact-label failure and safe budget stopping; it did not finish a strength comparison. The conversation's detached-launch probe was removed by its execution host before reaching a manifest, so an eight-hour hosted run was skipped. Use the documented local command outside that host. macOS Intel/Apple Silicon remain physically untested.

## Completed six-hour-cap study and publication audit

The subsequent WSL host run finished independently in 4 h 26 min with all 19 comparison conditions complete and zero failed tasks. [The final report](LOCAL_RESEARCH_RESULTS_20261027.md) records 1,544 opening pairs / 3,088 tournament games and independent ten-empty references. Production B remains unchanged. A reporting-only exporter audits pair/color order, W/D/L, paired scores and predefined bounds, margins, node/evaluation counts, depth distributions, wall/CPU totals, deadline tails, quality-summary arithmetic and confirmation-after-freeze ordering before publishing compact JSON/SVG evidence. Trained weights, complete trajectories and logs stay local.

Publication verification: **48 named JavaScript tests and 10 Python tests passed**, plus `git diff --check` and `python3 scripts/summarize-local-research.py .local-research/six-hour-20261027 --check`. The latter uses the retained local artifacts and plays no additional games. No new browser or physical Mac acceptance is implied by this reporting-only change.

## Next evaluator engineering round — 28 October 2026

The full JavaScript suite passes (62 tests in 14 files), as does the Python suite (18 tests). Coverage includes exact rule/search agreement, bit-identical cached/uncached fitting weights/counts/loss, guarded cost-aware selection, conservative budget refusal, event logging, completed-screen idempotence, model tampering refusal, source paths containing spaces, stale-boot locks, and the existing forced-crash/resume tests. Python HTTP launcher tests require local socket permissions; the sandbox's denied-socket failures were rerun successfully outside that sandbox. Existing subprocess cleanup ResourceWarnings in launcher tests remain non-fatal.

The actual frozen development screen completed all 288 games in 34.73 active minutes of its 45-minute cap. The independent Python publication audit replays every game, verifies scores/colors/points, solves all alternatives in 22 fresh exact endgames, verifies the source/model freeze, and checks the original campaign's published raw hashes and all 14 best-model hashes. Its verification command is:

```bash
python3 scripts/summarize-next-research.py \
  .local-research/next-frozen-screen-20261028 --check
```

The isolated C++ prototype agrees on 48 seeded positions across phases, every legal child board, static values, matching-kernel search values/node counts/evaluation counts and production search values. An additional compiled run checks forced pass, terminal positions with empty squares, early elimination and an empty terminal board against the independent oracle. Worker throughput, checkpoint serialization and encoding reuse have separate repeated benchmarks; see NEXT_EVALUATOR_RESEARCH.md and its three engineering reports. The exported SVG was parsed and its raster rendering visually inspected.

WSL2 execution, Windows memory/CPU/page/disk/power interrogation, detached screen launch and temporary keep-awake release were actually exercised. The screen's playing result was negative, so the prepared six-hour configuration remains inactive. No new long training campaign or browser runtime change occurred. Current Intel/Apple Silicon macOS hardware and native/browser-Wasm integration remain untested.

## Residual-frontier first session — 28 October 2026

The final fast suite passed **114 JavaScript tests and 26 Python tests**. New cases check zero-correction score/search/node identity, child-phase boundaries, color antisymmetry, independent exhaustive continuation values, passes, stable gradients in all 21 original units, deterministic projected optimization including active bounds, source weighting, full split balances, actual SIGKILL receipt recovery, corruption rejection, partial-game pause/resume, bootstrap endpoints, compact full-hash membership and the difference between safe worker cap and actual pool. Session tests enforce the original deadline/allowance across repairs and resumes, block first-session assessment, and refuse completed-run reentry.

Actual Windows 11 Home 10.0.26300 / Chrome 156.0.8078.48 passed WSL2 localhost analysis, a verified continuation, the playing-worker reply and default-browser launch via `python3 tests/windows_browser_check.py`. Current Mac hardware was unavailable. Optional Linux Playwright was unavailable and was not installed; no new Linux full-browser acceptance is claimed. Python's older launcher tests emit non-fatal subprocess cleanup ResourceWarnings; all 26 assertions passed.

The integrated 24-root pilot and completed 1,600-source training collection use the qualified patched teacher. The closing audit verifies all task/result hashes, canonical trajectory separation, full reserved targets, continuation placement counts, pass records and child phases. A scheduling-only source certificate preserves original numerical inputs and receipt identities while correcting actual-pool forecasting; regression tests reject gate or numerical-source changes through that path. No locked teacher queries or confirmation games were run. See [the session results](RESIDUAL_FRONTIER_RESULTS.md).

## Relaxed linear and compact-pattern experiment

The new tests cover exact B/L zero identity, full-window versus independent minimax and production search, phases, forced passes and terminal utilities, D4/color transformations, Float32/sparse tolerance, analytical/finite-difference gradients, optimizer convergence, unique-source support, genuine process-death receipt recovery, model/config identity, simultaneous selector gates, fixed expanded/fallback counts, paired-game recovery, conservative forecasts, and rejection of numerical changes by the resource-only execution certificate.

```bash
npm test
python3 -m unittest discover -s tests -p 'test_*.py'
python3 tests/windows_browser_check.py
node scripts/next-residual/audit.mjs .local-research/residual-constraint-pattern-screen-v1-20261029
git diff --check
```

Current verification: 129 JavaScript tests and 30 Python tests passed. Actual Windows Chrome/156.0.8078.48 loaded the WSL2 localhost application, rendered four analyzed moves, verified a continuation and a playing-worker reply; the real PowerShell default-browser launch route also succeeded. Full interactive acceptance was not repeated. macOS Apple Silicon and Intel hardware remained unavailable; no new Mac execution is claimed.

Numerical integrity passed, including all 41,519 preserved files of the preceding completed experiment. The new experiment's strict PV-independence qualification failed for four sources, and its positional gates failed. Those scientific limitations are retained in [NEXT_RESIDUAL_RESULTS.md](NEXT_RESIDUAL_RESULTS.md); a passing correctness/audit suite does not turn them into independent confirmation or stronger play.

## Native search backend — 30 October 2026, M4 iMac

The corrected release passes 154 JavaScript tests and the native 11-group suite
with the search core under ASan/UBSan. All 38 Python framework tests pass; two
old test fixtures normalize macOS `/var` and `/private/var` paths with resolve().
Broad qualification covers 2,007 positions, 12,042 B/L/P static queries, 96
production full-window searches and twelve independent eight-empty endings,
with zero observed numerical difference. Every 21,870 Float32 table cell and
all 63 double weights also compare bit-identically with the JavaScript export.
A separate published check verifies every stored fixed-depth native optimal
choice against the production JavaScript search.

All 768 corrected games independently replay under JavaScript mailbox and Python
rules. Python reproduces family-level confidence bounds, positive Student tails,
exact seeded bootstrap draws, matched-budget covariance and all 35,666 public
per-move metric rows/phase aggregates. Native P scored 76.95% / 70.51%. The first
768-game run is retained separately after a diagnosed request-clock drift; it is
not pooled with the corrected engineering sample. The corrected transport clock
passes a stale-startup-anchor regression and long-run actual-time checks.

Actual native Apple Silicon execution, CMake build, HTTP serving and real
headless Chromium 156.0.8078.4 acceptance pass. The browser test covers colors,
coaching comparison, keyboard, undo/replay, rapid changes, training, export/reload,
a complete game and mistake review. Intel macOS cross-compiles, but its executable
cannot run on this machine without Rosetta. No Intel hardware, current WSL2/native
Windows backend, actual Mac default-browser open or Wasm execution is claimed.
Browser search remains JavaScript.

```bash
npm test
NATIVE_SANITIZE=1 npm run native:test
python3 -m unittest discover -s tests -p 'test_*.py'
node docs/data/native-search-move-check-20261030.mjs
python3 docs/data/native-search-public-verify-20261030.py
```

See [the report](NATIVE_SEARCH_ENGINE.md), [protocol and repair](NATIVE_SEARCH_PROTOCOL.md)
and complete compact evidence linked there. No historical model, corpus,
confirmation result or production JavaScript search/evaluator changed.

## WebAssembly integration, M4 macOS (2026-10-30)

Actual Chromium 156.0.8078.4 passes `tests/wasm_browser_check.py` and the existing
`tests/browser_check.py`: full visible B/P games, selected-model coach/review,
80-ms P, undo/replay, rapid worker cancellation, cached reloads, failed loading,
B fallback/P refusal and saved/custom training/export/reload. Actual Node-hosted
Wasm numerical qualification is separately recorded in `WEBASSEMBLY_QUALIFICATION.md`.
This does not establish Safari, Intel or current WSL2 acceptance. Historical
platform results above remain unchanged.

Final browser qualification and numerical evidence are in
[`WEBASSEMBLY_ENGINE_RESULTS.md`](WEBASSEMBLY_ENGINE_RESULTS.md). The final
M4 run passes 169 Node tests, all 38 Python tests, 15 native sanitizer groups,
actual-Wasm exhaustive/internal assertions and 48 visible complete games covering
B/P, 80/300 ms and both colors. Independent public replay verifies all games,
1,647 applied computer replies, 408 forced passes, 143 small exact search results,
80 matched benchmark rows and source/distribution hashes. Additional actual Wasm
checks cover all long directional rays and independently solved 15/16-empty roots.
Safari automation was attempted and unavailable because Allow remote automation
is disabled; that setting was left unchanged. No new Intel/WSL2/Windows coverage
is inferred. The report discloses initialization, worker round trips, CPU profiles,
frame gaps and bounded-memory behavior rather than equating Wasm with native.

## M4 modernization and optimization campaign

See [the report](MAC_NATIVE_WASM_OPTIMIZATION_RESULTS.md) for exact source/build
identities, current Python 3.14.10, repeated complete-search timings and actual
Chrome checks. The additional focused native/compiled-Wasm test covers every
possible final empty square, one/two-empty passes, all alternatives, full-board
horizon-zero termination and shallow horizons that must remain heuristic:

```bash
source .venv/bin/activate
node --test tests/mac-endgame.test.mjs
NATIVE_SANITIZE=1 node --test tests/mac-endgame.test.mjs
REVERSI_BROWSER_CHANNEL=chrome python scripts/mac/browser-qualify.py
```

The local Mac campaign tools are optional developer scripts. Scored backend
samples are frozen before play, audited before summaries are opened, and used
only for engineering comparison. No evaluator is trained or promoted. Safari
is attempted only under existing automation settings. Other platforms require
separate execution; MacIntel browser user-agent text is not evidence of Intel
hardware qualification.
