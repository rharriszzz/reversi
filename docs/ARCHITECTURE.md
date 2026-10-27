# Architecture and design rationale

## Purpose

A **game**, a **move analyzer**, and a **teaching/learning experiment** in one local web application. A key design constraint is interpretability: expose all legal move scores and actual variations, rather than asking the user to trust an opaque score or generic advice. The repo builds its own Reversi implementation rather than delegating play to a black-box engine.

## Runtime

A Python 3 standard-library HTTP server (`launch.py`) serves static HTML/CSS/JavaScript. No Python packages, Node packages, build step, or Internet connection are necessary at runtime. `start.sh` is the POSIX entry point for WSL2 and macOS. Under WSL2, the server attempts to open the Windows browser via PowerShell; otherwise it prints the URL. On macOS, it uses the system `open` command. `start_windows.cmd` supports direct Windows execution. The Python HTTP server binds `127.0.0.1`, not a public network interface.

HTTP access/errors use a rotating file handler at `logs/http.log` (1 MB, three backups), configurable with `--http-log`. Startup messages and the URL still appear in the terminal. Static serving uses an explicit repository directory, without changing the process working directory.

## Core modules

1. `src/rules.js`: immutable 64-element board and legal move generation, flips, passes, terminal states.
2. `src/features.js`: board-based positional measurements and phase-dependent weights; static evaluation from one player's perspective.
3. `src/search.js`: shared original negamax alpha-beta core. `scoreAllMoves` provides full-window same-depth coaching values/verified lines; `findBestMove`/`bestMove` use root alpha sharing and omit coaching details. Preserve exact-vs-heuristic distinctions.
4. `src/learning.js`: reproducible, seeded proposal of new weights; compare via paired openings with colors swapped. This is a **baseline experiment**, not a proven learning result.
5. `src/worker.js`: work isolation for analysis, opponent play, and training. Avoid stale Worker responses overwriting a new position.
6. `src/app.js`: game state, UI interactions, replay, interpretation, browser model persistence and export.

## Search, jobs, and coaching

Depth counts placements; forced passes consume no depth. Every **coaching** root move uses a full window and one shared depth. Playing search carries alpha across root moves; inferior root values may be bounds and are not exposed as comparison scores. TT flags describe exact *depth-limited values* or upper/lower bounds; they do not themselves mean an endgame is solved. Separate conservative solved metadata tracks heuristic leaves and unsolved cached bounds. Searching at least the number of empty squares always solves the position, including passes. A terminal-only result can also be solved earlier, for example after elimination. Mixed coaching analyses label individual solved rows separately.

Playing workers use `play`/`played` messages containing only the chosen result and search metrics. Analyzer/review workers retain comprehensive coaching. Self-play and TD already call `bestMove`, so they use the playing path too. Regression tests compare optimal scores and membership in the coaching-optimal tied set, rather than requiring a particular tied move.

Optional playing-search deadlines use iterative deepening, fresh TT bounds per iteration, and the last completed root choice for ordering. A timeout discards the incomplete iteration; nodes/evaluator calls/elapsed time still include it. If depth 1 does not finish, the result is a legal fallback labeled depth 0, score null, exact false. Deadlines are soft, checked at every searched node; one node, allocation, or OS scheduling can overrun them. They are exposed to experimental callers, not substituted for browser depth controls. Heuristic evaluator calls are counted separately from nodes and coaching's immediate breakdown evaluations.

Continuations verify each chosen move against a full-window same-depth value, rather than trusting a TT cutoff move. Verification work is included in reported node/time totals. Feature extraction precomputes the fixed neighbor geometry; this changes allocation cost, not weights or values.

Analysis jobs retain view/depth/model identities and job IDs. Superseded analyses are terminated and replaced. Computer searches are canceled on replay, undo, restart, computer depth changes, and accepted/reset model changes; leaving replay starts a current search. Training retains its separate worker and fixed model snapshot.

`src/coaching.js` reports legal-move counts, actual corner placements and mandatory passes in the searched line. The coach compares any two legal moves and displays both scores, their difference and the searched replies. These are facts about one optimal continuation at the stated depth, not a proof of general strategic labels such as “mobility trap.”

`src/review.js` ranks completed-game human decisions by search-point loss. A separate worker reviews a snapshot at one stated depth with the current model. Each result links to replay. Review loss is a difference in search units, not lost win probability.

## Evaluation versus explanation

A search score is a backed-up value from a game-tree search. An *immediate feature contribution* describes the position directly after a particular move. These are related but **not identical explanations**, because subsequent replies can change the position radically. Educational feedback should therefore show actual alternative sequences and opponent replies and label uncertainty, depth, and score units. When a move is called bad because of corner loss, show the line that concedes the corner, not merely an adjacency penalty.

## Learning directions to evaluate

`src/evaluation.js` provides separate experimental evaluators. Stable edges count only uninterrupted same-color edge runs anchored at occupied corners, exclude corners already scored, and deduplicate overlap. The feature is net stable edge discs / 24, with a pilot weight of 60. Smooth weights linearly interpolate the unchanged phase vectors at 4/40/64 occupied squares. Original `FEATURE_NAMES`, defaults, saved weights and immediate coaching breakdowns remain unchanged. Tests independently enumerate endgames to check stability claims. The candidates are evaluated individually; no combined evaluator or parity feature is installed.

`scripts/evaluation-benchmark.mjs` records static feature/evaluation costs, coaching/playing throughput, and completed depth under wall-clock budgets. `scripts/evaluation-experiments.mjs` separates fixed-depth games, wall-clock games, development-selected weights, and independent solved-position diagnostics. See `docs/EVALUATION_EXPERIMENTS.md` for seeds, protocols, negative results and limits.

The first model adjusts interpretable weights using paired self-play. Carefully benchmark candidate systems such as temporal-difference learning or n-tuple patterns against a fixed baseline using training/holdout opening separation and both colors. Prefer a small, reproducible CPU-only implementation. Keep a versioned JSON representation of learned parameters and reproducible random seeds.

`src/td.js` prototypes TD(0) on linear phase-specific features, separately from browser defaults. Fixed baseline play supplies trajectories; each state's Black value targets the next state's value, with terminal target `100 * (black - white) / 64`. Updates are normalized and bounded. This is a prototype, not a calibrated value model.

`scripts/evaluate.mjs` freezes candidates before holdout games, excludes symmetry-equivalent duplicate eight-ply opening positions, uses both colors at equal fixed depths, and reports a conservative Hoeffding interval over opening-pair mean points. The small sample cannot establish superiority. Parameters, seeds, and format versions are printed to JSON; generated personal models are not committed. Browser weight mutation retains its original training-only acceptance threshold and is explicitly experimental.

## Remaining risks and limits

The follow-up result-preserving implementation is `src/fast-features.js`. It precomputes geometric rays once, fuses both players' mobility checks with potential/frontier/disc counting, and sums the original weights in the original order. Search passes an already computed own-mobility count as the optional fourth evaluator argument; the reference evaluator ignores it. Scalar evaluation omits contribution objects, while coaching's immediate breakdown still uses the original detailed implementation. There is no mutable board cache, incremental state, native code, or new runtime dependency. Forty independently generated games test exact feature/score equivalence, including custom weights; fixed-depth comparisons check moves, nodes and actual evaluator calls.

`makeFastStableEvaluator(weight)` uses the same fast baseline plus the existing conservative stable-edge feature. The frozen experiment protocol in `scripts/evaluator-protocol.mjs` separates development, selection, final quality, and final games. `scripts/compare-evaluators.mjs` records independent late-game labels and estimated early references, then interleaves paired timed conditions under a global cap. `pairOffset` preserves alternating color order across checkpointed one-pair runs. See `docs/EVALUATOR_COMPARISON.md`; a candidate's better position ranking is secondary to equal-time strength.

- Deep search and TT replacement retain correctness regression tests; this is not a proof for every board/depth.
- Verified continuations are optimal at their stated horizon; tied replies can differ and heuristic leaves can be misleading.
- Browser weight mutation uses training-only acceptance. Independent holdout evidence is required before claiming stronger play.
- Models export to JSON; an import/validation UI is not yet implemented.
- Actual WSL2-to-Windows Chrome and Chromium tests pass. macOS hardware and native Windows Python launch remain unverified; see `VALIDATION.md`.
