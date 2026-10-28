# Independent teacher audit — Stage A

28 October 2026. This implements the teacher-only stage of [Astra's strategy](ASTRA_STRATEGY.md). Production B and the original alpha-beta engine are unchanged. No model training or Stage B is invoked by these tools.

## Teacher and boundary

The adapter runs a separate Edax executable through its batch `-solve` OBF interface. It imports no Edax implementation or learned weights into our engine. External checkout, binary, evaluation data, raw transcripts and full audit receipts live under Git-ignored `.local-research/`.

- Source: Edax **4.6**, release commit `713a434f13b3d15fb69c61b9ba3641aed82c496c`.
- Evaluation data: upstream blob `bin/data/eval.dat` at `786421f355219ade872ce7285c1cab1eaf67836a`, SHA-256 `f8b2299612d9fa4414157e70e932636e33111c2602d0c2fc382a7d90ef21b792`. The setup fetches that exact blob rather than relying on an unversioned download.
- Each run records binary SHA-256, source identity, evaluation hash and original command/output transcripts. A changed binary, evaluation file or executable source digest refuses resume.
- One native search task; hash size 16 bits; selectivity **5**, meaning no selective pruning. Book lookup is bypassed by the batch solver path. Searches specify placement depth explicitly, not a level-to-depth schedule. No timed partial values are admitted.
- Each legal root alternative gets its own independent full-window child search at D−1. Root windows span Edax's complete [−64,+64] score range. Parsed bounded results are rejected except ±64, which are exact at the boundary of this range. Missing, selective and wrong-depth output is rejected; crashes/timeouts do not create labels.

Source and licensing references: [Edax repository and GPL-3.0 license](https://github.com/abulmo/edax-reversi), [pinned batch-solver source](https://github.com/abulmo/edax-reversi/blob/713a434f13b3d15fb69c61b9ba3641aed82c496c/src/obftest.c). The external checkout retains its LICENSE and notices. We distribute our adapter and compact measurements; we do not redistribute Edax binaries, sources or evaluation tables. Evaluation-data redistribution terms have not been independently established, so do not bundle them in browser/model exports.

The first build used upstream development 4.7; adapter validation exposed a forced-pass OBF crash. Released 4.6 exhibited the same failure. Raw failure transcripts are retained locally. The adapter applies a forced pass before invoking the solver and restores its sign and explicit pass in the returned continuation. Passes preserve remaining placement depth. Terminal roots are handled explicitly by the adapter and are marked `adapterTerminal`; they are not represented as native search results.

Coordinates use a1=0 through h8=63, row-major from rank 1. OBF uses X for Black, O for White, and an explicit turn. Child scores are negated into the original root player's perspective. Edax terminal margins award unplayed empty squares to the winner; our original engine uses actual occupied-disc margin. The receipts identify Edax's convention. Independent exact validation computes both conventions separately. No arbitrary subtraction converts an approximate Edax value into our raw-disc scale.

## Protocol and implementation

The audit accepts 1,000 roots, 250 each at 12–19, 20–35, 36–47 and 48–55 occupied squares. Each stratum has 125 representative roots and 125 roots selected for depth-one/depth-three B disagreement. Each root comes from a different seeded trajectory: randomized early play followed by B depth-one behavior with 12% exploration. “Representative” refers to this declared behavior distribution, not expert play or uniform legal positions.

Historical published positions and complete preserved local campaign trajectories/alternatives are loaded with the existing canonical D4/color exclusion helper. Roots and generated prefixes from 12 occupied squares onward are checked against historical and newly admitted trajectories; unavoidable earlier common prefixes are outside the admission boundary. These are Stage A diagnostic roots, not a new final strength holdout. Generation stops at the selected root, so future descendants have not been reserved for later training/confirmation. Future stages must load these receipts into exclusions.

D=8 labels cover all alternatives. The fixed every-fourth-root subset receives D+2=10. B's choices at depths 1, 3 and 6 are recorded. Stability requires the entire D-best set to lie in the D+2-best set, a conservative interpretation of Astra's tied-best criterion. Stable disagreements count only depth-checked roots on which depth-six B is outside the deeper best set. Gates remain:

1. At least 90% stability on the fixed depth-check subset.
2. At least 100 stable disagreements with B depth six.
3. At least 30 such disagreements in representative opening/middlegame strata (12–35 occupied).

The audit also independently solves 128 eight-empty anchors and compares every alternative with Edax, using the awarded-empty convention explicitly. Up to ten stable disagreement examples include both chosen continuations, legal replay, and an additional depth-eight query at each continuation's endpoint. These are corroborating heuristic searches, not proofs of early-game minimax truth.

Scripts reuse `Progress`, `Profiler`, `atomic`, `sourceDigest`, historical admission and the launcher preflight/source snapshot facilities. Receipts commit each completed root independently; manifest checkpoints occur every 25 roots and 16 anchors. A writer lock prevents duplicate writers; restarting reuses completed immutable receipts. Failed work is retried, not counted as completed. Checkpoints survive a reboot, but resuming requires starting the command again; no Windows startup task is installed. Logs show stage/task names and completed work with 45-second heartbeats. The pilot projection uses the slowest of three measured batches, includes measured B depth-six cost, adds 35% allowance and ten reporting minutes, and refuses an infeasible full audit. The total active cap is two hours, with the last ten minutes reserved for reporting.

Concurrency is deliberately one teacher process plus the serial coordinator in this first integration. This bounds contention and memory while measuring the teacher; it does not claim to exploit the PC's maximum throughput. The existing resource preflight selects safe capacity, and the Stage A runner uses less than that capacity. A later independent-label campaign may parallelize fixed root tasks after profiling. There are no timed head-to-head games in Stage A.

## Validation and reproducibility

Adapter validation precedes admission and labeling: 32 independently solved six-empty positions, one forced-pass fixture, a full terminal board, a terminal board with an empty square, and rotation plus simultaneous color/turn exchange checks. Independent rules use the existing sentinel-board oracle, with a separate alpha-beta reference solver. The 35 fixtures compare every legal alternative under the same terminal convention; raw versus awarded W/D/L is checked separately. Terminal fixtures validate adapter behavior, while played continuations exercise native terminal search. Fast tests reject malformed coordinates/boards and incomplete, bounded, selective or wrong-depth output.

Build and run from WSL2 bash (a portable macOS setup path is supplied but not hardware-tested):

```bash
python3 scripts/teacher/setup.py
python3 scripts/teacher/launch.py .local-research/teacher-audit-new pilot
python3 scripts/teacher/launch.py .local-research/teacher-audit-new audit
```

The second command completes validation, admission and three throughput trials, then stops. The third resumes those same receipts and performs only Stage A. Inspect `launcher.log`, `manifest.json`, `tasks/`, `raw/`, `preflight.json` and `results.json`. Reusing a completed directory reproduces its records, not fresh independent evidence. Both foreground commands can be started from a normal terminal; closing that terminal may interrupt work, and the same command resumes safely. No keep-awake or saved power setting is changed by this launcher. Binary naming in the launcher currently targets the measured Linux x86-64 build; on macOS invoke the Node runner with explicit `--binary` and `--eval` paths after resource assessment.

```bash
node --test tests/*.test.mjs
python3 -m unittest discover -s tests -p 'test_*.py'
```

## Measurements and disposition

**Completed; Astra's Stage A criteria were not satisfied. Do not start Stage B from this result.**

The adapter is validated for the tested rules and exact endings, and the teacher gives useful independent disagreements. However, depth eight versus ten is insufficiently stable to qualify this configuration as the reliable opening/middlegame supervision proposed by Astra. No claim that Edax is weak follows: this tests shallow full-width settings, not its strongest playing configuration.

| Predeclared measure | Result | Required | Gate |
|---|---:|---:|---|
| Accepted roots | 1,000, all four strata complete | 1,000 | Complete |
| Fixed depth-check roots | 250 | 250 | Complete |
| D8 best-set stability against D10 | 177/250 = **70.8%** | ≥90% | Fail |
| Stable disagreements against B depth six | **69** | ≥100 | Fail |
| Representative opening/middlegame stable disagreements | **15** | ≥30 | Fail |
| Independent eight-empty anchors | 128, all 668 alternative values matched | 128 | Pass |

Choosing only the first tied D8 move instead of requiring the entire best set to remain best gives 75.2% stability, still below 90%. This descriptive sensitivity check does not change the gate.

| Occupied squares | Roots | Depth checks | Stable checks | Stable B disagreements |
|---|---:|---:|---:|---:|
| 12–19 | 250 | 63 | 44 | 16 |
| 20–35 | 250 | 62 | 47 | 16 |
| 36–47 | 250 | 63 | 44 | 21 |
| 48–55 | 250 | 62 | 42 | 16 |

There are 8,754 primary alternative values and 2,198 deeper alternative values. Historical admission loaded **2,606,568 canonical keys**, including **15,248 prior local trajectories**, with zero missing local inputs. Admission attempted 4,831 candidates and rejected 3,831. Excluding historical/generated prefixes and selecting a disagreement stratum makes this a conditional diagnostic population; the table is not an estimate of ordinary game error rates.

Examples below are for the root player, in estimated Edax discs. These preferences agree at D8/D10; they are not exact minimax refutations. The compact evidence includes boards, all alternative values and both legally replayed continuations with endpoint re-searches for ten examples.

| Local generation index | Occupied / turn | B depth-six move; D10 value | Teacher best; D10 value |
|---|---|---|---|
| 35 | 12 / Black | c2; +2 | f3; +4 |
| 115 | 14 / Black | e3; −9 | f5; −8 |
| 150 | 13 / White | b4; −8 | c6; −5 |

For example 35 the board, rank 1 first, is:

```text
........
........
...WB...
.WWWWW..
..WBBB..
...W....
........
........
```

These small early-game value differences are precisely where stronger independent supervision could help. But the 29.2% unstable depth checks warn against treating every shallow teacher ranking as truth. Endpoint re-searches corroborate individual continuations only; they do not search all alternative replies along the entire earlier line.

### Throughput, resources and scheduling

The fresh preflight reported **3.66 GiB** limiting Windows/WSL available physical memory, about **0.21%** aggregate WSL CPU busy, zero active swap pages/second and **885 GiB** free disk. It allowed three workers under the existing headroom policy; this first teacher integration used one. No applications, saved settings or power policies were changed.

Three four-phase pilot batches, each containing both D8 and D10 all-alternative searches (eight root labels), took **1.233, 1.121 and 1.335 seconds** of summed adapter wall time. Twelve B depth-six probes took about **0.66–0.68 seconds**. The frozen conservative projection was approximately **18.7–18.8 minutes**, including 35% allowance and ten reporting minutes. The implementation deliberately overestimates deeper-label frequency in that projection. It did not separately predict the 128-anchor stage, which actually took about 14 seconds; future budgets should itemize it explicitly.

Actual combined active runner time, including the pilot and resumed full audit, was **324.1 seconds (5.40 minutes)**, leaving roughly **114.6 minutes** of the two-hour cap. The pause between pilot and audit is excluded. The 1,000 primary root tasks occupied **242.8 wall seconds**, about **4.12 roots/second**, including B choices, all alternatives and the fixed deeper subset. Profiled Node CPU in those tasks was **52.3 seconds**; this excludes child-process CPU. Edax's printed native CPU counters and raw transcripts are retained, but the report does not claim a precisely instrumented total campaign CPU time. Small-query startup/model loading is included in wall throughput and is a likely amortization opportunity.

Coordinator RSS was about **640–990 MiB** during admission/labeling, largely from historical keys and JSON admission. Forty seconds of read-only native process sampling captured 285 live Edax samples, peaking at **57.25 MiB RSS**; this is a sampled maximum, not a guaranteed process high-water mark. Sample files remain local. This single-worker workload stayed comfortably within measured headroom. No maximum-throughput claim is made, and concurrent launcher tests briefly ran during labeling; these are local planning measurements rather than controlled hardware benchmarks.

### Provenance, checks and remaining uncertainties

Run: `.local-research/teacher-audit-v1-20261028/`. Frozen source SHA-256: `632c97135dd5a189b7f868fe05f207087bba87ed13eb258eb860666e72b20242`. Binary SHA-256: `23f8808166ed97af3a0ea43705374a8847b258c9ea1e4ed2861e48ad2f6ccf9c`. [Compact evidence](data/teacher-audit-20261028.json) records the protocol, identities, gates, examples, profiles and hashes of original manifest/roots/results. Full data, sources, raw transcripts, failed adapter-development probes and recovery receipts remain local. `scripts/teacher/publish.mjs` recomputes the main counts from individual receipts and refuses incomplete or mismatched evidence.

The baseline suite passed 62 JavaScript tests before implementation. The expanded suite passed **65/65**, and the Python suite passed **18/18** (69.1 seconds), with two existing subprocess-lifecycle ResourceWarnings recorded. After the audit, the adapter's full 35-fixture native validation passed again. Post-run hardening adds invalid score/depth rejection, build metadata, and a completed-run launcher guard; it changes no recorded labels or scientific rule. The guard was exercised on the completed run and performed no new computation. No executable inputs were edited during the active audit. Current macOS hardware was unavailable; Linux/WSL success does not validate Mac builds or native Windows execution.

The main remaining uncertainty is teacher depth. This round establishes that the independent executable can supply verified exact values and distinct earlier preferences, but **does not establish that D10 is accurate enough for training**. A subsequent reviewed step should calibrate deeper full-width settings on a fixed new bounded subset, with throughput/depth-stability measured before another 1,000-root audit. For example D12/D14 may be informative, but their cost is unmeasured and no such run was started. A second independent engine could distinguish shared horizon errors from depth instability if the deeper Edax test remains ambiguous. Do not silently lower Astra's thresholds or reinterpret stable disagreements as proven strategic mistakes.

B remains the production player. No learned model was fitted, no tournament strength claim was made, and no six-hour campaign was launched.
