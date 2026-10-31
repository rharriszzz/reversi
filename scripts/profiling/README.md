# Local profiling investigation

Open the committed evidence with the ordinary dependency-free server:

```bash
./start.sh --no-browser
# Append profiling/ to the printed URL.
```

The explorer never starts a measurement. It works from the committed manifest,
benchmark results and selected complete normalized captures under
`docs/data/profiling/`. It uses no CDN, plotting package or remote service.

Collection is a separate, opt-in macOS/Xcode workflow. These commands can take
about an hour and must run serially on an otherwise quiet machine:

```bash
node scripts/profiling/build.mjs
.venv/bin/python scripts/profiling/package.py
.venv/bin/python scripts/profiling/measure.py --pilot
# Read .local-research/profiling-m4-20261030/registration.json first.
.venv/bin/python scripts/profiling/measure.py
.venv/bin/python scripts/profiling/normalize.py
.venv/bin/python scripts/profiling/qualify-builds.py
.venv/bin/python scripts/profiling/chrome.py  # optional separate actual Chrome worker captures
.venv/bin/python scripts/profiling/analyze.py
.venv/bin/python scripts/profiling/report.py
```

Use the qualified project environment, Python 3.13+ and Xcode Instruments.
The build reconstructs the qualified old/current sources with `git show`;
it changes neither production source nor Wasm. It verifies that adding debug
information leaves the engine's `__TEXT,__text` bytes unchanged. No forced frame
pointers, tracing macros or per-function timers are added to the measured engine.
It records both source/build and executable hashes. Do not overwrite the build
receipts or rebuild during collection.

The default output directory identifies this investigation. For a new campaign,
set `export REVERSI_PROFILE_RUN=.local-research/profiling-next` before running
any commands; every collection/analysis script honors it. `report.py` reads the
explicitly published derivatives, not a raw run directory. **Do not casually rerun the build into completed results.**
To start a distinct future investigation, first choose a fresh `REVERSI_PROFILE_RUN`, review the source commits/workloads
in `build.mjs`, and register new identities.
`measure.py` skips only completed trial IDs. A trace left without a completed row
requires examination before resumption; it is never overwritten automatically.
The advisory lock prevents collection and offline normalization from overlapping.
`analyze.py` computes matched interference/ranking comparisons from saved records;
`report.py` fills measured sections in the methods report. The separate Chrome
capture script runs only after native collection and normalization, and the
`qualify-builds.py` correctness check links each original production adapter
against its matching engine object without overwriting measured binaries.

`package.py` generates the independently written `hardware.instrpkg` and builds
it into ignored local storage with `instrumentbuilder`. `xctrace --package` loads
it for that command only. It does not install a persistent plugin or change
Developer Tools security settings. Each minimal collector requests:

- `pmi-sample` at `CORE_ACTIVE_CYCLE` periods of 1,000,000 or 10,000,000;
- an empty `callstack` array for IP, or `user` for stacks;
- periodic stack-free counter reads to configure the named counter correctly;
- two boundary signposts from the harness, outside its timed work.

The periodic counter-read records configure/read the counter; the instruction
locations used in the IP views come only from the hardware PMI records.
Standalone raw PMI requests without matching counter configuration failed event
qualification and are excluded. See the report for the preserved probes.

`driver.cpp` also preserves the interrupted session's optional software PC
sampler. A nonzero `ipIntervalUs` activates a thread that periodically suspends
the work thread and reads ARM registers. **That is software sampling, not PMU
sampling.** This campaign always passes zero. The driver's legacy `ipSamples`, `ipAttempts`
and `ipFailures` fields describe only that disabled software sampler; hardware
record counts come from the exported PMI tables. It is not silently substituted for
unsupported hardware facilities.

`normalize.py` runs offline. It exports real PMI/CPU/Time records, checks
signpost boundaries, rejects IP captures containing stacks, resolves XML
references, preserves cumulative counter values separately from sample weights,
and symbolizes selected complete captures with `nm`, `atos` and `otool`.
No small-count observations are discarded. Raw stack fragments retain register
fixup values separately; the decoder does not insert guessed LR caller frames.
CPU Profiler exports supply richer reconstructed/inline context. Startup, warmup and teardown samples
are counted separately from the complete fixed-work interval. Missing lost-sample
counts remain unknown. Raw traces/exports stay ignored; publication contains
compact records and capture statistics with hashes.

The browser model is in `profiling/model.js`, independently implemented from the
HIS reference. Normalized profiles have:

- version, workload/build identities, method, event and configuration;
- frames with raw PC, module-relative PC, physical symbol intervals and reliable
  source/assembly metadata where available;
- root-first **actual** stacks only for stack captures;
- sample tuples `[timeNs, locationId, weight, core, rawCumulativeCounter, threadId, hardwareProgramCounter, rawUnwindFixupRegisters]`;
- explicit accepted, outside-work, unresolved, malformed and unknown-loss mass;
- timestamp provenance and raw-export hashes.

Trailing collector-specific tuple fields are optional; `capture.sampleColumns`
identifies the fields actually retained by each file. An IP location ID references a frame; a stack location ID references a stack.
Native time is relative to a captured workload signpost; Chrome time is relative
to CDP profile start. Neither is invented from sample order.
Raw PMI weights are configured cycle periods, not cumulative counter values.
Raw cumulative readings use decimal strings to retain full integer precision.
CPU/Time weights retain the Instruments export's own units. Chrome worker
captures are separate software-sampled profiles and do not acquire native PCs.

The explorer exports real stacks to Speedscope's sampled format, using `none`
for its generic weight unit and labeling the original event explicitly. This
preserves weights without falsely declaring cycles to be seconds. Use a local
Speedscope installation if offline viewing there is desired; the explorer itself
needs no installation.

Qualification commands (outside collection):

```bash
node --test tests/profiling.test.mjs
.venv/bin/python -m unittest discover -s tests -p 'test_profiling.py'
.venv/bin/python scripts/profiling/browser-check.py
```

After acceptance, `receipt.py --final` publishes compact build/resource/test
evidence. Run the qualification commands first: the receipt requires their
passing logs. Playwright and installed Chrome are optional development tools for
`chrome.py` / `browser-check.py`; local explorer use requires neither.

See [methods, measured interference and view recommendations](../../docs/PROFILING_METHODS_AND_VIEWS.md).
