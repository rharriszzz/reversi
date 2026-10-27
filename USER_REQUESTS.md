There is a board game named reversi aka othello.  I used to be pretty good at it.  A long time I wrote a program to play it, using the alpha/beta search.  It was ok but it couldn't really beat me all the time.  One of the reasons was that computers were a lot slower 50 years ago.  I would like a program that can play this game against me, but that comes equipped with some ways that I can learn.  Such as reporting a score for all of my possible moves; also some way of explaining why one move is better than the others; and other ways for it to teach the strategy.  You get to choose whether to write the whole thing yourself, or give advice to codex.  I use github, my userid is rharriszzz.  If your github access is not great (effective for all the necessary tasks), then maybe codex is better.  Now either write the app yourself (If you are sure you will achieve success that way), or suggest a repo name, design a zip file with the initial content for that repo, tell me how to set it up, and then give me an initial prompt for codex.  The models gpt-6.1-sol and gpt-6-astra are the best at this time, but please also suggest a reasoning level.

---

"rather than spending the entire project reinventing alpha-beta search and positional evaluation."  I can help with that.  Plus, you can probably build a program that learns; as ai goes, this is easy.  Also, alpha/beta search is really really easy.  For this game positional evaluation is pretty easy too.

---

I am so sorry.  I forgot to mention that I want the code to work in Windows 11 WSL2, as well as the most recent mac OS.  Also if the repo name could be one word, I would appreciate it.  Most of the time I use WSL2.

---

I also want a markdown file that contains only my requests, and also whatever md files will help the process.

---

Read AGENTS.md, USER_REQUESTS.md, README.md, and CODEX_PROMPT.md.

Then execute the plan in CODEX_PROMPT.md, following the requirements and priorities in those files.

Run the tests, fix any problems, and commit and push your completed work.  Also, please make the http log go to a file rather than the terminal.  Also give me a summary of what the next steps could be.  I am hoping the code already has a reasonabley good positional evaluation.  If you are unsure about this, please plan a way to improve the evaluation, while also not taking very long.  Also, this counts as a user req

---

So I am working with chatgpt, and it says this: Please extend your current Reversi development plan with a new priority: **develop a mildly competent positional evaluation function, and investigate the tradeoff among evaluation quality, evaluation speed, and overall playing strength.**

I wrote Reversi programs using alpha-beta search in both assembler and Fortran on an IBM mainframe around 1982. I am familiar with the basic algorithms and would like this project to emphasize understandable, experimentally validated improvements. I suspect this game may not require advanced AI to produce a good opponent.

Review your existing plan and incorporate the following work. Do not discard or repeat completed tasks.

### 1. Establish a measurable baseline

Examine the existing features and weights in `src/features.js`, the search implementation in `src/search.js`, and the benchmarks already available.

Measure separately:

- Cost of a static position evaluation, including feature extraction.
- Search nodes per second, evaluations per second, and elapsed search time.
- Search depth attainable for a fixed computation budget.
- Playing performance against the current baseline and simple reference opponents.

Use representative opening, middlegame, and endgame positions, with reproducible seeds and measurements.

### 2. Investigate search overhead before complicating evaluation

I noticed that `bestMove()` currently invokes `scoreAllMoves()`, including verified principal variations for every move. This is useful for coaching but potentially wasteful during ordinary computer play and self-play training.

Investigate separating a fast playing search from the comprehensive coaching analysis. Ordinary play needs the best move; coaching needs comparable values and reliable continuations for every candidate.

If practical, implement this separation and measure its effect. Ensure both paths produce consistent optimal moves at the same depth, allowing for ties. Preserve the current coaching features.

### 3. Experiment with modest evaluation improvements

Retain the current evaluator as a baseline.

Start with inexpensive, interpretable improvements. My first candidates are corner-anchored stable edge discs and smoother transitions between opening, middlegame, and endgame weights. Consider late-game empty-region parity as a subsequent experiment.

Evaluate features individually before combining them. Avoid introducing complex features unless their incremental benefit justifies their evaluation cost.

Develop some tactical test positions that demonstrate clear strategic mistakes, and use independently solved endgames where appropriate.

The objective is a mildly competent evaluator, not an attempt to implement every technique in the Reversi literature.

### 4. Measure the three-way tradeoff

A more sophisticated evaluation may produce better estimates but reduce the number of positions searched.

Compare baseline and candidate evaluators under two conditions:

**Equal search depth:** Does the new evaluator make better strategic decisions?

**Equal elapsed computation budget:** Does the complete player become stronger after accounting for the additional evaluation cost?

Ideally, investigate several per-move time budgets. If time-limited search is not implemented yet, establish the necessary benchmarks and describe how to perform this comparison reliably.

Avoid confusing node counts, search depths, and elapsed time. All three are relevant.

### 5. Improve weights using modest learning experiments

The existing weight mutation and TD learning prototypes are worthwhile starting points.

Investigate whether a modest amount of self-play, parameter optimization, or supervised fitting to accurately solved positions can improve the weights.

Do not jump immediately to neural networks or large reinforcement-learning frameworks.

Use fresh held-out positions, paired games with both colors, and reproducible experiments. Report sample sizes and uncertainty. A small experiment showing a favorable score is not sufficient evidence of stronger play.

Retain the original weights as a reference and do not replace them unless there is convincing evidence of improvement.

### 6. Documentation and deliverables

Add the substance of this request to the current development plan, and append my latest request verbatim to `USER_REQUESTS.md`, maintaining that file's established user-only format.

Create `docs/EVALUATION_EXPERIMENTS.md` to record the baseline, experiments, parameter choices, performance measurements, results, and unanswered questions.

I want actual progress during this round, not merely recommendations. Aim to complete baseline measurements, investigate and preferably improve the playing-search overhead, and implement and test at least one modest evaluator enhancement.

If the results are disappointing, document the failure rather than prematurely introducing greater complexity.

Keep the application compatible with Windows 11 WSL2 and macOS. Run the relevant tests, update the documentation, and commit and push verified changes.

At the end, explain what was improved, what was learned, and which experiment you recommend next.
