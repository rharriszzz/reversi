# Reversi

**Browser WebAssembly update:** select **B**, **L** or **P** to use the qualified
shared C++ engine locally for playing, all-move coaching and review. Choose
80 ms or 300 ms for timed play. Existing saved/custom weights remain the initial
selection and retain JavaScript training/export. See the
[complete browser results](docs/WEBASSEMBLY_ENGINE_RESULTS.md).


**Native search backend complete:** the original C++17 bitboard engine supports
exact frozen B/L/P and persistent Node/Python research play. In the corrected
768-game engineering screen, native P scored **76.95% at 80 ms** and **70.51% at
300 ms** against the same P using JavaScript. All games and paired statistics
passed independent audits. See [the technical report](docs/NATIVE_SEARCH_ENGINE.md).
Browser play/coaching still use JavaScript, and B remains the browser default.

**Frozen P confirmation completed:** all 2,048 games finished. P scored **63.57% at 80 ms** and **61.72% at 300 ms**; paired, bootstrap and Hoeffding numerical criteria favor P at both controls. A played two-empty board reused an actual older historical training target, and further historical roles remain unresolved, so the requested independent-confirmation claim is blocked. B remains production. Read [the complete results](docs/P_CONFIRMATION_RESULTS.md). Do not resume this completed run, regenerate its sample, retrain, promote P, or launch another tournament automatically. Preserve all new games/reservations as historical evidence for any future authorized work. Earlier status paragraphs below retain historical handoffs.

The [M4 iMac / Windows WSL2 research benchmark](docs/MAC_PC_BENCHMARK.md) uses disclosed fixed positions, checks the patched teacher and numerical equivalence, and measures complete labeling, search, solving and fitting tasks. It requires no private research corpus; native M4 and PC results now show about 14–22% faster single-worker tasks on the Mac, with larger independent-task throughput under the measured memory limits.

**Latest constraint/pattern study completed:** all 256 reserved assessment sources and 128 root-transfer positions were evaluated. The original positional gates failed, and newly revealed PV collisions blocked the strict independence qualification; no confirmation games or promotion followed. The report identifies a terminal-utility incompatibility dominating preference loss, alongside substantial old-development gains after relaxing regularization. See [the complete results and coefficients](docs/NEXT_RESIDUAL_RESULTS.md). B remains production. Earlier status paragraphs below preserve prior handoffs; the preceding residual experiment is also completed, as recorded in its results.

**B-preserving residual experiment, first session paused:** the 24-root pilot passed and all **1,600 training sources** were labeled, yielding 44,790 supported preferences. Development, locked assessment and confirmation remain unopened. The corrected forecast fits the eight-hour scientific ceiling with sustained two-worker capacity, but exceeds it at one worker. Full targets remain unchanged. See the [frozen protocol](docs/RESIDUAL_FRONTIER_PROTOCOL.md) and [audited results, worker history and exact resume command](docs/RESIDUAL_FRONTIER_RESULTS.md). B remains production; no learned strength improvement is established.

**Teacher qualified in V4R1:** D10/R12 passed all eight predefined gates on the complete 256-root reliability and 64-root independent exact samples. It found 56 stable useful corrections to B, including 19 early-game corrections; all 449 exact-endgame alternatives matched independently. The authorized retry preserved V4's unopened assessment set and repaired optional-depth scheduling. See [the full results](docs/TEACHER_DEPTH_QUALIFICATION_V4.md) and [the 21-weight frontier residual experiment plan](docs/RESIDUAL_FRONTIER_EXPERIMENT_PLAN.md). The separately authorized residual experiment is described above; B remains production.

**Stage A teacher audit:** Edax passed independent exact validation, but depth-eight/depth-ten stability was 70.8%, below the 90% gate. Stage B was not started; B remains production. See [the teacher audit](docs/TEACHER_AUDIT.md).

**Deeper teacher qualification:** D10/D12/D14 calibration completed, but an independent twelve-empty reference exceeded its fixed ten-second cap. Qualification stopped before the locked assessment; no training started. See [the results and next action](docs/TEACHER_DEPTH_QUALIFICATION.md).

**Independent solver optimized:** the previously capped board now completes both terminal conventions in about 64 ms. All 44 engineering roots matched Edax on every awarded-empty alternative. The teacher qualification remains incomplete; no qualification or training was launched during that engineering round. See [exact solver optimization](docs/EXACT_SOLVER_OPTIMIZATION.md).

**Teacher qualification V3:** D10/R12 was selected after complete fresh calibration, including D16. The fixed assessment stopped at 154/256 roots when Edax emitted a bounded `>+63` result; no invalid label was accepted. The complete early sample contains 27 useful estimated corrections to B, but qualification remains incomplete and no training started. See [V3 evidence and the focused next action](docs/TEACHER_DEPTH_QUALIFICATION_V3.md).

**Edax interface repaired:** a separate, hashed experimental build resolves the bound at the requested fixed horizon and passes independent endgame, horizon and window checks. All 308 completed V3 root/depth results are unchanged. That engineering round prepared fresh V4 reservations without opening assessment; the subsequent completed qualification is reported above. See [the diagnosis, overhead and V4 launch recommendation](docs/EDAX_BOUND_RESOLUTION.md).

**Previous research:** the frozen long-pattern screen completed all 288 games within its cap and did not beat B. B remains production; no new long training run is recommended. See [the results and engineering round](docs/NEXT_EVALUATOR_RESEARCH.md), [profiling](docs/PERFORMANCE_PROFILING.md), [language comparison](docs/LANGUAGE_COMPARISON.md), and [worker scaling](docs/RESOURCE_SCALING.md).

**Proposed GitHub repository:** `rharriszzz/reversi` (one word).

**Application:** Reversi Coach Lab — an original Reversi/Othello opponent and learning-oriented browser interface. The game code, alpha-beta engine, feature evaluator, and self-play learning experiment are included. No external Reversi engine, build service, subscription, or network connection is required to play. The local HTTP server uses only the Python 3 standard library.

## First start: Windows 11 WSL2 (recommended)

1. Save `reversi-starter.zip` from the chat on Windows. If it is in your Windows Downloads folder, extract it **within WSL** to your Linux home directory. For example:

   ```bash
   mkdir -p ~/git
   unzip '/mnt/c/Users/<WINDOWS_USERNAME>/Downloads/reversi-starter.zip' -d ~/git
   cd ~/git/reversi
   ./start.sh
   ```

   Replace `<WINDOWS_USERNAME>` with your actual Windows user directory name. If `unzip` is unavailable, install it (`sudo apt install unzip`) or extract with Windows Explorer and copy the folder into WSL. You can always run `python3 launch.py` from the project directory instead of `./start.sh`.

2. The server prints a URL such as `http://127.0.0.1:8000/`. On WSL2 it tries to open **your Windows default browser** through Windows PowerShell. If that fails or WSL integration is disabled, open the printed URL manually in Windows Chrome/Edge. The server binds only to local loopback.
3. Keep the WSL terminal running during play. Press **Ctrl+C** to stop. You may use `./start.sh --no-browser` to suppress automatic browser launch.

HTTP access and error messages go to `logs/http.log`, with rotation at 1 MB and up to three backups. The terminal prints the URL and log location. Use `./start.sh --http-log /tmp/reversi-http.log` to choose another file; relative paths are relative to the calling directory. Logs are ignored by Git. `--port 0` chooses an OS-assigned port; otherwise the launcher tries 8000–8009.

**WSL note:** Save and develop under the Linux filesystem (for example, `~/git/reversi`) instead of `/mnt/c/...`. This typically gives better file-system performance for Git and development tools. Windows 11 normally forwards `localhost` connections into WSL2. If you have disabled WSL localhost forwarding or altered WSL networking, open the URL in a browser within WSL or restore localhost forwarding.

## First start: current macOS (Apple Silicon or Intel)

With Python 3 available:

```bash
mkdir -p ~/git
unzip ~/Downloads/reversi-starter.zip -d ~/git
cd ~/git/reversi
./start.sh
```

The macOS `open` command starts the default browser. If no browser opens, use the URL printed by the server. `python3 launch.py` is an equivalent fallback. This app does not require Xcode, Homebrew, Node, or architecture-specific native binaries **to play**. Install Python 3 if your Mac does not have it.

## Optional: native Windows 11 (outside WSL)

Double-click `start_windows.cmd`, or execute `py -3 launch.py` from PowerShell. This path is retained but WSL2 is the main development target.

**Do not open `index.html` with a `file://` URL.** The app uses JavaScript modules and Web Workers, so serve it through `launch.py`.

## Features

- Play Black or White against the computer; selectable search depth 2–6, undo, and game replay.
- Legal Reversi moves, disc flips, mandatory passes, and correct game termination.
- All legal moves scored at **the same search depth**, with negamax, alpha-beta, move ordering, and a transposition table.
- Click any move in the analysis table (or focus it and press Enter/Space) and choose any comparison move. Both moves show backed-up scores, their difference, verified continuations, searched replies, and actual mobility/corner/pass facts from those lines.
- After a game, **Review my completed game** ranks your decisions by search-point loss at the selected coach depth and current model. Click a decision to replay it.
- Replay past positions and analyze your alternatives.
- Phase-dependent heuristic features: corners, mobility, potential mobility, vulnerable X/C squares, frontier discs, and disc count.
- Experimental weight tuning by seeded, paired self-play games, with model persistence in local browser storage and JSON export.
- Background Web Workers separate opponent search and learning from the UI.

**Interpretation:** Heuristic search scores are *not* win probabilities or predicted final disc margins. Immediate feature contributions do *not* decompose the score from a multi-ply alpha-beta search. Each continuation move is verified against a full-window search at the stated remaining depth; tied replies can produce different lines. A “solved” row uses terminal search values (win/loss plus actual disc margin, or zero for a draw). Limited-depth results remain heuristic. The learning tournament is not proof of improved strength.

The positional evaluator has a sensible set of features, but its hand-selected weights are not calibrated against expert play. The first small held-out experiment was inconclusive, so the default weights remain unchanged. See [the initial review](docs/INITIAL_CODEX_REVIEW.md) for measurements and a short improvement plan.

Ordinary computer play and self-play now use a separate best-move search, sharing the original alpha-beta core while omitting all-move coaching work. The coach still searches every candidate at equal depth and verifies its lines. On the measured position set, the playing path was roughly 1.6–2.8× faster at depth 5; this is a local measurement, not a platform guarantee.

The next evaluation round tested conservative corner-anchored stable edges and smooth phase interpolation separately. The original depth-3 evaluator won 64/64 games against seeded random play and 61/64 against immediate-disc greedy play. Neither experimental evaluator nor the selected weight mutation showed convincing improvement over the original weights. See [EVALUATION_EXPERIMENTS.md](docs/EVALUATION_EXPERIMENTS.md) for costs, paired uncertainty, independently solved tactical examples, and equal-time results. Experimental evaluators are available to the benchmark tools, with no change to browser defaults or saved-model format.

## Set up the GitHub repository

1. Visit [github.com/new](https://github.com/new), set owner `rharriszzz`, name **`reversi`**, and create an **empty** repository. Do not pre-create a README or `.gitignore`; they are in this archive. Choose public/private as you wish. The archive **does not** create a remote repository for you.
2. From the extracted WSL2 directory `~/git/reversi`, run:

   ```bash
   git init -b main
   git add .
   git commit -m "Initial Reversi Coach Lab starter"
   git remote add origin git@github.com:rharriszzz/reversi.git
   git push -u origin main
   ```

   The above assumes Git SSH access to GitHub is already configured. Otherwise use `https://github.com/rharriszzz/reversi.git` and GitHub's supported authentication flow.
3. Give Codex the task in `CODEX_PROMPT.md`. For a WSL-first workflow, open the WSL path in your editor or run Codex from WSL. The same Git repository can be cloned natively on macOS.

You can alternatively have Codex perform the Git initialization and push **after** you create the empty GitHub repository and open this extracted folder as the workspace.

## Tests

Playing requires only Python 3 and a modern desktop browser. For JavaScript tests, additionally install Node.js **20 or newer**. In WSL2 or macOS:

```bash
node --test tests/*.test.mjs
python3 -m unittest discover -s tests -p 'test_*.py'
```

The JavaScript tests check rules, opening perft counts, endgames, search, seeded learning, and UI behavior. The Python tests check the HTTP launcher. Platform claims require tests on the actual platform; Linux tests alone cannot establish macOS or Windows-browser compatibility.

The expanded tests include a separate sentinel-board rules implementation, exhaustive small endgames, same-depth minimax and continuation checks, symmetries, stale-worker regressions, and training/holdout separation. Real Chromium acceptance and Windows Chrome accessing WSL2 localhost have now passed; **M4 macOS ARM64 Chromium acceptance now passes**; current Intel and WSL2
qualification limits are described in the browser report. See [platform details and optional browser commands](docs/VALIDATION.md).

Run the bounded, CPU-only evaluation experiment and search benchmark with Node:

```bash
node scripts/evaluate.mjs 8 2 > /tmp/reversi-evaluation.json
node scripts/benchmark.mjs
```

For the evaluation quality/speed/strength investigation, run these **serially** on an otherwise idle machine:

```bash
node scripts/evaluation-benchmark.mjs > /tmp/reversi-costs.json
node scripts/evaluation-experiments.mjs fixed 32 > /tmp/reversi-strength-depth.json
node scripts/evaluation-experiments.mjs solved 32 > /tmp/reversi-solved-quality.json
node scripts/evaluation-experiments.mjs learning 32 > /tmp/reversi-strength-learning.json
node scripts/evaluation-experiments.mjs timed 6 > /tmp/reversi-strength-timed.json
```

The last command plays exploratory paired games at 5/20/80 ms per move and can take a few minutes. Wall-clock results vary with machine load; fixed-depth choices are reproducible, allowing tied moves. `findBestMove()` also supports an optional `timeMs` budget for test callers: iterative deepening returns the last fully completed depth, with an explicit unsearched fallback if no iteration completes. Browser depth controls continue to use fixed depth; the coaching table never mixes horizons.

The experiment compares weight mutation and a separate linear TD(0) prototype with the default evaluator. Training and holdout openings are disjoint including board symmetries; holdout games use paired colors and equal fixed search depths. The JSON records seeds, model parameters/versions, sample sizes, and conservative uncertainty over opening pairs. Neither experimental model is installed in the browser. This run takes seconds on the development machine; deeper searches can take longer.

## Files and responsibilities

| File | Purpose |
|---|---|
| [`USER_REQUESTS.md`](USER_REQUESTS.md) | **Only the user's messages, verbatim and in order**; no assistant interpretation |
| [`CODEX_PROMPT.md`](CODEX_PROMPT.md) | Initial implementation/verification task for Codex |
| [`AGENTS.md`](AGENTS.md) | Standing engineering and evidence rules for Codex |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Design, data flow, and correctness assumptions |
| [`docs/VALIDATION.md`](docs/VALIDATION.md) | Platform matrix and manual/automated acceptance checklist |
| `src/rules.js` | Board representation, legal moves, flips, passes, termination |
| `src/features.js` | Interpretable positional features and phase-aware weights |
| `src/evaluation.js` | Separate stable-edge and smooth-phase experiments; original defaults preserved |
| `src/search.js` | Original negamax alpha-beta and legal-move scoring |
| `src/learning.js` | Seeded candidate weights and paired self-play comparison |
| `src/td.js`, `scripts/evaluate.mjs` | Separate transparent TD prototype and reproducible held-out comparison |
| `src/coaching.js`, `src/review.js` | Facts from searched lines and fixed-depth post-game review |
| `src/worker.js` | Background search/training workers |
| `src/app.js` | Browser game, move explanations, replay, persistence |
| `index.html`, `style.css` | Browser UI |
| `start.sh`, `start_windows.cmd`, `launch.py` | WSL2/macOS/Windows launchers |
| `tests/` | Automated verification |

## Next development steps

The current follow-up compares **A: original**, **B: mathematically identical but faster**, and **C: a development-selected stable-edge weight**. The baseline function and weights remain unchanged in `src/features.js`. Search now defaults to `evaluateFast` from `src/fast-features.js`: it fuses mobility/frontier/potential-mobility scanning, avoids temporary flip arrays and contribution objects, and reuses the legal-move count already computed at a search leaf. Coaching keeps the same full-window scores, verified lines and original immediate feature breakdowns. The original evaluator is still selectable through the search's `evaluate` option.

See [EVALUATOR_COMPARISON.md](docs/EVALUATOR_COMPARISON.md) for new datasets, tuning, expanded 20/80 ms paired trials, uncertainty, measured costs and a quality-versus-cost graph. C remains experimental; no stable-edge weight or pattern table is installed as the default. Runtime still needs only Python and a browser; plot generation is optional developer tooling.

See `CODEX_PROMPT.md` for the current plan and completed milestone history. The next performance experiment is allocation-light move generation. For positional knowledge, test phase-dependent stable-edge weights before fitting pattern tables, using newly reserved datasets. Mac hardware acceptance remains outstanding. Empty-region parity and combined features remain later experiments.

## Autonomous local evaluator research

**V2 campaign completed:** [final results](docs/STRONG_EVALUATOR_RESULTS_20261028.md) and [review recommendations](docs/STRONG_EVALUATOR_REVIEW.md). It accumulated 600,885 positions and completed all fixed test targets after an authorized extension. The learned finalist did not demonstrate stronger equal-time play, so B remains production. Do not resume that completed run; the launch commands below are framework documentation.

**New learning-first campaign:** use [STRONG_EVALUATOR_PLAN.md](docs/STRONG_EVALUATOR_PLAN.md), [TRAINING_DATA.md](docs/TRAINING_DATA.md), [EVALUATOR_ARCHITECTURES.md](docs/EVALUATOR_ARCHITECTURES.md) and [TRAINING_RESULTS.md](docs/TRAINING_RESULTS.md). The v2 launcher sizes workers from current physical memory, freezes its source, checkpoints small work units and resumes after Windows reboot:

```bash
python3 scripts/strong-launch.py --hours 6 --output .local-research/strong-six-hour-20261027
# After interruption or reboot:
python3 scripts/strong-launch.py --resume --output .local-research/strong-six-hour-20261027
```

Check whether that output is already running before launching. Large artifacts stay local. The older v1 commands below are retained for reproduction; use v2 for the new training program. No learned evaluator replaces B automatically.

The first full WSL2 study completed on 2026-10-27 in 4 h 26 min, within its six-hour cap, using two workers. [Published results and evidence](docs/LOCAL_RESEARCH_RESULTS_20261027.md) cover 3,088 tournament games: the learned stable-edge candidate improved late-position estimates but failed the playing-strength promotion rule. B remains the default. The [run handoff](docs/LOCAL_RESEARCH_STATUS.md) records completion and local artifact locations; do not resume that completed run.

The offline runner generates diverse games, fits linear/feature/TD(lambda)/small-pattern candidates, selects models, and conducts independent paired confirmation without any API or ongoing AI involvement. B remains the production evaluator. Node 20+ is required only for development tests and these optional experiments; playing still needs only Python 3 and a browser.

Run from a normal WSL2 or macOS terminal:

```bash
python3 scripts/research-launch.py --mode full --hours 8 --workers 4 --output .local-research/eight-hour
```

It returns a detached PID and log/report paths. Keep the machine awake and WSL running. Follow progress with `tail -f .local-research/eight-hour/launcher.log`; open `.local-research/eight-hour/report.md` for current evidence. SIGTERM/Ctrl+C checkpoints a foreground run; budget exhaustion discards unfinished pairs. To resume an interrupted run, with unchanged source:

```bash
python3 scripts/research-launch.py --resume --output .local-research/eight-hour
```

For a quick integrated check:

```bash
node scripts/research.mjs --mode smoke --seconds 30 --workers 2 --output .local-research/smoke
```

The budget is a total active wall-clock cap, including resumed sessions; fitting can stop early on development stagnation. Worker count is capped at four; timed tournaments run with other research workers stopped. Data/models/logs stay Git-ignored. No candidate is installed automatically. See [the protocol](docs/LOCAL_RESEARCH_PLAN.md) and [verified smoke evidence](docs/LOCAL_RESEARCH_SMOKE.md), including platform and execution-host limitations. Do not edit source during a run: source/input changes stop it and prevent incompatible resumption.

## Optional native research player

The C++17 bitboard backend performs complete B/L/P searches in a persistent
process. The JavaScript engine remains the reference and browser fallback;
Python + browser play still needs no build or npm install.

```bash
npm run native:build
npm run native:test
# Complete native-P versus JavaScript-P engineering game, 80 ms per move:
npm run native:play -- 80 P 2026103001
node scripts/native/qualify.mjs
```

Build requires a C++17 compiler (`c++`, or set `CXX`) and Node 20+ for verified
frozen-model export. Existing JavaScript research can import `NativeEngine` from
`scripts/native/client.mjs` or `choose`/`playGame` from `scripts/native/game.mjs`.
Python 3 can import `scripts/native/client.py` and use the already-built engine
without Node at runtime. One persistent client per serial research worker;
complete searches and all leaf evaluations stay inside C++.

See [the technical report](docs/NATIVE_SEARCH_ENGINE.md) and
[the fixed engineering screen protocol](docs/NATIVE_SEARCH_PROTOCOL.md).
Browser playing, all-move coaching and review now support selectable frozen
B/L/P WebAssembly; saved/custom weights retain JavaScript. See the
[browser integration](docs/WEBASSEMBLY_INTEGRATION.md).

Native search V2 measurements and the separately registered native P/B comparison: [engineering and results](docs/NATIVE_SEARCH_V2_RESULTS.md), [prospective protocol](docs/NATIVE_SEARCH_V2_PROTOCOL.md). Ordinary native timed play now searches to the natural empty-square limit; explicit fixed horizons remain available.

## Local WebAssembly playing and coaching

The shared C++ engine now runs locally in the browser. Start with `python3 launch.py`
(or `./start.sh`), select **B**, **L** or **P** under **Evaluator**, and choose
fixed depth or **80 ms / 300 ms** computer time. The coach and game review use the
same selected model and verified full-window continuations. No installation or
remote service is needed to play: the qualified Wasm artifacts are committed.

Your existing saved/custom model remains the initial selection and retains the
JavaScript training/export workflow. Explicit frozen-model selection is remembered
separately. P is optional; no model has been promoted or overwritten. Backend and
evaluator labels show what actually computed each result. See
[browser behavior](docs/WEBASSEMBLY_INTEGRATION.md),
[build/ABI instructions](docs/WEBASSEMBLY_BUILD.md) and
[numerical qualification](docs/WEBASSEMBLY_QUALIFICATION.md).
Historical browser/native paragraphs above describe their original release dates.
