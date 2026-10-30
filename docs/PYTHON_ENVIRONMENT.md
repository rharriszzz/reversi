# Python selection and developer dependencies

All active development, research, tests, benchmarks, browser automation and play
require **Python 3.13 or newer**, declared in `pyproject.toml`. This PC qualifies
CPython **3.14.4**; macOS must be qualified separately. Python is still the only
application dependency besides a modern browser. Optional developer packages
are never imported by application startup.

## WSL2 and macOS

Choose an installed supported interpreter explicitly, then activate the project
environment. For the upgraded PC:

```bash
cd ~/git/reversi
python3.14 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-dev-pc-20261030.txt
python -m pip check
python -c 'import sys; print(sys.version); print(sys.executable); print(sys.prefix)'
./start.sh
python -m unittest discover -s tests -p 'test_*.py'
npm test
```

The PC's Ubuntu installation lacks `ensurepip`, so the normal `venv` command
failed. This was resolved without a system package install using PyPA's
user-scoped virtualenv zipapp:

```bash
mkdir -p .local-research/python-tools
python3.14 -c 'import urllib.request; urllib.request.urlretrieve("https://bootstrap.pypa.io/virtualenv.pyz", ".local-research/python-tools/virtualenv.pyz")'
python3.14 .local-research/python-tools/virtualenv.pyz --python /usr/bin/python3.14 .venv
source .venv/bin/activate
python -m pip install -r requirements-dev-pc-20261030.txt
```

The downloaded bootstrap and environment stay ignored. The qualification
certificate records the bootstrap hash and complete package versions. Do not
reuse a venv across a Python minor-version upgrade: the old project's venv had
3.10 package directories even though `/usr/bin/python3` now resolved to 3.14.
Its metadata is retained locally; the old browser venv path now links to `.venv`.
The single active 3.14 environment serves development, plotting and automation.

`start.sh` and Node's `scripts/python.mjs` choose `REVERSI_PYTHON`, then an
activated `VIRTUAL_ENV`, then repository `.venv`, then `python3`. An explicitly
selected unavailable/old interpreter fails; it never silently selects another.
The launcher and Node helper reject Python below 3.13. Python parents use
`sys.executable`; research launchers also pass that selection to Node through
`REVERSI_PYTHON`. To override selection for one command:

```bash
REVERSI_PYTHON="$PWD/.venv/bin/python" node scripts/native/benchmark.mjs
```

Wasm SDK setup, production compilation and standalone assertion compilation
also export the selected interpreter as `EMSDK_PYTHON`. The pinned upstream
[compiler wrapper](https://github.com/emscripten-core/emscripten/blob/4.0.22/em%2B%2B)
and [SDK wrapper](https://github.com/emscripten-core/emsdk/blob/4.0.22/emsdk)
honor that variable; otherwise an SDK can select its own bundled Python. This
PC did not install an SDK or rebuild the production artifact. Repeat the actual
SDK/Python 3.14 compilation check on the Mac before claiming it qualified.

For direct `python3 scripts/...` commands, activate `.venv` first. Bare `python3`
uses the shell's PATH; metadata cannot change that. Preserved scientific
snapshots and historical report reproduction strings retain their original
interpreters and identities; they are provenance, not active environments. Do
not resume an old completed experiment or rewrite its execution certificate to
make it match modernized source. A future authorized experiment needs a fresh
source identity. No historical coefficients/results were migrated or retrained.

## Codex and VS Code

Launch Codex from the WSL repository after `source .venv/bin/activate`, or set
`REVERSI_PYTHON` to the absolute environment interpreter in that terminal. Verify
`python -c 'import sys; print(sys.executable, sys.version)'` in the task shell.
This requires no shell startup edits. A fresh agent shell can use the explicit
`.venv/bin/python` path; Node and `start.sh` detect it without activation.

Open VS Code using its WSL connection for this checkout. The repository's
`python.defaultInterpreterPath` points to `${workspaceFolder}/.venv/bin/python`.
If VS Code has cached another interpreter, use **Python: Select Interpreter**
and select that path; verify in a newly opened integrated terminal. This editor
selection alone does not govern arbitrary external terminal commands.

## Native Windows convenience launcher

Install a Windows Python 3.13+ interpreter separately from WSL. `start_windows.cmd`
tries `REVERSI_PYTHON`, active Windows `VIRTUAL_ENV`, `.venv\Scripts\python.exe`,
then `py -3`, then `python`. `launch.py` rejects an interpreter below 3.13 before
opening a server/browser. Set the Windows environment override if `py -3`
selects an older installation. A Linux `.venv` cannot be used by Windows Python.
Actual native Windows Python launch remains separately unqualified in this round;
the browsers run on Windows while Python hosting runs under WSL2.

## Mac setup

Install a user-managed Python 3.13+ using a Python.org macOS installer, Homebrew
(`brew install python@3.14`, if already using Homebrew), or an existing Python
version manager. Do not replace Apple's system interpreter or change its
symlinks. Explicitly run that installed interpreter with `-m venv .venv`, activate,
and install the recorded developer requirements. Both ARM64 and Intel need
separate native package/interpreter checks; do not copy the PC venv. Python 3.13
is supported by policy but this step's actual test evidence is Python 3.14 only.
