# Current browser integration

**P is the recommended first-visit default (2026-11-01).** Explicit B/L/P choices
and valid time preferences survive reload; invalid/custom preferences resolve to
P. Historical saved-model storage is never read or changed. The independent
300-ms paired study scored 61.6211% against B; the earlier 80-ms 60.6445% result
retains its failed strict novelty gate. See [production acceptance](P_DEFAULT_INTEGRATION.md).

The packaged ABI, source fingerprint, frozen coefficients and Wasm files are
unchanged. Play, equal-depth coaching and review request the selected evaluator.
P/L never silently substitute B. Failure presents **Retry engine** and **Use B
instead**; explicit B retains equivalent JS fallback. Rejected initialization is
not cached permanently, and failed UI workers are replaced for a clean retry.
There are still only three worker roles, with cancellation and stale-result guards.
Default fixed-depth/time settings are unchanged. Heuristic scores are not win
probabilities, and P is not guaranteed to win every position.

## Historical integration checkpoints

The dated entries below describe earlier behavior, not the current default.

**Player UI update, 2026-10-31:** B is now the default, including for former
saved/custom preferences. B/L/P remain selectable; historical saved-model bytes
are untouched. Training, export, coefficient UI/state and the training worker
have been removed. The three player workers handle play, coaching and review;
review identifies the returned frozen evaluator/backend. B's JavaScript fallback
and L/P's refusal to substitute remain. The packaged Wasm is unchanged.
See [current qualification](PLAYER_UI_CLEANUP.md). The original integration
checkpoint below records historical behavior and evidence.

Open `python3 launch.py`, choose **B**, **L** or **P** in Evaluator, and choose
fixed depth or **80 ms / 300 ms** computer time. Every search runs in the existing
module-worker architecture. Playing, coaching and review have separate workers,
engine instances and bounded TTs. The first visit retains Saved/custom weights
and the original JavaScript behavior. A separate preference key remembers an
explicit evaluator/time choice; the original weight/version/export storage is
unchanged. P is selectable, not promoted automatically.

Initialization is lazy and asynchronous inside each computational worker. Its
promise is reused for queued requests. IDs, view revision, model and horizon
protect replies; cancellation terminates a busy worker and creates an isolated
replacement. There is no additional search pool or main-thread Wasm initialization.
Training workers never allocate a Wasm table. Custom weights and self-play keep
the original JS path. Training/export/weight inspection are explicitly labeled
saved/custom; frozen evaluators cannot be overwritten by training.

Playing exposes completed depth, nodes, elapsed time and exact/heuristic/fallback
classification. The last-computer-search label remains clear during historical
analysis. Coaching scores every candidate at one fixed placement depth, displays
verified continuations and factual line evidence, and uses the selected frozen
model. P's static linear contributions and pattern correction are distinguished
from backed-up scores. Review uses that same evaluator for every recorded decision;
its result names the requested evaluator and saved version. Model changes cancel
obsolete review/search work.

Failed initialization visibly falls back to mathematically equivalent JavaScript
B only for a B request. P/L requests fail with an explanation and invite explicit
selection of B or Saved/custom. No P result can be silently computed as B.
A missing module, model/ABI mismatch and unavailable binary are caught during
initialization. Loading resources is entirely local. Python explicitly serves
`application/wasm` and JavaScript MIME types; ordinary startup installs nothing.

Real **Chromium 156.0.8078.4 on macOS ARM64** passes:

- B/L/P selection and all-move coaching, verified line presentation and P caveat.
- Timed P play, complete visible B and P games, model-consistent game review.
- Undo, historical replay, rapid depth/model changes and worker restart.
- Reload with cached resources and persisted explicit evaluator preference.
- Aborted Wasm loading: visible B fallback, P refusal, custom recovery.
- Existing keyboard/comparison/colors/full-game/custom-training/export/reload tests.

The screenshot was visually inspected. The browser context is temporary and does
not touch the user's saved application data. Node tests cover initialization races,
failed-load identity preservation and version mismatches; actual Wasm numerical
qualification remains in the previous checkpoint. Additional 48-game stress,
browser performance profiling and broader browser coverage follow separately.

Reproduce with a test-only Playwright environment containing Chromium:

```bash
python tests/wasm_browser_check.py
python tests/browser_check.py
npm test
python3 -m unittest discover -s tests -p 'test_*.py'
```

No new WSL2/Windows or Intel execution is claimed by this Mac integration check.

One legacy Python resume test initially failed because its ten-second cumulative
test allowance now included two expanded correctness suites containing actual
Wasm execution. Its test-only allowance is raised to thirty seconds (45-second
subprocess timeout); no research protocol, scientific budget or historical run
was changed. The failure is preserved in local logs. The launcher MIME checks
also verify the actual committed Wasm magic bytes over HTTP.

A second legacy smoke failure showed the same cumulative-time issue at its
27%-of-budget data deadline, leaving no completed development games after expanded
correctness. Smoke test allowances are now 60 seconds, with 30-second startup
polls; actual scientific runner code and frozen inputs are unchanged. All four
research-runner tests then pass together. The other 34 Python tests passed in
the preceding full run, and the four launcher tests pass separately with MIME
coverage. The integration suite passes all 167 Node tests. A final full Python
rerun is included in final application acceptance.
