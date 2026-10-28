# Offline training data and recovery

The completed v2 run contains **600,885 retained positions, 11,406 exact labels and 26,595 search labels**. See [the final audited report](STRONG_EVALUATOR_RESULTS_20261028.md) and `scripts/summarize-strong-research.py` for read-only publication/checking. The new publication's disclosed roots and references join historical exclusions; full local trajectories must also be excluded or retain their original roles in any authorized continuation. Never resume the completed run merely to inspect it.

V2 lives in `scripts/strong/`; raw artifacts belong under Git-ignored `.local-research/`. Ordinary Python/browser play gains no dependency. Node 20+ runs these optional developer experiments.

## Durable records

`manifest.json` holds configuration, frozen-source digest, sessions, active wall/CPU totals, category accounting, completed task paths, data/label roles, per-model streaming cursors, best model paths, learning history and comparison conditions. `data/generate-SPLIT-INDEX.json` stores admitted complete games. `tasks/` stores job evidence, including rejected generated games and timed pairs; `models/` stores immutable versioned weights. There is no destructive in-place dataset rewrite.

Every game contains seed, deterministic index, split, per-color policies, search depth, random-opening length, exploration probability, all moves including passes, terminal board, Black margin and W/D/L. Each sampled position contains its full board, side to move, placement count and canonical identity. Full move logs permit reconstruction of the omitted prefix. Behavior outcomes are not minimax truth. Positions before placement 16 (at least four beyond the randomized prefix) are never training examples. This also prevents shared initial prefixes from contaminating role separation.

States after the prefix are canonicalized under eight board symmetries and simultaneous color/side reversal. New trajectories are admitted in deterministic task order. If any retained state, reserved root or terminal identity conflicts with an earlier admitted role or historical exclusion, reject the entire trajectory. Exact duplicated positions within a trajectory do not inflate acceptance counts. Collision rejections and their task artifacts remain inspectable. Reserve selection/confirmation opening roots before training. Never regenerate disclosed seeds and call them fresh confirmation.

The historical loader reads published canonical keys and explicit boards in `docs/data/local-research-20261027.json`, the smoke and earlier comparison publications, and retained v1 trajectories where available. Its audit records missing local inputs. Earlier publications sometimes disclose `side:comma-separated-board` keys; these also need canonical conversion in the exclusion loader. Unpublished, unavailable historical trajectories remain a limitation. Current v2 sharded data are distinct from v1 and never imported as if unobserved final data.

Search references preserve board identity, trajectory ID, common depth, every legal move's score, an actual opponent reply and whether the child's result was solved. Scores in B units remain preferences, never disc-regression targets. Exact references preserve independent mailbox solver provenance, all move margins, root value, nodes and solve time; the production engine cross-checks the exact root. A failed/capped independent solve is a skipped reference, never an estimated exact label. Diagnostic continuation records include passes, final board and verified disc margin.

Label admission also checks every alternative child board against other roles. Those children enter the persistent exclusion index, even when they were not visited in the behavior game. Large teacher-measured candidate mistakes receive an additional search depth where affordable; these remain explicitly estimates. B's outcome/margin prediction metrics use separate zero-intercept gains fitted only on sampled training trajectories; calibration does not alter its search evaluator. Reports retain policy strata and boundary-neighborhood errors.

## Streaming and repeated computation

Games are generated in small eight-game shards. Each family/objective streams all newly admitted shards through bounded fitting windows, with a small deterministic sample of older replay shards. Observation counts accumulate new sampled positions once; replay does not manufacture extra independent observations. Counts regularize rare pattern states. Regression uses every second retained training state, development metrics every fourth, and game means give trajectories equal weight. Complete trajectories remain on disk even when a position is subsampled for a particular update.

Large datasets need not fit into a worker heap. A million accepted positions are feasible as many shards; memory includes the coordinator's canonical identity set plus a bounded per-worker fitting window, not all feature vectors. Models keep Float32 weights and Uint32 observation counts; encoded training vectors use Uint32 indices and Float32 values. Reports distinguish accumulated generated positions from positions actually fitted per model, optimizer epochs, replay and expensive references. Large data/model artifacts and caches must stay ignored by Git.

Interruption recovery reuses completed receipts and immutable task outputs. Signal handling finishes or abandons bounded work, then saves state. An abrupt reboot retries only a task whose durable admission/update was not committed. Saved cursors and atomic admission flags prevent counting the same completed fit or game shard twice. The independent exact set and final finalist remain fixed on resume. A completed run is read-only for purposes of research; longer training starts a new seed/output with `--continue-from`.

## Inspect and reproduce

```bash
less .local-research/strong-six-hour-20261027/report.md
python3 -m json.tool .local-research/strong-six-hour-20261027/results.json
node --test tests/strong.test.mjs
python3 -m unittest discover -s tests -p 'test_strong_runner.py'
```

The report and seven standalone SVGs update at bounded checkpoints. Timed measurements vary with host load. Deterministic generation, fixed-depth labels and fitting are reproducible from seeds, source, prior data and model artifacts; timing-based campaign sizing is machine-dependent.

Final tournament games preserve per-move completed depth, nodes, static calls, wall time, deadline overrun, fallback status, moves and canonical post-prefix identities. Whole pairs that collide with training/development/historical trajectories are rejected without examining their result; final pairs also exclude selection game trajectories. Save rejections and use predetermined backup roots. This defines a conditioned evaluation population and must be reported; it is not a claim about every possible opening.
