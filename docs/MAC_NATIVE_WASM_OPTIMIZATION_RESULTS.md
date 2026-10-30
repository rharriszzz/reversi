# M4 Mac native/Wasm modernization and optimization qualification

This report is in progress. Stage 1 qualifies current shared source on the M4;
optimization experiments and the frozen final acceptance campaign follow in
separate checkpoints. No evaluator is trained or promoted. Historical P/B
results and their provenance restrictions remain intact.

## Stage 1: environment and current-source qualification

The clean Mac checkout was fetched with `git fetch origin` and fast-forwarded
with `git merge --ff-only origin/main`, from `c605503` to `7dfb056`. There were
no unrelated working-tree changes. Both requested PC commits are present.

Actual hardware: iMac Mac16,3, Apple M4, ten cores (four performance, six
efficiency), 24 GiB RAM. macOS 27.2 / build 26B123; Xcode/Instruments 27.2,
Apple Clang 21.0.0. No GCC installation or OS upgrade was necessary. Initial
free disk was about 519 GiB. Spotlight and Time Machine were initially busy;
timing was deferred. Memory pressure was normal, estimated readily reclaimable
memory approximately 8.5–8.8 GiB and allocated swap 0.38 MiB. macOS provides no
Linux-style MemAvailable; the recorded estimate is explicitly described in
the resource certificate. Historical swap allocation is not a swapping rate.
No applications, services, power, security or browser preferences were changed.

| Tool | PC | Qualified Mac selection |
| --- | --- | --- |
| Python | 3.14.4 | **3.14.10**, `.venv/bin/python`, ARM64 |
| Node | 24.16.0 | **24.22.1**, existing MacPorts |
| npm | 12.0.2 | **12.2.1**, user-scoped, selected by `.venv` activation |
| Codex CLI | 0.166.0 | **0.166.0**, existing user installation |
| Playwright / WebSockets | 1.64.1 / 15.0.1 | Same versions |
| NumPy / Matplotlib | 2.5.4 / 3.11.2 | Same versions |
| Emscripten | qualified 4.0.22 artifacts | **4.0.22**, existing user SDK, LLVM 22 |
| Native compiler | GCC 15.2 | Apple Clang 21; features/numerics qualified independently |
| Actual browser | Chrome 156.0.8078.48 | Chrome **156.0.8078.74** |
| Safari | not applicable | 27.2, automation qualification pending |

MacPorts 2.12.7 offers Python 3.14.10, but installation requires an unavailable
administrator password. A single user-managed Astral standalone CPython was
installed with a local uv 0.13.6 bootstrap instead. Apple's Python and MacPorts
selections remain untouched. Existing research venvs retain their historical
Python 3.13 metadata; active project work selects `.venv`. Minimum supported
Python remains **3.13**. See [interpreter setup](PYTHON_ENVIRONMENT.md) and
[exact Mac developer dependencies](../requirements-dev-mac-20261030.txt).

`sys.executable`, `sys.version`, prefix/base prefix, PATH, dependency versions,
Node-to-Python selection and actual Emscripten Python subprocess observations
are recorded in the [Stage 1 certificate](data/mac-stage1-qualification-20261030.json).
All direct Python tests, browsers, reports and benchmark commands use `.venv`;
Python children use `sys.executable`. Node and SDK wrappers select that same
interpreter. No assumption is made from the shell's bare `python3` alone.
`pip check`, imports, Playwright startup and actual browser automation pass.

Two clean production Wasm compilations produce byte-identical manifests and
artifacts, including the current shared completed-iteration correction. An
additional Python-audited build is identical. Old build identity
`5dab45b8a8edfae11a0c9b3821f296a3ee6d06ed5f52c9394cef4e95d9cb1cef`
and its artifact hashes are preserved in the certificate. New build identity:
`2f1bd1d7fc0ce143969cb2cde9b1175aeb09c7b42e492f24b09d37f5f662dc37`.
B/L/P coefficients, model identities, ABI 1, numerical tolerance 1e-10,
floating-point restrictions and bounded memory remain unchanged.

The initial fast panel exposed a real Mac concurrent-build publication race:
separate temporary Mach-O link outputs can have different hashes. Atomic rename
alone did not make both client receipts coherent. Native builds now serialize
cache lookup/compilation/publication per output directory, reclaim only a
recorded dead owner's lock, and retain atomic output publication. A real
three-process fresh-build regression passes. No search mathematics changed.

Stage 1 passes **171 Node tests**, **39 Python 3.14 tests**, **15 ASan/UBSan
groups**, 23 targeted build/native/Wasm tests and the compiled-Wasm standalone
assertions. Broad native qualification checks **2,007 positions, 12,042 static
queries, 96,720 legal children, 96 fixed searches and 12 independent endgames**;
all recorded numerical errors are zero. Wasm qualification includes all B/L/P
cells/weights, full-window alternatives and optimal PV steps, terminal empties,
forced passes, horizons 15/16/64, interrupted iterations/null fallback,
collisions, generation rollover and bounds/model/horizon isolation.

Actual installed Chrome passes B/L/P coaching, complete B/P games and review,
timed play, undo/replay, cancellation/recreation, reload, fallback/refusal,
injected ABI failure/recovery, and the separate custom-weight persistence,
training/export/full-game/review check. SDKs, venvs, local binaries, browser
profiles, raw traces and personal exports are not committed. Existing nonfatal
Python HTTPError ResourceWarnings remain visible.

Reproduce Stage 1 from the repository, in macOS zsh/bash or WSL2 bash with
appropriate installed tools (these Mac results do not newly test WSL or Intel):

```bash
source .venv/bin/activate
python -m pip check
node scripts/native/build.mjs
node scripts/wasm/build.mjs
node --test tests/native-build.test.mjs tests/native-search.test.mjs tests/native-v2.test.mjs tests/wasm-engine.test.mjs
node scripts/wasm/internals.mjs
NATIVE_RUN=.local-research/mac-stage1 node scripts/native/qualify.mjs
npm test
python -m unittest discover -s tests -p 'test_*.py'
NATIVE_SANITIZE=1 node --test tests/native-search.test.mjs tests/native-v2.test.mjs
REVERSI_BROWSER_CHANNEL=chrome python tests/wasm_browser_check.py
REVERSI_BROWSER_CHANNEL=chrome python tests/browser_check.py
```
