# PC CPU dispatch follow-up

Checkpoint, 2026-10-31. Work is isolated on
`perf/runtime-cpu-branchless-probe`; main and historical reports/data are unchanged.
Qualified baseline: `a77712eb89e3a822d77048694227f39be5d62337`.
Mask-source probe: `a3165e01a6f4e240a7f4c2e77774bd5dc8f8a7bd`.

The exact requested 2x2 builds and four forced fallbacks are reconstructed in
fresh ignored `.local-research/runtime-cpu-followup-20261031`. Full-native N
reproduces the earlier accepted reference binary SHA-256 exactly. GCC is
15.2.0-16ubuntu1 on the i7-14700F under WSL2.

Before timing, independent mailbox/minimax qualification passed all nine
configurations: 221 boards, 35,802 root queries, 22,086 children, 3,294 coaching
rows, 9,882 PV placements, 1,215 deterministic node-stop publications and 567
deep coaching rows. The branchless source passes 17 native/dispatch groups,
and the same 17 groups under ASan/UBSan. Per-candidate tests are ongoing.

Linked code findings, **not performance acceptance**:

| Enhanced flips | Instructions | Bytes | Conditional branches | Stack operands |
| --- | ---: | ---: | ---: | ---: |
| A: original/generic | 101 | 405 | 4 | 0 |
| B: masks/generic | 118 | 455 | 0 | 14 |
| C: original/alderlake | 90 | 358 | 0 | 0 |
| D: masks/alderlake | 118 | 455 | 0 | 14 |
| N: full native reference | 90 | 358 | 0 | 0 |

Next: serial pilot, nine rotating/reversed fixed-work trials across B/L/P exact12,
mixed48, opening, middle, coaching and disclosed profile root; supporting micro
and actual timed-publication checks. Two warmups per block, all thirteen counters
and complete result signatures must match. Independent exact references remain
mandatory. The measurement wrapper enforces a shared 45-minute active budget.
No extra flag search, alignment changes, third backend or algorithm change.

Resource precheck: WSL about 5.9 GiB available, about 1 MiB swap occupied, load
0.01/0.02/0.04, 885 GiB free disk. Windows about 4.6 GiB free physical RAM.
Chrome eight processes/about 592 MiB and Edge five/about 291 MiB; neither was
a significant sampled CPU consumer. No application or system setting changed.

No candidate has performance acceptance yet. Mac hardware and freshly compiled
Wasm qualification are still required before promotion. Static baseline ISA and
forced fallback execution do not constitute physical testing on an older CPU.
