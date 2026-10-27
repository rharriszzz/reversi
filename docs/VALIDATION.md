# Verification plan / platform acceptance matrix

**Verification status should be updated after each run.** Never mark a platform tested without executing there. This file starts as a checklist, not an assertion of completed macOS/WSL2 testing.

| Environment | Launch | Local HTTP served | Browser functional | JS tests | Status |
|---|---|---|---|---|---|
| Generic Linux development container | Python 3 | Python HTTP smoke test | Fake-DOM test only | Node 22 | Automated tests run; no graphical browser |
| Windows 11 WSL2 Ubuntu + Windows Chrome/Edge | `./start.sh` or `python3 launch.py` | Test in WSL | Test in Windows browser | `node --test` in WSL | **Not yet verified on a real WSL2 machine** |
| Current macOS Apple Silicon | `./start.sh` | Test | Safari or Chrome | `node --test` | **Not yet verified on a Mac** |
| Current macOS Intel | `./start.sh` | Test | Safari or Chrome | `node --test` | **Not yet verified on a Mac** |
| Native Windows 11 (optional) | `start_windows.cmd` | Test | Chrome or Edge | Optional | **Not yet verified in this revision** |

## Baseline automated tests

In the repository root on WSL2/macOS:

```bash
node --test tests/*.test.mjs
python3 -m unittest discover -s tests -p 'test_*.py'
```

Record node/Python versions, exact test count, failures, and timing in `docs/INITIAL_CODEX_REVIEW.md`.

## Manual acceptance checklist (repeat on both WSL2 and macOS)

- [ ] Local HTTP URL loads without console errors; CSS and modules load.
- [ ] Running via launcher from an unrelated working directory serves the correct project.
- [ ] WSL2 opens a **Windows** browser, or the printed `localhost` URL opens there manually.
- [ ] macOS launches default browser or printed URL works.
- [ ] Board initially has four discs and four valid moves for Black.
- [ ] Legal clicks flip the correct discs; illegal clicks are disabled.
- [ ] Opponent plays as configured; try user as both Black and White.
- [ ] Analyze *every* available move at equal depth and consistent scoring perspective.
- [ ] Inspect move row, continuation, and immediate feature contributions.
- [ ] Change analysis depth while workers are busy; stale responses never overwrite new analysis.
- [ ] Undo, replay slider, and new game remain consistent with actual board and turn.
- [ ] Forced pass and non-full-board terminal positions behave correctly.
- [ ] One learning generation completes; persistent weights reload; JSON export works.
- [ ] Tab/keyboard operation and layout are usable with both mouse and keyboard.
- [ ] All JavaScript tests and HTTP launcher tests pass.
- [ ] User-visible claims about learning are supported by an independent holdout benchmark.

## Suggested new automated coverage for Codex

- Independent Reversi perft reference positions and pass-heavy endgame positions.
- Browser end-to-end tests with Chromium and/or Safari if tools are available.
- Simulated slow/late Web Worker messages, user color/depth changes, game restarts.
- Search score equality with independent exhaustive solver on small boards.
- Head-to-head learning benchmarks with paired opening sets, confidence intervals, and saved seeds.
