import test from 'node:test';
import assert from 'node:assert/strict';
import { BLACK, WHITE, initialBoard, boardFromRows, parseCoord, play, legalMoves } from '../src/rules.js';
import { cloneWeights, DEFAULT_WEIGHTS, extractFeatures, evaluate } from '../src/features.js';
import { scoreAllMoves, terminalScore } from '../src/search.js';

test('static evaluator is antisymmetric for the same board', () => {
  let b = initialBoard();
  b = play(b, BLACK, parseCoord('D3'));
  for (const key of Object.keys(extractFeatures(b, BLACK))) {
    assert.ok(Math.abs(extractFeatures(b, BLACK)[key] + extractFeatures(b, WHITE)[key]) < 1e-10, key);
  }
  assert.ok(Math.abs(evaluate(b, BLACK) + evaluate(b, WHITE)) < 1e-10);
});

test('all opening legal moves receive exact same-depth scores', () => {
  const analyzed = scoreAllMoves(initialBoard(), BLACK, 3);
  assert.equal(analyzed.results.length, 4);
  assert.ok(analyzed.results.every(move => Number.isFinite(move.score) && move.pv[0] === move.notation));
  assert.ok(analyzed.nodes > 0);
  assert.deepEqual(analyzed.results.map(x => x.score), [...analyzed.results.map(x => x.score)].sort((a, b) => b - a));
  assert.ok(analyzed.results.every(x => x.immediate.phase === 'opening'));
});

test('immediate terminal win is better than a loss', () => {
  const b = boardFromRows(['.WBBBBBB','BBBBBBBB','BBBBBBBB','BBBBBBBB','BBBBBBBB','BBBBBBBB','BBBBBBBB','BBBBBBBB']);
  assert.equal(legalMoves(b, BLACK).length, 1);
  const result = scoreAllMoves(b, BLACK, 1);
  assert.equal(result.exact, true);
  assert.equal(result.results[0].notation, 'A1');
  assert.ok(result.results[0].score >= 10000);
  assert.ok(terminalScore(play(b, BLACK, parseCoord('A1')), WHITE) < 0);
});

test('weights are copied, not mutated', () => {
  const copy = cloneWeights();
  copy.opening.corners = 20;
  assert.equal(DEFAULT_WEIGHTS.opening.corners, 115);
});

// Endgame check against independent brute-force negamax (no alpha-beta, no TT).
test('search gives exact values for multiple small endgames', () => {
  const naive = (board, player) => {
    const moves = legalMoves(board, player);
    if (!moves.length) {
      return legalMoves(board, -player).length ? -naive(board, -player) : terminalScore(board, player);
    }
    return Math.max(...moves.map(m => -naive(play(board, player, m), -player)));
  };
  for (const seed of [11, 23, 41, 57]) {
    let board = initialBoard(), player = BLACK;
    let random = seed;
    // Pseudo-random deterministic legal play until four empty squares remain.
    while (board.filter(v => v === 0).length > 4) {
      const legal = legalMoves(board, player);
      if (!legal.length) {
        if (!legalMoves(board, -player).length) break;
        player = -player; continue;
      }
      random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
      board = play(board, player, legal[random % legal.length]);
      player = legalMoves(board, -player).length ? -player : legalMoves(board, player).length ? player : null;
      if (player === null) break;
    }
    if (player === null) continue;
    const remaining = board.filter(v => v === 0).length;
    const result = scoreAllMoves(board, player, Math.max(1, remaining));
    assert.equal(result.exact, true);
    for (const row of result.results) {
      const expected = -naive(play(board, player, row.move), -player);
      assert.equal(row.score, expected, `seed ${seed}, move ${row.notation}`);
    }
  }
});
