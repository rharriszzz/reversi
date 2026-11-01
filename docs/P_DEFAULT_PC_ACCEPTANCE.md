# P default: final Windows PC acceptance

**PASS — Windows acceptance is complete. Ready for the next strategy-coach
session; no coach development was started.** Tested 2026-11-01 on the user's
Windows 11 / WSL2 PC against the packaged production application.

The initial working tree was clean at
`a560896ef54a3c4cec19974ed8cbc2064e177e4b`. `git fetch origin` verified
`origin/main` at the expected `429cb85e8621276b8ae3347a4bae8a3931f2f555`.
`git switch main` and `git merge --ff-only origin/main` safely updated the
checkout. Only this report, compact acceptance evidence and the verbatim user
request are added afterward. No application, native, model or Wasm source or
distribution changes were needed. Existing ignored research and local files
were preserved.

## Environment and identities

| Item | Actual version / identity |
| --- | --- |
| Windows | Windows 11 Home, 10.0.26300, build 26300 |
| WSL | Ubuntu 26.04.1 LTS, x86-64, kernel 6.18.33.2-microsoft-standard-WSL2 |
| CPU | Intel Core i7-14700F |
| Python / Node / GCC | Existing `.venv`: Python 3.14.4; Node v24.16.0; GCC 15.2.0 (Ubuntu 15.2.0-16ubuntu1) |
| Browser automation | Existing Playwright 1.64.1, actual Windows browser processes over CDP |
| Chrome | 156.0.8078.48 |
| Edge / Windows HTTP default | 156.0.4314.58 / `MSEdgeHTM` |
| Native dispatch build fingerprint | `9e9da3ee94688c50fdcd8110f5e3f89a5b2539ee4247e9c7914ecceee239216c` |
| Native dispatch executable SHA-256 | `09d0df1c895466768b986696cdf5300ff8a208b5d82ffe5cab03e6ae880a34db` |
| Production Wasm fingerprint / ABI | `934b888ad89f8d754d1ace6acfcd3cd84b6b48e948431916153d5d29c5f2b223` / 1 |
| Fetched Wasm SHA-256 | `7a9d43dd937af75999d5db11b018bd98a1d87eb655bbf05053957993dec0c9d0` |
| Packaged JS module SHA-256 | `95dbaf41ff32dbf04f41d6ff8936f8bf113ffbdbc0beafa2f69f481f00fb72c6` |

Frozen models agree in native execution, the manifest and both browsers:
B `original-production`,
L `ecf3fd376c680ced77d0b002ea2efb9fa4385737c4fffff734b901ab2968d97f`,
P `de4b84745589b0384ea3639f879e3c98990e802d176298ff8ef54f681520067f`.
Wasm was not rebuilt.

## Tests and results

The prescribed commands used the existing environment:

```bash
export REVERSI_PYTHON="$PWD/.venv/bin/python"
NATIVE_CPU=dispatch node --test tests/native-search.test.mjs tests/runtime-cpu-dispatch.test.mjs
node scripts/runtime-cpu-mac/verify-production.mjs
for browser in chrome edge; do
  export REVERSI_WINDOWS_BROWSER=1 REVERSI_WINDOWS_CHANNEL="$browser"
  export REVERSI_WASM_OUTPUT=".local-research/p-default-pc-$browser"
  "$REVERSI_PYTHON" tests/browser_check.py
  "$REVERSI_PYTHON" tests/wasm_browser_check.py
  export REVERSI_PC_FINAL_OUTPUT=.local-research/p-default-pc-acceptance-20261101
  "$REVERSI_PYTHON" scripts/windows-pc/production-acceptance.py
done
./start.sh --port 0
```

| Gate | Result |
| --- | --- |
| Focused native search / CPU dispatch | **12 pass, 0 failures, 0 skips** |
| Production source, model, ABI and artifact verifier | **Pass** |
| `browser_check.py` | **Pass in Chrome and Edge** |
| `wasm_browser_check.py` | **Pass in Chrome and Edge** |
| Existing production browser/package gate | **Pass in Chrome and Edge** |
| Normal Windows default-browser launch / Ctrl+C shutdown | **Pass** |

Native coverage includes frozen coefficients, independent rules/flips and exact
endgames, B/L/P minimax, TT/model/horizon changes, passes/terminal conditions,
completed-depth/cancellation recovery and both CPU backends. Automatic dispatch
reports `x86-popcnt-bmi1-bmi2-lzcnt`; all four features are detected. Forced
`REVERSI_CPU_BACKEND=portable` reports `portable`. Both retain the same frozen
models and 10,485,760-byte table. The dispatcher test also exercises more than
1.2 million flip cases per backend, state retention and guarded selection.

Each browser verifies fresh-profile **P**, explicit B/L/P preference preservation,
custom/unknown preference migration to P, reload and unchanged historical saved
model bytes. Actual first analysis requests P and returns P's frozen identity.
Both human colors, keyboard comparison, equal-depth alternatives, verified PVs,
undo/replay, active-search cancellation and model switching pass. Each Wasm check
completes B and P games, independently replays every placement and terminal
count, and reviews them with the selected evaluator: B has 60 placements and
10 forced passes; P has 59 placements and 7 forced passes in each browser.
These are functional fixtures, not strength experiments.

Missing Wasm makes first-visit P fail visibly without substitution. In-place
**Retry engine** succeeds after routing is restored; **Use B instead** explicitly
selects the working JavaScript fallback. Switching back to unavailable P fails
honestly; returning to B recovers. Injected ABI mismatch fails closed and recovers
on reload. Both browsers report no unexpected page errors.

The existing additional production gate verifies the HTTP-fetched binary hash,
current manifest/models and absence of experimental artifact requests. Per
browser, all 12 B/L/P opening alternatives match native full-window values;
36 PV placements are checked. P's 80-ms reply agrees with native search at its
completed depth. Busy-worker cancellation/restart increases created workers
3→6 with three terminations, without stale history. Disposable profiles are
removed, owned browser processes exit and gate servers close their ports.
Both resulting review screenshots were visually inspected; P's label fits.

## Normal launch, limits and publication

`./start.sh --port 0` opened `http://127.0.0.1:41533/` in the actual Windows
default **Edge** window. A read-only Windows UI Automation check identified its
URL, 64 board cells and live **P · WebAssembly** equal-depth analysis. Only that
verified single-tab application window was closed; preferences were unchanged.
Ctrl+C returned server exit **0**, and port **41533** was confirmed closed.
No owned browser, native client, proxy or server process remains. Three older
temporary test directories from October 30 were identified and preserved.

The older `scripts/windows-pc/launcher-ui.ps1` interactive helper initially failed
on a null element and then on reading the selected evaluator option. Its URL and
board checks succeeded. An ignored read-only extraction of its existing lookup
and metric functions completed the launch check and closed the verified window;
no application or tracked test was changed to obtain a pass. Interactive play,
switching and review were independently covered in both disposable browsers.

Remaining nonblocking limits: existing test-fixture GCC misleading-indentation
warnings, cosmetic `/favicon.ico` 404, and this legacy dropdown-automation issue.
A resource snapshot showed about 6.10 GiB WSL available and 0.42 GiB Windows
available; functional tests passed, with no system settings changed. This short
acceptance makes no performance claim and repeats no optimization, training or
tournament campaign. Mac runtime qualification remains in the
[integration report](P_DEFAULT_INTEGRATION.md); no new Mac or older-CPU hardware
execution is claimed here.

[Compact receipt](data/p-default-pc-20261101/receipt.json) records successful
browser results, identities, cleanup and hashes of local logs. Raw evidence and
screenshots remain ignored under `.local-research/p-default-pc-acceptance-20261101`
and `.local-research/p-default-pc-{chrome,edge}`.

Publication uses `git diff --check`, an explicit add of these documentation files,
`git commit -m "Record final Windows acceptance of P default"`, `git fetch origin`,
`git push origin main`, and `git ls-remote origin refs/heads/main`. The final
commit hash and verified remote equality are returned after publication, avoiding
a self-referential hash in this report.
