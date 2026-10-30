# Ubuntu 26.04 / Python 3.14 / GCC 15 qualification

This bounded final PC step starts from clean `main` at
`1e339d489a8ee4ade5b9a603d510a4331a0d12ae`, also verified by
`git ls-remote origin refs/heads/main`. It preserves all historical scientific
results and frozen B/L/P coefficients. The user's subsequent instruction omits
a matched old-executable GCC comparison; compiler timing comparisons use the
published GCC 11 results with their environmental limitations.

## Verified environment

Ubuntu **26.04.1 LTS**, Resolute Raccoon, x86-64; WSL **2.7.10.0**, kernel
**6.18.33.2-microsoft-standard-WSL2**, Windows **10.0.26300.9711**. `/etc/wsl.conf`
enables systemd; no user `.wslconfig` was found by the Windows audit. Windows
PowerShell interoperability works. The VM exposes 14 two-thread virtual cores /
28 logical processors for the i7-14700F; Windows' physical topology is distinct.
No distribution upgrade, service, power, firewall, page-file or WSL limit change
was made. Ordinary applications remain open.

The retained initial audit has **6.49 GiB Linux available** of 7.61 GiB and
**4.53 GiB Windows available** of 15.73 GiB OS-visible / 16 GiB installed.
The first terminal sample, taken before it, had 5.9 GiB Linux available.
Linux swap allocation is approximately **1 MiB**, and sampled `vmstat` swap
input/output is zero. Windows page input/output/read rates are zero in the
initial sample. Cumulative Linux swap counters are recorded; their historical
totals are not current paging rates. Free disk is about **885 GiB Linux** and
**349 GiB C:**. Linux load is about 0.35; Windows CPU is 10% in the retained
sample, including the audit itself. Sampled conditions are observations, not a
guarantee about all intervening desktop activity.

Largest visible consumers include the WSL VM (2.5 GiB working set), ordinary
Chrome (18 processes, about 2.1 GiB summed working sets), Windows services,
compression, Photos, Explorer, Steam, Defender and Codex. Summed working sets
include shared pages and private bytes are committed rather than resident RAM.
The visible Python 3.10 process belongs to the snap Ubuntu installer, outside
Reversi, and was left alone.

Tooling: `/usr/bin/python3` and `/usr/bin/python3.14` are **3.14.4**;
`gcc`, `g++` and `c++` are Ubuntu **15.2.0-16ubuntu1**; Node **24.16.0**, npm
**12.0.2**, Codex CLI **0.166.0**. No system Clang, `uv` or system perf executable
is on PATH. The previous pinned Emscripten SDK is not installed on this checkout.
Installed Windows Chrome is **156.0.8078.48**, Edge **156.0.4314.42**.

The previously extracted perf **5.15.222** remains executable on the WSL kernel.
Hardware `cycles`, `instructions`, `cache-misses` report **not supported**, even
though perf exits zero; software `cpu-clock:u` returns usable counts.
`perf_event_paranoid=2` was observed, not changed.

## Python modernization

`pyproject.toml` declares **Python >=3.13**, with no application packages.
The project `.venv` actually uses **CPython 3.14.4**, executable
`/home/rharris/git/reversi/.venv/bin/python`, prefix `.venv`, base prefix `/usr`.
The one existing browser environment had Python 3.10 metadata and packages but
a symlink to the upgraded system `python3`. It was retired locally and its old
path now links to `.venv`. No active Reversi environment uses Python 3.10.

Ubuntu's missing `ensurepip` initially prevented `python3.14 -m venv`. A
user-scoped PyPA virtualenv bootstrap created the environment without system
changes. No Python 3.13 fallback was necessary. Playwright **1.64.1**, WebSockets
**15.0.1**, Matplotlib **3.11.2**, NumPy **2.5.4** and all transitive dependencies
install successfully; `pip check`, driver startup, WebSocket imports and a real
Agg plot render pass. Exact versions are in
[`requirements-dev-pc-20261030.txt`](../requirements-dev-pc-20261030.txt).

Shell launch, Node subprocess selection and current research launchers select a
supported interpreter explicitly; Python child invocations use `sys.executable`.
The fixed completed-campaign completion script, frozen snapshots and hashed
execution repair specification remain provenance and are not active workflows.
See [WSL2/Mac/Codex/VS Code/Windows instructions](PYTHON_ENVIRONMENT.md).

The repeated `unrecognized arguments: --hours 16` message was an expected
negative CLI test. It now captures the diagnostic and verifies both its content
and exit status; the CLI still rejects the invalid authorization change.

## Correctness findings

Before modifications, the fast rules/native/committed-Wasm panel passes **23/23**.
An initial full Python run fails one embedded Node check with `Native executable
identity changed`: parallel fresh builds wrote the same live executable path.
Native builds now publish complete header/executable/receipt files by atomic
rename. A real concurrent-build regression compares both returned receipts
against the final binary hash. A serial prebuild also avoids needless duplicate
compiler work. This changes build publication, not engine mathematics.

The next full Python run passes **39/39** in 125.7 seconds; the final run with
diagnostic capture and the concurrent-build regression passes **39/39** in
**119.6 seconds**. The standalone Node suite passes **171/171** with no skipped
tests. ASan/UBSan and both optional target regression runs pass **15/15 groups**
each. Broad qualification checks **2,007 positions**, **12,042 B/L/P static
queries**, **96,720 legal children**, **96 fixed searches** and **12 independent
endgames**, with **zero maximum numerical error**, tolerance 1e-10. Regression
coverage includes full-window analyses and verified PVs, exact passes/terminal
empties, depths 15/16/64, deterministic interrupted-search recovery, TT bounds,
collisions and generation rollover. The final selected-Python/committed-Wasm
panel also passes **8/8** after SDK interpreter-selection changes. Existing nonfatal
HTTPError/subprocess ResourceWarnings are visible and are not skipped tests.

[Compact audit, complete build/interpreter identities and correctness evidence](data/ubuntu2604-qualification-20261030.json).

Portable remains the default native target. Explicit `NATIVE_CPU=native` retains
`-march=native` on x86 / `-mcpu=native` on ARM64. Explicit `NATIVE_CPU=popcnt`
adds only `-mpopcnt` on x86 and is rejected on other architectures. Every build
retains C++17, `-O3 -ffp-contract=off -fno-fast-math` and a complete build receipt.

The GCC exception-return correction remains in `Engine::search`: a separate
completed return value is assigned only after `root` finishes. The committed
Wasm was compiled before that source correction; its manifest still describes
its actual original source. The source difference is a target-independent
robustness measure in shared code, while the observed defect was GCC-specific.
Existing Wasm timeout tests have not demonstrated that defect. Future rebuilds
should include the correction and repeat deterministic interruption/fallback,
full-window/PV, exact/pass/deep-horizon, tiny-TT/generation and lifecycle tests.
No production Wasm rebuild is justified merely by differing fingerprints.
