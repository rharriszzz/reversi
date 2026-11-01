# Player interface cleanup — 2026-10-31

The application is a **Reversi opponent and strategy coach**. The experimental
self-play panel, training/reset/export controls, coefficient table, mutable
model/version state, storage reads/writes and training worker are removed from
the player interface and backend. Three workers retain analysis, play and review.
The former panel space explains comparison, score limits and replay in the
existing layout. Offline learning modules, scripts, frozen models, experiments,
receipts and published results remain intact.

At this cleanup checkpoint, B (original evaluator) was the first-visit default.
Old custom/unknown preferences resolved to B at load; valid B/L/P preferences and valid time controls survive.
L was labeled learned linear and P pattern, with no strength ranking. The
historical saved-model key is never read, changed or deleted. Selection persists
through the existing separate engine-preference key. Review titles now identify
the returned evaluator/backend, without referring to an unrelated saved version.

Starting checkout and remote main were clean and identical at
`81ac936704d58604a439014ee8fb8035b880abe2`. No search algorithm, model coefficient,
CPU-dispatch source or Wasm artifact changed. The packaged fingerprint remains
`934b888ad89f8d754d1ace6acfcd3cd84b6b48e948431916153d5d29c5f2b223`,
Wasm SHA-256 `7a9d43dd937af75999d5db11b018bd98a1d87eb655bbf05053957993dec0c9d0`.
The native dispatcher rebuild retains fingerprint `a7ba82955b15a464…` and executable
SHA-256 `09d0df1c895466768b986696cdf5300ff8a208b5d82ffe5cab03e6ae880a34db`.
The production Wasm was **not rebuilt**.

## Regression and acceptance

Windows 11 under WSL2 Ubuntu 26.04.1; Node 24.16.0, project Python 3.14.4,
GCC 15.2.0. Existing toolchains and test-only Playwright were reused.

```bash
source .venv/bin/activate
export CXX=g++ NATIVE_CPU=dispatch
npm run native:build
node --test --test-concurrency=1 tests/*.test.mjs
python -m unittest discover -s tests -p 'test_*.py'
node --test --test-concurrency=1 tests/native-search.test.mjs tests/runtime-cpu-dispatch.test.mjs tests/wasm-engine.test.mjs tests/mac-endgame.test.mjs
node scripts/runtime-cpu-mac/verify-production.mjs
```

Fast pre-change checks: 14/14. Final full Node suite: **187/187**, zero skips;
Python: **46/46**; focused native/Wasm/dispatch/endgame suite: **20/20**;
production source/artifact verification: **pass**. Full Node includes independent
rules, endgames, all-move scores/PVs, interruption/TT behavior and separate
learning/research tests. New UI cases exercise preferences, storage denial,
three workers, both colors, comparison, completed review, replay and stale
analysis/play/review responses. Research framework smoke fixtures use temporary
data only; no new scientific campaign was launched. Python retains its nonfatal
HTTPError cleanup ResourceWarning; compiler warnings in existing dispatch test
fixtures are unrelated to the cleanup.

Actual-browser commands, run serially for `chrome` and `edge`:

```bash
export REVERSI_WINDOWS_BROWSER=1
export REVERSI_WINDOWS_CHANNEL=chrome  # repeat with edge
export REVERSI_WASM_OUTPUT=.local-research/player-ui-cleanup-20261031/$REVERSI_WINDOWS_CHANNEL
export REVERSI_PC_FINAL_OUTPUT=.local-research/player-ui-cleanup-20261031
mkdir -p "$REVERSI_WASM_OUTPUT"
python tests/browser_check.py --screenshot "$REVERSI_WASM_OUTPUT/review.png"
python tests/wasm_browser_check.py
python scripts/windows-pc/production-acceptance.py
```

Actual **Chrome 156.0.8078.48** and **Edge 156.0.4314.58** pass all three browser
commands. Each verifies 36 PV placements against native and twelve coaching
alternatives across B/L/P. The four independently replayed B/P games contain
32 forced passes altogether; the separate general UI check also completes a
game in each browser. The screenshot was visually inspected.

Browser results and normal launcher observations are recorded in the compact
[receipt](data/player-ui-cleanup-20261031/receipt.json). These gates check rendered
controls and keyboard interactions, first-visit/custom/B/L/P/invalid preferences,
byte-preserved historical storage, reload, fixed-depth and timed replies,
full games and review, independent Python replay of B/P games including passes
and terminal counts, comparable coaching values and verified PVs against native,
worker cancellation/restart, actual fetched Wasm hash, failed-load B fallback,
P refusal and ABI-mismatch recovery. Test-only disposable profiles are removed.
The normal `./start.sh --port 0` route opens actual default Windows Edge and
fetches the current app/Wasm. The existing UIA helper cannot inspect page
controls in this ordinary-profile window (only 45 browser-chrome nodes were
exposed), including after focusing it. Those attempts are not UI passes; no
application change was made to accommodate them. The URL-verified single-tab
window was closed, Ctrl+C returned zero and port 43549 was confirmed closed.
This limits ordinary-profile interaction evidence, separately from the passing
actual Edge/Chrome disposable-profile checks. The existing favicon 404 remains
cosmetic.

At cleanup publication, updated Safari control checks compiled but this UI
revision had not yet been executed on macOS. The subsequent
[P-default integration](P_DEFAULT_INTEGRATION.md) closes the M4 Safari/Chrome
acceptance gap and supersedes the first-visit/migration behavior above: P is now
recommended/default, explicit B/L/P choices persist, and invalid/custom choices
resolve to P. Intel Mac execution remains a separate limitation.
Raw logs, screenshots and build outputs stay ignored under
`.local-research/player-ui-cleanup-20261031`.

## Publication

Only the reviewed UI, related current documentation/tests and verbatim appended
user request are included. Historical result files and research implementations
are unchanged. Commands: `git diff --check`, explicit `git add` of reviewed paths,
`git commit -m 'Remove experimental ML controls from Reversi player UI'`,
`git push origin main`, `git ls-remote origin refs/heads/main`. The final verified
publication SHA is reported after push, avoiding a self-referential document hash.
