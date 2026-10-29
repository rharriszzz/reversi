# Independent scientific review of Reversi learning

29 October 2026. Reviewed checkout `8dded668a3c816835630457c4454245dfb78c57b`.

## Executive conclusions

**First measure the playing strength of frozen L and P, without another fit and without a preference-loss eligibility gate.** My preferred direction is to validate the learning objective against actual searched play before optimizing it again. Keep B as production and keep both existing architectures as fixed experimental controls. A new, prospectively registered screen is scientifically different from resuming or rescuing the completed experiment. Its results cannot change that experiment's failed gates or independence status.

There is a substantive correction to the latest report's terminal diagnosis. **The disputed +64 is not merely an early-game estimate.** The published parent has 55 occupied squares; D10/D12 reaches termination. A small independent solve during this review confirms that all five disputed alternatives win and improve raw margin over the immediate finish. The bad training constraint is not necessarily a bad teacher ordering: it asks the restricted shallow evaluator to represent a valid solved ordering across its terminal/heuristic boundary. Calling the teacher's preference incorrect, or simply reversing it to prefer an immediate win, would be a mistake.

The larger methodological failure is treating a fixed relative improvement in logistic loss as a prerequisite for learning whether a player is stronger. This loss is sensitive to score confidence, unattainable constraints, and a few extreme cases. It is not a validated strength surrogate. The latest full-loss gate mostly measured a win-versus-win score incompatibility, while the root gate rejected L for a statistically unresolved increase of just 0.0078125 estimated discs. Neither demonstrates that L is a weaker player. Conversely, post-hoc nonterminal gains and P's exact-endgame counts do not demonstrate stronger play.

The evidence supports four distinct conclusions:

1. The original regularization was excessive **for the measured preference objective**. Convergence and flat curves under that penalty did not establish a seven-feature ceiling.
2. L and P improve observed nonterminal sibling judgments. This is more than pure score rescaling, but it does not identify which changes matter after minimax.
3. P has the most encouraging positional point estimates; L has the cleaner cost profile. Neither is the demonstrated stronger player. B remains the justified deployment choice.
4. Independent teacher qualification, exact solving and receipts are valuable infrastructure, but do not validate every teacher target, statistical gate or exclusion rule.

I do **not** endorse utility-consistent root-choice preference learning as an already established best next learner. It is a credible hypothesis. Pure root imitation can relocate the same utility contradiction; differentiating through minimax can fit unstable active leaves; value learning can provide cross-position calibration that sibling ranking lacks. The current evidence does not identify a winner among these objectives. The smallest useful first action is to learn whether the existing candidates already improve the user's actual outcome.

## Evidence, verification and limits

I read `USER_REQUESTS.md`, `AGENTS.md`, all eleven reports requested for this review, and the relevant implementation. Historical strategy documents are hypotheses, not experimental authority. The main evidence is [the latest results](NEXT_RESIDUAL_RESULTS.md), [their frozen protocol](NEXT_RESIDUAL_PROTOCOL.md), [the constraint diagnosis](NEXT_RESIDUAL_STRATEGY.md), [the previous residual outcome](RESIDUAL_FRONTIER_RESULTS.md), [its protocol](RESIDUAL_FRONTIER_PROTOCOL.md), [teacher qualification](TEACHER_DEPTH_QUALIFICATION_V4.md), [the earlier strategy](ASTRA_STRATEGY.md), [teacher strategy](ASTRA_TEACHER_STRATEGY.md), [the long-pattern screen](NEXT_EVALUATOR_RESEARCH.md), [the earlier campaign](STRONG_EVALUATOR_RESULTS_20261028.md), and [the matched hardware benchmark](MAC_PC_BENCHMARK.md).

The original residual, constraint/pattern and six-hour campaign directories are absent on this Mac. Published numerical JSON contains source-level summaries, disclosed roots and full L/P coefficients, but not every raw transcript or training example. I have not rerun historical audits or recomputed their training losses from unavailable receipts. Statements about their complete integrity inherit the published audits. No fresh locked result was opened.

A [small reproducible diagnostic](../scripts/review-learning-strategy.mjs) reads only committed evidence, reconstructs one disclosed B frontier, independently solves its nine-empty parent under both conventions, and counts exact diagnostic source clusters. Its [output](data/astra-learning-strategy-diagnostics-20261029.json) binds the input hash. It performs no fitting, sampling, teacher query, tournament or model export. This local exact recheck is distinct from the historical audit.

The code observations grounding this review are:

| Component | Verified behavior and scientific implication |
| --- | --- |
| [B features](../src/features.js), [fast implementation](../src/fast-features.js) | Seven bounded normalized features; phases at occupied 28 and 52. Mobility and conditional corner danger already encode nonlinear board knowledge. Twenty-one coefficients are not twenty-one raw square inputs. |
| [Search](../src/search.js) | Terminal utility is `10000*sign(raw margin)+raw margin`, zero for a draw. Terminal/pass detection precedes cutoff evaluation; passes consume no placement. Playing search shares root alpha; coaching/research all-alternative comparisons use full windows. Timed play keeps the last complete iteration and resets score TT entries between horizons. |
| [Frontier reconstruction](../scripts/next-residual/frontier.mjs) | Re-searches best-two root continuations and their remaining-depth alternatives; does not just trust a TT pointer. These are valid witnesses, but only a narrow part of the search tree. Changed models can change that part. |
| [Preference construction](../scripts/residual/data.mjs), [linear loss](../scripts/residual/model.mjs) | Requires both D10/D12 gaps ≥2; competitive pairs include near-best or original B choice; gap weight caps at 4; informative trajectories have unit mass. Terminal features are zero, while terminal score offsets enter logistic margins unchanged. |
| [Pattern model](../scripts/next-residual/model.mjs) | P freezes L, adds corner-six/edge-eight tables with D4 averaging and color antisymmetry, bounded ±25 coefficients, and uses original phases. No learned terminal correction. |
| [Teacher adapter](../scripts/teacher/edax.mjs) | Each alternative has the same remaining placement depth in an independent full window; rejects wrong-depth/selective/unresolved-bound output; handles passes and awarded-empty terminal scores explicitly. Full-window is not synonymous with game-theoretically exact. |
| [Independent exact solver](../scripts/teacher/exact.mjs) | Separate sentinel-board rules, convention-aware TT and full-window alternatives; solves raw and awarded margins independently. No external-engine implementation is imported. |
| [Statistics](../scripts/next-residual/statistics.mjs), [audit](../scripts/next-residual/audit.mjs) | Paired whole-source bootstrap; separate selector panels; root gate uses a point mean, not a noninferiority interval. Late PV overlap blocks the prescribed independence claim. |

Earlier mixed outcome/preference training in [strong/train.mjs](../scripts/strong/train.mjs) had different targets, phase rules, sampling and updates. Its negative games are evidence against those complete players, not a controlled trial of modern L/P or all value regression.

## What quantity should the evaluator learn?

Let a state be $s=(b,t)$, board and side to move. Let $m(z,p)$ be terminal occupied-disc margin for player $p$, $e(z)$ the unplayed empties, and

$$
 w(z,p)=\operatorname{sign}m(z,p),\qquad
 a(z,p)=m(z,p)+e(z)\operatorname{sign}m(z,p).
$$

Game points are $g=(1+w)/2$. Production terminal utility is

$$
 U_B(z,p)=10000w(z,p)+m(z,p).
$$

For any fixed zero-sum terminal utility $U$, its optimal-play value satisfies

$$
 V_U^*(s)=\max_{a\in A(s)}[-V_U^*(T(s,a))],
$$

with the terminal condition $U$, and a forced pass changing turn/sign without consuming a placement. Both players lacking a legal move ends the game, including with empty squares. In a fixed-player formulation this is alternating max/min instead of negamax.

### Deterministic values, outcomes and uncertainty

For fully solved deterministic play, maximizing **raw margin** already puts every win above a draw and every draw above a loss. `10000*sign(m)+m` is a strictly increasing odd transform of raw margin, so exact minimax choices are the same, including preference for a larger win or smaller loss. The bonus does not create a different solved raw-margin strategy. W/D/L alone is coarser: it leaves all wins tied. Awarded margin preserves outcome signs but can change within-outcome order and ties because empties differ. It is not a scalar transform of raw margin alone.

For uncertain outcomes these equivalences fail. A move winning by 64 with probability .51 and losing by 64 otherwise has expected margin 1.28, larger than a certain +1 win. It earns expected game points .51 rather than 1. Expected `U_B` ranks the certain win higher in this example, but no finite margin bonus implements *strict* lexicographic maximization of win probability: an arbitrarily small probability difference can still be outweighed by margin. Also $E[\operatorname{sign}M]\ne\operatorname{sign}E[M]$.

Our game is deterministic. Probabilities describe ignorance, sampled opponents or execution/policy randomness, not randomness in the rules. A learned expectation under policies $\pi,\sigma$, $E[U\mid s,\pi,\sigma]$, need not equal $V_U^*$. Strong-policy outcomes can nevertheless be useful supervision; the old weak/exploratory mixture does not disprove outcome learning generally.

If game points are primary, a probabilistic value would be

$$
 v_g(s)=P(\mathrm{win}\mid s)-P(\mathrm{loss}\mid s),
$$

under an explicitly stated predictive interpretation. A three-class W/D/L model permits a proper cross-entropy or Brier loss. Disc margin can be a separate auxiliary prediction or tie criterion. Edax's score sign is not a calibrated probability label.

Lexicographic `(outcome, margin)` comparisons need no differentiability in alpha-beta. The terminal rule is a constant boundary condition; no gradient through it is needed. Smooth learned outputs and nonsmooth max/min decisions can coexist. For uncertain distributions, replacing lexicographic probabilities by `K*v_g+expected_margin` is a practical approximation with a chosen tradeoff, not mathematical lexicographic priority.

### Static evaluation, backup and teacher value

Write a horizon evaluator as

$$
 F_\theta(s)=\begin{cases}U_B(s,t)&s\text{ terminal},\\ f_\theta(s)&\text{otherwise}.\end{cases}
$$

The production value $M_d^\theta$ uses $f_\theta$ at nonterminal cutoff states and alternating max/min over $d$ placements. Alpha-beta is an efficient way to compute that same finite-horizon minimax value when its correctness conditions hold. It does not make the leaves true values. A verified PV establishes how a score backs up under that evaluator; an immediate feature breakdown is not a causal explanation of a deeper score.

A teacher supplies $q_D^E(s,a)$, using its own evaluator, depth, score convention and search definition. Before termination these are estimates, even with complete full windows. Agreement at D10/D12 increases confidence in local stability, not independence from shared evaluator error. When the tree is solved, exact conventions determine which comparisons are valid.

At elapsed budget $T$, the actual policy is $\pi_{\theta,T}$, not simply $\arg\max M_6^\theta$. Completed depth, move ordering, pruning, TT work, evaluator cost, interrupted iterations and tie policy all matter. The user's target is an opening- and opponent-specific quantity such as

$$
 J_T(\theta;B)=E_{o\sim\mathcal D}\left[\frac{g(\pi_{\theta,T}\text{ as Black},B;o)+g(\pi_{\theta,T}\text{ as White},B;o)}2\right].
$$

Equal-time superiority against B means $J_T>.5$ on that declared population. It is not automatically an Elo rating, optimal-play improvement, or superiority to other opponents.

## Terminal utility: the concrete case and the correct diagnosis

The published example has Black to move at a 55-occupied frontier parent. Move 9 (B2) ends the game at 56 occupied. Its raw margin is +54; eight empties make awarded margin +62. Its production score is therefore **+10,054, not +10,062**. Move 16 (A3) leads to a nonterminal child whose B heuristic is **143.6185064935065**.

The diagnostic reconstructed that parent from the disclosed source and independently obtained:

| Move (row-major index) | Immediate terminal? | Exact raw minimax margin | Exact awarded minimax margin |
| --- | --- | ---: | ---: |
| B2 (9) | yes | 54 | 62 |
| A3 (16) | no | 63 | 64 |
| A4 (24) | no | 64 | 64 |
| A5 (32) | no | 64 | 64 |
| A6 (40) | no | 55 | 62 |
| A7 (48) | no | 62 | 64 |
| A8 (56) | no | 64 | 64 |

Thus the five supported +64-versus-+62 preferences are correct **under both margin conventions**, though their exact raw values are not all +64. Their W/D/L values are identical. The previously published exact summary already records chosen raw value 54, regret 10 and zero W/D/L error. The fresh read-only solve adds a direct check of every alternative; it does not provide new independent assessment evidence.

D10/D12 has more placements than the parent's nine empties; adapter depth capping and pass handling mean these labels are endgame values, not merely two agreeing heuristic horizons. The latest report's “future +64 Edax win” is easy to misread as uncertainty about this particular result. **Nonterminal board does not imply non-exact label.** This qualification materially changes the interpretation requested in the prompt.

The pair loss for A3 preferred to B2 is

$$
 \ell=\log(1+\exp[-(143.6185065-10054)/10])\simeq991.03815.
$$

A tied pair costs only $\log2\simeq.6931$. Even a deliberately generous combination of the declared linear and pattern boxes gives an upper preferred-minus-other margin of **−9,591.8082** for this pair. The learner cannot satisfy it. A larger fitted coefficient is not the appropriate repair.

The diagnoses must be kept separate:

* **Score-space/model incompatibility:** a near-10,000 gap separates all admissible heuristic outputs from proven terminal wins. A shallow student cannot reproduce this valid deep preference within its bounds.
* **Ordinal labeling:** this example's ordering is correct. Elsewhere, using awarded instead of raw margins can change ordering. For genuinely unsolved +64 estimates, saturation or horizon agreement is not proof that +64 is achievable; a label against a guaranteed win needs separate justification.
* **Strategic severity:** choosing B2 loses margin under optimal play but no game points. Calling this a catastrophic winning error because its logistic loss is approximately 991 is scientifically misleading.

The production terminal bonus is a useful convention for preferring a proven win to an uncertain heuristic advantage. It also makes some shallow comparisons incapable of matching exact margin-optimal decisions. That is a horizon/representation tradeoff, not an alpha-beta bug. The teacher knows more than the student search has proved.

For a **genuinely estimated** +64 against a certain +62 win, there is no general reason to prefer the estimate when maximizing game points. For the **actual solved** alternatives, larger margin is warranted as a secondary objective, but W/D/L treats them as ties. We should not convert uncertainty policy into fake ground-truth labels, nor reverse exact preferences merely to agree with B.

### What can calibration repair?

Changing temperature reduces the numerical dominance of the terminal pair but cannot reverse an unattainable ordering. Source normalization caps total pair weight per trajectory, not its unbounded loss. Logistic gradient in the score margin is bounded by $1/\tau$: enormous loss does **not** imply a proportionally enormous gradient. The observed 79% loss share does not prove this source dominated training updates, especially since it belongs to assessment.

A single increasing transform applied to *all* leaf and terminal utilities preserves min/max order; with negamax it should also be odd. It cannot repair wrong ordinal choices. Transforming only terminal scores or only heuristics changes mixed comparisons, and is a new experimental scoring design. A positive rescale of all nonterminal scores preserves fixed-depth choices when terminal ordering is also preserved. It can lower logistic loss without changing a single decision.

More generally, if an approximately fixed incompatible contribution is $C$, the gate measures $\Delta\mathcal L/(C+\mathcal L_{\rm compatible})$. Increasing $C$ can make the same useful decision changes fail an arbitrary relative threshold. Subtracting it retrospectively would change the old gate; recognizing this mechanism prospectively is essential. Before any future fit, audit both target provenance and whether each requested ordering is attainable within the model's declared score bounds.

A learned probability or raw-margin scale could be consistent with terminal values, but it requires a newly specified evaluator output and calibration dataset. Regression to `U_B` is coherent in principle; its sign jump makes noisy near-zero targets difficult, and preserving the current small bounded heuristic range leaves solved wins unrepresentable at cutoff. Mapping an estimated disc score through `10000*sign(q)+q` invents certainty and is especially dangerous near zero.

For future supervised fitting under the **unchanged** architecture, use a prospective target contract:

| Label situation | Treatment |
| --- | --- |
| Both alternatives exact | Compute raw-margin values independently; W/D/L severity first. Same-outcome margin differences are secondary. Keep exact terminal constants. If an ordering is unreachable within the model/horizon, flag it rather than drive an impossible gradient. |
| Both nonterminal and genuinely estimated | Stable competitive teacher preferences are admissible heuristic supervision, with capped weights and explicit uncertainty; not W/D/L truth. |
| Exact versus estimated, including an immediate terminal | Keep provenance and certainty separate. Do not let an uncalibrated estimated margin overrule a proven win as a purported outcome label. For fixed-architecture fitting, omit the unresolved cross-certainty preference by a frozen rule; report its coverage separately. |
| Both production endpoints terminal | No trainable dependence. Evaluate correctness directly, rather than adding constant loss to an eligibility denominator. |

Omitting a class from a *new* optimization objective is legitimate if declared before fitting; it narrows the claim and must never omit those states from comprehensive decision assessment. A bounded decision-error metric and separately reported exact W/D/L mistakes are better safeguards than an enormous unsatisfiable logistic penalty. Exact win-versus-loss constraints that are unreachable indicate a real architecture/search limitation and cannot be dismissed as harmless margin ties.

## Why sibling improvements need not survive minimax

The current objective is

$$
 \mathcal L_{\rm sib}(\theta)=\frac1{N_I}\sum_{i\in I}\sum_{(a,b)\in P_i}\bar w_{iab}
 \log[1+\exp(-(f_\theta(x_a,p_i)-f_\theta(x_b,p_i))/\tau)]
 +\lambda\|\delta\|_2^2,
$$

where $I$ contains informative sources, pair masses sum to one within each source, and $\tau=10$. Terminal offsets replace the corresponding learned score. For fixed pairs and linear/table coefficients this is a convex, well-defined surrogate. A Bradley–Terry interpretation would assume preference probabilities modeled by a logistic score difference. Here labels are deterministic filtered engine orderings and weights are engineering choices, not repeated human/engine preference probabilities. Calibration as probabilities is therefore unjustified. Logistic classification consistency under suitable unconstrained conditions is not a theorem of minimax or game-strength consistency for this restricted model and sampling scheme.

Three failure mechanisms survive fixing terminal pairs:

**Relative order within each parent does not identify values across parents.** In a two-placement max/min tree, let root A have opponent replies with true root-player values `(5,6)` and B have `(4,100)`. True backup is A=5, B=4. An evaluator giving A's replies `(1,2)` and B's `(3,4)` orders replies correctly within both parents yet chooses B. Sibling data may constrain these levels indirectly through shared parameters and other positions, but does not guarantee the needed cross-parent order. Training on relative move choices is useful; it is not automatically sufficient for a leaf value function.

**Minimax selects errors, not average accuracy.** Min and max are nonexpansive in the uniform norm. If every leaf is within $\epsilon$ of its true continuation value on a complete horizon tree, backed-up values are within $\epsilon$ and selected-move regret is at most $2\epsilon$. Mean squared error or average preference improvement gives no such uniform bound. One falsely optimistic refutation can control a root decision. Conversely, improving many inactive siblings changes no backed-up score.

**The fitted distribution is endogenous.** B's best-two witnesses were reasonable economical labels, but exclude much of the tree and potentially teacher-best root alternatives ranked below B's top two. L-selected assessment helps detect one distribution shift; it does not test P-selected deployment or all newly active branches. The competitive-pair filter still includes original B's static choice at L parents. Broadly correcting B-selected siblings can miss L/P's new mistakes.

Phase changes need precision. With placement-based depth and correct passes, all nonterminal leaves of a completed fixed-depth search have the same occupied count. Independent positive phase scaling therefore does not automatically alter such choices. It matters through terminal mixing, different completed horizons, and new distribution/calibration tasks. A blanket assertion that phase-specific scores necessarily corrupt every fixed-depth backup would be wrong. Hard boundaries and board-only turn representation remain substantive approximation constraints.

Finally, `f(board,p)=-f(board,-p)` is correct for changing the evaluation *perspective of a fixed state*. B/P use it also when the argument serves as side to move, without a separate turn input. The value of the same occupancy with opposite turns is a different state and need not obey that identity. Pass normalization fixes rule semantics, not this potential representation ceiling. The earlier Astra diagnosis was right to distinguish that limitation from a search sign bug.

## Alternatives: targets, assumptions and costs

All alternatives below require legal state/turn identity, placement-based pass handling, explicit child phases, constant terminal leaves, independent exact overrides and fresh deployment tests. None is licensed to treat Edax D12 as exact outside solved trees.

### A. Utility-consistent frontier preferences

Keep linear L-style or compact P-style features; apply the target contract above and minimize the source-normalized logistic loss on compatible pairs. The main advantages are cheap fitting, convexity and transparent diagnostics. Under the unchanged bounded architecture, the honest objective is partial heuristic ranking plus exact decision diagnostics, not full expected-utility estimation.

Teacher assumptions are ordinal: stable order of competitive alternatives. No absolute disc calibration is needed. Passes use parent perspective and actual child state; exact same-outcome preferences cannot dominate W/D/L. Fixed collected frontiers still become stale when weights change. Larger coefficients can improve margins without materially improving decisions. The observed nonterminal gains support learnability, but root-transfer uncertainty and plateauing curves weaken the case for a larger same-objective corpus. Reusing already available compatible labels would be inexpensive; new labeling and evaluation dominate cost. This remains the simplest future control.

### B. Root-choice preference learning

There are two different methods often conflated under this name.

A separate policy can minimize cross-entropy against teacher acceptable root moves, or cost-sensitive regret $\Delta_E(s,\pi_\theta(s))$. It may choose moves directly, or order search moves. As move ordering it changes cost but not a completed full-width minimax value. Used directly it changes the playing architecture; it is not a learned leaf evaluator.

Alternatively use searched scores:

$$
 \mathcal L_{\rm root}(\theta)=E_s\sum_{(a,b)\in C_s}w_{sab}
 \operatorname{softplus}\left(-[Q_d^\theta(s,a)-Q_d^\theta(s,b)]/\tau\right).
$$

This is search-aware optimization (C), not a cheap relabeling of immediate children. Replacing $Q_d$ with static child scores brings back the old distillation assumption. A listwise loss avoids spending effort on irrelevant bad-vs-bad pairs, but must respect ties and uncertainty. A root with a terminal +10,054 alternative and an unsolved bounded heuristic continuation still has the same impossible preference; moving the loss to the root does not cure it.

Root labels better match the decision of interest and can correct cross-parent comparisons. They are fewer and less reusable than local labels, vulnerable to a few teacher errors and source policies, and dependent on training depth. A policy learner is cheap; searched-score fitting requires repeated searches. Current data support testing this approach, not assuming it wins.

### C. Search-aware parameter optimization

For a fixed finite tree and linear leaves, $Q_d^\theta$ is continuous piecewise affine. Away from ties and changes of active branch,

$$
 \nabla_\theta Q_d^\theta(s,a)=\sigma_{s,a}\phi(\ell_{s,a}),
$$

where $\ell$ is the active minimax leaf and $\sigma$ converts its perspective. A terminal active leaf has zero gradient. Root pair gradients use the difference of these *signed active-leaf* features. At ties, derivatives are not unique; chosen branch gradients are local directional information, not a convex convergence guarantee. Re-search after parameter changes. TT bounds are not interchangeable with full root values or differentiable witnesses.

A capped-margin hinge $[\kappa-(Q_a-Q_b)]_+$, for example, stops rewarding already adequate margins; it still needs coherent target order and a declared scale. Direct teacher-regret optimization through $\arg\max Q$ is piecewise constant, so ordinary gradients vanish; coordinate search or other derivative-free methods may work for 21 weights but consume repeated searches. Soft minimax supplies gradients at the cost of branch-count bias (log-sum-exp differs from max by up to temperature times log branching), changing the optimized game. Validate with hard search.

The possible benefit is better assignment of error to leaves that determine root choices. The risks are chasing unstable PVs, shared features disturbing many other leaves, horizon-specific overfitting and plateau regions. Under exact leaves it must leave solved values untouched; passes preserve placement depth and can change signs multiple times. Train at one or a small fixed depth mixture, assess odd/even and deeper horizons, then timed play. Current uncertain root results motivate this hypothesis but are not evidence of an optimization failure that only differentiation solves. Cost is roughly optimizer updates times roots times full searches, not one convex fit. Six independent workers do not accelerate a sequential parameter-update chain by six.

### D. Value-function learning

For independently meaningful targets $v_i$, fit a source-balanced robust regression

$$
 \mathcal L_V=E_i\rho(f_\theta(s_i)-v_i)+\lambda\|\theta-\theta_0\|^2.
$$

A common raw-disc scale supplies levels across unrelated positions; a W/D/L distribution supplies outcome meaning with proper scoring losses. Exact targets have strongest provenance. Approximate teacher discs require calibration and robustness, not conversion by the terminal bonus's sign function. A probability model conditioned on bounded policies is not automatically a minimax probability oracle.

Keeping the old terminal score while training all nonterminal values in raw discs leaves mixed utilities incoherent. A coherent research variant must either map all scores to a common utility representation or retain a clearly separated proof/heuristic convention and exclude incompatible numeric targets. Preserving exact terminal behavior is possible with a terminal bypass; preserving the entire present bounded nonterminal scoring convention at the same time may not be. These would be explicit future experimental changes, not this review's edits.

Regression is cheap and stable for 21 weights, accommodates both phases and exact targets, and addresses the missing cross-parent levels. It can waste capacity on irrelevant score accuracy and fit teacher bias. Strong search labels are more credible here than the old weak-game outcome mixture. The old long-margin failures do not settle this alternative, because representation, source policy and label provenance all differed. Teacher qualification supports local ordering more strongly than global cardinal calibration; value learning needs additional checks of scale, tails and cross-phase errors.

### E. Established alternatives and their relevance

TD learns from temporally adjacent predictions/outcomes; in negamax form the unsolved one-step consistency target is $f(s)\approx-f(s')$, with terminal rewards and policy/exploration handled explicitly. TDLeaf transfers updates through minimax-selected leaves. It offers outcome anchoring and search awareness, but correlated self-play, off-policy exploration and bootstrapped approximation can reinforce mistakes; nonlinear/off-policy convergence is not assured. The primary [TDLeaf paper](https://arxiv.org/html/cs/9901001v1) demonstrates feasibility in other games, not guaranteed benefit here.

RootStrap/TreeStrap learn from search backups at current roots or multiple tree nodes rather than only later played states. This broadens training coverage and reduces dependence on an opponent's actual subsequent blunders. Search cutoffs provide bounds, so only validated targets or bound-aware losses are legitimate. These methods still share the current evaluator's bias and need exact/independent anchors. See [Veness et al., *Bootstrapping from Game Tree Search*](https://cgi.cse.unsw.edu.au/~blair/pubs/2009VenessSilverUtherBlairNIPS.pdf). Applying them here is a hypothesis, not a result.

Strong-engine imitation with broader independently labeled search states is a practical intermediate step: frozen teacher targets, modest linear/table student, limited repeated re-collection. Exact-endgame-informed training provides clean targets and useful tactical boundaries, but earlier eight-empty shallow improvements already failed to predict deeper strength. It cannot alone qualify opening play.

Buro's [statistical feature-combination study](https://arxiv.org/abs/cs/9512106) used outcome classification and tournament comparisons, supporting both meaningful calibration and actual playing validation. It does not validate our sibling logistic loss merely because both use logistic functions. [Pinned Edax evaluation source](https://raw.githubusercontent.com/abulmo/edax-reversi/713a434f13b3d15fb69c61b9ba3641aed82c496c/src/eval.c) provides a concrete pattern/incremental-evaluation precedent. Egaroucid's [author technical account](https://www.egaroucid.nyanyan.dev/en/technology/explanation/) describes strong self-play margin labels, separate opening supervision, patterns and incremental computation. Its reported successes do not transfer its data quality or search engineering to our small corpus, and its validation scheme is not our independence protocol.

A better move-ordering function or faster original search with frozen B is also credible. It offers a clean equal-time hypothesis without evaluator learning, but a native kernel speedup is not whole-player evidence. Neural networks are neither required nor ruled out; introducing them now would confound an unresolved objective problem with representation and cost.

## What the completed experiments say about B, L and P

| Model | Demonstrated or directly observed | What is not established |
| --- | --- | --- |
| B | Fast nonlinear board features combined linearly; strongest supported deployment option among completed playing comparisons | Optimal weights, expert-human strength, or a ceiling on learnability |
| Small original residual | Converged penalized fit; 2.08% published assessment loss improvement; uncertain depth-six gain; no games | Feature saturation or stronger play |
| L | Same runtime feature computation; old-development gain 16.75%, versus 1.80%; nonterminal contributions improve 15.23%/18.14%; fewer observed exact W/D/L mistakes | Unrestricted seven-feature optimum, fresh strict independence, root superiority or equal-time strength |
| P | Added geometry; nonterminal gains over L 8.29%/7.06%; favorable root point estimates; still lower exact error counts | General pattern superiority, superiority to a further-unconstrained linear fit, or strength after paying its search cost |

The regularization diagnosis is unusually well supported: with the original ±25 box, removing shrinkage lowered old-development loss from .544226 to .484996; widening to ±100 lowered it further to .461374. Roughly 71.5% of that additional reduction lies along the first step of this path. This is an ordered development-data decomposition, not a unique causal decomposition of game strength. A mean loss does not automatically dilute a fixed regularizer as data increases.

The old nonterminal scale-only control chose `0.880795 × B` and reduced development loss only to .550020, versus .461374 for relaxed L. Together with fewer incorrect preferences and lower immediate regret, this weakens a purely confidence-rescaling explanation. It does not eliminate that component of L's loss gain.

The latest assessment remains numerically and scientifically unchanged:

| Metric | B | L | P |
| --- | ---: | ---: | ---: |
| B-selector full preference loss | 2.52495 | 2.45420 | 2.41278 |
| L-selector full preference loss | 2.53757 | 2.45199 | 2.41740 |
| Depth-four root D12 regret, 128 sources | 1.8750 | 1.9375 | 1.5078 |
| Depth-six root D12 regret, same sources | 1.6172 | 1.6250 | 1.4375 |

Full-loss gains were L/B 2.80% and 3.37%, P/L 1.69% and 1.41%; neither contrast passed both 5% gates. At depth six the source-paired 95% intervals were L−B **−.4766 to +.5156** and P−L **−.7266 to +.3125** estimated discs. These intervals do not establish equivalence or superiority and do not repair the failed strict independence audit. No confirmation games occurred.

Large L weights are not strategic truths. Opening potential goes from 12 to 91.35; opening and middle C-square corrections hit +100; endgame potential becomes −27.08. Correlated feature differences, limited support, confidence scaling and surrogate tradeoffs can all produce these coefficients. An active bound warrants a sensitivity question, not automatic expansion. Seven-feature inputs demonstrably collide on some teacher-preferred children, but the old exact-tie mass was only about .13–.15%; that is not a lower bound explaining most remaining loss.

P has 10,932 color-pair coefficient coordinates; 3,152 have informative-source support. That is **not 10,932 independently identified strategic facts**. D4 averaging also introduces geometric redundancy (for example edge-code reversal contributes to the same averaged feature), and empirical feature correlations reduce effective rank. A supported lookup may have little support or cancel in pair differences. Unseen coefficients staying zero is a sensible fallback, but supported rare cells can still overfit.

P's exact-feature-tie subsets (B selector: 3 correct of 7 pairs; L selector: 7 of 9) show some added information and considerable uncertainty. Most improvements need not arise on exact ties: geometry can approximate global weight changes outside L's box, nonlinear interactions or genuine missing structure. Distinguishing these requires a controlled future fit and source-held-out search results, not inspection of coefficient count.

The cost is material but not prohibitive. P's known-mobility static cost was 1.062 μs versus L's .929 μs, +14.28%; without reuse, +11.32%. Zero-table matched-search throughput was 96.77% of L, isolating an overhead of only about 3.2% on those trees. Learned P's 1,123 ms versus L's 919.5 ms over 16 depth-six roots also includes changed node counts and pruning. It cannot all be charged to pattern lookup. On the old development probe, median completed depth at 300 ms was 7 for P and 7.5 for L/B; at 80 ms P/L both had median 6. These small measurements support testing both budgets, not extrapolating a precise strength penalty or a current Mac timing.

The latest exact frontier counts are 95/98 **positions from 50 sources per panel**, confirmed from committed rows. B's eight errors occur in seven sources in each panel. L/P have 1/0 error sources on B frontiers and 3/2 on L frontiers. The panels overlap and cannot be added into 193 independent trials. Zero errors in 95 selected parents does not prove a negligible population rate. These are static choices at selected late frontiers; the root exact subset has only seven sources and zero mistakes for all models. The counts are interesting evidence of useful late knowledge, not a stronger full player.

Historical conclusions need revision in scope, not in outcome. The first residual report favored representation expansion too quickly from a heavily penalized fit. Earlier Astra work correctly identified search/target mismatch but did not establish that minimax differentiation was necessary. The latest recommendation jumps to another objective before observing games for its strongest newly supervised candidates. Conversely, the old long-margin model's negative equal-depth and equal-time results are genuine evidence against speed as a universal explanation. None of these facts licenses rewriting completed gates.

## Independence and teacher reliability

### What overlap actually threatens

Independence has several meanings: no fitting/selection access to assessment labels; no duplicate scored cases; no correlated-source pseudo-replication; and generalization to a new opening population. One binary “any board collision” rule conflates them.

A training target identical to an assessment decision state, including symmetry/color-equivalent copies, can directly favor a memorizing model. Shared ancestors and branches can make test errors correlated. A published engineering example that influenced feature design can also matter. In contrast, two disjoint games ending at the same terminal board do not automatically leak parameters: terminal utility is known by the rules and is not learned. An incidental collision at an internal teacher PV node is not automatically direct target reuse. Its role, whether its labels influenced learning, and whether it is exact matter.

The existing strict ban is conservative but neither necessary nor sufficient for all forms of statistical independence. It may increasingly select unusual games and endings as history grows. Checking returned PVs also cannot prove disjointness of every internal node searched by the teacher. Exhaustive teacher-tree exclusion would be enormously restrictive and unnecessary for an independent fixed oracle. Conversely, checking only distinct root seeds cannot guarantee independent trajectories.

**The completed experiment remains blocked under its own rule.** Four sources, 50 occurrences and 18 canonical identities remain disclosed. The later 1,326 missing engineering keys and zero added collisions demonstrate an index-coverage defect plus a useful audit, not recovery of strict independence. I cannot classify every historical collision's training influence without the PC's provenance receipts.

### A prospective policy for the next study

For the proposed screen, register a *source-disjoint generalization* claim, not a claim that every internal or terminal board is historically novel:

1. Freeze models, source code, teacher and intended sampling distribution first. Import a compact verified historical index **with role/provenance metadata and a complete inventory**, including engineering games, queried children/PVs and unused reservations. The Mac cannot certify completeness from compact summaries alone. Transfer/check this index from the PC; no multi-gigabyte corpus is needed for a membership audit. Missing inventory blocks an independent launch.
2. Exclude historical and cross-role canonical assessment roots, directly scored nonterminal children and deployment frontier decision states. Keep board **and actual turn** in identity; simultaneous color/turn exchange is a symmetry. The old `keysFor` exclusion adds both turns and is deliberately stricter than state identity. For this small screen retaining that conservative rule for direct states avoids introducing a second admission change.
3. Group repeated openings and known common ancestry at or beyond the declared occupied-12 boundary as one source/family. Allocate families once. Symmetric/color variants and both colors are measurements within a cluster, never extra independent observations. Shared earlier random prefixes remain part of the conditional population; no claim of independence across all possible histories follows.
4. Freeze all scored positions and openings jointly. Returned teacher PVs are unknown beforehand: query behind a sealed result boundary, legally replay the **entire returned** PV, canonicalize with turn, record overlap and provenance, then release results. A returned finite-horizon PV is not the entire game tree or necessarily a complete game. This audit cannot certify unreturned nodes.
5. Retain every reserved source in analysis. Under this new policy, incidental oracle-internal overlaps and terminal convergence are reported, not silently dropped. Any forbidden direct-target cross-role leak or accidental model access blocks the confirmatory claim. Candidate-played paths also stay retained; overlap-induced exclusions after playing would select the opening population using the candidate's behavior.

If a future study instead insists on strict PV-disjointness, use a preregistered fixed candidate pool and deterministic collision-only admission in a sealed labeling stage, before fitting/selection or release of scores; rejected candidates never become training. Record rejection rates and the resulting conditional population. “Outcome blind” is not synonymous with “unbiased”: PVs depend on values. For late unforeseen collisions after a cohort is frozen, retain the cohort and block the strict claim, or apply a predeclared contamination estimand; never improvise favorable replacements.

Source-level separation is sufficient for inference about new source trajectories under a frozen oracle when direct target reuse is prevented or explicitly part of the deployment estimand and residual dependence is handled by family clusters. It is not sufficient to claim novelty of every state or to treat repeated roots as independent. Avoid zero-width or implausibly narrow resampling intervals: the earlier LCG/bootstrap error is a reminder to verify statistical code independently of search correctness.

### Is D10/D12 enough?

V4R1 supplies a reasonable economical teacher for stable ordinal comparisons: 251/256 D10 choices within two D12 discs, mean regret .227, 56 stable corrections including 19 early, and 449 exact alternatives agreeing across 64 roots. It does not establish calibrated win probabilities, unbiased cardinal values, all-pair correctness, or reliability on newly selected P branches. The horizons share an evaluator, and the patched root-conditioned clamp is part of this particular teacher's definition.

Use the same qualified pin for the first screen's diagnostics. Solve all feasible late roots independently under raw scoring; awarded values remain an interface check. Exact values override any contradictory heuristic sign. For genuinely earlier disagreements, report D10/D12 concordance, score gaps and phase; a fixed small odd/farther-depth audit would be appropriate before fitting a new cardinal or root-sensitive objective. Do not escalate only attractive candidate corrections and then call that a representative teacher audit. A second engine can expose shared bias, but disagreement still needs adjudication.

## The preferred next experiment: frozen-player search-transfer screen

### Hypothesis and why no fitting comes first

**Hypothesis:** the existing independent supervision has already produced a useful searched player, and the earlier eligibility surrogate prevented us from observing that benefit. The primary measurable alternative is that at least one of frozen L/P earns more than .5 expected game points against B at 80 ms on prospectively sampled paired openings. Transfer at 300 ms is a separately reported durability check. A practical screening effect is five percentage points; this is a chosen planning threshold, not an inferred equivalence to 5% logistic loss.

This is one experiment with B, L and P fixed, not an architecture search. It changes the measurement contract and independence policy prospectively; it does not change their scores, terminals, weights or search. The mathematical objective is $J_T$ above. **Training loss and new training targets: none.** Historical L/P supervision has the provenance already described; new teacher labels are diagnostic assessment only. A scientifically useful next experiment need not contain optimization. Refitting now would make it impossible to determine whether the unplayed frozen candidates were already useful.

### Fixed controls, development and assessment

* Use original B and exact frozen L/P checksums from the publication: L `ecf3fd376c680ced77d0b002ea2efb9fa4385737c4fffff734b901ab2968d97f`; P `de4b84745589b0384ea3639f879e3c98990e802d176298ff8ef54f681520067f`. Import validated model artifacts, or reproduce them byte-for-byte from complete committed coefficients/metadata and verify checksums. Never regenerate them by fitting. A reconstruction mismatch blocks launch.
* Use 16 disclosed engineering roots, one per existing phase/policy/source-depth cell, and four separate engineering opening pairs solely to qualify runtime, serialization, zero controls and telemetry. No outcome-based candidate choice or parameter adjustment. These engineering results are historical afterward.
* Jointly reserve **128 assessment source trajectories**, eight per original 16 cells, balancing turn/parity; **32 additional exact ten-empty source trajectories** (16 per source policy); and **96 independent game-opening families**. Never use old unused game reservations as fresh data. Use the first 64 game families at 80 ms and the other 32 at 300 ms, for each candidate versus B, both colors: **384 scored games**. Share each budget's openings across L–B and P–B for paired descriptive contrasts, but do not call that a direct P–L match.
* Keep the established B1/12% and B4/2% source mixture and 12/13-occupied game starts, evenly balanced. This bounds generalization to that artificial opening population. The standard initial board, strong human openings and other opponents remain separate future questions.
* Freeze source IDs, role/family assignment, condition order, models, analysis and all stopping rules before any new scored outcome. No selection subset is needed because there is no new model selection before the screen. Screen results may nominate a *future* finalist; they cannot also confirm that selected finalist without appropriate adjustment or new data.

### Measure root transfer and failure mechanisms

At all 128 roots, obtain all-alternative qualified D10/D12 labels. Evaluate B/L/P at fixed depths **4, 5 and 6**, and in ordinary play mode at **80 and 300 ms**. Depth five is diagnostic for parity/horizon transfer. Compare deterministic full-window choices and ordinary production tie behavior explicitly; root-bound rows must not be mislabeled as complete alternative scores.

Report source-paired D12 choice regret, stable significant changes, disagreements, exact raw W/D/L loss and margin regret, by stratum and policy. On the separate 32 ten-empty roots, independently solve all alternatives under both conventions and compare the same fixed-depth choices; aggregate outcomes by source. Keep this enriched exact panel separate from the main phase-mixture mean. Raw exact game-point regret is $(w^*-w_{\rm chosen})/2$, in {0,.5,1}; do not combine it numerically with estimated Edax-disc regret.

For a fixed 32-source subset selected by IDs before labels, collect B/L/P best-two frontier witnesses and label their union. This adds the missing P-selected distribution. Report **bounded preference-error mass**, compatible nonterminal logistic loss, incompatible-pair mass, exact outcome errors and same-outcome margin regret separately. Pure rescaling diagnostics can be computed offline from saved margins; they may not nominate new players. Retain terminal-containing cases in decision metrics, including the cases a future fit would omit.

On that same subset, trace changed root choices to verified active leaves and opponent alternatives. Check whether the frontier improvement concerned an inactive sibling, whether the active branch changed, and whether a teacher-favored move lay outside the old best-two set. These are descriptive causal witnesses for particular searches, not attribution from immediate feature contributions. No post-hoc easy-case removal or extra label budget.

### Playing conditions and uncertainty

Run all games regardless of positional improvement; only integrity/resource failures stop them. No teacher/fitting workers run during timed play. Use unchanged production iterative deepening, max depth 14, terminal/pass semantics and ordinary tie/deadline behavior. Alternate first color and condition order, warm up equivalently, and record actual elapsed time, completed-depth distributions, node/evaluation counts and overruns. Keep per-leaf clocks out of scored games; measure evaluator cost separately. Replay results with independent rules.

For candidate $c$, opening-pair score $X_{ic}\in[0,1]$ is the average of its two color-swapped game points. The unit is the **family/opening pair**, not individual moves or games. Report all W/D/L and pair scores. For root diagnostics use stratified whole-source resampling; for games resample complete opening families jointly across candidate contrasts, 10,000 times, with a tested nondegenerate RNG. If there are ancestor clusters spanning proposed families, merge them before declaring sample size; inability to reserve the fixed number of independent families is a prelaunch failure.

Primary exploratory superiority tests are L–B and P–B at 80 ms; two one-sided tests receive alpha .025 each. Report approximate studentized paired-mean intervals and bootstrap sensitivity, clearly labeled approximate. Also provide the assumption-light one-sided Hoeffding bounds

$$
 \mu_c\ge\bar X_c-\sqrt{\log(1/.025)/(2n)}.
$$

At 64 pairs this radius is .16976. The simultaneous rigorous lower-bound claim therefore requires a very large observed gain; broad uncertainty is honest. All 300-ms, root, phase and P–L indirect contrasts are descriptive, not further unadjusted superiority claims. If approximate and conservative evidence disagree, report both rather than select the favorable interval. A future confirmation can use a prespecified, coverage-checked pair-level method and adequate size instead of inheriting an unnecessarily conservative bound by habit.

There is deliberately **no 5% positional gate** and no point-mean root noninferiority gate. For choosing whether to invest in later confirmation, nominate a candidate only if its 80-ms mean is ≥.55 and its 300-ms mean is ≥.50; if both qualify, select the larger 80-ms mean, tie favoring L's simpler runtime. This is a development decision, not a strength claim. Negative or uncertain root/exact results must accompany that nomination and determine what must be checked next; they cannot silently disappear behind favorable games. Any integrity violation blocks independent claims. Production remains B even if a screen interval clears .5.

### Power, stopping and decisions

This small screen can detect a large advantage or gross failure and expose which transfer mechanism deserves work. **It cannot reliably settle a two-to-five-point strength difference.** With pair SD at its worst-case .5, an approximate alpha .025, 80%-power calculation for a .05 gain needs about **786 pairs per candidate at one control**, not 64. SD .25 would need roughly 197; neither variance is established here. Use independent engineering/pilot variance or a conservative bound for a later power calculation, not a favorable sample prefix to extend the current screen.

| Completed screen outcome | Interpretation and next decision |
| --- | --- |
| One candidate has favorable paired games at both budgets and favorable root transfer | Existing supervision may already suffice. Seek separately powered fresh game confirmation before any retraining. P remains subject to its cost. |
| L favorable, P worse or loses completed depth | Prefer the existing linear candidate for confirmation; patterns have not earned their cost. |
| P favorable, L not | Existing geometry has a credible practical lead; confirm frozen P directly against B. This does not prove P beat an unrestricted seven-feature optimum. |
| Frontier gains persist but searched regret and games are clearly adverse | Falsifies the optimistic existing-transfer hypothesis on this population. Do not collect more of the same sibling data. Test objective placement/calibration next. |
| Fixed-depth gains but timed games adverse | Prioritize evaluator/tree cost and deadline/depth mechanisms, not another teacher corpus. |
| Games favorable but teacher regret adverse | Challenges the teacher-surrogate link or opponent specificity. Investigate before using that teacher metric as a selection gate. |
| All intervals broad and no practical nomination | Inconclusive. Stop at the fixed sample. Neither increase data nor declare objective failure automatically. A later choice is a powered frozen-player test versus a targeted objective experiment. |

Stop dispatch on source/model mismatch, invalid labels, incomplete required exact solves or resource pressure; retain receipts and report incomplete evidence. Do not turn timeouts into solved labels, shrink the sample after results, or swap finalists. No optional positive-result stopping. A future staged game test may use a predeclared confidence sequence or alpha-spending rule over complete pairs, with futility rules and a maximum sample; ordinary repeated 95% intervals are invalid for that use. A standard independent-game SPRT cannot be applied unchanged to correlated paired openings.

### Bounded computation on the M4

The [measured Mac benchmark](MAC_PC_BENCHMARK.md) gives six-worker D10/D12 rates of **45,650/36,243 complete root tasks per hour**, about **2.39×/2.46×** the PC's fully repeated two-worker configuration. These are cold matched engineering tasks, not forecasts for arbitrary new sources. One D10+D12 pair of root queries at those rates costs about .178 aggregate wall seconds per admitted parent in a saturated pool. For 128 roots plus up to 192 frontier parents (32 sources × three selectors × two parents), that suggests approximately **57 seconds** of labeling alone. Exact checks, source rejection, reconstruction, startup, receipts and tails are additional; budget several times that proxy and qualify actual task costs.

The root fixed-depth B benchmark is 117,524 D4+D6 tasks/hour at six workers; learned trees and depth five differ. Timed root probes alone nominally cost 128×3×(.08+.30)=145.92 seconds serial. Fits/hour is irrelevant: **there is no fit**. In a later optimizer, independent-root throughput can help each batch, but updates remain sequential.

| Stage | Raw planning allowance |
| --- | ---: |
| Imported identity/index audit, resource check, engineering runtime checks | 8 min |
| Source admission, root/frontier reconstruction, all teacher and exact diagnostics, summaries | 12 min |
| 384 scored games | 51.03 min |
| Subtotal | 71.03 min |
| Subtotal with 35% allowance | 95.89 min |
| Separate final audit/report reserve | 15 min |
| Proposed active ceiling | **120 min** |

The game allowance is `2 candidates × [64 pairs ×104 placements×.08 s +32 pairs ×104×.30 s]`. Starting at occupied 12/13 leaves at most 52 placements per game. Pass calls, process/serialization overhead and deadline overshoot are not covered by that placement expression; the measured engineering cost and 35% allowance must cover them. Games remain serial and do not get divided by six.

This is a conditional feasible design, not authorization or a measured end-to-end forecast. Before any scored outcome require `1.35 × qualified remaining raw cost +15 reporting minutes ≤ remaining ceiling`, with phase-tail costs and actual admitted worker pool. Import/setup engineering effort is separately reported, not hidden as a scientific throughput gain. If the complete sample fails this check, stop before assessment and propose a revised protocol later; do not trim targets opportunistically. The historical exclusion package is a prerequisite, presently unavailable locally.

Use up to six independent non-timed workers only with fresh memory/workload admission, monitor swap and actual occupancy, and drain before games. Budget provisionally 2 GiB for compact receipts and 4 GiB working memory, verify actual use, and retain the existing headroom reserve; these are planning allocations, not peak measurements. Do not duplicate the historical index unnecessarily across workers. Desktop responsiveness was deferred by the user; no new hardware benchmark is needed. Nothing here claims current Intel-Mac or WSL runtime was re-tested during this review.

## If a new fit becomes necessary: the smallest discriminating comparison

The immediate recommendation remains the frozen-player screen. If it finds a real frontier-to-root failure, the next **learning** hypothesis should be that cross-parent value/decision alignment, rather than more examples of the same siblings, is limiting performance.

The clean first comparison would keep the 21-weight architecture and data sources fixed, with B/L/P frozen as external controls. Use one immediate compatible-target fit and one depth-four backed-up fit, identical parameter boxes and a single predeclared trust/scale rule, on at most 256 training sources and 128 separate development sources. Obtain root labels and independently labeled leaves from the same source roots; do not paste root values onto arbitrary leaves. Match total teacher-label and optimization compute budgets and report unequal effective information honestly. Select only on development searched regret; reserve fresh assessment and paired games before fitting. Do not reuse this screen's outcomes as confirmation.

For a true objective-placement comparison, use the same root teacher preferences in the two arms: static immediate-child score differences versus full depth-four backed-up differences, with the compatible-pair target contract applied to both. That directly tests static distillation versus search-aware fitting; it does **not** isolate frontier sampling, which needs its own control. Alternatively, test sibling ranking versus independently calibrated value regression on identical labeled states if the screen's witnesses show correct local ordering but wrong cross-parent levels. Do not combine those contrasts into one supposedly causal experiment.

Neither a neural model nor 10,000 new pattern coefficients is needed to make this distinction. If the backed-up objective improves training but not fresh depth-six/timed choices, abandon its proposed transfer advantage. If both small fits fail even on training decisions, inspect attainable feature differences, turn dependence and target inconsistency before increasing data. If training fits but development does not, address coverage/regularization and teacher bias. This is a conditional design outline, not a second campaign to launch with the screen.

## Strongest arguments against this recommendation

**The proposed screen is underpowered for modest gains.** That is the strongest objection. Its purpose is to observe the previously missing outcome and detect a large transfer success/failure, not to settle a small advantage. A user willing to spend substantially more time could reasonably choose powered games on frozen candidates immediately. I prefer a small screen because the sign of their actual playing effect is wholly unmeasured and earlier families sometimes failed badly.

**Neither model was trained under a fully coherent terminal objective.** Correct. Yet the offending assessment source cannot have corrupted their training retrospectively, and the models demonstrate nonterminal decision changes. Without unavailable training receipts we cannot establish how much similar constraints influenced their fitted coefficients. A new objective fit first might improve them, but would forfeit the clean test of what already exists.

**A root-aware learner could be more informative than more games.** It could test a mechanistic hypothesis, but the existing root intervals are too broad to establish a transfer defect, and root fitting itself has unresolved target/proof-scale issues. The screen includes fixed-depth, timed-root and active-leaf diagnostics specifically to select a subsequent mechanism instead of treating game score alone as an explanation.

**The new independence policy is less strict.** It is, explicitly and prospectively, for incidental internal/terminal overlap. Its claim concerns new source trajectories under frozen models and a fixed oracle, rather than universal state novelty. It must not be used to rehabilitate old results. The direct-state inventory requirement and honest cluster analysis are essential; if that provenance cannot be supplied, this screen cannot claim the planned independence.

**A win against B might be specialization.** Paired openings control color and some opening variance, not all opponents. Later confirmation should add a fixed independent opponent or a broader opening population as a separately budgeted external-validity check. No B-only screen proves universal strength.

## Unanswered questions requiring new evidence

* Do frozen L or P win more points than B at equal elapsed time, and does the answer change between 80 and 300 ms?
* How many historical **training** pairs cross incompatible score/proof categories, and how much do they alter fitted coefficients? Assessment loss decomposition cannot answer this; raw PC training receipts are needed.
* Are the root differences genuinely small, or merely imprecisely measured? Current intervals include meaningful benefit and harm.
* On P-selected branches, are the extra table terms still accurate, and which informative coordinates have enough independent-source support?
* Would cross-position value calibration outperform root-preference fitting with the same architecture, labels and compute?
* How much performance is lost to board-only turn symmetry, fixed phases, active L bounds, or omitted geometry? These mechanisms are not separately identified by the present experiments.
* Which of the 18 historical collision identities were actual learning targets versus terminal/oracle-only states? Compact collision counts do not supply the full learning provenance.
* Does stronger or independently different supervision agree on early root decisions where the candidates differ? D10/D12 stability is not sufficient proof.
* Would faster search with frozen B buy more game points than any evaluator improvement at the actual application budgets?

No production evaluator/search semantics, frozen result, fit or completed outcome was changed. The review's substantive recommendation is to test existing learned play under a new, honest contract before paying for another learning campaign.

## Reproduction and checks

```bash
npm test
node scripts/review-learning-strategy.mjs > /tmp/astra-learning-strategy-diagnostics.json
cmp docs/data/astra-learning-strategy-diagnostics-20261029.json /tmp/astra-learning-strategy-diagnostics.json
git diff --check
```

The JavaScript correctness suite passed **132/132 before and after** this work. The diagnostic reproduced byte-for-byte, every local report link resolved, the original request ledger remained an identical byte prefix, and `git diff --check` passed. Python launcher tests were not repeated for this documentation/read-only-analysis change. The diagnostic uses the existing independently tested solver; it is not a new solver or statistical confirmation. No browser behavior changed, and no new browser/platform acceptance or hardware benchmark is claimed. Commit/push identity and status are reported in the completion response.
