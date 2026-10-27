import test from 'node:test';
import assert from 'node:assert/strict';
import { findBestMove, bestMove, scoreAllMoves } from '../src/search.js';
import { evaluate } from '../src/features.js';
import { initialBoard, boardFromRows, legalMoves, play } from '../src/rules.js';
import { randomOpening, seededRandom } from '../src/learning.js';
import { EVALUATORS } from '../src/evaluation.js';
import { oracleChildren, oracleScore } from './oracle.mjs';

test('playing search matches coaching optimal values/moves across phases and depths, allowing ties', () => {
  for (const seed of [113, 271, 811]) for (const plies of [8, 28, 52]) {
    const { board, player } = randomOpening(seededRandom(seed), plies);
    for (const depth of [1, 2, 3, 4]) {
      const coach = scoreAllMoves(board, player, depth), playing = findBestMove(board, player, depth);
      assert.equal(playing.score, coach.results[0].score);
      assert.equal(coach.results.find(row => row.move === playing.move).score, coach.results[0].score);
      assert.equal(playing.depth, depth);
      assert.ok(!Object.hasOwn(playing, 'pv') && !Object.hasOwn(playing, 'immediate'));
    }
  }
});

test('playing candidates match independent exhaustive same-depth minimax', () => {
  const { board, player } = randomOpening(seededRandom(583), 28);
  for (const evaluator of Object.values(EVALUATORS)) {
    const result = findBestMove(board, player, 3, undefined, { evaluate: evaluator });
    const value = oracleScore([...board], player, 3, evaluator);
    assert.equal(result.score, value);
    const chosen = oracleChildren([...board], player).find(row => row.move === result.move);
    assert.equal(-oracleScore(chosen.board, -player, 2, evaluator), value);
  }
});

test('playing search solves pass-heavy endgames and terminal positions independently', () => {
  const board = boardFromRows(['.WBBBBBB','BBBBBBBB','BBBBBBBB','BBBBBBBB','BBBBBBBB','BBBBBBBB','BBBBBBBB','BBBBBBB.']);
  assert.equal(findBestMove(board, -1, 2).move, null);
  assert.equal(findBestMove(board, -1, 2).score, oracleScore([...board], -1));
  const result = bestMove(board, 1, 1);
  assert.equal(result.move, 0); assert.equal(result.exact, true);
  const ended = play(board, 1, 0);
  assert.equal(bestMove(ended, -1, 1), null);
  assert.equal(findBestMove(ended, -1, 1).score, oracleScore([...ended], -1));
  for (const seed of [1531, 4117, 7813]) {
    const position = randomOpening(seededRandom(seed), 54);
    const expected = oracleScore([...position.board], position.player);
    for (const evaluator of Object.values(EVALUATORS)) {
      const solved = findBestMove(position.board, position.player, 6, undefined, { evaluate: evaluator });
      assert.equal(solved.exact, true);
      assert.equal(solved.score, expected);
      const child = oracleChildren([...position.board], position.player).find(row => row.move === solved.move);
      assert.equal(-oracleScore(child.board, -position.player), expected);
    }
  }
});

test('deadline search returns only a completed iteration or an explicitly unsearched fallback', () => {
  let ticks = 0;
  const fallback = findBestMove(initialBoard(), 1, 6, undefined, { timeMs: 0.5, now: () => ticks++ });
  assert.equal(fallback.depth, 0); assert.equal(fallback.score, null); assert.equal(fallback.exact, false);
  assert.ok(legalMoves(initialBoard(), 1).includes(fallback.move));
  ticks = 0;
  const timed = findBestMove(initialBoard(), 1, 6, undefined, { timeMs: 90, now: () => ticks++ });
  assert.ok(timed.depth > 0 && timed.depth < 6);
  assert.equal(timed.timedOut, true);
  const coach = scoreAllMoves(initialBoard(), 1, timed.depth);
  assert.equal(timed.score, coach.results[0].score);
  assert.equal(coach.results.find(row => row.move === timed.move).score, timed.score);
  assert.throws(() => findBestMove(initialBoard(), 1, 4, undefined, { timeMs: NaN }));
});

test('reported evaluations count actual evaluator calls, independently of nodes', () => {
  let calls = 0;
  const result = findBestMove(initialBoard(), 1, 3, undefined, {
    evaluate: (...args) => { calls++; return evaluate(...args); },
  });
  assert.equal(result.evaluations, calls);
  assert.ok(calls > 0 && result.nodes > calls);
});
