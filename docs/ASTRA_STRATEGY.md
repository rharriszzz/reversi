# Independent strategic review: a credible route beyond B

28 October 2026. Assessment of `rharriszzz/reversi` at `b807a80069e0aa6c8eda348c46b15c8217239af0`. This is a proposed research program, not authorization to launch it. No evaluator, search implementation, or production default was changed during this review.

## 1. Executive summary

**Choose independent-teacher, search-aware residual learning around B.** Keep B's seven strategic features and original weights as a fixed starting function. Learn a small correction, first in those features and then, only if justified, in the existing seven long-pattern templates. Obtain opening/middlegame move labels from a pinned independent engine, preferably Edax, and optimize decisions made by our shallow alpha-beta search. Do not repeat weak-self-play margin regression with a larger dataset and expect a different result.

B's survival is less surprising than its 21 weights suggest. Its inputs already compute difficult nonlinear properties of the board: legal mobility, potential mobility, frontier exposure and conditional corner danger. Learning a linear combination of those inputs is a very different problem from rediscovering their strategic content from sparse occupancy tables. Moreover, our learner mostly predicts the consequences of weak, exploratory play, while our player tries to withstand adversarial replies. We have spent substantial computation on this mismatch without first demonstrating that our training signal corrects B's actual search decisions.

The strongest evidence against a simple speed explanation is the latest frozen-model screen: long-margin lost badly even at equal depth and sometimes searched deeper at equal time. The strongest reason to distrust our selection proxies is the reversal of late-game regret rankings between depth one and depth three. Neither observation proves that pattern evaluation is unsuitable.

The first decisive experiment is a **bounded independent-teacher audit followed by a low-dimensional learning test**, using new phase-stratified positions. Its purpose is to find out whether stronger labels contain stable, learnable corrections that survive search. Stop if they do not. Do not begin by implementing a native production engine, a neural network, or a broad architecture tournament.

The existing checkpoint, telemetry, admission, parallel-work and frozen-run machinery is valuable. Retain it. Native computation should initially buy better reference labels and deeper exact anchors; a production C++/WebAssembly core is a separate, evidence-gated engineering decision.

## 2. Diagnosis: what the evidence establishes

### Measured results, in chronological context

| Evidence | What it establishes | What it does not establish |
|---|---|---|
| Learning-first campaign: 600,885 retained positions; 300,876 outcome positions fitted per model; 26,595 B-search and 11,406 exact training labels | Substantial data collection and repeated fitting occurred | Equivalent numbers of independent strategic examples, or strong opening supervision |
| Frozen linear preference finalist: 44.43% at 80 ms, 47.07% at 300 ms; 256/128 opening pairs | Failed the predeclared promotion rule; B remains the demonstrated choice | Statistically established inferiority under those simultaneous intervals |
| Subsequent long-margin screen: 16.41%/24.22% at 80/300 ms; 18.75% at depth four | Cheap evaluation did not rescue this model; the 80-ms adjusted interval excludes 50% | Failure of all possible pattern architectures or all margin objectives |
| Long-preference screen: 42.19%/34.38%; 37.50% at depth four | Preferences were less disastrous than margin on this screen; no positive timed condition | A statistically established ordering versus the earlier linear finalist on different openings |
| New 22-position exact diagnostic: d1 regret B 4.318, long-margin 3.136, long-preference 1.227; d3: 1.182, 1.636, 1.364 discs | A shallow late-game advantage can disappear under search | Reliable opening/middlegame quality or general population effect sizes |
| Static costs roughly B 2.48 µs, long tables 0.84 µs; search evaluation rates only about 1.2× apart | Leaf microbenchmarks exaggerate whole-search savings | A threefold playing-search speedup |

Sources: [completed campaign](STRONG_EVALUATOR_RESULTS_20261028.md), [subsequent screen](NEXT_EVALUATOR_RESEARCH.md), and their linked audited JSON. The older [review](STRONG_EVALUATOR_REVIEW.md) proposed testing frozen long tables; that experiment has now happened and was negative. Its recommendation is historical, not an untried opportunity.

### Ranked explanations

**Highest priority: target, distribution and search mismatch.** About 80% of accepted behavior games used depth one, about 20% depth two; only three accepted calibration games used depth three. Exploration continued after the opening. Their final margins measure a policy mixture, including later mistakes. Opening/middlegame preference labels mostly come from B itself. There is no independent strong-teacher assessment of early strategic choices. This combination is a plausible central cause, though causality has not been experimentally isolated.

**High priority: B supplies valuable inductive bias that the fast model discards.** Mobility is a global legal-move computation, not a square weight. Corner danger depends on whether the adjacent corner is empty. Normalized frontier and potential mobility also encode relationships. The long family covers every square (checked during this review), but additive local tables cannot generally reconstruct global normalized mobility exactly. B need not have near-optimal weights to beat a learner that has lost those features. This motivates retaining B rather than learning everything from zero.

**High priority: our positional tests target the wrong regime.** Eight-empty d1 decisions, all-pair ordering, outcome MSE, and agreement with B are individually useful diagnostics. They are weak substitutes for top-choice quality at the six-to-eight-ply horizons reached in games. At eight empties, much of this problem soon disappears into exact search. The latest reversal at d3 directly contradicts the assumption that improved d1 regret alone predicts a stronger searched player.

**Moderate priority: optimizer and selection pathology.** The original selected linear checkpoint came from cycle one and was selected by regression MSE despite preference training. Current code fixes that criterion to exact top-choice regret when available, but this remains a small, late-game-only objective. Thus a known problem was repaired without demonstrating that the new criterion predicts playing strength. Lack of a late selected checkpoint is not evidence that useful learning has converged.

**Moderate priority: representation and phase limitations.** Four hard phase buckets, sparse long configurations, absence of a turn-sensitive value, and missing early training coverage remain plausible contributors. Six phases and short tuples have already been tested; merely repeating them is not a new hypothesis. There is no evidence yet that adding many phases or a larger network is the best use of time.

**Low priority as a general explanation: evaluation cost.** Cost plausibly hurts the 4–8 µs short/hybrid models. It cannot explain the cheap long-margin failure or the linear finalist's similar depths and slightly higher evaluation throughput. Native code alone will not repair an evaluator that loses at matched depth.

**Unproven: B is intrinsically excellent.** It is strongest among the tested local candidates, not independently rated against strong engines or skilled humans. Neither its apparent simplicity nor its current wins demonstrate that it is close to an attainable ceiling.

### Conceptual findings in the actual implementation

The following are code observations, not claims that any one caused the tournament losses. Relevant files are [train.mjs](../scripts/strong/train.mjs), [data.mjs](../scripts/strong/data.mjs), [model.mjs](../scripts/strong/model.mjs), [run.mjs](../scripts/strong/run.mjs), and [search.js](../src/search.js).

1. **Deep preferences train immediate children.** `searchLabel` searches every alternative to a common nominal depth with B and records a reply. `fit` then compares static encodings of the two boards immediately after the candidate moves. It does not update the leaves responsible for those minimax values, use the recorded reply, or evaluate the loss through search. This can be legitimate value distillation, but it asks a cheap static function to absorb tactics that deployment search will resolve again. It is not search-aware decision training. A move-ordering policy trained from these preferences would be a different use; with full-width completed alpha-beta it changes cost, not the minimax result.
2. **Every-other-position sampling introduces systematic parity imbalance.** Generation retains positions beginning after 16 placements, i.e. 20 occupied squares. Outcome fitting takes `states.filter((_,i)=>i%2===0)`; prediction scoring takes every fourth state. Because states are recorded before placements, these select even occupied counts. Passes can change the player associated with that parity but do not fill in odd occupied counts. Exact roots and preference children provide some other coverage, so this is not a claim that all odd positions are unseen. It is a deterministic imbalance to measure and remove, not random subsampling. The current phase correction starts at 16 occupied squares, but routine trajectories still start at 20; calling the first bucket fully covered overstates the repair.
3. **Board-only color antisymmetry removes turn information.** The model encodes a fixed-Black board score and multiplies by the requested player. Consequently it forces `f(board,Black) = -f(board,White)` when used as a side-to-move value. Actual values for the same occupancy with different players to move need not obey that identity. The correct color-exchange symmetry transforms both occupancy and turn. B shares this limitation; it is a possible ceiling, not an explanation unique to learned models. A future turn-relative table can share parameters under simultaneous color/turn exchange without forcing the two different-turn positions to be negatives. Do not call this an alpha-beta sign bug.
4. **Optimization is not straightforward SGD on one documented loss.** Each preference endpoint is normalized separately by `1 + ||x||²`, then updated sequentially. Shared coordinates and unequal norms mean this is not simply the gradient of a logistic loss on the feature difference. Outcomes are processed first, exact roots next, preferences last. Their effective influence varies with counts, ordering and architecture. Batch exposure totals do not reveal that influence. Test a defined loss and finite-difference gradients before replacing the optimizer with something more elaborate.
5. **Coverage shrinkage changes the predictor even at fixed weights.** Increasing `count/(count+32)` changes table outputs before a gradient step. Within-fit early stopping restores best weights, and subsequent batches start from that restored checkpoint; it is not unrestricted optimization from the last epoch. Replay samples old outcome shards, while the fit payload passes newly available labels rather than a comparable replay of old preference constraints. These choices can cause drift/forgetting. They need a frozen-corpus learning curve and measurements of update magnitudes and retained old-label accuracy.
6. **The fast and rich families are not matched causal comparisons.** The existing hybrid includes all 77 short templates as well as the seven long templates and features. Its 7+ µs cost does not tell us the cost or strength of B plus only seven long templates. That smaller residual is a materially new model, but still must earn its cost.
7. **Selection can amplify local weaknesses.** A small set of eight-empty references can be overfit by repeated checkpoint selection. Raw all-pair accuracy also rewards ordering many irrelevant bad alternatives. Current `ranking.byPhase` mixes exact-disc and B-heuristic regrets; the later report correctly cautions against interpreting that as a common scale. Use separate provenance/unit strata.
8. **Search semantics are mostly appropriate for this investigation.** Playing search carries alpha across root moves; coaching uses comparable full windows. Passes consume no placement depth; timed search retains the last complete iteration and clears score tables between horizons. Terminal scores prioritize W/D/L and then margin. Bounds from a playing search are not labels for all moves. A native prototype without production TT/order/deadline behavior is not an equivalent timed production engine.

A small executable check generated one seeded trajectory (`seed=729114`, index 0, depth 1), confirmed the even-occupied outcome subsample, and independently solved its six-empty board with both turns: Black-to-move Black margin −64, White-to-move White margin +63. This suffices to refute exact antisymmetry under turn change, not to estimate the practical size of that modeling error. All long-pattern squares were covered. No training or tournament was run for this review.

## 3. What quantity should we learn?

Let `s=(board,turn)` and let `U` be terminal utility, preferably win/draw/loss first and disc margin as a secondary criterion. In this deterministic game,

`V*(s) = max_a [-V*(T(s,a))]`,

with forced pass handled as a turn change without a placement and terminal utility fixed by the rules. Under weak policies π and σ, outcome regression instead estimates `E[U | s, π, σ]`. Mixing policies whose identities are absent from the input estimates a mixture of those conditional expectations. These quantities are not equal to minimax value. A dangerous position can have a good weak-policy outcome because its refutation is rarely played.

This distinction is a strong candidate explanation, **not a proof that outcome or margin regression is inherently wrong**. Strong self-play can make outcomes useful approximations; intermediate heuristic discrimination matters even when many true win/loss values coincide. Disc-margin and W/D/L have different behavior under uncertainty: chasing a large expected margin can sacrifice win probability. Report both, make game points primary, and do not give large-margin distinctions equal training priority to a reliable win-versus-loss distinction.

For a depth-d deployed player, the direct objective is low regret of `argmax_a Q_d^θ(s,a)` under a stronger independent reference. The optimal finite-capacity static approximator depends on the horizon, encountered leaf distribution, search errors and time budget. Min/max can select extreme model errors, so lower average MSE over trajectories need not improve decisions. Better d1 ranking can coexist with worse d3 choices, exactly as observed here.

Train both **values on search-frontier positions** and **top-move preferences through a short search**. If a wrong choice is driven by a falsely attractive opponent continuation, update the responsible leaf, then refresh the continuation after an optimization step. Do not paste a root label onto an arbitrary leaf; either query that leaf independently or differentiate the backed-up decision loss through its current minimizing/maximizing leaf. Exact terminal leaves remain constants. Ties need deterministic handling and periodic re-search because the active branch changes.

Initially fix a shallow training horizon (two placements) and test transfer at depths 1, 3, 4, 6 and timed 80/300 ms; do not add a separate model for every depth. This is a concrete horizon-aware hypothesis, not a promise that shallow training will transfer.

## 4. Established methods and alternative strategies

### Lessons from primary sources

Edax combines bitboards, search and a learned midgame evaluator; its source provides pattern indexing and incremental evaluation machinery. It is a practical independent teacher, not a reason to replace our engine. Pin source and evaluation-data hashes, disable the opening book for label comparisons, record search/selectivity settings, and verify score/coordinate/pass conventions. Edax's repository is GPL-3.0; preserve notices and check code/data terms before any redistribution. Keep the external executable separate and avoid importing its implementation or weights into our original engine. [Edax repository](https://github.com/abulmo/edax-reversi), [evaluation source](https://raw.githubusercontent.com/abulmo/edax-reversi/master/src/eval.c).

Egaroucid's technical account reports 60 phases, 1.8 billion training positions and Adam optimization; its self-play teacher used 11-ply middlegame search and much deeper endgame solving. It uses separate opening supervision. Its small tested neural network underperformed patterns on prediction error. These are that author's configurations/results, not requirements or guarantees for this project. The crucial comparison is strong supervision and broad coverage, not “patterns versus neural networks.” Its differential evaluation and specialized ordering also show why complete-engine timing matters. [Egaroucid technical explanation](https://www.egaroucid.nyanyan.dev/en/technology/explanation/).

Buro's Othello work demonstrates learned feature combination evaluated in actual search tournaments, and later combines learned features, selective search and opening learning. It supports supervised evaluation as a credible route, without identifying our current target distribution as sufficient. [Statistical Feature Combination](https://arxiv.org/abs/cs/9512106), [Improving heuristic mini-max search by supervised learning](https://www.sciencedirect.com/science/article/pii/S0004370201000935).

Systematic short n-tuples have published successes, including small networks competitive with strong **one-ply** players. That qualification matters: it does not predict performance inside our deeper search. A later TD n-tuple/MCTS study reports beating Edax through level seven on standard hardware, which is evidence of feasibility under its protocol, not evidence of top-Edax strength or an equal-time advantage here. [Jaśkowski, 2014](https://journals.sagepub.com/doi/abs/10.3233/ICG-2014-37203), [Scheiermann and Konen, 2022](https://arxiv.org/abs/2204.13307).

Stockfish's NNUE documentation emphasizes sparse inputs, incremental accumulators and quantization, and describes combining evaluation and outcome targets. Reversi flips multiple discs, so an accumulator update is not automatically as cheap as a chess move. Transfer the discipline of efficient inference and search-guided targets before transferring the architecture. TDLeaf explicitly connects learning to minimax-selected leaves; this motivates the proposed loss placement, without promising the historical chess results will repeat. [Stockfish NNUE documentation](https://official-stockfish.github.io/docs/nnue-pytorch-wiki/docs/nnue.html), [TDLeaf](https://arxiv.org/abs/cs/9901001).

### Critical comparison

These are planning judgments, not calibrated probabilities or Elo forecasts. CPU hours mean summed busy-core hours, not wall hours. Ranges include uncertain label costs and are conditional on pilot timing; implementation days are focused engineering estimates excluding unattended runs.

| Direction | Prospect of useful progress | Data and label requirements | Initial CPU / RAM / local storage | Effort and evaluation cost | Main risk; earliest decisive evidence |
|---|---|---|---|---|---|
| **Independent-teacher residual, search-aware learning (selected)** | Best-supported near-term route; moderate confidence, uncertain substantial gain | 1,000 audit roots, then 3,000–10,000 training roots plus frontier labels; stable common-depth independent preferences; exact anchors | Audit 1–6 CPU h; pilot up to 24 CPU h; 1–3 GiB working RAM, 0.1–2 GiB data initially | Roughly 4–8 engineering days; linear correction near B cost; B + seven long tables provisionally 3–5 µs, unmeasured | Teacher mistakes, leaf overfitting, no transfer through deeper search; first audit and held-out low-dimensional fit |
| **Search-aware TD/self-play policy iteration without external teacher** | Plausible medium-term; lower confidence for next run because it must improve its own labels | Stronger current-search trajectories, opponent pool, replay and exact anchors; tens of thousands of games rather than depth-one outcome expansion | 24–96 CPU h pilot; 1–4 GiB RAM, 1–10 GiB trajectories | 5–10 days; table/linear inference can remain cheap | Self-confirming errors, instability and forgetting; 6–24 wall h may still fail to distinguish weak supervision from weak model |
| **Search-first engine engineering with frozen B** | High confidence in useful throughput work; uncertain playing gain | Reproducible matched search positions, exact rules/oracle tests, no learned labels required | 2–8 CPU h benchmarking plus serial games; 0.5–2 GiB RAM, <1 GiB artifacts | 5–15 days for production parity; B evaluation unchanged mathematically, native complete speed unknown | Spending engineering effort on speed without positional progress; matched production search and equal-time games resolve it |
| **Small neural student from strong labels** | Plausible later; low confidence as first step | Same independent labels, likely substantially more frontier diversity; scale only after learning curves | 24–100 CPU h exploratory fitting; 2–6 GiB RAM, 1–10 GiB data; no GPU assumed | 1–3 weeks including inference; no defensible µs prediction without prototype | Inference consumes depth, too little data, feature design; small frozen-corpus fit and integrated search timing first |

A direct 21-weight tournament optimizer is a cheaper fallback within the first direction, not another primary campaign. It needs no value labels, but noisy game fitness can overfit B and consume many games to resolve small gains. Independent labels provide much denser feedback about why a move is wrong. Existing mutation/TD/linear trials mean “tune B more” alone is not novel.

Exact-endgame-only learning is an anchor, not the selected standalone route. It produces trustworthy values but a narrow distribution; projecting them backward over many plies requires a valid teacher or policy-improvement loop. More eight-empty d1 fits repeat an already failed proxy. Pure long-table retraining is likewise deferred until the signal works in a B-preserving model.

## 5. Selected strategy and first decisive experiment

### Model and loss

Begin with `fθ = B + δθ·φ`, retaining the original three phase boundaries and seven features. Initialize δ to zero, so the initial candidate is exactly B. Use an L2 trust penalty toward zero. This isolates the value of independent supervision and search-aware training before buying extra capacity. A later model adds only the existing seven long templates as zero-initialized residual tables, retaining B as a fallback on unsupported patterns. It is not the previous full hybrid.

Keep all initial outputs in B heuristic units. Train relative decision preferences; do not subtract an Edax disc estimate from B's score. Teacher preferences can be weighted by confidence, but do not mechanically mix exact discs, heuristic units and outcome targets. Use a separate calibrated disc-value head only if scalar supervision becomes necessary. For the first fit, use a documented logistic loss on differences of depth-two backed-up scores with a training-only chosen scale, and an L2 penalty. Normalize each root's contribution so positions with many legal moves do not dominate. Give near-best alternatives and reliable W/D/L differences priority; treat unstable/tied teacher rankings as soft or omitted constraints.

The branchwise gradient uses the active minimax leaves; aggregate feature differences before any norm preconditioning. Re-search after each small batch, verify gradients away from branch switches, and separately log branch changes. This implements a specific alternative to the present child-static surrogate.

### Stage A: teacher audit, before learning

Implementation: an external-process adapter and immutable label receipts using the existing worker/task framework. First cross-check 32 small exact endings with our independent solver, including pass and terminal-with-empties cases. Handle any external convention that awards remaining empties separately; our raw-disc scoring remains authoritative.

Accept **1,000 new roots from distinct trajectories**, 250 each at 12–19, 20–35, 36–47 and 48–55 occupied squares. Within each stratum reserve half as a representative sample and half from B/pattern or shallow/deep B disagreement. Do not pool their performance estimates without reporting their sampling weights. Use new training/development roles, canonical separation and historical exclusions. Separately reserve 128 eight-to-twelve-empty exact roots. Early positions require explicit generation rather than the current `states` cutoff.

For each root, record B choices at depths 1, 3 and 6. Query every legal alternative at the same teacher depth; include deeper queries at D+2 for a fixed 25% stratified subset. Start timing at D=8/10, but choose the actual frozen depth from calibration; require it to outperform shallower settings on exact anchors and demonstrate useful stability. Disable selective pruning where practical for the audit; a completed selective estimate is not exact. Save bounds, completion status, nodes and settings. If the adapter cannot deliver comparable alternative values, fix it before use.

**Advance criteria (engineering decision gates, not significance claims):** at least 90% of the depth-check subset's top choices remain within the deeper teacher's tied/best set; at least 100 roots exhibit a stable preference against B's depth-six choice, including at least 30 in representative opening/middlegame strata. Audit ten actual refutations by replaying teacher continuations and re-searching them, without describing immediate feature contributions as explanations. Report all failures and unstable labels.

If teacher stability fails, spend only the reserved audit budget on deeper labels or a small second-engine check. If stable disagreements are rare, the premise of cheap independent corrections is weak: stop and reconsider teacher strength, opening distribution or search-first work. Agreement is not proof B is optimal. This stage can falsify the proposed economical path without training hundreds of thousands of positions.

### Stage B: low-dimensional learnability test

If A passes, obtain **3,000 training roots**, **500 selection roots**, and **500 locked development-assessment roots**, trajectory-disjoint and stratified as above. The Stage A roots may enter training, never the locked assessment. Add 256 independent exact training anchors and 128 locked exact assessment roots. Collect equal occupied-parity coverage and both turns; record any unavoidable residual imbalance.

Fit only two predeclared controls using the same B-plus-linear parameterization and regularization budget: (1) immediate-child preference loss, and (2) depth-two backed-up preference loss. Use at most three learning-rate/trust settings on selection data and one fixed random ordering seed initially. Keep B as the zero-correction control. Freeze the chosen checkpoint before opening the 500-root assessment.

Measure top-choice teacher regret, stable-preference accuracy, serious W/D/L errors where solved, and changes across search depths 1/3/4/6. Keep estimated teacher-disc regret separate from exact regret. Bootstrap whole trajectory/root clusters for paired changes; report medians, tails and phase/parity strata, not only average accuracy. All-pair accuracy and prediction loss remain secondary diagnostics.

Advance only if the search-aware fit reduces locked opening/middlegame depth-four teacher regret by at least 10% relative to B, with a 95% paired bootstrap interval for the reduction above zero, and shows no point-estimate deterioration at depth six or in exact W/D/L errors. The 10% is a chosen practical filter, not a predicted benefit. If B regret is near zero, the relative criterion is inappropriate and the path fails this gate rather than changing the rule afterward. Failure to outperform the static control weakens the proposed horizon mechanism even if both beat B.

Then run a **development-only 48-pair 80-ms and 32-pair 300-ms screen** of one frozen candidate. Require at least 50% observed points at both controls to justify scaling; report pair-cluster uncertainty and acknowledge its low power. This gate is not promotion. No model swapping halfway through the games.

## 6. Staged longer-term program and statistical contract

| Stage | Work, fixed assessments and limits | Proceed / stop |
|---|---|---|
| A: 60–120-minute wall cap after adapter implementation | Teacher calibration, 1,000 roots, depth-stability subset, 128 exact anchors; preflight forecasts must fit all targets | Pass the stated stability/disagreement gates; otherwise stop without launching B |
| B: up to six wall hours | 3,000/500/500-root fit/selection/assessment, two loss controls, exact anchors, then 48/32 paired development games if quality gate passes | Pass both quality and playing screens; otherwise archive the failure, retain B |
| C: up to 24 wall hours | Up to 30,000 independently labeled training roots plus explicitly teacher-labeled frontier positions; 2,000 selection and 2,000 locked assessment roots; 512 fresh exact assessment roots; add seven long residual templates only if linear error analysis indicates capacity limits | Freeze one finalist before confirmation. If training loss improves without held-out searched regret, stop scaling; if quality improves but equal-time play fails, diagnose transfer/cost before more data |
| D: later 24–72-hour iteration, separately authorized | Candidate/B/older-policy mixture generates new hard roots; independent teacher remains anchor; one frozen policy-improvement iteration and new final tests | Only after C has a confirmed equal-time gain; no indefinite self-play campaign on an unverified signal |

For C, predeclare **512 paired openings at 80 ms and 256 at 300 ms**, both colors, one finalist, no books, same original search and actual per-move time limits. Reserve a further 64 paired openings against an independently configured strong engine as a descriptive external anchor, with its time budget and machine settings fixed in calibration. This is not an Elo rating. It is useful to compare B and the candidate against that same opponent and openings, while keeping these games out of selection.

Primary statistical unit is the opening-pair mean (win=1, draw=0.5). Treat paired colors as dependent. For the two primary controls use two-sided 97.5% Student-t intervals over independent pair means, yielding approximately simultaneous 95% coverage by Bonferroni. State the bounded-sample normal approximation, validate coverage with pre-run synthetic pair distributions, and report a pair-cluster bootstrap sensitivity interval. If coverage checks are unsatisfactory, choose the conservative bounded alternative and resize before outcomes. No independent-game binomial interval, no optional stopping, and no selection against prefixes of final results.

Promotion requires lower bounds above 50% at both primary controls, completed samples, and no protocol/timeout/collision defect. These sizes cannot guarantee detection of a modest improvement. Since pair means lie in [0,1], standard deviation is at most 0.5; a rough 97.5% normal half-width is 5.0 percentage points at 512 pairs and 7.0 at 256. A target gain smaller than that requires a larger preplanned study or accepting an inconclusive answer, not another extension after viewing results.

Final roots, their trajectories, exact alternatives and frontier descendants must not enter training or selection. Reuse the current canonical D4/color exclusions and source/model hashes. Common unavoidable opening prefixes are not independent data: define the split/admission boundary explicitly and report the conditional opening population. Whole-trajectory rejection is outcome-blind but can still change the population because trajectories depend on policies; disclose admission rates and root strata. Generate backup roots in advance and budget accepted counts. Published holdouts are historical diagnostics only.

Freeze sample sizes, depths, confidence treatment, seeds and candidate-selection rules in a machine-readable protocol before execution. Do not tune the strategy against C's final outcomes. Failed or inconclusive confirmation leaves B in production. A positive result establishes a measured step, not yet a “substantially stronger” engine; repeated gains and an external benchmark are required for that claim.

## 7. Computing architecture, cost and scheduling

### What the native result buys scientifically

The measured C++ kernel completed matched search batches about 2.75–2.95× faster including loading/startup, but only 1.03× at the smallest workload. It uses the trained long tables, ascending-square ordering and no TT, rather than full production search. It cannot yet be used as an estimate of whole-campaign or production speed. [Language comparison](LANGUAGE_COMPARISON.md).

Retain JavaScript as reference, browser implementation and orchestration. Use a separately installed native teacher now; this avoids making our own C++ backend a prerequisite for learning. If our own exact/reference search becomes the bottleneck, extend the existing C++ prototype to persistent batch requests, cancellation, hashes and independent equivalence checks. The payoff is more depth checks, earlier exact anchors and more teacher-labeled frontier positions per hour. It does not make B-derived labels independent.

Only after a measured evaluator gain, or a clear search bottleneck limiting the program, consider porting the original core incrementally: bitboard rules, table evaluation, TT/order semantics, deadlines, then coaching continuations. Compare frozen B on both cores before combining evaluator and engine changes. Require a worthwhile end-to-end gain, provisionally at least 1.5× in representative production batches, before taking on native packaging. C or Rust offers no demonstrated local advantage over the existing C++ work.

For eventual WebAssembly, export whole searches/batches, retain tables inside module memory, run in a browser worker, and preserve cancellation. Measure native, Wasm and JS independently. WSL2 is the primary development target; Apple Silicon and Intel macOS require actual compile/runtime/deadline tests. Keep Python + modern browser play dependency-free. Native research tools remain optional; no native rewrite is approved here.

### Transparent resource estimates

Teacher throughput is **not yet measured**. If a full root label takes 0.2–2 CPU seconds, 1,000 labels cost 0.056–0.56 CPU hours before deeper checks; 30,000 cost 1.7–16.7 CPU hours. At 10 seconds each, 30,000 cost 83 CPU hours and the proposed 24-hour allocation may be infeasible. These are sensitivity calculations, not observed Edax rates. All-alternative labeling, deeper verification and frontier queries multiply the count; a best-move call is not a full root label.

A six-wall-hour run capped at four workers has an upper envelope of 24 CPU hours; serial tournaments reduce attainable aggregate utilization. A 24-hour run has an upper envelope of 96 CPU hours at four workers, but much less of it is available for labeling after testing and margins. Do not confuse these budgets with pure optimizer time. The old ~140,000 retained positions per learning wall hour describes weak-policy collection, not strong labels.

Compact roots, alternative values, settings and short PVs should initially need roughly 1–4 KiB per root, plus explicitly stored frontier boards. Thirty thousand roots therefore mean roughly 30–120 MiB before extra traces, JSON overhead, repeated versions and indexes. Reserve 2 GiB initially and 10 GiB for the longer run; verify actual bytes/root. Long tables currently require a few MiB, whereas worker heaps, caches, teacher hash tables and admission indexes dominate RAM. Reserve 1–3 GiB working RAM initially, use bounded caches, and measure peak process RSS rather than V8 heap alone.

The prior scaling experiment favors six workers when memory permits, four with tighter Windows headroom; it does not authorize six teacher processes with large hash tables. Start with four only if a fresh Windows/WSL preflight passes the existing 1.5 GiB plus 0.6 GiB/worker reserve, adding the teacher's configured hash allocation. Use two if needed. Cap at six after measuring actual labels/hour and responsiveness. No active swapping, no closing applications or changing saved power settings. Use the existing temporary keep-awake and reboot/resume mechanism only within its authorized operation; receipt reuse must prevent duplicate admitted work. [Resource measurements](RESOURCE_SCALING.md).

### Finishing on time

Calibrate three repetitions per workload using independent development roots, including hard and slow strata. Budget from the slowest repetition and high-tail exact costs, not average shallow throughput. Reserve **1.35× predicted final-test cost**, explicit admission/retry overhead, plus a final safety margin of 30 minutes in six hours and two hours in 24 hours. Stop optional training at the predeclared freeze time regardless of training progress.

A crude tournament upper estimate is at most 120 searched placements per opening pair: 9.6 seconds at 80 ms, 36 seconds at 300 ms, before overhead. Thus C's 512/256 primary pairs can consume about 3.93 serial wall hours, or 5.31 hours with 35% allowance. Budget another separately calibrated allowance for the external-engine anchor and quality audit. Exact early completion often saves time; never rely on it to fit the plan. B's 48/32 pairs cost at most about 27 minutes nominal, about 36 minutes with that allowance. These bounds assume timely deadline handling; measured overruns and OS load must be added.

If calibration cannot fit all fixed targets, reduce optional training or decline launch. Any sample-size reduction must happen before final data access and be written into the protocol; a timeout with incomplete targets is an incomplete experiment, not a new smaller successful one. Use monotonic active time, frozen executable snapshots, immutable model/data receipts, atomic checkpoints, event logs and measured stage ETAs already implemented. No further framework redesign is needed.

## 8. Questions for review

No answer is needed to finish this document. Before the subsequent implementation/run, the useful strategic choices are:

- Is a pinned external Edax teacher acceptable as the default independent source? This review recommends it; the original player remains ours. If unavailable, deeper B labels are a weaker fallback and must not be called independent.
- Is a reproducible gain of roughly five to ten percentage points against B a useful first milestone, or should final sample sizes target a smaller improvement? This affects confirmation cost, not the initial audit.
- Is a B-preserving residual acceptable even if it costs modestly more per leaf? The recommendation is yes, conditional on equal-time wins; fast standalone tables remain a possible later distillation target.
- What overnight memory/CPU headroom should be reserved during normal Windows use, and when will Intel/Apple Silicon Mac hardware be available? Use fresh preflight defaults until specified.

These are review decisions, not permission requests inserted into this completed documentation task. No new long computation starts without strategy review.

## 9. Suggested subsequent Codex implementation plan

1. Read this document, the actual user requests and latest negative screen. Preserve B and all old artifacts; reserve new protocol namespaces and exclusions. Do not activate the old six-hour long-pattern configuration.
2. Implement only the external teacher adapter, score/turn/pass normalization and Stage A receipts. Pin executable/data identities and record licensing provenance. Verify exact fixtures and common-depth all-alternative labeling; execute a short calibration.
3. Freeze Stage A accepted counts, teacher depths, stability rules and cap. Run it autonomously, producing a decision receipt and report. If its gate fails, stop without invoking an AI or starting training.
4. If reviewed authorization includes Stage B, implement the small zero-residual linear model, parity-balanced sampling and explicit search-aware pair loss. Test B identity at zero correction, finite-difference gradients, branch switches, pass semantics, turn/color transforms and checkpoint recovery. Keep prototype turn-aware tables separate; no simultaneous representation overhaul.
5. Use a frozen corpus and explicit loss component weights, fixed replay of prior constraints, root-balanced sampling and training/selection separation. Retain both selected and last optimizer states with unambiguous identities. Execute only the two declared learning controls and the fixed development screen.
6. Generate a compact report with gates, data provenance, phase/parity/depth results, elapsed/CPU/I/O accounting and playing uncertainty. Stop automatically on failure or infeasible scheduling. Prepare, but do not automatically launch, Stage C.
7. Only after a successful pilot, add the small long-pattern residual or batched native reference backend where the measured error/cost justifies it. A confirmed improvement should motivate one policy-improvement iteration, not a new catalog of unrelated models.

### Verification of this review

Read the requested evidence and inspected evaluation, search, data generation, fitting, model compilation and coordinator code. Before documentation edits, `node --test tests/*.test.mjs` passed 62/62. A small independent exact check and sampling/coverage audit are described above. After documentation edits, the JavaScript suite again passed 62/62; the Python launcher/research suite passed 18/18 (72.7 seconds), with two subprocess-lifecycle ResourceWarnings. These warnings are recorded rather than described as a warning-free run. `git diff --check` passed. Commit/push results are recorded in the completion message. This round does not claim new macOS hardware, Windows-browser, teacher-strength or native-playing validation. Historical platform measurements remain historical.
