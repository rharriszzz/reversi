# Next residual strategy: fix the linear control before adding representation

**Primary architecture: B plus a less-constrained 21-weight residual.** The seven-feature model has not reached a demonstrated expressive ceiling. New exploratory checks show that the old regularization grid and, subsequently, the correction bounds suppressed substantial improvements on old development data. The preferred compact pattern residual is a credible **single nested challenger**, not yet the next selected player.

**One initial experiment:** compare that linear candidate with unchanged B on fresh positional assessment and a fixed small equal-time screen; include one corner/edge challenger to test incremental representation on the same labels. Forecast: approximately **96 minutes with sustained two-worker capacity, or 117 minutes with one**, including 35% allowance and a separate 15-minute reporting reserve. This is a proposed two-hour ceiling, not authorization to launch. No new campaign, teacher query, assessment reservation or game was started for this strategy.

## Evidence and what changed the diagnosis

Sources: [completed residual experiment](RESIDUAL_FRONTIER_RESULTS.md), [unchanged frozen protocol](RESIDUAL_FRONTIER_PROTOCOL.md), [earlier campaign](STRONG_EVALUATOR_RESULTS_20261028.md), [subsequent long-pattern screen](NEXT_EVALUATOR_RESEARCH.md), and [new compact diagnostic evidence](data/next-residual-strategy-20261029.json).

The original result remains exactly as published: **2.08% independent preference-loss improvement**, failure of its fixed 5% gate, a favorable but uncertain depth-six regret difference, and no confirmation games. Nothing below changes that outcome or retroactively qualifies another model under that experiment.

New checks used only its **1,600 training and 400 development preference corpora**. All old locked assessment is now disclosed evidence, never a fresh selection set. No old assessment labels were used in these exploratory fits; the cost projection additionally reads already completed assessment-task **timings**, without their scores. The original run, model, protocol, teacher and receipts were not written.

### Regularization was a major limitation

The diagnostic copied the existing fitter into a separate scratch directory. The first comparison changed only the allowed λ grid. Temperature 10, source normalization, objective, projected/backtracking optimizer, tolerance, training-only moments and ±25 bound stayed unchanged. The λ = 1e-4 fit reproduced the frozen training/development losses **exactly**.

| λ | Correction bound | Training preference loss | Old development loss | Development improvement over B | Maximum correction | Coordinates at bound |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| B | — | 0.534869 | 0.554185 | — | 0 | — |
| 1e-4, frozen selection | 25 | 0.523254 | 0.544226 | 1.80% | 3.227 | 0 |
| 1e-5 | 25 | 0.482482 | 0.507766 | 8.38% | 21.605 | 0 |
| 1e-6 | 25 | 0.459216 | 0.485776 | 12.34% | 25.000 | 9 |
| 0 | 25 | 0.458380 | 0.484996 | 12.48% | 25.000 | 12 |
| 1e-6 | 100 | 0.445514 | 0.472335 | 14.77% | 62.326 | 0 |
| 0 | 100 | 0.434956 | 0.461374 | 16.75% | 100.000 | 2 |

The two wider-bound controls changed only the validation bound and the fitter's two box projections in a **second scratch copy**. They are new exploratory controls, not repairs to the frozen experiment. All six fits converged. Timed diagnostic arithmetic, including controls and curves, took about **7.6 seconds after loading the old receipts**.

At the frozen optimum, the L2 penalty was **0.005473**, against an unregularized training-loss reduction of 0.011616. The largest unregularized loss-gradient coordinate remained **0.000645**. The tiny reported projected gradient, 9.66e-10, established convergence of the **penalized** objective, not optimality of preference loss alone. At an interior optimum, `∇loss = -2λδ`; this quantitatively explains the remaining gradient. Loss is a mean over source trajectories, so adding sources does not dilute a fixed λ. The training-moment preconditioner also does not rescale the penalty.

Small fitted coefficients and unused ±25 bounds therefore did **not** show that seven features had little left to learn. The weakest permitted λ won development selection, and the lower-λ controls expose the missing part of that regularization path. Once shrinkage is relaxed, the original bounds become active too. Even the ±100 control touches two bounds: do not call it the unrestricted optimum of all seven-feature evaluators.

### This is more than logistic score calibration

All rows below are **old development**, with the original source weighting. Frontier regret is relative to estimated Edax D12 sibling values; it is not deeper root regret or solved game value.

| Model | Nonpositive supported-preference mass | Mean frontier top-choice regret |
| --- | ---: | ---: |
| B | 25.93% | 4.86250 |
| Frozen λ = 1e-4, bound 25 | 25.33% | 4.68250 |
| λ = 1e-6, bound 25 | 23.16% | 4.15875 |
| λ = 0, bound 100 | 22.21% | 3.98750 |

A positive scale-only control, fitted on training nonterminal preferences, chose `E = 0.880795 × B`. Development loss fell only to **0.550020**; nonterminal sibling order is unchanged by that scaling. This is much less than the relaxed linear fits' gains. The scale calculation excludes terminal-containing pairs and renormalizes sources; it is a calibration diagnostic, never a replacement terminal utility or teacher-disc conversion.

Nevertheless, logistic loss rewards margins as well as decisions. Its fixed temperature and gap-capped preference weighting need not optimize minimax root regret or win probability. Lower source loss, fewer ranking errors and lower immediate regret are useful evidence, but none establishes stronger equal-time play. The new experiment keeps the loss fixed to isolate representation and constraints rather than changing several causes together.

### Learning curves and ablations need a narrower interpretation

The frozen λ = 1e-4 development curve was nearly flat: 0.543981 at 100 sources and 0.544226 at 1,600. Repeating the curve with λ = 1e-6 and the **same ±25 bound** gives:

| Independent training sources | Development preference loss |
| --- | ---: |
| 100 | 0.495453 |
| 400 | 0.488681 |
| 1,600 | 0.485776 |

Additional sources became useful when the excessive shrinkage was relaxed. The old flat curve did not establish data saturation. These exploratory points reuse development and have no fresh assessment status; the changing training prefixes also make raw training losses across sizes incomparable as a pure learning curve.

Frozen leave-one-feature-out corrections showed the largest preference-loss contributions from frontier discs, mobility and X-square exposure; corner corrections contributed little. All 21 individual coefficient removals worsened locked loss slightly, but **none** of the seven feature-group removals changed teacher-relative regret on the fixed 32-root ablation subset. These conditional, correlated ablations neither prove a feature dispensable nor explain the full-sample root improvement. A rarely varying corner count can have a small fitted correction while conditional corner geometry remains important.

### Exact feature collisions establish a small real representation gap

Without rounding or approximate binning, **54 training preferences from 50 sources**, and **19 development preferences from 18 sources**, give both nonterminal children exactly the same phase-block seven-feature vector and B score. Recomputing features directly from their saved boards confirms every collision. No weight choice, or any deterministic evaluator using only those identical inputs, can give the pair a nonzero score margin.

The two proposed antisymmetric corner/edge pattern encodings differ for **32/54 training** and **10/19 development** tied pairs. One old-development example, `development-146`, parent 1, prefers square 34 over 23 by **29 D10 / 30 D12 estimated discs**, despite identical seven-feature inputs. This is direct evidence that local patterns can encode information missing from the aggregate features; it is not a causal explanation of a deeper searched root score or proof that every such preference is jointly learnable.

These exact ties carry only **0.132% of training** and **0.147% of development** preference weight. Their unavoidable logistic contributions are just **0.000918 / 0.001019** respectively. They prove some missing information, not that representation accounts for most remaining loss. The two templates still cannot distinguish the other nine development ties. This is a reason for a narrowly controlled shadow probe, not for adding every diagonal/short pattern now.

### Sampling and supervision remain plausible limits

Training labels describe siblings above the frontier of **B's best two full-window continuations**, under B1/12% and B4/2% source policies. They are accurate, independently supported teacher preferences at those boards, but they are a selected distribution. A changed evaluator can choose different continuations and visit different leaves. Stable D10/D12 order also need not equal game-theoretic truth in early positions.

The old depth-six gain was concentrated in late source positions; its uncertainty included zero. Earlier long-pattern models improved shallow late-game rankings yet lost their game screens. Together these observations argue for checking deployment frontiers and backed-up root choices, not substituting more final-margin regression, outcome anchoring, or another architecture tournament.

**Diagnosis:** constraint choice demonstrably explains much of the small old gain on train/development; optimizer failure is unsupported. Representation, distribution shift and objective/teacher alignment remain unresolved as causes of the remaining errors and uncertain playing strength. A limited probe cannot identify all of them uniquely.

## Selected primary model and the one challenger

### Primary L: retain the original seven features

Use `L(s,p) = B(s,p) + δ[phase(s)] · φ(s,p)`, with the same feature definitions, original phases at 28/52 occupied, temperature 10, exact terminal handling and unchanged search. Fit only the 21 corrections. Compile `original weight + correction` once; static evaluation has the same operations as B.

For the proposed screen, nominate **λ = 0, |δ| ≤ 100**, using the minimum old-development preference loss among the six measured controls. This is an explicitly exploratory nomination made before any fresh data. Preserve the λ = 1e-6, bound-100 control as diagnostic evidence, not a second game finalist. Freeze the nominated weights, source/corpus identities and checksum before new assessment reservation or labeling. Start the implementation's corrections at zero and verify identity with B; do not import the old frozen finalist as a new baseline.

The new protocol and model validator must explicitly support the ±100 bound in a distinct artifact format. Do not pass those coefficients through the finished experiment's ±25 validator or represent them as its selected model.

With 21 coefficients and 1,576 informative training trajectories, bounded unpenalized fitting is worth testing. Its larger coefficients, boundary hits and altered feature signs are also reasons to demand fresh search and game evidence. Do not widen the bound again, tune temperature or select another λ after the new assessment.

### Challenger P: add just two pattern families to the frozen L

The user's preferred direction is plausible but **does not yet deserve replacing L as the primary architecture**. Specify one nested challenger:

`P(s,p) = L(s,p) + (p/8) Σtemplate ΣD4 T[phase(s), template, code(s)]`.

| Template | Ordered squares, A1 = 0 | Context supplied beyond B |
| --- | --- | --- |
| Corner six | `[0,1,2,8,9,16]` | Joint corner/X/C occupancy, adjacent edge support and local configurations |
| Edge eight | `[0,1,2,3,4,5,6,7]` | Edge gaps, runs, ownership and placement order that aggregate counts omit |

Ternary code is `Σ(board[square]+1)×3^j` in fixed Black orientation; multiply the final pattern sum by player. Tie reverse-color entries antisymmetrically, fix self-complement entries to zero, and sum all eight D4 transforms, including repeated geometries. Use each evaluated child's original B phase. The 1/8 normalization is explicit and is not inherited silently from the earlier seven-template model.

These tables can distinguish arrangements with the same aggregate corner/exposure/disc counts; B already captures some consequences through mobility/frontier features, so incremental usefulness is a hypothesis, not an automatic benefit. Diagonal tables could add interior line arrangements absent from these two templates, but their incremental benefit is unmeasured. Defer them: the old long family already included diagonals and still failed games, and another template would confound the smallest first contrast. No 77 short-template set, edge-X ten, corner-nine, extra phases, interpolation, native backend or incremental-search rewrite enters this experiment.

Freeze L's coefficients while fitting P's tables. All tables start at **exactly zero**, so the nested zero-pattern control equals L; with both δ and tables zero the whole construction equals B. Use the identical source-normalized logistic preferences and fixed terminal utility. Thus a P-versus-L comparison adds representation without changing global features, supervision, phase rule or loss.

For this **new** table fit, predeclare `λpattern ∈ {0, 1e-6, 1e-5}`, bounds ±25 B units, and L2 as the sum of squared **independent reverse-color-pair coefficients**, not an average divided by table size. Zero permits detecting another overly strong ridge. Unobserved reverse-color-pair coordinates remain exactly zero. Record distinct training-source support and unseen-cell rates; optimizer passes must not increase observation counts. Select λpattern once by old-development source preference loss, ties within 1e-12 favor smaller norm. No outcome-margin anchor or old four-phase SGD objective is reused.

Use deterministic sparse convex fitting, bounded coordinates and a projected-gradient convergence check in original coefficient units. Match sparse and compiled scores, analytical gradients and independent finite differences on small fixtures before fitting the full corpus. Fail qualification if full-corpus converged fitting, selection and the planned curves cannot fit their 10-minute envelope; save checkpoints and stop before fresh assessment. An incomplete optimizer state is not an accepted candidate.

This fit is a controlled probe, not a claim that the table prior is universally optimal. A negative result rejects this geometry/normalization/fit, not every possible pattern representation. P must improve **over L**, not over the over-regularized old finalist, to justify further pattern work.

## Evaluation cost and search throughput

Reuse `scripts/strong/model.mjs`'s template geometry, typed tables, reverse-color folding and serialization ideas, plus `fillFeaturesFast`. Do **not** directly reuse its deployment phase rule, 0.4×B initialization, mixed training targets or clipping: that earlier hybrid is not the exact B-preserving construction above. Use one B feature scan, known-mobility reuse, one seven-term sum and only 16 pattern lookups. Obtain occupied count from the B scan; there is no second full-board occupancy scan, runtime sparse Map or feature-vector allocation.

Three phases of `(3^6 + 3^8)` Float32 entries occupy **87,480 bytes / 85.43 KiB**. There are 21,870 physical entries before tying color pairs and any spatial redundancy. Counts and fit-time encoding add memory separately; this table size alone says nothing about fitting RSS. Keep learned linear coefficients in Float64; verify compiled table-rounding tolerance and zero-residual identity. No Int16 quantization is needed.

A cost-only prototype was run on **16 old training roots, one per source cell**, with five rotated-order static repetitions and three depth-six search repetitions. Tables were zero or arbitrary antisymmetric **synthetic values**, never fitted. The complete zero path remained active; its search scores, moves, node counts and evaluation counts matched B exactly. D4 and color checks passed.

| Evaluator | Complete static µs, no known mobility | Static µs, known mobility | Median ms / 16 depth-six searches | Nodes/s |
| --- | ---: | ---: | ---: | ---: |
| B | 1.019 | 0.950 | 1,061.0 | 181,393 |
| Fused seven-feature B control | 0.933 | 0.875 | 1,039.4 | 185,172 |
| B + two zero tables, full work | 1.184 | 1.168 | 1,088.2 | 176,872 |
| B + synthetic two-table residual | 1.217 | 1.154 | 1,153.5 | 167,861 |
| Historical frozen long preferences | 0.607 | 0.585 | 853.9 | 217,826 |

An earlier independent repetition gave **9.5%** matched zero-table search overhead; the table above gives **2.6%**. Treat this as short engineering measurement variation, not a confidence interval or guaranteed speedup. The synthetic and historical models visit different trees; their nodes/s differences are not pure evaluator-cost effects. The two complete cost probes took about 16 and 18 seconds. No playing-quality inference follows.

The historical hybrid cost **7.719 µs** on its earlier corpus and used 84 templates / 672 transforms. The new probe uses two / 16. Those absolute microseconds are from different workloads and cannot support a claimed sixfold speedup. The old long evaluator's 0.839-µs historical result and new 0.607-µs probe also differ by workload. Retaining all B features cannot retain the absolute pattern-only evaluation cost: mobility/frontier computation still costs time. The attainable advantage is compact lookup overhead and shared scanning, not free positional features. The historical long preference model's 42.19% / 34.38% game scores remain negative screening evidence.

Before fresh assessment, require a repeated zero-table matched-search throughput ratio **≥0.90 of its feature-only reference**, with exact scores/moves/nodes: compare with B at δ = 0 and with L at the trained δ. Measure the full learned L/P evaluator on old development positions at fixed depth and 80/300-ms move budgets. Record completed depths, nodes, evaluations, total evaluator time and deadline behavior. Only the zero control isolates evaluator overhead; actual equal-time games decide whether new scores compensate for any loss of throughput. Stop labeling/training workers before timed measurements.

## The single proposed experiment: a nested constraint/representation screen

### Freeze and reuse

Use a new run, proposed namespace `residual-constraint-pattern-screen-v1-20261029`, with immutable source, protocol, model and teacher identities. Do not resume or amend the finished residual experiment. Reuse **only old training for fitting and old development for nomination/selection**. All old assessments, examples, engineering roots and reserved openings are historical/disclosed, even if their games were never played.

Primary candidate is fixed L above. B is the unchanged reference. P is the only extra representation. Before reserving fresh assessment, require P's old-development preference loss to be at least **5% lower than L's**, with no increase in old-development source-mean frontier regret. Otherwise omit the P shadow arm and proceed only with the already nominated L; record that decision before fresh data. This exploratory filter avoids buying new labels for an obviously unhelpful added representation and is not fresh evidence of superiority.

Freeze all eligible weights/checksums. Reserve the complete independent positional sample, root-transfer subset and opening pool jointly **before any new assessment teacher label**. No fresh result may change the candidate, coefficient bounds, λ, temperature, patterns, opening count or sampling quotas.

### Independent assessment and a distribution check

Reserve **96 accepted complete source trajectories**: six in each of the original 16 occupied-stratum × B-policy × source-depth cells. This preserves the 12–19 / 20–35 / 36–47 / 48–55 strata, B1/12% and B4/2% policies, depths four/six, and balanced turn/parity marginals. Stop on an infeasible acceptance forecast; do not confuse 96 attempts with 96 accepted roots or silently shrink the target.

On each new root, collect verified best-two continuation frontiers separately under **B and L**, deduplicate their parent/child union, and independently label every required legal alternative with the unchanged qualified Edax D10/D12 configuration. These two selectors expose the shift from B's training frontiers to the primary candidate's deployment frontiers. Keep passes, early terminal lines, child phases, parser rejection and both independently solved endgame conventions exactly explicit.

Compute **separate B-selector and L-selector preference panels**, normalizing within each source in each panel. Apply B, L and eligible P to the same labeled siblings. Do not pool twice as many parents from one trajectory as independent observations. Report source-stratified paired bootstrap uncertainty by resampling complete trajectories jointly across panels, plus phase/policy/source-depth, preference error, D12 top-choice regret, disagreements, significant reversals and exact W/D/L diagnostics.

Fix **64 root-transfer sources**, four per cell with balanced turn/parity, from those 96 IDs before labels. Independently label all their root alternatives and compare B/L/eligible P at **both depths four and six**, using comparable full-window alternative values and deterministic ties. Keep terminal values fixed. Report source-level intervals, not preference-count intervals; immediate-feature differences are not explanations of deeper minimax scores.

Historical exclusions must load the complete previous campaigns, qualification/query PV boards, all original residual trajectories and queried children, disclosed fixtures, unused reservations and this round's old-data benchmark inputs. Reuse the compact canonical D4/color SHA-256 index and complete-trajectory checks, not root-only exclusion. Exclude new roles from one another; common random prefixes below 12 occupied remain a disclosed dependency. New labels are read-only assessment, never training additions.

Audit the newly revealed teacher PVs for forbidden cross-role collisions too. A collision blocks the affected independence/strength claim; it does not authorize replacing a source after seeing its label.

This checks a specific frontier-distribution shift. It does not replace B-generated source policies with a representative sample of every human/opponent policy, and does not test P-selected frontiers. P is a shadow representation until a separate decision; no general distribution or architecture sufficiency claim follows from 96 sources.

### Fixed equal-time screen, conditional on positional eligibility

For L to reach games, require at least **5% relative preference improvement over B on both selector panels**, a positive paired source-bootstrap improvement interval, and **no increase in mean D12-relative depth-six root regret** versus B on all 64 transfer roots. Report uncertainty; the mean-based root gate is not a statistical noninferiority proof. For the two panel loss claims use one-sided 97.5% lower bootstrap bounds, with 10,000 whole-source stratified resamples. Depth four remains a diagnostic.

Reserve **32 new 12/13-occupied openings**, balancing policy and turn, and use both colors. If L passes, play all 32 L-versus-B opening pairs at **80 ms and 300 ms**: 128 games. If P was eligible before assessment and also improves preference loss over L by at least 5% on **both** new selector panels, with the same simultaneous source treatment and no depth-six regret increase over L or B, add the predeclared **32 P-versus-L pairs at 80 ms**: 64 shadow games. Maximum: **192 games**, all timed serially with no labeling/fitting workers.

Use ordinary production iterative deepening, pass/terminal utility and deadline semantics; only the evaluator changes. Alternate first color/condition order by opening, freeze the order before results, and preserve complete paired outcomes. Report wins/draws/losses, opening-pair means, 10,000 corrected pair-bootstrap resamples, completed-depth distributions, nodes/evaluations, evaluator cost, move times and deadline overruns. The primary L-versus-B claim requires one-sided **97.5% lower score bounds above 50% at both controls**; this is the same two-comparison simultaneous treatment as the completed experiment. Shadow P-versus-L uncertainty is descriptive, not an additional production-promotion claim.

No outcome-based opening replacement, interim extension or finalist switch is allowed. An unexpected forbidden trajectory collision blocks a strength claim; retain the evidence and do not silently replace the opening. If the positional gates fail, skip the corresponding games. B remains production under every outcome.

Thirty-two pairs per condition can identify a large advantage or a clear failure, but may leave modest strength changes uncertain. This is a bounded go/no-go screen, not a promise to resolve a small Elo difference in two hours. An inconclusive interval means stop at the fixed sample, not automatically buy more training or games.

## Complete computational envelope

The evidence records all 16 cell maxima, the 3.535 admission-attempt factor and the original pilot's conservative measured parallel speedup of 1.8458. Costs use completed **training/development** tasks and completed root-search/teacher **timings**, rather than assuming long-pattern speed equals teacher speed. No assessment score was consulted to choose this budget.

| Stage | Conservative raw minutes at one worker | Basis |
| --- | ---: | --- |
| Reserve 96 sources + 32 openings | 1.51 | Cell maximum trajectory costs × measured rejection factor |
| Verified B/L continuation collectors | 4.14 | B work plus twice B work for changed L trees |
| Union-frontier D10/D12 labels | 21.61 | Twice original cell maximum complete-source labeling work |
| 64 independent root labels | 2.50 | Cell maxima from completed all-alternative root queries |
| B/L/P root searches, depths four/six | 4.17 | Twice observed task maxima for all three evaluators |
| Old-data encoding, fits, selection, curves | 10.00 | Qualification envelope; must be measured before labels |
| Maximum three timed conditions | 25.51 | 32 × (two 80-ms + one 300-ms pair cost), serial |
| Engineering checks + statistics/audit | 6.00 | Three minutes each; implementation work is separate |

Game planning takes the larger of measured pilot pair costs (**6.94 s / 22.83 s**) and **104 remaining placements × budget**, yielding **8.32 s / 31.20 s** before allowance. Deadlines/checkpoint variation remain covered by the global allowance; these are planning bounds, not a theorem that the production time checker cannot overrun.

Apply **1.35 to the complete raw envelope**, then add **15 reporting minutes separately**: approximately **116.9 minutes at actual pool one**, or **95.9 minutes at sustained pool two**. Only reservation/collection/labels/root searches receive measured parallel speedup. Timed games and fitting are conservatively serial. The shadow arm and all its games are budgeted even if earlier gates eliminate them.

These are conditional forecasts, not measured end-to-end costs of a trained pattern residual. New source rejection tails, sparse fitting convergence, L's changed trees and OS activity can invalidate them. Before opening fresh assessment, run Windows/WSL resource preflight and the old-data qualification; reforecast with actual pool and completed engineering costs. Within the three-minute engineering envelope, also probe complete L-selected frontier labeling on four old training roots, one per occupied stratum, and changed-model root search. Keep those engineering queries separate, add their PVs to exclusions, and never feed their new labels into fitting. If the qualified costs make the full fixed target exceed the proposed two-hour ceiling, stop before fresh labels and report the blocker, rather than reduce the sample or weaken a gate. Keep configured count, safe cap, actual pool, active native queries and sustained measured throughput distinct. Restore two workers only through a safe, checkpointed resource decision; never forecast its speed while actually running one.

Use atomic task/optimizer/game checkpoints and the existing bounded keep-awake mechanism. Preserve partial computation, but never accept incomplete searches or nonconverged fits. Avoid retained lists of visited boards in aggregate reports: reference immutable task receipts, as the last run's serialization repair demonstrated. Pause/drain before the session ceiling. No applications, saved settings or production defaults change.

## Decisions fixed before execution

| Result | Scientific interpretation and action |
| --- | --- |
| Relaxed L fails fresh loss or root gates | Old development gains did not establish transfer. Investigate selection/distribution or decision alignment; do not declare feature capacity exhausted or extend this run. |
| L improves frontier loss, but root decisions or games fail | Better sibling preferences were insufficient for stronger search/play. Abandon a larger same-objective weight-only campaign on this evidence. |
| L passes both positional panels, root gate and simultaneous equal-time criterion | Constraint correction produced a credible stronger candidate. A larger **linear** data campaign is justified only if the predeclared 400/800/1,600-source development curve still improves meaningfully, at least 1% relative from 800 to 1,600; otherwise stop training and review the existing candidate. No automatic production promotion. |
| L passes its simultaneous equal-time criterion; P also adds ≥5% fresh loss improvement over L in both panels, passes root/speed gates, and its 80-ms paired screen has mean >50% with a one-sided 95% lower bound above 50% | Added local representation has evidence beyond constraint repair. Recommend a separate larger pattern study, with fresh P-deployment and 300-ms confirmation before any P strength/promotion claim. Larger pattern **training** additionally requires at least 1% relative development-loss improvement from 800 to 1,600 sources on its predeclared curve. Treat the shadow interval as screening evidence, not simultaneous proof that P beats B. |
| P cannot beat L, only fits training, loses the L-selector gain, exceeds the speed envelope, or has unfavorable/uncertain root/game evidence | Abandon **this two-template residual under this protocol**. Do not enlarge the tables, change regularization or add diagonals against fresh outcomes to rescue it. This is not a theorem against all pattern evaluators. |
| Both models have uncertain strength at fixed samples | Publish the uncertainty and stop. No extra campaign follows automatically; small-sample uncertainty cannot honestly be eliminated by a different narrative. |

The representation contrast uses identical supervision and frozen L coefficients: P-over-L improvement on new data would demonstrate useful additional model terms under this objective. Report the exact-feature-tie subset separately: a nonzero correct margin there establishes added information, whereas some gain elsewhere could proxy for further global corrections outside L's fixed bounds. The bound-100 L still has two active coordinates, so P-over-L gain alone is not proof that an unrestricted seven-feature model could never match it. Conversely, linear constraint relief already improved old held-out ranking without new representation. If both gain frontier loss but fail backed-up decisions, objective/distribution transfer deserves priority over model size. This crossed evidence narrows the causes; it cannot uniquely separate teacher bias from every possible loss or policy-distribution defect.

## Recommended implementation sequence and checks

1. Preserve the completed run. Reproduce the exact λ = 1e-4 fit and the nominated bound-100 control in a new diagnostic/output namespace. Freeze L and its corpus/source checksum. Verify B-zero identity, phases, passes, color antisymmetry, serialization and terminal behavior.
2. Add only the specified optional table residual using existing geometry/compilation infrastructure. Keep a separate model format and explicit original B phase rule; freeze L while fitting tables. Check zero identity through full-window and ordinary search, sparse/compiled parity, D4/color symmetry, analytical gradients and distinct-source support counts. No production default changes.
3. Qualify full-corpus fit cost/convergence and 400/800/1,600-source learning curves on old data. Select the one P regularization and apply the exploratory admission rule. Benchmark complete trained evaluation/search cost. Abort infeasible or slow work before fresh assessment; retain its checkpoints.
4. Freeze the new protocol and all eligible models; jointly reserve/exclude fresh source and game roles. Run the 96-source / 64-root assessment and only the eligible fixed timed conditions. No new data feed training. Recompute uncertainty at the source/opening-pair unit and preserve all receipts.
5. Publish all arms, exclusions, coverage, cost and negative results. Request a separate decision before any larger campaign or production promotion.

Lightweight work completed for this strategy: **115 JavaScript tests and 26 Python tests passed after edits**; the frozen fit reproduced exactly; six convex sensitivity fits converged; scale and learning-curve controls completed; two cost-only prototypes verified real-search zero identity plus D4/color behavior. Original checkpoint/source hashes and the qualified teacher identity were checked without native teacher queries. WSL2/Node measurements were made on this host. Current macOS hardware was unavailable; no new browser or macOS test is claimed because production interaction code did not change.

Reproduce the read-only exploratory checks in **new** ignored outputs:

```bash
npm test
node scripts/residual/diagnose-strategy.mjs \
  .local-research/residual-frontier-v1r2-20261028 \
  .local-research/strategy-diagnosis-recheck
node scripts/residual/strategy-cost.mjs \
  .local-research/residual-frontier-v1r2-20261028 \
  .local-research/strategy-cost-recheck.json
```

These commands analyze old evidence and prototype cost; they do not launch the proposed experiment. No new required runtime dependency or production engine replacement is introduced.
