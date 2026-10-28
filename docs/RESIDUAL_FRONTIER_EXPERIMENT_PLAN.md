# Proposed B-preserving frontier experiment

V4R1 passed all qualification gates: [results](TEACHER_DEPTH_QUALIFICATION_V4.md). The next experiment should test **one 21-weight residual model**, supervised by independent Edax searches of actual B-search frontier decisions. This is a plan, not a launched training run. No weights, training labels or production evaluator were changed.

## Model and objective

Use `E_new(s,p) = B(s,p) + δ[phase(s)] · φ(s,p)`, initialized with all 21 corrections zero. Preserve B's seven existing normalized features: mobility, potential mobility, occupied corners, X-square exposure, C-square exposure, frontier discs and disc advantage. Preserve its exact phase rule: opening below 28 occupied, middle from 28 through 51, endgame from 52. Use each **child board's** phase when scoring a frontier child. Preserve terminal utility and pass handling.

Add no features, patterns, interpolation or minimax differentiation. Export a separate experimental weight file; never overwrite `DEFAULT_WEIGHTS` or change production defaults. Verify zero correction reproduces B's scores, full-window choices and terminal play.

For a supported preference between sibling frontier children x and y, from parent player p, fit

`w · log(1 + exp(-(E_new(x,p) - E_new(y,p))/10)) + λ ||δ||²`.

The fixed temperature 10 is in **B score units**, not an Edax-disc conversion. Predeclare three λ values `{0.0001, 0.001, 0.01}` and an absolute correction bound `|δ_i| ≤ 25` B weight units. Include unmodified B as the zero-correction control. Use deterministic projected gradient with backtracking on this fixed convex corpus; training-only feature moments may precondition updates but must map back to the same 21 original coefficients. Select λ once using development data, with ties favoring the smaller correction norm. Do not tune phase boundaries or temperature on holdout data.

## Independent data contract

Reserve complete, separate trajectory pools before labels: **1,600 training roots, 400 development roots, 400 locked holdout roots**, plus **256 fresh paired-game openings**. Exclude every previous research/engineering/qualification trajectory and its queried children under the existing canonical rules. Neither V4's calibration nor its assessment becomes training data. Keep the existing 12-occupied common-prefix boundary explicit.

Within each corpus, assign equal counts to the four occupied strata, the B1/12% and B4/2% source policies, and B search depths four and six **before outcomes**. That yields 100 training or 25 development/holdout roots per stratum/policy/depth cell. Record actual parent/child occupied counts, both turns and both occupied parities; audit coverage before querying the teacher. Distinct source trajectories, rather than many correlated leaves from a few games, determine effective sample sizes.

For each root:

1. Run B's full-window search at its assigned depth. Trace the best and second-best root alternatives through their actual minimax principal continuations, with deterministic row-major ties.
2. Retain each continuation's penultimate nonterminal parent, immediately above the deployment frontier. Deduplicate parents and children canonically, preserving source trajectory and continuation provenance. Early terminal lines are explicitly recorded; do not silently fill a quota with favorable substitutes.
3. Independently query **every legal alternative** at each retained parent using the qualified patched Edax **D10/D12** configuration. Its child values have common remaining depth and independent full windows. Handle positive-depth passes without consuming placements. Preserve the exact executable/evaluation/source identities and all parser rejection rules.
4. Form preferences only where the same ordering has a gap of at least two estimated discs at **both** horizons. Prioritize alternatives within two of best at either horizon, plus B's choice. Use weight `min(4, min(gap_D10, gap_D12))/4`, then normalize total weight per source trajectory. Keep unresolved preferences absent, rather than assigning guessed targets.

These are independently evaluated frontier siblings. Do not paste a root score onto a PV endpoint, use B-derived search labels as independent truth, or add weak self-play final outcomes. Terminal children retain fixed exact utility; keep solved W/D/L constraints and both terminal conventions separate from approximate disc rankings.

Also reserve a fixed 128-root subset of the holdout pool for independently labeled **root** alternatives. This checks transfer through a fresh six-placement search, beyond the particular frontier boards used to fit the model.

## Reviewable implementation sequence

1. Add an offline frontier collector with full-window continuation witnesses, pass/terminal records, canonical deduplication, source-level splits and immutable teacher receipts. Test continuations against independent rules; verify siblings use the same perspective and horizon.
2. Add a separate 21-coefficient preference fitter. Test analytical gradients against finite differences, zero-correction identity, phase assignment, serialization, color antisymmetry and training-only preprocessing. Reuse storage and telemetry from the research framework, not the existing mixed-outcome training objective.
3. Measure cost on a separately reserved 24-root engineering sample. Before opening holdouts, freeze the full target, λ grid, gates, model checksum and schedule. Require a conservative forecast with 35% allowance and a reporting reserve. Request a separate execution allowance for this experiment; do not assume qualification timings cover its larger corpus or games. If fixed targets cannot fit, stop before holdout labels or games.
4. Fit on training, select one candidate on development, freeze it, then evaluate the complete locked frontier holdout and 128 searched-root checks. Report source-weighted preference loss, teacher-relative regret and uncertainty by phase/policy/search depth. Predeclare a 5% relative held-out preference-loss improvement and no increase in mean D12-relative searched-root regret as the gate to games. These are proposed learning gates, distinct from V4 qualification.
5. Play the frozen candidate against B on all 256 fresh openings, both colors, at **80 ms and 300 ms per move**: 512 games per budget, 1,024 total. Use identical production search semantics and hardware conditions, with measured evaluation cost, nodes and completed depth. Add a fixed-depth diagnostic to separate evaluator quality from inference overhead.

For games, bootstrap whole paired openings with the corrected sampler, accounting for draws and both colors. Require simultaneous evidence of positive equal-time play at both budgets: one-sided 97.5% lower score bounds above 50% for each of the two budgets. Do not extend the sample after inspecting results. A neutral interval is inconclusive, rather than proof of no possible benefit.

The experiment may fail because these seven features cannot express the correction, independently supported rankings do not transfer through search, or the frontier distribution misses deployment states. Report those separately. Even successful games produce a reviewable candidate and evidence; production promotion requires a separate decision. The immediate recommendation is this one residual experiment, without an architecture tournament.
