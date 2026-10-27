# Initial Codex review

Review date: 2026-10-26 local / 2026-10-27 UTC. Starting commit: `c55b465`.
The user's requests are authoritative; README/architecture choices are assistant-origin designs. The latest request was appended verbatim to `USER_REQUESTS.md`, preserving its existing contents.

## Verified environment and checks

- WSL2 Ubuntu 22.04.5, x86_64; kernel `6.18.33.2-microsoft-standard-WSL2`; Node `v24.16.0`; Python `3.10.12`.
- Actual Windows host: Windows 11 Home, version `10.0.26300`, 64-bit.
- Baseline: all four JavaScript test files (14 named cases) and two Python tests passed before changes.
- Completed work: all six JavaScript files (24 named cases) and four Python tests pass. Node's default reporter here counts files; isolation disabled exposes the named test count.

Commands:

```bash
node --test tests/*.test.mjs
node --test --test-isolation=none tests/*.test.mjs
python3 -m unittest discover -s tests -p 'test_*.py'
git diff --check
```

Actual browser acceptance passed in Chromium `153.0.8010.12`, including a full game, human Black/White, computer moves, undo, replay, analysis comparison, keyboard row activation, rapid depth/restart actions, training, export, reload/persistence, and completed-game mistake review. Page errors were asserted absent. A captured review screen was also visually inspected; it is a local `/tmp` artifact, not committed.

The exact browser command on this machine used an already available test environment, without modifying its repository:

```bash
PLAYWRIGHT_BROWSERS_PATH=/home/rharris/.cache/beads-playwright /home/rharris/git/beads/.venv/bin/python tests/browser_check.py --screenshot /tmp/reversi-browser-review.png
python3 tests/windows_browser_check.py
```

The second command launched actual Windows Chrome `155.0.8059.40` and verified that WSL2 localhost served the rendered app, four analyzed moves, and the searched continuation. The launcher's real PowerShell `Start-Process` route returned success opening the normal Windows default browser; its interactive window was not visually inspected. Windows Chrome's `--dump-dom` did not supply usable WSL output, so the test uses its debugging interface from Windows PowerShell. It cleans up only the disposable test profile/processes.

The sandbox blocks localhost sockets/browser processes/Windows interop; these integration checks were run with execution approval outside that sandbox. Runtime requires only Python's standard library and a modern browser. Playwright is optional test tooling. No runtime packages, external engines, or other repositories were changed.

**Unresolved platform checks:** No Mac hardware was available. Neither current macOS Apple Silicon nor Intel has been physically tested. The `open` command branch is tested with mocks, not presented as hardware verification. Native Windows Python/`.cmd` launch was not run. Precise manual checks and portable commands are in [VALIDATION.md](VALIDATION.md).

## Defects and changes

1. HTTP access/errors previously went to stderr. They now use `logs/http.log`, rotating at 1 MB with three backups; `--http-log` overrides it. Startup URL/log location remain visible. Tests verify HTTP 200 and 404 in the file, quiet stderr, path spaces, unrelated working directory, default-port fallback, `--no-browser`, and Ctrl+C shutdown. Native `.cmd` now forwards launcher arguments.
2. The original endgame check reused production rules, so it could miss shared move-generation bugs. New tests use an independent 10×10 sentinel-board implementation, checking every legal child throughout 20 seeded games and exhaustive six-empty endings. Separate same-depth exhaustive minimax checks all root scores and verified lines. All eight symmetries, forced passes, elimination, and termination with empty squares are covered.
3. TT cutoff moves did not establish the displayed principal variation. Each displayed continuation move is now verified against a full-window value at the same remaining depth. Passes consume no placement depth. TT bound flags remain separate from solved-endgame metadata. Terminal-only early finishes can now be labeled solved even when empty squares exceed depth. Individual solved rows are labeled in mixed analyses.
4. Computer depth changes had no handler; replay could allow an already-running computer search to change the live game; accepted/reset models could leave an older computer job active. Searches are now canceled/replaced as appropriate, with job/view identity checks rejecting late messages. Superseded analysis workers are terminated too, avoiding a queue behind old deep searches. Controlled-worker regression tests exercise stale analysis/computer responses, depth changes, replay, restart, and color changes.
5. Coaching previously compared only against the best move, using unverified illustrative lines. Select any row and any comparison move to see both backed-up values, their difference, verified lines, and actual searched replies. Facts report corner placements, passes, and legal-move counts in those lines. Immediate features remain explicitly separate from attribution of a minimax score. No unsupported parity/trap claims are made.
6. Completed-game review searches all human decisions at the chosen depth with one model snapshot, ranks search-point loss, labels heuristic/solved results, and links each decision to replay. Keyboard activation retains table-row focus. Full rules, passing, and terminal conditions are available in the UI.
7. A rejected training attempt previously reloaded with “No training performed.” Saved attempt counts now appear after reload. The original seeded paired mutation experiment remains available and labeled experimental. A separate transparent TD prototype and holdout runner were added; neither changes the browser's default weights.

## Positional evaluation: facts and limits

**Verified facts:** The existing evaluator has phase-specific mobility, potential mobility, occupied corners, X/C exposure beside empty corners, frontier discs, and disc advantage. It is antisymmetric and invariant under board symmetries. Corner exposure penalties switch off after the corner is occupied. This is a sensible interpretable positional starting point, not just disc counting. The hand-selected default weights remain unchanged.

**Unknown:** These checks do not measure expert-level strength, calibration, or whether it can reliably beat the user. There are no explicit stable-edge/pattern features or smooth phase transitions. Their usefulness is a hypothesis to test, not a reason to replace the current evaluator without evidence.

## Bounded learning experiment

```bash
node scripts/evaluate.mjs 8 2 > /tmp/reversi-evaluation.json
```

Training seed `20261026`; holdout seed `734917`; eight random placements per opening; eight training and eight holdout openings, excluding duplicate/symmetry-equivalent positions across both sets. Parameters freeze before holdout games. Candidate and baseline use equal fixed depth 2, both colors per opening. This is a fixed-depth search budget, not equal elapsed time or node counts. Formats, weights, opening keys, seeds and per-pair outcomes are in the JSON output. No generated personal model export is committed.

The mutation candidate is selected on paired training games; the separate TD(0) prototype learns from eight fixed-baseline depth-1 trajectories (414 transitions, rate 0.03, one epoch). TD uses the next state's linear value and a terminal target of `100 * actual Black disc margin / 64`, normalized bounded updates, and versioned parameters. Training costs differ between the methods; this experiment does not compare equal-cost learning efficiency.

The complete experiment took 2.41 seconds on this machine. Mutation passed its training threshold (10/16 points) but scored below 50% on the held-out openings, illustrating why training acceptance is not evidence of general improvement.

| Frozen candidate vs default | Holdout games | Wins / draws / losses | Points rate | Conservative 95% interval |
|---|---:|---|---:|---|
| Weight mutation | 16 (8 opening pairs) | 6 / 0 / 10 | 37.5% | 0–85.5% |
| Linear TD(0) | 16 (8 opening pairs) | 9 / 1 / 6 | 59.4% | 11.4–100% |

Intervals use Hoeffding's bound over opening-pair mean points, not independent color games. Pseudorandom samples and the tiny sample size limit interpretation. Both intervals include 50%; **there is no demonstrated improvement**. These pilot holdouts are now disclosed development evidence; a future selection experiment should reserve fresh unseen seeds before tuning. No candidate was installed by this runner.

## Profiling and measured optimization

```bash
node scripts/benchmark.mjs
node --cpu-prof --cpu-prof-dir=/tmp scripts/benchmark.mjs
```

V8 sampling identified feature extraction and move generation as major costs. A small change precomputes fixed neighbor geometry and removes temporary adjacency arrays at each evaluation. Both-player feature outputs and evaluations were byte-identical on 100 seeded opening positions before/after; correctness checks pass. No bitboards or additional framework was warranted for this milestone.

Same seed `123`, positions after 0/20/40 random placements, equal depths, five timed runs after warmup, median milliseconds. Both columns include the new verified-continuation work; node totals are unchanged by this optimization. These are local measurements, not cross-platform promises.

| Placements | Depth | Nodes | Before neighbor optimization (ms) | After (ms) |
|---:|---:|---:|---:|---:|
| 0 | 3 | 82 | 1.8 | 1.4 |
| 0 | 4 | 240 | 3.2 | 2.9 |
| 0 | 5 | 909 | 12.1 | 10.2 |
| 20 | 3 | 863 | 11.8 | 9.7 |
| 20 | 4 | 3,790 | 44.2 | 39.7 |
| 20 | 5 | 19,426 | 226.9 | 200.3 |
| 40 | 3 | 137 | 0.9 | 0.9 |
| 40 | 4 | 786 | 6.9 | 5.9 |
| 40 | 5 | 1,406 | 8.7 | 8.2 |

The middlegame depth-5 example takes about 12% less elapsed time (1.13× throughput). Millisecond cases are noisy. Continuation verification intentionally adds nodes relative to the starter (for example, middlegame depth 4: 3,706 → 3,790); do not attribute that semantic change to the neighbor optimization.

## Suggested next milestone, with a short evaluation budget

1. Complete the documented interactive Mac checks on Apple Silicon and Intel, plus normal Windows-browser visual checks. This is the outstanding platform acceptance work.
2. Spend about 30–60 minutes on one evaluator experiment: add a conservative corner-anchored stable-edge feature **or** smooth phase interpolation, with a small set of expert tactical positions and independent exact-endgame targets. Test one change at a time and keep the current evaluator as the baseline.
3. Before tuning, reserve fresh disjoint seeds. Extend the runner to 32–64 holdout opening pairs at equal depth 2–3, with both colors, a stated wall-time cap (for example ten minutes), paired uncertainty, and saved parameter versions. Report an incomplete run honestly if the cap is reached; keep defaults unless evidence supports the candidate. Do not reuse this pilot's exposed holdout as a fresh test set.
4. Expand coaching with a few independently tested tactical fixtures (forced corner concessions, mobility traps, parity). Use verified continuations and counterfactual alternatives for each claim. Add iterative deepening/time limits only if measured deeper-search latency calls for it.

This sequence retains a reasonable current evaluator, gives the user a useful game now, and bounds the next strength experiment rather than starting a large learning framework.
