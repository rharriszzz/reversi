# Six-hour WSL2 research run: handoff

**New request / 27 October 20:19 UTC:** the learning-first v2 framework and a completed five-minute calibration are published in [TRAINING_RESULTS.md](TRAINING_RESULTS.md). The new six-hour run is **not started**: fresh Windows available physical memory was only 0.58 GiB, below the 1.25-GiB launch floor. Use the resource-checked command in that report after freeing memory. Do not resume the completed v1 run described below. No applications or saved settings were changed. V2 includes source snapshots, small atomic work units and a generated Windows/WSL reboot-resume command.

**Completed 2026-10-27, approximately 09:53 UTC.** All 19 comparison conditions finished, with 1,544 opening pairs / 3,088 games and no failed tasks, in 4 h 26 min 22 s. Keep-awake was released automatically. B remains the production evaluator. See the [published final results](LOCAL_RESEARCH_RESULTS_20261027.md) and [compact evidence](data/local-research-20261027.json). Do not restart or resume this completed experiment.

The launch snapshot below was checked **2026-10-27 05:36:50 UTC** and is retained as history, not current status. The user requested publication of final results after completion; no follow-up study has been started.

## Run identity and historical launch snapshot

- Started **2026-10-27 05:26:39 UTC**, independently of the conversation, using the existing detached launcher on the WSL host.
- Coordinator PID: **559597** on WSL host `daisy`. Sandbox process lists cannot see this host PID. PIDs are only valid for this launch and can be reused after exit.
- Output: `/home/rharris/git/reversi/.local-research/six-hour-20261027`.
- Configuration: `full`, **six active wall-clock hours maximum**, **two workers**, seed **2026102751**. The runner can finish its program earlier; downtime on resume does not count toward the active budget. Timed tournaments use one worker with other research workers stopped.
- Snapshot: **running**, stage **serious** (selection tournaments), about **10.1 active minutes**. Accepted 1,024 training games and 192 development games; all five preliminary comparisons completed eight opening pairs each; serious comparisons were underway. No failed tasks were recorded. Final confirmation had not begun. These are progress facts, not evidence of a stronger evaluator.
- Framework commit recorded in the manifest: `65fd704fa8d8d7bc693ef460a9d9b24fd8386b93`. Runtime input digest: `2d55d9dad01567bf06854bf70c238c5b6c02eaef5391cff1dbf2d0ef9d37453f`.
- Evaluator **B remains the production baseline**; A remains the equivalence reference, C experimental. No learned candidate is installed automatically.

Launch command used on the host:

```bash
python3 scripts/research-launch.py --mode full --hours 6 --workers 2 --seed 2026102751 --output .local-research/six-hour-20261027
```

**Do not run that command again while this run exists.** The original sandbox removed detached children; the host launch was separately verified to persist after its launching command returned. No new service was installed.

## Resource and power decisions

Preflight found 28 logical CPUs (i7-14700F), Windows CPU samples 2–9%, WSL CPU about 0.3%, Windows available physical RAM approximately 2.4–2.5 GiB, WSL available RAM 6.4 GiB, WSL swap usage 88 MiB, and no active paging in the measurement windows. Windows C: had 367 GiB free; WSL advertised 904 GiB on its virtual filesystem. Chrome used approximately 3.0 GiB private working set, Photos 472 MiB, and WSL 946 MiB. **Two workers were chosen for memory headroom**, rather than automatically choosing four. No duplicate research process was found; the old sandbox `detached-check/run.lock` was left alone.

Windows Balanced power settings sleep after one hour on AC. The user explicitly approved a temporary keep-awake request and two workers; it ran in Windows PowerShell PID **40836** (WSL interop PID **559572**) and was released at **2026-10-27 09:53:10 UTC** after completion. Saved power settings are unchanged. No applications were closed or existing processes terminated. The administrator-only `powercfg /requests` listing was skipped and recorded.

The user subsequently instructed: **do not ask for further approval; record and skip or work around steps needing it**. Do not change settings or close applications under an inferred permission.

## Inspect completed artifacts from a normal WSL terminal

```bash
cd /home/rharris/git/reversi
tail -n 30 .local-research/six-hour-20261027/launcher.log
```

The log is now finished; there are no further progress lines to wait for. Read the final generated local report with:

```bash
less .local-research/six-hour-20261027/report.md
```

Press `q` to leave `less`; reopen to refresh. For a compact current checkpoint summary:

```bash
python3 - <<'PY'
import json
from pathlib import Path
s = json.loads(Path('.local-research/six-hour-20261027/manifest.json').read_text())
print('Status:', s['status'], '| stage:', s['stage'])
print('Active minutes:', round(s['elapsedMs'] / 60000, 1), '| budget hours:', s['config']['budgetMs'] / 3600000)
print('Accepted games:', s['progress']['accepted'], '| failed tasks:', len(s['failures']))
for c in s['conditions']:
    print(c['stage'], c['candidate'], 'vs', c['opponent'], c['budget'], len(c['tasks']), '/', c['target'], 'pairs')
print('Stopping reason:', s.get('stoppingReason'))
PY
```

`results.json`, `report.md`, `curves.svg`, `quality-cost.svg`, and the manifest live in the output directory. Task/model files and the exact frozen selection remain local. The checkpoint and report may lag the live process by 15–30 seconds; they are rewritten atomically. A single sample can be stale, so check whether the log/checkpoint advances before diagnosing a stall.

## Historical resume instructions — not needed for this completed run

The following **local-only** helper calls the existing detached launcher with `--resume`, then renews the approved temporary Windows keep-awake request:

```bash
cd /home/rharris/git/reversi
python3 .local-research/resume-six-hour-20261027.py
```

It preserves the original seed, worker count and total active budget. It is already on this PC, **not in Git**. The portable runner-only command is `python3 scripts/research-launch.py --resume --output .local-research/six-hour-20261027`; if used after the power helper has exited, it does not itself restore keep-awake. Do not resume a running or completed experiment just to inspect it. Keep Windows awake and WSL running; deliberate sleep, shutdown, or `wsl --shutdown` can still interrupt computation.

Other local-only operational records are `.local-research/six-hour-preflight-20261027.json`, `six-hour-launch-receipt-20261027.json`, `six-hour-power-request-20261027.json`, and `six-hour-keep-awake-20261027.ps1`/`.log` (all under `.local-research/`). The full directory is Git-ignored. Another machine or a fresh clone will not contain these artifacts.

## Instructions for the next AI

Read `USER_REQUESTS.md`, this file, and [the final results](LOCAL_RESEARCH_RESULTS_20261027.md). The computation is complete and the user requested GitHub publication. Do not launch another study or tune against the disclosed final data without a new request. The report records the need to include newly published roots/reference boards in any future exclusions.

**Do not edit `src/`, `scripts/`, `tests/`, `package.json`, or `docs/data/` while this run is active.** They are hashed inputs; changes stop the run and prevent compatible resume. In particular, do not regenerate the smoke-summary JSON. Documentation-only changes to this file, README, CODEX_PROMPT and USER_REQUESTS are outside that digest. A documentation commit may change Git HEAD while the manifest correctly continues to identify the original framework commit.

The final manifest, report, results and frozen-selection record remain local. Preserve training/development/selection/confirmation separation and pair-level uncertainty; no premature champion or Elo claim. Only the compact reproducible evidence/report is published, never raw datasets, trained weights or logs. The published final report supersedes this launch snapshot.
