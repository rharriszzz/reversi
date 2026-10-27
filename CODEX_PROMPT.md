# Initial Codex task — Reversi Coach Lab (`rharriszzz/reversi`)

Read `USER_REQUESTS.md` **first**: it contains only the user's own requests, in chronological order. Then read `AGENTS.md`, `README.md`, `docs/ARCHITECTURE.md`, `docs/VALIDATION.md`, and the code/tests. The user has prior experience writing an alpha-beta Reversi program, understands evaluation design, and explicitly wants an original engine with a useful learning/teaching interface. Do not substitute a third-party engine for this code.

**Required platforms:** **Windows 11 WSL2 Ubuntu is the primary development and play environment** (the user most often uses WSL2); the app must also work on **current macOS, Apple Silicon and Intel**. No Windows-only APIs in game logic, no native dependencies, and no required Node/npm install just to play. Use local Python 3 HTTP serving, ES JavaScript, and browsers. Native Windows 11 `.cmd` launch is supplemental. Repo name is one word: `reversi`.

## Work plan, in priority order

**1. Validate and exercise the cross-platform starter.** Reproduce `node --test tests/*.test.mjs` and `python3 -m unittest discover -s tests -p 'test_*.py'`. Check that `./start.sh` and `python3 launch.py` work from WSL2 and macOS, that WSL2 launches or can be reached from a **Windows** browser using localhost, and that macOS opens the default browser. Test URL auto-selection, shutdown, spaces in local paths, and the `--no-browser` fallback. If your execution environment cannot actually run WSL2 or macOS, do not claim those platforms were tested: explicitly report what you could verify and provide precise manual instructions for the user. No architecture-specific native libraries.

**2. Independently validate rules and search.** Check move generation with known perft counts, forced passes, elimination, and terminal positions with empty squares. Use an independent brute-force oracle on small endgames. Examine alpha-beta pass/depth semantics, transposition-table bound flags, and symmetric positions. Each listed legal move must be evaluated using a **full root window at the same nominal depth** from the side-to-move's viewpoint. Verify exact-result labeling in all relevant cases; distinguish tree-search outcomes from approximate feature values. Record reproducible node/time measurements.

**3. Verify actual browser behavior.** Confirm human Black/White, undo, replay, adjusting depth, clicking an analysis row, computer move, training, export, refresh/reload, and keyboard accessibility. Add browser end-to-end tests if practical. Explicitly test stale worker messages and quick user actions during analysis. If the browser is unavailable, do not describe it as visually verified.

**4. Strengthen coaching and explanations.** Allow side-by-side comparison of ANY two legal moves. Show backed-up score, depth, opponent best reply (actually searched), relevant continuations, and score difference. Provide concrete evidence for corner concessions, mobility traps, forced passes, parity, or other claims, rather than generic commentary. Build a post-game mistake review using the search at a stated depth. Immediate feature contributions are useful evidence but DO NOT exactly attribute a deeper alpha-beta score.

**5. Investigate learning.** Preserve the seeded, paired baseline weight-mutation tournament. Prototype one method suited to a CPU and transparency: TD learning, linear value learning, or n-tuple evaluation. Use separate training and holdout openings, paired colors, fixed budgets and random seeds, saved parameter versions, and uncertainty measures; do not claim superiority without a fair held-out benchmark. Ask the user only for truly strategic decisions where their experience would change the design.

**6. Optimize after measuring.** Profile the code. If relevant, add bitboards, iterative deepening, search time budget, better move ordering and TT replacement. Compare same position sets, seeds, and depth/time constraints before/after. Keep run commands and project structure simple.

## Deliverables

- Working cross-platform app, automated tests, and platform verification notes (be precise about what was not physically tested).
- Updated `README.md`, `docs/ARCHITECTURE.md`, and `docs/VALIDATION.md` when changing behavior. Leave `USER_REQUESTS.md` verbatim.
- A new `docs/INITIAL_CODEX_REVIEW.md` reporting test commands, environments, verified functionality, measured speed, defects and fixes, objective evidence of learning (or lack of evidence), and remaining limitations.
- Brief recommendations for the **next** milestone, especially about transparent learning and better move-specific explanations.
- Commit/push if access permits; report exact commit SHA and test outcomes. If blocked, say why and leave user files intact. Do not create or modify other repositories.

## Suggested model and reasoning level

Start with **GPT-6.1-Sol, High** for implementation and cross-platform tests. Use **GPT-6-Astra, High** for evaluating difficult search/evaluation/learning choices or interpreting a failed approach; use Extra High only when a genuinely challenging algorithmic issue has been isolated and benchmarked. Make focused, testable changes rather than spending tokens on speculative rewrites.
