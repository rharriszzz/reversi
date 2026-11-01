# P default: production integration and acceptance

**P is the recommended first-visit opponent. B and L remain selectable.** Explicit
saved choices survive, and old/custom/invalid preferences resolve to P. The
qualified integration changes initialization and failure recovery, with no new
learning, scientific tournament, search optimization or coach development.

## History and integration

Remote references were fetched and verified:

| Reference | Starting commit |
| --- | --- |
| Production `origin/main` | `a560896ef54a3c4cec19974ed8cbc2064e177e4b` |
| Original local `main` | `e955e992708b7138b5c0f704451e17e3dee4484a` |
| Completed 300-ms research | `83de5d3536522ba0aa84fbc3cec0dd718555f657` |
| Qualified application implementation | `f7eb4b586348814b67d5cb6faa488b9b29db1859` |

Work used `integrate/p-default-20261101`. Production was a clean ancestor of the
research branch. Its seven additional commits introduce offline tools, compact
evidence and reports, with **no runtime/native/Wasm/package changes**. Integration
uses a fast-forward through all original research commits, followed by the
application commit and this report/evidence commit. No squash, rebase, replacement
experiment or historical report rewrite. Other worktrees were reviewed and left
clean and unchanged. Bulk local archives, binaries and profiles stay ignored.

The [300-ms prospective report](PHASE_A_300MS_TOURNAMENT_RESULTS.md) remains
individually accessible: P scored **61.6211%**, 298/35/179 W/D/L over 512 games,
with both registered gates and independent verification passing. The separate
[80-ms M4 report](PHASE_A_MAC_TOURNAMENT_RESULTS.md) retains **60.6445%** and its
**failed original strict historical-novelty gate**. Both complete public verifiers
passed again, including report/evidence hashes and all game/source paths. No bulk
historical reconstruction was repeated. These results support P against B on the
registered distribution, not an absolute rating or superiority to unrelated
engines, and do not make heuristic values win probabilities.

## Application behavior

- Markup and initialization select **P · Recommended pattern evaluator** for a
  first visit. B stays **Original evaluator** and L **Learned linear evaluator**.
- Explicit B/L/P choices and valid time preferences are respected and persisted
  only through `reversi-engine-preferences-v1`. Invalid/custom/malformed preferences
  resolve to P at load; a later explicit selection stores that valid choice.
- `reversi-coach-lab-learning-v1` is never read, written, removed or migrated by
  the application. Tests guard forbidden reads and verify byte preservation.
- Storage denial still permits play with P. The existing defaults remain fixed
  depth, computer D4 and coach D3; no thinking-time change accompanies promotion.
- Play, all-move analysis and completed review explicitly request the selection.
  Tests check real packaged-Wasm response identities, not just displayed labels.
- A failed P/L initialization cannot substitute B. **Retry engine** preserves the
  board and retries through a replacement worker; **Use B instead** explicitly
  selects and persists B, allowing its equivalent JavaScript fallback.
- A rejected backend initialization promise is cleared for later requests. Failed
  analysis/play/review workers are replaced, pending jobs are cleared, and old
  replies/errors cannot overwrite the replacement's state or evaluator identity.
  An explicit saved B/L choice also appears correctly in the initial loading label.

There are still exactly three worker roles: analysis, play and review. No new
runtime dependency, worker pool or training UI. Coaching algorithms, equal-depth
scores, verified continuations, rules, coefficients and search are unchanged.
Current README, architecture, validation, Wasm integration and handoff documents
now identify P as default; dated historical descriptions retain their scope.

## Frozen identities and package preservation

The Wasm distribution was **not rebuilt or changed**. The packaging verifier
checks source hashes, strict floating-point/compiler options, ABI/exports, loaded
geometry, model/header values, fingerprint and both artifact hashes. Safari also
verified the actual HTTP-fetched Wasm SHA-256 and MIME type.

| Item | Identity |
| --- | --- |
| B | `original-production` |
| L | `ecf3fd376c680ced77d0b002ea2efb9fa4385737c4fffff734b901ab2968d97f` |
| P | `de4b84745589b0384ea3639f879e3c98990e802d176298ff8ef54f681520067f` |
| ABI | `1` |
| Wasm build fingerprint | `934b888ad89f8d754d1ace6acfcd3cd84b6b48e948431916153d5d29c5f2b223` |
| Wasm SHA-256 | `7a9d43dd937af75999d5db11b018bd98a1d87eb655bbf05053957993dec0c9d0` |
| JS module SHA-256 | `95dbaf41ff32dbf04f41d6ff8936f8bf113ffbdbc0beafa2f69f481f00fb72c6` |
| Frozen model-header SHA-256 | `1b286ed8371f0a2cd957b06b679e7422b68b3699cb7c8fe7c9f50968d27ceba1` |

Native ARM64 source, CPU dispatch, `src/worker.js`, `src/wasm-engine.js`, all Wasm
files and frozen coefficient exports are byte-identical to the research starting
commit. Native build fingerprint remains `118ac8f1ac74571993db0d7976e801d541aa6a52780d91448f092dbd0f511818`;
the local tested CLI SHA-256 is `7a49af80c2265b8b32362b5f2266e80b1441627558fdc129f10f6a7db705e35d`.
Local executable bytes can depend on build paths; frozen model/source identities
and deterministic numerical agreement are checked separately.

## Regression and actual browser acceptance

M4 iMac, 24 GiB, actual ARM64 execution. Final checks:

| Check | Result |
| --- | --- |
| Full Node suite, including native/Wasm/rules/search/UI | **199 pass / 200; one expected Linux-x86 dispatch skip** |
| Focused backend/controller checks | **13 pass** |
| Python 3.13.18 standard-library suite | **66 pass** |
| Project Python 3.14.10 suite | **66 pass** |
| Actual Chrome 156.0.8078.74, disposable Playwright context | **Pass** |
| Actual Safari 27.2, isolated SafariDriver session | **Pass** |
| Production source/ABI/artifact verification | **Pass** |
| Ordinary ARM64 preprocessing/symbol checks | **Pass; no x86 detector/enhanced symbols** |
| Intel Mac engine/CLI/browser-ABI compile and link | **Pass; not executed** |
| Original 80-ms and 300-ms public evidence verification | **Pass; original conclusions retained** |

Native/Wasm correctness includes independent legal children and flips, forced
passes, raw terminal counts with empty squares, fixed/timed search, TT and
interruption behavior, model identities, comparable all-move values and PVs.
New cases test actual P dispatch/results for analysis/play/review, first visit,
saved choices, denied/malformed storage, failed initialization, active model
changes, stale responses/errors and review retry. Explicit B fallback tests remain.
Existing research smoke/unit fixtures ran as correctness checks; no scientific
campaign or learned challenger was created. Existing nonfatal Python subprocess
and HTTPError ResourceWarnings remain visible in retained logs.

Chrome used the actual installed browser in headless automation. It completed the
general UI check and the Wasm integration check: first P worker request/response
identity, B/L/P switches, reload/migration, both human colors, undo/replay,
keyboard/comparison, complete games and selected-model review. The B/P game paths
were independently replayed, including **21 forced passes** in the final run.
Missing-Wasm first-visit P fails visibly, retry recovers without reload, explicit
B falls back to JS, and an injected ABI mismatch recovers on reload.

Safari performed **823 native/Wasm comparisons with maximum absolute error 0**:
312 static queries, 141 root alternatives, 423 verified PV placements and 45 deep
independent-reference alternative checks. Six complete UI acceptance games cover
B/L/P at 80/300 ms and both colors, with independent replay and 43 coaching score
checks. These are deterministic correctness fixtures, not a playing-strength
tournament. First-visit P, all explicit/invalid preference cases, byte-preserved
historical test storage, reload, keyboard, undo/replay, rapid cancellation,
fixed/timed replies, selected-model review, missing Wasm, ABI mismatch and
in-place initialization/worker-error retry all pass.

Normal serving used `start.sh --no-browser --port 0` / `launch.py --no-browser`
with actual packaged resources. Automation opened its own isolated contexts;
personal profiles and application data were not read or modified. Fault injection
used browser routing or an owned test server, never modified distribution files.
Screenshots from both browsers were visually inspected: the P label fits and no
new layout problem was found. A preexisting tied-score rounding display can show
`−0.0`; it is a nonblocking presentation quirk left for later review.

[Compact acceptance evidence](data/p-default-integration-20261101/receipt.json)
binds source, model, artifact, test/log and screenshot identities. Raw logs,
screenshots, full browser events and build outputs remain ignored under
`.local-research/p-default-integration-20261101`.

## Reproduce and platform follow-up

On this Mac, using the existing test-only browser environment:

```bash
npm test
python3 -m unittest discover -s tests -p 'test_*.py'
.venv/bin/python -m unittest discover -s tests -p 'test_*.py'
node scripts/runtime-cpu-mac/verify-production.mjs
REVERSI_BROWSER_CHANNEL=chrome .venv/bin/python tests/browser_check.py
REVERSI_BROWSER_CHANNEL=chrome REVERSI_WASM_OUTPUT=.local-research/p-default-repeat/chrome .venv/bin/python tests/wasm_browser_check.py
REVERSI_SAFARI_OUTPUT=.local-research/p-default-repeat/safari .venv/bin/python tests/p_default_safari.py
python3 docs/data/phase-a-tournament/verify-final.py
python3 docs/data/phase-a-300ms/verify-final.py
git diff --check
```

SafariDriver must already be enabled; this round did not change browser/system
settings or install test dependencies. The Intel check reused
`scripts/runtime-cpu-mac/compatibility.py` with new ignored output and links to the
current native executable/header. It cross-compiles/links x86-64 Mach-O objects,
CLI and browser dylib using the installed SDK, but does not execute Intel code.
No Windows/WSL2 or Intel Mac runtime execution occurred in this Mac session.

Short follow-up on the existing WSL2 PC (no SSH, firewall or archive work):

```bash
cd ~/git/reversi
git status --short
git switch main
git pull --ff-only origin main
export REVERSI_PYTHON="$PWD/.venv/bin/python"
NATIVE_CPU=dispatch node --test tests/native-search.test.mjs tests/runtime-cpu-dispatch.test.mjs
for browser in chrome edge; do
  export REVERSI_WINDOWS_BROWSER=1 REVERSI_WINDOWS_CHANNEL="$browser"
  export REVERSI_WASM_OUTPUT=".local-research/p-default-pc-$browser"
  "$REVERSI_PYTHON" tests/browser_check.py
  "$REVERSI_PYTHON" tests/wasm_browser_check.py
done
./start.sh --port 0
# Check normal Windows-browser opening, then stop with Ctrl+C.
```

Use existing test dependencies; stop rather than overwrite any local work if Git
reports a conflict. Intel hardware browser/native execution remains an honest
coverage limit. M4 qualification has no remaining critical blocker to promotion
or to beginning a separately requested coach session. No coach work began here.

## Publication

Application commit `f7eb4b586348814b67d5cb6faa488b9b29db1859` is followed by the
report/evidence commit, preserving the original research ancestry. Commands:

```bash
git commit -m "Make frozen P the default and qualify initialization recovery"
git commit -m "Record P default production qualification"
git fetch origin
git switch main
git merge --ff-only integrate/p-default-20261101
git push -u origin integrate/p-default-20261101
git push origin main
git ls-remote origin refs/heads/main refs/heads/integrate/p-default-20261101
git status --short --branch
```

Final clean status, remote equality and the exact publication-tip SHA are checked
after push and reported in the handoff/final response, avoiding a self-referential
commit hash in this file. The implementation hash above identifies the qualified
runtime changes; the following commit contains only documentation and evidence.
