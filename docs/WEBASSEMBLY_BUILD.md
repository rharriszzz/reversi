# Reproducible WebAssembly engine

Running the application needs only Python 3 and a modern browser. Committed
`src/wasm/` resources contain the compiler output and frozen B/L/P coefficients;
no SDK, Node installation or remote computing service is required to play.

Developer build on macOS ARM64/Intel or WSL2 bash/zsh:

```bash
# Once: user-scoped pinned SDK, no shell startup or system settings changes.
scripts/wasm/setup.sh
node scripts/wasm/build.mjs
node --test tests/wasm-engine.test.mjs
node scripts/wasm/internals.mjs
```

Override the user-scoped SDK location with `REVERSI_EMSDK`. The setup script pins
emsdk tag and compiler **4.0.22**. It does not use a moving `latest` version.
The build rejects another compiler version. See the official
[SDK installation instructions](https://emscripten.org/docs/getting_started/downloads.html)
and [compiler settings](https://emscripten.org/docs/tools_reference/settings_reference.html).

The build emits a content-versioned ES module and `.wasm`, and `manifest.js`
containing SHA-256 source/header/artifact identities, full compiler version,
flags, frozen model identities and the unchanged 63 weights. The module exports
its build fingerprint and ABI version, verified at asynchronous initialization;
all three frozen identities must match before an engine handle is allocated.
Superseded generated outputs are removed only after successful compilation.
Generated distribution files are intentionally tracked. Local native executables,
headers, qualification binaries and build logs stay under ignored storage.

Compilation uses C++17, `-O3`, `-ffp-contract=off -fno-fast-math`, explicit C++
exception support, ES module modularization, no filesystem, no threads/SIMD,
32 MiB initial linear memory, 128 MiB maximum, 1 MiB stack and bounded memory
growth. `--profiling-funcs` preserves function names for actual browser profiles.
Complete exact flags are in the committed manifest. The default TT is the same
10 MiB allocation as native; browser handles accept nominal 0..32 MiB ceilings.
A test-only zero setting allocates one entry. There is no per-node allocation.

`native/engine.cpp` remains the principal search/evaluator implementation for
both targets. `native/main.cpp` provides only native process I/O.
`native/browser.cpp` provides only a C-compatible request boundary with owned
handles, structured JSON errors, split 32-bit bitboard halves, model identities,
inspect/search/all-move queries, diagnostics and release. No search/evaluation
callbacks cross to JavaScript. Clock checks call the runtime every 64 nodes in
timed search. The response string belongs to its handle until the next request;
the adapter copies/parses it immediately. Close is idempotent in the adapter;
calling a closed adapter fails before entering Wasm. Worker termination releases
the entire isolated module/linear memory during cancellation.

Shared `Engine::analyze` searches every legal alternative through full-window
negamax at the declared common placement horizon. It independently verifies each
PV reply by full-window value equality at the remaining depth. Passes retain
depth; terminal checks precede static evaluation. A failure to find a verified
reply returns a structured error, never an invented line. Solved metadata is
conservative and separate from exact depth-limited TT bounds. Playing retains
alpha sharing between root moves and only exposes its best score. Timed play
uses the natural empty-square limit and the last fully completed iteration;
depth-zero fallback has null score and is explicitly unsolved.

`src/wasm-engine.js` adapts to the existing board/result types. Static explanatory
linear contributions use the active frozen weights; P's additional pattern
correction is reported separately. Neither immediate breakdown is a causal
explanation of the backed-up minimax score. Custom-weight training stays in JS.

Qualification uses **actual Wasm execution** under Node, the native process and
an independent sentinel-board minimax/rules oracle. Tolerance is absolute 1e-10;
observed max numerical difference is recorded in the qualification certificate.
The standalone native assertion suite is also compiled to Wasm: all 174,960
ordered pattern-sum checks, generation rollover, same-depth analysis/PV checks,
node interruption and depth 64 execute there. These Node results establish Wasm
semantics; browser integration/measurements are qualified separately.
