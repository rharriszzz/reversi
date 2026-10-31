# Fast-flip experiment

Read [the Mac results and PC handoff](../../docs/FLIP_OPTIMIZATION_MAC.md)
first. `perf/fast-flips` is experimental and is not merged into `main`.
No models or search policies change. The installed browser artifacts remain
unchanged; candidate Wasm is built into ignored storage for qualification.

`candidates.hpp` preserves the original ray loop, a masked-opponent loop,
six-step propagation, pair/doubling propagation and a 4 KiB geometry table.
`build.mjs` reconstructs the exact original engine from
`1058f013581e0566277586f857b0a2884be260f6`, with one flip kernel substituted
per experimental translation unit. `late-ray` substitutes the table only in
the existing last-one/two-empty helper. `selected-build.mjs` snapshots the
checked-out `native/engine.cpp`; its microbenchmark links that actual engine
object, alongside the five standalone alternatives. The micro row named
`selected` means this linked production-source implementation.

All measured builds use separate engine/driver/kernel compilation units,
matching optimization flags, no LTO and no per-call timing instrumentation.
`-g` adds symbols without forcing frame pointers; Mac builds verify identical
engine text with/without debug information. Each experiment directory is
immutable after measurement. Choose a fresh directory to rebuild.

## Common native recipe

Use the existing qualified Python 3.14 environment, Node 20+ and C++ compiler.
On the PC, verify GCC 15 and the actual Ubuntu/WSL installation first. Do not
install older versions. These commands work in WSL bash and macOS zsh/bash;
select the actual compiler available on that machine.

```bash
export REVERSI_FLIP_RUN=.local-research/fast-flips-new-portable
unset FLIP_NATIVE
# On the WSL2 PC:
export CXX=g++
python --version
node --version
"$CXX" --version
node scripts/fast-flips/build.mjs
FLIP_SELECTED_TAG=refined node scripts/fast-flips/selected-build.mjs
FLIP_TAGS=original,ray-table,refined node scripts/fast-flips/qualify.mjs
FLIP_TAGS=original,refined python scripts/fast-flips/sanitize.py > "$REVERSI_FLIP_RUN/sanitize.json"
python scripts/fast-flips/run.py micro "$REVERSI_FLIP_RUN/micro-refined" docs/data/fast-flips-mac/search-cases.txt
FLIP_TAGS=original,ray-table,refined python scripts/fast-flips/run.py integrated-final python scripts/fast-flips/integrated.py
node scripts/fast-flips/verify-timed.mjs
FLIP_DATA=integrated-final FLIP_SUMMARY=summary-final python scripts/fast-flips/analyze.py > "$REVERSI_FLIP_RUN/analysis.log"
node --test --test-concurrency=1 tests/*.test.mjs
NATIVE_SANITIZE=1 node --test --test-concurrency=1 tests/native-search.test.mjs tests/native-v2.test.mjs tests/mac-endgame.test.mjs
python -m unittest discover -s tests -p 'test_*.py'
```

`qualify.mjs` compares complete boards, independent mailbox/minimax results,
all exposed search/TT counters, full-window coaching rows/PVs at depths 3/6,
and deterministic interrupted iterations. `sanitize.py` also runs the standalone
native assertions and exhaustive mailbox flip suite. `verify-timed.mjs` checks
the actual 80/300-ms published scores **and moves** against complete baseline
searches at the stated horizon. Correctness runs are not performance results.

`run.py` serializes measurement, checks resources and keeps a durable
90-minute ledger. Its file names cannot overwrite completed results. It also
checks that measured executables do not change during a run. Native fixed-work
blocks have two complete warmups, approximately 0.35 seconds of baseline work,
nine repetitions, and rotated/reversed engine and workload order. Timed trials
are supplementary, with six roots, three repetitions and both 80/300-ms budgets.
Baseline/candidate scores and complete counters must match for every fixed call.

The microbenchmark pre-generates all cases. Its default is about twenty million
calls per class/algorithm/trial, seven rotated/reversed trials. An external
function call and consumed checksum prevent constant folding. Explicit
xorshift/Fisher-Yates order is independent of the C++ standard library.
`FLIP_MICRO_CALLS=1` is a correctness/build smoke setting, not a performance run.
`micro-refined --check` runs only exhaustive/reference checks, without timings.

For a separately reported host-tuned PC configuration, choose another fresh
directory and set `FLIP_NATIVE=1` before rebuilding **all** variants. It selects
`-march=native` on x86-64 (`-mcpu=native` on ARM). Compare algorithms within each
configuration; never compare portable baseline with host-tuned candidate.
The builder saves x86 disassembly with `objdump -Cd`.

Compare `micro.json`'s `corpus` array with the committed Mac manifest before
making cross-platform comparisons. Its cases/order must match, as must the
workload and source hashes in the handoff. The legal-phase weighted mixture
does not include the overlapping edge subset or controlled stress cases.
The separate exact-search corpus contains one-in-97 diagnostic calls by empty
count from the disclosed exact root; it is not claimed to represent all searches.

## M4-only collection and Wasm qualification

Do not run these as the PC phase. They require the existing qualified Mac tools.
Raw traces/exports and binaries remain ignored. Do not change Processor Trace
or Developer Tools security settings.

```bash
# After unprofiled measurements, not concurrently:
FLIP_PROFILE_TAGS=original,refined FLIP_PROFILE_REFINEMENT=1 FLIP_PROFILE_SUFFIX=final \
  python scripts/fast-flips/run.py profiles-final python scripts/fast-flips/profile.py
FLIP_PROFILE_DATA=profiles-final FLIP_PROFILE_ANALYSIS=profile-analysis-final \
  python scripts/fast-flips/profile-analyze.py
node scripts/fast-flips/wasm-build.mjs
FLIP_SELECTED_TAG=refined node scripts/fast-flips/wasm-qualify.mjs
python scripts/fast-flips/run.py wasm-browser python scripts/fast-flips/browser.py
```

The full Mac campaign also preserved initial original/doubling/guarded-table/
helper-only search blocks and contextual hardware-stack/CPU Profiler captures.
`profile.py` reuses the qualified minimal collector with explicit
`CORE_ACTIVE_CYCLE` configuration. `profile-analyze.py` reuses its offline parser,
checks all IP records and TOC requirements for hidden stack collection, and
retains unknown loss/unresolved mass. Only real exported stacks supply callers.
The final coarse/fine IP captures complement those initial contextual captures.

`browser.py` loads the ignored candidate with an explicit manifest in a real
Chrome worker. It compares complete batch wall time and fixed scores/counters,
then routes only its disposable UI context to that same candidate for acceptance.
It changes no distributed artifacts or ordinary browser profiles. Native
coaching uses hints disabled; browser coaching uses the ordinary adapter's
default hints, so cross-backend absolute coaching times are not matched work.

`check.py` is the Mac closing-check orchestrator (including a counting-only
diagnostic); `publish.py` writes compact Mac derivatives after all checks pass.
It deliberately refuses non-ARM macOS publication. Do not use it to replace Mac
evidence with PC results. Create `FLIP_OPTIMIZATION_PC.md` and update the combined
summary separately during the actual PC phase.
