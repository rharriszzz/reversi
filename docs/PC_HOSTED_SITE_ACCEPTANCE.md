# Windows acceptance of the public website

**PASS — actual Windows Chrome and Edge pass the public HTTPS site. No home
server is required. Ready for the next strategy-coach session; none started.**

Tested 2026-11-01: **https://rharriszzz.github.io/reversi/**.
The clean PC checkout started at `8683516e8f477fdb1bac7c6f868ac7e1011b8e4c`.
`git fetch origin`, `git switch main`, and `git merge --ff-only origin/main`
verified and safely updated it to the expected production commit
`d8ee8155ff859f0119020473f6decda0d7c8db8a`. Ignored research and other local files
were preserved. Deployment scripts and static browser tests were present.

## Environment and results

| Item | Actual version / result |
| --- | --- |
| Windows | Windows 11 Home, 10.0.26300, build 26300 |
| WSL | Ubuntu 26.04.1 LTS, x86-64, kernel 6.18.33.2-microsoft-standard-WSL2 |
| CPU | Intel Core i7-14700F |
| Existing tools | `.venv` Python 3.14.4, Playwright 1.64.1; Node v24.16.0; Windows PowerShell 5.1.26100.9711 |
| Actual Windows Chrome | **156.0.8078.48 — pass** |
| Actual Windows Edge | **156.0.4314.58 — pass** |
| Packaging regression | **6/6 pass**, before and after the test adaptation |
| Static package build / validation | **Pass; 18 files, 499,017 bytes** |

The only test change connects `tests/static_chromium_check.py` to the existing
`scripts/wasm/browser.py` Windows selector, records the actual browser/user agent,
checks HTTP error responses across the browser context and guarantees browser
cleanup. Without the Windows flag it retains the existing Chrome channel.
The shared Safari/static functional checks and independent Python mailbox rules
are reused unchanged. No application, deployment, engine, coefficient or Wasm
changes were needed; no tool installation, native qualification or local
application acceptance was repeated.

Both browsers verify the 64-square board, fresh-profile P and actual worker
request/response identity. B/L/P switching and each explicit preference survive
reload. All six fixed-depth D4 / 80-ms / 300-ms × human-black/white cases pass,
including legal computer replies, independent disc-flip replay, undo, history,
position replay, verified move comparisons and analysis. Observed worker
requests include all three budgets; play and analysis responses identify the
frozen model and packaged Wasm build. Active model/depth cancellation also passes.

Each completes and independently replays one P game: **59 placements, 7 forced
passes, Black 1 / White 62**, with one empty square and neither side able to move.
Terminal counts and completed-game review with **P · WebAssembly** agree.
These are functional fixtures, not playing-strength evidence.

Both browsers report **zero page exceptions, zero failed requests and no HTTP
errors**. Every observed response is HTTP 200. Supplementary **390×844** desktop
viewports also pass: 64 cells, 311-pixel board, 44-pixel evaluator control, no
horizontal overflow, and an independently checked human move/computer reply.
Screenshots were inspected. This is no new iPhone or physical-device evidence.

## Hosting and integrity

All 16 distinct runtime request URLs stay under
`https://rharriszzz.github.io/reversi/`: HTML, CSS, icon, runtime modules, module
workers, manifest, loader and Wasm. No Python HTTP server or native executable
was running for these public browser checks. The local CDP proxy controls the
test browsers; it serves no application resource or computation. Browser worker
responses demonstrate that search runs inside each Windows browser, with no
localhost, home-Mac or external computation API request.

| Identity | Verified value |
| --- | --- |
| P | `de4b84745589b0384ea3639f879e3c98990e802d176298ff8ef54f681520067f` |
| Wasm fingerprint | `934b888ad89f8d754d1ace6acfcd3cd84b6b48e948431916153d5d29c5f2b223` |
| Fetched Wasm SHA-256 | `7a9d43dd937af75999d5db11b018bd98a1d87eb655bbf05053957993dec0c9d0` |
| Fetched loader SHA-256 | `95dbaf41ff32dbf04f41d6ff8936f8bf113ffbdbc0beafa2f69f481f00fb72c6` |

Both browser downloads match the public manifest; Wasm MIME is
`application/wasm`. Independently, all **18 allowlisted public files** return
200 and match the validated local package SHA-256 values. The downloaded Pages
artifact contains exactly those 18 matching files and no symbolic/hard links.
Nine excluded-path probes return the expected 404: Git config, local research,
README, user requests, this report, native source, browser test, build script and
workflow YAML. These intentional probes are separate from runtime requests.

The pre-acceptance deployment for `d8ee815…`,
[Pages run 41324282081](https://github.com/rharriszzz/reversi/actions/runs/41324282081),
has successful build and deploy jobs. Test/report changes are outside the existing
allowlist, so publication must preserve every runtime byte. The new main push's
workflow, downloaded artifact and public bytes are checked again after push;
its exact SHA and successful run are returned in the final handoff.

## Reproduce and evidence

From the repository, using the existing environment:

```bash
export REVERSI_PYTHON="$PWD/.venv/bin/python"
"$REVERSI_PYTHON" -m unittest discover -s tests -p 'test_static_site.py'
"$REVERSI_PYTHON" scripts/build-static.py
"$REVERSI_PYTHON" scripts/build-static.py --check
for browser in chrome edge; do
  export REVERSI_WINDOWS_BROWSER=1 REVERSI_WINDOWS_CHANNEL="$browser"
  "$REVERSI_PYTHON" tests/static_chromium_check.py \
    --url https://rharriszzz.github.io/reversi/ \
    --output ".local-research/pc-hosted-site-20261101/$browser"
done
git diff --check
```

The packaging unit test briefly serves its own temporary fixture and stops it;
neither hosted browser run uses that server. Browser profiles/processes are
disposable; personal data/settings are untouched. Raw receipts, requested URLs,
worker observations, screenshots, artifact ZIPs and the small supplementary audit
scripts remain ignored under `.local-research/pc-hosted-site-20261101/`.
[Compact evidence](data/pc-hosted-site-20261101/receipt.json) records the results
and hashes. No new compatibility warning or unresolved Windows blocker was found.
The earlier tied-score `−0.0` presentation quirk remains cosmetic; physical-device
coverage limits remain in the [mobile report](IPHONE_GITHUB_PAGES.md).

Publication: `git diff --check`, explicit `git add`,
`git commit -m "Accept public Reversi site in Windows Chrome and Edge"`,
`git fetch origin`, `git push origin main`, and
`git ls-remote origin refs/heads/main`. GitHub Actions status is checked through
the GitHub API; no Pages setting is changed.
