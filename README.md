# Reversi

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

## Features in starter v0.1

- Play Black or White against the computer; selectable search depth 2–6, undo, and game replay.
- Legal Reversi moves, disc flips, mandatory passes, and correct game termination.
- All legal moves scored at **the same search depth**, with negamax, alpha-beta, move ordering, and a transposition table.
- Click any move in the analysis table to inspect its score, an illustrative search continuation, and immediate positional feature contributions.
- Replay past positions and analyze your alternatives.
- Phase-dependent heuristic features: corners, mobility, potential mobility, vulnerable X/C squares, frontier discs, and disc count.
- Experimental weight tuning by seeded, paired self-play games, with model persistence in local browser storage and JSON export.
- Background Web Workers separate opponent search and learning from the UI.

**Interpretation:** Heuristic search scores are *not* win probabilities or predicted final disc margins. Immediate feature contributions do *not* decompose the score from a multi-ply alpha-beta search. Search lines are illustrative until the principal variation is independently verified. The starter learning tournament is not proof of improved strength.

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

The first tests check rules, opening perft counts, short endgames, search, seeded learning, and a fake-DOM UI smoke test. The second checks the Python HTTP launcher. An actual browser end-to-end test on **both WSL2/Windows-browser and macOS** is still required; success here on Linux does **not** establish that those environments were tested.

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
| `src/search.js` | Original negamax alpha-beta and legal-move scoring |
| `src/learning.js` | Seeded candidate weights and paired self-play comparison |
| `src/worker.js` | Background search/training workers |
| `src/app.js` | Browser game, move explanations, replay, persistence |
| `index.html`, `style.css` | Browser UI |
| `start.sh`, `start_windows.cmd`, `launch.py` | WSL2/macOS/Windows launchers |
| `tests/` | Automated verification |

## Next development steps

See `CODEX_PROMPT.md` for the ordered tasks, acceptance criteria, and model recommendation. Priorities are rules/search verification, real browser tests on both platforms, reliable coaching explanations, sound learning comparisons, and finally performance improvements supported by profiling.
