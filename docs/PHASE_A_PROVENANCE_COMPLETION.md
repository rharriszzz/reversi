# Phase A provenance completion on the M4

**No-go for preregistering/running the 512-game study within the existing two-hour
ceiling. The historical inventory is now qualified for conservative admission
against the identified sources; the complete time gate fails.** No new opening
sample or scored tournament was created. B remains the application default.

Work is on `research/phase-a-provenance-completion-20261031`, based on `064d1f8`.
The original Phase A branch, archives, qualification, historical failed gates,
production `main`, engine, coefficients and Wasm are preserved.

## Verified transfer and inventory

All fourteen recent PC directories are present at
`/Users/rharris/git/reversi/.local-research/phase-a-pc-transfer`: **3,184 file/link
records, 789,997,683 logical bytes**. The previously abbreviated fast-flips run
is the two actual `fast-flips-pc-native-20261031` and
`fast-flips-pc-portable-20261031` directories. Every previously missing run family
is accounted for. The tiny PC native-V2 supplement is only a measurement ledger;
the complete native-V2 experiment is the retained Mac directory.

The user verified all directories matching `.local-research/*20261030*` and
`.local-research/*20261031*` from WSL2, looping over each directory with:

```bash
rsync -av --checksum --stats "$src/" "$MAC:$DEST/$name/"
rsync -nac --itemize-changes "$src/" "$MAC:$DEST/$name/"
```

The checksum dry run reported no files needing transfer. This first-hand
source/destination verification is accepted and recorded in the
[transfer evidence](data/phase-a-provenance/transfer.json), alongside independent
Mac SHA-256 identities and public receipt/hash matches. Raw rsync transcripts
were not supplied; the procedure/result are user-attested. **No recopy or
additional PC manifest is required.** No hostname was guessed or network/security
setting changed. Symlinks are hashed literally without following their targets.

The [coverage record](data/phase-a-provenance/coverage.json) binds the versioned
inventory, original and local paths, per-file SHA-256, role/occurrence layers,
seed registry and final full-SHA membership. The original **128,899-file,
21,723,183,394-byte** import and its verified 33,724,618-occurrence layer are reused
by digest; the original 21.7 GB was not recopied or rehashed. Later retained Mac/PC
sources, public projections, software/profile identities and reconstructed fixtures
add a **146,011-record catalog**. These counts include copies/aliases and are not
independent scientific samples.

All **4,823 initial serialized path-format exceptions** were resolved using actual
query roots, rejected-attempt inputs, accepted reservations, explicit opening
bindings and the original teacher convention that PVs follow the root move.
Independent mailbox replay also checks serialized endpoints/final boards where
retained. Binary bitboard workload inputs are decoded separately. The original
exceptions remain diagnostic history, not accusations of corrupt archives.
Four non-scientific parser exceptions are explicitly retained: an empty discarded
pilot output, one Windows UI-tree text encoding, and two Windows resource reports
with appended text. They contain no unidentified training/assessment board records.

The final sorted index contains **17,321,472 canonical keys** (SHA-256
`6e959bb877d14a96c1938090f0e94db5fc08118ee358ef949c75a7aaf5b5d9d0`).
It and the compressed occurrence streams remain local under
`.local-research/phase-a-provenance-v1/inventory-v1` and its bound extraction.
The committed [PC file catalog](data/phase-a-provenance/pc-files.jsonl.gz) is compact;
bulk membership, traces, binaries, models and archives are not committed.

## Roles, restrictions and remaining retention limits

The inventory distinguishes generated/rejected ancestry, reserved alternatives,
queried panels, returned continuations, played paths, internal static observations
and unresolved membership. A generator's `training` declaration alone never proves
an applied fit. Every original restriction survives the union; independent mmap
membership checks retain all **65** original confirmation restrictions and the
later native-V2 **two prohibited / 48 unresolved** restrictions.

The original two-empty overlap is one board under symmetry, with two conservative
turn keys: accepted game `train-22614-1035056215`, `states[42]`, shard 2826, applied
fit `cycle-36-fit-linear-margin-p4-2823`. This is actual use by the **older unrelated
linear-margin-p4 evaluator**, not evidence of direct fitting by P or L. The verified
1,600 training / 400 development P/L panels, 76,274 direct-state keys, original
corpus and frozen-model hashes retain their separate proof. The old audit found
no original-65-flag match to those panels. The original failed strict gate remains
failed; no affected family is deleted or replaced.

A newly reviewed Safari custom-training smoke is also **unrelated to frozen P/L**.
Its first-attempt seed is fixed by the historical UI. The mutation exactly
reconstructs saved weight hash `c3039f0a86abdc0ec11135bd9edfb8a651819ec40429c5e94a2062e0f06e5048`.
The four paired, fixed-depth selection openings and eight paths were recovered
with byte-identical historical rules/search/learning sources and independently
replayed. Their states are conservatively restricted as **unrelated model-selection
assessments**. No outcomes, margins, acceptance decision or new learning were
computed. This is different from merely calling every engineering observation a
training target.

Two old **P-native versus P-Wasm timing pilots** have a genuine retention limit:
`mac-modernization-20261030/backend-pilot-timing.json` and `backend-pilot.log`
retain timings only. The registered, hash-matching `scripts/mac/backend-games.py`
discards those pilots' returned steps. Their exact seeded prefixes, roots and
alternatives have been recovered; their timed played paths cannot be recreated
faithfully. `backend-games.sealed.jsonl` contains the different 256-game engineering
comparison. The collector establishes the pilots' engineering purpose; no fitting
or evaluator-selection use is inferred. This limits a universal claim about every
past observation, but is not a missing P/L target/assessment panel or a reason to
invent training leakage. All available known engineering observations remain
conservative admission restrictions.

**All identified necessary PC archives and retained target/assessment sources are
accounted for.** No further missing PC file has been identified. Qualification is
scoped to those verified sources and known historical restrictions; it is not a
claim of universal novelty of every past internal node. Unknown recorded roles
remain excluded. The new sample itself is absent, so actual source admission and
the subsequent whole-sample encounter audit have not passed merely because the
inventory is ready.

## Conservative M4 forecast and execution plan

Actual machine: Mac16,3 Apple M4, 10 cores, 24 GiB, macOS 27.2 (26B123), Node
24.22.1, project Python 3.14.10. The existing ordinary ARM64 CLI was reused:

```text
/Users/rharris/git/reversi-phase-a-mac/.local-research/native/reversi-native
SHA-256 aee4e98b2d00d1631c61383a3b6dbf11d716a47673276bf1eefa4fc52f0323f1
fingerprint 118ac8f1ac74571993db0d7976e801d541aa6a52780d91448f092dbd0f511818
```

Native sources/model hashes were checked against the completed qualification;
that qualification was not repeated. Ordinary ARM64 reports `single-target`;
`NATIVE_CPU=dispatch` is not used. No competing scientific worker ran during fresh
timing. Physical headroom was 8.40–8.64 GiB, swap occupancy 0.38 MiB with
unchanged swap counters, and free disk exceeded 554 GiB. No affinity, power,
security or saved sleep setting changed. The [forecast](data/phase-a-provenance/forecast.json) retains every timing,
including the slowest checkpoint sample:

| Remaining component | Raw minutes |
| --- | ---: |
| 512 × at most 52 searches, at least 81 ms/search | 35.94 |
| Fresh B/P processes and symmetric disclosed D3 warmup | 0.24 |
| Durable checkpoints: twice worst 64 KB fsync, at most 106 steps/game | 16.80 |
| Coverage revalidation | 5.00 |
| Source admission and freeze | 12.00 |
| Independent reservation audit | 3.00 |
| Complete replay, role audit and statistics | 15.00 |
| **Raw remaining total** | **87.98** |

`1.35 × 87.9844 + 15 = 133.78 minutes`: **fails 120 minutes even before spent
preparation**. At collection time the recorded preparation span/allowances raised
the complete continuation estimate to about 179 minutes; subsequent reconciliation
and reporting add time. The non-search allowances are explicit planning bounds,
not measurements of a completed 512-game pipeline. Search-only timing is not a
complete forecast. One spent-time field-name lookup was corrected separately;
all measured samples/components were preserved, without retiming to seek a pass.

The pure [draft protocol](../scripts/phase-a-mac/prospective-protocol.mjs) fixes 256
families, 16 per each of 16 policy/parity/actual-turn/first-color cells, adjacent
color pairs, frozen P versus B, 80 ms, serial native execution, natural horizons,
separate 16-MiB TTs and symmetric disclosed D3 warmup. It creates neither openings
nor outcomes and fails closed without registration bindings. Its future endpoint
is the mean of 256 complete family point averages: require both one-sided .05
Hoeffding and approximate Student 95% lower bounds above .5; the bounded score
threshold is **strictly above 57.64920885%**. Use 10,000 stratified whole-family
bootstrap resamples as sensitivity, no interim tests, extensions or pooling.

Before scoring: qualify a complete forecast that fits an explicitly agreed time
allocation; bind the final index/role lookup and executable; adapt the existing
`residual/data.mjs` generator and `frozen-player/execution.mjs` admission checks to
the draft; implement the 256-family checkpoint/registration coordinator using
`native-v2/game.mjs`/`native/client.mjs` semantics; freeze literal source trajectories,
attempts/rejections and full schedule; independently verify them and publish the
registration. Recheck CPU, memory, swap and disk; run serially with no scientific
competitors. After games, independent legal/receipt/played-path audits must precede
aggregate scores. The historical `p-confirmation/run.mjs` and `native-v2/run.mjs`
are **2,048-game runners** and must not be launched for this draft. No ready-to-run
512-game coordinator or accepted literal sample is falsely claimed here.

## Prospective policy proposal, not adopted

Keep the old broad prohibition, including unrelated historical targets, for the
current draft. Incidental late convergence is not source-family duplication or
proof of fitting; a key with both incidental and applied-target occurrences still
inherits the target restriction. Any prohibited/unresolved encounter blocks the
whole strict study, without replacement or clean-subset rescue.

For a separately reviewed future strength experiment, independence could instead
focus on fresh families and separation from data influencing P/L fitting,
development, selection and test design, while disclosing incidental convergence
with unrelated models. This narrower causal claim may be more practical than
requiring a novel late board relative to every old evaluator. It requires explicit
prospective review and has not been adopted. It cannot repair the historical
failed gates or justify changing them after scores.


## Verification and publication

Fast checks passed 26 Node tests. The full Python suite passed 60 tests with
inputs fixed. Its earlier attempt correctly refused a frozen-runner resume when
a new audit script was added during the suite; the failed log is retained and
was not used as a pass. Known nonfatal subprocess/HTTPError ResourceWarnings
remain. The final historical source-closure guard was additionally checked by
byte-identical reconstructed paths and 14 targeted Python tests plus the two
protocol tests. These are correctness checks, not fresh strength observations.

A second Mac rehash verified every one of the 3,184 PC file/link records unchanged;
all 146,011 retained-catalog metadata records remained stable. Native/Wasm diffs
against `064d1f8` are empty, the original user-ledger prefix is byte-preserved,
and both original research/production remote SHAs are recorded in the manifest.
Intel Mac execution and a new WSL2 runtime campaign were not performed.

Reproduction uses fresh output paths; never overwrite historical evidence:

```bash
export REVERSI_PYTHON=/Users/rharris/git/reversi/.venv/bin/python
node --test tests/rules.test.mjs tests/exact-solver.test.mjs \
  tests/engine.test.mjs tests/frozen-player.test.mjs \
  tests/p-confirmation.test.mjs tests/phase-a-prospective.test.mjs
TMPDIR=/private/tmp "$REVERSI_PYTHON" -m unittest discover -s tests -p 'test_*.py'
# Keep source inputs fixed throughout the tests above.
"$REVERSI_PYTHON" scripts/phase-a-mac/check-transfer.py \
  .local-research/phase-a-provenance-v1/extraction-3/files.jsonl.gz \
  /tmp/phase-a-transfer-recheck-new.json \
  --verification docs/data/phase-a-provenance/transfer-verification.json
"$REVERSI_PYTHON" scripts/phase-a-mac/review.py \
  .local-research/phase-a-provenance-v1/extraction-3 \
  /tmp/phase-a-coverage-recheck-new.json \
  --reconciliation .local-research/phase-a-provenance-v1/inventory-v1/manifest.json \
  --transfer-verification docs/data/phase-a-provenance/transfer-verification.json
git diff --check
```

The coverage JSON preserves complete source-root configuration and file identities.
`inventory.py` builds the retained-file/occurrence layers; `reconstruct-engineering.mjs`
and `reconstruct-custom.mjs` reproduce disclosed historical inputs; `reconcile.py`
adds bound continuations, custom-selection paths, bitboard inputs and pilot roots.
`forecast.mjs` is disclosed-root/scratch-I/O calibration only, with no game launcher.
The source-catalog helper is optional audit tooling, not another PC-transfer gate.

Publication uses `git commit -m 'Complete Phase A historical provenance inventory'`
and `git push -u origin research/phase-a-provenance-completion-20261031` after
checks, followed by exact `git ls-remote` verification. Resolve this report's commit
with `git log -1 --format=%H -- docs/PHASE_A_PROVENANCE_COMPLETION.md`.
No production merge or promotion is performed.
