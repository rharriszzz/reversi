# Native Reversi search engine

Implementation and engineering qualification are complete. The prescribed
768-game equal-time P/native versus P/JavaScript screen is being prepared under
[the frozen protocol](NATIVE_SEARCH_PROTOCOL.md). Results will be added after
complete-game and statistical auditing; no playing-strength conclusion is made
in this checkpoint.

The engine uses two 64-bit bitboards, allocation-free recursive negamax, a
bounded contiguous transposition table with full board/color verification,
iterative deepening, steady-clock deadlines and exact original B/L/P evaluation.
The original JavaScript search remains unchanged and usable. Persistent Node and
Python clients run entire searches inside C++; the new complete-game research
pipeline already passes interruption/replay checks.

Broad numerical qualification passed 2,007 positions, 12,042 static comparisons,
96 production-search comparisons and 12 independent eight-empty solutions with
zero observed numerical differences. Forced passes, terminal empty squares,
D4/color transforms, one-slot TT collisions, narrow-window bounds, horizon/model
changes, deadline fallbacks and cancellation have additional regression tests.

Profiling on the M4 identified pattern indexing and move-priority work as useful
moderate optimizations. Specialized constant-shift ternary indices and a
corner-occupancy priority table improved matched native P searches about 28%,
with identical scores and node counts. Final production-JavaScript comparisons,
full resource summaries and recommendations will be recorded with the complete
screen results.

Build and qualification:

```bash
npm run native:build
npm run native:test
NATIVE_SANITIZE=1 npm run native:test
node scripts/native/qualify.mjs
npm run native:play -- 80 P 2026103001
```

Apple Silicon execution and actual Chromium browser acceptance pass. Intel macOS
cross-compiles but was not executed (no Rosetta runtime on this host). Current
WSL2 and native Windows hardware are unavailable. The browser remains JavaScript;
no Wasm acceleration is claimed.
