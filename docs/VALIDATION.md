# Validation status and acceptance checks

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
