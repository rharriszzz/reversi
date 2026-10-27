# Repository instructions for Codex and other coding agents

## Authority and scope

Read `USER_REQUESTS.md` **first**. It preserves the user's own words and requirements. `README.md`, `docs/ARCHITECTURE.md`, and `CODEX_PROMPT.md` contain assistant-origin design decisions; distinguish those from actual user requests. Do not rewrite `USER_REQUESTS.md` unless the user provides additional requests, and then append those **verbatim**, chronologically, without assistant paraphrase.

Use repository name `reversi`; user account `rharriszzz`. Target **Windows 11 WSL2 as the primary development environment** and **current macOS (Apple Silicon and Intel)** as a coequal supported runtime. Keep Python 3 + modern-browser play dependency-free; Node 20+ is for tests only. Native Windows launch is a supported convenience but not the primary target.

## Development rules

- Keep the original game engine and alpha-beta search inspectable; third-party engines may be used only as independent, license-compliant test oracles without the user's approval to replace the engine.
- Run fast correctness tests before and after modifications. Test actual WSL2-to-Windows-browser launching and macOS behavior when hardware is available. Never claim a platform has been tested just because Linux tests pass.
- Every legal move's displayed score must use comparable search depth and coherent perspective. Label heuristic vs exact results accurately. An immediate heuristic feature breakdown is **not** an explanation of a deeper minimax score unless supported with causal evidence from actual continuations.
- Include full game rules, pass handling and terminal conditions; use independent endgame reference tests.
- When claiming learning improved the engine, use seeded holdout openings, paired games in both colors, fixed search budgets, sample sizes, and uncertainty. Avoid training/test leakage and false confidence.
- Prefer incremental, reviewable changes with measured benefits over complicated frameworks or new required toolchains.
- Update docs and tests when changing the rules, evaluator, supported platforms, or interaction behavior. Keep commands copyable in WSL2 bash and macOS zsh/bash.
- Do not commit generated archives, personal model exports, `node_modules`, browser caches, or secrets.
- If requested to commit or push, do so only after verifying tests and report exact commands, status, commit hash, and any blockers.

## Initial milestone

Follow `CODEX_PROMPT.md` and document findings in `docs/INITIAL_CODEX_REVIEW.md`. Distinguish verified facts, measurements, hypotheses, and unresolved platform-specific issues.
