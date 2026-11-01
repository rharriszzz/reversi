# iPhone Safari and GitHub Pages

Website: **https://rharriszzz.github.io/reversi/**. No custom domain or running
home computer is needed. GitHub serves the files; your phone performs every
search and coaching calculation. Loading requires internet access. This release
does not implement offline caching, saved games across page reloads, or a service
worker. Existing evaluator/time preferences persist in Safari storage.

## Implementation and package

Started from fetched production `8683516e8f477fdb1bac7c6f868ac7e1011b8e4c` on
`deploy/iphone-pages-20261101`, after a clean fast-forward of local main from
`429cb85e8621276b8ae3347a4bae8a3931f2f555`. Other worktrees and local research
archives were preserved. The user's request was appended verbatim.

The explicit 18-file allowlist in [`scripts/build-static.py`](../scripts/build-static.py)
creates the ignored **`dist/reversi/`** directory:

- `index.html`, `style.css`, `assets/apple-touch-icon.png`.
- Ten runtime modules: `app`, `backend`, `coaching`, `fast-features`, `features`,
  `review`, `rules`, `search`, `wasm-engine`, and `worker`, under `src/`.
- `src/wasm/manifest.js`, the qualified `engine-934b888ad89f8d75.mjs` and `.wasm`,
  and the Emscripten/LLVM license notices.

No repository tree, native executable, report, dataset, test, screenshot, browser
installation, log, credential, or Git metadata is uploaded as website content.
Packaging rejects extra files, missing dependencies, nonrelative references,
symlinks, changed distribution bytes and Wasm artifact/hash mismatches. Its six
unit tests also serve every allowed file through the `/reversi/` prefix and check
JavaScript/Wasm MIME types. Packaging is deterministic and uses only Python's
standard library; visitors need no Python, Node, C++ or server installation.

```bash
python3 scripts/build-static.py
python3 scripts/build-static.py --check
python3 -m unittest discover -s tests -p 'test_static_site.py'
python3 -m http.server 8920 --bind 127.0.0.1 --directory dist
# Open http://127.0.0.1:8920/reversi/ ; Ctrl+C stops this test server.
```

No runtime path correction or Wasm rebuild was needed: module imports, workers,
the dynamic loader and the generated loader's Wasm URL already resolve relatively.
Browser acceptance checks the actual fetched artifact hashes/MIME types and the
returned model and build identities. P remains default; B and L remain available.
All `src/`, native engine sources, search semantics, coaching logic, coefficients
and committed Wasm files are unchanged from the starting production commit.

P identity: `de4b84745589b0384ea3639f879e3c98990e802d176298ff8ef54f681520067f`.
Build fingerprint: `934b888ad89f8d754d1ace6acfcd3cd84b6b48e948431916153d5d29c5f2b223`.
Wasm SHA-256: `7a9d43dd937af75999d5db11b018bd98a1d87eb655bbf05053957993dec0c9d0`.
ABI remains 1. The complete artifact identities remain in the packaged manifest.

Changes to the interface are limited to phone CSS and metadata: 16-pixel native
select text with explicit 44-pixel heights, larger buttons/range targets, wrapping
headers and status text, more readable history, bottom safe-area padding, a
180-pixel board icon, theme color, and Apple Home Screen title/standalone metadata.
The existing layout/design and desktop controls remain.

## Simulator and browser acceptance

M4 iMac, macOS 27.2, Xcode 27.2 (`27B52`), selected developer directory
`/Applications/Xcode.app/Contents/Developer`. MacPorts `gh` 2.103.3 authenticated
as `rharriszzz`; Pages API confirmed `build_type: workflow`, no custom domain,
and HTTPS enforcement. No tool upgrades or security-setting changes were made.

Disposable simulator devices preserve existing user devices and browser data:

| Device | iOS / Safari | Portrait CSS width | Board width |
| --- | --- | --- | --- |
| iPhone 17 Pro | 26.5 / 26.5, build 23F77 | 402 px | 338 px |
| iPhone SE (3rd generation) | 26.5 / 26.5, build 23F77 | 375 px | 311 px |

Both ran the packaged `/reversi/` site with actual module workers and WebAssembly.
The automated checks cover first-visit P response identity/fingerprint, every
opening alternative, B/L/P selection and reload persistence, fixed depth D4,
80/300 ms play in both human colors, independent mailbox replay of moves/flips,
undo/new game, history and position replay, legal-move comparison, active model/
depth cancellation, complete P games, terminal counts, and selected-model review.
No horizontal overflow was observed. On an SE the initial header/board extends
below the small viewport; scrolling brings the entire board into view. Controls
remain in the normal page flow, with native Safari controls visible.

**Input evidence is deliberately separated:** SafariDriver on these iOS runtimes
accepted element-click and touch-action commands but delivered no page input
events. The repeatable mobile functional script therefore uses explicit DOM
events (`--dom-input`); it does not prove native taps or picker operation.
Separate native Device Hub interaction, outside WebDriver sessions, successfully
tapped D3 on **both** phone sizes and observed P's legal C5 reply and the correct
six-disc board. The native evaluator picker selected L and retained it after
reload. Native swipe scrolling and modern-phone landscape controls were also
inspected. Screenshots were visually inspected and remain local, outside Git and
the deployment artifact. A screenshot alone is not used to establish input.

The listed iOS 27.0 runtime failed creation with `runtime path not found`;
27.2 did not provide a matching SafariDriver host, and an 18.6 SE session timed
out during creation. Those versions are **not qualified** here. Installed 26.5
worked for both sizes; no runtime installation or Xcode upgrade was necessary.

The mobile workers returned 32 MiB Wasm linear memory per initialized engine.
Three initialized roles therefore account for 96 MiB of linear memory, excluding
JavaScript, WebKit and OS overhead. Initial local load observations were roughly
0.5–2.3 seconds, with warm runs varying. Main-thread 16-ms heartbeat observations
had maximum gaps of 24–51 ms in the initial complete-game runs, including 300-ms
search cases. Idle outstanding jobs returned to zero; rapid-change checks also
exercised cancellation. No Wasm initialization failure, unexpected reload, or
unhandled page error occurred in successful runs. These limited simulator
observations are not physical-device memory, startup, thermal or battery results.
No performance optimization or worker redesign was introduced.

Desktop static-site acceptance passes in actual Safari 27.2 and Chrome
156.0.8078.74, including complete games, independent replay and review. Chrome's
existing local Python-launcher Wasm regression additionally passes preference
migration, missing-Wasm recovery, explicit B JavaScript fallback and ABI mismatch
recovery, with zero page errors. Windows/WSL2 and Intel Mac execution were not
repeated on this M4; their existing qualification remains separate evidence.

Reproduce actual browser checks with existing test dependencies:

```bash
# Keep the static HTTP server above running. Use disposable simulator UDIDs.
xcrun simctl list devices available
python3 tests/static_safari_check.py --device YOUR_SIMULATOR_UDID --dom-input
python3 tests/static_safari_check.py  # actual desktop SafariDriver
.venv/bin/python tests/static_chromium_check.py  # test-only Playwright + Chrome
REVERSI_BROWSER_CHANNEL=chrome .venv/bin/python tests/wasm_browser_check.py
node --test tests/*.test.mjs
python3 -m unittest discover -s tests -p 'test_*.py'
```

SafariDriver must already be enabled. The scripts never change that setting.
Receipts, observed requests/results and screenshots default to ignored
`.local-research/iphone-pages/`. The scripts accept `--url` and `--output` for the
deployed HTTPS site. `--short` retains all six time/color cases but omits a complete
game. Physical touch coverage still requires separate native interaction.

## Deployment and production updates

[`.github/workflows/pages.yml`](../.github/workflows/pages.yml) runs on `main`
pushes or manual dispatch. The build job has only `contents: read` and
`pages: read`; it checks out without persisted credentials, selects Python 3.14,
runs packaging tests, builds and validates, configures Pages, and uploads **only
`dist/reversi`** using the standard Pages artifact action. The dependent deploy
job has `actions: read`, `pages: write`, and `id-token: write` and uses the
`github-pages` environment. Only `main` can deploy, including manual runs.
Concurrency serializes deployments. No API token or personal secret enters the
artifact. This follows GitHub's [custom-workflow deployment guidance](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

Future qualified changes pushed to `main` automatically rebuild and deploy.
Inspect the **Publish Reversi to GitHub Pages** run in the repository Actions tab.
Keep Settings → Pages → Source set to **GitHub Actions**. Domain verification and
a custom domain are unnecessary. Source/test/report files remain in GitHub's
repository history, separately from the narrow website artifact.

Local publication gates passed: **199 Node tests passed, one expected Linux-only
skip; 72 Python tests passed**, including the six packaging tests. The Python
suite initially had two older timing-sensitive research-runner failures while
simulators were active (startup checkpoint timeout and a depth-zero result in a
short-budget correctness fixture). With the disposable simulators shut down,
the complete unchanged suite passed in 104.534 seconds. Original failure logs
were retained locally. Existing nonfatal subprocess/HTTPError ResourceWarnings
remain visible; no research code or test budgets were changed. Workflow YAML and
`git diff --check` also passed. Compact local evidence is in
[`data/iphone-pages/local-acceptance.json`](data/iphone-pages/local-acceptance.json).

## Public qualification and publication

Implementation commit **`82d09b963275ddbfce07ceb7ca44b0786d03b547`** was pushed on
the development branch and fast-forwarded to `main`. Both remote refs were
verified equal. [Actions run 41323546349](https://github.com/rharriszzz/reversi/actions/runs/41323546349)
completed **successfully**, including both build and Pages deployment.

The actual public HTTPS site passes:

- All **18 files / 499,017 bytes** return HTTP 200 and match local source SHA-256.
  Wasm is served as `application/wasm`; the module loader has a JavaScript MIME
  type. The downloaded Pages artifact independently contains exactly those 18
  matching files with no symbolic/hard links.
- `.git/config`, `.local-research/`, `README.md`, the report, and native source
  return **404** on the website, as intended.
- Actual Chrome 156 and iPhone 17 Pro / iOS 26.5 Safari execute the hosted Wasm
  with the frozen P identity and build fingerprint. Both complete independently
  replayed games and review, and pass the six fixed/80/300-ms and human-color
  cases, preferences, undo/replay and coaching comparisons. Chrome records zero
  page errors or failed requests, with every runtime request under `/reversi/`.
- The local static HTTP server was stopped before the public iOS acceptance
  finished. The site has no request or service dependency on the home Mac/PC.

Compact public checks are in
[`data/iphone-pages/public-acceptance.json`](data/iphone-pages/public-acceptance.json).
The following report commit records this observed successful deployment and
triggers an identical static rebuild: reports and request-history updates are
outside the allowlist. Its exact remote tip and final Actions status are checked
after push and supplied in the completion handoff, avoiding a self-referential
commit hash in this file.

Commands used for publication and status verification:

```bash
git push -u origin deploy/iphone-pages-20261101
git switch main
git merge --ff-only deploy/iphone-pages-20261101
git push origin main
git ls-remote origin refs/heads/main refs/heads/deploy/iphone-pages-20261101
gh run list --workflow pages.yml
gh run view 41323546349
git status --short --branch
```

## Broader browser/device scope

The site uses browser standards, without browser-name restrictions. The user's
subsequent request includes iPhone Safari, Chrome and the Google app; an older,
unsupported iPad; Mac Safari/Chrome; and PC Edge/Chrome. Those are targets, with
the following evidence boundaries:

| Environment | Status |
| --- | --- |
| Mac Safari 27.2 / Chrome 156 | Actual static-site acceptance passes |
| iPhone Safari | Actual iOS 26.5 simulators pass; physical phone still to test |
| iPhone Chrome / Google app browser | Physical-device check pending; Safari testing alone is not proof |
| PC Edge / Chrome | Actual hosted-site acceptance passes on Windows 11 / WSL2 in Edge 156 and Chrome 156; see [Windows public-site report](PC_HOSTED_SITE_ACCEPTANCE.md) |
| Old unsupported iPad | Best effort; actual model/iPadOS is unknown, so compatibility is not promised |

An additional **iPad (6th generation) / iPadOS 17.5** simulator smoke check opened
the public HTTPS site and visibly displayed P/WebAssembly, all four equally
searched opening moves, and a verified depth-3 continuation. Its screenshot was
inspected. This is page-load/coaching initialization evidence, not the complete
automated phone suite or proof about the user's unspecified older iPad.

An old device may lack JavaScript/module-worker/WebAssembly capabilities even
when its browser application can be updated. No legacy engine replacement or new
framework is introduced. On each actual device, try the public URL, confirm
**P · WebAssembly**, play a move, and try a comparison. In the Google app, use its
Open in Safari option if the embedded browser has trouble. Windows/WSL2 users can
also retain the unchanged local launcher; this hosted website needs no launcher.

## Test on a physical iPhone

1. Turn off Wi-Fi in Settings so Safari uses cellular data. Leave cellular data
   enabled for Safari. Your Mac/PC may be off.
2. Open Safari and enter **https://rharriszzz.github.io/reversi/**.
3. Confirm **P · Recommended pattern evaluator**, scroll to the coach and check
   **P · WebAssembly**. Tap a highlighted square and wait for the reply.
4. Try 80 ms and 300 ms, undo, new game, replay and a move comparison. Select
   B/L/P and reload to check the remembered selection. Try portrait and landscape.
5. Use **Share → Add to Home Screen**, name it **Reversi**, and tap **Add**.
   Reopen from the icon and play another move. Modern Safari may put Share inside
   its More (`…`) menu.

Physical-iPhone touch accuracy, browser-bar behavior, Home Screen launch,
cellular startup, background/resume behavior, memory pressure, thermal response
and battery usage remain user acceptance checks. Reloading starts a new game.
If P cannot initialize, the existing visible error offers **Retry engine** or an
explicit **Use B instead**; there is no silent substitution.
