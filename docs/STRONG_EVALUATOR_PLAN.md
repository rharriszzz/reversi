# Strong positional evaluator research, v2

The user request in USER_REQUESTS.md authorizes this framework and one approximately six-hour campaign. B remains production. The original alpha-beta search and coaching interface are preserved. This document describes assistant implementation decisions, not additional user requirements.

## What changes from v1

V1 accepted 1,024 training games, ended fitting on development stagnation after about 48 task-wall seconds, then transferred almost everything to tournaments. Its small pattern model used Map/object feature extraction in every static call. V2 instead streams newly generated shards through separately fitted linear, short-tuple, long-tuple and hybrid families. Each family compares margin, outcome and preference objectives. It returns to fresh data and expensive labels after each bounded fit. There is no rule that expands tournaments when fitting converges early.

Learning continues to a measured deadline, rather than a fixed number of games. A short integrated pilot measures generation at depths 1/2/3, deep and exact labels, all model fits, complete static cost, search work, and pair costs at 20/80/300 ms. Before confirmation, these timings reserve the greater of 20% of the allowance or the projected fixed comparison cost with 15% headroom, capped at 42%. The balance belongs to learning. Initial cycles allow 60% of a five-minute window for data/labels, then stream up to twelve epochs of every new shard plus older replay, stopping after three stale development epochs. The final shorter window also reserves time for fitting. Short fits lead to another data cycle. Calibration should remain below 10%; unused calibration time belongs to learning.

The intended 10/45/25/20 performance/data/fitting/validation division is a guideline. Reports give actual nonoverlapping category wall time and process CPU, including workers. Data and fitting proportions depend on measured throughput; v2 cannot promise that useful optimization will consume a particular fraction. It must not fill an arbitrary fitting quota with stagnant epochs. Fitting includes feature encoding, coverage counting and model evaluation, not just scalar gradient arithmetic. Selection/confirmation cannot consume unused early-fitting time before the learning deadline.

## Distinguishing the five failure hypotheses

| Hypothesis | Diagnostic | What would discriminate it |
|---|---|---|
| Representation cost loses depth | Compile the old frozen linear/stable weights without changing values; compare static cost and fixed-depth minimax on the same positions. Record completed depths, nodes, calls and wall time for every new timed game. | An identical-value speed gain isolates avoidable implementation overhead. It does not alone establish stronger play. |
| Opening/middlegame accuracy is weak | Game-cluster outcome error by occupied-count phase; deeper B move preferences by phase; exact late labels kept separate. | A late-only gain alongside poor earlier ranking suggests inadequate strategic coverage. B labels can favor B. |
| Outcome targets miss decision quality | Margin, outcome and search-guided logistic pair losses in each architecture, trained independently. | Better exact move ranking after preference training without corresponding outcome MSE improvement distinguishes objectives. |
| Data are correlated or policy-biased | Unique canonical identities; complete-game splits; multiple behavior policies; chronological curves and policy metadata; stream all new data rather than a fixed small reservoir. | Improvement as new distinct trajectories arrive supports more data. Compare policy strata and report rejection rates before interpreting plateauing curves. |
| Phase/parameterization mistakes | Four vs six phases for linear and short ranking controls; separate systematic short patterns, long corner/edge/diagonal tables and hybrid. | Errors concentrated near boundaries, rare-table coverage, and family-specific regressions identify representation limitations. |

Historical diagnostic command:

```bash
node scripts/strong/diagnose-previous.mjs .local-research/six-hour-20261027 .local-research/previous-diagnostic.json
```

Historical positions are disclosed diagnostics, never new confirmation. New campaign exclusions load the publication JSON and the retained old local trajectories where available. Missing local files are counted. Fresh namespaces reserve development, training, selection and confirmation. See TRAINING_DATA.md for the precise prefix exception and canonical collision policy.

## Repeated learning cycle

1. Generate full mixed-policy games from randomized 8/10/12-placement openings. B and C stay in the opponent pool alongside the two best development candidates. Depths and exploration vary; both colors can use different policies.
2. Score a deterministic sample of candidate positions for model disagreement, depth-1/depth-2 disagreement, score disagreement and low pattern coverage.
3. Label the highest-priority positions with common-depth full-window depth-5/6 searches of every legal alternative, recording an actual opponent reply. These are B estimates, in B units, used for preferences only. Independently solve 8-empty positions; cycle through 10 and 12 empties under strict node/time caps. Unfinished exact solves are recorded and excluded.
4. Stream all new training shards through every family/objective. Keep a small deterministic older replay sample. Fit L2-regularized models with rare-pattern shrinkage and bounded weights. Save versioned model artifacts after each bounded fitting task, retaining the best epoch within that task. A total learning deadline can leave some last shards unfitted; per-model cursors and actual fitted-position counts make this visible.
5. Record development prediction, exact regret, estimated-search regret, preference accuracy, phase results and full evaluation cost. Retain each candidate's best development checkpoint and use previous models for subsequent behavior policies.
6. Return to fresh trajectories and labels. Long-run continuation inherits only training/development roles, never old confirmation targets as training labels.

The first pilot does not enumerate the first eight opening moves for fitting: intentionally randomized/common prefixes are excluded. This leaves earliest-opening knowledge largely untrained and is an explicit limitation, not a claim of full opening coverage.

Calibration exposed an entirely empty first bucket in the original equal 4–64 layout. Before the full run, phases were anchored at 16 occupied squares and clamped through the opening, giving boundaries 28/40/52 for four buckets. A regression checks actual retained positions in every four/six-phase bucket. The full campaign generates 256 development games and up to 64 exact/64 search development labels; rejected trajectories/labels remain visible.

## Confirmation protocol

Development metrics rank candidates by the sum of exact and approximate pairwise ranking accuracy, breaking ties by evaluator cost. Two candidates advance to four paired depth-2 openings and four paired openings at each of 20/80/300 ms. The single finalist maximizes the mean of the three timed selection points rates; ties use model ID. All rules precede final access.

Freeze the finalist and exact artifact path before generating any confirmation-quality labels or games. Fixed final targets are **256 pairs at 80 ms, 128 at 300 ms, and 16 descriptive pairs at 20 ms**, with both colors from each matched opening. The program does not change these counts after seeing results. It alternates primary conditions and uses the same final roots across budgets. Color game order alternates with pair index. All timed comparisons are serial with other research workers terminated.

Primary uncertainty uses bounded opening-pair means and a two-sided Hoeffding interval, Bonferroni over **two actual primary controls**, family alpha .05: radius `sqrt(log(80)/(2*n))`. The 20-ms result is descriptive. A completed final fixed sample is necessary for inferential interpretation; budget-truncated intervals are descriptive and cannot earn promotion. Resume completes the same fixed experiment, without optional stopping based on points. Both completed primary lower bounds must exceed .5 for evidence of stronger internal equal-time play. No model installs itself, and no human-strength/Elo claim follows.

Full-trajectory collision rejection is declared in advance and examines only board identities, never results. Entire conflicting pairs are recorded and replaced from reserved backup roots. Confirmation excludes training/development, historical and selection trajectories after the common-prefix cutoff. Sample sizes refer to admitted opening pairs.

## Launch, interruption and Windows reboot

```bash
python3 scripts/strong-launch.py --check-only --output .local-research/strong-six-hour-20261027
python3 scripts/strong-launch.py --hours 6 --seed 2026102797 --output .local-research/strong-six-hour-20261027
tail -f .local-research/strong-six-hour-20261027/launcher.log
```

The launcher checks current WSL CPU, physical memory, swap activity, disk, existing research processes, Windows physical memory, paging counters, top application memory and saved sleep timeouts where accessible. Below 3.5 GiB available physical memory it chooses **one** 320-MiB-heap worker, otherwise at most two. Below 1.25 GiB or above 85% CPU use it records a blocker and skips launch. Worker heap limits are not total RSS limits. No applications are closed. macOS records `vm_stat`, `memory_pressure`, load and `pmset`; current Mac hardware still needs physical validation.

The launcher copies runtime source/tests/publication inputs to `OUTPUT/source/` before starting and resumes that copy. Do not edit its executable files while active. Completed game shards, labels, fit tasks and whole opening pairs use fsync and same-directory atomic rename. The manifest has periodic durable heartbeats and task receipts. A reboot discards only in-flight bounded work, generally a few seconds and at most the task cap (up to two minutes for assessment); completed work is reused. Downtime does not consume active budget. Stale locks use boot and process-start identity on Linux so a reused PID after a Windows reboot does not strand the run.

The already-authorized temporary Windows keep-awake request is renewed by the launcher and watches the durable heartbeat. It releases on completion, interruption, stale heartbeat or a bounded deadline. macOS uses `caffeinate -i -w PID` when available. If the computer still reboots, the durable work remains resumable. The historical exclusion set is also saved locally, so loss of a temporary diagnostic directory after reboot does not change the experiment's admitted population.

After reboot, open WSL and run:

```bash
cd /home/rharris/git/reversi
python3 scripts/strong-launch.py --resume --output .local-research/strong-six-hour-20261027
```

A Windows `resume-after-reboot.cmd` is generated in the run directory. Run it after logging in, or explicitly add it to your own Task Scheduler login task if desired. **No startup task or saved power setting is installed automatically**, following the user's restriction on saved-setting changes. A temporary, previously authorized keep-awake request can prevent idle sleep, but cannot prevent Windows Update restarts or power loss. Local fsync is crash recovery, not protection against loss of the WSL virtual disk; an occasional Windows `wsl --export` while research is stopped is a separate backup option.

The detached run survives closing the launching terminal and the Codex conversation on a normal WSL host. This must be checked after the launch command returns; restricted execution hosts can reap children. A launch receipt alone is insufficient proof of persistence.

## Longer rounds, prepared but not authorized to start

```bash
python3 scripts/strong-launch.py --hours 24 --seed 2026103001 --continue-from .local-research/strong-six-hour-20261027 --output .local-research/strong-24h
# The same configuration supports --hours 72 with a new output and seed.
```

Continue only from a stopped/completed run. Its training/development datasets retain their roles; final evaluation data remain excluded. Keep the source artifacts and previous data directories, since manifests reference immutable files there. The six-hour report should determine whether more data, deeper labels, faster representation or a revised architecture is justified. No longer round starts automatically.

## Optional independent engine

The [Egaroucid technical explanation](https://www.egaroucid.nyanyan.dev/en/technology/explanation/) supports investigating shared ternary patterns and differential indices. This implementation keeps those ideas local and does not import its code/weights. [Egaroucid Console](https://www.egaroucid.nyanyan.dev/en/console/) supports Linux/macOS builds and GTP, with resource files and a board-orientation caveat. Its [project site](https://www.egaroucid.nyanyan.dev/) identifies GPL-3.0. [Edax source and build instructions](https://github.com/abulmo/edax-reversi) require a separately obtained evaluation file; consult its actual [LICENSE](https://github.com/abulmo/edax-reversi/blob/master/LICENSE) before distributing any engine or derived assets.

Neither engine is installed locally in this round. Building, obtaining resource files and validating orientation/protocol would add an unmeasured dependency to the first campaign. The economic fallback is the existing deeper alpha-beta teacher plus independently implemented exact solving. External-engine labels/benchmarking remain optional follow-up work, with executable/version/resource hashes, command, license and attribution required per imported label. No third-party engine replaces production search.
