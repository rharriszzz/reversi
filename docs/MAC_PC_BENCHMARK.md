# M4 iMac versus Alienware: useful Reversi work per hour

The portable suite has a published Windows 11 / WSL2 i7-14700F result. This follow-up runs on the native ARM64 M4 iMac and records its platform validation and matched measurements below. Production B, game/search code and historical research checkpoints are unchanged. This is an engineering benchmark, not a new learning campaign or playing-strength experiment.

## Run once on each computer

Open `rharriszzz/reversi` in Codex on each computer and ask: “Read AGENTS.md and docs/MAC_PC_BENCHMARK.md. Install missing native prerequisites, run the fixed full machine benchmark once in a fresh local directory, inspect correctness and resource results, and publish its compact result. Preserve the workload and all research checkpoints.” Codex handles installation and shell commands. Only the repository, pinned public Edax source/data and a small result file need to move between machines; no private corpus is needed.

Prerequisites are Python 3.9+, Git, make, a native C compiler and Node 20+ for these existing offline research tools. Playing remains Python + browser with no new dependency. Prefer the same Node release on both machines; this PC uses v24.16.0. On WSL Ubuntu, Codex can install missing system tools with `sudo apt-get install build-essential git python3`; install Node through the existing native installation/version manager. On macOS use native Terminal/Codex, `xcode-select --install` if Command Line Tools are absent, and a native Node installation (for example `brew install node@24` when Homebrew is already present). Apple's installation dialog may require the operator. Record such a blocker; do not substitute an emulated executable or claim successful Mac validation.

From a fresh checkout on the Mac:

```bash
git pull --ff-only
python3 - <<'PY'
import json, sys
sys.path.insert(0, 'scripts/machine-benchmark')
from run import source_identity
from compare import source_compatibility
print(source_compatibility(json.load(open('docs/data/mac-pc-pc.json'))['source'], source_identity()))
PY
caffeinate -i -s python3 scripts/machine-benchmark/run.py --setup \
  --output .local-research/mac-benchmark
```

On a fresh PC installation, omit the macOS `caffeinate -i -s` prefix and use output `.local-research/pc-benchmark`. The Mac prefix holds a temporary system-awake assertion only while the command runs. `--setup` builds into the separate `.local-research/machine-benchmark-teacher` directory and refuses an existing installation. When that benchmark teacher already exists, omit `--setup`. Every measurement run requires a fresh output directory; existing results are never overwritten or counted as new trials. Failed/partial receipts stay local. The exclusive `.local-research/machine-benchmark.lock` prevents simultaneous benchmarks; after a crash, Codex must establish that its recorded PID has exited before removing the stale lock.

The commands print progress and write `result.json` after each complete cell. Use the same Git source/workload on both machines, AC power and normal power settings. Leave the shell open and prevent sleep for the run; record any changed power conditions. The run uses low scheduling priority and changes no saved setting. Three repetitions and all worker counts are fixed in advance. An elapsed envelope stops new worker-count blocks after 40 minutes without shortening any scientific task; task deadlines are engineering failure limits, not search budgets.

Only the compact JSON needs to be brought back:

```bash
cp .local-research/mac-benchmark/result.json docs/data/mac-pc-mac.json
python3 scripts/machine-benchmark/compare.py \
  docs/data/mac-pc-pc.json docs/data/mac-pc-mac.json \
  --output docs/data/mac-pc-comparison.json \
  --report docs/MAC_PC_BENCHMARK.md
```

Codex should inspect the raw correctness/resource receipts, add the Mac compiler/build/version details and operator responsiveness observation to this report, run the regression tests, then commit/push the two compact results and comparison. The comparison command refuses changed numerical source, fixtures, workload, scoring, teacher patch/data, smoke results and unsuccessful correctness gates. It records a narrow, explicit exception for the reviewed Darwin allocation header, installation script, comparison script and its tests; all other source files must remain identical to the published PC inventory. Only counts with all three repetitions qualify for comparison. Keep raw task/model/transcript/sample files under `.local-research/`.

## Frozen work and correctness

Source: [`suite.mjs`](../scripts/machine-benchmark/suite.mjs), [`worker.mjs`](../scripts/machine-benchmark/worker.mjs), [`run.py`](../scripts/machine-benchmark/run.py), [`setup.py`](../scripts/machine-benchmark/setup.py), [`compare.py`](../scripts/machine-benchmark/compare.py), [`workload.json`](../scripts/machine-benchmark/workload.json), [`positions.json`](../scripts/machine-benchmark/positions.json). The approximately 47 KB fixture contains complete boards, seeds, turns, all expected numerical outputs and the engineering linear coefficients. It is deliberately public engineering data and must be excluded from future research holdouts. Consult [the previous teacher repair](EDAX_BOUND_RESOLUTION.md), [resource scaling](RESOURCE_SCALING.md), [profiling](PERFORMANCE_PROFILING.md), [exact solver](EXACT_SOLVER_OPTIMIZATION.md) and [latest research outcome](NEXT_RESIDUAL_RESULTS.md) for context; their old timings are not substituted for this benchmark.

The four seeded random legal trajectories are `74102901`–`74102904`. Each supplies occupied counts 16, 30, 44 and 52 (16 teacher/B roots), and ten- and twelve-empty endings (eight exact roots). No position is selected for favorable speed. Random-policy fixtures span phases but are not a representative sample of expert play or unusually difficult endings. The all-alternative teacher scores are approximate fixed-horizon heuristic values unless the position is fully solved. Search depth counts placements; passes retain depth. Raw occupied-disc margin and winner-awarded unplayed empties are separate exact targets. B retains its original terminal sentinel and seven features/three phases.

Before timing, **on each actual host**, the runner verifies:

- Pinned source/patch/binary/evaluation identity and native Node architecture; macOS rejects a detected Rosetta process.
- Existing adapter preflight: 35 fixtures plus seven extrema/pass/terminal cases, the early-terminal leaf, ±63 horizon saturation, disclosed repaired D12 values `[-63,-61,-63,-63]`, and coordinate/color transforms.
- All 32 D10/D12 root queries against frozen all-alternative values; all B D4/D6 results, node/evaluation counts, and independent mailbox D3 minimax values.
- Eight ten/twelve-empty roots, both exact conventions, against the straightforward independent mailbox oracle and native Edax's awarded values.
- Complete converged linear and pattern fits against frozen coefficients, losses and optimizer iteration counts.

Every timed task checks its output again. Integer teacher/exact values and B results must agree exactly. JSON's single zero representation normalizes JavaScript signed zero, which has the same game value. Fitting permits at most `1e-7` absolute coefficient/loss difference with identical iteration counts: every accepted difference, actual/expected hash and maximum difference is recorded; exact-hash disagreement is never silently called identical. Larger or structurally changed results stop the run. The suite does not prove the patched teacher's strategic accuracy or formally verify all Edax internals.

| Work category | Tasks per trial | Complete useful task |
| --- | ---: | --- |
| Edax D10 | 128 | One all-alternative root query; each child full-window D9, no book/selectivity, one native search thread |
| Edax D12 | 128 | Same procedure, each child full-window D11 |
| B alpha-beta | 256 | One root searched at both four and six placements with unchanged production B |
| Exact | 128 | Every legal alternative, both raw/awarded conventions, fixed independent solver/TT |
| Linear fitting | 128 | Encode fixed engineering preferences, converge 21 corrections from zero at λ=0/bound ±100, pack/write model |
| Pattern fitting | 128 | Encode same preferences, freeze engineering L, converge 10,932 corner6/edge8 coefficients from zero at λ=1e-5/bound ±25, pack/write model |

Indices cycle over all roots identically. Fits use the 591 unequal D12 sibling preferences from 15 informative original roots; the remaining all-tied root is retained with zero informative mass. Exactly 16 disclosed engineering replicas produce 9,456 optimization rows to exercise encoding/fitting. These duplicates provide **no additional independent evidence**. Fits always restart from zero; they never train or revise a historical checkpoint. This remains a small working set and cannot rank the computers for multi-gigabyte corpus parsing, cache capacity, large-pattern training or dependent model-update chains.

Three matched trials use worker counts 1, 2, 4, 6 and, on this Intel PC, 8 where memory permits. Worker-count and category order rotate by repetition to reduce monotonic thermal/time drift. Tasks, seeds, search depths, table sizes, starting weights, fitting criteria and task order stay fixed; no machine calibrates its own scientific workload or trades depth for a deadline. Engineering probes precede timed trials and only estimate memory. Compiler instruction selection may differ by architecture; numerical source and expected values may not.

## Measurement and resource accounting

Each useful task runs in a fresh native Node subprocess. Elapsed timing includes pool orchestration, imports, input reads, feature/pattern encoding, optimizer work, native startup and evaluation loading, full model/receipt packing, JSON serialization, fsync/rename/directory fsync and sampled telemetry. This measures independent **cold processes**, with OS file caches warmed by correctness/probe work; a persistent warmed worker or batched production fitter may amortize startup differently. Tiny pure evaluation loops and Edax's rounded internal timer are not the benchmark. Build, preflight, memory probes and baseline responsiveness are separately reported, with total run elapsed time.

POSIX `wait4` records actual task user/system CPU and maximum RSS, including accounted reaped descendants. Summed task CPU divided by trial elapsed is consumed CPU-core equivalents, not a count of P cores. Native CPU is also recorded separately. Coordinator/probe CPU is not included in summed scientific task CPU; its overhead is included in elapsed time. Per-task max RSS is an OS peak; simultaneous process-tree RSS is a one-second sampled peak, which can miss short-lived peaks and includes the sampler/probe. Summing each task's separate RSS peak would exaggerate simultaneous memory. File cache/Windows WSL allocation are not fully represented by process RSS.

Actual active tasks are measured by task lifetimes, including startup/I/O/waiting, with mean slot occupancy; they are not assumed to equal the configured pool. One-second process samples independently record active tasks and actual native teacher PIDs. Very short tasks can be missed by those samples. Tasks/hour always names the useful unit in the table; fits are independent replicates, not simultaneous updates of the same evolving model. Three-trial medians, ranges, standard deviations and CVs are recorded. Observed ranges are not confidence intervals for general hardware superiority.

Memory admission reserves 1.5 GiB plus 1.35 times measured task/native RSS per worker, using the limiting Windows/WSL physical headroom. Unsafe counts are skipped with the actual readings/reason. Linux/macOS swap counters, available-memory estimates, swap occupancy, load, Windows memory/CPU/hard-page reads at worker-block admission, and sampled process-tree RSS are retained. Sustained measured swap activity above 256 pages/second or less than 768 MiB available local memory stops queued work and invalidates that trial. Windows hard-page reads also include file-backed faults; they are not proof of paging to the swap file. Windows pressure between admission samples is a measurement limitation. macOS free+inactive+speculative memory is a conservative approximation, not a complete memory-pressure model.

Responsiveness uses a three-second baseline and one-second samples of Python launch latency (p50/p95/max), a scheduling/startup proxy. It does not measure Windows or macOS UI latency. Operator observations must be supplied separately; missing observations are labeled unmeasured. During the Mac run the user explicitly deferred desktop performance to a later round. Today’s recommendation therefore uses correctness, useful throughput and memory/swap safety; GUI responsiveness is deferred, not a pending question or a claim of acceptance. No program closes applications, terminates unrelated processes, changes CPU affinity, power plan or saved sleep settings. Normal background applications introduce noise and the two operating systems schedule hybrid cores differently.

## Recorded identities and PC measurements

The [compact PC result](data/mac-pc-pc.json) is 111,447 bytes. The full run completed **2026-10-29 03:59:25–04:17:04 UTC**, **17.66 minutes**, with status `complete-with-skips`: 42 timing cells and 6,272 complete tasks. It finished below the approximate 20-minute target because memory admission skipped eight worker-count blocks. Nothing was added just to fill time. Correctness took 34.94 seconds, the six memory probes 2.47 seconds, and the isolated compiler build 1.71 seconds (download/setup and regression testing are outside the timed run). All timed scientific tasks together used 1,620.82 user+system CPU seconds; 620.87 were separately accounted native teacher CPU seconds. These categories overlap and must not be added.

This is the actual i7-14700F WSL2 host, exposing 28 logical processors. Windows reported 15.73 GiB physical RAM; WSL had approximately 7.61 GiB configured. Runtime: Python **3.10.12**, native x64 Node **v24.16.0**, GCC **11.4.0** (`gcc (Ubuntu 11.4.0-1ubuntu1~22.04.3) 11.4.0`), Linux **6.18.33.2-microsoft-standard-WSL2**. The read-only initial power check reported Windows Balanced, AC idle sleep 60 minutes. No saved setting was changed. That original PC session could not measure the Mac; native Mac evidence is added below.

Actual commands used on this PC:

```bash
python3 scripts/machine-benchmark/setup.py
python3 scripts/machine-benchmark/run.py --smoke \
  --output .local-research/mac-pc-smoke-final
python3 scripts/machine-benchmark/run.py \
  --output .local-research/pc-benchmark-20261028
cp .local-research/pc-benchmark-20261028/result.json docs/data/mac-pc-pc.json
```

The directory date reflects the local start date; UTC timestamps above are authoritative. `revision` in the JSON records checkout parent `6229bfd9984ffd7cd6702eec09bd2cdc3359ab7d`, before these new files were committed. The source inventory below binds every actual benchmark/numerical/test file in that working tree; it reproduces from the published benchmark commit. Documentation/results are excluded from that source inventory so adding the Mac result does not change the scientific inputs.

The following pins are fixed:

| Item | Identity |
| --- | --- |
| Upstream Edax | `713a434f13b3d15fb69c61b9ba3641aed82c496c` |
| Public eval.dat source | `786421f355219ade872ce7285c1cab1eaf67836a:bin/data/eval.dat` |
| eval.dat SHA-256 | `f8b2299612d9fa4414157e70e932636e33111c2602d0c2fc382a7d90ef21b792` |
| Patch SHA-256 | `36555b54c837b39fcd60af0b91266d2b4db882ae16519678adee5f3db0a2ced9` |
| Patched numerical source-tree SHA-256 | `c6e78436cb62e4f44644f1230c093e06bed6ce0228ece4f3a81ac8e442a186d7` |
| Benchmark/importable source inventory SHA-256 | `3d091dc672c7244327123a60d87647007e97fdbe03056d046d33be9c1fb7306c` |
| PC benchmark binary SHA-256 | `6fc07058594226f8b256b9557a0f7a3255091b489bad611cb47f4fccf74e9c05` |
| Public fixture file SHA-256 | `dcf9c7ca7ecabc4f7ffbe5acd890415415e22f1d8cc37301e6ee0d32ce651f5f` |
| Workload file SHA-256 | `b16d071737df933eeed17870608eb14c65f3668e983aa5765fb812f0f28e8dfe` |
| Encoded replicated preference corpus SHA-256 | `9e88029825b6c5b2405b0ba109c2cd510820db72e09e1851c610e6dd50a3a3a5` |
| Production weights/features file SHA-256 | `f55ac4b6c6c6dd37948158569ade860de35d687244d673c89e605564d5525966` |
| Frozen engineering L model checksum | `ff27b95724a0a5ef3d88946f388d5d6056bd4c577032fcdbb96ea19153b5b843` |
| Linear numerical reference SHA-256 | `6bdf870c48785515cf8a9395dd3b365a0ef9d7cf0258de26cadde1a4332b1e95` |
| Pattern numerical reference SHA-256 | `aa145b8daa72a58756582dac22f962221cfbf19f812673cc36f51b95f7850042` |
| Published PC result SHA-256 | `f1a02153108373c70ba73bbdc7f8069dbd75400573e9e170a6b17a91b0913a25` |

The Mac build additionally force-includes `scripts/machine-benchmark/darwin-allocation.h`, discussed below. The isolated build retains upstream GPL source, license and notices and applies the existing separately licensed patch. No executable or eval.dat is committed. Linux uses GCC `-Ofast -flto` and `-march=x86-64-v3`; macOS uses native Apple Clang `-O3 -flto -ffast-math` and `-march=armv8-a` (NEON) on ARM64, x86-64-v3 on Intel. These are upstream optimized Makefile profiles. Different binary hashes and compiler versions are expected and recorded; numerical differences must pass the explicit checks. The M4 profile is portable ARMv8, not a claim that every M4-specific instruction is exploited.

The actual PC compiler command was `nice -n 10 make build ARCH=x86-64-v3 CC=gcc OS=linux -j1`, in the isolated patched `src` directory. Its exact expanded invocation/warnings remain in `.local-research/machine-benchmark-teacher/fixed/build.log`; upstream Makefile flags and the compiler/binary/source identities are in the compact result.

### PC complete-task results

Elapsed figures are medians and observed ranges; CPU is median summed task user+system CPU. RSS is the maximum **sampled simultaneous tree** RSS across the indicated trials, including coordinator/probe. Useful units are defined above. Four-worker rows have only one observation; their JSON `stdev`/`cv` zero placeholders do not estimate variability and they are excluded from repeated-trial recommendations and automatic comparison.

| Task | Workers | Trials | Elapsed seconds (range) | Useful tasks/hour | CPU seconds | Mean active tasks | Sampled RSS MiB |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Edax D10 | 1 | 3 | 48.57 (47.91–49.62) | 9,488 | 48.88 | 1.00 | 172 |
| Edax D10 | 2 | 3 | 24.12 (23.97–24.41) | 19,101 | 48.50 | 2.00 | 292 |
| Edax D10 | 4 | 1 | 12.89 | 35,736 | 51.17 | 3.94 | 552 |
| Edax D12 | 1 | 3 | 62.82 (61.79–63.71) | 7,336 | 63.07 | 1.00 | 170 |
| Edax D12 | 2 | 3 | 31.25 (30.97–31.50) | 14,745 | 62.83 | 2.00 | 319 |
| Edax D12 | 4 | 1 | 16.55 | 27,837 | 65.49 | 3.93 | 557 |
| B D4+D6 | 1 | 3 | 36.88 (36.57–37.88) | 24,991 | 43.26 | 1.00 | 116 |
| B D4+D6 | 2 | 3 | 17.91 (17.90–18.67) | 51,465 | 42.65 | 2.00 | 197 |
| B D4+D6 | 4 | 1 | 9.34 | 98,702 | 44.28 | 3.99 | 325 |
| Exact, both conventions | 1 | 3 | 12.73 (12.56–12.87) | 36,202 | 15.62 | 1.00 | 109 |
| Exact, both conventions | 2 | 3 | 6.24 (6.21–6.25) | 73,826 | 15.45 | 1.98 | 188 |
| Exact, both conventions | 4 | 1 | 3.21 | 143,427 | 16.00 | 3.96 | 298 |
| Linear fit | 1 | 3 | 31.21 (30.65–31.62) | 14,765 | 34.54 | 1.00 | 115 |
| Linear fit | 2 | 3 | 15.06 (15.00–15.07) | 30,608 | 33.56 | 2.00 | 206 |
| Linear fit | 4 | 1 | 7.83 | 58,887 | 34.62 | 3.95 | 352 |
| Pattern fit | 1 | 3 | 18.77 (18.57–19.30) | 24,551 | 25.82 | 1.00 | 121 |
| Pattern fit | 2 | 3 | 9.31 (9.31–9.33) | 49,480 | 25.68 | 2.00 | 212 |
| Pattern fit | 4 | 1 | 5.18 | 88,890 | 28.49 | 3.99 | 394 |

Across categories with three trials, elapsed CVs were **0.16%–2.44%**. Median matched two/one-worker speedups were D10 **1.99×**, D12 **2.02×**, B **2.04×**, exact **2.04×**, linear **2.07×**, pattern **2.01×**. Small superlinear effects are observed timings with cache/JIT/scheduler noise, not evidence that two physical cores inherently perform more than twice the work. The one four-worker block suggests further throughput, but cannot establish its repeatability or sustained safe headroom.

All integer/search references and every fitted coefficient/loss/iteration matched the frozen references exactly: **zero tolerated fitting difference was used**. Source inventory matched again at completion. Mean task occupancy was approximately 1.00, 1.98–2.00 and 3.93–3.99 for configured counts 1, 2 and 4; slot occupancy ranged **98.29%–99.98%**. Actual teacher PID samples, native CPU and task lifetimes are retained separately; configured slots are not counted as proof of active native searches.

The maximum OS task RSS was **104.98 MiB**; maximum sampled simultaneous tree RSS was **557 MiB**. Windows available physical RAM at admissions ranged **1.96–2.73 GiB**, limiting the much larger WSL free-memory readings. Conservative per-worker allowance was **198.34 MiB**; four/six/eight workers required **2.27/2.66/3.05 GiB**, respectively, including the 1.5 GiB reserve. Four failed admission in repetitions 0 and 1, then passed in repetition 2. Six and eight failed all three admissions. Skip receipts preserve each exact reading/reason; no missing trial was imputed or replaced.

WSL swap occupied **88.64 MiB** before and after, with **zero observed swap-in/out pages** across all timed cells. The baseline scheduler/startup probe p50/p95 was **8.42/9.51 ms**; the largest per-cell p95 was **12.91 ms**. This is a modest proxy change under load, not a claim about desktop usability. **Operator Windows GUI responsiveness was not reported and remains unmeasured.** Windows hard-page read/CPU samples are in the JSON; they cannot independently establish whether background applications paged. No large-corpus memory-pressure test was performed.

Reproduce correctness tests with:

```bash
npm test
REVERSI_NATIVE_TEST=1 REVERSI_BOUND_TEST=1 node --test \
  tests/teacher-bound.test.mjs tests/teacher-qualification.test.mjs tests/exact-solver.test.mjs
python3 -m unittest discover -s tests -p 'test_*.py'
```

Final verification passed **132 JavaScript tests, 28 explicit native/exact tests and 33 Python tests**, plus the full per-host benchmark preflight. The original pre-change fast JavaScript run passed 129 tests. The result comparator passed a self-identity check over the 12 eligible repeated cells; that check is not a Mac measurement. Published JSON matches the original result byte for byte, all bound source files reproduce, and the prior user-request ledger prefix is intact.

The first final Python suite failed its source-freeze resume guard because this PC result was copied into `docs/data` while the suite was still running. The unchanged full suite then passed with source/data held fixed; no existing checkpoint or production code was repaired or relaxed. Existing detached-launch tests still print nonfatal subprocess `ResourceWarning`s. These test-only temporary runs are unrelated to a new research campaign. Native Mac and browser/GUI acceptance were not exercised.

For a short installation/integration check only, use `--smoke` with a separate output directory. Its reduced work is explicitly incompatible with full benchmark comparisons. Do not run tests or edit numerical/benchmark source during final timings; source hashes are verified again on completion.

## Native macOS portability validation

The first native Apple Clang build compiled but failed before searching: Darwin rejected `aligned_alloc(32, (size + HASH_N_WAY + 1) * sizeof(Hash))` with EINVAL. C17 requires a size divisible by alignment; the pinned upstream caller violates that requirement and glibc tolerates it. The separate build-only header includes stdlib first, checks overflow, and rounds allocated bytes up to the next alignment multiple. It changes neither logical table entries, table masks, indexing nor search/evaluation source. Upstream source, existing teacher patch and evaluation-data hashes remain identical to the PC. The extra header and its hash are explicitly bound in the Mac build metadata and source inventory. No previous teacher installation or checkpoint was modified.

The comparison exception permits only this header, setup.py, compare.py and its Python tests to differ from the exact published PC inventory; it checks inventory digests, every other file, and changed-file hashes against this checkout. The comparison JSON records both inventories and every changed path. This is an explicit portability exception, not byte-identical complete build inputs. Scientific task runner, native-resource accounting, JS search/solver/training, workload and fixtures remain unchanged. Every timed numerical result still must match its frozen reference.

Mac regression testing initially exposed `/var` versus `/private/var` temporary-path aliases in historical launcher tests. `TMPDIR=/private/tmp` resolves those without production changes. Localhost integration tests require execution outside the Codex sandbox. With both conditions met, all 34 Python tests passed; their historical detached-launch tests still emit nonfatal subprocess ResourceWarnings. The initial smoke attempt overlapping regression tests correctly refused another active test research coordinator. The failed unaligned build and refused/failed smoke outputs remain local and are excluded from performance results.

Mac environment: macOS 27.0.1, Apple M4, ten logical CPUs, native ARM64 Node v24.22.1, Python 3.13.18, Apple Clang 21.0.0 (`clang-2100.3.34.2`). Rosetta detection returned zero. The PC used Node v24.16.0 and Python 3.10.12; runtime patch versions, OS, compiler, storage/fsync and background workloads differ. Results compare these actual supported systems, not isolated CPU architecture. Apple Clang emitted one upstream pthread start-function cast warning; the native validation gates passed, but this is not a formal audit of all upstream threading code.

Mac build command (run in the isolated patched `src` directory):

```bash
nice -n 10 make build ARCH=armv8-a CC=clang OS=osx -j1 \
  "DFLAGS=-include /Users/rharris/git/reversi/scripts/machine-benchmark/darwin-allocation.h"
```

The fixed-source inventory includes the additional header and build/comparison code; their source files are published with this report. The native executable is Mach-O 64-bit ARM64, SHA-256 `643b4a39dea9d85f3a862c37510c90e70188f0b7f02b37bde693841746c8f1c2`. Header SHA-256: `3351a3d1a9c0f8d82ae7daeb6d1a6979d701a93ec8b41ef00a7752c4703dc81c`. The upstream source-tree, existing patch, fixture, encoded corpus, production weights and engineering model/reference hashes above apply unchanged. Mac benchmark source inventory SHA-256: `0e47c715e07cbca94f8c5725f103d51064b38bc49dc2324b9ea02989ddd44754`.

The initial saved AC power configuration reported system sleep disabled, low power mode disabled and display sleep after ten minutes. A temporary `caffeinate -i -s` assertion covered only the benchmark command; no saved power settings changed. Approximately 607 GiB disk space was available. Actual Mac commands:

```bash
python3 scripts/machine-benchmark/setup.py .local-research/machine-benchmark-teacher-mac-aligned
TMPDIR=/private/tmp python3 -m unittest discover -s tests -p 'test_*.py'
npm test
caffeinate -i -s python3 scripts/machine-benchmark/run.py \
  --installation .local-research/machine-benchmark-teacher-mac-aligned \
  --smoke --output .local-research/mac-benchmark-smoke-aligned-2
caffeinate -i -s python3 scripts/machine-benchmark/run.py \
  --installation .local-research/machine-benchmark-teacher-mac-aligned \
  --output .local-research/mac-benchmark-20261029
```

Tests ended before the full timed run. Raw receipts and telemetry remain in the ignored local directories. No private research corpus was downloaded, no prior research model was accessed or revised, and no learning campaign was launched. Fits are disposable engineering controls.

## Mac complete-task measurements

The [compact Mac result](data/mac-pc-mac.json) completed **2026-10-29 05:35:06–05:54:23 UTC**, **19.28 minutes**, status `complete`. All **72 cells / 10,752 tasks** completed at 1, 2, 4 and 6 workers, three trials each, with no skips. The fixed workload finished just below the approximate 20-minute target; no extra tasks were added. Correctness took 30.26 seconds; isolated compilation took 2.71 seconds and the six one-task probes took 2.28 seconds. Setup/downloads, smoke and regression checks are outside the full-run elapsed time.

All integer/search outputs and every fitted coefficient, loss and iteration matched exactly; maximum fitting difference was **zero** throughout. The end-of-run source inventory matched the start. Total timed-task user+system CPU was **2,754.97 seconds**, including **984.03 separately recorded native teacher CPU seconds**; these overlap and must not be added. Per-task user/system splits and per-cell native PID samples are in the JSON. Differences in process startup/accounting mean these CPU totals alone do not rank efficiency.

| Task | Workers | Elapsed seconds (range) | Useful tasks/hour | CPU seconds | Mean active tasks | Sampled RSS MiB |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| edax10 | 1 | 42.26 (42.24–43.47) | 10,903 | 41.60 | 1.00 | 194 |
| edax10 | 2 | 22.17 (21.48–22.26) | 20,780 | 42.37 | 2.00 | 331 |
| edax10 | 4 | 12.26 (12.11–12.50) | 37,593 | 47.61 | 3.94 | 629 |
| edax10 | 6 | 10.09 (9.92–10.22) | 45,650 | 57.89 | 5.82 | 899 |
| edax12 | 1 | 54.44 (54.43–55.80) | 8,465 | 53.79 | 1.00 | 181 |
| edax12 | 2 | 28.36 (27.64–28.69) | 16,251 | 54.63 | 2.00 | 331 |
| edax12 | 4 | 15.81 (15.55–16.12) | 29,143 | 61.50 | 3.94 | 630 |
| edax12 | 6 | 12.71 (12.60–12.98) | 36,243 | 73.84 | 5.83 | 929 |
| B | 1 | 30.34 (30.22–30.89) | 30,373 | 35.36 | 1.00 | 118 |
| B | 2 | 16.00 (15.67–16.06) | 57,602 | 37.04 | 2.00 | 198 |
| B | 4 | 9.56 (8.87–9.62) | 96,384 | 46.73 | 3.98 | 364 |
| B | 6 | 7.84 (7.77–8.12) | 117,524 | 55.60 | 5.96 | 516 |
| exact | 1 | 11.19 (11.17–11.48) | 41,192 | 13.60 | 1.00 | 115 |
| exact | 2 | 5.97 (5.84–5.98) | 77,143 | 14.21 | 1.99 | 199 |
| exact | 4 | 3.51 (3.26–3.54) | 131,389 | 17.61 | 3.97 | 351 |
| exact | 6 | 2.93 (2.87–2.93) | 157,294 | 20.80 | 5.88 | 444 |
| linear | 1 | 25.66 (25.65–25.94) | 17,957 | 28.15 | 1.00 | 124 |
| linear | 2 | 13.22 (13.02–13.70) | 34,863 | 28.99 | 2.00 | 216 |
| linear | 4 | 7.97 (7.57–8.02) | 57,833 | 36.15 | 3.96 | 398 |
| linear | 6 | 6.60 (6.54–6.74) | 69,839 | 43.09 | 5.91 | 584 |
| pattern | 1 | 15.92 (15.92–16.30) | 28,949 | 22.24 | 1.00 | 134 |
| pattern | 2 | 8.68 (8.60–8.76) | 53,066 | 23.66 | 2.00 | 238 |
| pattern | 4 | 5.15 (4.97–5.20) | 89,546 | 28.87 | 3.95 | 441 |
| pattern | 6 | 4.34 (4.33–4.42) | 106,184 | 33.42 | 5.88 | 527 |

Elapsed CVs ranged **0.64%–4.45%**. Slot occupancy across cells was **96.79%–99.98%**; six-worker mean active-task occupancy ranged **5.81–5.97**. OS task peak RSS reached **118.06 MiB**, while sampled simultaneous tree RSS reached **929.25 MiB**. Available-memory estimates stayed above **6.11 GiB**. Admission used **180.50 MiB per worker**, including the 35% allowance, plus the 1.5-GiB reserve. Swap occupancy stayed at **0.25 MiB** with **zero observed swap-in/out pages**. These counters measure this run, not absence of past memory compression or future corpus pressure.

The Mac baseline Python startup/scheduling p50/p95 was **22.17/22.59 ms**; the largest loaded per-cell p95 was **70.21 ms**. The PC used a different Python build and OS, so raw startup latency is not an architecture-normalized desktop measure. **Desktop responsiveness was explicitly deferred by the user to a later round**. It is neither an acceptance claim nor a blocker for today’s throughput recommendation.

Mac result SHA-256: `c69b1ef1290ecf3e0d7d72b19247fd65b3160d5afc7d3e9ff75e3bcbb4ac083a`. The original PC result remains byte-identical. The [comparison JSON](data/mac-pc-comparison.json) binds both source inventories and lists the four reviewed portability-only file differences. Actual Mac revision was checkout parent `40a0cf2`, with the final changed source bound by the inventory above.

## Hardware decision

**Prefer the M4 iMac for the next campaign under the measured system conditions.** Use up to six independent labeling workers when a fresh memory preflight admits them. D10/D12 six-worker median throughput was **45,650/36,243 complete roots per hour**, versus the PC’s fully repeated two-worker **19,101/14,745**: **2.39×/2.46×**. The Mac’s single-worker medians were about **15% faster** for both teacher depths; the larger throughput gain reflects its admitted worker pool as well as task speed.

**Prefer the Mac for these linear/pattern fits**, with single-fit median elapsed speedups of **1.22×/1.18×** (ratio of host medians). The matched-repetition linear ratio is 1.20×, shown below; paired ratios and ratios of medians are different summaries. Six independent fit workers yielded **69,839/106,184 fits/hour**, **2.28×/2.15×** the PC’s repeated two-worker medians. Parallel independent candidate fits do not accelerate sequential updates of one evolving model. These tiny disclosed fits do not rank large private-corpus parsing or large-model training.

B searches and exact solving also favor the Mac at fully repeated admitted counts, about **2.28×/2.13×** the PC’s two-worker throughput. Use the Mac for a longer research campaign with this task mix, retain the existing 35% forecast allowance and reporting reserve, and check real corpus memory/complete-stage costs before a long run. No new campaign is authorized or started by this recommendation.

The PC had only one admitted four-worker block and no six/eight-worker blocks because Windows physical memory was limiting. **This is not evidence that an otherwise idle i7-14700F cannot outperform the M4 at higher concurrency.** A later PC run with more headroom could change the practical ranking. The comparison below includes only counts with all three repetitions on both hosts. The user deferred desktop performance; the comparator’s generic responsiveness caveat is retained for a later round. No macOS Intel execution or multi-hour thermal/corpus stress test was performed. Browser interaction was unchanged and was not manually retested in this benchmark round.

Reproduce publication and verification:

```bash
cp .local-research/mac-benchmark-20261029/result.json docs/data/mac-pc-mac.json
python3 scripts/machine-benchmark/compare.py docs/data/mac-pc-pc.json docs/data/mac-pc-mac.json \
  --output docs/data/mac-pc-comparison.json --report docs/MAC_PC_BENCHMARK.md
npm test
TMPDIR=/private/tmp python3 -m unittest discover -s tests -p 'test_*.py'
git diff --check
```

Final Mac regression checks passed **132 JavaScript and 34 Python tests**; the native benchmark preflight independently exercised the installed ARM64 teacher, 35 adapter fixtures, seven extrema/pass/terminal cases, all 32 depth/root references, 16 B roots, eight independent exact roots and both converged fits. Legacy native test opt-ins hardcode the old Linux teacher paths; they are not claimed as native Mac tests. The actual Mac native acceptance is the full preflight and each timed task’s reference check.

<!-- MACHINE COMPARISON -->


| Task | Workers | PC seconds | Mac seconds | Mac/PC useful throughput |
| --- | ---: | ---: | ---: | ---: |
| edax10 | 1 | 48.57 | 42.26 | 1.15× (1.10–1.17) |
| edax10 | 2 | 24.12 | 22.17 | 1.08× (1.08–1.14) |
| edax12 | 1 | 62.82 | 54.44 | 1.15× (1.11–1.17) |
| edax12 | 2 | 31.25 | 28.36 | 1.10× (1.08–1.14) |
| B | 1 | 36.88 | 30.34 | 1.22× (1.21–1.23) |
| B | 2 | 17.91 | 16.00 | 1.14× (1.12–1.16) |
| exact | 1 | 12.73 | 11.19 | 1.14× (1.09–1.15) |
| exact | 2 | 6.24 | 5.97 | 1.04× (1.04–1.07) |
| linear | 1 | 31.21 | 25.66 | 1.20× (1.19–1.23) |
| linear | 2 | 15.06 | 13.22 | 1.14× (1.10–1.15) |
| pattern | 1 | 18.77 | 15.92 | 1.18× (1.17–1.18) |
| pattern | 2 | 9.31 | 8.68 | 1.07× (1.07–1.08) |

Ratios are paired elapsed-time ratios for identical work, median and observed range over three trials.

Independent labeling measured point estimates: edax10: Mac at 6 workers (45650 tasks/hour); edax12: Mac at 6 workers (36243 tasks/hour).
Model fitting measured point estimates: linear: Mac at 6 workers (69839 tasks/hour); pattern: Mac at 6 workers (106184 tasks/hour).
Exact solving measured point estimates: exact: Mac at 6 workers (157294 tasks/hour).

For longer campaigns, choose using the measured cost of the planned labeling/solving/fitting mix and safe memory headroom. These fixtures do not establish full-corpus capacity or stronger play.

Three matched repetitions estimate run variability, not confidence in general hardware superiority. Best count must also have acceptable paging and operator responsiveness. Small cold fits do not model large-corpus memory pressure. Campaign choice depends on the fixed task mix; no synthetic aggregate CPU score.
