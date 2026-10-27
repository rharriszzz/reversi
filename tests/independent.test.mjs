import test from 'node:test';
import assert from 'node:assert/strict';
import { initialBoard, legalMoves, play, boardFromRows, parseCoord, isTerminal } from '../src/rules.js';
import { evaluate } from '../src/features.js';
import { scoreAllMoves } from '../src/search.js';
import { seededRandom } from '../src/learning.js';
import { oracleChildren, oracleScore } from './oracle.mjs';
import { reviewGame } from '../src/review.js';
import { continuationEvidence } from '../src/coaching.js';

test('independent mailbox rules agree throughout 20 seeded games; search solves final six empties', () => {
  const rng = seededRandom(817);
  let passes = 0;
  for (let game = 0; game < 20; game++) {
    let board = [...initialBoard()], player = 1;
    while (true) {
      const children = oracleChildren(board, player);
      assert.deepEqual(legalMoves(board, player), children.map(row => row.move));
      for (const child of children) assert.deepEqual([...play(board, player, child.move)], child.board);
      if (!children.length) {
        if (!oracleChildren(board, -player).length) break;
        passes++; player = -player; continue;
      }
      const empty = board.filter(value => value === 0).length;
      if (empty <= 6) {
        const analysis = scoreAllMoves(Int8Array.from(board), player, empty);
        assert.equal(analysis.exact, true);
        for (const row of analysis.results) {
          const child = children.find(child => child.move === row.move);
          assert.equal(row.score, -oracleScore(child.board, -player));
        }
        for (const depth of [1, 2]) {
          const limited = scoreAllMoves(Int8Array.from(board), player, depth);
          for (const row of limited.results.filter(row => row.exact)) {
            const child = children.find(child => child.move === row.move);
            assert.equal(row.score, -oracleScore(child.board, -player), 'Every solved label must match terminal oracle');
          }
        }
      }
      board = children[Math.floor(rng() * children.length)].board; player = -player;
    }
  }
  assert.ok(passes > 0);
});

test('full-window root values and verified continuations match exhaustive same-depth minimax', () => {
  const rng = seededRandom(15);
  let board = [...initialBoard()], player = 1;
  for (let ply = 0; ply < 36; ply++) {
    const children = oracleChildren(board, player);
    if (!children.length) { player = -player; continue; }
    if (ply % 6 === 0) for (const depth of [1, 2, 3]) {
      const analysis = scoreAllMoves(Int8Array.from(board), player, depth);
      for (const row of analysis.results) {
        const child = children.find(child => child.move === row.move);
        assert.equal(row.score, -oracleScore(child.board, -player, depth - 1, evaluate));
        let position = board, side = player, remaining = depth;
        for (const notation of row.pv) {
          const choices = oracleChildren(position, side);
          if (notation === 'pass') {
            assert.equal(choices.length, 0); assert.ok(oracleChildren(position, -side).length);
          } else {
            const chosen = choices.find(row => row.move === parseCoord(notation));
            assert.ok(chosen, notation);
            if (remaining < depth) assert.equal(-oracleScore(chosen.board, -side, remaining - 1, evaluate),
              oracleScore(position, side, remaining, evaluate));
            position = chosen.board; remaining--;
          }
          side = -side;
        }
        const backedUp = oracleScore(position, side, remaining, evaluate) * side * player;
        assert.equal(backedUp, row.score);
      }
    }
    board = children[Math.floor(rng() * children.length)].board; player = -player;
  }
});

test('early elimination is solved even with empty squares; terminal empty boards and passes', () => {
  const board = boardFromRows(['.WBBBBBB','BBBBBBBB','BBBBBBBB','BBBBBBBB','BBBBBBBB','BBBBBBBB','BBBBBBBB','BBBBBBB.']);
  const analysis = scoreAllMoves(board, 1, 1);
  assert.equal(analysis.exact, true);
  assert.equal(analysis.results[0].score, 10063);
  assert.equal(isTerminal(play(board, 1, 0)), true);
  assert.equal(scoreAllMoves(play(board, 1, 0), -1, 1).exact, true);
});

test('eight board symmetries preserve evaluator and same-depth move values', () => {
  let board = initialBoard(), player = 1;
  for (let ply = 0; ply < 17; ply++) { board = play(board, player, legalMoves(board, player).at(-1)); player = -player; }
  const original = scoreAllMoves(board, player, 3);
  for (let reflect = 0; reflect < 2; reflect++) for (let rotation = 0; rotation < 4; rotation++) {
    const map = i => {
      let r = i >> 3, c = i & 7;
      if (reflect) c = 7 - c;
      for (let n = 0; n < rotation; n++) [r, c] = [c, 7 - r];
      return 8 * r + c;
    };
    const transformed = new Int8Array(64);
    board.forEach((value, i) => { transformed[map(i)] = value; });
    assert.ok(Math.abs(evaluate(board, player) - evaluate(transformed, player)) < 1e-9);
    const result = scoreAllMoves(transformed, player, 3);
    for (const row of original.results) assert.equal(result.results.find(r => r.move === map(row.move)).score, row.score);
  }
});

test('game review ranks human decisions using fixed-depth search losses', () => {
  const history = [{ board: [...initialBoard()], player: 1, move: 19 }];
  const result = reviewGame(history, 3, undefined, 1);
  assert.equal(result.length, 1);
  assert.equal(result[0].loss, 0);
  assert.equal(result[0].depth, 3);
  assert.deepEqual(reviewGame(history, 3, undefined, -1), []);
});

test('coaching evidence records actual corner moves, passes and legal-move counts', () => {
  const board = boardFromRows(['.WBBBBBB','BBBBBBBB','BBBBBBBB','BBBBBBBB','BBBBBBBB','BBBBBBBB','BBBBBBBB','BBBBBBB.']);
  const facts = continuationEvidence(board, -1, ['pass', 'A1']);
  assert.deepEqual(facts[0], { player: -1, pass: true });
  assert.equal(facts[1].corner, true);
  assert.equal(facts[1].opponentMobility, 0);
  assert.equal(facts[1].ownMobility, 0);
  assert.throws(() => continuationEvidence(initialBoard(), 1, ['pass']));
});
