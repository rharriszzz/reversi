# Final PC qualification and M4 Mac handoff

The upgraded Ubuntu 26.04 PC is qualified for Reversi with Python 3.14.4 and
GCC 15.2. All active project workflows select Python 3.13+; this machine uses
3.14. Native B/L/P remain numerically unchanged. The original committed Wasm
passes actual Windows Chrome **and Edge**, including P coaching/play/review.
There is no remaining PC correctness blocker requiring another development
round. Return to the Mac for its own interpreter/build qualification and a
small, separately reviewed optimization experiment if authorized.

No frozen model was retrained, no strength tournament was started, and no
shared search algorithm changed. The custom-weight browser test includes only
its existing disposable UI training/export smoke. Ordinary applications,
profiles and Windows/WSL settings were left alone.

## Environment, Python and correctness

See [Ubuntu qualification](UBUNTU_2604_QUALIFICATION.md) and
[Python setup/selection](PYTHON_ENVIRONMENT.md). Actual environment:

- Ubuntu **26.04.1 LTS**, WSL **2.7.10.0**, kernel
  **6.18.33.2-microsoft-standard-WSL2**, Windows **10.0.26300.9711**.
- i7-14700F / 28 logical processors; 16 GiB installed Windows memory and
  7.61 GiB WSL-visible. Windows' physical topology and the VM's 14 virtual
  two-thread cores are distinct views.
- `/usr/bin/python3` is **3.14.4**. The active environment is
  `/home/rharris/git/reversi/.venv/bin/python`, prefix `.venv`, base `/usr`.
  The previous 3.10 browser venv was retired locally; its old path links to
  `.venv`. The installer snap's unrelated Python 3.10 process was not changed.
- GCC/G++/C++ **15.2.0-16ubuntu1**, Node **24.16.0**, npm **12.0.2**,
  Codex CLI **0.166.0**. No system Clang or Emscripten SDK is installed here.

`pyproject.toml` requires Python **>=3.13**, rather than pinning Mac users to a
particular minor version. Playwright **1.64.1**, WebSockets **15.0.1**, Matplotlib
**3.11.2** and NumPy **2.5.4** work on Python 3.14; the
[complete developer version snapshot](../requirements-dev-pc-20261030.txt)
and [interpreter/build certificate](data/ubuntu2604-qualification-20261030.json)
preserve reproducibility. `pip check`, Playwright driver startup, WebSocket
imports and a real Agg plot pass. No 3.13 fallback was needed.

Ubuntu lacked `ensurepip`; the environment was created with a user-scoped PyPA
virtualenv bootstrap. Nothing replaced the system Python. Shell launchers and
Node subprocesses choose `REVERSI_PYTHON`, active environment, repository `.venv`,
then supported `python3`. Python parents retain `sys.executable`; research
launchers propagate it through Node. SDK setup/builds explicitly set
`EMSDK_PYTHON` too. Direct Python commands require environment activation.
Historical scientific snapshots/certificates and the fixed completed-campaign
completion script remain provenance, not active workflows to resume.

Final correctness evidence:

| Check | Result |
| --- | --- |
| Complete Python 3.14 unittest suite | **39 passed**, no skips; 119.6 s at checkpoint 1, 123.1 s before checkpoint 2 |
| Complete Node suite | **171 passed**, no skips, including the final checkpoint 2 rerun |
| ASan + UBSan native regressions | **15 groups passed** |
| Host-target and POPCNT-only regressions | **15 groups passed each** |
| Broad native rules/features/search panel | 2,007 positions; 12,042 static queries; 96,720 children; 96 fixed searches; 12 independent endgames |
| Numerical discrepancy | **Zero** for B/L/P, absolute tolerance 1e-10 |
| Selected-Python + committed-Wasm final panel | **8 passed** |

Coverage includes independent rules/flips and exact endings, full-window all-move
values, verified PVs, forced passes, terminal empties, horizons 15/16/64, timed
iteration recovery, legal null-score fallback, TT windows/collisions/generations
and exact frozen cells/weights. Existing nonfatal ResourceWarnings remain
visible; no test was weakened to obtain a pass.

Two development issues were fixed: fresh parallel native builds now publish
complete files by atomic rename, with a real concurrent-build regression;
expected negative CLI diagnostics are captured and asserted. The repeated
`unrecognized arguments: --hours 16` was that negative test, not a failed research
launch. A separate browser cleanup race is described below.

## GCC 15 timing and generated instructions

This reuses the previous PC/M4 **eight disclosed roots and placement depths**:
7 below 28 occupied, 6 below 52, otherwise min(9, empties), at least one.
Seven serial repetitions each contain ten complete batches, after two warmups.
Build order rotates/reverses; B/P order alternates. No CPU profiler or correctness
suite runs concurrently. Static tests use 200,000 evaluations per root/trial.
Complete core elapsed/CPU times, IPC-inclusive block wall times, actual counts,
checksums, positions and receipts are in the
[benchmark evidence](data/pc-upgrade-benchmarks-20261030.json).

Time below is the sum of complete native search calls per eight-root batch,
excluding process startup/IPC. Static rate is the median per-root rate including
feature extraction/mobility; search and static measurements have separate scopes.

| Model / GCC 15 target | Median elapsed ms | Seven-block range ms | Median CPU ms | Million nodes/s | Million static evals/s |
| --- | ---: | ---: | ---: | ---: | ---: |
| B / portable | 10.621 | 10.080–10.956 | 10.621 | 14.00 | 23.71 |
| B / `-march=native` | 10.348 | 9.788–12.156 | 10.348 | 14.36 | 29.17 |
| B / `-mpopcnt` | 10.302 | 9.374–11.133 | 10.302 | 14.43 | 28.86 |
| P / portable | 14.489 | 13.839–15.233 | 14.490 | 11.70 | 19.79 |
| P / `-march=native` | 13.472 | 12.425–15.254 | 13.472 | 12.58 | 22.78 |
| P / `-mpopcnt` | 13.050 | 11.974–13.981 | 13.051 | 12.99 | 22.41 |

Every B batch visits **148,636 nodes / 90,353 evaluations**; P visits
**169,532 / 108,829**. All three builds have identical same-model scores, trees,
evaluation counts and static checksums. Different B/P trees do not measure
isolated evaluator cost.

Relative to GCC 15 portable, host targeting reduces median elapsed time
**2.6% B / 7.0% P**; POPCNT-only reduces it **3.0% / 9.9%**. Throughput gains are
2.6% / 7.6% and 3.1% / 11.0%, respectively. Overlapping trial ranges and desktop
scheduling limit small differences. The narrower flag is competitive here;
there is no evidence that additional host-specific instructions improve this
panel beyond POPCNT. **Portable remains the default.** Both options remain
explicit local builds, not architecture-independent binaries.

All use `-O3 -std=c++17 -ffp-contract=off -fno-fast-math`, plus warnings.
The portable compiler target is `x86-64`, generic tuning. Host targeting resolves
to **alderlake**, with AVX/AVX2 and BMI options among the enabled target features;
actual disassembly contains vector instructions. POPCNT-only retains generic
x86-64 tuning and emits no additional VEX/BMI examples found in the host build.
Disassembly finds **0 / 25 / 24 POPCNT instruction sites** and
**20 / 0 / 0 software-popcount call/thunk sites**, respectively. These are static
sites, not dynamic call counts. Complete flags/target options and examples are
published in [the results](data/pc-upgrade-results-20261030.json).

Per the user's follow-up, **no matched GCC 11 executable rerun was performed**.
The comparable historical seven-block GCC 11 portable medians were
**12.499 ms B / 15.933 ms P**; current medians use **15.0% / 9.1% less elapsed
time** on the same work. Historical host medians were 11.424 / 14.785 ms.
The old primary single-batch medians belong to a different timing aggregation.
Ubuntu/Python changes, warmup, background load, hybrid-core scheduling and WSL
conditions differ. This is an observed workload improvement, not an isolated
causal GCC-version speedup. Old results remain intact in the
[previous PC report](WINDOWS_PC_NATIVE_WASM_RESULTS.md).

## Profiles and interpretation

Locally extracted **perf 5.15.222** still works. Hardware cycles, instructions
and cache misses report unsupported; software `cpu-clock:u` sampling works.
Nine separate four-second, 999 Hz recordings cover opening D8, middle D7 and
exact 12-empty P search in all three builds. They retain **3,722–3,926 self
samples per recording, zero lost samples**. Separate frame-pointer/profile
binaries and exclusive instrumentation are diagnostic; production timings above
use uninstrumented binaries.

Portable GCC 15 self-sample shares:

| Component | Opening | Middle | Exact endgame |
| --- | ---: | ---: | ---: |
| Search / inlined TT / ordering | 37.5% | 28.7% | 56.0% |
| Legal generation | 19.3% | 21.9% | 19.5% |
| Flipping | 14.3% | 14.8% | 23.5% |
| Seven features / evaluator wrapper | 14.4% | 17.7% | ~0 |
| Patterns | 6.9% | 7.9% | ~0 |
| Software popcount and verified PLT thunk | 7.5% | 8.8% | .7% |

GCC 11 exposed ordering separately at roughly 11% / 10% / 4%; GCC 15 inlines
it into `negamax`. Comparing the larger search symbol alone would falsely imply
a new TT regression. Combined search/ordering and rules remain dominant.
Host targeting removes software popcount samples; its endgame is about
59% combined search and 41% separately visible rules. Patterns stay around
7–9% of nonterminal host samples and essentially zero in exact solving.

Exclusive instrumentation assigns TT **47.2% portable / 43.0% host / 58.5%
POPCNT-only** of the *instrumented endgame spans*. These are perturbed span
fractions, not whole-program self shares; they cannot establish a cache miss
problem or a reliable ranking between targets. Ordering has its own span even
when it is inlined in the software samples.

The [latest M4 baseline profiles](NATIVE_FINAL_OPTIMIZATIONS.md) also put exact
solving entirely in search and rules (approximately 48% combined search,
37% flips, 15% legal among its reported self samples), and patterns around
8–10% in nonterminal search. Older M4/PC profile attributions differ with panel,
inlining and sampling scope; one historical Mac sampling invocation also
overlapped tests. The common engineering conclusion is robust, but these are
not directly comparable cache/frequency measurements. No new dominant evaluator
bottleneck appeared under GCC 15.

## Windows Chrome, Edge, Wasm provenance and memory

Actual Windows **Chrome 156.0.8078.48** and **Edge 156.0.4314.42** report Win32
and Windows NT. Each passes **524 numerical comparisons**, maximum error zero:
208 static B/P queries, 94 full-window alternatives, 282 independently legal
PV placements with optimal reply values checked, and 30 deep exact alternatives.
Each also retains 32 MiB linear memory through twenty close/reinitialize cycles.
Twelve supplemental 30 ms timed searches agree with native fixed searches at
their completed depths; the original 12-empty P root solves in both browsers.

Both pass B/L/P selection/coaching, complete B/P application games,
model-consistent historical review, verified lines, timed P play, undo/replay,
worker cancellation/restart, reload, B fallback, P refusal, custom recovery,
injected ABI mismatch and reload recovery. Edge separately passes custom-weight
controls, keyboard comparison, its existing UI training smoke, actual exported
Blob/file agreement, persistence, complete custom play and review. The unchanged
**372,213-byte** module is served by Python 3.14 under WSL with `application/wasm`.

Only disposable Windows TEMP profiles were used. The existing PowerShell stdio
CDP relay requires no firewall, security-setting or normal-profile changes.
Cleanup initially encountered null/exited CIM records and then an exit between
identity checking and `taskkill`. The final helper checks the owned profile,
tolerates an already-exited process, and still fails for an owned live process
that cannot be stopped. Final complete acceptance and cleanup pass; failed
harness logs remain local.

The small sanity check uses five serial three-batch repetitions after two
warmups, with the same roots/depths/counts. Chrome runs before Edge; this is not
a controlled browser ranking or a repeat of the old campaign.

| Browser | B median batch ms (range) | P median batch ms (range) |
| --- | ---: | ---: |
| Windows Chrome | 12.367 (11.500–13.133) | 15.300 (14.500–16.700) |
| Windows Edge | 12.200 (12.033–12.300) | 15.267 (14.967–15.833) |

They are effectively comparable on this small panel. No Ubuntu-caused browser
speedup is inferred from differences against older observations.

In the finite Edge memory test, forty cancellations/restarts leave **four live
workers**, with no page errors. Process private bytes rise from **578 to 733 MiB**
during the burst, then fall naturally to **467 MiB after 30 seconds idle**;
renderer JS heap falls from its 3.9 MiB peak to 2.1 MiB and DOM nodes from
20,857 to 816. No forced GC was used. This supports finite stability, not a
long-term leak proof. Renderer JS heap excludes worker Wasm memory; process
working sets share pages. The first finite observation is preserved too.

The Wasm manifest and distribution are **unchanged**. The original shared
engine hash is `c238818d6c6ab485ea64eb142e7a614058ea02b8e6afc1e744fd0904be364f6d`;
current engine source is
`959b4bb25f9ac90002edc4e7659548ed4574c9387dd21c3319c85a4632d9d1a3`.
The engine difference is the separate completed-result assignment added after
Wasm compilation. That robustness property applies to the shared source on all
targets; the defect was observed with GCC. The original Clang-built artifact
passes actual interrupted/timed qualification and shows no demonstrated defect
requiring replacement. A future rebuild **should include the correction**, keep
the same floating-point restrictions, retain new source/build receipts and rerun
the full native/Wasm interruption, fallback, PV, exact/pass/deep and TT tests.
Do not relabel the existing artifact as built from current source.

## Resources, identities and publication

Initial available memory was 6.49 GiB Linux / 4.53 GiB Windows. Monitoring during
all final tools/tests observed Linux above **5.51 GiB** and a Windows minimum of
**2.90 GiB**, just below the preferred 3 GiB target. Linux swap counters did not
advance; sampled Windows page output remained **zero**. Transient page input
and reads occurred (up to 391 pages/s and 35 reads/s at publication), which do
not by themselves identify page-file thrashing. No sustained memory pressure
was observed. Final available memory was **6.47 GiB Linux / 3.97 GiB Windows**.
Ordinary Chrome remained open. Free disk initially was about 885 GiB Linux /
349 GiB Windows. All **59 resource samples** accompany the results.

Native benchmarking, browser sanity timing and profiling tool wall time totals
**79.6 seconds**, conservatively including their startup/compilation/resource
overheads. Correctness/UI setup is separate. This is far below the requested
90-minute intensive ceiling. There was no profiling/timing overlap.

| Build | Fingerprint |
| --- | --- |
| GCC 15 portable | `f3c748474d599d1163a1a6e6c0a1c3a76b3cd2dfefd1fda35699373b7b35f540` |
| GCC 15 host | `8ae506faa073a941d7d092626e4cbc3a5ea80f1fc5478e3ac2fff11e12f42a71` |
| GCC 15 POPCNT | `dabe52f6b401146fc9d3c505d28e0e5282e3e6ab7e2bed5d35a33174bdd34766` |
| Original Wasm | `5dab45b8a8edfae11a0c9b3821f296a3ee6d06ed5f52c9394cef4e95d9cb1cef` |

Wasm SHA-256 is
`233fda1b1df7b85dd95202673ce92614d8aff5b52e30d08e7a482ebdbe9fdcd3`;
frozen P identity is
`de4b84745589b0384ea3639f879e3c98990e802d176298ff8ef54f681520067f`.
Full executable/header/source hashes, compiler flags, frozen B/L/P identities,
package versions, profiles and resource history are in
[results](data/pc-upgrade-results-20261030.json),
[benchmarks](data/pc-upgrade-benchmarks-20261030.json) and
[browser evidence](data/pc-upgrade-browsers-20261030.json).
No environments, executables, raw traces, SDK downloads or large corpora are
committed. Historical data remain unchanged.

Checkpoint 1: **`0ee7857ca327b8000865ade783bd0dab44a62723`**, committed with
`git commit -m 'Qualify Ubuntu 26.04 Python 3.14 and GCC 15 native correctness'`,
then `git push origin main`; verified with `git ls-remote origin refs/heads/main`.
Checkpoint 2 uses `git commit -m 'Report GCC 15 Edge qualification profiles and Mac handoff'`,
`git push origin main`, and the same remote verification. Its final exact hash
is reported after publication, avoiding a self-referential commit hash here.

## Mac setup and qualification

Use a user-managed Python 3.13+ from Python.org, an existing version manager, or
Homebrew if already installed. Leave Apple's system interpreter alone. Select
the installed interpreter explicitly; for example, after installing Homebrew's
Python 3.14, use `$(brew --prefix python@3.14)/bin/python3.14`. Do not copy the
Linux environment or native binaries. Python 3.13 is supported by policy; this
PC evidence executes 3.14 only. Repeat on Intel when hardware is available.

```bash
git pull --ff-only
# Use the absolute path to your installed Python 3.13+ interpreter:
python3.14 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-dev-pc-20261030.txt
python -m pip check
python -c 'import sys; print(sys.version); print(sys.executable); print(sys.prefix)'
CXX=clang++ node scripts/native/build.mjs
python -m unittest discover -s tests -p 'test_*.py'
npm test
NATIVE_SANITIZE=1 CXX=clang++ node --test tests/native-search.test.mjs tests/native-v2.test.mjs
NATIVE_RUN=.local-research/mac-return-qualification node scripts/native/qualify.mjs
NATIVE_CPU=native CXX=clang++ node scripts/native/build.mjs
NATIVE_CPU=native CXX=clang++ node --test tests/native-search.test.mjs tests/native-v2.test.mjs
python -m playwright install chromium
python tests/wasm_browser_check.py
python tests/browser_check.py
./start.sh
```

Also verify actual macOS `open`/default-browser launch, not just the mocked
command branch. Observe memory/CPU conditions before timing. Repeat the same
disclosed fixed panels serially before changing code. On Apple Silicon,
`-mpopcnt` is inapplicable and rejected. Optional host targeting must be
requalified for that Mac/compiler; it is not assumed beneficial.

For a deliberate future Wasm rebuild from current shared source:

```bash
source .venv/bin/activate
scripts/wasm/setup.sh
node scripts/wasm/build.mjs
node --test tests/wasm-engine.test.mjs
node scripts/wasm/internals.mjs
npm test
node scripts/wasm/fixtures.mjs
python tests/wasm_browser_check.py
python tests/browser_check.py
git diff -- src/wasm/manifest.js
```

The setup/build wrappers select supported `EMSDK_PYTHON`. The pinned SDK is
**4.0.22**; current-source SDK compilation under Python 3.14 was **not executed
on this PC**, since the SDK is absent and no production rebuild was necessary.
Test that combination on the Mac. Use an isolated Python 3.13 environment only
if an actual third-party compatibility failure requires it. Repeat two production
builds and compare manifest artifact hashes for reproducibility. Preserve both
old and new identities and fully qualify the new result before publishing it.

Prioritize deterministic completed-iteration/node-interruption tests on native
Clang and rebuilt Wasm, null-score fallback and restart, full-window/PV equality,
independent exact endings including passes and horizons beyond 14, TT windows/
collisions/generation rollover, model identities, custom fallback and real
browser memory/lifecycle checks. Repeat actual Safari only where its existing
automation settings permit; document a blocker rather than changing security
preferences. No new Mac execution is claimed by this PC report.

## Ranked engineering opportunities — hypotheses for the next authorized Mac work

1. **Targeted final-empty legal/flip specialization.** Exact solving spends
   approximately 41–44% of current PC self samples in separately visible rules;
   the latest M4 baseline also spends about half in rules. Restrict a first
   experiment to the last one/few empties, preserving pass/terminal utility.
   Faster general rules were previously unsuccessful, so retain only a measured
   complete-search win against independent exact references. As an illustrative
   upper bound, halving *all* of a 43% rules cost would yield about 1.27× speed;
   a final-empty subset addresses less than that. Its actual share/gain is not
   measured here.
2. **A compact, aligned direct TT with equal memory.** TT spans are substantial
   in exact solving, but the earlier two-way eighty-byte candidate gained hits
   and lost elapsed time on the Mac. A genuinely smaller entry is a different,
   unproven hypothesis. Preserve full board/model/depth/generation identity and
   bound semantics; compare useful cutoffs, nodes, occupancy and elapsed time.
   More hits alone cannot justify it; no cache-miss diagnosis is available.
3. **Cheap move-ordering improvements.** Search/control remains large on both
   platforms. Better first-move cutoffs might reduce trees enough to offset a
   small ordering cost. Measure nodes and complete time together and retain
   full-window coaching/PV checks. PVS is a separate higher-risk future project,
   not part of this step.
4. **Batch immediate coaching facts across the boundary**, if UI measurements
   justify it. This can reduce per-alternative calls, with little expected
   playing-search benefit. Keep immediate explanations distinct from minimax.
5. **Further pattern/evaluator micro-optimization is lower priority.** Patterns
   cost roughly 7–10% in nonterminal samples and essentially nothing in exact
   solving. Even halving an 8% component implies only about 4% whole-search time
   reduction under a fixed-work assumption. There is no profile-based reason
   here to rewrite the evaluator or begin more training.

The immediate Mac action is qualification, then one small measured experiment
if requested. No further PC development or optimization campaign starts
automatically.
