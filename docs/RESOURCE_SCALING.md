# CPU and memory scaling, 28 October 2026

**Six workers are the measured throughput/memory compromise when headroom permits; four are appropriate with the most recent roughly 4.3 GiB Windows headroom.** Eight were fastest in these independent workloads, but cost more memory and total CPU. A configuration with only two evolving models cannot use six simultaneous fits of those same models: each batch depends on the previous weights. The recommendation therefore means up to six generation tasks, up to four label partitions with the current label budget, and two model fits. Timed tournaments always use one worker and terminate idle training workers first.

## Host checks and actual scope

The machine is an i7-14700F exposing 28 logical processors to WSL2. WSL had approximately 6.0–6.4 GiB available out of 7.6 GiB. Windows initially had only 2.6 GiB available out of 15.7 GiB; after the user closed applications it reached 5.8–6.0 GiB, enabling the scaling benchmark. After benchmark/model activity, a fresh screen-launch check reported 4.27 GiB Windows available, roughly 886 GiB free WSL disk, 0.18% aggregate WSL CPU busy and no active WSL swap traffic. About 89 MiB swap was occupied; nonzero occupancy alone is not evidence of current thrashing.

Read-only Windows CIM measurements include physical memory, CPU utilization, page reads/writes, largest processes, system-drive space and sleep settings. Linux checks include available memory, CPU activity, swap traffic, disk space and duplicate coordinator detection. No applications were closed by the code, no unrelated processes were terminated and no saved settings changed. Windows AC sleep is configured for 60 minutes; the already authorized temporary keep-awake request was smoke-tested and automatically released on completion.

The launcher reserves 1.5 GiB plus 0.6 GiB per configured worker, caps at eight, and reduces to one under higher background CPU load. With `--scaling-results`, it additionally caps at the smallest measured fitting count within 90% of the best throughput. This is deliberately conservative: each 320 MiB V8 heap limit is not a whole-process RSS limit. Measurements and thresholds are recorded in `preflight.json`; no permission to close applications is inferred.

## Sustained independent work

Three repetitions per count. Generation used 64 tasks of eight depth-three games, **512 games per repetition**, fixed seeds and B/stable behavior policies. Fits used 64 independent fresh long-pattern controls over the same 64-game corpus, up to 12 epochs each; every fit starts from the same initial weights. This is a scaling benchmark, not a learning-strength experiment. Timings include worker startup, message copying, results and atomic task writes.

| Workers | Generation seconds, median | Generation speedup | Fits seconds, median | Fit speedup | Peak process RSS, MiB |
|---|---:|---:|---:|---:|---:|
| 1 | 17.750 | 1.00× | 10.131 | 1.00× | 704 |
| 2 | 8.977 | 1.98× | 5.678 | 1.78× | 920 |
| 4 | 5.357 | 3.31× | 3.738 | 2.71× | 1,324 |
| 6 | 4.027 | 4.41× | 3.075 | 3.29× | 1,723 |
| 8 | 3.663 | 4.85× | 2.798 | 3.62× | 2,139 |

Six workers deliver approximately 91% of eight-worker fit throughput, with roughly 416 MiB less peak RSS. Eight improve generation by only another 10% over six, despite 33% more workers. Median fitting process-CPU utilization rises from about 1.16 to 5.89 and 7.67 logical-core equivalents at one, six and eight workers. Those numbers include V8/helper threads. P/E cores, hyperthreads, scheduling, startup and memory traffic prevent linear scaling. No affinity or power setting was altered, and no equivalence of logical processors is assumed.

The complete sustained sweep took **227 seconds**. The initial short sweep was useful for integration but overly sensitive to startup; it was followed by the longer fixed-work trials above. Six-worker fitting gradient arithmetic accounted for 6.66% of process CPU; pure optimizer arithmetic is not the whole fitting task. See [PERFORMANCE_PROFILING.md](PERFORMANCE_PROFILING.md).

The corrected label benchmark produced 320 nonempty reference labels per trial. Median times were 25.88 seconds at one worker, 17.02 at two (1.52×), and 11.06 at four (2.34×). Six/eight were skipped in this rerun because the fresh Windows available-memory check had fallen to 3.35 GiB. The 162-second sweep and all three repetitions appear in the final evidence. The initial sustained script accidentally created 48 empty partitions among 64 label tasks; those rows are excluded from the recommendation and were corrected before the dedicated label rerun. Their receipts are retained rather than silently replaced. Generation/fitting rows had all 64 nonempty tasks. Early correctness/smoke tasks briefly overlapped engineering benchmarks; these are development throughput measurements, not a controlled hardware publication. The timed playing screen begins only after those workloads exit.

## Serial work and useful concurrency

Previously, `generateBatch` awaited one worker, then `labelBatch` awaited one worker. Only fitting distinct models used the configured worker count. Generation and labeling now execute deterministic partitions concurrently and admit results in partition order, keeping canonical collision decisions on the coordinator. Configured partition identities remain stable when a resume uses a lower concurrency cap. Concurrent workers never mutate one model or write the shared manifest.

Historical-key reconstruction, admission checks, checkpoint serialization, selection decisions and reports remain serial. Workers still load/compile policy models for some tasks; the B/stable generation scaling numbers must not be extrapolated unchanged to a learned-policy mixture or much deeper teacher search. The new raw-encoding cache and future persistent compiled policies need separate end-to-end measurements. For two-model training, increasing workers alone cannot cure the serial coordinator/model-dependency limits.

```bash
python3 scripts/strong-launch.py --check-only \
  --output .local-research/next-resource-check
node scripts/next/benchmark.mjs .local-research/scaling-repeat --sustained
```

Use a new output directory for each benchmark; receipts are resumable, so reusing a completed directory is not a fresh timing run. See [NEXT_EVALUATOR_RESEARCH.md](NEXT_EVALUATOR_RESEARCH.md) for the bounded screen and prepared six-hour configuration. WSL2/Windows resource interrogation was actually exercised; macOS resource commands are implemented but current Mac hardware remains untested.
