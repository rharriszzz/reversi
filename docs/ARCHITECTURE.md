# Architecture and design rationale

Active Python launch, research and test tooling requires Python 3.13+ as declared
in `pyproject.toml`. `scripts/python.mjs` selects and checks Node's Python
subprocess interpreter; Python research launchers propagate `sys.executable`.
Optional browser/plot packages live in `.venv`; application startup remains
standard-library-only. See [Python environment policy](PYTHON_ENVIRONMENT.md).

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
- Historical WSL2-to-Windows Chrome checks passed. Current Apple Silicon native research and real Chromium acceptance pass; native Intel, current WSL2/native Windows backend execution and actual Mac default-browser launch remain unverified. See `VALIDATION.md`.

## B-preserving residual research

`scripts/residual/` is an offline experiment, independent of browser learning and the older mixed-target fitting code. It compiles 21 learned weight corrections into the original B weights, preserving the existing evaluator/search and phase boundaries. `frontier.mjs` reconstructs the best two root alternatives using fresh full-window continuation searches, verifies final static children with independent rules, and records pass/terminal witnesses. `data.mjs` admits whole source trajectories with canonical historical/cross-role exclusions and filters independent D10/D12 sibling preferences. `model.mjs` implements the fixed convex source-normalized objective and a deterministic bounded optimizer; original defaults remain unchanged.

`launch.py` freezes source and pins the qualified external teacher, performs Windows/WSL resource checks, detaches the coordinator and holds a bounded temporary keep-awake request. `run.mjs` separates cumulative scientific time from each explicit session allowance, checkpoints individual expensive tasks and optimizer/game state, and bars locked assessment in session one. The historical parsing heap lives in a short-lived builder process; the coordinator uses a compact sorted full-SHA-256 exclusion index. `audit.mjs` verifies receipts, split identities, original source/teacher identities and trajectory separation before `publish.mjs` exports compact evidence. See [the frozen protocol](RESIDUAL_FRONTIER_PROTOCOL.md) for precise score units, normalization, selection and gates.


## Autonomous offline research

`scripts/research.mjs` owns a bounded, seeded state machine: correctness/calibration, disjoint trajectory generation, reference labeling, fitting, development assessment, preliminary and serious selection, durable freeze, untouched confirmation, and reporting. Its workers execute bounded tasks in `scripts/research/worker.mjs`. The coordinator alone writes the atomic manifest and accepts task results in deterministic order. Generation batches are committed together; complete task artifacts survive interruptions and can be reused without publishing partial pairs.

`scripts/research/core.mjs` implements 21-weight coordinate/SGD controls, individual feature additions/removals, offline fixed-Black TD(lambda)/TD(0), and three-phase ternary patterns (24,093 total hybrid parameters). Patterns share weights through all D4 transforms and antisymmetric color-reversed lookups. Supervised targets distinguish `100 * Black margin / 64` from `100 * outcome sign`; engine terminal sentinels never enter regression. B/C prediction-only calibration fits three phase scalars on training data; searches retain original scores. Model and data artifacts never enter browser storage or alter `DEFAULT_WEIGHTS`.

The exact reference uses the independent mailbox oracle in `tests/oracle.mjs` and checks its value against production exhaustive alpha-beta. Earlier full-window B labels are explicitly estimates. Whole trajectories, canonical D4/color keys and distinct reserved opening roots prevent cross-split leakage; disclosed historical roots/boards and published smoke keys are excluded. Unpublished historical trajectories cannot be reconstructed and are a stated limitation.

`src/fast-features.js` exports an allocation-light legal list. `findBestMove` accepts optional `legalMoves` and `orderingHints` for research. Its defaults and coaching behavior are preserved. Ordering hints carry moves across iterative horizons, never TT score bounds. Calibration compares matched workloads before enabling either research option. Independent rules and minimax tests cover both options.

`io.mjs` implements fsync/atomic rename and hashes source, tests and data-provenance inputs. A live PID/host lock prevents competing writers. Workers have a 384 MB V8 old-generation limit each (not a whole-process RSS guarantee), at most four with a logical CPU left free where possible. Sparse supervised examples are subsampled before vector caching. Timed games and cost assessment terminate other idle workers; no training runs concurrently. CPU totals are process-wide, avoiding double counting overlapping workers.

`report.mjs` periodically emits Markdown, JSON, learning/quality-cost SVGs and Pareto candidates. Pair-level Hoeffding bounds cover 512 possible candidate/control conditions and every possible prefix up to 1,024 pairs, including duration-dependent stopping. Confirmation targets may expand using selection timing and unused budget, before confirmation outcomes are opened. Selection and confirmation remain distinct. See LOCAL_RESEARCH_PLAN.md for fallback, incomplete-run, and evidence rules.

`scripts/research-launch.py` starts a new POSIX session with closed stdin, file logs and reduced priority. It verifies a durable startup checkpoint before returning. No daemon installation, network, privileged operation or conversation lifetime is required in a normal local terminal. A hosted sandbox may still remove descendants after a tool invocation; this was observed and is not claimed as persistent hosting.


## Research v3 engineering round

The v2 results above remain historical. `scripts/strong/run.mjs` now uses version `strong-evaluator-v3`; old campaigns resume from their own preserved source. New v3 runs use guarded cost/quality screening with explicit family retention and audited unplayed candidates. Development exact top-choice regret selects checkpoints before MSE; no candidate is installed automatically.

Worker tasks emit named stages/epochs and wall/thread-CPU profiles. `telemetry.mjs` writes event logs plus a 45-second heartbeat; large histories are immutable chunks, and the manifest keeps at most 1,024 scalar fit summaries. `encoding-cache.mjs` retains bounded raw geometry in a worker while reapplying current learned counts. Atomic checkpoint fsync/rename remains in `research/io.mjs`, with optional operation profiling. Generation and label tasks use deterministic partitions and coordinator admission; partitions retain their identities on lower-concurrency recovery. Two dependent model fits remain limited to two useful concurrent fits.

`next/screen.mjs` and `next/pool.mjs` implement the separately bounded frozen development screen and hashed atomic task receipts. Its source and models are frozen before play. `strong-launch.py --screen` resource-checks, snapshots and detaches it, with temporary keep-awake and completed-run refusal. The screen completed with negative results; see NEXT_EVALUATOR_RESEARCH.md. `next/kernel.cpp` is an isolated optional benchmark kernel, not a browser dependency or replacement engine.

The prepared long-pattern six-hour template is inactive. A real future long-pattern launch requires a matching-source completed smoke, fresh resource checks, fixed pre-confirmation targets, slower repeated pilot timings, 35% confirmation overhead, an audit allowance and a 15-minute final safety reserve. The original framework/browser remains dependency-free for play.

## Relaxed linear and compact residual research

`scripts/next-residual/` is a separate offline experiment, preserving the completed residual runner and every production module. L stores 21 corrections with a distinct ±100 format and calls the existing evaluator with corrected weights. P freezes L and compiles only corner-six and edge-eight antisymmetric ternary tables with all eight D4 transforms, original B phases and normalization 1/8. It shares the baseline feature scan, retains Float64 linear weights and uses 87,480 bytes of Float32 tables.

Source-normalized sparse logistic fitting uses deterministic bounded projected L-BFGS for the patterns, independently checked original-unit gradients and per-source support. Full-window continuation witnesses and production iterative deepening receive evaluator callbacks; production search semantics stay unchanged. Joint reservations, compact historical exclusion indices, task/model/source checksums, per-move game checkpoints and independent occupancy sampling keep scientific inputs separate from resource scheduling. A narrow archived execution certificate corrects the resident-worker memory reserve without changing numerical inputs or receipts.

The complete 256-source/128-root experiment stopped before games. The published [results](NEXT_RESIDUAL_RESULTS.md) retain both failed gates and the failed historical-PV independence qualification. The post-outcome loss decomposition is diagnostic only: no terminal-containing preference, source, model or gate was changed to rescue the result. No learned model is installed in browser play.

## Optional native complete-search backend (October 2026)

`native/engine.cpp` adds an original C++17 two-bitboard implementation of the
same seven features and frozen B/L/P evaluators. `scripts/native/build.mjs`
reconstructs and verifies the committed L/P identities, exports the exact
Float32 tables into a generated header under ignored local storage, and builds
with contraction/fast-math disabled. No model fitting or browser default changes.

`NativeEngine` (`scripts/native/client.mjs`) owns a persistent process with a
versioned request protocol, whole-search deadlines, bounded TT allocation,
model/build identities, error replies and process cancellation/restart. Its
Python standard-library counterpart uses the same protocol. `choose` and
`playGame` supply a real research playing pipeline with native or original
JavaScript search, independent replay and durable game-prefix recovery.

Native negamax uses placement depth, forced passes, original terminal utility,
same-depth full-identity TT bounds, iterative deepening and only completed
iterations. Prior search/iteration entries may guide ordering; score bounds are
valid only in the current generation/horizon. Root play returns one best move;
its cutoff values are never presented as all-move coaching scores. Full coaching
and verified continuations remain on the existing JavaScript worker path. The
browser worker termination/job-id lifecycle is unchanged. See
[NATIVE_SEARCH_ENGINE.md](NATIVE_SEARCH_ENGINE.md) for measurements and limits.

## WebAssembly browser extension (2026-10-30)

`native/engine.cpp` is now shared by native and browser builds. The explicit C ABI
in `native/browser.cpp` and `src/wasm-engine.js` adapt complete computational
operations; there is no leaf callback to JavaScript. `src/backend.js` selects
frozen Wasm or saved/custom JavaScript evaluation inside the existing workers.
Each worker owns its own lazy module/TT; terminating it cancels initialization or
search and discards the whole memory lifetime. Workers serialize incoming jobs
through initialization; the UI still rejects replies by ID/revision/view/model.
Frozen B/L/P selection and time preferences use a separate storage key from the
unchanged mutable model format. Initial defaults and training remain JS/custom.
See `WEBASSEMBLY_INTEGRATION.md` and `WEBASSEMBLY_BUILD.md` for current runtime,
full-window/PV semantics, memory bounds and visible fallback behavior. Earlier
JS-only descriptions above retain their historical scope.

## Qualified tiny exact tails on the M4

Shared native/Wasm search can solve the last one or two empty squares without
full-board legal propagation. One empty square uses directional flips and the
actual resulting raw margin, including a required pass or double-pass terminal.
It never awards an unplayed square. Two empties check both flip masks once,
reuse them to construct children, and retain alpha-beta and pass semantics.
The final-empty body is an out-of-line shared C++ method. Each root/analysis/
window request records whether its placement horizon covers all remaining
empties; truncated trees cannot reach a tiny exact tail and bypass its tests.
Terminal detection still precedes heuristic evaluation, including horizon zero.

There is no new selective pruning, PVS, aspiration search or evaluator change.
Analytically resolved final placements reduce visited-node counts; NPS alone
must not be interpreted as complete-search speedup. The original forty-byte,
full-identity direct TT and its bounded allocation remain. A qualified equal-
allocated-memory thirty-two-byte experiment was slower and rejected. Numerical,
whole-search and profile evidence is in the [M4 report](MAC_NATIVE_WASM_OPTIMIZATION_RESULTS.md).
