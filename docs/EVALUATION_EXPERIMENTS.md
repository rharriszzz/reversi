# Evaluation quality, speed, and playing strength

This extends the completed [initial review](INITIAL_CODEX_REVIEW.md), rather than restarting it. Original evaluation features and weights remain the browser defaults and reference. The latest user request is appended verbatim to `USER_REQUESTS.md`; `CODEX_PROMPT.md` now records this priority.

## Implemented this round

- Split playing search from comprehensive coaching. Both use the original inspectable negamax/alpha-beta core. Playing carries alpha between root moves and omits immediate feature breakdowns and verified variations for every candidate. Coaching retains full-window, equal-depth values and verified lines for all moves. Browser computer play, self-play mutation, and TD trajectories now use the playing path.
- Count recursive nodes and actual heuristic evaluator calls separately. Coaching additionally reports immediate-breakdown calls. Neither node counts nor evaluation counts are elapsed time.
- Add optional iterative deepening with a per-move elapsed-time budget to playing search. Return only the last completed iteration; count incomplete work in the totals. Clear TT bounds between horizons and use the previous root move for ordering. A budget that cannot finish depth 1 returns a legal, explicitly unsearched depth-0 fallback with null score. Browser depth controls remain fixed-depth, and coaching never mixes horizons.
- Implement and test two inexpensive positional candidates individually: conservative corner-anchored stable edges, and smooth interpolation of the existing phase weights. No combined model, parity feature, neural network, or additional play-time dependency was introduced.
- Run fixed-depth, equal-time, independent solved-endgame, and modest weight-selection experiments. Neither candidate nor learned weights met a standard for replacing defaults.

## Reproduce the measurements

Run serially on an otherwise idle machine:

```bash
node scripts/evaluation-benchmark.mjs > /tmp/reversi-costs.json
node scripts/evaluation-experiments.mjs fixed 32 > /tmp/reversi-strength-depth.json
node scripts/evaluation-experiments.mjs solved 32 > /tmp/reversi-solved-quality.json
node scripts/evaluation-experiments.mjs learning 32 > /tmp/reversi-strength-learning.json
node scripts/evaluation-experiments.mjs timed 6 > /tmp/reversi-strength-timed.json
```

Measured environment: WSL2 Ubuntu 22.04.5, Intel Core i7-14700F, kernel `6.18.33.2-microsoft-standard-WSL2`, Node `v24.16.0`. These are local measurements, not Mac performance claims. The timed tournament took 106.5 seconds; fixed-depth games took 18.6 seconds; weight selection/holdout took 10.5 seconds. JSON includes board positions, parameter versions, raw per-game/per-move statistics and actual elapsed time, and stays outside Git. Original weights remain versioned in `src/features.js`.

## Protocol and parameters

| Purpose | Seed / sample |
|---|---|
| Cost/depth positions | Seeds 113, 271, 811; positions after 8, 28, 52 random placements (nine positions) |
| Training openings | 14659013; 16 eight-placement openings |
| Development selection | 14659117; 16 opening pairs |
| Fixed-depth/selected-weight holdout | 14659991; 32 opening pairs / 64 games per comparison |
| Timed holdout | 14661007; six opening pairs / 12 games per comparison |
| Independently solved holdout | 14664007; 32 six-empty positions generated using that RNG |
| Mutation proposals | 546031, 546037, 546041 |
| Tactical diagnostic fixtures | Seeds 730000 and 730003, deliberately selected examples |

Opening sets reject duplicates and symmetry-equivalent positions and exclude the previous round's disclosed pilot openings. Training and development positions are disjoint from the fixed-depth holdout. The measured fixed-depth and timed holdouts were also checked to be disjoint. All candidate feature definitions, constants and learning-selection rules were frozen before inspecting holdout results. Fixed-depth and selected-weight comparisons share the same holdout opening set for a common reference; no selection uses that holdout. These results are now disclosed development evidence, so future tuning requires newly reserved seeds.

Both colors start from the same position in each pair. Game order alternates between pairs. Fixed-depth comparisons use depth 3 for both engines, including the random/greedy comparisons where only the baseline searches. Reference random play samples a legal move with seed `9173 + opening index`; greedy play maximizes immediate flips, breaking ties by square index. These are deliberately weak references, not expert engines.

Intervals below are conservative 95% Hoeffding bounds on **opening-pair mean points**, with draws worth half a point. Color games are not treated as independent samples. Bounds are exploratory, assume representative sampled openings, and are not simultaneous multiple-comparison guarantees. Small samples, random-opening distributions and wall-clock variability limit strength claims.

### Candidate definitions

The original evaluator includes legal and potential mobility, corners, X/C exposure beside empty corners, frontier discs, and disc advantage, using its unchanged three phase vectors. This already represents a positional player rather than a disc-counting player.

**Stable edges:** Find uninterrupted same-colored edge runs from occupied corners, exclude the corners already scored, and deduplicate overlapping runs. Only this conservative subset is called stable. Feature = `(own anchored noncorner edge discs - opponent's) / 24`; pilot weight = 60 in every phase, or 2.5 points per net disc. Independently enumerating every continuation of three six-empty test positions verifies that claimed stable discs never flip. The feature ignores other potentially stable discs; it does not attempt full-board stability.

**Smooth phases:** Linearly interpolate the *unchanged* opening/middle/endgame vectors at 4/40/64 occupied squares. The original has discrete boundaries at 28 and 52 occupied squares. Interpolation removes those discontinuities but also changes how early disc advantage matters; smoothness alone is not evidence of accuracy. Anchors and edge weight are hypotheses, not fitted constants. Tests cover anchors, continuity, antisymmetry and all board symmetries. Candidates are not combined in this round.

## Static cost and playing-search overhead

Five samples of 6,000 evaluator calls per phase, after warmup, with timing order rotated between samples; table entries are median microseconds per call. Each phase uses three seeded positions. Static evaluation includes extraction, phase selection and weighted summation. Feature extraction alone includes its legal-move generation. These are whole-call costs, not a marginal feature timing claim.

| Random placements | Feature extraction only | Original static evaluation | Stable edges | Smooth phases |
|---:|---:|---:|---:|---:|
| 8 (opening) | 5.951 | 6.288 | 6.440 | 6.748 |
| 28 (middle) | 4.671 | 5.130 | 5.240 | 5.470 |
| 52 (late) | 2.243 | 2.640 | 2.845 | 2.984 |

Feature extraction dominates. Stable edges add about 2–8% and smooth phases about 7–13% to the measured static call cost, depending on phase. Small differences are noisy. The pilot smooth implementation explicitly builds blended weights for inspectability; caching/interpolating without that object is a possible small optimization if smooth evaluation later proves useful.

Depth-5 search on seed **271** illustrates why throughput, work count and elapsed time must be separate. Each time is the median of five externally timed calls. Nodes count recursive negamax visits; heuristic calls count actual search-leaf evaluations, excluding terminal scores and TT hits. Coaching also computes an immediate breakdown once per legal root move, reported separately in JSON. The former `bestMove()` was exactly the coaching path below.

| Placements | Evaluator / path | Nodes | Search evaluator calls | Elapsed ms | Nodes/s | Search evaluations/s |
|---:|---|---:|---:|---:|---:|---:|
| 8 | Original / old coaching-as-play | 9,844 | 7,082 | 98.343 | 100,099 | 72,013 |
| 8 | Original / playing | 5,555 | 4,093 | 55.148 | 100,728 | 74,218 |
| 8 | Stable edges / playing | 5,555 | 4,093 | 57.634 | 96,384 | 71,017 |
| 8 | Smooth / playing | 5,240 | 3,925 | 55.441 | 94,516 | 70,796 |
| 28 | Original / old coaching-as-play | 15,489 | 11,258 | 132.775 | 116,656 | 84,790 |
| 28 | Original / playing | 5,383 | 4,362 | 47.204 | 114,036 | 92,407 |
| 28 | Stable edges / playing | 5,360 | 4,354 | 48.777 | 109,887 | 89,263 |
| 28 | Smooth / playing | 5,697 | 4,632 | 52.466 | 108,584 | 88,285 |
| 52 | Original / old coaching-as-play | 552 | 242 | 1.739 | 317,362 | 139,133 |
| 52 | Original / playing | 303 | 147 | 0.943 | 321,444 | 155,948 |
| 52 | Stable edges / playing | 299 | 144 | 1.068 | 279,990 | 134,845 |
| 52 | Smooth / playing | 294 | 143 | 1.005 | 292,522 | 142,281 |

Across all nine positions at depth 5, separating playing reduced elapsed time by factors of **1.59–2.81×**. The benefit combines root alpha sharing, omitted variation verification, and omitted immediate breakdowns; it is not attributed to variation work alone. Middlegame nodes/s actually falls slightly while elapsed time improves 2.81×: far less work matters more than that rate alone. Candidate evaluation also changes move ordering/cutoffs through search values, so differing node totals are not a direct measure of feature cost. At equal depth the original evaluator's optimal backed-up value is unchanged; tied move selection may differ.

### Completed depth under fixed elapsed budgets

Three runs per position/budget/evaluator (nine samples per phase and evaluator). Table entries are median completed depths; parentheses give observed ranges across all three evaluators. This is actual deadline search including iterative-deepening and interrupted-iteration overhead, not a depth extrapolated from nodes/s.

| Placements | 5 ms | 20 ms | 80 ms |
|---:|---:|---:|---:|
| 8 | 3 (2–3) | 4 (3–4) | 5 (4–5) |
| 28 | 3 (3–3) | 4 (4–4) | 5 (5–5) |
| 52 | 7 (6–8) | 8 (8–8) | 8 (8–8) |

All evaluators had these same medians. At 52 placements there are eight empties; depth 8 solves the position, so search stops rather than spending the rest of an 80 ms allowance. Two baseline late-position runs completed depth 8 at 5 ms; candidates' late-position maximum was 7. The largest overrun in this position benchmark was 0.86 ms; actual-game overruns below were larger. These thresholds will vary with hardware and scheduling.

## Equal-depth playing performance

| Candidate vs opponent | W / D / L | Points rate | Conservative 95% interval |
|---|---:|---:|---:|
| Original evaluator vs random | 64 / 0 / 0 | 100% | 76.0–100% |
| Original evaluator vs immediate-disc greedy | 61 / 0 / 3 | 95.3% | 71.3–100% |
| Stable edges vs original | 33 / 2 / 29 | 53.1% | 29.1–77.1% |
| Smooth phases vs original | 30 / 3 / 31 | 49.2% | 25.2–73.2% |

Each row uses 32 opening pairs / 64 games. The baseline is mildly competent relative to these simple references. This does not establish expert strength or that it can beat the user. The two evaluator candidates do not show convincing superiority. Same-depth optimal playing choices match coaching scores on the regression set, allowing tied moves; fast search may choose a different tied move than the old square-index tie rule.

## Independently solved positions and tactical evidence

The 32-position holdout uses a separate 10×10 sentinel-board move generator and exhaustive terminal solver, not production rules/search. The metric is actual final-disc regret relative to the best legal move; search win/loss sentinels are decoded before calculating disc regret. Every position has six empty squares. A depth-3 search still uses heuristics on some branches, so this measures horizon behavior rather than simply re-solving the position.

| Evaluator | Depth | Exact-optimal choices / 32 | Mean final-disc regret | Available win turned into loss |
|---|---:|---:|---:|---:|
| Original | 1 | 14 | 4.625 | 3 |
| Stable edges | 1 | 14 | 4.000 | 2 |
| Smooth phases | 1 | 14 | 4.500 | 3 |
| Original | 3 | 20 | 2.938 | 1 |
| Stable edges | 3 | 20 | 3.000 | 1 |
| Smooth phases | 3 | 20 | 3.125 | 1 |

Deeper search improves this sample more consistently than either extra feature. Stable edges help one shallow metric but slightly worsen deeper regret. These are small descriptive samples, not a general accuracy claim or a feature-selection test set to reuse indefinitely.

`tests/fixtures/positional.json` contains two deliberately selected diagnostic examples, with all legal-move scores independently recomputed by tests:

- **Greedy corner concession, seed 730003:** Black's immediate-flip greedy G1 allows White H1 and loses by 16 under exact play; G5 wins by 8. The original depth-1 evaluator already chooses G5. Positional evaluation is doing useful work here.
- **Stable-edge horizon correction, seed 730000:** Black's original depth-1 A7 loses by 40 under exact play; the stable-edge candidate chooses A2, the best available move, losing by 30. This illustrates a feature benefit in a losing position, not a proof of generally stronger play.

## Equal elapsed computation budgets

Playing uses iterative deepening at 5/20/80 ms per move, capped at depth 14. Only completed depths determine choices. Both sides get the same wall-clock limit. Actual nodes and evaluator calls can differ because feature costs, ordering, cutoffs, and board states differ. Runs are serial; machine load and OS scheduling can still change completed depths and outcomes. Repeating a seed cannot make a wall-clock experiment bit-for-bit deterministic.

| Candidate vs original | Budget / move | W / D / L | Points rate | Conservative 95% interval |
|---|---:|---:|---:|---:|
| Stable edges | 5 ms | 7 / 0 / 5 | 58.3% | 2.9–100% |
| Smooth phases | 5 ms | 5 / 0 / 7 | 41.7% | 0–97.1% |
| Stable edges | 20 ms | 10 / 0 / 2 | 83.3% | 27.9–100% |
| Smooth phases | 20 ms | 6 / 0 / 6 | 50.0% | 0–100% |
| Stable edges | 80 ms | 7 / 2 / 3 | 66.7% | 11.2–100% |
| Smooth phases | 80 ms | 7 / 0 / 5 | 58.3% | 2.9–100% |

Only six opening pairs / 12 games per condition: **even 10 wins in 12 games here is insufficient evidence to change defaults**. Across actual game moves, median completed depths were 3/4/5 at 5/20/80 ms for both sides in every condition. This hides distributions; JSON records every move. No unsearched fallbacks occurred. Deadlines are soft: the largest observed tournament overrun was 4.28 ms on a nominal 5 ms move; allocation, a single node, and scheduling can overrun a deadline. Match scripts record actual time, not just requested budgets. More repetitions and finer overrun statistics are needed for stronger equal-time conclusions.

## Modest weight learning

Three seeded mutations and three TD(0) rates were evaluated only on the 16-pair development set, at depth 2. TD trained on 16 separate baseline-policy depth-1 trajectories, two epochs, rates 0.01/0.03/0.1. Original target/update rules remain unchanged; no large learning framework was added. Mutation and TD training costs differ, so this is not an equal-training-cost algorithm comparison.

| Candidate | Development points rate (32 games) |
|---|---:|
| Mutation 546031 | 56.25% |
| Mutation 546037 | 62.50% |
| Mutation 546041 | 59.38% |
| TD rate 0.01 | 54.69% |
| TD rate 0.03 | 51.56% |
| TD rate 0.1 | 53.13% |

The predefined rule selects the highest development rate, breaking ties by proposal order. Only that frozen candidate sees the 32-pair depth-3 holdout. Selected mutation 546037 changes middle discs −8→−14.9, endgame mobility 12→15.2, and endgame frontier 0→4.3. It scores **32 wins, 1 draw, 31 losses: 50.8%, interval 26.8–74.8%**. Its apparent development advantage does not carry convincingly to holdout. The JSON saves weights, seed, parameter version and TD metadata. No learned parameter file is committed or installed in the browser.

## Verification

**36 named JavaScript tests in nine files and four Python tests pass**, including playing/coaching agreement, independent candidate minimax, solved endgames, deterministic deadline interruption/fallback, evaluator-call counters, stability, interpolation and tactical fixtures. Commands:

```bash
node --test tests/*.test.mjs
node --test --test-isolation=none tests/*.test.mjs
python3 -m unittest discover -s tests -p 'test_*.py'
git diff --check
```

Full Chromium `153.0.8010.12` browser acceptance passed after changing the playing worker. Actual Windows 11 Home `10.0.26300` / Chrome `155.0.8059.40` loaded WSL2 localhost, verified coaching, played D3 and received the playing-worker reply; PowerShell default-browser launch also returned success. Browser commands are documented in [VALIDATION.md](VALIDATION.md). Mac hardware was unavailable: Apple Silicon and Intel remain untested physically. Runtime still requires only Python 3 and a modern browser; the new game/evaluation code has no OS-specific dependency.

## What to try next

Keep the faster playing search and existing positional defaults. Reserve fresh seeds before any tuning. Use a small development-only grid for the stable-edge weight (for example 15/30/60), choose by independent solved-position regret plus a few paired development games, then freeze one candidate for a larger paired **20 ms** test. A 64-pair holdout, with actual-time/overrun and completed-depth distributions, is a useful next bounded experiment; predeclare a wall-time cap and report an incomplete run honestly if reached. The exposed 83.3% pilot is motivation to test, not evidence to reuse as a fresh holdout.

Smooth phases need better anchors or calibration before combination with stable edges. Empty-region parity remains a subsequent isolated experiment. Remaining questions include expert-opening coverage, strength at longer budgets, timing variability across machines, better supervised late-game targets, and Mac hardware validation. No disappointing result here justifies adding more complex AI.
