# Compact evaluator architectures

Production B is unchanged. `src/fast-features.js` additionally offers a caller-owned scratch-buffer path for offline learned linear models, verified against all seven original features and known-mobility reuse. The original engine, rules, feature breakdown and coach remain inspectable.

## Representations

| Family | Inputs | Runtime work |
|---|---|---|
| B | Original seven positional features/weights and original three boundaries | Existing fast evaluator; independent reference remains A |
| Learned linear | Same seven features, four phase buckets; six-phase ranking control | One fused scan into a reusable Float64 buffer; seven weighted terms |
| Short tuples | All contiguous straight 2-, 3-, 4-square lines on rows, columns and both diagonal directions, grouped into D4 template orbits | Occupancy scan; precomputed square lists; ternary indices and Float32 table sums |
| Corner/edge/diagonal | Corner 6 and 9, edge 8, edge-plus-X 10, diagonals 6/7/8 | Same typed lookup path; richer but sparser states |
| Hybrid | Seven features plus both independently investigated pattern sets | Fused feature scan plus all table sums; measured complete cost determines viability |

Each template shares one table across all eight board transforms. For a pattern of length k, its ternary index is `sum((board[square]+1)*3**j)`, in a specified ordered square list. Reversing colors maps index c to `3**k-1-c`. Evaluation uses the signed difference of these two entries, guaranteeing color antisymmetry. Summing every transform, including repeated geometries, guarantees D4 invariance; normalization is `1/sqrt(8*templateCount)`. Templates and offsets are explicitly serialized, not inferred from an undocumented model name.

The full-run phase rule is equal occupied-count buckets from **16 to 64**, clamped through the opening. Four-phase boundaries are 28/40/52; six-phase boundaries are 24/32/40/48/56. The calibration's original 4-to-64 layout left its entire first bucket untrained after prefix exclusion. That diagnostic exposed a systematic mistake; the corrected layout and a complete-game coverage regression precede the six-hour launch. Serialized models without `phaseStart` preserve the old layout for reproducible inspection. Four buckets are primary; linear/short preference models also test six. These hard boundaries are controls, not assumed superior to interpolation. Earliest randomized openings remain absent from fitting, so this is not an opening book.

At four phases the short family has 77 templates / 10,548 coordinates (about 0.08 MiB weights plus counts); the long family has seven / 381,996 (2.91 MiB); hybrid has 84 / 392,572 (3.00 MiB). Every template has eight runtime transforms. Compilation folds mirrored-color subtraction into one lookup per transform. Runtime Float32 lookup tables add memory separately from the trainable arrays.

## Training and compilation

Every primary family fits **margin**, **outcome** and **rank** separately. Margin targets are `100 * final Black margin / 64`; outcomes are `100 * sign(margin)`. Ranking models use a quarter-strength margin regression anchor plus logistic preferences with a ten-score temperature, derived from common-depth B searches and independent exact alternatives. Exact root regression adds valid disc-scale supervision. B heuristic values are not regressed as disc margins. Separate teacher bias and exact test performance remain visible.

SGD uses seeded order, normalized updates, L2 shrinkage, bounded weights, and a coverage prior: each pattern coordinate is multiplied by `count/(count+32)`. Counts concern new sampled observations, not optimizer repetitions or replay. Rare configurations therefore approach zero instead of acquiring large unsupported scores. The last task checkpoint advances training; the best same-objective development checkpoint remains separately archived. There is no comparison of raw outcome MSE with margin MSE as if they were one scale.

Runtime compilation folds sign-reversed entries, normalization and coverage shrinkage into Float32 lookup arrays once. Static evaluation performs no Map construction, feature-vector allocation, JSON decoding or model training. The linear scratch array belongs to a single synchronous evaluator closure. Model JSON stores an inspectable specification plus base64 little-endian Float32 weights and Uint32 counts; schema, lengths, endianness and finite weights are validated. Hashes/digests and immutable paths identify checkpoints. These are local research models, not browser exports.

An experimental Int16 compiler uses a 1/256 score unit and refuses overflow. It is tested against Float32 with the accumulated rounding bound; Float32 remains the playing representation until a measured speed benefit justifies quantization. Incremental pattern indices have square-to-pattern incidence lists and apply every placement/flip delta. Tests compare **all pattern indices after every move and undo against independent full recomputation**. Incremental indices are not wired into production search: changing that search interface is unwarranted without a measured end-to-end win.

Compiling the previous frozen linear/stable evaluator provides an identical-value representation control. It removes generic vector construction and deduplicates anchored edges in a reusable typed buffer. Tests require unchanged static values and fixed-depth minimax choices. It is a historical diagnostic, not a new finalist or production change.

A future distillation experiment could train a richer hybrid offline and fit short tables to its preferences while preserving an exact/endgame anchor. V2 already supplies compact compilation, but **does not claim a completed teacher-to-student distillation experiment**. Runtime neural inference and native search rewrites are unnecessary for this first study.
