# Language decision from the October engineering round

Keep JavaScript for the application, reference search, orchestration, and training experiments. Develop an optional C++ computational backend next, starting with batches of reference searches. The isolated prototype demonstrates a material benefit, but does not justify replacing the complete engine yet. C and Rust were investigated through their engineering tradeoffs and primary documentation; neither was benchmarked, and no numerical advantage over C++ is claimed.

## Matched prototype measurements

WSL2, i7-14700F, Node v24.16.0, GCC 11.4.0, `-O3 -std=c++17`, no CPU-specific instruction flags or fast-math. Three repetitions; medians below. All measurements use the existing frozen **trained** long-pattern margin tables, not zero weights. The native evaluator sums the same Float32 table cells into doubles, in the same record order, with the same clamping and perspective.

| Workload | JavaScript ms | Native computation ms | Native including startup/model/input/output ms | End-to-end speedup |
|---|---:|---:|---:|---:|
| 48 positions, depth 1, repeated 20 times | 13.30 | 6.53 | 12.95 | 1.03× |
| 48 positions, depth 4, repeated twice | 187.31 | 55.25 | 63.43 | 2.95× |
| Four middlegames, depth 6, repeated twice | 651.85 | 228.36 | 236.86 | 2.75× |

These are complete matched **search batches**, including legal generation, flips, terminal handling, pattern evaluation and alpha-beta. JavaScript tables are already loaded; native end-to-end includes launching the executable and reading its model. Thus cheap individual native calls are unattractive. Batch calls amortize the boundary cost.

The two kernels deliberately share ascending-square ordering, full-window negamax, pass-without-depth-decrement, terminal sentinels and no transposition table. Every score also agrees with the original JavaScript production search, but production uses different ordering/TT and visits different node counts. **This is not a measured 2.75× speedup of production timed play, self-play training, or the whole research campaign.** That integration remains the next acceptance gate.

The native bitboards use standard `uint64_t` masks. Compiled ternary tables are exported from JavaScript; native code contains no separate learned-weight interpretation. Across 48 seeded positions spanning opening through very late endgames, every legal set and every legal move's resulting Black/White board agree with JavaScript and the independent mailbox oracle. Static values agree within 1e-9; matched search nodes and evaluation counts agree exactly. Production search values agree too. Artifacts, binaries and model tables remain under `.local-research/next-native/`.

## Practical choices

| Language | Likely role and execution cost | Development and portability | Browser path |
|---|---|---|---|
| JavaScript | Reference and orchestration; good numerical typed arrays, but board scans, allocation and string TT keys cost time | Lowest maintenance cost in this repository; dependency-free browser play retained; Node workers support CPU work | Existing implementation |
| C++17 | Best next native prototype: bitboards, compact tables, contiguous TT and reusable buffers | Existing GCC works in WSL2; portable code should build with Apple Clang on Intel/Apple Silicon, but those machines were unavailable | Emscripten exports a small batch API; must measure Wasm separately |
| C | Similar low-level representation is possible; no evidence it would outperform equivalent C++ here | Smaller language, but explicit ownership, vectors and parsing add work; same native compiler targets | Emscripten also supports C |
| Rust | Comparable representations are plausible; no measured speed advantage | Ownership checking is useful, but introduces Cargo/toolchain and additional learning/integration work; no rustc installed on this host | wasm-bindgen or a small exported API; host filesystem/thread assumptions need separation |

Node's [worker documentation](https://nodejs.org/api/worker_threads.html) supports CPU-intensive JavaScript work through workers. Language switching is not required to use more cores. Its [Node-API documentation](https://nodejs.org/api/n-api.html) describes an ABI-stable native-addon interface, though external C++ libraries and binaries still need platform-specific build/testing.

For browser integration, [Emscripten's interface documentation](https://emscripten.org/docs/porting/connecting_cpp_and_javascript/Interacting-with-code.html) provides exported C/C++ calls and typed-memory access. Call whole searches or batches, retaining boards/tables inside the module, instead of crossing the boundary for each leaf. [Rust's target documentation](https://doc.rust-lang.org/rustc/platform-support/wasm32-unknown-unknown.html) describes its minimal WebAssembly target and unavailable OS facilities; native research I/O must remain outside that portable kernel.

A persistent executable accepting versioned requests is the least invasive first Node interface: one model-load operation, arrays of positions/depths, cancellation and structured result/error receipts. It can be replaced by Node-API if measured IPC becomes material. Estimated implementation effort is several focused engineering days for a reliable batched backend and equivalence suite, then additional days for Wasm/build/cancellation/browser validation; these are planning estimates, not measured completion times. Full search parity, deadlines, TT bounds, coach continuations and both macOS architectures remain necessary before production use.

## Reproduce

```bash
node scripts/next/native-benchmark.mjs .local-research/next-native-repeat
```

Requires the preserved trained model and a C++17 compiler named `g++`; on macOS Apple's compiler accepts that command when developer tools are installed. No compiler, Node addon, Rust installation or Wasm build is required to play the existing game. Actual native macOS and browser-Wasm execution were **not tested**.
