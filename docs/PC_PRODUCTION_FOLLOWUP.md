# PC production follow-up

**Pass, 2026-10-31.** Production `main` safely fast-forwarded from local
`7dfb056` to remote `e7b79b9510278b815606c47b667ddeff396e289b`.
Fetch found no newer main commit. The initially clean `perf/fast-flips` branch
at `791c0f8` and all ignored research files were preserved; one worktree existed.
This Stage 1 record is committed/pushed on main before Stage 2 begins.

Actual environment: Intel i7-14700F, Ubuntu 26.04.1 under WSL2 kernel
6.18.33.2, GCC 15.2.0-16ubuntu1, Python/project venv 3.14.4, Node 24.16.0.
About 6.2 GiB available guest RAM, 1 MiB used swap and 885 GiB free disk;
no competing Reversi computation. No toolchain or system setting changed.

The source SHA-256 is the prescribed `b97d5266…47e7a5`.
Tracked production manifest/module/Wasm, frozen header and B/L/P identities pass
`scripts/fast-flips/verify-production.mjs`. Actual loaded build fingerprint is
`eb25fd26b0e29d8e3ba5d2b0eb865c7658790b7791d8076cf4515235c369549b`;
Wasm SHA-256 is `a6540b1b9b83d80098fad424bfdf14a71b72e073e2aa972daa03366175a5414e`.
No Wasm artifact was modified or rebuilt. Browser network checks verify that
the runtime requests this committed production module, with no research path.

Commands (all returned zero):

```bash
export CXX=g++
unset NATIVE_CPU
npm run native:build
node --test --test-concurrency=1 tests/rules.test.mjs tests/native-search.test.mjs tests/wasm-engine.test.mjs tests/fast-flips.test.mjs
node scripts/fast-flips/verify-production.mjs
node scripts/fast-flips/production-smoke.mjs
REVERSI_WINDOWS_BROWSER=1 REVERSI_WINDOWS_CHANNEL=edge .venv/bin/python scripts/fast-flips/packaged-browser-check.py
REVERSI_WINDOWS_BROWSER=1 REVERSI_WINDOWS_CHANNEL=chrome .venv/bin/python scripts/fast-flips/packaged-browser-check.py
./start.sh --port 0
```

All **24/24** prescribed test groups pass, with no skips. These include independent
mailbox flipping, rules/perft/pass/terminal checks, fixed native and actual Wasm
searches, deep exact references, frozen coefficients, coaching and interruption.
The smoke uses the unchanged hashed mixed48 corpus, one full warmup and three
B/P repetitions. Mean core / CPU / IPC-inclusive wall milliseconds are
**114.860 / 114.863 / 121.352 (B)** and **187.325 / 187.334 / 193.390 (P)**.
Nodes are respectively 1,780,838 and 2,578,323 per batch; scores, depths,
exactness, moves, nodes and evaluations match the published references.
This short smoke is packaging acceptance, not a new performance campaign.

Actual Windows **Edge 156.0.4314.42** and **Chrome 156.0.8078.48** pass
B/L/P coaching, an 80-ms reply, reload/persistence, network/build/model identity
and fetched Wasm hash, with no page errors. Automated checks use disposable
Windows profiles which the existing helper closes/removes.

The actual `start.sh` default-browser route produced successful app/module HTTP
requests and a Windows Edge window titled “Reversi Coach Lab”. This verifies
launch/loading, without claiming visual inspection of that ordinary profile.
The launcher was sent SIGINT (Ctrl+C), returned zero, and its port was verified
closed. Automated acceptance servers also exited. The existing favicon 404 is
present; no engine or launcher defect was found. No Mac hardware was tested here.

[Compact receipt](data/pc-production-followup/receipt.json) preserves native build
flags/hashes, packaging, browser identities, complete smoke rows and launcher
HTTP/exit evidence. Local full logs remain in the ignored directory
`.local-research/pc-production-followup-20261031`.

Publication, after diff/test checks:

```bash
git add USER_REQUESTS.md docs/PC_PRODUCTION_FOLLOWUP.md docs/data/pc-production-followup/receipt.json
git commit -m 'Qualify Mac production integration on Windows WSL2'
git push origin main
git ls-remote origin refs/heads/main
```

The resulting exact commit/remote SHA is reported in the final handoff.
