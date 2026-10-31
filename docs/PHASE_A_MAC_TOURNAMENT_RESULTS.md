# Phase A M4 P-versus-B tournament

Prospective implementation and registration, 31 October 2026. The new authorization
is 180 active minutes. This is a separate experiment descended from
`886c5aff60bd42e7368f67a531980afb2b7e5609`; the stopped 120-minute investigations
and their failed gates remain historical evidence. B remains production default.

This document will receive the completed audit and results after the full sample
finishes. At registration, no confirmation outcomes have been inspected.

The fixed design is 256 independently admitted source families, 16 in each of
16 policy/parity/actual-turn/first-color cells, two adjacent color-swapped games
per family, 512 serial games at 80 ms. The B1/12% and B4/2% complete source policies,
12/13-occupied starts, simultaneous board-color/turn reversal and shuffled schedule
are preserved from the completed draft. Namespace
`phase-a-m4-p-v-b-prospective-v1-20261031`; schedule seed 2026103191;
bootstrap seed 2026103192. There is no reserve sample, post-outcome replacement,
interim test, sample extension, fitting or search optimization.

The original source generator and admission implementation are reused. Admission
checks both-turn D4/simultaneous-color canonical SHA-256 identities for all
nonterminal source ancestry from occupied 12, roots and legal root children
against history and accepted families. Every attempted source, rejection reason
and conflict identity is retained. Terminal convergence is disclosed separately.
The existing broad historical prohibition includes unrelated targets, assessments,
reserved decisions and unresolved roles. It has not been narrowed.

The ordinary qualified ARM64 executable is reused unchanged, with separate
16-MiB-capacity B/P transposition tables, fresh B/P processes before every game,
identical first-16 disclosed `native-engineering-*` D3 warmup for both players,
and alternating warmup order. Its existing table allocation rounds down to
10,485,760 bytes per process within the requested 16-MiB cap. Natural timed search
uses depth 0 at the client boundary, unchanged absolute deadline/TT/hint semantics,
and a single serial stream of game searches. Warmup is outside move clocks and
inside the study's elapsed time.

The coordinator reuses `native-v2/game.mjs` and `native/client.mjs`; its outer
receipts bind the new registration independently of the inner historical game
identity. Every move prefix is durable, game receipts are immutable, and each
complete color pair has an atomic hash-chained receipt. A restart can verify and
skip complete pairs. A partial pair is preserved and blocks continuation as a
complete confirmation; no lost-TT partial game is replayed to replace an outcome.
A three-hour cap interruption therefore produces incomplete evidence.

The primary endpoint is the mean of the 256 complete family point averages,
win/draw/loss = 1/.5/0. Require both `mean - sqrt(log(20)/512) > .5` and the
approximate one-sided Student 95% lower bound above .5. The exact bounded score
threshold is strictly above 57.64920885%. Also report a descriptive two-sided
Student 95% interval and 10,000 whole-family percentile bootstrap resamples,
16 draws with replacement within each of 16 cells, ascending cell/family order,
with score and margin resampled together. The bootstrap is sensitivity analysis.
No moves, colors or symmetry variants are additional independent observations.

Independent Python mailbox replay, admission, seed, symmetry, receipt, terminal,
model/build/depth/time-control and whole-path historical-role audits precede
aggregate strength analysis. A prohibited or unresolved encounter blocks the
whole independent-confirmation claim while retaining all games and descriptive
results. The independent JS statistics implementation cross-checks Python's
Student integration, bounded inference and exact seeded stratified bootstrap.

The new ledger charges the uninterrupted wall span from
`2026-10-31T23:45:05Z`, including implementation, tests, calibration, admission,
execution, verification and publication. There is no paused-span deduction or
reset. The fresh 128-KB atomic-checkpoint maximum of 15.284041 ms is retained,
including its slower result relative to the earlier 64-KB maximum. The initial
complete forecast is 148.4293 remaining minutes plus 9.8628 spent minutes, using
the full 35% contingency and separate 15-minute reserve. The complete forecast
is checked again after admission and immediately before scored execution.

Development used four disclosed generation fixtures, two late disclosed native
fixture games, a separate four-source disclosed test namespace, independent
replay, real process exit/reopening of an atomic pair receipt, tamper rejection,
and synthetic family-statistics tests. All 944 resulting nonterminal canonical
keys are additional admission exclusions. One mistyped Student reference constant
in a development test was corrected before registration; the failed development
log is retained. No confirmation outcomes were involved. Full pre-freeze checks
passed 192 Node tests with one expected Linux-x86 dispatch skip and 64 Python
tests; the final focused checks passed 30 Node and four Python tests. Known
nonfatal Python subprocess/HTTPError ResourceWarnings remain visible.

The literal registration and all scientific source hashes are published in
[data/phase-a-tournament/registration.json](data/phase-a-tournament/registration.json)
before scored games. Historical bulk inventories, archives and raw move-prefix
receipts remain local. Production sources, models, UI, distributed Wasm and
`main` are preserved.

## Pre-play freeze and supplemental seed check

All 256 literal families and the complete 512-game schedule were registered at `2026-10-31T23:56:41.672Z`; registration checksum `5bfd082e1dfe120c7dd1ccec6f5963ec27690bae88971d65d36e5457a4b219c1`. Ascending admission used 1,699 complete source attempts, accepting 256 and rejecting 1,443 before any scored play. Independent Python replay verified every attempted source, both-turn canonicalization, historical/mutual exclusions, balance and every receipt.

A pre-play review found that the extraction catalog records scalar `seed` fields but omits 11,818 older seeds retained in arrays. The [supplemental verifier](data/phase-a-tournament/verify-seed-registries.py) checks the original hash-matching registries as well: 53,545 historical seeds in the union. **All 1,699 attempted seeds are disjoint from that full union.** Accepted seeds are also mutually unique and disjoint from development fixtures. This pre-play supplement changes no literal opening, source trajectory, admission decision, schedule, endpoint or analysis rule. The original registration and source snapshot remain immutable. The supplemental certificate and verifier are committed before scoring.

| Frozen identity | Value |
| --- | --- |
| Native CLI SHA-256 | `aee4e98b2d00d1631c61383a3b6dbf11d716a47673276bf1eefa4fc52f0323f1` |
| Build fingerprint | `118ac8f1ac74571993db0d7976e801d541aa6a52780d91448f092dbd0f511818` |
| B model | `original-production` |
| L model | `ecf3fd376c680ced77d0b002ea2efb9fa4385737c4fffff734b901ab2968d97f` |
| P model | `de4b84745589b0384ea3639f879e3c98990e802d176298ff8ef54f681520067f` |
| Historical membership SHA-256 | `6e959bb877d14a96c1938090f0e94db5fc08118ee358ef949c75a7aaf5b5d9d0` |

The post-admission full remaining forecast is **125.4793 minutes**, plus **11.6093 minutes already charged**. It retains the original 35% contingency and 15-minute reporting reserve. Its raw components are 35.9424 search, 0.2443 process/warmup, 27.6498 checkpoint, 3 reservation audit and 15 replay/role/statistical audit minutes. The launch gate is checked against actual elapsed time again after publication.
