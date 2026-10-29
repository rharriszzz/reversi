> Continuation, 29 October 2026: the user transferred the complete PC archive to the iMac. The local read-only extraction now passes, including exact L/P identities, the training/development corpus hash, receipt/PV/game replays and the missing 1,326 engineering-game keys. No further PC transfer is requested. The original blocker and requirements below are retained as historical documentation; see [current screen results](FROZEN_PLAYER_SCREEN_RESULTS.md).

# PC provenance package required before the frozen-player screen

The M4 contains only the benchmark installation/runs and committed summaries. It does **not** contain the six-hour campaigns, teacher research receipts, original residual run or latest constraint/pattern run. The compact numerical publications cannot certify all historical sources, direct learning targets, unused reservations, engineering-game descendants or query PVs. Exact L and P artifacts need not be transferred: their published coefficients/metadata reconstruct the required checksums on the Mac.

No independent scientific sample or scored outcome has been generated. This is an explicit provenance blocker, not a failed preference gate. The four-hour scientific allowance has not started.

## What to build on the Windows/WSL PC

Work in `/home/rharris/git/reversi`, after pulling the engineering commit. Keep every historical run unchanged. Create a **new** export directory outside the historical inputs. Do not transfer multi-gigabyte raw corpora to the Mac or commit the compact private membership package.

First inventory the entire historical local directory while no research process is writing to it:

```bash
python3 scripts/frozen-player/inventory.py \
  .local-research /tmp/reversi-history-inventory-20261029.json
```

This read-only helper hashes each file and refuses symlinks or per-file mutation; it does not itself certify scientific completeness or derive role metadata. Run it again at the end of export and compare inventories to establish that the whole input tree stayed unchanged. Review stale temporary files explicitly rather than deleting them to obtain a convenient inventory.

The required package is a new, audited export, not just a copy of the old `historical-index.bin`. It must contain:

1. A complete run/artifact inventory: relative paths, byte lengths, SHA-256, run/protocol/source identity, receipt/result hashes, inclusion purpose, parsed/unsupported/error counts and excluded-file reasons. Include stopped and partial runs and all unused reservations, not only successful campaigns. The inventory must resolve every historical input referenced by manifests, including absolute PC paths and training shards. Missing references or unrecognized scientific formats block completeness.
2. Sorted, unique **full 32-byte SHA-256** state membership, using the existing `keyFor`/`keysFor` canonicalization. Preserve actual-turn keys and the conservative both-turn direct-admission keys separately. Include all complete trajectories at/after occupied 12, root alternatives, frontier decisions/children, queried children and legally replayed returned PVs, disclosed fixtures and played engineering-game continuations. Validate sorting, key length, duplicate handling, counts and independent file digests. The established compact representation costs 32 bytes per unique key before role metadata/compression; there is no justified total-size estimate until rebuilt.
3. Role/provenance records mapping each key to **all** occurrences: run, source ID, source/family ID, artifact path/hash and location, state role, actual turn, occupied count/terminal status, label/exactness, and whether it was a direct fitting target, used for selection/design/assessment, an unused reservation, a deployment frontier decision/child, a played game state or only an internal teacher PV node. Keep ambiguous historical roles explicitly unknown; do not invent a favorable classification. A key with both direct-target and internal-PV provenance must retain its direct-target restriction. A blanket legacy index cannot distinguish these cases.
4. A source/family registry: all historical seeds/namespaces, reservation IDs (including the 384 unused latest openings), canonical occupied-12-and-later ancestry identities, known parent/branch links, symmetry/color equivalences and role allocation. Include abandoned/rejected candidates if queried, disclosed or otherwise used scientifically. Preserve the original reports' claims, without reclassifying their previous failures.
5. A replay and coverage audit: independent legal replay of full source/game paths and returned PVs; receipt digest checks; comparison against original audited membership; explicit accounting of every added/missing identity. Bind exporter source, canonicalization tests, inventory digests, all package file digests, counts by run/role, run-preservation before/after and any unresolved source files. A manifest hash alone proves neither role correctness nor completeness.

A practical compact transport uses the existing sorted binary membership format plus compressed occurrence/source JSONL, file inventory and a small manifest. Intern table/path/source identifiers instead of repeating strings. The exact on-disk role schema/importer must be reviewed against the real PC formats before it can be accepted; this Mac preparation does not ship an untested exporter that guesses those roles. No historical teacher output or training pair needs to be exposed to the new models.

## Required historical coverage and published anchors

At minimum inspect these directories, plus every additional teacher/bound/exact/residual/engineering/review run found by the inventory and every manifest-linked shard:

* `six-hour-20261027`, `strong-six-hour-20261027`, `next-frozen-screen-20261028`.
* `teacher-audit-v1-20261028`; all teacher-qualification versions, including stopped V4 and qualified V4R1; all bound/exact engineering runs and correctness fixtures.
* `residual-frontier-v1r2-20261028`: 1,600 training, 400 development, 400 assessment sources, all reservations/frontiers/queries, original snapshots and scheduling/serialization certificates.
* `residual-constraint-pattern-screen-v1-20261029`: original compact base and inventory, all 256 assessment sources, all 384 unused openings, both selector frontiers, engineering-v2 tasks, optimizer-input provenance, later queries, complete played pilot games and the final exclusion-coverage audit.
* The Mac benchmark public trajectories `74102901`–`74102904`, benchmark fixtures and this screen's disclosed engineering inputs/queries/played paths must be added locally after import. The new engineering directory is historical for any later reservation.

Verify against the published latest audit: run `361277f1de3bd638fe29250a15e9fe6f54cf6fafac2a2f2db9c4cbf1a991b1c2`, reservation `72f95d130f9478f7cf99778c1d17e0bf9262a8e10a48811b8e1bd5254fec13c4`, 5,701 scientific and 286 engineering task receipts. The latest final exclusion audit is `cf2b1362ad907c2c648433a15429aec240fd61fafe2feb893c4721820c0d68d9`: 16 engineering games, 1,368 keys total, **1,326 missing from the old frozen index**. Their additional-key digest is `0c1011c931c31823c115d945ec9a681156ebf348a984fca41b29c90a9d97fe9e`. The new package must include them; copying the old binary alone repeats a known omission.

Also retain role attribution for all 50 flagged occurrences / 18 canonical identities in the four historical affected sources. Their old strict-PV failure remains a failure. New classification is needed solely to apply the new prospective policy accurately.

The original residual run is `601ea969f0a43fbbe5d0ac87e805e0fbb08a4fde976121ed2d7fe7753397bfe0`, reservation `c86d121af8f1209b9b58341dc5cc83fed296b46d0b82410518c5a0c98867c212`. The qualified V4R1 reservation is `8b88a3f228ca9053434c4254ade8dc06eb7845037d7f6f92ec924446098cd237`. These anchors help detect wrong directories; they do not replace replay and completeness checks.

## After transfer

On the Mac verify all package digests and PC preservation/replay/coverage audits, add the complete new local engineering paths and freeze the merged index. Then complete/review the scientific admission and sealed-query coordinator, measure full admission/rejection cost and memory, qualify its restart/audit/statistical pipeline, and recompute the complete forecast with 35% contingency and a separate 15-minute reserve. Only then jointly reserve/freeze all 128+32+96 source/family identities and launch the predetermined games and diagnostics.

No new user permission is required for the already authorized screen once these prerequisites are met. Do not spend the scientific allowance on an unverified independent claim, reuse old unused openings as fresh, shorten the sample or substitute a different model. If exact provenance cannot be recovered on the PC, preserve the preparation and report that the independent experiment remains blocked.
