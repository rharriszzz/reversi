# Windows PC native C++ and browser Wasm qualification

Platform qualification checkpoint; measurements and final analysis follow in a
separate commit. The clean PC checkout was fetched and fast-forwarded from
`40a0cf2` to published `main` at `c605503`. Historical research remains read-only.
No evaluator was retrained and no frozen coefficient changed.

## Initial resource audit

Windows 11 Home 10.0.26300, i7-14700F: 16 GiB installed / 15.725 GiB OS-visible
physical RAM, approximately 4.45 GiB available at the initial sample; committed
26.22 GiB against a 59.72 GiB limit. Pages input/output and page reads were zero
in that sample. This is materially better headroom than the earlier 1.5 GiB
reported in the request. WSL2 initially had approximately 6.23 GiB available of
7.61 GiB, with 88.6 MiB swap allocated and zero observed vmstat swap activity.
Free storage: approximately 883 GiB on the Linux filesystem and 348 GiB on C:.

Windows reports 20 physical cores / 28 logical processors; the VM exposes 14
virtual two-thread cores / 28 processors. These are different topology views.
Initial Windows CPU load was 2%; Linux was essentially idle. Chrome had 18
processes with summed working sets 2.72 GiB and private bytes 3.00 GiB; Edge had
eight processes, 150 MiB working sets / 262 MiB private bytes. The WSL VM had
1.34 GiB working set / 3.50 GiB private bytes. Memory Compression, Explorer,
Defender, Steam and Dell services were other visible consumers. Process working
sets share pages; their sum is not unique physical use. Private committed bytes
are not resident memory. Cumulative process CPU time is not current utilization.

Python 3.10.12, Node 24.16.0, Ubuntu GCC 11.4.0. Windows Chrome
156.0.8078.48 and installed Edge 156.0.4314.42 were detected; Chrome is the browser
actually qualified here. Linux hardware performance events report
`<not supported>`; software `cpu-clock:u` works using locally extracted Ubuntu
perf 5.15.222. No kernel settings or privileged configuration was changed.

## Native and actual Windows qualification

The production build retains C++17, `-O3 -ffp-contract=off -fno-fast-math` and all
frozen model identities. The initial timed-search regressions exposed a GCC 11
aggregate return-slot issue: assigning `result=root(...)` allowed the return
object to overwrite the previous completed iteration before a deeper search
threw. Fixed-depth values were correct, but interrupted search could report
depth zero or an invalid fallback. A separate completed return object now
precedes assignment. All 15 native regression groups then pass, including
ASan/UBSan. No search algorithm or floating-point tolerance changed.

Broad native qualification covers 2,007 legal positions, 12,042 B/L/P static
queries, 96,720 independent legal children, 96 fixed searches and twelve exact
endgames. Maximum numerical error is zero at absolute tolerance 1e-10. All
169 Node tests pass, including actual committed-Wasm execution and independent
depth-15/16 references. The Wasm binary is unchanged; it was compiled by the
previous pinned Clang/Emscripten toolchain, whose exception path passes.
The manifest retains its original source/build identity; the small native
exception workaround is explicitly a later source change, not a rebuilt Wasm.

Actual **Windows** Chrome reports `navigator.platform=Win32` and Windows NT in
its browser identity. The unchanged 372,213-byte module loads through WSL
localhost with `application/wasm`. A disposable Windows TEMP profile is launched;
WSL NAT is bridged through a Windows loopback CDP websocket over PowerShell
stdio and a private WSL loopback relay. No Windows listening interface, firewall
rule, ordinary profile or Chrome preference is changed.

The Windows worker independently passes 524 numerical comparisons with maximum
error zero: 208 static queries, 94 full-window root alternatives, 282 independently
legal PV placements with optimal reply values checked against native, and 30
exact alternatives from the preserved depth-15/16 reference roots. Twenty
close/reinitialize cycles retain 32 MiB linear memory. Actual application tests
pass B/L/P coaching, P timed play, complete B/P games, model-consistent review,
undo/replay, cancellation/model changes, cached reload, B fallback, P refusal,
custom recovery, injected ABI mismatch and reload recovery.
The original custom-weight browser check also passes training, the actual export
download/Blob, persistence across reload, keyboard comparisons and game review.

Harness problems were retained locally and repaired: stdio needed explicit
UTF-8 for middle-dot text assertions, large CDP messages needed a larger reader
limit, and cleanup PID token substitution initially damaged `/PID`. Only test
Chrome instances created by this task were closed during recovery. Existing
user applications and saved settings were left alone.

Two legacy Python smoke tests initially stopped when full actual-Wasm correctness
consumed their 16.2-second data-stage cutoff. Their test-only allowance is now
180 seconds, with a 90-second subprocess/poll timeout; the scientific runner,
old protocols and experiment allowances are unchanged. An additional run safely
stopped after source files were edited while its immutability timer was active;
the final unchanged-source rerun passes all **38 Python tests** in 130.8 seconds.
The existing nonfatal subprocess ResourceWarnings remain visible in its log.

`NATIVE_CPU=native node scripts/native/build.mjs` now provides an explicit,
optional host-target build in `.local-research/native-host`, using `-march=native`
on x86 or `-mcpu=native` on ARM64. The default remains portable. Both retain
floating-point restrictions and complete flag/source/binary receipts. On this
PC, the default GCC target uses software `__popcountdi2`; both builds will be
measured rather than confusing that build choice with hardware performance.
The host build also passes all 15 native regression groups.

[Compact qualification and build identities](data/windows-pc-qualification-20261030.json).
Raw logs, extracted tools, temporary profiles and executable files stay ignored.

## Reproduction

From WSL2 bash, with Windows Chrome installed:

```bash
node scripts/native/build.mjs
node --test --test-concurrency=1 tests/*.test.mjs
NATIVE_SANITIZE=1 node --test --test-concurrency=1 tests/native-search.test.mjs tests/native-v2.test.mjs
NATIVE_RUN=.local-research/windows-pc-20261030 node scripts/native/qualify.mjs
python3 -m venv .local-research/windows-pc-20261030/venv
.local-research/windows-pc-20261030/venv/bin/pip install playwright==1.64.1 websockets==15.0.1
node scripts/wasm/fixtures.mjs
cp .local-research/wasm-20261030/fixtures.json .local-research/windows-pc-20261030/fixtures.json
.local-research/windows-pc-20261030/venv/bin/python scripts/windows-pc/qualify.py
REVERSI_WINDOWS_BROWSER=1 REVERSI_WASM_OUTPUT=.local-research/windows-pc-20261030 \
  .local-research/windows-pc-20261030/venv/bin/python tests/wasm_browser_check.py
```

Do not run timing benchmarks alongside qualification, sanitizers or profiling.
Final performance results, stress acceptance, resource ranges and optimization
recommendations are pending this checkpoint and are not inferred from Mac data.
