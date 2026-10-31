# Reversi

An original Reversi engine, browser opponent and coaching lab. Play locally with
Python and a modern browser; no package installation, build service or network
connection is required to play. The alpha-beta search and evaluators remain
inspectable. Frozen B/L/P models and qualified WebAssembly binaries are included.

## Quick Start

Use **Python 3.13+**. This M4 Mac's project environment is **Python 3.14.10**;
the qualified WSL2 Ubuntu environment uses **3.14.4**. See
[interpreter selection and setup](docs/PYTHON_ENVIRONMENT.md).

On **macOS (Apple Silicon or Intel)** or **Windows 11 WSL2 Ubuntu**:

```bash
cd ~/git/reversi
./start.sh
```

The script selects `REVERSI_PYTHON`, an activated environment, the repository's
`.venv`, or `python3`, in that order. It forwards all launcher flags. To invoke
Python directly, select a supported interpreter first:

```bash
source .venv/bin/activate  # when the project environment exists
python3 launch.py
```

macOS opens the default browser using `open`. WSL2 tries the **Windows default
browser** through PowerShell; open the printed localhost URL manually if needed.
Keep the terminal running and press **Ctrl+C to stop the server**. Work under
WSL's Linux filesystem (`~/git/reversi`), rather than `/mnt/c`, for development.

On **native Windows**, double-click `start_windows.cmd`, or run:

```powershell
py -3 launch.py
```

The Windows script also honors `REVERSI_PYTHON`, an activated environment and a
Windows `.venv`. Native Windows is a convenience; WSL2 remains the primary Windows
development target. Use a native Windows environment with Windows Python, not a
WSL virtual environment.

Supported flags for `./start.sh`, `start_windows.cmd` and `launch.py`:

```bash
./start.sh --no-browser
./start.sh --port 0                      # operating system selects a free port
./start.sh --port 8000 --http-log /tmp/reversi-http.log
python3 launch.py --help
```

Without `--port`, the launcher tries ports 8000–8009. It binds to local loopback.
Rotated HTTP logs default to `logs/http.log`; a relative `--http-log` path is
relative to the process working directory (the repository for `start.sh` and
`start_windows.cmd`). Use the printed URL, not `file://index.html`:
JavaScript modules and workers require HTTP.

**Playing and coaching:** select **B**, **L** or **P** under Evaluator for the
frozen WebAssembly engine. Select fixed depth or 80/300 ms computer time. All-move
coaching and game review use the selected evaluator, equal-depth full-window
scores and verified continuations. **Saved/custom weights** use JavaScript and
retain local training, persistence and JSON export. Saved/custom is the initial
selection; explicit frozen-model preferences are remembered separately. These
are distinct backends, identified in the UI. No evaluator is promoted by the
performance results.

**Profiling explorer:** start the same server and append **`profiling/`** to its
printed URL, for example **[http://127.0.0.1:8000/profiling/](http://127.0.0.1:8000/profiling/)**.
The [explorer source](profiling/index.html) uses committed measurements; opening it
never launches a profiler. See [measurement methods and findings](docs/PROFILING_METHODS_AND_VIEWS.md)
and [the performance overview](docs/PERFORMANCE_OVERVIEW.md).

## Current behavior and evidence

The shared C++ engine supports exact frozen B/L/P evaluation, bitboards,
alpha-beta search, a collision-safe transposition table, iterative deepening,
forced passes, exact final-empty handling and faster disc flipping. A portable
4 KiB table stores the eight board rays for each square; endpoint tests find
bracketed opponents without directional loops. Fixed-depth scores, search trees,
move ordering and frozen models are preserved. Browser play, coaching and review
use its committed Wasm distribution for frozen models; ordinary play still needs
only Python and a browser. Custom weights retain the original JavaScript path.

A move must capture at least one opposing disc along a straight line. All
captured lines flip. A player with no legal move must pass; the game ends when
neither player can move, even with empty squares. The winner has more discs;
unplayed empty squares are not awarded. See the in-app rules and
[independent correctness coverage](docs/VALIDATION.md).

Heuristic search scores are not win probabilities or predicted final margins.
Immediate feature contributions do not decompose a deeper minimax score. Coaching
searches every candidate at the same horizon and verifies continuations; exact
terminal results are labeled separately. You can compare any two legal moves,
replay positions, undo, review a complete game and export custom weights.

Established engineering results:

- [Faster flipping production acceptance](docs/FAST_FLIPS_PRODUCTION_ACCEPTANCE.md):
  the shared native engine and rebuilt packaged Wasm retain the qualified kernel.
  The original [M4 experiment](docs/FLIP_OPTIMIZATION_MAC.md) saved about 37% on
  twelve exact roots and 12–15% on opening/middle/coaching; the independent
  [WSL2 GCC 15 experiment](docs/FLIP_OPTIMIZATION_PC.md) saved about 25–27% exact
  with portable flags and 34–36% with host tuning. These are separate matched
  comparisons. Shorter searches may reach deeper horizons at fixed time budgets;
  no measured playing-strength improvement is claimed.
- [M4 native/Wasm optimization and acceptance](docs/MAC_NATIVE_WASM_OPTIMIZATION_RESULTS.md):
  before faster flipping, specialized final-empty handling reduced its exact batch by about
  26% native / 33% Wasm. A compact TT was slower and rejected. All 96 Chromium
  acceptance games and 256 native/Wasm backend games passed independent replay.
- [Actual Safari 27.2 qualification](docs/SAFARI_QUALIFICATION.md): numerical,
  worker, coaching, frozen-model and custom-weight browser acceptance.
- [Windows PC / WSL2 / Chrome / Edge qualification](docs/PC_TO_MAC_HANDOFF.md):
  Python 3.14, GCC 15, CPU-target comparisons and documented platform limits.
- [Reusable M4 hardware sampling investigation](docs/PROFILING_METHODS_AND_VIEWS.md):
  collection mechanisms, measured interference and address/context views.

These reports describe their actual machines, versions and workloads. Production
browser acceptance runs on this M4; post-merge Windows-browser/WSL2 launcher checks
are a short follow-up, and Intel Mac hardware is not newly tested.

## Optional native C++ research startup

A C++17 compiler and Node 20+ are needed to build the research executable and
export verified frozen coefficients. Node is a development/test tool, not a play
dependency. The Mac environment currently uses Node 24.22.1 and Apple Clang 21.

```bash
npm run native:build
npm run native:test
npm run native:play -- 80 P 2026103001
```

`CXX` selects another compiler. Research clients can use
[`scripts/native/client.mjs`](scripts/native/client.mjs) or
[`scripts/native/client.py`](scripts/native/client.py). Python can use an
already-built persistent native engine without Node at runtime. See the
[native engine](docs/NATIVE_SEARCH_ENGINE.md), [Wasm integration](docs/WEBASSEMBLY_INTEGRATION.md)
and [build provenance](docs/WEBASSEMBLY_BUILD.md). Building a profiler harness is
separate from launching the browser game.

## Development and tests

Run tests serially, outside timed measurements:

```bash
node --test tests/*.test.mjs
python3 -m unittest discover -s tests -p 'test_*.py'
```

Fast engine and profiling-model checks:

```bash
node --test tests/rules.test.mjs tests/search.test.mjs tests/fast-features.test.mjs tests/native-search.test.mjs tests/wasm-engine.test.mjs tests/profiling.test.mjs
```

The profiling collector is macOS-specific; the read-only explorer uses the same
Python server on supported platforms. See
[the reproducible profiling workflow](scripts/profiling/README.md),
[architecture](docs/ARCHITECTURE.md) and [validation](docs/VALIDATION.md).

## Research history

B remains the original production reference. L and P are frozen research models.
The completed 2,048-game P confirmation has favorable numerical results but a
historical training-target collision blocks its requested strict independence
claim. It does not authorize model promotion or another training campaign. See
[the confirmation report](docs/P_CONFIRMATION_RESULTS.md).

Older experiments, starter-archive installation and obsolete release-specific
startup paragraphs are preserved in the [historical README](docs/HISTORICAL_README.md).
The chronological [user request ledger](USER_REQUESTS.md) is authoritative;
[repository instructions](AGENTS.md) distinguish it from assistant design notes.
