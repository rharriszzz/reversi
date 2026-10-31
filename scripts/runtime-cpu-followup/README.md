# PC compiler follow-up

This bounded experiment preserves the original `runtime-cpu` evidence and reuses
its qualified driver, corpus, mailbox references and timing methods. A–D are the
requested 2x2 experiment; AP/BP/CP/DP force portable in the corresponding **same
executable bytes**. N reconstructs the original full-native reference. All builds
have strict floating point and unchanged frozen model identities.

Use GCC 15.2 on the PC. Choose a **new** directory, then run these commands
serially. Do not run tests/compilation alongside performance measurements.

```bash
export CXX=g++-15
export REVERSI_DISPATCH_RUN="$PWD/.local-research/runtime-cpu-followup-new"
export REVERSI_FLIP_RUN="$REVERSI_DISPATCH_RUN"
export REVERSI_FOLLOWUP_BUDGET_ROOT="$REVERSI_DISPATCH_RUN"
node scripts/runtime-cpu-followup/build.mjs
node scripts/runtime-cpu-followup/qualify.mjs
node scripts/runtime-cpu-followup/qualify-builds.mjs
node scripts/runtime-cpu-followup/qualify-builds.mjs --sanitize
node scripts/runtime-cpu-followup/verify-interruption.mjs
python3 scripts/runtime-cpu-followup/assembly.py
```

The separately retained pilot shares the parent's 45-minute ledger. It uses two
repetitions and 100-ms targets, excluded from final confidence intervals.

```bash
mkdir "$REVERSI_DISPATCH_RUN/pilot"
for tag in A B C D AP BP CP DP N dispatch; do
  ln -s "$REVERSI_DISPATCH_RUN/$tag" "$REVERSI_DISPATCH_RUN/pilot/$tag"
done
cp "$REVERSI_DISPATCH_RUN/positions.json" "$REVERSI_DISPATCH_RUN/pilot/positions.json"
REVERSI_FLIP_RUN="$REVERSI_DISPATCH_RUN/pilot" REVERSI_DISPATCH_RUN="$REVERSI_DISPATCH_RUN/pilot" DISPATCH_PILOT=1 python3 scripts/runtime-cpu-followup/run.py pilot python3 scripts/runtime-cpu-followup/benchmark.py
python3 scripts/runtime-cpu-followup/run.py benchmarks python3 scripts/runtime-cpu-followup/benchmark.py
python3 scripts/runtime-cpu-followup/run.py micro python3 scripts/runtime-cpu-followup/micro.py
python3 scripts/runtime-cpu/verify-exact.py
node scripts/runtime-cpu/verify-timed.mjs
python3 scripts/runtime-cpu-followup/analyze.py
```

Nine rotating/reversed repetitions, two full warmups per block and 250-ms
calibrated baseline targets. Fixed results and all thirteen counters must match.
Supplementary 80/300-ms publications are independently checked at their actual
completed horizons. Micro uses the unchanged legal-phase and exact-tail corpus,
three rotated executable rounds and seven inner repetitions per class. Sanitizer
builds have their own objects/executables and never supply performance numbers.

`builds.json` and per-build receipts record exact committed source hashes, flags,
compiler, frozen identities, ISA contract and binary hashes. Qualification files
record test outcomes; full linked `.asm`, `.nm` and maps remain in ignored local
storage. Published compact data retain paired clocks, CPU times, every counter,
score signatures, per-root references, variability and Student-t intervals on nine
paired log ratios (df=8). These are fixed engineering panels, with no multiple
comparison correction or claim about all Reversi positions or other hardware.

`AP` is the qualified fallback reference. CP changes only the enhanced object;
portable object equality is checked separately. The selected backend diagnostic
and ISA audit are required even when performance looks favorable. No claim of
physical older-CPU, Mac or newly compiled Wasm testing follows from PC results.
