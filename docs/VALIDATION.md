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

All 24 named JavaScript tests in six files and four Python tests pass. Node 24's default process-isolation reporter here counts files; `node --test --test-isolation=none tests/*.test.mjs` exposes the 24 named cases (this extra reporting option is optional and not required by Node 20 users).

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
