# Teacher strategy after the Edax audit

28 October 2026. Review of `rharriszzz/reversi` at `3936e2784c9df59476c3675ea97530525f1c09c1`. Completed using GPT-6.1-Sol after the requested Astra model was unavailable. This document proposes a subsequent experiment; this review ran no new teacher search, training or games.

## 1. Recommendation and interpretation

**Keep the independent teacher approach, test deeper searches, and simplify the first learning experiment.** The next computation should measure teacher reliability and cost, with a 120-minute ceiling and an earlier calibration-only exit. If that succeeds, prepare a small B-preserving linear fit on independently searched frontier positions. Defer differentiation through minimax branches and additional pattern tables until that simpler experiment demonstrates transfer through search.

The [completed audit](TEACHER_AUDIT.md) failed all three declared decision gates. Stage B correctly did not start. Neither this review nor its revised criteria changes that disposition. All revised gates below apply to fresh reserved data.

The audit establishes three different things:

* **Adapter correctness on tested endings:** all 668 alternative values from 128 independently solved eight-empty anchors matched. This strongly supports coordinates, perspective, pass handling and terminal-value conventions on those cases. It does not establish opening or middlegame evaluation accuracy. The 668 alternatives share 128 roots and are not 668 independent strategic tests.
* **Limited horizon consistency:** the full D8 best set remained best at D10 on 177/250 roots, or 70.8%. Choosing one deterministic D8 best move gives 188/250, or 75.2%. Both fail the original 90% requirement. D10 is another estimate from the same engine and evaluator, rather than ground truth.
* **Potentially useful independent information:** stable disagreements with B depth six exist, including substantial estimated differences. Their learnability and contribution to equal-time playing strength remain untested.

“Full window” means an unbounded value for the specified heuristic search, rather than a cutoff bound. It does **not** mean exact game-theoretic value unless the game is solved. Accepted approximate values remain estimated Edax discs. Edax awards unplayed terminal empties to the winner; our game records occupied-disc margins. Compute both conventions independently at solved anchors, retain their provenance, and do not subtract empties from approximate scores to invent a conversion.

### What the retained scores add

I recomputed the following from all 1,000 immutable root receipts, after checking the original manifest, roots and results hashes against [the published artifact](data/teacher-audit-20261028.json). The [compact descriptive reanalysis](data/teacher-strategy-diagnostics-20261028.json) records histograms, definitions and receipt identity. These are post-hoc diagnostics, not new pass criteria for the old audit.

For a fixed tie-break (lowest row-major move index), define regret as the D10 best alternative value minus the D10 value of the D8 choice:

| Estimated regret | Roots out of 250 |
|---|---:|
| 0 | 188 |
| 1 | 21 |
| 2 | 25 |
| 3 | 10 |
| 4 | 5 |
| 7 | 1 |

Thus **234/250 = 93.6%** lost at most two estimated discs, mean regret was **0.512**, and six choices lost at least four. Taking the worst member of every D8 tied-best set gives mean regret **0.616**, with eight roots losing at least four and maximum eight. Eleven of the 73 failed best-set checks disappear simply by specifying the deterministic tie-break.

This is much less alarming than interpreting 29.2% instability as a 29.2% strategic-blunder rate. It still contains consequential reversals. Among the union of alternatives within two discs of best at either horizon, plus B's choice, two roots had a pair go from at least four discs ahead to at least four behind. On one root, the deterministic D8 choice was evaluated at D10 as at most −2 while another move was at least +2. These are estimated sign changes, not proven losses of wins.

B depth six had mean D10 regret **2.172** on the 250 checks. On the 69 stable disagreements its mean was **5.551**, with 45 gaps of at least four. However, the 15 representative early disagreements averaged only **2.067**, seven were one-disc differences, and only three were four-disc differences. There appears to be a more difficult early-game signal than the pooled disagreement count suggests. D10 judging a D10-derived choice is also structurally favorable to the teacher; these numbers do not independently establish teacher playing superiority.

### The original gates had denominator and purpose problems

The 100-disagreement target applied to **250 checked roots**, requiring a 40% stable-disagreement rate, rather than 10% of all 1,000 roots. The representative early target applied to **63 checked roots**: 32 at 12–19 occupied and 31 at 20–35. Thirty disagreements required **47.6%** of that population; the observed 15/63 was 23.8%. Only 48 of those 63 roots passed best-set stability, making the count requirement especially demanding.

The original plan did not supply evidence that such high rates should occur. A competent B can agree with a strong teacher often while still having valuable correctable weaknesses. Conversely, many disagreements could reflect a noisy teacher. Reliability and useful-label yield should therefore be separate gates. Absolute counts should follow from the number of independent examples needed for a small fit and measured collection cost.

Requiring every tied shallow optimum to remain exactly optimal was conservative, particularly with integer-rounded estimates. It penalized near-equivalent alternatives and did not directly assess the quality of relative scores elsewhere. The broader audit population also mixed representative roots with B d1/d3 disagreements in equal proportions; the latter are not necessarily B d6 mistakes. Report those groups separately. “Representative” always refers to the declared generation and historical-exclusion procedure, not expert games or all legal Reversi positions.

## 2. Reliability measures and their calibration

Let `q_D(s,a)` be an estimated, full-window, common-depth score for root player `s.turn`, and `a_D` the deterministic maximizing move. Let `R` denote a stronger reference horizon. Use the following measures together:

| Measure | Definition and interpretation |
|---|---|
| Choice regret | `max_a q_R(s,a) - q_R(s,a_D)`. Report mean, median, p90/p95, maximum and counts above 2/4/8. This distinguishes small tie changes from large errors. |
| Tied-set sensitivity | Report both deterministic-choice and worst-shallow-tie regret. State the tie policy used by training and play. |
| Significant reversals | A pair has a gap ≥4 in opposite directions at D and R. Primary pair set: alternatives within 2 of best at either depth, plus B's move. Count roots, not every correlated pair. |
| Near-best coverage | Whether the chosen move remains within 2 of reference best; overlap of near-best sets is secondary. Large acceptable sets should not inflate an exact-match statistic. |
| Competing-score stability | For each near-best/B pair compare `q_D(a)-q_D(b)` with `q_R(a)-q_R(b)`. Report absolute change and sign reversal by initial gap. Choice stability alone does not validate regression targets. |
| Outcome severity | On solved positions count exact win→draw/loss and draw→loss separately, even with a small margin gap. Earlier, report estimated sign reversals and an explicit uncertain band; do not call signs calibrated win probabilities. |
| Continuation variation | Replay PVs, compare common placement prefixes and re-search divergent branches. A changed line may reflect equivalent replies; a stable line may retain a shared evaluation error. Neither is a standalone accuracy certificate. |
| Exact agreement | Compare every alternative with the independent solver, under each explicitly stated terminal convention. Also test truncated estimates against exact choices and W/D/L. |

For example, +1 versus −1 at an exact ending changes a win to a loss and must receive more attention than +20 versus +18. A one-disc early heuristic reversal has no such established interpretation. With integer scores, differences of one are particularly fragile.

The two-disc near-best tolerance, four-disc significant gap and ±2 sign band below are **predeclared engineering tolerances**, not calibrated error bars or known win-probability thresholds. On calibration data, tabulate errors of pair gaps against farther horizons and exact endings by phase and gap size. Report sensitivity at 1/2/4/8 without selecting a favorable threshold afterward. Exact late-game calibration cannot establish opening calibration.

Use these observations to weight future constraints: omit unresolved/tied preferences; prioritize robust competitive alternatives over ordering obviously bad moves; cap gap weights so large estimated margins do not dominate; normalize total contribution per source trajectory. A preference stable at two horizons can receive more weight than a single-horizon preference, but agreement between correlated horizons is not a probability of correctness. Only an independently validated uncertainty model would justify such a probability. Keep solved W/D/L constraints separate from estimated-disc constraints.

For assessment, report 95% Wilson intervals for root-level proportions and stratified root-bootstrap intervals for means and paired differences. Bootstrap complete source trajectories if multiple roots/leaves share one. These describe sampling uncertainty conditional on admission; they omit systematic teacher bias. Freeze sample sizes, use complete samples, and do not stop on favorable intermediate intervals.

## 3. Stronger searches and the cost tradeoff

The completed run used **324.1 active wall seconds**, leaving about 114.6 minutes of its cap. This supports measuring deeper searches before abandoning the approach. It does not establish that D14 or D16 is affordable.

Read-only receipt timings provide a firmer starting point than the aggregate audit duration:

| All-alternative root label | Mean seconds | Median | p95 | Maximum |
|---|---:|---:|---:|---:|
| D8, 1,000 roots | 0.118 | 0.110 | 0.182 | 0.324 |
| D10, 250 roots | 0.290 | 0.200 | 0.793 | 1.606 |

These include adapter startup and native work, exclude B searches/admission/reporting, and come from different-sized samples. They are wall costs, not summed child CPU times. The old report's 52.3 seconds of Node CPU excluded Edax CPU. The old sampled 57.25 MiB native RSS maximum was not a guaranteed process high-water mark; coordinator RSS approached one GiB because of admission indexes.

Measure D10, D12 and D14 first. Measure D16 only if the cost forecast fits. Include an odd intermediate horizon to expose parity effects hidden by comparing only even depths. Record phase, branching factor, nodes, static/native counters where available, wall and child CPU time, maximum RSS, timeout rate and bytes per receipt. Separate independent-child evaluation cost from best-root-query cost.

For illustration only, let `g` be the cost multiplier per extra two placements, starting at the old 0.290-second D10 mean:

| Assumed g | D12 seconds | D14 seconds | D16 seconds |
|---|---:|---:|---:|
| 2 | 0.58 | 1.16 | 2.32 |
| 4 | 1.16 | 4.64 | 18.56 |
| 8 | 2.32 | 18.56 | 148.48 |

These are sensitivity calculations, **not measured deeper costs**. Endgame transitions, transpositions, ordering, small hash tables and heavy tails can invalidate constant growth. Increasing depth costs CPU primarily; memory need not grow exponentially with a fixed TT, but must be measured.

### Search settings and alternatives

Retain the pinned Edax 4.6 executable/data and audited adapter. In its [pinned search source](https://github.com/abulmo/edax-reversi/blob/713a434f13b3d15fb69c61b9ba3641aed82c496c/src/search.c), `NO_SELECTIVITY` is 5. The [midgame code](https://github.com/abulmo/edax-reversi/blob/713a434f13b3d15fb69c61b9ba3641aed82c496c/src/midgame.c) guards probabilistic cuts by selectivity; internal auxiliary ordering searches can still use different settings. Full-width here means the accepted result avoids probabilistic pruning; safe alpha-beta/TT pruning is appropriate. It remains a horizon-limited estimate.

Keep selectivity 5 as the first experiment's reference. Selective deeper search might eventually provide better decisions per second, but nominal depth is then an incomplete description. Its advertised selectivity percentage is not a calibrated confidence interval for each label. Our parser currently rejects selective output and the subprocess arguments hard-code selectivity 5: enabling it requires a separate explicit protocol/parser path. Do not weaken existing rejection checks. Compare selective versus full-width at equal teacher wall budgets against a third, stronger reference before using selective labels.

Hash bits 16 may become restrictive at deeper horizons. A calibration-only paired check at bits 18 on eight fixed roots can measure benefit; accept a hash change only with identical completed values, a measured throughput gain, and resource headroom. Freeze settings before assessment. Do not simultaneously tune depth, hash, selection and several engines on the assessment set.

All-alternative evaluation buys comparable relative scores and protection against missing a surprising move. The old audit averaged 8.75 alternatives per root. It may be wasteful for eventual preference learning, where the teacher best, B choice and close competitors matter most. A future reduced protocol should obtain a full-width **root best-value search**, then common-depth full-window child values for a declared contender set. Merely searching the shallow top three can miss a new best move and produces biased apparent reliability. Audit all alternatives on a fixed random subset and record unqueried values as missing. For the bounded reliability experiment below, keep all alternatives to avoid introducing this extra uncertainty.

Egaroucid is a useful second reference if deeper Edax remains ambiguous. Its author describes strong self-play supervision, separate opening labeling, incremental patterns and inexpensive dedicated ordering evaluation. Those are useful engineering precedents, not evidence our particular model will improve. [Technical explanation](https://www.egaroucid.nyanyan.dev/en/technology/explanation/). A second evaluator can expose shared Edax horizon bias, but disagreements still need adjudication; neither engine becomes ground truth by being stronger than B. Adding another adapter is deferred from this first run.

Genuine evidence beyond adjacent-horizon agreement includes improved exact regret at truncated endgames, absence of robust losses under farther/odd horizons, transfer to stronger-policy positions, and ultimately fresh equal-time games. Re-searching only the endpoint of a chosen PV does not validate every earlier opponent alternative.

## 4. Which learning strategy to pursue

The objective remains the **complete player beating B at equal elapsed time**. The evidence does not justify an architecture tournament.

| Approach | Assessment and role |
|---|---|
| A. Small changes to B weights | Preferred first parameterization: 21 coefficients, zero correction initially, original three phases. Cheap, inspectable, and preserves useful strategic inputs. Capacity may limit eventual gains. |
| B. B plus a few patterns | Plausible second step if reliable labels reveal irreducible errors. The previous hybrid contained many short templates; it did not isolate a small residual. Still adds cost and sparse parameters. |
| C. Separate ranking/ordering | A move policy and a leaf evaluator solve different problems. Ordering can reduce nodes and increase completed depth without changing completed full-width minimax values. Promising fallback if evaluation learning fails; measure sorting/inference cost and cutoff efficiency. |
| D. Independently labeled frontier positions | **Primary learning direction**, combined with A. Supervise boards the evaluator actually reads, with independent searches of those boards. This addresses target/distribution mismatch without changing production search semantics. |
| E. Differentiate through selected minimax leaves | Technically credible but deferred. Branch changes, ties, re-search cost and horizon transfer complicate attribution before we have demonstrated a useful independent signal. |
| F. Improve search first | Strong fallback, with frozen B. Profiling supports move generation, board-key and ordering work. Native prototype speedups are encouraging but not equivalent to production speedups. Avoid making a full rewrite a prerequisite. |

The previous strategy coupled independent labels, residual learning and minimax differentiation. The audit only addressed the first component. There is no evidence yet that differentiation is necessary or better than direct independently searched frontier supervision. Historical [TDLeaf work](https://arxiv.org/abs/cs/9901001) demonstrates a connection between learning and minimax leaves, rather than a guarantee for this application.

### Proposed objective, after teacher qualification

Use `fθ(s,p) = B(s,p) + δθ · φ(s,p)` with the existing seven normalized features and three phase boundaries. Initialize δ to zero, preserve terminal scoring, and regularize toward zero. Fix the temperature/scale before selection; do not convert Edax discs directly into B units.

Collect parent positions immediately above the frontier of B searches. Half the source roots use four-placement searches and half six-placement searches, assigned before outcomes. Trace the principal continuation of B's best and second-best full-window root alternatives; take their penultimate positions, deduplicate them, and query the teacher independently for **every legal child at that parent**. Terminal children use exact utility. Forced passes preserve placement depth and perspective. These are supervised frontier decisions, not root labels pasted onto leaves.

For an independently supported preference between sibling children x and y from parent player p, minimize

`w · log(1 + exp(-(fθ(x,p)-fθ(y,p))/τ)) + λ ||δθ||²`.

Aggregate the feature difference before applying a documented gradient/preconditioner. Standardize features using training data only, keep the score scale anchored by the trust penalty, normalize each source trajectory's total weight, and omit near-ties. Weight robust competitive preferences using the qualification results; do not call weights posterior probabilities. Do not mix weak-policy final margins into this first fit. A static child objective is appropriate here because these children are chosen to be deployment frontier boards; transfer must still be demonstrated by a new search.

This is deliberately a convex fixed-corpus preference fit in a small model, rather than a moving-branch optimization. It can fail because B's features cannot express the correction or because the frontier distribution is inadequate. Measure those possibilities before adding capacity. B's board-only turn antisymmetry also remains a potential limitation; changing representation simultaneously would obscure this test.

The current `scripts/strong/train.mjs` is not this experiment: it mixes outcomes, exact roots and immediate-child preferences, applies endpoint-normalized updates separately, and uses a different phase/model initialization. Reuse its storage/telemetry facilities, not its objective by accident. `data.mjs`'s B-derived search labels are not independent. Fix the existing every-other-state occupied-parity bias in new sampling; explicitly generate early positions and record both turns/parities.

## 5. One preferred next experiment: qualify deeper labels

**Question:** Can a practicably priced Edax configuration deliver low-regret, sufficiently informative labels on fresh representative roots, including positions from a stronger behavior policy?

This experiment generates labels and a decision receipt. On success it prepares a separate learning configuration; it does not start fitting, tournaments or a six-hour campaign automatically.

### Data contract and fixed samples

Use new namespaces rooted at `teacher-v2-20261028` with separate `cost`, `assessment`, `exact-cost`, `exact-assessment`, `future-train`, `future-select` and `future-games` suffixes. Derive numeric RNG seeds deterministically from the full namespace plus trajectory index, record them, and check against prior seeds/positions. These are proposed reservations, not claims that roots have already been generated.

Before searches, reserve **24 cost roots**, six in each old occupied-count stratum: 12–19, 20–35, 36–47, 48–55. Reserve **256 locked assessment roots**, 64 per stratum. Every root comes from a distinct trajectory and has at least two legal alternatives. Half each stratum uses the old randomized-opening/B-d1/12%-exploration behavior; half uses eight random placements then B d4 with 2% exploration. Publish policy-specific results as well as the declared 50:50 mixture. Neither policy is expert play. Select representative roots without filtering on teacher/B disagreement.

Use a separate **eight-root exact-cost sample** (four each at 10/12 empties), then **64 locked exact-assessment roots**, 32 each at 10/12 empties. Independent solver cap: ten seconds per root for all required convention checks combined; a timeout is incomplete evidence, not an exact value. No outcome-dependent replacements. Preserve all admitted roots and capped receipts.

Load complete historical trajectories, alternative boards and the completed teacher audit into canonical D4/color/turn-aware exclusions. The current historical loader does not automatically load the teacher audit: explicitly add its receipts. Admit all new roles jointly, with the existing 12-occupied prefix boundary declared. Save source trajectories and teacher-queried children; forbid cross-role canonical collisions at or beyond that boundary. Preserve common earlier prefixes as a disclosed dependency. Reserve backup trajectories for pre-search collision rejection only. Stop admission after 20,000 attempted trajectories or ten minutes; underfilled targets mean incomplete.

### Calibration and choice rule

1. Reuse the validated adapter and its exact regression fixtures. On the 24 cost roots, complete all-alternative D10/D12/D14 queries. Interleave depths and divide roots into three balanced eight-root batches; use distinct roots rather than counting warm repeated queries as independent evidence.
2. On a fixed eight-root subset (two per stratum), query D13 to check odd/even behavior. Time the exact-cost sample explicitly. Optionally compare hash bits 18 as described above.
3. Query D16 on **all 24** cost roots only if measured D14 growth and remaining calibration time forecast completion within the 20-minute calibration allowance, including 35% overhead. Eight cheap D16 probes alone cannot qualify D14 as the chosen horizon.
4. Eligible horizon/reference pairs are H10/R12, H12/R14, and H14/R16 only if both were fully measured. Require on calibration roots: mean choice regret ≤0.75, ≥90% within two, and no ≥8 regret. Among eligible pairs that fit the full budget, choose the **lowest H** passing those criteria. If none passes, stop. A higher horizon must buy reduced meaningful regret, not merely more exact move matches.
5. Freeze H, R, settings, samples, thresholds, task caps and schedule before reading any locked teacher results. Query H and R for every alternative on all 256 assessment roots. Query H+1 on a fixed 32-root subset, eight per stratum. The odd-depth test uses the maximum regret of H's choice under R and H+1 on that subset; do not hide odd-horizon failures in even-depth averages.
6. Solve all 64 exact assessment roots independently under raw and awarded-empty conventions and verify Edax exact-depth alternatives. Also query truncated D6/D8 estimates, plus D10 on the 12-empty roots, to measure actual error reduction against solved references. Compare B d6 choices against the same exact references.

Full all-alternative assessment is intentional. Do not reduce alternatives, sample sizes or reference depth after seeing locked results to meet the cap. If even H10/R12 is infeasible, stop with a cost result and propose a fresh reduced-label protocol separately.

### Assessment gates

These are engineering filters permitting a small learning test, not certification of game-theoretic teacher accuracy. Report intervals even though the gates use fixed-sample observed rates.

| Gate | Predeclared requirement |
|---|---|
| Integrity | Complete fixed samples; correct identities/depths/windows; legal PV replay; zero exact-alternative mismatches. Any defect or timed-out required query blocks proceeding. |
| Mean regret | H-choice regret under R ≤0.75 across 256 roots **and** across the 128 early roots; each early phase mean ≤1.0. |
| Small-error coverage | At least 231/256 and 116/128 early roots have regret ≤2. |
| Significant errors | At most 12/256 and 6/128 early roots have regret ≥4; no root ≥8. |
| Sign/reversal guard | At most two roots where R best ≥+2 but H choice ≤−2; at most five roots with a ≥4-to-≤−4 near-best/B pair reversal. Report all small-score sign changes separately. |
| Odd-horizon guard | On the 32 fixed roots, mean of the maximum regret under R and H+1 ≤1.0, with no regret ≥8. |
| Exact calibration | Exact values all match; deeper truncated searches have no larger mean exact regret or count of exact W/D/L mistakes than their immediately preceding measured horizon, pooled and by empty-count group. Plateaus are acceptable; worsening blocks proceeding. |
| Useful correction yield | At least 32/256 roots, including 12/128 early, where the deterministic H choice beats B d6 by ≥2 at **both H and R**, and has R regret ≤2. Report policy/phase denominators and Wilson intervals. |

The yield floors correspond to 12.5% overall and 9.4% early, rather than demanding 40–48%. They are chosen to make a small 21-weight test plausible: at a 12.5% yield, collecting roughly 200 informative independent roots requires about 1,600 representative roots on average, before allowance for uncertainty and correlation. They do not assert that two discs is strategically decisive or that 200 constraints suffice to beat B. Do not relabel the old audit using these gates.

If reliability passes but yield fails, conclude that this economical correction-learning proposal lacks enough demonstrated signal on this distribution. If depth agreement passes but exact calibration fails, investigate horizon bias rather than accepting convergence. A failed gate produces a report and stops; it does not invoke an AI, lower thresholds, or start a different experiment.

## 6. CPU time, resources and completion margins

Choose the 120-minute mode for full qualification. A 30-minute mode performs admission/calibration and reports feasible configurations only; it never describes an unfinished assessment as a successful shorter audit.

| Stage | Maximum wall allocation in full mode |
|---|---:|
| Resource checks, validation and admission | 10 minutes |
| Cost/quality calibration, including optional D16 | 20 minutes |
| Locked all-alternative and odd-horizon assessment | 55 minutes |
| Independent exact assessment and truncated queries | 15 minutes |
| Reporting, verification and final safety margin | 20 minutes |

Require `1.35 × forecast remaining work + 20 minutes ≤ remaining total allowance` before opening assessment. Itemize admission, B probes, child CPU, exact solving, transcript writing and retries. Base forecasts on the slowest balanced batch, phase-specific p95 costs and the observed serial coordinator fraction. Do not assume two workers halve all wall time. Decline launch if fixed targets cannot fit.

For scale, 256 H12/R14 root pairs would occupy about **24.7 serial minutes** under the illustrative g=4 model above; H14/R16 about **99 serial minutes**. Odd checks, admission, exact solving and reporting are additional. At g=8, even H12/R14 costs about 89 serial minutes. These wide ranges explain why selecting depth from measured costs is essential.

Two workers running at most 100 compute minutes represent an upper envelope of **3.33 worker busy-core hours**, plus separately measured coordinator CPU. Two single-threaded workers can consume at most four worker core-hours during the complete two-hour session. A plausible useful outcome is 30–120 wall minutes and roughly 0.5–3.3 worker CPU hours, conditional on calibration, plus coordinator overhead. Neither is a measured completion forecast yet.

Reuse fresh Windows/WSL resource preflight. Default to **at most two single-threaded teacher/independent-solver workers**, or one if available memory/load demands it. Keep the historical admission index in one coordinator rather than duplicating its nearly one-GiB heap. Account for actual native TT/RSS plus the existing host headroom policy. On low memory, serialize work. Use ordinary reduced CPU priority for offline workers; no affinity/power changes, application closing or process termination. Check available physical memory, swap activity and host responsiveness between batches; drain/checkpoint if the existing preflight reserve fails. A logged resource stop leaves the audit incomplete.

The current teacher runner is serial and hard-codes D8/D10. It needs a small separate configurable audit driver and bounded root-task scheduling; it cannot execute this protocol simply by changing its output directory. Reuse `alternatives`, `query`, `Progress`, `Profiler`, atomic receipts, source snapshots and writer locks. Preserve all adapter rejection checks. Record native child CPU explicitly (the existing Node profiler excludes it), and use process high-water accounting where supported, rather than calling occasional RSS samples peak memory.

Checkpoint each completed root/depth, store detailed history separately, and preserve failed/time-limited receipts without treating them as labels. Use a monotonic active-time cap across resume and per-query timeout no larger than remaining stage time. Stop dispatch before the reporting reserve; never extend after looking at results. Resuming a hard-capped incomplete experiment cannot silently increase its allowance. The normal terminal launcher may be interrupted by terminal closure; a detached mode requires the existing verified launcher behavior or explicit documentation, not an assumption. A reboot requires a restart command and identical source/protocol hashes. Keep raw data ignored. macOS Apple Silicon/Intel need actual later runtime/resource tests; WSL success does not establish Mac support.

## 7. What would it take to beat B?

B remains strongest because it preserves useful nonlinear board knowledge in inexpensive features and is deployed with a reasonable search. “21 weights” understates what legal mobility, normalized potential mobility, frontier and conditional corner danger already compute. The previous corpus largely described weak exploratory policies or B's own searches; independent early strategic correction was missing. Optimizer/selection issues and insufficient early coverage are additional plausible causes, rather than proven single explanations.

The [completed learning campaign](STRONG_EVALUATOR_RESULTS_20261028.md) accumulated 600,885 retained positions, but its frozen linear finalist scored 44.43%/47.07% at 80/300 ms and failed promotion. The [later frozen screen](NEXT_EVALUATOR_RESEARCH.md) found cheap long-margin tables losing even at equal depth. Those outcomes contradict a general claim that evaluation speed alone caused all failures. They also show that stronger shallow endgame rankings and lower prediction loss do not establish stronger searched play.

Independent supervision is a credible way to remove one major weakness. The audit's large B/teacher estimated gaps make a low-dimensional correction plausible, but do not establish that the available features can represent it. Deep Edax may still share horizon errors across depths, and improved approximate teacher agreement may fail to improve actual games.

For a first subsequent fit, budget **1,000 independent training source roots, 250 selection roots and 500 locked quality roots**, with up to two frontier parents per training root. This could yield roughly 10,000–20,000 queried frontier children, depending on legal branching; count source trajectories as the independent sample. Fit at cumulative 250/500/1,000 training roots with a fixed trust/temperature grid of at most three settings, selected only on the 250 selection roots. Reserve all namespaces and exclusions before collecting data. These numbers test learnability, not a reliable strength guarantee.

If learning curves improve searched decisions, 2,000–5,000 independent source roots and roughly 20,000–100,000 well-targeted frontier positions are a defensible next scale to cost out. They are planning ranges, not a sample-complexity estimate. Large pattern residuals may need substantially more coverage. Existing 600,000 weak-policy observations do not tell us the number of strong independent labels required. Stop increasing data when held-out searched regret plateaus despite lower fitting loss.

Before even a development game screen, require a frozen candidate to reduce mean estimated regret on the 500 fresh quality roots at depth six by at least 10%, with a paired root-bootstrap 95% interval for the reduction above zero; require no point deterioration at depth four or in independent exact W/D/L mistakes. If B's regret is essentially zero, this relative-improvement gate is uninformative and the experiment stops rather than inventing another criterion. Qualify these as teacher-relative results. Measure complete evaluation cost and search throughput; a linear residual should be compiled into the existing weights, avoiding a second feature scan.

Then use the previous bounded **48 opening pairs at 80 ms and 32 at 300 ms** as a development-only screen, both colors and one frozen candidate, with no background labeling. Require at least 50% observed points at both before preparing serious confirmation. This screen has low power and is not promotion. Its nominal upper move-budget cost is about 27 minutes, or about 36 with 35% allowance, before measured overruns. Add this to training/labeling cost before choosing any future run allowance; do not promise it all fits two hours.

The most convincing result would be **one frozen candidate winning fresh paired equal-time confirmation at both 80 and 300 ms, accompanied by reduced independent searched regret, controlled speed/depth measurements and no leakage**. Use at least the earlier proposed 512/256 pairs, confidence intervals over opening-pair means with adjustment for the two actual primary tests, no optional stopping and independent seeds reserved before selection. Those sizes still cannot reliably resolve very small gains. Production promotion requires both lower bounds above 50%; planning that confirmation is separate from this audit.

Search improvement may prove more productive than evaluation changes. The existing native kernel's roughly 2.75–2.95× matched-batch speedup demonstrates an opportunity, but it lacks full production parity. An additional reliably completed ply with frozen B would be stronger evidence than a kernel timing alone. If qualified labels cannot improve matched-depth decisions, prioritize ordering/TT keys/move-generation work with frozen B before another dataset campaign. If quality improves at matched depth but loses at equal time, investigate inference cost, pruning behavior and deadlines before collecting more labels. If both improve, scaling supervision becomes justified.

Evaluation speed matters because search amplifies cost over many leaves. The later long tables were about three times faster in static microbenchmarks, yet whole-search evaluation rates differed by only about 1.2×. Nodes, evaluations and depth must all be measured: changes in visited boards and pruning can outweigh a cheaper leaf. There is no justified Elo forecast or confident prediction of how many hours will yield a substantially stronger player.

## 8. Proposed subsequent Codex implementation prompt

> Work in `rharriszzz/reversi`, starting from current main. Read `USER_REQUESTS.md`, `AGENTS.md`, `docs/ASTRA_TEACHER_STRATEGY.md`, the completed teacher audit and actual adapter/search/learning code. Preserve production B and historical evidence.
>
> Implement only the bounded deeper-teacher qualification experiment in sections 5–6. Reuse the pinned verified Edax adapter, validation, source identities, checkpointing, progress, profiling and resource preflight. Add configurable depths, native CPU/high-water accounting, explicit teacher-audit exclusions, role-separated reservations and at most two independent root workers. Keep all-alternative full-window label semantics and pass/terminal conventions. Do not weaken parser rejection rules or enable selective labels.
>
> Before any expensive run, write a machine-readable protocol with the exact fresh namespaces, admission rules, 24 cost roots, optional D16 rule, 256 locked assessment roots, 32 odd-horizon roots, 8 exact-cost and 64 exact-assessment roots, all thresholds and active-time caps. Implement 30-minute calibration-only and 120-minute full modes. Calibration selects the lowest eligible horizon under the frozen rule; lock the choice before assessment. Stop on infeasible scheduling or failed gates. Do not reduce targets or extend the allowance after inspecting assessment results.
>
> Verify metric calculations using fixtures for tied sets, near-tied choices, major reversals, exact win/loss changes, bounds, forced passes and terminal empties. Test crash/resume, no duplicate task admission, protocol/source mismatch rejection, query/stage timeouts and deterministic ordering with different worker counts. Run existing correctness tests before and after changes. Keep runtime/browser play dependency-free and document actual WSL/macOS verification precisely.
>
> If authorized for execution in this implementation session, run only this bounded qualification after preflight and a feasible forecast. Otherwise provide one-command launch/resume instructions and stop at the verified implementation. This strategic-review document itself does not authorize a new computation. No six-hour campaign, evaluator replacement or automatic training.
>
> Publish `docs/TEACHER_DEPTH_QUALIFICATION.md` and compact audited evidence with measured depth costs, child CPU, memory, regret tails, score-gap changes, phase/policy denominators, exact calibration, gates and uncertainty. On complete success, prepare—but do not launch—the frontier/linear learning configuration described in sections 4 and 7, using new roles/seeds. On failure, emit a reasoned stop receipt without changing criteria. Commit and push verified code/report changes and report commands, status, hash and blockers.

## Verification of this review

The five requested documents and compact audit artifact were read, along with adapter, audit, validation, publication, search, evaluator, data-generation, fitting and profiling code. Read-only reanalysis verified the three original artifact hashes and regenerated diagnostic counts from immutable receipts. No new Edax computation was needed. `npm test` passed 65/65 before and after edits. Additional checks verified local document links, diagnostic histogram arithmetic, receipt identities and preservation of the original request ledger as an unchanged prefix; `git diff --check` passed. Python/browser tests were not repeated for documentation-only changes. The Git outcome is reported with the completed change. This review makes no new Windows-browser or macOS hardware-test claim.
