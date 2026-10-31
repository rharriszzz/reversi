# M4 integration qualification

This is a bounded acceptance procedure, not another compiler or learning
campaign. All demanding commands run **serially**. Keep the existing SDK,
strict FP flags and default memory settings. The historical fast-flip and PC
experiments remain untouched; this harness compiles only ordinary old/new
engines and uses their corresponding headers for the same driver.

Use a separate worktree, the existing project Python environment and a **fresh**
ignored output directory. The completed evidence is under
`.local-research/runtime-cpu-mac-20261031`; do not overwrite it.

```bash
export REVERSI_PYTHON=/Users/rharris/git/reversi/.venv/bin/python
export REVERSI_FLIP_RUN="$PWD/.local-research/runtime-cpu-mac-new"
export REVERSI_DISPATCH_RUN="$REVERSI_FLIP_RUN"
export FLIP_TAGS=original,selected FLIP_SELECTED_TAG=selected
node --test --test-concurrency=1 tests/*.test.mjs
"$REVERSI_PYTHON" scripts/runtime-cpu-mac/artifacts.py old
node scripts/runtime-cpu-mac/build.mjs
node scripts/fast-flips/qualify.mjs
node scripts/runtime-cpu-mac/verify-interruption.mjs
NATIVE_SANITIZE=1 node --test --test-concurrency=1 tests/native-search.test.mjs tests/native-v2.test.mjs tests/mac-endgame.test.mjs
"$REVERSI_FLIP_RUN/selected/micro" --check
FLIP_REPS=7 "$REVERSI_PYTHON" scripts/fast-flips/run.py integrated-final "$REVERSI_PYTHON" scripts/fast-flips/integrated.py
node scripts/fast-flips/verify-timed.mjs
CXX=c++ "$REVERSI_PYTHON" scripts/fast-flips/pc-verify-exact.py
node scripts/wasm/build.mjs
"$REVERSI_PYTHON" scripts/runtime-cpu-mac/artifacts.py first
node scripts/wasm/build.mjs
"$REVERSI_PYTHON" scripts/runtime-cpu-mac/artifacts.py compare
node scripts/runtime-cpu-mac/verify-production.mjs
node scripts/fast-flips/production-wasm-qualify.mjs
node scripts/wasm/internals.mjs
"$REVERSI_PYTHON" scripts/runtime-cpu-mac/compatibility.py
REVERSI_BROWSER_CHANNEL=chrome "$REVERSI_PYTHON" scripts/fast-flips/run.py chrome-browser "$REVERSI_PYTHON" scripts/runtime-cpu-mac/browser.py
REVERSI_WASM_OUTPUT="$REVERSI_FLIP_RUN" REVERSI_BROWSER_CHANNEL=chrome "$REVERSI_PYTHON" scripts/wasm/fast-flips-production-acceptance.py
REVERSI_WASM_OUTPUT="$REVERSI_FLIP_RUN" REVERSI_BROWSER_CHANNEL=chrome "$REVERSI_PYTHON" tests/wasm_browser_check.py
REVERSI_SAFARI_OUTPUT="$REVERSI_FLIP_RUN/safari-benchmark" "$REVERSI_PYTHON" scripts/fast-flips/run.py safari-browser "$REVERSI_PYTHON" scripts/runtime-cpu-mac/safari-benchmark.py
REVERSI_SAFARI_SHORT=1 REVERSI_SAFARI_OUTPUT="$REVERSI_FLIP_RUN/safari" "$REVERSI_PYTHON" scripts/mac/runtime-cpu-safari.py
"$REVERSI_PYTHON" scripts/runtime-cpu-mac/analyze.py
```

Run Safari with an unlocked desktop. It uses actual WebDriver clicks/keys and
retains all frozen-model acceptance gates, without starting a training run.
Verify `./start.sh --port 0` visibly opens the actual default browser; close
only that test tab and stop its server with Ctrl+C. Check the listening socket
is closed. Do not infer that test from `--no-browser` acceptance.

The shared resource wrapper has its historical 90-minute hard limit; this
procedure's **operational cap is 30 minutes** of active measurement. Its three
measurement stages used 246.23 seconds in the accepted run. Stop before another
stage if it would exceed the operational cap. Never run a suite or compiler
alongside measurements.

After the final full Node/Python/sanitizer runs, the receipt script compacts and
independently audits the logged acceptance. `--publish` expects the completed
log/launcher/environment receipts named in its source and refuses missing gates.
The ordinary public audit needs neither SDK, private research data nor browsers:

```bash
node scripts/runtime-cpu-mac/verify-production.mjs
"$REVERSI_PYTHON" scripts/runtime-cpu-mac/evidence.py
```

`scripts/fast-flips/verify-production.mjs` intentionally remains pinned to the
previous distribution. Run that historical check at `6b480ed`, not against
new sources. The new verifier independently pins all seven provenance files to
the qualified `911ce40` history, reconstructs the fingerprint, checks every
artifact hash, frozen coefficients, ABI/exports and unchanged options, and loads
the actual new module. It does not relax the historical source-hash gate.
