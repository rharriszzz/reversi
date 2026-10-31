# Phase A Mac confirmation: stopped at historical coverage

**No scored games were launched. The complete provenance prerequisite could not
be certified, so this round supplies no new P-versus-B strength estimate.** The
original independence failures remain failures. B remains the production default.

This is a preflight/qualification result, not a registered partial tournament.
The requested 256-family, 512-game experiment was neither reduced nor extended.
See the [occurrence-level reinspection](data/phase-a-mac/preflight.json),
[native qualification and disclosed calibration](data/phase-a-mac/qualification.json),
and [publication manifest](data/phase-a-mac/manifest.json).

## Checkout and actual Mac

On 31 October 2026, initial local `main` and the existing integration worktree
were clean at `e955e992708b7138b5c0f704451e17e3dee4484a`. Fetch advanced the
remote-tracking branch to
`a560896ef54a3c4cec19974ed8cbc2064e177e4b`, exactly the expected production SHA.
Work uses the new `research/phase-a-mac-confirmation-20261031` branch and
`/Users/rharris/git/reversi-phase-a-mac` worktree based on that remote commit.
Neither original worktree nor its ignored research directories was switched,
reset, cleaned or overwritten.

Actual host: Apple M4 iMac Mac16,3, ten cores (four performance/six efficiency),
24 GiB RAM, ARM64, macOS 27.2 (26B123), Darwin 27.2.0. Compiler: Apple Clang
21.0.0 (clang-2100.4.1.1), installed Xcode toolchain. Node 24.22.1. The shell's
`python3` is 3.13.18; the existing qualified project interpreter is **3.14.10** at
`/Users/rharris/git/reversi/.venv/bin/python`, selected explicitly. No toolchain
installation, PC computation, affinity, power or security change was performed.

The ordinary build uses `CXX=clang++ NATIVE_CPU=portable`, with
`-O3 -std=c++17 -Wall -Wextra -Wpedantic -ffp-contract=off -fno-fast-math`.
There is no dispatch macro or x86 enhanced translation unit. `hello` correctly
reports **`single-target`**; `portable` is the build option name, not the ordinary
ARM64 runtime diagnostic. Production Wasm was neither rebuilt nor modified.

| Exact identity | SHA-256 / value |
| --- | --- |
| Native CLI | `aee4e98b2d00d1631c61383a3b6dbf11d716a47673276bf1eefa4fc52f0323f1` |
| Build fingerprint | `118ac8f1ac74571993db0d7976e801d541aa6a52780d91448f092dbd0f511818` |
| Frozen generated coefficient header | `1b286ed8371f0a2cd957b06b679e7422b68b3699cb7c8fe7c9f50968d27ceba1` |
| B | `original-production` |
| Nested frozen L | `ecf3fd376c680ced77d0b002ea2efb9fa4385737c4fffff734b901ab2968d97f` |
| Frozen P | `de4b84745589b0384ea3639f879e3c98990e802d176298ff8ef54f681520067f` |
| L/P training/development corpus | `9d31921709aca433c4ac9f2e31c43292e2fa2a5b83f07ae1b7c3b1ef21a68c64` |

The build receipt binds every native source/include/client hash and compiler
flag. No engine, rules, evaluator, coefficients, TT semantics, timing convention,
browser UI or model-selection default changed.

## Historical archives actually inspected

Both `pc-import-20261029` and `p-independent-confirmation-v1-20261029` are present
under the original checkout's `.local-research`. A fresh, complete read-only
rehash of the PC import is byte-identical to its previously qualified inventory:
**128,899 entries, 21,723,183,394 bytes**, inventory SHA-256
`df1d545dfe3bb88c42af9a0aeadf57b20832660aa59ea8df52cece260043e861`.
No missing, added or changed entry was found. Reviewed historical symlinks are
recorded literally without following them. The newly written inventory resides
in this worktree's fresh ignored run directory, outside the historical inputs.

The inspected records include:

- Original L/P artifacts in the constraint-pattern campaign's `engineering-v2`;
  both compare exactly to the published frozen models. All 1,600 training and
  400 development preference groups reconstruct the published corpus hash.
  Reinspection of all 2,000 actual decision panels gives **76,274** conservative
  direct-state keys. None of the original confirmation's 65 flagged keys matches
  that panel set. This is a panel-specific finding, not universal historical
  completeness or proof about why P scored well.
- The older `strong-six-hour-20261027` training shards, archived learner and
  coordinator, applied-fit manifest/cursor and fit receipt. The two turn keys
  for the previously proved nonterminal two-empty board again match accepted
  `train-22614-1035056215`, `states[42]`, shard 2826, used by completed fit
  `cycle-36-fit-linear-margin-p4-2823`. That fit is the **older linear-margin-p4**
  evaluator. This is actual applied use, without evidence that frozen P or L
  trained on that board. The old tournament's failed strict gate is unchanged.
- The earlier 400 assessment reservations, the later 256 assessment and **384
  reserved unused game openings**, plus teacher tasks, source trajectories,
  behavior games, engineering fixtures and occurrence/role records. The old
  exploratory screen retains 256 roots/384 games; the P confirmation retains
  768 roots/2,048 games; native V2 retains 768 roots/2,048 games. These are
  historical exclusion material, not fresh observations in this round.
- The native V2 direct development-query proof: the two keys at
  `development-50` parent 1 match its frontier and D10/D12 label receipts. This
  remains a development/assessment restriction, not a new assertion of gradient
  fitting. Its other 48 unresolved historical keys remain restricted.

The separate Python path uses padded-mailbox rules and independently computes
D4, simultaneous color/turn reversal and conservative both-turn identities. It
reconstructs all **333 recorded occurrences behind the 65 original flags** from
literal boards, canonical encodings, legal behavior paths, reserved children,
student-search observations and teacher continuations. Raw file hashes match
the original inventory. The Node path additionally checks 15 applicable task
input/result receipts and all 2,000 frontier result hashes.

For the other **63** flags, the new record identifies occurrence roles for 36
keys without an opaque upstream role in those recorded occurrences; **27** still
have at least one unresolved upstream occurrence, principally copied exclusion
membership or encoded ancestry. This distinction is not a clearance: all 63
original restrictions are retained. Accepted ancestry, a rejected generator,
an internal static observation, a played path, a reserved child and an applied
training target are recorded separately. A sampled state or an intended role by
itself does not establish applied fitting. All original reports/audits remain
unchanged. Retaining unknown keys as exclusions can be valid prospectively;
their existence alone is not the new coverage blocker.

Reusable base, engineering, confirmation-addition, direct-panel and native V2
addition files were read and checked against their recorded SHA-256 digests,
including the full historical compressed occurrence stream. Their identities
are published in the preflight evidence. They are **layers**, not a newly
certified complete current exclusion inventory.

## What prevents scored launch

The Oct 29 import predates substantial Oct 30–31 PC engineering/acceptance work.
The following documented raw run directories were not found in any of the three
inspected Reversi worktrees' research roots:

```text
windows-pc-20261030
fast-flips-pc-20261031
runtime-cpu-20261031
runtime-cpu-final-20261031
runtime-cpu-followup-20261031
pc-production-followup-20261031
pc-final-production-20261031
```

Their committed summaries and some complete public game paths are available.
They do not provide a post-import complete PC artifact inventory or a verified
role/membership supplement binding every later query continuation, engineering
observation and stopped/partial input. Availability of a public performance
summary cannot establish the absence of additional historical observations.
Some disclosed fixed fixtures can be reconstructed; that does not certify the
entire later archive. No claim is made that every listed directory necessarily
contains a unique prohibited target.

The Mac-origin later native, profiling, optimization, browser and integration
directories are present, including the runtime integration worktree. Their
additions also must join a verified current exclusion inventory with the later
PC material before source admission. That complete reconciliation was not
certified in this round; the preserved old layered index is insufficient to
assert it already happened.

SSH configuration contains only a wildcard identity setting; known hosts identify
GitHub, with no PC destination. No newer Reversi archive was found by the scoped
top-level check of Downloads/Documents/Desktop. An existing authorized transfer
destination or newer local archive path was requested; none was available when
this report was prepared. No host/credential was guessed, connection configured,
or PC evaluation launched. No transfer occurred, so there is no transfer checksum
claim. Originals remain unchanged.

To remove the blocker, obtain a read-only **post-import PC inventory and the
missing source/receipt/trajectory material or an independently verified complete
role/key export**, hash it before/after copying into a fresh Mac directory, then
reconcile it with all later Mac inputs. Preserve every conservative unknown
restriction. Missing per-run raw data may be substituted only by demonstrated
complete coverage, not by an assumption that the work used familiar fixtures.
All analysis and any eventual calibration/games must continue on the Mac.

## Qualification, calibration, budget and gates

Initial rules/confirmation/frozen-player checks: 16/16 pass. Ordinary native
search/V2/endgame/build checks: 17/17 pass. ASan/UBSan native/V2/endgame checks:
16/16 pass. Coefficient checks cover all 21,870 stored Float32 cells and all 63
double weights. The suites exercise independent move generation/flips, minimax,
exact endings, forced passes, terminal empties, TT reuse/collisions/generations,
model/depth changes, natural timed horizons, interruption and recovery. Additional
Python decoder tests check public canonical identities, negative-cell encoding,
illegal replay rejection and forced-pass teacher prefixes.

Final fixed-input verification passes **186 Node tests** with one expected
Linux-x86-dispatch skip on ARM64, and **51 Python tests**. The initial Python
collection correctly refused a research-runner resume when a new audit test was
added while that collection was running; its failure log is retained. The full
rerun held source inputs fixed and passed, including the source-freeze/restart
guard. Existing nonfatal Python subprocess/HTTPError ResourceWarnings remain
visible. Native and Wasm source/artifacts match the production base byte-for-byte.

Disclosed calibration uses the first 16 existing `native-engineering-*` roots,
whose literal boards and keys are included in the qualification evidence. There
is no new confirmation sample. After depth-three B/P warmup, 32 serial 80-ms root
queries use the exact native CLI above; each published nonzero horizon is checked
against a complete fixed-depth search. No compilation, test suite, profiling or
other benchmark runs alongside the **retained isolated calibration**. Its maximum
interface time is used to estimate only the search/IPC component: approximately
**35.54 minutes** for 512 games × at most 52 placements. Exact searches may return
early. This is neither a measured 512-game duration nor a complete forecast.

The prior Mac campaign's 2,048 games and audits took about 210.51 active minutes.
Scaling that total by four gives about 52.63 minutes as historical planning
context; it does not price the new provenance work or certify the current study.
The required `1.35 × complete conservative forecast + 15 <= 120 minutes` gate
therefore remains **unqualified**: missing archive acquisition/reconciliation
and the final exclusion/admission/audit costs have no reliable complete bound.
The maximum raw total allowed by that inequality is 77.78 minutes, before
accounting conservatively for work already spent. No sample reduction, time
extension, score inspection or scored-game checkpoint was used to work around it.

Resource observations show about 558 GiB free disk, 0.38 MiB swap occupancy,
unchanged cumulative swap-in/out counters (12/24), and ample memory headroom.
CPU idle samples include 67.11%; ordinary desktop/indexing activity is present.
No competing Reversi research process was found before isolated timing. Resource
samples, final test receipts, artifact sizes and the measured elapsed preparation
span are bound in the manifest. This stopped preflight stays within two hours;
it does not demonstrate that the complete study would fit.

One initial diagnostic assertion incorrectly expected `portable` instead of
`single-target` and stopped before calibration; its failure log is retained.
One later calibration collection overlapped regression tests; its original
artifact is retained locally and excluded from timing evidence. The isolated
collection above is the reported calibration. No engine change or scientific
game resulted from either collection issue.

| Acceptance gate | Decision |
| --- | --- |
| Latest remote state, isolated worktree | Pass |
| Ordinary Apple Silicon native/model correctness | Pass |
| Original PC import preservation and specific overlap reinspection | Pass within stated scope |
| Complete current historical coverage/exclusion inventory | **Not passed** |
| Complete conservative two-hour launch forecast | **Not qualified** |
| Frozen independent opening sample and schedule | Not created; prerequisite blocked |
| 512 complete scored games / paired checkpoints | Not run: 0 games |
| Independent complete-sample replay and played-path audit | Not applicable |
| Registered statistical acceptance | Not evaluated |

## Requested study and scientific conclusions

The requested design remains 256 fresh source families, 16 per cell across the
existing 16 policy/parity/turn/first-color cells, both colors adjacent per family,
512 games, 80 ms, exact frozen B/P, ordinary native natural timed horizon and
unchanged search/TT/deadline semantics. The B1/12% and B4/2% complete source
trajectories, 12/13-occupied starts, historical and mutual ancestry/root/child
exclusions, and strict whole-sample encounter gate remain requirements.

There is **no preregistration** of literal new openings, seed namespace, rejection
log, replacement reserve or color/order schedule: creating/qualifying that sample
was conditional on passing preflight. Those fields are absent, not silently
filled by historical openings or retrospective choices. No registered game
outcomes, W/D/L, mean margins, confidence bounds, bootstrap intervals or strength
search-depth distribution exist for this round.

For a future properly frozen run, the endpoint is the mean P points of 256 whole
color-swapped opening pairs. One-sided alpha is .05; require both the stipulated
Hoeffding lower bound and approximate one-sided Student 95% lower bound above
.5, reporting any disagreement. The bounded radius is .07649208846, requiring
an observed score **strictly above 57.64920885%**. The 10,000-resample bootstrap
must resample whole families within the 16 strata as sensitivity. These are the
requested criteria, not tests applied to this empty sample. Source admission,
played-path convergence, prohibited targets and unresolved encounters must stay
distinct; any prohibited/unresolved played encounter blocks the whole fixed study.
Never replace or delete an affected family after outcomes.

Explicit answers:

1. **Archives available?** The named original PC import and Mac confirmation are
   available and verified. Necessary complete later-PC coverage was not available
   in the inspected locations; universal current coverage is not certified.
2. **Complete provenance preflight passed?** No.
3. **Qualified native used throughout?** The identified ordinary Apple Silicon
   CLI supplied the retained calibration. No tournament was launched; sanitizer
   binaries were separate correctness tools.
4. **All 512 games within budget?** No scored games were played. This is a prerequisite
   stop, not a time-cap interruption or partial confirmation.
5. **New sample passed independence?** No new sample was admitted or audited.
6. **New P score?** Unavailable, not 0% and not a carry-forward of the old score.
7. **Registered statistical criteria passed?** Not evaluated.
8. **Reproduced 63.57%?** No new estimate exists. The old 63.5742% at 80 ms and
   61.7188% at 300 ms remain favorable but provenance-restricted historical results.
9. **Recommend a new 300-ms confirmation?** This round supplies no additional
   strength evidence for that recommendation. First resolve coverage and complete
   a clean 80-ms confirmation; retain the prior motivation for later durability
   testing without claiming it has been newly justified here.
10. **Limitations?** Incomplete current historical coverage/role reconciliation,
    no complete launch forecast or registered sample, no new games or inference.
    Any eventual result would concern 80-ms Mac-native P versus B on the admitted
    opening distribution, not 300-ms superiority, an absolute rating, Intel Mac
    runtime qualification or an identical Windows/browser performance measurement.

B stays the default. All historical failures, favorable results and original
archives remain preserved. Publication is confined to this research branch.

## Reproduction and publication

Use a fresh output filename for every read-only reinspection; existing evidence
is immutable. Commands run from this worktree on the Mac:

```bash
export REVERSI_PYTHON=/Users/rharris/git/reversi/.venv/bin/python
export CXX=clang++ NATIVE_CPU=portable
"$REVERSI_PYTHON" scripts/frozen-player/inventory.py \
  /Users/rharris/git/reversi/.local-research/pc-import-20261029 \
  /tmp/phase-a-pc-inventory-new.json --record-reviewed-pc-links
"$REVERSI_PYTHON" scripts/phase-a-mac/preflight.py \
  /Users/rharris/git/reversi/.local-research /tmp/phase-a-pc-inventory-new.json \
  /tmp/phase-a-preflight-new.json
node scripts/phase-a-mac/qualify.mjs \
  /Users/rharris/git/reversi/.local-research /tmp/phase-a-preflight-new.json \
  /tmp/phase-a-qualification-new.json
node --test --test-concurrency=1 tests/*.test.mjs
TMPDIR=/private/tmp "$REVERSI_PYTHON" -m unittest discover -s tests -p 'test_*.py'
git diff --check
```

Run timing separately from tests/builds. `preflight.py` is deliberately an
inspection-only tool: it cannot authorize launch, even if a missing directory is
later copied. Its published coverage findings describe this inspection, not a
general automatic completeness test. A future coverage certificate and complete
preregistration still require independent review of the actual later inputs.

The final manifest records verification commands/statuses and exact file hashes.
Publication commands, after the successful checks, are:

```bash
git add USER_REQUESTS.md docs/PHASE_A_MAC_CONFIRMATION_RESULTS.md \
  docs/data/phase-a-mac scripts/phase-a-mac tests/test_phase_a_mac.py
git diff --cached --check
git commit -m 'Record blocked Phase A Mac confirmation preflight'
git push -u origin research/phase-a-mac-confirmation-20261031
git ls-remote origin refs/heads/research/phase-a-mac-confirmation-20261031 refs/heads/main
```

The verified research-branch SHA is returned after publication. Resolve this
report's commit with `git log -1 --format=%H --
docs/PHASE_A_MAC_CONFIRMATION_RESULTS.md`. No production merge is performed.
