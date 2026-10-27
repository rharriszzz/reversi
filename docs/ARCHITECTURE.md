# Architecture and design rationale

## Purpose

A **game**, a **move analyzer**, and a **teaching/learning experiment** in one local web application. A key design constraint is interpretability: expose all legal move scores and actual variations, rather than asking the user to trust an opaque score or generic advice. The repo builds its own Reversi implementation rather than delegating play to a black-box engine.

## Runtime

A Python 3 standard-library HTTP server (`launch.py`) serves static HTML/CSS/JavaScript. No Python packages, Node packages, build step, or Internet connection are necessary at runtime. `start.sh` is the POSIX entry point for WSL2 and macOS. Under WSL2, the server attempts to open the Windows browser via PowerShell; otherwise it prints the URL. On macOS, it uses the system `open` command. `start_windows.cmd` supports direct Windows execution. The Python HTTP server binds `127.0.0.1`, not a public network interface.

## Core modules

1. `src/rules.js`: immutable 64-element board and legal move generation, flips, passes, terminal states.
2. `src/features.js`: board-based positional measurements and phase-dependent weights; static evaluation from one player's perspective.
3. `src/search.js`: negamax alpha-beta with full-window root evaluations for every legal move, transposition entries, and a best-move interface. Preserve the distinction between exact solved positions and limited-horizon heuristics.
4. `src/learning.js`: reproducible, seeded proposal of new weights; compare via paired openings with colors swapped. This is a **baseline experiment**, not a proven learning result.
5. `src/worker.js`: work isolation for analysis, opponent play, and training. Avoid stale Worker responses overwriting a new position.
6. `src/app.js`: game state, UI interactions, replay, interpretation, browser model persistence and export.

## Evaluation versus explanation

A search score is a backed-up value from a game-tree search. An *immediate feature contribution* describes the position directly after a particular move. These are related but **not identical explanations**, because subsequent replies can change the position radically. Educational feedback should therefore show actual alternative sequences and opponent replies and label uncertainty, depth, and score units. When a move is called bad because of corner loss, show the line that concedes the corner, not merely an adjacency penalty.

## Learning directions to evaluate

The first model adjusts interpretable weights using paired self-play. Carefully benchmark candidate systems such as temporal-difference learning or n-tuple patterns against a fixed baseline using training/holdout opening separation and both colors. Prefer a small, reproducible CPU-only implementation. Keep a versioned JSON representation of learned parameters and reproducible random seeds.

## Risks requiring independent checking

- Deep search and alpha-beta transposition bound semantics, especially passing and depth limits.
- Principal-variation extraction under table replacement and cutoffs; reported lines may be incomplete.
- Fairness of move scores and exact-vs-heuristic classification in pass situations.
- Opponent / analyzer responses arriving after the user changes depth, color, board or model.
- Storing a model locally versus export/import portability and validation.
- Linux runtime success not proving WSL2-to-Windows-browser or native macOS end-to-end behavior.
