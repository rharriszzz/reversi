# WSL2 fast-flips reproduction

## Completed WSL2 qualification and PMU probes

Read [the PC report](../../docs/FLIP_OPTIMIZATION_PC.md) and
[combined decision](../../docs/FLIP_OPTIMIZATION_RESULTS.md). The additional PC
tools preserve the engine and original measurement harness. No privileged tool,
kernel, Windows feature, profiling driver or security setting is changed.

Read-only probes, using the existing project environment:

```bash
.venv/bin/python scripts/fast-flips/pc-pmu-probe.py
powershell.exe -NoProfile -NonInteractive \
  -File "$(wslpath -w scripts/fast-flips/pc-host-probe.ps1)"
```

The Linux probe also uses the previously available local perf frontend when
`perf` is absent from PATH; it installs nothing. Direct hardware/software
`perf_event_open` probes and guest CPUID distinguish frontend, permission and
event-support failures. The Windows probe enumerates WPR sources; enumeration
is not a successful capture or evidence of Linux symbol attribution.

For each **fresh** portable/native campaign, use the [common native recipe](README.md#common-native-recipe)
with `FLIP_SELECTED_TAG=refined` and `FLIP_TAGS=original,ray-table,refined`.
Use the unchanged committed Mac `search-cases.txt` as the micro input. After
`integrated-final` and timed-publication verification, complete these steps:

```bash
python scripts/fast-flips/pc-verify-exact.py
python scripts/fast-flips/diagnose.py
FLIP_DIAGNOSTIC_TAG=refined python scripts/fast-flips/diagnose.py
python scripts/fast-flips/pc-assembly.py
python scripts/fast-flips/pc-directions.py
FLIP_DATA=integrated-final FLIP_SUMMARY=summary-final \
  python scripts/fast-flips/analyze.py > "$REVERSI_FLIP_RUN/analysis.log"
```

For clarity, the full per-configuration sequence is below. Choose a new run
directory; the actual completed directories end in `pc-portable-20261031` and
`pc-native-20261031` and must not be overwritten. Use the same sequence a second
time with a different output path and `export FLIP_NATIVE=1`; leave it unset for
portable. Do not run the configurations concurrently.

```bash
export CXX=g++
export REVERSI_FLIP_RUN=.local-research/fast-flips-pc-new-portable
unset FLIP_NATIVE
# For a separate host-tuned run instead:
# export REVERSI_FLIP_RUN=.local-research/fast-flips-pc-new-native
# export FLIP_NATIVE=1
node scripts/fast-flips/build.mjs
FLIP_SELECTED_TAG=refined node scripts/fast-flips/selected-build.mjs
FLIP_TAGS=original,ray-table,refined node scripts/fast-flips/qualify.mjs
FLIP_TAGS=original,refined .venv/bin/python scripts/fast-flips/sanitize.py \
  > "$REVERSI_FLIP_RUN/sanitize.json"
.venv/bin/python scripts/fast-flips/run.py micro \
  "$REVERSI_FLIP_RUN/micro-refined" docs/data/fast-flips-mac/search-cases.txt
FLIP_TAGS=original,ray-table,refined .venv/bin/python scripts/fast-flips/run.py \
  integrated-final .venv/bin/python scripts/fast-flips/integrated.py
node scripts/fast-flips/verify-timed.mjs
.venv/bin/python scripts/fast-flips/pc-verify-exact.py
.venv/bin/python scripts/fast-flips/diagnose.py
FLIP_DIAGNOSTIC_TAG=refined .venv/bin/python scripts/fast-flips/diagnose.py
.venv/bin/python scripts/fast-flips/pc-assembly.py
.venv/bin/python scripts/fast-flips/pc-directions.py
FLIP_DATA=integrated-final FLIP_SUMMARY=summary-final \
  .venv/bin/python scripts/fast-flips/analyze.py > "$REVERSI_FLIP_RUN/analysis.log"
```

The new independent C++ solver scans a 10x10 mailbox and solves all twelve
exact roots plus the disclosed D12 root, checking every algorithm/model's fixed
scores. It shares no production engine, bitboard flip routine, TT or tiny-endgame
helper. These reference runs and the counting diagnostics are correctness work,
never performance evidence. The isolated direction-wrapper instruction totals
are static diagnostics and cannot be summed to decompose the measured function.

Optionally, after unprofiled timing and without concurrent tests/builds:

```bash
python scripts/fast-flips/run.py software-profiles \
  python scripts/fast-flips/pc-profile.py
python scripts/fast-flips/pc-profile-addresses.py
```

This captures six short **software cpu-clock** IP profiles of the actual measured
portable binaries. It requests no stacks, preserves symbol/unresolved/loss
accounting, and does not claim hardware cycles or P/E-core attribution. Raw
perf files remain ignored. The combined active time from **both** configuration
ledgers must stay below 90 minutes; they are not separate machine allowances.

Run `REVERSI_FLIP_RUN=PORTABLE_RUN python scripts/fast-flips/pc-check.py` after
both campaigns and outside timing to save the full serial closing suites.
`pc-publish.py PORTABLE_RUN NATIVE_RUN` publishes compact clocks/counters,
signatures, corpus identities, qualifications, assembly, probes and resources
under `docs/data/fast-flips-pc/`, without modifying Mac evidence. It requires
passing suites in `PORTABLE_RUN/pc-test-receipt.json`. Use `pc-verify-public.py`
to audit the resulting committed evidence without repeating measurements.
