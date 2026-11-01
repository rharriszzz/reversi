# Phase A M4 P-versus-B tournament

**P scored 60.6445% (299 wins, 23 draws, 190 losses) and passed both numerical
strength gates. The strict whole-sample historical-independence gate failed.**
This is favorable descriptive evidence for P, **not independent confirmation**
under the registered broad contract. B remains the application default.

All 256 families were frozen and published before scoring. All 512 games finished
without interruption or replacement, after **43.1804 charged minutes** including
preparation; serial scored execution took **29.0726 minutes**. Audits and reporting
also fit comfortably inside the new 180-minute allowance. The original 120-minute
stops, earlier failed independence gates and historical archives are preserved.

The [registration](data/phase-a-tournament/registration.json), [all compact games](data/phase-a-tournament/games.json.gz),
[all source attempts](data/phase-a-tournament/admission-attempts.jsonl.gz),
[independent integrity certificate](data/phase-a-tournament/integrity-verification.json),
[historical-role audit](data/phase-a-tournament/provenance-verification.json),
[board-level encounter witnesses](data/phase-a-tournament/restricted-encounters.json),
and [statistical evidence](data/phase-a-tournament/analysis.json) bind the result.

| Gate / endpoint | Result |
| --- | --- |
| Historical inventory, full seed registries and source admission | Pass within qualified retained-source scope |
| 256 families / 16 per cell frozen before scoring | Pass; remote commit `27488af3066149b0fee8832926c45dad30486cb8` |
| Complete 512-game / 256-pair checkpoint chain | Pass |
| Independent rules, identities, timing and receipt verification | Pass, with disclosed verifier correction below |
| Strict complete played-path independence | **Fail: 56 restricted keys / 28 symmetry-color boards** |
| P points / all game points | 310.5 / 512 = **60.64453125%** |
| One-sided Student 95% lower / p | **57.4521%** / `4.5078e-8` |
| One-sided Hoeffding 95% lower | **52.9953%** |
| Both predefined numerical gates above 50% | **Pass** |
| Descriptive Student two-sided 95% interval | 56.8363–64.4528% |
| Stratified whole-family bootstrap 95% sensitivity | 56.9336–64.3555% |
| Mean raw terminal disc margin, P perspective | +5.796875 discs |
| Margin bootstrap 95% sensitivity | +4.4550 to +7.171875 discs |
| Requested independent-confirmation claim | **Blocked by provenance** |

The family-score sample variance is 0.09573280484, SD about 0.3094 and SE
0.01933794893. There are 256 independent-family observations under the protocol's
sampling assumptions, not 512 independent observations. Bootstrap uses 10,000
stratified whole-family draws with the frozen seed. The conservative threshold
remains strictly above 57.64920885%; no alternative endpoint rescued the result.

The new score is **2.9297 percentage points below** the historical 63.5742% at
80 ms. That old point estimate lies inside the new descriptive 95% interval;
the direction and magnitude are broadly consistent, without proving equivalence.
The samples are not pooled, the old failures are not cleared, and native natural
horizons differ from the older JS confirmation's search regime. This study makes
no 300-ms superiority claim or absolute playing-strength/rating claim.

## Registered design and preparation

Prospective implementation and registration, 31 October 2026. The new authorization
is 180 active minutes. This is a separate experiment descended from
`886c5aff60bd42e7368f67a531980afb2b7e5609`; the stopped 120-minute investigations
and their failed gates remain historical evidence. B remains production default.

At registration, no confirmation outcomes had been inspected. All 512 games now
remain preserved, including every family with a restricted encounter.

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

## Verification commands and retained evidence

The public verifier is read-only and uses Python's standard library. Run from
this research worktree:

```bash
export REVERSI_PYTHON=/Users/rharris/git/reversi/.venv/bin/python
"$REVERSI_PYTHON" docs/data/phase-a-tournament/verify-final.py
"$REVERSI_PYTHON" docs/data/phase-a-tournament/verify-seed-registries.py
git diff --check
```

Public evidence contains literal registered openings and complete source paths,
all admission receipts in compressed JSONL, all 512 legal game paths and numerical
move telemetry in compressed column form, family rows, numerical results,
resource records, provenance occurrences/classifications, checkpoint/receipt hash
inventories, and both independent verification certificates. The public replay
verifies those artifacts and recomputes paired numerical results. It explicitly
does **not** claim to repeat historical membership without the retained bulk index.

The immutable local run is
`/Users/rharris/git/reversi-phase-a-tournament/.local-research/phase-a-m4-tournament-v1`.
Full original per-game receipts, move-prefix checkpoints, complete-pair chain,
scientific snapshots, failed development logs and resource/process captures remain
there. The completed provenance inventory remains at its original bound path;
no import, transfer or historical reconstruction was repeated. Do not rerun the
creation commands over these completed records.

To repeat the full local independent historical audit without overwriting its
certificates, create a fresh scratch view containing read-only input symlinks:

```bash
AUDIT_DIR=$("$REVERSI_PYTHON" - <<'PY'
from pathlib import Path
import tempfile
source=Path('/Users/rharris/git/reversi-phase-a-tournament/.local-research/phase-a-m4-tournament-v1')
target=Path(tempfile.mkdtemp(prefix='reversi-phase-a-reaudit-'))
outputs={'integrity-verification.json','provenance-verification.json','analysis.json',
         'early-terminal-exact-verification.json'}
for path in source.iterdir():
    if path.name not in outputs:
        (target/path.name).symlink_to(path,target_is_directory=path.is_dir())
print(target)
PY
)
"$REVERSI_PYTHON" docs/data/phase-a-tournament/audit-repair.py integrity "$AUDIT_DIR"
"$REVERSI_PYTHON" scripts/phase-a-mac/verify-tournament.py analyze "$AUDIT_DIR"
```

The runner's creation stages are `fixture`, `prepare`, independent `reservation`,
pre-play seed-registry verification and publication, then `execute`, independent
`integrity`, `analyze`, and the explicitly corrected publication wrapper `publish-repaired.mjs`. The
original scientific sources are frozen for this
specific namespace/authorization and fail closed against existing immutable
outputs. They are not an authorization to repeat scored games or extend the study.

Publication is confined to `research/phase-a-m4-tournament-20261031`, using
`git commit` and `git push -u origin research/phase-a-m4-tournament-20261031`,
followed by `git ls-remote` verification. The preregistration remote SHA is
`27488af3066149b0fee8832926c45dad30486cb8`. Production `main` remains
`a560896ef54a3c4cec19974ed8cbc2064e177e4b` on the remote; the original local
`main` worktree remains at its original `e955e992…` without being switched/reset.


## Actual audit findings

The independent Python path replayed **27,817 move/pass records** from all 512
games, all 1,699 complete admission trajectories, both color assignments, forced
passes, flips and terminal outcomes. Every raw game result checksum, move-prefix
checksum, complete-pair chain and registration/source snapshot was checked.
A supplementary identity audit verified all 1,024 fresh player process IDs, inner
game/prefix identities and that every game started after remote publication.
The native executable, coefficients and frozen scientific sources stayed unchanged.

The historical audit matched complete played paths against the unchanged final
membership index and scanned the existing **33,724,618 original**, **3,825,432
supplemental**, and **105,140 reconciled** occurrence records. This reused retained
streams; it did not reconstruct or import the history again. It completed before
any aggregate scores were opened. The audit takes 76.06 seconds including its
repeated admission/rules/receipt checks; analysis followed at
`2026-11-01T00:32:11.045994Z`.

There were **72 indexed historical keys / 114 overlap occurrences**, including
terminal convergence. **56 nonterminal keys represent 28 distinct symmetry/color
boards reached by 15 families in 21 games.** All 56 retain unresolved restrictions;
two also inherit the old confirmation's prohibited classification, representing
one 63-occupied board reached by family 167, game 288, plies 53/54. These are
retained old classifications, not newly proved gradient-fitting use.

There were **zero matches to the known direct-state panel index** and **zero to
the previously proved older two-empty applied target**. The known-direct index
includes direct panels/decisions and must not be described as exclusively P/L
training. The new flags include legacy behavior ancestry, generator-declared
training/development/assessment ancestry, opaque upstream exclusion membership,
and incidental old played paths with unresolved upstream roles. A generator's
role declaration or an ancestor occurring on an old behavior path does not prove
an applied fit. None of these facts clears an unresolved restriction or shows
that P trained on a flagged board.

No nonterminal cross-family played convergence was found. Source-family admission
separation passed independently. The failed played-path gate concerns the fixed
whole sample: every affected game remains included, with no clean-subset estimate,
replacement, rerun or retrospective independence definition.

The following rows identify **all 28 restricted board identities**. The first
conservative key is abbreviated; both full turn keys, literal witness boards,
complete played locations and historical occurrence pointers are in the linked
board-level witness file and full role audit. Game/ply numbers are zero-based.

| First key prefix | Family | Game(s) | Ply / occupied | Representative historical occurrence |
| --- | --- | --- | --- | --- |
| `22072135848657d1` | 228 | 28,29 | 2 / 14 | `strong-six-hour-20261027/data/generate-train-13968.json` `/games/0/replayed/9` |
| `3a6729436be6dce2` | 104 | 61 | 3 / 15 | `strong-six-hour-20261027/data/generate-train-26784.json` `/games/2/replayed/10` |
| `3af00bc27e8f3000` | 122 | 184,185 | 2 / 15 | `residual-frontier-v1r2-20261028/tasks/generation-training-3480.json` `/result/history/3/board` |
| `3ffad257729b5c1e` | 122 | 184,185 | 3 / 16 | `residual-frontier-v1r2-20261028/tasks/generation-training-3480.json` `/result/history/4/board` |
| `640da2dc125b5162` | 204 | 188 | 6 / 18 | `strong-six-hour-20261027/tasks/generate-train-19184.json` `/games/1/replayed/13` |
| `51054f8d0dde3aa0` | 204 | 188 | 7 / 19 | `strong-six-hour-20261027/tasks/generate-train-19184.json` `/games/1/replayed/14` |
| `260fc22f33c6f2cb` | 11 | 197 | 2 / 15 | `strong-six-hour-20261027/data/generate-train-25248.json` `/games/5/replayed/10` |
| `bfe2c019e4e8b1ab` | 11 | 197 | 3 / 16 | `next-frozen-screen-20261028/exclusions.json` `/keys/1928383` |
| `368396baa7ccebe9` | 11 | 197 | 4 / 17 | `strong-six-hour-20261027/data/generate-train-25248.json` `/games/5/replayed/12` |
| `65092c11b0b0f079` | 11 | 197 | 5 / 18 | `strong-six-hour-20261027/data/generate-train-25248.json` `/games/5/replayed/13` |
| `0e31fb1da43a0f41` | 112 | 222,223 | 4 / 16 | `residual-frontier-v1r2-20261028/tasks/generation-development-6320.json` `/result/history/4/board` |
| `a6d13c4bc4a09494` | 201 | 245 | 52 / 63 | `admission-attempts/2143.json` `/trajectory/moves/replayed/61` |
| `583ee48a9026a14f` | 167 | 288 | 49 / 60 | `history-extra-occurrences.json` `/92018/keys/0` |
| `582ebf034975954e` | 167 | 288 | 50 / 61 | `history-extra-occurrences.json` `/92019/keys/0` |
| `04fce14ac298a940` | 167 | 288 | 51/52 / 62 | `history-extra-occurrences.json` `/92020/keys/0` |
| `19c4971eb0672eb3` | 167 | 288 | 53/54 / 63 | `next-frozen-screen-20261028/exclusions.json` `/keys/192712` |
| `8a6d33cdad18fc9f` | 157 | 292,293 | 2 / 14 | `residual-frontier-v1r2-20261028/tasks/generation-assessment-8102.json` `/result/history/2/board` |
| `16f1b994177db852` | 157 | 292 | 3 / 15 | `residual-frontier-v1r2-20261028/tasks/generation-assessment-8102.json` `/result/history/3/board` |
| `9ff5127a5cd033dc` | 157 | 292 | 4 / 16 | `next-frozen-screen-20261028/exclusions.json` `/keys/899188` |
| `8bb41a257dab8d02` | 157 | 292 | 5 / 17 | `residual-frontier-v1r2-20261028/tasks/generation-assessment-8102.json` `/result/history/5/board` |
| `3c836cd6b55eac39` | 152 | 298 | 4 / 16 | `strong-six-hour-20261027/tasks/generate-train-2832.json` `/games/7/roots/1/board` |
| `b25a54e3d269dc31` | 152 | 298 | 5 / 17 | `strong-six-hour-20261027/tasks/generate-train-2832.json` `/games/7/replayed/12` |
| `2b2f1dcc8cad67f9` | 248 | 360 | 3 / 15 | `admission-attempts/978.json` `/trajectory/moves/replayed/11` |
| `1f3ad0d9cb321720` | 244 | 370,371 | 2 / 14 | `residual-frontier-v1r2-20261028/tasks/generation-training-5211.json` `/result/history/2/board` |
| `4062f42186f576b8` | 191 | 398 | 3 / 16 | `residual-frontier-v1r2-20261028/tasks/generation-games-9131.json` `/result/history/4/board` |
| `5863da9e42ca556d` | 124 | 432 | 4 / 16 | `residual-frontier-v1r2-20261028/tasks/generation-training-2210.json` `/result/history/4/board` |
| `5c02eb49a8cd9fe3` | 208 | 466,467 | 3 / 15 | `history-extra-occurrences.json` `/97011/keys/0` |
| `80d31194fc9fbdb7` | 208 | 466,467 | 4 / 16 | `history-extra-occurrences.json` `/97012/keys/0` |


## Verifier corrections, with original evidence preserved

The first outcome-blind integrity attempt stopped on an overly strong assertion
in the newly written verifier: `exact` was incorrectly assumed to imply
`depth == empties`. The frozen native root reports exact when the full empty
horizon is reached **or no heuristic horizon observations were used**. Early
terminal positions can therefore be exact at shorter placement depth. The native
source and semantics were not changed.

The [audit correction](data/phase-a-tournament/audit-repair.py) checks the original
verifier's preregistered hash, changes only that assertion in memory, and retains
all other original checks. It independently exhaustively solves all **12** shorter
exact cases, checking their numerical terminal scores and optimal selected moves.
A disclosed synthetic early-terminal positive case and corrupted-score negative
case pass. The [exact-case certificate](data/phase-a-tournament/early-terminal-exact-verification.json)
binds every literal board and result. The failed attempt and the original frozen
verifier/snapshot remain unchanged. This repairs an audit assumption, not a game,
endpoint or independence gate.

The first independent publication cross-check also found that the frozen Python
primary analysis interpolates percentile endpoints linearly, while the JS helper
uses a lower order statistic. The score interval and both strength gates matched;
the margin lower endpoint was +4.4550293 in Python versus +4.453125 in JS. The
[publication correction](data/phase-a-tournament/publish-repaired.mjs) preserves
both original sources and matches the explicit frozen primary Python convention
in memory. The [convention certificate](data/phase-a-tournament/percentile-convention-verification.json)
records both values. Both implementations now reproduce the same seeded stratified
bootstrap and Student/bounded results. No observation, sample draw or acceptance
rule changed. One earlier pre-play publication check also hit Node's default
1-MB output buffer on the 1.285-MB registration; it was corrected before any game.

## Opening-stratum results (descriptive)

Each row contains 16 whole families / 32 games. First P color denotes the first
game's P assignment; each family's other game reverses it. These small cells are
not separate confirmatory tests or evidence of phase-specific strategy defects.

| Cell | Source policy | Occupied | Actual turn | First P color | P score | Mean disc margin |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | B1-12% | 12 | Black | Black | 62.5000% | +7.4375 |
| 1 | B4-2% | 12 | Black | Black | 68.7500% | +10.1875 |
| 2 | B1-12% | 13 | White | Black | 45.3125% | +3.7500 |
| 3 | B4-2% | 13 | White | Black | 56.2500% | +1.6250 |
| 4 | B1-12% | 12 | White | Black | 67.1875% | +8.2812 |
| 5 | B4-2% | 12 | White | Black | 71.8750% | +8.5625 |
| 6 | B1-12% | 13 | Black | Black | 45.3125% | +3.1250 |
| 7 | B4-2% | 13 | Black | Black | 57.8125% | +2.4375 |
| 8 | B1-12% | 12 | Black | White | 56.2500% | +1.3125 |
| 9 | B4-2% | 12 | Black | White | 65.6250% | +6.8750 |
| 10 | B1-12% | 13 | White | White | 65.6250% | +5.4688 |
| 11 | B4-2% | 13 | White | White | 67.1875% | +7.4375 |
| 12 | B1-12% | 12 | White | White | 62.5000% | +6.3125 |
| 13 | B4-2% | 12 | White | White | 59.3750% | +6.7188 |
| 14 | B1-12% | 13 | Black | White | 62.5000% | +5.9375 |
| 15 | B4-2% | 13 | Black | White | 56.2500% | +7.2812 |


## Search and time-control observations

Phases are occupied <28 (opening), 28–51 (middle) and >=52 (endgame). Depth
histograms for every player/phase are in the evidence. Moves and phases are
telemetry, not extra strength samples.

| Player | Phase | Moves | Mean / median completed depth | Nodes | Static evaluations | Native search seconds |
| --- | --- | --- | --- | --- | --- | --- |
| B | all | 12,989 | 9.996 / 10 | 17,416,507,914 | 10,781,052,256 | 740.007 |
| B | opening | 3,968 | 9.592 / 10 | 7,111,686,464 | 4,986,073,663 | 315.325 |
| B | middle | 6,139 | 11.786 / 11 | 10,291,157,121 | 5,791,619,865 | 424.222 |
| B | endgame | 2,882 | 6.741 / 7 | 13,664,329 | 3,358,728 | 0.459 |
| P | all | 13,371 | 9.648 / 10 | 16,168,947,478 | 10,153,962,737 | 743.988 |
| P | opening | 3,968 | 9.390 / 9 | 6,561,651,392 | 4,682,278,206 | 315.310 |
| P | middle | 6,149 | 11.588 / 11 | 9,589,776,421 | 5,467,169,645 | 428.083 |
| P | endgame | 3,254 | 6.296 / 6 | 17,519,665 | 4,514,886 | 0.595 |


B completed depths 1–18 and P 1–19, with median 10 for both overall. P averaged
about 0.20 fewer placements in opening/middle searches. That describes work/tree
shape and cannot establish a causal positional weakness or isolate evaluation
cost. Every >=52-occupied move was exact in both players; shrinking remaining
empties make late mean depth unsuitable for a simple strength comparison.

Neither player had a depth-zero fallback or an overrun above 1 ms (therefore none
above 5 ms). Maximum end-to-end overruns were **0.117958 ms for B** and
**0.103292 ms for P**. Ordinary interrupted final iterations numbered 9,089 / 9,129;
these preserve the last completed iteration and are expected timed-search behavior.
Opening calls averaged about 79.55 ms. Exact late searches returned early. No
meaningful time-control failure was detected, and no phase-specific superiority
or weakness is inferred from these descriptive timings.

## Actual resources, time and limits

Actual host: Apple M4 iMac Mac16,3, 10 cores, 24 GiB, ARM64, macOS 27.2 (26B123),
Apple Clang 21.0.0, Node 24.22.1, project Python 3.14.10. The qualified ordinary
`single-target` native CLI was reused, with the established strict floating-point
build options; production Wasm and native engine sources were not modified.

Scored execution ran from charged minute 14.1079 to 43.1805, **29.0726 minutes**. Summed game wall time was 28.9051 minutes, including 6.324 seconds of fresh-process symmetric warmup. Summed move search/IPC time was 24.7658 minutes. Full replay and provenance were complete by charged minute 47.0701; subsequent analysis, public verification, reporting and publication also count in the continuous ledger.

The [resource record](data/phase-a-tournament/resources.json) shows 8.86–9.73 GiB
physical reclaimable headroom across preparation/execution samples, swap occupancy
0.38 MiB and unchanged swap counters 12/24. Disk headroom exceeded 550 GiB. Before
scoring the CPU sample was 93.77% idle; ordinary desktop/indexing/backup activity
was present, but no competing scientific worker. No profiling, training, compilation
or benchmark ran with scored games. A temporary process-scoped `caffeinate` assertion
ended with the game runner; saved power, affinity and security settings were not
changed. No WSL2 or Intel Mac runtime campaign is claimed by this Mac study.

The public [ledger](data/phase-a-tournament/ledger.json) records the uninterrupted
charged span through publication readiness. The local ledger additionally retains
final commit/push/remote-verification time; no interval is reset or deducted.
The 35% forecast allowance and 15-minute reserve were preserved. Historical stopped
budgets remain untouched, and no target reduction or automatic extension occurred.

Remaining limitations are the failed broad provenance gate, unresolved upstream
roles, the retained inventory's documented engineering-pilot retention limits,
conditional synthetic opening distribution, approximate Student/percentile
inference, assumed independence of whole source families, and OS variability in
serial timed searches. Source disjointness is not a proof of universal independence
of every internal node. This is P versus B on the admitted 80-ms Mac-native regime,
not a 300-ms result, browser/Intel/WSL2 performance test, absolute rating, or
proof that historical overlaps caused the observed P advantage.

## Requested conclusions

1. **Full source admission passed?** Yes, within the qualified retained-source
   scope, including all 53,545 historical seeds and added development fixtures.
2. **All 256 families registered before scoring?** Yes; exact literal sources,
   hashes and schedule were remotely published before every game began.
3. **All 512 games within three active hours?** Yes; complete pairs finished at
   43.18 charged minutes, with verification/reporting also inside the allowance.
4. **Complete played-path independence passed?** No: 56 restricted keys, 28 boards,
   15 families, 21 games. All records and games remain included.
5. **P's score?** 60.6445%, 299 wins / 23 draws / 190 losses.
6. **Both predefined statistical gates?** Yes numerically; provenance still blocks
   the independent-confirmation claim.
7. **Consistency with 63.57%?** 2.93 pp lower; broadly consistent within the new
   uncertainty interval, without pooling or declaring equivalence.
8. **Phase/time issues?** No material time-control failure. P searched slightly
   shallower on average; telemetry does not establish a phase-specific weakness.
   Early-terminal exact results were independently validated after fixing the
   verifier assumption.
9. **Limitations?** Especially unresolved historical roles and the strict failed
   whole-sample gate; other sampling/runtime/inference limits are stated above.
10. **Separate 300-ms Mac confirmation justified?** The descriptive playing result
    motivates durability testing, but this run does not justify calling a new
    study clean independent confirmation under the unchanged strict contract.
    First resolve the restrictions or review a separately proposed prospective
    independence policy. No 300-ms study or training was begun automatically.

All scientific sources and immutable historical records are preserved. The final
research commit can be resolved with `git log -1 --format=%H --
docs/PHASE_A_MAC_TOURNAMENT_RESULTS.md`; its exact pushed SHA is reported with the
final publication status. There is no merge or promotion to production.
