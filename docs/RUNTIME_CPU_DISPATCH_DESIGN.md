# Runtime CPU dispatch design

Experimental branch: `perf/runtime-cpu-dispatch`, based on qualified production
main `6b480ed`. Native dispatch is opt-in at build time:

```bash
NATIVE_CPU=dispatch node scripts/native/build.mjs
NATIVE_CPU=dispatch node scripts/native/play.mjs 80 P 2026103001
# Force the fallback in that same executable:
REVERSI_CPU_BACKEND=portable NATIVE_CPU=dispatch node scripts/native/play.mjs 80 P 2026103001
printf '1 hello\n' | .local-research/native-dispatch/reversi-native
```

`REVERSI_CPU_BACKEND=auto` is the default. `enhanced` is a guarded diagnostic
request: unsupported hardware is rejected before search; it cannot override
feature safety. Invalid values fail explicitly. Portable/native/popcnt standalone
build modes remain available and do not contain the enhanced backend.

## Organization and outer boundary

`native/engine-impl.inc` contains the single rules/evaluator/search implementation.
`native/engine.cpp` includes it with specialization ID 0 and helper namespace
`cpu_portable`; `native/engine-enhanced.cpp` includes it with ID 1 and namespace
`cpu_enhanced`. The integer is a compile-time symbol discriminator, never a
runtime recursive argument. Explicit private member specializations retain
normal member access to exactly one `Engine` object. There is no generic backend
framework, vtable, duplicated search algorithm or layout reinterpretation.

The public signatures of `Engine::search`, `analyze`, `windows`, `configure`,
constructor and `tableBytes` are retained. A private backend choice is set during
construction. Each public search operation branches once to the appropriate
specialization. Calls from root through negamax, final-empty solving, move
ordering, TT operations and rule/evaluation helpers bind statically within it.
The compiler sees the entire implementation under one target invocation.
The three outer branches are direct calls/jumps, not per-move function pointers.
`nextGeneration` is common baseline code called outside recursion. Allocation,
clock, exception and standard-library runtime calls remain normal external calls.

Public free functions (inspect/evalbench diagnostics and standalone rule API)
retain their portable implementation. Search calls its namespace-local helpers
directly, so it never bounces through the public wrapper at a leaf or move.
The diagnostic `hello` reply adds `cpuBackend` and four `cpuFeatures` fields;
protocol version, existing result fields and model identities are unchanged.

## Feature requirements and safety

For this experiment the native builder supports dispatch only with Linux x86-64
GCC. All ordinary/native paths, including macOS and Emscripten, still compile
`engine.cpp` alone. No Linux API or x86 intrinsic enters the shared algorithm.

Baseline compilation explicitly uses `-march=x86-64 -mtune=generic`.
The enhanced translation unit adds **only** `-mpopcnt -mbmi -mbmi2 -mlzcnt`.
It has compile-time guards against missing flags or incompatible targets. Both
retain `-O3 -std=c++17 -ffp-contract=off -fno-fast-math`, no LTO. The dispatcher,
constructor, native I/O, portable implementation and link invocation use baseline
flags. Neither target permits AVX, AVX2, AVX-512, FMA or an implicit native CPU.

GCC `__builtin_cpu_init` and `__builtin_cpu_supports` detect POPCNT, BMI1 (`bmi`),
BMI2 and LZCNT. One function-local static caches the process-wide feature result.
An engine selects from those actual features, never CPU names or PMU exposure.
The scalar extensions need no AVX register-state qualification. The i7's P/E
cores expose the required common features through WSL; this experiment does not
claim core-specific timing or permit host flags hidden by the guest.

The approach follows [GCC's x86 runtime detection documentation](https://gcc.gnu.org/onlinedocs/gcc-15.1.0/gcc/x86-Built-in-Functions.html).
Feature detection happens outside timed fixed batches/recursion. Environment
selection is read at construction; changing it later does not change an active
engine. Baseline REP-BSF encodings may disassemble as TZCNT; every operand is
nonzero, so execution as BSF on older hardware has the same defined result.
LZCNT is different and is forbidden in baseline code. Static inspection and
forced portable execution qualify the fallback here; no old physical CPU is
available. See the results for any additional emulator qualification.

## State and immutable data

Each engine retains its original single `vector<Entry>`, all flags, model,
deadline, node limit, generations and counters. Entry is still 40 bytes; nominal
16 MiB selects 262,144 entries, **10,485,760 bytes**. The backend flag adds no
second table or backend object. Exception unwinding leaves the same completed
iteration publication semantics. No copying between distinct state layouts,
allocation in the recursion, or new lifetime ownership rule is introduced.

`engine-tables.hpp` holds inline constexpr flipping geometry, move priorities
and P contribution tables in `reversi::detail`. External inline linkage gives
one read-only definition after linking each target object. Frozen arrays already
have inline constexpr linkage and remain in namespace `frozen`. Both backends
refer to the same data. `nm` verifies one 4,096-byte ray table, one 87,480-byte
pair of P coefficient arrays, one weight array and one of each contribution table.
Nothing is mutable or rebuilt based on CPUID.

## Layout, qualification and alternatives

Ordinary linking places the two implementation objects in separate sequential
text ranges, with separately named hot/cold functions; no linker script, ICF,
LTO or function-pointer recursion is enabled. Namespace isolation also separates
helper template instantiations. Shared standard-library code contains no
feature-specific bit operations, as checked in the static audit. The unused
backend consumes disk/address space but is not normally fetched into L1I.
Alignment beyond the compiler defaults requires measurement, not an assumption.

`scripts/runtime-cpu/assembly.py` records instruction counts, extension use,
branches, direct/indirect targets, addresses/alignment, section information and
shared-data symbols from actual linked executables. It rejects enhanced
instructions in portable application code and cross-backend/indirect calls in
the recursive search graph. Compact results and limits accompany the report.

GCC `target_clones` was considered. Independently cloning helpers does not by
itself promise a statically bound complete search graph; the exact-tail function
is deliberately out of line. Separate target invocations make that property
explicit and auditable without annotating every edge. There is no performance
claim against a whole-engine target_clones implementation and no second search
algorithm maintained for comparison. See [GCC's attribute semantics](https://gcc.gnu.org/onlinedocs/gcc/Common-Function-Attributes.html).

Neither the production manifest nor its distributed Wasm files are rebuilt or
edited. Their provenance still names the pre-refactor source, accurately.
Promotion would require fresh M4 compilation/correctness and a qualified Wasm
rebuild on the existing pinned Mac SDK, separately from this PC experiment.
