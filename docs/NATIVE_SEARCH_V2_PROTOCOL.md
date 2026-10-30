# Native P versus native B: prospective V2 contract

This is a new 2,048-game experiment on the M4, separately registered before any
scored outcome. It uses original B and frozen P, without fitting or production
promotion. `scripts/native-v2/protocol.mjs` is the machine contract. Historical
reports, source snapshots and games remain immutable.

All 768 new families receive two color-swapped games at 80 ms. The 256 families
whose 16-cell cycle number is divisible by three also receive both colors at
300 ms. The balanced cells cross B1/12% versus B4/2% source policy, occupied 12
versus 13, simultaneous board-color/actual-turn reversal, and first P color.
There are 48 families per cell at 80 ms and 16 per cell at 300 ms. Shuffle seed
2026103016 and cycle/cell parity determine family and first-condition order.
No score-dependent removal, extension, repeated testing or early superiority stop.

Source generator namespace is `native-v2-p-v-b-20261030`. Reuse the verified
historical membership, engineering and additive indices read-only. Add the
previous 768-family confirmation's complete source trajectories, roots, children
and played paths, both native engineering screens, new disclosed engineering
roots and pilot games. Admit complete generated nonterminal trajectories from
occupied 12 and root children only when disjoint from these indices and every
other new admitted source. Verify full source replay and record every rejected
attempt. A fully random common prefix below occupied 12 is allowed. Under the
original generator a 12-occupied opening contains only that random prefix; a
13-occupied opening contains one subsequent policy move. Policy names describe
complete source generation and exclusion conditioning, not expert opening books.

The primary independence claim is fresh **source families with disjoint declared
ancestry and direct root/child separation** under the available indices. It is
not universal novelty of every searched or later played board. Subsequent played
transpositions, terminal convergence and unrelated historical internal-tree states
are retained and attributed by role. An actual historical direct-target reuse or
unresolved role limits broader board-novelty/independent-confirmation claims;
it never causes replacement, deletion or selective stopping. The historical
strict confirmation's failed gate remains failed. Before opening aggregate score
summaries, audit all indexed played overlaps against historical occurrences,
actual L/P direct fitting panels and known older direct-target proofs. Report
remaining incomplete historical roles rather than inventing provenance.

Both competitors use the same final executable, model selection, one search
thread, nominal 16 MiB TT ceiling (actual allocation disclosed), bounds and
ordering policy. Each evaluator has its own persistent process within a game.
Restart both before every game and warm both on the same four disclosed roots,
at depths 3 and 5 using its own coefficients; alternate warmup order with game
parity. This prevents shared or cross-game TT histories. Score bounds always
start a fresh generation per iterative depth. Ordinary timed play has natural
placement limit equal to empties, with passes preserving depth; only completed
iterations publish values. No leaf clocks in production. Input transport consumes
the budget through fresh wall-clock deadlines; elapsed search uses steady time.
Output transport and scheduling are measured as overrun. Completed exact searches
can return early. Explicit diagnostic fixed horizons retain their exact meaning.

Games run serially without competing scientific workers. Record complete moves,
final boards, P scores/margins, completed depths, nodes/evaluations, CPU and elapsed
time, all TT/cutoff counters, exactness, interrupted iterations and overruns.
Atomic per-move prefixes and immutable per-game receipts are fsynced, renamed
and directory-fsynced. Resume validates identities and independent legal replay.
Integrity/resource/allowance failure pauses with data retained, never with an
incomplete value relabeled as exact. Qualify real process restart and tamper
rejection before registration.

The primary hypothesis is mean P family game points above .5 at 80 ms; 300 ms is
separately registered durability. Complete color-swapped family means are units.
One-sided Student tests at alpha .025 each control simultaneous superiority at
familywise .05 by Bonferroni, irrespective of shared-family dependence. Use
positive Student survival quadrature; report paired two-sided 95% intervals,
variance, disc-margin intervals, and Hoeffding lower bounds
`mean - sqrt(log(40)/(2*n))`. Hoeffding assumes independent bounded [0,1] families
and stable conditions; exclusion conditioning and OS timing limit ideal sampling
claims. Percentile bootstrap uses 10,000 whole-family resamples, seed 2026103017
plus budget; repeat with seeds +1/+2 as sensitivity. On the common 256 families
jointly resample 300-minus-80 scores using seed 2026103017. Do not pool budgets
as independent. Subgroups and phase/depth telemetry are descriptive only.

Conventional evidence requires both Student lower bounds above .5; disclose
bootstrap agreement and separately whether both distribution-free lower bounds
clear .5. An 80 ms failure cannot be rescued by 300 ms. No automatic promotion
or new training regardless of outcome. Report the uncertainty of the matched
thinking-time contrast; mean differences alone do not establish a time effect.

The cumulative active measurement ceiling is eight hours, including retained
profiling, benchmarks, preparation, games and audits. Ordinary engineering tests
are separate. Before scored results, forecast all 2,048 games using the greater
of measured high-tail complete game time and every possible remaining placement
using its full budget. Add measured checkpoint overhead, warmup and 30 minutes
for replay/provenance/statistics/independent audit, multiply remaining work by
1.35, retain a separate 20-minute reporting reserve, and include all spent work.
Stop before scores if it cannot fit; no silent sample reduction. Require at least
3 GiB physical headroom, no sustained swapping and no competing scientific jobs.
Use bounded caffeinate without saved power changes. Freeze sources, executable,
models, TT settings, sample, schedule, tests and statistics before play, and
publish/commit the registration plus separate Python reservation audit first.
No engine optimization after scored outcomes open.
