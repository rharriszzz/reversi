# Runtime dispatch checkpoint

2026-10-31, before pilot timing. Stage 1 passed and was pushed on main at
`6b480ed1bc6ddcdde2fdb37872c0ca8d0a804425`; the remote SHA matched.
Stage 2 remains isolated on `perf/runtime-cpu-dispatch`.

Implemented: single-source separate portable/enhanced search compilation,
construction-time feature selection, forced portable environment variable,
backend/feature diagnostics, one original TT/state object and shared immutable
tables. Read [the design](RUNTIME_CPU_DISPATCH_DESIGN.md).

Passed before this checkpoint:

- Initial auto native/rules/Wasm/fast-flip suites: 29/29 groups.
- Forced portable native/rules/V2/endgame suites: 21/21 groups.
- ASan/UBSan native/V2/endgame suites: 16/16 groups on each backend.
- Matched A/B/C/D/E qualification: 221 boards, 19,890 root queries,
  12,270 children, 1,830 coaching rows, 5,490 PV placements,
  675 deterministic completed-horizon checks and 315 deep coaching rows.
- New dispatch regression: both backends independently pass >1.2 million
  mailbox flip cases and standalone TT rollover/pattern/PV assertions.
- Linked disassembly: distinct negamax specializations; no indirect or
  cross-backend recursion/helper calls; one shared geometry/model definition;
  baseline application code contains no required enhanced instruction.

These are correctness and static findings, **not yet performance acceptance**.
No older CPU emulator, Mac or newly compiled Wasm qualification is claimed.
No production Wasm file changed. Local evidence is preserved under ignored
`.local-research/runtime-cpu-20261031` and `.local-research/dispatch-*.log`.

Next: serial two-repetition pilot, then nine rotating/reversed matched trials
if worthwhile, supporting micro/timed work, independent exact-panel references,
final tests/report and push. Main will not receive the dispatch experiment.
All performance work uses the durable 90-minute ledger; no PMU investigation,
security changes or general optimization campaign is planned.

Recovery commands:

```bash
NATIVE_CPU=dispatch node scripts/native/build.mjs
REVERSI_CPU_BACKEND=portable NATIVE_CPU=dispatch node --test --test-concurrency=1 tests/native-search.test.mjs
node --test --test-concurrency=1 tests/runtime-cpu-dispatch.test.mjs
node scripts/runtime-cpu/build.mjs # choose fresh REVERSI_DISPATCH_RUN after measurements exist
```

The scripts reconstruct references from `e7b79b9` and use the unchanged qualified
48-root input. Final results supersede this intermediate status document.
