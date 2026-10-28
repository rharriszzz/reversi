# Research performance measurements, 28 October 2026

The largest demonstrated avoidable framework cost was repeatedly embedding detailed learning histories in checkpoints. The implementation now writes full epoch histories once as immutable task/chunk files, retains at most 1,024 scalar fitting summaries in the manifest, and removes per-position ranking records from those summaries. Atomic rename, file fsync and directory fsync remain in place. The completed experiment and its models were never rewritten.

## Storage experiment

The original manifest contains 25,532 epoch records and 13,370 tasks. Three serialization trials used the same in-memory state; full atomic-write trials include fsync. The compact representation preserves paths to the original complete fitting receipts. It retains recent summaries for plots, while the complete history remains reconstructible from immutable receipts/chunks. The two experiments ran on the same WSL filesystem; warm-cache results are not a cold-disk guarantee.

| Operation | Original | Compact |
|---|---:|---:|
| Manifest bytes | 201,314,581 | 6,781,367 |
| Serialization, mean of three | 481.10 ms | 12.27 ms |
| Full atomic write, one trial | 656.08 ms | 23.10 ms |

This is **96.6% less frequently rewritten data**, approximately **39× faster serialization** and **28× faster atomic writing** in this fixture. It is not a measured 28× improvement to the whole campaign. The original parse took 922 ms and increased heap usage by about 304 MB. Smaller checkpoint footprints also reduce restart memory requirements. A full long campaign has not yet established its total saved hours or crash-recovery savings; no causal claim about the previous run's entire 103-minute fitting category is possible from these measurements alone.

Reports no longer write `results.json` twice on each refresh. Detailed history lives outside both manifest and results. Reports are generated at stage/checkpoint milestones rather than on every heartbeat; the 45-second heartbeat persists the compact state. Historical plots use retained summaries and must be labeled as sampled; complete details are in `historyChunks` and task receipts.

## CPU versus elapsed time

`Profiler` records separately named wall, thread CPU, and heap-delta spans. Node v24 here exposes `threadCpuUsage`; on older supported Node versions the fallback is explicitly labeled **process CPU**, which overlaps across simultaneous workers and must not be summed as independent thread CPU. Coordinator `process.cpuUsage` measures the complete process, including all workers, exactly once. Nested spans are inclusive and cannot be added indiscriminately. Very short CPU spans also show accounting/host-clock anomalies here (for example, summed read CPU can exceed summed read wall); `clockWarnings` now flags such spans rather than silently treating them as precise work attribution. Prefer repeated larger operations and aggregate process CPU when estimating budgets.

Machine-readable `worker-profiles.jsonl`/task profiles distinguish shard reads/parsing, model reading/unpacking, model compilation, encoding/counting, optimization, development prediction, packing, total task time, JSON conversion, writes, fsync, rename and directory fsync. Heap deltas can be negative after GC; they are **not allocation totals**. GC observers are supplemented by V8 sampling, since synchronous spans can finish before GC entries are delivered.

A separate approximately three-second CPU-profile workload generated 64 depth-two games, made 16 depth-five references, solved 16 eight-empty references and fitted a fresh long-pattern control. It deliberately uses fresh control weights, not retraining the frozen screen candidates. Sampled self time:

| Function | Sampled ms | Interpretation |
|---|---:|---|
| Fast feature scan | 1,025 | Mobility/frontier/potential/disc scanning; includes baseline generation and static-evaluation workload |
| Negamax body | 404 | Search/TT control, excluding sampled children |
| String position key | 218 | Board encoding for TT lookup |
| Move ordering | 104 | Sorting and priority work |
| Independent mailbox children | 80 | Separate rule/reference implementation |
| Garbage collector | 76 | Allocation has a measurable cost |
| Flip detection / move application | 54 / 54 | Separate sampled frames |
| Model compilation | 41 | Table construction, including development prediction |
| Sparse feature encoding | 22 | Training representation |

The workload deliberately includes 400,000 B static calls and short timed probes. Its distribution is **not** the whole campaign's time distribution. It nevertheless distinguishes scan/key/rules costs from optimizer arithmetic and identifies what the native prototype should target. Sampling and explicit instrumentation have overhead, so fair throughput trials run separately.

Explicit wall/CPU spans in that workload measured generation 467/437 ms, estimated labeling 801/762 ms, independent exact labeling 101/93 ms, encoding 50/46 ms, gradient updates 12/7 ms, and development prediction 46/35 ms. Reading/parsing its approximately 1 MB training shard took 4.05/3.78 ms. Its write fsync took 7.66 ms elapsed but 0.28 ms CPU: waiting for storage is not gradient work.

## Fitting efficiency and next bottlenecks

The sustained independent-fit benchmark used identical initial models, fixed seeds, 64 tasks per trial, 64 games per fit, up to 12 epochs, and three trials per worker count. At six workers, pure gradient updates accounted for **6.66% of total fitting-process CPU**, raw encoding/counting 21.46%, development prediction 17.30%, and shard reading/parsing 3.96%. These fractions concern that benchmark, not the old campaign. Remaining CPU includes model loading, final prediction, message copying, serialization, checkpoints and coordination. More workers increase completed work per hour but also increase total CPU spent for the same work.

A bounded worker-local raw-encoding cache has been added to reuse geometry between counting, replay and successive fitting batches. It reapplies current shrink counts on every encoding and retains no learned weights. Its acceptance test requires bit-identical trained weights, counts and loss with/without caching, including a second fit with changed observation counts. Six balanced trials of eight successive fits each measured median 761 ms without reuse versus 596 ms with reuse, about 22% less elapsed fitting time. Every trial required exactly matching final weights. This does not imply a 22% whole-campaign improvement, and cache hits alone are not evidence of an end-to-end gain.

The priority after checkpoint reduction is amortizing data/model encoding and compilation over larger useful fitting/labeling batches. The native prototype addresses search, legal moves, flips and pattern evaluation; see [LANGUAGE_COMPARISON.md](LANGUAGE_COMPARISON.md). Replacing string TT keys and incremental pattern indices remain candidates, not installed optimizations. The existing incremental-index correctness prototype alone does not demonstrate a search speedup.

## Logging and reproducibility

Human logs are plain UTF-8 lines suitable for Notepad++, with immediate stage/task/checkpoint/failure events and one heartbeat every 45 seconds. They identify the exact task and model, batch and epoch, accepted versus processed positions, new data since the last report, operation age, measured throughput, completed/remaining work where known, CPU core equivalents, RSS, available WSL memory, and last durable checkpoint. A fitting task explicitly says it expects no new training positions. Long-task warnings do not themselves kill fitting/generation; the declared overall experiment cap still applies.

ETA is unknown until completed comparable work exists. The bounded game screen uses empirical condition costs with 35% high-side allowance; a hard budget is reported as a cap, never a percentage-complete estimate. Open-ended learning cannot honestly have a fixed remaining-position count. Per-task detail and resource samples are written separately to JSONL. Telemetry need not be fsynced per line; scientific task receipts/checkpoints remain atomic and durable.

```bash
node scripts/strong/storage-benchmark.mjs \
  .local-research/strong-six-hour-20261027 .local-research/storage-repeat
mkdir -p .local-research/profile-repeat
node --cpu-prof --cpu-prof-dir=.local-research/profile-repeat \
  scripts/next/cpu-workload.mjs .local-research/profile-repeat
```

Actual WSL2 execution was measured. Current Intel/Apple Silicon macOS hardware was unavailable. Browser coaching, original rules, production B and search semantics remain unchanged.
