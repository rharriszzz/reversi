# WebAssembly module checkpoint

The standalone module passes qualification before UI integration. One shared
C++ engine serves native and Wasm. The native search/evaluation algorithms are
unchanged; a shared all-move/PV operation and a small C transport were added.
Frozen B, L and P identities match, with **zero maximum observed numerical
error** in 2,250 explicit comparisons (absolute tolerance 1e-10), including 600
static queries over disclosed phase roots and arbitrary occupancies, both turns
and all models. Features match exactly; independent rules validate every returned
child. Full-window all-move scores and every subsequent PV reply match the
independent minimax oracle at the declared horizon. Native fixed searches match.

Actual Wasm tests also cover exact alternatives, terminal empties, forced passes,
zero-horizon pass semantics, depths 15/16/64, tiny-TT collisions, upper/lower/full
windows, changing model/horizon, interrupted iterative deepening, unsolved null
score fallback, invalid inputs, 80 repeated search/analysis cycles with stable
linear memory, idempotent close and fail-closed ABI/model mismatches. The separate
standalone assertion executable runs as Wasm, including exhaustive frozen pattern
checks, generation rollover and native-independent all-move/PV comparisons.
No loose tolerance or expected floating-point discrepancy was needed.

The full suite passes 165 tests. All 15 native regression groups pass ASan/UBSan;
the extended shared analysis assertions execute both natively and as Wasm.
Two consecutive pinned production builds produce identical module and Wasm
hashes. [Certificate](data/wasm-qualification-20261030.json) records exact final
source, compiler, header, native executable, artifact and model identities.
[Build/interface details and commands](WEBASSEMBLY_BUILD.md) are reproducible.
This is actual Node-hosted Wasm qualification, not yet a real-browser acceptance
claim. No browser speed or playing-strength conclusion is inferred here.

Two development issues were repaired: memory accounting needed an explicit
HEAPU8 runtime export; the first PV test erroneously treated every candidate as
the globally best root move. Candidate scores are now checked separately and
only subsequent replies must maximize their subtree. Both failures remain in
local logs. Neither required a numerical/search correction.
