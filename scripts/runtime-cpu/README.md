# Reproduce the runtime dispatch experiment

Use the existing qualified GCC/Python/Node environment. Do not rebuild production
Wasm. Choose a fresh ignored directory; never reuse completed measurement paths.
Demanding commands below are **serial**. The original fast-flip reports/data and
runner remain unchanged; this harness reuses its corpus/reference/driver methods.
Historical source-patching runners should be used from their historical revision,
not against this refactored source layout.

```bash
export REVERSI_DISPATCH_RUN=.local-research/runtime-cpu-new
export REVERSI_FLIP_RUN="$REVERSI_DISPATCH_RUN"  # common resource/budget wrapper
export CXX=g++
node scripts/runtime-cpu/build.mjs
node --test --test-concurrency=1 tests/runtime-cpu-dispatch.test.mjs
node scripts/runtime-cpu/qualify.mjs
.venv/bin/python scripts/runtime-cpu/assembly.py
DISPATCH_PILOT=1 .venv/bin/python scripts/fast-flips/run.py pilot .venv/bin/python scripts/runtime-cpu/benchmark.py
# Only proceed if the pilot supports it:
.venv/bin/python scripts/fast-flips/run.py benchmarks .venv/bin/python scripts/runtime-cpu/benchmark.py
.venv/bin/python scripts/fast-flips/run.py micro .venv/bin/python scripts/runtime-cpu/micro.py
.venv/bin/python scripts/runtime-cpu/verify-exact.py
node scripts/runtime-cpu/verify-timed.mjs
.venv/bin/python scripts/runtime-cpu/analyze.py
.venv/bin/python scripts/runtime-cpu/ordinary-path.py
```

A and D reconstruct the exact production engine from `e7b79b9`, with matched
portable or full `-march=native` options. E is its POPCNT-only reference.
B/C are byte-identical dispatch executables with a portable or automatic
runtime selection. Original and new headers have different Engine layouts, so
compile the same driver source separately against each header; never mix their
stack-object ABIs. The current source has one maintainable implementation.

The fixed panel uses 2 full warmups, 9 trials, rotating/reversed build and workload
order, and a calibrated 250-ms baseline target per block. All individual
results/counters must match before timing is accepted. The pilot uses 2 trials
and 100 ms targets, separately preserved and excluded from final intervals.
80/300-ms searches use six opening/middle roots, B/L/P, 3 trials and a full warmup.
The micro run uses three rotating/reversed executable orders, seven inner trials
and the unchanged exhaustive generator/exact-tree tail file. It is supporting
evidence only. Sanitizers are separate correctness runs.

The common `run.py` locks one measurement boundary, records memory/load/processes,
checks executable hashes before/after, and enforces a shared 90-minute ledger.
Immutable local raw evidence includes every fixed and timed result. Compact
publication retains all block clocks, CPU times, complete counters, hashes,
per-root references/mean times, timed publications, corpus identities and static
layout, while excluding binaries/maps/full disassembly and large repeated rows.
`verify-public.py` audits committed data without rerunning a campaign.

Default result paths are local conveniences, not provenance claims. Builds
record source/flags/compiler/header and binary hashes. Rebuilding after the
campaign must use a fresh directory and compare actual binary hashes before
using the old measurements for newly edited source.
